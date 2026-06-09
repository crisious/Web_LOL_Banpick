# Evidence Index Violation Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record malformed AI `evidenceIndex` input as `shape.evidenceIndex.invalid` while keeping genuinely missing/empty evidence on the existing `missing.evidenceIndex` path.

**Architecture:** Keep deterministic evidence repair unchanged: invalid AI evidence is still replaced with `buildEvidenceIndex(normalized)` before final validation. Add one small violation-classification branch in `buildAnalysis()` so `undefined`, `null`, or `[]` remain missing, while non-empty malformed arrays and non-array values become shape violations.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Malformed Evidence Index Separately From Missing Evidence

**Files:**
- Create: `test-artifacts/server/evidence-index-violation-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-evidence-index-violation-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/evidence-index-violation-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
evidenceIndex: { evt_001: { summary: "object shape is invalid" } }
```

The stubbed `buildEvidenceIndex()` should return a valid repaired array and increment `state.evidenceRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("evidence index is repaired", result.evidenceIndex, [{ eventId: "evt_001", summary: "repaired evidence" }]);
check("evidence repair called once", state.evidenceRepairCalls, 1);
checkTrue(
  "schemaViolations include malformed evidence index",
  result.analysisMeta.schemaViolations.includes("shape.evidenceIndex.invalid"),
);
checkTrue(
  "schemaViolations do not misclassify malformed evidence as missing",
  !result.analysisMeta.schemaViolations.includes("missing.evidenceIndex"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks malformed evidence index separately",
  buildAnalysisSrc.includes("shape.evidenceIndex.invalid"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/evidence-index-violation-tracking-tests.mjs
node test-artifacts/server/evidence-index-violation-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because malformed raw `evidenceIndex` is repaired but recorded as `missing.evidenceIndex`.

Actual RED evidence at 2026-06-09 09:57 KST:

```text
node --check test-artifacts/server/evidence-index-violation-tracking-tests.mjs
# passed

node test-artifacts/server/evidence-index-violation-tracking-tests.mjs
# 5 passed, 3 failed
# primary analysis and repaired evidenceIndex were preserved, but schemaViolations missed shape.evidenceIndex.invalid and misclassified the malformed object as missing.evidenceIndex.
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `evidenceIndex` repair block:

```js
  if (!hasValidEvidenceIndex(primary.evidenceIndex)) {
    const evidenceIndexViolation = (
      primary.evidenceIndex === undefined ||
      primary.evidenceIndex === null ||
      (
        Array.isArray(primary.evidenceIndex) &&
        primary.evidenceIndex.length === 0
      )
    )
      ? "missing.evidenceIndex"
      : "shape.evidenceIndex.invalid";
    primary.evidenceIndex = buildEvidenceIndex(normalized);
    violations.push(evidenceIndexViolation);
  }
```

Do not change `hasValidEvidenceIndex()`, `buildEvidenceIndex()`, final schema validation, prompt contract, or evidence UI behavior.

Implementation note at 2026-06-09 09:58 KST:

- Added `evidenceIndexViolation` classification inside the existing `buildAnalysis()` repair block.
- Preserves `missing.evidenceIndex` for `undefined`, `null`, or empty-array AI evidence.
- Records `shape.evidenceIndex.invalid` for non-array evidence and non-empty malformed arrays.
- Left `hasValidEvidenceIndex()`, `buildEvidenceIndex()`, final schema validation, prompt contract, and evidence UI behavior unchanged.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/evidence-index-violation-tracking-tests.mjs
node test-artifacts/server/evidence-index-violation-tracking-tests.mjs
node test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
node test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/evidence-index-violation-tracking-local npm run smoke:report:readonly
```

Expected: focused evidence/combat/teamfight/metadata/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN/local QA evidence at 2026-06-09 09:59 KST:

```text
node --check server.js
# passed

node --check test-artifacts/server/evidence-index-violation-tracking-tests.mjs
# passed

node test-artifacts/server/evidence-index-violation-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
# 6 passed, 0 failed

node test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
# 6 passed, 0 failed

node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 12 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed

npm test
# 2027 passed, 0 failed across 81 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/evidence-index-violation-tracking-local npm run smoke:report:readonly
# qaStatus: passed
# requiredChecks: 13/13
# smoke: 156 passed, 0 failed
# durationMs: 361
# mode: readonly
# gitShortSha: 4e43268
# gitDirty: true

rg -n --hidden -S "<sensitive-output-pattern>" test-artifacts/tmp/evidence-index-violation-tracking-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-evidence-index-violation-tracking.md server.js test-artifacts/server/evidence-index-violation-tracking-tests.mjs
git commit -m "test: track malformed evidence index"
git push origin main
```

Implementation commit evidence at 2026-06-09 10:00 KST:

```text
git commit -m "test: track malformed evidence index"
# 90e3dcc test: track malformed evidence index

git push origin main
# 4e43268..90e3dcc main -> main
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence at 2026-06-09 10:00 KST:

```text
gh run watch 27176963400 --exit-status
# success

QA run: 27176963400
QA artifact: 7496086526 (qa-automation-27176963400)
Head SHA: 90e3dcc66f985cfa760ece0cd4373133d56be712

qa-summary.json
# qaStatus: passed
# requiredChecks: 13/13
# smoke: 156 passed, 0 failed
# durationMs: 226
# mode: readonly
# ci.provider: github-actions
# git.shortSha: 90e3dcc
# git.dirty: false

rg -n --hidden -S "<sensitive-output-pattern>" test-artifacts/tmp/gh-run-27176963400
# no matches
```

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-evidence-index-violation-tracking.md
git commit -m "docs: finalize evidence index violation tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers malformed evidence index classification, preserves missing evidence classification, and keeps deterministic repair behavior unchanged.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague “add tests” placeholders remain.
- Type consistency: The violation key is consistently `shape.evidenceIndex.invalid`; the existing `missing.evidenceIndex` key is preserved for absent/null/empty evidence.
