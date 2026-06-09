# Teamfight Analysis Missing Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record missing AI `teamfightPhaseAnalysis` when the LLM payload includes teamfight structures but the AI response omits them or returns an empty array.

**Architecture:** Keep the deterministic server merge behavior unchanged so final reports still receive safe rule-based teamfight coaching. Add a small pre-merge tracking branch in `buildAnalysis()` that distinguishes missing/empty raw AI teamfight analysis from malformed raw shape, using `missing.teamfightPhaseAnalysis` only when `payload.teamfightPhases` is non-empty.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Missing AI Teamfight Analysis When Payload Has Teamfights

**Files:**
- Create: `test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-teamfight-analysis-missing-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The primary AI response should be otherwise valid but set:

```js
teamfightPhaseAnalysis: []
```

The stubbed `buildLlmPayload()` should return one deterministic `teamfightPhases` item. The stubbed `mergeTeamfightCoaching()` should return a valid merged final array so the test proves missing tracking without changing final report behavior.

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("merged teamfight survives", result.teamfightPhaseAnalysis[0].teamfightId, "enc_001");
checkTrue(
  "schemaViolations include missing teamfight analysis",
  result.analysisMeta.schemaViolations.includes("missing.teamfightPhaseAnalysis"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks missing teamfight analysis before merge",
  buildAnalysisSrc.includes("missing.teamfightPhaseAnalysis"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
node test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because empty raw `teamfightPhaseAnalysis` is repaired by merge but not recorded in `schemaViolations`.

Actual RED evidence at 2026-06-09 09:38 KST:

```text
node --check test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
# passed

node test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
# 3 passed, 3 failed
# primary analysis and merged teamfight output were preserved, but schemaViolations missed missing.teamfightPhaseAnalysis and schemaViolationCount stayed 0.
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, update only the pre-merge tracking block before `primary.teamfightPhaseAnalysis = mergeTeamfightCoaching(...)`:

```js
  const hasTeamfightPayload = Array.isArray(payload.teamfightPhases) && payload.teamfightPhases.length > 0;
  if (
    hasTeamfightPayload &&
    (
      primary.teamfightPhaseAnalysis === undefined ||
      primary.teamfightPhaseAnalysis === null ||
      (
        Array.isArray(primary.teamfightPhaseAnalysis) &&
        primary.teamfightPhaseAnalysis.length === 0
      )
    )
  ) {
    violations.push("missing.teamfightPhaseAnalysis");
  } else if (
    primary.teamfightPhaseAnalysis !== undefined &&
    primary.teamfightPhaseAnalysis !== null &&
    !hasValidTeamfightPhaseAnalysis(primary.teamfightPhaseAnalysis)
  ) {
    violations.push("shape.teamfightPhaseAnalysis.invalid");
  }
```

Do not change `mergeTeamfightCoaching()`, final validation, prompt contract, or teamfight rendering behavior.

Implementation note at 2026-06-09 09:40 KST:

- Added `hasTeamfightPayload` in `buildAnalysis()` before `mergeTeamfightCoaching(...)`.
- Records `missing.teamfightPhaseAnalysis` only when `payload.teamfightPhases` is non-empty and the raw AI field is `undefined`, `null`, or an empty array.
- Kept malformed non-empty shapes on the existing `shape.teamfightPhaseAnalysis.invalid` path.
- Left deterministic merge, final validation, prompt contract, and rendering behavior unchanged.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
node test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
node test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
node test-artifacts/server/teamfight-phase-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-analysis-missing-tracking-local npm run smoke:report:readonly
```

Expected: focused teamfight/analysis/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN/local QA evidence at 2026-06-09 09:41 KST:

```text
node --check server.js
# passed

node --check test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
# passed

node test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
# 6 passed, 0 failed

node test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
# 6 passed, 0 failed

node test-artifacts/server/teamfight-phase-tests.mjs
# 38 passed, 0 failed

node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 12 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed

npm test
# 2013 passed, 0 failed across 79 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-analysis-missing-tracking-local npm run smoke:report:readonly
# qaStatus: passed
# requiredChecks: 13/13
# smoke: 156 passed, 0 failed
# durationMs: 197
# mode: readonly
# gitShortSha: 0443f93
# gitDirty: true

rg -n --hidden -S "<sensitive-output-pattern>" test-artifacts/tmp/teamfight-analysis-missing-tracking-local
# no matches
```

- [x] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-teamfight-analysis-missing-tracking.md server.js test-artifacts/server/teamfight-analysis-missing-tracking-tests.mjs
git commit -m "test: track missing teamfight analysis"
git push origin main
```

Implementation commit evidence at 2026-06-09 09:43 KST:

```text
git commit -m "test: track missing teamfight analysis"
# e8d7903 test: track missing teamfight analysis

git push origin main
# 0443f93..e8d7903 main -> main
```

- [x] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

Implementation GitHub QA evidence at 2026-06-09 09:44 KST:

```text
gh run watch 27176375524 --exit-status
# success

QA run: 27176375524
QA artifact: 7495877374 (qa-automation-27176375524)
Head SHA: e8d7903fa35edf264eb3c36d8c43553b4a1327b1

qa-summary.json
# qaStatus: passed
# requiredChecks: 13/13
# smoke: 156 passed, 0 failed
# durationMs: 167
# mode: readonly
# ci.provider: github-actions
# git.shortSha: e8d7903
# git.dirty: false

rg -n --hidden -S "<sensitive-output-pattern>" test-artifacts/tmp/gh-run-27176375524
# no matches
```

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-teamfight-analysis-missing-tracking.md
git commit -m "docs: finalize teamfight analysis missing tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.
