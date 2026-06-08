# Raw Building Target Team Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent malformed target team ids from turning building kills into false enemy tower-take events.

**Architecture:** Tighten `isRawEnemyBuildingKill(rawEvent, targetTeamId)` so it validates both the raw building team id and the target team id with `isKnownRawTeamId()`. Invalid, missing, string, or neutral target team ids will fail closed and return `false`, which preserves conservative `OBJECTIVE_SETUP_FAIL` handling and prevents unrelated structure events from being kept as enemy pressure.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helpers, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Building Target Team Guard

**Files:**
- Create: `test-artifacts/server/raw-building-target-team-policy-tests.mjs`
- Modify: `server.js`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/raw-building-target-team-policy-tests.mjs` with direct helper and consumer checks:

```js
check("known enemy tower with numeric target remains enemy", isRawEnemyBuildingKill(knownEnemyTower, 100), true);
check("known tower with string target fails closed", isRawEnemyBuildingKill(knownEnemyTower, "100"), false);
check("known tower with missing target fails closed", isRawEnemyBuildingKill(knownEnemyTower, null), false);
check("known tower with neutral target fails closed", isRawEnemyBuildingKill(knownEnemyTower, 300), false);
check("buildEventType invalid target stays conservative", buildEventType(knownEnemyTower, 2, "100", false), "OBJECTIVE_SETUP_FAIL");
check("shouldKeepEvent invalid target drops non-involved tower", shouldKeepEvent(knownEnemyTower, 2, "100"), false);
check("extractTimelineEvents invalid target drops non-involved tower", eventsWithInvalidTarget.length, 0);
```

Add source-shape checks:

```js
checkTrue("isRawEnemyBuildingKill validates target team id", isRawEnemyBuildingKillSrc.includes("isKnownRawTeamId(targetTeamId)"));
checkTrue(
  "isRawEnemyBuildingKill no longer compares against unvalidated target only",
  !isRawEnemyBuildingKillSrc.includes("isKnownRawTeamId(rawEvent.teamId) && rawEvent.teamId !== targetTeamId"),
);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/raw-building-target-team-policy-tests.mjs
node test-artifacts/server/raw-building-target-team-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because `isRawEnemyBuildingKill()` currently validates only `rawEvent.teamId`, then compares it to any `targetTeamId`.

Evidence, 2026-06-09 06:26 KST:
- `node --check test-artifacts/server/raw-building-target-team-policy-tests.mjs` exited 0.
- `node test-artifacts/server/raw-building-target-team-policy-tests.mjs` exited 1 with `3 passed, 8 failed`.
- RED failures covered string, missing, and neutral target team ids being treated as enemy, `buildEventType()` returning `TOWER_TAKE`, `shouldKeepEvent()` keeping a non-involved tower, `extractTimelineEvents()` returning one invalid-target event, and source-shape checks missing target team validation.

- [x] **Step 3: Implement the minimal production change**

Update `isRawEnemyBuildingKill()`:

```js
function isRawEnemyBuildingKill(rawEvent, targetTeamId) {
  return (
    isKnownRawTeamId(rawEvent.teamId) &&
    isKnownRawTeamId(targetTeamId) &&
    rawEvent.teamId !== targetTeamId
  );
}
```

Do not change raw building type detection, `isKnownRawTeamId()`, champion/objective event handling, or timeline sort behavior.

- [x] **Step 4: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js
node --check test-artifacts/server/raw-building-target-team-policy-tests.mjs
node test-artifacts/server/raw-building-target-team-policy-tests.mjs
node test-artifacts/server/raw-building-team-policy-tests.mjs
node test-artifacts/server/raw-participant-id-policy-tests.mjs
node test-artifacts/server/timeline-consumer-tests.mjs
```

Expected GREEN:
- New target team policy test passes.
- Existing raw building, participant id, and timeline consumer policies still pass.

Evidence, 2026-06-09 06:26 KST:
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/raw-building-target-team-policy-tests.mjs` exited 0.
- `node test-artifacts/server/raw-building-target-team-policy-tests.mjs`: `11 passed, 0 failed`.
- `node test-artifacts/server/raw-building-team-policy-tests.mjs`: `28 passed, 0 failed`.
- `node test-artifacts/server/raw-participant-id-policy-tests.mjs`: `17 passed, 0 failed`.
- `node test-artifacts/server/timeline-consumer-tests.mjs`: `12 passed, 0 failed`.

- [x] **Step 5: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-building-target-team-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence, 2026-06-09 06:26 KST:
- `npm test` exited 0 with `1816 passed, 0 failed across 61 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-building-target-team-policy-local npm run smoke:report:readonly` exited 0.
- Local read-only smoke summary: QA verdict `passed`, required checks `13/13`, smoke `156 passed, 0 failed`, duration `224ms`.
- Local smoke artifact sensitive scan found no high-risk sensitive patterns.
- `git diff --check` exited 0.

Pre-commit recheck, 2026-06-09 06:29 KST:
- `git diff --check`, syntax checks, focused policy tests, and `npm test` exited 0.
- `npm test`: `1816 passed, 0 failed across 61 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/raw-building-target-team-policy-precommit npm run smoke:report:readonly` exited 0.
- Pre-commit smoke summary: QA verdict `passed`, required checks `13/13`, smoke `156 passed, 0 failed`, duration `201ms`.
- Pre-commit smoke artifact sensitive scan found no high-risk sensitive patterns.

- [ ] **Step 6: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-raw-building-target-team-policy.md server.js test-artifacts/server/raw-building-target-team-policy-tests.mjs
git commit -m "test: guard raw building target teams"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers invalid target team handling in helper, event type, keep/drop decision, extracted timeline output, regression tests, local QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `isRawEnemyBuildingKill(rawEvent, targetTeamId)`, `buildEventType(rawEvent, targetParticipantId, targetTeamId, playerWonObjective)`, `shouldKeepEvent(rawEvent, targetParticipantId, targetTeamId)`, and `extractTimelineEvents(matchDetail, timeline, targetParticipantId, targetTeamId)` names exactly as defined in `server.js`.
