# Smoke Decimal Integer Option Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject non-decimal numeric spellings for smoke CLI numeric options before network probes or report artifact creation.

**Architecture:** Keep existing positive integer and HTTP error range semantics, but validate the raw option value with a decimal digit pattern before converting it with `Number(...)`. Direct smoke owns `--min-samples`, `--timeout-ms`, and sample error statuses; the report runner mirrors this for forwarded `--timeout-ms` and sample error statuses.

**Tech Stack:** Node.js ESM smoke scripts, script-level parser tests, README/runbook operator docs.

---

### Task 1: Add RED Tests For Non-Decimal Numeric Values

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke parser rejection tests**

```js
checkThrows("parseSmokeArgs rejects exponential minimum sample count",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--min-samples=1e2"], {}),
  "--min-samples must be a positive integer");

checkThrows("parseSmokeArgs rejects whitespace request timeout",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--timeout-ms= 5000"], {}),
  "--timeout-ms must be a positive integer");

checkThrows("parseSmokeArgs rejects exponential sample detail status",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-detail-error-id=sample-kr-1",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-detail-error-status=5e2",
  ], {}),
  "--expect-sample-detail-error-status must be a positive integer");

checkThrows("parseSmokeArgs rejects whitespace sample list status",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-list-error-status= 500",
  ], {}),
  "--expect-sample-list-error-status must be a positive integer");
```

- [x] **Step 2: Add report runner parser and pre-artifact rejection tests**

```js
checkThrows("parseRunnerArgs rejects exponential smoke pass-through timeout",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--timeout-ms=1e3"], {}),
  "--timeout-ms must be a positive integer");

checkThrows("parseRunnerArgs rejects exponential sample detail status before artifact creation",
  () => runner.parseRunnerArgs([
    "node",
    "scripts/run-smoke-report.mjs",
    "--mode=readonly",
    "--expect-sample-detail-error-id=sample-kr-1",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-detail-error-status=5e2",
  ], {}),
  "--expect-sample-detail-error-status must be a positive integer");

const exponentialTimeoutOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-exponential-timeout");
fs.rmSync(exponentialTimeoutOutputRoot, { recursive: true, force: true });
await checkRejects("runSmokeReport rejects exponential timeout before artifact creation",
  () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", `--output-root=${exponentialTimeoutOutputRoot}`, "--timeout-ms=1e3"], {}),
  "--timeout-ms must be a positive integer");
check("exponential timeout rejection does not create output root",
  fs.existsSync(exponentialTimeoutOutputRoot),
  false);
```

- [x] **Step 3: Run focused tests and confirm RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke fails the four new decimal-text tests; report runner fails the new parser/pre-artifact tests.

### Task 2: Parse Positive Integers From Decimal Text Only

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add direct smoke decimal parser**

Inside `parseSmokeArgs()`, add:

```js
function parsePositiveIntegerOption(value, optionName) {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  return parsed;
}
```

Replace direct `Number(...)` parsing for `--min-samples`, `--timeout-ms`, `--expect-sample-detail-error-status`, and `--expect-sample-list-error-status` with this helper. Keep sample error status range checking after the decimal integer parse:

```js
function parseSampleErrorStatus(value, optionName) {
  const parsed = parsePositiveIntegerOption(value, optionName);
  if (parsed < 400 || parsed > 599) {
    throw new Error(`${optionName} must be an HTTP error status (400-599)`);
  }
  return parsed;
}
```

- [x] **Step 2: Add report runner decimal parser**

Update `assertPositiveIntegerOption()` and `assertHttpErrorStatusOption()` so both inspect the raw substring before numeric conversion:

```js
const rawValue = arg.slice(prefix.length);
if (!/^[0-9]+$/.test(rawValue)) {
  throw new Error(message);
}
const value = Number(rawValue);
```

Use the status-specific positive integer message in `assertHttpErrorStatusOption()` before the 400-599 check.

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node --check scripts/run-smoke-report.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke tests and runner tests pass with the new decimal-only guard.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update numeric option contract docs**

Document that smoke numeric options must be plain decimal digits. Mention that whitespace, decimal notation, and exponential notation are rejected before network probes or artifact creation.

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

- RED direct smoke: 184 passed, 4 failed on the new decimal-text numeric option tests.
- RED smoke report runner: 90 passed, 4 failed; `--timeout-ms=1e3` reached child smoke and created a report output root before this guard.
- GREEN direct smoke: 188 passed, 0 failed.
- GREEN smoke report runner: 94 passed, 0 failed.
- Full local QA: `npm test` 871 passed, 0 failed across 25 test files; `git diff --check` passed.
