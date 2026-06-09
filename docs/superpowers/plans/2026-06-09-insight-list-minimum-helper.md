# Insight List Minimum Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure strengths and weaknesses minimum-count validation uses a shared `hasMinimumInsightList()` helper everywhere count-specific repair classification depends on it.

**Architecture:** Keep deterministic insight repair and existing violation keys unchanged. Add a small minimum-count helper in `server.js`, use it from `hasValidInsightList()` and both `buildAnalysis()` count branches, then update source-extraction harnesses so evaluated validators include the new helper.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

### Task 1: Add RED Coverage For Helper Delegation

**Files:**
- Modify: `test-artifacts/server/strengths-count-tracking-tests.mjs`
- Modify: `test-artifacts/server/weaknesses-count-tracking-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-insight-list-minimum-helper.md`

- [x] **Step 1: Capture validator source and fallback helper source**

In both count tracking test files, add:

```js
const hasValidInsightListSrc = extractFunctionSource(serverSrc, "hasValidInsightList");
const insightListMinimumSource = serverSrc.includes("function hasMinimumInsightList(")
  ? extractFunctionSource(serverSrc, "hasMinimumInsightList")
  : `
function hasMinimumInsightList(items) {
  return Array.isArray(items) && items.length >= INSIGHT_LIST_MIN;
}
`;
```

Add `insightListMinimumSource` to `supportSources` immediately before `hasValidInsightListSrc`, and use `hasValidInsightListSrc` instead of extracting `hasValidInsightList()` inline.

- [x] **Step 2: Assert helper reuse**

In `strengths-count-tracking-tests.mjs`, add:

```js
checkTrue(
  "server defines shared insight list minimum helper",
  serverSrc.includes("function hasMinimumInsightList"),
);
checkTrue(
  "hasValidInsightList reuses minimum helper",
  hasValidInsightListSrc.includes("hasMinimumInsightList(items)"),
);
checkTrue(
  "buildAnalysis checks strengths minimum helper for count",
  buildAnalysisSrc.includes("hasMinimumInsightList(primary.strengths)"),
);
```

In `weaknesses-count-tracking-tests.mjs`, add:

```js
checkTrue(
  "server defines shared insight list minimum helper",
  serverSrc.includes("function hasMinimumInsightList"),
);
checkTrue(
  "hasValidInsightList reuses minimum helper",
  hasValidInsightListSrc.includes("hasMinimumInsightList(items)"),
);
checkTrue(
  "buildAnalysis checks weaknesses minimum helper for count",
  buildAnalysisSrc.includes("hasMinimumInsightList(primary.weaknesses)"),
);
```

- [x] **Step 3: Verify RED**

Run:

```bash
node --check test-artifacts/server/strengths-count-tracking-tests.mjs
node --check test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/server/strengths-count-tracking-tests.mjs
node test-artifacts/server/weaknesses-count-tracking-tests.mjs
```

Expected: syntax passes, runtime fails only on the new helper/source delegation assertions.

Result: `node --check` passed for both count tracking tests. Runtime produced the expected RED failure shape: each test reported `9 passed, 3 failed`, with failures limited to the new shared helper/delegation assertions.

### Task 2: Implement Minimal Helper Delegation

**Files:**
- Modify: `server.js`
- Modify: source-extraction harnesses under `test-artifacts/server/*.mjs` and `test-artifacts/schema/*.mjs` that evaluate `hasValidInsightList()`
- Modify: `docs/superpowers/plans/2026-06-09-insight-list-minimum-helper.md`

- [x] **Step 1: Add helper and use it in `hasValidInsightList()`**

Add before `hasValidInsightList()`:

```js
function hasMinimumInsightList(items) {
  return Array.isArray(items) && items.length >= INSIGHT_LIST_MIN;
}
```

Then change `hasValidInsightList()` to:

```js
function hasValidInsightList(items) {
  return hasMinimumInsightList(items) &&
    items.length <= INSIGHT_LIST_MAX &&
    hasValidInsightItemShapes(items);
}
```

- [x] **Step 2: Use helper in `buildAnalysis()` count branches**

Change only the short-count predicates:

```js
Array.isArray(primary.strengths) &&
!hasMinimumInsightList(primary.strengths) &&
strengthsHaveValidItemShapes
```

```js
Array.isArray(primary.weaknesses) &&
!hasMinimumInsightList(primary.weaknesses) &&
weaknessesHaveValidItemShapes
```

- [x] **Step 3: Update extraction harnesses**

For every test harness that evaluates `hasValidInsightList()` or `buildAnalysis()`, include:

```js
extractFunctionSource(serverSrc, "hasMinimumInsightList"),
```

immediately before `hasValidInsightList` in the support source order.

- [x] **Step 4: Verify focused GREEN**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strengths-count-tracking-tests.mjs
node --check test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/server/strengths-count-tracking-tests.mjs
node test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/server/insight-list-shape-before-count-tests.mjs
node test-artifacts/server/strengths-missing-tracking-tests.mjs
node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
node test-artifacts/schema/insight-list-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected: all focused tests pass.

Result: Focused GREEN passed. `server.js` syntax check passed; strengths and weaknesses count tracking tests reported `12 passed, 0 failed`; insight-list shape-before-count reported `21 passed, 0 failed`; missing tracking, schema, and adjacent count/nonblank policy tests all passed.

### Task 3: Full QA And Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-insight-list-minimum-helper.md`
- Update outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-list-minimum-helper-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/insight-list-minimum-helper-local
```

Expected: tests and smoke pass; the sensitive-pattern scan exits 1 with no matches.

Result: Local QA passed on 2026-06-09 14:08 KST. `npm test` reported `2219 passed, 0 failed across 99 test file(s)`, `git diff --check` passed, read-only smoke report passed with 156 checks, and the local smoke artifact sensitive-pattern scan returned no matches.

- [ ] **Step 2: Commit and push implementation**

Commit and push:

```bash
git add server.js test-artifacts docs/superpowers/plans/2026-06-09-insight-list-minimum-helper.md
git commit -m "test: reuse insight list minimum helper"
git push origin main
```

- [ ] **Step 3: Verify GitHub QA**

Watch the pushed `QA` workflow, download the uploaded `qa-automation-*` artifact, inspect `qa-summary.json`, and scan the artifact for the same sensitive patterns.
