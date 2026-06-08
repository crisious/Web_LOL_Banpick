# Smoke Sample Error Status Range Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject sample manifest error expectation statuses outside HTTP error range before direct smoke network probes or report runner artifact creation.

**Architecture:** Keep existing positive integer checks for syntax-level errors, then add a semantic HTTP error range check for sample detail/list error expectations. Direct smoke and the report runner use the same 400-599 contract.

**Tech Stack:** Node.js ESM smoke scripts, script-level parser tests, README/runbook docs.

---

### Task 1: Add RED Tests For Out-Of-Range Error Statuses

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke parser rejection tests**

```js
checkThrows("parseSmokeArgs rejects non-error sample detail status",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-detail-error-id=sample-kr-1",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-detail-error-status=399",
  ], {}),
  "--expect-sample-detail-error-status must be an HTTP error status (400-599)");

checkThrows("parseSmokeArgs rejects out-of-range sample list status",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-list-error-status=600",
  ], {}),
  "--expect-sample-list-error-status must be an HTTP error status (400-599)");
```

- [x] **Step 2: Add report runner parser rejection tests**

```js
checkThrows("parseRunnerArgs rejects non-error sample detail status before artifact creation",
  () => runner.parseRunnerArgs([
    "node",
    "scripts/run-smoke-report.mjs",
    "--mode=readonly",
    "--expect-sample-detail-error-id=sample-kr-1",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-detail-error-status=399",
  ], {}),
  "--expect-sample-detail-error-status must be an HTTP error status (400-599)");

checkThrows("parseRunnerArgs rejects out-of-range sample list status before artifact creation",
  () => runner.parseRunnerArgs([
    "node",
    "scripts/run-smoke-report.mjs",
    "--mode=readonly",
    "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-list-error-status=600",
  ], {}),
  "--expect-sample-list-error-status must be an HTTP error status (400-599)");
```

- [x] **Step 3: Run focused tests and confirm RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke and runner tests fail on the new 399/600 status checks.

### Task 2: Add HTTP Error Status Validation

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add direct smoke helper and calls**

Inside `parseSmokeArgs()`, add:

```js
function assertSampleErrorStatus(value, optionName) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  if (value < 400 || value > 599) {
    throw new Error(`${optionName} must be an HTTP error status (400-599)`);
  }
}
```

Then replace the sample detail/list status integer checks with:

```js
assertSampleErrorStatus(expectedSampleDetailError.status, "--expect-sample-detail-error-status");
assertSampleErrorStatus(expectedSampleListError.status, "--expect-sample-list-error-status");
```

- [x] **Step 2: Add runner helper and calls**

In `scripts/run-smoke-report.mjs`, keep `--timeout-ms` on positive integer validation, but validate sample statuses through:

```js
function assertHttpErrorStatusOption(args, prefix) {
  const arg = passThroughOptionArg(args, prefix);
  if (!arg) return;
  const value = Number(arg.slice(prefix.length));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${prefix.slice(0, -1)} must be a positive integer`);
  }
  if (value < 400 || value > 599) {
    throw new Error(`${prefix.slice(0, -1)} must be an HTTP error status (400-599)`);
  }
}
```

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node --check scripts/run-smoke-report.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke tests and runner tests pass.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update status range contract docs**

Document that sample manifest error expectation statuses must be HTTP error statuses in the 400-599 range.

- [x] **Step 2: Run full QA**

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

Expected: all commands exit 0 with no whitespace errors.

### Verification Results

- RED direct smoke: 182 passed, 2 failed on the new 399/600 status tests.
- RED smoke report runner: 88 passed, 2 failed on the new 399/600 status tests.
- GREEN direct smoke: 184 passed, 0 failed.
- GREEN smoke report runner: 90 passed, 0 failed.
- Full local QA: `npm test` 863 passed, 0 failed across 25 test files; `git diff --check` passed.
