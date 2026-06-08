# Raw Assist Array Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Riot raw timeline assist-array normalization through one shared helper.

**Architecture:** Add `rawAssistingParticipantIds(rawEvent)` beside the raw timeline helpers. Update `isRawPlayerInvolved()` and `buildEventType()` to use it so missing or malformed `assistingParticipantIds` values are treated as an empty assist list everywhere raw assist data is consumed.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Create: `test-artifacts/server/raw-assist-array-tests.mjs` - behavior and source-shape tests for raw assist-array normalization.
- Modify: `server.js` - add `rawAssistingParticipantIds()` and use it in raw involvement and event type classification.
- Modify: `test-artifacts/server/raw-player-involvement-tests.mjs` - include the new helper source/fallback because `isRawPlayerInvolved()` depends on it.
- Modify: `test-artifacts/server/raw-timeline-event-type-tests.mjs` - include the new helper source/fallback because `buildEventType()` and `isRawPlayerInvolved()` depend on it.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` - append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-raw-assist-array-helper.md` - mark steps complete and add evidence after each stage.

### Task 1: Add RED Coverage For Raw Assist Array Normalization

**Files:**
- Create: `test-artifacts/server/raw-assist-array-tests.mjs`

- [x] **Step 1: Create source-extraction regression test**

Create `test-artifacts/server/raw-assist-array-tests.mjs` with:

```js
// server.js raw assist-array helper regression tests

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
  extractConstSource(serverSrc, "RAW_CHAMPION_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "RAW_ELITE_MONSTER_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "RAW_BUILDING_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "SUPPORTED_RAW_TIMELINE_EVENT_TYPES"),
  extractFunctionSource(serverSrc, "isRawChampionKillEvent"),
  extractFunctionSource(serverSrc, "isRawEliteMonsterKillEvent"),
  extractFunctionSource(serverSrc, "isRawBuildingKillEvent"),
  extractFunctionSource(serverSrc, "isSupportedRawTimelineEvent"),
  serverSrc.includes("function rawAssistingParticipantIds(rawEvent)")
    ? extractFunctionSource(serverSrc, "rawAssistingParticipantIds")
    : "function rawAssistingParticipantIds(rawEvent) { return Array.isArray(rawEvent.assistingParticipantIds) ? rawEvent.assistingParticipantIds : []; }",
  extractFunctionSource(serverSrc, "isRawPlayerInvolved"),
];

const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");
const isRawPlayerInvolvedSrc = extractFunctionSource(serverSrc, "isRawPlayerInvolved");

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
function safeCall(fn) {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

const targetParticipantId = 2;
const normalAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [2, 3] };
const missingAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8 };
const malformedAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: "2,3" };

check("rawAssistingParticipantIds keeps arrays", rawAssistingParticipantIds(normalAssistEvent), [2, 3]);
check("rawAssistingParticipantIds maps missing assists to []", rawAssistingParticipantIds(missingAssistEvent), []);
check("rawAssistingParticipantIds maps malformed assists to []", rawAssistingParticipantIds(malformedAssistEvent), []);
check("isRawPlayerInvolved detects normalized assist arrays", isRawPlayerInvolved(normalAssistEvent, targetParticipantId), true);
check("isRawPlayerInvolved treats malformed assists as no involvement", isRawPlayerInvolved(malformedAssistEvent, targetParticipantId), false);
check("buildEventType missing assists does not throw", safeCall(() => buildEventType(missingAssistEvent, targetParticipantId, 100, false)), { ok: true, value: "SKIRMISH_WIN" });
check("buildEventType malformed assists does not throw", safeCall(() => buildEventType(malformedAssistEvent, targetParticipantId, 100, false)), { ok: true, value: "SKIRMISH_WIN" });

checkTrue(
  "server defines rawAssistingParticipantIds",
  serverSrc.includes("function rawAssistingParticipantIds(rawEvent)"),
);
checkTrue(
  "rawAssistingParticipantIds guards with Array.isArray",
  serverSrc.includes("return Array.isArray(rawEvent.assistingParticipantIds)") &&
    serverSrc.includes("? rawEvent.assistingParticipantIds") &&
    serverSrc.includes(": [];"),
);
checkTrue(
  "isRawPlayerInvolved uses rawAssistingParticipantIds",
  isRawPlayerInvolvedSrc.includes("const assistingParticipantIds = rawAssistingParticipantIds(rawEvent);"),
);
checkTrue(
  "isRawPlayerInvolved no longer owns Array.isArray guard",
  !isRawPlayerInvolvedSrc.includes("Array.isArray(rawEvent.assistingParticipantIds)"),
);
checkTrue(
  "buildEventType uses rawAssistingParticipantIds for assist count",
  buildEventTypeSrc.includes("rawAssistingParticipantIds(rawEvent).length > 1"),
);
checkTrue(
  "buildEventType no longer directly reads assistingParticipantIds.length",
  !buildEventTypeSrc.includes("rawEvent.assistingParticipantIds.length"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run RED test**

Run:

```bash
node test-artifacts/server/raw-assist-array-tests.mjs
```

Expected:
- Exits 1.
- Direct helper fallback behavior checks pass.
- Current production `buildEventType()` throws when `assistingParticipantIds` is missing, and source-shape checks fail because `rawAssistingParticipantIds()` is not yet defined or used.

RED evidence:
- `node test-artifacts/server/raw-assist-array-tests.mjs`: 5 passed / 8 failed.
- Failing behavior checks:
  - Missing `assistingParticipantIds` makes `buildEventType()` throw `Cannot read properties of undefined (reading 'length')`.
  - Malformed string `assistingParticipantIds` returns `TEAMFIGHT_FOLLOWUP` instead of `SKIRMISH_WIN` because the current code reads string `.length`.
- Failing source-shape checks: `rawAssistingParticipantIds()` is not defined, `isRawPlayerInvolved()` owns the `Array.isArray` guard, and `buildEventType()` still directly reads `rawEvent.assistingParticipantIds.length`.

### Task 2: Implement Raw Assist Array Helper

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/raw-player-involvement-tests.mjs`
- Modify: `test-artifacts/server/raw-timeline-event-type-tests.mjs`

