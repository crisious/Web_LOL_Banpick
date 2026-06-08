# Fight Contribution Event Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rule-based fight summary and fight-strength evidence share one named fight-contribution event type policy.

**Architecture:** Add a module-level `FIGHT_CONTRIBUTION_EVENT_TYPES` Set plus `isFightContributionEvent(event)` helper for the three events already treated as positive fight contribution: `CHAMPION_KILL`, `TEAMFIGHT_FOLLOWUP`, and `SKIRMISH_WIN`. Route `bestFightSummary()` and the fight branch in `buildStrengths()` through the helper, leaving teamfight encounter detection and death-based combat grouping unchanged.

**Tech Stack:** Node.js single-file server, plain JavaScript source-shape regression tests, npm test harness, read-only smoke report runner.

---

### Task 1: Add Failing Source-Shape Regression Tests

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Capture `bestFightSummary()` source**

Add this constant after the existing `bestObjectiveSummarySrc` declaration:

```js
const bestFightSummarySrc = extractFunctionSource(serverSrc, "bestFightSummary");
```

- [x] **Step 2: Add source-shape checks for the shared fight-contribution policy**

Add these checks after the existing `bestFightSummary 2 combat, low KP -> null` behavior check:

```js
checkTrue(
  "server defines FIGHT_CONTRIBUTION_EVENT_TYPES",
  serverSrc.includes('const FIGHT_CONTRIBUTION_EVENT_TYPES = new Set(["CHAMPION_KILL", "TEAMFIGHT_FOLLOWUP", "SKIRMISH_WIN"]);'),
);
checkTrue(
  "server defines isFightContributionEvent",
  serverSrc.includes("function isFightContributionEvent(event)"),
);
checkTrue(
  "bestFightSummary uses isFightContributionEvent",
  bestFightSummarySrc.includes("timelineEvents.filter(isFightContributionEvent)"),
);
checkTrue(
  "buildStrengths fight evidence uses isFightContributionEvent",
  buildStrengthsSrc.includes(".filter(isFightContributionEvent)"),
);
```

- [x] **Step 3: Run focused test to verify RED**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected: FAIL with four new source-shape checks failing while the existing behavior checks still pass.

### Task 2: Implement Shared Fight-Contribution Policy

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Add module-level fight-contribution Set**

In `server.js`, directly after `MACRO_OBJECTIVE_WIN_EVENT_TYPES`, add:

```js
const FIGHT_CONTRIBUTION_EVENT_TYPES = new Set(["CHAMPION_KILL", "TEAMFIGHT_FOLLOWUP", "SKIRMISH_WIN"]);
```

- [x] **Step 2: Add helper beside the event policy helpers**

In `server.js`, directly after `isMacroObjectiveWinEvent(event)`, add:

```js
function isFightContributionEvent(event) {
  return FIGHT_CONTRIBUTION_EVENT_TYPES.has(event.eventType);
}
```

- [x] **Step 3: Replace duplicated inline fight-contribution filters**

Change `bestFightSummary()` from:

```js
const combat = normalized.timelineEvents.filter((event) =>
  ["CHAMPION_KILL", "TEAMFIGHT_FOLLOWUP", "SKIRMISH_WIN"].includes(event.eventType),
);
```

to:

```js
const combat = normalized.timelineEvents.filter(isFightContributionEvent);
```

Change the fight branch in `buildStrengths()` from:

```js
const linked = events
  .filter((event) => ["CHAMPION_KILL", "TEAMFIGHT_FOLLOWUP", "SKIRMISH_WIN"].includes(event.eventType))
  .slice(0, 3);
```

to:

```js
const linked = events
  .filter(isFightContributionEvent)
  .slice(0, 3);
```

- [x] **Step 4: Inject the shared policy into the extracted-function test harness**

In `test-artifacts/server/strength-weakness-tests.mjs`, add these entries after the existing macro-objective helper entries in the `new Function` source list:

```js
extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
extractFunctionSource(serverSrc, "isFightContributionEvent"),
```

- [x] **Step 5: Run focused test to verify GREEN**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected: PASS with all focused checks green.

### Task 3: Verify, Document, Commit, Push

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-fight-contribution-event-types.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local verification gates**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-fight-contribution-event-types.md
npm test
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/fight-contribution-event-types-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/fight-contribution-event-types-local/qa-summary.json
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/fight-contribution-event-types-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
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
### 2026-06-09 HH:MM KST - Fight contribution event types 공유

- 구현 커밋: 후속 커밋 예정
- 계획 완료 커밋: 후속 문서 완료 커밋 예정
- GitHub push: `origin/main`
- 변경 배경: `bestFightSummary()`와 `buildStrengths()`가 `CHAMPION_KILL`, `TEAMFIGHT_FOLLOWUP`, `SKIRMISH_WIN`을 전투 기여 이벤트로 반복 분류하고 있었다. `FIGHT_CONTRIBUTION_EVENT_TYPES` / `isFightContributionEvent()`로 공유해 fight summary와 evidence 링크 기준이 갈라지지 않게 한다.
- 변경 범위:
  - `server.js`: `FIGHT_CONTRIBUTION_EVENT_TYPES` Set과 `isFightContributionEvent(event)` helper 추가, fight summary/strength evidence가 helper를 사용하도록 변경
  - `test-artifacts/server/strength-weakness-tests.mjs`: shared fight contribution policy source-shape 회귀 테스트 추가
  - `docs/superpowers/plans/2026-06-09-fight-contribution-event-types.md`: TDD 계획 및 검증 기록 추가
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
git add server.js test-artifacts/server/strength-weakness-tests.mjs docs/superpowers/plans/2026-06-09-fight-contribution-event-types.md
git diff --cached --check
git commit -m "test: share fight contribution event types"
git push origin main
```

Expected: commit and push succeed on `main`.

- [ ] **Step 4: Verify GitHub Actions QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha,status,conclusion --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/fight-contribution-event-types-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/fight-contribution-event-types-gh/qa-summary.json
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/fight-contribution-event-types-gh; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected: GitHub Actions QA passes, artifact smoke summary has 0 failed, sensitive scan prints `no sensitive matches`.

- [ ] **Step 5: Mark plan complete and push docs completion**

After implementation QA, update this plan’s checkboxes and add a `## Completion Evidence` section with local and GitHub evidence. Then run:

```bash
git add docs/superpowers/plans/2026-06-09-fight-contribution-event-types.md
git diff --cached --check
git commit -m "docs: mark fight contribution event plan complete"
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

- Spec coverage: This plan shares the fight-contribution event type policy across the two rule-based positive-fight paths while preserving existing output behavior.
- Placeholder scan target: `rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-fight-contribution-event-types.md`
- Type consistency: `FIGHT_CONTRIBUTION_EVENT_TYPES` is a `Set`, `isFightContributionEvent(event)` accepts timeline event objects, and both consumers pass event objects directly to `Array.prototype.filter`.
