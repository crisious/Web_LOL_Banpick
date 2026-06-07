# Smoke Report Path Whitespace Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make direct smoke `--report-json` and smoke report runner `--output-root` reject path values with leading or trailing whitespace before network requests or QA artifact creation.

**Architecture:** Keep path validation in the two existing CLI parsers. Direct smoke validates report JSON file paths in `normalizeReportJsonPath()`, and the report runner validates output directories in `normalizeOutputRoot()`. Both should keep the current empty-value errors, but should no longer trim a non-empty path into a different valid artifact location.

**Tech Stack:** Node.js ES modules, zero-dependency CLI tests, existing smoke/report docs.

---

### Task 1: Add RED Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke parser tests**

Add these checks after the repeated separator report JSON parser checks:

```js
checkThrows("parseSmokeArgs rejects leading whitespace report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json= test-artifacts/tmp/smoke-report.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");

checkThrows("parseSmokeArgs rejects trailing whitespace report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/smoke-report.json "], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [x] **Step 2: Add direct smoke CLI preflight test**

Add this check near the existing report JSON CLI preflight checks:

```js
const whitespaceReportJsonPath = path.join("test-artifacts", "tmp", "smoke-report-whitespace.json");
fs.rmSync(whitespaceReportJsonPath, { force: true });
const whitespaceReportJson = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  "--report-json=test-artifacts/tmp/smoke-report-whitespace.json ",
]);

check("CLI exits non-zero for whitespace report JSON path",
  whitespaceReportJson.status,
  1);

check("CLI reports whitespace report JSON path without network request",
  whitespaceReportJson.stderr.includes("FAIL --report-json must be a relative .json path under a test-artifacts subdirectory"),
  true);

check("CLI whitespace report JSON path does not create file",
  fs.existsSync(whitespaceReportJsonPath),
  false);
```

- [x] **Step 3: Add report runner parser tests**

Add these checks after the repeated separator output-root checks:

```js
  checkThrows("parseRunnerArgs rejects leading whitespace output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root= test-artifacts/qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects trailing whitespace output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/qa-automation "], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [x] **Step 4: Add report runner env artifact-creation test**

Add this check near the existing env output root preflight checks:

```js
  const whitespaceEnvOutputRoot = " test-artifacts/tmp/smoke-report-whitespace-root";
  const whitespaceEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-whitespace-root");
  fs.rmSync(whitespaceEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects whitespace env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: whitespaceEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("whitespace env output root rejection does not create output root",
    fs.existsSync(whitespaceEnvCreatedPath),
    false);
```

- [x] **Step 5: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: both commands fail because the parsers currently trim non-empty whitespace-wrapped paths.

Observed: direct smoke RED `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `148 passed, 4 failed`. The parser checks for leading/trailing whitespace did not throw, and the CLI preflight test wrote canonical `test-artifacts/tmp/smoke-report-whitespace.json` after a failed `/healthz` request. Runner RED `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `54 passed, 4 failed`; whitespace output roots normalized, and env output root created `test-artifacts/tmp/smoke-report-whitespace-root/...`.

### Task 2: Implement Whitespace Guards

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Reject whitespace-wrapped direct smoke report paths**

Change `normalizeReportJsonPath()` from trimming into the canonical input to comparing the original raw string first:

```js
    const raw = reportPath;
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error("--report-json needs a file path");
    }
    if (trimmed !== raw) {
      throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
    }
```

- [x] **Step 2: Reject whitespace-wrapped report runner output roots**

Change `normalizeOutputRoot()` from trimming into the canonical input to comparing the original raw string first:

```js
  const raw = outputRoot;
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("--output-root needs a directory path");
  }
  if (trimmed !== raw) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke and runner focused tests pass with the new whitespace checks.

Observed: after removing RED artifacts, `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0. Direct smoke tests reported `152 passed, 0 failed`; smoke report runner tests reported `58 passed, 0 failed`.

### Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-path-whitespace-guard.md`

- [x] **Step 1: Document whitespace rejection**

Update the direct smoke `--report-json` paragraph and the report runner output-root paragraph in README and the external demo runbook. State that leading/trailing whitespace around path values fails before network requests or artifact creation.

- [x] **Step 2: Record observed RED/GREEN evidence**

Update this plan with the observed test counts and cleanup notes.

### Task 4: Full QA And Publish

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: focused tests pass, full suite passes, and whitespace check passes.

Observed: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` exited 0. Focused direct smoke tests reported `152 passed, 0 failed`; smoke report runner tests reported `58 passed, 0 failed`; the full suite reported `799 passed, 0 failed across 25 test file(s)`.

- [x] **Step 2: Commit and push implementation evidence**

Run:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-path-whitespace-guard.md
git commit -m "ci: reject whitespace smoke report paths"
git push origin main
```

Observed: implementation commit `fe71705 ci: reject whitespace smoke report paths` was pushed to `origin/main`.

- [x] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir /tmp/<download-dir>
```

Expected: GitHub Actions QA succeeds, `qa-summary.json` reports read-only smoke `155 passed / 0 failed` or higher, and artifact sensitive-value scan has no matches.

Observed: GitHub Actions QA run `27108605832` completed successfully for `fe71705`. Artifact `7469194587` / `qa-automation-27108605832` contained `qa-summary.json` with read-only `actualMode=readonly`, `checkCount=155`, and `155 passed / 0 failed`. Sensitive-value scan over the downloaded artifact found no matches for token, Authorization, Riot key, match id, or lock-key patterns.

- [ ] **Step 4: Update Obsidian**

Append a cycle log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local QA, remote run, artifact id, and sensitive-value scan result.

Deferred: Obsidian update is applied after the final docs evidence run so the project note can reference the final `main` hash and final QA artifact.