- [x] **Step 1: Add helper after `isSupportedRawTimelineEvent()`**

Add this function before `isRawPlayerInvolved(rawEvent, targetParticipantId)`:

```js
function rawAssistingParticipantIds(rawEvent) {
  return Array.isArray(rawEvent.assistingParticipantIds)
    ? rawEvent.assistingParticipantIds
    : [];
}
```

- [x] **Step 2: Update `isRawPlayerInvolved()`**

Replace its local assist-array guard with:

```js
const assistingParticipantIds = rawAssistingParticipantIds(rawEvent);
```

- [x] **Step 3: Update `buildEventType()`**

Replace:

```js
return rawEvent.assistingParticipantIds.length > 1 ? "TEAMFIGHT_FOLLOWUP" : "SKIRMISH_WIN";
```

with:

```js
return rawAssistingParticipantIds(rawEvent).length > 1 ? "TEAMFIGHT_FOLLOWUP" : "SKIRMISH_WIN";
```

- [x] **Step 4: Update source-extraction harness dependencies**

In `test-artifacts/server/raw-player-involvement-tests.mjs`, insert this item in `rawEventPolicySources` immediately before the `isRawPlayerInvolved` source/fallback item:

```js
  serverSrc.includes("function rawAssistingParticipantIds(rawEvent)")
    ? extractFunctionSource(serverSrc, "rawAssistingParticipantIds")
    : "function rawAssistingParticipantIds(rawEvent) { return Array.isArray(rawEvent.assistingParticipantIds) ? rawEvent.assistingParticipantIds : []; }",
```

