# Objective Label Monster Subtype Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent malformed Riot `monsterSubType` values from crashing objective timeline label generation.

**Architecture:** Add a small `objectiveMonsterSubTypeLabel(event)` helper near `buildObjectiveLabel()`. `buildObjectiveLabel()` will append a subtype suffix only when `monsterSubType` is a non-empty string after trimming; non-string, empty, or whitespace-only values will be ignored.

**Tech Stack:** Node.js ESM regression tests, vanilla `server.js` helpers, existing `test-artifacts/run-tests.mjs` suite.

---

### Task 1: Monster Subtype Label Guard

**Files:**
- Create: `test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`
- Modify: `test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs`
- Modify: `test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`
- Update after QA: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing regression test**

Create `test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs` with direct label checks:

```js
check("string monster subtype formats label suffix", labelResult({ monsterType: "DRAGON", monsterSubType: "FIRE_DRAGON" }), { value: "드래곤 (fire dragon)", error: null });
check("number monster subtype is ignored", labelResult({ monsterType: "DRAGON", monsterSubType: 42 }), { value: "드래곤", error: null });
check("array monster subtype is ignored", labelResult({ monsterType: "HORDE", monsterSubType: ["VOID"] }), { value: "공허 유충", error: null });
check("object monster subtype is ignored", labelResult({ monsterType: "BARON_NASHOR", monsterSubType: { name: "BARON" } }), { value: "바론", error: null });
check("whitespace monster subtype is ignored", labelResult({ monsterType: "RIFTHERALD", monsterSubType: "   " }), { value: "전령", error: null });
check("trimmed string monster subtype formats suffix", labelResult({ monsterType: "DRAGON", monsterSubType: "  HEXTECH_DRAGON  " }), { value: "드래곤 (hextech dragon)", error: null });
```

Also verify `buildObjectiveTimeline()` does not throw when one objective event carries a malformed subtype and another carries a valid subtype:

```js
check("timeline with malformed subtype does not throw", timelineError, null);
check("timeline ignores malformed subtype label", timelineLabels[0], "드래곤");
check("timeline keeps valid subtype label", timelineLabels[1], "드래곤 (cloud dragon)");
```

Source-shape checks:

```js
checkTrue("server defines objectiveMonsterSubTypeLabel", serverSrc.includes("function objectiveMonsterSubTypeLabel(event)"));
checkTrue("buildObjectiveLabel uses objectiveMonsterSubTypeLabel", buildObjectiveLabelSrc.includes("objectiveMonsterSubTypeLabel(event)"));
checkTrue("buildObjectiveLabel no longer calls replace on raw monsterSubType", !buildObjectiveLabelSrc.includes("event.monsterSubType.replace"));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs
node test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs
```

Expected RED:
- Syntax check exits 0.
- Test command fails because number/array/object `monsterSubType` values throw or produce invalid labels, and `objectiveMonsterSubTypeLabel()` does not exist yet.

Evidence (2026-06-09 06:00 KST):
- `node --check test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs` exited 0.
- `node test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs` failed as expected with `3 passed, 16 failed`; failures covered numeric/array/object subtype `TypeError`, whitespace labels, missing helper, and timeline throw.

- [x] **Step 3: Implement the minimal production change**

Add this helper near `buildObjectiveLabel()`:

```js
function objectiveMonsterSubTypeLabel(event) {
  if (typeof event.monsterSubType !== "string") {
    return "";
  }
  const monsterSubType = event.monsterSubType.trim();
  return monsterSubType ? ` (${monsterSubType.replace(/_/g, " ").toLowerCase()})` : "";
}
```

Update `buildObjectiveLabel()`:

```js
return `${labels[event.monsterType] || event.monsterType}${objectiveMonsterSubTypeLabel(event)}`;
```

Do not change monster type labels, objective team policy, timestamp normalization, or objective sorting.

- [x] **Step 4: Update existing extraction harnesses**

Because `buildObjectiveTimeline()` extracts `buildObjectiveLabel()` with `new Function()`, inject `objectiveMonsterSubTypeLabel()` in:

```bash
test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs
test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
```

- [x] **Step 5: Verify GREEN and focused regressions**

Run:

```bash
node --check server.js && node --check test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs
node test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs
node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs
node test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs
node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
```

Expected GREEN:
- New monster subtype policy test passes.
- Existing objective timeline team/timestamp policies still pass.

Evidence (2026-06-09 06:00 KST):
- `node --check server.js` exited 0.
- `node --check test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs` exited 0.
- `node test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs`: `19 passed, 0 failed`.
- `node test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs`: `16 passed, 0 failed`.
- `node test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs`: `17 passed, 0 failed`.
- `node test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs`: `8 passed, 0 failed`.

- [x] **Step 6: Run full QA**

Run:

```bash
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-label-monster-subtype-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `npm test` exits 0.
- Read-only smoke report exits 0 with required checks all passed.
- Local smoke artifact scan finds no high-risk sensitive patterns.
- `git diff --check` exits 0.

Evidence (2026-06-09 06:00 KST):
- `npm test`: `1787 passed, 0 failed across 58 test file(s)`.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-label-monster-subtype-policy-local npm run smoke:report:readonly`: smoke `156 passed, 0 failed`, QA verdict `passed`, required checks `13/13`, duration `202 ms`.
- Local smoke artifact sensitive scan: no high-risk sensitive patterns found.
- `git diff --check` exited 0.

- [ ] **Step 7: Commit, push, and verify GitHub Actions**

Stage only:

```bash
git add docs/superpowers/plans/2026-06-09-objective-label-monster-subtype-policy.md server.js test-artifacts/server/objective-label-monster-subtype-policy-tests.mjs test-artifacts/server/objective-timeline-killer-team-policy-tests.mjs test-artifacts/server/objective-timeline-structure-team-policy-tests.mjs test-artifacts/server/objective-timeline-timestamp-policy-tests.mjs
git commit -m "test: guard objective monster subtype labels"
git push origin main
```

Then watch the `QA` workflow for the pushed commit, download the smoke artifact, inspect `qa-summary.json`, scan the artifact for high-risk sensitive patterns, and update the Obsidian project plan with the local and GitHub evidence.

## Self-Review

- Spec coverage: The plan covers malformed `monsterSubType` handling in objective labels, objective timeline no-throw behavior, regression tests, local QA, remote QA, and project documentation.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan uses existing `buildObjectiveLabel(event)` and `buildObjectiveTimeline(timeline, targetTeamId, participantTeamMap)` names exactly as defined in `server.js`.
