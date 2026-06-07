# Direct Smoke Report Dot Segment Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent direct smoke `--report-json` paths from using `.` path segments that can canonicalize back to the `test-artifacts` root or produce ambiguous QA artifact destinations.

**Architecture:** Keep `scripts/external-demo-smoke.mjs` as the owner of direct smoke report path validation. Extend `normalizeReportJsonPath()` so raw slash-delimited segments reject both `.` and `..` before network requests or report writes, while retaining the existing `test-artifacts/<subdir>/.../*.json` contract.

**Tech Stack:** Node.js ESM scripts, repository-local `.mjs` test runner, GitHub Actions QA workflow.

---

### Task 1: Add RED Coverage For Dot Segment Report Paths

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Add parser reject tests**

Add these checks near the existing `--report-json` path validation cases:

```js
checkThrows("parseSmokeArgs rejects root dot-segment report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/./smoke-report.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");

checkThrows("parseSmokeArgs rejects child dot-segment report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/./smoke-report.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [x] **Step 2: Add CLI preflight reject coverage**

Add a CLI check near the existing unsafe report JSON path check:

```js
const dotSegmentReportJsonPath = "test-artifacts/./smoke-report.json";
const dotSegmentReportJson = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  `--report-json=${dotSegmentReportJsonPath}`,
]);

check("CLI exits non-zero for dot-segment report JSON path",
  dotSegmentReportJson.status,
  1);

check("CLI reports dot-segment report JSON path without network request",
  dotSegmentReportJson.stderr.includes("FAIL --report-json must be a relative .json path under a test-artifacts subdirectory"),
  true);
```

- [x] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected before implementation: parser dot-segment reject tests fail because `.` segments are accepted.

Observed before implementation: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `135 passed, 3 failed`; the failures were the two parser dot-segment reject checks and the CLI preflight message check.

### Task 2: Reject Dot Segments In Direct Report Paths

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`

- [x] **Step 1: Update raw segment validation**

Change the raw segment guard from:

```js
if (comparable.startsWith("/") || /^[A-Za-z]:\//.test(comparable) || comparable.startsWith("//") || comparable.split("/").includes("..")) {
  throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
}
```

to:

```js
const rawSegments = comparable.split("/");
if (comparable.startsWith("/") || /^[A-Za-z]:\//.test(comparable) || comparable.startsWith("//") || rawSegments.includes(".") || rawSegments.includes("..")) {
  throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
}
```

- [x] **Step 2: Run focused GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected after implementation: focused smoke tests pass.

Observed after implementation: `node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 0 with `138 passed, 0 failed`.

### Task 3: Document, Commit, Push, And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-direct-smoke-report-dot-segment-guard.md`

- [x] **Step 1: Document the dot segment guard**

In the existing direct smoke `--report-json` contract, state that both `.` and `..` path segments are rejected before network requests or report writes.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check
```

Expected: all commands exit 0.

Observed locally:

```bash
node --check scripts/external-demo-smoke.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check
```

Result: exit 0. Focused direct smoke tests `138 passed, 0 failed`; full suite `772 passed, 0 failed across 25 test file(s)`.

- [ ] **Step 3: Commit and push main**

```bash
git add scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-direct-smoke-report-dot-segment-guard.md
git commit -m "ci: reject dot segment smoke report paths"
git push origin main
```

- [ ] **Step 4: Verify remote QA and artifact**

Use `gh run list`, `gh run watch`, and `gh run download` for the pushed SHA. Confirm `qa-summary.json` reports read-only smoke success and no sensitive token patterns appear in the downloaded artifact.

- [ ] **Step 5: Update Obsidian**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, RED/GREEN/full QA, remote run id, artifact id, and sensitive-value search result.
