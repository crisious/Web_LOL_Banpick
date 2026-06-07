# Smoke Report Readonly Token Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent read-only smoke report runs from forwarding demo tokens to read-only smoke probes.

**Architecture:** Keep `scripts/run-smoke-report.mjs` as the report-runner credential boundary. Allow `--token=<value>` only for `protected` and `external-protected` report modes, while preserving env-token support for protected modes and avoiding artifact creation when a read-only report receives a token.

**Tech Stack:** Node.js ESM scripts, zero-dependency runner parser tests under `test-artifacts/scripts`, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Read-Only Token Guard Coverage

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add read-only token parser rejection test**

Add this near the protected token source checks:

```js
checkThrows("parseRunnerArgs rejects readonly mode with token pass-through",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--token=secret"], {}),
  "--token is only accepted for protected smoke reports");
```

- [x] **Step 2: Add external read-only token parser rejection test**

Add this near the read-only token check:

```js
checkThrows("parseRunnerArgs rejects external readonly mode with token pass-through",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-readonly", "https://demo.example.com", "--token=secret"], {}),
  "--token is only accepted for protected smoke reports");
```

- [x] **Step 3: Add no-artifact failure test**

Add this near the existing no-artifact runner checks:

```js
const readonlyTokenOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-readonly-token");
fs.rmSync(readonlyTokenOutputRoot, { recursive: true, force: true });
await checkRejects("runSmokeReport rejects readonly token before artifact creation",
  () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", `--output-root=${readonlyTokenOutputRoot}`, "--token=secret"], {}),
  "--token is only accepted for protected smoke reports");
check("readonly token rejection does not create output root",
  fs.existsSync(readonlyTokenOutputRoot),
  false);
```

- [x] **Step 4: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the new checks fail because read-only report modes currently accept and forward `--token`.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `32 passed, 4 failed`. The read-only token run created `test-artifacts/tmp/smoke-report-readonly-token/...` before child smoke failed to connect, proving the artifact-creation gap.

### Task 2: Implement Read-Only Token Rejection

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Reject token for non-protected modes**

After external URL preflight and before protected token-source validation, add:

```js
  const tokenArg = passThroughOptionArg(extraSmokeArgs, "--token=");
  if (!isProtected && tokenArg) {
    throw new Error("--token is only accepted for protected smoke reports");
  }
```

- [x] **Step 2: Reuse `tokenArg` in protected validation**

Update the protected block to reuse the local `tokenArg`:

```js
  if (isProtected) {
    const demoToken = tokenArg ? inlineTokenValue(extraSmokeArgs) : (env.PUBLIC_DEMO_TOKEN || "").trim();
    if (!demoToken) {
      throw new Error("--require-token needs --token or PUBLIC_DEMO_TOKEN");
    }
  }
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: runner tests pass with read-only token rejection and no-artifact checks.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0 with `36 passed, 0 failed`, including read-only token no-artifact checks.

### Task 3: Verify, Document, And Sync

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-readonly-token-guard.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document read-only token guard**

State that `smoke:report:readonly` and `smoke:report:external:readonly` reject `--token` before artifact creation, because tokens are only meaningful for protected report modes.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: syntax check, focused runner suite, full test suite, and whitespace check all pass.

Observed: command exited 0. Focused runner suite reported `36 passed, 0 failed`; full `npm test` reported `742 passed, 0 failed across 25 test file(s)`; `git diff --check` reported no whitespace errors.

- [x] **Step 3: Commit and push**

Run:

```bash
git add scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-readonly-token-guard.md
git commit -m "ci: reject readonly smoke report tokens"
git push origin main
```

Expected: commit lands on `main` and push triggers GitHub Actions QA.

Observed: committed and pushed `691fc197703097143d23b4e91b5f5e1468828188` to `main` with message `ci: reject readonly smoke report tokens`.

- [x] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 5
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: latest run for the pushed head SHA succeeds, uploaded artifact contains `qa-summary.json`, read-only smoke reports zero failures, and sensitive-value search has no matches.

Observed: GitHub Actions QA run `27106536567` completed successfully for head SHA `691fc197703097143d23b4e91b5f5e1468828188`. Artifact `qa-automation-27106536567` / ID `7468539793` contained `qa-summary.json`, `smoke-run.json`, and `smoke-report.json`; `qa-summary.json` recorded read-only smoke `155 passed, 0 failed`. Sensitive-value search across the downloaded artifact directory found no matches.
