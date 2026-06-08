# Raw Building Team Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat raw `BUILDING_KILL` events as enemy structure takes only when the event has a known numeric Riot team id.

**Architecture:** Add `isKnownRawTeamId(teamId)` and `isRawEnemyBuildingKill(rawEvent, targetTeamId)` near the raw timeline helpers. Route `buildEventType()` and `shouldKeepEvent()` through the helper so missing or malformed `teamId` values do not become false-positive enemy tower evidence.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Create: `test-artifacts/server/raw-building-team-policy-tests.mjs` - behavior and source-shape tests for raw building team classification.
- Modify: `server.js` - add known-team and enemy-building helpers, then use them in `buildEventType()` and `shouldKeepEvent()`.
- Modify: `test-artifacts/server/raw-player-involvement-tests.mjs` - include the new building-team helpers in the source-extraction harness for `shouldKeepEvent()`.
- Modify: `test-artifacts/server/raw-timeline-event-type-tests.mjs` - include the new building-team helpers in the source-extraction harness for `buildEventType()` and `shouldKeepEvent()`.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` - append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-raw-building-team-policy.md` - mark steps complete and add evidence after each stage.

### Task 1: Add RED Coverage For Building Team Policy

**Files:**
- Create: `test-artifacts/server/raw-building-team-policy-tests.mjs`

- [x] **Step 1: Create source-extraction regression test**

Create `test-artifacts/server/raw-building-team-policy-tests.mjs` with:

