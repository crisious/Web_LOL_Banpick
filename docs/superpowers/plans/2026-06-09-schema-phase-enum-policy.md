# Schema Phase Enum Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject AI analysis outputs whose game-phase fields are not one of `EARLY`, `MID`, or `LATE`.

**Architecture:** Keep the policy in `server.js`'s schema validator because it is the final gate before an AI response is accepted. Add a small game-phase enum helper and use it only for user-facing game-phase fields: `phaseSummaries[].phase` and `keyMoments[].phase`; do not apply it to `teamfightPhaseAnalysis.phases[].phase` because those values describe fight sections such as `ENGAGE`, `TRADE`, and `CLEANUP`.

**Tech Stack:** Node.js ESM test scripts, `server.js` pure helper extraction, npm QA scripts.

---

### Task 1: Pin Game Phase Enum Validation

**Files:**
- Create: `test-artifacts/schema/schema-phase-enum-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/schema/schema-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-schema-phase-enum-policy.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/schema/schema-phase-enum-policy-tests.mjs` with:

```js
// server.js analysis schema game phase enum regression tests

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

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

function extractConstSource(source, name) {
  const m = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[0];
}

const hasValidKeyMomentsSrc = extractFunctionSource(serverSrc, "hasValidKeyMoments");
const hasValidPhaseSummariesSrc = extractFunctionSource(serverSrc, "hasValidPhaseSummaries");

const supportSources = [
  extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
  extractConstSource(serverSrc, "PHASE_SUMMARIES_MIN"),
  extractConstSource(serverSrc, "EVIDENCE_INDEX_MIN"),
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MIN"),
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MAX"),
  extractConstSource(serverSrc, "INSIGHT_LIST_MIN"),
  extractConstSource(serverSrc, "INSIGHT_LIST_MAX"),
  serverSrc.includes("const GAME_PHASES =") ? extractConstSource(serverSrc, "GAME_PHASES") : "",
  serverSrc.includes("function isValidGamePhase(") ? extractFunctionSource(serverSrc, "isValidGamePhase") : "",
  extractFunctionSource(serverSrc, "hasMinimumKeyMoments"),
  hasValidKeyMomentsSrc,
  hasValidPhaseSummariesSrc,
  extractFunctionSource(serverSrc, "hasAnalysisMetaObject"),
  extractFunctionSource(serverSrc, "isNonBlankString"),
  extractFunctionSource(serverSrc, "hasValidMatchSummary"),
  extractFunctionSource(serverSrc, "hasValidCoachSummary"),
  extractFunctionSource(serverSrc, "hasValidEvidenceIndex"),
  extractFunctionSource(serverSrc, "hasValidActionChecklist"),
  extractFunctionSource(serverSrc, "hasValidInsightList"),
  extractFunctionSource(serverSrc, "hasValidCombatAnalysis"),
  extractFunctionSource(serverSrc, "hasValidTeamfightPhaseAnalysis"),
];

const validateAnalysisOutput = new Function(
  `${supportSources.join("\n")}\n${extractFunctionSource(serverSrc, "validateAnalysisOutput")}\nreturn validateAnalysisOutput;`,
)();

let pass = 0;
let fail = 0;

function expectThrows(label, fn, expectedSubstring) {
  try {
    fn();
    console.log(`FAIL  ${label} — expected throw but did not`);
    fail += 1;
  } catch (err) {
    const ok = expectedSubstring ? err.message.includes(expectedSubstring) : true;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) console.log(`  expected message containing "${expectedSubstring}"\n  got "${err.message}"`);
    ok ? pass++ : fail++;
  }
}

function expectOk(label, fn) {
  try {
    fn();
    console.log(`PASS  ${label}`);
    pass += 1;
  } catch (err) {
    console.log(`FAIL  ${label} — unexpected throw: ${err.message}`);
    fail += 1;
  }
}

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

function validFixture() {
  return {
    schemaVersion: "1.0",
    analysisMeta: { sourceType: "claude_ai", language: "ko" },
    matchSummary: { headline: "한 줄 요약" },
    coachSummary: { overallSummary: "전체 흐름 요약" },
    phaseSummaries: [
      { phase: "EARLY", summary: "초반" },
      { phase: "MID", summary: "중반" },
      { phase: "LATE", summary: "후반" },
    ],
    strengths: [
      { id: "str_1", title: "t1", description: "d1", relatedEventIds: [] },
      { id: "str_2", title: "t2", description: "d2", relatedEventIds: [] },
      { id: "str_3", title: "t3", description: "d3", relatedEventIds: [] },
    ],
    weaknesses: [
      { id: "wk_1", title: "t1", description: "d1", relatedEventIds: [] },
      { id: "wk_2", title: "t2", description: "d2", relatedEventIds: [] },
      { id: "wk_3", title: "t3", description: "d3", relatedEventIds: [] },
    ],
    actionChecklist: [
      { id: "act_1", text: "t1" },
      { id: "act_2", text: "t2" },
      { id: "act_3", text: "t3" },
    ],
    keyMoments: [
      { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "t", description: "d", relatedEventIds: ["evt_001"] },
      { id: "km_2", timestampLabel: "12:00", phase: "MID", title: "t", description: "d", relatedEventIds: ["evt_001"] },
      { id: "km_3", timestampLabel: "16:00", phase: "MID", title: "t", description: "d", relatedEventIds: ["evt_001"] },
      { id: "km_4", timestampLabel: "20:00", phase: "LATE", title: "t", description: "d", relatedEventIds: ["evt_001"] },
    ],
    evidenceIndex: [{ eventId: "evt_001", summary: "핵심 근거" }],
  };
}

expectOk("valid game phase values pass", () => validateAnalysisOutput(validFixture()));

expectThrows("phaseSummaries reject unknown game phase", () => {
  const f = validFixture();
  f.phaseSummaries[1].phase = "LANING";
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries reject lowercase game phase", () => {
  const f = validFixture();
  f.phaseSummaries[0].phase = "early";
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("keyMoments reject unknown game phase", () => {
  const f = validFixture();
  f.keyMoments[0].phase = "LANING";
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments reject whitespace-padded game phase", () => {
  const f = validFixture();
  f.keyMoments[1].phase = " MID ";
  validateAnalysisOutput(f);
}, "keyMoments");

checkTrue(
  "server defines GAME_PHASES enum",
  serverSrc.includes('const GAME_PHASES = new Set(["EARLY", "MID", "LATE"]);'),
);
checkTrue(
  "server defines isValidGamePhase helper",
  serverSrc.includes("function isValidGamePhase(phase)"),
);
checkTrue(
  "hasValidPhaseSummaries uses game phase enum",
  hasValidPhaseSummariesSrc.includes("isValidGamePhase(item.phase)"),
);
checkTrue(
  "hasValidKeyMoments uses game phase enum",
  hasValidKeyMomentsSrc.includes("isValidGamePhase(item.phase)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/schema/schema-phase-enum-policy-tests.mjs
node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
```

