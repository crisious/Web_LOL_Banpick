# Smoke Report Duration Ms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `qa-summary.json.latestRun.durationMs` so QA artifacts show how long the smoke report run took without requiring timestamp subtraction.

**Architecture:** Keep the existing `startedAt` and `finishedAt` fields unchanged. Derive a non-negative integer duration inside `scripts/run-smoke-report.mjs` from the same timestamps already passed into `buildQaSummary`.

**Tech Stack:** Node.js ESM scripts, built-in `Date.parse`, zero-dependency test runner in `test-artifacts/scripts/smoke-report-runner-tests.mjs`, Markdown docs, GitHub Actions QA artifact inspection.

---

## File Structure

- Modify: `scripts/run-smoke-report.mjs`
  - Add `runDurationMs(startedAt, finishedAt)`.
  - Include `durationMs` in `buildQaSummary().latestRun`.
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Assert `durationMs` on the exact protected `qaSummary` expectation.
  - Assert a read-only passing summary records the expected duration.
- Modify: `README.md`
  - Document that `qa-summary.json` includes run duration.
- Modify: `docs/external-demo-runbook.md`
  - Mirror the operator-facing run duration description.
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-duration-ms.md`
  - Track RED, GREEN, docs, local QA, GitHub artifact, and Obsidian evidence.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
  - Record the completed QA cycle after commit/push.

## Task 1: RED Test Coverage

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add failing assertions for durationMs**

Add `durationMs` to the exact protected `qaSummary` expectation after `finishedAt`:

```js
        durationMs: 15000,
```

Add a focused assertion for the passing read-only summary after `passingRequiredSummary` is created:

```js
  check("buildQaSummary records run duration in milliseconds",
    passingRequiredSummary?.latestRun?.durationMs,
    10000);
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

The failure must show missing `durationMs`. If it fails because of syntax or import errors, fix the test and rerun until the failure proves the production behavior is missing.

Observed:

```text
119 passed, 2 failed
Failures were missing durationMs values in qa-summary expectations.
```

## Task 2: Minimal Runner Implementation

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add duration helper**

Insert the helper before `buildQaSummary`:

```js
function runDurationMs(startedAt, finishedAt) {
  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished)) return 0;
  return Math.max(0, finished - started);
}
```

- [x] **Step 2: Include the field in `buildQaSummary`**

Update the latest-run payload:

```js
      startedAt,
      finishedAt,
      durationMs: runDurationMs(startedAt, finishedAt),
      reportDir,
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
121 passed, 0 failed
```

## Task 3: Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update artifact field descriptions**

In both docs, update the `qa-summary.json` field list so it includes run duration:

```text
status, exit code, run duration, pass/fail counts
```

For the Korean README sentence, use:

```text
상태, exit code, run duration, smoke pass/fail 요약
```

- [x] **Step 2: Scan the plan for forbidden placeholders**

Run:

```bash
rg -n "T[B]D|T[O]DO|implement lat[e]r|fill in deta[i]ls|Add appropriat[e]|Write tests for the abov[e]|Similar to Tas[k]" docs/superpowers/plans/2026-06-08-smoke-report-duration-ms.md
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
- Read-only artifact output: `test-artifacts/tmp/qa-duration-ms-local`

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
smoke report runner tests: 121 passed, 0 failed
npm test: 1298 passed, 0 failed across 40 test file(s)
git diff --check produced no output
```

- [x] **Step 2: Run local read-only smoke report**

Start the server:

```bash
PORT=8123 HOST=127.0.0.1 PUBLIC_DEMO_MODE=readonly node server.js
```

Run the report:

```bash
npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-duration-ms-local
```

Inspect the summary:

```bash
node -e "const fs=require('fs'); const path=require('path'); const root='test-artifacts/tmp/qa-duration-ms-local'; const p=path.join(root,'qa-summary.json'); const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, durationMs:j.latestRun.durationMs, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredCheckStatus:j.latestRun.requiredCheckStatus, requiredCheckSummary:j.latestRun.requiredCheckSummary, requiredCheckFailures:j.latestRun.requiredCheckFailures}, null, 2));"
```

Expected evidence:

```json
{
  "status": "passed",
  "exitCode": 0,
  "durationMs": "<non-negative integer>",
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
  "durationMs": 209,
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

- [x] **Step 3: Assert local artifact duration and privacy**

Run:

```bash
node -e "const fs=require('fs'); const path=require('path'); const root='test-artifacts/tmp/qa-duration-ms-local'; const j=JSON.parse(fs.readFileSync(path.join(root,'qa-summary.json'),'utf8')); if (!Number.isInteger(j.latestRun.durationMs) || j.latestRun.durationMs < 0) process.exit(1); if (j.latestRun.requiredCheckStatus !== 'passed') process.exit(1); console.log('durationMs is a non-negative integer and required checks passed');"
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-duration-ms-local
```

Expected:

```text
durationMs is a non-negative integer and required checks passed
second command has no matches and exits 1
```

Observed:

```text
durationMs is a non-negative integer and required checks passed
sensitive artifact scan had no matches and exited 1
```

## Task 5: Commit, Push, GitHub Artifact, and Notes

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Stage and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-duration-ms.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
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

Observed:

```text
staged smoke report runner tests: 121 passed, 0 failed
staged npm test: 1298 passed, 0 failed across 40 test file(s)
git diff --cached --check produced no output
only README.md, docs/external-demo-runbook.md, docs/superpowers/plans/2026-06-08-smoke-report-duration-ms.md, scripts/run-smoke-report.mjs, and test-artifacts/scripts/smoke-report-runner-tests.mjs were staged
```

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git commit -m "ci: record smoke report duration"
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
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/qa-duration-ms-gh
node -e "const fs=require('fs'); const path=require('path'); const root='test-artifacts/tmp/qa-duration-ms-gh'; const j=JSON.parse(fs.readFileSync(path.join(root,'qa-summary.json'),'utf8')); if (!Number.isInteger(j.latestRun.durationMs) || j.latestRun.durationMs < 0) process.exit(1); if (j.latestRun.requiredCheckStatus !== 'passed') process.exit(1); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, durationMs:j.latestRun.durationMs, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredCheckStatus:j.latestRun.requiredCheckStatus, requiredCheckSummary:j.latestRun.requiredCheckSummary, requiredCheckFailures:j.latestRun.requiredCheckFailures}, null, 2));"
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-duration-ms-gh
```

Expected:

```text
GitHub QA succeeds
artifact durationMs is a non-negative integer
artifact requiredCheckStatus is passed
artifact requiredCheckFailures is []
sensitive scan has no matches and exits 1
```

- [ ] **Step 4: Update Obsidian and final sync evidence**

Update the Obsidian project note with the new commit, QA run id, artifact id, `durationMs`, and sensitive-scan result.

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
latest commit is ci: record smoke report duration
```
