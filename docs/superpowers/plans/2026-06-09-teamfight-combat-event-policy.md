# Teamfight Combat Event Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route teamfight encounter detection and phase K/D tagging through shared player combat event helpers.

**Architecture:** Add `PLAYER_COMBAT_EVENT_TYPES` and `isPlayerCombatEvent(event)` beside the existing player kill/death helpers. Update `detectCombatEncounters()` to use the combat helper, and update `buildTeamfightPhases()` to use `isPlayerKillEvent(event)` / `isPlayerDeathEvent(event)` for K/D counts and outcome tags.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Modify: `server.js` — add player-combat Set/helper and replace teamfight-local combat event checks.
- Modify: `test-artifacts/server/teamfight-phase-tests.mjs` — inject player combat policy helper sources and add behavior/source-shape checks for `detectCombatEncounters()` and `buildTeamfightPhases()`.
- Modify: `test-artifacts/server/llm-payload-tests.mjs` — inject player combat policy helper sources into the extracted `buildLlmPayload()` harness because it evaluates `detectCombatEncounters()` and `buildTeamfightPhases()` in the same closure.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` — append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-teamfight-combat-event-policy.md` — mark steps complete and add completion evidence after verification.

### Task 1: Add RED Coverage For Teamfight Combat Policy

**Files:**
- Modify: `test-artifacts/server/teamfight-phase-tests.mjs`

- [x] **Step 1: Update test harness with policy sources**

Add these blocks after `extractConstSource()`:

```js
const playerKillPolicySources = serverSrc.includes("const PLAYER_KILL_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isPlayerKillEvent"),
    ]
  : [
      'const PLAYER_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);',
      'function isPlayerKillEvent(event) { return PLAYER_KILL_EVENT_TYPES.has(event.eventType); }',
    ];

const playerDeathPolicySources = serverSrc.includes("const PLAYER_DEATH_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    ]
  : [
      'const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);',
      'function isPlayerDeathEvent(event) { return PLAYER_DEATH_EVENT_TYPES.has(event.eventType); }',
    ];

const playerCombatPolicySources = serverSrc.includes("const PLAYER_COMBAT_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "PLAYER_COMBAT_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isPlayerCombatEvent"),
    ]
  : [
      'const PLAYER_COMBAT_EVENT_TYPES = new Set([...PLAYER_KILL_EVENT_TYPES, ...PLAYER_DEATH_EVENT_TYPES]);',
      'function isPlayerCombatEvent(event) { return PLAYER_COMBAT_EVENT_TYPES.has(event.eventType); }',
    ];
```

Then insert these sources before `extractFunctionSource(serverSrc, "buildTeamfightPhases")` in the `new Function` body:

```js
...playerKillPolicySources,
...playerDeathPolicySources,
...playerCombatPolicySources,
extractFunctionSource(serverSrc, "detectCombatEncounters"),
```

Return `detectCombatEncounters` from the harness:

```js
"return { detectCombatEncounters, buildTeamfightPhases, teamfightPhaseCoaching, teamfightTakeaway, mergeTeamfightCoaching };",
```

Update destructuring:

```js
const { detectCombatEncounters, buildTeamfightPhases, teamfightPhaseCoaching, teamfightTakeaway, mergeTeamfightCoaching } = env;
```

Add source captures:

```js
const detectCombatEncountersSrc = extractFunctionSource(serverSrc, "detectCombatEncounters");
const buildTeamfightPhasesSrc = extractFunctionSource(serverSrc, "buildTeamfightPhases");
```

- [x] **Step 2: Add behavior and source-shape checks**

Add this behavior check after the `ev` / `enc` helpers:

```js
const detected = detectCombatEncounters([
  { eventId: "d0", timestampMs: 1000, timestampLabel: "0:01", phase: "EARLY", eventType: "TOWER_TAKE", isPlayerInvolved: true },
  { eventId: "d1", timestampMs: 2000, timestampLabel: "0:02", phase: "EARLY", eventType: "CHAMPION_KILL", isPlayerInvolved: true },
  { eventId: "d2", timestampMs: 5000, timestampLabel: "0:05", phase: "EARLY", eventType: "PLAYER_DEATH", isPlayerInvolved: true },
]);
check("detectCombatEncounters keeps only player combat events", detected.map((row) => ({
  eventCount: row.eventCount,
  playerKills: row.playerKills,
  playerDeaths: row.playerDeaths,
  situation: row.situation,
  relatedEventIds: row.relatedEventIds,
})), [{
  eventCount: 2,
  playerKills: 1,
  playerDeaths: 1,
  situation: "TRADED",
  relatedEventIds: ["d1", "d2"],
}]);
```

