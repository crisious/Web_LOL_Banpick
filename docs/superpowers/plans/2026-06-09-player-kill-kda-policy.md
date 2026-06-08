# Player Kill KDA Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route KDA timeline and phase-context kill/death counters through shared player kill/death event helpers.

**Architecture:** Add `PLAYER_KILL_EVENT_TYPES` and `isPlayerKillEvent(event)` beside the existing player-death helper. Update only the KDA-facing consumers, `buildPhaseContext()` and `buildKdaTimeline()`, so kill and death counters share event policy while assist-like events continue to use `isFightContributionEvent(event)`.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Modify: `server.js` — add player-kill Set/helper and update KDA-facing `CHAMPION_KILL` / `PLAYER_DEATH` branches in `buildPhaseContext()` and `buildKdaTimeline()`.
- Modify: `test-artifacts/server/timeline-consumer-tests.mjs` — inject player kill/death helper sources and add source-shape checks for KDA-facing consumers.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` — append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-player-kill-kda-policy.md` — mark steps complete and add completion evidence after verification.

### Task 1: Add RED Coverage For KDA Kill/Death Policy

**Files:**
- Modify: `test-artifacts/server/timeline-consumer-tests.mjs`

- [x] **Step 1: Update `timeline-consumer-tests.mjs` harness**

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
```

Then insert both spreads before `extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES")`:

```js
...playerKillPolicySources,
...playerDeathPolicySources,
```

- [x] **Step 2: Add `timeline-consumer-tests.mjs` source-shape checks**

Add these checks after `kdaTimeline final counts`:

```js
checkTrue(
  "server defines PLAYER_KILL_EVENT_TYPES",
  serverSrc.includes('const PLAYER_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);'),
);
checkTrue(
  "server defines isPlayerKillEvent",
  serverSrc.includes("function isPlayerKillEvent(event)"),
);
checkTrue(
  "buildPhaseContext uses isPlayerKillEvent for kills",
  buildPhaseContextSrc.includes("if (isPlayerKillEvent(event))"),
);
checkTrue(
  "buildPhaseContext uses isPlayerDeathEvent for deaths",
  buildPhaseContextSrc.includes("} else if (isPlayerDeathEvent(event))"),
);
checkTrue(
  "buildKdaTimeline uses isPlayerKillEvent for kills",
  buildKdaTimelineSrc.includes("} else if (isPlayerKillEvent(evt))"),
);
checkTrue(
  "buildKdaTimeline uses isPlayerDeathEvent for deaths",
  buildKdaTimelineSrc.includes("if (isPlayerDeathEvent(evt))"),
);
```

- [x] **Step 3: Run RED test**

Run:

```bash
node test-artifacts/server/timeline-consumer-tests.mjs
```

Expected:
- Exits 1.
- Existing behavior checks still pass.
- Six new source-shape checks fail: `server defines PLAYER_KILL_EVENT_TYPES`, `server defines isPlayerKillEvent`, `buildPhaseContext uses isPlayerKillEvent for kills`, `buildPhaseContext uses isPlayerDeathEvent for deaths`, `buildKdaTimeline uses isPlayerKillEvent for kills`, and `buildKdaTimeline uses isPlayerDeathEvent for deaths`.

### Task 2: Implement Shared KDA Kill Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add policy Set**

Add this constant before `PLAYER_DEATH_EVENT_TYPES`:

```js
const PLAYER_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);
```

- [x] **Step 2: Add helper**

Add this helper before `isPlayerDeathEvent(event)`:

```js
function isPlayerKillEvent(event) {
  return PLAYER_KILL_EVENT_TYPES.has(event.eventType);
}
```

- [x] **Step 3: Replace `buildPhaseContext()` KDA branches**

Replace:

```js
if (event.eventType === "CHAMPION_KILL") {
  bucket.kills += 1;
} else if (event.eventType === "PLAYER_DEATH") {
  bucket.deaths += 1;
} else if (isFightContributionEvent(event)) {
  bucket.assists += 1;
}
```

with:

```js
if (isPlayerKillEvent(event)) {
  bucket.kills += 1;
} else if (isPlayerDeathEvent(event)) {
  bucket.deaths += 1;
} else if (isFightContributionEvent(event)) {
  bucket.assists += 1;
}
```

- [x] **Step 4: Replace `buildKdaTimeline()` KDA branches**

Replace:

```js
if (evt.eventType === "PLAYER_DEATH") {
  deaths++;
  changed = true;
} else if (evt.eventType === "CHAMPION_KILL") {
  kills++;
  changed = true;
} else if (isFightContributionEvent(evt)) {
  assists++;
  changed = true;
}
```

with:

```js
if (isPlayerDeathEvent(evt)) {
  deaths++;
  changed = true;
} else if (isPlayerKillEvent(evt)) {
  kills++;
  changed = true;
} else if (isFightContributionEvent(evt)) {
  assists++;
  changed = true;
}
```

- [x] **Step 5: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/timeline-consumer-tests.mjs
```

Expected:
- Exits 0.
- Reports `12 passed, 0 failed`.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-player-kill-kda-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/timeline-consumer-tests.mjs
node test-artifacts/server/timeline-consumer-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/player-kill-kda-policy-local npm run smoke:report:readonly
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
  - `node test-artifacts/server/timeline-consumer-tests.mjs`: 6 passed / 6 failed for the six new KDA kill/death source-shape checks.
- GREEN:
  - `node test-artifacts/server/timeline-consumer-tests.mjs`: 12 passed / 0 failed.
- Verification:
  - `node --check server.js`: exit 0.
  - `node --check test-artifacts/server/timeline-consumer-tests.mjs`: exit 0.
  - `npm test`: 1521 passed / 0 failed across 43 test files.
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/player-kill-kda-policy-local npm run smoke:report:readonly`: read-only smoke 156 passed / 0 failed, `durationMs: 264`, required checks total 13 / passed 13 / failed 0 / missing 0.
  - `git diff --check`: exit 0.
  - Plan placeholder scan: no matches.
  - Local smoke artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with local RED/GREEN evidence, `npm test`, local smoke summary, commit SHA, GitHub Actions run id, artifact id, sensitive scan result, and final `main...origin/main` sync count.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/timeline-consumer-tests.mjs docs/superpowers/plans/2026-06-09-player-kill-kda-policy.md
git diff --cached --check
git commit -m "test: share player kill kda policy"
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

Update this plan with completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-player-kill-kda-policy.md
git diff --cached --check
git commit -m "docs: mark player kill kda plan complete"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers the two KDA-facing consumers, `buildPhaseContext()` and `buildKdaTimeline()`, without changing deeper teamfight outcome inference.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `PLAYER_KILL_EVENT_TYPES` and `PLAYER_DEATH_EVENT_TYPES` are `Set` objects, and both helpers accept event objects.
