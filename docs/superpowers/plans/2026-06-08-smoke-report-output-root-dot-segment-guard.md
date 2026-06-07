# Smoke Report Output Root Dot Segment Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `smoke:report:*` reject `--output-root` and `SMOKE_REPORT_OUTPUT_ROOT` values containing `.` path segments before creating QA artifacts.

**Architecture:** Keep `scripts/run-smoke-report.mjs` as the single report output path validator. Tighten `normalizeOutputRoot()` so raw `.` segments are rejected like traversal segments, matching the stricter direct smoke `--report-json` contract.

**Tech Stack:** Node.js ES modules, zero-dependency script tests, existing smoke report runner docs.

---

### Task 1: Add RED Coverage

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add parser dot-segment tests**

Add these checks after the existing artifact root trailing slash output root checks:

```js
  checkThrows("parseRunnerArgs rejects root dot-segment output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/./qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects child dot-segment output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/./qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [x] **Step 2: Add env preflight artifact-creation test**

Add this check near the existing unsafe env output root preflight test:

```js
  const dotSegmentEnvOutputRoot = "test-artifacts/tmp/./smoke-report-dot-output-root";
  const dotSegmentEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-dot-output-root");
  fs.rmSync(dotSegmentEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects dot-segment env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: dotSegmentEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("dot-segment env output root rejection does not create output root",
    fs.existsSync(dotSegmentEnvCreatedPath),
    false);
```

- [x] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: fails because `normalizeOutputRoot()` currently normalizes `.` segments instead of rejecting them.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `45 passed, 4 failed`. The parser checks for `test-artifacts/./qa-automation` and `test-artifacts/tmp/./qa-automation` did not throw, and the env-path check created `test-artifacts/tmp/smoke-report-dot-output-root/...` before child smoke failed on `/healthz`.

### Task 2: Implement Guard

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Reject raw dot segments**

Change the unsafe segment guard in `normalizeOutputRoot()` from:

```js
  if (path.isAbsolute(raw) || path.win32.isAbsolute(raw) || comparable.split("/").includes("..")) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
```

to:

```js
  const rawSegments = comparable.split("/");
  if (path.isAbsolute(raw) || path.win32.isAbsolute(raw) || rawSegments.includes(".") || rawSegments.includes("..")) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
```

- [x] **Step 2: Run GREEN**

Run:

```bash
node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: smoke report runner tests pass with the new dot-segment rejection checks.

Observed: after removing the RED artifact directory, `rm -rf test-artifacts/tmp/smoke-report-dot-output-root && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0, and the focused runner tests reported `49 passed, 0 failed`.

### Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-output-root-dot-segment-guard.md`

- [x] **Step 1: Document output root dot-segment rejection**

In README and the external demo runbook, update the output root contract to state that `.` path segments are rejected before artifact creation.

- [x] **Step 2: Record observed RED/GREEN evidence**

Update this plan with observed command output for RED and GREEN.

### Task 4: Full QA And Publish

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: focused runner tests pass, full suite passes, and whitespace check passes.

Observed: `node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` exited 0. Focused runner tests reported `49 passed, 0 failed`; the full suite reported `780 passed, 0 failed across 25 test file(s)`.

- [ ] **Step 2: Commit and push implementation evidence**

Run:

```bash
git add scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-output-root-dot-segment-guard.md
git commit -m "ci: reject dot segment smoke output roots"
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