Add these source-shape checks after the existing `eventCount<3 제외` check:

```js
checkTrue(
  "server defines PLAYER_COMBAT_EVENT_TYPES",
  serverSrc.includes("const PLAYER_COMBAT_EVENT_TYPES = new Set([...PLAYER_KILL_EVENT_TYPES, ...PLAYER_DEATH_EVENT_TYPES]);"),
);
checkTrue(
  "server defines isPlayerCombatEvent",
  serverSrc.includes("function isPlayerCombatEvent(event)"),
);
checkTrue(
  "detectCombatEncounters uses isPlayerCombatEvent",
  detectCombatEncountersSrc.includes(".filter(isPlayerCombatEvent)"),
);
checkTrue(
  "detectCombatEncounters counts kills with isPlayerKillEvent",
  detectCombatEncountersSrc.includes("if (isPlayerKillEvent(e)) playerKills += 1;"),
);
checkTrue(
  "detectCombatEncounters counts deaths with isPlayerDeathEvent",
  detectCombatEncountersSrc.includes("else if (isPlayerDeathEvent(e)) playerDeaths += 1;"),
);
checkTrue(
  "buildTeamfightPhases counts kills with isPlayerKillEvent",
  buildTeamfightPhasesSrc.includes("if (isPlayerKillEvent(e)) pk += 1;"),
);
checkTrue(
  "buildTeamfightPhases counts deaths with isPlayerDeathEvent",
  buildTeamfightPhasesSrc.includes("else if (isPlayerDeathEvent(e)) pd += 1;"),
);
checkTrue(
  "buildTeamfightPhases engage tag uses isPlayerKillEvent",
  buildTeamfightPhasesSrc.includes('isPlayerKillEvent(events[0]) ? "INITIATED_KILL" : "CAUGHT_OUT"'),
);
checkTrue(
  "buildTeamfightPhases cleanup tag uses isPlayerKillEvent",
  buildTeamfightPhasesSrc.includes("if (isPlayerKillEvent(lastEvt))"),
);
```

- [x] **Step 3: Run RED test**

Run:

```bash
node test-artifacts/server/teamfight-phase-tests.mjs
```

Expected:
- Exits 1.
- Existing behavior checks still pass.
- New behavior check passes because fallback helper sources model the desired combat event set.
- Nine new source-shape checks fail for the missing shared combat helper and teamfight helper usage.

### Task 2: Implement Shared Teamfight Combat Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add policy Set**

Add this constant after `PLAYER_DEATH_EVENT_TYPES`:

```js
const PLAYER_COMBAT_EVENT_TYPES = new Set([...PLAYER_KILL_EVENT_TYPES, ...PLAYER_DEATH_EVENT_TYPES]);
```

- [x] **Step 2: Add helper**

Add this helper after `isPlayerDeathEvent(event)`:

```js
function isPlayerCombatEvent(event) {
  return PLAYER_COMBAT_EVENT_TYPES.has(event.eventType);
}
```

- [x] **Step 3: Replace `detectCombatEncounters()` combat filtering and counting**

Remove:

```js
const COMBAT_TYPES = new Set(["CHAMPION_KILL", "PLAYER_DEATH"]);
```

Replace:

```js
.filter((e) => COMBAT_TYPES.has(e.eventType))
```

with:

```js
.filter(isPlayerCombatEvent)
```

Replace:

```js
if (e.eventType === "CHAMPION_KILL") playerKills += 1;
else if (e.eventType === "PLAYER_DEATH") playerDeaths += 1;
```

with:

```js
if (isPlayerKillEvent(e)) playerKills += 1;
else if (isPlayerDeathEvent(e)) playerDeaths += 1;
```

- [x] **Step 4: Replace `buildTeamfightPhases()` K/D and outcome checks**

Replace:

```js
if (e.eventType === "CHAMPION_KILL") pk += 1;
else if (e.eventType === "PLAYER_DEATH") pd += 1;
```

with:

```js
if (isPlayerKillEvent(e)) pk += 1;
else if (isPlayerDeathEvent(e)) pd += 1;
```

Replace:

```js
engage.outcomeTag = events[0].eventType === "CHAMPION_KILL" ? "INITIATED_KILL" : "CAUGHT_OUT";
```

with:

```js
engage.outcomeTag = isPlayerKillEvent(events[0]) ? "INITIATED_KILL" : "CAUGHT_OUT";
```

Replace:

```js
if (lastEvt.eventType === "CHAMPION_KILL") {
```

with:

```js
if (isPlayerKillEvent(lastEvt)) {
```

Replace:

```js
prevEvt.eventType === "CHAMPION_KILL" || gap > CLEANUP_GAP_MS ? "OVERCHASE_DEATH" : "DIED_IN_FIGHT";
```

