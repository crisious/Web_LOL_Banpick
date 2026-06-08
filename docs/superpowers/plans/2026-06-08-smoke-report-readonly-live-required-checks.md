# Smoke Report Readonly Live Required Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make read-only smoke report QA summaries prove that live/write API endpoints were blocked with the expected read-only error code.

**Architecture:** Split the smoke report runner's required full-smoke labels into common checks and read-only-only live/write block checks. Normal read-only reports must require sample-list privacy, sensitive static block, static `nosniff`, and read-only live/write block labels; protected reports keep only the common checks because they intentionally pass the live/write auth gate.

**Tech Stack:** Node.js ESM smoke report runner, Node-based runner tests, Markdown README/runbook.

---

### Task 1: Add Failing Runner Tests for Read-Only Live Required Checks

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Inspect: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Write the failing tests**

Replace the current `missingFullRequiredChecks` constant with two explicit expected arrays:

```js
const commonMissingFullRequiredChecks = [
  { label: "/api/samples list entries omit explicit matchId", status: "missing" },
  { label: "/.env is not publicly served", status: "missing" },
  { label: "/.env has X-Content-Type-Options nosniff", status: "missing" },
  { label: "/server.js is not publicly served", status: "missing" },
  { label: "/server.js has X-Content-Type-Options nosniff", status: "missing" },
  { label: "/data/samples/manifest.json is not publicly served", status: "missing" },
  { label: "/data/samples/manifest.json has X-Content-Type-Options nosniff", status: "missing" },
];

const readonlyMissingFullRequiredChecks = [
  ...commonMissingFullRequiredChecks,
  { label: "readonly mode blocks /api/recent-matches", status: "missing" },
  { label: "/api/recent-matches readonly block returns PUBLIC_DEMO_READONLY", status: "missing" },
  { label: "readonly mode blocks /api/champion-history", status: "missing" },
  { label: "/api/champion-history readonly block returns PUBLIC_DEMO_READONLY", status: "missing" },
  { label: "readonly mode blocks /api/generate-sample", status: "missing" },
  { label: "/api/generate-sample readonly block returns PUBLIC_DEMO_READONLY", status: "missing" },
];
```

Keep protected summary expectations on `commonMissingFullRequiredChecks`:

```js
requiredChecks: commonMissingFullRequiredChecks,
```

Update the read-only missing-check validation expectation to include the six read-only live/write messages:

```js
"missing required smoke check: readonly mode blocks /api/recent-matches",
"missing required smoke check: /api/recent-matches readonly block returns PUBLIC_DEMO_READONLY",
"missing required smoke check: readonly mode blocks /api/champion-history",
"missing required smoke check: /api/champion-history readonly block returns PUBLIC_DEMO_READONLY",
"missing required smoke check: readonly mode blocks /api/generate-sample",
"missing required smoke check: /api/generate-sample readonly block returns PUBLIC_DEMO_READONLY",
```

Update `passingRequiredCheckReport.checks` to include passing entries for these labels:

```js
{ status: "pass", label: "readonly mode blocks /api/recent-matches" },
{ status: "pass", label: "/api/recent-matches readonly block returns PUBLIC_DEMO_READONLY" },
{ status: "pass", label: "readonly mode blocks /api/champion-history" },
{ status: "pass", label: "/api/champion-history readonly block returns PUBLIC_DEMO_READONLY" },
{ status: "pass", label: "readonly mode blocks /api/generate-sample" },
{ status: "pass", label: "/api/generate-sample readonly block returns PUBLIC_DEMO_READONLY" },
```

Add one protected-mode guard so protected reports do not require read-only labels:

```js
check("protected smoke reports require common checks only",
  runner.requiredSmokeCheckResults?.(protectedConfig, { checks: [] }),
  commonMissingFullRequiredChecks);
```

- [x] **Step 2: Run the focused test to verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits non-zero because `scripts/run-smoke-report.mjs` still requires only the common full-smoke labels for read-only reports.

