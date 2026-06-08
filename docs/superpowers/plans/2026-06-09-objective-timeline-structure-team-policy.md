# Objective Timeline Structure Team Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent malformed Riot `BUILDING_KILL.teamId` values from being rendered as allied structure pressure in the UI objective timeline.

**Architecture:** Add a small `objectiveStructureTeam(event, targetTeamId)` helper next to the objective timeline helpers. Route `buildObjectiveTimeline()` structure rows through that helper so only a known numeric enemy destroyed team (`100` or `200`, different from the player's team) renders as `ALLY`; missing, string, neutral, or own-team structure events render conservatively as `ENEMY`.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helpers, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Structure Team Direction Helper

**Files:**
- Create: `test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`
- Modify: `test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs` with checks that exercise the real `buildObjectiveTimeline()`:

```js
check("known enemy structure destroyed renders as allied pressure", byLabel("미드 외곽 타워")?.team, "ALLY");
check("known own structure destroyed renders as enemy pressure", byLabel("탑 내부 타워")?.team, "ENEMY");
check("string enemy team id stays conservative enemy", byLabel("봇 외곽 타워")?.team, "ENEMY");
check("missing team id stays conservative enemy", byLabel("탑 억제기")?.team, "ENEMY");
check("neutral team id stays conservative enemy", byLabel("미드 넥서스 타워")?.team, "ENEMY");
check("objective rows keep objective killer team policy", byLabel("드래곤")?.team, "ALLY");
```

Also assert the helper contract and source shape:

```js
check("helper maps known enemy destroyed team to ALLY", objectiveStructureTeam({ teamId: 200 }, 100), "ALLY");
check("helper maps known own destroyed team to ENEMY", objectiveStructureTeam({ teamId: 100 }, 100), "ENEMY");
check("helper rejects string team id conservatively", objectiveStructureTeam({ teamId: "200" }, 100), "ENEMY");
check("helper rejects missing team id conservatively", objectiveStructureTeam({}, 100), "ENEMY");
checkTrue(
  "buildObjectiveTimeline uses objectiveStructureTeam",
  buildObjectiveTimelineSrc.includes("team: objectiveStructureTeam(event, targetTeamId),"),
);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs
node test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `objectiveStructureTeam()` does not exist and `buildObjectiveTimeline()` currently uses `event.teamId === targetTeamId ? "ENEMY" : "ALLY"` directly.

Observed at `2026-06-09 05:47 KST`:
- `node --check test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs`: passed
- `node test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs`: 5 passed / 12 failed
- Failure evidence: string/missing/neutral structure `teamId` values rendered as `ALLY`, helper/source-shape checks failed because `objectiveStructureTeam()` did not exist and `buildObjectiveTimeline()` still compared structure teams inline.

- [x] **Step 3: Implement the minimal production change**

Add this helper near `objectiveKillerTeamId()`:

```js
function objectiveStructureTeam(event, targetTeamId) {
  if (!isKnownRawTeamId(event.teamId) || !isKnownRawTeamId(targetTeamId)) {
    return "ENEMY";
  }
  return event.teamId === targetTeamId ? "ENEMY" : "ALLY";
}
```

Then update structure rows in `buildObjectiveTimeline()`:

```js
team: objectiveStructureTeam(event, targetTeamId),
```

Do not change structure labels, objective killer team policy, timestamp normalization, or sorting.

- [x] **Step 4: Update existing extraction harnesses**

Because `buildObjectiveTimeline()` is extracted with `new Function()` in existing tests, inject `objectiveStructureTeam()` in:

```bash
test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
```

Keep their existing assertions unchanged except where source-shape coverage should confirm the helper remains wired.

- [x] **Step 5: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js && node --check test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs && node --check test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs && node --check test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs
node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
node test-artifacts/server/raw-building-team-policy-tests.mjs
```

Expected GREEN:
- New structure team policy test passes.
- Existing objective killer team, timestamp, and raw building team policies still pass.

Observed at `2026-06-09 05:47 KST`:
- `node --check server.js && node --check test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs && node --check test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs && node --check test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`: passed
- `node test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs`: 17 passed / 0 failed
- `node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: 16 passed / 0 failed
- `node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`: 8 passed / 0 failed
- `node test-artifacts/server/raw-building-team-policy-tests.mjs`: 28 passed / 0 failed

- [x] **Step 6: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-timeline-structure-team-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Observed at `2026-06-09 05:47 KST`:
- `npm test`: 1768 passed / 0 failed across 57 test file(s)
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-timeline-structure-team-policy-local npm run smoke:report:readonly`: passed
- Local smoke summary: required checks total 13 / passed 13 / failed 0 / missing 0, smoke 156 passed / 0 failed, `durationMs: 1272`, mode `readonly`
- Local smoke artifact high-risk sensitive pattern scan: no matches
- `git diff --check`: passed

- [ ] **Step 7: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-objective-timeline-structure-team-policy.md server.js test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
git commit -m "test: guard objective timeline structure teams"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers malformed structure `teamId` handling in UI objective timeline rows, regression tests, local QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `isKnownRawTeamId(teamId)`, `buildObjectiveTimeline(timeline, targetTeamId, participantTeamMap)`, and `objectiveKillerTeamId(event, participantTeamMap)` names exactly as defined in `server.js`.
