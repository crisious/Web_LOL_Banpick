# Teamfight Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed timeline event timestamps before building combat encounters and teamfight phase payloads.

**Architecture:** `detectCombatEncounters()` and `buildTeamfightPhases()` currently sort and label combat events from raw/stale `timestampMs`, `timestampLabel`, and `phase` fields. Reuse `rawEventTimestampMs()`, `timestampLabel()`, and `phaseFor()` so combat/teamfight AI context follows the same timestamp policy as LLM timeline events, key moments, KDA timeline, and evidence index.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helper extraction, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Combat Encounter And Teamfight Timestamp Guard

**Files:**
- Create: `test-artifacts/server/teamfight-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/server/teamfight-phase-tests.mjs`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/teamfight-timestamp-policy-tests.mjs` with direct `detectCombatEncounters()` and `buildTeamfightPhases()` checks:

```js
check("combat encounter normalizes malformed event labels", encounterTiming(encounters[0]), {
  phase: "EARLY",
  startLabel: "0:00",
  endLabel: "0:00",
  relatedEventIds: ["evt_string", "evt_negative", "evt_infinite"],
});
check("valid event splits after normalized malformed group", encounterTiming(encounters[1]), {
  phase: "EARLY",
  startLabel: "2:00",
  endLabel: "2:00",
  relatedEventIds: ["evt_valid"],
});
check("teamfight top-level labels derive from normalized event time", teamfightTiming(teamfight), {
  startLabel: "0:00",
  endLabel: "2:00",
});
check("teamfight phase labels derive from normalized event time", teamfight.phases.map((phase) => ({
  phase: phase.phase,
  startLabel: phase.startLabel,
  endLabel: phase.endLabel,
})), [
  { phase: "ENGAGE", startLabel: "0:00", endLabel: "0:00" },
  { phase: "TRADE", startLabel: "0:00", endLabel: "0:00" },
  { phase: "CLEANUP", startLabel: "2:00", endLabel: "2:00" },
]);
```

Add source-shape checks:

```js
checkTrue("detectCombatEncounters normalizes sort timestamps", detectCombatEncountersSrc.includes("rawEventTimestampMs({ timestamp: a.timestampMs })"));
checkTrue("detectCombatEncounters normalizes loop timestamp", detectCombatEncountersSrc.includes("const ts = rawEventTimestampMs({ timestamp: evt.timestampMs });"));
checkTrue("detectCombatEncounters derives phase from normalized first time", detectCombatEncountersSrc.includes("phase: phaseFor(firstTime),"));
checkTrue("detectCombatEncounters derives labels from normalized time", detectCombatEncountersSrc.includes("startLabel: timestampLabel(firstTime),") && detectCombatEncountersSrc.includes("endLabel: timestampLabel(lastTime),"));
checkTrue("buildTeamfightPhases normalizes sort timestamps", buildTeamfightPhasesSrc.includes("rawEventTimestampMs({ timestamp: a.timestampMs })"));
checkTrue("buildTeamfightPhases derives phase labels from normalized time", buildTeamfightPhasesSrc.includes("startLabel: evs.length ? timestampLabel(eventTime(evs[0])) : \"\","));
checkTrue("buildTeamfightPhases cleanup gap uses normalized time", buildTeamfightPhasesSrc.includes("const gap = eventTime(lastEvt) - eventTime(prevEvt);"));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/teamfight-timestamp-policy-tests.mjs
node test-artifacts/server/teamfight-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `detectCombatEncounters()` and `buildTeamfightPhases()` currently sort by raw `timestampMs` and copy stale labels/phases.

Evidence, 2026-06-09 07:15 KST:
- `node --check test-artifacts/server/teamfight-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/teamfight-timestamp-policy-tests.mjs` exited 1 with `2 passed, 17 failed`.
- RED failures covered malformed combat grouping, stale encounter phase/start/end labels, stale teamfight phase labels, raw event order, cleanup outcome drift from raw timestamp gaps, and source-shape checks proving the functions still copied `first.phase`, `first.timestampLabel`, and `last.timestampLabel`.

