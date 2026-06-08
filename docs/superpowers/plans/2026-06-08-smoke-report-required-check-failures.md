# Smoke Report Required Check Failures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured required-check failure messages to `qa-summary.json` so CI artifacts expose the exact missing or failed required gates without consumers reconstructing messages from labels.

**Architecture:** Keep `latestRun.requiredChecks` as label-level evidence and `latestRun.requiredCheckSummary` as count evidence. Add `latestRun.requiredCheckFailures` as an ordered string array derived from the same required check results; passing reports store an empty array, and early sample manifest error probes also store an empty array.

**Tech Stack:** Node.js ESM smoke report runner, Node-based runner tests, Markdown README/runbook, GitHub Actions smoke report artifact.

---

### Task 1: Add Failing Runner Tests for Required Check Failure Messages

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Inspect: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Write the failing tests**

Add helper expected arrays near the existing required check fixtures:

```js
const commonMissingFullRequiredCheckFailures = commonMissingFullRequiredChecks.map((check) =>
  `missing required smoke check: ${check.label}`
);
const readonlyMissingFullRequiredCheckFailures = readonlyMissingFullRequiredChecks.map((check) =>
  `missing required smoke check: ${check.label}`
);
```

Update the exact protected `buildQaSummary records latest run evidence without token values` expectation so `latestRun` includes:

```js
requiredCheckFailures: commonMissingFullRequiredCheckFailures,
```

Update the existing validation expected array to use `readonlyMissingFullRequiredCheckFailures`.

Add a read-only passing failure-message check after `passingRequiredSummary`:

```js
check("buildQaSummary records no required check failures when required checks pass",
  passingRequiredSummary?.latestRun?.requiredCheckFailures,
  []);
```

Add a read-only missing failure-message check after `missingRequiredSummary`:

```js
check("buildQaSummary records missing required check failures",
  missingRequiredSummary?.latestRun?.requiredCheckFailures,
  readonlyMissingFullRequiredCheckFailures);
```

Add a mixed pass/fail/missing failure-message check after `mixedRequiredSummary`:

```js
check("buildQaSummary records mixed required check failures",
  mixedRequiredSummary?.latestRun?.requiredCheckFailures,
  [
    "required smoke check failed: /.env is not publicly served",
    "missing required smoke check: /.env has X-Content-Type-Options nosniff",
    "missing required smoke check: /server.js is not publicly served",
    "missing required smoke check: /server.js has X-Content-Type-Options nosniff",
    "missing required smoke check: /data/samples/manifest.json is not publicly served",
    "missing required smoke check: /data/samples/manifest.json has X-Content-Type-Options nosniff",
    "missing required smoke check: readonly mode blocks /api/recent-matches",
    "missing required smoke check: /api/recent-matches readonly block returns PUBLIC_DEMO_READONLY",
    "missing required smoke check: readonly mode blocks /api/champion-history",
    "missing required smoke check: /api/champion-history readonly block returns PUBLIC_DEMO_READONLY",
    "missing required smoke check: readonly mode blocks /api/generate-sample",
    "missing required smoke check: /api/generate-sample readonly block returns PUBLIC_DEMO_READONLY",
  ]);
```

Add an early sample-list error probe failure-message check:

```js
check("sample list error smoke reports record no required check failures",
  sampleListErrorSummary?.latestRun?.requiredCheckFailures,
  []);
```

- [x] **Step 2: Run the focused test to verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits non-zero because `latestRun.requiredCheckFailures` is not yet emitted by `scripts/run-smoke-report.mjs`.

Observed: exited non-zero with `110 passed, 5 failed`; failures showed `requiredCheckFailures` was missing from `buildQaSummary()` output.

### Task 2: Emit Required Check Failure Messages

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add a failure message helper**

Add this helper below `summarizeRequiredSmokeChecks()`:

```js
function requiredSmokeCheckFailureMessages(requiredChecks) {
  return requiredChecks
    .filter((check) => check.status !== "pass")
    .map((check) =>
      check.status === "missing"
        ? `missing required smoke check: ${check.label}`
        : `required smoke check failed: ${check.label}`
    );
}
```

- [x] **Step 2: Reuse the helper in validation and summary output**

Update `validateRequiredSmokeChecks()`:

```js
export function validateRequiredSmokeChecks(config, smokeReport) {
  return requiredSmokeCheckFailureMessages(requiredSmokeCheckResults(config, smokeReport));
}
```

Inside `buildQaSummary()`, add:

```js
      requiredCheckFailures: requiredSmokeCheckFailureMessages(requiredChecks),
```

- [x] **Step 3: Run the focused test to verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits zero and reports the expanded runner test count with zero failures.

Observed: exited zero with `115 passed, 0 failed`.

### Task 3: Document the Failure Message Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update README**

Update the `qa-summary.json` sentence to mention required check failure messages:

```markdown
`qa-summary.json`은 mode, redacted URL, 상태, exit code, smoke pass/fail 요약, check count, required check label results, required check pass/fail/missing totals, required check failure messages, 산출물 경로를 담으며...
```

- [x] **Step 2: Update runbook**

Update the runbook `qa-summary.json` sentence to mention required check failure messages:

