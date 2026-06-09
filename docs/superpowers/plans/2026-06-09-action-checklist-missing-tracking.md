# Action Checklist Missing Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record missing AI `actionChecklist` input as `missing.actionChecklist` while keeping malformed non-empty checklist shapes on `shape.actionChecklist.invalid`.

**Architecture:** Keep deterministic checklist repair unchanged: invalid AI checklists are still rebuilt from weaknesses via `buildActionChecklist(normalized, checklistWeaknesses)` before final validation. Add one violation-classification branch in `buildAnalysis()` so `undefined`, `null`, or `[]` become missing and malformed non-empty values remain shape violations.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Missing Action Checklist Separately From Malformed Checklist

**Files:**
- Create: `test-artifacts/server/action-checklist-missing-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-action-checklist-missing-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/action-checklist-missing-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
actionChecklist: []
```

The stubbed `buildActionChecklist()` should return a valid repaired 3-item checklist and increment `state.actionRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("action checklist is repaired", result.actionChecklist.map((item) => item.id), ["act_1", "act_2", "act_3"]);
check("action repair called once", state.actionRepairCalls, 1);
checkTrue(
  "schemaViolations include missing action checklist",
  result.analysisMeta.schemaViolations.includes("missing.actionChecklist"),
);
checkTrue(
  "schemaViolations do not misclassify missing checklist as malformed",
  !result.analysisMeta.schemaViolations.includes("shape.actionChecklist.invalid"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks missing action checklist separately",
  buildAnalysisSrc.includes("missing.actionChecklist"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because empty raw `actionChecklist` is repaired but recorded as `shape.actionChecklist.invalid`.

Actual RED evidence at 2026-06-09 10:05 KST:

```text
node --check test-artifacts/server/action-checklist-missing-tracking-tests.mjs
# passed

node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
# 5 passed, 3 failed
# primary analysis and repaired actionChecklist were preserved, but schemaViolations missed missing.actionChecklist and misclassified the empty checklist as shape.actionChecklist.invalid.
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
      : "shape.actionChecklist.invalid";
    const checklistWeaknesses = Array.isArray(primary.weaknesses) && primary.weaknesses.length > 0
      ? primary.weaknesses
      : buildWeaknesses(normalized);
    primary.actionChecklist = buildActionChecklist(normalized, checklistWeaknesses);
    violations.push(actionChecklistViolation);
  }
```

Do not change `hasValidActionChecklist()`, `buildActionChecklist()`, final schema validation, prompt contract, or checklist UI behavior.

Implementation note at 2026-06-09 10:08 KST: `server.js` now classifies `undefined`, `null`, and empty-array raw `actionChecklist` values as `missing.actionChecklist`, then reuses the existing deterministic `buildActionChecklist()` repair path. Malformed non-empty checklist values still record `shape.actionChecklist.invalid`.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/server/evidence-index-violation-tracking-tests.mjs
node test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-missing-tracking-local npm run smoke:report:readonly
```

Expected: focused action/evidence/combat/metadata/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN evidence at 2026-06-09 10:08 KST:

```text
node --check server.js
# passed
node --check test-artifacts/server/action-checklist-missing-tracking-tests.mjs
# passed
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/evidence-index-violation-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
# 6 passed, 0 failed
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 12 passed, 0 failed
node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
npm test
# 2035 passed, 0 failed across 82 test file(s)
git diff --check
# passed
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-missing-tracking-local npm run smoke:report:readonly
# qaVerdict.status=passed, requiredChecks=13/13, smokeSummary=156 passed / 0 failed, mode=readonly, durationMs=198
rg -n --hidden -S "<sensitive/live-api scan>" test-artifacts/tmp/action-checklist-missing-tracking-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-action-checklist-missing-tracking.md server.js test-artifacts/server/action-checklist-missing-tracking-tests.mjs
git commit -m "test: track missing action checklist"
git push origin main
```

Actual implementation commit:

```text
10f046e test: track missing action checklist
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence at 2026-06-09 10:11 KST:

```text
gh run watch 27177353463 --exit-status
# success, job test-and-smoke in 24s

artifact: qa-automation-27177353463
artifact id: 7496223606
headSha: 10f046e3148b4d196c7a92c444b5d6d4c92e43d1
qaVerdict.status=passed
requiredChecks=13/13
smokeSummary=156 passed / 0 failed
mode=readonly
durationMs=204

rg -n --hidden -S "<sensitive/live-api scan>" test-artifacts/tmp/gh-run-27177353463
# no matches
```

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-action-checklist-missing-tracking.md
git commit -m "docs: finalize action checklist missing tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers missing action checklist classification, preserves malformed checklist classification, and keeps deterministic repair behavior unchanged.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague “add tests” placeholders remain.
- Type consistency: The violation key is consistently `missing.actionChecklist`; the existing `shape.actionChecklist.invalid` key is preserved for malformed non-empty values.
