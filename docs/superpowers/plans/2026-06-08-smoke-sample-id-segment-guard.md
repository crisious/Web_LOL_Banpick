# Smoke Sample Id Segment Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject malformed sample detail expectation ids with empty hyphen segments before direct smoke network probes or report runner artifact creation.

**Architecture:** Tighten the existing sample error id regex in both smoke parsers from a broad character allowlist to a segmented token shape. Keep valid ids such as `sample-kr-1`, `sample-bad`, and real `sample-kr-824...` ids working.

**Tech Stack:** Node.js ESM smoke scripts, script-level parser tests, README/runbook docs.

---

### Task 1: Add RED Tests For Empty Sample Id Segments

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [ ] **Step 1: Add direct smoke parser rejection tests**

```js
checkThrows("parseSmokeArgs rejects sample detail error id empty segment",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-detail-error-id=sample-kr--1",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
  ], {}),
  "--expect-sample-detail-error-id must match sample-[a-z0-9]+(-[a-z0-9]+)*");

checkThrows("parseSmokeArgs rejects sample detail error id trailing separator",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-detail-error-id=sample-bad-",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
  ], {}),
  "--expect-sample-detail-error-id must match sample-[a-z0-9]+(-[a-z0-9]+)*");
```

- [ ] **Step 2: Add report runner parser rejection tests**

```js
checkThrows("parseRunnerArgs rejects sample detail error id empty segment before artifact creation",
  () => runner.parseRunnerArgs([
    "node",
    "scripts/run-smoke-report.mjs",
    "--mode=readonly",
    "--expect-sample-detail-error-id=sample-kr--1",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
  ], {}),
  "--expect-sample-detail-error-id must match sample-[a-z0-9]+(-[a-z0-9]+)*");

checkThrows("parseRunnerArgs rejects sample detail error id trailing separator before artifact creation",
  () => runner.parseRunnerArgs([
    "node",
    "scripts/run-smoke-report.mjs",
    "--mode=readonly",
    "--expect-sample-detail-error-id=sample-bad-",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
  ], {}),
  "--expect-sample-detail-error-id must match sample-[a-z0-9]+(-[a-z0-9]+)*");
```

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke and runner tests fail on the new empty-segment sample id checks.

### Task 2: Tighten Parser Regex

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [ ] **Step 1: Replace the sample id regex and error message**

Use this pattern and message in both parser paths:

```js
/^sample-[a-z0-9]+(?:-[a-z0-9]+)*$/
```

```js
`${optionName} must match sample-[a-z0-9]+(-[a-z0-9]+)*`
```

- [ ] **Step 2: Run focused GREEN**

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

- [ ] **Step 1: Update sample id contract docs**

Replace `sample-[a-z0-9-]+` references with `sample-[a-z0-9]+(-[a-z0-9]+)*` and mention that empty hyphen segments fail before network requests or artifact creation.

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
