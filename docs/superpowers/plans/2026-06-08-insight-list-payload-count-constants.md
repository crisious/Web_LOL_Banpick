# Insight List Payload Count Constants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the LLM payload's strengths/weaknesses count metadata use `INSIGHT_LIST_MIN` and `INSIGHT_LIST_MAX` instead of duplicated numeric literals.

**Architecture:** `server.js` already defines `INSIGHT_LIST_MIN = 3` and `INSIGHT_LIST_MAX = 3`, and `validateAnalysisOutput()` uses those constants for `strengths` and `weaknesses`. `buildLlmPayload()` still repeats `3` for `taskMeta.strengthCount`, `taskMeta.weaknessCount`, `requiredArrayCounts.strengths`, and `requiredArrayCounts.weaknesses`. Focused payload tests will extract the insight constants, verify payload values mirror them, and require the builder source to reference the constants directly.

**Tech Stack:** Node.js zero-dependency extracted-function tests, `server.js`, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Payload Constant Coverage

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`
- Modify: `README.md`

- [x] **Step 1: Extract insight list constants in the payload test harness**

Add this reusable source block after the existing action checklist count constants block:

```js
const insightListCountConstantsSrc = [
  extractConstSource(serverSrc, "INSIGHT_LIST_MIN"),
  extractConstSource(serverSrc, "INSIGHT_LIST_MAX"),
].join("\n");
const { INSIGHT_LIST_MIN, INSIGHT_LIST_MAX } = new Function(
  `${insightListCountConstantsSrc}\nreturn { INSIGHT_LIST_MIN, INSIGHT_LIST_MAX };`,
)();
```

Then replace the current `extractConstSource(serverSrc, "INSIGHT_LIST_MAX")` entry in `tfConstants` with:

```js
  insightListCountConstantsSrc,
```

- [x] **Step 2: Add payload value and source-shape checks**

Inside case 5, after the two action checklist taskMeta checks, add:

```js
  check("taskMeta.strengthCount mirrors INSIGHT_LIST_MIN", out.taskMeta.strengthCount, INSIGHT_LIST_MIN);
  check("taskMeta.weaknessCount mirrors INSIGHT_LIST_MIN", out.taskMeta.weaknessCount, INSIGHT_LIST_MIN);
```

Change the existing strengths/weaknesses array count checks to use the constants:

```js
  check("requiredArrayCounts.strengthsMax mirrors INSIGHT_LIST_MAX", out.outputContract.requiredArrayCounts.strengthsMax, INSIGHT_LIST_MAX);
  check("requiredArrayCounts.weaknessesMax mirrors INSIGHT_LIST_MAX", out.outputContract.requiredArrayCounts.weaknessesMax, INSIGHT_LIST_MAX);
  check("requiredArrayCounts.strengths mirrors INSIGHT_LIST_MIN", out.outputContract.requiredArrayCounts.strengths, INSIGHT_LIST_MIN);
  check("requiredArrayCounts.weaknesses mirrors INSIGHT_LIST_MIN", out.outputContract.requiredArrayCounts.weaknesses, INSIGHT_LIST_MIN);
```

Then add source-shape checks after the existing action checklist source-shape checks:

```js
  checkTrue("buildLlmPayload taskMeta uses INSIGHT_LIST_MIN for strengthCount", buildSrc.includes("strengthCount: INSIGHT_LIST_MIN"));
  checkTrue("buildLlmPayload taskMeta uses INSIGHT_LIST_MIN for weaknessCount", buildSrc.includes("weaknessCount: INSIGHT_LIST_MIN"));
  checkTrue("buildLlmPayload requiredArrayCounts uses INSIGHT_LIST_MIN for strengths", buildSrc.includes("strengths: INSIGHT_LIST_MIN"));
  checkTrue("buildLlmPayload requiredArrayCounts uses INSIGHT_LIST_MIN for weaknesses", buildSrc.includes("weaknesses: INSIGHT_LIST_MIN"));
  checkTrue("buildLlmPayload requiredArrayCounts uses INSIGHT_LIST_MAX for strengthsMax", buildSrc.includes("strengthsMax: INSIGHT_LIST_MAX"));
  checkTrue("buildLlmPayload requiredArrayCounts uses INSIGHT_LIST_MAX for weaknessesMax", buildSrc.includes("weaknessesMax: INSIGHT_LIST_MAX"));
