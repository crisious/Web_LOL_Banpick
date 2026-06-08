# Objective Policy Consumers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the remaining rule-based objective score and coach summary consumers through the shared objective-win event policy.

**Architecture:** Keep the existing `OBJECTIVE_WIN_EVENT_TYPES` and `isObjectiveWinEvent(event)` helper as the source of truth for dragon/baron/objective-setup wins. Update `calcObjectiveScore()` and `buildCoachSummary()` to use that helper while preserving their current behavior, including keeping `TOWER_TAKE` out of objective score and coach-summary objective-event counts.

**Tech Stack:** Node.js single-file server, plain JavaScript extracted-function regression tests, npm test harness, read-only smoke report runner.

---

### Task 1: Add Failing Regression Tests

**Files:**
- Modify: `test-artifacts/server/coach-summary-tests.mjs`

- [x] **Step 1: Capture source for objective policy consumers**

Add these constants before the `new Function` harness:

```js
const buildCoachSummarySrc = extractFunctionSource(serverSrc, "buildCoachSummary");
const calcObjectiveScoreSrc = extractFunctionSource(serverSrc, "calcObjectiveScore");
```

- [x] **Step 2: Inject objective policy and score function into the harness**

Change the harness source list from:

```js
[
  extractConstSource(serverSrc, "POST_OBJECTIVE_DEATH_WINDOW_MS"),
  extractFunctionSource(serverSrc, "filterPostObjectiveDeaths"),
  extractFunctionSource(serverSrc, "buildCoachSummary"),
  "return { buildCoachSummary };",
]
```

to:

```js
[
  extractConstSource(serverSrc, "POST_OBJECTIVE_DEATH_WINDOW_MS"),
  extractConstSource(serverSrc, "OBJECTIVE_WIN_EVENT_TYPES"),
  extractFunctionSource(serverSrc, "isObjectiveWinEvent"),
  extractFunctionSource(serverSrc, "filterPostObjectiveDeaths"),
  extractFunctionSource(serverSrc, "clamp10"),
  extractFunctionSource(serverSrc, "calcObjectiveScore"),
  extractFunctionSource(serverSrc, "buildCoachSummary"),
  "return { buildCoachSummary, calcObjectiveScore };",
]
```

Change the destructuring from:

```js
const { buildCoachSummary } = new Function(
```

to:

```js
const { buildCoachSummary, calcObjectiveScore } = new Function(
```

- [x] **Step 3: Add `checkTrue()` helper**

Add this helper after `check()`:

```js
function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}
```

- [x] **Step 4: Add objective score behavior checks**

Add these checks after `const objEvent = ...`:

```js
check("calcObjectiveScore no objective events -> neutral", calcObjectiveScore([]), 5);
check("calcObjectiveScore 3 wins / 1 fail", calcObjectiveScore([
  { eventType: "DRAGON_FIGHT" },
  { eventType: "BARON_FIGHT" },
  { eventType: "OBJECTIVE_SETUP_WIN" },
  { eventType: "OBJECTIVE_SETUP_FAIL" },
]), 7.2);
check("calcObjectiveScore ignores tower take as objective win", calcObjectiveScore([
  { eventType: "TOWER_TAKE" },
  { eventType: "OBJECTIVE_SETUP_FAIL" },
]), 0);
```

- [x] **Step 5: Add source-shape checks for shared objective policy use**

Add these checks after the objective score behavior checks:

```js
checkTrue(
  "buildCoachSummary uses isObjectiveWinEvent",
  buildCoachSummarySrc.includes("timelineEvents.filter(isObjectiveWinEvent)"),
);
checkTrue(
  "calcObjectiveScore uses isObjectiveWinEvent",
  calcObjectiveScoreSrc.includes("events.filter(isObjectiveWinEvent)"),
);
```

- [x] **Step 6: Run focused test to verify RED**

Run:

```bash
node test-artifacts/server/coach-summary-tests.mjs
```

Expected: FAIL with two new source-shape checks failing while the existing coach summary behavior checks and objective score behavior checks pass.

