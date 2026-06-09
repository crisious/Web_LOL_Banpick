# Insight Event Chip Label Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make insight card evidence chips reuse safe Korean event labels instead of exposing raw timeline `eventType` schema tokens.

**Architecture:** Keep `compactEventTypeLabel()` as the single compact timeline event label helper and tighten its fallback to `이벤트` for missing or unknown values. Route `renderInsightCards()` chip text through that helper while keeping timestamps escaped with `escapeHtml()`. The evidence list already uses the helper, so this aligns two UI surfaces without changing stored sample data.

**Tech Stack:** Vanilla JavaScript frontend, Node.js source regression tests in `test-artifacts/main`, existing read-only smoke report and GitHub QA workflow.

---

### Task 1: Add RED Coverage For Insight Event Chips

**Files:**
- Create: `test-artifacts/main/insight-event-chip-label-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-insight-event-chip-label-helper.md`

- [x] **Step 1: Add the failing regression test**

Create `test-artifacts/main/insight-event-chip-label-tests.mjs` with tests that extract `compactEventTypeLabel()` and `renderInsightCards()` from `main.js`, render linked evidence chips, and assert:

```js
check("compactEventTypeLabel champion kill", compactEventTypeLabel("CHAMPION_KILL"), "킬 관여");
check("compactEventTypeLabel unknown fallback", compactEventTypeLabel("VOIDGRUB<script>"), "이벤트");
checkTrue("renderInsightCards renders known event chip label", host.innerHTML.includes("12:34 · 킬 관여"));
checkTrue("renderInsightCards renders unknown event chip fallback", host.innerHTML.includes("&lt;unsafe&gt; · 이벤트"));
checkTrue("renderInsightCards does not leak known raw event type", !host.innerHTML.includes("CHAMPION_KILL"));
checkTrue("renderInsightCards does not leak unknown raw event type", !host.innerHTML.includes("VOIDGRUB"));
checkTrue("renderInsightCards uses compact event label helper", renderInsightCardsSrc.includes("compactEventTypeLabel(entry.eventType)"));
checkTrue("renderInsightCards no longer writes raw chip eventType", !renderInsightCardsSrc.includes("escapeHtml(entry.eventType)"));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/insight-event-chip-label-tests.mjs
node test-artifacts/main/insight-event-chip-label-tests.mjs
```

Expected: syntax passes; runtime fails because `compactEventTypeLabel()` currently falls back to raw unknown event text and `renderInsightCards()` writes `escapeHtml(entry.eventType)` directly.

Observed 2026-06-09 18:54 KST: syntax passed; runtime failed as expected with `5 passed, 8 failed`, covering unknown/blank `compactEventTypeLabel()` fallback, known/unknown insight event chip labels, raw event token leakage, and missing helper reuse in `renderInsightCards()`.

### Task 2: Reuse Compact Event Labels In Insight Chips

**Files:**
- Modify: `main.js`

- [x] **Step 1: Tighten unknown event fallback**

Change `compactEventTypeLabel(eventType)` so it trims the input, returns mapped labels for known event types, and returns `이벤트` for blank or unknown values:

```js
function compactEventTypeLabel(eventType) {
  const key = String(eventType || "").trim();
  const labels = {
    CHAMPION_KILL: "킬 관여",
    PLAYER_DEATH: "데스",
    DRAGON_FIGHT: "드래곤 교전",
    BARON_FIGHT: "바론 교전",
    TOWER_TAKE: "타워",
    SKIRMISH_WIN: "소규모 교전 승리",
    SKIRMISH_LOSS: "소규모 교전 패배",
    TEAMFIGHT_FOLLOWUP: "한타 후속",
    OBJECTIVE_SETUP_WIN: "오브젝트 준비 성공",
    OBJECTIVE_SETUP_FAIL: "오브젝트 준비 실패",
    ROAM_SUCCESS: "로밍 성공",
    ROAM_FAIL: "로밍 실패",
    BAD_ENGAGE: "불리한 진입",
    LANE_PRIORITY: "라인 주도권",
  };
  return labels[key] || "이벤트";
}
```

- [x] **Step 2: Route insight chips through the helper**

In `renderInsightCards()`, replace the chip event type interpolation with:

```js
<span class="event-chip">${escapeHtml(entry.timestamp)} · ${escapeHtml(compactEventTypeLabel(entry.eventType))}</span>
```

- [x] **Step 3: Verify GREEN**

Run:

