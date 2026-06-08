# Timeline Event Type Helper Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route timeline event importance and summary text classification through shared `eventType` helper predicates.

**Architecture:** Add string-based event type helpers beside the existing event-object helpers without changing existing event-object helper bodies. Update `importanceForEvent(eventType, phase, event)` and `summaryForEvent(eventType, phase, event, playerWonObjective)` to use those helpers where they currently compare `PLAYER_DEATH`, `CHAMPION_KILL`, `TOWER_TAKE`, and fight-contribution strings directly.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Create: `test-artifacts/server/timeline-event-type-tests.mjs` — source-extraction tests for `importanceForEvent()` / `summaryForEvent()` behavior and helper usage.
- Modify: `server.js` — add `isPlayerDeathEventType(eventType)`, `isPlayerKillEventType(eventType)`, `isStructureTakeEventType(eventType)`, `isFightContributionEventType(eventType)`, and `isEliteObjectiveFightEventType(eventType)`, then update timeline text/importance functions.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` — append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-timeline-event-type-helper-policy.md` — mark steps complete and add verification evidence after each stage.

### Task 1: Add RED Coverage For Timeline Event Type Helpers

**Files:**
- Create: `test-artifacts/server/timeline-event-type-tests.mjs`

- [x] **Step 1: Create source-extraction regression test**

Create `test-artifacts/server/timeline-event-type-tests.mjs` with:

