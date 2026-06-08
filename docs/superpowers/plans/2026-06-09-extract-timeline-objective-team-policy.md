# Extract Timeline Objective Team Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `extractTimelineEvents()` classify objective wins/losses from Riot's numeric `killerTeamId` when available, instead of relying only on `killerId`.

**Architecture:** Add a narrow `rawObjectiveTeamId(rawEvent)` helper in `server.js`. `extractTimelineEvents()` will preserve raw `killerTeamId` on its normalized raw event object and use the helper to compute `playerWonObjective`; downstream event type, summary, phase, and evidence indexing contracts stay unchanged.

**Tech Stack:** Node.js ESM regression scripts under `test-artifacts/server`, existing single-file Node server helpers in `server.js`, `npm test`, read-only smoke report QA, GitHub Actions QA workflow.

---

## File Structure

- Create: `test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs`
  - Verifies objective event type classification for known numeric `killerTeamId`, malformed IDs, neutral teams, and participant fallback.
  - Verifies source shape so future edits keep raw team validation and preserve `killerTeamId` through `extractTimelineEvents()`.
- Modify: `test-artifacts/server/raw-participant-id-policy-tests.mjs`
- Modify: `test-artifacts/server/raw-building-team-policy-tests.mjs`
- Modify: `test-artifacts/server/raw-event-timestamp-tests.mjs`
  - Include `rawObjectiveTeamId()` in function-extraction harnesses that execute `extractTimelineEvents()`.
- Modify: `server.js`
  - Add `rawObjectiveTeamId(rawEvent)` near raw team helpers.
  - Preserve `killerTeamId` on the `rawEvent` object created by `extractTimelineEvents()`.
  - Replace `participantTeam(rawEvent.killerId)` with `rawObjectiveTeamId(rawEvent)`.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
  - Record the improvement, RED/GREEN evidence, local QA, GitHub QA, and final sync status.

## Task 1: Write RED Regression Coverage

**Files:**
- Create: `test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs`

- [x] **Step 1: Add the focused regression test file**

