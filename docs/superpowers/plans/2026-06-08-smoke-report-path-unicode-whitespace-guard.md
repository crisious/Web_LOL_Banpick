# Smoke Report Path Unicode Whitespace Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make direct smoke `--report-json` and smoke report runner `--output-root` reject Unicode whitespace and byte order mark characters before network requests or QA artifact creation.

**Architecture:** Keep validation in the existing path normalizers. Direct smoke validates report JSON file paths in `normalizeReportJsonPath()`, and the report runner validates output directories in `normalizeOutputRoot()`. Both should preserve the current empty, leading/trailing whitespace, ASCII control, backslash, absolute, dot-segment, repeated-slash, and artifact-tree checks while rejecting raw Unicode whitespace characters such as NBSP that could create visually confusing artifact names.

**Tech Stack:** Node.js ES modules, zero-dependency CLI tests, existing smoke/report docs.

---

### Task 1: Add RED Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke parser test**

Add this check after the control character report JSON parser check:

```js
checkThrows("parseSmokeArgs rejects unicode whitespace report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/smoke-report-\u00a0unicode.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [x] **Step 2: Add direct smoke CLI preflight test**

Add this check near the existing report JSON CLI preflight checks:

```js
const unicodeWhitespaceReportJsonPath = path.join("test-artifacts", "tmp", "smoke-report-\u00a0unicode.json");
fs.rmSync(unicodeWhitespaceReportJsonPath, { force: true });
const unicodeWhitespaceReportJson = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  "--report-json=test-artifacts/tmp/smoke-report-\u00a0unicode.json",
]);

check("CLI exits non-zero for unicode whitespace report JSON path",
  unicodeWhitespaceReportJson.status,
  1);

check("CLI reports unicode whitespace report JSON path without network request",
  unicodeWhitespaceReportJson.stderr.includes("FAIL --report-json must be a relative .json path under a test-artifacts subdirectory"),
  true);

check("CLI unicode whitespace report JSON path does not create file",
  fs.existsSync(unicodeWhitespaceReportJsonPath),
  false);
```

- [x] **Step 3: Add report runner parser test**

Add this check after the control character output-root parser check:

```js
  checkThrows("parseRunnerArgs rejects unicode whitespace output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\u00a0unicode-root"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [x] **Step 4: Add report runner env artifact-creation test**

Add this check near the existing env output root preflight checks:

```js
  const unicodeWhitespaceEnvOutputRoot = "test-artifacts/tmp/smoke-report-\u00a0unicode-root";
  const unicodeWhitespaceEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-\u00a0unicode-root");
  fs.rmSync(unicodeWhitespaceEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects unicode whitespace env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: unicodeWhitespaceEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("unicode whitespace env output root rejection does not create output root",
    fs.existsSync(unicodeWhitespaceEnvCreatedPath),
    false);
```

- [x] **Step 5: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: both commands fail because the parsers currently allow Unicode whitespace inside artifact paths.

Observed: direct smoke RED `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `161 passed, 3 failed`. The parser accepted an internal NBSP report JSON path, the CLI failed later after a network request instead of preflight, and canonical `test-artifacts/tmp/smoke-report-\u00a0unicode.json` was created. Runner RED `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `64 passed, 3 failed`; the parser accepted an internal NBSP output root, and env output root created `test-artifacts/tmp/smoke-report-\u00a0unicode-root/...`. RED-created artifacts were removed before implementation.

### Task 2: Implement Unicode Whitespace Guards

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Reject direct smoke report paths with Unicode whitespace**

Change `normalizeReportJsonPath()` so it rejects raw Unicode whitespace and byte order mark characters before slash/path validation:

```js
    if (/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/u.test(raw)) {
      throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
    }
```

- [x] **Step 2: Reject report runner output roots with Unicode whitespace**

Change `normalizeOutputRoot()` so it rejects raw Unicode whitespace and byte order mark characters before slash/path validation:

```js
  if (/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/u.test(raw)) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke and runner focused tests pass with the new Unicode whitespace checks.

Observed: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0. Direct smoke tests reported `164 passed, 0 failed`; smoke report runner tests reported `67 passed, 0 failed`.

### Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-path-unicode-whitespace-guard.md`

- [x] **Step 1: Document Unicode whitespace rejection**

Update the direct smoke `--report-json` paragraph and the report runner output-root paragraph in README and the external demo runbook. State that path values containing Unicode whitespace or byte order mark characters fail before network requests or artifact creation.

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

Expected: focused tests pass, full suite passes, and Unicode whitespace check passes.

Observed: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` exited 0. Focused direct smoke tests reported `164 passed, 0 failed`; smoke report runner tests reported `67 passed, 0 failed`; the full suite reported `820 passed, 0 failed across 25 test file(s)`.

- [ ] **Step 2: Commit and push implementation evidence**

Run:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-path-unicode-whitespace-guard.md
git commit -m "ci: reject unicode whitespace smoke report paths"
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
