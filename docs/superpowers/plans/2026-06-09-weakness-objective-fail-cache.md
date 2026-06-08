# Weakness Objective Fail Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `buildWeaknesses()` compute objective setup failure events once and reuse them in the fallback padding branch.

**Architecture:** `buildWeaknesses()` already precomputes deaths, early deaths, objective wins, and post-objective deaths before building weakness cards. The fallback padding loop currently filters `events` for `OBJECTIVE_SETUP_FAIL` on every iteration, so source-shape tests will fail first while the filter remains inside the loop, then the implementation will introduce a cached `objectiveFailEvents` array beside the other derived event lists.

**Tech Stack:** Node.js zero-dependency extracted-function tests, `server.js`, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Source-Shape Coverage

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Add source-shape checks for cached objective fail events**

After the existing `buildWeaknesses B all fallback title` check, add:

```js
checkTrue(
  "buildWeaknesses caches objectiveFailEvents",
  buildWeaknessesSrc.includes('const objectiveFailEvents = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");'),
);
checkTrue(
  "buildWeaknesses fallback uses cached objectiveFailEvents",
  buildWeaknessesSrc.includes("objectiveFailEvents.length ? objectiveFailEvents.slice(0, 2) : deaths.slice(0, 2);"),
);
```

- [x] **Step 2: Run focused RED test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected before implementation:

```text
60 passed, 2 failed
```

The two failures should be:

```text
FAIL  buildWeaknesses caches objectiveFailEvents
FAIL  buildWeaknesses fallback uses cached objectiveFailEvents
```

### Task 2: Reuse Cached Objective Fail Events

**Files:**
- Modify: `server.js`

- [x] **Step 1: Define `objectiveFailEvents` beside the other derived event arrays**

Inside `buildWeaknesses()`, after:

```js
const objectiveWins = events.filter((event) =>
  ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType),
);
```

Add:

```js
const objectiveFailEvents = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");
```

- [x] **Step 2: Use `objectiveFailEvents` in the fallback padding loop**

Change:

```js
const objectiveFails = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");
const linked = objectiveFails.length ? objectiveFails.slice(0, 2) : deaths.slice(0, 2);
```

To:

```js
const linked = objectiveFailEvents.length ? objectiveFailEvents.slice(0, 2) : deaths.slice(0, 2);
```

- [x] **Step 3: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected after implementation:

```text
62 passed, 0 failed
```

### Task 3: QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-weakness-objective-fail-cache.md`

- [x] **Step 1: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-weakness-objective-fail-cache.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 2: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1460 passed, 0 failed
```

- [x] **Step 3: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/weakness-objective-fail-cache-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/weakness-objective-fail-cache-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 4: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/weakness-objective-fail-cache-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-09-weakness-objective-fail-cache.md`

- [ ] **Step 1: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs docs/superpowers/plans/2026-06-09-weakness-objective-fail-cache.md
git commit -m "test: cache weakness objective failures"
git push origin main
```

- [ ] **Step 2: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/weakness-objective-fail-cache-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/weakness-objective-fail-cache-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

- [ ] **Step 3: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

---

## Self-Review

- Spec coverage: This plan removes the repeated `OBJECTIVE_SETUP_FAIL` filter inside `buildWeaknesses()` fallback padding while preserving the emitted weakness cards.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `objectiveFailEvents`, `buildWeaknesses`, and `OBJECTIVE_SETUP_FAIL` are named consistently across tests and implementation.
