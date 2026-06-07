# Smoke Report Repeated Separator Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make direct smoke `--report-json` and smoke report runner `--output-root` reject repeated slash separators before network requests or QA artifact creation.

**Architecture:** Keep path ownership in the two existing CLI parsers. Direct smoke validates report JSON file paths in `normalizeReportJsonPath()`, and the report runner validates output directories in `normalizeOutputRoot()`. Both should reject slash-normalized raw paths containing `//`, while the report runner continues to accept a single trailing slash on valid child output roots.

**Tech Stack:** Node.js ES modules, zero-dependency CLI tests, existing smoke/report docs.

---

### Task 1: Add RED Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke parser tests**

Add these checks after the existing root/dot-segment report JSON parser checks:

```js
checkThrows("parseSmokeArgs rejects root repeated separator report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts//tmp/smoke-report.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");

checkThrows("parseSmokeArgs rejects child repeated separator report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp//smoke-report.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [x] **Step 2: Add direct smoke CLI preflight tests**

Add these checks near the existing unsafe/dot/trailing report JSON CLI preflight checks:

```js
const repeatedSeparatorReportPath = path.join("test-artifacts", "tmp", "smoke-report-repeated-separator.json");
fs.rmSync(repeatedSeparatorReportPath, { force: true });
const repeatedSeparatorReport = spawnSync(process.execPath, [
  smokePath,
  "--report-json=test-artifacts/tmp//smoke-report-repeated-separator.json",
], {
  encoding: "utf8",
});

check("CLI exits non-zero for repeated separator report JSON path",
  repeatedSeparatorReport.status,
  1);

check("CLI reports repeated separator report JSON path without network request",
  repeatedSeparatorReport.stderr.trim(),
  "FAIL --report-json must be a relative .json path under a test-artifacts subdirectory");

check("CLI repeated separator report JSON path does not create file",
  fs.existsSync(repeatedSeparatorReportPath),
  false);
```

- [x] **Step 3: Add report runner parser tests**

Add these checks after the existing repeated trailing slash root output-root checks:

```js
  checkThrows("parseRunnerArgs rejects root repeated separator output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts//qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects child repeated separator output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp//qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects repeated trailing slash child output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/qa-automation//"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [x] **Step 4: Add report runner env artifact-creation test**

Add this check near the existing unsafe/dot-segment env output root checks:

```js
  const repeatedSeparatorEnvOutputRoot = "test-artifacts/tmp//smoke-report-repeated-separator-root";
  const repeatedSeparatorEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-repeated-separator-root");
  fs.rmSync(repeatedSeparatorEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects repeated separator env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: repeatedSeparatorEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("repeated separator env output root rejection does not create output root",
    fs.existsSync(repeatedSeparatorEnvCreatedPath),
    false);
```

- [x] **Step 5: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: fails because both parsers currently canonicalize repeated separators.

Observed: direct smoke RED `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `143 passed, 4 failed`. The parser checks for `test-artifacts//tmp/smoke-report.json` and `test-artifacts/tmp//smoke-report.json` did not throw, and the CLI preflight test wrote the canonical `test-artifacts/tmp/smoke-report-repeated-separator.json` after a failed `/healthz` request. Runner RED `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `49 passed, 5 failed`; repeated separator output roots normalized, and env output root created `test-artifacts/tmp/smoke-report-repeated-separator-root/...`.

### Task 2: Implement Repeated Separator Guards

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Reject repeated separators in direct smoke report JSON paths**

Change the unsafe path guard in `normalizeReportJsonPath()` so it includes `comparable.includes("//")`:

```js
    if (comparable.startsWith("/") || /^[A-Za-z]:\//.test(comparable) || comparable.startsWith("//") || comparable.includes("//") || comparable.endsWith("/") || rawSegments.includes(".") || rawSegments.includes("..")) {
      throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
    }
```

- [x] **Step 2: Reject repeated separators in report runner output roots**

Change the unsafe path guard in `normalizeOutputRoot()` so it includes `comparable.includes("//")`:

```js
  if (path.isAbsolute(raw) || path.win32.isAbsolute(raw) || comparable.includes("//") || rawSegments.includes(".") || rawSegments.includes("..")) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke and runner focused tests pass with the new repeated separator checks.

Observed: after removing RED artifacts, `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0. Direct smoke tests reported `147 passed, 0 failed`; smoke report runner tests reported `54 passed, 0 failed`.

### Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-repeated-separator-guard.md`

- [x] **Step 1: Document repeated separator rejection**

Update the direct smoke `--report-json` paragraph and the `smoke:report:*` output-root paragraph in README and the external demo runbook. State that repeated separators such as `test-artifacts//tmp/...` or `test-artifacts/tmp//...` fail before network requests or artifact creation.

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

Observed: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` exited 0. Focused direct smoke tests reported `147 passed, 0 failed`; smoke report runner tests reported `54 passed, 0 failed`; the full suite reported `790 passed, 0 failed across 25 test file(s)`.

- [ ] **Step 2: Commit and push implementation evidence**

Run:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-repeated-separator-guard.md
git commit -m "ci: reject repeated slash smoke report paths"
git push origin main
```

- [ ] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir /tmp/<download-dir>
```

Expected: GitHub Actions QA succeeds, `qa-summary.json` reports read-only smoke `155 passed / 0 failed` or higher, and artifact sensitive-value scan has no matches.

- [ ] **Step 4: Update Obsidian**

Append a cycle log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local QA, remote run, artifact id, and sensitive-value scan result.
