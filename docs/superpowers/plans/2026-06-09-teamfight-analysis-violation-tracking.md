# Teamfight Analysis Violation Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record malformed AI `teamfightPhaseAnalysis` input in `analysisMeta.schemaViolations` even when the server safely rebuilds the final teamfight analysis shape.

**Architecture:** Keep the deterministic `mergeTeamfightCoaching()` path unchanged: the final stored `teamfightPhaseAnalysis` still comes from the server payload structure plus usable AI coaching. Add a pre-merge violation check in `buildAnalysis()` so non-null/non-undefined raw AI teamfight analysis that fails the final shape contract is counted as `shape.teamfightPhaseAnalysis.invalid`.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Track Malformed AI Teamfight Analysis Inputs

**Files:**
- Create: `test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-teamfight-analysis-violation-tracking.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs` with a source-extracted `buildAnalysis()` harness. The harness should stub agent calls and deterministic builders, then evaluate the real `buildAnalysis()` source. The primary AI response should be otherwise valid but set:

```js
teamfightPhaseAnalysis: { teamfightId: "enc_001" }
```

The merge stub should return a valid final array so the test proves the issue is violation tracking, not final schema fallback:

```js
function mergeTeamfightCoaching() {
  return [
    {
      teamfightId: "enc_001",
      takeaway: "server merged takeaway",
      phases: [
        {
          phase: "ENGAGE",
          outcomeTag: "INITIATED_KILL",
          playerKills: 1,
          playerDeaths: 0,
          coaching: "server merged coaching",
          relatedEventIds: ["evt_001"],
        },
      ],
    },
  ];
}
```

Assertions:

```js
check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("merged teamfight survives", result.teamfightPhaseAnalysis[0].teamfightId, "enc_001");
checkTrue(
  "schemaViolations include malformed teamfight analysis",
  result.analysisMeta.schemaViolations.includes("shape.teamfightPhaseAnalysis.invalid"),
);
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks invalid raw teamfight analysis before merge",
  buildAnalysisSrc.includes("shape.teamfightPhaseAnalysis.invalid"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
node test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
```

Expected: syntax check passes, runtime test fails because malformed raw `teamfightPhaseAnalysis` is repaired by merge but not recorded in `schemaViolations`.

Actual RED evidence at 2026-06-09 09:29 KST:

```text
node --check test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
# passed

node test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
# 3 passed, 3 failed
# primary analysis and merged teamfight output were preserved, but schemaViolations missed shape.teamfightPhaseAnalysis.invalid and schemaViolationCount stayed 0.
```

- [x] **Step 3: Implement the minimal tracking policy**

In `server.js`, add only this pre-merge check immediately before the existing `primary.teamfightPhaseAnalysis = mergeTeamfightCoaching(...)` assignment:

```js
  if (
    primary.teamfightPhaseAnalysis !== undefined &&
    primary.teamfightPhaseAnalysis !== null &&
    !hasValidTeamfightPhaseAnalysis(primary.teamfightPhaseAnalysis)
  ) {
    violations.push("shape.teamfightPhaseAnalysis.invalid");
  }
```

Do not change `mergeTeamfightCoaching()`, final validation, prompt contract, or teamfight rendering behavior.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
node test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
node test-artifacts/server/teamfight-phase-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-analysis-violation-tracking-local npm run smoke:report:readonly
```

Expected: focused teamfight/analysis/schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN and local QA evidence at 2026-06-09 09:31 KST:

```text
node --check server.js
# passed

node --check test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
# passed

node test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
# 6 passed, 0 failed

node test-artifacts/server/teamfight-phase-tests.mjs
# 38 passed, 0 failed

node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 12 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed

npm test
# 2007 passed, 0 failed across 78 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-analysis-violation-tracking-local npm run smoke:report:readonly
# qaStatus=passed, requiredChecks=13/13, smoke=156 passed / 0 failed, durationMs=303, mode=readonly

rg sensitive-output scan on test-artifacts/tmp/teamfight-analysis-violation-tracking-local
# no matches
```

- [ ] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-teamfight-analysis-violation-tracking.md server.js test-artifacts/server/teamfight-analysis-violation-tracking-tests.mjs
git commit -m "test: track malformed teamfight analysis"
git push origin main
```

- [ ] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-teamfight-analysis-violation-tracking.md
git commit -m "docs: finalize teamfight analysis violation tracking"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.
