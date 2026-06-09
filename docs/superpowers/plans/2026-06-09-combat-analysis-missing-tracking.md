# Combat Analysis Missing Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record missing AI `combatAnalysis` when the LLM payload includes combat encounters but the AI response omits them or returns an empty array.

**Architecture:** Keep `combatAnalysis` optional for final schema compatibility, but distinguish "no combat payload" from "AI missed available combat payload" in `buildAnalysis()`. Add a pre-normalization tracking branch that records `missing.combatAnalysis` only when `payload.combatEncounters` is non-empty and the raw AI field is `undefined`, `null`, or `[]`; malformed raw shapes remain on `shape.combatAnalysis.invalid`.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Missing AI Combat Analysis When Payload Has Encounters

**Files:**
- Create: `test-artifacts/server/combat-analysis-missing-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-combat-analysis-missing-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/combat-analysis-missing-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The stubbed `buildLlmPayload()` should return one deterministic `combatEncounters` item and no `teamfightPhases`. The primary AI response should otherwise be valid but set:

```js
combatAnalysis: []
```

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("combat analysis remains optional empty array", result.combatAnalysis, []);
checkTrue(
  "schemaViolations include missing combat analysis",
  result.analysisMeta.schemaViolations.includes("missing.combatAnalysis"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks missing combat analysis before normalization",
  buildAnalysisSrc.includes("missing.combatAnalysis"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
node test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because empty raw `combatAnalysis` is accepted as optional but not recorded in `schemaViolations`.

Actual RED evidence at 2026-06-09 09:49 KST:

```text
node --check test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
# passed

node test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
# 3 passed, 3 failed
# primary analysis and optional empty combatAnalysis were preserved, but schemaViolations missed missing.combatAnalysis and schemaViolationCount stayed 0.
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `combatAnalysis` normalization block:

```js
  const hasCombatPayload = Array.isArray(payload.combatEncounters) && payload.combatEncounters.length > 0;
  if (
    hasCombatPayload &&
    (
      primary.combatAnalysis === undefined ||
      primary.combatAnalysis === null ||
      (
        Array.isArray(primary.combatAnalysis) &&
        primary.combatAnalysis.length === 0
      )
    )
  ) {
    primary.combatAnalysis = [];
    violations.push("missing.combatAnalysis");
  } else if (primary.combatAnalysis === undefined || primary.combatAnalysis === null) {
    primary.combatAnalysis = [];
  } else if (!hasValidCombatAnalysis(primary.combatAnalysis)) {
    primary.combatAnalysis = [];
    violations.push("shape.combatAnalysis.invalid");
  }
```

Do not change final schema validation, prompt contract, or combat UI behavior.

Implementation note at 2026-06-09 09:50 KST:

- Added `hasCombatPayload` in `buildAnalysis()` before optional `combatAnalysis` normalization.
- Records `missing.combatAnalysis` only when `payload.combatEncounters` is non-empty and the raw AI field is `undefined`, `null`, or an empty array.
- Kept malformed non-empty shapes on the existing `shape.combatAnalysis.invalid` path.
- Left final schema validation, prompt contract, and combat UI behavior unchanged.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
node test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
node test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
node test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/combat-analysis-missing-tracking-local npm run smoke:report:readonly
```

Expected: focused combat/teamfight/metadata/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN/local QA evidence at 2026-06-09 09:51 KST:

```text
node --check server.js
# passed

node --check test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
# passed

node test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
# 6 passed, 0 failed

node test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
# 6 passed, 0 failed

node test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
# 6 passed, 0 failed

node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 12 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed

npm test
# 2019 passed, 0 failed across 80 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/combat-analysis-missing-tracking-local npm run smoke:report:readonly
# qaStatus: passed
# requiredChecks: 13/13
# smoke: 156 passed, 0 failed
# durationMs: 337
# mode: readonly
# gitShortSha: e84fd03
# gitDirty: true

rg -n --hidden -S "<sensitive-output-pattern>" test-artifacts/tmp/combat-analysis-missing-tracking-local
# no matches
```

- [ ] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-combat-analysis-missing-tracking.md server.js test-artifacts/server/combat-analysis-missing-tracking-tests.mjs
git commit -m "test: track missing combat analysis"
git push origin main
```

- [ ] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-combat-analysis-missing-tracking.md
git commit -m "docs: finalize combat analysis missing tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers missing/empty AI `combatAnalysis` when payload combat encounters exist, preserves existing malformed-shape tracking, and keeps final optional schema behavior unchanged.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague “add tests” placeholders remain.
- Type consistency: The violation key is consistently `missing.combatAnalysis`, payload field is consistently `combatEncounters`, and final report field is consistently `combatAnalysis`.
