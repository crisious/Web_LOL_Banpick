# Match Summary Missing Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record omitted AI `matchSummary` objects as `missing.matchSummary` once, while preserving `missing.matchSummary.headline` for present objects whose headline text is missing or blank.

**Architecture:** Keep deterministic headline repair unchanged: invalid AI match summaries still receive a fallback headline from `buildRuleBasedAnalysis(normalized, sampleId)` before final validation. Split the top-level missing object case from malformed object/headline cases in `buildAnalysis()` so schema violation metrics do not double-count an omitted `matchSummary`.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Missing Match Summary Separately From Missing Headline

**Files:**
- Create: `test-artifacts/server/match-summary-missing-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-match-summary-missing-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/match-summary-missing-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but omit `matchSummary` entirely.

The stubbed `buildRuleBasedAnalysis()` should return a fallback headline and increment `state.matchRepairCalls`.

Assertions:

```js
check("coach summary is preserved", result.coachSummary.overallSummary, "primary coach summary");
check("match summary headline is repaired", result.matchSummary.headline, "fallback headline");
check("match repair called once", state.matchRepairCalls, 1);
checkTrue(
  "schemaViolations include missing match summary",
  result.analysisMeta.schemaViolations.includes("missing.matchSummary"),
);
checkTrue(
  "schemaViolations do not mark missing match summary as invalid type",
  !result.analysisMeta.schemaViolations.includes("type.matchSummary.invalid"),
);
checkTrue(
  "schemaViolations do not double count missing headline for missing match summary",
  !result.analysisMeta.schemaViolations.includes("missing.matchSummary.headline"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks missing match summary separately",
  buildAnalysisSrc.includes("\"missing.matchSummary\""),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/match-summary-missing-tracking-tests.mjs
node test-artifacts/server/match-summary-missing-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because omitted raw `matchSummary` is repaired but recorded as `type.matchSummary.invalid` and `missing.matchSummary.headline`.

Actual RED evidence at 2026-06-09 11:04 KST:

```text
node --check test-artifacts/server/match-summary-missing-tracking-tests.mjs
# passed

node test-artifacts/server/match-summary-missing-tracking-tests.mjs
# 3 passed, 5 failed
# coach summary and repaired match headline were preserved, but schemaViolations missed missing.matchSummary, included type.matchSummary.invalid, double-counted missing.matchSummary.headline, and schemaViolationCount was 2 instead of 1.
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `matchSummary` normalization and repair block:

```js
  // matchSummary: AI가 string으로 반환하는 경우 → 객체로 정규화
  if (typeof primary.matchSummary === "string") {
    primary.matchSummary = { headline: primary.matchSummary };
    violations.push("type.matchSummary.string");
  } else if (!primary.matchSummary || typeof primary.matchSummary !== "object" || Array.isArray(primary.matchSummary)) {
    const matchSummaryViolation = (
      primary.matchSummary === undefined ||
      primary.matchSummary === null
    )
      ? "missing.matchSummary"
      : "type.matchSummary.invalid";
    primary.matchSummary = {};
    violations.push(matchSummaryViolation);
  }
  if (!hasValidMatchSummary(primary.matchSummary)) {
    const fb = buildRuleBasedAnalysis(normalized, sampleId);
    primary.matchSummary.headline = fb.matchSummary.headline;
    if (!violations.includes("missing.matchSummary")) {
      violations.push("missing.matchSummary.headline");
    }
  }
```

Do not change `hasValidMatchSummary()`, final schema validation, coach summary repair, prompt contract, UI rendering, or stored sample content.

Implementation note at 2026-06-09 11:05 KST: `server.js` now records `missing.matchSummary` when the raw AI `matchSummary` is `undefined` or `null`, then reuses the existing fallback headline repair path. Present objects with missing/blank headline still record `missing.matchSummary.headline`; malformed non-object values still record the existing type violation.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/match-summary-missing-tracking-tests.mjs
node test-artifacts/server/match-summary-missing-tracking-tests.mjs
node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
node test-artifacts/server/strengths-missing-tracking-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/match-summary-missing-tracking-local npm run smoke:report:readonly
```

Expected: focused summary/weaknesses/strengths/metadata/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN evidence at 2026-06-09 11:06 KST:

```text
node --check server.js
# passed
node --check test-artifacts/server/match-summary-missing-tracking-tests.mjs
# passed
node test-artifacts/server/match-summary-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/strengths-missing-tracking-tests.mjs
# 8 passed, 0 failed
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 12 passed, 0 failed
node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
npm test
# 2075 passed, 0 failed across 87 test file(s)
git diff --check
# passed
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/match-summary-missing-tracking-local npm run smoke:report:readonly
# qaVerdict.status=passed, requiredChecks=13/13, smokeSummary=156 passed / 0 failed, mode=readonly, durationMs=485
rg -n --hidden -S "<sensitive/live-api scan>" test-artifacts/tmp/match-summary-missing-tracking-local
# no matches
```

- [ ] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-match-summary-missing-tracking.md server.js test-artifacts/server/match-summary-missing-tracking-tests.mjs
git commit -m "test: track missing match summary"
git push origin main
```

- [ ] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-match-summary-missing-tracking.md
git commit -m "docs: finalize match summary missing tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers omitted `matchSummary` object tracking, preserves headline repair, and keeps present-object headline validation on the existing `missing.matchSummary.headline` key.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The violation key is consistently `missing.matchSummary`; the existing `missing.matchSummary.headline`, `type.matchSummary.string`, and `type.matchSummary.invalid` keys remain available for their narrower cases.