```js
// server.js extract timeline objective team policy regression tests

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

const rawObjectiveTeamIdSrc = functionSourceOrFallback(
  serverSrc,
  "rawObjectiveTeamId",
  "function rawObjectiveTeamId(rawEvent) { const mappedTeamId = participantTeam(rawEvent.killerId); return mappedTeamId === 100 || mappedTeamId === 200 ? mappedTeamId : null; }",
);
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

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
  extractFunctionSource(serverSrc, "isKnownRawTeamId"),
  extractFunctionSource(serverSrc, "isRawEnemyBuildingKill"),
  rawObjectiveTeamIdSrc,
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

const { rawObjectiveTeamId, extractTimelineEvents } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "participantTeam"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    extractFunctionSource(serverSrc, "rawParticipantId"),
    ...rawTimelinePolicySources,
    ...eventTypePolicySources,
    extractFunctionSource(serverSrc, "laneHintForEvent"),
    extractFunctionSource(serverSrc, "importanceForEvent"),
    extractFunctionSource(serverSrc, "summaryForEvent"),
    extractFunctionSource(serverSrc, "buildEventType"),
    extractFunctionSource(serverSrc, "shouldKeepEvent"),
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    "return { rawObjectiveTeamId, extractTimelineEvents };",
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

const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "ELITE_MONSTER_KILL", timestamp: 1000, killerId: null, killerTeamId: 100, monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 2000, killerId: null, killerTeamId: 100, monsterType: "RIFTHERALD" },
          { type: "ELITE_MONSTER_KILL", timestamp: 3000, killerId: null, killerTeamId: 200, monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 4000, killerId: "2", killerTeamId: "100", monsterType: "RIFTHERALD" },
          { type: "ELITE_MONSTER_KILL", timestamp: 5000, killerId: 2, killerTeamId: "100", monsterType: "DRAGON" },
        ],
      },
    ],
  },
};

const events = extractTimelineEvents({}, timeline, 2, 100);
check("extractTimelineEvents keeps all objective events", events.length, 5);
check("known allied killerTeamId awards dragon fight", events[0]?.eventType, "DRAGON_FIGHT");
check("known allied killerTeamId awards non-dragon objective setup win", events[1]?.eventType, "OBJECTIVE_SETUP_WIN");
check("known enemy killerTeamId keeps dragon as objective fail", events[2]?.eventType, "OBJECTIVE_SETUP_FAIL");
check("string killerTeamId with string killerId stays conservative fail", events[3]?.eventType, "OBJECTIVE_SETUP_FAIL");
check("malformed killerTeamId falls back to valid numeric killerId", events[4]?.eventType, "DRAGON_FIGHT");

check("helper uses known killerTeamId without participant fallback", rawObjectiveTeamId({ killerTeamId: 100, killerId: null }), 100);
check("helper prioritizes known killerTeamId over conflicting killerId fallback", rawObjectiveTeamId({ killerTeamId: 200, killerId: 2 }), 200);
check("helper falls back through sanitized raw killerId", rawObjectiveTeamId({ killerTeamId: "100", killerId: 2 }), 100);
check("helper rejects string team and string participant ids", rawObjectiveTeamId({ killerTeamId: "100", killerId: "2" }), null);
check("helper rejects neutral team and neutral participant id", rawObjectiveTeamId({ killerTeamId: 300, killerId: 0 }), null);

checkTrue(
  "server defines rawObjectiveTeamId",
  serverSrc.includes("function rawObjectiveTeamId(rawEvent)"),
);
checkTrue(
  "rawObjectiveTeamId validates raw killerTeamId",
  rawObjectiveTeamIdSrc.includes("isKnownRawTeamId(rawEvent.killerTeamId)"),
);
checkTrue(
  "rawObjectiveTeamId falls back through participantTeam",
  rawObjectiveTeamIdSrc.includes("participantTeam(rawEvent.killerId)"),
);
checkTrue(
  "extractTimelineEvents preserves killerTeamId on rawEvent",
  extractTimelineEventsSrc.includes("killerTeamId: event.killerTeamId ?? null,"),
);
checkTrue(
  "extractTimelineEvents uses rawObjectiveTeamId",
  extractTimelineEventsSrc.includes("const objectiveTeam = rawObjectiveTeamId(rawEvent);"),
);
checkTrue(
  "extractTimelineEvents no longer directly maps objective team from killerId",
  !extractTimelineEventsSrc.includes("const objectiveTeam = participantTeam(rawEvent.killerId);"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run the RED test**

Run:

```bash
node test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs
```

Expected: FAIL because current production code drops `killerTeamId` from `rawEvent`, computes `objectiveTeam` directly from `killerId`, and has no `rawObjectiveTeamId()` helper.

Evidence:
- `node --check test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs`: exit `0`.
- `node test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs`: `8 passed, 9 failed`.
- Expected failures included allied `killerTeamId: 100` dragon/Herald events becoming objective failures, helper absence, missing raw team validation, missing `killerTeamId` preservation, and direct `participantTeam(rawEvent.killerId)` use.

## Task 2: Implement Minimal Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add helper near raw team helpers**

```js
function rawObjectiveTeamId(rawEvent) {
  if (isKnownRawTeamId(rawEvent.killerTeamId)) {
    return rawEvent.killerTeamId;
  }
  const mappedTeamId = participantTeam(rawEvent.killerId);
  return isKnownRawTeamId(mappedTeamId) ? mappedTeamId : null;
}
```

- [x] **Step 2: Preserve killerTeamId and use the helper**

In `extractTimelineEvents()`, add:

```js
killerTeamId: event.killerTeamId ?? null,
```

Then replace:

```js
const objectiveTeam = participantTeam(rawEvent.killerId);
```

With:

```js
const objectiveTeam = rawObjectiveTeamId(rawEvent);
```

- [x] **Step 3: Run the focused GREEN test**

Run:

```bash
node test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs
```

Expected: `17 passed, 0 failed`.

Evidence:
- `node --check server.js && node --check test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs`: exit `0`.
- `node test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs`: `17 passed, 0 failed`.
- Adjacent extraction harnesses were updated to include `rawObjectiveTeamId()` after `raw-participant` and `raw-building` tests surfaced `ReferenceError: rawObjectiveTeamId is not defined`.

## Task 3: Local QA

**Files:**
- Verify changed code and adjacent raw timeline policies.

- [x] **Step 1: Syntax check changed JavaScript**

Run:

```bash
node --check server.js
node --check test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs
```

Expected: both commands exit `0`.

- [x] **Step 2: Run focused regression tests**

Run:

```bash
node test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs
node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
node test-artifacts/server/raw-participant-id-policy-tests.mjs
node test-artifacts/server/raw-building-team-policy-tests.mjs
node test-artifacts/server/raw-timeline-event-type-tests.mjs
node test-artifacts/server/participant-team-policy-tests.mjs
```

Expected: every command exits `0`.

- [x] **Step 3: Run full suite and read-only smoke**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/extract-timeline-objective-team-policy-local npm run smoke:report:readonly
git diff --check
```

