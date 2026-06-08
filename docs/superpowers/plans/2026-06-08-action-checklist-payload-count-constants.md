# Action Checklist Payload Count Constants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the LLM payload's action checklist count metadata use `ACTION_CHECKLIST_MIN` and `ACTION_CHECKLIST_MAX` instead of duplicated numeric literals.

**Architecture:** `server.js` already defines `ACTION_CHECKLIST_MIN = 3` and `ACTION_CHECKLIST_MAX = 5`, and the validator/helper now use those constants. `buildLlmPayload()` still repeats the same numbers in `taskMeta` and `outputContract.requiredArrayCounts`, so focused payload tests should extract the constants and prove the payload values mirror them. The implementation then swaps the duplicated literals for the shared constants without changing the public payload shape.

**Tech Stack:** Node.js zero-dependency extracted-function tests, `server.js`, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Payload Constant Coverage

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`
- Modify: `README.md`

- [x] **Step 1: Extract action checklist constants in the payload test harness**

Add a reusable source block and exported values after the prompt extraction block:

```js
const actionChecklistCountConstantsSrc = [
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MIN"),
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MAX"),
].join("\n");
const { ACTION_CHECKLIST_MIN, ACTION_CHECKLIST_MAX } = new Function(
  `${actionChecklistCountConstantsSrc}\nreturn { ACTION_CHECKLIST_MIN, ACTION_CHECKLIST_MAX };`,
)();
```

Then add the same source block to `tfConstants` after `PHASE_SUMMARIES_MIN`:

```js
  actionChecklistCountConstantsSrc,
```

- [x] **Step 2: Add payload value and source-shape checks**

Inside case 5, after the `outputContract.schemaVersion = 1.0` check, add:

```js
  check("taskMeta.checklistCountMin mirrors ACTION_CHECKLIST_MIN", out.taskMeta.checklistCountMin, ACTION_CHECKLIST_MIN);
  check("taskMeta.checklistCountMax mirrors ACTION_CHECKLIST_MAX", out.taskMeta.checklistCountMax, ACTION_CHECKLIST_MAX);
```

Then after the existing `requiredArrayCounts.weaknesses` check, add:

```js
  check("requiredArrayCounts.actionChecklistMin mirrors ACTION_CHECKLIST_MIN", out.outputContract.requiredArrayCounts.actionChecklistMin, ACTION_CHECKLIST_MIN);
  check("requiredArrayCounts.actionChecklistMax mirrors ACTION_CHECKLIST_MAX", out.outputContract.requiredArrayCounts.actionChecklistMax, ACTION_CHECKLIST_MAX);
```

Then add source-shape checks after the payload value checks:

```js
  checkTrue("buildLlmPayload taskMeta uses ACTION_CHECKLIST_MIN", buildSrc.includes("checklistCountMin: ACTION_CHECKLIST_MIN"));
  checkTrue("buildLlmPayload taskMeta uses ACTION_CHECKLIST_MAX", buildSrc.includes("checklistCountMax: ACTION_CHECKLIST_MAX"));
  checkTrue("buildLlmPayload requiredArrayCounts uses ACTION_CHECKLIST_MIN", buildSrc.includes("actionChecklistMin: ACTION_CHECKLIST_MIN"));
  checkTrue("buildLlmPayload requiredArrayCounts uses ACTION_CHECKLIST_MAX", buildSrc.includes("actionChecklistMax: ACTION_CHECKLIST_MAX"));
```

- [x] **Step 3: Run focused RED test**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected before implementation:

```text
FAIL  buildLlmPayload taskMeta uses ACTION_CHECKLIST_MIN
FAIL  buildLlmPayload taskMeta uses ACTION_CHECKLIST_MAX
FAIL  buildLlmPayload requiredArrayCounts uses ACTION_CHECKLIST_MIN
FAIL  buildLlmPayload requiredArrayCounts uses ACTION_CHECKLIST_MAX
```

The payload values are numerically equal today, so the RED condition intentionally checks source shape: `buildLlmPayload()` must reference the shared constants, not duplicate the same literals.

### Task 2: Wire Payload Counts To Shared Constants

**Files:**
- Modify: `server.js`

- [x] **Step 1: Replace duplicated task metadata literals**

Change:

```js
taskMeta: { language: "ko", analysisMode: "coaching", strengthCount: 3, weaknessCount: 3, checklistCountMin: 3, checklistCountMax: 5 },
```

To:

```js
taskMeta: { language: "ko", analysisMode: "coaching", strengthCount: 3, weaknessCount: 3, checklistCountMin: ACTION_CHECKLIST_MIN, checklistCountMax: ACTION_CHECKLIST_MAX },
```

- [x] **Step 2: Replace duplicated output contract literals**

Change the `requiredArrayCounts` object so these fields use shared constants:

```js
actionChecklistMin: ACTION_CHECKLIST_MIN,
actionChecklistMax: ACTION_CHECKLIST_MAX,
```

- [x] **Step 3: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected after implementation:

```text
74 passed, 0 failed
```

### Task 3: QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-action-checklist-payload-count-constants.md`
- Modify: `README.md`

- [x] **Step 1: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/llm-payload-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-08-action-checklist-payload-count-constants.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 2: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1440 passed, 0 failed
```

- [x] **Step 3: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-payload-count-constants-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/action-checklist-payload-count-constants-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 4: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/action-checklist-payload-count-constants-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-08-action-checklist-payload-count-constants.md`

- [x] **Step 1: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

- [x] **Step 2: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/llm-payload-tests.mjs README.md docs/superpowers/plans/2026-06-08-action-checklist-payload-count-constants.md
git commit -m "test: mirror action checklist payload counts"
git push origin main
```

- [x] **Step 3: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/action-checklist-payload-count-constants-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/action-checklist-payload-count-constants-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

### Completion Evidence

- Focused RED: `node test-artifacts/server/llm-payload-tests.mjs` reported `70 passed, 4 failed` before implementation.
- Focused GREEN: `node test-artifacts/server/llm-payload-tests.mjs` reported `74 passed, 0 failed` after implementation.
- Static checks: `node --check server.js`, `node --check test-artifacts/server/llm-payload-tests.mjs`, `git diff --check`, and placeholder scan passed.
- Full test: `npm test` reported `1440 passed, 0 failed across 40 test file(s)`.
- Local smoke: read-only smoke report passed with `156 passed, 0 failed`, `durationMs: 203`, and required checks `13/13`.
- Implementation commit: `0e91294 test: mirror action checklist payload counts`.
- GitHub QA: run `27145470996` completed successfully for SHA `0e91294db2c0f263f084e6bc4f207a44c3b1840d`.
- GitHub artifact: `7483582871` (`qa-automation-27145470996`) passed with read-only smoke `156 passed, 0 failed`, `durationMs: 224`, required checks `13/13`, and no sensitive pattern matches.

---

## Self-Review

- Spec coverage: This plan closes the remaining action checklist count duplication in `buildLlmPayload()` after the validator and helper were already moved to shared constants.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `ACTION_CHECKLIST_MIN`, `ACTION_CHECKLIST_MAX`, `taskMeta.checklistCountMin`, `taskMeta.checklistCountMax`, `requiredArrayCounts.actionChecklistMin`, and `requiredArrayCounts.actionChecklistMax` are named consistently across tests and implementation.
