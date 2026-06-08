# Item Timeline Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed item purchase timestamps so item timeline UI timing stays stable.

**Architecture:** Reuse the existing `rawEventTimestampMs(event)` helper inside `buildItemTimeline()`. Each purchase row will calculate `const time = rawEventTimestampMs(event)` before building `time`, `timeLabel`, and `phase`, matching the objective and ward timestamp policies without changing item purchase filtering or item ids.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helpers, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Item Timeline Timestamp Normalization

**Files:**
- Create: `test-artifacts/server/item-timeline-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/item-timeline-timestamp-policy-tests.mjs` with direct `buildItemTimeline()` checks:

```js
check("string item timestamp normalizes to 0", timing(stringItem), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("negative item timestamp normalizes to 0", timing(negativeItem), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("infinite item timestamp normalizes to 0", timing(infiniteItem), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("valid item timestamp is preserved", timing(validItem), { time: 120000, timeLabel: "2:00", phase: "EARLY" });
check("target participant item purchases are kept", itemTimeline.map((event) => event.itemId), [1001, 2003, 3340, 1055]);
```

Add source-shape checks:

```js
checkTrue("buildItemTimeline uses rawEventTimestampMs", buildItemTimelineSrc.includes("const time = rawEventTimestampMs(event);"));
checkTrue(
  "buildItemTimeline labels use normalized time",
  buildItemTimelineSrc.includes("timeLabel: timestampLabel(time),") &&
    buildItemTimelineSrc.includes("phase: phaseFor(time),"),
);
checkTrue(
  "buildItemTimeline no longer labels from raw event.timestamp",
  !buildItemTimelineSrc.includes("timeLabel: timestampLabel(event.timestamp)") &&
    !buildItemTimelineSrc.includes("phase: phaseFor(event.timestamp)"),
);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/item-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/item-timeline-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `buildItemTimeline()` still assigns `time`, `timeLabel`, and `phase` from raw `event.timestamp`.

Evidence (2026-06-09 06:17 KST):
- `node --check test-artifacts/server/item-timeline-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/item-timeline-timestamp-policy-tests.mjs` failed as expected with `1 passed, 7 failed`; failures covered item order instability, string timestamp `NaN:NaN`/`LATE`, negative timestamp `-1:-1`, infinite timestamp label mismatch, and source-shape checks.

- [x] **Step 3: Implement the minimal production change**

Inside the `ITEM_PURCHASED` branch, add:

```js
const time = rawEventTimestampMs(event);
```

Then use the normalized value:

```js
time,
timeLabel: timestampLabel(time),
phase: phaseFor(time),
```

Do not change item event filtering, item id preservation, sorting, or any other timeline builders.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/item-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/item-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/raw-event-timestamp-tests.mjs
node test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
```

Expected GREEN:
- New item timestamp policy test passes.
- Existing raw, ward, and objective timestamp policy tests still pass.

Evidence (2026-06-09 06:17 KST):
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/item-timeline-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/item-timeline-timestamp-policy-tests.mjs`: `8 passed, 0 failed`.
- `node test-artifacts/server/raw-event-timestamp-tests.mjs`: `15 passed, 0 failed`.
- `node test-artifacts/server/ward-timeline-timestamp-policy-tests.mjs`: `10 passed, 0 failed`.
- `node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`: `8 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/item-timeline-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence (2026-06-09 06:17 KST):
- `npm test`: `1805 passed, 0 failed across 60 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/item-timeline-timestamp-policy-local npm run smoke:report:readonly`: smoke `156 passed, 0 failed`, QA verdict `passed`, required checks `13/13`, duration `579 ms`.
- Local smoke artifact sensitive scan: no high-risk sensitive patterns found.
- `git diff --check` exited 0.

- [x] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-item-timeline-timestamp-policy.md server.js test-artifacts/server/item-timeline-timestamp-policy-tests.mjs
git commit -m "test: guard item timeline timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

Evidence (2026-06-09 06:19 KST):
- Implementation commit: `cbb8791521e5ccf15a0c1d83fe480cfad7b620e0` (`test: guard item timeline timestamps`).
- Push target: `origin/main`.
- GitHub QA run: `27167589443`, conclusion `success`.
- GitHub artifact: `qa-automation-27167589443`, id `7492657328`, size `3547` bytes.
- Artifact `qa-summary.json`: QA verdict `passed`, required checks `13/13`, smoke `156 passed, 0 failed`, duration `225 ms`, git dirty `false`, short SHA `cbb8791`.
- GitHub artifact sensitive scan: no high-risk sensitive patterns found.

## Self-Review

- Spec coverage: The plan covers item purchase timestamp normalization, participant filtering stability, item id preservation, regression tests, local QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `buildItemTimeline(timeline, targetParticipantId)` and `rawEventTimestampMs(event)` names exactly as defined in `server.js`.
