# KDA Timeline Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed `timestampMs` values before they enter the derived KDA timeline.

**Architecture:** `buildKdaTimeline()` already consumes normalized `timelineEvents`, but it still copies each event's `timestampMs`, `timestampLabel`, and `phase` directly into chart points. Reuse the existing `rawEventTimestampMs()` semantics against `evt.timestampMs`, then derive `timeLabel` and `phase` from that normalized time so stored or recomputed malformed timeline events fail closed to `0:00` / `EARLY`.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helpers, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: KDA Timeline Timestamp Guard

**Files:**
- Create: `test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/server/timeline-consumer-tests.mjs`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs` with direct `buildKdaTimeline()` checks:

```js
check("string KDA timestamp normalizes to 0", timing(stringPoint), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("negative KDA timestamp normalizes to 0", timing(negativePoint), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("infinite KDA timestamp normalizes to 0", timing(infinitePoint), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("valid KDA timestamp is derived from timestampMs", timing(validPoint), { time: 120000, timeLabel: "2:00", phase: "EARLY" });
check("KDA counts stay unchanged", countShape(validPoint), { kills: 2, deaths: 1, assists: 1, kda: 3 });
```

Add source-shape checks:

```js
checkTrue(
  "buildKdaTimeline normalizes evt.timestampMs with rawEventTimestampMs",
  buildKdaTimelineSrc.includes("const time = rawEventTimestampMs({ timestamp: evt.timestampMs });"),
);
checkTrue("buildKdaTimeline derives labels from normalized time", buildKdaTimelineSrc.includes("timeLabel: timestampLabel(time),"));
checkTrue("buildKdaTimeline derives phase from normalized time", buildKdaTimelineSrc.includes("phase: phaseFor(time),"));
checkTrue("buildKdaTimeline no longer copies evt.timestampLabel", !buildKdaTimelineSrc.includes("timeLabel: evt.timestampLabel"));
checkTrue("buildKdaTimeline no longer copies evt.phase", !buildKdaTimelineSrc.includes("phase: evt.phase"));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `buildKdaTimeline()` currently copies `evt.timestampMs`, `evt.timestampLabel`, and `evt.phase` directly.

Evidence, 2026-06-09 06:35 KST:
- `node --check test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs` exited 1 with `3 passed, 9 failed`.
- RED failures covered string, negative, and infinite `timestampMs`, stale valid timestamp label/phase copying, and source-shape checks proving `buildKdaTimeline()` still copied `evt.timestampLabel` and `evt.phase`.

- [x] **Step 3: Implement the minimal production change**

Update the changed branch inside `buildKdaTimeline()`:

```js
if (changed) {
  const time = rawEventTimestampMs({ timestamp: evt.timestampMs });
  const kda = +((kills + assists) / Math.max(1, deaths)).toFixed(2);
  points.push({
    time,
    timeLabel: timestampLabel(time),
    phase: phaseFor(time),
    kills,
    deaths,
    assists,
    kda,
    event: evt.summary || evt.eventType,
    eventType: evt.eventType,
  });
}
```

Do not change KDA counting, event filtering, event labels, or any timeline extraction behavior.

Also update `test-artifacts/server/timeline-consumer-tests.mjs` so its direct `new Function()` harness includes `timestampLabel()`, `phaseFor()`, and `rawEventTimestampMs()` before evaluating `buildKdaTimeline()`.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/timeline-consumer-tests.mjs
node test-artifacts/server/raw-event-timestamp-tests.mjs
node test-artifacts/server/item-timeline-timestamp-policy-tests.mjs
```

Expected GREEN:
- New KDA timestamp policy test passes.
- Existing timeline consumer and timestamp policy tests still pass.

Evidence, 2026-06-09 06:38 KST:
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs` exited 0.
- `node --check test-artifacts/server/timeline-consumer-tests.mjs` exited 0.
- `node test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/server/timeline-consumer-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/server/raw-event-timestamp-tests.mjs`: `15 passed, 0 failed`.
- `node test-artifacts/server/item-timeline-timestamp-policy-tests.mjs`: `8 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/kda-timeline-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence, 2026-06-09 06:39 KST:
- `npm test` exited 0 with `1828 passed, 0 failed across 62 test file(s)`.
- `git diff --check` exited 0.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/kda-timeline-timestamp-policy-local npm run smoke:report:readonly` exited 0.
- Local read-only smoke summary: QA verdict `passed`, required checks `13/13`, smoke `156 passed, 0 failed`, duration `226ms`.
- Local smoke artifact sensitive scan found no high-risk sensitive patterns.

- [ ] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-kda-timeline-timestamp-policy.md server.js test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs test-artifacts/server/timeline-consumer-tests.mjs
git commit -m "test: guard kda timeline timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers malformed KDA timeline timestamps, label/phase derivation, KDA count preservation, focused tests, full QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `buildKdaTimeline(normalized)`, `rawEventTimestampMs(event)`, `timestampLabel(milliseconds)`, and `phaseFor(timestampMs)` names exactly as defined in `server.js`.
