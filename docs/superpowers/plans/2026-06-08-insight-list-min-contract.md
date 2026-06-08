# Insight List Min Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the final analysis validator with the LLM output contract so `strengths` and `weaknesses` each require exactly 3 items, not 1.

**Architecture:** `server.js` already exposes `INSIGHT_LIST_MAX = 3` and the LLM payload contract already asks for 3 strengths and 3 weaknesses. Raise `INSIGHT_LIST_MIN` to 3 so `hasValidInsightList()` rejects partial AI lists and the existing `buildAnalysis()` repair path replaces them with rule-based fallback lists before final validation. Because `buildWeaknesses()` currently pads only once, update it to always return 3 fallback weakness cards before tightening the validator. Focused schema and server tests will prove the old partial-list gap fails first and then passes after implementation.

**Tech Stack:** Node.js zero-dependency tests, `server.js` extracted-function tests, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Schema Coverage

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [x] **Step 1: Expand valid fixture insight lists to 3 items**

Replace the one-item `strengths` and `weaknesses` fixture lists with three valid items each:

```js
    strengths: [
      { id: "str_1", title: "t1", description: "d1", relatedEventIds: [] },
      { id: "str_2", title: "t2", description: "d2", relatedEventIds: [] },
      { id: "str_3", title: "t3", description: "d3", relatedEventIds: [] },
    ],
    weaknesses: [
      { id: "wk_1", title: "t1", description: "d1", relatedEventIds: [] },
      { id: "wk_2", title: "t2", description: "d2", relatedEventIds: [] },
      { id: "wk_3", title: "t3", description: "d3", relatedEventIds: [] },
    ],
```

- [x] **Step 2: Add partial-list rejection tests**

Insert these tests after the current empty-list tests:

```js
expectThrows("strengths only 2 throws", () => {
  const f = validFixture();
  f.strengths = f.strengths.slice(0, 2);
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("weaknesses only 2 throws", () => {
  const f = validFixture();
  f.weaknesses = f.weaknesses.slice(0, 2);
  validateAnalysisOutput(f);
}, "weaknesses");
```

- [x] **Step 3: Run focused RED test**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected before implementation:

```text
FAIL  strengths only 2 throws — expected throw but did not
FAIL  weaknesses only 2 throws — expected throw but did not
```

### Task 2: Align Validator Constants

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Update fallback weakness expectations**

Change the `buildWeaknesses` comments and expectations so low-signal cases now require three weakness cards:

```js
// ─── buildWeaknesses — 항상 길이 3 (while 패딩) ─────────────────────────────
check("buildWeaknesses B padded length 3", wkB.length, 3);
check("buildWeaknesses B ids sequential", wkB.map((w) => w.id), ["weak_01", "weak_02", "weak_03"]);
check("buildWeaknesses B all fallback title", wkB.every((w) => w.title === "중요 구도 판단을 더 빠르게 정리할 필요가 있음"), true);

check("buildWeaknesses C padded length 3", wkC.length, 3);
check("buildWeaknesses C ids", wkC.map((w) => w.id), ["weak_01", "weak_02", "weak_03"]);
```

- [x] **Step 2: Raise insight minimum**

Change:

```js
// strengths/weaknesses는 legacy fallback 호환 최소 1개와 리포트 카드 상한 3개를 검증한다.
const INSIGHT_LIST_MIN = 1;
const INSIGHT_LIST_MAX = 3;
```

To:

```js
// strengths/weaknesses는 LLM 출력 계약과 리포트 카드 구조에 맞춰 정확히 3개를 검증한다.
const INSIGHT_LIST_MIN = 3;
const INSIGHT_LIST_MAX = 3;
```

- [x] **Step 3: Pad rule-based weaknesses to 3**

Change the final fallback block in `buildWeaknesses()` from a single `if` to a `while` loop:

```js
  while (weaknesses.length < 3) {
    const objectiveFails = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");
    const linked = objectiveFails.length ? objectiveFails.slice(0, 2) : deaths.slice(0, 2);
    weaknesses.push({
      id: `weak_0${weaknesses.length + 1}`,
      title: "중요 구도 판단을 더 빠르게 정리할 필요가 있음",
      description: "contest와 이탈 중 하나를 더 빠르게 정하면 손실을 줄일 수 있는 장면이 있었다.",
      evidence:
        linked.length > 0
          ? linked.map((event) => `${event.timestampLabel} ${event.summary}`).join(" ")
          : "중요 구도에서 판단이 길어진 장면이 있었다.",
      impact: "작은 지연이 데스나 오브젝트 손실로 이어질 수 있다.",
      improvementHint: "시야가 밀리거나 숫자가 안 맞으면 contest 기준을 짧게 정하고 빠르게 후퇴하는 콜을 만드는 편이 좋다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }
```

- [x] **Step 4: Run focused GREEN tests**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected after implementation:

```text
84 passed, 0 failed
48 passed, 0 failed
```

### Task 3: Documentation And QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-insight-list-min-contract.md`

- [x] **Step 1: Update README schema count**

Change:

```md
npm run test:schema      # validateAnalysisOutput 위반 패턴 82건
```

To:

```md
npm run test:schema      # validateAnalysisOutput 위반 패턴 84건
```

- [x] **Step 2: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/schema-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-08-insight-list-min-contract.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 3: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1426 passed, 0 failed
```

- [x] **Step 4: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-list-min-contract-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/insight-list-min-contract-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 5: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/insight-list-min-contract-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-08-insight-list-min-contract.md`

- [x] **Step 1: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

- [x] **Step 2: Commit implementation**

Run:

```bash
git add server.js test-artifacts/schema/schema-tests.mjs README.md docs/superpowers/plans/2026-06-08-insight-list-min-contract.md "/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md"
git commit -m "test: require insight list minimum"
git push origin main
```

- [x] **Step 3: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/insight-list-min-contract-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/insight-list-min-contract-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

Completion evidence:

```text
implementation commit: 7a3ee9c test: require insight list minimum
GitHub QA run: 27143042795
artifact: 7482500416 / qa-automation-27143042795 / 3549 bytes
remote smoke: 156 passed / 0 failed, durationMs 206
required checks: total 13 / passed 13 / failed 0 / missing 0
artifact git: main / 7a3ee9c / dirty false
sensitive scan: no matches
```

---

## Self-Review

- Spec coverage: This plan covers the exact inconsistency between `outputContract.requiredArrayCounts.strengths/weaknesses`, prompt text, and the final validator.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `INSIGHT_LIST_MIN`, `INSIGHT_LIST_MAX`, `strengths`, and `weaknesses` are named consistently across tests, implementation, and README.
