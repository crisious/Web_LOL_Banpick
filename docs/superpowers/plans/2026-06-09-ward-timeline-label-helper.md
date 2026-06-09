# Ward Timeline Label Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ward timeline event chips render safe Korean labels for ward actions and ward types without leaking raw enum or unsafe sample text.

**Architecture:** Add small display helpers near the existing frontend label helpers: `wardTypeLabel(type)`, `wardActionLabel(action)`, and `wardActionClass(action)`. Keep stored sample enum values unchanged for data logic, but use helpers plus `escapeHtml()` / `escapeAttr()` at the render boundary in `renderWardTimeline()`. Add a neutral chip style for unknown action fallback.

**Tech Stack:** Vanilla JavaScript frontend, CSS, Node.js source/runtime regression tests in `test-artifacts/main`, existing read-only smoke report and GitHub QA workflow.

---

### Task 1: Add RED Coverage For Ward Timeline Labels

**Files:**
- Create: `test-artifacts/main/ward-timeline-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-ward-timeline-label-helper.md`

- [x] **Step 1: Add the failing regression test**

Create `test-artifacts/main/ward-timeline-label-tests.mjs`:

```js
// Ward timeline label regression tests.
//
// Ward timeline chips are user-facing, so raw ward/action enum values and
// unsafe supplemental sample text should not be interpolated directly.

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
const wardTypeLabelSrc = optionalFunctionSource(mainSrc, "wardTypeLabel", "function wardTypeLabel(type) { return type; }");
const wardActionLabelSrc = optionalFunctionSource(mainSrc, "wardActionLabel", "function wardActionLabel(action) { return action === \"PLACED\" ? \"설치\" : \"제거\"; }");
const wardActionClassSrc = optionalFunctionSource(mainSrc, "wardActionClass", "function wardActionClass(action) { return action === \"PLACED\" ? \"placed\" : \"killed\"; }");
const renderWardTimelineSrc = extractFunctionSource(mainSrc, "renderWardTimeline");

const { wardTypeLabel, wardActionLabel, wardActionClass, renderWardTimeline, dom } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${wardTypeLabelSrc}
${wardActionLabelSrc}
${wardActionClassSrc}
const dom = {
  wardSummary: { innerHTML: "" },
  wardEvents: { innerHTML: "" },
};
${renderWardTimelineSrc}
return { wardTypeLabel, wardActionLabel, wardActionClass, renderWardTimeline, dom };`,
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

check("wardTypeLabel YELLOW_TRINKET", wardTypeLabel("YELLOW_TRINKET"), "노랑 와드");
check("wardTypeLabel CONTROL_WARD", wardTypeLabel("CONTROL_WARD"), "컨트롤 와드");
check("wardTypeLabel BLUE_TRINKET", wardTypeLabel("BLUE_TRINKET"), "파랑 와드");
check("wardTypeLabel unknown fallback", wardTypeLabel("STEALTH_WARD"), "와드");
check("wardTypeLabel blank fallback", wardTypeLabel("   "), "와드");
check("wardTypeLabel null fallback", wardTypeLabel(null), "와드");
check("wardActionLabel PLACED", wardActionLabel("PLACED"), "설치");
check("wardActionLabel KILLED", wardActionLabel("KILLED"), "제거");
check("wardActionLabel unknown fallback", wardActionLabel("DENIED"), "와드 활동");
check("wardActionClass PLACED", wardActionClass("PLACED"), "placed");
check("wardActionClass KILLED", wardActionClass("KILLED"), "killed");
check("wardActionClass unknown fallback", wardActionClass("DENIED"), "unknown");

renderWardTimeline({
  normalized: {
    wardTimeline: {
      summary: {
        totalPlaced: 2,
        totalKilled: 1,
        controlWardsPlaced: 1,
        wardsPerMinute: 1.4,
        byPhase: { EARLY: 2, MID: 1, LATE: 0 },
      },
      events: [
        { action: "PLACED", timeLabel: "02:00", wardType: "YELLOW_TRINKET" },
        { action: "KILLED", timeLabel: "04:30", wardType: "CONTROL_WARD" },
        { action: "DENIED", timeLabel: "<unsafe>", wardType: "STEALTH_WARD<script>" },
      ],
    },
  },
});

