# Smoke Report Artifact Relative Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add artifact-root relative paths to `qa-summary.json.latestRun` so downloaded GitHub QA artifacts can be inspected without reconstructing the original CI workspace path.

**Architecture:** Preserve existing `reportDir`, `reportJsonPath`, and `smokeRunJsonPath` fields for backward compatibility. Add a derived `artifactRelativePaths` object in `scripts/run-smoke-report.mjs` from the report output root, with POSIX-style paths that match the files uploaded under the artifact root.

**Tech Stack:** Node.js ESM scripts, built-in `path` helpers, zero-dependency test runner in `test-artifacts/scripts/smoke-report-runner-tests.mjs`, Markdown docs, GitHub Actions QA artifact inspection.

---

## File Structure

- Modify: `scripts/run-smoke-report.mjs`
  - Add a small POSIX normalization helper for JSON artifact paths.
  - Add `artifactRelativePathsFor(reportDir, reportJsonPath, metadataPath)`.
  - Include `artifactRelativePaths` in `buildQaSummary().latestRun`.
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Assert the exact `artifactRelativePaths` object on the full protected `qaSummary` expectation.
  - Assert a read-only passing summary records downloadable artifact-relative paths.
- Modify: `README.md`
  - Document that `qa-summary.json` includes artifact-root relative paths.
- Modify: `docs/external-demo-runbook.md`
  - Mirror the operator-facing artifact path description.
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-artifact-relative-paths.md`
  - Track RED, GREEN, docs, local QA, GitHub artifact, and Obsidian evidence.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
  - Record the completed QA cycle after commit/push.

## Task 1: RED Test Coverage

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add failing assertions for artifact-relative paths**

Add the expected `artifactRelativePaths` field to the exact protected `qaSummary` expectation after `smokeRunJsonPath`:

```js
        artifactRelativePaths: {
          qaSummary: "qa-summary.json",
          smokeReport: "2026-06-08T01-15-30Z-external-protected/smoke-report.json",
          smokeRun: "2026-06-08T01-15-30Z-external-protected/smoke-run.json",
        },
```

Add a focused assertion for the passing read-only summary after `passingRequiredSummary` is created:

```js
  check("buildQaSummary records artifact-relative smoke paths",
    passingRequiredSummary?.latestRun?.artifactRelativePaths,
    {
      qaSummary: "qa-summary.json",
      smokeReport: "2026-06-08T06-35-00Z-readonly/smoke-report.json",
      smokeRun: "2026-06-08T06-35-00Z-readonly/smoke-run.json",
    });
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

The failure must show missing `artifactRelativePaths`. If it fails because of syntax or import errors, fix the test and rerun until the failure proves the production behavior is missing.

Observed:

```text
118 passed, 2 failed
Failures were missing artifactRelativePaths values in qa-summary expectations.
```

## Task 2: Minimal Runner Implementation

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add artifact-relative path helpers**

Insert the helpers before `buildQaSummary`:

```js
function artifactJsonPath(value) {
  return value.split(path.sep).join("/");
}

function artifactRelativePathsFor(reportDir, reportJsonPath, metadataPath) {
  const outputRoot = path.dirname(reportDir);
  return {
    qaSummary: "qa-summary.json",
    smokeReport: artifactJsonPath(path.relative(outputRoot, reportJsonPath)),
    smokeRun: artifactJsonPath(path.relative(outputRoot, metadataPath)),
  };
}
```

- [x] **Step 2: Include the field in `buildQaSummary`**

Update the latest-run payload:

```js
      reportDir,
      reportJsonPath,
      smokeRunJsonPath: metadataPath,
      artifactRelativePaths: artifactRelativePathsFor(reportDir, reportJsonPath, metadataPath),
      smokeSummary: smokeReport?.summary || null,
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
120 passed, 0 failed
```

## Task 3: Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update artifact field descriptions**

In both docs, update the `qa-summary.json` field list so it includes artifact-root relative paths:

```text
required check failure messages, artifact-root relative paths, and artifact paths
```

- [x] **Step 2: Scan the plan for forbidden placeholders**

Run:

```bash
rg -n "T[B]D|T[O]DO|implement lat[e]r|fill in deta[i]ls|Add appropriat[e]|Write tests for the abov[e]|Similar to Tas[k]" docs/superpowers/plans/2026-06-08-smoke-report-artifact-relative-paths.md
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
- Read-only artifact output: `test-artifacts/tmp/qa-artifact-relative-paths-local`

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
smoke report runner tests: 120 passed, 0 failed
npm test: 1297 passed, 0 failed across 40 test file(s)
git diff --check produced no output
```

