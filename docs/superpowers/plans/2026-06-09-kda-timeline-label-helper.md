# KDA Timeline Label Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make KDA timeline event rows render safe Korean labels and neutral fallback styling without leaking raw event enum tokens or unsafe sample text.

**Architecture:** Add small display helpers near the existing frontend label helpers: `kdaEventTypeLabel(eventType)` and `kdaEventTypeClass(eventType)`. Keep stored sample enum values unchanged for logic and chart colors, but route the event row display boundary in `renderKdaTimeline()` through helpers plus `escapeHtml()` / `escapeAttr()`. Add a neutral row style for unknown KDA event types.

**Tech Stack:** Vanilla JavaScript frontend, CSS, Node.js source/runtime regression tests in `test-artifacts/main`, existing read-only smoke report and GitHub QA workflow.

---

### Task 1: Add RED Coverage For KDA Timeline Labels

**Files:**
- Create: `test-artifacts/main/kda-timeline-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-kda-timeline-label-helper.md`

- [x] **Step 1: Add the failing regression test**

Create `test-artifacts/main/kda-timeline-label-tests.mjs`:

```js
// KDA timeline label regression tests.
//
// KDA event rows are user-facing, so raw event enum values and unsafe sample
// strings should not be interpolated directly.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const stylesSrc = fs.readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

function extractConstSource(source, name) {
  const pattern = new RegExp(`const ${name} = \\{[\\s\\S]*?\\};`);
  const match = source.match(pattern);
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

function optionalFunctionSource(source, name, fallback) {
  return source.includes(`function ${name}(`) ? extractFunctionSource(source, name) : fallback;
}

const htmlEscapeSrc = extractConstSource(mainSrc, "HTML_ESCAPE");
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const kdaEventTypeLabelSrc = optionalFunctionSource(mainSrc, "kdaEventTypeLabel", "function kdaEventTypeLabel(eventType) { return eventType; }");
const kdaEventTypeClassSrc = optionalFunctionSource(mainSrc, "kdaEventTypeClass", "function kdaEventTypeClass(eventType) { return eventType === \"PLAYER_DEATH\" ? \"death\" : \"kill\"; }");
const renderKdaTimelineSrc = extractFunctionSource(mainSrc, "renderKdaTimeline");

const { kdaEventTypeLabel, kdaEventTypeClass, renderKdaTimeline, dom } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${kdaEventTypeLabelSrc}
${kdaEventTypeClassSrc}
const dom = {
  kdaChart: { innerHTML: "" },
  kdaEvents: { innerHTML: "" },
};
${renderKdaTimelineSrc}
return { kdaEventTypeLabel, kdaEventTypeClass, renderKdaTimeline, dom };`,
)();

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

check("kdaEventTypeLabel death", kdaEventTypeLabel("PLAYER_DEATH"), "데스");
check("kdaEventTypeLabel kill", kdaEventTypeLabel("CHAMPION_KILL"), "킬");
check("kdaEventTypeLabel followup", kdaEventTypeLabel("TEAMFIGHT_FOLLOWUP"), "어시스트");
check("kdaEventTypeLabel skirmish", kdaEventTypeLabel("SKIRMISH_WIN"), "어시스트");
check("kdaEventTypeLabel unknown fallback", kdaEventTypeLabel("OBJECTIVE_SETUP_WIN"), "KDA 변화");
check("kdaEventTypeLabel blank fallback", kdaEventTypeLabel("   "), "KDA 변화");
check("kdaEventTypeClass death", kdaEventTypeClass("PLAYER_DEATH"), "death");
check("kdaEventTypeClass kill", kdaEventTypeClass("CHAMPION_KILL"), "kill");
check("kdaEventTypeClass followup", kdaEventTypeClass("TEAMFIGHT_FOLLOWUP"), "assist");
check("kdaEventTypeClass unknown fallback", kdaEventTypeClass("OBJECTIVE_SETUP_WIN"), "neutral");

