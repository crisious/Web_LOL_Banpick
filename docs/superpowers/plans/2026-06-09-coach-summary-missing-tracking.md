# Coach Summary Missing Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record omitted AI `coachSummary` objects as `missing.coachSummary` once, while preserving `missing.coachSummary.overallSummary` for present objects whose summary text is missing or blank.

**Architecture:** Keep deterministic coach summary repair unchanged: invalid AI coach summaries still receive a fallback `overallSummary` from `buildCoachSummary(normalized)` before final validation. Split the top-level missing object case from malformed object/summary cases in `buildAnalysis()` so schema violation metrics do not double-count an omitted `coachSummary`.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Missing Coach Summary Separately From Missing Overall Summary

**Files:**
- Create: `test-artifacts/server/coach-summary-missing-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-coach-summary-missing-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/coach-summary-missing-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but omit `coachSummary` entirely.

The stubbed `buildCoachSummary()` should return a fallback summary and increment `state.coachRepairCalls`.

Assertions:

```js
check("match summary is preserved", result.matchSummary.headline, "primary headline");
check("coach summary is repaired", result.coachSummary.overallSummary, "fallback coach summary");
check("coach repair called once", state.coachRepairCalls, 1);
checkTrue(
  "schemaViolations include missing coach summary",
  result.analysisMeta.schemaViolations.includes("missing.coachSummary"),
);
checkTrue(
  "schemaViolations do not mark missing coach summary as invalid type",
  !result.analysisMeta.schemaViolations.includes("type.coachSummary.invalid"),
);
checkTrue(
  "schemaViolations do not double count missing overall summary for missing coach summary",
  !result.analysisMeta.schemaViolations.includes("missing.coachSummary.overallSummary"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks missing coach summary separately",
  buildAnalysisSrc.includes("\"missing.coachSummary\""),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/coach-summary-missing-tracking-tests.mjs
node test-artifacts/server/coach-summary-missing-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because omitted raw `coachSummary` is repaired but recorded as `type.coachSummary.invalid` and `missing.coachSummary.overallSummary`.

Actual RED evidence at 2026-06-09 11:13 KST:

```text
node --check test-artifacts/server/coach-summary-missing-tracking-tests.mjs
# passed

node test-artifacts/server/coach-summary-missing-tracking-tests.mjs
# 3 passed, 5 failed
# match summary and repaired coach summary were preserved, but schemaViolations missed missing.coachSummary, included type.coachSummary.invalid, double-counted missing.coachSummary.overallSummary, and schemaViolationCount was 2 instead of 1.
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `coachSummary` normalization and repair block:

```js
  // coachSummary: AI가 string으로 반환하는 경우 → 객체로 정규화
  if (typeof primary.coachSummary === "string") {
    primary.coachSummary = { overallSummary: primary.coachSummary };
    violations.push("type.coachSummary.string");
  } else if (!primary.coachSummary || typeof primary.coachSummary !== "object" || Array.isArray(primary.coachSummary)) {
    const coachSummaryViolation = (
      primary.coachSummary === undefined ||
      primary.coachSummary === null
    )
      ? "missing.coachSummary"
      : "type.coachSummary.invalid";
    primary.coachSummary = {};
    violations.push(coachSummaryViolation);
  }
  if (!hasValidCoachSummary(primary.coachSummary)) {
    const fb = buildCoachSummary(normalized);
    primary.coachSummary.overallSummary = fb.overallSummary;
    if (!violations.includes("missing.coachSummary")) {
      violations.push("missing.coachSummary.overallSummary");
    }
  }
```

Do not change `hasValidCoachSummary()`, final schema validation, match summary repair, prompt contract, UI rendering, or stored sample content.

Implementation note at 2026-06-09 11:14 KST: `server.js` now records `missing.coachSummary` when the raw AI `coachSummary` is `undefined` or `null`, then reuses the existing fallback overall summary repair path. Present objects with missing/blank summary still record `missing.coachSummary.overallSummary`; malformed non-object values still record the existing type violation.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/coach-summary-missing-tracking-tests.mjs
node test-artifacts/server/coach-summary-missing-tracking-tests.mjs
node test-artifacts/server/match-summary-missing-tracking-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/coach-summary-missing-tracking-local npm run smoke:report:readonly
```

Expected: focused coach/match/metadata/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN evidence at 2026-06-09 11:15 KST:

```text
node --check server.js
# passed
node --check test-artifacts/server/coach-summary-missing-tracking-tests.mjs
# passed
node test-artifacts/server/coach-summary-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/match-summary-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 12 passed, 0 failed
node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
npm test
# 2083 passed, 0 failed across 88 test file(s)
git diff --check
# passed
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/coach-summary-missing-tracking-local npm run smoke:report:readonly
# qaVerdict.status=passed, requiredChecks=13/13, smokeSummary=156 passed / 0 failed, mode=readonly, durationMs=281
rg -n --hidden -S "<sensitive/live-api scan>" test-artifacts/tmp/coach-summary-missing-tracking-local
# no matches
```

- [ ] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-coach-summary-missing-tracking.md server.js test-artifacts/server/coach-summary-missing-tracking-tests.mjs
git commit -m "test: track missing coach summary"
git push origin main
```

- [ ] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-coach-summary-missing-tracking.md
git commit -m "docs: finalize coach summary missing tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers omitted `coachSummary` object tracking, preserves deterministic summary repair, and keeps present-object summary validation on the existing `missing.coachSummary.overallSummary` key.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The violation key is consistently `missing.coachSummary`; the existing `missing.coachSummary.overallSummary`, `type.coachSummary.string`, and `type.coachSummary.invalid` keys remain available for their narrower cases.
