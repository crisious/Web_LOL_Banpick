# LLM Payload Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed timeline event timestamps before sending `timelineEvents` to AI prompt payloads.

**Architecture:** `buildLlmPayload()` currently sorts selected timeline events by raw `timestampMs` and copies `timestampLabel` / `phase` into the AI payload. Reuse `rawEventTimestampMs()`, `timestampLabel()`, and `phaseFor()` so AI context receives the same safe display fields as key moments, KDA timeline, and evidence index.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helper extraction, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: LLM Payload Timeline Timestamp Guard

**Files:**
- Create: `test-artifacts/server/llm-payload-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/server/llm-payload-tests.mjs`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/llm-payload-timestamp-policy-tests.mjs` with direct `buildLlmPayload()` checks:

```js
check("timeline events sort by normalized timestamp", byOrder, ["evt_string", "evt_negative", "evt_infinite", "evt_valid"]);
check("string LLM timestamp normalizes to display 0", timing(byId.get("evt_string")), { timestampLabel: "0:00", phase: "EARLY" });
check("negative LLM timestamp normalizes to display 0", timing(byId.get("evt_negative")), { timestampLabel: "0:00", phase: "EARLY" });
check("infinite LLM timestamp normalizes to display 0", timing(byId.get("evt_infinite")), { timestampLabel: "0:00", phase: "EARLY" });
check("valid LLM timestamp derives fresh label and phase", timing(byId.get("evt_valid")), { timestampLabel: "2:00", phase: "EARLY" });
check("LLM timeline event keys stay stable", Object.keys(byId.get("evt_valid")).sort(), ["eventId", "eventType", "importance", "isPlayerInvolved", "phase", "summary", "timestampLabel"]);
```

Add source-shape checks:

```js
checkTrue("buildLlmPayload normalizes sort timestamp", buildLlmPayloadSrc.includes("rawEventTimestampMs({ timestamp: a.timestampMs })"));
checkTrue("buildLlmPayload normalizes map timestamp", buildLlmPayloadSrc.includes("const time = rawEventTimestampMs({ timestamp: event.timestampMs });"));
checkTrue("buildLlmPayload derives timestampLabel from normalized time", buildLlmPayloadSrc.includes("timestampLabel: timestampLabel(time),"));
checkTrue("buildLlmPayload derives phase from normalized time", buildLlmPayloadSrc.includes("phase: phaseFor(time),"));
checkTrue("buildLlmPayload no longer destructures stale timestamp fields", !buildLlmPayloadSrc.includes("map(({ eventId, timestampLabel, phase, eventType, importance, summary, isPlayerInvolved })"));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/llm-payload-timestamp-policy-tests.mjs
node test-artifacts/server/llm-payload-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `buildLlmPayload()` currently sorts by raw `timestampMs` and copies stale `timestampLabel` / `phase`.

Evidence, 2026-06-09 07:04 KST:
- `node --check test-artifacts/server/llm-payload-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/llm-payload-timestamp-policy-tests.mjs` exited 1 with `2 passed, 10 failed`.
- RED failures covered raw timestamp sorting, string/negative/Infinity display normalization, stale valid timestamp label/phase copying, and source-shape checks proving `buildLlmPayload()` still destructured `timestampLabel` / `phase` directly.

- [x] **Step 3: Implement the minimal production change**

Update only the timeline event sorting and mapping inside `buildLlmPayload()`:

```js
.sort((a, b) => {
  const aTime = rawEventTimestampMs({ timestamp: a.timestampMs });
  const bTime = rawEventTimestampMs({ timestamp: b.timestampMs });
  return aTime - bTime;
})
.map((event) => {
  const time = rawEventTimestampMs({ timestamp: event.timestampMs });
  return {
    eventId: event.eventId,
    timestampLabel: timestampLabel(time),
    phase: phaseFor(time),
    eventType: event.eventType,
    importance: event.importance,
    summary: event.summary,
    isPlayerInvolved: event.isPlayerInvolved,
  };
});
```

Do not change the importance filter, the 15-event cap, `combatEncounters`, `teamfightPhases`, or output contract fields.

Evidence, 2026-06-09 07:07 KST:
- Updated only the `filteredEvents` timestamp sort and event mapping in `buildLlmPayload()`.
- Updated `test-artifacts/server/llm-payload-tests.mjs` function-extraction harness to include `timestampLabel()`, `phaseFor()`, and `rawEventTimestampMs()` because `buildLlmPayload()` now depends on the shared timestamp policy.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/llm-payload-timestamp-policy-tests.mjs
node test-artifacts/server/llm-payload-timestamp-policy-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/server/evidence-index-timestamp-policy-tests.mjs
node test-artifacts/server/key-moment-timestamp-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected GREEN:
- New LLM payload timestamp policy test passes.
- Existing LLM payload, evidence index, key moment, and schema contracts still pass.

Evidence, 2026-06-09 07:07 KST:
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/llm-payload-timestamp-policy-tests.mjs` exited 0.
- `node --check test-artifacts/server/llm-payload-tests.mjs` exited 0.
- `node test-artifacts/server/llm-payload-timestamp-policy-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/server/llm-payload-tests.mjs`: `84 passed, 0 failed`.
- `node test-artifacts/server/evidence-index-timestamp-policy-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/server/key-moment-timestamp-policy-tests.mjs`: `11 passed, 0 failed`.
- `node test-artifacts/server/kda-timeline-timestamp-policy-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/schema/schema-tests.mjs`: `86 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/llm-payload-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence, 2026-06-09 07:08 KST:
- `npm test`: `1863 passed, 0 failed across 65 test file(s)`.
- `git diff --check` exited 0.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/llm-payload-timestamp-policy-local npm run smoke:report:readonly` exited 0.
- Local read-only smoke summary: QA `passed`, required checks `13/13`, smoke checks `156 passed, 0 failed`, duration `225ms`, mode `readonly`, dirty `true`.
- Local smoke report directory: `test-artifacts/tmp/llm-payload-timestamp-policy-local/2026-06-08T22-08-11Z-readonly`.
- Local high-risk sensitive pattern scan over `test-artifacts/tmp/llm-payload-timestamp-policy-local` returned no matches.

- [ ] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-llm-payload-timestamp-policy.md server.js test-artifacts/server/llm-payload-timestamp-policy-tests.mjs
git add test-artifacts/server/llm-payload-tests.mjs
git commit -m "test: guard llm payload timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers malformed LLM payload timeline timestamps, stale phase replacement, normalized sorting, output field stability, focused tests, full QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `buildLlmPayload(normalized)`, `rawEventTimestampMs(event)`, `timestampLabel(milliseconds)`, and `phaseFor(timestampMs)` names exactly as defined in `server.js`.
