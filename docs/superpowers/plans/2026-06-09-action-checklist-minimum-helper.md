# Action Checklist Minimum Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure action checklist minimum-count validation uses a shared `hasMinimumActionChecklist()` helper everywhere count-specific repair classification depends on it.

**Architecture:** Keep deterministic checklist repair and violation keys unchanged. Add a small minimum-count helper in `server.js`, use it from `hasValidActionChecklist()` and the `buildAnalysis()` count branch, then update source-extraction harnesses so evaluated validators include the new helper.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

### Task 1: Add RED Coverage For Helper Delegation

**Files:**
- Modify: `test-artifacts/server/action-checklist-count-tracking-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-action-checklist-minimum-helper.md`

- [x] **Step 1: Capture validator source and fallback helper source**

In `test-artifacts/server/action-checklist-count-tracking-tests.mjs`, add:

```js
const hasValidActionChecklistSrc = extractFunctionSource(serverSrc, "hasValidActionChecklist");
const actionChecklistMinimumSource = serverSrc.includes("function hasMinimumActionChecklist(")
  ? extractFunctionSource(serverSrc, "hasMinimumActionChecklist")
  : `
function hasMinimumActionChecklist(actionChecklist) {
  return Array.isArray(actionChecklist) && actionChecklist.length >= ACTION_CHECKLIST_MIN;
}
`;
```

Add `actionChecklistMinimumSource` to `supportSources` immediately before `hasValidActionChecklistSrc`, and use `hasValidActionChecklistSrc` instead of extracting `hasValidActionChecklist()` inline.

- [x] **Step 2: Assert helper reuse**

Add these checks near the existing buildAnalysis source assertion:

```js
checkTrue(
  "server defines shared action checklist minimum helper",
  serverSrc.includes("function hasMinimumActionChecklist"),
);
checkTrue(
  "hasValidActionChecklist reuses minimum helper",
  hasValidActionChecklistSrc.includes("hasMinimumActionChecklist(actionChecklist)"),
);
checkTrue(
  "buildAnalysis checks action checklist minimum helper for count",
  buildAnalysisSrc.includes("hasMinimumActionChecklist(primary.actionChecklist)"),
);
```

- [x] **Step 3: Verify RED**

Run:

```bash
node --check test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
```

Expected: syntax passes, runtime fails only on the new helper/source delegation assertions.

### Task 2: Implement Minimal Helper Delegation

**Files:**
- Modify: `server.js`
- Modify: source-extraction harnesses under `test-artifacts/server/*.mjs` and `test-artifacts/schema/*.mjs` that evaluate `hasValidActionChecklist()`
- Modify: `docs/superpowers/plans/2026-06-09-action-checklist-minimum-helper.md`

- [x] **Step 1: Add helper and use it in `hasValidActionChecklist()`**

Add before `hasValidActionChecklist()`:

```js
function hasMinimumActionChecklist(actionChecklist) {
  return Array.isArray(actionChecklist) && actionChecklist.length >= ACTION_CHECKLIST_MIN;
}
```

Then change `hasValidActionChecklist()` to:

```js
function hasValidActionChecklist(actionChecklist) {
  return hasMinimumActionChecklist(actionChecklist) &&
    actionChecklist.length <= ACTION_CHECKLIST_MAX &&
    actionChecklist.every((item) =>
      item &&
      isNonBlankString(item.id) &&
      (
        isNonBlankString(item.text) ||
        isNonBlankString(item.action)
      )
    );
}
```

- [x] **Step 2: Use helper in `buildAnalysis()` count branch**

Change only the short-count predicate:

```js
Array.isArray(primary.actionChecklist) &&
!hasMinimumActionChecklist(primary.actionChecklist) &&
actionChecklistHasValidItemShapes
```

- [x] **Step 3: Update extraction harnesses**

For every test harness that evaluates `hasValidActionChecklist()` or `buildAnalysis()`, include:

```js
extractFunctionSource(serverSrc, "hasMinimumActionChecklist"),
```

immediately before `hasValidActionChecklist` in the support source order.

- [x] **Step 4: Verify focused GREEN**

Run:

```bash
node --check server.js
node --check test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-shape-before-count-tests.mjs
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected: all focused tests pass.

### Task 3: Full QA And Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-action-checklist-minimum-helper.md`
- Update outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-minimum-helper-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/action-checklist-minimum-helper-local
```

Expected: tests and smoke pass; the sensitive-pattern scan exits 1 with no matches.

Result:

```text
npm test
2212 passed, 0 failed across 99 test file(s)

git diff --check
PASS

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-minimum-helper-local npm run smoke:report:readonly
156 passed, 0 failed
qa-summary durationMs: 301
qaVerdict.status: passed
sampleEvidence.detailChecks: 19 passed / 0 failed
demoSafetyEvidence.status: passed
requiredCheckSummary total 13 / passed 13 / failed 0 / missing 0

sensitive artifact scan
no matches
```

- [ ] **Step 2: Commit and push implementation**

Commit and push:

```bash
git add server.js test-artifacts docs/superpowers/plans/2026-06-09-action-checklist-minimum-helper.md
git commit -m "test: reuse action checklist minimum helper"
git push origin main
```

- [ ] **Step 3: Verify GitHub QA**

Watch the pushed `QA` workflow, download the uploaded `qa-automation-*` artifact, inspect `qa-summary.json`, and scan the artifact for the same sensitive patterns.
