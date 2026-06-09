# Trend Report Label Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace remaining English trend/report UI labels such as `Trend Summary`, `Reports`, `CURRENT`, and `ARCHIVE` with Korean labels in visible frontend surfaces.

**Architecture:** Keep data attributes and internal state unchanged. Add a tiny display helper for report card state labels and replace static/dynamic visible labels in the trend panel and saved report strip.

**Tech Stack:** Vanilla JS frontend, static HTML, Node.js source/string regression tests in `test-artifacts/main`, existing local smoke/GitHub QA flow.

---

### Task 1: Add RED Coverage For Trend/Report Labels

**Files:**
- Create: `test-artifacts/main/trend-report-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-trend-report-label-localization.md`

- [x] **Step 1: Add the failing frontend label test**

Create `test-artifacts/main/trend-report-label-tests.mjs`:

```js
// Trend/report visible label regression tests.
//
// Trend and saved report surfaces are Korean-first UI. Internal state can keep
// English identifiers, but visible labels should not show report dashboard
// scaffolding such as Trend Summary, Reports, CURRENT, or ARCHIVE.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

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

const reportStateLabelSrc = extractFunctionSource(mainSrc, "reportStateLabel");
const buildTrendSnapshotSrc = extractFunctionSource(mainSrc, "buildTrendSnapshot");
const renderSampleSwitcherSrc = extractFunctionSource(mainSrc, "renderSampleSwitcher");

const { reportStateLabel } = new Function(`${reportStateLabelSrc}\nreturn { reportStateLabel };`)();

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

check("reportStateLabel current", reportStateLabel(true), "현재");
check("reportStateLabel archive", reportStateLabel(false), "보관");

checkTrue("trend stat label 리포트 exists", buildTrendSnapshotSrc.includes('label: "리포트"'));
checkTrue("trend stat label 전적 exists", buildTrendSnapshotSrc.includes('label: "전적"'));
checkTrue("trend stat label 주 역할 exists", buildTrendSnapshotSrc.includes('label: "주 역할"'));
checkTrue("trend stat label 현재 샘플 exists", buildTrendSnapshotSrc.includes('label: "현재 샘플"'));
checkTrue("trend stat label Reports removed", !buildTrendSnapshotSrc.includes('label: "Reports"'));
checkTrue("trend stat label Record removed", !buildTrendSnapshotSrc.includes('label: "Record"'));
checkTrue("trend stat label Main Role removed", !buildTrendSnapshotSrc.includes('label: "Main Role"'));
checkTrue("trend stat label Current removed", !buildTrendSnapshotSrc.includes('label: "Current"'));

checkTrue("renderSampleSwitcher uses reportStateLabel", renderSampleSwitcherSrc.includes("reportStateLabel(sample.id === state.currentSampleId)"));
checkTrue("renderSampleSwitcher visible CURRENT removed", !renderSampleSwitcherSrc.includes("? \"CURRENT\" : \"ARCHIVE\""));

checkTrue("static Trend Summary localized", indexSrc.includes('<span class="meta-label">누적 요약</span>'));
checkTrue("static Repeated Strengths localized", indexSrc.includes('<span class="meta-label">반복 강점</span>'));
checkTrue("static Repeated Weaknesses localized", indexSrc.includes('<span class="meta-label">반복 약점</span>'));
checkTrue("static Trend Summary removed", !indexSrc.includes(">Trend Summary<"));
checkTrue("static Repeated Strengths removed", !indexSrc.includes(">Repeated Strengths<"));
checkTrue("static Repeated Weaknesses removed", !indexSrc.includes(">Repeated Weaknesses<"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/trend-report-label-tests.mjs
node test-artifacts/main/trend-report-label-tests.mjs
```

Expected: syntax passes; runtime fails with `function reportStateLabel not found`.

Result 2026-06-09: `node --check test-artifacts/main/trend-report-label-tests.mjs` passed, and `node test-artifacts/main/trend-report-label-tests.mjs` failed with `Error: function reportStateLabel not found`.

### Task 2: Localize Trend/Report Labels

**Files:**
- Modify: `main.js`
- Modify: `index.html`

- [x] **Step 1: Add `reportStateLabel(isCurrent)`**