### Task 2: Implement Shared Objective Policy Consumers

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/coach-summary-tests.mjs`

- [x] **Step 1: Update `calcObjectiveScore()`**

Change:

```js
const wins = events.filter((e) => ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(e.eventType)).length;
```

to:

```js
const wins = events.filter(isObjectiveWinEvent).length;
```

- [x] **Step 2: Update `buildCoachSummary()`**

Change:

```js
const objectiveEvents = normalized.timelineEvents.filter((event) =>
  ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType),
);
```

to:

```js
const objectiveEvents = normalized.timelineEvents.filter(isObjectiveWinEvent);
```

- [x] **Step 3: Run focused test to verify GREEN**

Run:

```bash
node test-artifacts/server/coach-summary-tests.mjs
```

Expected: PASS with all focused checks green.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-objective-policy-consumers.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification gates**

Run:

```bash
node --check server.js
node --check test-artifacts/server/coach-summary-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-objective-policy-consumers.md
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-policy-consumers-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/objective-policy-consumers-local/qa-summary.json
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/objective-policy-consumers-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:
- syntax checks exit 0
- `git diff --check` exits 0
- placeholder scan exits 1 with no matches
- `npm test` reports 0 failed
- read-only smoke report passes with 0 failed checks
- sensitive scan prints `no sensitive matches`

- [x] **Step 2: Record implementation evidence in Obsidian**

Add a new section before `## 리스크 관리` with:

```markdown
### 2026-06-09 HH:MM KST - Objective policy consumers 공유

- 구현 커밋: 후속 커밋 예정
- 계획 완료 커밋: 후속 문서 완료 커밋 예정
- GitHub push: `origin/main`
- 변경 배경: `OBJECTIVE_WIN_EVENT_TYPES` / `isObjectiveWinEvent()`가 도입된 뒤에도 `calcObjectiveScore()`와 `buildCoachSummary()`가 같은 오브젝트 승리 이벤트 목록을 inline으로 반복하고 있었다. 점수와 코칭 요약이 같은 전투형 오브젝트 정책을 사용하도록 연결한다.
- 변경 범위:
  - `server.js`: `calcObjectiveScore()`와 `buildCoachSummary()`가 `isObjectiveWinEvent`를 사용하도록 변경
  - `test-artifacts/server/coach-summary-tests.mjs`: objective score behavior와 shared objective policy source-shape 회귀 테스트 추가
  - `docs/superpowers/plans/2026-06-09-objective-policy-consumers.md`: TDD 계획 및 검증 기록 추가
- RED 확인:
  - `node test-artifacts/server/coach-summary-tests.mjs`: 후속 기록
- GREEN 확인:
  - `node test-artifacts/server/coach-summary-tests.mjs`: 후속 기록
- 로컬 QA:
  - 후속 기록
- GitHub Actions QA:
  - 후속 기록
- main sync: 최종 확인 예정
```

- [ ] **Step 3: Commit and push implementation**

Run:

```bash
git add server.js test-artifacts/server/coach-summary-tests.mjs docs/superpowers/plans/2026-06-09-objective-policy-consumers.md
git diff --cached --check
git commit -m "test: share objective policy consumers"
git push origin main
```

Expected: commit and push succeed on `main`.

- [ ] **Step 4: Verify GitHub Actions QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha,status,conclusion --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/objective-policy-consumers-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/objective-policy-consumers-gh/qa-summary.json
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/objective-policy-consumers-gh; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected: GitHub Actions QA passes, artifact smoke summary has 0 failed, sensitive scan prints `no sensitive matches`.

- [ ] **Step 5: Mark plan complete and push docs completion**

After implementation QA, update this plan’s checkboxes and add a `## Completion Evidence` section with local and GitHub evidence. Then run:

```bash
git add docs/superpowers/plans/2026-06-09-objective-policy-consumers.md
git diff --cached --check
git commit -m "docs: mark objective policy consumer plan complete"
git push origin main
```

Expected: docs completion commit and push succeed.

- [ ] **Step 6: Final sync and cleanup**

Run:

```bash
rm -rf test-artifacts/tmp
git fetch origin --prune
git pull --ff-only
git status --short --branch
git rev-list --left-right --count main...origin/main
git log --oneline --decorate -8
find test-artifacts -maxdepth 2 -type d -name tmp -print
```

Expected:
- `Already up to date.`
- `## main...origin/main`
- `0 0`
- no `test-artifacts/tmp` output

## Self-Review

- Spec coverage: This plan routes the remaining score and coach-summary objective-win consumers through `isObjectiveWinEvent()` while preserving current output behavior and keeping structure takes excluded from this policy.
- Placeholder scan target: `rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-objective-policy-consumers.md`
- Type consistency: `OBJECTIVE_WIN_EVENT_TYPES`, `isObjectiveWinEvent`, `calcObjectiveScore`, and `buildCoachSummary` are named consistently across tests and implementation.
