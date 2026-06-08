# Key Moment Impact Event Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route key moment impact objective/structure classification through shared event policy helpers.

**Architecture:** Add `ELITE_OBJECTIVE_FIGHT_EVENT_TYPES` and `isEliteObjectiveFightEvent(event)` beside the existing objective helpers. Update `impactForMoment()` so death, elite-objective fight, and structure-take branches all use shared helpers instead of local string comparisons.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Modify: `server.js` — add the elite objective fight Set/helper and replace `impactForMoment()` direct objective/structure event checks.
- Modify: `test-artifacts/server/key-moment-tests.mjs` — inject elite objective and structure policy helper sources, then add source-shape checks for `impactForMoment()`.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` — append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-key-moment-impact-event-policy.md` — mark steps complete and add verification evidence after each stage.

### Task 1: Add RED Coverage For Key Moment Impact Policy

**Files:**
- Modify: `test-artifacts/server/key-moment-tests.mjs`

- [x] **Step 1: Update the test harness with policy sources**

Change the opening comment to:

```js
// server.js key moment impact event policy regression tests
```

Add these blocks after `playerDeathPolicySources`:

```js
const structureTakePolicySources = serverSrc.includes("const STRUCTURE_TAKE_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isStructureTakeEvent"),
    ]
  : [
      'const STRUCTURE_TAKE_EVENT_TYPES = new Set(["TOWER_TAKE"]);',
      'function isStructureTakeEvent(event) { return STRUCTURE_TAKE_EVENT_TYPES.has(event.eventType); }',
    ];

const eliteObjectiveFightPolicySources = serverSrc.includes("const ELITE_OBJECTIVE_FIGHT_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "ELITE_OBJECTIVE_FIGHT_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isEliteObjectiveFightEvent"),
    ]
  : [
      'const ELITE_OBJECTIVE_FIGHT_EVENT_TYPES = new Set(["DRAGON_FIGHT", "BARON_FIGHT"]);',
      'function isEliteObjectiveFightEvent(event) { return ELITE_OBJECTIVE_FIGHT_EVENT_TYPES.has(event.eventType); }',
    ];
```

Update the `new Function` body so the helper sources are evaluated before `impactForMoment()`:

```js
const { impactForMoment } = new Function(
  [
    ...playerDeathPolicySources,
    ...structureTakePolicySources,
    ...eliteObjectiveFightPolicySources,
    extractFunctionSource(serverSrc, "impactForMoment"),
    "return { impactForMoment };",
  ].join("\n"),
)();
```

- [x] **Step 2: Add source-shape checks**

Add these checks after the existing `impactForMoment uses isPlayerDeathEvent` assertion:

```js
checkTrue(
  "server defines ELITE_OBJECTIVE_FIGHT_EVENT_TYPES",
  serverSrc.includes('const ELITE_OBJECTIVE_FIGHT_EVENT_TYPES = new Set(["DRAGON_FIGHT", "BARON_FIGHT"]);'),
);
checkTrue(
  "server defines isEliteObjectiveFightEvent",
  serverSrc.includes("function isEliteObjectiveFightEvent(event)"),
);
checkTrue(
  "impactForMoment uses isEliteObjectiveFightEvent",
  impactForMomentSrc.includes("isEliteObjectiveFightEvent(event)"),
);
checkTrue(
  "impactForMoment uses isStructureTakeEvent",
  impactForMomentSrc.includes("isStructureTakeEvent(event)"),
);
```

- [x] **Step 3: Run RED test**

Run:

```bash
node test-artifacts/server/key-moment-tests.mjs
```

Expected:
- Exits 1.
- Existing behavior checks still pass because the current direct comparisons preserve output strings.
- Four new source-shape checks fail for the missing elite objective fight helper and direct `impactForMoment()` objective/structure checks.

RED evidence:
- `node test-artifacts/server/key-moment-tests.mjs`: 8 passed / 4 failed.
- Failing checks: `server defines ELITE_OBJECTIVE_FIGHT_EVENT_TYPES`, `server defines isEliteObjectiveFightEvent`, `impactForMoment uses isEliteObjectiveFightEvent`, `impactForMoment uses isStructureTakeEvent`.

### Task 2: Implement Shared Key Moment Impact Helpers

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add the elite objective fight policy Set**

Add this constant after `MACRO_OBJECTIVE_WIN_EVENT_TYPES`:

```js
const ELITE_OBJECTIVE_FIGHT_EVENT_TYPES = new Set(["DRAGON_FIGHT", "BARON_FIGHT"]);
```

- [x] **Step 2: Add the elite objective fight helper**

Add this helper after `isMacroObjectiveWinEvent(event)`:

```js
function isEliteObjectiveFightEvent(event) {
  return ELITE_OBJECTIVE_FIGHT_EVENT_TYPES.has(event.eventType);
}
```

- [x] **Step 3: Replace `impactForMoment()` direct event checks**

Replace:

```js
if (event.eventType === "DRAGON_FIGHT" || event.eventType === "BARON_FIGHT") {
  return "오브젝트 주도권에 직접 영향을 줬다.";
}
if (event.eventType === "TOWER_TAKE") {
  return "승리 조건을 구조물로 전환했다.";
}
```

with:

```js
if (isEliteObjectiveFightEvent(event)) {
  return "오브젝트 주도권에 직접 영향을 줬다.";
}
if (isStructureTakeEvent(event)) {
  return "승리 조건을 구조물로 전환했다.";
}
```

- [x] **Step 4: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/key-moment-tests.mjs
```

Expected:
- Exits 0.
- Reports `12 passed, 0 failed`.

GREEN evidence:
- `node test-artifacts/server/key-moment-tests.mjs`: 12 passed / 0 failed.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-key-moment-impact-event-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/key-moment-tests.mjs
node test-artifacts/server/key-moment-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moment-impact-event-policy-local npm run smoke:report:readonly
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
  - `node test-artifacts/server/key-moment-tests.mjs`: 8 passed / 4 failed for the new key moment impact policy source-shape checks.
- GREEN:
  - `node test-artifacts/server/key-moment-tests.mjs`: 12 passed / 0 failed.
- Verification:
  - `node --check server.js`: exit 0.
  - `node --check test-artifacts/server/key-moment-tests.mjs`: exit 0.
  - `npm test`: 1535 passed / 0 failed across 43 test files.
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moment-impact-event-policy-local npm run smoke:report:readonly`: read-only smoke 156 passed / 0 failed, `durationMs: 230`, required checks total 13 / passed 13 / failed 0 / missing 0.
  - `git diff --check`: exit 0.
  - Plan placeholder scan: no matches.
  - Local smoke artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with local RED/GREEN evidence, `npm test`, local smoke summary, implementation commit SHA, GitHub Actions run id, artifact id, sensitive scan result, docs completion commit SHA, final docs GitHub Actions run id, and final `main...origin/main` sync count.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/key-moment-tests.mjs docs/superpowers/plans/2026-06-09-key-moment-impact-event-policy.md
git diff --cached --check
git commit -m "test: share key moment impact event policy"
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
git add docs/superpowers/plans/2026-06-09-key-moment-impact-event-policy.md
git diff --cached --check
git commit -m "docs: finalize key moment impact event plan"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers key moment impact output behavior, elite objective fight classification, and structure-take classification without changing UI copy.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: All helpers accept event objects, and `impactForMoment(event, result)` keeps the same signature.
