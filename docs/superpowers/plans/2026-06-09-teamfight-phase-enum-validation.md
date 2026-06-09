# Teamfight Phase Enum Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten `teamfightPhaseAnalysis` validation so AI output only accepts the phase and outcome tags that the server builds and the UI renders intentionally.

**Architecture:** Keep the optional top-level `teamfightPhaseAnalysis` backward-compatible (`undefined`, `null`, and `[]` still pass), but validate each phase row with explicit server-side enums when the array is present. Add schema regression coverage before changing production validation.

**Tech Stack:** Node.js, vanilla `server.js`, existing `test-artifacts/schema/schema-tests.mjs` harness, GitHub Actions QA workflow, Obsidian project log.

---

### Task 1: Add RED Coverage For Invalid Teamfight Enums

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [x] **Step 1: Add failing enum assertions**

Add these checks in the `teamfightPhaseAnalysis 검증` section after the existing valid item assertion:

```js
expectThrows("teamfightPhaseAnalysis: invalid phase enum throws",
  () => {
    const item = teamfightPhaseItem();
    item.phases[0].phase = "LANING";
    validateAnalysisOutput(withTeamfightPhaseAnalysis([item]));
  },
  "phase");

expectThrows("teamfightPhaseAnalysis: invalid outcomeTag enum throws",
  () => {
    const item = teamfightPhaseItem();
    item.phases[0].outcomeTag = "UNKNOWN_OUTCOME";
    validateAnalysisOutput(withTeamfightPhaseAnalysis([item]));
  },
  "outcomeTag");
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/schema/schema-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected: syntax passes, runtime fails only the two new enum assertions because the current validator accepts any nonblank `phase` and `outcomeTag`.

Result: `node --check test-artifacts/schema/schema-tests.mjs` passed. `node test-artifacts/schema/schema-tests.mjs` failed only the new enum assertions with `105 passed, 2 failed`, proving the current validator accepts `LANING` and `UNKNOWN_OUTCOME`.

### Task 2: Implement Enum Validation

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add enum constants**

Near `GAME_PHASES`, add:

```js
const TEAMFIGHT_PHASES = new Set(["ENGAGE", "TRADE", "CLEANUP"]);
const TEAMFIGHT_OUTCOME_TAGS = new Set([
  "INITIATED_KILL",
  "CAUGHT_OUT",
  "TRADE_WON",
  "TRADE_LOST",
  "TRADE_EVEN",
  "CLOSED_OUT",
  "OVERCHASE_DEATH",
  "DIED_IN_FIGHT",
]);
```

- [x] **Step 2: Add validation helpers**

Near `isValidGamePhase`, add:

```js
function isValidTeamfightPhase(value) {
  return isNonBlankString(value) && TEAMFIGHT_PHASES.has(value);
}

function isValidTeamfightOutcomeTag(value) {
  return isNonBlankString(value) && TEAMFIGHT_OUTCOME_TAGS.has(value);
}
```

- [x] **Step 3: Use helpers in `hasValidTeamfightPhaseAnalysis`**

Replace the loose nonblank checks:

```js
isNonBlankString(phase.phase) &&
isNonBlankString(phase.outcomeTag) &&
```

with:

```js
isValidTeamfightPhase(phase.phase) &&
isValidTeamfightOutcomeTag(phase.outcomeTag) &&
```

- [x] **Step 4: Preserve detailed error messages**

In `validateAnalysisOutput`, replace:

```js
if (!phase || !isNonBlankString(phase.phase)) throw new Error("teamfightPhaseAnalysis phase missing phase");
if (!isNonBlankString(phase.outcomeTag)) throw new Error("teamfightPhaseAnalysis phase missing outcomeTag");
```

with:

```js
if (!phase || !isValidTeamfightPhase(phase.phase)) throw new Error("teamfightPhaseAnalysis phase missing phase");
if (!isValidTeamfightOutcomeTag(phase.outcomeTag)) throw new Error("teamfightPhaseAnalysis phase missing outcomeTag");
```

Result: The enum sets and helper predicates were implemented locally inside `hasValidTeamfightPhaseAnalysis()` and the detailed `validateAnalysisOutput()` error branch. This preserves the intended enum contract while avoiding broad source-extraction harness churn across build-analysis regression tests that embed only selected server functions.

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `server.js`
- Verify: `test-artifacts/schema/schema-tests.mjs`
- Verify: `test-artifacts/server/teamfight-phase-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/schema-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/teamfight-phase-tests.mjs
```

Expected: all focused checks pass; schema total increases by 2.

Result: `node --check server.js` passed; `node --check test-artifacts/schema/schema-tests.mjs` passed; schema tests passed `107 passed, 0 failed`; teamfight phase tests passed `38 passed, 0 failed`.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-phase-enum-validation-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/teamfight-phase-enum-validation-local
```

Expected: full suite and read-only smoke pass; the sensitive scan exits with no matches.

Result: `npm test` passed with `2260 passed, 0 failed across 99 test file(s)`; `git diff --check` passed; local read-only smoke report passed `156 passed, 0 failed` at `test-artifacts/tmp/teamfight-phase-enum-validation-local/2026-06-09T06-02-09Z-readonly`; sensitive pattern scan against `test-artifacts/tmp/teamfight-phase-enum-validation-local` had no matches.

### Task 4: Commit, Push, GitHub QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-teamfight-phase-enum-validation.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add server.js test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-09-teamfight-phase-enum-validation.md
git commit -m "test: validate teamfight phase enums"
git push origin main
```

- [x] **Step 2: Verify GitHub QA artifact**

Use:

```bash
gh run list --branch main --limit 5 --json databaseId,headSha,conclusion,status,workflowName,createdAt,url
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
gh run download <run-id> --dir test-artifacts/tmp/github-qa-<run-id>
```

Confirm `qa-summary.json` reports the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, and no sensitive pattern matches in the downloaded artifact.

Result: Implementation commit `fd6c6af test: validate teamfight phase enums` was pushed to `origin/main`. GitHub QA run `27187151269` completed successfully for `fd6c6af`; artifact `7499704552` (`qa-automation-27187151269`, 3548 bytes) was downloaded. `qa-summary.json` reports `latestRun.git.shortSha: "fd6c6af"`, `dirty: false`, smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, `durationMs: 205`; sensitive pattern scan against `test-artifacts/tmp/github-qa-27187151269` had no matches.

- [x] **Step 3: Update Obsidian and final sync**

Record RED/GREEN/full QA, local smoke, GitHub run/artifact, sensitive scan, and final sync evidence in Obsidian. Then run:

```bash
rm -rf test-artifacts/tmp
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
git status --short --branch
```

Expected: `main...origin/main` is `0 0` and the working tree is clean.

Result: This repo plan finalization records the implementation QA evidence for `fd6c6af`. It is committed separately so the final docs-only GitHub QA run can be recorded in Obsidian without creating another repository documentation loop.

---

## Self-Review

- Spec coverage: The plan directly tightens `teamfightPhaseAnalysis` shape validation without changing optional top-level compatibility or the rule-based teamfight builder.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague test steps remain.
- Type consistency: The enum names match the existing `buildTeamfightPhases()` and `teamfightPhaseCoaching()` values.
