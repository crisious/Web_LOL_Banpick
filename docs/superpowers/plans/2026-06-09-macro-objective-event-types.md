# Macro Objective Event Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rule-based derived signals and phase summaries share one named macro-objective event type policy that includes structure takes.

**Architecture:** Keep the existing combat-objective policy `OBJECTIVE_WIN_EVENT_TYPES` unchanged for dragon/baron/setup-only paths. Add a separate `MACRO_OBJECTIVE_WIN_EVENT_TYPES` Set plus `isMacroObjectiveWinEvent(event)` helper for paths that already include `TOWER_TAKE`, then replace the duplicated inline arrays in `buildDerivedSignals()` and `buildPhaseSummaries()`.

**Tech Stack:** Node.js single-file server, plain JavaScript source-shape regression tests, npm test harness.

---

### Task 1: Add Failing Source-Shape Regression Tests

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Capture source for the two macro-objective consumers**

Add these constants after the existing `bestObjectiveSummarySrc` declaration:

```js
const buildDerivedSignalsSrc = extractFunctionSource(serverSrc, "buildDerivedSignals");
const buildPhaseSummariesSrc = extractFunctionSource(serverSrc, "buildPhaseSummaries");
```

- [x] **Step 2: Add source-shape checks for the shared macro-objective policy**

Add these checks after the existing `bestObjectiveSummary uses isObjectiveWinEvent` check:

```js
checkTrue(
  "server defines MACRO_OBJECTIVE_WIN_EVENT_TYPES",
  serverSrc.includes('const MACRO_OBJECTIVE_WIN_EVENT_TYPES = new Set([...OBJECTIVE_WIN_EVENT_TYPES, "TOWER_TAKE"]);'),
);
checkTrue(
  "server defines isMacroObjectiveWinEvent",
  serverSrc.includes("function isMacroObjectiveWinEvent(event)"),
);
checkTrue(
  "buildDerivedSignals uses isMacroObjectiveWinEvent",
  buildDerivedSignalsSrc.includes("events.filter(isMacroObjectiveWinEvent)"),
);
checkTrue(
  "buildPhaseSummaries uses isMacroObjectiveWinEvent",
  buildPhaseSummariesSrc.includes("phaseEvents.filter(isMacroObjectiveWinEvent).length"),
);
```

- [x] **Step 3: Run focused test to verify RED**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected: FAIL with four new source-shape checks failing while the existing behavioral checks still run.

### Task 2: Implement Shared Macro-Objective Policy

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Add module-level macro-objective Set**

In `server.js`, directly after `OBJECTIVE_WIN_EVENT_TYPES`, add:

```js
const MACRO_OBJECTIVE_WIN_EVENT_TYPES = new Set([...OBJECTIVE_WIN_EVENT_TYPES, "TOWER_TAKE"]);
```

- [x] **Step 2: Add helper beside `isObjectiveWinEvent()`**

In `server.js`, directly after `isObjectiveWinEvent(event)`, add:

```js
function isMacroObjectiveWinEvent(event) {
  return MACRO_OBJECTIVE_WIN_EVENT_TYPES.has(event.eventType);
}
```

- [x] **Step 3: Replace the duplicated inline macro-objective filters**

Change `buildDerivedSignals()` from:

```js
const objectiveWins = events.filter((event) =>
  ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN", "TOWER_TAKE"].includes(event.eventType),
);
```

to:

```js
const objectiveWins = events.filter(isMacroObjectiveWinEvent);
```

Change `buildPhaseSummaries()` from:

```js
const objectiveWins = phaseEvents.filter((event) =>
  ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN", "TOWER_TAKE"].includes(event.eventType),
).length;
```

to:

```js
const objectiveWins = phaseEvents.filter(isMacroObjectiveWinEvent).length;
```

- [x] **Step 4: Inject the shared policy into the extracted-function test harness**

In `test-artifacts/server/strength-weakness-tests.mjs`, add these two entries after the existing `OBJECTIVE_WIN_EVENT_TYPES` / `isObjectiveWinEvent` entries in the `new Function` source list:

```js
extractConstSource(serverSrc, "MACRO_OBJECTIVE_WIN_EVENT_TYPES"),
extractFunctionSource(serverSrc, "isMacroObjectiveWinEvent"),
```

- [x] **Step 5: Run focused test to verify GREEN**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected: PASS with all focused checks green.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-macro-objective-event-types.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification gates**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-macro-objective-event-types.md
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/macro-objective-event-types-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/macro-objective-event-types-local/qa-summary.json
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/macro-objective-event-types-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
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
### 2026-06-09 HH:MM KST - Macro objective event types 공유

- 구현 커밋: 후속 커밋 예정
- 계획 완료 커밋: 후속 문서 완료 커밋 예정
- GitHub push: `origin/main`
- 변경 배경: `buildDerivedSignals()`와 `buildPhaseSummaries()`가 구조물까지 포함한 매크로 오브젝트 승리 이벤트를 같은 inline 배열로 반복하고 있었다. 전투형 오브젝트 정책과 구분되는 `MACRO_OBJECTIVE_WIN_EVENT_TYPES` / `isMacroObjectiveWinEvent()`로 공유해 향후 TOWER_TAKE 포함 여부 드리프트를 줄인다.
- 변경 범위:
  - `server.js`: `MACRO_OBJECTIVE_WIN_EVENT_TYPES` Set과 `isMacroObjectiveWinEvent(event)` helper 추가, derived signals/phase summaries가 helper를 사용하도록 변경
  - `test-artifacts/server/strength-weakness-tests.mjs`: shared macro objective policy source-shape 회귀 테스트 추가
  - `docs/superpowers/plans/2026-06-09-macro-objective-event-types.md`: TDD 계획 및 검증 기록 추가
- RED 확인:
  - `node test-artifacts/server/strength-weakness-tests.mjs`: 후속 기록
- GREEN 확인:
  - `node test-artifacts/server/strength-weakness-tests.mjs`: 후속 기록
- 로컬 QA:
  - 후속 기록
- GitHub Actions QA:
  - 후속 기록
- main sync: 최종 확인 예정
```

- [ ] **Step 3: Commit and push implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs docs/superpowers/plans/2026-06-09-macro-objective-event-types.md
git diff --cached --check
git commit -m "test: share macro objective event types"
git push origin main
```

Expected: commit and push succeed on `main`.

- [ ] **Step 4: Verify GitHub Actions QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha,status,conclusion --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/macro-objective-event-types-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/macro-objective-event-types-gh/qa-summary.json
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/macro-objective-event-types-gh; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected: GitHub Actions QA passes, artifact smoke summary has 0 failed, sensitive scan prints `no sensitive matches`.

- [ ] **Step 5: Mark plan complete and push docs completion**

After implementation QA, update this plan’s checkboxes and add a `## Completion Evidence` section with local and GitHub evidence. Then run:

```bash
git add docs/superpowers/plans/2026-06-09-macro-objective-event-types.md
git diff --cached --check
git commit -m "docs: mark macro objective event plan complete"
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

- Spec coverage: This plan shares the macro-objective event type policy across the two rule-based paths that already include `TOWER_TAKE`, while leaving combat-objective scoring and coach summary behavior unchanged.
- Placeholder scan target: `rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-macro-objective-event-types.md`
- Type consistency: `MACRO_OBJECTIVE_WIN_EVENT_TYPES` is a `Set`, `isMacroObjectiveWinEvent(event)` accepts timeline event objects, and both consumers pass event objects directly to `Array.prototype.filter`.
