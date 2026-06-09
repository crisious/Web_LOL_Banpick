# Action Checklist Count Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record short-but-nonempty AI `actionChecklist` arrays as `count.actionChecklist<3` instead of grouping them under `shape.actionChecklist.invalid`.

**Architecture:** Keep the existing deterministic repair path through `buildActionChecklist()`. Narrow only the violation selection in `buildAnalysis()` so missing/empty checklists stay `missing.actionChecklist`, 1-2 item arrays become `count.actionChecklist<3`, and malformed non-array or invalid item shapes stay `shape.actionChecklist.invalid`.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Short Action Checklists Separately From Malformed Shapes

**Files:**
- Create: `test-artifacts/server/action-checklist-count-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-action-checklist-count-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/action-checklist-count-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
actionChecklist: [{ id: "act_short_1", text: "too few actions" }]
```

The stubbed `buildActionChecklist()` should return three valid repaired actions and increment `state.actionRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("action checklist is repaired", result.actionChecklist.map((item) => item.id), ["act_1", "act_2", "act_3"]);
check("action repair called once", state.actionRepairCalls, 1);
checkTrue(
  "schemaViolations include short action checklist count",
  result.analysisMeta.schemaViolations.includes("count.actionChecklist<3"),
);
checkTrue(
  "schemaViolations do not misclassify short checklist as missing",
  !result.analysisMeta.schemaViolations.includes("missing.actionChecklist"),
);
checkTrue(
  "schemaViolations do not misclassify short checklist as malformed",
  !result.analysisMeta.schemaViolations.includes("shape.actionChecklist.invalid"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks short action checklists separately",
  buildAnalysisSrc.includes("count.actionChecklist<${ACTION_CHECKLIST_MIN}"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because the short checklist is repaired but recorded as `shape.actionChecklist.invalid`.

Actual RED evidence (2026-06-09 11:35 KST):

```text
node --check test-artifacts/server/action-checklist-count-tracking-tests.mjs
# passed

node test-artifacts/server/action-checklist-count-tracking-tests.mjs
# 6 passed, 3 failed
# FAIL schemaViolations include short action checklist count
# FAIL schemaViolations do not misclassify short checklist as malformed
# FAIL buildAnalysis tracks short action checklists separately
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `actionChecklist` repair block:

```js
  if (!hasValidActionChecklist(primary.actionChecklist)) {
    const actionChecklistViolation = (
      primary.actionChecklist === undefined ||
      primary.actionChecklist === null ||
      (
        Array.isArray(primary.actionChecklist) &&
        primary.actionChecklist.length === 0
      )
    )
      ? "missing.actionChecklist"
      : (
        Array.isArray(primary.actionChecklist) &&
        primary.actionChecklist.length < ACTION_CHECKLIST_MIN
      )
        ? `count.actionChecklist<${ACTION_CHECKLIST_MIN}`
        : "shape.actionChecklist.invalid";
    const checklistWeaknesses = Array.isArray(primary.weaknesses) && primary.weaknesses.length > 0
      ? primary.weaknesses
      : buildWeaknesses(normalized);
    primary.actionChecklist = buildActionChecklist(normalized, checklistWeaknesses);
    violations.push(actionChecklistViolation);
  }
```

Do not change `hasValidActionChecklist()`, `buildActionChecklist()`, missing checklist tracking, prompt contract, UI rendering, or stored sample content.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-count-tracking-local npm run smoke:report:readonly
```

Expected: focused action/phase/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Focused GREEN evidence (2026-06-09 11:36 KST):

```text
node --check server.js
# passed

node --check test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
```

Full local QA evidence (2026-06-09 11:37 KST):

```text
npm test
# 2101 passed, 0 failed across 90 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-count-tracking-local npm run smoke:report:readonly
# qaVerdict.status=passed, smokeSummary=156 passed / 0 failed, requiredChecks=13/13, durationMs=391

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/action-checklist-count-tracking-local
# no matches
```

- [ ] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-action-checklist-count-tracking.md server.js test-artifacts/server/action-checklist-count-tracking-tests.mjs
git commit -m "test: track short action checklists"
git push origin main
```

- [ ] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-action-checklist-count-tracking.md
git commit -m "docs: finalize action checklist count tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers short nonempty action checklists, preserves deterministic repair, and keeps empty/missing checklists on the existing `missing.actionChecklist` path.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The new violation key is consistently `count.actionChecklist<3`; existing `missing.actionChecklist` and `shape.actionChecklist.invalid` remain available for their narrower cases.
