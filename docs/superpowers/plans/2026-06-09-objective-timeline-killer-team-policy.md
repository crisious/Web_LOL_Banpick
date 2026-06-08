# Objective Timeline Killer Team Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make objective timeline monster ownership use Riot's numeric `killerTeamId` when it is available, while preserving sanitized participant-ID fallback behavior.

**Architecture:** Add one focused helper in `server.js` that resolves objective killer team ownership from raw timeline events. `buildObjectiveTimeline()` will call that helper instead of directly reading `participantTeamMap.get(event.killerId)`, keeping UI-facing team labels unchanged as `ALLY` or `ENEMY`.

**Tech Stack:** Node.js ESM regression scripts under `test-artifacts/server`, existing single-file Node server helpers in `server.js`, `npm test`, read-only smoke report QA, GitHub Actions QA workflow.

---

## File Structure

- Create: `test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`
  - Verifies objective timeline ownership when `ELITE_MONSTER_KILL` has known numeric `killerTeamId`, malformed IDs, neutral teams, and a structure event regression.
  - Verifies the new helper source shape so future edits keep raw team validation and sanitized participant fallback.
- Modify: `server.js`
  - Add `objectiveKillerTeamId(event, participantTeamMap)` near objective timeline helpers.
  - Replace the direct `participantTeamMap.get(event.killerId)` lookup in `buildObjectiveTimeline()`.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
  - Record the improvement, RED/GREEN evidence, local QA, GitHub QA, and final sync status.

## Task 1: Write RED Regression Coverage

**Files:**
- Create: `test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`

- [x] **Step 1: Add the focused regression test file**

