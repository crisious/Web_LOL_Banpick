# Objective Timeline Label Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make objective timeline rows render safe Korean labels for type, lane, and team while escaping row text and attributes.

**Architecture:** Add small frontend display helpers near the existing label helpers: `objectiveTypeLabel()`, `objectiveTypeIcon()`, `objectiveLaneLabel()`, `objectiveTeamLabel()`, `objectiveTeamClass()`, and `objectiveTeamKey()`. Keep stored sample enum values unchanged for summary counting and analysis logic, but route `renderObjectiveTimeline()` row text, CSS class, and `data-team` attribute through helpers plus `escapeHtml()` / `escapeAttr()`. Add neutral styling for unknown teams.

**Tech Stack:** Vanilla JavaScript frontend, CSS, Node.js source/runtime regression tests in `test-artifacts/main`, existing read-only smoke report and GitHub QA workflow.

---

### Task 1: Add RED Coverage For Objective Timeline Labels

**Files:**
- Create: `test-artifacts/main/objective-timeline-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-objective-timeline-label-helper.md`

- [x] **Step 1: Add the failing regression test**

Create `test-artifacts/main/objective-timeline-label-tests.mjs`:

```js
// Objective timeline label regression tests.
//
// Objective rows are user-facing, so raw team/lane/type enum values and unsafe
// sample text should not be interpolated directly.

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
const gamePhaseLabelSrc = extractFunctionSource(mainSrc, "gamePhaseLabel");
const objectiveTypeLabelSrc = optionalFunctionSource(mainSrc, "objectiveTypeLabel", "function objectiveTypeLabel(type) { return type === \"STRUCTURE\" ? \"구조물\" : \"오브젝트\"; }");
const objectiveTypeIconSrc = optionalFunctionSource(mainSrc, "objectiveTypeIcon", "function objectiveTypeIcon(type) { return type === \"STRUCTURE\" ? \"🏛\" : \"🐉\"; }");
const objectiveLaneLabelSrc = optionalFunctionSource(mainSrc, "objectiveLaneLabel", "function objectiveLaneLabel(lane) { const labels = { TOP_LANE: \"탑\", MID_LANE: \"미드\", BOT_LANE: \"봇\" }; return labels[lane] || lane || \"—\"; }");
const objectiveTeamLabelSrc = optionalFunctionSource(mainSrc, "objectiveTeamLabel", "function objectiveTeamLabel(team) { return team === \"ALLY\" ? \"아군\" : \"적\"; }");
const objectiveTeamClassSrc = optionalFunctionSource(mainSrc, "objectiveTeamClass", "function objectiveTeamClass(team) { return team === \"ALLY\" ? \"ally\" : \"enemy\"; }");
const objectiveTeamKeySrc = optionalFunctionSource(mainSrc, "objectiveTeamKey", "function objectiveTeamKey(team) { return team || \"\"; }");
const renderObjectiveTimelineSrc = extractFunctionSource(mainSrc, "renderObjectiveTimeline");

const { objectiveTypeLabel, objectiveTypeIcon, objectiveLaneLabel, objectiveTeamLabel, objectiveTeamClass, objectiveTeamKey, renderObjectiveTimeline, dom } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${gamePhaseLabelSrc}
${objectiveTypeLabelSrc}
${objectiveTypeIconSrc}
${objectiveLaneLabelSrc}
${objectiveTeamLabelSrc}
${objectiveTeamClassSrc}
${objectiveTeamKeySrc}
const dom = {
  objectiveSummary: { innerHTML: "" },
  objectiveTable: { innerHTML: "" },
};
${renderObjectiveTimelineSrc}
return { objectiveTypeLabel, objectiveTypeIcon, objectiveLaneLabel, objectiveTeamLabel, objectiveTeamClass, objectiveTeamKey, renderObjectiveTimeline, dom };`,
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

