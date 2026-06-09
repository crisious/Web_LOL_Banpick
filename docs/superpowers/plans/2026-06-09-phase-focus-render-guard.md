# Phase Focus Render Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent phase summary cards from rendering `undefined`/`null` when stored analysis phase summaries do not provide an optional focus line.

**Architecture:** Add a small `phaseFocusText()` helper and extract each phase card into `renderPhaseCard(phase)`. `renderPhases(sample)` keeps choosing the same phase card data, but card rendering omits the focus paragraph when no nonblank focus text exists and escapes all card text through existing HTML helpers.

**Tech Stack:** Vanilla JS frontend, Node.js source-extracted test harness in `test-artifacts/main`, existing local smoke/GitHub QA flow.

---

### Task 1: Add RED Coverage For Optional Phase Focus

**Files:**
- Create: `test-artifacts/main/phase-focus-render-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-phase-focus-render-guard.md`

- [x] **Step 1: Add the failing frontend render test**

Create `test-artifacts/main/phase-focus-render-tests.mjs`:

```js
// Phase summary card render regression tests.
//
// Stored sample phase summaries currently contain `phase` and `summary`, but no
// optional `focus` field. The UI must not surface JavaScript placeholder text
// such as "undefined" or "null" in that case.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractConstSource(source, name) {
  const pattern = new RegExp(`const ${name} = \\\\{[\\\\s\\\\S]*?\\\\};`);
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
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const ratingLabelSrc = extractFunctionSource(mainSrc, "ratingLabel");
const phaseFocusTextSrc = extractFunctionSource(mainSrc, "phaseFocusText");
const renderPhaseCardSrc = extractFunctionSource(mainSrc, "renderPhaseCard");
const renderPhasesSrc = extractFunctionSource(mainSrc, "renderPhases");

const { phaseFocusText, renderPhaseCard } = new Function(
  `${htmlEscapeSrc}\n${escapeHtmlSrc}\n${escapeAttrSrc}\n${ratingLabelSrc}\n${phaseFocusTextSrc}\n${renderPhaseCardSrc}\nreturn { phaseFocusText, renderPhaseCard };`,
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

check("phaseFocusText trims focus text", phaseFocusText({ focus: "  주요 이벤트 3건  " }), "주요 이벤트 3건");
check("phaseFocusText blank focus is empty", phaseFocusText({ focus: "   " }), "");
check("phaseFocusText missing focus is empty", phaseFocusText({ summary: "초반 요약" }), "");
check("phaseFocusText null phase is empty", phaseFocusText(null), "");

const noFocusHtml = renderPhaseCard({
  phase: "EARLY",
  rating: "OK",
  summary: "초반 흐름은 안정적이었다.",
});
checkTrue("card without focus keeps summary", noFocusHtml.includes("초반 흐름은 안정적이었다."));
checkTrue("card without focus omits phase-focus paragraph", !noFocusHtml.includes("phase-focus"));
checkTrue("card without focus does not leak undefined", !noFocusHtml.includes("undefined"));
checkTrue("card without focus does not leak null", !noFocusHtml.includes("null"));

const focusHtml = renderPhaseCard({
  phase: "MID",
  rating: "GOOD",
  summary: "중반 교전 합류가 좋았다.",
  focus: "  주요 이벤트 5건  ",
});
checkTrue("card with focus renders trimmed focus", focusHtml.includes('<p class="phase-focus">주요 이벤트 5건</p>'));
checkTrue("card with focus keeps rating label", focusHtml.includes("좋음"));

const unsafeHtml = renderPhaseCard({
  phase: "LATE<script>",
  rating: 'BAD" data-x="1',
  summary: "후반 <위험> & 확인",
  focus: "다음 <체크>",
});
checkTrue("card escapes phase text", unsafeHtml.includes("LATE&lt;script&gt;"));
checkTrue("card escapes summary text", unsafeHtml.includes("후반 &lt;위험&gt; &amp; 확인"));
checkTrue("card escapes focus text", unsafeHtml.includes("다음 &lt;체크&gt;"));
checkTrue("card escapes rating attribute", unsafeHtml.includes('data-rating="BAD&quot; data-x=&quot;1"'));

checkTrue("renderPhases delegates card rendering", renderPhasesSrc.includes(".map(renderPhaseCard)"));
checkTrue("renderPhases no longer interpolates raw phase.focus", !renderPhasesSrc.includes("${phase.focus}"));
checkTrue("renderPhases no longer keeps inline phase-card markup", !renderPhasesSrc.includes('<article class="phase-card"'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/phase-focus-render-tests.mjs
node test-artifacts/main/phase-focus-render-tests.mjs
```

Expected: syntax passes; runtime fails with `function phaseFocusText not found`.

Result: `node --check test-artifacts/main/phase-focus-render-tests.mjs` passed. Runtime RED was confirmed with `Error: function phaseFocusText not found`.

### Task 2: Implement Safe Phase Card Rendering

**Files:**
- Modify: `main.js`