```js
// server.js timeline eventType helper policy regression tests

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

const eventTypePolicySources = [
  extractConstSource(serverSrc, "ELITE_OBJECTIVE_FIGHT_EVENT_TYPES"),
  extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
  extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
  extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
  serverSrc.includes("function isEliteObjectiveFightEventType(eventType)")
    ? extractFunctionSource(serverSrc, "isEliteObjectiveFightEventType")
    : "function isEliteObjectiveFightEventType(eventType) { return ELITE_OBJECTIVE_FIGHT_EVENT_TYPES.has(eventType); }",
  serverSrc.includes("function isStructureTakeEventType(eventType)")
    ? extractFunctionSource(serverSrc, "isStructureTakeEventType")
    : "function isStructureTakeEventType(eventType) { return STRUCTURE_TAKE_EVENT_TYPES.has(eventType); }",
  serverSrc.includes("function isPlayerKillEventType(eventType)")
    ? extractFunctionSource(serverSrc, "isPlayerKillEventType")
    : "function isPlayerKillEventType(eventType) { return PLAYER_KILL_EVENT_TYPES.has(eventType); }",
  serverSrc.includes("function isPlayerDeathEventType(eventType)")
    ? extractFunctionSource(serverSrc, "isPlayerDeathEventType")
    : "function isPlayerDeathEventType(eventType) { return PLAYER_DEATH_EVENT_TYPES.has(eventType); }",
  serverSrc.includes("function isFightContributionEventType(eventType)")
    ? extractFunctionSource(serverSrc, "isFightContributionEventType")
    : "function isFightContributionEventType(eventType) { return FIGHT_CONTRIBUTION_EVENT_TYPES.has(eventType); }",
];

const importanceForEventSrc = extractFunctionSource(serverSrc, "importanceForEvent");
const summaryForEventSrc = extractFunctionSource(serverSrc, "summaryForEvent");

const { importanceForEvent, summaryForEvent } = new Function(
  [
    ...eventTypePolicySources,
    importanceForEventSrc,
    summaryForEventSrc,
    "return { importanceForEvent, summaryForEvent };",
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

check("importance early death", importanceForEvent("PLAYER_DEATH", "EARLY", {}), 4);
check("importance late death", importanceForEvent("PLAYER_DEATH", "LATE", {}), 5);
check("importance inhibitor tower", importanceForEvent("TOWER_TAKE", "MID", { buildingType: "INHIBITOR_BUILDING" }), 5);
check("importance early tower", importanceForEvent("TOWER_TAKE", "EARLY", {}), 3);
check("importance champion kill", importanceForEvent("CHAMPION_KILL", "MID", {}), 4);
check("importance early dragon", importanceForEvent("DRAGON_FIGHT", "EARLY", {}), 4);
check("importance late baron", importanceForEvent("BARON_FIGHT", "LATE", {}), 5);
check("summary death early", summaryForEvent("PLAYER_DEATH", "EARLY", {}, false), "초반 교전에서 먼저 끊기며 템포가 흔들렸다.");
check("summary champion kill", summaryForEvent("CHAMPION_KILL", "MID", {}, false), "교전에서 직접 킬을 만들며 흐름을 당겨 왔다.");
check("summary followup", summaryForEvent("TEAMFIGHT_FOLLOWUP", "MID", {}, false), "교전 후속 합류로 킬 관여를 만들었다.");
check("summary skirmish", summaryForEvent("SKIRMISH_WIN", "MID", {}, false), "교전 후속 합류로 킬 관여를 만들었다.");
check("summary tower", summaryForEvent("TOWER_TAKE", "MID", {}, false), "구조물 압박에 관여하며 승리 조건을 구조물로 전환했다.");

checkTrue(
  "server defines isPlayerDeathEventType",
  serverSrc.includes("function isPlayerDeathEventType(eventType)"),
);
checkTrue(
  "server defines isPlayerKillEventType",
  serverSrc.includes("function isPlayerKillEventType(eventType)"),
);
checkTrue(
  "server defines isStructureTakeEventType",
  serverSrc.includes("function isStructureTakeEventType(eventType)"),
);
checkTrue(
  "server defines isFightContributionEventType",
  serverSrc.includes("function isFightContributionEventType(eventType)"),
);
checkTrue(
  "server defines isEliteObjectiveFightEventType",
  serverSrc.includes("function isEliteObjectiveFightEventType(eventType)"),
);
checkTrue(
  "importanceForEvent uses isPlayerDeathEventType",
  importanceForEventSrc.includes("isPlayerDeathEventType(eventType)"),
);
checkTrue(
  "importanceForEvent uses isPlayerKillEventType",
  importanceForEventSrc.includes("isPlayerKillEventType(eventType)"),
);
checkTrue(
  "importanceForEvent uses isStructureTakeEventType",
  importanceForEventSrc.includes("isStructureTakeEventType(eventType)"),
);
checkTrue(
  "importanceForEvent uses isEliteObjectiveFightEventType",
  importanceForEventSrc.includes("isEliteObjectiveFightEventType(eventType)"),
);
checkTrue(
  "summaryForEvent uses isPlayerDeathEventType",
  summaryForEventSrc.includes("isPlayerDeathEventType(eventType)"),
);
checkTrue(
  "summaryForEvent uses isPlayerKillEventType",
  summaryForEventSrc.includes("isPlayerKillEventType(eventType)"),
);
checkTrue(
  "summaryForEvent uses isFightContributionEventType",
  summaryForEventSrc.includes("isFightContributionEventType(eventType)"),
);
checkTrue(
  "summaryForEvent uses isStructureTakeEventType",
  summaryForEventSrc.includes("isStructureTakeEventType(eventType)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run RED test**

Run:

```bash
node test-artifacts/server/timeline-event-type-tests.mjs
```

Expected:
- Exits 1.
- Twelve behavior checks pass because fallback helper sources model the desired eventType policy.
- Thirteen source-shape checks fail because production has not yet defined or used eventType helper predicates.

RED evidence:
- `node test-artifacts/server/timeline-event-type-tests.mjs`: 12 passed / 13 failed.
- Failing checks: `server defines isPlayerDeathEventType`, `server defines isPlayerKillEventType`, `server defines isStructureTakeEventType`, `server defines isFightContributionEventType`, `server defines isEliteObjectiveFightEventType`, and eight `importanceForEvent()` / `summaryForEvent()` helper usage checks.

### Task 2: Implement Event Type Helper Predicates

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add string-based helper predicates**

Add these helpers after `isMacroObjectiveWinEvent(event)` and before `isEliteObjectiveFightEvent(event)`:

```js
function isEliteObjectiveFightEventType(eventType) {
  return ELITE_OBJECTIVE_FIGHT_EVENT_TYPES.has(eventType);
}

function isStructureTakeEventType(eventType) {
  return STRUCTURE_TAKE_EVENT_TYPES.has(eventType);
}

function isPlayerKillEventType(eventType) {
  return PLAYER_KILL_EVENT_TYPES.has(eventType);
}

function isPlayerDeathEventType(eventType) {
  return PLAYER_DEATH_EVENT_TYPES.has(eventType);
}