```markdown
`qa-summary.json` records the latest run's mode, redacted URL, status, exit code, pass/fail counts, check count, required check label results, required check pass/fail/missing totals, required check failure messages, and artifact paths.
```

### Task 4: Verify and Publish

**Files:**
- Read: changed files
- Update after publish: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
rg -n "T[B]D|T[O]DO|implement lat[e]r|fill in deta[i]ls|Add appropriat[e]|Write tests for the abov[e]|Similar to Tas[k]" docs/superpowers/plans/2026-06-08-smoke-report-required-check-failures.md
npm test
git diff --check
```

Expected: every command exits zero except the placeholder scan, which exits one with no matches.

Observed: `node --check` passed for both scripts, focused runner tests reported `115 passed, 0 failed`, placeholder scan exited one with no matches, `npm test` reported `1292 passed, 0 failed across 40 test file(s)`, and `git diff --check` exited zero.

- [x] **Step 2: Run a local read-only smoke report**

Start the server:

```bash
PORT=8123 HOST=127.0.0.1 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-required-check-failures-local
node -e "const fs=require('fs'); const p='test-artifacts/tmp/qa-required-check-failures-local/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredCheckSummary:j.latestRun.requiredCheckSummary, requiredCheckFailures:j.latestRun.requiredCheckFailures, requiredChecks:j.latestRun.requiredChecks}, null, 2));"
rg -n '"requiredCheckFailures": \\[\\]' test-artifacts/tmp/qa-required-check-failures-local/qa-summary.json
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-required-check-failures-local
rm -rf test-artifacts/tmp/qa-required-check-failures-local
```

Expected: smoke report passes with 156 checks, `requiredCheckFailures` is an empty array, all thirteen `requiredChecks` statuses are `pass`, the sensitive scan exits one with no matches, and the temporary artifact directory is removed.

Observed: local read-only smoke report passed with `156 passed, 0 failed`; `qa-summary.json.latestRun.requiredCheckFailures` was `[]`; `requiredCheckSummary` was `{ total: 13, passed: 13, failed: 0, missing: 0 }`; all thirteen `requiredChecks` statuses were `pass`; sensitive scan exited one with no matches; temporary artifact directory was removed.

- [x] **Step 3: Run staged QA**

After staging only intended files, run:

```bash
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --cached --check
```

Expected: every command exits zero.

Observed: staged QA passed; `node --check` passed for both scripts, focused runner tests reported `115 passed, 0 failed`, `npm test` reported `1292 passed, 0 failed across 40 test file(s)`, and `git diff --cached --check` exited zero.

- [ ] **Step 4: Commit and push to main**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-required-check-failures.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
git commit -m "ci: record smoke report required check failures"
git push origin main
```

Expected: push succeeds and `main...origin/main` returns `0	0` after fetch.

- [ ] **Step 5: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5 --json databaseId,headSha,status,conclusion,workflowName,createdAt,url
gh run watch <run-id> --exit-status
rm -rf /tmp/lol-ai-coach-required-check-failures
mkdir -p /tmp/lol-ai-coach-required-check-failures
gh run download <run-id> --dir /tmp/lol-ai-coach-required-check-failures
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts --jq '.artifacts[] | [.id, .name, .expired, .size_in_bytes] | @tsv'
```

Then inspect the downloaded `qa-summary.json`:

```bash
node -e "const fs=require('fs'); const p='/tmp/lol-ai-coach-required-check-failures/qa-automation-<run-id>/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredCheckSummary:j.latestRun.requiredCheckSummary, requiredCheckFailures:j.latestRun.requiredCheckFailures, requiredChecks:j.latestRun.requiredChecks}, null, 2));"
rg -n '"requiredCheckFailures": \\[\\]' /tmp/lol-ai-coach-required-check-failures
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" /tmp/lol-ai-coach-required-check-failures
```

Expected: GitHub Actions exits zero, the artifact summary reports 156 passed and 0 failed, `requiredCheckFailures` is an empty array, all thirteen required checks pass, and the sensitive scan exits one with no matches.

- [ ] **Step 6: Update Obsidian project note**

Update `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`:

```markdown
- 최근 QA: `npm test` <total> passed / 0 failed across 40 test file(s), smoke report required check failures <focused> passed / 0 failed, local read-only smoke report 156 passed / 0 failed with `requiredCheckFailures` empty and required summary total 13 / passed 13 / failed 0 / missing 0, GitHub Actions QA run <run-id> 통과, read-only smoke artifact <artifact-id>에서 156 passed / 0 failed 및 `requiredCheckFailures: []` 확인, artifact 민감정보/경기ID/lockKey/raw error 스캔 매치 없음.
- 현재 저장소 상태: `main` / `origin/main` sync at `<commit>`.
```

Append a dated log entry before `## 리스크 관리` with the commit, run, artifact, and QA commands.

- [ ] **Step 7: Final sync check**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git status --short --branch
git log --oneline --decorate -5
gh run view <run-id> --json status,conclusion,headSha,url,workflowName,createdAt,updatedAt
```

Expected: `git rev-list` prints `0	0`, status shows `## main...origin/main`, the latest commit is `ci: record smoke report required check failures`, and the GitHub Actions run conclusion is `success`.
