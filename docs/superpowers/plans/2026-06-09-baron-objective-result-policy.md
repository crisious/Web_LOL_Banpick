# Baron Objective Result Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent lost Baron objective events from being counted as objective wins in derived strengths, coach summary, and objective score logic.

**Architecture:** Keep `BARON_FIGHT` as the existing positive Baron event type, but only emit it when `playerWonObjective` is true. Lost Baron events will reuse the existing `OBJECTIVE_SETUP_FAIL` type so objective win/fail consumers continue using the current event taxonomy.

**Tech Stack:** Node.js ESM regression scripts under `test-artifacts/server`, existing single-file Node server helpers in `server.js`, `npm test`, read-only smoke report QA, GitHub Actions QA workflow.

---

## File Structure

- Create: `test-artifacts/server/baron-objective-result-policy-tests.mjs`
  - Verifies `buildEventType()` maps won Baron to `BARON_FIGHT` and lost Baron to `OBJECTIVE_SETUP_FAIL`.
  - Verifies `extractTimelineEvents()` applies the policy from raw `killerTeamId`.
  - Verifies `calcObjectiveScore()` no longer scores a lost Baron as a win.
- Modify: `server.js`
  - Change the Baron branch in `buildEventType()` to respect `playerWonObjective`.
- Modify: `test-artifacts/server/raw-timeline-event-type-tests.mjs`
  - Update existing raw timeline event type expectations for the lost Baron case.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
  - Record the improvement, RED/GREEN evidence, local QA, GitHub QA, and final sync status.

## Task 1: Write RED Regression Coverage

**Files:**
- Create: `test-artifacts/server/baron-objective-result-policy-tests.mjs`

- [x] **Step 1: Add the focused regression test file**

```js
// server.js Baron objective result policy regression tests

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
  extractFunctionSource(serverSrc, "rawObjectiveTeamId"),
  extractFunctionSource(serverSrc, "isRawEnemyBuildingKill"),
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

const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");
const calcObjectiveScoreSrc = extractFunctionSource(serverSrc, "calcObjectiveScore");

const { buildEventType, extractTimelineEvents, calcObjectiveScore } = new Function(
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
    buildEventTypeSrc,
    extractFunctionSource(serverSrc, "shouldKeepEvent"),
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    extractConstSource(serverSrc, "OBJECTIVE_WIN_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isObjectiveWinEvent"),
    extractConstSource(serverSrc, "OBJECTIVE_FAIL_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isObjectiveFailEvent"),
    extractFunctionSource(serverSrc, "clamp10"),
    calcObjectiveScoreSrc,
    "return { buildEventType, extractTimelineEvents, calcObjectiveScore };",
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

const baron = {
  type: "ELITE_MONSTER_KILL",
  monsterType: "BARON_NASHOR",
  killerId: null,
  victimId: null,
  assistingParticipantIds: [],
  teamId: null,
};

check("buildEventType maps won Baron to BARON_FIGHT", buildEventType(baron, 2, 100, true), "BARON_FIGHT");
check("buildEventType maps lost Baron to objective fail", buildEventType(baron, 2, 100, false), "OBJECTIVE_SETUP_FAIL");

const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "ELITE_MONSTER_KILL", timestamp: 1000, killerId: null, killerTeamId: 100, monsterType: "BARON_NASHOR" },
          { type: "ELITE_MONSTER_KILL", timestamp: 2000, killerId: null, killerTeamId: 200, monsterType: "BARON_NASHOR" },
        ],
      },
    ],
  },
};

const events = extractTimelineEvents({}, timeline, 2, 100);
check("extractTimelineEvents keeps two Baron objective events", events.length, 2);
check("allied Baron remains BARON_FIGHT", events[0]?.eventType, "BARON_FIGHT");
check("enemy Baron is objective fail", events[1]?.eventType, "OBJECTIVE_SETUP_FAIL");
check("objective score counts one Baron win and one Baron fail", calcObjectiveScore(events), 4.4);

checkTrue(
  "buildEventType uses playerWonObjective for Baron",
  buildEventTypeSrc.includes('return playerWonObjective ? "BARON_FIGHT" : "OBJECTIVE_SETUP_FAIL";'),
);
checkTrue(
  "buildEventType no longer returns BARON_FIGHT unconditionally",
  !buildEventTypeSrc.includes('if (rawEvent.monsterType === "BARON_NASHOR") {\n      return "BARON_FIGHT";\n    }'),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run the RED test**

Run:

```bash
node test-artifacts/server/baron-objective-result-policy-tests.mjs
```

Expected: FAIL because current production code returns `BARON_FIGHT` even when `playerWonObjective` is false.

Evidence:
- `node --check test-artifacts/server/baron-objective-result-policy-tests.mjs`: exit `0`.
- `node test-artifacts/server/baron-objective-result-policy-tests.mjs`: `3 passed, 5 failed`.
- Expected failures included lost Baron mapping to `BARON_FIGHT`, enemy Baron from `extractTimelineEvents()` mapping to `BARON_FIGHT`, objective score `8.8` instead of `4.4`, and source-shape checks for unconditional Baron return.

## Task 2: Implement Minimal Policy

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/raw-timeline-event-type-tests.mjs`

- [x] **Step 1: Make Baron event type depend on objective ownership**

Replace:

```js
if (rawEvent.monsterType === "BARON_NASHOR") {
  return "BARON_FIGHT";
}
```

With:

```js
if (rawEvent.monsterType === "BARON_NASHOR") {
  return playerWonObjective ? "BARON_FIGHT" : "OBJECTIVE_SETUP_FAIL";
}
```

