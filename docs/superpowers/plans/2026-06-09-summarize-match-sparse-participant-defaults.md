# Summarize Match Sparse Participant Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep recent-match summaries stable when Riot participant payloads omit optional combat, item, or summoner fields.

**Architecture:** `summarizeMatch()` remains the single raw Match-V5 to recent-card summary adapter. Add focused regression coverage to the existing match summary harness, then make the adapter mirror the safer numeric defaults already used by `buildNormalized()`.

**Tech Stack:** Node.js ES modules, existing text-extraction regression harnesses under `test-artifacts/server`, `npm test`, read-only smoke report.

---

### Task 1: Add Sparse Participant Regression

**Files:**
- Modify: `test-artifacts/server/match-summary-tests.mjs`
- Verify: `node --check test-artifacts/server/match-summary-tests.mjs`
- Verify: `node test-artifacts/server/match-summary-tests.mjs`

- [x] **Step 1: Add a sparse participant test**

Append this case after the existing `summarizeMatch result win->WIN` assertion:

```js
const sparse = summarizeMatch(
  {
    metadata: { matchId: "KR_TEST_SPARSE" },
    info: {
      queueId: 420, gameDuration: 1200, gameVersion: "14.2.1", gameCreation: 2,
      participants: [
        { puuid: "ME", teamId: 100, teamPosition: "UTILITY", championName: "Milio", win: false },
        { puuid: "ALLY", teamId: 100, kills: 0 },
      ],
    },
  },
  "ME",
);
check("summarizeMatch sparse kills default", sparse.kills, 0);
check("summarizeMatch sparse deaths default", sparse.deaths, 0);
check("summarizeMatch sparse assists default", sparse.assists, 0);
check("summarizeMatch sparse killParticipation default", sparse.killParticipation, 0);
check("summarizeMatch sparse items default", sparse.items, [0, 0, 0, 0, 0, 0, 0]);
check("summarizeMatch sparse summoner spells default", sparse.summonerSpells, [0, 0]);
checkTrue("summarizeMatch sparse values are finite", Number.isFinite(sparse.killParticipation));
```

- [x] **Step 2: Run RED**

Run:

```bash
node --check test-artifacts/server/match-summary-tests.mjs
node test-artifacts/server/match-summary-tests.mjs
```

Expected: syntax passes; runtime fails only the new sparse participant assertions because `summarizeMatch()` currently returns undefined fields and `NaN` kill participation for missing K/D/A.

Result: `node --check test-artifacts/server/match-summary-tests.mjs` passed. Runtime produced the expected RED failure shape: existing assertions passed, and only the 7 new sparse participant defaults/finite assertions failed (`25 passed, 7 failed`).

### Task 2: Default Sparse Summary Fields

**Files:**
- Modify: `server.js`
- Verify: `node --check server.js`
- Verify: `node test-artifacts/server/match-summary-tests.mjs`

- [x] **Step 1: Add local numeric defaults inside `summarizeMatch()`**

Change the start of `summarizeMatch()` after `cs`:

```js
const kills = participant.kills || 0;
const deaths = participant.deaths || 0;
const assists = participant.assists || 0;
```

- [x] **Step 2: Reuse defaults in summary output**

Update `summary` so K/D/A, kill participation, items, and summoner spells use defaults:

```js
kills,
deaths,
assists,
killParticipation: Math.min(1, +((kills + assists) / Math.max(1, teamTotalKills)).toFixed(2)),
items: [
  participant.item0 || 0,
  participant.item1 || 0,
  participant.item2 || 0,
  participant.item3 || 0,
  participant.item4 || 0,
  participant.item5 || 0,
  participant.item6 || 0,
],
summonerSpells: [participant.summoner1Id || 0, participant.summoner2Id || 0],
```

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check server.js
node --check test-artifacts/server/match-summary-tests.mjs
node test-artifacts/server/match-summary-tests.mjs
```

Expected: match summary harness passes with the new sparse participant coverage.

Result: `node --check server.js`, `node --check test-artifacts/server/match-summary-tests.mjs`, and `node test-artifacts/server/match-summary-tests.mjs` all passed. Match summary harness reports `32 passed, 0 failed`.

### Task 3: QA, Documentation, And Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-summarize-match-sparse-participant-defaults.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run regression and smoke QA**

Run:

```bash
node test-artifacts/server/match-summary-tests.mjs
node test-artifacts/server/public-demo-mode-gate-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/summarize-match-sparse-defaults-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/summarize-match-sparse-defaults-local
```

Expected: focused tests pass, full suite passes, diff check passes, smoke report passes, sensitive scan has no matches.

Result: `node test-artifacts/server/match-summary-tests.mjs` reported `32 passed, 0 failed`; `node test-artifacts/server/public-demo-mode-gate-tests.mjs` reported `67 passed, 0 failed`; `npm test` reported `2250 passed, 0 failed across 99 test file(s)`; `git diff --check` passed; local read-only smoke report passed 156 checks at `test-artifacts/tmp/summarize-match-sparse-defaults-local/2026-06-09T05-37-16Z-readonly`; sensitive pattern scan against `test-artifacts/tmp/summarize-match-sparse-defaults-local` had no matches.

- [x] **Step 2: Commit and push implementation**

Run:

```bash
git add server.js test-artifacts/server/match-summary-tests.mjs docs/superpowers/plans/2026-06-09-summarize-match-sparse-participant-defaults.md
git commit -m "test: default sparse match summaries"
git push origin main
```

- [x] **Step 3: Verify GitHub Actions artifact**

Use `gh run list` and `gh run download` for the pushed commit. Confirm `qa-summary.json` reports the pushed short SHA, `dirty: false`, smoke pass counts, required checks total/passed, and no sensitive pattern matches in the downloaded artifact.

Result: Implementation commit `86ffa89 test: default sparse match summaries` was pushed to `origin/main`. GitHub QA run `27186250554` completed successfully for `86ffa89`; artifact `7499371218` (`qa-automation-27186250554`, 3549 bytes) was downloaded. `qa-summary.json` reports `latestRun.git.shortSha: "86ffa89"`, `dirty: false`, smoke `156 passed, 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0, `durationMs: 208`; sensitive pattern scan against `test-artifacts/tmp/github-qa-27186250554` had no matches.

- [x] **Step 4: Update Obsidian and final sync**

Append a `2026-06-09 14:34 KST - Summarize match sparse participant defaults` entry with RED/GREEN/full QA, local smoke artifact, implementation commit, GitHub run/artifact, sensitive scan, and final `main...origin/main` sync count. Then run `git fetch origin --prune`, `git merge --ff-only origin/main`, `git rev-list --left-right --count main...origin/main`, and `git status --short --branch`.

Result: Obsidian project log was updated with the implementation QA evidence for `86ffa89`, including RED/GREEN/full QA, local smoke, GitHub run `27186250554`, artifact `7499371218`, and sensitive scan results. This repo plan finalization is committed separately so the final docs-only GitHub QA run can be recorded in Obsidian without creating another repository documentation loop.

---

## Self-Review

- Spec coverage: The plan implements the Phase 33 `summarizeMatch` regression hardening path from `PLAN.md` by covering sparse raw participant payloads in the existing recent-match summary harness.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The affected function remains `summarizeMatch(match, puuid)`, and all expected summary fields keep their current names.