check("objectiveTypeLabel objective", objectiveTypeLabel("OBJECTIVE"), "오브젝트");
check("objectiveTypeLabel structure", objectiveTypeLabel("STRUCTURE"), "구조물");
check("objectiveTypeLabel unknown fallback", objectiveTypeLabel("VOIDGRUB<script>"), "이벤트");
check("objectiveTypeIcon objective", objectiveTypeIcon("OBJECTIVE"), "🐉");
check("objectiveTypeIcon structure", objectiveTypeIcon("STRUCTURE"), "🏛");
check("objectiveTypeIcon unknown fallback", objectiveTypeIcon("VOIDGRUB<script>"), "•");
check("objectiveLaneLabel mid", objectiveLaneLabel("MID_LANE"), "미드");
check("objectiveLaneLabel unknown fallback", objectiveLaneLabel("JUNGLE<script>"), "위치 미상");
check("objectiveLaneLabel blank fallback", objectiveLaneLabel("   "), "위치 미상");
check("objectiveTeamLabel ally", objectiveTeamLabel("ALLY"), "아군");
check("objectiveTeamLabel enemy", objectiveTeamLabel("ENEMY"), "적");
check("objectiveTeamLabel unknown fallback", objectiveTeamLabel("RIVER<script>"), "팀 미상");
check("objectiveTeamClass ally", objectiveTeamClass("ALLY"), "ally");
check("objectiveTeamClass enemy", objectiveTeamClass("ENEMY"), "enemy");
check("objectiveTeamClass unknown fallback", objectiveTeamClass("RIVER<script>"), "unknown");
check("objectiveTeamKey ally", objectiveTeamKey("ALLY"), "ALLY");
check("objectiveTeamKey enemy", objectiveTeamKey("ENEMY"), "ENEMY");
check("objectiveTeamKey unknown fallback", objectiveTeamKey("RIVER<script>"), "UNKNOWN");

renderObjectiveTimeline({
  normalized: {
    objectiveTimeline: [
      { type: "OBJECTIVE", team: "ALLY", phase: "EARLY", timeLabel: "05:00", label: "첫 드래곤", lane: "MID_LANE" },
      { type: "VOIDGRUB<script>", team: "RIVER<script>", phase: "MID", timeLabel: "<unsafe>", label: "<img src=x onerror=alert(1)>", lane: "JUNGLE<script>" },
    ],
  },
});

