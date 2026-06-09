# Insight List Overcount Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify valid-but-overfull strengths and weaknesses lists as count violations instead of malformed shape violations.

**Architecture:** Keep the existing deterministic repair path and validator contract. Add RED coverage in the strengths/weaknesses count tracking harnesses for overfull valid insight lists, then update `buildAnalysis()` to emit `count.strengths>${INSIGHT_LIST_MAX}` and `count.weaknesses>${INSIGHT_LIST_MAX}` when item shapes are valid but the list exceeds the maximum.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

### Task 1: Add RED Coverage For Overfull Insight Lists

**Files:**
- Modify: `test-artifacts/server/strengths-count-tracking-tests.mjs`
- Modify: `test-artifacts/server/weaknesses-count-tracking-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-insight-list-overcount-tracking.md`

- [x] **Step 1: Add overfull strengths scenario**

In `test-artifacts/server/strengths-count-tracking-tests.mjs`, after the existing short-count assertions, mutate the test state to a valid four-item strengths list and call `buildAnalysis()` again:

```js
state.primaryResponse = primaryAnalysisFixture();
state.primaryResponse.strengths = [
  { id: "str_over_1", title: "over strength 1", description: "over strength description 1", relatedEventIds: [] },
  { id: "str_over_2", title: "over strength 2", description: "over strength description 2", relatedEventIds: [] },
  { id: "str_over_3", title: "over strength 3", description: "over strength description 3", relatedEventIds: [] },
  { id: "str_over_4", title: "over strength 4", description: "over strength description 4", relatedEventIds: [] },
];
state.fallbackCalls = 0;
state.strengthRepairCalls = 0;

const overStrengthsResult = await buildAnalysis(normalizedFixture(), "sample-strengths-overcount");
```

Then assert:

```js
checkTrue(
  "schemaViolations include overfull strengths count",
  overStrengthsResult.analysisMeta?.schemaViolations?.includes("count.strengths>3"),
);
checkTrue(
  "schemaViolations do not misclassify overfull strengths as malformed",
  !overStrengthsResult.analysisMeta?.schemaViolations?.includes("shape.strengths.invalid"),
);
check("overfull strengths schemaViolationCount", overStrengthsResult.analysisMeta?.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks overfull strengths separately",
  buildAnalysisSrc.includes("count.strengths>${INSIGHT_LIST_MAX}"),
);
```

- [x] **Step 2: Add overfull weaknesses scenario**

In `test-artifacts/server/weaknesses-count-tracking-tests.mjs`, after the existing short-count assertions, mutate the test state to a valid four-item weaknesses list and call `buildAnalysis()` again:

```js
state.primaryResponse = primaryAnalysisFixture();
state.primaryResponse.weaknesses = [
  { id: "wk_over_1", title: "over weakness 1", description: "over weakness description 1", relatedEventIds: [] },
  { id: "wk_over_2", title: "over weakness 2", description: "over weakness description 2", relatedEventIds: [] },
  { id: "wk_over_3", title: "over weakness 3", description: "over weakness description 3", relatedEventIds: [] },
  { id: "wk_over_4", title: "over weakness 4", description: "over weakness description 4", relatedEventIds: [] },
];
state.fallbackCalls = 0;
state.weaknessRepairCalls = 0;

const overWeaknessesResult = await buildAnalysis(normalizedFixture(), "sample-weaknesses-overcount");
```

Then assert:

```js
checkTrue(
  "schemaViolations include overfull weaknesses count",
  overWeaknessesResult.analysisMeta?.schemaViolations?.includes("count.weaknesses>3"),
);
checkTrue(
  "schemaViolations do not misclassify overfull weaknesses as malformed",
  !overWeaknessesResult.analysisMeta?.schemaViolations?.includes("shape.weaknesses.invalid"),
);
check("overfull weaknesses schemaViolationCount", overWeaknessesResult.analysisMeta?.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks overfull weaknesses separately",
  buildAnalysisSrc.includes("count.weaknesses>${INSIGHT_LIST_MAX}"),
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

Expected: syntax passes; each runtime test keeps the existing short-count assertions green and fails only on the new over-count classification/source assertions.

Result: `node --check` passed for both count tracking tests. Runtime produced the expected RED failure shape: strengths and weaknesses tests each reported `17 passed, 3 failed`, with failures limited to the new over-count classification/source assertions.

### Task 2: Implement Overcount Classification

**Files:**
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-insight-list-overcount-tracking.md`

- [x] **Step 1: Add strengths over-count branch**

In `buildAnalysis()`, change the strengths violation classification to keep the missing branch first, then short-count, then over-count, then shape:

```js
: (
  Array.isArray(primary.strengths) &&
  !hasMinimumInsightList(primary.strengths) &&
  strengthsHaveValidItemShapes
)
  ? `count.strengths<${INSIGHT_LIST_MIN}`
  : (
    Array.isArray(primary.strengths) &&
    primary.strengths.length > INSIGHT_LIST_MAX &&
    strengthsHaveValidItemShapes
  )
    ? `count.strengths>${INSIGHT_LIST_MAX}`
    : "shape.strengths.invalid";
```

- [x] **Step 2: Add weaknesses over-count branch**

In `buildAnalysis()`, change the weaknesses violation classification to keep the missing branch first, then short-count, then over-count, then shape:

```js
: (
  Array.isArray(primary.weaknesses) &&
  !hasMinimumInsightList(primary.weaknesses) &&
  weaknessesHaveValidItemShapes
)
  ? `count.weaknesses<${INSIGHT_LIST_MIN}`
  : (
    Array.isArray(primary.weaknesses) &&
    primary.weaknesses.length > INSIGHT_LIST_MAX &&
    weaknessesHaveValidItemShapes
  )
    ? `count.weaknesses>${INSIGHT_LIST_MAX}`
    : "shape.weaknesses.invalid";
```

- [x] **Step 3: Verify focused GREEN**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strengths-count-tracking-tests.mjs
node --check test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/server/strengths-count-tracking-tests.mjs
node test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/server/insight-list-shape-before-count-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected: all focused tests pass, and malformed short insight lists still report shape violations instead of count violations.

Result: Focused GREEN passed. `server.js` syntax check passed; strengths and weaknesses count tracking tests each reported `20 passed, 0 failed`; insight-list shape-before-count reported `21 passed, 0 failed`; schema regressions reported `105 passed, 0 failed`.

### Task 3: Full QA And Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-insight-list-overcount-tracking.md`
- Update outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-list-overcount-tracking-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/insight-list-overcount-tracking-local
```

Expected: tests and smoke pass; the sensitive-pattern scan exits 1 with no matches.

Result: Local QA passed on 2026-06-09 14:18 KST. `npm test` reported `2235 passed, 0 failed across 99 test file(s)`, `git diff --check` passed, read-only smoke report passed with 156 checks, and the local smoke artifact sensitive-pattern scan returned no matches.

- [ ] **Step 2: Commit and push implementation**

Commit and push:

```bash
git add server.js test-artifacts/server/strengths-count-tracking-tests.mjs test-artifacts/server/weaknesses-count-tracking-tests.mjs docs/superpowers/plans/2026-06-09-insight-list-overcount-tracking.md
git commit -m "test: track overfull insight lists"
git push origin main
```

- [ ] **Step 3: Verify GitHub QA**

Watch the pushed `QA` workflow, download the uploaded `qa-automation-*` artifact, inspect `qa-summary.json`, and scan the artifact for the same sensitive patterns.
