# Timeline Phase Label Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make timeline surfaces reuse `gamePhaseLabel()` so user-facing phase labels stay Korean and raw schema enums such as `EARLY` do not leak into objective timeline dividers.

**Architecture:** Keep schema enum tokens unchanged for logic and layout class selection. Route display-only phase names in `renderDualTimeline()`, `renderDualTimelineDetail()`, and `renderObjectiveTimeline()` through the existing `gamePhaseLabel(phase)` helper. Add one focused source/runtime regression test in `test-artifacts/main`.

**Tech Stack:** Vanilla JavaScript frontend, Node.js source/runtime regression tests, existing read-only smoke report and GitHub QA workflow.

---

### Task 1: Add RED Coverage For Timeline Phase Labels

**Files:**
- Create: `test-artifacts/main/timeline-phase-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-timeline-phase-label-helper.md`

- [x] **Step 1: Add the failing regression test**

Create `test-artifacts/main/timeline-phase-label-tests.mjs`:

```js
// Timeline phase label regression tests.
//
// Timeline UI should use the shared gamePhaseLabel() display helper. Raw schema
// enums such as EARLY/MID/LATE remain useful for logic, but should not be shown
// in objective timeline divider text.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

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

const htmlEscapeSrc = extractConstSource(mainSrc, "HTML_ESCAPE");
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const gamePhaseLabelSrc = extractFunctionSource(mainSrc, "gamePhaseLabel");
const renderDualTimelineSrc = extractFunctionSource(mainSrc, "renderDualTimeline");
const renderDualTimelineDetailSrc = extractFunctionSource(mainSrc, "renderDualTimelineDetail");
const renderObjectiveTimelineSrc = extractFunctionSource(mainSrc, "renderObjectiveTimeline");

const { renderObjectiveTimeline, dom } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${gamePhaseLabelSrc}
const dom = {
  objectiveSummary: { innerHTML: "" },
  objectiveTable: { innerHTML: "" },
};
${renderObjectiveTimelineSrc}
return { renderObjectiveTimeline, dom };`,
)();

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

renderObjectiveTimeline({
  normalized: {
    objectiveTimeline: [
      { type: "OBJECTIVE", team: "ALLY", phase: "EARLY", timeLabel: "05:00", label: "첫 드래곤", lane: "MID_LANE" },
      { type: "STRUCTURE", team: "ENEMY", phase: "MID", timeLabel: "18:00", label: "미드 1차", lane: "MID_LANE" },
    ],
  },
});