```js
// server.js raw building team policy regression tests

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

const rawTimestampSource = functionSourceOrFallback(
  serverSrc,
  "rawEventTimestampMs",
  "function rawEventTimestampMs(event) { return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0; }",
);

const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");
const shouldKeepEventSrc = extractFunctionSource(serverSrc, "shouldKeepEvent");
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const {
  isKnownRawTeamId,
  isRawEnemyBuildingKill,
  buildEventType,
  shouldKeepEvent,
  extractTimelineEvents,
} = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "participantTeam"),
    extractFunctionSource(serverSrc, "phaseFor"),
    rawTimestampSource,
    ...rawTimelinePolicySources,
    ...eventTypePolicySources,
    extractFunctionSource(serverSrc, "laneHintForEvent"),
    extractFunctionSource(serverSrc, "importanceForEvent"),
    extractFunctionSource(serverSrc, "summaryForEvent"),
    buildEventTypeSrc,
    shouldKeepEventSrc,
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    "return { isKnownRawTeamId, isRawEnemyBuildingKill, buildEventType, shouldKeepEvent, extractTimelineEvents };",
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

const knownEnemyTower = { type: "BUILDING_KILL", timestamp: 3000, killerId: 7, victimId: null, assistingParticipantIds: [], teamId: 200 };
const knownOwnTower = { type: "BUILDING_KILL", timestamp: 2000, killerId: 7, victimId: null, assistingParticipantIds: [], teamId: 100 };
const missingTeamTower = { type: "BUILDING_KILL", timestamp: 1000, killerId: 7, victimId: null, assistingParticipantIds: [] };
const stringOwnTower = { type: "BUILDING_KILL", timestamp: 1500, killerId: 7, victimId: null, assistingParticipantIds: [], teamId: "100" };
const stringEnemyTower = { type: "BUILDING_KILL", timestamp: 2500, killerId: 7, victimId: null, assistingParticipantIds: [], teamId: "200" };
const playerInvolvedUnknownTower = { type: "BUILDING_KILL", timestamp: 4000, killerId: 2, victimId: null, assistingParticipantIds: [], teamId: null };

check("isKnownRawTeamId accepts 100", isKnownRawTeamId(100), true);
check("isKnownRawTeamId accepts 200", isKnownRawTeamId(200), true);
check("isKnownRawTeamId rejects string team id", isKnownRawTeamId("200"), false);
check("isKnownRawTeamId rejects missing team id", isKnownRawTeamId(null), false);
check("isRawEnemyBuildingKill keeps known enemy team", isRawEnemyBuildingKill(knownEnemyTower, 100), true);
check("isRawEnemyBuildingKill rejects own team", isRawEnemyBuildingKill(knownOwnTower, 100), false);
check("isRawEnemyBuildingKill rejects missing team", isRawEnemyBuildingKill(missingTeamTower, 100), false);
check("isRawEnemyBuildingKill rejects string enemy team", isRawEnemyBuildingKill(stringEnemyTower, 100), false);

check("buildEventType maps known enemy tower to TOWER_TAKE", buildEventType(knownEnemyTower, 2, 100, false), "TOWER_TAKE");
check("buildEventType maps own tower to objective fail", buildEventType(knownOwnTower, 2, 100, false), "OBJECTIVE_SETUP_FAIL");
check("buildEventType maps missing team tower conservatively", buildEventType(missingTeamTower, 2, 100, false), "OBJECTIVE_SETUP_FAIL");
check("buildEventType maps string enemy team tower conservatively", buildEventType(stringEnemyTower, 2, 100, false), "OBJECTIVE_SETUP_FAIL");

check("shouldKeepEvent keeps known enemy tower without player involvement", shouldKeepEvent(knownEnemyTower, 2, 100), true);
check("shouldKeepEvent drops own tower without player involvement", shouldKeepEvent(knownOwnTower, 2, 100), false);
check("shouldKeepEvent drops missing team tower without player involvement", shouldKeepEvent(missingTeamTower, 2, 100), false);
check("shouldKeepEvent drops string own tower without player involvement", shouldKeepEvent(stringOwnTower, 2, 100), false);
check("shouldKeepEvent drops string enemy tower without player involvement", shouldKeepEvent(stringEnemyTower, 2, 100), false);
check("shouldKeepEvent preserves player-involved unknown tower", shouldKeepEvent(playerInvolvedUnknownTower, 2, 100), true);

const timeline = {
  info: {
    frames: [
      {
        events: [
          stringOwnTower,
          missingTeamTower,
          knownEnemyTower,
          stringEnemyTower,
        ],
      },
    ],
  },
};

const events = extractTimelineEvents({}, timeline, 2, 100);
check("extractTimelineEvents only keeps known enemy building event", events.length, 1);
check("kept building event is known enemy tower take", {
  timestampMs: events[0]?.timestampMs,
  eventType: events[0]?.eventType,
}, { timestampMs: 3000, eventType: "TOWER_TAKE" });

checkTrue(
  "server defines isKnownRawTeamId",
  serverSrc.includes("function isKnownRawTeamId(teamId)"),
);
checkTrue(
  "isKnownRawTeamId allows only numeric Riot team ids",
  serverSrc.includes("teamId === 100") && serverSrc.includes("teamId === 200"),
);
checkTrue(
  "server defines isRawEnemyBuildingKill",
  serverSrc.includes("function isRawEnemyBuildingKill(rawEvent, targetTeamId)"),
);
checkTrue(
  "isRawEnemyBuildingKill requires known team id",
  serverSrc.includes("isKnownRawTeamId(rawEvent.teamId)") &&
    serverSrc.includes("rawEvent.teamId !== targetTeamId"),
);
checkTrue(
  "buildEventType uses isRawEnemyBuildingKill",
  buildEventTypeSrc.includes("isRawEnemyBuildingKill(rawEvent, targetTeamId)"),
);
checkTrue(
  "shouldKeepEvent uses isRawEnemyBuildingKill",
  shouldKeepEventSrc.includes("isRawEnemyBuildingKill(rawEvent, targetTeamId)"),
);
checkTrue(
  "buildEventType no longer directly compares building team with ternary",
  !buildEventTypeSrc.includes("rawEvent.teamId === targetTeamId ?"),
);
checkTrue(
  "shouldKeepEvent no longer treats every non-own raw team as enemy",
  !shouldKeepEventSrc.includes("rawEvent.teamId !== targetTeamId"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run RED test**

Run:

```bash
node test-artifacts/server/raw-building-team-policy-tests.mjs
```

Expected:
- Exits 1.
- Direct fallback helper checks pass.
- Current `buildEventType()` treats missing/string team ids as `TOWER_TAKE`, `shouldKeepEvent()` keeps missing/string team building kills without player involvement, `extractTimelineEvents()` keeps false-positive building events, and source-shape checks fail because production does not define or use the helpers.

Evidence:
- `node test-artifacts/server/raw-building-team-policy-tests.mjs` exited 1 before production changes.
- RED output: `13 passed, 15 failed`.
- Intended failures covered missing/string `teamId` building events becoming `TOWER_TAKE`, `shouldKeepEvent()` retaining malformed non-involved building events, `extractTimelineEvents()` keeping four false-positive building events instead of one known enemy event, and missing helper/source-shape checks.

### Task 2: Implement Known Raw Building Team Policy

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add helpers after `isRawPlayerInvolved(rawEvent, targetParticipantId)`**

Add:

```js
function isKnownRawTeamId(teamId) {
  return teamId === 100 || teamId === 200;
}

