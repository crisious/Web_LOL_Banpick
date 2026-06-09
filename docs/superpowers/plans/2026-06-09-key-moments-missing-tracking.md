# Key Moments Missing Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record missing AI `keyMoments` input as `missing.keyMoments` while keeping malformed non-empty key moment shapes on `shape.keyMoments.invalid`.

**Architecture:** Keep deterministic key moment repair unchanged: invalid AI key moments are still rebuilt with `buildKeyMoments(normalized)` before final validation. Add one violation-classification branch in `buildAnalysis()` so `undefined`, `null`, or `[]` become missing and malformed non-empty values remain shape violations.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Missing Key Moments Separately From Malformed Key Moments

**Files:**
- Create: `test-artifacts/server/key-moments-missing-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-key-moments-missing-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/key-moments-missing-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
keyMoments: []
```

The stubbed `buildKeyMoments()` should return four valid repaired key moments and increment `state.keyMomentRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("key moments are repaired", result.keyMoments.map((item) => item.id), ["km_1", "km_2", "km_3", "km_4"]);
check("key moment repair called once", state.keyMomentRepairCalls, 1);
checkTrue(
  "schemaViolations include missing key moments",
  result.analysisMeta.schemaViolations.includes("missing.keyMoments"),
);
checkTrue(
  "schemaViolations do not misclassify missing key moments as malformed",
  !result.analysisMeta.schemaViolations.includes("shape.keyMoments.invalid"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks missing key moments separately",
  buildAnalysisSrc.includes("missing.keyMoments"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/key-moments-missing-tracking-tests.mjs
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because empty raw `keyMoments` is repaired but recorded as `shape.keyMoments.invalid`.

Actual RED evidence at 2026-06-09 10:16 KST:

```text
node --check test-artifacts/server/key-moments-missing-tracking-tests.mjs
# passed

node test-artifacts/server/key-moments-missing-tracking-tests.mjs
# 5 passed, 3 failed
# primary analysis and repaired keyMoments were preserved, but schemaViolations missed missing.keyMoments and misclassified the empty keyMoments array as shape.keyMoments.invalid.
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `keyMoments` repair block:

```js
  if (!hasValidKeyMoments(primary.keyMoments)) {
    const keyMomentsViolation = (
      primary.keyMoments === undefined ||
      primary.keyMoments === null ||
      (
        Array.isArray(primary.keyMoments) &&
        primary.keyMoments.length === 0
      )
    )
      ? "missing.keyMoments"
      : "shape.keyMoments.invalid";
    primary.keyMoments = buildKeyMoments(normalized);
    violations.push(keyMomentsViolation);
  }
```

Do not change `hasValidKeyMoments()`, `buildKeyMoments()`, final schema validation, prompt contract, key moments UI, or stored sample content.

Implementation note at 2026-06-09 10:18 KST: `server.js` now classifies `undefined`, `null`, and empty-array raw `keyMoments` values as `missing.keyMoments`, then reuses the existing deterministic `buildKeyMoments()` repair path. Malformed non-empty key moment values still record `shape.keyMoments.invalid`.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/key-moments-missing-tracking-tests.mjs
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/server/evidence-index-violation-tracking-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-missing-tracking-local npm run smoke:report:readonly
```

Expected: focused key/action/evidence/metadata/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN evidence at 2026-06-09 10:19 KST:

```text
node --check server.js
# passed
node --check test-artifacts/server/key-moments-missing-tracking-tests.mjs
# passed
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
# 8 passed, 0 failed
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
# 2043 passed, 0 failed across 83 test file(s)
git diff --check
# passed
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-missing-tracking-local npm run smoke:report:readonly
# qaVerdict.status=passed, requiredChecks=13/13, smokeSummary=156 passed / 0 failed, mode=readonly, durationMs=283
rg -n --hidden -S "<sensitive/live-api scan>" test-artifacts/tmp/key-moments-missing-tracking-local
# no matches
```

- [ ] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-key-moments-missing-tracking.md server.js test-artifacts/server/key-moments-missing-tracking-tests.mjs
git commit -m "test: track missing key moments"
git push origin main
```

- [ ] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-key-moments-missing-tracking.md
git commit -m "docs: finalize key moments missing tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers missing key moments classification, preserves malformed key moments classification, and keeps deterministic repair behavior unchanged.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The violation key is consistently `missing.keyMoments`; the existing `shape.keyMoments.invalid` key is preserved for malformed non-empty values.
