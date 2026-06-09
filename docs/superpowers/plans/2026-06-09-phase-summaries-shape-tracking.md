# Phase Summaries Shape Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record malformed nonempty AI `phaseSummaries` arrays as `shape.phaseSummaries.invalid` instead of grouping them under `count.phaseSummaries<3`.

**Architecture:** Keep the deterministic repair path through `buildPhaseSummaries()`. Narrow only the violation selection in `buildAnalysis()` so missing/empty arrays stay `missing.phaseSummaries`, short valid-looking arrays stay `count.phaseSummaries<3`, unusable object shapes stay `shape.phaseSummaries.object.invalid`, and malformed nonempty arrays become `shape.phaseSummaries.invalid`.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Malformed Phase Summary Arrays Separately From Count Violations

**Files:**
- Create: `test-artifacts/server/phase-summaries-shape-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-phase-summaries-shape-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/phase-summaries-shape-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should otherwise be valid but set:

```js
phaseSummaries: [
  { phase: "LANING", summary: "invalid phase summary 1" },
  { phase: "MIDGAME", summary: "invalid phase summary 2" },
  { phase: "LATEGAME", summary: "invalid phase summary 3" },
]
```

The stubbed `buildPhaseSummaries()` should return three valid repaired phase summaries and increment `state.phaseRepairCalls`.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("phase summaries are repaired", result.phaseSummaries.map((item) => item.phase), ["EARLY", "MID", "LATE"]);
check("phase repair called once", state.phaseRepairCalls, 1);
checkTrue(
  "schemaViolations include malformed phase summaries",
  result.analysisMeta.schemaViolations.includes("shape.phaseSummaries.invalid"),
);
checkTrue(
  "schemaViolations do not misclassify malformed phase summaries as missing",
  !result.analysisMeta.schemaViolations.includes("missing.phaseSummaries"),
);
checkTrue(
  "schemaViolations do not misclassify malformed phase summaries as count",
  !result.analysisMeta.schemaViolations.includes("count.phaseSummaries<3"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks malformed phase summaries separately",
  buildAnalysisSrc.includes("\"shape.phaseSummaries.invalid\""),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because the malformed nonempty phase summary array is repaired but recorded as `count.phaseSummaries<3`.

Actual RED evidence (2026-06-09 12:18 KST):

```text
node --check test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
# passed

node test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
# 6 passed, 3 failed
# FAIL schemaViolations include malformed phase summaries
# FAIL schemaViolations do not misclassify malformed phase summaries as count
# FAIL buildAnalysis tracks malformed phase summaries separately
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the `phaseSummaries` repair violation selection:

```js
        ? "missing.phaseSummaries"
        : (
          Array.isArray(primary.phaseSummaries) &&
          primary.phaseSummaries.length < PHASE_SUMMARIES_MIN
        )
          ? `count.phaseSummaries<${PHASE_SUMMARIES_MIN}`
          : "shape.phaseSummaries.invalid";
```

Keep the existing object normalization branch and `shape.phaseSummaries.object.invalid` handling unchanged. Do not change `hasValidPhaseSummaries()`, `buildPhaseSummaries()`, prompt contract, UI rendering, or stored sample content.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
node test-artifacts/server/key-moments-count-tracking-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-shape-tracking-local npm run smoke:report:readonly
```

Expected: focused phase/key/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Focused GREEN evidence (2026-06-09 12:19 KST):

```text
node --check server.js
# passed

node --check test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
# 8 passed, 0 failed

node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/server/key-moments-count-tracking-tests.mjs
# 9 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed
```

Full local QA evidence (2026-06-09 12:19 KST):

```text
npm test
# 2137 passed, 0 failed across 94 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-shape-tracking-local npm run smoke:report:readonly
# External demo smoke passed for http://127.0.0.1:8123

node -e '...read test-artifacts/tmp/phase-summaries-shape-tracking-local/qa-summary.json...'
# status: passed
# qaVerdict: passed
# smoke: 156 passed, 0 failed
# required: 13 passed, 0 failed, 0 missing

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/phase-summaries-shape-tracking-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summaries-shape-tracking.md server.js test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
git commit -m "test: track malformed phase summaries"
git push origin main
```

Implementation commit evidence (2026-06-09 12:20 KST):

```text
git commit -m "test: track malformed phase summaries"
# [main 9188991] test: track malformed phase summaries
# 3 files changed, 454 insertions(+), 1 deletion(-)

git push origin main
# c2648de..9188991  main -> main
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence (2026-06-09 12:21 KST):

```text
gh run watch 27181698755 --exit-status
# main QA 27181698755 passed
# head SHA: 9188991a5eabb9409230fb4bc698ae247c4b96e3

gh api repos/crisious/Web_LOL_Banpick/actions/runs/27181698755/artifacts --jq '.artifacts[] | {id, name, size_in_bytes, expired}'
# {"expired":false,"id":7497756433,"name":"qa-automation-27181698755","size_in_bytes":3555}

node -e '...read test-artifacts/tmp/gh-run-27181698755/.../qa-summary.json...'
# status: passed
# qaVerdict: passed
# smoke: 156 passed, 0 failed
# required: 13 passed, 0 failed, 0 missing
# shortSha: 9188991
# dirty: false

rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\.api\.riotgames\.com|americas\.api\.riotgames\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/gh-run-27181698755
# no matches
```

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summaries-shape-tracking.md
git commit -m "docs: finalize phase summaries shape tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.

### Plan Self-Review

- Spec coverage: The plan covers malformed nonempty phase summary arrays, preserves deterministic repair, and keeps missing/empty arrays and unusable object shapes on their existing paths.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The new violation key is consistently `shape.phaseSummaries.invalid`; existing `missing.phaseSummaries`, `count.phaseSummaries<3`, and `shape.phaseSummaries.object.invalid` remain available for their narrower cases.
