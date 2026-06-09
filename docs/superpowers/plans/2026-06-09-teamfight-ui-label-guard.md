# Teamfight UI Label Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep teamfight phase rows user-safe by mapping only known phase/outcome enum values to Korean labels and falling back to generic labels for unknown, blank, or legacy values.

**Architecture:** Extract the inline `renderTeamfightPhases()` phase/outcome mappings into two pure helpers in `main.js`. Add a source-extracted frontend unit test so invalid data cannot leak raw enum-like strings into visible phase rows, then verify local smoke and GitHub QA.

**Tech Stack:** Vanilla JS frontend, Node.js test harnesses, existing `test-artifacts/main` source extraction pattern, GitHub Actions QA.

---

### Task 1: Add RED Coverage For Safe Teamfight Labels

**Files:**
- Create: `test-artifacts/main/teamfight-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-teamfight-ui-label-guard.md`

- [x] **Step 1: Add the failing frontend helper test**

Create `test-artifacts/main/teamfight-label-tests.mjs`:

```js
// Teamfight phase/outcome chip label regression tests.

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

const teamfightPhaseLabelSrc = extractFunctionSource(mainSrc, "teamfightPhaseLabel");
const teamfightOutcomeLabelSrc = extractFunctionSource(mainSrc, "teamfightOutcomeLabel");
const renderTeamfightPhasesSrc = extractFunctionSource(mainSrc, "renderTeamfightPhases");
const { teamfightPhaseLabel, teamfightOutcomeLabel } = new Function(
  `${teamfightPhaseLabelSrc}\n${teamfightOutcomeLabelSrc}\nreturn { teamfightPhaseLabel, teamfightOutcomeLabel };`,
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

check("ENGAGE phase label", teamfightPhaseLabel("ENGAGE"), "진입");
check("TRADE phase label", teamfightPhaseLabel("TRADE"), "딜교환");
check("CLEANUP phase label", teamfightPhaseLabel("CLEANUP"), "정리");
check("unknown phase uses safe fallback", teamfightPhaseLabel("LANING"), "한타");
check("blank phase uses safe fallback", teamfightPhaseLabel("   "), "한타");
check("null phase uses safe fallback", teamfightPhaseLabel(null), "한타");
check("INITIATED_KILL outcome label", teamfightOutcomeLabel("INITIATED_KILL"), "선제 이니시");
check("CAUGHT_OUT outcome label", teamfightOutcomeLabel("CAUGHT_OUT"), "먼저 잘림");
check("TRADE_WON outcome label", teamfightOutcomeLabel("TRADE_WON"), "딜교환 우위");
check("TRADE_LOST outcome label", teamfightOutcomeLabel("TRADE_LOST"), "딜교환 손해");
check("TRADE_EVEN outcome label", teamfightOutcomeLabel("TRADE_EVEN"), "딜교환 비등");
check("CLOSED_OUT outcome label", teamfightOutcomeLabel("CLOSED_OUT"), "마무리 성공");
check("OVERCHASE_DEATH outcome label", teamfightOutcomeLabel("OVERCHASE_DEATH"), "추격사");
check("DIED_IN_FIGHT outcome label", teamfightOutcomeLabel("DIED_IN_FIGHT"), "교전 중 사망");
check("unknown outcome uses safe fallback", teamfightOutcomeLabel("UNKNOWN_OUTCOME"), "판단");
check("blank outcome uses safe fallback", teamfightOutcomeLabel("   "), "판단");
check("null outcome uses safe fallback", teamfightOutcomeLabel(null), "판단");
checkTrue(
  "renderTeamfightPhases uses shared teamfightPhaseLabel helper",
  renderTeamfightPhasesSrc.includes("teamfightPhaseLabel(p.phase)"),
);
checkTrue(
  "renderTeamfightPhases uses shared teamfightOutcomeLabel helper",
  renderTeamfightPhasesSrc.includes("teamfightOutcomeLabel(p.outcomeTag)"),
);
checkTrue(
  "renderTeamfightPhases no longer defines inline phaseLabel helper",
  !renderTeamfightPhasesSrc.includes("const phaseLabel ="),
);
checkTrue(
  "renderTeamfightPhases no longer defines inline tagLabel helper",
  !renderTeamfightPhasesSrc.includes("const tagLabel ="),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/teamfight-label-tests.mjs
node test-artifacts/main/teamfight-label-tests.mjs
```