with:

```js
isPlayerKillEvent(prevEvt) || gap > CLEANUP_GAP_MS ? "OVERCHASE_DEATH" : "DIED_IN_FIGHT";
```

- [x] **Step 5: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/teamfight-phase-tests.mjs
```

Expected:
- Exits 0.
- Reports `38 passed, 0 failed`.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-teamfight-combat-event-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/teamfight-phase-tests.mjs
node --check test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/server/teamfight-phase-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-combat-event-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `node --check` commands exit 0.
- Focused test exits 0.
- LLM payload extraction test exits 0.
- `npm test` exits 0.
- Read-only smoke report exits 0.
- `git diff --check` exits 0.

Local evidence recorded before commit:
- RED:
  - `node test-artifacts/server/teamfight-phase-tests.mjs`: 29 passed / 9 failed for the new teamfight combat policy source-shape checks.
- GREEN:
  - `node test-artifacts/server/teamfight-phase-tests.mjs`: 38 passed / 0 failed.
- Harness compatibility:
  - Initial `npm test` surfaced `test-artifacts/server/llm-payload-tests.mjs` failing with `ReferenceError: isPlayerCombatEvent is not defined` because the source-extraction harness evaluated `detectCombatEncounters()` without the new helper.
  - After injecting player combat policy sources, `node test-artifacts/server/llm-payload-tests.mjs`: 84 passed / 0 failed.
- Verification:
  - `node --check server.js`: exit 0.
  - `node --check test-artifacts/server/teamfight-phase-tests.mjs`: exit 0.
  - `node --check test-artifacts/server/llm-payload-tests.mjs`: exit 0.
  - `npm test`: 1531 passed / 0 failed across 43 test files.
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-combat-event-policy-local npm run smoke:report:readonly`: read-only smoke 156 passed / 0 failed, `durationMs: 268`, required checks total 13 / passed 13 / failed 0 / missing 0.
  - `git diff --check`: exit 0.
  - Plan placeholder scan: no matches.
  - Local smoke artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with local RED/GREEN evidence, `npm test`, local smoke summary, commit SHA, GitHub Actions run id, artifact id, sensitive scan result, and final `main...origin/main` sync count.

- [x] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/teamfight-phase-tests.mjs test-artifacts/server/llm-payload-tests.mjs docs/superpowers/plans/2026-06-09-teamfight-combat-event-policy.md
git diff --cached --check
git commit -m "test: share teamfight combat event policy"
git push origin main
```

Expected: commit and push succeed on `main`.

- [x] **Step 4: Verify GitHub QA**

Run:

```bash
gh run list --workflow QA --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/github-qa-<run-id>
```

Expected: QA run for the pushed commit passes, artifact summary reports smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, dirty `false`, and no high-risk sensitive-value scan matches.

Implementation evidence:
- Commit: `ee03a13 test: share teamfight combat event policy`
- Push: `origin/main`
- GitHub Actions QA: run `27156059079` passed for head SHA `ee03a13b169dd63f2cb04deabba56b2a8dd4e377`.
- Artifact: `7488060067` (`qa-automation-27156059079`, 3547 bytes) downloaded and inspected.
- Artifact summary: read-only smoke 156 passed / 0 failed, `durationMs: 217`, `latestRun.qaVerdict.status: "passed"`, `latestRun.git.shortSha: "ee03a13"`, `dirty: false`, required checks total 13 / passed 13 / failed 0 / missing 0.
- Artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 5: Mark plan complete and final sync**

Update this plan with completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-teamfight-combat-event-policy.md
git diff --cached --check
git commit -m "docs: mark teamfight combat event plan complete"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

Docs completion evidence:
- Commit: `e9609d5 docs: mark teamfight combat event plan complete`
- Push: `origin/main`
- GitHub Actions QA: run `27156161397` passed for head SHA `e9609d5fbe63af3f34c16166b2063352e5aa5838`.
- Artifact: `7488101902` (`qa-automation-27156161397`, 3550 bytes) downloaded and inspected.
- Artifact summary: read-only smoke 156 passed / 0 failed, `durationMs: 211`, `latestRun.qaVerdict.status: "passed"`, `latestRun.git.shortSha: "e9609d5"`, `dirty: false`, required checks total 13 / passed 13 / failed 0 / missing 0.
- Artifact high-risk sensitive pattern scan: no matches.

## Self-Review

- Spec coverage: The plan covers teamfight encounter detection, phase K/D counting, engage tags, and cleanup tags without changing LLM prompt/schema behavior.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `PLAYER_COMBAT_EVENT_TYPES` composes the existing player kill/death Sets, and all helpers accept event objects.
