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

const hasValidKeyMomentItemShapesSrc = extractFunctionSource(serverSrc, "hasValidKeyMomentItemShapes");
const hasValidKeyMomentsSrc = extractFunctionSource(serverSrc, "hasValidKeyMoments");
const hasMinimumPhaseSummariesSrc = extractFunctionSource(serverSrc, "hasMinimumPhaseSummaries");
const hasValidPhaseSummaryItemShapesSrc = extractFunctionSource(serverSrc, "hasValidPhaseSummaryItemShapes");
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
  hasValidKeyMomentItemShapesSrc,
  hasValidKeyMomentsSrc,
  hasMinimumPhaseSummariesSrc,
  hasValidPhaseSummaryItemShapesSrc,
  hasValidPhaseSummariesSrc,
  extractFunctionSource(serverSrc, "hasAnalysisMetaObject"),
  extractFunctionSource(serverSrc, "isNonBlankString"),
  extractFunctionSource(serverSrc, "hasValidMatchSummary"),
  extractFunctionSource(serverSrc, "hasValidCoachSummary"),
  extractFunctionSource(serverSrc, "hasValidEvidenceIndex"),
  extractFunctionSource(serverSrc, "hasMinimumActionChecklist"),
  extractFunctionSource(serverSrc, "hasValidActionChecklist"),
  extractFunctionSource(serverSrc, "hasValidInsightItemShapes"),
  extractFunctionSource(serverSrc, "hasMinimumInsightList"),
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
  "hasValidPhaseSummaryItemShapes uses game phase enum",
  hasValidPhaseSummaryItemShapesSrc.includes("isValidGamePhase(item.phase)"),
);
checkTrue(
  "hasValidPhaseSummaries reuses phase summary item shape helper",
  hasValidPhaseSummariesSrc.includes("hasValidPhaseSummaryItemShapes(phaseSummaries)"),
);
checkTrue(
  "hasValidPhaseSummaries reuses phase summary minimum helper",
  hasValidPhaseSummariesSrc.includes("hasMinimumPhaseSummaries(phaseSummaries)"),
);
checkTrue(
  "hasValidKeyMomentItemShapes uses game phase enum",
  hasValidKeyMomentItemShapesSrc.includes("isValidGamePhase(item.phase)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
