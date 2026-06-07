# Direct Smoke Token Scope Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent direct read-only smoke checks from attaching demo tokens to live/write probes.

**Architecture:** Keep token parsing inside `scripts/external-demo-smoke.mjs`. Treat tokens as protected-mode material only: inline `--token=<value>` is accepted only with `--require-token --expect-mode=protected`, and `PUBLIC_DEMO_TOKEN` is read only for that protected path. Read-only/full smoke ignores ambient env tokens and rejects inline tokens before network requests.

**Tech Stack:** Node.js ESM scripts, zero-dependency parser/CLI tests under `test-artifacts/scripts`, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Coverage For Direct Readonly Token Scope

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Write failing parser tests**

Add parser checks near the existing token parser tests:

```js
checkThrows("parseSmokeArgs rejects readonly inline token",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "https://demo.example", "--token=abc", "--expect-mode=readonly"], {}),
  "--token is only accepted with --require-token and --expect-mode=protected");

check("parseSmokeArgs ignores env token for readonly smoke",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expect-mode=readonly"], { PUBLIC_DEMO_TOKEN: "env-token" }),
  { baseUrl: "http://127.0.0.1:8123", demoToken: "", expectedMode: "readonly", minSamples: 1, requestTimeoutMs: 10000 });

checkThrows("parseSmokeArgs rejects require-token outside protected expected mode",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-token", "--expect-mode=readonly"], { PUBLIC_DEMO_TOKEN: "env-token" }),
  "--require-token is only accepted with --expect-mode=protected");
```

- [x] **Step 2: Write failing CLI pre-network test**

Add a closed-port CLI check:

```js
const readonlyToken = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  "--token=secret-readonly-token",
]);

check("CLI exits non-zero for readonly inline token",
  readonlyToken.status,
  1);

check("CLI reports readonly inline token before network request",
  readonlyToken.stderr.includes("FAIL --token is only accepted with --require-token and --expect-mode=protected") &&
    !readonlyToken.stderr.includes("FAIL request /healthz failed"),
  true);
```

- [x] **Step 3: Run RED test**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: new readonly token checks fail because direct smoke currently accepts inline/env tokens outside protected token-required mode.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `125 passed, 4 failed`. The parser still accepted read-only inline tokens, used ambient `PUBLIC_DEMO_TOKEN` for read-only smoke, accepted `--require-token --expect-mode=readonly`, and the CLI reached the network-failure path instead of failing on the readonly token preflight.

### Task 2: Restrict Direct Smoke Token Parsing

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Move expected mode validation before token material**

Compute and validate `expectedMode` before deriving `demoToken`.

- [x] **Step 2: Add token scope guard**

Implement:

```js
  if (requireToken && expectedMode !== "protected") {
    throw new Error("--require-token is only accepted with --expect-mode=protected");
  }
  if (tokenArg && !requireToken) {
    throw new Error("--token is only accepted with --require-token and --expect-mode=protected");
  }
  const demoToken = requireToken
    ? (tokenArg ? tokenArg.slice("--token=".length) : env.PUBLIC_DEMO_TOKEN || "").trim()
    : "";
```

Keep the existing missing-token message for protected token-required smoke.

- [x] **Step 3: Update valid protected token tests**

Add `--require-token` to existing protected direct smoke tests that intentionally pass `--token=protected-token`. Remove the unnecessary `--token=secret-smoke-token` from the read-only sample list report fixture.

- [x] **Step 4: Run focused GREEN test**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: all external demo smoke tests pass.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 0 and reported `130 passed, 0 failed`.

### Task 3: Document Contract And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-direct-smoke-token-scope-guard.md`

- [x] **Step 1: Document direct token scope**

State that direct smoke accepts inline/env tokens only for `--require-token --expect-mode=protected`; read-only/full smoke rejects inline tokens and ignores ambient `PUBLIC_DEMO_TOKEN`.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check
```

Expected: command exits 0, focused direct smoke tests pass, full suite passes, and diff check has no output.

Observed:

`node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check` exited 0. Focused direct smoke tests reported `130 passed, 0 failed`; the full npm suite reported `760 passed, 0 failed across 25 test file(s)`; `git diff --check` produced no output.

- [x] **Step 3: Commit and push**

Run:

```bash
git add scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-direct-smoke-token-scope-guard.md
git commit -m "ci: scope direct smoke tokens to protected checks"
git push origin main
```

Expected: commit lands on `main` and pushes to `origin/main`.

Observed:

Commit `d8a1d8c` (`ci: scope direct smoke tokens to protected checks`) landed on `main` and pushed to `origin/main`.

- [x] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 6
gh run watch <run-id> --exit-status
gh run view <run-id> --json conclusion,headSha,status,url,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Download `qa-automation-<run-id>`, inspect `qa-summary.json`, and scan for sensitive values.

Expected: latest run for the pushed head SHA succeeds, uploaded artifact contains `qa-summary.json`, read-only smoke reports zero failures, and sensitive-value search has no matches.

Observed:

GitHub Actions QA run `27107151988` completed successfully for head SHA `d8a1d8c1f4c8ef7072aeb300d63e1f6a73a7ddc3`. Artifact `qa-automation-27107151988` (`7468746983`) was downloaded and inspected. `qa-summary.json` recorded read-only smoke status `passed`, `actualMode=readonly`, `expectedMode=readonly`, and `155 passed, 0 failed`; `smoke-report.json` matched that summary with `checkCount=155`. Sensitive-value scan across the downloaded artifact produced no matches.

- [ ] **Step 5: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed:
