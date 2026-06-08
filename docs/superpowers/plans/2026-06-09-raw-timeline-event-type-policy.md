# Raw Timeline Event Type Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Riot raw timeline event type classification through shared helper predicates.

**Architecture:** Add raw event type Sets and helper predicates for `CHAMPION_KILL`, `ELITE_MONSTER_KILL`, and `BUILDING_KILL`. Update `buildEventType()`, `shouldKeepEvent()`, and `extractTimelineEvents()` to use those helpers for raw event type gates while leaving monster type and team ownership logic unchanged.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Create: `test-artifacts/server/raw-timeline-event-type-tests.mjs` — source-extraction tests for raw event type helper behavior and usage.
- Modify: `server.js` — add raw event type Sets/helpers and replace repeated `rawEvent.type` comparisons.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` — append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-raw-timeline-event-type-policy.md` — mark steps complete and add verification evidence after each stage.

### Task 1: Add RED Coverage For Raw Timeline Event Type Policy

**Files:**
- Create: `test-artifacts/server/raw-timeline-event-type-tests.mjs`

- [x] **Step 1: Create source-extraction regression test**

Create `test-artifacts/server/raw-timeline-event-type-tests.mjs` with:

```js
// server.js raw timeline event type policy regression tests

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

const rawEventPolicySources = [
  serverSrc.includes("const RAW_CHAMPION_KILL_EVENT_TYPES =")
    ? extractConstSource(serverSrc, "RAW_CHAMPION_KILL_EVENT_TYPES")
    : 'const RAW_CHAMPION_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);',
  serverSrc.includes("const RAW_ELITE_MONSTER_KILL_EVENT_TYPES =")
    ? extractConstSource(serverSrc, "RAW_ELITE_MONSTER_KILL_EVENT_TYPES")
    : 'const RAW_ELITE_MONSTER_KILL_EVENT_TYPES = new Set(["ELITE_MONSTER_KILL"]);',
  serverSrc.includes("const RAW_BUILDING_KILL_EVENT_TYPES =")
    ? extractConstSource(serverSrc, "RAW_BUILDING_KILL_EVENT_TYPES")
    : 'const RAW_BUILDING_KILL_EVENT_TYPES = new Set(["BUILDING_KILL"]);',
  serverSrc.includes("const SUPPORTED_RAW_TIMELINE_EVENT_TYPES =")
    ? extractConstSource(serverSrc, "SUPPORTED_RAW_TIMELINE_EVENT_TYPES")
    : 'const SUPPORTED_RAW_TIMELINE_EVENT_TYPES = new Set([...RAW_CHAMPION_KILL_EVENT_TYPES, ...RAW_ELITE_MONSTER_KILL_EVENT_TYPES, ...RAW_BUILDING_KILL_EVENT_TYPES]);',
  serverSrc.includes("function isRawChampionKillEvent(rawEvent)")
    ? extractFunctionSource(serverSrc, "isRawChampionKillEvent")
    : "function isRawChampionKillEvent(rawEvent) { return RAW_CHAMPION_KILL_EVENT_TYPES.has(rawEvent.type); }",
  serverSrc.includes("function isRawEliteMonsterKillEvent(rawEvent)")
    ? extractFunctionSource(serverSrc, "isRawEliteMonsterKillEvent")
    : "function isRawEliteMonsterKillEvent(rawEvent) { return RAW_ELITE_MONSTER_KILL_EVENT_TYPES.has(rawEvent.type); }",
  serverSrc.includes("function isRawBuildingKillEvent(rawEvent)")
    ? extractFunctionSource(serverSrc, "isRawBuildingKillEvent")
    : "function isRawBuildingKillEvent(rawEvent) { return RAW_BUILDING_KILL_EVENT_TYPES.has(rawEvent.type); }",
  serverSrc.includes("function isSupportedRawTimelineEvent(rawEvent)")
    ? extractFunctionSource(serverSrc, "isSupportedRawTimelineEvent")
    : "function isSupportedRawTimelineEvent(rawEvent) { return SUPPORTED_RAW_TIMELINE_EVENT_TYPES.has(rawEvent.type); }",
];

const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");
const shouldKeepEventSrc = extractFunctionSource(serverSrc, "shouldKeepEvent");
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const { buildEventType, shouldKeepEvent } = new Function(
  [
    ...rawEventPolicySources,
    buildEventTypeSrc,
    shouldKeepEventSrc,
    "return { buildEventType, shouldKeepEvent };",
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

const championKill = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [2, 3], teamId: null };
const playerKill = { type: "CHAMPION_KILL", killerId: 2, victimId: 7, assistingParticipantIds: [], teamId: null };
const playerDeath = { type: "CHAMPION_KILL", killerId: 7, victimId: 2, assistingParticipantIds: [], teamId: null };
const dragon = { type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", killerId: 7, victimId: null, assistingParticipantIds: [], teamId: null };
const baron = { type: "ELITE_MONSTER_KILL", monsterType: "BARON_NASHOR", killerId: 7, victimId: null, assistingParticipantIds: [], teamId: null };
const horde = { type: "ELITE_MONSTER_KILL", monsterType: "HORDE", killerId: 2, victimId: null, assistingParticipantIds: [], teamId: null };
const enemyTower = { type: "BUILDING_KILL", killerId: 2, victimId: null, assistingParticipantIds: [], teamId: 200 };
const ownTower = { type: "BUILDING_KILL", killerId: 7, victimId: null, assistingParticipantIds: [], teamId: 100 };
const wardKill = { type: "WARD_KILL", killerId: 2, victimId: null, assistingParticipantIds: [], teamId: null };

check("buildEventType player kill", buildEventType(playerKill, 2, 100, false), "CHAMPION_KILL");
check("buildEventType player death", buildEventType(playerDeath, 2, 100, false), "PLAYER_DEATH");
check("buildEventType assisted multi fight", buildEventType(championKill, 2, 100, false), "TEAMFIGHT_FOLLOWUP");
check("buildEventType dragon won", buildEventType(dragon, 2, 100, true), "DRAGON_FIGHT");
check("buildEventType dragon lost", buildEventType(dragon, 2, 100, false), "OBJECTIVE_SETUP_FAIL");
check("buildEventType baron", buildEventType(baron, 2, 100, false), "BARON_FIGHT");
check("buildEventType horde won", buildEventType(horde, 2, 100, true), "OBJECTIVE_SETUP_WIN");
check("buildEventType enemy tower", buildEventType(enemyTower, 2, 100, false), "TOWER_TAKE");
check("buildEventType own tower lost", buildEventType(ownTower, 2, 100, false), "OBJECTIVE_SETUP_FAIL");
check("shouldKeep player involved champion kill", shouldKeepEvent(playerKill, 2, 100), true);
check("shouldKeep non-involved champion kill", shouldKeepEvent({ ...championKill, assistingParticipantIds: [] }, 2, 100), false);
check("shouldKeep elite monster", shouldKeepEvent(dragon, 2, 100), true);
check("shouldKeep enemy tower", shouldKeepEvent(enemyTower, 2, 100), true);
check("shouldKeep unsupported raw event", shouldKeepEvent(wardKill, 2, 100), false);

checkTrue(
  "server defines RAW_CHAMPION_KILL_EVENT_TYPES",
  serverSrc.includes('const RAW_CHAMPION_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);'),
);
checkTrue(
  "server defines RAW_ELITE_MONSTER_KILL_EVENT_TYPES",
  serverSrc.includes('const RAW_ELITE_MONSTER_KILL_EVENT_TYPES = new Set(["ELITE_MONSTER_KILL"]);'),
);
checkTrue(
  "server defines RAW_BUILDING_KILL_EVENT_TYPES",
  serverSrc.includes('const RAW_BUILDING_KILL_EVENT_TYPES = new Set(["BUILDING_KILL"]);'),
);
checkTrue(
  "server defines SUPPORTED_RAW_TIMELINE_EVENT_TYPES",
  serverSrc.includes("const SUPPORTED_RAW_TIMELINE_EVENT_TYPES = new Set([...RAW_CHAMPION_KILL_EVENT_TYPES, ...RAW_ELITE_MONSTER_KILL_EVENT_TYPES, ...RAW_BUILDING_KILL_EVENT_TYPES]);"),
);
checkTrue(
  "server defines isRawChampionKillEvent",
  serverSrc.includes("function isRawChampionKillEvent(rawEvent)"),
);
checkTrue(
  "server defines isRawEliteMonsterKillEvent",
  serverSrc.includes("function isRawEliteMonsterKillEvent(rawEvent)"),
);
checkTrue(
  "server defines isRawBuildingKillEvent",
  serverSrc.includes("function isRawBuildingKillEvent(rawEvent)"),
);
checkTrue(
  "server defines isSupportedRawTimelineEvent",
  serverSrc.includes("function isSupportedRawTimelineEvent(rawEvent)"),
);
checkTrue(
  "buildEventType uses isRawChampionKillEvent",
  buildEventTypeSrc.includes("if (isRawChampionKillEvent(rawEvent))"),
);
checkTrue(
  "buildEventType uses isRawEliteMonsterKillEvent",
  buildEventTypeSrc.includes("if (isRawEliteMonsterKillEvent(rawEvent))"),
);
checkTrue(
  "buildEventType uses isRawBuildingKillEvent",
  buildEventTypeSrc.includes("if (isRawBuildingKillEvent(rawEvent))"),
);
checkTrue(
  "shouldKeepEvent uses isRawChampionKillEvent",
  shouldKeepEventSrc.includes("if (isRawChampionKillEvent(rawEvent))"),
);
checkTrue(
  "shouldKeepEvent uses isRawEliteMonsterKillEvent",
  shouldKeepEventSrc.includes("if (isRawEliteMonsterKillEvent(rawEvent))"),
);
checkTrue(
  "shouldKeepEvent uses isRawBuildingKillEvent",
  shouldKeepEventSrc.includes("if (isRawBuildingKillEvent(rawEvent))"),
);
checkTrue(
  "extractTimelineEvents uses isSupportedRawTimelineEvent",
  extractTimelineEventsSrc.includes("if (!isSupportedRawTimelineEvent(rawEvent))"),
);
checkTrue(
  "extractTimelineEvents horde dedupe uses isRawEliteMonsterKillEvent",
  extractTimelineEventsSrc.includes("isRawEliteMonsterKillEvent(rawEvent) &&\n        rawEvent.monsterType === \"HORDE\""),
);
checkTrue(
  "extractTimelineEvents horde timestamp uses isRawEliteMonsterKillEvent",
  extractTimelineEventsSrc.includes('if (isRawEliteMonsterKillEvent(rawEvent) && rawEvent.monsterType === "HORDE")'),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run RED test**

Run:

```bash
node test-artifacts/server/raw-timeline-event-type-tests.mjs
```

Expected:
- Exits 1.
- Fourteen behavior checks pass because fallback helper sources model the desired raw event type policy.
- Seventeen source-shape checks fail because production has not yet defined or used raw event helper predicates.

RED evidence:
- Initial test fixture had the target player as `victimId` for the assisted fight and non-involved cases, so two behavior checks failed for the wrong reason.
- After correcting the fixture, `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: 14 passed / 17 failed.
- Failing checks: raw event Set/helper definitions and `buildEventType()` / `shouldKeepEvent()` / `extractTimelineEvents()` helper usage checks.

