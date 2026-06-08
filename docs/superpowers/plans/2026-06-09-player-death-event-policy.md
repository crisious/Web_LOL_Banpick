# Player Death Event Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route repeated `PLAYER_DEATH` insight consumers through a shared player-death event helper.

**Architecture:** Add `PLAYER_DEATH_EVENT_TYPES` and `isPlayerDeathEvent(event)` beside existing timeline event policy helpers. Update the insight, coach summary, and key moment consumers that currently treat `PLAYER_DEATH` as player death pressure.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Modify: `server.js` — add player-death Set/helper and replace repeated `PLAYER_DEATH` checks in insight-oriented consumers.
- Modify: `test-artifacts/server/strength-weakness-tests.mjs` — inject the helper into extracted fallback-builder tests and add source-shape checks for derived signals and weakness death filtering.
- Modify: `test-artifacts/server/coach-summary-tests.mjs` — inject the helper into extracted coach summary tests and add source-shape coverage for coach summary deaths.
- Create: `test-artifacts/server/key-moment-tests.mjs` — focused behavior/source-shape coverage for `impactForMoment()`.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` — append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-player-death-event-policy.md` — mark steps complete and add completion evidence after verification.

### Task 1: Add RED Coverage For Player-Death Policy

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`
- Modify: `test-artifacts/server/coach-summary-tests.mjs`
- Create: `test-artifacts/server/key-moment-tests.mjs`

- [x] **Step 1: Update `strength-weakness-tests.mjs` harness**

Add this block after `structureTakePolicySources`:

```js
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

Then insert this spread after `...structureTakePolicySources`:

```js
...playerDeathPolicySources,
```

- [x] **Step 2: Add `strength-weakness-tests.mjs` source-shape checks**

Add these checks after the `buildDerivedSignals late structure uses isStructureTakeEvent` check:

```js
checkTrue(
  "server defines PLAYER_DEATH_EVENT_TYPES",
  serverSrc.includes('const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);'),
);
checkTrue(
  "server defines isPlayerDeathEvent",
  serverSrc.includes("function isPlayerDeathEvent(event)"),
);
checkTrue(
  "buildDerivedSignals uses isPlayerDeathEvent",
  buildDerivedSignalsSrc.includes("events.filter(isPlayerDeathEvent)"),
);
```

Add this check after `buildWeaknesses objective wins use isObjectiveWinEvent`:

```js
checkTrue(
  "buildWeaknesses deaths use isPlayerDeathEvent",
  buildWeaknessesSrc.includes("const deaths = events.filter(isPlayerDeathEvent);"),
);
```

- [x] **Step 3: Update `coach-summary-tests.mjs` harness**

Add this block after `objectiveFailPolicySources`:

```js
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

Then insert this spread after `...objectiveFailPolicySources`:

```js
...playerDeathPolicySources,
```

- [x] **Step 4: Add `coach-summary-tests.mjs` source-shape check**

Add this check after `buildCoachSummary uses isObjectiveWinEvent`:

```js
checkTrue(
  "buildCoachSummary deaths use isPlayerDeathEvent",
  buildCoachSummarySrc.includes("timelineEvents.filter(isPlayerDeathEvent)"),
);
```

- [x] **Step 5: Create `key-moment-tests.mjs`**

Create `test-artifacts/server/key-moment-tests.mjs` with:

```js
// server.js key moment player-death policy regression tests

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

