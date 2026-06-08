# Action Checklist Builder Min Padding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `buildActionChecklist()` itself honor the 3-item minimum now required by the final analysis validator.

**Architecture:** `ACTION_CHECKLIST_MIN` is now 3, and `validateAnalysisOutput()` rejects shorter checklists. `buildRuleBasedAnalysis()` normally passes three generated weaknesses, but the helper still returns fewer than three items when called with a short weakness list. Pad the helper's local weakness source to `ACTION_CHECKLIST_MIN` before mapping actions, preserving existing first/second/third/fourth action copy and the existing 4-item cap.

**Tech Stack:** Node.js zero-dependency tests, `server.js` extracted-function tests, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Builder Coverage

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Extract checklist minimum constant for helper tests**

Add `ACTION_CHECKLIST_MIN` to the evaluated source list before `buildActionChecklist`:

```js
    extractConstSource(serverSrc, "ACTION_CHECKLIST_MIN"),
```

- [x] **Step 2: Replace single-weakness legacy expectation**

Change:

```js
check("actionChecklist single weakness -> length 1", buildActionChecklist({}, [{ improvementHint: "only" }]).length, 1);
```

To:

```js
const singleWeaknessChecklist = buildActionChecklist({}, [{ improvementHint: "only" }]);
check("actionChecklist single weakness pads to min 3", singleWeaknessChecklist.length, 3);
check("actionChecklist single weakness keeps first reason", singleWeaknessChecklist[0].reason, "only");
check("actionChecklist single weakness pads fallback reasons", singleWeaknessChecklist.slice(1).every((a) => a.reason === "체크리스트 최소 항목을 채우기 위한 기본 개선 루틴"), true);
```

- [x] **Step 3: Add empty weakness list padding test**

Add:

```js
const emptyWeaknessChecklist = buildActionChecklist({}, []);
check("actionChecklist empty weakness list pads to min 3", emptyWeaknessChecklist.length, 3);
check("actionChecklist empty weakness ids", emptyWeaknessChecklist.map((a) => a.id), ["act_01", "act_02", "act_03"]);
```

- [x] **Step 4: Run focused RED test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected before implementation:

```text
FAIL  actionChecklist single weakness pads to min 3
FAIL  actionChecklist empty weakness list pads to min 3
```

### Task 2: Pad Builder Input

**Files:**
- Modify: `server.js`

- [x] **Step 1: Pad short weakness lists inside `buildActionChecklist()`**

Change:

```js
function buildActionChecklist(normalized, weaknesses) {
  return weaknesses.slice(0, 4).map((item, index) => ({
```

To:

```js
function buildActionChecklist(normalized, weaknesses) {
  const checklistWeaknesses = Array.isArray(weaknesses) ? weaknesses.slice(0, 4) : [];
  while (checklistWeaknesses.length < ACTION_CHECKLIST_MIN) {
    checklistWeaknesses.push({ improvementHint: "체크리스트 최소 항목을 채우기 위한 기본 개선 루틴" });
  }
  return checklistWeaknesses.map((item, index) => ({
```

- [x] **Step 2: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected after implementation:

```text
52 passed, 0 failed
```

### Task 3: QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-action-checklist-builder-min-padding.md`

- [x] **Step 1: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-08-action-checklist-builder-min-padding.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 2: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1431 passed, 0 failed
```

- [x] **Step 3: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-builder-min-padding-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/action-checklist-builder-min-padding-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 4: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/action-checklist-builder-min-padding-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-08-action-checklist-builder-min-padding.md`

- [ ] **Step 1: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs docs/superpowers/plans/2026-06-08-action-checklist-builder-min-padding.md
git commit -m "test: pad action checklist builder minimum"
git push origin main
```

- [ ] **Step 3: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/action-checklist-builder-min-padding-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/action-checklist-builder-min-padding-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

---

## Self-Review

- Spec coverage: This plan closes the helper-level gap left after raising `ACTION_CHECKLIST_MIN` to 3.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `ACTION_CHECKLIST_MIN`, `buildActionChecklist`, and the fallback `improvementHint` string are named consistently across tests and implementation.
