# Weaknesses Count Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record short-but-nonempty AI `weaknesses` arrays as `count.weaknesses<3` instead of grouping them under `shape.weaknesses.invalid`.

**Architecture:** Keep the existing deterministic repair path through `buildWeaknesses()`. Narrow only the violation selection in `buildAnalysis()` so missing/empty weaknesses stay `missing.weaknesses`, 1-2 item arrays become `count.weaknesses<3`, and malformed non-array or invalid item shapes stay `shape.weaknesses.invalid`.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Short Weakness Lists Separately From Malformed Shapes

**Files:**
- Create: `test-artifacts/server/weaknesses-count-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-weaknesses-count-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/weaknesses-count-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
weaknesses: [
  { id: "wk_short_1", title: "short weakness 1", description: "short weakness description 1", relatedEventIds: [] },
  { id: "wk_short_2", title: "short weakness 2", description: "short weakness description 2", relatedEventIds: [] },
]
```

The stubbed `buildWeaknesses()` should return three valid repaired weaknesses and increment `state.weaknessRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("weaknesses are repaired", result.weaknesses.map((item) => item.id), ["wk_1", "wk_2", "wk_3"]);
check("weakness repair called once", state.weaknessRepairCalls, 1);
checkTrue(
  "schemaViolations include short weaknesses count",
  result.analysisMeta.schemaViolations.includes("count.weaknesses<3"),
);
checkTrue(
  "schemaViolations do not misclassify short weaknesses as missing",
  !result.analysisMeta.schemaViolations.includes("missing.weaknesses"),
);
checkTrue(
  "schemaViolations do not misclassify short weaknesses as malformed",
  !result.analysisMeta.schemaViolations.includes("shape.weaknesses.invalid"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks short weaknesses separately",
  buildAnalysisSrc.includes("count.weaknesses<${INSIGHT_LIST_MIN}"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/server/weaknesses-count-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because the short weaknesses array is repaired but recorded as `shape.weaknesses.invalid`.

Actual RED evidence (2026-06-09 12:08 KST):

```text
node --check test-artifacts/server/weaknesses-count-tracking-tests.mjs
# passed

node test-artifacts/server/weaknesses-count-tracking-tests.mjs
# 6 passed, 3 failed
# FAIL schemaViolations include short weaknesses count
# FAIL schemaViolations do not misclassify short weaknesses as malformed
# FAIL buildAnalysis tracks short weaknesses separately
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `weaknesses` repair block:

```js
  if (!hasValidInsightList(primary.weaknesses)) {
    const weaknessesViolation = (
      primary.weaknesses === undefined ||
      primary.weaknesses === null ||
      (
        Array.isArray(primary.weaknesses) &&
        primary.weaknesses.length === 0
      )
    )
      ? "missing.weaknesses"
      : (
        Array.isArray(primary.weaknesses) &&
        primary.weaknesses.length < INSIGHT_LIST_MIN
      )
        ? `count.weaknesses<${INSIGHT_LIST_MIN}`
        : "shape.weaknesses.invalid";
    primary.weaknesses = buildWeaknesses(normalized);
    violations.push(weaknessesViolation);
  }
```

Do not change `hasValidInsightList()`, `buildWeaknesses()`, missing weaknesses tracking, strengths repair, prompt contract, UI rendering, or stored sample content.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
node test-artifacts/server/strengths-count-tracking-tests.mjs
node test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/weaknesses-count-tracking-local npm run smoke:report:readonly
```

Expected: focused weaknesses/strengths/key/action/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Focused GREEN evidence (2026-06-09 12:09 KST):

```text
node --check server.js
# passed

node --check test-artifacts/server/weaknesses-count-tracking-tests.mjs
node test-artifacts/server/weaknesses-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/weaknesses-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/strengths-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/key-moments-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/action-checklist-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
```

Full local QA evidence (2026-06-09 12:09 KST):

```text
npm test
# 2128 passed, 0 failed across 93 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/weaknesses-count-tracking-local npm run smoke:report:readonly
# External demo smoke passed for http://127.0.0.1:8123

node -e '...read test-artifacts/tmp/weaknesses-count-tracking-local/qa-summary.json...'
# status: passed
# qaVerdict: passed
# smoke: 156 passed, 0 failed
# required: 13 passed, 0 failed, 0 missing

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/weaknesses-count-tracking-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-weaknesses-count-tracking.md server.js test-artifacts/server/weaknesses-count-tracking-tests.mjs
git commit -m "test: track short weaknesses"
git push origin main
```

Implementation commit evidence (2026-06-09 12:09 KST):

```text
git commit -m "test: track short weaknesses"
# [main 49cf977] test: track short weaknesses
# 3 files changed, 468 insertions(+), 1 deletion(-)

git push origin main
# 29b2422..49cf977  main -> main
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence (2026-06-09 12:10 KST):

```text
gh run watch 27181348056 --exit-status
# main QA 27181348056 passed
# head SHA: 49cf9773fb52520cdecc53b8326799e2b09f2045

gh api repos/crisious/Web_LOL_Banpick/actions/runs/27181348056/artifacts --jq '.artifacts[] | {id, name, size_in_bytes, expired}'
# {"expired":false,"id":7497618759,"name":"qa-automation-27181348056","size_in_bytes":3549}

node -e '...read test-artifacts/tmp/gh-run-27181348056/.../qa-summary.json...'
# status: passed
# qaVerdict: passed
# smoke: 156 passed, 0 failed
# required: 13 passed, 0 failed, 0 missing
# shortSha: 49cf977
# dirty: false

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/gh-run-27181348056
# no matches
```

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-weaknesses-count-tracking.md
git commit -m "docs: finalize weaknesses count tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers short nonempty weaknesses, preserves deterministic repair, and keeps empty/missing weaknesses on the existing `missing.weaknesses` path.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The new violation key is consistently `count.weaknesses<3`; existing `missing.weaknesses` and `shape.weaknesses.invalid` remain available for their narrower cases.
