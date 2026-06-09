# Key Moments Count Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record short-but-nonempty AI `keyMoments` arrays as `count.keyMoments<4` instead of grouping them under `shape.keyMoments.invalid`.

**Architecture:** Keep the existing deterministic repair path through `buildKeyMoments()`. Narrow only the violation selection in `buildAnalysis()` so missing/empty key moments stay `missing.keyMoments`, 1-3 item arrays become `count.keyMoments<4`, and malformed non-array or invalid item shapes stay `shape.keyMoments.invalid`.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Short Key Moments Separately From Malformed Shapes

**Files:**
- Create: `test-artifacts/server/key-moments-count-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-key-moments-count-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/key-moments-count-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
keyMoments: [
  { id: "km_short_1", timestampLabel: "08:00", phase: "EARLY", title: "short moment 1", description: "short moment description 1", relatedEventIds: ["evt_001"] },
  { id: "km_short_2", timestampLabel: "12:00", phase: "MID", title: "short moment 2", description: "short moment description 2", relatedEventIds: ["evt_001"] },
  { id: "km_short_3", timestampLabel: "16:00", phase: "MID", title: "short moment 3", description: "short moment description 3", relatedEventIds: ["evt_001"] },
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
  "schemaViolations include short key moments count",
  result.analysisMeta.schemaViolations.includes("count.keyMoments<4"),
);
checkTrue(
  "schemaViolations do not misclassify short key moments as missing",
  !result.analysisMeta.schemaViolations.includes("missing.keyMoments"),
);
checkTrue(
  "schemaViolations do not misclassify short key moments as malformed",
  !result.analysisMeta.schemaViolations.includes("shape.keyMoments.invalid"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks short key moments separately",
  buildAnalysisSrc.includes("count.keyMoments<${KEY_MOMENTS_MIN}"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/server/key-moments-count-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because the short key moments array is repaired but recorded as `shape.keyMoments.invalid`.

Actual RED evidence (2026-06-09 11:45 KST):

```text
node --check test-artifacts/server/key-moments-count-tracking-tests.mjs
# passed

node test-artifacts/server/key-moments-count-tracking-tests.mjs
# 6 passed, 3 failed
# FAIL schemaViolations include short key moments count
# FAIL schemaViolations do not misclassify short key moments as malformed
# FAIL buildAnalysis tracks short key moments separately
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `keyMoments` repair block:

```js
  if (!hasValidKeyMoments(primary.keyMoments)) {
    const keyMomentsViolation = (
      primary.keyMoments === undefined ||
      primary.keyMoments === null ||
      (
        Array.isArray(primary.keyMoments) &&
        primary.keyMoments.length === 0
      )
    )
      ? "missing.keyMoments"
      : (
        Array.isArray(primary.keyMoments) &&
        primary.keyMoments.length < KEY_MOMENTS_MIN
      )
        ? `count.keyMoments<${KEY_MOMENTS_MIN}`
        : "shape.keyMoments.invalid";
    primary.keyMoments = buildKeyMoments(normalized);
    violations.push(keyMomentsViolation);
  }
```

Do not change `hasValidKeyMoments()`, `buildKeyMoments()`, missing key moment tracking, prompt contract, UI rendering, or stored sample content.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/server/key-moments-missing-tracking-tests.mjs
node test-artifacts/server/action-checklist-count-tracking-tests.mjs
node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-count-tracking-local npm run smoke:report:readonly
```

Expected: focused key/action/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Focused GREEN evidence (2026-06-09 11:46 KST):

```text
node --check server.js
# passed

node --check test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/server/key-moments-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/key-moments-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/action-checklist-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/action-checklist-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
```

Full local QA evidence (2026-06-09 11:47 KST):

```text
npm test
# 2110 passed, 0 failed across 91 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-count-tracking-local npm run smoke:report:readonly
# qaVerdict.status=passed, smokeSummary=156 passed / 0 failed, requiredChecks=13/13, durationMs=282

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/key-moments-count-tracking-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-key-moments-count-tracking.md server.js test-artifacts/server/key-moments-count-tracking-tests.mjs
git commit -m "test: track short key moments"
git push origin main
```

Actual implementation publish evidence:

```text
git commit -m "test: track short key moments"
# [main 2e8a531] test: track short key moments

git push origin main
# d8b133d..2e8a531 main -> main
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence:

```text
gh run watch 27180631403 --exit-status
# success

Artifact: qa-automation-27180631403
Artifact id: 7497368487
Commit: 2e8a531
qaVerdict.status: passed
smokeSummary: 156 passed / 0 failed
requiredChecks: 13 passed / 0 failed / 0 missing
durationMs: 201
dirty: false

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/gh-run-27180631403
# no matches

Obsidian project improvement note updated with implementation evidence:
`/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
```

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-key-moments-count-tracking.md
git commit -m "docs: finalize key moments count tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers short nonempty key moments, preserves deterministic repair, and keeps empty/missing key moments on the existing `missing.keyMoments` path.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The new violation key is consistently `count.keyMoments<4`; existing `missing.keyMoments` and `shape.keyMoments.invalid` remain available for their narrower cases.