checkTrue("objective timeline renders Korean early divider", dom.objectiveTable.innerHTML.includes("초반"));
checkTrue("objective timeline renders Korean mid divider", dom.objectiveTable.innerHTML.includes("중반"));
checkTrue("objective timeline no longer shows raw EARLY divider token", !dom.objectiveTable.innerHTML.includes("(EARLY)"));
checkTrue("objective timeline no longer shows raw MID divider token", !dom.objectiveTable.innerHTML.includes("(MID)"));
checkTrue("renderObjectiveTimeline uses gamePhaseLabel for event phases", renderObjectiveTimelineSrc.includes("gamePhaseLabel(e.phase)"));
checkTrue("renderObjectiveTimeline no longer defines inline phaseLabel map", !renderObjectiveTimelineSrc.includes("const phaseLabel ="));
checkTrue("renderObjectiveTimeline no longer prints raw phase enum in divider", !renderObjectiveTimelineSrc.includes("(${e.phase})"));
checkTrue("renderDualTimeline uses gamePhaseLabel for phase bands", renderDualTimelineSrc.includes("gamePhaseLabel(p.phase)"));
checkTrue("renderDualTimelineDetail uses gamePhaseLabel for phase summary notes", renderDualTimelineDetailSrc.includes("gamePhaseLabel(ps.phase)"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/timeline-phase-label-tests.mjs
node test-artifacts/main/timeline-phase-label-tests.mjs
```

Observed: syntax passed; runtime failed as expected with `2 passed, 7 failed` because `renderObjectiveTimeline()` still rendered `초반 (EARLY)` / `중반 (MID)`, defined an inline phase label map, and `renderDualTimeline()` / `renderDualTimelineDetail()` still calculated display labels inline instead of calling `gamePhaseLabel()`.

### Task 2: Route Timeline Phase Labels Through `gamePhaseLabel()`

**Files:**
- Modify: `main.js`

- [x] **Step 1: Update dual timeline phase bands**

In `renderDualTimeline()`, replace the inline label ternary:

```js
const label = p.phase === "EARLY" ? "\uCD08\uBC18" : p.phase === "MID" ? "\uC911\uBC18" : "\uD6C4\uBC18";
```

with:

```js
const label = gamePhaseLabel(p.phase);
```

Keep `phaseClass` unchanged because it is layout logic.

- [x] **Step 2: Update dual timeline detail phase note**

In `renderDualTimelineDetail()`, replace:

```js
const phaseLabel = ps.phase === "EARLY" ? "\uCD08\uBC18" : ps.phase === "MID" ? "\uC911\uBC18" : "\uD6C4\uBC18";
```

with:

```js
const phaseLabel = gamePhaseLabel(ps.phase);
```

Keep `phaseStart` / `phaseEnd` enum logic unchanged.

- [x] **Step 3: Update objective timeline display labels**

In `renderObjectiveTimeline()`, remove:

```js
const phaseLabel = { EARLY: "초반", MID: "중반", LATE: "후반" };
```

Inside the `timeline.map((e) => { ... })` callback, add:

```js
const phaseName = gamePhaseLabel(e.phase);
```

Replace the phase divider and phase cell with:

```js
const phaseDivider = e.phase !== lastPhase ? `<tr class="obj-phase-divider"><td colspan="6">${escapeHtml(phaseName)}</td></tr>` : "";
```

and:

```js
<td>${escapeHtml(phaseName)}</td>
```

Do not render `(${e.phase})` in user-facing divider text.

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `main.js`
- Verify: `test-artifacts/main/timeline-phase-label-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check main.js
node --check test-artifacts/main/timeline-phase-label-tests.mjs
node test-artifacts/main/timeline-phase-label-tests.mjs
node test-artifacts/main/phase-card-label-tests.mjs
node test-artifacts/main/key-moment-phase-label-tests.mjs
node test-artifacts/main/teamfight-label-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Observed: `node --check main.js` and the new test syntax check passed; focused runtime checks passed: timeline phase label `9 passed, 0 failed`, phase card label `12 passed, 0 failed`, key moment phase label `12 passed, 0 failed`, teamfight label `21 passed, 0 failed`, demo mode UI `16 passed, 0 failed`.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/timeline-phase-label-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/timeline-phase-label-local
```

Observed: `npm test` passed with `2410 passed, 0 failed across 110 test file(s)`; `git diff --check` passed; read-only smoke report passed with `156 passed, 0 failed` and required checks `13 passed / 0 failed / 0 missing`; sensitive scan exited with no matches.

### Task 4: Commit, Push, GitHub QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-timeline-phase-label-helper.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/timeline-phase-label-tests.mjs docs/superpowers/plans/2026-06-09-timeline-phase-label-helper.md
git commit -m "test: reuse timeline phase labels"
git push origin main
```

Observed: committed and pushed `541f91c test: reuse timeline phase labels` to `main`.

- [x] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

Observed: GitHub QA run `27195203494` passed for `541f91c`; artifact `7503013319` (`qa-automation-27195203494`) downloaded successfully; `qa-summary.json` reported `dirty: false`, smoke `156 passed / 0 failed`, required checks `13 passed / 0 failed / 0 missing`, artifact integrity `passed`, QA verdict `passed`; sensitive scan exited with no matches.

- [ ] **Step 3: Update Obsidian and final sync**

Record RED/GREEN/full QA, local smoke, GitHub run/artifact, sensitive scan, and final sync evidence in Obsidian. Then run:

```bash
rm -rf test-artifacts/tmp
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
git status --short --branch
```

Expected: `main...origin/main` is `0 0` and the working tree is clean.

### Self-Review

- Spec coverage: The plan covers objective timeline visible raw phase removal plus dual timeline helper reuse.
- Placeholder scan: No placeholder or deferred implementation steps remain.
- Type consistency: `gamePhaseLabel(phase)` continues to return display text, while enum tokens remain available for logic, class selection, and phase range calculation.
