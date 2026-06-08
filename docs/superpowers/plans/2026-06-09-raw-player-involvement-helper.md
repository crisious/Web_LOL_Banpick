# Raw Player Involvement Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Riot raw timeline player-involvement checks through one shared helper.

**Architecture:** Add `isRawPlayerInvolved(rawEvent, targetParticipantId)` beside the raw event type helpers. Update `shouldKeepEvent()` and `extractTimelineEvents()` to call the helper for killer/victim/assist involvement, preserving existing event filtering behavior while making missing assist arrays safe.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Create: `test-artifacts/server/raw-player-involvement-tests.mjs` - behavior and source-shape tests for raw player involvement handling.
- Modify: `test-artifacts/server/raw-timeline-event-type-tests.mjs` - include `isRawPlayerInvolved()` in the source-extraction harness because `shouldKeepEvent()` now depends on it.
- Modify: `server.js` - add `isRawPlayerInvolved()` and use it in `shouldKeepEvent()` and `extractTimelineEvents()`.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` - append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-raw-player-involvement-helper.md` - mark steps complete and add evidence after each stage.

### Task 1: Add RED Coverage For Raw Player Involvement

**Files:**
- Create: `test-artifacts/server/raw-player-involvement-tests.mjs`

- [x] **Step 1: Create source-extraction regression test**

Create `test-artifacts/server/raw-player-involvement-tests.mjs` with:

```js
// server.js raw player involvement helper regression tests

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
  serverSrc.includes("function isRawPlayerInvolved(rawEvent, targetParticipantId)")
    ? extractFunctionSource(serverSrc, "isRawPlayerInvolved")
    : "function isRawPlayerInvolved(rawEvent, targetParticipantId) { const assistingParticipantIds = Array.isArray(rawEvent.assistingParticipantIds) ? rawEvent.assistingParticipantIds : []; return rawEvent.killerId === targetParticipantId || rawEvent.victimId === targetParticipantId || assistingParticipantIds.includes(targetParticipantId); }",
];

const shouldKeepEventSrc = extractFunctionSource(serverSrc, "shouldKeepEvent");
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const { isRawPlayerInvolved, shouldKeepEvent } = new Function(
  [
    ...rawEventPolicySources,
    shouldKeepEventSrc,
    "return { isRawPlayerInvolved, shouldKeepEvent };",
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
const targetTeamId = 100;
const killerEvent = { type: "CHAMPION_KILL", killerId: 2, victimId: 7, assistingParticipantIds: [] };
const victimEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 2, assistingParticipantIds: [] };
const assistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [2, 3] };
const missingAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8 };
const enemyTowerWithoutAssists = { type: "BUILDING_KILL", killerId: 7, victimId: null, teamId: 200 };

check("helper detects killer involvement", isRawPlayerInvolved(killerEvent, targetParticipantId), true);
check("helper detects victim involvement", isRawPlayerInvolved(victimEvent, targetParticipantId), true);
check("helper detects assist involvement", isRawPlayerInvolved(assistEvent, targetParticipantId), true);
check("helper treats missing assists as no involvement", isRawPlayerInvolved(missingAssistEvent, targetParticipantId), false);
check("shouldKeep champion kill with missing assists does not throw", safeCall(() => shouldKeepEvent(missingAssistEvent, targetParticipantId, targetTeamId)), { ok: true, value: false });
check("shouldKeep enemy tower with missing assists does not throw", safeCall(() => shouldKeepEvent(enemyTowerWithoutAssists, targetParticipantId, targetTeamId)), { ok: true, value: true });

checkTrue(
  "server defines isRawPlayerInvolved",
  serverSrc.includes("function isRawPlayerInvolved(rawEvent, targetParticipantId)"),
);
checkTrue(
  "isRawPlayerInvolved guards missing assist arrays",
  serverSrc.includes("const assistingParticipantIds = Array.isArray(rawEvent.assistingParticipantIds)") &&
    serverSrc.includes("assistingParticipantIds.includes(targetParticipantId)"),
);
checkTrue(
  "shouldKeepEvent uses isRawPlayerInvolved",
  shouldKeepEventSrc.includes("const playerInvolved = isRawPlayerInvolved(rawEvent, targetParticipantId);"),
);
checkTrue(
  "shouldKeepEvent no longer inlines killer involvement",
  !shouldKeepEventSrc.includes("rawEvent.killerId === targetParticipantId"),
);
checkTrue(
  "extractTimelineEvents uses isRawPlayerInvolved for isPlayerInvolved",
  extractTimelineEventsSrc.includes("isPlayerInvolved: isRawPlayerInvolved(rawEvent, targetParticipantId),"),
);
checkTrue(
  "extractTimelineEvents no longer inlines killer involvement in the output object",
  !extractTimelineEventsSrc.includes("isPlayerInvolved:\n          rawEvent.killerId === targetParticipantId"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run RED test**

Run:

```bash
node test-artifacts/server/raw-player-involvement-tests.mjs
```

Expected:
- Exits 1.
- Helper fallback behavior checks pass for direct helper calls.
- Current production `shouldKeepEvent()` throws on missing `assistingParticipantIds`, and source-shape checks fail because the helper is not yet defined or used.

RED evidence:
- `node test-artifacts/server/raw-player-involvement-tests.mjs`: 4 passed / 8 failed.
- Failing behavior checks: `shouldKeepEvent()` throws `Cannot read properties of undefined (reading 'includes')` for champion kill and enemy tower events when `assistingParticipantIds` is missing.
- Failing source-shape checks: `isRawPlayerInvolved()` is not defined, `shouldKeepEvent()` does not use it, and `extractTimelineEvents()` still inlines the `isPlayerInvolved` killer/victim/assist expression.

### Task 2: Implement Raw Player Involvement Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add helper after raw event type helpers**

Add this function after `isSupportedRawTimelineEvent(rawEvent)`:

```js
function isRawPlayerInvolved(rawEvent, targetParticipantId) {
  const assistingParticipantIds = Array.isArray(rawEvent.assistingParticipantIds)
    ? rawEvent.assistingParticipantIds
    : [];
  return (
    rawEvent.killerId === targetParticipantId ||
    rawEvent.victimId === targetParticipantId ||
    assistingParticipantIds.includes(targetParticipantId)
  );
}
```

- [x] **Step 2: Update `shouldKeepEvent()`**

Replace the existing inline `playerInvolved` expression with:

```js
const playerInvolved = isRawPlayerInvolved(rawEvent, targetParticipantId);
```

- [x] **Step 3: Update `extractTimelineEvents()` output**

Replace the `isPlayerInvolved` inline expression inside the pushed event object with:

```js
isPlayerInvolved: isRawPlayerInvolved(rawEvent, targetParticipantId),
```

- [x] **Step 4: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/raw-player-involvement-tests.mjs
```