In `test-artifacts/server/raw-timeline-event-type-tests.mjs`, insert the same source/fallback item immediately before the `isRawPlayerInvolved` source/fallback item.

- [x] **Step 5: Run focused GREEN tests**

Run:

```bash
node test-artifacts/server/raw-assist-array-tests.mjs
node test-artifacts/server/raw-player-involvement-tests.mjs
node test-artifacts/server/raw-timeline-event-type-tests.mjs
```

Expected:
- `raw-assist-array-tests.mjs` exits 0 and reports `13 passed, 0 failed`.
- `raw-player-involvement-tests.mjs` exits 0 and reports `12 passed, 0 failed`.
- `raw-timeline-event-type-tests.mjs` exits 0 and reports `31 passed, 0 failed`.

GREEN evidence:
- `node test-artifacts/server/raw-assist-array-tests.mjs`: 13 passed / 0 failed.
- `node test-artifacts/server/raw-player-involvement-tests.mjs`: 12 passed / 0 failed.
- `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: 31 passed / 0 failed.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-raw-assist-array-helper.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/raw-assist-array-tests.mjs
node --check test-artifacts/server/raw-player-involvement-tests.mjs
node --check test-artifacts/server/raw-timeline-event-type-tests.mjs
node test-artifacts/server/raw-assist-array-tests.mjs
node test-artifacts/server/raw-player-involvement-tests.mjs
node test-artifacts/server/raw-timeline-event-type-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-assist-array-helper-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `node --check` commands exit 0.
- Focused tests exit 0.
- `npm test` exits 0.
- Read-only smoke report exits 0.
- `git diff --check` exits 0.

Local evidence recorded before commit:
- RED:
  - `node test-artifacts/server/raw-assist-array-tests.mjs`: 5 passed / 8 failed.
- GREEN:
  - `node test-artifacts/server/raw-assist-array-tests.mjs`: 13 passed / 0 failed.
  - `node test-artifacts/server/raw-player-involvement-tests.mjs`: 12 passed / 0 failed.
  - `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: 31 passed / 0 failed.
- Verification:
  - `node --check server.js`: exit 0.
  - `node --check test-artifacts/server/raw-assist-array-tests.mjs`: exit 0.
  - `node --check test-artifacts/server/raw-player-involvement-tests.mjs`: exit 0.
  - `node --check test-artifacts/server/raw-timeline-event-type-tests.mjs`: exit 0.
  - `npm test`: 1616 passed / 0 failed across 47 test files.
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-assist-array-helper-local npm run smoke:report:readonly`: read-only smoke 156 passed / 0 failed, `durationMs: 199`, required checks total 13 / passed 13 / failed 0 / missing 0.
  - `git diff --check`: exit 0.
  - Plan placeholder scan: no matches.
  - Local smoke artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with RED/GREEN evidence, `npm test`, local smoke summary, implementation commit SHA, GitHub Actions run id, artifact id, sensitive scan result, docs completion commit SHA, final docs GitHub Actions run id, and final `main...origin/main` sync count.

Obsidian local entry evidence:
- Added `### 2026-06-09 03:47 KST - Raw assist array helper 공유`.
- Recorded RED/GREEN, `npm test`, local read-only smoke, and local artifact sensitive scan evidence.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/raw-assist-array-tests.mjs test-artifacts/server/raw-player-involvement-tests.mjs test-artifacts/server/raw-timeline-event-type-tests.mjs docs/superpowers/plans/2026-06-09-raw-assist-array-helper.md
git diff --cached --check
git commit -m "test: share raw assist array helper"
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
git add docs/superpowers/plans/2026-06-09-raw-assist-array-helper.md
git diff --cached --check
git commit -m "docs: finalize raw assist array plan"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers raw assist-array normalization in both raw player involvement and raw champion-kill event type classification.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `rawAssistingParticipantIds(rawEvent)` accepts raw Riot event objects and returns an array used by both consumers.
