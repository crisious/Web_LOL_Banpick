# Ward Timeline Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed ward timeline timestamps so ward UI timing and phase summaries stay stable.

**Architecture:** Reuse the existing `rawEventTimestampMs(event)` helper inside `buildWardTimeline()`. Each ward event row will calculate `const time = rawEventTimestampMs(event)` before building `time`, `timeLabel`, and `phase`, matching the objective timeline timestamp policy without changing ward action filtering or summary math.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helpers, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Ward Timeline Timestamp Normalization

**Files:**
- Create: `test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs` with direct `buildWardTimeline()` checks:

```js
check("placed string timestamp normalizes to 0", timing(placedString), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("placed negative timestamp normalizes to 0", timing(placedNegative), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("killed infinite timestamp normalizes to 0", timing(killedInfinite), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("valid ward timestamp is preserved", timing(placedValid), { time: 120000, timeLabel: "2:00", phase: "EARLY" });
check("summary counts normalized placed wards in early phase", wardTimeline.summary.byPhase, { EARLY: 3, MID: 0, LATE: 0 });
```

Add source-shape checks:

```js
checkTrue("buildWardTimeline uses rawEventTimestampMs", buildWardTimelineSrc.includes("const time = rawEventTimestampMs(event);"));
checkTrue(
  "buildWardTimeline labels use normalized time",
  buildWardTimelineSrc.includes("timeLabel: timestampLabel(time),") &&
    buildWardTimelineSrc.includes("phase: phaseFor(time),"),
);
checkTrue(
  "buildWardTimeline no longer labels from raw event.timestamp",
  !buildWardTimelineSrc.includes("timeLabel: timestampLabel(event.timestamp)") &&
    !buildWardTimelineSrc.includes("phase: phaseFor(event.timestamp)"),
);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `buildWardTimeline()` still assigns `time`, `timeLabel`, and `phase` from raw `event.timestamp`.

Evidence (2026-06-09 06:09 KST):
- `node --check test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs` failed as expected with `3 passed, 7 failed`; failures covered string timestamp `NaN:NaN`/`LATE`, negative timestamp `-1:-1`, infinite timestamp label mismatch, phase summary mismatch, and source-shape checks.

- [x] **Step 3: Implement the minimal production change**

Inside both ward event branches, add:

```js
const time = rawEventTimestampMs(event);
```

Then use the normalized value:

```js
time,
timeLabel: timestampLabel(time),
phase: phaseFor(time),
```

Do not change ward filtering, action names, ward type fallback, sorting, or summary formulas.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/raw-event-timestamp-tests.mjs
node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
```

Expected GREEN:
- New ward timestamp policy test passes.
- Existing raw timestamp and objective timestamp policy tests still pass.

Evidence (2026-06-09 06:09 KST):
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs`: `10 passed, 0 failed`.
- `node test-artifacts/server/raw-event-timestamp-tests.mjs`: `15 passed, 0 failed`.
- `node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`: `8 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/ward-timeline-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence (2026-06-09 06:09 KST):
- `npm test`: `1797 passed, 0 failed across 59 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/ward-timeline-timestamp-policy-local npm run smoke:report:readonly`: smoke `156 passed, 0 failed`, QA verdict `passed`, required checks `13/13`, duration `603 ms`.
- Local smoke artifact sensitive scan: no high-risk sensitive patterns found.
- `git diff --check` exited 0.

- [ ] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-ward-timeline-timestamp-policy.md server.js test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs
git commit -m "test: guard ward timeline timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers ward placed/kill timestamp normalization, phase summary stability, regression tests, local QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `buildWardTimeline(timeline, targetParticipantId)` and `rawEventTimestampMs(event)` names exactly as defined in `server.js`.