### Task 2: Implement Raw Timeline Event Type Helpers

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add raw event type Sets**

Add these constants after `const PUBLIC_DIR = __dirname;`:

```js
const RAW_CHAMPION_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);
const RAW_ELITE_MONSTER_KILL_EVENT_TYPES = new Set(["ELITE_MONSTER_KILL"]);
const RAW_BUILDING_KILL_EVENT_TYPES = new Set(["BUILDING_KILL"]);
const SUPPORTED_RAW_TIMELINE_EVENT_TYPES = new Set([...RAW_CHAMPION_KILL_EVENT_TYPES, ...RAW_ELITE_MONSTER_KILL_EVENT_TYPES, ...RAW_BUILDING_KILL_EVENT_TYPES]);
```

- [x] **Step 2: Add raw event helper predicates**

Add these helpers after `phaseFor(timestampMs)`:

```js
function isRawChampionKillEvent(rawEvent) {
  return RAW_CHAMPION_KILL_EVENT_TYPES.has(rawEvent.type);
}

function isRawEliteMonsterKillEvent(rawEvent) {
  return RAW_ELITE_MONSTER_KILL_EVENT_TYPES.has(rawEvent.type);
}

function isRawBuildingKillEvent(rawEvent) {
  return RAW_BUILDING_KILL_EVENT_TYPES.has(rawEvent.type);
}

function isSupportedRawTimelineEvent(rawEvent) {
  return SUPPORTED_RAW_TIMELINE_EVENT_TYPES.has(rawEvent.type);
}
```

