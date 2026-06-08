# Raw Assist Participant Id Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize raw `assistingParticipantIds` array items with the same `1..10` integer-only policy used for raw killer/victim participant IDs.

**Architecture:** Keep the policy in the existing raw timeline helper layer in `server.js`. `rawAssistingParticipantIds(rawEvent)` remains the single assist-array entry point, but filters each array item through `rawParticipantId(value)` before consumers count assists or check player involvement.

**Tech Stack:** Node.js ESM regression scripts under `test-artifacts/server`, existing single-file Node server helpers in `server.js`, `npm test`, read-only smoke report QA.

---

## File Structure

- Create: `test-artifacts/server/raw-assist-participant-id-policy-tests.mjs`
  - Focused regression coverage for assist participant ID item filtering and source-shape checks.
- Modify: `server.js`
  - Update `rawAssistingParticipantIds(rawEvent)` to map/filter items through `rawParticipantId(value)`.
- Modify: `test-artifacts/server/raw-assist-array-tests.mjs`
  - Add `rawParticipantId` to the extracted helper bundle because `rawAssistingParticipantIds()` will depend on it.
- Modify: `test-artifacts/server/raw-player-involvement-tests.mjs`
  - Add `rawParticipantId` to the extracted helper bundle before `rawAssistingParticipantIds()`.
- Modify: `test-artifacts/server/raw-timeline-event-type-tests.mjs`
  - Add `rawParticipantId` to the extracted helper bundle before `rawAssistingParticipantIds()`.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
  - Record the improvement, RED/GREEN evidence, local QA, GitHub QA, and final sync status.

## Task 1: Write RED Regression Coverage

**Files:**
- Create: `test-artifacts/server/raw-assist-participant-id-policy-tests.mjs`

- [ ] **Step 1: Add the focused regression test file**

