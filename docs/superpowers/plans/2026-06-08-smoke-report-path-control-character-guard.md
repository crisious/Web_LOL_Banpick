# Smoke Report Path Control Character Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make direct smoke `--report-json` and smoke report runner `--output-root` reject ASCII control characters before network requests or QA artifact creation.

**Architecture:** Keep validation in the existing path normalizers. Direct smoke validates report JSON file paths in `normalizeReportJsonPath()`, and the report runner validates output directories in `normalizeOutputRoot()`. Both should preserve the current empty, whitespace, backslash, absolute, dot-segment, repeated-slash, and artifact-tree checks while rejecting raw `\u0000-\u001f` / `\u007f` characters that could create confusing artifact names or logs.

**Tech Stack:** Node.js ES modules, zero-dependency CLI tests, existing smoke/report docs.

---

### Task 1: Add RED Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke parser test**

Add this check after the backslash report JSON parser check:

```js
checkThrows("parseSmokeArgs rejects control character report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/smoke-report-\u0007control.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [x] **Step 2: Add direct smoke CLI preflight test**

Add this check near the existing report JSON CLI preflight checks:

```js
const controlCharReportJsonPath = path.join("test-artifacts", "tmp", "smoke-report-\u0007control.json");
fs.rmSync(controlCharReportJsonPath, { force: true });
const controlCharReportJson = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  "--report-json=test-artifacts/tmp/smoke-report-\u0007control.json",
]);

check("CLI exits non-zero for control character report JSON path",
  controlCharReportJson.status,
  1);

check("CLI reports control character report JSON path without network request",
  controlCharReportJson.stderr.includes("FAIL --report-json must be a relative .json path under a test-artifacts subdirectory"),
  true);

check("CLI control character report JSON path does not create file",
  fs.existsSync(controlCharReportJsonPath),
  false);
```

- [x] **Step 3: Add report runner parser test**

Add this check after the backslash output-root parser check:

```js
  checkThrows("parseRunnerArgs rejects control character output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\u0007control-root"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [x] **Step 4: Add report runner env artifact-creation test**

Add this check near the existing env output root preflight checks:

```js
  const controlCharEnvOutputRoot = "test-artifacts/tmp/smoke-report-\u0007control-root";
  const controlCharEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-\u0007control-root");
  fs.rmSync(controlCharEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects control character env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: controlCharEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("control character env output root rejection does not create output root",
    fs.existsSync(controlCharEnvCreatedPath),
    false);
```

- [x] **Step 5: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: both commands fail because the parsers currently allow ASCII control characters inside artifact paths.

Observed: direct smoke RED `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `157 passed, 3 failed`. The parser accepted a control character report JSON path, the CLI failed later after a network request instead of preflight, and canonical `test-artifacts/tmp/smoke-report-\u0007control.json` was created. Runner RED `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `61 passed, 3 failed`; the parser accepted a control character output root, and env output root created `test-artifacts/tmp/smoke-report-\u0007control-root/...`. RED-created artifacts were removed before implementation.

### Task 2: Implement Control Character Guards

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Reject direct smoke report paths with ASCII control characters**

Change `normalizeReportJsonPath()` so it rejects raw ASCII control characters before slash/path validation:

```js
    if (/[\u0000-\u001f\u007f]/.test(raw)) {
      throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
    }
```

- [x] **Step 2: Reject report runner output roots with ASCII control characters**

Change `normalizeOutputRoot()` so it rejects raw ASCII control characters before slash/path validation:

```js
  if (/[\u0000-\u001f\u007f]/.test(raw)) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke and runner focused tests pass with the new control character checks.

Observed: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0. Direct smoke tests reported `160 passed, 0 failed`; smoke report runner tests reported `64 passed, 0 failed`.

### Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-path-control-character-guard.md`

- [x] **Step 1: Document control character rejection**

Update the direct smoke `--report-json` paragraph and the report runner output-root paragraph in README and the external demo runbook. State that path values containing ASCII control characters fail before network requests or artifact creation.

- [x] **Step 2: Record observed RED/GREEN evidence**

Update this plan with observed test counts and cleanup notes.

### Task 4: Full QA And Publish

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: focused tests pass, full suite passes, and control character check passes.

Observed: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` exited 0. Focused direct smoke tests reported `160 passed, 0 failed`; smoke report runner tests reported `64 passed, 0 failed`; the full suite reported `813 passed, 0 failed across 25 test file(s)`.

- [x] **Step 2: Commit and push implementation evidence**

Run:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-path-control-character-guard.md
git commit -m "ci: reject control characters in smoke report paths"
git push origin main
```

Observed: implementation commit `5f5dfe0 ci: reject control characters in smoke report paths` was pushed to `origin/main`.

- [x] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir /tmp/<download-dir>
```

Expected: GitHub Actions QA succeeds, `qa-summary.json` reports read-only smoke `155 passed / 0 failed` or higher, and artifact sensitive-value scan has no matches.

Observed: GitHub Actions QA run `27109087381` completed successfully for `5f5dfe0`. Artifact `7469328706` / `qa-automation-27109087381` contained `qa-summary.json` with read-only `actualMode=readonly`, `checkCount=155`, and `155 passed / 0 failed`. Sensitive-value scan over the downloaded artifact found no matches for token, Authorization, Riot key, match id, or lock-key patterns.

- [ ] **Step 4: Update Obsidian**

Append a cycle log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local QA, remote run, artifact id, and sensitive-value scan result.

Deferred: Obsidian update is applied after the final docs evidence run so the project note can reference the final `main` hash and final QA artifact.
