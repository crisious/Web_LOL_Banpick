# Phase Summaries Missing Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record missing AI `phaseSummaries` input as `missing.phaseSummaries` while keeping malformed or too-short non-empty phase summary arrays on `count.phaseSummaries<3`.

**Architecture:** Keep deterministic phase summary repair unchanged: invalid AI phase summaries are still rebuilt with `buildPhaseSummaries(normalized)` before final validation. Add one violation-classification branch in `buildAnalysis()` so `undefined`, `null`, or `[]` become missing and malformed or too-short non-empty arrays remain count violations.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Missing Phase Summaries Separately From Count/Shape Violations

**Files:**
- Create: `test-artifacts/server/phase-summaries-missing-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-phase-summaries-missing-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/phase-summaries-missing-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
phaseSummaries: []
```

The stubbed `buildPhaseSummaries()` should return three valid repaired phase summaries and increment `state.phaseRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("phase summaries are repaired", result.phaseSummaries.map((item) => item.phase), ["EARLY", "MID", "LATE"]);
check("phase repair called once", state.phaseRepairCalls, 1);
checkTrue(
  "schemaViolations include missing phase summaries",
  result.analysisMeta.schemaViolations.includes("missing.phaseSummaries"),
);
checkTrue(
  "schemaViolations do not misclassify missing phase summaries as count violation",
  !result.analysisMeta.schemaViolations.includes("count.phaseSummaries<3"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks missing phase summaries separately",
  buildAnalysisSrc.includes("missing.phaseSummaries"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because empty raw `phaseSummaries` is repaired but recorded as `count.phaseSummaries<3`.

Actual RED evidence at 2026-06-09 10:27 KST:

```text
node --check test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
# passed

node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
# 5 passed, 3 failed
# primary analysis and repaired phaseSummaries were preserved, but schemaViolations missed missing.phaseSummaries and misclassified the empty phaseSummaries array as count.phaseSummaries<3.
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the invalid `phaseSummaries` repair block:

```js
  if (!hasValidPhaseSummaries(primary.phaseSummaries)) {
    const phaseSummariesViolation = (
      primary.phaseSummaries === undefined ||
      primary.phaseSummaries === null ||
      (
        Array.isArray(primary.phaseSummaries) &&
        primary.phaseSummaries.length === 0
      )
    )
      ? "missing.phaseSummaries"
      : `count.phaseSummaries<${PHASE_SUMMARIES_MIN}`;
    primary.phaseSummaries = buildPhaseSummaries(normalized);
    violations.push(phaseSummariesViolation);
  }
```

Do not change the object-to-array normalization path, `hasValidPhaseSummaries()`, `buildPhaseSummaries()`, final schema validation, prompt contract, phase summary UI, or stored sample content.

Implementation note at 2026-06-09 10:28 KST: `server.js` now classifies `undefined`, `null`, and empty-array raw `phaseSummaries` values as `missing.phaseSummaries`, then reuses the existing deterministic `buildPhaseSummaries()` repair path. Non-empty arrays that still fail the phase summary contract continue to record `count.phaseSummaries<3`.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-missing-tracking-local npm run smoke:report:readonly
```

Expected: focused phase/key/action/metadata/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN evidence at 2026-06-09 10:29 KST:

```text
node --check server.js
# passed
node --check test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
# passed
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/evidence-index-violation-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 12 passed, 0 failed
node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
npm test
# 2051 passed, 0 failed across 84 test file(s)
git diff --check
# passed
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-missing-tracking-local npm run smoke:report:readonly
# qaVerdict.status=passed, requiredChecks=13/13, smokeSummary=156 passed / 0 failed, mode=readonly, durationMs=251
rg -n --hidden -S "<sensitive/live-api scan>" test-artifacts/tmp/phase-summaries-missing-tracking-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summaries-missing-tracking.md server.js test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
git commit -m "test: track missing phase summaries"
git push origin main
```

Actual implementation commit:

```text
e192bfa test: track missing phase summaries
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence at 2026-06-09 10:31 KST:

```text
gh run watch 27178066997 --exit-status
# success, job test-and-smoke in 20s

artifact: qa-automation-27178066997
artifact id: 7496482155
headSha: e192bfa194531dcfd966cb89887fe9dd83137190
qaVerdict.status=passed
requiredChecks=13/13
smokeSummary=156 passed / 0 failed
mode=readonly
durationMs=210

rg -n --hidden -S "<sensitive/live-api scan>" test-artifacts/tmp/gh-run-27178066997
# no matches
```

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summaries-missing-tracking.md
git commit -m "docs: finalize phase summaries missing tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers missing phase summaries classification, preserves existing count violation classification, and keeps deterministic repair behavior unchanged.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The violation key is consistently `missing.phaseSummaries`; the existing `count.phaseSummaries<3` key is preserved for non-empty arrays that still fail the phase summary contract.
