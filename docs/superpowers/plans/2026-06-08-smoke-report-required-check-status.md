# Smoke Report Required Check Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single `qa-summary.json.latestRun.requiredCheckStatus` field so QA artifacts show whether required smoke checks passed, failed, or were intentionally skipped.

**Architecture:** Keep the behavior inside `scripts/run-smoke-report.mjs`, beside existing required-check result, summary, and failure-message helpers. The new status is derived only from `requiredChecks`, so validation and summary output stay consistent and no smoke runner command contract changes.

**Tech Stack:** Node.js ESM scripts, zero-dependency test runner in `test-artifacts/scripts/smoke-report-runner-tests.mjs`, Markdown docs, GitHub Actions QA artifact inspection.

---

## File Structure

- Modify: `scripts/run-smoke-report.mjs`
  - Add `requiredSmokeCheckStatus(requiredChecks)`.
  - Include `requiredCheckStatus` in `buildQaSummary().latestRun`.
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Add assertions for failed, passed, missing, mixed, and skipped required-check status cases.
- Modify: `README.md`
  - Document that `qa-summary.json` includes the required check overall status.
- Modify: `docs/external-demo-runbook.md`
  - Mirror the README artifact field description for operators.
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-required-check-status.md`
  - Track RED, GREEN, docs, local QA, GitHub artifact, and Obsidian evidence.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
  - Record the completed QA cycle after commit/push.

## Task 1: RED Test Coverage

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add failing assertions for required check status**

Add the expected `requiredCheckStatus` field to the exact protected `qaSummary` expectation:

```js
        requiredChecks: commonMissingFullRequiredChecks,
        requiredCheckStatus: "failed",
        requiredCheckSummary: {
          total: 7,
          passed: 0,
          failed: 0,
          missing: 7,
        },
        requiredCheckFailures: commonMissingFullRequiredCheckFailures,
```

Add focused status assertions after each related summary check:

```js
  check("buildQaSummary records passing required check status",
    passingRequiredSummary?.latestRun?.requiredCheckStatus,
    "passed");

  check("buildQaSummary records missing required check status",
    missingRequiredSummary?.latestRun?.requiredCheckStatus,
    "failed");

  check("buildQaSummary records mixed required check status",
    mixedRequiredSummary?.latestRun?.requiredCheckStatus,
    "failed");

  check("sample list error smoke reports record skipped required check status",
    sampleListErrorSummary?.latestRun?.requiredCheckStatus,
    "skipped");
```

- [x] **Step 2: Run focused tests and verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected:

```text
failed
```

The failure must show missing `requiredCheckStatus` or mismatched expected summary output. If the test fails because of syntax or import errors, fix the test and rerun until it fails for the missing production behavior.

Observed:

```text
114 passed, 5 failed
Failures were missing requiredCheckStatus values in qa-summary expectations.
```

## Task 2: Minimal Runner Implementation

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add helper beside required-check summary helpers**

Insert this helper after `summarizeRequiredSmokeChecks(requiredChecks)`:

```js
function requiredSmokeCheckStatus(requiredChecks) {
  if (!requiredChecks.length) return "skipped";
  return requiredChecks.every((check) => check?.status === "pass") ? "passed" : "failed";
}
```

- [x] **Step 2: Include the field in `buildQaSummary`**

Update the latest-run payload:

```js
      requiredChecks,
      requiredCheckStatus: requiredSmokeCheckStatus(requiredChecks),
      requiredCheckSummary: summarizeRequiredSmokeChecks(requiredChecks),
      requiredCheckFailures: requiredSmokeCheckFailureMessages(requiredChecks),
