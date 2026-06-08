# Smoke Sample Error Token Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject malformed sample manifest error expectation `id` and `code` pass-through values before direct smoke network probes or report runner artifact creation.

**Architecture:** Add parser-level token validators to both direct smoke and the report runner. Keep valid fixture values such as `sample-kr-1`, `sample-bad`, and `SAMPLE_MANIFEST_INVALID` working, while rejecting URL-like, whitespace-containing, or lowercase diagnostic code values.

**Tech Stack:** Node.js ESM smoke scripts, existing script-level smoke tests, README/runbook docs.

---

### Task 1: Add RED Tests For Direct Smoke Parser

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [ ] **Step 1: Add parser rejection tests after existing sample error status checks**

```js
checkThrows("parseSmokeArgs rejects unsafe sample detail error id",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-detail-error-id=https://user:pass@demo.example/path?token=secret",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
  ], {}),
  "--expect-sample-detail-error-id must match sample-[a-z0-9-]+");

checkThrows("parseSmokeArgs rejects unsafe sample detail error code",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-detail-error-id=sample-kr-1",
    "--expect-sample-detail-error-code=sample manifest invalid",
  ], {}),
  "--expect-sample-detail-error-code must match [A-Z0-9_]+");

checkThrows("parseSmokeArgs rejects unsafe sample list error code",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-list-error-code=sample manifest invalid",
  ], {}),
  "--expect-sample-list-error-code must match [A-Z0-9_]+");
```

- [ ] **Step 2: Run direct smoke tests and confirm RED**

Run: `node test-artifacts/scripts/external-demo-smoke-tests.mjs`

Expected: FAIL on the new unsafe sample detail/list expectation token checks.

### Task 2: Add RED Tests For Report Runner Parser

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [ ] **Step 1: Add runner parser rejection tests near existing pass-through validation checks**

```js
checkThrows("parseRunnerArgs rejects unsafe sample detail error id before artifact creation",
  () => runner.parseRunnerArgs([
    "node",
    "scripts/run-smoke-report.mjs",
    "--mode=readonly",
    "--expect-sample-detail-error-id=https://user:pass@demo.example/path?token=secret",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
  ], {}),
  "--expect-sample-detail-error-id must match sample-[a-z0-9-]+");

checkThrows("parseRunnerArgs rejects unsafe sample detail error code before artifact creation",
  () => runner.parseRunnerArgs([
    "node",
    "scripts/run-smoke-report.mjs",
    "--mode=readonly",
    "--expect-sample-detail-error-id=sample-kr-1",
    "--expect-sample-detail-error-code=sample manifest invalid",
  ], {}),
  "--expect-sample-detail-error-code must match [A-Z0-9_]+");

checkThrows("parseRunnerArgs rejects unsafe sample list error code before artifact creation",
  () => runner.parseRunnerArgs([
    "node",
    "scripts/run-smoke-report.mjs",
    "--mode=readonly",
    "--expect-sample-list-error-code=sample manifest invalid",
  ], {}),
  "--expect-sample-list-error-code must match [A-Z0-9_]+");
```

- [ ] **Step 2: Run runner tests and confirm RED**

Run: `node test-artifacts/scripts/smoke-report-runner-tests.mjs`

Expected: FAIL on the new unsafe pass-through token checks.

### Task 3: Implement Shared Parser Rules Locally In Each Script

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [ ] **Step 1: Add regex constants and assertion helpers**

```js
const SAMPLE_ERROR_ID_PATTERN = /^sample-[a-z0-9-]+$/;
const SAMPLE_ERROR_CODE_PATTERN = /^[A-Z0-9_]+$/;

function assertSampleErrorId(value, optionName) {
  if (!SAMPLE_ERROR_ID_PATTERN.test(value)) {
    throw new Error(`${optionName} must match sample-[a-z0-9-]+`);
  }
}

function assertSampleErrorCode(value, optionName) {
  if (!SAMPLE_ERROR_CODE_PATTERN.test(value)) {
    throw new Error(`${optionName} must match [A-Z0-9_]+`);
  }
}
```

- [ ] **Step 2: Call helpers after required-field checks**

For direct smoke, validate `expectedSampleDetailError.id`, `expectedSampleDetailError.code`, and `expectedSampleListError.code`.

For the report runner, validate the extracted sample detail id/code and sample list code inside `validateExtraSmokeArgs()`.

- [ ] **Step 3: Run focused GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node --check scripts/run-smoke-report.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke tests and runner tests pass.

### Task 4: Document The Operator Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update pass-through docs**

Document that sample detail ids must use `sample-[a-z0-9-]+` and sample error codes must use `[A-Z0-9_]+`, with invalid values failing before network requests or artifact creation.

- [ ] **Step 2: Run full QA**

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
