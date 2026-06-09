# Insight List Shape Before Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record malformed short AI `strengths` and `weaknesses` arrays as `shape.*.invalid` instead of grouping them under `count.*<3`.

**Architecture:** Keep deterministic insight repair through `buildStrengths()` and `buildWeaknesses()`. Add a shared insight item-shape predicate so `buildAnalysis()` can distinguish valid-but-short insight lists from malformed short arrays before selecting the violation key.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Short Malformed Insight Lists As Shape Errors

**Files:**
- Create: `test-artifacts/server/insight-list-shape-before-count-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-insight-list-shape-before-count.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/insight-list-shape-before-count-tests.mjs` with a source-extracted `buildAnalysis()` harness. It should run two scenarios.

Malformed short strengths fixture:

```js
strengths: [
  { id: "", title: "malformed short strength", description: "malformed strength description", relatedEventIds: [] },
]
```

Expected assertions:

```js
check("strengths primary analysis is preserved", strengthsResult.matchSummary.headline, "primary headline");
check("strengths fallback is not used", strengthsState.fallbackCalls, 0);
check("strengths are repaired", strengthsResult.strengths.map((item) => item.id), ["str_1", "str_2", "str_3"]);
check("strength repair called once", strengthsState.strengthRepairCalls, 1);
checkTrue(
  "schemaViolations include malformed strengths",
  strengthsResult.analysisMeta.schemaViolations.includes("shape.strengths.invalid"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short strengths as missing",
  !strengthsResult.analysisMeta.schemaViolations.includes("missing.strengths"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short strengths as count",
  !strengthsResult.analysisMeta.schemaViolations.includes("count.strengths<3"),
);
check("strengths schemaViolationCount", strengthsResult.analysisMeta.schemaViolationCount, 1);
```

Malformed short weaknesses fixture:

```js
weaknesses: [
  { id: "", title: "malformed short weakness", description: "malformed weakness description", relatedEventIds: [] },
]
```

Expected assertions:

```js
check("weaknesses primary analysis is preserved", weaknessesResult.matchSummary.headline, "primary headline");
check("weaknesses fallback is not used", weaknessesState.fallbackCalls, 0);
check("weaknesses are repaired", weaknessesResult.weaknesses.map((item) => item.id), ["wk_1", "wk_2", "wk_3"]);
check("weakness repair called once", weaknessesState.weaknessRepairCalls, 1);
checkTrue(
  "schemaViolations include malformed weaknesses",
  weaknessesResult.analysisMeta.schemaViolations.includes("shape.weaknesses.invalid"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short weaknesses as missing",
  !weaknessesResult.analysisMeta.schemaViolations.includes("missing.weaknesses"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short weaknesses as count",
  !weaknessesResult.analysisMeta.schemaViolations.includes("count.weaknesses<3"),
);
check("weaknesses schemaViolationCount", weaknessesResult.analysisMeta.schemaViolationCount, 1);
```

Source-shape assertions:

```js
checkTrue(
  "server defines shared insight item shape helper",
  serverSrc.includes("function hasValidInsightItemShapes"),
);
checkTrue(
  "buildAnalysis checks strengths item shape before count",
  buildAnalysisSrc.includes("hasValidInsightItemShapes(primary.strengths)"),
);
checkTrue(
  "buildAnalysis checks weaknesses item shape before count",
  buildAnalysisSrc.includes("hasValidInsightItemShapes(primary.weaknesses)"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/insight-list-shape-before-count-tests.mjs
node test-artifacts/server/insight-list-shape-before-count-tests.mjs
```

Expected: syntax check passes, runtime test fails because malformed short strengths and weaknesses are repaired but recorded as `count.strengths<3` / `count.weaknesses<3`.

Actual RED evidence (2026-06-09 12:40 KST):

```text
node --check test-artifacts/server/insight-list-shape-before-count-tests.mjs
# passed

node test-artifacts/server/insight-list-shape-before-count-tests.mjs
# 14 passed, 7 failed
# FAIL schemaViolations include malformed strengths
# FAIL schemaViolations do not misclassify malformed short strengths as count
# FAIL schemaViolations include malformed weaknesses
# FAIL schemaViolations do not misclassify malformed short weaknesses as count
# FAIL server defines shared insight item shape helper
# FAIL buildAnalysis checks strengths item shape before count
# FAIL buildAnalysis checks weaknesses item shape before count
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, split item-shape validation from count validation:

```js
function hasValidInsightItemShapes(items) {
  return Array.isArray(items) &&
    items.every((item) =>
      item &&
      isNonBlankString(item.id) &&
      isNonBlankString(item.title) &&
      isNonBlankString(item.description) &&
      Array.isArray(item.relatedEventIds) &&
      item.relatedEventIds.every((id) => isNonBlankString(id))
    );
}
```

Then update `hasValidInsightList()` to reuse the helper:

```js
function hasValidInsightList(items) {
  return Array.isArray(items) &&
    items.length >= INSIGHT_LIST_MIN &&
    items.length <= INSIGHT_LIST_MAX &&
    hasValidInsightItemShapes(items);
}
```

Gate the strengths count branch:

```js
    const strengthsHaveValidItemShapes = hasValidInsightItemShapes(primary.strengths);
```

```js
        Array.isArray(primary.strengths) &&
        primary.strengths.length < INSIGHT_LIST_MIN &&
        strengthsHaveValidItemShapes