- [x] **Step 3: Implement the minimal production change**

Update only timestamp sort/label/gap handling in `detectCombatEncounters()` and `buildTeamfightPhases()`:

```js
const eventTime = (event) => rawEventTimestampMs({ timestamp: event.timestampMs });
```

Use `eventTime(a) - eventTime(b)` for sort comparators, `timestampLabel(eventTime(...))` for start/end labels, `phaseFor(firstTime)` for encounter phase, and `eventTime(lastEvt) - eventTime(prevEvt)` for cleanup gap.

Do not change combat event filtering, encounter cap, kill/death counters, situation tags, teamfight minimum event count, outcome tag policy, or AI merge behavior.

Evidence, 2026-06-09 07:17 KST:
- Updated `detectCombatEncounters()` to use a local `eventTime(event)` wrapper around `rawEventTimestampMs({ timestamp: event.timestampMs })`.
- Updated combat event sorting, grouping `ts`, encounter `phase`, `startLabel`, and `endLabel` to use normalized time.
- Updated `buildTeamfightPhases()` to normalize sort timestamps, per-phase labels, top-level labels, and cleanup gap calculation.
- Updated `test-artifacts/server/teamfight-phase-tests.mjs` function-extraction harness to include `timestampLabel()`, `phaseFor()`, and `rawEventTimestampMs()` because the extracted functions now depend on the shared timestamp policy.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/teamfight-timestamp-policy-tests.mjs
node --check test-artifacts/server/teamfight-phase-tests.mjs
node test-artifacts/server/teamfight-timestamp-policy-tests.mjs
node test-artifacts/server/teamfight-phase-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/server/llm-payload-timestamp-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected GREEN:
- New teamfight timestamp policy test passes.
- Existing teamfight, LLM payload, and schema contracts still pass.

Evidence, 2026-06-09 07:17 KST:
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/teamfight-timestamp-policy-tests.mjs` exited 0.
- `node --check test-artifacts/server/teamfight-phase-tests.mjs` exited 0.
- `node test-artifacts/server/teamfight-timestamp-policy-tests.mjs`: `19 passed, 0 failed`.
- `node test-artifacts/server/teamfight-phase-tests.mjs`: `38 passed, 0 failed`.
- `node test-artifacts/server/llm-payload-tests.mjs`: `84 passed, 0 failed`.
- `node test-artifacts/server/llm-payload-timestamp-policy-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/schema/schema-tests.mjs`: `86 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence, 2026-06-09 07:19 KST:
- `npm test`: `1882 passed, 0 failed across 66 test file(s)`.
- `git diff --check` exited 0.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-timestamp-policy-local npm run smoke:report:readonly` exited 0.
- Local read-only smoke summary: QA `passed`, required checks `13/13`, smoke checks `156 passed, 0 failed`, duration `204ms`, mode `readonly`, dirty `true`.
- Local smoke report directory: `test-artifacts/tmp/teamfight-timestamp-policy-local/2026-06-08T22-18-45Z-readonly`.
- Local high-risk sensitive pattern scan over `test-artifacts/tmp/teamfight-timestamp-policy-local` returned no matches.

- [ ] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-teamfight-timestamp-policy.md server.js test-artifacts/server/teamfight-phase-tests.mjs test-artifacts/server/teamfight-timestamp-policy-tests.mjs
git commit -m "test: guard teamfight timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers malformed combat encounter timestamps, stale encounter phase replacement, stale teamfight phase labels, cleanup gap normalization, focused tests, full QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `detectCombatEncounters(timelineEvents)`, `buildTeamfightPhases(encounters, timelineEvents)`, `rawEventTimestampMs(event)`, `timestampLabel(milliseconds)`, and `phaseFor(timestampMs)` names exactly as defined in `server.js`.
