# Phase Summary Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed timeline event timestamps before building phase context counters and phase summaries.

**Architecture:** `buildPhaseContext()` and `buildPhaseSummaries()` currently trust each normalized event's `phase` field. Reuse `rawEventTimestampMs()` and `phaseFor()` so phase counters and summary objective counts derive from the event timestamp, matching the timestamp policy now used by KDA, key moments, evidence index, LLM payload, and teamfight context.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helper extraction, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Phase Context And Summary Timestamp Guard

**Files:**
- Create: `test-artifacts/server/phase-summary-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/server/timeline-consumer-tests.mjs`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/phase-summary-timestamp-policy-tests.mjs` with direct `buildPhaseContext()` and `buildPhaseSummaries()` checks:

```js
check("phaseContext buckets by normalized timestamp", phaseCounts(phaseContext), {
  early: { kills: 1, deaths: 1, assists: 0, notableEventCount: 2 },
  mid: { kills: 0, deaths: 0, assists: 1, notableEventCount: 3 },
  late: { kills: 0, deaths: 0, assists: 0, notableEventCount: 1 },
});
check("phase summaries count mid objectives by normalized phase", pickSummary(summaries, "MID"), {
  phase: "MID",
  rating: "GOOD",
  summary: "중반에는 오브젝트나 한타 후속 합류가 살아 있어 경기 핵심 구도를 주도했다.",
});
check("phase summaries keep late loss summary with normalized late fail", pickSummary(summaries, "LATE"), {
  phase: "LATE",
  rating: "NEUTRAL",
  summary: "후반에는 교전 영향력은 있었지만 마지막 수비 구도를 지키지 못했다.",
});
```

Add source-shape checks:

```js
checkTrue("buildPhaseContext normalizes event timestamp", buildPhaseContextSrc.includes("const time = rawEventTimestampMs({ timestamp: event.timestampMs });"));
checkTrue("buildPhaseContext derives phase from normalized time", buildPhaseContextSrc.includes("const phase = phaseFor(time);"));
checkTrue("buildPhaseContext no longer buckets by event.phase", !buildPhaseContextSrc.includes("const bucket = phases[event.phase];"));
checkTrue("buildPhaseSummaries derives phase groups from normalized time", buildPhaseSummariesSrc.includes("phaseFor(rawEventTimestampMs({ timestamp: event.timestampMs })) === phaseKey"));
checkTrue("buildPhaseSummaries no longer filters by event.phase", !buildPhaseSummariesSrc.includes('event.phase === "EARLY"') && !buildPhaseSummariesSrc.includes('event.phase === "MID"') && !buildPhaseSummariesSrc.includes('event.phase === "LATE"'));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/phase-summary-timestamp-policy-tests.mjs
node test-artifacts/server/phase-summary-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `buildPhaseContext()` and `buildPhaseSummaries()` currently bucket by stale `event.phase`.

Evidence, 2026-06-09 07:25 KST:
- `node --check test-artifacts/server/phase-summary-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/phase-summary-timestamp-policy-tests.mjs` exited 1 with `2 passed, 7 failed`.
- RED failures covered stale phase bucketing in `buildPhaseContext()`, missing MID objective summary from stale phase filters in `buildPhaseSummaries()`, and source-shape checks proving the functions still depended on `event.phase`.

- [x] **Step 3: Implement the minimal production change**

Update only phase bucketing in `buildPhaseContext()` and `buildPhaseSummaries()`:

```js
const time = rawEventTimestampMs({ timestamp: event.timestampMs });
const phase = phaseFor(time);
const bucket = phases[phase];
```

And in `buildPhaseSummaries()` use normalized phase filtering:

```js
const eventsByPhase = Object.fromEntries(
  ["EARLY", "MID", "LATE"].map((phaseKey) => [
    phaseKey,
    normalized.timelineEvents.filter((event) =>
      phaseFor(rawEventTimestampMs({ timestamp: event.timestampMs })) === phaseKey,
    ),
  ]),
);
```

Do not change kill/death/assist classification, objective win/fail event type policy, summary copy, rating rules, or phase summary array shape.

