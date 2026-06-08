# Action Checklist Nonblank Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject AI analysis outputs whose action checklist ids or display fields contain only whitespace.

**Architecture:** Keep the policy in `server.js`'s final schema validator. Reuse the existing `isNonBlankString()` helper in `hasValidActionChecklist()` so action checklist validation matches the stricter behavior already used by `matchSummary`, `coachSummary`, `evidenceIndex`, `combatAnalysis`, and `teamfightPhaseAnalysis`.

**Tech Stack:** Node.js ESM test scripts, `server.js` pure helper extraction, npm QA scripts.

---

### Task 1: Pin Action Checklist Nonblank Validation

**Files:**
- Create: `test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/schema/schema-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-action-checklist-nonblank-policy.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs` with:

```js
// server.js action checklist nonblank schema regression tests

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

const hasValidActionChecklistSrc = extractFunctionSource(serverSrc, "hasValidActionChecklist");

const supportSources = [
  extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
  extractConstSource(serverSrc, "PHASE_SUMMARIES_MIN"),
  extractConstSource(serverSrc, "GAME_PHASES"),
  extractConstSource(serverSrc, "EVIDENCE_INDEX_MIN"),
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MIN"),
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MAX"),
  extractConstSource(serverSrc, "INSIGHT_LIST_MIN"),
  extractConstSource(serverSrc, "INSIGHT_LIST_MAX"),
  extractFunctionSource(serverSrc, "isValidGamePhase"),
  extractFunctionSource(serverSrc, "hasMinimumKeyMoments"),
  extractFunctionSource(serverSrc, "hasValidKeyMoments"),
  extractFunctionSource(serverSrc, "hasValidPhaseSummaries"),
  extractFunctionSource(serverSrc, "hasAnalysisMetaObject"),
  extractFunctionSource(serverSrc, "isNonBlankString"),
  extractFunctionSource(serverSrc, "hasValidMatchSummary"),
  extractFunctionSource(serverSrc, "hasValidCoachSummary"),
  extractFunctionSource(serverSrc, "hasValidEvidenceIndex"),
  hasValidActionChecklistSrc,
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

expectOk("valid text checklist passes", () => validateAnalysisOutput(validFixture()));

expectOk("valid action-only checklist passes", () => {
  const f = validFixture();
  f.actionChecklist = [
    { id: "act_1", action: "첫 액션" },
    { id: "act_2", action: "둘째 액션" },
    { id: "act_3", action: "셋째 액션" },
  ];
  validateAnalysisOutput(f);
});

expectThrows("actionChecklist rejects whitespace id", () => {
  const f = validFixture();
  f.actionChecklist[0].id = "   ";
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist rejects whitespace text without action", () => {
  const f = validFixture();
  f.actionChecklist[0] = { id: "act_1", text: "   " };
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist rejects whitespace action without text", () => {
  const f = validFixture();
  f.actionChecklist[0] = { id: "act_1", action: "   " };
  validateAnalysisOutput(f);
}, "actionChecklist");

checkTrue(
  "hasValidActionChecklist uses nonblank ids",
  hasValidActionChecklistSrc.includes("isNonBlankString(item.id)"),
);
checkTrue(
  "hasValidActionChecklist uses nonblank text",
  hasValidActionChecklistSrc.includes("isNonBlankString(item.text)"),
);
checkTrue(
  "hasValidActionChecklist uses nonblank action",
  hasValidActionChecklistSrc.includes("isNonBlankString(item.action)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs
node test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs
```

Expected: syntax check passes, runtime test fails because whitespace-only `id`, `text`, and `action` still pass and `hasValidActionChecklist()` does not use `isNonBlankString()`.

- [x] **Step 3: Implement the minimal validator policy**

In `server.js`, update only `hasValidActionChecklist()`:

```js
function hasValidActionChecklist(actionChecklist) {
  return Array.isArray(actionChecklist) &&
    actionChecklist.length >= ACTION_CHECKLIST_MIN &&
    actionChecklist.length <= ACTION_CHECKLIST_MAX &&
    actionChecklist.every((item) =>
      item &&
      isNonBlankString(item.id) &&
      (
        isNonBlankString(item.text) ||
        isNonBlankString(item.action)
      )
    );
}
```

- [x] **Step 4: Update existing schema regression tests**

In `test-artifacts/schema/schema-tests.mjs`, add whitespace cases next to the existing action checklist tests:

```js
expectThrows("actionChecklist item whitespace id throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "   ", text: "준비하기" }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item whitespace text/action throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "act_1", text: "   " }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item whitespace action throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "act_1", action: "   " }];
  validateAnalysisOutput(f);
}, "actionChecklist");
```

- [x] **Step 5: Run focused QA**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs
node --check test-artifacts/schema/schema-tests.mjs
node test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected: all commands pass.

- [x] **Step 6: Run full local QA and smoke report**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-nonblank-policy-local npm run smoke:report:readonly
node -e "const fs=require('fs'); const summary=JSON.parse(fs.readFileSync('test-artifacts/tmp/action-checklist-nonblank-policy-local/qa-summary.json','utf8')); const run=summary.latestRun; const requiredPassed=run.requiredChecks.filter((check)=>check.status==='pass').length; console.log(JSON.stringify({qaStatus:run.qaVerdict.status,requiredPassed,requiredTotal:run.requiredChecks.length,smokePassed:run.smokeSummary.passed,smokeFailed:run.smokeSummary.failed,durationMs:run.durationMs,mode:run.mode,gitShortSha:run.git.shortSha,gitDirty:run.git.dirty},null,2));"
rg -n --hidden -S "RGAPI-|api_key|RIOT_API_KEY|OPENAI_API_KEY|BEGIN (RSA|OPENSSH|PRIVATE) KEY|secret.json|/Users/|/runtime/samples|kr\\.api\\.riotgames\\.com|getaddrinfo|Unexpected token" test-artifacts/tmp/action-checklist-nonblank-policy-local
```

Expected: `npm test` passes, diff has no whitespace errors, smoke verdict is `pass`, sensitive scan has no matches.

- [x] **Step 7: Commit and push with GitHub QA evidence**

Run:

```bash
rm -rf test-artifacts/tmp
git status --short --branch
git add docs/superpowers/plans/2026-06-09-action-checklist-nonblank-policy.md server.js test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs test-artifacts/schema/schema-tests.mjs
git commit -m "test: guard action checklist strings"
git push origin main
gh run list --workflow QA --branch main --limit 8 --json databaseId,headSha,status,conclusion,displayTitle,createdAt,url
gh run watch <run-id> --exit-status
```

Expected: push succeeds, GitHub QA succeeds for the pushed commit, artifact summary reports a passing smoke run.

### Execution Notes

- 2026-06-09 08:22 KST: Current `main` and `origin/main` are synchronized at `762bf46`. `hasValidActionChecklist()` currently accepts truthy strings, so whitespace-only `id`, `text`, or `action` can pass the final AI schema gate.
- 2026-06-09 08:24 KST: RED confirmed. `node --check test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs` passed, and `node test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs` failed 6/8 because whitespace-only `id`, `text`, and `action` still passed and `hasValidActionChecklist()` did not use `isNonBlankString()`.
- 2026-06-09 08:25 KST: GREEN focused QA passed: `node --check server.js`, `node --check test-artifacts/schema/action-checklist-nonblank-policy-tests.mjs`, `node --check test-artifacts/schema/schema-tests.mjs`, new action checklist nonblank test 8/0, schema tests 91/0, LLM payload 84/0, strength/weakness 89/0.
- 2026-06-09 08:27 KST: Full local QA passed. `npm test` reported 1942 passed, 0 failed across 72 test files. `git diff --check` passed. Read-only smoke report passed with QA verdict `passed`, required checks 13/13, smoke 156/0, duration 212 ms, mode `readonly`, local dirty state expected before commit. Sensitive/runtime-path scan over `test-artifacts/tmp/action-checklist-nonblank-policy-local` returned no matches.
- 2026-06-09 08:28 KST: Implementation commit `95c7724` (`test: guard action checklist strings`) pushed to `main`. GitHub Actions QA run `27173495184` completed with conclusion `success`; artifact `7494880199` (`qa-automation-27173495184`, 3550 bytes) reported QA verdict `passed`, required checks 13/13, smoke 156/0, duration 218 ms, mode `readonly`, `latestRun.ci.provider: "github-actions"`, `runUrl: "https://github.com/crisious/Web_LOL_Banpick/actions/runs/27173495184"`, `latestRun.git.shortSha: "95c7724"`, `dirty: false`. Artifact sensitive/runtime-path scan returned no matches.