renderKdaTimeline({
  normalized: {
    kdaTimeline: [
      { timeLabel: "0:00", eventType: "GAME_START", kills: 0, deaths: 0, assists: 0, kda: 0, event: "게임 시작" },
      { timeLabel: "02:00", eventType: "CHAMPION_KILL", kills: 1, deaths: 0, assists: 0, kda: 1, event: "직접 킬" },
      { timeLabel: "04:30", eventType: "TEAMFIGHT_FOLLOWUP", kills: 1, deaths: 0, assists: 1, kda: 2, event: "후속 합류" },
      { timeLabel: "<unsafe>", eventType: "OBJECTIVE_SETUP_WIN", kills: 1, deaths: 0, assists: 2, kda: "<bad>", event: "<img src=x onerror=alert(1)>" },
    ],
  },
});

checkTrue("renderKdaTimeline renders kill Korean label", dom.kdaEvents.innerHTML.includes('<span class="kda-evt-type">킬</span>'));
checkTrue("renderKdaTimeline renders assist Korean label", dom.kdaEvents.innerHTML.includes('<span class="kda-evt-type">어시스트</span>'));
checkTrue("renderKdaTimeline renders unknown safe fallback", dom.kdaEvents.innerHTML.includes('<span class="kda-evt-type">KDA 변화</span>'));
checkTrue("renderKdaTimeline does not leak raw unknown event enum", !dom.kdaEvents.innerHTML.includes("OBJECTIVE_SETUP_WIN"));
checkTrue("renderKdaTimeline does not leak raw followup enum", !dom.kdaEvents.innerHTML.includes("TEAMFIGHT_FOLLOWUP"));
checkTrue("renderKdaTimeline escapes unsafe time labels", dom.kdaEvents.innerHTML.includes("&lt;unsafe&gt;"));
checkTrue("renderKdaTimeline escapes unsafe descriptions", dom.kdaEvents.innerHTML.includes("&lt;img src=x onerror=alert(1)&gt;"));
checkTrue("renderKdaTimeline does not interpolate unsafe descriptions", !dom.kdaEvents.innerHTML.includes("<img src=x"));
checkTrue("renderKdaTimeline uses kdaEventTypeLabel helper", renderKdaTimelineSrc.includes("kdaEventTypeLabel(p.eventType)"));
checkTrue("renderKdaTimeline uses kdaEventTypeClass helper", renderKdaTimelineSrc.includes("kdaEventTypeClass(p.eventType)"));
checkTrue("renderKdaTimeline no longer defines inline eventTypeLabel map", !renderKdaTimelineSrc.includes("const eventTypeLabel ="));
checkTrue("renderKdaTimeline no longer falls back to raw eventType", !renderKdaTimelineSrc.includes("|| p.eventType"));
checkTrue("neutral KDA event has style", stylesSrc.includes(".kda-evt--neutral"));
checkTrue("assist KDA event has style", stylesSrc.includes(".kda-evt--assist"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/kda-timeline-label-tests.mjs
node test-artifacts/main/kda-timeline-label-tests.mjs
```

Expected: syntax passes; runtime fails because `kdaEventTypeLabel()` and `kdaEventTypeClass()` do not exist yet, `renderKdaTimeline()` still defines inline `eventTypeLabel`, falls back to raw `p.eventType`, renders unsafe `timeLabel` / `event` values directly, and CSS has no assist/neutral row styles.

Observed 2026-06-09 18:22 KST: syntax passed; runtime failed as expected with `5 passed, 19 failed`, covering missing label/class helpers, raw unknown event fallback, unsafe `timeLabel` / description interpolation, inline `eventTypeLabel`, raw `p.eventType` fallback, and missing assist/neutral styles.

### Task 2: Add KDA Timeline Display Helpers

**Files:**
- Modify: `main.js`
- Modify: `styles.css`

- [x] **Step 1: Add KDA label helpers near other frontend label helpers**

Add after `wardActionClass(action)`:

```js
function kdaEventTypeLabel(eventType) {
  const key = String(eventType || "").trim();
  const labels = {
    PLAYER_DEATH: "데스",
    CHAMPION_KILL: "킬",
    TEAMFIGHT_FOLLOWUP: "어시스트",
    SKIRMISH_WIN: "어시스트",
  };
  return labels[key] || "KDA 변화";
}

function kdaEventTypeClass(eventType) {
  const key = String(eventType || "").trim();
  if (key === "PLAYER_DEATH") return "death";
  if (key === "CHAMPION_KILL") return "kill";
  if (key === "TEAMFIGHT_FOLLOWUP" || key === "SKIRMISH_WIN") return "assist";
  return "neutral";
}
```

- [x] **Step 2: Route `renderKdaTimeline()` through helpers and escaping**

In `renderKdaTimeline(sample)`, remove:

```js
  const eventTypeLabel = {
    PLAYER_DEATH: "데스",
    CHAMPION_KILL: "킬",
    TEAMFIGHT_FOLLOWUP: "어시스트",
    SKIRMISH_WIN: "어시스트",
  };
```

Replace the event row mapping with:

```js
  dom.kdaEvents.innerHTML = points.slice(1).map((p) => {
    const typeClass = kdaEventTypeClass(p.eventType);
    const kdaText = `${p.kills}/${p.deaths}/${p.assists} (${p.kda})`;
    return `
      <div class="kda-evt kda-evt--${escapeAttr(typeClass)}">
        <span class="kda-evt-time">${escapeHtml(p.timeLabel || "")}</span>
        <span class="kda-evt-type">${escapeHtml(kdaEventTypeLabel(p.eventType))}</span>
        <span class="kda-evt-kda">${escapeHtml(kdaText)}</span>
        <span class="kda-evt-desc">${escapeHtml(p.event || "")}</span>
      </div>
    `;
  }).join("");
```

- [x] **Step 3: Add assist and neutral row styles**

In `styles.css`, add after `.kda-evt--kill`:

```css
.kda-evt--assist {
  background: var(--amber-bg-soft);
  border-left-color: var(--accent);
}

.kda-evt--neutral {
  background: var(--surface-2);
  border-left-color: var(--line);
}
```

Add after the existing `.kda-evt--kill .kda-evt-type` rule:

```css
.kda-evt--assist .kda-evt-type { color: var(--accent); }
.kda-evt--neutral .kda-evt-type { color: var(--muted); }
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
node --check main.js
node --check test-artifacts/main/kda-timeline-label-tests.mjs
node test-artifacts/main/kda-timeline-label-tests.mjs
node test-artifacts/main/ward-timeline-label-tests.mjs
node test-artifacts/main/timeline-phase-label-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all commands pass with `0 failed`.

Observed 2026-06-09 18:23 KST: `node --check main.js`, `node --check test-artifacts/main/kda-timeline-label-tests.mjs`, and focused runtime tests passed. KDA label test reported `24 passed, 0 failed`; ward timeline label `25 passed, 0 failed`; timeline phase label `9 passed, 0 failed`; demo mode UI `16 passed, 0 failed`.

### Task 3: Run Local QA, Browser QA, Commit, Push, And Record Evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-kda-timeline-label-helper.md`
- Modify outside git: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/kda-timeline-label-local npm run smoke:report:readonly
node -e 'const fs=require("fs"); const q=JSON.parse(fs.readFileSync("test-artifacts/tmp/kda-timeline-label-local/qa-summary.json","utf8")); const r=q.latestRun; console.log(JSON.stringify({status:r.status, exitCode:r.exitCode, shortSha:r.git?.shortSha, dirty:r.git?.dirty, smokeSummary:r.smokeSummary, requiredCheckSummary:r.requiredCheckSummary, reportDir:r.reportDir}, null, 2));'
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/kda-timeline-label-local
```

Expected: `npm test`, `git diff --check`, and smoke pass; sensitive scan has no matches.

Observed 2026-06-09 18:26 KST: `npm test` reported `2459 passed, 0 failed across 112 test file(s)`. `git diff --check` passed. `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/kda-timeline-label-local npm run smoke:report:readonly` passed with smoke `156 passed, 0 failed` and required checks `13 passed, 0 failed, 0 missing`; local smoke artifact shortSha was `d611b6b` with `dirty: true` because implementation changes were intentionally uncommitted. Sensitive pattern scan over `test-artifacts/tmp/kda-timeline-label-local` had no matches.

- [x] **Step 2: Run browser QA**

Open `http://127.0.0.1:8123/?qa=kda-timeline-label`, click `저장 샘플 열기`, switch to `타임라인`, and inspect `.kda-evt` rows. Confirm Korean labels are visible, raw known event tokens are absent in scoped KDA rows, and console warn/error count is 0.

Observed 2026-06-09 18:28 KST: Browser QA on `http://127.0.0.1:8123/?qa=kda-timeline-label` passed. Stored sample opened, `타임라인` tab became active, `.kda-evt` row count was 11, row types included `어시스트`, `데스`, and `킬`, assist rows used `kda-evt--assist`, scoped KDA text/HTML raw token checks for `CHAMPION_KILL`, `PLAYER_DEATH`, `TEAMFIGHT_FOLLOWUP`, `SKIRMISH_WIN`, and `OBJECTIVE_SETUP_WIN` were empty, and console warn/error count was 0.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js styles.css test-artifacts/main/kda-timeline-label-tests.mjs docs/superpowers/plans/2026-06-09-kda-timeline-label-helper.md
git commit -m "test: reuse kda timeline labels"
git push origin main
```

Observed 2026-06-09 18:28 KST: implementation commit `e496e6f test: reuse kda timeline labels` was pushed to `origin/main`.

- [x] **Step 4: Verify GitHub QA artifact**

Run `gh run list`, watch the latest `main` run for the pushed commit, download `qa-automation-<run-id>`, inspect `qa-summary.json`, and run the same sensitive scan on the artifact directory.

Observed 2026-06-09 18:29 KST: GitHub Actions QA run `27196887900` for `e496e6f` passed. Artifact `7503734125` (`qa-automation-27196887900`, 3549 bytes) downloaded successfully. `qa-summary.json` reported `status: "passed"`, `exitCode: 0`, `latestRun.git.shortSha: "e496e6f"`, `dirty: false`, smoke `156 passed / 0 failed`, required checks `13 passed / 0 failed / 0 missing`, artifact integrity `passed`, and QA verdict `passed`. Sensitive pattern scan over `test-artifacts/tmp/github-qa-27196887900` had no matches.

- [x] **Step 5: Record Obsidian evidence and finalize plan**

Append a KDA timeline label helper entry to `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with RED/GREEN/full QA, browser QA, implementation commit, GitHub run/artifact, sensitive scan, and final sync evidence. Then mark completed plan steps in this file, commit with:

```bash
git add docs/superpowers/plans/2026-06-09-kda-timeline-label-helper.md
git commit -m "docs: finalize kda timeline label plan"
git push origin main
```

Observed 2026-06-09 18:30 KST: Obsidian project log was updated with RED/GREEN/full QA, browser QA, implementation commit, GitHub run/artifact, and sensitive scan evidence. This repository plan finalization is committed separately so the final docs-only GitHub QA run can be recorded in Obsidian without creating another documentation loop.

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

- Spec coverage: the plan covers helper extraction, safe rendering, styling fallback, focused regression tests, full local QA, browser QA, GitHub QA, Obsidian evidence, and final sync.
- Placeholder scan: no deferred implementation markers remain; commands and file paths are explicit.
- Type consistency: helper names are consistent across tests, implementation snippets, and verification steps.
