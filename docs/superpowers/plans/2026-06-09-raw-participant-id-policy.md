# Raw Participant Id Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize raw timeline `killerId` and `victimId` values so only numeric integer Riot participant ids from `1` through `10` enter event extraction.

**Architecture:** Add `rawParticipantId(value)` near the raw timeline value helpers. Use it when `extractTimelineEvents()` builds `rawEvent.killerId` and `rawEvent.victimId`, preventing malformed strings, fractional ids, out-of-range ids, and infinite values from influencing player involvement or objective ownership calculations.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Create: `test-artifacts/server/raw-participant-id-policy-tests.mjs` - behavior and source-shape tests for raw participant id normalization in timeline extraction.
- Modify: `server.js` - add `rawParticipantId()` and use it for `killerId` / `victimId` raw event fields.
- Modify: `test-artifacts/server/raw-event-timestamp-tests.mjs` - include `rawParticipantId()` in the `extractTimelineEvents()` source-extraction harness.
- Modify: `test-artifacts/server/raw-building-team-policy-tests.mjs` - include `rawParticipantId()` in the `extractTimelineEvents()` source-extraction harness.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` - append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-raw-participant-id-policy.md` - mark steps complete and add evidence after each stage.

### Task 1: Add RED Coverage For Raw Participant Id Normalization

**Files:**
- Create: `test-artifacts/server/raw-participant-id-policy-tests.mjs`

- [x] **Step 1: Create source-extraction regression test**

Create `test-artifacts/server/raw-participant-id-policy-tests.mjs` with:

