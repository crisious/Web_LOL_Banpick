# Raw Event Timestamp Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize Riot raw timeline event timestamps through one shared helper before timeline event extraction.

**Architecture:** Add `rawEventTimestampMs(event)` near the timeline phase helpers. Update `extractTimelineEvents()` to use it when building the raw event object so invalid, missing, infinite, string, or negative timestamp values become `0` before phase, label, dedupe, and output fields consume them.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Create: `test-artifacts/server/raw-event-timestamp-tests.mjs` - behavior and source-shape tests for raw timestamp normalization in `extractTimelineEvents()`.
- Modify: `server.js` - add `rawEventTimestampMs()` and use it in raw timeline event construction.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` - append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-raw-event-timestamp-helper.md` - mark steps complete and add evidence after each stage.

### Task 1: Add RED Coverage For Raw Event Timestamp Normalization

**Files:**
- Create: `test-artifacts/server/raw-event-timestamp-tests.mjs`

- [x] **Step 1: Create source-extraction regression test**

Create `test-artifacts/server/raw-event-timestamp-tests.mjs` with:

```js
// server.js raw event timestamp helper regression tests

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

function extractConstSource(source, name) {
  const m = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[0];
}

const timelineTypePolicySources = [
  extractConstSource(serverSrc, "RAW_CHAMPION_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "RAW_ELITE_MONSTER_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "RAW_BUILDING_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "SUPPORTED_RAW_TIMELINE_EVENT_TYPES"),
  extractFunctionSource(serverSrc, "isRawChampionKillEvent"),
  extractFunctionSource(serverSrc, "isRawEliteMonsterKillEvent"),
  extractFunctionSource(serverSrc, "isRawBuildingKillEvent"),
  extractFunctionSource(serverSrc, "isSupportedRawTimelineEvent"),
  extractFunctionSource(serverSrc, "rawAssistingParticipantIds"),
  extractFunctionSource(serverSrc, "isRawPlayerInvolved"),
];

const eventTypePolicySources = [
  extractConstSource(serverSrc, "ELITE_OBJECTIVE_FIGHT_EVENT_TYPES"),
  extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
  extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
  extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
  extractFunctionSource(serverSrc, "isEliteObjectiveFightEventType"),
  extractFunctionSource(serverSrc, "isStructureTakeEventType"),
  extractFunctionSource(serverSrc, "isPlayerKillEventType"),
  extractFunctionSource(serverSrc, "isPlayerDeathEventType"),
  extractFunctionSource(serverSrc, "isFightContributionEventType"),
];

const rawTimestampSource = serverSrc.includes("function rawEventTimestampMs(event)")
  ? extractFunctionSource(serverSrc, "rawEventTimestampMs")
  : "function rawEventTimestampMs(event) { return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0; }";

const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const { rawEventTimestampMs, extractTimelineEvents } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "participantTeam"),
    extractFunctionSource(serverSrc, "phaseFor"),
    rawTimestampSource,
    ...timelineTypePolicySources,
    ...eventTypePolicySources,
    extractFunctionSource(serverSrc, "laneHintForEvent"),
    extractFunctionSource(serverSrc, "importanceForEvent"),
    extractFunctionSource(serverSrc, "summaryForEvent"),
    extractFunctionSource(serverSrc, "buildEventType"),
    extractFunctionSource(serverSrc, "shouldKeepEvent"),
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    "return { rawEventTimestampMs, extractTimelineEvents };",
  ].join("\n"),
)();

let pass = 0, fail = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

check("rawEventTimestampMs keeps finite non-negative numbers", rawEventTimestampMs({ timestamp: 120000 }), 120000);
check("rawEventTimestampMs maps missing timestamp to 0", rawEventTimestampMs({}), 0);
check("rawEventTimestampMs maps string timestamp to 0", rawEventTimestampMs({ timestamp: "120000" }), 0);
check("rawEventTimestampMs maps negative timestamp to 0", rawEventTimestampMs({ timestamp: -1 }), 0);
check("rawEventTimestampMs maps Infinity to 0", rawEventTimestampMs({ timestamp: Infinity }), 0);
check("rawEventTimestampMs maps NaN to 0", rawEventTimestampMs({ timestamp: NaN }), 0);

const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "CHAMPION_KILL", timestamp: "abc", killerId: 2, victimId: 7 },
          { type: "CHAMPION_KILL", timestamp: -100, killerId: 2, victimId: 8 },
          { type: "CHAMPION_KILL", timestamp: Infinity, killerId: 2, victimId: 9 },
          { type: "CHAMPION_KILL", timestamp: 120000, killerId: 2, victimId: 10 },
        ],
      },
    ],
  },
};

const events = extractTimelineEvents({}, timeline, 2, 100);
check("extractTimelineEvents keeps four timestamp test events", events.length, 4);
check("string timestamp normalizes to output 0", {
  timestampMs: events[0].timestampMs,
  timestampLabel: events[0].timestampLabel,
  phase: events[0].phase,
}, { timestampMs: 0, timestampLabel: "0:00", phase: "EARLY" });
check("negative timestamp normalizes to output 0", {
  timestampMs: events[1].timestampMs,
  timestampLabel: events[1].timestampLabel,
  phase: events[1].phase,
}, { timestampMs: 0, timestampLabel: "0:00", phase: "EARLY" });
check("infinite timestamp normalizes to output 0", {
  timestampMs: events[2].timestampMs,
  timestampLabel: events[2].timestampLabel,
  phase: events[2].phase,
}, { timestampMs: 0, timestampLabel: "0:00", phase: "EARLY" });
check("valid timestamp is preserved", {
  timestampMs: events[3].timestampMs,
  timestampLabel: events[3].timestampLabel,
  phase: events[3].phase,
}, { timestampMs: 120000, timestampLabel: "2:00", phase: "EARLY" });

checkTrue(
  "server defines rawEventTimestampMs",
  serverSrc.includes("function rawEventTimestampMs(event)"),
);
checkTrue(
  "rawEventTimestampMs guards with Number.isFinite and non-negative check",
  serverSrc.includes("Number.isFinite(event.timestamp)") &&
    serverSrc.includes("event.timestamp >= 0"),
);
checkTrue(
  "extractTimelineEvents uses rawEventTimestampMs",
  extractTimelineEventsSrc.includes("timestamp: rawEventTimestampMs(event),"),
);
checkTrue(
  "extractTimelineEvents no longer uses timestamp fallback expression",
  !extractTimelineEventsSrc.includes("timestamp: event.timestamp || 0"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run RED test**

Run:

```bash
node test-artifacts/server/raw-event-timestamp-tests.mjs
```

Expected:
- Exits 1.
- Direct `rawEventTimestampMs()` fallback checks pass.
- Current `extractTimelineEvents()` still lets string, negative, and infinite timestamps flow into `timestampMs`, `timestampLabel`, and `phase`, and source-shape checks fail because production does not define or use the helper.

Evidence:
- `node test-artifacts/server/raw-event-timestamp-tests.mjs` exited 1 before production changes.
- RED output: `8 passed, 7 failed`.
- Intended failures covered string timestamp -> `NaN:NaN`, negative timestamp -> `-1:-1`, infinite timestamp -> `Infinity:NaN`, plus missing helper/source-shape checks.

### Task 2: Implement Raw Event Timestamp Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add helper after `phaseFor(timestampMs)`**

Add:

```js
function rawEventTimestampMs(event) {
  return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0;
}
```

- [x] **Step 2: Update `extractTimelineEvents()` raw event construction**

Replace:

```js
timestamp: event.timestamp || 0,
```

with:

```js
timestamp: rawEventTimestampMs(event),
```

- [x] **Step 3: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/raw-event-timestamp-tests.mjs
```