function isRawEnemyBuildingKill(rawEvent, targetTeamId) {
  return isKnownRawTeamId(rawEvent.teamId) && rawEvent.teamId !== targetTeamId;
}
```

- [x] **Step 2: Update `buildEventType()` building branch**

Replace:

```js
if (isRawBuildingKillEvent(rawEvent)) {
  return rawEvent.teamId === targetTeamId ? "OBJECTIVE_SETUP_FAIL" : "TOWER_TAKE";
}
```

with:

```js
if (isRawBuildingKillEvent(rawEvent)) {
  return isRawEnemyBuildingKill(rawEvent, targetTeamId) ? "TOWER_TAKE" : "OBJECTIVE_SETUP_FAIL";
}
```

- [x] **Step 3: Update `shouldKeepEvent()` building branch**

Replace:

```js
if (isRawBuildingKillEvent(rawEvent)) {
  return playerInvolved || rawEvent.teamId !== targetTeamId;
}
```

with:

```js
if (isRawBuildingKillEvent(rawEvent)) {
  return playerInvolved || isRawEnemyBuildingKill(rawEvent, targetTeamId);
}
```

- [x] **Step 4: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/raw-building-team-policy-tests.mjs
```

Expected:
- Exits 0.
- Reports `28 passed, 0 failed`.

Evidence:
- First focused run after production changes surfaced a test-contract mismatch: `extractTimelineEvents()` does not output `teamRelation`, so the test was corrected to assert the existing `timestampMs` and `eventType` contract.
- `node test-artifacts/server/raw-building-team-policy-tests.mjs` exited 0 after the contract correction.
- GREEN output: `28 passed, 0 failed`.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-raw-building-team-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/raw-building-team-policy-tests.mjs
node test-artifacts/server/raw-building-team-policy-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-building-team-policy-local npm run smoke:report:readonly
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
- `node --check test-artifacts/server/raw-building-team-policy-tests.mjs`, `node --check test-artifacts/server/raw-player-involvement-tests.mjs`, and `node --check test-artifacts/server/raw-timeline-event-type-tests.mjs` exited 0.
- `node test-artifacts/server/raw-building-team-policy-tests.mjs`: `28 passed, 0 failed`.
- First `npm test` after implementation found source-extraction harness dependency gaps:
  - `test-artifacts/server/raw-player-involvement-tests.mjs` failed with `isRawEnemyBuildingKill is not defined`.
  - `test-artifacts/server/raw-timeline-event-type-tests.mjs` failed with `ReferenceError: isRawEnemyBuildingKill is not defined`.
