# Key Moments Builder Min Padding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rule-based `buildKeyMoments()` honor the four-item minimum even when a match has too few notable timeline events.

**Architecture:** The output schema, LLM payload contract, and `buildAnalysis()` repair gate already share `KEY_MOMENTS_MIN = 4`. This change closes the helper-level gap by padding `buildKeyMoments()` with deterministic stat-backed fallback cards after preserving any real timeline-derived moments.

**Tech Stack:** Node.js zero-dependency `.mjs` regression tests, `server.js` extracted-function harnesses, local read-only smoke report, GitHub Actions QA artifacts.

---

### Task 1: Add RED Builder Coverage

**Files:**
- Modify: `test-artifacts/server/key-moment-timestamp-policy-tests.mjs`

- [x] **Step 1: Load the key moment minimum constant**

Add this source before `buildKeyMomentsSrc` in the `new Function()` source list:

```js
extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
```

- [x] **Step 2: Add empty-timeline padding assertions**

Append this after the existing timestamp-policy source assertions:

```js
const emptyTimelineMoments = buildKeyMoments({
  matchInfo: { result: "LOSS", position: "SUPPORT" },
  playerStats: { cs: 0, csPerMinute: 0, visionScore: 0, killParticipation: 0 },
  timelineEvents: [],
});
check("empty timeline pads key moments to minimum", emptyTimelineMoments.length, 4);
check("empty timeline fallback ids", emptyTimelineMoments.map((moment) => moment.eventId), [
  "fallback_key_moment_01",
  "fallback_key_moment_02",
  "fallback_key_moment_03",
  "fallback_key_moment_04",
]);
check("empty timeline fallback phases", emptyTimelineMoments.map((moment) => moment.phase), ["EARLY", "MID", "LATE", "LATE"]);
checkTrue(
  "empty timeline fallback moments have nonblank related evidence ids",
  emptyTimelineMoments.every((moment) =>
    Array.isArray(moment.relatedEventIds) &&
    moment.relatedEventIds.every((id) => typeof id === "string" && id.length > 0)
  ),
);
```

- [x] **Step 3: Add short-timeline preservation assertions**

Append this after the empty-timeline case:

```js
const shortTimelineMoments = buildKeyMoments({
  matchInfo: { result: "WIN", position: "MID" },
  playerStats: { cs: 90, csPerMinute: 6, visionScore: 12, killParticipation: 0.5 },
  timelineEvents: [
    {
      eventId: "evt_real",
      eventType: "CHAMPION_KILL",
      timestampMs: 60000,
      importance: 5,
      summary: "real event remains first",
    },
  ],
});
check("short timeline pads after real key moment", shortTimelineMoments.length, 4);
check("short timeline keeps real moment first", shortTimelineMoments[0]?.eventId, "evt_real");
check("short timeline fallback tail ids", shortTimelineMoments.slice(1).map((moment) => moment.eventId), [
  "fallback_key_moment_02",
  "fallback_key_moment_03",
  "fallback_key_moment_04",
]);
checkTrue(
  "buildKeyMoments pads with shared minimum constant",
  buildKeyMomentsSrc.includes("while (moments.length < KEY_MOMENTS_MIN)"),
);
```

- [x] **Step 4: Run RED**

Run:

```bash
node --check test-artifacts/server/key-moment-timestamp-policy-tests.mjs
node test-artifacts/server/key-moment-timestamp-policy-tests.mjs
```

Expected: syntax passes; runtime fails the new padding assertions because current `buildKeyMoments()` returns only timeline-derived rows.

Result: `node --check test-artifacts/server/key-moment-timestamp-policy-tests.mjs` passed. Runtime produced the expected RED failure shape: existing timestamp policy assertions passed and only the new padding/source assertions failed (`13 passed, 6 failed`).

### Task 2: Pad `buildKeyMoments()`

**Files:**
- Modify: `server.js`

- [x] **Step 1: Convert the existing chain to a `moments` local**

Change:

```js
function buildKeyMoments(normalized) {
  return normalized.timelineEvents
```

To:

```js
function buildKeyMoments(normalized) {
  const moments = normalized.timelineEvents
```

- [x] **Step 2: Append deterministic fallback moments**

Before the function closes, append:

