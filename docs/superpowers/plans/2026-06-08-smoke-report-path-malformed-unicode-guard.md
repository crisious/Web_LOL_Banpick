# Smoke Report Path Malformed Unicode Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent malformed Unicode markers from being persisted in smoke report artifact paths.

**Architecture:** Keep validation in the existing direct smoke and report runner path normalizers. Add tests for unpaired surrogate code units at parser level and Unicode replacement character paths at CLI/env artifact-creation level, then reject both before network requests or report directory creation.

**Tech Stack:** Node.js ESM scripts, existing custom test harness under `test-artifacts/scripts`, Markdown operator docs.

---

### Task 1: Direct Smoke Malformed Unicode Report Path Guard

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Write failing parser tests**

Add these checks near the other `--report-json` path safety parser tests:

```js
checkThrows("parseSmokeArgs rejects surrogate report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/smoke-report-\ud800surrogate.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");

checkThrows("parseSmokeArgs rejects replacement character report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/smoke-report-\ufffdreplacement.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [ ] **Step 2: Write the failing CLI preflight test**

Add this check near the existing unsafe path CLI preflight tests:

```js
const replacementCharReportJsonPath = path.join("test-artifacts", "tmp", "smoke-report-\ufffdreplacement.json");
fs.rmSync(replacementCharReportJsonPath, { force: true });
const replacementCharReportJson = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  "--report-json=test-artifacts/tmp/smoke-report-\ufffdreplacement.json",
]);

check("CLI exits non-zero for replacement character report JSON path",
  replacementCharReportJson.status,
  1);

check("CLI reports replacement character report JSON path without network request",
  replacementCharReportJson.stderr.includes("FAIL --report-json must be a relative .json path under a test-artifacts subdirectory"),
  true);

check("CLI replacement character report JSON path does not create file",
  fs.existsSync(replacementCharReportJsonPath),
  false);
```

- [ ] **Step 3: Run direct smoke RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the new parser checks and CLI preflight check fail because malformed Unicode markers are currently accepted.

- [ ] **Step 4: Implement the direct smoke guard**

In `normalizeReportJsonPath()`, add this check after the Unicode format guard:

```js
if (/[\ufffd]|\p{Cs}/u.test(raw)) {
  throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
}
```

- [ ] **Step 5: Run direct smoke GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: direct smoke script syntax passes and direct smoke tests pass.

### Task 2: Smoke Report Runner Malformed Unicode Output Root Guard

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Modify: `scripts/run-smoke-report.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Write failing parser tests**

Add these checks near the other `--output-root` path safety parser tests:

```js
checkThrows("parseRunnerArgs rejects surrogate output root",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\ud800surrogate-root"], {}),
  "--output-root must be a relative path under a test-artifacts subdirectory");

checkThrows("parseRunnerArgs rejects replacement character output root",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\ufffdreplacement-root"], {}),
  "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [ ] **Step 2: Write the failing env artifact-creation test**

Add this check near the existing `SMOKE_REPORT_OUTPUT_ROOT` preflight tests:

```js
const replacementCharEnvOutputRoot = "test-artifacts/tmp/smoke-report-\ufffdreplacement-root";
const replacementCharEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-\ufffdreplacement-root");
fs.rmSync(replacementCharEnvCreatedPath, { recursive: true, force: true });
await checkRejects("runSmokeReport rejects replacement character env output root before artifact creation",
  () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: replacementCharEnvOutputRoot }),
  "--output-root must be a relative path under a test-artifacts subdirectory");
check("replacement character env output root rejection does not create output root",
  fs.existsSync(replacementCharEnvCreatedPath),
  false);
```

- [ ] **Step 3: Run runner RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the new parser checks and env artifact-creation check fail because malformed Unicode markers are currently accepted.

- [ ] **Step 4: Implement the runner guard**

In `normalizeOutputRoot()`, add this check after the Unicode format guard:

```js
if (/[\ufffd]|\p{Cs}/u.test(raw)) {
  throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
}
```

- [ ] **Step 5: Run runner GREEN**

Run:

```bash
node --check scripts/run-smoke-report.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: runner script syntax passes and runner tests pass.

### Task 3: Docs, Full QA, GitHub Sync, and Project Notes

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-path-malformed-unicode-guard.md`
- Update outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Document the operator contract**

Update the direct smoke and runner path contract paragraphs to mention Unicode surrogate code units and replacement characters.

- [ ] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node --check scripts/run-smoke-report.mjs &&
node --check test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs &&
npm test &&
git diff --check
```

Expected: all checks exit 0, direct smoke tests include the malformed Unicode checks, runner tests include the malformed Unicode checks, and the full suite passes.

- [ ] **Step 3: Commit and push implementation**

Stage only the implementation, tests, docs, and this plan:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-path-malformed-unicode-guard.md
git diff --cached --check
git commit -m "ci: reject malformed unicode smoke report paths"
git push origin main
```

- [ ] **Step 4: Verify GitHub Actions artifact**

Wait for the `QA` workflow on the pushed commit, download the `qa-automation-*` artifact, inspect `qa-summary.json`, and search the artifact for sensitive token/API patterns.

- [ ] **Step 5: Commit QA evidence and sync**

Update this plan with RED/GREEN/local/remote QA evidence, commit it, push it, verify the final GitHub Actions run, update the Obsidian project note, and finish with:

```bash
git pull --ff-only
git status -sb
git rev-list --left-right --count origin/main...HEAD
```

Expected: `main` and `origin/main` are synchronized and the working tree is clean.

---

## Execution Evidence

### RED

- Direct smoke RED:
  - Command: `node test-artifacts/scripts/external-demo-smoke-tests.mjs`
  - Result: `173 passed, 4 failed`
  - Expected failures:
    - `parseSmokeArgs rejects surrogate report JSON path` accepted `test-artifacts/tmp/smoke-report-\ud800surrogate.json`.
    - `parseSmokeArgs rejects replacement character report JSON path` accepted `test-artifacts/tmp/smoke-report-\ufffdreplacement.json`.
    - CLI path preflight did not emit the canonical `--report-json` failure before the smoke attempt.
    - `test-artifacts/tmp/smoke-report-\ufffdreplacement.json` was created.
- Smoke report runner RED:
  - Command: `node test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Result: `73 passed, 4 failed`
  - Expected failures:
    - `parseRunnerArgs rejects surrogate output root` accepted `test-artifacts/tmp/smoke-report-\ud800surrogate-root`.
    - `parseRunnerArgs rejects replacement character output root` accepted `test-artifacts/tmp/smoke-report-\ufffdreplacement-root`.
    - Runner env preflight did not reject `SMOKE_REPORT_OUTPUT_ROOT` before smoke execution.
    - `test-artifacts/tmp/smoke-report-\ufffdreplacement-root/...` was created.
- RED artifact cleanup:
  - Command: `find test-artifacts/tmp -maxdepth 1 -name '*replacement*' -print -exec rm -rf {} +`
  - Removed: `test-artifacts/tmp/smoke-report-\ufffdreplacement.json`, `test-artifacts/tmp/smoke-report-\ufffdreplacement-root`

### GREEN

- Focused GREEN:
  - Command: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Direct smoke tests: `177 passed, 0 failed`
  - Smoke report runner tests: `77 passed, 0 failed`
- Full local QA:
  - Command: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check`
  - Direct smoke tests: `177 passed, 0 failed`
  - Smoke report runner tests: `77 passed, 0 failed`
  - Full suite: `843 passed, 0 failed across 25 test file(s)`
