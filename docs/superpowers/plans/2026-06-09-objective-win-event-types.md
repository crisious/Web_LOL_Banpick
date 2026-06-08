# Objective Win Event Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rule-based objective insight builders share one named objective-win event type policy.

**Architecture:** `bestObjectiveSummary()`, `buildStrengths()`, and `buildWeaknesses()` all classify `DRAGON_FIGHT`, `BARON_FIGHT`, and `OBJECTIVE_SETUP_WIN` as objective wins, but each function repeats the same inline array. Add `OBJECTIVE_WIN_EVENT_TYPES` plus `isObjectiveWinEvent(event)`, inject that helper into the extracted-function test harness, and route the three fallback builder locations through the helper.

**Tech Stack:** Node.js zero-dependency extracted-function tests, `server.js`, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Source-Shape Coverage

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Capture `bestObjectiveSummary()` source for source-shape checks**

After:

```js
const buildStrengthsSrc = extractFunctionSource(serverSrc, "buildStrengths");
const buildWeaknessesSrc = extractFunctionSource(serverSrc, "buildWeaknesses");
```

Add:

```js
const bestObjectiveSummarySrc = extractFunctionSource(serverSrc, "bestObjectiveSummary");
```

- [x] **Step 2: Add source-shape checks for the shared objective-win policy**

After the existing `bestObjectiveSummary 0 win -> null` check, add:

```js
checkTrue(
  "server defines OBJECTIVE_WIN_EVENT_TYPES",
  serverSrc.includes('const OBJECTIVE_WIN_EVENT_TYPES = new Set(["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"]);'),
);
checkTrue(
  "bestObjectiveSummary uses isObjectiveWinEvent",
  bestObjectiveSummarySrc.includes("timelineEvents.filter(isObjectiveWinEvent)"),
);
```

- [x] **Step 3: Add builder source-shape checks**

After the existing `buildStrengths A fight relatedEventIds (3 combat)` check, add:

```js
checkTrue(
  "buildStrengths objective evidence uses isObjectiveWinEvent",
  buildStrengthsSrc.includes(".filter(isObjectiveWinEvent)"),
);
```

After the existing `buildWeaknesses A titles` check, add:

```js
checkTrue(
  "buildWeaknesses objective wins use isObjectiveWinEvent",
  buildWeaknessesSrc.includes("const objectiveWins = events.filter(isObjectiveWinEvent);"),
);
```

- [x] **Step 4: Run focused RED test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected before implementation:

```text
66 passed, 4 failed
```

The four failures should be:

```text
FAIL  server defines OBJECTIVE_WIN_EVENT_TYPES
FAIL  bestObjectiveSummary uses isObjectiveWinEvent
FAIL  buildStrengths objective evidence uses isObjectiveWinEvent
FAIL  buildWeaknesses objective wins use isObjectiveWinEvent
```

### Task 2: Share Objective-Win Event Classification

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Add the top-level objective-win event type set**

After:

```js
const VISION_STRENGTH_THRESHOLDS = { JUNGLE: 35, DEFAULT: 25 };
```

Add:

```js
const OBJECTIVE_WIN_EVENT_TYPES = new Set(["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"]);
```

- [x] **Step 2: Add `isObjectiveWinEvent(event)` helper**

After `visionStrengthThreshold(position)`, add:

```js
function isObjectiveWinEvent(event) {
  return OBJECTIVE_WIN_EVENT_TYPES.has(event.eventType);
}
```

- [x] **Step 3: Use the helper in `bestObjectiveSummary()`**

Change:

```js
const wins = normalized.timelineEvents.filter((event) =>
  ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType),
);
```

To:

```js
const wins = normalized.timelineEvents.filter(isObjectiveWinEvent);
```

- [x] **Step 4: Use the helper in `buildStrengths()`**

Change:

```js
const linked = events
  .filter((event) => ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType))
  .slice(0, 4);
```

To:

```js
const linked = events
  .filter(isObjectiveWinEvent)
  .slice(0, 4);
```

- [x] **Step 5: Use the helper in `buildWeaknesses()`**

Change:

```js
const objectiveWins = events.filter((event) =>
  ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType),
);
```

To:

```js
const objectiveWins = events.filter(isObjectiveWinEvent);
```

- [x] **Step 6: Inject the shared policy into the extracted-function harness**

Inside the `new Function([...].join("\n"))` source list in `test-artifacts/server/strength-weakness-tests.mjs`, add these entries before `extractFunctionSource(serverSrc, "bestObjectiveSummary")`:

```js
    extractConstSource(serverSrc, "OBJECTIVE_WIN_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isObjectiveWinEvent"),
```

- [x] **Step 7: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected after implementation:

```text
70 passed, 0 failed
```

### Task 3: QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-objective-win-event-types.md`

- [x] **Step 1: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-objective-win-event-types.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 2: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1468 passed, 0 failed
```

- [x] **Step 3: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-win-event-types-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/objective-win-event-types-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 4: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/objective-win-event-types-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-09-objective-win-event-types.md`

- [ ] **Step 1: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs docs/superpowers/plans/2026-06-09-objective-win-event-types.md
git commit -m "test: share objective win event types"
git push origin main
```

- [ ] **Step 2: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/objective-win-event-types-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/objective-win-event-types-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

- [ ] **Step 3: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

---

## Self-Review

- Spec coverage: This plan shares the objective-win event type policy across the three rule-based objective insight paths while preserving existing output behavior.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `OBJECTIVE_WIN_EVENT_TYPES`, `isObjectiveWinEvent`, `bestObjectiveSummary`, `buildStrengths`, and `buildWeaknesses` are named consistently across tests and implementation.
