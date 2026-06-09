# Sample Metadata Label Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw stored sample metadata like `SUPPORT LOSS` with Korean role/result labels in user-facing sample, report, and status surfaces.

**Architecture:** Add pure frontend helpers `roleLabel(role)` and `sampleReportLabel(sample)` next to existing label helpers. Route stored sample chips, report cards, candidate identity tags, hero snapshot role, recent match rows, and status strings through these helpers while keeping raw enum values only in data attributes.

**Tech Stack:** Vanilla JS frontend, Node.js source-extracted tests in `test-artifacts/main`, existing local smoke/GitHub QA flow.

---

### Task 1: Add RED Coverage For Sample Metadata Labels

**Files:**
- Create: `test-artifacts/main/sample-metadata-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-sample-metadata-label-localization.md`

- [x] **Step 1: Add the failing frontend label test**

Create `test-artifacts/main/sample-metadata-label-tests.mjs`:

```js
// Stored sample metadata label regression tests.
//
// Stored sample labels contain schema-friendly tokens such as SUPPORT LOSS.
// User-facing cards should render Korean labels while keeping raw tokens only in
// data attributes where styling needs them.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

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

const resultLabelSrc = extractFunctionSource(mainSrc, "resultLabel");
const roleLabelSrc = extractFunctionSource(mainSrc, "roleLabel");
const parseReportMetaSrc = extractFunctionSource(mainSrc, "parseReportMeta");
const sampleReportLabelSrc = extractFunctionSource(mainSrc, "sampleReportLabel");
const candidateIdentityMetaMarkupSrc = extractFunctionSource(mainSrc, "candidateIdentityMetaMarkup");
const renderSampleSwitcherSrc = extractFunctionSource(mainSrc, "renderSampleSwitcher");
const renderHeroSrc = extractFunctionSource(mainSrc, "renderHero");
const renderCandidatesSrc = extractFunctionSource(mainSrc, "renderCandidates");
const buildTrendSnapshotSrc = extractFunctionSource(mainSrc, "buildTrendSnapshot");

const { resultLabel, roleLabel, sampleReportLabel } = new Function(
  `${resultLabelSrc}\n${roleLabelSrc}\n${parseReportMetaSrc}\n${sampleReportLabelSrc}\nreturn { resultLabel, roleLabel, sampleReportLabel };`,
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

check("roleLabel TOP", roleLabel("TOP"), "탑");
check("roleLabel JUNGLE", roleLabel("JUNGLE"), "정글");
check("roleLabel MID", roleLabel("MID"), "미드");
check("roleLabel ADC", roleLabel("ADC"), "원딜");
check("roleLabel SUPPORT", roleLabel("SUPPORT"), "서포터");
check("roleLabel unknown fallback", roleLabel("UTILITY"), "역할 미상");
check("roleLabel blank fallback", roleLabel("   "), "역할 미상");
check("roleLabel null fallback", roleLabel(null), "역할 미상");

check("resultLabel WIN", resultLabel("WIN"), "승리");
check("resultLabel LOSS", resultLabel("LOSS"), "패배");
check("resultLabel unknown fallback", resultLabel("REMAKE"), "결과 미상");
check("resultLabel blank fallback", resultLabel(""), "결과 미상");

const sample = {
  id: "sample-kr-8242613150",
  label: "sample-kr-8242613150 · SUPPORT LOSS",
};
check("sampleReportLabel localizes stored sample metadata",
  sampleReportLabel(sample),
  "sample-kr-8242613150 · 서포터 패배");
checkTrue("sampleReportLabel does not leak SUPPORT", !sampleReportLabel(sample).includes("SUPPORT"));
checkTrue("sampleReportLabel does not leak LOSS", !sampleReportLabel(sample).includes("LOSS"));

const unknownSample = {
  id: "sample-unknown",
  label: "sample-unknown · UTILITY REMAKE",
};
check("sampleReportLabel uses safe unknown fallbacks",
  sampleReportLabel(unknownSample),
  "sample-unknown · 역할 미상 결과 미상");

checkTrue(
  "candidateIdentityMetaMarkup localizes role tag",
  candidateIdentityMetaMarkupSrc.includes("roleLabel(role)"),
);
checkTrue(
  "renderSampleSwitcher uses sampleReportLabel for sample chip text",
  renderSampleSwitcherSrc.includes("sampleReportLabel(sample)"),
);
checkTrue(
  "renderSampleSwitcher localizes report role badge",
  renderSampleSwitcherSrc.includes("roleLabel(meta.role)"),
);
checkTrue(
  "renderHero localizes snapshot role",
  renderHeroSrc.includes("roleLabel(match.role)"),
);
checkTrue(
  "renderCandidates localizes match row role",
  renderCandidatesSrc.includes("roleLabel(match.role)"),
);
checkTrue(
  "buildTrendSnapshot localizes dominant role headline",
  buildTrendSnapshotSrc.includes("roleLabel(dominantRole)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/sample-metadata-label-tests.mjs
node test-artifacts/main/sample-metadata-label-tests.mjs
```

Expected: syntax passes; runtime fails with `function roleLabel not found`.

