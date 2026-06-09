# Combat Situation Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every visible combat analysis card has a valid situation chip (`PLAYER_DOMINANT`, `PLAYER_DOWN`, or `TRADED`) in generated analysis and stored demo samples.

**Architecture:** Add schema/prompt tests first, then require `combatAnalysis[].situation` in the server validator and output schema. Backfill existing stored `analysis-result.json` bundles from each sample's normalized timeline event IDs so the read-only demo immediately benefits.

**Tech Stack:** Node.js, `server.js`, vanilla frontend data shape, existing `test-artifacts/schema/schema-tests.mjs`, `test-artifacts/server/llm-payload-tests.mjs`, `test-artifacts/samples/manifest-tests.mjs`, GitHub Actions QA, Obsidian project log.

---

### Task 1: Add RED Coverage For Combat Situation

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`
- Modify: `test-artifacts/server/llm-payload-tests.mjs`
- Modify: `test-artifacts/samples/manifest-tests.mjs`

- [x] **Step 1: Add schema regression assertions**

In `test-artifacts/schema/schema-tests.mjs`, update the valid combat item to include:

```js
situation: "PLAYER_DOWN",
```

Then add these assertions in the combatAnalysis section:

```js
expectThrows("combatAnalysis: missing situation throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "초반 갱킹 손실",
    playerDecision: "판단",
    takeaway: "교훈",
    relatedEventIds: ["evt_001"],
  }])),
  "situation");

expectThrows("combatAnalysis: invalid situation enum throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situation: "UNKNOWN",
    situationLabel: "초반 갱킹 손실",
    playerDecision: "판단",
    takeaway: "교훈",
    relatedEventIds: ["evt_001"],
  }])),
  "situation");
```

- [x] **Step 2: Add prompt contract assertion**

In `test-artifacts/server/llm-payload-tests.mjs`, add a combat schema snippet check:

```js
{
  const start = OUTPUT_SCHEMA_EXAMPLE.indexOf('"combatAnalysis"');
  const end = OUTPUT_SCHEMA_EXAMPLE.indexOf('"teamfightPhaseAnalysis"', start);
  const snippet = OUTPUT_SCHEMA_EXAMPLE.slice(start, end);
  checkTrue("combat prompt includes situation", snippet.includes('"situation"'));
  checkTrue("combat prompt includes situation enum", snippet.includes("PLAYER_DOMINANT") && snippet.includes("PLAYER_DOWN") && snippet.includes("TRADED"));
}
```

- [x] **Step 3: Add stored sample contract assertion**

In `test-artifacts/samples/manifest-tests.mjs`, add:

```js
const validCombatSituations = new Set(["PLAYER_DOMINANT", "PLAYER_DOWN", "TRADED"]);
const invalidCombatSituations = [];
```

Inside the per-sample bundle read, after `analysis` is parsed, add:

```js
if (Array.isArray(analysis.combatAnalysis)) {
  analysis.combatAnalysis.forEach((item, index) => {
    if (!validCombatSituations.has(item?.situation)) {
      invalidCombatSituations.push(`${sample.id}:combatAnalysis[${index}].situation`);
    }
  });
}
```

Add a final check:

```js
check("stored combat analysis includes valid situation chips",
  invalidCombatSituations.length === 0,
  invalidCombatSituations.slice(0, 10).join(", "));