```js
// server.js objective timeline killer team policy regression tests

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

function functionSourceOrFallback(source, name, fallback) {
  return source.includes(`function ${name}(`)
    ? extractFunctionSource(source, name)
    : fallback;
}

const objectiveKillerTeamIdSrc = functionSourceOrFallback(
  serverSrc,
  "objectiveKillerTeamId",
  "function objectiveKillerTeamId(event, participantTeamMap) { const mappedTeamId = participantTeamMap.get(event.killerId); return mappedTeamId === 100 || mappedTeamId === 200 ? mappedTeamId : null; }",
);
const buildObjectiveTimelineSrc = extractFunctionSource(serverSrc, "buildObjectiveTimeline");

const { objectiveKillerTeamId, buildObjectiveTimeline } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawParticipantId"),
    extractFunctionSource(serverSrc, "isKnownRawTeamId"),
    extractFunctionSource(serverSrc, "buildStructureLabel"),
    extractFunctionSource(serverSrc, "buildObjectiveLabel"),
    objectiveKillerTeamIdSrc,
    buildObjectiveTimelineSrc,
    "return { objectiveKillerTeamId, buildObjectiveTimeline };",
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

const participantTeamMap = new Map([[2, 100], [7, 200]]);
const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "ELITE_MONSTER_KILL", timestamp: 1000, killerId: null, killerTeamId: 100, monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 2000, killerId: null, killerTeamId: 200, monsterType: "BARON_NASHOR" },
          { type: "ELITE_MONSTER_KILL", timestamp: 3000, killerId: "2", killerTeamId: "100", monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 4000, killerId: 2, killerTeamId: "100", monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 5000, killerId: 0, killerTeamId: 300, monsterType: "RIFTHERALD" },
          { type: "BUILDING_KILL", timestamp: 6000, teamId: 200, buildingType: "TOWER_BUILDING", towerType: "OUTER_TURRET", laneType: "MID_LANE" },
        ],
      },
    ],
  },
};

const events = buildObjectiveTimeline(timeline, 100, participantTeamMap);
check("known raw killerTeamId 100 marks objective as ally", events[0]?.team, "ALLY");
check("known raw killerTeamId 200 marks objective as enemy", events[1]?.team, "ENEMY");
check("string killerTeamId with string killerId stays conservative enemy", events[2]?.team, "ENEMY");
check("malformed killerTeamId falls back to valid numeric killerId", events[3]?.team, "ALLY");
check("neutral or unknown killer team stays conservative enemy", events[4]?.team, "ENEMY");
check("building team direction remains unchanged", events[5]?.team, "ALLY");

check("helper uses known killerTeamId without participant fallback", objectiveKillerTeamId({ killerTeamId: 100, killerId: null }, participantTeamMap), 100);
check("helper prioritizes known killerTeamId over conflicting killerId fallback", objectiveKillerTeamId({ killerTeamId: 200, killerId: 2 }, participantTeamMap), 200);
check("helper falls back through sanitized numeric killerId", objectiveKillerTeamId({ killerTeamId: "100", killerId: 2 }, participantTeamMap), 100);
check("helper rejects string team and string participant ids", objectiveKillerTeamId({ killerTeamId: "100", killerId: "2" }, participantTeamMap), null);
check("helper rejects neutral team and neutral participant id", objectiveKillerTeamId({ killerTeamId: 300, killerId: 0 }, participantTeamMap), null);

checkTrue(
  "server defines objectiveKillerTeamId",
  serverSrc.includes("function objectiveKillerTeamId(event, participantTeamMap)"),
);
checkTrue(
  "objectiveKillerTeamId validates raw killerTeamId",
  objectiveKillerTeamIdSrc.includes("isKnownRawTeamId(event.killerTeamId)"),
);
checkTrue(
  "objectiveKillerTeamId sanitizes fallback killerId",
  objectiveKillerTeamIdSrc.includes("rawParticipantId(event.killerId)"),
);
checkTrue(
  "buildObjectiveTimeline uses objectiveKillerTeamId",
  buildObjectiveTimelineSrc.includes("const killerTeam = objectiveKillerTeamId(event, participantTeamMap);"),
);
checkTrue(
  "buildObjectiveTimeline no longer reads event.killerId directly from the map",
  !buildObjectiveTimelineSrc.includes("participantTeamMap.get(event.killerId)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run the RED test**

Run:

```bash
node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
```

Expected: FAIL because current production code ignores numeric raw `killerTeamId` in `buildObjectiveTimeline()` and has no `objectiveKillerTeamId()` helper.

Evidence:
- `node --check test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: exit `0`.
- `node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: `8 passed, 8 failed`.
- Expected failures included known raw `killerTeamId: 100` rendering as `ENEMY`, helper absence, missing raw team validation, missing sanitized fallback, and direct `participantTeamMap.get(event.killerId)` use.

## Task 2: Implement Minimal Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add helper near objective timeline label helpers**

```js
function objectiveKillerTeamId(event, participantTeamMap) {
  if (isKnownRawTeamId(event.killerTeamId)) {
    return event.killerTeamId;
  }
  const killerId = rawParticipantId(event.killerId);
  if (killerId === null) {
    return null;
  }
  const mappedTeamId = participantTeamMap.get(killerId);
  return isKnownRawTeamId(mappedTeamId) ? mappedTeamId : null;
}
```

- [x] **Step 2: Route objective timeline team lookup through the helper**

Replace:

```js
const killerTeam = participantTeamMap.get(event.killerId);
```

With:

```js
const killerTeam = objectiveKillerTeamId(event, participantTeamMap);
```

- [x] **Step 3: Run the focused GREEN test**

Run:

```bash
node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
```

Expected: `16 passed, 0 failed`.

Evidence:
- `node --check server.js && node --check test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: exit `0`.
- `node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: `16 passed, 0 failed`.

## Task 3: Local QA

**Files:**
- Verify changed code and adjacent raw timeline policies.

- [x] **Step 1: Syntax check changed JavaScript**

Run:

```bash
node --check server.js
node --check test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
```

Expected: both commands exit `0`.

- [x] **Step 2: Run focused regression tests**

Run:

```bash
node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
node test-artifacts/server/raw-participant-id-policy-tests.mjs
node test-artifacts/server/raw-building-team-policy-tests.mjs
node test-artifacts/server/participant-team-policy-tests.mjs
node test-artifacts/server/sample-bundle-error-tests.mjs
node test-artifacts/server/samples-dir-tests.mjs
```

Expected: every command exits `0`.

- [x] **Step 3: Run full suite and read-only smoke**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-timeline-killer-team-policy-local npm run smoke:report:readonly
git diff --check
```

Expected: `npm test` exits `0`, smoke report `latestRun.qaVerdict.status` is `passed`, and `git diff --check` exits `0`.

Evidence captured at `2026-06-09 05:05 KST`:
- `node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: `16 passed, 0 failed`.
- `node test-artifacts/server/raw-participant-id-policy-tests.mjs`: `17 passed, 0 failed`.
- `node test-artifacts/server/raw-building-team-policy-tests.mjs`: `28 passed, 0 failed`.
- `node test-artifacts/server/participant-team-policy-tests.mjs`: `13 passed, 0 failed`.
- `node test-artifacts/server/sample-bundle-error-tests.mjs`: `13 passed, 0 failed`.
- `node test-artifacts/server/samples-dir-tests.mjs`: `21 passed, 0 failed`.
- `npm test`: `1717 passed, 0 failed across 53 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-timeline-killer-team-policy-local npm run smoke:report:readonly`: exit `0`.
- `test-artifacts/tmp/objective-timeline-killer-team-policy-local/qa-summary.json`: `latestRun.qaVerdict.status` `passed`, required checks `13 passed / 0 failed / 0 missing`, smoke `156 passed / 0 failed`, duration `234ms`, mode `readonly`.
- Local smoke artifact sensitive scan: `no high-risk sensitive patterns found`.
- `git diff --check`: exit `0`.

## Task 4: Docs, Commit, Push, GitHub QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-objective-timeline-killer-team-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Update docs with QA evidence**

Record RED, GREEN, full local QA, smoke report, Git commit SHA, GitHub Actions run ID, artifact ID, and final `main...origin/main` sync evidence.

- [ ] **Step 2: Commit and push implementation**

Run:

```bash
rm -rf test-artifacts/tmp
git diff --check
git status --short --branch
git add server.js test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs docs/superpowers/plans/2026-06-09-objective-timeline-killer-team-policy.md
git diff --cached --check
git commit -m "test: guard objective timeline team mapping"
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
git add docs/superpowers/plans/2026-06-09-objective-timeline-killer-team-policy.md "/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md"
git diff --cached --check
git commit -m "docs: finalize objective timeline team policy"
git push origin main
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final docs commit is pushed, working tree is clean, and local/remote `main` differ by `0 0`.
