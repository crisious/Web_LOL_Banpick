# Key Moment Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed timeline event timestamps before building key moment cards.

**Architecture:** `buildKeyMoments()` currently sorts by raw `event.timestampMs` and copies `event.timestampLabel` / `event.phase` directly into the returned key moment. Reuse the same `rawEventTimestampMs()` policy used by extracted, objective, ward, item, and KDA timelines, then derive key moment `timestamp` and `phase` from the normalized time.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helpers, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Key Moment Timestamp Guard

**Files:**
- Create: `test-artifacts/server/key-moment-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/key-moment-timestamp-policy-tests.mjs` with direct `buildKeyMoments()` checks:

```js
check("key moments sort by normalized timestamp", keyMoments.map((moment) => moment.eventId), ["evt_string", "evt_negative", "evt_infinite", "evt_valid"]);
check("string key moment timestamp normalizes to display 0", timing(byId.get("evt_string")), { timestamp: "0:00", phase: "EARLY" });
check("negative key moment timestamp normalizes to display 0", timing(byId.get("evt_negative")), { timestamp: "0:00", phase: "EARLY" });
check("infinite key moment timestamp normalizes to display 0", timing(byId.get("evt_infinite")), { timestamp: "0:00", phase: "EARLY" });
check("valid key moment timestamp derives fresh label and phase", timing(byId.get("evt_valid")), { timestamp: "2:00", phase: "EARLY" });
```

Add source-shape checks:

```js
checkTrue("buildKeyMoments normalizes sort timestamps", buildKeyMomentsSrc.includes("rawEventTimestampMs({ timestamp: a.timestampMs })"));
checkTrue("buildKeyMoments derives timestamp label from normalized time", buildKeyMomentsSrc.includes("timestamp: timestampLabel(time),"));
checkTrue("buildKeyMoments derives phase from normalized time", buildKeyMomentsSrc.includes("phase: phaseFor(time),"));
checkTrue("buildKeyMoments no longer copies event.timestampLabel", !buildKeyMomentsSrc.includes("timestamp: event.timestampLabel"));
checkTrue("buildKeyMoments no longer copies event.phase", !buildKeyMomentsSrc.includes("phase: event.phase"));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/key-moment-timestamp-policy-tests.mjs
node test-artifacts/server/key-moment-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `buildKeyMoments()` currently sorts by raw `timestampMs` and copies stale `timestampLabel` / `phase`.

Evidence, 2026-06-09 06:45 KST:
- `node --check test-artifacts/server/key-moment-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/key-moment-timestamp-policy-tests.mjs` exited 1 with `1 passed, 10 failed`.
- RED failures covered raw timestamp sorting, string/negative/Infinity timestamp display, stale valid timestamp label/phase copying, and source-shape checks proving `buildKeyMoments()` still copied `event.timestampLabel` and `event.phase`.

- [x] **Step 3: Implement the minimal production change**

Update `buildKeyMoments()`:

```js
function buildKeyMoments(normalized) {
  return normalized.timelineEvents
    .slice()
    .sort((a, b) => {
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      const aTime = rawEventTimestampMs({ timestamp: a.timestampMs });
      const bTime = rawEventTimestampMs({ timestamp: b.timestampMs });
      return aTime - bTime;
    })
    .slice(0, 7)
    .sort((a, b) => {
      const aTime = rawEventTimestampMs({ timestamp: a.timestampMs });
      const bTime = rawEventTimestampMs({ timestamp: b.timestampMs });
      return aTime - bTime;
    })
    .map((event) => {
      const time = rawEventTimestampMs({ timestamp: event.timestampMs });
      return {
        eventId: event.eventId,
        timestamp: timestampLabel(time),
        phase: phaseFor(time),
        label: labelForMoment(event),
        reason: event.summary,
        impact: impactForMoment(event, normalized.matchInfo.result),
        importance: event.importance,
        relatedEventIds: [event.eventId],
      };
    });
}
```

Do not change key moment labels, impact text, importance selection count, or related event ids.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/key-moment-timestamp-policy-tests.mjs
node test-artifacts/server/key-moment-timestamp-policy-tests.mjs
node test-artifacts/server/key-moment-tests.mjs
node test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected GREEN:
- New key moment timestamp policy test passes.
- Existing key moment impact, KDA timestamp, and schema contracts still pass.

Evidence, 2026-06-09 06:46 KST:
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/key-moment-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/key-moment-timestamp-policy-tests.mjs`: `11 passed, 0 failed`.
- `node test-artifacts/server/key-moment-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/schema/schema-tests.mjs`: `86 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moment-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence, 2026-06-09 06:48 KST:
- `npm test` exited 0 with `1839 passed, 0 failed across 63 test file(s)`.
- `git diff --check` exited 0.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moment-timestamp-policy-local npm run smoke:report:readonly` exited 0.
- Local read-only smoke summary: QA verdict `passed`, required checks `13/13`, smoke `156 passed, 0 failed`, duration `575ms`.
- Local smoke artifact sensitive scan found no high-risk sensitive patterns.

- [ ] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-key-moment-timestamp-policy.md server.js test-artifacts/server/key-moment-timestamp-policy-tests.mjs
git commit -m "test: guard key moment timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers malformed key moment timestamps, stale label/phase replacement, normalized sorting, focused tests, full QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `buildKeyMoments(normalized)`, `rawEventTimestampMs(event)`, `timestampLabel(milliseconds)`, `phaseFor(timestampMs)`, `labelForMoment(event)`, and `impactForMoment(event, result)` names exactly as defined in `server.js`.
