# Smoke Report Required Check Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured required-check count summary to `qa-summary.json` so CI artifacts show the required gate pass/fail/missing totals without consumers re-counting labels.

**Architecture:** Keep the existing label-level `latestRun.requiredChecks` array as the detailed evidence source. Add a derived `latestRun.requiredCheckSummary` object with `total`, `passed`, `failed`, and `missing` counts produced from the same required check results, including early sample manifest error probes where the total is zero.

**Tech Stack:** Node.js ESM smoke report runner, Node-based runner tests, Markdown README/runbook, GitHub Actions smoke report artifact.

---

### Task 1: Add Failing Runner Tests for Required Check Summary

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Inspect: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Write the failing tests**

Update the exact `buildQaSummary records latest run evidence without token values` expectation so `latestRun` includes:

```js
requiredCheckSummary: {
  total: 7,
  passed: 0,
  failed: 0,
  missing: 7,
},
```

Add a read-only missing summary check after `missingRequiredSummary`:

```js
check("buildQaSummary records missing required check summary",
  missingRequiredSummary?.latestRun?.requiredCheckSummary,
  {
    total: 13,
    passed: 0,
    failed: 0,
    missing: 13,
  });
```

Add a read-only passing summary check after the existing passing validation:

```js
const passingRequiredSummary = runner.buildQaSummary?.({
  config: missingRequiredCheckConfig,
  reportDir: "test-artifacts/qa-automation/2026-06-08T06-35-00Z-readonly",
  reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-35-00Z-readonly/smoke-report.json",
  metadataPath: "test-artifacts/qa-automation/2026-06-08T06-35-00Z-readonly/smoke-run.json",
  startedAt: "2026-06-08T06:35:00.000Z",
  finishedAt: "2026-06-08T06:35:10.000Z",
  exitCode: 0,
  smokeReport: passingRequiredCheckReport,
});

check("buildQaSummary records passing required check summary",
  passingRequiredSummary?.latestRun?.requiredCheckSummary,
  {
    total: 13,
    passed: 13,
    failed: 0,
    missing: 0,
  });
```

Add a mixed pass/fail/missing summary check:

```js
const mixedRequiredSummary = runner.buildQaSummary?.({
  config: missingRequiredCheckConfig,
  reportDir: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly",
  reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly/smoke-report.json",
  metadataPath: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly/smoke-run.json",
  startedAt: "2026-06-08T06:40:00.000Z",
  finishedAt: "2026-06-08T06:40:10.000Z",
  exitCode: 1,
  smokeReport: {
    status: "failed",
    actualMode: "readonly",
    summary: { passed: 41, failed: 1 },
    checks: [
      { status: "pass", label: "/api/samples list entries omit explicit matchId" },
      { status: "fail", label: "/.env is not publicly served" },
    ],
  },
});

check("buildQaSummary records mixed required check summary",
  mixedRequiredSummary?.latestRun?.requiredCheckSummary,
  {
    total: 13,
    passed: 1,
    failed: 1,
    missing: 11,
  });
```

Add an early sample-list error probe summary check:

```js
const sampleListErrorSummary = runner.buildQaSummary?.({
  config: sampleListErrorConfig,
  reportDir: "test-artifacts/qa-automation/2026-06-08T06-45-00Z-readonly",
  reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-45-00Z-readonly/smoke-report.json",
  metadataPath: "test-artifacts/qa-automation/2026-06-08T06-45-00Z-readonly/smoke-run.json",
  startedAt: "2026-06-08T06:45:00.000Z",
  finishedAt: "2026-06-08T06:45:10.000Z",
  exitCode: 0,
  smokeReport: missingRequiredCheckReport,
});

check("sample list error smoke reports record zero required check summary",
  sampleListErrorSummary?.latestRun?.requiredCheckSummary,
  {
    total: 0,
    passed: 0,
    failed: 0,
    missing: 0,
  });
```

- [x] **Step 2: Run the focused test to verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits non-zero because `latestRun.requiredCheckSummary` is not yet emitted by `scripts/run-smoke-report.mjs`.

Observed: exited non-zero with `106 passed, 5 failed`; failures showed `requiredCheckSummary` was missing from `buildQaSummary()` output.

### Task 2: Emit Required Check Summary

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add a count helper**

Add this helper below `requiredSmokeCheckResults()`:

```js
function summarizeRequiredSmokeChecks(requiredChecks) {
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    missing: 0,
  };
  for (const check of requiredChecks) {
    summary.total += 1;
    if (check?.status === "pass") {
      summary.passed += 1;
    } else if (check?.status === "fail") {
      summary.failed += 1;
    } else {
      summary.missing += 1;
    }
  }
  return summary;
}
```

- [x] **Step 2: Use the helper in `buildQaSummary()`**

Inside `buildQaSummary()`, compute required checks once:

```js
  const requiredChecks = requiredSmokeCheckResults(config, smokeReport);
```

Then set:

```js
      requiredChecks,
      requiredCheckSummary: summarizeRequiredSmokeChecks(requiredChecks),
```

- [x] **Step 3: Run the focused test to verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits zero and reports the expanded runner test count with zero failures.

Observed: exited zero with `111 passed, 0 failed`.