- [x] **Step 2: Update existing raw timeline event type expectation**

In `test-artifacts/server/raw-timeline-event-type-tests.mjs`, split the Baron assertion:

```js
check("buildEventType baron won", buildEventType(baron, 2, 100, true), "BARON_FIGHT");
check("buildEventType baron lost", buildEventType(baron, 2, 100, false), "OBJECTIVE_SETUP_FAIL");
```

- [x] **Step 3: Run the focused GREEN tests**

Run:

```bash
node test-artifacts/server/baron-objective-result-policy-tests.mjs
node test-artifacts/server/raw-timeline-event-type-tests.mjs
```

Expected: every command exits `0`.

Evidence:
- `node --check server.js && node --check test-artifacts/server/baron-objective-result-policy-tests.mjs && node --check test-artifacts/server/raw-timeline-event-type-tests.mjs`: exit `0`.
- `node test-artifacts/server/baron-objective-result-policy-tests.mjs`: `8 passed, 0 failed`.
- `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: `32 passed, 0 failed`.

## Task 3: Local QA

**Files:**
- Verify changed code and adjacent objective policy consumers.

- [x] **Step 1: Syntax check changed JavaScript**

Run:

```bash
node --check server.js
node --check test-artifacts/server/baron-objective-result-policy-tests.mjs
node --check test-artifacts/server/raw-timeline-event-type-tests.mjs
```

Expected: all commands exit `0`.

- [x] **Step 2: Run focused regression tests**

Run:

```bash
node test-artifacts/server/baron-objective-result-policy-tests.mjs
node test-artifacts/server/raw-timeline-event-type-tests.mjs
node test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs
node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
node test-artifacts/server/coach-summary-tests.mjs
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected: every command exits `0`.

- [x] **Step 3: Run full suite and read-only smoke**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/baron-objective-result-policy-local npm run smoke:report:readonly
git diff --check
```

Expected: `npm test` exits `0`, smoke report `latestRun.qaVerdict.status` is `passed`, and `git diff --check` exits `0`.

Evidence captured at `2026-06-09 05:26 KST`:
- `node test-artifacts/server/baron-objective-result-policy-tests.mjs`: `8 passed, 0 failed`.
- `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: `32 passed, 0 failed`.
- `node test-artifacts/server/extract-timeline-objective-team-policy-tests.mjs`: `17 passed, 0 failed`.
- `node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: `16 passed, 0 failed`.
- `node test-artifacts/server/coach-summary-tests.mjs`: `11 passed, 0 failed`.
- `node test-artifacts/server/strength-weakness-tests.mjs`: `89 passed, 0 failed`.
- `npm test`: `1743 passed, 0 failed across 55 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/baron-objective-result-policy-local npm run smoke:report:readonly`: exit `0`.
- `test-artifacts/tmp/baron-objective-result-policy-local/qa-summary.json`: `latestRun.qaVerdict.status` `passed`, required checks `13 passed / 0 failed / 0 missing`, smoke `156 passed / 0 failed`, duration `209ms`, mode `readonly`.
- Local smoke artifact sensitive scan: `no high-risk sensitive patterns found`.
- `git diff --check`: exit `0`.

## Task 4: Docs, Commit, Push, GitHub QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-baron-objective-result-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Update docs with QA evidence**

Record RED, GREEN, full local QA, smoke report, Git commit SHA, GitHub Actions run ID, artifact ID, and final `main...origin/main` sync evidence.

- [x] **Step 2: Commit and push implementation**

Run:

```bash
rm -rf test-artifacts/tmp
git diff --check
git status --short --branch
git add server.js test-artifacts/server/baron-objective-result-policy-tests.mjs test-artifacts/server/raw-timeline-event-type-tests.mjs docs/superpowers/plans/2026-06-09-baron-objective-result-policy.md
git diff --cached --check
git commit -m "test: guard Baron objective result mapping"
git push origin main
```

Expected: implementation commit is pushed to `origin/main`.

Evidence:
- Implementation commit `60e1056` (`test: guard Baron objective result mapping`) was pushed to `origin/main`.

- [x] **Step 3: Verify GitHub Actions QA**

Run:

```bash
gh run list --workflow QA --branch main --limit 8 --json databaseId,headSha,headBranch,status,conclusion,displayTitle,createdAt,url
gh run watch <run-id> --exit-status
gh run download <run-id> --dir test-artifacts/tmp/github-qa-<run-id>
```

Expected: GitHub Actions QA exits `0`, the downloaded `qa-summary.json` reports passed required checks, and sensitive-pattern scan finds no high-risk strings.

Evidence:
- GitHub Actions QA run `27164894478` passed for head SHA `60e105606cf951884db5b8a94c8ba4baec82d972`.
- Workflow artifact `7491586651` (`qa-automation-27164894478`, 3549 bytes) was downloaded and inspected.
- Artifact `qa-summary.json`: `latestRun.qaVerdict.status` `passed`, required checks `13 passed / 0 failed / 0 missing`, smoke `156 passed / 0 failed`, duration `220ms`, mode `readonly`, `latestRun.git.shortSha` `60e1056`, `dirty: false`.
- Downloaded artifact sensitive scan: `no high-risk sensitive patterns found`.

- [ ] **Step 4: Commit docs finalization and verify final sync**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-baron-objective-result-policy.md "/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md"
git diff --cached --check
git commit -m "docs: finalize Baron objective result policy"
git push origin main
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final docs commit is pushed, working tree is clean, and local/remote `main` differ by `0 0`.