function isFightContributionEventType(eventType) {
  return FIGHT_CONTRIBUTION_EVENT_TYPES.has(eventType);
}
```

- [x] **Step 2: Update `importanceForEvent()`**

Replace these direct checks:

```js
if (eventType === "BARON_FIGHT") {
  return 5;
}
if (eventType === "DRAGON_FIGHT") {
  return phase === "EARLY" ? 4 : 5;
}
```

with:

```js
if (isEliteObjectiveFightEventType(eventType)) {
  return eventType === "DRAGON_FIGHT" && phase === "EARLY" ? 4 : 5;
}
```

Replace:

```js
if (eventType === "PLAYER_DEATH") {
```

with:

```js
if (isPlayerDeathEventType(eventType)) {
```

Replace:

```js
if (eventType === "TOWER_TAKE") {
```

with:

```js
if (isStructureTakeEventType(eventType)) {
```

Replace:

```js
if (eventType === "CHAMPION_KILL") {
```

with:

```js
if (isPlayerKillEventType(eventType)) {
```

- [x] **Step 3: Update `summaryForEvent()`**

Replace:

```js
if (eventType === "PLAYER_DEATH") {
```

with:

```js
if (isPlayerDeathEventType(eventType)) {
```

Replace:

```js
if (eventType === "CHAMPION_KILL") {
```

with:

```js
if (isPlayerKillEventType(eventType)) {
```

Replace:

```js
if (eventType === "TEAMFIGHT_FOLLOWUP" || eventType === "SKIRMISH_WIN") {
```

with:

```js
if (isFightContributionEventType(eventType)) {
```

Replace:

```js
if (eventType === "TOWER_TAKE") {
```

with:

```js
if (isStructureTakeEventType(eventType)) {
```

- [x] **Step 4: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/timeline-event-type-tests.mjs
```

Expected:
- Exits 0.
- Reports `25 passed, 0 failed`.

GREEN evidence:
- `node test-artifacts/server/timeline-event-type-tests.mjs`: 25 passed / 0 failed.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-timeline-event-type-helper-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/timeline-event-type-tests.mjs
node test-artifacts/server/timeline-event-type-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/timeline-event-type-helper-policy-local npm run smoke:report:readonly
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
  - `node test-artifacts/server/timeline-event-type-tests.mjs`: 12 passed / 13 failed for the new timeline eventType helper source-shape checks.
- GREEN:
  - `node test-artifacts/server/timeline-event-type-tests.mjs`: 25 passed / 0 failed.
- Verification:
  - `node --check server.js`: exit 0.
  - `node --check test-artifacts/server/timeline-event-type-tests.mjs`: exit 0.
  - `npm test`: 1560 passed / 0 failed across 44 test files.
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/timeline-event-type-helper-policy-local npm run smoke:report:readonly`: read-only smoke 156 passed / 0 failed, `durationMs: 218`, required checks total 13 / passed 13 / failed 0 / missing 0.
  - `git diff --check`: exit 0.
  - Plan placeholder scan: no matches.
  - Local smoke artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with local RED/GREEN evidence, `npm test`, local smoke summary, implementation commit SHA, GitHub Actions run id, artifact id, sensitive scan result, docs completion commit SHA, final docs GitHub Actions run id, and final `main...origin/main` sync count.

- [x] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/timeline-event-type-tests.mjs docs/superpowers/plans/2026-06-09-timeline-event-type-helper-policy.md
git diff --cached --check
git commit -m "test: share timeline event type helpers"
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
- Commit: `3a59a1e test: share timeline event type helpers`
- Push: `origin/main`
- GitHub Actions QA: run `27157367966` passed for head SHA `3a59a1ebcce1a48be1f6416f64cd7a429f702097`.
- Artifact: `7488577624` (`qa-automation-27157367966`, 3550 bytes) downloaded and inspected.
- Artifact summary: read-only smoke 156 passed / 0 failed, `durationMs: 228`, `latestRun.qaVerdict.status: "passed"`, `latestRun.git.shortSha: "3a59a1e"`, `dirty: false`, required checks total 13 / passed 13 / failed 0 / missing 0.
- Artifact high-risk sensitive pattern scan: no matches.

- [ ] **Step 5: Mark plan complete and final sync**

Update this plan with implementation and docs completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-timeline-event-type-helper-policy.md
git diff --cached --check
git commit -m "docs: finalize timeline event type helper plan"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers timeline importance scoring, summary copy, shared eventType helpers, local QA, GitHub QA, and Obsidian documentation.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: String helpers accept `eventType` strings, object helpers remain unchanged, and source-extraction tests inject only the helper sources needed for focused evaluation.
