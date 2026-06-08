# Structure Take Event Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route repeated `TOWER_TAKE` structure-pressure consumers through a shared structure-take event helper.

**Architecture:** Add `STRUCTURE_TAKE_EVENT_TYPES` and `isStructureTakeEvent(event)` beside the existing timeline event policy helpers. Update the three consumers that currently treat `TOWER_TAKE` as structure pressure: late closeout signals, tower fallback strength evidence, and structure score.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Modify: `server.js` — add structure-take Set/helper and replace repeated `TOWER_TAKE` filters in three consumers.
- Modify: `test-artifacts/server/strength-weakness-tests.mjs` — inject the helper into extracted fallback-builder tests and add source-shape checks for derived signals and strength tower fallback.
- Create: `test-artifacts/server/structure-score-tests.mjs` — focused behavior/source-shape coverage for `calcStructureScore()`.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` — append QA evidence for this cycle.
- Modify: `docs/superpowers/plans/2026-06-09-structure-take-event-policy.md` — mark steps complete and add completion evidence after verification.

### Task 1: Add RED Coverage For Structure-Take Policy

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`
- Create: `test-artifacts/server/structure-score-tests.mjs`

- [x] **Step 1: Update `strength-weakness-tests.mjs` harness**

Add this block after `objectiveFailPolicySources`:

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
```

Then insert this spread after `...objectiveFailPolicySources`:

```js
...structureTakePolicySources,
```

- [x] **Step 2: Add `strength-weakness-tests.mjs` source-shape checks**

Add these checks after the existing `buildDerivedSignals uses isMacroObjectiveWinEvent` check:

```js
checkTrue(
  "buildDerivedSignals late structure uses isStructureTakeEvent",
  buildDerivedSignalsSrc.includes('event.phase === "LATE" && isStructureTakeEvent(event)'),
);
```

Add these checks after `buildStrengths C length 3`:

```js
checkTrue(
  "buildStrengths tower fallback gate uses isStructureTakeEvent",
  buildStrengthsSrc.includes("events.some(isStructureTakeEvent)"),
);
checkTrue(
  "buildStrengths tower fallback evidence uses isStructureTakeEvent",
  buildStrengthsSrc.includes(".filter(isStructureTakeEvent)"),
);
```

- [x] **Step 3: Create `structure-score-tests.mjs`**

Create `test-artifacts/server/structure-score-tests.mjs` with:

```js
// server.js calcStructureScore policy regression tests

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

const structureTakePolicySources = serverSrc.includes("const STRUCTURE_TAKE_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isStructureTakeEvent"),
    ]
  : [
      'const STRUCTURE_TAKE_EVENT_TYPES = new Set(["TOWER_TAKE"]);',
      'function isStructureTakeEvent(event) { return STRUCTURE_TAKE_EVENT_TYPES.has(event.eventType); }',
    ];

const calcStructureScoreSrc = extractFunctionSource(serverSrc, "calcStructureScore");