```

- [x] **Step 3: Run focused RED test**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected before implementation:

```text
FAIL  buildLlmPayload taskMeta uses INSIGHT_LIST_MIN for strengthCount
FAIL  buildLlmPayload taskMeta uses INSIGHT_LIST_MIN for weaknessCount
FAIL  buildLlmPayload requiredArrayCounts uses INSIGHT_LIST_MIN for strengths
FAIL  buildLlmPayload requiredArrayCounts uses INSIGHT_LIST_MIN for weaknesses
```

The payload values are numerically equal today, so the RED condition intentionally checks source shape: `buildLlmPayload()` must reference the shared constants, not duplicate the same literals.

### Task 2: Wire Payload Counts To Shared Constants

**Files:**
- Modify: `server.js`

- [x] **Step 1: Replace duplicated task metadata literals**

Change:

```js
taskMeta: { language: "ko", analysisMode: "coaching", strengthCount: 3, weaknessCount: 3, checklistCountMin: ACTION_CHECKLIST_MIN, checklistCountMax: ACTION_CHECKLIST_MAX },
```

To:

```js
taskMeta: { language: "ko", analysisMode: "coaching", strengthCount: INSIGHT_LIST_MIN, weaknessCount: INSIGHT_LIST_MIN, checklistCountMin: ACTION_CHECKLIST_MIN, checklistCountMax: ACTION_CHECKLIST_MAX },
```

- [x] **Step 2: Replace duplicated output contract literals**

Change the `requiredArrayCounts` object so these fields use shared constants:

```js
strengths: INSIGHT_LIST_MIN,
weaknesses: INSIGHT_LIST_MIN,
```

Keep these existing max fields as:

```js
strengthsMax: INSIGHT_LIST_MAX,
weaknessesMax: INSIGHT_LIST_MAX,
```

- [x] **Step 3: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected after implementation:

```text
82 passed, 0 failed
```

### Task 3: QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-insight-list-payload-count-constants.md`

- [x] **Step 1: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/llm-payload-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-08-insight-list-payload-count-constants.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 2: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1448 passed, 0 failed
```

- [x] **Step 3: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-list-payload-count-constants-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/insight-list-payload-count-constants-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 4: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/insight-list-payload-count-constants-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-08-insight-list-payload-count-constants.md`

- [x] **Step 1: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

- [x] **Step 2: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/llm-payload-tests.mjs README.md docs/superpowers/plans/2026-06-08-insight-list-payload-count-constants.md
git commit -m "test: mirror insight list payload counts"
git push origin main
```

- [x] **Step 3: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/insight-list-payload-count-constants-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/insight-list-payload-count-constants-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

### Completion Evidence

- Focused RED: `node test-artifacts/server/llm-payload-tests.mjs` reported `78 passed, 4 failed` before implementation.
- Focused GREEN: `node test-artifacts/server/llm-payload-tests.mjs` reported `82 passed, 0 failed` after implementation.
- Static checks: `node --check server.js`, `node --check test-artifacts/server/llm-payload-tests.mjs`, `git diff --check`, and placeholder scan passed.
- Full test: `npm test` reported `1448 passed, 0 failed across 40 test file(s)`.
- Local smoke: read-only smoke report passed with `156 passed, 0 failed`, `durationMs: 201`, and required checks `13/13`.
- Implementation commit: `0e45727 test: mirror insight list payload counts`.
- GitHub sync note: the first push hit a remote `fatal error in commit_refs`; `git push --porcelain origin main` retried the same commit successfully.
- GitHub QA: run `27146099254` completed successfully for SHA `0e45727173551c44a4c20e066566323414611648`.
- GitHub artifact: `7483867343` (`qa-automation-27146099254`) passed with read-only smoke `156 passed, 0 failed`, `durationMs: 205`, required checks `13/13`, and no sensitive pattern matches.

---

## Self-Review

- Spec coverage: This plan closes the remaining strengths/weaknesses count duplication in `buildLlmPayload()` after the validator already uses shared insight list constants.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `INSIGHT_LIST_MIN`, `INSIGHT_LIST_MAX`, `taskMeta.strengthCount`, `taskMeta.weaknessCount`, `requiredArrayCounts.strengths`, `requiredArrayCounts.weaknesses`, `strengthsMax`, and `weaknessesMax` are named consistently across tests and implementation.