Expected: syntax passes; runtime fails because `teamfightPhaseLabel` does not exist yet.

Result: `node --check test-artifacts/main/teamfight-label-tests.mjs` passed. Runtime RED was confirmed with `Error: function teamfightPhaseLabel not found`.

### Task 2: Implement Shared Teamfight Label Helpers

**Files:**
- Modify: `main.js`

- [x] **Step 1: Add helpers near frontend label helpers**

Add these functions near `combatSituationLabel()` in `main.js`:

```js
function teamfightPhaseLabel(phase) {
  if (phase === "ENGAGE") return "진입";
  if (phase === "TRADE") return "딜교환";
  if (phase === "CLEANUP") return "정리";
  return "한타";
}

function teamfightOutcomeLabel(outcomeTag) {
  const labels = {
    INITIATED_KILL: "선제 이니시",
    CAUGHT_OUT: "먼저 잘림",
    TRADE_WON: "딜교환 우위",
    TRADE_LOST: "딜교환 손해",
    TRADE_EVEN: "딜교환 비등",
    CLOSED_OUT: "마무리 성공",
    OVERCHASE_DEATH: "추격사",
    DIED_IN_FIGHT: "교전 중 사망",
  };
  return labels[outcomeTag] || "판단";
}
```

- [x] **Step 2: Route teamfight rendering through the helpers**

In `renderTeamfightPhases(sample)`, remove the inline `phaseLabel` and `tagLabel` constants and replace:

```js
<strong>${escapeHtml(phaseLabel(p.phase))}</strong>
<span class="tf-tag">${escapeHtml(tagLabel(p.outcomeTag))}</span>
```

with:

```js
<strong>${escapeHtml(teamfightPhaseLabel(p.phase))}</strong>
<span class="tf-tag">${escapeHtml(teamfightOutcomeLabel(p.outcomeTag))}</span>
```

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `main.js`
- Verify: `test-artifacts/main/teamfight-label-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check main.js
node --check test-artifacts/main/teamfight-label-tests.mjs
node test-artifacts/main/teamfight-label-tests.mjs
node test-artifacts/main/combat-situation-label-tests.mjs
node test-artifacts/main/utils-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all focused frontend checks pass.

Result: `node --check main.js` and `node --check test-artifacts/main/teamfight-label-tests.mjs` passed. Focused runtime checks passed: teamfight label `21 passed, 0 failed`, combat situation label `8 passed, 0 failed`, main utils `38 passed, 0 failed`, demo mode UI `16 passed, 0 failed`.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-ui-label-guard-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/teamfight-ui-label-guard-local
```

Expected: full suite and read-only smoke pass; sensitive scan exits with no matches.

Result: `npm test` passed with `2298 passed, 0 failed across 101 test file(s)`. `git diff --check` produced no output. Read-only smoke passed at `test-artifacts/tmp/teamfight-ui-label-guard-local/2026-06-09T06-44-26Z-readonly` with smoke `156 passed, 0 failed` and required checks `13 passed, 0 failed, 0 missing`; `qa-summary.json` recorded `dirty: true` as expected before commit. Sensitive scan over `test-artifacts/tmp/teamfight-ui-label-guard-local` returned no matches.

### Task 4: Commit, Push, GitHub QA, Browser QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-teamfight-ui-label-guard.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/teamfight-label-tests.mjs docs/superpowers/plans/2026-06-09-teamfight-ui-label-guard.md
git commit -m "test: guard teamfight labels"
git push origin main
```

- [ ] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

- [ ] **Step 3: Run Browser QA**

Open the read-only local app at `http://127.0.0.1:8123/`, open a stored sample, switch to the analysis tab, and inspect teamfight phase rows. Confirm localized phase/outcome labels are visible, raw enum strings are not visible in teamfight rows, and console warn/error logs are empty.

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

---

## Self-Review

- Spec coverage: The plan covers known phase/outcome mappings, safe fallback labels, renderer wiring, local QA, GitHub QA, Browser QA, and Obsidian logging.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: Helper names are consistently `teamfightPhaseLabel` and `teamfightOutcomeLabel`; fallback copy is consistently `한타` and `판단`.
