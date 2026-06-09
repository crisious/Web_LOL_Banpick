# Weaknesses Missing Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record missing AI `weaknesses` input as `missing.weaknesses` while keeping malformed non-empty weakness lists on `shape.weaknesses.invalid`.

**Architecture:** Keep deterministic weakness repair unchanged: invalid AI weaknesses are still rebuilt with `buildWeaknesses(normalized)` before final validation. Add one violation-classification branch in `buildAnalysis()` so `undefined`, `null`, or `[]` become missing and malformed non-empty values remain shape violations.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Missing Weaknesses Separately From Malformed Weaknesses

**Files:**
- Create: `test-artifacts/server/weaknesses-missing-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-weaknesses-missing-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/weaknesses-missing-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
weaknesses: []
```

The stubbed `buildWeaknesses()` should return three valid repaired weaknesses and increment `state.weaknessRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("weaknesses are repaired", result.weaknesses.map((item) => item.id), ["wk_1", "wk_2", "wk_3"]);
check("weakness repair called once", state.weaknessRepairCalls, 1);
checkTrue(
  "schemaViolations include missing weaknesses",
  result.analysisMeta.schemaViolations.includes("missing.weaknesses"),
);
checkTrue(
  "schemaViolations do not misclassify missing weaknesses as malformed",
  !result.analysisMeta.schemaViolations.includes("shape.weaknesses.invalid"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks missing weaknesses separately",
  buildAnalysisSrc.includes("missing.weaknesses"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/weaknesses-missing-tracking-tests.mjs
node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because empty raw `weaknesses` is repaired but recorded as `shape.weaknesses.invalid`.

Actual RED evidence at 2026-06-09 10:53 KST:

```text
node --check test-artifacts/server/weaknesses-missing-tracking-tests.mjs
# passed

node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
# 5 passed, 3 failed
# primary analysis and repaired weaknesses were preserved, but schemaViolations missed missing.weaknesses and misclassified the empty weaknesses array as shape.weaknesses.invalid.
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the invalid `weaknesses` repair block:

```js
  if (!hasValidInsightList(primary.weaknesses)) {
    const weaknessesViolation = (
      primary.weaknesses === undefined ||
      primary.weaknesses === null ||
      (
        Array.isArray(primary.weaknesses) &&
        primary.weaknesses.length === 0
      )
    )
      ? "missing.weaknesses"
      : "shape.weaknesses.invalid";
    primary.weaknesses = buildWeaknesses(normalized);
    violations.push(weaknessesViolation);
  }
```

Do not change `hasValidInsightList()`, `buildWeaknesses()`, strengths repair, final schema validation, prompt contract, insight UI, or stored sample content.

Implementation note at 2026-06-09 10:53 KST: `server.js` now classifies `undefined`, `null`, and empty-array raw `weaknesses` values as `missing.weaknesses`, then reuses the existing deterministic `buildWeaknesses()` repair path. Malformed non-empty weakness values still record `shape.weaknesses.invalid`.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/weaknesses-missing-tracking-tests.mjs
node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
node test-artifacts/server/strengths-missing-tracking-tests.mjs
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/weaknesses-missing-tracking-local npm run smoke:report:readonly
```

Expected: focused weaknesses/strengths/phase/key/action/metadata/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN evidence at 2026-06-09 10:55 KST:

```text
node --check server.js
# passed
node --check test-artifacts/server/weaknesses-missing-tracking-tests.mjs
# passed
node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
# 8 passed, 0 failed
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
# 2067 passed, 0 failed across 86 test file(s)
git diff --check
# passed
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/weaknesses-missing-tracking-local npm run smoke:report:readonly
# qaVerdict.status=passed, requiredChecks=13/13, smokeSummary=156 passed / 0 failed, mode=readonly, durationMs=270
rg -n --hidden -S "<sensitive/live-api scan>" test-artifacts/tmp/weaknesses-missing-tracking-local
# no matches
```

- [ ] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-weaknesses-missing-tracking.md server.js test-artifacts/server/weaknesses-missing-tracking-tests.mjs
git commit -m "test: track missing weaknesses"
git push origin main
```

- [ ] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-weaknesses-missing-tracking.md
git commit -m "docs: finalize weaknesses missing tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers missing weaknesses classification, preserves existing malformed weaknesses classification, and keeps deterministic repair behavior unchanged.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The violation key is consistently `missing.weaknesses`; the existing `shape.weaknesses.invalid` key is preserved for malformed non-empty values.