```

Gate the weaknesses count branch:

```js
    const weaknessesHaveValidItemShapes = hasValidInsightItemShapes(primary.weaknesses);
```

```js
        Array.isArray(primary.weaknesses) &&
        primary.weaknesses.length < INSIGHT_LIST_MIN &&
        weaknessesHaveValidItemShapes
```

Do not change `buildStrengths()`, `buildWeaknesses()`, missing insight tracking, prompt contract, UI rendering, or stored sample content.

Implementation note (2026-06-09 12:43 KST): `server.js` now defines `hasValidInsightItemShapes()`, reuses it from `hasValidInsightList()`, and gates the `count.strengths<3` / `count.weaknesses<3` branches so only valid-item short arrays use count violations. Malformed short arrays now record `shape.strengths.invalid` or `shape.weaknesses.invalid`.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/insight-list-shape-before-count-tests.mjs
node test-artifacts/server/insight-list-shape-before-count-tests.mjs
node test-artifacts/server/strengths-count-tracking-tests.mjs
node test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/server/strengths-missing-tracking-tests.mjs
node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-list-shape-before-count-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/insight-list-shape-before-count-local
```

Expected: focused insight/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, readonly smoke report has `qaVerdict.status = "passed"`, and sensitive-output scan has no matches.

Focused GREEN evidence (2026-06-09 12:44 KST):

```text
node --check server.js
# passed

node --check test-artifacts/server/insight-list-shape-before-count-tests.mjs
# passed

node test-artifacts/server/insight-list-shape-before-count-tests.mjs
# 21 passed, 0 failed

node test-artifacts/server/strengths-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/weaknesses-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/strengths-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
```

Full local QA evidence (2026-06-09 12:45 KST):

```text
npm test
# 2168 passed, 0 failed across 96 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-list-shape-before-count-local npm run smoke:report:readonly
# External demo smoke passed for http://127.0.0.1:8123

node -e '...read test-artifacts/tmp/insight-list-shape-before-count-local/qa-summary.json...'
# status: passed
# qaVerdict: passed
# smoke: 156 passed, 0 failed
# required: 13 passed, 0 failed, 0 missing
# durationMs: 205

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/insight-list-shape-before-count-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-insight-list-shape-before-count.md server.js test-artifacts/server/insight-list-shape-before-count-tests.mjs
git commit -m "test: track malformed short insight lists"
git push origin main
```

Implementation commit evidence (2026-06-09 12:46 KST):

```text
git commit -m "test: track malformed short insight lists"
# [main ee56a06] test: track malformed short insight lists
# 29 files changed, 678 insertions(+), 13 deletions(-)

git push origin main
# 6dc1753..ee56a06  main -> main
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence (2026-06-09 12:47 KST):

```text
gh run watch 27182528926 --exit-status
# main QA passed
# test-and-smoke completed in 23s

gh api repos/crisious/Web_LOL_Banpick/actions/runs/27182528926/artifacts --jq '.artifacts[] | {id, name, size_in_bytes, expired}'
# {"expired":false,"id":7498050621,"name":"qa-automation-27182528926","size_in_bytes":3547}

qa-summary.json
# latestRun.status: passed
# latestRun.qaVerdict.status: passed
# latestRun.smokeSummary: 156 passed, 0 failed
# latestRun.requiredCheckSummary: 13 passed, 0 failed, 0 missing
# latestRun.durationMs: 212
# latestRun.git.shortSha: ee56a06
# latestRun.git.dirty: false

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/gh-run-27182528926
# no matches
```

Obsidian project improvement note updated with the insight list shape-before-count implementation record.

- [x] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-insight-list-shape-before-count.md
git commit -m "docs: finalize insight list shape tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

Final documentation and sync evidence (2026-06-09 12:50 KST):

```text
git commit -m "docs: finalize insight list shape tracking"
# [main 4b5a6da] docs: finalize insight list shape tracking
# 1 file changed, 38 insertions(+), 2 deletions(-)

git push origin main
# ee56a06..4b5a6da  main -> main

gh run watch 27182607601 --exit-status
# main QA passed
# test-and-smoke completed in 24s

gh api repos/crisious/Web_LOL_Banpick/actions/runs/27182607601/artifacts --jq '.artifacts[] | {id, name, size_in_bytes, expired}'
# {"expired":false,"id":7498079032,"name":"qa-automation-27182607601","size_in_bytes":3552}

qa-summary.json
# latestRun.status: passed
# latestRun.qaVerdict.status: passed
# latestRun.smokeSummary: 156 passed, 0 failed
# latestRun.requiredCheckSummary: 13 passed, 0 failed, 0 missing
# latestRun.durationMs: 212
# latestRun.git.shortSha: 4b5a6da
# latestRun.git.dirty: false

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/gh-run-27182607601
# no matches

git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
# 0 0
```

### Plan Self-Review

- Spec coverage: The plan covers malformed short strengths and weaknesses, preserves deterministic repair, and keeps missing/empty plus valid short insight lists on their existing paths.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The new helper is consistently named `hasValidInsightItemShapes`; existing `missing.strengths`, `missing.weaknesses`, `count.strengths<3`, `count.weaknesses<3`, `shape.strengths.invalid`, and `shape.weaknesses.invalid` keys remain available for their narrower cases.