```

- [x] **Step 3: Run focused tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected:

```text
passed, 0 failed
```

Observed:

```text
119 passed, 0 failed
```

## Task 3: Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update artifact field descriptions**

In both docs, update the `qa-summary.json` sentence so the field list includes the required check overall status:

```text
required check label results, required check overall status, required check pass/fail/missing totals, required check failure messages
```

- [x] **Step 2: Scan the plan for forbidden placeholders**

Run:

```bash
rg -n "T[B]D|T[O]DO|implement lat[e]r|fill in deta[i]ls|Add appropriat[e]|Write tests for the abov[e]|Similar to Tas[k]" docs/superpowers/plans/2026-06-08-smoke-report-required-check-status.md
```

Expected:

```text
no matches, exit code 1
```

Observed:

```text
no matches, exit code 1
```

## Task 4: Local QA

**Files:**
- Read-only artifact output: `test-artifacts/tmp/qa-required-check-status-local`

- [x] **Step 1: Run syntax, focused, full test, and whitespace gates**

Run:

```bash
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --check
```

Expected:

```text
no syntax errors
smoke report runner tests pass with 0 failed
npm test passes with 0 failed
git diff --check produces no output
```

Observed:

```text
node --check scripts/run-smoke-report.mjs passed
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs passed
smoke report runner tests: 119 passed, 0 failed
npm test: 1296 passed, 0 failed across 40 test file(s)
git diff --check produced no output
```

- [x] **Step 2: Run local read-only smoke report**

Start the server:

```bash
PORT=8123 HOST=127.0.0.1 PUBLIC_DEMO_MODE=readonly node server.js
```

Run the report:

```bash
npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-required-check-status-local
```

Inspect the summary:

```bash
node -e "const fs=require('fs'); const p='test-artifacts/tmp/qa-required-check-status-local/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredCheckStatus:j.latestRun.requiredCheckStatus, requiredCheckSummary:j.latestRun.requiredCheckSummary, requiredCheckFailures:j.latestRun.requiredCheckFailures, requiredChecks:j.latestRun.requiredChecks}, null, 2));"
```

Expected evidence:

```json
{
  "status": "passed",
  "exitCode": 0,
  "requiredCheckStatus": "passed",
  "requiredCheckSummary": {
    "total": 13,
    "passed": 13,
    "failed": 0,
    "missing": 0
  },
  "requiredCheckFailures": []
}
```

Observed:

```json
{
  "status": "passed",
  "exitCode": 0,
  "smokeSummary": {
    "passed": 156,
    "failed": 0
  },
  "checkCount": 156,
  "requiredCheckStatus": "passed",
  "requiredCheckSummary": {
    "total": 13,
    "passed": 13,
    "failed": 0,
    "missing": 0
  },
  "requiredCheckFailures": []
}
```

- [x] **Step 3: Assert local artifact status and privacy**

Run:

```bash
node -e "const fs=require('fs'); const p='test-artifacts/tmp/qa-required-check-status-local/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); if (j.latestRun.requiredCheckStatus !== 'passed') process.exit(1); if (!Array.isArray(j.latestRun.requiredCheckFailures) || j.latestRun.requiredCheckFailures.length !== 0) process.exit(1); console.log('requiredCheckStatus passed and failures empty');"
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-required-check-status-local
```

Expected:

```text
requiredCheckStatus passed and failures empty
second command has no matches and exits 1
```

Observed:

```text
requiredCheckStatus passed and failures empty
sensitive artifact scan had no matches and exited 1
```

## Task 5: Commit, Push, GitHub Artifact, and Notes

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Stage and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-required-check-status.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --cached --check
git status --short
```

Expected:

```text
tests pass with 0 failed
only the five intended files are staged
```

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git commit -m "ci: record smoke report required check status"
git push origin main
```

Expected:

```text
main is pushed to origin/main
```

- [ ] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/qa-required-check-status-gh
node -e "const fs=require('fs'); const p='test-artifacts/tmp/qa-required-check-status-gh/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); if (j.latestRun.requiredCheckStatus !== 'passed') process.exit(1); if (!Array.isArray(j.latestRun.requiredCheckFailures) || j.latestRun.requiredCheckFailures.length !== 0) process.exit(1); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredCheckStatus:j.latestRun.requiredCheckStatus, requiredCheckSummary:j.latestRun.requiredCheckSummary, requiredCheckFailures:j.latestRun.requiredCheckFailures}, null, 2));"
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-required-check-status-gh
```

Expected:

```text
GitHub QA succeeds
artifact requiredCheckStatus is passed
artifact requiredCheckFailures is []
sensitive scan has no matches and exits 1
```

- [ ] **Step 4: Update Obsidian and final sync evidence**

Update the Obsidian project note with the new commit, QA run id, artifact id, `requiredCheckStatus: "passed"`, and sensitive-scan result.

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git status --short --branch
git log --oneline --decorate -5
```

Expected:

```text
0	0
working tree has only ignored local artifact output or is clean
latest commit is ci: record smoke report required check status
```
