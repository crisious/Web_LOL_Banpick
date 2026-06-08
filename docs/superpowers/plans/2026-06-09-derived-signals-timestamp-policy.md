# Derived Signals Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed timeline event timestamps before rule-based derived signals and early-death weaknesses decide event phases.

**Architecture:** `buildDerivedSignals()` and `buildWeaknesses()` still trust stale `event.phase` for early/mid/late decisions. Reuse `rawEventTimestampMs()` and `phaseFor()` so candidate themes, summary booleans, and early stability weakness generation follow the same timestamp policy as key moments, KDA, evidence index, LLM payload, teamfight context, and phase summaries.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helper extraction, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Derived Signals And Weakness Phase Timestamp Guard

**Files:**
- Create: `test-artifacts/server/derived-signals-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/derived-signals-timestamp-policy-tests.mjs` with direct `buildDerivedSignals()`, `buildWeaknesses()`, and `filterPostObjectiveDeaths()` checks:

```js
check("derived signals derive early/mid/late gates from normalized timestamp", compactDerivedSignals(derived), {
  hasEarlyLeadMoments: true,
  hasMidGameThrowRisk: true,
  candidateThemes: ["weak_early_stability", "late_structure_closeout"],
});
check("weaknesses derive early death weakness from normalized timestamp", compactWeakness(weaknesses[0]), {
  title: "초반 안정감이 낮았음",
  relatedEventIds: ["d_bad", "d_negative"],
});
check("post objective death window normalizes malformed timestamps", filterPostObjectiveDeaths(malformedDeaths, malformedObjectives), []);
```

Add source-shape checks:

```js
checkTrue("buildDerivedSignals normalizes event phase", buildDerivedSignalsSrc.includes("const eventPhase = (event) => phaseFor(rawEventTimestampMs({ timestamp: event.timestampMs }));"));
checkTrue("buildDerivedSignals no longer filters by event.phase", !buildDerivedSignalsSrc.includes('event.phase === "EARLY"') && !buildDerivedSignalsSrc.includes('event.phase === "MID"') && !buildDerivedSignalsSrc.includes('event.phase === "LATE"'));
checkTrue("buildWeaknesses normalizes event phase", buildWeaknessesSrc.includes("const eventPhase = (event) => phaseFor(rawEventTimestampMs({ timestamp: event.timestampMs }));"));
checkTrue("buildWeaknesses no longer filters early deaths by event.phase", !buildWeaknessesSrc.includes('deaths.filter((event) => event.phase === "EARLY")'));
checkTrue("filterPostObjectiveDeaths normalizes objective/death timestamps", filterPostObjectiveDeathsSrc.includes("const deathTime = rawEventTimestampMs({ timestamp: deathEvent.timestampMs });") && filterPostObjectiveDeathsSrc.includes("const objectiveTime = rawEventTimestampMs({ timestamp: objectiveEvent.timestampMs });"));
checkTrue("filterPostObjectiveDeaths no longer compares raw timestampMs fields", !filterPostObjectiveDeathsSrc.includes("objectiveEvent.timestampMs < deathEvent.timestampMs"));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/derived-signals-timestamp-policy-tests.mjs
node test-artifacts/server/derived-signals-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `buildDerivedSignals()`, `buildWeaknesses()`, and `filterPostObjectiveDeaths()` currently depend on stale `event.phase` or raw `timestampMs` comparison.

Evidence, 2026-06-09 07:43 KST:
- `node --check test-artifacts/server/derived-signals-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/derived-signals-timestamp-policy-tests.mjs` exited 1 with `0 passed, 9 failed`.
- RED failures covered stale phase gates in `buildDerivedSignals()`, early-death weakness generation in `buildWeaknesses()`, raw malformed timestamp comparison in `filterPostObjectiveDeaths()`, and all source-shape checks proving the functions still depended on `event.phase` or direct `timestampMs` comparisons.

- [x] **Step 3: Implement the minimal production change**

Update only phase/time bucketing in `filterPostObjectiveDeaths()`, `buildDerivedSignals()`, and `buildWeaknesses()`:

```js
const deathTime = rawEventTimestampMs({ timestamp: deathEvent.timestampMs });
const objectiveTime = rawEventTimestampMs({ timestamp: objectiveEvent.timestampMs });
return objectiveTime < deathTime && deathTime - objectiveTime <= POST_OBJECTIVE_DEATH_WINDOW_MS;
```

```js
const eventPhase = (event) => phaseFor(rawEventTimestampMs({ timestamp: event.timestampMs }));
const earlyDeaths = playerDeaths.filter((event) => eventPhase(event) === "EARLY");
const lateTowers = events.filter((event) => eventPhase(event) === "LATE" && isStructureTakeEvent(event));
```

```js
hasEarlyLeadMoments: objectiveWins.some((event) => eventPhase(event) === "EARLY"),
hasMidGameThrowRisk:
  postObjectiveDeaths.length >= 1 ||
  playerDeaths.filter((event) => eventPhase(event) === "MID").length >= 2,