const { calcStructureScore } = new Function(
  [
    ...structureTakePolicySources,
    extractFunctionSource(serverSrc, "clamp10"),
    extractFunctionSource(serverSrc, "calcStructureScore"),
    "return { calcStructureScore };",
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

const tower = () => ({ eventType: "TOWER_TAKE" });
const dragon = () => ({ eventType: "DRAGON_FIGHT" });

check("calcStructureScore neutral towers and neutral diff", calcStructureScore({ teamTowers: 5, enemyTowers: 5 }, []), 2);
check("calcStructureScore 3 towers and +2 tower diff", calcStructureScore(
  { teamTowers: 8, enemyTowers: 6 },
  [tower(), tower(), tower()],
), 7.8);
check("calcStructureScore caps structure pressure at 10", calcStructureScore(
  { teamTowers: 10, enemyTowers: 7 },
  [tower(), tower(), tower(), tower(), tower(), tower()],
), 10);
check("calcStructureScore ignores non-structure objective events", calcStructureScore(
  { teamTowers: 5, enemyTowers: 5 },
  [dragon(), dragon()],
), 2);
checkTrue(
  "server defines STRUCTURE_TAKE_EVENT_TYPES",
  serverSrc.includes('const STRUCTURE_TAKE_EVENT_TYPES = new Set(["TOWER_TAKE"]);'),
);
checkTrue(
  "server defines isStructureTakeEvent",
  serverSrc.includes("function isStructureTakeEvent(event)"),
);
checkTrue(
  "calcStructureScore uses isStructureTakeEvent",
  calcStructureScoreSrc.includes("events.filter(isStructureTakeEvent).length"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 4: Run RED tests**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/structure-score-tests.mjs
```

Expected:
- `strength-weakness-tests.mjs` exits 1 with three new failures: `buildDerivedSignals late structure uses isStructureTakeEvent`, `buildStrengths tower fallback gate uses isStructureTakeEvent`, and `buildStrengths tower fallback evidence uses isStructureTakeEvent`.
- `structure-score-tests.mjs` exits 1 with three source-shape failures: `server defines STRUCTURE_TAKE_EVENT_TYPES`, `server defines isStructureTakeEvent`, and `calcStructureScore uses isStructureTakeEvent`.

### Task 2: Implement Shared Structure-Take Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add policy Set**

Add this constant after `MACRO_OBJECTIVE_WIN_EVENT_TYPES`:

```js
const STRUCTURE_TAKE_EVENT_TYPES = new Set(["TOWER_TAKE"]);
```

- [x] **Step 2: Add helper**

Add this helper after `isMacroObjectiveWinEvent(event)`:

```js
function isStructureTakeEvent(event) {
  return STRUCTURE_TAKE_EVENT_TYPES.has(event.eventType);
}
```

- [x] **Step 3: Replace duplicate structure filters**

Replace these four snippets:

```js
(event) => event.phase === "LATE" && event.eventType === "TOWER_TAKE",
events.some((event) => event.eventType === "TOWER_TAKE")
events.filter((event) => event.eventType === "TOWER_TAKE").slice(-2)
events.filter((e) => e.eventType === "TOWER_TAKE").length
```

with:

```js
(event) => event.phase === "LATE" && isStructureTakeEvent(event),
events.some(isStructureTakeEvent)
events.filter(isStructureTakeEvent).slice(-2)
events.filter(isStructureTakeEvent).length
```

- [x] **Step 4: Run focused GREEN tests**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/structure-score-tests.mjs
```

Expected:
- `strength-weakness-tests.mjs` exits 0 with all checks passing.
- `structure-score-tests.mjs` exits 0 with `7 passed, 0 failed`.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-structure-take-event-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
node --check test-artifacts/server/structure-score-tests.mjs
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/structure-score-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/structure-take-event-policy-local npm run smoke:report:readonly
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
  - `node test-artifacts/server/strength-weakness-tests.mjs`: 82 passed / 3 failed for the three new structure helper source-shape checks.
  - `node test-artifacts/server/structure-score-tests.mjs`: 4 passed / 3 failed for missing structure helper source-shape checks.
- GREEN:
  - `node test-artifacts/server/strength-weakness-tests.mjs`: 85 passed / 0 failed.
  - `node test-artifacts/server/structure-score-tests.mjs`: 7 passed / 0 failed.
- Verification:
  - `node --check server.js`: exit 0.
  - `node --check test-artifacts/server/strength-weakness-tests.mjs`: exit 0.
  - `node --check test-artifacts/server/structure-score-tests.mjs`: exit 0.
  - `npm test`: 1502 passed / 0 failed across 42 test files.
  - `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/structure-take-event-policy-local npm run smoke:report:readonly`: read-only smoke 156 passed / 0 failed, `durationMs: 256`, required checks total 13 / passed 13 / failed 0 / missing 0.
  - `git diff --check`: exit 0.
  - Plan placeholder scan: no matches.
  - Local smoke artifact high-risk sensitive pattern scan: no matches.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with local RED/GREEN evidence, `npm test`, local smoke summary, commit SHA, GitHub Actions run id, artifact id, sensitive scan result, and final `main...origin/main` sync count.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs test-artifacts/server/structure-score-tests.mjs docs/superpowers/plans/2026-06-09-structure-take-event-policy.md
git diff --cached --check
git commit -m "test: share structure take event policy"
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

Expected: QA run for the pushed commit passes, artifact summary reports smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, dirty `false`, and no sensitive-value scan matches.

- [ ] **Step 5: Mark plan complete and final sync**

Update this plan with completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-structure-take-event-policy.md
git diff --cached --check
git commit -m "docs: mark structure take event plan complete"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers structure take consumers in derived signals, strengths, and structure score.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `STRUCTURE_TAKE_EVENT_TYPES` is a `Set`, `isStructureTakeEvent(event)` accepts event objects, and each updated consumer passes event objects directly to `Array.prototype.filter` or `some`.
