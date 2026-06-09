# Action Checklist Shape Before Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record malformed short AI `actionChecklist` arrays as `shape.actionChecklist.invalid` instead of grouping them under `count.actionChecklist<3`.

**Architecture:** Keep the deterministic repair path through `buildActionChecklist()`. Narrow only the violation selection in `buildAnalysis()` so missing/empty checklists stay `missing.actionChecklist`, short arrays with valid item shapes stay `count.actionChecklist<3`, and short malformed arrays become `shape.actionChecklist.invalid`.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Short Malformed Action Checklist Arrays As Shape Errors

**Files:**
- Create: `test-artifacts/server/action-checklist-shape-before-count-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-action-checklist-shape-before-count.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/action-checklist-shape-before-count-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
actionChecklist: [
  { id: "", text: "malformed short action" },
]
```

The stubbed `buildActionChecklist()` should return three valid repaired checklist items and increment `state.actionRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("action checklist is repaired", result.actionChecklist.map((item) => item.id), ["act_1", "act_2", "act_3"]);
check("action repair called once", state.actionRepairCalls, 1);
checkTrue(
  "schemaViolations include malformed action checklist",
  result.analysisMeta.schemaViolations.includes("shape.actionChecklist.invalid"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short checklist as missing",
  !result.analysisMeta.schemaViolations.includes("missing.actionChecklist"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short checklist as count",
  !result.analysisMeta.schemaViolations.includes("count.actionChecklist<3"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis checks action checklist item shape before count",
  buildAnalysisSrc.includes("actionChecklistHasValidItemShapes"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/action-checklist-shape-before-count-tests.mjs
node test-artifacts/server/action-checklist-shape-before-count-tests.mjs
```

Expected: syntax check passes, runtime test fails because the malformed short checklist is repaired but recorded as `count.actionChecklist<3`.

Actual RED evidence (2026-06-09 12:31 KST):

```text
node --check test-artifacts/server/action-checklist-shape-before-count-tests.mjs
# passed

node test-artifacts/server/action-checklist-shape-before-count-tests.mjs
# 6 passed, 3 failed
# FAIL schemaViolations include malformed action checklist
# FAIL schemaViolations do not misclassify malformed short checklist as count
# FAIL buildAnalysis checks action checklist item shape before count
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `actionChecklist` repair violation selection:

```js
    const actionChecklistHasValidItemShapes = Array.isArray(primary.actionChecklist) &&
      primary.actionChecklist.every((item) =>
        item &&
        isNonBlankString(item.id) &&
        (
          isNonBlankString(item.text) ||
          isNonBlankString(item.action)
        )
      );
```

Then gate the count branch with that predicate:

```js
        Array.isArray(primary.actionChecklist) &&
        primary.actionChecklist.length < ACTION_CHECKLIST_MIN &&
        actionChecklistHasValidItemShapes
```

Do not change `hasValidActionChecklist()`, `buildActionChecklist()`, missing checklist tracking, prompt contract, UI rendering, or stored sample content.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/action-checklist-shape-before-count-tests.mjs
node test-artifacts/server/action-checklist-shape-before-count-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-shape-before-count-local npm run smoke:report:readonly
```

Expected: focused action/weakness/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Focused GREEN evidence (2026-06-09 12:32 KST):

```text
node --check server.js
# passed

node --check test-artifacts/server/action-checklist-shape-before-count-tests.mjs
node test-artifacts/server/action-checklist-shape-before-count-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/action-checklist-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/weaknesses-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
```

Full local QA evidence (2026-06-09 12:33 KST):

```text
npm test
# 2146 passed, 0 failed across 95 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-shape-before-count-local npm run smoke:report:readonly
# External demo smoke passed for http://127.0.0.1:8123

node -e '...read test-artifacts/tmp/action-checklist-shape-before-count-local/qa-summary.json...'
# status: passed
# qaVerdict: passed
# smoke: 156 passed, 0 failed
# required: 13 passed, 0 failed, 0 missing

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/action-checklist-shape-before-count-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-action-checklist-shape-before-count.md server.js test-artifacts/server/action-checklist-shape-before-count-tests.mjs
git commit -m "test: track malformed short action checklists"
git push origin main
```

Implementation commit evidence (2026-06-09 12:32 KST):

```text
git commit -m "test: track malformed short action checklists"
# [main 83c98f7] test: track malformed short action checklists
# 3 files changed, 470 insertions(+), 1 deletion(-)

git push origin main
# 649b7ee..83c98f7  main -> main
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence (2026-06-09 12:33 KST):

```text
gh run watch 27182064203 --exit-status
# main QA passed
# test-and-smoke completed in 21s

gh api repos/crisious/Web_LOL_Banpick/actions/runs/27182064203/artifacts --jq '.artifacts[] | {id, name, size_in_bytes, expired}'
# {"expired":false,"id":7497890625,"name":"qa-automation-27182064203","size_in_bytes":3549}

qa-summary.json
# latestRun.status: passed
# latestRun.qaVerdict.status: passed
# latestRun.smokeSummary: 156 passed, 0 failed
# latestRun.requiredCheckSummary: 13 passed, 0 failed, 0 missing
# latestRun.durationMs: 214
# latestRun.git.shortSha: 83c98f7
# latestRun.git.dirty: false

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/gh-run-27182064203
# no matches
```

Obsidian project improvement note updated with the action checklist shape-before-count implementation record.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-action-checklist-shape-before-count.md
git commit -m "docs: finalize action checklist shape tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers malformed short action checklist arrays, preserves deterministic repair, and keeps empty/missing arrays plus valid short arrays on their existing paths.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The new local predicate is consistently named `actionChecklistHasValidItemShapes`; existing `missing.actionChecklist`, `count.actionChecklist<3`, and `shape.actionChecklist.invalid` keys remain available for their narrower cases.
