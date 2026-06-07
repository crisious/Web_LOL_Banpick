# Smoke Report Passthrough Option Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent smoke report runner pass-through option typos from creating partial QA artifacts before failing in the underlying smoke command.

**Architecture:** Keep `scripts/run-smoke-report.mjs` as the owner of report mode, output root, base URL, `--expect-mode`, `--min-samples`, `--require-*`, and `--report-json`. Add a strict pass-through allowlist for only the direct smoke options that operators may intentionally forward through report runner commands. Unknown or runner-controlled `--...` options fail in `parseRunnerArgs` before report directories or metadata files are created.

**Tech Stack:** Node.js ESM scripts, zero-dependency runner parser tests under `test-artifacts/scripts`, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Runner Parser Coverage

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add unknown pass-through option test**

Add this near the existing `parseRunnerArgs` validation checks:

```js
checkThrows("parseRunnerArgs rejects unknown smoke pass-through options",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--expectmode=readonly"], {}),
  "unknown smoke report option: --expectmode=readonly");
```

- [x] **Step 2: Add runner-controlled smoke option test**

Add this near the unknown pass-through test:

```js
checkThrows("parseRunnerArgs rejects runner-controlled smoke pass-through options",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--expect-mode=protected"], {}),
  "unknown smoke report option: --expect-mode=protected");
```

- [x] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: both new checks fail because `parseRunnerArgs` currently forwards any non-runner `--...` option into `extraSmokeArgs`.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `19 passed, 2 failed`. Both new checks failed because `parseRunnerArgs` did not throw for unknown or runner-controlled pass-through options.

### Task 2: Implement Pass-Through Allowlist

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add allowed pass-through prefixes**

Near the existing constants, add:

```js
const ALLOWED_SMOKE_ARG_PREFIXES = [
  "--token=",
  "--timeout-ms=",
  "--expect-sample-detail-error-id=",
  "--expect-sample-detail-error-status=",
  "--expect-sample-detail-error-code=",
  "--expect-sample-detail-error-message=",
  "--expect-sample-list-error-status=",
  "--expect-sample-list-error-code=",
  "--expect-sample-list-error-message=",
];
```

- [x] **Step 2: Validate extra smoke args in parser**

After computing `extraSmokeArgs`, add:

```js
for (const arg of extraSmokeArgs) {
  if (ALLOWED_SMOKE_ARG_PREFIXES.some((prefix) => arg.startsWith(prefix))) continue;
  throw new Error(`unknown smoke report option: ${arg}`);
}
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: smoke report runner tests pass with the new pass-through validation checks.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0 and reported `21 passed, 0 failed`.

### Task 3: Verify, Document, And Sync

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-passthrough-option-guard.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document operator contract**

State that `smoke:report:*` only forwards allowlisted smoke pass-through options and rejects unknown or runner-controlled options before artifact creation.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: syntax check, focused runner suite, full test suite, and whitespace check all pass.

Observed: command exited 0. Focused runner suite reported `21 passed, 0 failed`; full `npm test` reported `727 passed, 0 failed across 25 test file(s)`; `git diff --check` reported no whitespace errors.

- [x] **Step 3: Commit and push**

Run:

```bash
git add scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-passthrough-option-guard.md
git commit -m "ci: reject unknown smoke report options"
git push origin main
```

Expected: commit lands on `main` and push triggers GitHub Actions QA.

Observed: committed and pushed `c8a7608d62a6384056b9fe888c5884d3e26d6302` to `main` with message `ci: reject unknown smoke report options`.

- [x] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 5
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: latest run for the pushed head SHA succeeds, uploaded artifact contains `qa-summary.json`, read-only smoke reports zero failures, and sensitive-value search has no matches.

Observed: GitHub Actions QA run `27106043071` completed successfully for head SHA `c8a7608d62a6384056b9fe888c5884d3e26d6302`. Artifact `qa-automation-27106043071` / ID `7468386381` contained `qa-summary.json`, `smoke-run.json`, and `smoke-report.json`; `qa-summary.json` recorded read-only smoke `155 passed, 0 failed`. Sensitive-value search across the downloaded artifact directory found no matches.