```js
// server.js raw assist participant-id policy regression tests

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

const rawParticipantSource = serverSrc.includes("function rawParticipantId(value)")
  ? extractFunctionSource(serverSrc, "rawParticipantId")
  : "function rawParticipantId(value) { return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null; }";

const rawEventPolicySources = [
  extractConstSource(serverSrc, "RAW_CHAMPION_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "RAW_ELITE_MONSTER_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "RAW_BUILDING_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "SUPPORTED_RAW_TIMELINE_EVENT_TYPES"),
  rawParticipantSource,
  extractFunctionSource(serverSrc, "isRawChampionKillEvent"),
  extractFunctionSource(serverSrc, "isRawEliteMonsterKillEvent"),
  extractFunctionSource(serverSrc, "isRawBuildingKillEvent"),
  extractFunctionSource(serverSrc, "isSupportedRawTimelineEvent"),
  serverSrc.includes("function rawAssistingParticipantIds(rawEvent)")
    ? extractFunctionSource(serverSrc, "rawAssistingParticipantIds")
    : "function rawAssistingParticipantIds(rawEvent) { return Array.isArray(rawEvent.assistingParticipantIds) ? rawEvent.assistingParticipantIds.map(rawParticipantId).filter((participantId) => participantId !== null) : []; }",
  extractFunctionSource(serverSrc, "isRawPlayerInvolved"),
  extractFunctionSource(serverSrc, "isKnownRawTeamId"),
  extractFunctionSource(serverSrc, "isRawEnemyBuildingKill"),
];

const rawAssistingParticipantIdsSrc = extractFunctionSource(serverSrc, "rawAssistingParticipantIds");
const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");

const { rawAssistingParticipantIds, isRawPlayerInvolved, buildEventType } = new Function(
  [
    ...rawEventPolicySources,
    buildEventTypeSrc,
    "return { rawAssistingParticipantIds, isRawPlayerInvolved, buildEventType };",
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

const targetParticipantId = 2;
const malformedAssistItemsEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: ["2", 11, 2.5, Infinity, 3] };
const mixedBoundaryAssistItemsEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [1, 10, 0, null, "5"] };
const malformedTargetAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: ["2"] };
const validTargetAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [2] };
const malformedMultiAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: ["2", 11, 2.5] };
const validMultiAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [2, 3] };

check("rawAssistingParticipantIds keeps valid assist ids", rawAssistingParticipantIds(validMultiAssistEvent), [2, 3]);
check("rawAssistingParticipantIds maps missing assists to []", rawAssistingParticipantIds({ type: "CHAMPION_KILL", killerId: 7, victimId: 8 }), []);
check("rawAssistingParticipantIds maps non-array assists to []", rawAssistingParticipantIds({ type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: "2,3" }), []);
check("rawAssistingParticipantIds drops malformed array items", rawAssistingParticipantIds(malformedAssistItemsEvent), [3]);
check("rawAssistingParticipantIds keeps only participant id boundaries", rawAssistingParticipantIds(mixedBoundaryAssistItemsEvent), [1, 10]);
check("isRawPlayerInvolved ignores malformed assist target strings", isRawPlayerInvolved(malformedTargetAssistEvent, targetParticipantId), false);
check("isRawPlayerInvolved keeps valid assist target numbers", isRawPlayerInvolved(validTargetAssistEvent, targetParticipantId), true);
check("buildEventType ignores malformed assist ids when counting follow-up fights", buildEventType(malformedMultiAssistEvent, targetParticipantId, 100, false), "SKIRMISH_WIN");
check("buildEventType keeps valid multi-assist follow-up classification", buildEventType(validMultiAssistEvent, targetParticipantId, 100, false), "TEAMFIGHT_FOLLOWUP");
checkTrue(
  "rawAssistingParticipantIds uses rawParticipantId mapping",
  rawAssistingParticipantIdsSrc.includes(".map(rawParticipantId)"),
);
checkTrue(
  "rawAssistingParticipantIds filters invalid participant ids",
  rawAssistingParticipantIdsSrc.includes(".filter((participantId) => participantId !== null)"),
);
checkTrue(
  "rawAssistingParticipantIds no longer returns the raw assist array directly",
  !rawAssistingParticipantIdsSrc.includes("? rawEvent.assistingParticipantIds\n    : [];"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run the RED test**

Run:

```bash
node test-artifacts/server/raw-assist-participant-id-policy-tests.mjs
```

Expected: FAIL because production `rawAssistingParticipantIds()` returns raw array items directly, so malformed arrays are not filtered and malformed multi-assist events can classify as `TEAMFIGHT_FOLLOWUP`.

## Task 2: Implement Minimal Normalization

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Change only `rawAssistingParticipantIds(rawEvent)`**

Replace:

```js
function rawAssistingParticipantIds(rawEvent) {
  return Array.isArray(rawEvent.assistingParticipantIds)
    ? rawEvent.assistingParticipantIds
    : [];
}
```

With:

```js
function rawAssistingParticipantIds(rawEvent) {
  return Array.isArray(rawEvent.assistingParticipantIds)
    ? rawEvent.assistingParticipantIds
        .map(rawParticipantId)
        .filter((participantId) => participantId !== null)
    : [];
}
```

- [ ] **Step 2: Run the focused GREEN test**

Run:

```bash
node test-artifacts/server/raw-assist-participant-id-policy-tests.mjs
```

Expected: `12 passed, 0 failed`.

## Task 3: Update Existing Extracted Helper Harnesses

**Files:**
- Modify: `test-artifacts/server/raw-assist-array-tests.mjs`
- Modify: `test-artifacts/server/raw-player-involvement-tests.mjs`
- Modify: `test-artifacts/server/raw-timeline-event-type-tests.mjs`

- [ ] **Step 1: Add `rawParticipantId` source extraction before `rawAssistingParticipantIds()`**

Add this declaration after `extractConstSource()` in each test file:

```js
const rawParticipantSource = serverSrc.includes("function rawParticipantId(value)")
  ? extractFunctionSource(serverSrc, "rawParticipantId")
  : "function rawParticipantId(value) { return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null; }";
```

Add `rawParticipantSource` to each `rawEventPolicySources` array before the `rawAssistingParticipantIds` source entry.

- [ ] **Step 2: Update the assist-array source-shape check**

In `test-artifacts/server/raw-assist-array-tests.mjs`, replace the old raw-array check with:

```js
checkTrue(
  "rawAssistingParticipantIds normalizes array items with rawParticipantId",
  serverSrc.includes("return Array.isArray(rawEvent.assistingParticipantIds)") &&
    serverSrc.includes(".map(rawParticipantId)") &&
    serverSrc.includes(".filter((participantId) => participantId !== null)") &&
    serverSrc.includes(": [];"),
);
```

- [ ] **Step 3: Run the affected harnesses**

Run:

```bash
node test-artifacts/server/raw-assist-array-tests.mjs
node test-artifacts/server/raw-player-involvement-tests.mjs
node test-artifacts/server/raw-timeline-event-type-tests.mjs
```

Expected: the three affected harnesses pass after their extracted helper bundles include `rawParticipantId`.

## Task 4: Full Local QA

**Files:**
- Verify all changed files and generated read-only smoke report.

- [ ] **Step 1: Syntax check changed JavaScript files**

Run:

```bash
node --check server.js
node --check test-artifacts/server/raw-assist-participant-id-policy-tests.mjs
node --check test-artifacts/server/raw-assist-array-tests.mjs
node --check test-artifacts/server/raw-player-involvement-tests.mjs
node --check test-artifacts/server/raw-timeline-event-type-tests.mjs
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run focused raw timeline helper tests**

