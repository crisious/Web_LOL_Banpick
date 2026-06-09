# Teamfight Game Phase Label Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make teamfight analysis card headers render safe Korean game-phase labels instead of exposing raw `teamfightPhaseAnalysis[].gamePhase` schema tokens.

**Architecture:** Reuse the existing `gamePhaseLabel()` display helper at the `renderTeamfightPhases()` top-level card header boundary. Keep stored `gamePhase` values unchanged for schema and logic, and keep fight-section row labels routed through `teamfightPhaseLabel()` / `teamfightOutcomeLabel()`. Add a focused frontend regression test that renders synthetic teamfight data and confirms known/unknown game phases are localized and escaped.

**Tech Stack:** Vanilla JavaScript frontend, Node.js source regression tests in `test-artifacts/main`, existing read-only smoke report and GitHub QA workflow.

---

### Task 1: Add RED Coverage For Teamfight Card Game Phase Labels

**Files:**
- Create: `test-artifacts/main/teamfight-game-phase-label-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-teamfight-game-phase-label-helper.md`

- [x] **Step 1: Add the failing regression test**

Create `test-artifacts/main/teamfight-game-phase-label-tests.mjs` with tests that extract `renderTeamfightPhases()` from `main.js`, render two synthetic `teamfightPhaseAnalysis` items, and assert:

```js
checkTrue("renderTeamfightPhases renders Korean MID game phase", dom.teamfightPhases.innerHTML.includes("<strong>중반</strong>"));
checkTrue("renderTeamfightPhases renders unknown game phase fallback", dom.teamfightPhases.innerHTML.includes("<strong>구간</strong>"));
checkTrue("renderTeamfightPhases keeps fight-section phase label", dom.teamfightPhases.innerHTML.includes("<strong>진입</strong>"));
checkTrue("renderTeamfightPhases escapes unsafe time label", dom.teamfightPhases.innerHTML.includes("&lt;unsafe&gt;~21:00"));
checkTrue("renderTeamfightPhases does not leak raw MID game phase", !dom.teamfightPhases.innerHTML.includes("<strong>MID</strong>"));
checkTrue("renderTeamfightPhases does not leak unsafe raw game phase", !dom.teamfightPhases.innerHTML.includes("LANING"));
checkTrue("renderTeamfightPhases uses gamePhaseLabel for top-level game phase", renderTeamfightPhasesSrc.includes("gamePhaseLabel(tf.gamePhase)"));
checkTrue("renderTeamfightPhases no longer writes raw top-level game phase", !renderTeamfightPhasesSrc.includes("escapeHtml(tf.gamePhase || \"\")"));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/teamfight-game-phase-label-tests.mjs
node test-artifacts/main/teamfight-game-phase-label-tests.mjs
```

Expected: syntax passes; runtime fails because `renderTeamfightPhases()` currently writes `escapeHtml(tf.gamePhase || "")` directly in the card header.

Observed 2026-06-09 19:04 KST: syntax passed; runtime failed as expected with `2 passed, 6 failed`, covering missing Korean `MID` label, unknown phase fallback, raw `MID`/unsafe gamePhase leakage, missing `gamePhaseLabel(tf.gamePhase)` helper reuse, and direct raw `tf.gamePhase` interpolation.

### Task 2: Route Teamfight Card Game Phase Through `gamePhaseLabel()`

**Files:**
- Modify: `main.js`

- [x] **Step 1: Use shared game phase label helper**

In `renderTeamfightPhases(sample)`, replace the card header game phase markup:

```js
<strong>${escapeHtml(tf.gamePhase || "")}</strong>
```

with:

```js
<strong>${escapeHtml(gamePhaseLabel(tf.gamePhase))}</strong>
```

- [x] **Step 2: Verify GREEN**

Run:

