# Key Moments Shape Before Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record malformed short AI `keyMoments` arrays as `shape.keyMoments.invalid` instead of grouping them under `count.keyMoments<4`.

**Architecture:** Keep deterministic key moment repair through `buildKeyMoments()`. Split key moment item-shape validation from minimum-count validation so `buildAnalysis()` can distinguish valid-but-short key moment lists from malformed short arrays before selecting the violation key.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Short Malformed Key Moments As Shape Errors

**Files:**
- Create: `test-artifacts/server/key-moments-shape-before-count-tests.mjs`
- Modify: `server.js`
- Modify: source-extracted harnesses under `test-artifacts/server/*.mjs` and schema harnesses under `test-artifacts/schema/*.mjs` that load `hasValidKeyMoments()`
- Modify: `docs/superpowers/plans/2026-06-09-key-moments-shape-before-count.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/key-moments-shape-before-count-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
keyMoments: [
  { id: "", timestampLabel: "08:00", phase: "EARLY", title: "malformed short moment", description: "malformed moment description", relatedEventIds: ["evt_001"] },
]
```

The stubbed `buildKeyMoments()` should return four valid repaired key moments and increment `state.keyMomentRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("key moments are repaired", result.keyMoments.map((item) => item.id), ["km_1", "km_2", "km_3", "km_4"]);
check("key moment repair called once", state.keyMomentRepairCalls, 1);
checkTrue(
  "schemaViolations include malformed key moments",
  result.analysisMeta.schemaViolations.includes("shape.keyMoments.invalid"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short key moments as missing",
  !result.analysisMeta.schemaViolations.includes("missing.keyMoments"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short key moments as count",
  !result.analysisMeta.schemaViolations.includes("count.keyMoments<4"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "server defines shared key moment item shape helper",
  serverSrc.includes("function hasValidKeyMomentItemShapes"),
);
checkTrue(
  "hasValidKeyMoments reuses item shape helper",
  hasValidKeyMomentsSrc.includes("hasValidKeyMomentItemShapes(keyMoments)"),
);
checkTrue(
  "buildAnalysis checks key moment item shape before count",
  buildAnalysisSrc.includes("hasValidKeyMomentItemShapes(primary.keyMoments)"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/key-moments-shape-before-count-tests.mjs
node test-artifacts/server/key-moments-shape-before-count-tests.mjs
```

Expected: syntax check passes, runtime test fails because the malformed short key moment list is repaired but recorded as `count.keyMoments<4`.

Actual RED evidence (2026-06-09 12:55 KST):

```text
node --check test-artifacts/server/key-moments-shape-before-count-tests.mjs
# passed

node test-artifacts/server/key-moments-shape-before-count-tests.mjs
# 6 passed, 5 failed
# FAIL schemaViolations include malformed key moments
# FAIL schemaViolations do not misclassify malformed short key moments as count
# FAIL server defines shared key moment item shape helper
# FAIL hasValidKeyMoments reuses item shape helper
# FAIL buildAnalysis checks key moment item shape before count
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, split item-shape validation from count validation:

```js
function hasValidKeyMomentItemShapes(keyMoments) {
  return Array.isArray(keyMoments) &&
    keyMoments.every((item) =>
      item &&
      (
        isNonBlankString(item.id) ||
        isNonBlankString(item.eventId)
      ) &&
      (
        isNonBlankString(item.timestampLabel) ||
        isNonBlankString(item.timestamp)
      ) &&
      isValidGamePhase(item.phase) &&
      (
        isNonBlankString(item.title) ||
        isNonBlankString(item.label)
      ) &&
      (
        isNonBlankString(item.description) ||
        isNonBlankString(item.reason)
      ) &&
      Array.isArray(item.relatedEventIds) &&
      item.relatedEventIds.every((id) => isNonBlankString(id))
    );
}
```

Then update `hasValidKeyMoments()` to reuse the helper:

```js
function hasValidKeyMoments(keyMoments) {
  return Array.isArray(keyMoments) &&
    keyMoments.length >= KEY_MOMENTS_MIN &&
    hasValidKeyMomentItemShapes(keyMoments);
}
```

Gate the key moments count branch:

```js
    const keyMomentsHaveValidItemShapes = hasValidKeyMomentItemShapes(primary.keyMoments);
```

```js
        Array.isArray(primary.keyMoments) &&
        primary.keyMoments.length < KEY_MOMENTS_MIN &&
        keyMomentsHaveValidItemShapes
