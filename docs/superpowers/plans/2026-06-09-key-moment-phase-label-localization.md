# Key Moment Phase Label Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw key moment and evidence phase tokens like `EARLY` and `MID` with Korean labels in user-facing frontend surfaces.

**Architecture:** Keep `keyMomentPhase(moment)` returning schema-friendly phase tokens for logic and fallback derivation. Reuse the existing `gamePhaseLabel(phase)` helper only at render/output boundaries: key moment cards and evidence phase notes.

**Tech Stack:** Vanilla JS frontend, Node.js source-extracted tests in `test-artifacts/main`, existing local smoke/GitHub QA flow.

---

### Task 1: Add RED Coverage For Key Moment Phase Labels

**Files:**
- Create: `test-artifacts/main/key-moment-phase-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-key-moment-phase-label-localization.md`

- [x] **Step 1: Add the failing frontend label test**

Create `test-artifacts/main/key-moment-phase-label-tests.mjs`:

```js
// Key moment phase label regression tests.
//
// Key moment phase values are schema enum tokens such as EARLY/MID/LATE.
// User-facing cards and evidence metadata should render Korean labels while
// keeping keyMomentPhase() useful for deriving normalized phase tokens.

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

const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const gamePhaseLabelSrc = extractFunctionSource(mainSrc, "gamePhaseLabel");
const keyMomentPhaseSrc = extractFunctionSource(mainSrc, "keyMomentPhase");
const evidenceMapSrc = extractFunctionSource(mainSrc, "evidenceMap");
const renderKeyMomentsSrc = extractFunctionSource(mainSrc, "renderKeyMoments");
const renderEvidenceSrc = extractFunctionSource(mainSrc, "renderEvidence");

const { gamePhaseLabel, keyMomentPhase, evidenceMap, renderKeyMoments, dom } = new Function(
  `${escapeHtmlSrc}
${gamePhaseLabelSrc}
${keyMomentPhaseSrc}
${evidenceMapSrc}
const dom = { keyMoments: { innerHTML: "" } };
${renderKeyMomentsSrc}
return { gamePhaseLabel, keyMomentPhase, evidenceMap, renderKeyMoments, dom };`,
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

check("keyMomentPhase keeps explicit enum for logic", keyMomentPhase({ phase: "EARLY" }), "EARLY");
check("keyMomentPhase derives MID enum from timestamp", keyMomentPhase({ timestampLabel: "22:08" }), "MID");
check("gamePhaseLabel EARLY", gamePhaseLabel("EARLY"), "초반");
check("gamePhaseLabel MID", gamePhaseLabel("MID"), "중반");
check("gamePhaseLabel LATE", gamePhaseLabel("LATE"), "후반");

renderKeyMoments({
  analysis: {
    keyMoments: [
      { timestamp: "4:46", phase: "EARLY", label: "초반 첫 데스", reason: "템포 손실", impact: "라인 주도권 상실" },
      { timestampLabel: "22:08", title: "바론 주도권 상실", description: "결정적 분기점", impact: "오브젝트 손실" },
    ],
  },
});

checkTrue("renderKeyMoments renders Korean EARLY label", dom.keyMoments.innerHTML.includes("<strong>초반</strong>"));
checkTrue("renderKeyMoments renders Korean derived MID label", dom.keyMoments.innerHTML.includes("<strong>중반</strong>"));
checkTrue("renderKeyMoments does not leak raw EARLY", !dom.keyMoments.innerHTML.includes("<strong>EARLY</strong>"));
checkTrue("renderKeyMoments does not leak raw MID", !dom.keyMoments.innerHTML.includes("<strong>MID</strong>"));
checkTrue(
  "renderKeyMoments uses gamePhaseLabel at display boundary",
  renderKeyMomentsSrc.includes("gamePhaseLabel(keyMomentPhase(moment))"),
);

const timelineMap = evidenceMap({
  normalized: {
    timelineEvents: [
      { eventId: "evt_early", timestampLabel: "4:46", eventType: "PLAYER_DEATH", summary: "초반 데스", phase: "EARLY" },
    ],
  },
});
check("evidenceMap localizes timeline phase statNote", timelineMap.get("evt_early").statNote, "초반 구간");
checkTrue(
  "renderEvidence localizes rule-based evidence phase statNote",
  renderEvidenceSrc.includes("gamePhaseLabel(entry.phase)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/key-moment-phase-label-tests.mjs
node test-artifacts/main/key-moment-phase-label-tests.mjs
```

Expected: syntax passes; runtime fails because `renderKeyMoments()` still renders `<strong>EARLY</strong>` / `<strong>MID</strong>` and `evidenceMap()` still returns `EARLY 구간`.