```bash
node --check main.js
node --check test-artifacts/main/insight-event-chip-label-tests.mjs
node test-artifacts/main/insight-event-chip-label-tests.mjs
node test-artifacts/main/objective-timeline-label-tests.mjs
node test-artifacts/main/kda-timeline-label-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all commands pass with `0 failed`.

Observed 2026-06-09 18:56 KST: `node --check main.js` and `node --check test-artifacts/main/insight-event-chip-label-tests.mjs` passed. Focused runtime tests passed: insight event chip label `13 passed, 0 failed`, objective timeline label `40 passed, 0 failed`, KDA timeline label `24 passed, 0 failed`, demo mode UI `16 passed, 0 failed`.

### Task 3: Run QA, Browser QA, Commit, Push, And Record Evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-insight-event-chip-label-helper.md`
- Modify outside git: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-event-chip-label-local npm run smoke:report:readonly
node -e 'const fs=require("fs"); const q=JSON.parse(fs.readFileSync("test-artifacts/tmp/insight-event-chip-label-local/qa-summary.json","utf8")); const r=q.latestRun; console.log(JSON.stringify({status:r.status, exitCode:r.exitCode, shortSha:r.git?.shortSha, dirty:r.git?.dirty, smokeSummary:r.smokeSummary, requiredCheckSummary:r.requiredCheckSummary, reportDir:r.reportDir}, null, 2));'
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/insight-event-chip-label-local
```

Expected: `npm test`, `git diff --check`, and smoke pass; sensitive scan has no matches.

Observed 2026-06-09 18:58 KST: `npm test` reported `2512 passed, 0 failed across 114 test file(s)`. `git diff --check` passed. `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-event-chip-label-local npm run smoke:report:readonly` passed with smoke `156 passed, 0 failed` and required checks `13 passed, 0 failed, 0 missing`; local smoke artifact shortSha was `cbe22e1` with `dirty: true` because implementation changes were intentionally uncommitted. Sensitive pattern scan over `test-artifacts/tmp/insight-event-chip-label-local` had no matches.

- [x] **Step 2: Run browser QA**

Open `http://127.0.0.1:8123/?qa=insight-event-chip-label`, click `저장 샘플 열기`, inspect visible `.event-chip` text in insight cards, and confirm Korean event labels are visible, raw event tokens are absent from scoped chip text, and console warn/error count is 0.

Observed 2026-06-09 18:56 KST: Browser QA on `http://127.0.0.1:8123/?qa=insight-event-chip-label` passed. Stored sample opened, report content became visible, `.insight-card` count was 6, `.event-chip` count was 12, visible chip labels included `드래곤 교전`, `오브젝트 준비 성공`, `한타 후속`, `소규모 교전 승리`, `데스`, `오브젝트 준비 실패`, and `바론 교전`; scoped chip visible-text raw token checks for timeline event enums were empty. Console warn/error count was 0.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/insight-event-chip-label-tests.mjs docs/superpowers/plans/2026-06-09-insight-event-chip-label-helper.md
git commit -m "test: reuse insight event chip labels"
git push origin main
```

Observed 2026-06-09 18:57 KST: implementation commit `493baf9 test: reuse insight event chip labels` was pushed to `origin/main`.

- [x] **Step 4: Verify GitHub QA artifact**

Run `gh run list`, watch the latest `main` run for the pushed commit, download `qa-automation-<run-id>`, inspect `qa-summary.json`, and run the same sensitive scan on the artifact directory.

Observed 2026-06-09 18:58 KST: GitHub Actions QA run `27198440443` for `493baf9` passed. Artifact `7504378975` (`qa-automation-27198440443`, 3549 bytes, digest `sha256:d5a83c50ce7af021d05e6fa45879bb4c13bd69ddb3e78148c18d3067b354d21d`) downloaded successfully. `qa-summary.json` reported `status: "passed"`, `exitCode: 0`, `latestRun.git.shortSha: "493baf9"`, `dirty: false`, smoke `156 passed / 0 failed`, required checks `13 passed / 0 failed / 0 missing`, artifact integrity `passed`, and QA verdict `passed`. Sensitive pattern scan over `test-artifacts/tmp/github-qa-27198440443` had no matches.

- [x] **Step 5: Record Obsidian evidence and finalize plan**

Append an insight event chip label helper entry to `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with RED/GREEN/full QA, browser QA, implementation commit, GitHub run/artifact, sensitive scan, and final sync evidence. Then mark completed plan steps in this file, commit with:

```bash
git add docs/superpowers/plans/2026-06-09-insight-event-chip-label-helper.md
git commit -m "docs: finalize insight event chip label plan"
git push origin main
```

Observed 2026-06-09 18:59 KST: Obsidian project log was updated with RED/GREEN/full QA, browser QA, implementation commit, GitHub run/artifact, and sensitive scan evidence. This repository plan finalization is committed separately so the final docs-only GitHub QA run can be recorded in Obsidian without creating another documentation loop.

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

- Spec coverage: the plan covers helper reuse, safe unknown fallback, focused RED/GREEN tests, local QA, browser QA, GitHub QA, Obsidian evidence, and final sync.
- Placeholder scan: no deferred implementation markers remain; commands and file paths are explicit.
- Type consistency: helper names are consistent across tests, implementation snippets, and verification steps.
