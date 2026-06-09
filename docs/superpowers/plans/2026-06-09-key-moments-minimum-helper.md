# Key Moments Minimum Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure key moment minimum-count validation uses the shared `hasMinimumKeyMoments()` helper everywhere count-specific repair classification depends on it.

**Architecture:** Keep the behavior in `server.js` unchanged while tightening the validation boundary. The existing `hasMinimumKeyMoments()` helper should be the only key-moment minimum-count predicate used by `hasValidKeyMoments()` and the `buildAnalysis()` count violation branch.

**Tech Stack:** Node.js, plain JavaScript, existing source-extraction regression tests.

---

### Task 1: Add RED Coverage For Helper Delegation

**Files:**
- Modify: `test-artifacts/server/key-moments-count-tracking-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-key-moments-minimum-helper.md`

- [x] **Step 1: Capture validator source**

In `test-artifacts/server/key-moments-count-tracking-tests.mjs`, add:

```js
const hasValidKeyMomentsSrc = extractFunctionSource(serverSrc, "hasValidKeyMoments");
```

- [x] **Step 2: Assert helper reuse**

Add these checks near the existing buildAnalysis source assertion:

```js
checkTrue(
  "server defines shared key moments minimum helper",
  serverSrc.includes("function hasMinimumKeyMoments"),
);
checkTrue(
  "hasValidKeyMoments reuses minimum helper",
  hasValidKeyMomentsSrc.includes("hasMinimumKeyMoments(keyMoments)"),
);
checkTrue(
  "buildAnalysis checks key moments minimum helper for count",
  buildAnalysisSrc.includes("hasMinimumKeyMoments(primary.keyMoments)"),
);
```

- [x] **Step 3: Verify RED**

Run:

```bash
node --check test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/server/key-moments-count-tracking-tests.mjs
```

Expected: syntax passes, runtime fails on helper reuse while existing behavior checks continue to pass.

### Task 2: Implement Minimal Helper Delegation

**Files:**
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-key-moments-minimum-helper.md`

- [x] **Step 1: Update `hasValidKeyMoments()`**

Change only the count predicate:

```js
function hasValidKeyMoments(keyMoments) {
  return hasMinimumKeyMoments(keyMoments) &&
    hasValidKeyMomentItemShapes(keyMoments);
}
```

- [x] **Step 2: Update `buildAnalysis()` count branch**

Change only the short-count predicate:

```js
Array.isArray(primary.keyMoments) &&
!hasMinimumKeyMoments(primary.keyMoments) &&
keyMomentsHaveValidItemShapes
```

- [x] **Step 3: Verify focused GREEN**

Run:

```bash
node --check server.js
node --check test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/server/key-moments-shape-before-count-tests.mjs
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected: all focused tests pass.

### Task 3: Full QA And Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-key-moments-minimum-helper.md`
- Update outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-minimum-helper-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/key-moments-minimum-helper-local
```

Expected: tests and smoke pass; the sensitive-pattern scan exits 1 with no matches.

Result:

```text
npm test
2209 passed, 0 failed across 99 test file(s)

git diff --check
PASS

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-minimum-helper-local npm run smoke:report:readonly
156 passed, 0 failed
qa-summary durationMs: 705
qaVerdict.status: passed
sampleEvidence.detailChecks: 19 passed / 0 failed
demoSafetyEvidence.status: passed
requiredCheckSummary total 13 / passed 13 / failed 0 / missing 0

sensitive artifact scan
no matches
```

- [x] **Step 2: Mark plan complete and commit**

Mark this plan's checklist complete after local QA passes, then commit:

```bash
git add server.js test-artifacts/server/key-moments-count-tracking-tests.mjs docs/superpowers/plans/2026-06-09-key-moments-minimum-helper.md
git commit -m "test: reuse key moments minimum helper"
git push origin main
```

- [x] **Step 3: Verify GitHub QA**

Watch the pushed `QA` workflow, download the uploaded `qa-automation-*` artifact, inspect `qa-summary.json`, and scan the artifact for the same sensitive patterns.

Result:

```text
implementation commit
edd5e98 test: reuse key moments minimum helper

GitHub QA run
27184404239 success
headSha: edd5e9879428cfe531b944bfacafef7c851e6202

artifact
7498701083 qa-automation-27184404239, 3551 bytes

qa-summary
read-only smoke 156 passed, 0 failed
durationMs: 229
latestRun.qaVerdict.status: passed
latestRun.ci.provider: github-actions
latestRun.git.shortSha: edd5e98
dirty: false
requiredCheckSummary total 13 / passed 13 / failed 0 / missing 0

sensitive artifact scan
no matches
```