Result 2026-06-09: `node --check test-artifacts/main/sample-metadata-label-tests.mjs` passed, and `node test-artifacts/main/sample-metadata-label-tests.mjs` failed with `Error: function roleLabel not found`.

### Task 2: Implement Metadata Label Helpers And UI Routing

**Files:**
- Modify: `main.js`

- [x] **Step 1: Add `roleLabel()` and safer `resultLabel()`**

Replace the current `resultLabel(result)` with:

```js
function resultLabel(result) {
  if (result === "WIN") return "승리";
  if (result === "LOSS") return "패배";
  return "결과 미상";
}
```

Then add:

```js
function roleLabel(role) {
  const labels = {
    TOP: "탑",
    JUNGLE: "정글",
    MID: "미드",
    ADC: "원딜",
    SUPPORT: "서포터",
  };
  return labels[role] || "역할 미상";
}
```

- [x] **Step 2: Add `sampleReportLabel(sample)` after `parseReportMeta(sample)`**

Add:

```js
function sampleReportLabel(sample) {
  const rawLabel = String(sample?.label || sample?.id || "").trim();
  const base = (rawLabel.split("·")[0] || sample?.id || "").trim();
  const meta = parseReportMeta(sample || {});
  const detail = [roleLabel(meta.role), resultLabel(meta.result)].filter(Boolean).join(" ");
  return [base, detail].filter(Boolean).join(" · ");
}
```

- [x] **Step 3: Route visible role/sample labels through helpers**

Update these surfaces in `main.js`:

```js
tokens.push(`<span class="candidate-head__tag">${roleLabel(role)}</span>`);
```

```js
return compactInsightLabel(text).slice(0, 42) || sampleReportLabel(sample);
```

```js
const headline = `${playerAlias} · 리포트 ${samples.length}개 / ${wins}승 ${losses}패 / ${roleLabel(dominantRole)} 비중 ${dominantRoleCount}회`;
```

```js
<span>${sampleReportLabel(sample)}</span>
```

```js
<h4>${sampleReportLabel(sample)}</h4>
```

```js
<span class="report-badge">${roleLabel(meta.role)}</span>
```

```js
if (dom.snapshotRole) dom.snapshotRole.textContent = roleLabel(match.role);
```

```js
dom.fetchStatus.textContent = `${sampleId} 로드 완료 · ${[match.champion, roleLabel(match.role), match.result ? resultLabel(match.result) : "결과 미상"].filter(Boolean).join(" ")}`;
```

```js
<span class="match-row__role">${roleLabel(match.role)}</span>
```

```js
<span class="meta-label">${roleLabel(m.role)} ${masteryBadge}</span>
```

```js
dom.fetchStatus.textContent = `${state.currentSampleId || matchId} 로드 완료 · ${[match.champion, roleLabel(match.role), match.result ? resultLabel(match.result) : "결과 미상"].filter(Boolean).join(" ")}`;
```

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `main.js`
- Verify: `test-artifacts/main/sample-metadata-label-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check main.js
node --check test-artifacts/main/sample-metadata-label-tests.mjs
node test-artifacts/main/sample-metadata-label-tests.mjs
node test-artifacts/main/phase-card-label-tests.mjs
node test-artifacts/main/phase-focus-render-tests.mjs
node test-artifacts/main/teamfight-label-tests.mjs
node test-artifacts/main/combat-situation-label-tests.mjs
node test-artifacts/main/utils-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all focused frontend checks pass.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/sample-metadata-label-localization-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/sample-metadata-label-localization-local
```

Expected: full suite and read-only smoke pass; sensitive scan exits with no matches.

Result 2026-06-09:
- Focused checks passed: sample metadata labels 22/0, phase card labels 12/0, phase focus 18/0, teamfight labels 21/0, combat situation labels 8/0, utils 38/0, demo mode UI 16/0.
- `npm test`: 2350 passed, 0 failed across 104 test file(s).
- `git diff --check`: passed.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/sample-metadata-label-local npm run smoke:report:readonly`: passed, smoke 156/0, required checks 13/13.
- Sensitive scan over `test-artifacts/tmp/sample-metadata-label-local`: no matches.

### Task 4: Commit, Push, GitHub QA, Browser QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-sample-metadata-label-localization.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/sample-metadata-label-tests.mjs docs/superpowers/plans/2026-06-09-sample-metadata-label-localization.md
git commit -m "test: localize sample metadata labels"
git push origin main
```

- [ ] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

- [ ] **Step 3: Run Browser QA**

Open the read-only local app at `http://127.0.0.1:8123/`, open stored samples, and inspect the sample list/report cards. Confirm `서포터 패배` or `서포터 승리` appears, raw `SUPPORT LOSS` / `SUPPORT WIN` does not appear in visible sample metadata, and console warn/error logs are empty.

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

- Spec coverage: The raw `SUPPORT LOSS/WIN` sample metadata UI issue is covered by helper tests, source-shape routing assertions, Browser QA on the stored sample list/report cards, and local/GitHub smoke gates.
- Placeholder scan: No `TBD`, `TODO`, "implement later", or unresolved placeholder steps remain.
- Type consistency: `roleLabel(role)`, `resultLabel(result)`, `parseReportMeta(sample)`, and `sampleReportLabel(sample)` are all plain string helpers used by the named render surfaces.
