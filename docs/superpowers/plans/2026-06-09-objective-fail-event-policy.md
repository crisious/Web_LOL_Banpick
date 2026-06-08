# Objective Fail Event Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route repeated `OBJECTIVE_SETUP_FAIL` consumers through a shared objective-fail event policy helper.

**Architecture:** Add `OBJECTIVE_FAIL_EVENT_TYPES` and `isObjectiveFailEvent(event)` beside the existing objective-win and macro-objective helpers. Update the four consumers that count objective failures for derived signals, weakness evidence, phase summaries, and objective scoring while preserving every current output.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

## File Structure

- Modify: `server.js` — add the objective-fail Set/helper and replace four duplicate `OBJECTIVE_SETUP_FAIL` filters.
- Modify: `test-artifacts/server/strength-weakness-tests.mjs` — add objective-fail policy source-shape checks and inject the helper into extracted fallback-builder tests.
- Modify: `test-artifacts/server/coach-summary-tests.mjs` — inject the helper into the objective-score harness and assert `calcObjectiveScore()` uses it.
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` — append QA evidence for this improvement cycle.
- Modify: `docs/superpowers/plans/2026-06-09-objective-fail-event-policy.md` — mark steps complete and add completion evidence after verification.

### Task 1: Add RED Coverage For Objective-Fail Policy

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`
- Modify: `test-artifacts/server/coach-summary-tests.mjs`

- [x] **Step 1: Update `strength-weakness-tests.mjs` harness**

Add this block after `extractConstSource()`:

```js
const objectiveFailPolicySources = serverSrc.includes("const OBJECTIVE_FAIL_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "OBJECTIVE_FAIL_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isObjectiveFailEvent"),
    ]
  : [
      'const OBJECTIVE_FAIL_EVENT_TYPES = new Set(["OBJECTIVE_SETUP_FAIL"]);',
      'function isObjectiveFailEvent(event) { return OBJECTIVE_FAIL_EVENT_TYPES.has(event.eventType); }',
    ];
```

Then insert this spread after the existing `isObjectiveWinEvent` harness injection:

```js
...objectiveFailPolicySources,
```

- [x] **Step 2: Add `strength-weakness-tests.mjs` source-shape checks**

Add these checks after the existing `bestObjectiveSummary uses isObjectiveWinEvent` check:

```js
checkTrue(
  "server defines OBJECTIVE_FAIL_EVENT_TYPES",
  serverSrc.includes('const OBJECTIVE_FAIL_EVENT_TYPES = new Set(["OBJECTIVE_SETUP_FAIL"]);'),
);
checkTrue(
  "server defines isObjectiveFailEvent",
  serverSrc.includes("function isObjectiveFailEvent(event)"),
);
checkTrue(
  "buildDerivedSignals uses isObjectiveFailEvent",
  buildDerivedSignalsSrc.includes("events.filter(isObjectiveFailEvent)"),
);
checkTrue(
  "buildPhaseSummaries uses isObjectiveFailEvent",
  buildPhaseSummariesSrc.includes("phaseEvents.filter(isObjectiveFailEvent).length"),
);
```

Replace the existing objective-fail cache check:

```js
checkTrue(
  "buildWeaknesses caches objectiveFailEvents",
  buildWeaknessesSrc.includes('const objectiveFailEvents = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");'),
);
```

with:

```js
checkTrue(
  "buildWeaknesses objective fails use isObjectiveFailEvent",
  buildWeaknessesSrc.includes("const objectiveFailEvents = events.filter(isObjectiveFailEvent);"),
);
```

- [x] **Step 3: Update `coach-summary-tests.mjs` harness**

Add this block after `extractConstSource()`:

```js
const objectiveFailPolicySources = serverSrc.includes("const OBJECTIVE_FAIL_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "OBJECTIVE_FAIL_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isObjectiveFailEvent"),
    ]
  : [
      'const OBJECTIVE_FAIL_EVENT_TYPES = new Set(["OBJECTIVE_SETUP_FAIL"]);',
      'function isObjectiveFailEvent(event) { return OBJECTIVE_FAIL_EVENT_TYPES.has(event.eventType); }',
    ];
```

Then insert this spread after the existing `isObjectiveWinEvent` harness injection:

```js
...objectiveFailPolicySources,
```

- [x] **Step 4: Add `calcObjectiveScore()` source-shape check**

Add this check after `calcObjectiveScore uses isObjectiveWinEvent`:

```js
checkTrue(
  "calcObjectiveScore objective fails use isObjectiveFailEvent",
  calcObjectiveScoreSrc.includes("events.filter(isObjectiveFailEvent).length"),
);
```