- After adding `isKnownRawTeamId()` and `isRawEnemyBuildingKill()` source/fallback injection to those two harnesses:
  - `node test-artifacts/server/raw-player-involvement-tests.mjs`: `12 passed, 0 failed`.
  - `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: `31 passed, 0 failed`.
  - `npm test`: `1659 passed, 0 failed across 49 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-building-team-policy-local npm run smoke:report:readonly` exited 0.
- Local smoke summary: `latestRun.qaVerdict.status: "passed"`, required checks total 13 / passed 13 / failed 0 / missing 0, smoke 156 passed / 0 failed, `durationMs: 243`, mode `readonly`.
- Local smoke artifact high-risk sensitive pattern scan: no matches.
- `git diff --check` exited 0.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with RED/GREEN evidence, `npm test`, local smoke summary, implementation commit SHA, GitHub Actions run id, artifact id, sensitive scan result, docs completion commit SHA, final docs GitHub Actions run id, and final `main...origin/main` sync count.

Evidence:
- Added the `2026-06-09 04:16 KST - Raw building team policy 보강` entry with RED/GREEN, harness adjustment, and local QA evidence.
- Commit SHA, GitHub Actions run id, artifact id, and final sync evidence remain pending until push and CI verification complete.

- [x] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/raw-building-team-policy-tests.mjs docs/superpowers/plans/2026-06-09-raw-building-team-policy.md
git add test-artifacts/server/raw-player-involvement-tests.mjs test-artifacts/server/raw-timeline-event-type-tests.mjs
git diff --cached --check
git commit -m "test: guard raw building team policy"
git push origin main
```

Expected: commit and push succeed on `main`.

Evidence:
- Implementation commit `4bd5c66` (`test: guard raw building team policy`) was pushed to `origin/main`.

- [x] **Step 4: Verify GitHub QA**

Run:

```bash
gh run list --workflow QA --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/github-qa-<run-id>
```

Expected: QA run for the pushed commit passes, artifact summary reports smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, dirty `false`, and no high-risk sensitive-value scan matches.

Evidence:
- GitHub Actions QA run `27161132208` passed for head SHA `4bd5c66f5d3a43068ff5403b75f7b3a151f8814b`.
- Workflow artifact `7490089644` (`qa-automation-27161132208`, 3551 bytes) was downloaded and inspected.
- Artifact `qa-summary.json`: `latestRun.qaVerdict.status: "passed"`, smoke 156 passed / 0 failed, required checks total 13 / passed 13 / failed 0 / missing 0, `durationMs: 202`, `latestRun.git.shortSha: "4bd5c66"`, `dirty: false`.
- GitHub artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 5: Mark plan complete and final sync**

Update this plan with implementation and docs completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-raw-building-team-policy.md
git diff --cached --check
git commit -m "docs: finalize raw building team policy"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

Docs checkpoint and finalization evidence:
- Docs checkpoint commit `9a92a7c` (`docs: mark raw building team policy complete`) pushed to `origin/main`.
- QA run `27161216947` passed for `9a92a7cf96176b58d6280e6c1c9e99fbd7c1204d`.
- Artifact `7490123858` (`qa-automation-27161216947`, 3546 bytes) inspected.
- Artifact `qa-summary.json`: `latestRun.qaVerdict.status` passed, read-only smoke 156 passed / 0 failed, `durationMs: 202`, required checks total 13 / passed 13 / failed 0 / missing 0, `latestRun.git.shortSha: "9a92a7c"`, `dirty: false`.
- GitHub artifact high-risk sensitive pattern scan: no matches.

## Self-Review

- Spec coverage: The plan covers direct raw building team classification, keep/drop policy, and normalized timeline output for malformed or missing `teamId`.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `isKnownRawTeamId(teamId)` accepts only numeric Riot team ids and `isRawEnemyBuildingKill(rawEvent, targetTeamId)` returns a boolean consumed by both building policy branches.
