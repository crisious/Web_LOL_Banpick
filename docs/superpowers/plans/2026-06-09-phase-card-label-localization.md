# Phase Card Label Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent analysis phase cards from showing raw `EARLY` / `MID` / `LATE` enum values to users by rendering Korean phase labels with a safe fallback.

**Architecture:** Add a pure `gamePhaseLabel(phase)` helper in `main.js` near other frontend label helpers. Route `renderPhaseCard(phase)` through the helper so stored sample phase summaries display `초반`, `중반`, `후반`, or `구간` for unknown/blank/legacy values.

**Tech Stack:** Vanilla JS frontend, Node.js source-extracted test harness in `test-artifacts/main`, existing local smoke/GitHub QA flow.

---

### Task 1: Add RED Coverage For Phase Card Labels

**Files:**
- Create: `test-artifacts/main/phase-card-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-phase-card-label-localization.md`

- [x] **Step 1: Add the failing frontend label test**

Create `test-artifacts/main/phase-card-label-tests.mjs`:

```js
// Phase card label regression tests.
//
// The analysis tab is user-facing, so phase cards should display Korean labels
// instead of raw schema enum values such as EARLY/MID/LATE.

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
const gamePhaseLabelSrc = extractFunctionSource(mainSrc, "gamePhaseLabel");
const phaseFocusTextSrc = extractFunctionSource(mainSrc, "phaseFocusText");
const renderPhaseCardSrc = extractFunctionSource(mainSrc, "renderPhaseCard");

const { gamePhaseLabel, renderPhaseCard } = new Function(
  `${htmlEscapeSrc}\n${escapeHtmlSrc}\n${escapeAttrSrc}\n${ratingLabelSrc}\n${gamePhaseLabelSrc}\n${phaseFocusTextSrc}\n${renderPhaseCardSrc}\nreturn { gamePhaseLabel, renderPhaseCard };`,
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

check("EARLY phase label", gamePhaseLabel("EARLY"), "초반");
check("MID phase label", gamePhaseLabel("MID"), "중반");
check("LATE phase label", gamePhaseLabel("LATE"), "후반");
check("unknown phase uses safe fallback", gamePhaseLabel("LANING"), "구간");
check("blank phase uses safe fallback", gamePhaseLabel("   "), "구간");
check("null phase uses safe fallback", gamePhaseLabel(null), "구간");

const earlyHtml = renderPhaseCard({
  phase: "EARLY",
  rating: "OK",
  summary: "초반 흐름은 안정적이었다.",
});
checkTrue("phase card renders Korean EARLY label", earlyHtml.includes('<span class="phase-tag">초반</span>'));
checkTrue("phase card does not render raw EARLY tag", !earlyHtml.includes('<span class="phase-tag">EARLY</span>'));

const unknownHtml = renderPhaseCard({
  phase: "LANING",
  rating: "OK",
  summary: "알 수 없는 구간 데이터입니다.",
});
checkTrue("unknown phase card renders fallback label", unknownHtml.includes('<span class="phase-tag">구간</span>'));
checkTrue("unknown phase card does not leak raw phase", !unknownHtml.includes("LANING"));

checkTrue(
  "renderPhaseCard uses gamePhaseLabel helper",
  renderPhaseCardSrc.includes("gamePhaseLabel(phase?.phase)"),
);
checkTrue(
  "renderPhaseCard no longer interpolates raw phase tag",
  !renderPhaseCardSrc.includes("${escapeHtml(phase?.phase || \"\")}"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/phase-card-label-tests.mjs
node test-artifacts/main/phase-card-label-tests.mjs
```

Expected: syntax passes; runtime fails with `function gamePhaseLabel not found`.

Result: `node --check test-artifacts/main/phase-card-label-tests.mjs` passed. Runtime RED was confirmed with `Error: function gamePhaseLabel not found`.

### Task 2: Implement Shared Phase Label Helper

**Files:**
- Modify: `main.js`

- [x] **Step 1: Add `gamePhaseLabel()` near label helpers**

Add this helper near `ratingLabel()` in `main.js`:

```js
function gamePhaseLabel(phase) {
  if (phase === "EARLY") return "초반";
  if (phase === "MID") return "중반";
  if (phase === "LATE") return "후반";
  return "구간";
}
```

