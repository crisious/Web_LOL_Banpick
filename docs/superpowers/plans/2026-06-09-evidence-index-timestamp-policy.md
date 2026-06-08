# Evidence Index Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed timeline event timestamps before building analysis evidence index rows.

**Architecture:** `buildEvidenceIndex()` currently copies each timeline event's `timestampLabel` and `phase` into the evidence row. Reuse the existing `rawEventTimestampMs()` policy, derive `timestamp` with `timestampLabel(time)`, and derive the phase segment of `statNote` with `phaseFor(time)` so stale or malformed timeline event display fields do not leak into evidence.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helpers, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Evidence Index Timestamp Guard

**Files:**
- Create: `test-artifacts/server/evidence-index-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/evidence-index-timestamp-policy-tests.mjs` with direct `buildEvidenceIndex()` checks:

```js
check("string evidence timestamp normalizes to display 0", timing(byId.get("evt_string")), { timestamp: "0:00", statNote: "EARLY · 중요도 5" });
check("negative evidence timestamp normalizes to display 0", timing(byId.get("evt_negative")), { timestamp: "0:00", statNote: "EARLY · 중요도 4" });
check("infinite evidence timestamp normalizes to display 0", timing(byId.get("evt_infinite")), { timestamp: "0:00", statNote: "EARLY · 중요도 4" });
check("valid evidence timestamp derives fresh label and phase", timing(byId.get("evt_valid")), { timestamp: "2:00", statNote: "EARLY · 중요도 5" });
check("low importance event stays excluded", byId.has("evt_low"), false);
check("stat summary evidence rows stay appended", evidence.slice(-2).map((item) => item.eventId), ["stat_cs", "stat_vision"]);
```

Add source-shape checks:

```js
checkTrue("buildEvidenceIndex normalizes event timestamp", buildEvidenceIndexSrc.includes("const time = rawEventTimestampMs({ timestamp: event.timestampMs });"));
checkTrue("buildEvidenceIndex derives phase from normalized time", buildEvidenceIndexSrc.includes("const phase = phaseFor(time);"));
checkTrue("buildEvidenceIndex derives timestamp label from normalized time", buildEvidenceIndexSrc.includes("timestamp: timestampLabel(time),"));
checkTrue("buildEvidenceIndex no longer copies event.timestampLabel", !buildEvidenceIndexSrc.includes("timestamp: event.timestampLabel"));
checkTrue("buildEvidenceIndex no longer copies event.phase in statNote", !buildEvidenceIndexSrc.includes("`${event.phase} · 중요도 ${event.importance}`"));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/evidence-index-timestamp-policy-tests.mjs
node test-artifacts/server/evidence-index-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `buildEvidenceIndex()` currently copies `event.timestampLabel` and `event.phase`.

Evidence, 2026-06-09 06:53 KST:
- `node --check test-artifacts/server/evidence-index-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/evidence-index-timestamp-policy-tests.mjs` exited 1 with `3 passed, 9 failed`.
- RED failures covered string, negative, Infinity, and stale valid timestamp display, plus source-shape checks proving `buildEvidenceIndex()` still copied `event.timestampLabel` and `event.phase`.

- [x] **Step 3: Implement the minimal production change**

Update only the event row mapping inside `buildEvidenceIndex()`:

```js
.map((event) => {
  const time = rawEventTimestampMs({ timestamp: event.timestampMs });
  const phase = phaseFor(time);
  return {
    eventId: event.eventId,
    timestamp: timestampLabel(time),
    eventType: event.eventType,
    summary: event.summary,
    statNote: `${phase} · 중요도 ${event.importance}`,
  };
});
```

Do not change evidence filtering, the 10-row cap, or the appended `stat_cs` / `stat_vision` summary rows.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/evidence-index-timestamp-policy-tests.mjs
node test-artifacts/server/evidence-index-timestamp-policy-tests.mjs
node test-artifacts/server/key-moment-timestamp-policy-tests.mjs
node test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected GREEN:
- New evidence index timestamp policy test passes.
- Existing key moment, KDA timestamp, and schema contracts still pass.

Evidence, 2026-06-09 06:54 KST:
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/evidence-index-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/evidence-index-timestamp-policy-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/server/key-moment-timestamp-policy-tests.mjs`: `11 passed, 0 failed`.
- `node test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/schema/schema-tests.mjs`: `86 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/evidence-index-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence, 2026-06-09 06:57 KST:
- `npm test`: `1851 passed, 0 failed across 64 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/evidence-index-timestamp-policy-local npm run smoke:report:readonly` exited 0.
- Local read-only smoke summary: QA `passed`, required checks `13/13`, smoke checks `156 passed, 0 failed`, duration `336ms`, mode `readonly`, dirty `true`.
- Local smoke report directory: `test-artifacts/tmp/evidence-index-timestamp-policy-local/2026-06-08T21-57-07Z-readonly`.
- Local high-risk sensitive pattern scan over `test-artifacts/tmp/evidence-index-timestamp-policy-local` returned no matches.
- `git diff --check` exited 0.

- [ ] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-evidence-index-timestamp-policy.md server.js test-artifacts/server/evidence-index-timestamp-policy-tests.mjs
git commit -m "test: guard evidence index timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers malformed evidence index timestamps, stale phase replacement, low-importance filtering preservation, stat summary row preservation, focused tests, full QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `buildEvidenceIndex(normalized)`, `rawEventTimestampMs(event)`, `timestampLabel(milliseconds)`, and `phaseFor(timestampMs)` names exactly as defined in `server.js`.