Run:

```bash
node test-artifacts/server/raw-assist-participant-id-policy-tests.mjs
node test-artifacts/server/raw-assist-array-tests.mjs
node test-artifacts/server/raw-player-involvement-tests.mjs
node test-artifacts/server/raw-timeline-event-type-tests.mjs
node test-artifacts/server/raw-participant-id-policy-tests.mjs
node test-artifacts/server/raw-event-timestamp-tests.mjs
node test-artifacts/server/raw-building-team-policy-tests.mjs
```

Expected: every command exits `0`.

- [ ] **Step 3: Run full suite and read-only smoke**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-assist-participant-id-policy-local npm run smoke:report:readonly
git diff --check
```

Expected: `npm test` exits `0`, smoke report `latestRun.qaVerdict.status` is `passed`, and `git diff --check` exits `0`.

## Task 5: Docs, Commit, Push, GitHub QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-09-raw-assist-participant-id-policy.md`

- [ ] **Step 1: Update docs with QA evidence**

Record RED, GREEN, full local QA, smoke report, Git commit SHA, GitHub Actions run ID, artifact ID, and final `main...origin/main` sync evidence.

- [ ] **Step 2: Commit and push implementation**

Run:

```bash
rm -rf test-artifacts/tmp
git diff --check
git status --short --branch
git add server.js test-artifacts/server/raw-assist-participant-id-policy-tests.mjs test-artifacts/server/raw-assist-array-tests.mjs test-artifacts/server/raw-player-involvement-tests.mjs test-artifacts/server/raw-timeline-event-type-tests.mjs docs/superpowers/plans/2026-06-09-raw-assist-participant-id-policy.md
git diff --cached --check
git commit -m "test: guard raw assist participant ids"
git push origin main
```

- [ ] **Step 3: Verify GitHub Actions QA**

Run:

```bash
gh run list --workflow QA --branch main --limit 8 --json databaseId,headSha,headBranch,status,conclusion,displayTitle,createdAt,url
gh run watch <run-id> --exit-status
```

Download and inspect the smoke artifact for pass/fail counts and sensitive pattern matches.

- [ ] **Step 4: Commit final documentation and sync**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-raw-assist-participant-id-policy.md "/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md"
git diff --cached --check
git commit -m "docs: finalize raw assist participant id plan"
git push origin main
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and `0 0`.

## Execution Evidence

### 2026-06-09 04:42 KST - Local TDD and QA

- RED:
  - `node test-artifacts/server/raw-assist-participant-id-policy-tests.mjs`
  - Result: 6 passed / 6 failed.
  - Expected failures confirmed: malformed assist array items were returned unchanged, malformed multi-assist arrays inflated `buildEventType()` to `TEAMFIGHT_FOLLOWUP`, and source-shape checks did not find `.map(rawParticipantId)` / invalid-ID filtering.
- GREEN:
  - `node test-artifacts/server/raw-assist-participant-id-policy-tests.mjs`: 12 passed / 0 failed.
  - `node test-artifacts/server/raw-assist-array-tests.mjs`: 13 passed / 0 failed.
  - `node test-artifacts/server/raw-player-involvement-tests.mjs`: 12 passed / 0 failed.
  - `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: 31 passed / 0 failed.
- Focused adjacent policy QA:
  - `node --check server.js && node --check test-artifacts/server/raw-assist-participant-id-policy-tests.mjs && node --check test-artifacts/server/raw-assist-array-tests.mjs && node --check test-artifacts/server/raw-player-involvement-tests.mjs && node --check test-artifacts/server/raw-timeline-event-type-tests.mjs`: exit 0.
  - `node test-artifacts/server/raw-participant-id-policy-tests.mjs`: 17 passed / 0 failed.
  - `node test-artifacts/server/raw-event-timestamp-tests.mjs`: 15 passed / 0 failed.
  - `node test-artifacts/server/raw-building-team-policy-tests.mjs`: 28 passed / 0 failed.
- Full local QA:
  - `npm test`: 1688 passed / 0 failed across 51 test file(s).
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-assist-participant-id-policy-local npm run smoke:report:readonly`: 156 passed / 0 failed.
  - Smoke summary: `latestRun.qaVerdict.status: "passed"`, required checks total 13 / passed 13 / failed 0 / missing 0, `durationMs: 238`, mode `readonly`.
  - Local smoke artifact high-risk sensitive pattern scan: no matches for Riot key, Authorization/Bearer, Riot host, local user path, `api_key`, or `secret.json`.
  - `git diff --check`: exit 0.