Add near other display label helpers in `main.js`:

```js
function reportStateLabel(isCurrent) {
  return isCurrent ? "현재" : "보관";
}
```

- [x] **Step 2: Localize trend stat labels**

In `buildTrendSnapshot()`, replace:

```js
{ label: "Reports", value: `${samples.length}개`, note: "저장된 리포트 수" },
{ label: "Record", value: `${wins}승 ${losses}패`, note: "저장 샘플 기준" },
{ label: "Main Role", value: roleLabel(dominantRole), note: `가장 많이 나온 포지션 ${dominantRoleCount}회` },
{ label: "Current", value: current?.id || "-", note: "현재 보고 있는 샘플" },
```

with:

```js
{ label: "리포트", value: `${samples.length}개`, note: "저장된 리포트 수" },
{ label: "전적", value: `${wins}승 ${losses}패`, note: "저장 샘플 기준" },
{ label: "주 역할", value: roleLabel(dominantRole), note: `가장 많이 나온 포지션 ${dominantRoleCount}회` },
{ label: "현재 샘플", value: current?.id || "-", note: "현재 보고 있는 샘플" },
```

- [x] **Step 3: Localize report card state text**

In `renderSampleSwitcher()`, replace:

```js
<span class="report-card__state">${sample.id === state.currentSampleId ? "CURRENT" : "ARCHIVE"}</span>
```

with:

```js
<span class="report-card__state">${reportStateLabel(sample.id === state.currentSampleId)}</span>
```

- [x] **Step 4: Localize static trend panel eyebrows**

In `index.html`, replace:

```html
<span class="meta-label">Trend Summary</span>
<span class="meta-label">Repeated Strengths</span>
<span class="meta-label">Repeated Weaknesses</span>
```

with:

```html
<span class="meta-label">누적 요약</span>
<span class="meta-label">반복 강점</span>
<span class="meta-label">반복 약점</span>
```

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `main.js`
- Verify: `index.html`
- Verify: `test-artifacts/main/trend-report-label-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check main.js
node --check test-artifacts/main/trend-report-label-tests.mjs
node test-artifacts/main/trend-report-label-tests.mjs
node test-artifacts/main/sample-metadata-label-tests.mjs
node test-artifacts/main/key-moment-phase-label-tests.mjs
node test-artifacts/main/phase-card-label-tests.mjs
node test-artifacts/main/utils-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all focused frontend checks pass.

Result 2026-06-09: Focused checks passed: trend/report labels 18/0, sample metadata label 22/0, key moment phase label 12/0, phase card label 12/0, main utils 38/0, demo mode UI 16/0.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/trend-report-label-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/trend-report-label-local
```

Expected: full suite and read-only smoke pass; sensitive scan exits with no matches.

Result 2026-06-09:
- `npm test`: 2380 passed, 0 failed across 106 test file(s).
- `git diff --check`: passed.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/trend-report-label-local npm run smoke:report:readonly`: passed, smoke 156/0, required checks 13/13.
- Sensitive scan over `test-artifacts/tmp/trend-report-label-local`: no matches.

### Task 4: Commit, Push, GitHub QA, Browser QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-trend-report-label-localization.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Commit and push implementation**

Run:

```bash
git add index.html main.js test-artifacts/main/trend-report-label-tests.mjs docs/superpowers/plans/2026-06-09-trend-report-label-localization.md
git commit -m "test: localize trend report labels"
git push origin main
```

- [ ] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

- [ ] **Step 3: Run Browser QA**

Open the read-only local app at `http://127.0.0.1:8123/`, open stored samples, inspect the trend tab and report cards. Confirm `누적 요약`, `반복 강점`, `반복 약점`, `리포트`, `전적`, `주 역할`, `현재 샘플`, `현재`, and `보관` appear, scoped raw visible label checks are empty, and console warn/error logs are empty.

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

- Spec coverage: The plan covers dynamic trend stats, dynamic report state labels, and static trend section eyebrows.
- Placeholder scan: No `TBD`, `TODO`, "implement later", or unresolved placeholder steps remain.
- Type consistency: `reportStateLabel(isCurrent)` receives a boolean and returns only visible Korean text.
