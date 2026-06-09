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
  extractFunctionSource(serverSrc, "hasValidKeyMomentItemShapes"),
  extractFunctionSource(serverSrc, "hasValidKeyMoments"),
  extractFunctionSource(serverSrc, "hasValidPhaseSummaryItemShapes"),
  extractFunctionSource(serverSrc, "hasValidPhaseSummaries"),
  extractFunctionSource(serverSrc, "hasAnalysisMetaObject"),
  extractFunctionSource(serverSrc, "isNonBlankString"),
  extractFunctionSource(serverSrc, "hasValidMatchSummary"),
  extractFunctionSource(serverSrc, "hasValidCoachSummary"),
  extractFunctionSource(serverSrc, "hasValidEvidenceIndex"),
  hasValidActionChecklistSrc,
  extractFunctionSource(serverSrc, "hasValidInsightItemShapes"),
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