- [x] **Step 2: Run local read-only smoke report**

Start the server:

```bash
PORT=8123 HOST=127.0.0.1 PUBLIC_DEMO_MODE=readonly node server.js
```

Run the report:

```bash
npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-artifact-relative-paths-local
```

Inspect the summary:

```bash
node -e "const fs=require('fs'); const path=require('path'); const root='test-artifacts/tmp/qa-artifact-relative-paths-local'; const p=path.join(root,'qa-summary.json'); const j=JSON.parse(fs.readFileSync(p,'utf8')); const rel=j.latestRun.artifactRelativePaths; console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredCheckStatus:j.latestRun.requiredCheckStatus, requiredCheckSummary:j.latestRun.requiredCheckSummary, requiredCheckFailures:j.latestRun.requiredCheckFailures, artifactRelativePaths:rel, smokeReportExists:fs.existsSync(path.join(root, rel.smokeReport)), smokeRunExists:fs.existsSync(path.join(root, rel.smokeRun))}, null, 2));"
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
  "requiredCheckFailures": [],
  "artifactRelativePaths": {
    "qaSummary": "qa-summary.json",
    "smokeReport": "<timestamp>-readonly/smoke-report.json",
    "smokeRun": "<timestamp>-readonly/smoke-run.json"
  },
  "smokeReportExists": true,
  "smokeRunExists": true
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
  "requiredCheckFailures": [],
  "artifactRelativePaths": {
    "qaSummary": "qa-summary.json",
    "smokeReport": "2026-06-08T07-37-00Z-readonly/smoke-report.json",
    "smokeRun": "2026-06-08T07-37-00Z-readonly/smoke-run.json"
  },
  "smokeReportExists": true,
  "smokeRunExists": true
}
```

- [x] **Step 3: Assert local artifact paths and privacy**

Run:

```bash
node -e "const fs=require('fs'); const path=require('path'); const root='test-artifacts/tmp/qa-artifact-relative-paths-local'; const j=JSON.parse(fs.readFileSync(path.join(root,'qa-summary.json'),'utf8')); const rel=j.latestRun.artifactRelativePaths; if (rel.qaSummary !== 'qa-summary.json') process.exit(1); if (!rel.smokeReport.endsWith('/smoke-report.json')) process.exit(1); if (!rel.smokeRun.endsWith('/smoke-run.json')) process.exit(1); if (!fs.existsSync(path.join(root, rel.smokeReport))) process.exit(1); if (!fs.existsSync(path.join(root, rel.smokeRun))) process.exit(1); console.log('artifact relative paths resolve inside artifact root');"
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-artifact-relative-paths-local
```

Expected:

```text
artifact relative paths resolve inside artifact root
second command has no matches and exits 1
```

Observed:

```text
artifact relative paths resolve inside artifact root
sensitive artifact scan had no matches and exited 1
```

## Task 5: Commit, Push, GitHub Artifact, and Notes

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Stage and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-artifact-relative-paths.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
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
git commit -m "ci: record smoke report artifact relative paths"
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
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/qa-artifact-relative-paths-gh
node -e "const fs=require('fs'); const path=require('path'); const root='test-artifacts/tmp/qa-artifact-relative-paths-gh'; const j=JSON.parse(fs.readFileSync(path.join(root,'qa-summary.json'),'utf8')); const rel=j.latestRun.artifactRelativePaths; if (rel.qaSummary !== 'qa-summary.json') process.exit(1); if (!rel.smokeReport.endsWith('/smoke-report.json')) process.exit(1); if (!rel.smokeRun.endsWith('/smoke-run.json')) process.exit(1); if (!fs.existsSync(path.join(root, rel.smokeReport))) process.exit(1); if (!fs.existsSync(path.join(root, rel.smokeRun))) process.exit(1); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredCheckStatus:j.latestRun.requiredCheckStatus, requiredCheckSummary:j.latestRun.requiredCheckSummary, requiredCheckFailures:j.latestRun.requiredCheckFailures, artifactRelativePaths:rel}, null, 2));"
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-artifact-relative-paths-gh
```

Expected:

```text
GitHub QA succeeds
artifact relative paths resolve inside the downloaded artifact root
artifact requiredCheckStatus is passed
artifact requiredCheckFailures is []
sensitive scan has no matches and exits 1
```

- [ ] **Step 4: Update Obsidian and final sync evidence**

Update the Obsidian project note with the new commit, QA run id, artifact id, `artifactRelativePaths`, and sensitive-scan result.

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
latest commit is ci: record smoke report artifact relative paths
```