```

- [x] **Step 4: Verify RED**

Run:

```bash
node --check test-artifacts/schema/schema-tests.mjs
node --check test-artifacts/server/llm-payload-tests.mjs
node --check test-artifacts/samples/manifest-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/samples/manifest-tests.mjs
```

Expected: syntax passes. Runtime fails the new schema situation assertions, the prompt situation assertion, and the stored sample situation assertion.

Result: syntax checks passed for schema, LLM payload, and sample manifest tests. Runtime RED was confirmed: schema tests failed only the new combat situation assertions with `107 passed, 2 failed`; LLM payload tests failed combat schema/prompt situation assertions with `85 passed, 5 failed`; stored sample manifest failed the new combat situation chip check with `11 passed, 1 failed`.

### Task 2: Implement Validator And Prompt Contract

**Files:**
- Modify: `server.js`

- [x] **Step 1: Require valid combat situation in validator**

Inside `hasValidCombatAnalysis()`, add a local set:

```js
const combatSituations = new Set(["PLAYER_DOMINANT", "PLAYER_DOWN", "TRADED"]);
const isValidCombatSituation = (value) => isNonBlankString(value) && combatSituations.has(value);
```

Then require:

```js
isValidCombatSituation(item.situation) &&
```

before `isNonBlankString(item.situationLabel)`.

- [x] **Step 2: Preserve detailed validate errors**

Inside the combatAnalysis branch of `validateAnalysisOutput()`, add the same local set/predicate and check:

```js
if (!isValidCombatSituation(item.situation)) throw new Error("combatAnalysis item missing situation");
```

before the `situationLabel` check.

- [x] **Step 3: Update output schema example**

Change the combat schema example to include:

```json
"situation": "PLAYER_DOWN"
```

in each combatAnalysis item example.

- [x] **Step 4: Update agent prompts**

In both Claude and Codex combatAnalysis instructions, add that `situation` must be copied unchanged from the input encounter and must be one of `PLAYER_DOMINANT`, `PLAYER_DOWN`, or `TRADED`.

### Task 3: Backfill Stored Sample Combat Situations

**Files:**
- Modify: `data/samples/*/analysis-result.json`

- [x] **Step 1: Apply deterministic backfill**

Run this Node script from the repo root:

```bash
node - <<'NODE'
const fs = require("fs");
const path = require("path");
const samplesDir = path.join(process.cwd(), "data", "samples");
const ids = fs.readdirSync(samplesDir).filter((id) => id.startsWith("sample-"));

function classify(events) {
  let kills = 0;
  let deaths = 0;
  for (const event of events) {
    if (!event?.isPlayerInvolved) continue;
    if (event.eventType === "CHAMPION_KILL") kills += 1;
    else if (event.eventType === "PLAYER_DEATH") deaths += 1;
  }
  if (kills > deaths) return "PLAYER_DOMINANT";
  if (deaths > kills) return "PLAYER_DOWN";
  return "TRADED";
}

for (const id of ids) {
  const analysisPath = path.join(samplesDir, id, "analysis-result.json");
  const normalizedPath = path.join(samplesDir, id, "normalized-match.json");
  if (!fs.existsSync(analysisPath) || !fs.existsSync(normalizedPath)) continue;
  const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
  const normalized = JSON.parse(fs.readFileSync(normalizedPath, "utf8"));
  if (!Array.isArray(analysis.combatAnalysis) || analysis.combatAnalysis.length === 0) continue;
  const byId = new Map((normalized.timelineEvents || []).map((event) => [event.eventId, event]));
  let changed = false;
  for (const item of analysis.combatAnalysis) {
    if (typeof item.situation === "string" && item.situation.trim()) continue;
    const events = (item.relatedEventIds || []).map((eventId) => byId.get(eventId)).filter(Boolean);
    item.situation = classify(events);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`);
    console.log(`updated ${id}`);
  }
}
NODE
```

Expected: only stored sample `analysis-result.json` files with non-empty combatAnalysis are updated.

Result: Backfilled 8 stored sample analysis bundles with non-empty `combatAnalysis`: `sample-kr-8215889762`, `sample-kr-8240894781`, `sample-kr-8240931986`, `sample-kr-8241977558`, `sample-kr-8242047350`, `sample-kr-8242079574`, `sample-kr-8242213528`, and `sample-kr-8242613150`. All backfilled situations are one of `PLAYER_DOMINANT`, `PLAYER_DOWN`, or `TRADED`.

### Task 4: GREEN And Regression QA

**Files:**
- Verify: `server.js`
- Verify: `test-artifacts/schema/schema-tests.mjs`
- Verify: `test-artifacts/server/llm-payload-tests.mjs`
- Verify: `test-artifacts/samples/manifest-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/schema-tests.mjs
node --check test-artifacts/server/llm-payload-tests.mjs
node --check test-artifacts/samples/manifest-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/samples/manifest-tests.mjs
```

Expected: all focused checks pass; schema and payload totals increase by the new assertions, and stored sample manifest reports all combat situations valid.

Result: `node --check server.js`, schema tests, LLM payload tests, and sample manifest tests all passed. Focused runtime checks passed with schema `109 passed, 0 failed`, LLM payload `90 passed, 0 failed`, and sample manifest `12 passed, 0 failed`.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/combat-situation-contract-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/combat-situation-contract-local
```

Expected: full suite and read-only smoke pass; the sensitive scan exits with no matches.

Result: `npm test` passed with `2269 passed, 0 failed across 99 test file(s)`. `git diff --check` passed with no output. Fresh read-only smoke passed with `156 passed, 0 failed` at `test-artifacts/tmp/combat-situation-contract-local/2026-06-09T06-18-35Z-readonly`; QA summary showed required checks `13 passed, 0 failed, 0 missing` and `dirty: true` because implementation files were intentionally uncommitted. Sensitive artifact scan returned no matches.

### Task 5: Commit, Push, GitHub QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-combat-situation-contract.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Commit and push implementation**

Run:

```bash
git add server.js test-artifacts/schema/schema-tests.mjs test-artifacts/server/llm-payload-tests.mjs test-artifacts/samples/manifest-tests.mjs data/samples docs/superpowers/plans/2026-06-09-combat-situation-contract.md
git commit -m "test: require combat situation chips"
git push origin main
```

- [ ] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

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

- Spec coverage: The plan covers generated analysis validation, LLM prompt/schema guidance, and existing stored demo sample data so the UI can render combat situation chips immediately.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" placeholders remain.
- Type consistency: `situation` values match existing `detectCombatEncounters()` output and `renderCombatAnalysis()` labels.