Expected: `npm test` exits `0`, smoke report `latestRun.qaVerdict.status` is `passed`, and `git diff --check` exits `0`.

Evidence captured at `2026-06-09 05:16 KST`:
- `node test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs`: `17 passed, 0 failed`.
- `node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: `16 passed, 0 failed`.
- `node test-artifacts/server/raw-participant-id-policy-tests.mjs`: `17 passed, 0 failed`.
- `node test-artifacts/server/raw-building-team-policy-tests.mjs`: `28 passed, 0 failed`.
- `node test-artifacts/server/raw-event-timestamp-tests.mjs`: `15 passed, 0 failed`.
- `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: `31 passed, 0 failed`.
- `node test-artifacts/server/participant-team-policy-tests.mjs`: `13 passed, 0 failed`.
- `npm test`: `1734 passed, 0 failed across 54 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/extract-timeline-objective-team-policy-local npm run smoke:report:readonly`: exit `0`.
- `test-artifacts/tmp/extract-timeline-objective-team-policy-local/qa-summary.json`: `latestRun.qaVerdict.status` `passed`, required checks `13 passed / 0 failed / 0 missing`, smoke `156 passed / 0 failed`, duration `208ms`, mode `readonly`.
- Local smoke artifact sensitive scan: `no high-risk sensitive patterns found`.
- `git diff --check`: exit `0`.

## Task 4: Docs, Commit, Push, GitHub QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-extract-timeline-objective-team-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Update docs with QA evidence**

Record RED, GREEN, full local QA, smoke report, Git commit SHA, GitHub Actions run ID, artifact ID, and final `main...origin/main` sync evidence.

- [ ] **Step 2: Commit and push implementation**

Run:

```bash
rm -rf test-artifacts/tmp
git diff --check
git status --short --branch
git add server.js test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs docs/superpowers/plans/2026-06-09-extract-timeline-objective-team-policy.md
git diff --cached --check
git commit -m "test: guard extracted objective team mapping"
git push origin main
```

Expected: implementation commit is pushed to `origin/main`.

- [ ] **Step 3: Verify GitHub Actions QA**

Run:

```bash
gh run list --workflow QA --branch main --limit 8 --json databaseId,headSha,headBranch,status,conclusion,displayTitle,createdAt,url
gh run watch <run-id> --exit-status
gh run download <run-id> --dir test-artifacts/tmp/github-qa-<run-id>
```

Expected: GitHub Actions QA exits `0`, the downloaded `qa-summary.json` reports passed required checks, and sensitive-pattern scan finds no high-risk strings.

- [ ] **Step 4: Commit docs finalization and verify final sync**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-extract-timeline-objective-team-policy.md "/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md"
git diff --cached --check
git commit -m "docs: finalize extracted objective team policy"
git push origin main
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final docs commit is pushed, working tree is clean, and local/remote `main` differ by `0 0`.
