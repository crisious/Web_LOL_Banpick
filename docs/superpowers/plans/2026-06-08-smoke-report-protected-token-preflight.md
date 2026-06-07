# Smoke Report Protected Token Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject protected smoke report runs without a usable token source before report directories or metadata artifacts are created.

**Architecture:** Keep `scripts/run-smoke-report.mjs` as the report runner preflight owner. Validate protected-mode token availability after mode/base URL validation and before `runSmokeReport()` creates the report directory, matching the direct smoke CLI contract that `--require-token` needs either `--token` or `PUBLIC_DEMO_TOKEN`.

**Tech Stack:** Node.js ESM scripts, zero-dependency runner parser tests under `test-artifacts/scripts`, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Protected Token Source Coverage

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add missing token parser test**

Add this near the existing pass-through validation tests:

```js
checkThrows("parseRunnerArgs rejects protected mode without token source",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=protected"], {}),
  "--require-token needs --token or PUBLIC_DEMO_TOKEN");
```

- [x] **Step 2: Add accepted env token parser test**

Add this near the new missing-token check:

```js
check("parseRunnerArgs accepts protected mode with env token",
  runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=protected"], { PUBLIC_DEMO_TOKEN: "env-token" }),
  {
    mode: "protected",
    baseUrl: "http://127.0.0.1:8123",
    expectedMode: "protected",
    outputRoot: "test-artifacts/qa-automation",
    requiresUrl: false,
    requiresHttps: false,
    requiresToken: true,
    extraSmokeArgs: [],
  });
```

- [x] **Step 3: Add empty inline token parser test**

Add this near the token checks:

```js
checkThrows("parseRunnerArgs rejects protected mode with empty inline token",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=protected", "--token=   "], { PUBLIC_DEMO_TOKEN: "env-token" }),
  "--require-token needs --token or PUBLIC_DEMO_TOKEN");
```

- [x] **Step 4: Add no-artifact failure test**

Add this near the existing no-artifact invalid pass-through test:

```js
const missingTokenOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-missing-token");
fs.rmSync(missingTokenOutputRoot, { recursive: true, force: true });
await checkRejects("runSmokeReport rejects missing protected token before artifact creation",
  () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", "--mode=protected", `--output-root=${missingTokenOutputRoot}`], {}),
  "--require-token needs --token or PUBLIC_DEMO_TOKEN");
check("missing protected token does not create output root",
  fs.existsSync(missingTokenOutputRoot),
  false);
```

- [x] **Step 5: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the new missing-token and empty-token checks fail because `parseRunnerArgs` currently only records `requiresToken`; `runSmokeReport()` creates a report output root before child smoke rejects the missing token.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `28 passed, 4 failed`. The protected missing-token run created `test-artifacts/tmp/smoke-report-missing-token/...` before child smoke failed, proving the artifact-creation gap.

### Task 2: Implement Protected Token Source Preflight

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add token source helper**

Add this near the validation helpers:

```js
function inlineTokenValue(extraSmokeArgs) {
  const tokenArg = passThroughOptionArg(extraSmokeArgs, "--token=");
  return tokenArg ? tokenArg.slice("--token=".length).trim() : "";
}
```

- [x] **Step 2: Validate protected token source after mode/base URL**

After `isProtected` is computed and after external URL preflight, add:

```js
  if (isProtected) {
    const tokenArg = passThroughOptionArg(extraSmokeArgs, "--token=");
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

Expected: runner tests pass with protected token source preflight and no-artifact checks.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0 with `32 passed, 0 failed`, including missing-token no-artifact checks.

### Task 3: Verify, Document, And Sync

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-protected-token-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document protected token source preflight**

State that `smoke:report:protected` and `smoke:report:external:protected` require a non-empty `--token` or `PUBLIC_DEMO_TOKEN` before artifact creation.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: syntax check, focused runner suite, full test suite, and whitespace check all pass.

Observed: command exited 0. Focused runner suite reported `32 passed, 0 failed`; full `npm test` reported `738 passed, 0 failed across 25 test file(s)`; `git diff --check` reported no whitespace errors.

- [x] **Step 3: Commit and push**

Run:

```bash
git add scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-protected-token-preflight.md
git commit -m "ci: preflight protected smoke report tokens"
git push origin main
```

Expected: commit lands on `main` and push triggers GitHub Actions QA.

Observed: committed and pushed `e7786b04dca5189095db39e90116c3dcc11a2efe` to `main` with message `ci: preflight protected smoke report tokens`.

- [x] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 5
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: latest run for the pushed head SHA succeeds, uploaded artifact contains `qa-summary.json`, read-only smoke reports zero failures, and sensitive-value search has no matches.

Observed: GitHub Actions QA run `27106401270` completed successfully for head SHA `e7786b04dca5189095db39e90116c3dcc11a2efe`. Artifact `qa-automation-27106401270` / ID `7468496160` contained `qa-summary.json`, `smoke-run.json`, and `smoke-report.json`; `qa-summary.json` recorded read-only smoke `155 passed, 0 failed`. Sensitive-value search across the downloaded artifact directory found no matches.