- [x] **Step 5: Run RED tests**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/coach-summary-tests.mjs
```

Expected:
- `strength-weakness-tests.mjs` exits 1 with five new failures: `server defines OBJECTIVE_FAIL_EVENT_TYPES`, `server defines isObjectiveFailEvent`, `buildDerivedSignals uses isObjectiveFailEvent`, `buildPhaseSummaries uses isObjectiveFailEvent`, and `buildWeaknesses objective fails use isObjectiveFailEvent`.
- `coach-summary-tests.mjs` exits 1 with one new failure: `calcObjectiveScore objective fails use isObjectiveFailEvent`.

### Task 2: Implement Shared Objective-Fail Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add policy Set**

Add this constant after `OBJECTIVE_WIN_EVENT_TYPES`:

```js
const OBJECTIVE_FAIL_EVENT_TYPES = new Set(["OBJECTIVE_SETUP_FAIL"]);
```

- [x] **Step 2: Add helper**

Add this helper after `isObjectiveWinEvent(event)`:

```js
function isObjectiveFailEvent(event) {
  return OBJECTIVE_FAIL_EVENT_TYPES.has(event.eventType);
}
```

- [x] **Step 3: Replace duplicate filters**

Replace these four filters:

```js
const objectiveFails = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");
const objectiveFailEvents = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");
const objectiveFails = phaseEvents.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL").length;
const fails = events.filter((e) => e.eventType === "OBJECTIVE_SETUP_FAIL").length;
```

with:

```js
const objectiveFails = events.filter(isObjectiveFailEvent);
const objectiveFailEvents = events.filter(isObjectiveFailEvent);
const objectiveFails = phaseEvents.filter(isObjectiveFailEvent).length;
const fails = events.filter(isObjectiveFailEvent).length;
```

- [x] **Step 4: Run focused GREEN tests**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/coach-summary-tests.mjs
```

Expected:
- `strength-weakness-tests.mjs` exits 0 with all checks passing.
- `coach-summary-tests.mjs` exits 0 with all checks passing.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-objective-fail-event-policy.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
node --check test-artifacts/server/coach-summary-tests.mjs
node test-artifacts/server/strength-weakness-tests.mjs
node test-artifacts/server/coach-summary-tests.mjs
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-fail-event-policy-local npm run smoke:report:readonly
git diff --check
```

Expected:
- `node --check` commands exit 0.
- Focused tests exit 0.
- `npm test` exits 0.
- Read-only smoke report exits 0.
- `git diff --check` exits 0.

- [x] **Step 2: Update Obsidian QA log**

Append a cycle entry before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with local RED/GREEN evidence, `npm test`, local smoke summary, commit SHA, GitHub Actions run id, artifact id, sensitive scan result, and final `main...origin/main` sync count.

- [x] **Step 3: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs test-artifacts/server/coach-summary-tests.mjs docs/superpowers/plans/2026-06-09-objective-fail-event-policy.md
git diff --cached --check
git commit -m "test: share objective fail event policy"
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

Expected: QA run for the pushed commit passes, artifact summary reports smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, dirty `false`, and no sensitive-value scan matches.

- [x] **Step 5: Mark plan complete and final sync**

Update this plan with completion evidence, then run:

```bash
git add docs/superpowers/plans/2026-06-09-objective-fail-event-policy.md
git diff --cached --check
git commit -m "docs: mark objective fail event plan complete"
git push origin main
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
```

Expected: final status is `## main...origin/main` and rev-list output is `0 0`.

## Self-Review

- Spec coverage: The plan covers the four current objective-fail consumers that count `OBJECTIVE_SETUP_FAIL` events.
- Placeholder scan: No blocked placeholder wording is used.
- Type consistency: `OBJECTIVE_FAIL_EVENT_TYPES` is a `Set`, `isObjectiveFailEvent(event)` accepts event objects, and every updated consumer passes event objects directly to `Array.prototype.filter`.

## Completion Evidence

- RED check: `node test-artifacts/server/strength-weakness-tests.mjs` exited 1 with `77 passed, 5 failed`. The failing checks were `server defines OBJECTIVE_FAIL_EVENT_TYPES`, `server defines isObjectiveFailEvent`, `buildDerivedSignals uses isObjectiveFailEvent`, `buildPhaseSummaries uses isObjectiveFailEvent`, and `buildWeaknesses objective fails use isObjectiveFailEvent`.
- RED check: `node test-artifacts/server/coach-summary-tests.mjs` exited 1 with `9 passed, 1 failed`. The failing check was `calcObjectiveScore objective fails use isObjectiveFailEvent`.
- GREEN check: `node test-artifacts/server/strength-weakness-tests.mjs` exited 0 with `82 passed, 0 failed`.
- GREEN check: `node test-artifacts/server/coach-summary-tests.mjs` exited 0 with `10 passed, 0 failed`.
- Syntax checks: `node --check server.js`, `node --check test-artifacts/server/strength-weakness-tests.mjs`, and `node --check test-artifacts/server/coach-summary-tests.mjs` exited 0.
- Diff hygiene: `git diff --check` exited 0.
- Placeholder scan: the plan document scan exited 0 with no blocked placeholder strings.
- Full local tests: `npm test` exited 0 with `1492 passed, 0 failed across 41 test file(s)`.
- Local read-only smoke: `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-fail-event-policy-local npm run smoke:report:readonly` exited 0 with smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, and `qaVerdict.status: "passed"`.
- Local smoke sensitive scan: no matches for secret/token/API-key/path patterns.
- Implementation commit: `69bb8f9 test: share objective fail event policy`.
- GitHub Actions QA: run `27153563983` passed for SHA `69bb8f911d44d55e8acc0ceddda7d2d140de1d91`.
- GitHub QA artifact: `7487033022` (`qa-automation-27153563983`, 3550 bytes) reported read-only smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, `latestRun.git.shortSha: "69bb8f9"`, and `dirty: false`.
- GitHub artifact sensitive scan: no matches for secret/token/API-key/path patterns.
- Obsidian project log updated at `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`.
