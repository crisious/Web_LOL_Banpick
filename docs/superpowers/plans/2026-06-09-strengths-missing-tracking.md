# Strengths Missing Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record missing AI `strengths` input as `missing.strengths` while keeping malformed non-empty strength lists on `shape.strengths.invalid`.

**Architecture:** Keep deterministic strength repair unchanged: invalid AI strengths are still rebuilt with `buildStrengths(normalized)` before final validation. Add one violation-classification branch in `buildAnalysis()` so `undefined`, `null`, or `[]` become missing and malformed non-empty values remain shape violations.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Missing Strengths Separately From Malformed Strengths

**Files:**
- Create: `test-artifacts/server/strengths-missing-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-strengths-missing-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/strengths-missing-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
strengths: []
```

The stubbed `buildStrengths()` should return three valid repaired strengths and increment `state.strengthRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("strengths are repaired", result.strengths.map((item) => item.id), ["str_1", "str_2", "str_3"]);
check("strength repair called once", state.strengthRepairCalls, 1);
checkTrue(
  "schemaViolations include missing strengths",
  result.analysisMeta.schemaViolations.includes("missing.strengths"),
);
checkTrue(
  "schemaViolations do not misclassify missing strengths as malformed",
  !result.analysisMeta.schemaViolations.includes("shape.strengths.invalid"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks missing strengths separately",
  buildAnalysisSrc.includes("missing.strengths"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/strengths-missing-tracking-tests.mjs
node test-artifacts/server/strengths-missing-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because empty raw `strengths` is repaired but recorded as `shape.strengths.invalid`.

Actual RED evidence at 2026-06-09 10:38 KST:

```text
node --check test-artifacts/server/strengths-missing-tracking-tests.mjs
# passed

node test-artifacts/server/strengths-missing-tracking-tests.mjs
# 5 passed, 3 failed
# primary analysis and repaired strengths were preserved, but schemaViolations missed missing.strengths and misclassified the empty strengths array as shape.strengths.invalid.
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the invalid `strengths` repair block:

```js
  if (!hasValidInsightList(primary.strengths)) {
    const strengthsViolation = (
      primary.strengths === undefined ||
      primary.strengths === null ||
      (
        Array.isArray(primary.strengths) &&
        primary.strengths.length === 0
      )
    )
      ? "missing.strengths"
      : "shape.strengths.invalid";
    primary.strengths = buildStrengths(normalized);
    violations.push(strengthsViolation);
  }
```

Do not change `hasValidInsightList()`, `buildStrengths()`, weaknesses repair, final schema validation, prompt contract, insight UI, or stored sample content.

Implementation note at 2026-06-09 10:40 KST: `server.js` now classifies `undefined`, `null`, and empty-array raw `strengths` values as `missing.strengths`, then reuses the existing deterministic `buildStrengths()` repair path. Malformed non-empty strength values still record `shape.strengths.invalid`.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strengths-missing-tracking-tests.mjs
node test-artifacts/server/strengths-missing-tracking-tests.mjs
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/strengths-missing-tracking-local npm run smoke:report:readonly
```

Expected: focused strengths/phase/key/action/metadata/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN evidence at 2026-06-09 10:40 KST:

```text
node --check server.js
# passed
node --check test-artifacts/server/strengths-missing-tracking-tests.mjs
# passed
node test-artifacts/server/strengths-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 12 passed, 0 failed
node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
npm test
# 2059 passed, 0 failed across 85 test file(s)
git diff --check
# passed
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/strengths-missing-tracking-local npm run smoke:report:readonly
# qaVerdict.status=passed, requiredChecks=13/13, smokeSummary=156 passed / 0 failed, mode=readonly, durationMs=288
rg -n --hidden -S "<sensitive/live-api scan>" test-artifacts/tmp/strengths-missing-tracking-local
# no matches
```

- [ ] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-strengths-missing-tracking.md server.js test-artifacts/server/strengths-missing-tracking-tests.mjs
git commit -m "test: track missing strengths"
git push origin main
```

- [ ] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-strengths-missing-tracking.md
git commit -m "docs: finalize strengths missing tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers missing strengths classification, preserves existing malformed strengths classification, and keeps deterministic repair behavior unchanged.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The violation key is consistently `missing.strengths`; the existing `shape.strengths.invalid` key is preserved for malformed non-empty values.
