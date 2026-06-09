# Combat Situation UI Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep combat analysis situation chips user-safe by mapping only known combat situation enum values to Korean labels and falling back to `교전` for unknown, blank, or legacy values.

**Architecture:** Extract the inline combat situation label mapping in `renderCombatAnalysis()` into a small pure helper in `main.js`. Add a source-extracted frontend unit test so invalid data cannot leak raw enum-like strings into the visible chip, then verify the existing read-only demo smoke path still passes.

**Tech Stack:** Vanilla JS frontend, Node.js test harnesses, existing `test-artifacts/main` source extraction pattern, GitHub Actions QA.

---

### Task 1: Add RED Coverage For Safe Combat Situation Labels

**Files:**
- Create: `test-artifacts/main/combat-situation-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-combat-situation-ui-label.md`

- [x] **Step 1: Add the failing frontend helper test**

Create `test-artifacts/main/combat-situation-label-tests.mjs`:

```js
// Combat situation chip label regression tests.

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

const combatSituationLabelSrc = extractFunctionSource(mainSrc, "combatSituationLabel");
const renderCombatAnalysisSrc = extractFunctionSource(mainSrc, "renderCombatAnalysis");
const { combatSituationLabel } = new Function(
  `${combatSituationLabelSrc}\nreturn { combatSituationLabel };`,
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

check("PLAYER_DOMINANT label", combatSituationLabel("PLAYER_DOMINANT"), "우세");
check("PLAYER_DOWN label", combatSituationLabel("PLAYER_DOWN"), "열세");
check("TRADED label", combatSituationLabel("TRADED"), "교환");
check("unknown situation uses safe fallback", combatSituationLabel("UNKNOWN"), "교전");
check("blank situation uses safe fallback", combatSituationLabel("   "), "교전");
check("null situation uses safe fallback", combatSituationLabel(null), "교전");
checkTrue(
  "renderCombatAnalysis uses shared combatSituationLabel helper",
  renderCombatAnalysisSrc.includes("combatSituationLabel(item.situation)"),
);
checkTrue(
  "renderCombatAnalysis no longer defines inline situationLabel helper",
  !renderCombatAnalysisSrc.includes("const situationLabel ="),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/combat-situation-label-tests.mjs
node test-artifacts/main/combat-situation-label-tests.mjs
```

Expected: syntax passes; runtime fails because `combatSituationLabel` does not exist yet.

Result: `node --check test-artifacts/main/combat-situation-label-tests.mjs` passed. Runtime RED was confirmed with `Error: function combatSituationLabel not found`.

### Task 2: Implement Shared Combat Situation Label Helper

**Files:**
- Modify: `main.js`

- [x] **Step 1: Add helper near the frontend label helpers**

Add this function near other top-level label helpers in `main.js`:

```js
function combatSituationLabel(situation) {
  if (situation === "PLAYER_DOMINANT") return "우세";
  if (situation === "PLAYER_DOWN") return "열세";
  if (situation === "TRADED") return "교환";
  return "교전";
}
```

- [x] **Step 2: Route combat rendering through the helper**

In `renderCombatAnalysis(sample)`, remove the inline `situationLabel` function and replace:

```js
const sit = situationLabel(item.situation);
```

with:

```js
const sit = combatSituationLabel(item.situation);
```

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `main.js`
- Verify: `test-artifacts/main/combat-situation-label-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check main.js
node --check test-artifacts/main/combat-situation-label-tests.mjs
node test-artifacts/main/combat-situation-label-tests.mjs
node test-artifacts/main/utils-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all focused frontend checks pass.

Result: `node --check main.js` and `node --check test-artifacts/main/combat-situation-label-tests.mjs` passed. Focused runtime checks passed: combat situation label `8 passed, 0 failed`, main utils `38 passed, 0 failed`, demo mode UI `16 passed, 0 failed`.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/combat-situation-ui-label-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/combat-situation-ui-label-local
```

Expected: full suite and read-only smoke pass; sensitive scan exits with no matches.

Result: `npm test` passed with `2277 passed, 0 failed across 100 test file(s)`. `git diff --check` passed with no output. Fresh read-only smoke passed with `156 passed, 0 failed` at `test-artifacts/tmp/combat-situation-ui-label-local/2026-06-09T06-28-50Z-readonly`; QA summary showed required checks `13 passed, 0 failed, 0 missing` and `dirty: true` because implementation files were intentionally uncommitted. Sensitive artifact scan returned no matches.

### Task 4: Commit, Push, GitHub QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-combat-situation-ui-label.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/combat-situation-label-tests.mjs docs/superpowers/plans/2026-06-09-combat-situation-ui-label.md
git commit -m "test: guard combat situation labels"
git push origin main
```

Result: Implementation commit `16e1c62 test: guard combat situation labels` was created on `main` and pushed to `origin/main`.

- [x] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

Result: GitHub QA run `27188213108` completed with conclusion `success` for `16e1c62be7a1827e5e637fe9840392f47b762146`. Artifact `qa-automation-27188213108` (`7500111805`) was downloaded and verified: `shortSha: 16e1c62`, `dirty: false`, smoke `156 passed, 0 failed`, required checks `13 passed, 0 failed, 0 missing`, artifact integrity `passed`, QA verdict `passed`. Sensitive artifact scan returned no matches.

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

---

## Self-Review

- Spec coverage: The plan covers the user-visible fallback label, known enum labels, renderer wiring, local QA, GitHub QA, and Obsidian logging.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: The helper name is consistently `combatSituationLabel`; the safe fallback copy is consistently `교전`.