Expected: syntax check passes, runtime test fails because invalid game phases still pass and the enum helper is missing.

- [x] **Step 3: Implement the minimal validator policy**

In `server.js`, add the enum near the phase constants/helpers:

```js
const GAME_PHASES = new Set(["EARLY", "MID", "LATE"]);
```

Add the helper near `phaseFor()`:

```js
function isValidGamePhase(phase) {
  return GAME_PHASES.has(phase);
}
```

Update `hasValidKeyMoments()`:

```js
isValidGamePhase(item.phase) &&
```

Update `hasValidPhaseSummaries()`:

```js
isValidGamePhase(item.phase) &&
```

Do not update `hasValidTeamfightPhaseAnalysis()` because `teamfightPhaseAnalysis.phases[].phase` uses fight-section values, not game-phase values.

- [x] **Step 4: Update existing schema extraction tests**

In `test-artifacts/schema/schema-tests.mjs`, include the new support sources before functions that call `isValidGamePhase()`:

```js
if (serverSrc.includes("const GAME_PHASES =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "GAME_PHASES"));
}
if (serverSrc.includes("function isValidGamePhase(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "isValidGamePhase"));
}
```

Add expectations:

```js
expectThrows("keyMoments item invalid phase throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", phase: "LANING", title: "장면", description: "설명", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("phaseSummaries item invalid phase throws", () => {
  const f = validFixture();
  f.phaseSummaries = [{ phase: "LANING", summary: "early" }, { phase: "MID", summary: "mid" }, { phase: "LATE", summary: "late" }];
  validateAnalysisOutput(f);
}, "phaseSummaries");
```