```bash
node --check main.js
node --check test-artifacts/main/teamfight-game-phase-label-tests.mjs
node test-artifacts/main/teamfight-game-phase-label-tests.mjs
node test-artifacts/main/teamfight-label-tests.mjs
node test-artifacts/main/key-moment-phase-label-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all commands pass with `0 failed`.

Observed 2026-06-09 19:05 KST: `node --check main.js` and `node --check test-artifacts/main/teamfight-game-phase-label-tests.mjs` passed. Focused runtime tests passed: teamfight game phase label `8 passed, 0 failed`, teamfight label `21 passed, 0 failed`, key moment phase label `12 passed, 0 failed`, demo mode UI `16 passed, 0 failed`.

### Task 3: Run QA, Browser QA, Commit, Push, And Record Evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-teamfight-game-phase-label-helper.md`
- Modify outside git: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-game-phase-label-local npm run smoke:report:readonly
node -e 'const fs=require("fs"); const q=JSON.parse(fs.readFileSync("test-artifacts/tmp/teamfight-game-phase-label-local/qa-summary.json","utf8")); const r=q.latestRun; console.log(JSON.stringify({status:r.status, exitCode:r.exitCode, shortSha:r.git?.shortSha, dirty:r.git?.dirty, smokeSummary:r.smokeSummary, requiredCheckSummary:r.requiredCheckSummary, reportDir:r.reportDir}, null, 2));'
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/teamfight-game-phase-label-local
```

Expected: `npm test`, `git diff --check`, and smoke pass; sensitive scan has no matches.

Observed 2026-06-09 19:08 KST: `npm test` reported `2520 passed, 0 failed across 115 test file(s)`. `git diff --check` passed. `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-game-phase-label-local npm run smoke:report:readonly` passed with smoke `156 passed, 0 failed` and required checks `13 passed, 0 failed, 0 missing`; local smoke artifact shortSha was `eb28af4` with `dirty: true` because implementation changes were intentionally uncommitted. Sensitive pattern scan over `test-artifacts/tmp/teamfight-game-phase-label-local` had no matches.

- [x] **Step 2: Run browser QA**

Open `http://127.0.0.1:8123/?qa=teamfight-game-phase-label`, click `저장 샘플 열기`, inspect `[data-teamfight-phases] .moment-stamp strong`, and confirm Korean game-phase labels are visible, raw `EARLY`/`MID`/`LATE` tokens are absent from scoped teamfight stamp text, and console warn/error count is 0.

Observed 2026-06-09 19:10 KST: Stored samples did not include non-empty `teamfightPhaseAnalysis`, so Browser QA used an untracked temporary read-only fixture under `test-artifacts/tmp/teamfight-browser-samples` and a temporary server at `http://127.0.0.1:8124/?qa=teamfight-game-phase-label`. The stored sample UI opened successfully, `[data-teamfight-phases] .moment-card` count was 1, stamp label text was `중반`, scoped stamp raw token checks for `EARLY`, `MID`, and `LATE` were empty, and console warn/error count was 0. The temporary server was stopped after verification.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/teamfight-game-phase-label-tests.mjs docs/superpowers/plans/2026-06-09-teamfight-game-phase-label-helper.md
git commit -m "test: localize teamfight game phase labels"
git push origin main
```

Observed 2026-06-09 19:12 KST: implementation commit `65fa61b test: localize teamfight game phase labels` was pushed to `origin/main`.

- [x] **Step 4: Verify GitHub QA artifact**

Run `gh run list`, watch the latest `main` run for the pushed commit, download `qa-automation-<run-id>`, inspect `qa-summary.json`, and run the same sensitive scan on the artifact directory.

Observed 2026-06-09 19:13 KST: GitHub Actions QA run `27199231634` for `65fa61b` passed. Artifact `7504708348` (`qa-automation-27199231634`, 3548 bytes, digest `sha256:f83204680fb0ba35b113cb9f864cf5d64af3ed590b535eb19f3d1d8aaecbeb12`) downloaded successfully. `qa-summary.json` reported `status: "passed"`, `exitCode: 0`, `latestRun.git.shortSha: "65fa61b"`, `dirty: false`, smoke `156 passed / 0 failed`, required checks `13 passed / 0 failed / 0 missing`, artifact integrity `passed`, and QA verdict `passed`. Sensitive pattern scan over `test-artifacts/tmp/github-qa-27199231634` had no matches.

- [x] **Step 5: Record Obsidian evidence and finalize plan**

Append a teamfight game phase label helper entry to `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with RED/GREEN/full QA, browser QA, implementation commit, GitHub run/artifact, sensitive scan, and final sync evidence. Then mark completed plan steps in this file, commit with:

```bash
git add docs/superpowers/plans/2026-06-09-teamfight-game-phase-label-helper.md
git commit -m "docs: finalize teamfight game phase label plan"
git push origin main
```

Observed 2026-06-09 19:14 KST: Obsidian project log was updated with RED/GREEN/full QA, browser QA, implementation commit, GitHub run/artifact, and sensitive scan evidence. This repository plan finalization is committed separately so the final docs-only GitHub QA run can be recorded in Obsidian without creating another documentation loop.

- [ ] **Step 6: Final sync**

Run:

```bash
rm -rf test-artifacts/tmp
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
git status --short --branch
git log --oneline --decorate --max-count=8
```

Expected: `0 0`, clean worktree, local `main` equals `origin/main`.

---

## Review Notes

- Spec coverage: the plan covers helper reuse, safe fallback, focused RED/GREEN tests, local QA, browser QA, GitHub QA, Obsidian evidence, and final sync.
- Placeholder scan: no deferred implementation markers remain; commands and file paths are explicit.
- Type consistency: `gamePhaseLabel(tf.gamePhase)` is used for top-level game phases, while `teamfightPhaseLabel(p.phase)` remains dedicated to fight-section phases.