- [x] **Step 1: Add optional focus helper and card renderer**

Add these functions near `renderPhases(sample)` in `main.js`:

```js
function phaseFocusText(phase) {
  return String(phase?.focus ?? "").trim();
}

function renderPhaseCard(phase) {
  const focus = phaseFocusText(phase);
  const focusHtml = focus ? `
          <p class="phase-focus">${escapeHtml(focus)}</p>` : "";

  return `
        <article class="phase-card" data-rating="${escapeAttr(phase?.rating || "")}">
          <div class="phase-card__top">
            <span class="phase-tag">${escapeHtml(phase?.phase || "")}</span>
            <span class="phase-rating">${ratingLabel(phase?.rating)}</span>
          </div>
          <p class="phase-summary">${escapeHtml(phase?.summary || "")}</p>${focusHtml}
        </article>
      `;
}
```

- [x] **Step 2: Delegate `renderPhases()` card markup**

Replace the existing inline `dom.phaseGrid.innerHTML = phaseCards.map((phase) => ...).join("")` block with:

```js
  dom.phaseGrid.innerHTML = phaseCards.map(renderPhaseCard).join("");
```

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `main.js`
- Verify: `test-artifacts/main/phase-focus-render-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check main.js
node --check test-artifacts/main/phase-focus-render-tests.mjs
node test-artifacts/main/phase-focus-render-tests.mjs
node test-artifacts/main/teamfight-label-tests.mjs
node test-artifacts/main/combat-situation-label-tests.mjs
node test-artifacts/main/utils-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all focused frontend checks pass.

Result: `node --check main.js` and `node --check test-artifacts/main/phase-focus-render-tests.mjs` passed. Focused runtime checks passed: phase focus render `17 passed, 0 failed`, teamfight label `21 passed, 0 failed`, combat situation label `8 passed, 0 failed`, main utils `38 passed, 0 failed`, demo mode UI `16 passed, 0 failed`.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-focus-render-guard-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/phase-focus-render-guard-local
```

Expected: full suite and read-only smoke pass; sensitive scan exits with no matches.

Result: `npm test` passed with `2315 passed, 0 failed across 102 test file(s)`. `git diff --check` produced no output. Read-only smoke passed at `test-artifacts/tmp/phase-focus-render-guard-local/2026-06-09T06-58-13Z-readonly` with smoke `156 passed, 0 failed` and required checks `13 passed, 0 failed, 0 missing`; `qa-summary.json` recorded `dirty: true` as expected before commit. Sensitive scan over `test-artifacts/tmp/phase-focus-render-guard-local` returned no matches.

### Task 4: Commit, Push, GitHub QA, Browser QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-phase-focus-render-guard.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/phase-focus-render-tests.mjs docs/superpowers/plans/2026-06-09-phase-focus-render-guard.md
git commit -m "test: guard phase focus rendering"
git push origin main
```

Result: Implementation commit `4e2703a` (`test: guard phase focus rendering`) was pushed to `origin/main`.

- [x] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

Result: GitHub QA run `27189470281` passed for `4e2703a`. Artifact `qa-automation-27189470281` downloaded and `qa-summary.json` confirmed `status: passed`, `shortSha: 4e2703a`, `dirty: false`, smoke `156 passed, 0 failed`, required checks `13 passed, 0 failed, 0 missing`, artifact integrity `passed`, and QA verdict `passed/shareable`. Sensitive scan over `test-artifacts/tmp/github-qa-27189470281` returned no matches.

- [x] **Step 3: Run Browser QA**

Open the read-only local app at `http://127.0.0.1:8123/`, open stored sample `sample-kr-8242613150`, switch to the analysis tab, and inspect `.phase-card` elements. Confirm no `.phase-focus` paragraph is rendered for stored phase summaries without focus, no visible `undefined` / `null` text appears in the phase grid, and console warn/error logs are empty.

Result: Browser QA opened `http://127.0.0.1:8123/` in read-only mode, loaded stored `sample-kr-8242613150`, and inspected the selected `분석` tab. The phase grid rendered `cardCount: 3`, `focusNodeCount: 0`, `gridHasUndefined: false`, `gridHasNull: false`, and console warn/error logs were empty.

- [ ] **Step 4: Update Obsidian and final sync**

Record RED/GREEN/full QA, local smoke, GitHub run/artifact, Browser QA, sensitive scan, and final sync evidence in Obsidian. Then run:

```bash
rm -rf test-artifacts/tmp
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
git status --short --branch
```

Expected: `main...origin/main` is `0 0` and the working tree is clean.

### Self-Review

- Spec coverage: The observed `undefined` UI leak is covered by Task 1 direct render assertions, Task 2 implementation, and Task 4 Browser QA against the stored sample page where the bug appeared.
- Placeholder scan: No `TBD`, `TODO`, "implement later", or unresolved placeholder steps remain.
- Type consistency: `phaseFocusText(phase)` returns a string, `renderPhaseCard(phase)` returns HTML, and `renderPhases(sample)` delegates to `renderPhaseCard`.