- [x] **Step 3: Update `buildEventType()` raw type gates**

Replace:

```js
if (rawEvent.type === "CHAMPION_KILL") {
```

with:

```js
if (isRawChampionKillEvent(rawEvent)) {
```

Replace:

```js
if (rawEvent.type === "ELITE_MONSTER_KILL") {
```

with:

```js
if (isRawEliteMonsterKillEvent(rawEvent)) {
```

Replace:

```js
if (rawEvent.type === "BUILDING_KILL") {
```

with:

```js
if (isRawBuildingKillEvent(rawEvent)) {
```

- [x] **Step 4: Update `shouldKeepEvent()` raw type gates**

Make the same three replacements in `shouldKeepEvent()`:

```js
if (isRawChampionKillEvent(rawEvent)) {
  return playerInvolved;
}

if (isRawEliteMonsterKillEvent(rawEvent)) {
  return true;
}

if (isRawBuildingKillEvent(rawEvent)) {
  return playerInvolved || rawEvent.teamId !== targetTeamId;
}
```

- [x] **Step 5: Update `extractTimelineEvents()` raw type gates**

Replace the unsupported raw event guard:

```js
if (
  rawEvent.type !== "CHAMPION_KILL" &&
  rawEvent.type !== "ELITE_MONSTER_KILL" &&
  rawEvent.type !== "BUILDING_KILL"
) {
  return;
}
```