```js
// server.js raw participant id policy regression tests

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

function functionSourceOrFallback(source, name, fallback) {
  return source.includes(`function ${name}(`)
    ? extractFunctionSource(source, name)
    : fallback;
}

const rawParticipantSource = functionSourceOrFallback(
  serverSrc,
  "rawParticipantId",
  "function rawParticipantId(value) { return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null; }",
);

const rawTimestampSource = functionSourceOrFallback(
  serverSrc,
  "rawEventTimestampMs",
  "function rawEventTimestampMs(event) { return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0; }",
);

const rawTimelinePolicySources = [
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
  functionSourceOrFallback(
    serverSrc,
    "isKnownRawTeamId",
    "function isKnownRawTeamId(teamId) { return teamId === 100 || teamId === 200; }",
  ),
  functionSourceOrFallback(
    serverSrc,
    "isRawEnemyBuildingKill",
    "function isRawEnemyBuildingKill(rawEvent, targetTeamId) { return isKnownRawTeamId(rawEvent.teamId) && rawEvent.teamId !== targetTeamId; }",
  ),
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

const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const { rawParticipantId, extractTimelineEvents } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "participantTeam"),
    extractFunctionSource(serverSrc, "phaseFor"),
    rawTimestampSource,
    rawParticipantSource,
    ...rawTimelinePolicySources,
    ...eventTypePolicySources,
    extractFunctionSource(serverSrc, "laneHintForEvent"),
    extractFunctionSource(serverSrc, "importanceForEvent"),
    extractFunctionSource(serverSrc, "summaryForEvent"),
    extractFunctionSource(serverSrc, "buildEventType"),
    extractFunctionSource(serverSrc, "shouldKeepEvent"),
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    "return { rawParticipantId, extractTimelineEvents };",
  ].join("\n"),
)();

let pass = 0;
let fail = 0;
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

check("rawParticipantId accepts first participant", rawParticipantId(1), 1);
check("rawParticipantId accepts last participant", rawParticipantId(10), 10);
check("rawParticipantId rejects zero", rawParticipantId(0), null);
check("rawParticipantId rejects string id", rawParticipantId("2"), null);
check("rawParticipantId rejects fractional id", rawParticipantId(2.5), null);
check("rawParticipantId rejects out-of-range id", rawParticipantId(11), null);
check("rawParticipantId rejects Infinity", rawParticipantId(Infinity), null);
check("rawParticipantId rejects missing id", rawParticipantId(null), null);

const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "ELITE_MONSTER_KILL", timestamp: 1000, killerId: "2", monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 2000, killerId: 2.5, monsterType: "RIFTHERALD" },
          { type: "ELITE_MONSTER_KILL", timestamp: 3000, killerId: 2, monsterType: "DRAGON" },
        ],
      },
    ],
  },
};

const events = extractTimelineEvents({}, timeline, 2, 100);
check("extractTimelineEvents keeps three objective events", events.length, 3);
check("string killer id does not award dragon fight", {
  timestampMs: events[0]?.timestampMs,
  eventType: events[0]?.eventType,
  isPlayerInvolved: events[0]?.isPlayerInvolved,
}, { timestampMs: 1000, eventType: "OBJECTIVE_SETUP_FAIL", isPlayerInvolved: false });
check("fractional killer id does not award objective setup win", {
  timestampMs: events[1]?.timestampMs,
  eventType: events[1]?.eventType,
  isPlayerInvolved: events[1]?.isPlayerInvolved,
}, { timestampMs: 2000, eventType: "OBJECTIVE_SETUP_FAIL", isPlayerInvolved: false });
check("valid numeric killer id still awards dragon fight", {
  timestampMs: events[2]?.timestampMs,
  eventType: events[2]?.eventType,
  isPlayerInvolved: events[2]?.isPlayerInvolved,
}, { timestampMs: 3000, eventType: "DRAGON_FIGHT", isPlayerInvolved: true });

checkTrue(
  "server defines rawParticipantId",
  serverSrc.includes("function rawParticipantId(value)"),
);
checkTrue(
  "rawParticipantId requires integer in participant range",
  serverSrc.includes("Number.isInteger(value)") &&
    serverSrc.includes("value >= 1") &&
    serverSrc.includes("value <= 10"),
);
checkTrue(
  "extractTimelineEvents uses rawParticipantId for killerId",
  extractTimelineEventsSrc.includes("killerId: rawParticipantId(event.killerId),"),
);
checkTrue(
  "extractTimelineEvents uses rawParticipantId for victimId",
  extractTimelineEventsSrc.includes("victimId: rawParticipantId(event.victimId),"),
);
checkTrue(
  "extractTimelineEvents no longer uses participant id fallback expressions",
  !extractTimelineEventsSrc.includes("killerId: event.killerId || null") &&
    !extractTimelineEventsSrc.includes("victimId: event.victimId || null"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run RED test**

Run:

```bash
node test-artifacts/server/raw-participant-id-policy-tests.mjs
```

Expected:
- Exits 1.
- Direct fallback `rawParticipantId()` checks pass.
- Current `extractTimelineEvents()` still lets string and fractional `killerId` values reach `participantTeam()`, so malformed objective events are classified as won by the player team, and source-shape checks fail because production does not define or use the helper.

Evidence:
- `node test-artifacts/server/raw-participant-id-policy-tests.mjs` exited 1 before production changes.
- RED output: `10 passed, 7 failed`.
- Intended failures covered string `killerId` becoming `DRAGON_FIGHT`, fractional `killerId` becoming `OBJECTIVE_SETUP_WIN`, and missing helper/source-shape checks.

### Task 2: Implement Raw Participant Id Policy

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/raw-event-timestamp-tests.mjs`
- Modify: `test-artifacts/server/raw-building-team-policy-tests.mjs`

- [x] **Step 1: Add helper near the raw timeline value helpers**

Add after `rawEventTimestampMs(event)`:

```js
function rawParticipantId(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null;
}
```

- [x] **Step 2: Update `extractTimelineEvents()` raw event construction**

Replace:

```js
killerId: event.killerId || null,
victimId: event.victimId || null,
```

with:

```js
killerId: rawParticipantId(event.killerId),
victimId: rawParticipantId(event.victimId),
```

- [x] **Step 3: Update existing source-extraction harnesses**

In `test-artifacts/server/raw-event-timestamp-tests.mjs` and `test-artifacts/server/raw-building-team-policy-tests.mjs`, add this source/fallback item before `extractTimelineEventsSrc` is evaluated:

```js
const rawParticipantSource = serverSrc.includes("function rawParticipantId(value)")
  ? extractFunctionSource(serverSrc, "rawParticipantId")
  : "function rawParticipantId(value) { return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null; }";
```

Then include `rawParticipantSource` in the `new Function([...])` dependency list immediately after `rawTimestampSource`.

- [x] **Step 4: Run focused GREEN tests**

Run:

```bash
node test-artifacts/server/raw-participant-id-policy-tests.mjs
node test-artifacts/server/raw-event-timestamp-tests.mjs
node test-artifacts/server/raw-building-team-policy-tests.mjs
```

Expected:
- `raw-participant-id-policy-tests.mjs` exits 0 and reports `17 passed, 0 failed`.
- `raw-event-timestamp-tests.mjs` exits 0 and reports `15 passed, 0 failed`.
- `raw-building-team-policy-tests.mjs` exits 0 and reports `28 passed, 0 failed`.

Evidence:
- `node test-artifacts/server/raw-participant-id-policy-tests.mjs`: `17 passed, 0 failed`.
- `node test-artifacts/server/raw-event-timestamp-tests.mjs`: `15 passed, 0 failed`.
- `node test-artifacts/server/raw-building-team-policy-tests.mjs`: `28 passed, 0 failed`.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-raw-participant-id-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/raw-participant-id-policy-tests.mjs
node --check test-artifacts/server/raw-event-timestamp-tests.mjs
node --check test-artifacts/server/raw-building-team-policy-tests.mjs
node test-artifacts/server/raw-participant-id-policy-tests.mjs
node test-artifacts/server/raw-event-timestamp-tests.mjs
node test-artifacts/server/raw-building-team-policy-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-participant-id-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `node --check` commands exit 0.
- Focused tests exit 0.
- `npm test` exits 0.
- Read-only smoke report exits 0.
- `git diff --check` exits 0.

Evidence:
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/raw-participant-id-policy-tests.mjs`, `node --check test-artifacts/server/raw-event-timestamp-tests.mjs`, and `node --check test-artifacts/server/raw-building-team-policy-tests.mjs` exited 0.
- Focused tests:
  - `node test-artifacts/server/raw-participant-id-policy-tests.mjs`: `17 passed, 0 failed`.
  - `node test-artifacts/server/raw-event-timestamp-tests.mjs`: `15 passed, 0 failed`.
  - `node test-artifacts/server/raw-building-team-policy-tests.mjs`: `28 passed, 0 failed`.
- `npm test`: `1676 passed, 0 failed across 50 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-participant-id-policy-local npm run smoke:report:readonly` exited 0.
- Local smoke summary: `latestRun.qaVerdict.status: "passed"`, required checks total 13 / passed 13 / failed 0 / missing 0, smoke 156 passed / 0 failed, `durationMs: 210`, mode `readonly`.
- Local smoke artifact high-risk sensitive pattern scan: no matches.
- `git diff --check` exited 0.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with RED/GREEN evidence, `npm test`, local smoke summary, implementation commit SHA, GitHub Actions run id, artifact id, sensitive scan result, docs completion commit SHA, final docs GitHub Actions run id, and final `main...origin/main` sync count.

Evidence:
- Added the `2026-06-09 04:28 KST - Raw participant id policy 보강` entry with RED/GREEN and local QA evidence.
- Commit SHA, GitHub Actions run id, artifact id, and final sync evidence remain pending until push and CI verification complete.

- [x] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/raw-participant-id-policy-tests.mjs test-artifacts/server/raw-event-timestamp-tests.mjs test-artifacts/server/raw-building-team-policy-tests.mjs docs/superpowers/plans/2026-06-09-raw-participant-id-policy.md
git diff --cached --check
git commit -m "test: guard raw participant id policy"
git push origin main
```

Expected: commit and push succeed on `main`.

Evidence:
- Implementation commit `b488052` (`test: guard raw participant id policy`) was pushed to `origin/main`.

- [x] **Step 4: Verify GitHub QA**

Run:

```bash
gh run list --workflow QA --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/github-qa-<run-id>
```

Expected: QA run for the pushed commit passes, artifact summary reports smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, dirty `false`, and no high-risk sensitive-value scan matches.

Evidence:
- GitHub Actions QA run `27161792216` passed for head SHA `b48805269b0755d04b9d8e7ded23a2ac9d533d8c`.
- Workflow artifact `7490351848` (`qa-automation-27161792216`, 3550 bytes) was downloaded and inspected.
- Artifact `qa-summary.json`: `latestRun.qaVerdict.status: "passed"`, smoke 156 passed / 0 failed, required checks total 13 / passed 13 / failed 0 / missing 0, `durationMs: 203`, `latestRun.git.shortSha: "b488052"`, `dirty: false`.
- GitHub artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 5: Mark plan complete and final sync**

Update this plan with implementation and docs completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-raw-participant-id-policy.md
git diff --cached --check
git commit -m "docs: finalize raw participant id policy"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

Docs checkpoint and finalization evidence:
- Docs checkpoint commit `c1a98c1` (`docs: mark raw participant id policy complete`) pushed to `origin/main`.
- QA run `27161887172` passed for `c1a98c1b9897f02136515c910807954aef1362d5`.
- Artifact `7490387775` (`qa-automation-27161887172`, 3550 bytes) inspected.
- Artifact `qa-summary.json`: `latestRun.qaVerdict.status` passed, read-only smoke 156 passed / 0 failed, `durationMs: 212`, required checks total 13 / passed 13 / failed 0 / missing 0, `latestRun.git.shortSha: "c1a98c1"`, `dirty: false`.
- GitHub artifact high-risk sensitive pattern scan: no matches.

## Self-Review

- Spec coverage: The plan covers helper behavior, objective extraction behavior, source-shape checks, existing source-extraction harness compatibility, local QA, GitHub QA, Obsidian docs, and final sync.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `rawParticipantId(value)` returns a numeric participant id or `null`; `extractTimelineEvents()` consumes it for `killerId` and `victimId`.
