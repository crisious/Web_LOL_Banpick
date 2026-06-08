# Smoke Report Path Backslash Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make direct smoke `--report-json` and smoke report runner `--output-root` reject literal backslashes before network requests or QA artifact creation.

**Architecture:** Keep the guard in the two existing CLI path normalizers. Direct smoke validates report JSON file paths in `normalizeReportJsonPath()`, and the report runner validates output directories in `normalizeOutputRoot()`. Both should preserve the current empty, whitespace, absolute, dot-segment, repeated-slash, and artifact-tree checks, but should no longer translate `\` into `/` for operator-provided artifact paths.

**Tech Stack:** Node.js ES modules, zero-dependency CLI tests, existing smoke/report docs.

---

### Task 1: Add RED Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke parser test**

Add this check after the whitespace report JSON parser checks:

```js
checkThrows("parseSmokeArgs rejects backslash report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts\\tmp\\smoke-report.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [x] **Step 2: Add direct smoke CLI preflight test**

Add this check near the existing report JSON CLI preflight checks:

```js
const backslashReportJsonPath = path.join("test-artifacts", "tmp", "smoke-report-backslash.json");
fs.rmSync(backslashReportJsonPath, { force: true });
const backslashReportJson = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  "--report-json=test-artifacts\\tmp\\smoke-report-backslash.json",
]);

check("CLI exits non-zero for backslash report JSON path",
  backslashReportJson.status,
  1);

check("CLI reports backslash report JSON path without network request",
  backslashReportJson.stderr.includes("FAIL --report-json must be a relative .json path under a test-artifacts subdirectory"),
  true);

check("CLI backslash report JSON path does not create file",
  fs.existsSync(backslashReportJsonPath),
  false);
```

- [x] **Step 3: Add report runner parser test**

Add this check after the whitespace output-root parser checks:

```js
  checkThrows("parseRunnerArgs rejects backslash output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts\\qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [x] **Step 4: Add report runner env artifact-creation test**

Add this check near the existing env output root preflight checks:

```js
  const backslashEnvOutputRoot = "test-artifacts\\tmp\\smoke-report-backslash-root";
  const backslashEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-backslash-root");
  fs.rmSync(backslashEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects backslash env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: backslashEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("backslash env output root rejection does not create output root",
    fs.existsSync(backslashEnvCreatedPath),
    false);
```

- [x] **Step 5: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: both commands fail because the parsers currently normalize backslashes into slash-separated artifact paths.

Observed: direct smoke RED `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `153 passed, 3 failed`. The parser accepted a backslash report JSON path, the CLI failed later after a network request instead of preflight, and canonical `test-artifacts/tmp/smoke-report-backslash.json` was created. Runner RED `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `58 passed, 3 failed`; the parser normalized a backslash output root, and env output root created `test-artifacts/tmp/smoke-report-backslash-root/...`. RED-created artifacts were removed before implementation.

### Task 2: Implement Backslash Guards

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Reject direct smoke report paths with literal backslashes**

Change `normalizeReportJsonPath()` so it rejects a raw backslash before slash normalization:

```js
    if (raw.includes("\\")) {
      throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
    }
```

- [x] **Step 2: Reject report runner output roots with literal backslashes**

Change `normalizeOutputRoot()` so it rejects a raw backslash before slash normalization:

```js
  if (raw.includes("\\")) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke and runner focused tests pass with the new backslash checks.

Observed: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0. Direct smoke tests reported `156 passed, 0 failed`; smoke report runner tests reported `61 passed, 0 failed`.

### Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-path-backslash-guard.md`

- [x] **Step 1: Document backslash rejection**

Update the direct smoke `--report-json` paragraph and the report runner output-root paragraph in README and the external demo runbook. State that path values containing literal backslashes fail before network requests or artifact creation.

- [x] **Step 2: Record observed RED/GREEN evidence**

Update this plan with observed test counts and any cleanup of RED-created artifacts.

### Task 4: Full QA And Publish

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: focused tests pass, full suite passes, and backslash check passes.

Observed: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` exited 0. Focused direct smoke tests reported `156 passed, 0 failed`; smoke report runner tests reported `61 passed, 0 failed`; the full suite reported `806 passed, 0 failed across 25 test file(s)`.

- [x] **Step 2: Commit and push implementation evidence**

Run:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-path-backslash-guard.md
git commit -m "ci: reject backslash smoke report paths"
git push origin main
```

Observed: implementation commit `f8044f3 ci: reject backslash smoke report paths` was pushed to `origin/main`.

- [x] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir /tmp/<download-dir>
```

Expected: GitHub Actions QA succeeds, `qa-summary.json` reports read-only smoke `155 passed / 0 failed` or higher, and artifact sensitive-value scan has no matches.

Observed: GitHub Actions QA run `27108830658` completed successfully for `f8044f3`. Artifact `7469262303` / `qa-automation-27108830658` contained `qa-summary.json` with read-only `actualMode=readonly`, `checkCount=155`, and `155 passed / 0 failed`. Sensitive-value scan over the downloaded artifact found no matches for token, Authorization, Riot key, match id, or lock-key patterns.

- [ ] **Step 4: Update Obsidian**

Append a cycle log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local QA, remote run, artifact id, and sensitive-value scan result.

Deferred: Obsidian update is applied after the final docs evidence run so the project note can reference the final `main` hash and final QA artifact.