- [x] **Step 5: Run focused QA**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/schema-phase-enum-policy-tests.mjs
node --check test-artifacts/schema/schema-tests.mjs
node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/server/llm-payload-timestamp-policy-tests.mjs
```

Expected: all commands pass; existing `teamfightPhaseAnalysis` valid item still passes with `ENGAGE` phase.

- [x] **Step 6: Run full local QA and smoke report**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/schema-phase-enum-policy-local npm run smoke:report:readonly
node -e "const fs=require('fs'); const summary=JSON.parse(fs.readFileSync('test-artifacts/tmp/schema-phase-enum-policy-local/qa-summary.json','utf8')); const run=summary.latestRun; const requiredPassed=run.requiredChecks.filter((check)=>check.status==='pass').length; console.log(JSON.stringify({qaStatus:run.qaVerdict.status,requiredPassed,requiredTotal:run.requiredChecks.length,smokePassed:run.smokeSummary.passed,smokeFailed:run.smokeSummary.failed,durationMs:run.durationMs,mode:run.mode,gitShortSha:run.git.shortSha,gitDirty:run.git.dirty},null,2));"
rg -n --hidden -S "RGAPI-|api_key|RIOT_API_KEY|OPENAI_API_KEY|BEGIN (RSA|OPENSSH|PRIVATE) KEY|secret.json|/Users/|/runtime/samples|kr\\.api\\.riotgames\\.com|getaddrinfo|Unexpected token" test-artifacts/tmp/schema-phase-enum-policy-local
```

Expected: `npm test` passes, diff has no whitespace errors, smoke verdict is `pass`, sensitive scan has no matches.

- [ ] **Step 7: Commit and push with GitHub QA evidence**

Run:

```bash
rm -rf test-artifacts/tmp
git status --short --branch
git add docs/superpowers/plans/2026-06-09-schema-phase-enum-policy.md server.js test-artifacts/schema/schema-phase-enum-policy-tests.mjs test-artifacts/schema/schema-tests.mjs
git commit -m "test: guard schema game phases"
git push origin main
gh run list --workflow QA --branch main --limit 8 --json databaseId,headSha,status,conclusion,displayTitle,createdAt,url
gh run watch <run-id> --exit-status
```

Expected: push succeeds, GitHub QA succeeds for the pushed commit, artifact summary reports a passing smoke run.

### Execution Notes

- 2026-06-09 08:11 KST: Current `main` and `origin/main` are synchronized at `543c6bb`. `hasValidKeyMoments()` and `hasValidPhaseSummaries()` currently accept any non-empty string for `phase`, while `teamfightPhaseAnalysis.phases[].phase` correctly uses fight-section values such as `ENGAGE`.
- 2026-06-09 08:13 KST: RED confirmed. `node --check test-artifacts/schema/schema-phase-enum-policy-tests.mjs` passed, and `node test-artifacts/schema/schema-phase-enum-policy-tests.mjs` failed 8/9 because invalid `phaseSummaries`/`keyMoments` game phases still passed and `GAME_PHASES` / `isValidGamePhase()` were missing.
- 2026-06-09 08:15 KST: GREEN focused QA passed: `node --check server.js`, `node --check test-artifacts/schema/schema-phase-enum-policy-tests.mjs`, `node --check test-artifacts/schema/schema-tests.mjs`, new schema phase enum test 9/0, schema tests 88/0, LLM payload 84/0, LLM payload timestamp policy 12/0, teamfight phase 38/0.
- 2026-06-09 08:16 KST: Full local QA passed. `npm test` reported 1931 passed, 0 failed across 71 test files. `git diff --check` passed. Read-only smoke report passed with QA verdict `passed`, required checks 13/13, smoke 156/0, duration 205 ms, mode `readonly`, local dirty state expected before commit. Sensitive/runtime-path scan over `test-artifacts/tmp/schema-phase-enum-policy-local` returned no matches.