checkTrue("renderObjectiveTimeline renders objective Korean labels", dom.objectiveTable.innerHTML.includes("🐉 오브젝트"));
checkTrue("renderObjectiveTimeline renders known lane label", dom.objectiveTable.innerHTML.includes("<td>미드</td>"));
checkTrue("renderObjectiveTimeline renders known team label", dom.objectiveTable.innerHTML.includes('data-team="ALLY">아군</td>'));
checkTrue("renderObjectiveTimeline renders unknown type fallback", dom.objectiveTable.innerHTML.includes("• 이벤트"));
checkTrue("renderObjectiveTimeline renders unknown lane fallback", dom.objectiveTable.innerHTML.includes("<td>위치 미상</td>"));
checkTrue("renderObjectiveTimeline renders unknown team fallback", dom.objectiveTable.innerHTML.includes('data-team="UNKNOWN">팀 미상</td>'));
checkTrue("renderObjectiveTimeline uses unknown team row class", dom.objectiveTable.innerHTML.includes('class="obj-row--unknown"'));
checkTrue("renderObjectiveTimeline escapes unsafe time labels", dom.objectiveTable.innerHTML.includes("&lt;unsafe&gt;"));
checkTrue("renderObjectiveTimeline escapes unsafe detail labels", dom.objectiveTable.innerHTML.includes("&lt;img src=x onerror=alert(1)&gt;"));
checkTrue("renderObjectiveTimeline does not interpolate unsafe detail labels", !dom.objectiveTable.innerHTML.includes("<img src=x"));
checkTrue("renderObjectiveTimeline does not leak raw unknown type", !dom.objectiveTable.innerHTML.includes("VOIDGRUB"));
checkTrue("renderObjectiveTimeline does not leak raw unknown lane", !dom.objectiveTable.innerHTML.includes("JUNGLE"));
checkTrue("renderObjectiveTimeline does not leak raw unknown team", !dom.objectiveTable.innerHTML.includes("RIVER"));
checkTrue("renderObjectiveTimeline uses objectiveTypeLabel helper", renderObjectiveTimelineSrc.includes("objectiveTypeLabel(e.type)"));
checkTrue("renderObjectiveTimeline uses objectiveLaneLabel helper", renderObjectiveTimelineSrc.includes("objectiveLaneLabel(e.lane)"));
checkTrue("renderObjectiveTimeline uses objectiveTeamLabel helper", renderObjectiveTimelineSrc.includes("objectiveTeamLabel(e.team)"));
checkTrue("renderObjectiveTimeline uses objectiveTeamClass helper", renderObjectiveTimelineSrc.includes("objectiveTeamClass(e.team)"));
checkTrue("renderObjectiveTimeline uses objectiveTeamKey helper", renderObjectiveTimelineSrc.includes("objectiveTeamKey(e.team)"));
checkTrue("renderObjectiveTimeline no longer defines inline laneLabel map", !renderObjectiveTimelineSrc.includes("const laneLabel ="));
checkTrue("renderObjectiveTimeline no longer writes raw data-team", !renderObjectiveTimelineSrc.includes('data-team="${e.team}"'));
checkTrue("unknown objective row has neutral style", stylesSrc.includes(".obj-row--unknown"));
checkTrue("unknown objective team cell has neutral style", stylesSrc.includes('.obj-team-cell[data-team="UNKNOWN"]'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/objective-timeline-label-tests.mjs
node test-artifacts/main/objective-timeline-label-tests.mjs
```

Expected: syntax passes; runtime fails because objective display helpers do not exist yet, `renderObjectiveTimeline()` still defines an inline lane map, falls back to raw lane/team/type values, writes raw `data-team`, and interpolates unsafe row text directly.

Observed 2026-06-09 18:36 KST: syntax passed; runtime failed as expected with `15 passed, 25 failed`, covering unknown type/lane/team fallback, unsafe row text, raw `data-team`, inline lane map, and neutral style gaps.

### Task 2: Add Objective Timeline Display Helpers

**Files:**
- Modify: `main.js`
- Modify: `styles.css`

- [x] **Step 1: Add objective label helpers near other frontend label helpers**

Add after `kdaEventTypeClass(eventType)`:

```js
function objectiveTypeLabel(type) {
  if (type === "OBJECTIVE") return "오브젝트";
  if (type === "STRUCTURE") return "구조물";
  return "이벤트";
}

function objectiveTypeIcon(type) {
  if (type === "OBJECTIVE") return "🐉";
  if (type === "STRUCTURE") return "🏛";
  return "•";
}

function objectiveLaneLabel(lane) {
  const key = String(lane || "").trim();
  const labels = {
    TOP_LANE: "탑",
    MID_LANE: "미드",
    BOT_LANE: "봇",
  };
  return labels[key] || "위치 미상";
}

function objectiveTeamLabel(team) {
  if (team === "ALLY") return "아군";
  if (team === "ENEMY") return "적";
  return "팀 미상";
}

function objectiveTeamClass(team) {
  if (team === "ALLY") return "ally";
  if (team === "ENEMY") return "enemy";
  return "unknown";
}

function objectiveTeamKey(team) {
  if (team === "ALLY") return "ALLY";
  if (team === "ENEMY") return "ENEMY";
  return "UNKNOWN";
}
```

- [x] **Step 2: Route `renderObjectiveTimeline()` rows through helpers and escaping**

Inside `renderObjectiveTimeline(sample)`, remove the inline `laneLabel` map and replace row-local display code with:

```js
    const teamClass = objectiveTeamClass(e.team);
    const teamText = objectiveTeamLabel(e.team);
    const teamKey = objectiveTeamKey(e.team);
    const typeLabel = objectiveTypeLabel(e.type);
    const typeIcon = objectiveTypeIcon(e.type);
    const laneText = objectiveLaneLabel(e.lane);
```

Replace the row markup with:

```js
      <tr class="obj-row--${escapeAttr(teamClass)}">
        <td>${escapeHtml(e.timeLabel || "")}</td>
        <td>${escapeHtml(phaseName)}</td>
        <td>${escapeHtml(typeIcon)} ${escapeHtml(typeLabel)}</td>
        <td>${escapeHtml(e.label || "")}</td>
        <td>${escapeHtml(laneText)}</td>
        <td class="obj-team-cell" data-team="${escapeAttr(teamKey)}">${escapeHtml(teamText)}</td>
      </tr>`;
```

- [x] **Step 3: Add neutral unknown objective styles**

In `styles.css`, add after `.obj-row--enemy`:

```css
.obj-row--unknown {
  background: var(--surface-2);
}
```

Add after the existing `.obj-team-cell[data-team="ENEMY"]` rule:

```css
.obj-team-cell[data-team="UNKNOWN"] { color: var(--muted); font-weight: 600; }
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
node --check main.js
node --check test-artifacts/main/objective-timeline-label-tests.mjs
node test-artifacts/main/objective-timeline-label-tests.mjs
node test-artifacts/main/timeline-phase-label-tests.mjs
node test-artifacts/main/kda-timeline-label-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all commands pass with `0 failed`.

Observed 2026-06-09 18:38 KST: `node --check main.js`, `node --check test-artifacts/main/objective-timeline-label-tests.mjs`, and `node --check test-artifacts/main/timeline-phase-label-tests.mjs` passed. Focused runtime tests passed: objective timeline label `40 passed, 0 failed`, timeline phase label `9 passed, 0 failed`, KDA timeline label `24 passed, 0 failed`, demo mode UI `16 passed, 0 failed`.

### Task 3: Run QA, Browser QA, Commit, Push, And Record Evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-objective-timeline-label-helper.md`
- Modify outside git: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-timeline-label-local npm run smoke:report:readonly
node -e 'const fs=require("fs"); const q=JSON.parse(fs.readFileSync("test-artifacts/tmp/objective-timeline-label-local/qa-summary.json","utf8")); const r=q.latestRun; console.log(JSON.stringify({status:r.status, exitCode:r.exitCode, shortSha:r.git?.shortSha, dirty:r.git?.dirty, smokeSummary:r.smokeSummary, requiredCheckSummary:r.requiredCheckSummary, reportDir:r.reportDir}, null, 2));'
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/objective-timeline-label-local
```

Expected: `npm test`, `git diff --check`, and smoke pass; sensitive scan has no matches.

Observed 2026-06-09 18:41 KST: `npm test` reported `2499 passed, 0 failed across 113 test file(s)`. `git diff --check` passed. `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/objective-timeline-label-local npm run smoke:report:readonly` passed with smoke `156 passed, 0 failed` and required checks `13 passed, 0 failed, 0 missing`; local smoke artifact shortSha was `48f9f37` with `dirty: true` because implementation changes were intentionally uncommitted. Sensitive pattern scan over `test-artifacts/tmp/objective-timeline-label-local` had no matches.

- [x] **Step 2: Run browser QA**

Open `http://127.0.0.1:8123/?qa=objective-timeline-label`, click `저장 샘플 열기`, switch to `타임라인`, and inspect `.obj-table` rows. Confirm Korean type/lane/team labels are visible, raw objective type/team/lane tokens are absent in scoped objective table text, and console warn/error count is 0.

Observed 2026-06-09 18:42 KST: Browser QA on `http://127.0.0.1:8123/?qa=objective-timeline-label` passed. Stored sample opened, `타임라인` tab became active, `.obj-table` row count was 20, visible rows included Korean type/lane/team labels such as `🐉 오브젝트`, `🏛 구조물`, `봇`, `미드`, `아군`, and `적`; scoped objective table visible-text raw token checks for `OBJECTIVE`, `STRUCTURE`, `TOP_LANE`, `MID_LANE`, `BOT_LANE`, `VOIDGRUB`, `RIVER`, and unsafe tags were empty. `data-team="ALLY/ENEMY"` remained only as non-visible style keys. Console warn/error count was 0.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js styles.css test-artifacts/main/objective-timeline-label-tests.mjs test-artifacts/main/timeline-phase-label-tests.mjs docs/superpowers/plans/2026-06-09-objective-timeline-label-helper.md
git commit -m "test: reuse objective timeline labels"
git push origin main
```

Observed 2026-06-09 18:43 KST: implementation commit `7948a55 test: reuse objective timeline labels` was pushed to `origin/main`.

- [x] **Step 4: Verify GitHub QA artifact**

Run `gh run list`, watch the latest `main` run for the pushed commit, download `qa-automation-<run-id>`, inspect `qa-summary.json`, and run the same sensitive scan on the artifact directory.

Observed 2026-06-09 18:44 KST: GitHub Actions QA run `27197660131` for `7948a55` passed. Artifact `7504056600` (`qa-automation-27197660131`, 3549 bytes, digest `sha256:66eb7d9825cbc12c038c8a0270b60fd2a0acedf3ec6ea824ed861b614bace2e7`) downloaded successfully. `qa-summary.json` reported `status: "passed"`, `exitCode: 0`, `latestRun.git.shortSha: "7948a55"`, `dirty: false`, smoke `156 passed / 0 failed`, required checks `13 passed / 0 failed / 0 missing`, artifact integrity `passed`, and QA verdict `passed`. Sensitive pattern scan over `test-artifacts/tmp/github-qa-27197660131` had no matches.

- [x] **Step 5: Record Obsidian evidence and finalize plan**

Append an objective timeline label helper entry to `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with RED/GREEN/full QA, browser QA, implementation commit, GitHub run/artifact, sensitive scan, and final sync evidence. Then mark completed plan steps in this file, commit with:

```bash
git add docs/superpowers/plans/2026-06-09-objective-timeline-label-helper.md
git commit -m "docs: finalize objective timeline label plan"
git push origin main
```

Observed 2026-06-09 18:45 KST: Obsidian project log was updated with RED/GREEN/full QA, browser QA, implementation commit, GitHub run/artifact, and sensitive scan evidence. This repository plan finalization is committed separately so the final docs-only GitHub QA run can be recorded in Obsidian without creating another documentation loop.

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

- Spec coverage: the plan covers helper extraction, safe row rendering, fallback styling, focused RED/GREEN tests, local QA, browser QA, GitHub QA, Obsidian evidence, and final sync.
- Placeholder scan: no deferred implementation markers remain; commands and file paths are explicit.
- Type consistency: helper names are consistent across tests, implementation snippets, and verification steps.