```js
  const fallbackTemplates = [
    {
      phase: "EARLY",
      label: "초반 흐름 점검",
      reason: "핵심 이벤트가 부족해 초반 안정성과 첫 전환 루틴을 기본 점검 항목으로 보완했다.",
      impact: "짧은 경기에서도 초반 판단 기준을 남긴다.",
      relatedEventIds: ["stat_cs"],
    },
    {
      phase: "MID",
      label: "중반 자원 전환 점검",
      reason: `총 CS ${normalized.playerStats?.cs ?? 0}, 분당 CS ${normalized.playerStats?.csPerMinute ?? 0} 기준으로 자원 전환을 확인한다.`,
      impact: "이벤트가 적어도 성장 흐름을 복기할 수 있게 한다.",
      relatedEventIds: ["stat_cs"],
    },
    {
      phase: "LATE",
      label: "시야와 합류 점검",
      reason: `비전 점수 ${normalized.playerStats?.visionScore ?? 0}, 킬 관여율 ${Math.round((normalized.playerStats?.killParticipation ?? 0) * 100)}% 기준으로 합류 품질을 확인한다.`,
      impact: "근거 이벤트가 부족한 경기에서도 시야와 합류 축을 유지한다.",
      relatedEventIds: ["stat_vision"],
    },
    {
      phase: "LATE",
      label: "다음 경기 루틴",
      reason: "타임라인 근거가 적을 때는 라인 정리, 시야 확보, 오브젝트 전 리콜 타이밍을 기본 루틴으로 점검한다.",
      impact: "리포트가 최소 코칭 카드 수를 유지하면서 다음 행동으로 연결된다.",
      relatedEventIds: ["stat_vision"],
    },
  ];

  while (moments.length < KEY_MOMENTS_MIN) {
    const index = moments.length;
    const template = fallbackTemplates[index % fallbackTemplates.length];
    moments.push({
      eventId: `fallback_key_moment_${String(index + 1).padStart(2, "0")}`,
      timestamp: "FULL",
      phase: template.phase,
      label: template.label,
      reason: template.reason,
      impact: template.impact,
      importance: 1,
      relatedEventIds: template.relatedEventIds,
    });
  }

  return moments;
```

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check server.js
node --check test-artifacts/server/key-moment-timestamp-policy-tests.mjs
node test-artifacts/server/key-moment-timestamp-policy-tests.mjs
```

Expected: key moment timestamp/padding harness passes.

Result: `node --check server.js`, `node --check test-artifacts/server/key-moment-timestamp-policy-tests.mjs`, and `node test-artifacts/server/key-moment-timestamp-policy-tests.mjs` all passed. Key moment harness reports `19 passed, 0 failed`.

### Task 3: QA And Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-key-moments-builder-min-padding.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
node test-artifacts/server/key-moment-timestamp-policy-tests.mjs
node test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-builder-min-padding-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/key-moments-builder-min-padding-local
```

Expected: focused tests, full suite, diff check, and read-only smoke pass; sensitive scan has no matches.

Result: key moment timestamp/padding harness 19 passed / 0 failed; key moments count tracking 12 passed / 0 failed; schema tests 105 passed / 0 failed; `npm test` 2258 passed / 0 failed across 99 test file(s); `git diff --check` passed; local read-only smoke report passed 156 checks at `test-artifacts/tmp/key-moments-builder-min-padding-local/2026-06-09T05-48-26Z-readonly`; sensitive pattern scan against `test-artifacts/tmp/key-moments-builder-min-padding-local` had no matches.

- [ ] **Step 2: Commit and push implementation**

Run:

```bash
git add server.js test-artifacts/server/key-moment-timestamp-policy-tests.mjs docs/superpowers/plans/2026-06-09-key-moments-builder-min-padding.md
git commit -m "test: pad key moment builder minimum"
git push origin main
```

- [ ] **Step 3: Verify GitHub Actions artifact**

Use `gh run watch`, `gh api .../artifacts`, and `gh run download` for the pushed commit. Confirm `qa-summary.json` reports the pushed short SHA, `dirty: false`, smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, and no sensitive pattern matches in the downloaded artifact.

- [ ] **Step 4: Update Obsidian and final sync**

Update the Obsidian project log with RED/GREEN/full QA, local smoke, GitHub run/artifact, sensitive scan, and final sync evidence. Then run:

```bash
rm -rf test-artifacts/tmp
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
git status --short --branch
```

Expected: `main...origin/main` is `0 0` and the working tree is clean.

---

## Self-Review

- Spec coverage: The plan closes the helper-level gap left after enforcing `KEY_MOMENTS_MIN = 4`, so rule-based fallback can satisfy the same minimum contract as AI output.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: Existing names `buildKeyMoments(normalized)`, `KEY_MOMENTS_MIN`, `stat_cs`, and `stat_vision` are used consistently.
