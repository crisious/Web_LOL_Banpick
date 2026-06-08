# Objective Timeline Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep objective timeline UI events from rendering malformed timestamps when Riot timeline payloads contain missing, string, negative, infinite, or NaN timestamps.

**Architecture:** Reuse the existing `rawEventTimestampMs(event)` normalization helper in `buildObjectiveTimeline()` before computing `time`, `timeLabel`, and `phase`. Add a focused server regression test that extracts the real functions from `server.js` and verifies objective and structure events share the same timestamp policy as `extractTimelineEvents()`.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helpers, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Objective Timeline Timestamp Normalization

**Files:**
- Create: `test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs` with checks that:

```js
check("objective string timestamp normalizes to 0", {
  time: events[0]?.time,
  timeLabel: events[0]?.timeLabel,
  phase: events[0]?.phase,
}, { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("objective negative timestamp normalizes to 0", {
  time: events[1]?.time,
  timeLabel: events[1]?.timeLabel,
  phase: events[1]?.phase,
}, { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("structure infinite timestamp normalizes to 0", {
  time: events[2]?.time,
  timeLabel: events[2]?.timeLabel,
  phase: events[2]?.phase,
}, { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("valid objective timestamp is preserved", {
  time: events[3]?.time,
  timeLabel: events[3]?.timeLabel,
  phase: events[3]?.phase,
}, { time: 120000, timeLabel: "2:00", phase: "EARLY" });
```

Also assert source shape:

```js
checkTrue(
  "buildObjectiveTimeline uses rawEventTimestampMs for event time",
  buildObjectiveTimelineSrc.includes("const time = rawEventTimestampMs(event);"),
);
checkTrue(
  "buildObjectiveTimeline labels use normalized time",
  buildObjectiveTimelineSrc.includes("timeLabel: timestampLabel(time),") &&
    buildObjectiveTimelineSrc.includes("phase: phaseFor(time),"),
);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `buildObjectiveTimeline()` currently uses `event.timestamp` directly.

Observed at `2026-06-09 05:38 KST`:
- `node --check test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`: passed
- `node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`: 2 passed / 6 failed
- Failure evidence: string timestamp rendered `NaN:NaN`, negative timestamp rendered `-1:-1`, infinite structure timestamp rendered `Infinity:NaN`, and source-shape checks confirmed raw `event.timestamp` usage.

- [x] **Step 3: Implement the minimal production change**

In `buildObjectiveTimeline()`, introduce one normalized timestamp per raw event callback:

```js
const time = rawEventTimestampMs(event);
```

Use `time` for both structure and objective rows:

```js
time,
timeLabel: timestampLabel(time),
phase: phaseFor(time),
```

Do not change objective team policy, labels, event sorting, or filtering.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js && node --check test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
node test-artifacts/server/raw-event-timestamp-tests.mjs
```

Expected GREEN:
- New timestamp policy test passes.
- Existing objective team and raw event timestamp tests still pass.

Observed at `2026-06-09 05:38 KST`:
- `node --check server.js && node --check test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs && node --check test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: passed
- `node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`: 8 passed / 0 failed
- `node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: 16 passed / 0 failed
- `node test-artifacts/server/raw-event-timestamp-tests.mjs`: 15 passed / 0 failed
- `node test-artifacts/server/sample-bundle-error-tests.mjs`: 13 passed / 0 failed

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-timeline-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- `git diff --check` exits 0.

Observed at `2026-06-09 05:38 KST`:
- `npm test`: 1751 passed / 0 failed across 56 test file(s)
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-timeline-timestamp-policy-local npm run smoke:report:readonly`: passed
- Local smoke summary: required checks total 13 / passed 13 / failed 0 / missing 0, smoke 156 passed / 0 failed, `durationMs: 646`, mode `readonly`
- Local smoke artifact high-risk sensitive pattern scan: no matches
- `git diff --check`: passed

- [ ] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-objective-timeline-timestamp-policy.md server.js test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
git commit -m "test: guard objective timeline timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers malformed timestamp protection for objective timeline structure/objective rows, regression tests, local QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses the existing `rawEventTimestampMs(event)`, `timestampLabel(milliseconds)`, `phaseFor(timestampMs)`, and `buildObjectiveTimeline(timeline, targetTeamId, participantTeamMap)` names exactly as defined in `server.js`.
