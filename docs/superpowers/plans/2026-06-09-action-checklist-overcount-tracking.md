# Action Checklist Overcount Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify valid-but-overfull action checklist lists as count violations instead of malformed shape violations.

**Architecture:** Keep the existing deterministic repair path and validator contract. Add RED coverage in the action checklist count tracking harness for a valid six-item checklist, then update `buildAnalysis()` to emit `count.actionChecklist>${ACTION_CHECKLIST_MAX}` when item shapes are valid but the list exceeds the maximum.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

### Task 1: Add RED Coverage For Overfull Action Checklists

**Files:**
- Modify: `test-artifacts/server/action-checklist-count-tracking-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-action-checklist-overcount-tracking.md`

- [x] **Step 1: Add overfull action checklist scenario**

In `test-artifacts/server/action-checklist-count-tracking-tests.mjs`, after the existing short-count assertions, mutate the test state to a valid six-item action checklist and call `buildAnalysis()` again:

```js
state.primaryResponse = primaryAnalysisFixture();
state.primaryResponse.actionChecklist = [
  { id: "act_over_1", text: "over action 1" },
  { id: "act_over_2", text: "over action 2" },
  { id: "act_over_3", text: "over action 3" },
  { id: "act_over_4", text: "over action 4" },
  { id: "act_over_5", text: "over action 5" },
  { id: "act_over_6", text: "over action 6" },
];
state.fallbackCalls = 0;
state.actionRepairCalls = 0;

const overActionResult = await buildAnalysis(normalizedFixture(), "sample-action-overcount");
```

Then assert:

```js
check("overfull action checklist primary analysis is preserved", overActionResult.matchSummary?.headline, "primary headline");
check("overfull action checklist fallback is not used", state.fallbackCalls, 0);
check("overfull action checklist is repaired", overActionResult.actionChecklist?.map((item) => item.id), ["act_1", "act_2", "act_3"]);
check("overfull action repair called once", state.actionRepairCalls, 1);
checkTrue(
  "schemaViolations include overfull action checklist count",
  overActionResult.analysisMeta?.schemaViolations?.includes("count.actionChecklist>5"),
);
checkTrue(
  "schemaViolations do not misclassify overfull checklist as malformed",
  !overActionResult.analysisMeta?.schemaViolations?.includes("shape.actionChecklist.invalid"),
);
check("overfull action checklist schemaViolationCount", overActionResult.analysisMeta?.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks overfull action checklists separately",
  buildAnalysisSrc.includes("count.actionChecklist>${ACTION_CHECKLIST_MAX}"),
);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
```

Expected: syntax passes; runtime keeps the existing short-count assertions green and fails only on the new over-count classification/source assertions.

Result: `node --check` passed. Runtime produced the expected RED failure shape: `17 passed, 3 failed`, with failures limited to the new over-count classification/source assertions.

### Task 2: Implement Overcount Classification

**Files:**
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-action-checklist-overcount-tracking.md`

- [x] **Step 1: Add action checklist over-count branch**

In `buildAnalysis()`, change the action checklist violation classification to keep the missing branch first, then short-count, then over-count, then shape:

```js
: (
  Array.isArray(primary.actionChecklist) &&
  !hasMinimumActionChecklist(primary.actionChecklist) &&
  actionChecklistHasValidItemShapes
)
  ? `count.actionChecklist<${ACTION_CHECKLIST_MIN}`
  : (
    Array.isArray(primary.actionChecklist) &&
    primary.actionChecklist.length > ACTION_CHECKLIST_MAX &&
    actionChecklistHasValidItemShapes
  )
    ? `count.actionChecklist>${ACTION_CHECKLIST_MAX}`
    : "shape.actionChecklist.invalid";
```

- [x] **Step 2: Verify focused GREEN**

Run:

```bash
node --check server.js
node --check test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-shape-before-count-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected: all focused tests pass, and malformed short action checklists still report shape violations instead of count violations.

Result: Focused GREEN passed. `server.js` syntax check passed; action checklist count tracking reported `20 passed, 0 failed`; action checklist shape-before-count reported `9 passed, 0 failed`; schema regressions reported `105 passed, 0 failed`.

### Task 3: Full QA And Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-action-checklist-overcount-tracking.md`
- Update outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-overcount-tracking-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/action-checklist-overcount-tracking-local
```

Expected: tests and smoke pass; the sensitive-pattern scan exits 1 with no matches.

Result: Local QA passed on 2026-06-09 14:26 KST. `npm test` reported `2243 passed, 0 failed across 99 test file(s)`, `git diff --check` passed, read-only smoke report passed with 156 checks, and the local smoke artifact sensitive-pattern scan returned no matches.

- [ ] **Step 2: Commit and push implementation**

Commit and push:

```bash
git add server.js test-artifacts/server/action-checklist-count-tracking-tests.mjs docs/superpowers/plans/2026-06-09-action-checklist-overcount-tracking.md
git commit -m "test: track overfull action checklists"
git push origin main
```

- [ ] **Step 3: Verify GitHub QA**

Watch the pushed `QA` workflow, download the uploaded `qa-automation-*` artifact, inspect `qa-summary.json`, and scan the artifact for the same sensitive patterns.