Evidence, 2026-06-09 07:28 KST:
- Updated `buildPhaseContext()` to derive `time` via `rawEventTimestampMs({ timestamp: event.timestampMs })` and bucket via `phaseFor(time)`.
- Updated `buildPhaseSummaries()` phase groups to filter events by `phaseFor(rawEventTimestampMs({ timestamp: event.timestampMs }))`.
- Updated `test-artifacts/server/timeline-consumer-tests.mjs` fixture timestamps so existing intended EARLY/MID phase assertions are represented by timestamp as well as the legacy `phase` field.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/phase-summary-timestamp-policy-tests.mjs
node --check test-artifacts/server/timeline-consumer-tests.mjs
node test-artifacts/server/phase-summary-timestamp-policy-tests.mjs
node test-artifacts/server/timeline-consumer-tests.mjs
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected GREEN:
- New phase summary timestamp policy test passes.
- Existing timeline consumer, strength/weakness, LLM payload, and schema contracts still pass.

Evidence, 2026-06-09 07:28 KST:
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/phase-summary-timestamp-policy-tests.mjs` exited 0.
- `node --check test-artifacts/server/timeline-consumer-tests.mjs` exited 0.
- `node test-artifacts/server/phase-summary-timestamp-policy-tests.mjs`: `9 passed, 0 failed`.
- `node test-artifacts/server/timeline-consumer-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/server/strength-weakness-tests.mjs`: `89 passed, 0 failed`.
- `node test-artifacts/server/llm-payload-tests.mjs`: `84 passed, 0 failed`.
- `node test-artifacts/schema/schema-tests.mjs`: `86 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summary-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence, 2026-06-09 07:30 KST:
- `npm test && git diff --check` exited 0.
- `npm test`: `1891 passed, 0 failed across 67 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summary-timestamp-policy-local npm run smoke:report:readonly` exited 0.
- Local `qa-summary.json`: `qaStatus=passed`, required checks `13/13`, smoke checks `156 passed, 0 failed`, duration `205ms`, mode `readonly`, git short SHA `6e2f4ed`, dirty `true` because this implementation was intentionally uncommitted.
- Local artifact sensitive-pattern scan found no matches for Riot/OpenAI key markers, private key headers, local absolute paths, runtime sample paths, Riot hostnames, DNS errors, or parser errors.

- [x] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summary-timestamp-policy.md server.js test-artifacts/server/timeline-consumer-tests.mjs test-artifacts/server/phase-summary-timestamp-policy-tests.mjs
git commit -m "test: guard phase summary timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

Evidence, 2026-06-09 07:32 KST:
- Staged only `docs/superpowers/plans/2026-06-09-phase-summary-timestamp-policy.md`, `server.js`, `test-artifacts/server/timeline-consumer-tests.mjs`, and `test-artifacts/server/phase-summary-timestamp-policy-tests.mjs`.
- Commit `8009928` (`test: guard phase summary timestamps`) pushed to `origin/main`.
- GitHub QA run `27171176987` completed with conclusion `success` for SHA `8009928ee141b1d11face126d5048849b980715b`.
- GitHub artifact `qa-automation-27171176987` id `7494027290`, size `3549`, digest `sha256:9c0ac7024f1f1753d79d42579dfa1ff04b2452e5c108e132caf31f83c0c687f9`.
- Downloaded artifact `qa-summary.json`: `qaStatus=passed`, required checks `13/13`, smoke checks `156 passed, 0 failed`, duration `200ms`, mode `readonly`, git short SHA `8009928`, dirty `false`.
- Downloaded artifact sensitive-pattern scan found no matches for Riot/OpenAI key markers, private key headers, local absolute paths, runtime sample paths, Riot hostnames, DNS errors, or parser errors.

## Self-Review

- Spec coverage: The plan covers malformed phase context timestamps, stale phase replacement, phase summary objective counts, focused tests, full QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `buildPhaseContext(events)`, `buildPhaseSummaries(normalized)`, `rawEventTimestampMs(event)`, and `phaseFor(timestampMs)` names exactly as defined in `server.js`.