Expected:
- Exits 0.
- Reports `12 passed, 0 failed`.

GREEN evidence:
- `node test-artifacts/server/raw-player-involvement-tests.mjs`: 12 passed / 0 failed.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-raw-player-involvement-helper.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/raw-player-involvement-tests.mjs
node test-artifacts/server/raw-player-involvement-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-player-involvement-helper-local npm run smoke:report:readonly
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
  - `node test-artifacts/server/raw-player-involvement-tests.mjs`: 4 passed / 8 failed.
- GREEN:
  - `node test-artifacts/server/raw-player-involvement-tests.mjs`: 12 passed / 0 failed.
- Regression harness adjustment:
  - First `npm test` after implementation found `test-artifacts/server/raw-timeline-event-type-tests.mjs` was missing the new `isRawPlayerInvolved()` dependency in its source-extraction harness.
  - Focused reproduction: `node test-artifacts/server/raw-timeline-event-type-tests.mjs` failed with `ReferenceError: isRawPlayerInvolved is not defined`.
  - After adding the helper source/fallback to the harness, `node test-artifacts/server/raw-timeline-event-type-tests.mjs`: 31 passed / 0 failed.
- Verification:
  - `node --check server.js`: exit 0.
  - `node --check test-artifacts/server/raw-player-involvement-tests.mjs`: exit 0.
  - `node --check test-artifacts/server/raw-timeline-event-type-tests.mjs`: exit 0.
  - `npm test`: 1603 passed / 0 failed across 46 test files.
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-player-involvement-helper-local npm run smoke:report:readonly`: read-only smoke 156 passed / 0 failed, `durationMs: 220`, required checks total 13 / passed 13 / failed 0 / missing 0.
  - `git diff --check`: exit 0.
  - Plan placeholder scan: no matches.
  - Local smoke artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with RED/GREEN evidence, `npm test`, local smoke summary, implementation commit SHA, GitHub Actions run id, artifact id, sensitive scan result, docs completion commit SHA, final docs GitHub Actions run id, and final `main...origin/main` sync count.

Obsidian local entry evidence:
- Added `### 2026-06-09 03:34 KST - Raw player involvement helper 공유`.
- Recorded RED/GREEN, raw timeline harness adjustment, `npm test`, local read-only smoke, and local artifact sensitive scan evidence.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/raw-player-involvement-tests.mjs test-artifacts/server/raw-timeline-event-type-tests.mjs docs/superpowers/plans/2026-06-09-raw-player-involvement-helper.md
git diff --cached --check
git commit -m "test: share raw player involvement helper"
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
git add docs/superpowers/plans/2026-06-09-raw-player-involvement-helper.md
git diff --cached --check
git commit -m "docs: finalize raw player involvement plan"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers raw player involvement checks in `shouldKeepEvent()` and `extractTimelineEvents()` while preserving the existing raw event type and objective classification policies.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `isRawPlayerInvolved(rawEvent, targetParticipantId)` accepts raw Riot event objects and returns a boolean used by both consumers.