checkTrue("renderWardTimeline renders placed Korean label", dom.wardEvents.innerHTML.includes("02:00 설치 노랑 와드"));
checkTrue("renderWardTimeline renders killed Korean label", dom.wardEvents.innerHTML.includes("04:30 제거 컨트롤 와드"));
checkTrue("renderWardTimeline renders unknown safe fallback", dom.wardEvents.innerHTML.includes("&lt;unsafe&gt; 와드 활동 와드"));
checkTrue("renderWardTimeline does not leak raw known ward enum", !dom.wardEvents.innerHTML.includes("YELLOW_TRINKET"));
checkTrue("renderWardTimeline does not leak raw unknown ward enum", !dom.wardEvents.innerHTML.includes("STEALTH_WARD"));
checkTrue("renderWardTimeline does not leak raw unknown action enum", !dom.wardEvents.innerHTML.includes("DENIED"));
checkTrue("renderWardTimeline escapes unsafe time labels", !dom.wardEvents.innerHTML.includes("<unsafe>"));
checkTrue("renderWardTimeline uses wardTypeLabel helper", renderWardTimelineSrc.includes("wardTypeLabel(e.wardType)"));
checkTrue("renderWardTimeline uses wardActionLabel helper", renderWardTimelineSrc.includes("wardActionLabel(e.action)"));
checkTrue("renderWardTimeline uses wardActionClass helper", renderWardTimelineSrc.includes("wardActionClass(e.action)"));
checkTrue("renderWardTimeline no longer defines inline wardLabel map", !renderWardTimelineSrc.includes("const wardLabel ="));
checkTrue("renderWardTimeline no longer falls back to raw wardType", !renderWardTimelineSrc.includes("|| e.wardType"));
checkTrue("unknown ward action chip has neutral style", stylesSrc.includes(".ward-event-chip--unknown"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/ward-timeline-label-tests.mjs
node test-artifacts/main/ward-timeline-label-tests.mjs
```

Observed: syntax passed; runtime failed as expected with `8 passed, 17 failed` because `wardTypeLabel()`, `wardActionLabel()`, and `wardActionClass()` do not exist yet, `renderWardTimeline()` still defines inline `wardLabel`, falls back to raw `e.wardType`, misclassifies unknown action as killed, does not escape time labels, and CSS has no unknown chip style.

### Task 2: Add Ward Timeline Display Helpers

**Files:**
- Modify: `main.js`
- Modify: `styles.css`

- [x] **Step 1: Add label helpers near other frontend label helpers**

Add after `roleLabel(role)`:

```js
function wardTypeLabel(wardType) {
  const key = String(wardType || "").trim();
  const labels = {
    YELLOW_TRINKET: "노랑 와드",
    CONTROL_WARD: "컨트롤 와드",
    SIGHT_WARD: "시야 와드",
    BLUE_TRINKET: "파랑 와드",
  };
  return labels[key] || "와드";
}

function wardActionLabel(action) {
  if (action === "PLACED") return "설치";
  if (action === "KILLED") return "제거";
  return "와드 활동";
}

function wardActionClass(action) {
  if (action === "PLACED") return "placed";
  if (action === "KILLED") return "killed";
  return "unknown";
}
```

- [x] **Step 2: Route `renderWardTimeline()` through helpers**

In `renderWardTimeline(sample)`, remove:

```js
const wardLabel = { YELLOW_TRINKET: "노랑 와드", CONTROL_WARD: "컨트롤 와드", SIGHT_WARD: "시야 와드", BLUE_TRINKET: "파랑 와드" };
```

Replace the chip markup in `ward.events.slice(0, 30).map((e) => ...)` with:

```js
      <span class="ward-event-chip ward-event-chip--${escapeAttr(wardActionClass(e.action))}">
        ${escapeHtml(e.timeLabel || "")} ${escapeHtml(wardActionLabel(e.action))} ${escapeHtml(wardTypeLabel(e.wardType))}
      </span>
```

- [x] **Step 3: Add neutral unknown action chip style**

In `styles.css`, add after `.ward-event-chip--killed`:

```css
.ward-event-chip--unknown {
  background: var(--surface-2);
  color: var(--muted);
}
```

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `main.js`
- Verify: `styles.css`
- Verify: `test-artifacts/main/ward-timeline-label-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check main.js
node --check test-artifacts/main/ward-timeline-label-tests.mjs
node test-artifacts/main/ward-timeline-label-tests.mjs
node test-artifacts/main/timeline-phase-label-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Observed: `node --check main.js` and the new test syntax check passed; focused runtime checks passed: ward timeline label `25 passed, 0 failed`, timeline phase label `9 passed, 0 failed`, demo mode UI `16 passed, 0 failed`.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/ward-timeline-label-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/ward-timeline-label-local
```

Observed: `npm test` passed with `2435 passed, 0 failed across 111 test file(s)`; `git diff --check` passed; read-only smoke report passed with `156 passed, 0 failed` and required checks `13 passed / 0 failed / 0 missing`; sensitive scan exited with no matches.

### Task 4: Commit, Push, GitHub QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-ward-timeline-label-helper.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add main.js styles.css test-artifacts/main/ward-timeline-label-tests.mjs docs/superpowers/plans/2026-06-09-ward-timeline-label-helper.md
git commit -m "test: reuse ward timeline labels"
git push origin main
```

Observed: committed and pushed `12f4e79 test: reuse ward timeline labels` to `main`.

- [x] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

Observed: GitHub QA run `27195895996` passed for `12f4e79`; artifact `7503305153` (`qa-automation-27195895996`) downloaded successfully; `qa-summary.json` reported `dirty: false`, smoke `156 passed / 0 failed`, required checks `13 passed / 0 failed / 0 missing`, artifact integrity `passed`, QA verdict `passed`; sensitive scan exited with no matches.

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

- Spec coverage: The plan covers ward type labels, ward action labels/classes, raw enum fallback removal, unsafe time label escaping, focused/full QA, GitHub artifact QA, and Obsidian logging.
- Placeholder scan: No placeholder or deferred implementation steps remain.
- Type consistency: `wardTypeLabel()`, `wardActionLabel()`, and `wardActionClass()` all accept raw sample enum strings and return display-safe strings used only at the render boundary.