```

Do not change insight copy, CS thresholds, objective/fight event type policy, weakness ordering, or returned object shape.

Evidence, 2026-06-09 07:45 KST:
- Updated `filterPostObjectiveDeaths()` to normalize both objective and death `timestampMs` values through `rawEventTimestampMs({ timestamp: ... })` before comparing the post-objective death window.
- Updated `buildDerivedSignals()` to derive `earlyDeaths`, `lateTowers`, `hasEarlyLeadMoments`, and the MID death throw-risk gate through `phaseFor(rawEventTimestampMs({ timestamp: event.timestampMs }))`.
- Updated `buildWeaknesses()` to derive early-death weakness gates through normalized timestamp phase.
- Updated `test-artifacts/server/strength-weakness-tests.mjs` extraction harness with `phaseFor()` and `rawEventTimestampMs()` dependencies and revised the source-shape assertion for late structure phase gating.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/derived-signals-timestamp-policy-tests.mjs
node --check test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/derived-signals-timestamp-policy-tests.mjs
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/phase-summary-timestamp-policy-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected GREEN:
- New derived signals timestamp policy test passes.
- Existing strength/weakness, phase summary, LLM payload, and schema contracts still pass.

Evidence, 2026-06-09 07:45 KST:
- `node --check server.js && node --check test-artifacts/server/derived-signals-timestamp-policy-tests.mjs && node --check test-artifacts/server/strength-weakness-tests.mjs` exited 0.
- `node test-artifacts/server/derived-signals-timestamp-policy-tests.mjs`: `9 passed, 0 failed`.
- `node test-artifacts/server/strength-weakness-tests.mjs`: `89 passed, 0 failed`.
- `node test-artifacts/server/phase-summary-timestamp-policy-tests.mjs`: `9 passed, 0 failed`.
- `node test-artifacts/server/llm-payload-tests.mjs`: `84 passed, 0 failed`.
- `node test-artifacts/schema/schema-tests.mjs`: `86 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/derived-signals-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence, 2026-06-09 07:51 KST:
- Initial full QA surfaced a harness dependency gap in `test-artifacts/server/coach-summary-tests.mjs` after `filterPostObjectiveDeaths()` began using `rawEventTimestampMs()`.
- Root cause was confirmed by rerunning `node test-artifacts/server/coach-summary-tests.mjs`: `ReferenceError: rawEventTimestampMs is not defined`.
- Updated the coach summary extraction harness to include `rawEventTimestampMs()`.
- `node --check test-artifacts/server/coach-summary-tests.mjs` exited 0.
- `node test-artifacts/server/coach-summary-tests.mjs`: `11 passed, 0 failed`.
- Re-run `npm test && git diff --check` exited 0.
- `npm test`: `1900 passed, 0 failed across 68 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/derived-signals-timestamp-policy-local npm run smoke:report:readonly` exited 0.
- Local `qa-summary.json`: `qaStatus=passed`, required checks `13/13`, smoke checks `156 passed, 0 failed`, duration `211ms`, mode `readonly`, git short SHA `4ae8db3`, dirty `true` because this implementation was intentionally uncommitted.
- Local artifact sensitive-pattern scan found no matches for Riot/OpenAI key markers, private key headers, local absolute paths, runtime sample paths, Riot hostnames, DNS errors, or parser errors.

- [ ] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-derived-signals-timestamp-policy.md server.js test-artifacts/server/strength-weakness-tests.mjs test-artifacts/server/derived-signals-timestamp-policy-tests.mjs
git commit -m "test: guard derived signal timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers stale phase gates in derived signals, early death weaknesses, malformed post-objective timestamp comparison, focused tests, full QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `buildDerivedSignals(normalized)`, `buildWeaknesses(normalized)`, `filterPostObjectiveDeaths(deaths, objectiveWins)`, `rawEventTimestampMs(event)`, and `phaseFor(timestampMs)` names exactly as defined in `server.js`.