with:

```js
if (!isSupportedRawTimelineEvent(rawEvent)) {
  return;
}
```

Replace both horde branches:

```js
rawEvent.type === "ELITE_MONSTER_KILL" &&
```

and:

```js
if (rawEvent.type === "ELITE_MONSTER_KILL" && rawEvent.monsterType === "HORDE") {
```

with:

```js
isRawEliteMonsterKillEvent(rawEvent) &&
```

and:

```js
if (isRawEliteMonsterKillEvent(rawEvent) && rawEvent.monsterType === "HORDE") {
```

- [x] **Step 6: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/raw-timeline-event-type-tests.mjs
```

Expected:
- Exits 0.
- Reports `31 passed, 0 failed`.

GREEN evidence:
- `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: 31 passed / 0 failed.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-raw-timeline-event-type-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/raw-timeline-event-type-tests.mjs
node test-artifacts/server/raw-timeline-event-type-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-timeline-event-type-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `node --check` commands exit 0.
- Focused test exits 0.
- `npm test` exits 0.
- Read-only smoke report exits 0.
- `git diff --check` exits 0.

Local evidence recorded before commit:
- RED:
  - `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: 14 passed / 17 failed after correcting the test fixture.
- GREEN:
  - `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: 31 passed / 0 failed.
- Verification:
  - `node --check server.js`: exit 0.
  - `node --check test-artifacts/server/raw-timeline-event-type-tests.mjs`: exit 0.
  - `npm test`: 1591 passed / 0 failed across 45 test files.
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-timeline-event-type-policy-local npm run smoke:report:readonly`: read-only smoke 156 passed / 0 failed, `durationMs: 225`, required checks total 13 / passed 13 / failed 0 / missing 0.
  - `git diff --check`: exit 0.
  - Plan placeholder scan: no matches.
  - Local smoke artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with local RED/GREEN evidence, `npm test`, local smoke summary, implementation commit SHA, GitHub Actions run id, artifact id, sensitive scan result, docs completion commit SHA, final docs GitHub Actions run id, and final `main...origin/main` sync count.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/raw-timeline-event-type-tests.mjs docs/superpowers/plans/2026-06-09-raw-timeline-event-type-policy.md
git diff --cached --check
git commit -m "test: share raw timeline event type helpers"
git push origin main
```

Expected: commit and push succeed on `main`.

- [ ] **Step 4: Verify GitHub QA**

Run:

```bash
gh run list --workflow QA --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/github-qa-<run-id>
```

Expected: QA run for the pushed commit passes, artifact summary reports smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, dirty `false`, and no high-risk sensitive-value scan matches.

- [ ] **Step 5: Mark plan complete and final sync**

Update this plan with implementation and docs completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-raw-timeline-event-type-policy.md
git diff --cached --check
git commit -m "docs: finalize raw timeline event type plan"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers raw event type gates in `buildEventType()`, `shouldKeepEvent()`, and `extractTimelineEvents()` without changing monster type classification or team ownership behavior.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: Raw helpers accept raw Riot event objects, and normalized timeline event helpers remain unchanged.
