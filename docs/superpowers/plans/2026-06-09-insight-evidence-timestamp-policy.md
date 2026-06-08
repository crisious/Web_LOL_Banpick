# Insight Evidence Timestamp Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize malformed timeline event timestamps before rendering rule-based strength/weakness evidence strings.

**Architecture:** `buildStrengths()` and `buildWeaknesses()` currently build user-facing evidence text by copying `event.timestampLabel`. Add a small shared helper that formats labels from `rawEventTimestampMs({ timestamp: event.timestampMs })`, then use it in strength objective/fight/tower evidence and weakness early/post-objective/fallback evidence. This matches the timestamp policy now used by key moments, evidence index, LLM payload, teamfights, phase summaries, and derived signals.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helper extraction, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Strength And Weakness Evidence Timestamp Guard

**Files:**
- Create: `test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs` with direct `buildStrengths()` and `buildWeaknesses()` checks:

```js
check("strength objective evidence derives labels from normalized timestamp", strengthsWithObjectives[0].evidence, "0:00 DRAGON_FIGHT, 2:00 BARON_FIGHT");
check("strength fight evidence derives labels from normalized timestamp", strengthsWithObjectives[1].evidence, "0:00 kill 2:00 follow 3:00 skirmish");
check("strength tower evidence derives labels from normalized timestamp", towerStrengths[0].evidence, "0:00 bot, 31:40 mid");
check("weakness early evidence derives labels from normalized timestamp", earlyWeaknesses[0].evidence, "0:00 bad death 0:50 early death");
check("weakness post-objective evidence derives labels from normalized timestamp", postObjectiveWeaknesses[0].evidence, "2:30 post death");
check("weakness fallback evidence derives labels from normalized timestamp", fallbackWeaknesses[0].evidence, "0:00 failed setup 31:40 late fail");
```

Add source-shape checks:

```js
checkTrue("server defines timelineEventTimestampLabel helper", serverSrc.includes("function timelineEventTimestampLabel(event)"));
checkTrue("timelineEventTimestampLabel uses normalized event timestamp", serverSrc.includes("return timestampLabel(rawEventTimestampMs({ timestamp: event.timestampMs }));"));
checkTrue("buildStrengths evidence uses timelineEventTimestampLabel", buildStrengthsSrc.includes("timelineEventTimestampLabel(event)"));
checkTrue("buildWeaknesses evidence uses timelineEventTimestampLabel", buildWeaknessesSrc.includes("timelineEventTimestampLabel(event)"));
checkTrue("buildStrengths no longer copies event.timestampLabel", !buildStrengthsSrc.includes("event.timestampLabel"));
checkTrue("buildWeaknesses no longer copies event.timestampLabel", !buildWeaknessesSrc.includes("event.timestampLabel"));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs
node test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `buildStrengths()` and `buildWeaknesses()` still copy stale `event.timestampLabel` into evidence strings and no shared normalized evidence-label helper exists.

Evidence, 2026-06-09 07:49 KST:
- `node --check test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs` exited 0.
- `node test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs` exited 1 with `0 passed, 12 failed`.
- RED failures covered stale labels in strength objective/fight/tower evidence, weakness early/post-objective/fallback evidence, missing `timelineEventTimestampLabel()` helper, and source-shape checks proving both insight builders still copied `event.timestampLabel`.

- [x] **Step 3: Implement the minimal production change**

Add a helper near `rawEventTimestampMs()`:

```js
function timelineEventTimestampLabel(event) {
  return timestampLabel(rawEventTimestampMs({ timestamp: event.timestampMs }));
}
```

Update only evidence string construction in `buildStrengths()` and `buildWeaknesses()`:

```js
`${timelineEventTimestampLabel(event)} ${event.eventType}`
`${timelineEventTimestampLabel(event)} ${event.summary}`
`${timelineEventTimestampLabel(event)} ${event.laneHint}`
```

Do not change insight ordering, titles, descriptions, impact copy, related event IDs, thresholds, padding behavior, or returned array shape.

Evidence, 2026-06-09 07:51 KST:
- Added `timelineEventTimestampLabel(event)` near `rawEventTimestampMs()` to format event labels from normalized `event.timestampMs`.
- Updated `buildStrengths()` evidence generation for objective, fight, and tower fallback rows to use `timelineEventTimestampLabel(event)`.
- Updated `buildWeaknesses()` evidence generation for early-death, post-objective death, and fallback rows to use `timelineEventTimestampLabel(event)`.
- Updated `test-artifacts/server/strength-weakness-tests.mjs` extraction harness with `timestampLabel()` and `timelineEventTimestampLabel()` dependencies.
- Updated `test-artifacts/server/derived-signals-timestamp-policy-tests.mjs` extraction harness with `timestampLabel()` and `timelineEventTimestampLabel()` after the new helper became a `buildWeaknesses()` dependency.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs
node --check test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/derived-signals-timestamp-policy-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected GREEN:
- New insight evidence timestamp policy test passes.
- Existing strength/weakness, derived signals, LLM payload, and schema contracts still pass.

Evidence, 2026-06-09 07:52 KST:
- `node --check server.js && node --check test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs && node --check test-artifacts/server/strength-weakness-tests.mjs` exited 0.
- `node test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs`: `12 passed, 0 failed`.
- `node test-artifacts/server/strength-weakness-tests.mjs`: `89 passed, 0 failed`.
- `node --check test-artifacts/server/derived-signals-timestamp-policy-tests.mjs && node test-artifacts/server/derived-signals-timestamp-policy-tests.mjs`: `9 passed, 0 failed`.
- `node test-artifacts/server/llm-payload-tests.mjs`: `84 passed, 0 failed`.
- `node test-artifacts/schema/schema-tests.mjs`: `86 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-evidence-timestamp-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence, 2026-06-09 07:53 KST:
- `npm test && git diff --check` exited 0.
- `npm test`: `1912 passed, 0 failed across 69 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-evidence-timestamp-policy-local npm run smoke:report:readonly` exited 0.
- Local `qa-summary.json`: `qaStatus=passed`, required checks `13/13`, smoke checks `156 passed, 0 failed`, duration `194ms`, mode `readonly`, git short SHA `81943de`, dirty `true` because this implementation was intentionally uncommitted.
- Local artifact sensitive-pattern scan found no matches for Riot/OpenAI key markers, private key headers, local absolute paths, runtime sample paths, Riot hostnames, DNS errors, or parser errors.

- [ ] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-insight-evidence-timestamp-policy.md server.js test-artifacts/server/strength-weakness-tests.mjs test-artifacts/server/insight-evidence-timestamp-policy-tests.mjs
git commit -m "test: guard insight evidence timestamps"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers user-facing strength and weakness evidence timestamps, stale label replacement, helper introduction, focused tests, full QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `buildStrengths(normalized)`, `buildWeaknesses(normalized)`, `rawEventTimestampMs(event)`, and `timestampLabel(milliseconds)` names exactly as defined in `server.js`.