const playerDeathPolicySources = serverSrc.includes("const PLAYER_DEATH_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    ]
  : [
      'const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);',
      'function isPlayerDeathEvent(event) { return PLAYER_DEATH_EVENT_TYPES.has(event.eventType); }',
    ];

const impactForMomentSrc = extractFunctionSource(serverSrc, "impactForMoment");

const { impactForMoment } = new Function(
  [
    ...playerDeathPolicySources,
    extractFunctionSource(serverSrc, "impactForMoment"),
    "return { impactForMoment };",
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

check("impactForMoment death in win", impactForMoment({ eventType: "PLAYER_DEATH" }, "WIN"), "이기는 흐름을 다소 늦췄다.");
check("impactForMoment death in loss", impactForMoment({ eventType: "PLAYER_DEATH" }, "LOSS"), "팀 운영이 크게 흔들렸다.");
check("impactForMoment dragon objective", impactForMoment({ eventType: "DRAGON_FIGHT" }, "LOSS"), "오브젝트 주도권에 직접 영향을 줬다.");
check("impactForMoment tower take", impactForMoment({ eventType: "TOWER_TAKE" }, "WIN"), "승리 조건을 구조물로 전환했다.");
check("impactForMoment default combat", impactForMoment({ eventType: "TEAMFIGHT_FOLLOWUP" }, "WIN"), "교전 흐름을 유리하게 만드는 장면이었다.");
checkTrue(
  "server defines PLAYER_DEATH_EVENT_TYPES",
  serverSrc.includes('const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);'),
);
checkTrue(
  "server defines isPlayerDeathEvent",
  serverSrc.includes("function isPlayerDeathEvent(event)"),
);
checkTrue(
  "impactForMoment uses isPlayerDeathEvent",
  impactForMomentSrc.includes("isPlayerDeathEvent(event)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 6: Run RED tests**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/coach-summary-tests.mjs
node test-artifacts/server/key-moment-tests.mjs
```

Expected:
- `strength-weakness-tests.mjs` exits 1 with four new source-shape failures: `server defines PLAYER_DEATH_EVENT_TYPES`, `server defines isPlayerDeathEvent`, `buildDerivedSignals uses isPlayerDeathEvent`, and `buildWeaknesses deaths use isPlayerDeathEvent`.
- `coach-summary-tests.mjs` exits 1 with one new source-shape failure: `buildCoachSummary deaths use isPlayerDeathEvent`.
- `key-moment-tests.mjs` exits 1 with three source-shape failures: `server defines PLAYER_DEATH_EVENT_TYPES`, `server defines isPlayerDeathEvent`, and `impactForMoment uses isPlayerDeathEvent`.

### Task 2: Implement Shared Player-Death Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add policy Set**

Add this constant after `STRUCTURE_TAKE_EVENT_TYPES`:

```js
const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);
```

- [x] **Step 2: Add helper**

Add this helper after `isStructureTakeEvent(event)`:

```js
function isPlayerDeathEvent(event) {
  return PLAYER_DEATH_EVENT_TYPES.has(event.eventType);
}
```

- [x] **Step 3: Replace duplicate insight death filters**

Replace these snippets:

```js
const playerDeaths = events.filter((event) => event.eventType === "PLAYER_DEATH");
const deaths = events.filter((event) => event.eventType === "PLAYER_DEATH");
const deaths = normalized.timelineEvents.filter((event) => event.eventType === "PLAYER_DEATH");
```

with:

```js
const playerDeaths = events.filter(isPlayerDeathEvent);
const deaths = events.filter(isPlayerDeathEvent);
const deaths = normalized.timelineEvents.filter(isPlayerDeathEvent);
```

- [x] **Step 4: Replace key moment death impact branch**

Replace:

```js
if (event.eventType === "PLAYER_DEATH") {
```

inside `impactForMoment(event, result)` with:

```js
if (isPlayerDeathEvent(event)) {
```

- [x] **Step 5: Run focused GREEN tests**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/coach-summary-tests.mjs
node test-artifacts/server/key-moment-tests.mjs
```

Expected:
- `strength-weakness-tests.mjs` exits 0.
- `coach-summary-tests.mjs` exits 0.
- `key-moment-tests.mjs` exits 0 with `8 passed, 0 failed`.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-player-death-event-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
node --check test-artifacts/server/coach-summary-tests.mjs
node --check test-artifacts/server/key-moment-tests.mjs
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/coach-summary-tests.mjs
node test-artifacts/server/key-moment-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/player-death-event-policy-local npm run smoke:report:readonly
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
  - `node test-artifacts/server/strength-weakness-tests.mjs`: 85 passed / 4 failed for the new player-death policy source-shape checks.
  - `node test-artifacts/server/coach-summary-tests.mjs`: 10 passed / 1 failed for `buildCoachSummary deaths use isPlayerDeathEvent`.
  - `node test-artifacts/server/key-moment-tests.mjs`: 5 passed / 3 failed for missing player-death policy and key moment source-shape checks.
- GREEN:
  - `node test-artifacts/server/strength-weakness-tests.mjs`: 89 passed / 0 failed.
  - `node test-artifacts/server/coach-summary-tests.mjs`: 11 passed / 0 failed.
  - `node test-artifacts/server/key-moment-tests.mjs`: 8 passed / 0 failed.
- Verification:
  - `node --check server.js`: exit 0.
  - `node --check test-artifacts/server/strength-weakness-tests.mjs`: exit 0.
  - `node --check test-artifacts/server/coach-summary-tests.mjs`: exit 0.
  - `node --check test-artifacts/server/key-moment-tests.mjs`: exit 0.
  - `npm test`: 1515 passed / 0 failed across 43 test files.
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/player-death-event-policy-local npm run smoke:report:readonly`: read-only smoke 156 passed / 0 failed, `durationMs: 321`, required checks total 13 / passed 13 / failed 0 / missing 0.
  - `git diff --check`: exit 0.
  - Plan placeholder scan: no matches.
  - Local smoke artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with local RED/GREEN evidence, `npm test`, local smoke summary, commit SHA, GitHub Actions run id, artifact id, sensitive scan result, and final `main...origin/main` sync count.

- [x] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs test-artifacts/server/coach-summary-tests.mjs test-artifacts/server/key-moment-tests.mjs docs/superpowers/plans/2026-06-09-player-death-event-policy.md
git diff --cached --check
git commit -m "test: share player death event policy"
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

- [x] **Step 5: Mark plan complete and final sync**

Update this plan with completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-player-death-event-policy.md
git diff --cached --check
git commit -m "docs: mark player death event plan complete"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers player death consumers in derived signals, weaknesses, coach summary, and key moment impact text.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `PLAYER_DEATH_EVENT_TYPES` is a `Set`, `isPlayerDeathEvent(event)` accepts event objects, and each updated consumer passes event objects directly to `Array.prototype.filter` or branch checks.

## Completion Evidence

- Implementation commit: `17a6ae8f17acb71dd139c6aca2c2574fcb4079cc` (`test: share player death event policy`) pushed to `origin/main`.
- GitHub Actions QA run: `27154756641` passed for `17a6ae8f17acb71dd139c6aca2c2574fcb4079cc`.
- GitHub QA artifact: `7487526434` (`qa-automation-27154756641`, 3548 bytes, not expired).
- Artifact summary: read-only smoke 156 passed / 0 failed, `durationMs: 208`, `latestRun.qaVerdict.status: "passed"`, required checks total 13 / passed 13 / failed 0 / missing 0, `latestRun.git.dirty: false`.
- GitHub artifact high-risk sensitive pattern scan: no matches.