Observed: exited non-zero with `105 passed, 2 failed`; failures showed read-only summaries still required only the seven common full-smoke labels.

### Task 2: Split Required Labels by Smoke Mode

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Replace the single required label constant**

Change the existing constant to:

```js
const COMMON_REQUIRED_FULL_SMOKE_CHECK_LABELS = [
  "/api/samples list entries omit explicit matchId",
  "/.env is not publicly served",
  "/.env has X-Content-Type-Options nosniff",
  "/server.js is not publicly served",
  "/server.js has X-Content-Type-Options nosniff",
  "/data/samples/manifest.json is not publicly served",
  "/data/samples/manifest.json has X-Content-Type-Options nosniff",
];
const READONLY_REQUIRED_FULL_SMOKE_CHECK_LABELS = [
  "readonly mode blocks /api/recent-matches",
  "/api/recent-matches readonly block returns PUBLIC_DEMO_READONLY",
  "readonly mode blocks /api/champion-history",
  "/api/champion-history readonly block returns PUBLIC_DEMO_READONLY",
  "readonly mode blocks /api/generate-sample",
  "/api/generate-sample readonly block returns PUBLIC_DEMO_READONLY",
];
```

- [x] **Step 2: Add a mode-aware label helper**

Add this helper near `isEarlySampleErrorProbe`:

```js
function requiredFullSmokeCheckLabelsFor(config) {
  if (isEarlySampleErrorProbe(config)) return [];
  return [
    ...COMMON_REQUIRED_FULL_SMOKE_CHECK_LABELS,
    ...(config?.expectedMode === "readonly" ? READONLY_REQUIRED_FULL_SMOKE_CHECK_LABELS : []),
  ];
}
```

Then update `requiredSmokeCheckResults()`:

```js
export function requiredSmokeCheckResults(config, smokeReport) {
  const checks = Array.isArray(smokeReport?.checks) ? smokeReport.checks : [];
  return requiredFullSmokeCheckLabelsFor(config).map((label) => {
    const check = checks.find((item) => item?.label === label);
    if (!check) return { label, status: "missing" };
    return { label, status: check.status === "pass" ? "pass" : "fail" };
  });
}
```

- [x] **Step 3: Run the focused test to verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits zero with read-only summaries requiring thirteen labels and protected summaries requiring seven labels.

Observed: exited zero with `107 passed, 0 failed`.

### Task 3: Document the Expanded Artifact Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update README**

Update the smoke report security sentence to:

```markdown
`npm run smoke:report:*` also records this privacy gate plus core sensitive static block and `nosniff` gates in `qa-summary.json.latestRun.requiredChecks`; read-only report runs additionally record live/write API block and `PUBLIC_DEMO_READONLY` code gates, and normal report runs fail if any mode-required full-smoke check is missing from the smoke report.
```

- [x] **Step 2: Update runbook**

Update the expected checklist wording to:

```markdown
Smoke report summaries must include the required sample-list privacy, core sensitive static block, static block `nosniff`, and read-only live/write block check results so CI artifacts prove those gates were part of the run.
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
rg -n "T[B]D|T[O]DO|implement lat[e]r|fill in deta[i]ls|Add appropriat[e]|Write tests for the abov[e]|Similar to Tas[k]" docs/superpowers/plans/2026-06-08-smoke-report-readonly-live-required-checks.md
npm test
git diff --check
```

Expected: every command exits zero except the placeholder scan, which exits one with no matches.

Observed: `node --check` passed for both scripts, focused runner tests reported `107 passed, 0 failed`, placeholder scan exited one with no matches, `npm test` reported `1284 passed, 0 failed across 40 test file(s)`, and `git diff --check` exited zero.

- [x] **Step 2: Run a local read-only smoke report**

Start the server:

