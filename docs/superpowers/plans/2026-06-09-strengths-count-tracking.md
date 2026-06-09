# Strengths Count Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record short-but-nonempty AI `strengths` arrays as `count.strengths<3` instead of grouping them under `shape.strengths.invalid`.

**Architecture:** Keep the existing deterministic repair path through `buildStrengths()`. Narrow only the violation selection in `buildAnalysis()` so missing/empty strengths stay `missing.strengths`, 1-2 item arrays become `count.strengths<3`, and malformed non-array or invalid item shapes stay `shape.strengths.invalid`.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Short Strength Lists Separately From Malformed Shapes

**Files:**
- Create: `test-artifacts/server/strengths-count-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-strengths-count-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/strengths-count-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
strengths: [
  { id: "str_short_1", title: "short strength 1", description: "short strength description 1", relatedEventIds: [] },
  { id: "str_short_2", title: "short strength 2", description: "short strength description 2", relatedEventIds: [] },
]
```

The stubbed `buildStrengths()` should return three valid repaired strengths and increment `state.strengthRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("strengths are repaired", result.strengths.map((item) => item.id), ["str_1", "str_2", "str_3"]);
check("strength repair called once", state.strengthRepairCalls, 1);
checkTrue(
  "schemaViolations include short strengths count",
  result.analysisMeta.schemaViolations.includes("count.strengths<3"),
);
checkTrue(
  "schemaViolations do not misclassify short strengths as missing",
  !result.analysisMeta.schemaViolations.includes("missing.strengths"),
);
checkTrue(
  "schemaViolations do not misclassify short strengths as malformed",
  !result.analysisMeta.schemaViolations.includes("shape.strengths.invalid"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks short strengths separately",
  buildAnalysisSrc.includes("count.strengths<${INSIGHT_LIST_MIN}"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/strengths-count-tracking-tests.mjs
node test-artifacts/server/strengths-count-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because the short strengths array is repaired but recorded as `shape.strengths.invalid`.

Actual RED evidence (2026-06-09 11:54 KST):

```text
node --check test-artifacts/server/strengths-count-tracking-tests.mjs
# passed

node test-artifacts/server/strengths-count-tracking-tests.mjs
# 6 passed, 3 failed
# FAIL schemaViolations include short strengths count
# FAIL schemaViolations do not misclassify short strengths as malformed
# FAIL buildAnalysis tracks short strengths separately
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `strengths` repair block:

```js
  if (!hasValidInsightList(primary.strengths)) {
    const strengthsViolation = (
      primary.strengths === undefined ||
      primary.strengths === null ||
      (
        Array.isArray(primary.strengths) &&
        primary.strengths.length === 0
      )
    )
      ? "missing.strengths"
      : (
        Array.isArray(primary.strengths) &&
        primary.strengths.length < INSIGHT_LIST_MIN
      )
        ? `count.strengths<${INSIGHT_LIST_MIN}`
        : "shape.strengths.invalid";
    primary.strengths = buildStrengths(normalized);
    violations.push(strengthsViolation);
  }
```

Do not change `hasValidInsightList()`, `buildStrengths()`, missing strengths tracking, weaknesses repair, prompt contract, UI rendering, or stored sample content.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strengths-count-tracking-tests.mjs
node test-artifacts/server/strengths-count-tracking-tests.mjs
node test-artifacts/server/strengths-missing-tracking-tests.mjs
node test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/strengths-count-tracking-local npm run smoke:report:readonly
```

Expected: focused strengths/key/action/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Focused GREEN evidence (2026-06-09 11:55 KST):

```text
node --check server.js
# passed

node --check test-artifacts/server/strengths-count-tracking-tests.mjs
node test-artifacts/server/strengths-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/strengths-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/key-moments-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/action-checklist-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
```

Full local QA evidence (2026-06-09 11:57 KST):

```text
npm test
# 2119 passed, 0 failed across 92 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/strengths-count-tracking-local npm run smoke:report:readonly
# External demo smoke passed for http://127.0.0.1:8123

node -e '...read test-artifacts/tmp/strengths-count-tracking-local/qa-summary.json...'
# status: passed
# qaVerdict: passed
# smoke: 156 passed, 0 failed
# required: 13 passed, 0 failed, 0 missing

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/strengths-count-tracking-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-strengths-count-tracking.md server.js test-artifacts/server/strengths-count-tracking-tests.mjs
git commit -m "test: track short strengths"
git push origin main
```

Implementation commit evidence (2026-06-09 11:58 KST):

```text
git commit -m "test: track short strengths"
# [main 0668990] test: track short strengths
# 3 files changed, 464 insertions(+), 1 deletion(-)

git push origin main
# d9fa707..0668990  main -> main
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence (2026-06-09 11:59 KST):

```text
gh run watch 27180987228 --exit-status
# main QA 27180987228 passed
# head SHA: 0668990899413bdde19ddcd22db89040280915d1

gh api repos/crisious/Web_LOL_Banpick/actions/runs/27180987228/artifacts --jq '.artifacts[] | {id, name, size_in_bytes, expired}'
# {"expired":false,"id":7497485453,"name":"qa-automation-27180987228","size_in_bytes":3549}

node -e '...read test-artifacts/tmp/gh-run-27180987228/.../qa-summary.json...'
# status: passed
# qaVerdict: passed
# smoke: 156 passed, 0 failed
# required: 13 passed, 0 failed, 0 missing
# shortSha: 0668990
# dirty: false

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/gh-run-27180987228
# no matches
```

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-strengths-count-tracking.md
git commit -m "docs: finalize strengths count tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers short nonempty strengths, preserves deterministic repair, and keeps empty/missing strengths on the existing `missing.strengths` path.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The new violation key is consistently `count.strengths<3`; existing `missing.strengths` and `shape.strengths.invalid` remain available for their narrower cases.
