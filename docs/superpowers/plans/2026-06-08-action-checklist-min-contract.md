# Action Checklist Min Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the final analysis validator with the LLM output contract so `actionChecklist` requires at least 3 items and at most 5 items.

**Architecture:** `server.js` already advertises `taskMeta.checklistCountMin = 3`, `outputContract.requiredArrayCounts.actionChecklistMin = 3`, and prompt text `actionChecklist는 3~5개의 배열이다.` The final validator still uses `ACTION_CHECKLIST_MIN = 1`, so a partial AI checklist can pass. Raise `ACTION_CHECKLIST_MIN` to 3 and update focused schema tests so partial checklists fail before implementation and pass after implementation.

**Tech Stack:** Node.js zero-dependency tests, `server.js` extracted-function schema tests, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Schema Coverage

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [x] **Step 1: Expand valid fixture action checklist to 3 items**

Change:

```js
    actionChecklist: [{ id: "act_1", text: "t" }],
```

To:

```js
    actionChecklist: [
      { id: "act_1", text: "t1" },
      { id: "act_2", text: "t2" },
      { id: "act_3", text: "t3" },
    ],
```

- [x] **Step 2: Add partial checklist rejection test**

Insert after the existing `actionChecklist empty throws` test:

```js
expectThrows("actionChecklist only 2 throws", () => {
  const f = validFixture();
  f.actionChecklist = f.actionChecklist.slice(0, 2);
  validateAnalysisOutput(f);
}, "actionChecklist");
```

- [x] **Step 3: Run focused RED test**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected before implementation:

```text
FAIL  actionChecklist only 2 throws - expected throw but did not
```

### Task 2: Align Validator Constant

**Files:**
- Modify: `server.js`

- [x] **Step 1: Raise action checklist minimum**

Change:

```js
// actionChecklist는 legacy rule-based fallback 호환을 위해 최소 1개, LLM 계약 상한 5개를 검증한다.
const ACTION_CHECKLIST_MIN = 1;
const ACTION_CHECKLIST_MAX = 5;
```

To:

```js
// actionChecklist는 LLM 출력 계약과 코칭 체크리스트 UI에 맞춰 3~5개를 검증한다.
const ACTION_CHECKLIST_MIN = 3;
const ACTION_CHECKLIST_MAX = 5;
```

- [x] **Step 2: Run focused GREEN test**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected after implementation:

```text
85 passed, 0 failed
```

### Task 3: Documentation And QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-action-checklist-min-contract.md`

- [x] **Step 1: Update README schema count**

Change:

```md
npm run test:schema      # validateAnalysisOutput 위반 패턴 84건
```

To:

```md
npm run test:schema      # validateAnalysisOutput 위반 패턴 85건
```

- [x] **Step 2: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/schema-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-08-action-checklist-min-contract.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 3: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1427 passed, 0 failed
```

- [x] **Step 4: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-min-contract-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/action-checklist-min-contract-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 5: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/action-checklist-min-contract-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-08-action-checklist-min-contract.md`

- [ ] **Step 1: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add server.js test-artifacts/schema/schema-tests.mjs README.md docs/superpowers/plans/2026-06-08-action-checklist-min-contract.md
git commit -m "test: require action checklist minimum"
git push origin main
```

- [ ] **Step 3: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/action-checklist-min-contract-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/action-checklist-min-contract-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

---

## Self-Review

- Spec coverage: This plan covers the exact inconsistency between `taskMeta.checklistCountMin`, `outputContract.requiredArrayCounts.actionChecklistMin`, prompt text, and the final validator constant.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `ACTION_CHECKLIST_MIN`, `ACTION_CHECKLIST_MAX`, and `actionChecklist` are named consistently across tests, implementation, and README.