```bash
PORT=8123 HOST=127.0.0.1 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-readonly-live-required-check-local
node -e "const fs=require('fs'); const p='test-artifacts/tmp/qa-readonly-live-required-check-local/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredChecks:j.latestRun.requiredChecks}, null, 2));"
rg -n "readonly mode blocks /api/recent-matches|/api/recent-matches readonly block returns PUBLIC_DEMO_READONLY|readonly mode blocks /api/champion-history|/api/champion-history readonly block returns PUBLIC_DEMO_READONLY|readonly mode blocks /api/generate-sample|/api/generate-sample readonly block returns PUBLIC_DEMO_READONLY" test-artifacts/tmp/qa-readonly-live-required-check-local
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-readonly-live-required-check-local
rm -rf test-artifacts/tmp/qa-readonly-live-required-check-local
```

Expected: smoke report passes with 156 checks, all thirteen `requiredChecks` statuses are `pass`, the read-only label search finds all six added gates, the sensitive scan exits one with no matches, and the temporary artifact directory is removed.

Observed: local read-only smoke report passed with `156 passed, 0 failed`; `qa-summary.json.latestRun.requiredChecks` contained all thirteen required checks with `pass`; read-only label search found all six added gates; sensitive scan exited one with no matches; temporary artifact directory was removed.

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

Observed: staged QA passed; `node --check` passed for both scripts, focused runner tests reported `107 passed, 0 failed`, `npm test` reported `1284 passed, 0 failed across 40 test file(s)`, and `git diff --cached --check` exited zero.

- [ ] **Step 4: Commit and push to main**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-readonly-live-required-checks.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
git commit -m "ci: require readonly live smoke report checks"
git push origin main
```

Expected: push succeeds and `main...origin/main` returns `0	0` after fetch.

- [ ] **Step 5: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5 --json databaseId,headSha,status,conclusion,workflowName,createdAt,url
gh run watch <run-id> --exit-status
rm -rf /tmp/lol-ai-coach-readonly-live-required-checks
mkdir -p /tmp/lol-ai-coach-readonly-live-required-checks
gh run download <run-id> --dir /tmp/lol-ai-coach-readonly-live-required-checks
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts --jq '.artifacts[] | [.id, .name, .expired, .size_in_bytes] | @tsv'
```

Then inspect the downloaded read-only `qa-summary.json` and smoke report:

```bash
node -e "const fs=require('fs'); const p='/tmp/lol-ai-coach-readonly-live-required-checks/qa-automation/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify({status:j.latestRun.status, exitCode:j.latestRun.exitCode, smokeSummary:j.latestRun.smokeSummary, checkCount:j.latestRun.checkCount, requiredChecks:j.latestRun.requiredChecks}, null, 2));"
rg -n "readonly mode blocks /api/recent-matches|/api/recent-matches readonly block returns PUBLIC_DEMO_READONLY|readonly mode blocks /api/champion-history|/api/champion-history readonly block returns PUBLIC_DEMO_READONLY|readonly mode blocks /api/generate-sample|/api/generate-sample readonly block returns PUBLIC_DEMO_READONLY" /tmp/lol-ai-coach-readonly-live-required-checks
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" /tmp/lol-ai-coach-readonly-live-required-checks
```

Expected: GitHub Actions exits zero, the read-only artifact summary reports 156 passed and 0 failed, all thirteen required checks pass, the read-only label search finds all six added gates, and the sensitive scan exits one with no matches.

- [ ] **Step 6: Update Obsidian project note**

Update `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`:

```markdown
- 최근 QA: `npm test` 1284 passed / 0 failed across 40 test file(s), smoke report readonly live required checks 107 passed / 0 failed, local read-only smoke report 156 passed / 0 failed with thirteen required checks pass, GitHub Actions QA run <run-id> 통과, read-only smoke artifact <artifact-id>에서 156 passed / 0 failed 및 sample/static/nosniff/readonly live required checks pass 확인, artifact 민감정보/경기ID/lockKey/raw error 스캔 매치 없음.
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

Expected: `git rev-list` prints `0	0`, status shows `## main...origin/main`, the latest commit is `ci: require readonly live smoke report checks`, and the GitHub Actions run conclusion is `success`.