Result 2026-06-09: `node --check test-artifacts/main/key-moment-phase-label-tests.mjs` passed. `node test-artifacts/main/key-moment-phase-label-tests.mjs` failed with 5 passed / 7 failed: key moment Korean labels missing, raw `EARLY` / `MID` leaked, `evidenceMap()` returned `EARLY 구간`, and render source did not route through `gamePhaseLabel()`.

### Task 2: Localize Phase Labels At Render Boundaries

**Files:**
- Modify: `main.js`

- [x] **Step 1: Localize key moment phase badges**

In `renderKeyMoments(sample)`, replace:

```js
<strong>${escapeHtml(keyMomentPhase(moment))}</strong>
```

with:

```js
<strong>${escapeHtml(gamePhaseLabel(keyMomentPhase(moment)))}</strong>
```

- [x] **Step 2: Localize evidence timeline phase notes**

In `evidenceMap(sample)`, replace the `entry.phase` fallback:

```js
statNote: entry.laneHint ? `위치 ${entry.laneHint}` : entry.phase ? `${entry.phase} 구간` : "",
```

with:

```js
statNote: entry.laneHint ? `위치 ${entry.laneHint}` : entry.phase ? `${gamePhaseLabel(entry.phase)} 구간` : "",
```

- [x] **Step 3: Localize rule-based evidence phase notes**

In `renderEvidence(sample)`, replace:

```js
statNote: entry.statNote || (entry.phase ? `${entry.phase} 구간` : tl?.statNote || ""),
```

with:

```js
statNote: entry.statNote || (entry.phase ? `${gamePhaseLabel(entry.phase)} 구간` : tl?.statNote || ""),
```

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `main.js`
- Verify: `test-artifacts/main/key-moment-phase-label-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check main.js
node --check test-artifacts/main/key-moment-phase-label-tests.mjs
node test-artifacts/main/key-moment-phase-label-tests.mjs
node test-artifacts/main/phase-card-label-tests.mjs
node test-artifacts/main/phase-focus-render-tests.mjs
node test-artifacts/main/sample-metadata-label-tests.mjs
node test-artifacts/main/utils-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all focused frontend checks pass.

Result 2026-06-09: Focused checks passed: key moment phase label 12/0, phase card label 12/0, phase focus render 18/0, sample metadata label 22/0, utils 38/0, demo mode UI 16/0.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moment-phase-label-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/key-moment-phase-label-local
```

Expected: full suite and read-only smoke pass; sensitive scan exits with no matches.

Result 2026-06-09:
- `npm test`: 2362 passed, 0 failed across 105 test file(s).
- `git diff --check`: passed.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moment-phase-label-local npm run smoke:report:readonly`: passed, smoke 156/0, required checks 13/13.
- Sensitive scan over `test-artifacts/tmp/key-moment-phase-label-local`: no matches.

### Task 4: Commit, Push, GitHub QA, Browser QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-key-moment-phase-label-localization.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/key-moment-phase-label-tests.mjs docs/superpowers/plans/2026-06-09-key-moment-phase-label-localization.md
git commit -m "test: localize key moment phase labels"
git push origin main
```

- [x] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

Result 2026-06-09: Implementation commit `8a7d8cc` pushed to `main`. GitHub QA run `27191761289` completed successfully. Artifact `7501564840` (`qa-automation-27191761289`) reported `status: passed`, `dirty: false`, smoke 156/0, required checks 13/13, artifact integrity passed, QA verdict passed/shareable. Sensitive scan over downloaded artifact had no matches.

- [x] **Step 3: Run Browser QA**

Open the read-only local app at `http://127.0.0.1:8123/`, open stored samples, inspect the analysis tab key moment cards and evidence tab metadata. Confirm key moments show `초반` / `중반` instead of `EARLY` / `MID`, scoped raw visible token checks are empty, and console warn/error logs are empty.

Result 2026-06-09: Browser QA on `http://127.0.0.1:8123/?qa=key-moment-phase-label` passed. Stored sample `sample-kr-8242613150` analysis tab key moment cards showed `초반` and `중반` badges for 4:46, 11:33, 15:27~17:30, and 22:08 moments. Scoped key moment/evidence visible text checks found no raw `EARLY`, `MID`, or `LATE` tokens; console warn/error count was 0.

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

- Spec coverage: The plan covers key moment phase badges, timeline evidence phase fallback, and rule-based evidence phase fallback.
- Placeholder scan: No `TBD`, `TODO`, "implement later", or unresolved placeholder steps remain.
- Type consistency: `keyMomentPhase(moment)` continues to return raw enum tokens; `gamePhaseLabel(phase)` is used only at user-facing display boundaries.
