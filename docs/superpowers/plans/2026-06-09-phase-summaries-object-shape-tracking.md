# Phase Summaries Object Shape Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record unusable AI `phaseSummaries` objects as `shape.phaseSummaries.object.invalid` instead of misclassifying them as `missing.phaseSummaries`.

**Architecture:** Keep the existing object-to-array normalization path for AI responses that send `{ early, mid, late }` instead of an array. Track whether the raw input was an object and whether it produced any usable phase entries; if object normalization yields no usable entries, preserve the existing `type.phaseSummaries.object` signal and record `shape.phaseSummaries.object.invalid` for the repair reason.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Unusable Phase Summary Objects Separately From Missing Arrays

**Files:**
- Create: `test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-phase-summaries-object-shape-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
phaseSummaries: { laning: { summary: "ignored legacy phase" } }
```

The stubbed `buildPhaseSummaries()` should return three valid repaired summaries and increment `state.phaseRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("phase summaries are repaired", result.phaseSummaries.map((item) => item.phase), ["EARLY", "MID", "LATE"]);
check("phase repair called once", state.phaseRepairCalls, 1);
checkTrue(
  "schemaViolations include phase summary object type",
  result.analysisMeta.schemaViolations.includes("type.phaseSummaries.object"),
);
checkTrue(
  "schemaViolations include malformed phase summary object",
  result.analysisMeta.schemaViolations.includes("shape.phaseSummaries.object.invalid"),
);
checkTrue(
  "schemaViolations do not misclassify malformed object as missing",
  !result.analysisMeta.schemaViolations.includes("missing.phaseSummaries"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 2);
checkTrue(
  "buildAnalysis tracks malformed phase summary object separately",
  buildAnalysisSrc.includes("\"shape.phaseSummaries.object.invalid\""),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because the unusable object is repaired but recorded as `missing.phaseSummaries`.

Actual RED evidence (2026-06-09 11:25 KST):

```text
node --check test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
# passed

node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
# 6 passed, 3 failed
# FAIL schemaViolations include malformed phase summary object
# FAIL schemaViolations do not misclassify malformed object as missing
# FAIL buildAnalysis tracks malformed phase summary object separately
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `phaseSummaries` object normalization and repair block:

```js
  // phaseSummaries: AI가 배열 대신 객체로 반환하는 경우 → 배열로 정규화
  let phaseSummariesWasObject = false;
  let phaseSummariesObjectHadUsableEntries = false;
  if (primary.phaseSummaries && !Array.isArray(primary.phaseSummaries)) {
    phaseSummariesWasObject = typeof primary.phaseSummaries === "object";
    const ps = primary.phaseSummaries;
    const phaseSummaryObjectKeys = ["early", "mid", "late"].filter((k) => ps[k]);
    phaseSummariesObjectHadUsableEntries = phaseSummaryObjectKeys.length > 0;
    primary.phaseSummaries = phaseSummaryObjectKeys
      .map((k) => {
        const v = ps[k];
        return typeof v === "string" ? { phase: k.toUpperCase(), summary: v } : { phase: k.toUpperCase(), ...v };
      });
    violations.push("type.phaseSummaries.object");
  }
  if (!hasValidPhaseSummaries(primary.phaseSummaries)) {
    const phaseSummariesViolation = (
      phaseSummariesWasObject &&
      !phaseSummariesObjectHadUsableEntries
    )
      ? "shape.phaseSummaries.object.invalid"
      : (
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

Do not change `hasValidPhaseSummaries()`, final schema validation, existing empty-array missing tracking, prompt contract, UI rendering, or stored sample content.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
node test-artifacts/server/coach-summary-missing-tracking-tests.mjs
node test-artifacts/server/match-summary-missing-tracking-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-object-shape-tracking-local npm run smoke:report:readonly
```

Expected: focused phase/match/coach/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN/local QA evidence (2026-06-09 11:27 KST):

```text
node --check server.js
# passed

node --check test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/coach-summary-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/match-summary-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed

npm test
# 2092 passed, 0 failed across 89 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-object-shape-tracking-local npm run smoke:report:readonly
# qaVerdict.status=passed, smokeSummary=156 passed / 0 failed, requiredChecks=13/13, durationMs=203

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/phase-summaries-object-shape-tracking-local
# no matches
```

- [ ] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summaries-object-shape-tracking.md server.js test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
git commit -m "test: track malformed phase summary objects"
git push origin main
```

- [ ] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summaries-object-shape-tracking.md
git commit -m "docs: finalize phase summary object tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers unusable object-shaped `phaseSummaries`, preserves deterministic repair, and keeps raw missing/empty arrays on the existing `missing.phaseSummaries` path.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The new violation key is consistently `shape.phaseSummaries.object.invalid`; existing `type.phaseSummaries.object`, `missing.phaseSummaries`, and `count.phaseSummaries<3` remain available for their narrower cases.