```

Do not change `buildKeyMoments()`, missing key moment tracking, prompt contract, UI rendering, or stored sample content.

Implementation note (2026-06-09 12:57 KST): `server.js` now defines `hasValidKeyMomentItemShapes()`, reuses it from `hasValidKeyMoments()`, and gates the `count.keyMoments<4` branch so only valid-item short arrays use count violations. Malformed short arrays now record `shape.keyMoments.invalid`.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/key-moments-shape-before-count-tests.mjs
node test-artifacts/server/key-moments-shape-before-count-tests.mjs
node test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
node test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
node test-artifacts/schema/key-moments-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-shape-before-count-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/key-moments-shape-before-count-local
```

Expected: focused key moment/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, readonly smoke report has `qaVerdict.status = "passed"`, and sensitive-output scan has no matches.

Focused GREEN evidence (2026-06-09 12:57 KST):

```text
node --check server.js
# passed

node --check test-artifacts/server/key-moments-shape-before-count-tests.mjs
# passed

node test-artifacts/server/key-moments-shape-before-count-tests.mjs
# 11 passed, 0 failed

node test-artifacts/server/key-moments-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/key-moments-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/schema/key-moments-nonblank-policy-tests.mjs
# 13 passed, 0 failed

node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
# 9 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
```

Full local QA evidence (2026-06-09 12:59 KST):

```text
npm test
# 2180 passed, 0 failed across 97 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-shape-before-count-local npm run smoke:report:readonly
# External demo smoke passed for http://127.0.0.1:8123

node -e '...read test-artifacts/tmp/key-moments-shape-before-count-local/qa-summary.json...'
# status: passed
# qaVerdict: passed
# smoke: 156 passed, 0 failed
# required: 13 passed, 0 failed, 0 missing
# durationMs: 300

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/key-moments-shape-before-count-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-key-moments-shape-before-count.md server.js test-artifacts/server test-artifacts/schema
git commit -m "test: track malformed short key moments"
git push origin main
```

Implementation commit evidence (2026-06-09 12:59 KST):

```text
git commit -m "test: track malformed short key moments"
# [main 74a1c5f] test: track malformed short key moments
# 30 files changed, 611 insertions(+), 19 deletions(-)

git push origin main
# e8e65de..74a1c5f  main -> main
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence (2026-06-09 13:00 KST):

```text
gh run watch 27182926352 --exit-status
# main QA passed
# test-and-smoke completed in 22s

gh api repos/crisious/Web_LOL_Banpick/actions/runs/27182926352/artifacts --jq '.artifacts[] | {id, name, size_in_bytes, expired}'
# {"expired":false,"id":7498187536,"name":"qa-automation-27182926352","size_in_bytes":3551}

qa-summary.json
# latestRun.status: passed
# latestRun.qaVerdict.status: passed
# latestRun.smokeSummary: 156 passed, 0 failed
# latestRun.requiredCheckSummary: 13 passed, 0 failed, 0 missing
# latestRun.durationMs: 203
# latestRun.git.shortSha: 74a1c5f
# latestRun.git.dirty: false

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/gh-run-27182926352
# no matches
```

Obsidian project improvement note updated with the key moments shape-before-count implementation record.

- [x] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-key-moments-shape-before-count.md
git commit -m "docs: finalize key moments shape tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

Final documentation and sync evidence (2026-06-09 13:02 KST):

```text
git commit -m "docs: finalize key moments shape tracking"
# [main 7c849b2] docs: finalize key moments shape tracking
# 1 file changed, 38 insertions(+), 2 deletions(-)

git push origin main
# 74a1c5f..7c849b2  main -> main

gh run watch 27183004148 --exit-status
# main QA passed
# test-and-smoke completed in 21s

gh api repos/crisious/Web_LOL_Banpick/actions/runs/27183004148/artifacts --jq '.artifacts[] | {id, name, size_in_bytes, expired}'
# {"expired":false,"id":7498211136,"name":"qa-automation-27183004148","size_in_bytes":3551}

qa-summary.json
# latestRun.status: passed
# latestRun.qaVerdict.status: passed
# latestRun.smokeSummary: 156 passed, 0 failed
# latestRun.requiredCheckSummary: 13 passed, 0 failed, 0 missing
# latestRun.durationMs: 226
# latestRun.git.shortSha: 7c849b2
# latestRun.git.dirty: false

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/gh-run-27183004148
# no matches

git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
# 0 0
```

### Plan Self-Review

- Spec coverage: The plan covers malformed short key moment arrays, preserves deterministic repair, and keeps missing/empty plus valid short key moment lists on their existing paths.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The new helper is consistently named `hasValidKeyMomentItemShapes`; existing `missing.keyMoments`, `count.keyMoments<4`, and `shape.keyMoments.invalid` keys remain available for their narrower cases.