Expected:
- Exits 0.
- Reports `15 passed, 0 failed`.

Evidence:
- `node test-artifacts/server/raw-event-timestamp-tests.mjs` exited 0 after production changes.
- GREEN output: `15 passed, 0 failed`.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-raw-event-timestamp-helper.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/raw-event-timestamp-tests.mjs
node test-artifacts/server/raw-event-timestamp-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-event-timestamp-helper-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `node --check` commands exit 0.
- Focused test exits 0.
- `npm test` exits 0.
- Read-only smoke report exits 0.
- `git diff --check` exits 0.

Evidence:
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/raw-event-timestamp-tests.mjs` exited 0.
- `node test-artifacts/server/raw-event-timestamp-tests.mjs`: `15 passed, 0 failed`.
- `npm test`: `1631 passed, 0 failed across 48 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-event-timestamp-helper-local npm run smoke:report:readonly` exited 0.
- Local smoke summary: `latestRun.qaVerdict.status: "passed"`, required checks total 13 / passed 13 / failed 0 / missing 0, smoke 156 passed / 0 failed, `durationMs: 229`, mode `readonly`.
- Local smoke artifact high-risk sensitive pattern scan: no matches.
- `git diff --check` exited 0.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with RED/GREEN evidence, `npm test`, local smoke summary, implementation commit SHA, GitHub Actions run id, artifact id, sensitive scan result, docs completion commit SHA, final docs GitHub Actions run id, and final `main...origin/main` sync count.

Evidence:
- Added the `2026-06-09 04:01 KST - Raw event timestamp helper 공유` entry with RED/GREEN and local QA evidence.
- Commit SHA, GitHub Actions run id, artifact id, and final sync evidence remain pending until push and CI verification complete.

- [x] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/raw-event-timestamp-tests.mjs docs/superpowers/plans/2026-06-09-raw-event-timestamp-helper.md
git diff --cached --check
git commit -m "test: share raw event timestamp helper"
git push origin main
```

Expected: commit and push succeed on `main`.

Evidence:
- Implementation commit `5d223c9` (`test: share raw event timestamp helper`) was pushed to `origin/main`.

- [x] **Step 4: Verify GitHub QA**

Run:

```bash
gh run list --workflow QA --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/github-qa-<run-id>
```

Expected: QA run for the pushed commit passes, artifact summary reports smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, dirty `false`, and no high-risk sensitive-value scan matches.

Evidence:
- GitHub Actions QA run `27160366298` passed for head SHA `5d223c98ab8b637d73302c7010eb914fbf6b9d64`.
- Workflow artifact `7489775296` (`qa-automation-27160366298`, 3551 bytes) was downloaded and inspected.
- Artifact `qa-summary.json`: `latestRun.qaVerdict.status: "passed"`, smoke 156 passed / 0 failed, required checks total 13 / passed 13 / failed 0 / missing 0, `durationMs: 201`, `latestRun.git.shortSha: "5d223c9"`, `dirty: false`.
- GitHub artifact high-risk sensitive pattern scan: no matches.

- [ ] **Step 5: Mark plan complete and final sync**

Update this plan with implementation and docs completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-raw-event-timestamp-helper.md
git diff --cached --check
git commit -m "docs: finalize raw event timestamp plan"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers raw timestamp normalization before phase, timestamp label, dedupe, and normalized timeline output consume the value.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `rawEventTimestampMs(event)` accepts raw Riot event objects and returns a non-negative finite millisecond number.