- [x] **Step 2: Route `renderPhaseCard()` phase tag through the helper**

Replace:

```js
<span class="phase-tag">${escapeHtml(phase?.phase || "")}</span>
```

with:

```js
<span class="phase-tag">${escapeHtml(gamePhaseLabel(phase?.phase))}</span>
```

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `main.js`
- Verify: `test-artifacts/main/phase-card-label-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check main.js
node --check test-artifacts/main/phase-card-label-tests.mjs
node test-artifacts/main/phase-card-label-tests.mjs
node test-artifacts/main/phase-focus-render-tests.mjs
node test-artifacts/main/teamfight-label-tests.mjs
node test-artifacts/main/combat-situation-label-tests.mjs
node test-artifacts/main/utils-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all focused frontend checks pass.

Result: `node --check main.js` and `node --check test-artifacts/main/phase-card-label-tests.mjs` passed. Focused runtime checks passed: phase card label `12 passed, 0 failed`, phase focus render `18 passed, 0 failed`, teamfight label `21 passed, 0 failed`, combat situation label `8 passed, 0 failed`, main utils `38 passed, 0 failed`, demo mode UI `16 passed, 0 failed`. `test-artifacts/main/phase-focus-render-tests.mjs` was updated to include the new `gamePhaseLabel()` dependency and to expect unsafe phase text to fall back to `구간`.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-card-label-localization-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/phase-card-label-localization-local
```

Expected: full suite and read-only smoke pass; sensitive scan exits with no matches.

Result: `npm test` passed with `2328 passed, 0 failed across 103 test file(s)`. `git diff --check` produced no output. Read-only smoke passed at `test-artifacts/tmp/phase-card-label-localization-local/2026-06-09T07-12-07Z-readonly` with smoke `156 passed, 0 failed` and required checks `13 passed, 0 failed, 0 missing`; `qa-summary.json` recorded `dirty: true` as expected before commit. Sensitive scan over `test-artifacts/tmp/phase-card-label-localization-local` returned no matches.

### Task 4: Commit, Push, GitHub QA, Browser QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-phase-card-label-localization.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/phase-card-label-tests.mjs docs/superpowers/plans/2026-06-09-phase-card-label-localization.md
git commit -m "test: localize phase card labels"
git push origin main
```

Result: Implementation commit `3beccb8` (`test: localize phase card labels`) was pushed to `origin/main`.

- [x] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

Result: GitHub QA run `27190116889` passed for `3beccb8`. Artifact `qa-automation-27190116889` downloaded and `qa-summary.json` confirmed `status: passed`, `shortSha: 3beccb8`, `dirty: false`, smoke `156 passed, 0 failed`, required checks `13 passed, 0 failed, 0 missing`, artifact integrity `passed`, and QA verdict `passed/shareable`. Sensitive scan over `test-artifacts/tmp/github-qa-27190116889` returned no matches.

- [x] **Step 3: Run Browser QA**

Open the read-only local app at `http://127.0.0.1:8123/`, open stored sample `sample-kr-8242613150`, switch to the analysis tab, and inspect `.phase-card .phase-tag` text. Confirm phase tags are `초반`, `중반`, `후반`, raw `EARLY` / `MID` / `LATE` tags are not visible in the phase grid, and console warn/error logs are empty.

Result: Browser QA opened `http://127.0.0.1:8123/` in read-only mode, loaded stored `sample-kr-8242613150`, and inspected the selected `분석` tab. The phase grid returned `tagCount: 3`, tags `["초반","중반","후반"]`, `rawVisibleTokens: []`, and console warn/error logs were empty.

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

- Spec coverage: The raw phase enum UI issue is covered by direct helper assertions, render output assertions, Browser QA against the stored sample where raw tags were observed, and local/GitHub smoke gates.
- Placeholder scan: No `TBD`, `TODO`, "implement later", or unresolved placeholder steps remain.
- Type consistency: `gamePhaseLabel(phase)` returns a string, `renderPhaseCard(phase)` calls it with `phase?.phase`, and Browser QA inspects the same `.phase-tag` surface.