### Task 3: Document the Summary Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update README**

Update the `smoke:report:*` artifact sentence to:

```markdown
`qa-summary.json`은 mode, redacted URL, 상태, exit code, smoke pass/fail 요약, check count, required check label results, required check pass/fail/missing totals, 산출물 경로를 담으며, `smoke-run.json`의 command 필드는 `--token=<redacted>`와 redacted URL로 기록되어 토큰/URL secret 값을 남기지 않습니다.
```

- [x] **Step 2: Update runbook**

Update the runbook `qa-summary.json` sentence to:

```markdown
`qa-summary.json` records the latest run's mode, redacted URL, status, exit code, pass/fail counts, check count, required check label results, required check pass/fail/missing totals, and artifact paths.
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
rg -n "T[B]D|T[O]DO|implement lat[e]r|fill in deta[i]ls|Add appropriat[e]|Write tests for the abov[e]|Similar to Tas[k]" docs/superpowers/plans/2026-06-08-smoke-report-required-check-summary.md
npm test
git diff --check
```

Expected: every command exits zero except the placeholder scan, which exits one with no matches.

Observed: `node --check` passed for both scripts, focused runner tests reported `111 passed, 0 failed`, placeholder scan exited one with no matches, `npm test` reported `1288 passed, 0 failed across 40 test file(s)`, and `git diff --check` exited zero.

- [x] **Step 2: Run a local read-only smoke report**

Start the server:

```bash
PORT=8123 HOST=127.0.0.1 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-required-check-summary-local
node -e "const fs=require('fs'); const p='test-artifacts/tmp/qa-required-check-summary-local/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredCheckSummary:j.latestRun.requiredCheckSummary, requiredChecks:j.latestRun.requiredChecks}, null, 2));"
rg -n '"requiredCheckSummary"|"total": 13|"passed": 13|"failed": 0|"missing": 0' test-artifacts/tmp/qa-required-check-summary-local/qa-summary.json
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-required-check-summary-local
rm -rf test-artifacts/tmp/qa-required-check-summary-local
```

Expected: smoke report passes with 156 checks, `requiredCheckSummary` is `{ total: 13, passed: 13, failed: 0, missing: 0 }`, all thirteen `requiredChecks` statuses are `pass`, the sensitive scan exits one with no matches, and the temporary artifact directory is removed.

Observed: local read-only smoke report passed with `156 passed, 0 failed`; `qa-summary.json.latestRun.requiredCheckSummary` was `{ total: 13, passed: 13, failed: 0, missing: 0 }`; all thirteen `requiredChecks` statuses were `pass`; sensitive scan exited one with no matches; temporary artifact directory was removed.

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

Observed: staged QA passed; `node --check` passed for both scripts, focused runner tests reported `111 passed, 0 failed`, `npm test` reported `1288 passed, 0 failed across 40 test file(s)`, and `git diff --cached --check` exited zero.

- [ ] **Step 4: Commit and push to main**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-required-check-summary.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
git commit -m "ci: summarize smoke report required checks"
git push origin main
```

Expected: push succeeds and `main...origin/main` returns `0	0` after fetch.

- [ ] **Step 5: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5 --json databaseId,headSha,status,conclusion,workflowName,createdAt,url
gh run watch <run-id> --exit-status
rm -rf /tmp/lol-ai-coach-required-check-summary
mkdir -p /tmp/lol-ai-coach-required-check-summary
gh run download <run-id> --dir /tmp/lol-ai-coach-required-check-summary
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts --jq '.artifacts[] | [.id, .name, .expired, .size_in_bytes] | @tsv'
```

Then inspect the downloaded `qa-summary.json`:

```bash
node -e "const fs=require('fs'); const p='/tmp/lol-ai-coach-required-check-summary/qa-automation-<run-id>/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredCheckSummary:j.latestRun.requiredCheckSummary, requiredChecks:j.latestRun.requiredChecks}, null, 2));"
rg -n '"requiredCheckSummary"|"total": 13|"passed": 13|"failed": 0|"missing": 0' /tmp/lol-ai-coach-required-check-summary
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" /tmp/lol-ai-coach-required-check-summary
```

Expected: GitHub Actions exits zero, the artifact summary reports 156 passed and 0 failed, `requiredCheckSummary` is `{ total: 13, passed: 13, failed: 0, missing: 0 }`, all thirteen required checks pass, and the sensitive scan exits one with no matches.

- [ ] **Step 6: Update Obsidian project note**

Update `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`:

```markdown
- 최근 QA: `npm test` <total> passed / 0 failed across 40 test file(s), smoke report required check summary <focused> passed / 0 failed, local read-only smoke report 156 passed / 0 failed with requiredCheckSummary total 13 / passed 13 / failed 0 / missing 0, GitHub Actions QA run <run-id> 통과, read-only smoke artifact <artifact-id>에서 156 passed / 0 failed 및 requiredCheckSummary total 13 / passed 13 / failed 0 / missing 0 확인, artifact 민감정보/경기ID/lockKey/raw error 스캔 매치 없음.
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

Expected: `git rev-list` prints `0	0`, status shows `## main...origin/main`, the latest commit is `ci: summarize smoke report required checks`, and the GitHub Actions run conclusion is `success`.
