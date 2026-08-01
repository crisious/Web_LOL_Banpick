// server.js buildAnalysis strengths count tracking regression tests

import fs from "fs";
import { createRequire } from "node:module";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");
const require = createRequire(import.meta.url);
const { buildActionChecklist, buildKeyMoments } = require("../../lib/rule-based-fallback.js");

function extractFunctionSource(source, name) {
  let startIdx = source.indexOf(`async function ${name}(`);
  if (startIdx < 0) startIdx = source.indexOf(`function ${name}(`);
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

const buildAnalysisSrc = extractFunctionSource(serverSrc, "buildAnalysis");
const hasValidInsightListSrc = extractFunctionSource(serverSrc, "hasValidInsightList");
const insightListMinimumSource = serverSrc.includes("function hasMinimumInsightList(")
  ? extractFunctionSource(serverSrc, "hasMinimumInsightList")
  : `
function hasMinimumInsightList(items) {
  return Array.isArray(items) && items.length >= INSIGHT_LIST_MIN;
}
`;

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
  extractFunctionSource(serverSrc, "isNonBlankString"),
  extractFunctionSource(serverSrc, "hasMinimumKeyMoments"),
  extractFunctionSource(serverSrc, "hasValidKeyMomentItemShapes"),
  extractFunctionSource(serverSrc, "hasValidKeyMoments"),
  extractFunctionSource(serverSrc, "hasMinimumPhaseSummaries"),
  extractFunctionSource(serverSrc, "hasValidPhaseSummaryItemShapes"),
  extractFunctionSource(serverSrc, "hasValidPhaseSummaries"),
  extractFunctionSource(serverSrc, "hasAnalysisMetaObject"),
  extractFunctionSource(serverSrc, "hasValidMatchSummary"),
  extractFunctionSource(serverSrc, "hasValidCoachSummary"),
  extractFunctionSource(serverSrc, "hasValidEvidenceIndex"),
  extractFunctionSource(serverSrc, "hasMinimumActionChecklist"),
  extractFunctionSource(serverSrc, "hasValidActionChecklist"),
  extractFunctionSource(serverSrc, "hasValidInsightItemShapes"),
  insightListMinimumSource,
  hasValidInsightListSrc,
  extractFunctionSource(serverSrc, "hasValidCombatAnalysis"),
  extractFunctionSource(serverSrc, "hasValidTeamfightPhaseAnalysis"),
  extractFunctionSource(serverSrc, "validateAnalysisOutput"),
].join("\n");

const state = {
  fallbackCalls: 0,
  strengthRepairCalls: 0,
  primaryResponse: primaryAnalysisFixture(),
  console: { log() {}, error() {} },
};

const buildAnalysis = new Function("state", "buildKeyMoments", "buildActionChecklist", `
  const console = state.console;
  ${supportSources}

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function buildLlmPayload() {
    return {
      combatEncounters: [],
      teamfightPhases: [],
    };
  }
  function parseAgentDisableCodexConfig() {
    return false;
  }
  async function callClaudeAgent() {
    return clone(state.primaryResponse);
  }
  async function callCodexAgent() {
    throw new Error("codex unavailable");
  }
  function repairedStrengths() {
    return [
      { id: "str_1", title: "repaired strength 1", description: "repaired strength description 1", relatedEventIds: [] },
      { id: "str_2", title: "repaired strength 2", description: "repaired strength description 2", relatedEventIds: [] },
      { id: "str_3", title: "repaired strength 3", description: "repaired strength description 3", relatedEventIds: [] },
    ];
  }
  function buildRuleBasedAnalysis() {
    state.fallbackCalls += 1;
    return {
      schemaVersion: "1.0",
      analysisMeta: { sourceType: "rule_based", language: "ko" },
      matchSummary: { headline: "fallback headline" },
      coachSummary: { overallSummary: "fallback coach summary" },
      phaseSummaries: [
        { phase: "EARLY", summary: "fallback early" },
        { phase: "MID", summary: "fallback mid" },
        { phase: "LATE", summary: "fallback late" },
      ],
      strengths: repairedStrengths(),
      weaknesses: [
        { id: "wk_1", title: "fallback weakness 1", description: "fallback weakness description 1", relatedEventIds: [] },
        { id: "wk_2", title: "fallback weakness 2", description: "fallback weakness description 2", relatedEventIds: [] },
        { id: "wk_3", title: "fallback weakness 3", description: "fallback weakness description 3", relatedEventIds: [] },
      ],
      actionChecklist: [
        { id: "act_1", text: "fallback action 1" },
        { id: "act_2", text: "fallback action 2" },
        { id: "act_3", text: "fallback action 3" },
      ],
      keyMoments: [
        { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "fallback moment 1", description: "fallback moment description 1", relatedEventIds: ["evt_001"] },
        { id: "km_2", timestampLabel: "12:00", phase: "MID", title: "fallback moment 2", description: "fallback moment description 2", relatedEventIds: ["evt_001"] },
        { id: "km_3", timestampLabel: "16:00", phase: "MID", title: "fallback moment 3", description: "fallback moment description 3", relatedEventIds: ["evt_001"] },
        { id: "km_4", timestampLabel: "20:00", phase: "LATE", title: "fallback moment 4", description: "fallback moment description 4", relatedEventIds: ["evt_001"] },
      ],
      evidenceIndex: [{ eventId: "evt_001", summary: "fallback evidence" }],
      combatAnalysis: [],
      teamfightPhaseAnalysis: [],
    };
  }
  function buildCoachSummary() {
    return { overallSummary: "fallback coach summary" };
  }
  function buildPhaseSummaries() {
    return buildRuleBasedAnalysis().phaseSummaries;
  }
  function buildEvidenceIndex() {
    return [{ eventId: "evt_001", summary: "fallback evidence" }];
  }
  function buildStrengths() {
    state.strengthRepairCalls += 1;
    return repairedStrengths();
  }
  function buildWeaknesses() {
    return buildRuleBasedAnalysis().weaknesses;
  }
  function mergeTeamfightCoaching() {
    return [];
  }
  function buildComparison() {
    return { agreements: [], disagreements: [] };
  }

  ${buildAnalysisSrc}
  return buildAnalysis;
`)(state, buildKeyMoments, buildActionChecklist);

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

function primaryAnalysisFixture() {
  return {
    schemaVersion: "1.0",
    analysisMeta: { sourceType: "claude_ai", language: "ko" },
    matchSummary: { headline: "primary headline" },
    coachSummary: { overallSummary: "primary coach summary" },
    phaseSummaries: [
      { phase: "EARLY", summary: "primary early summary" },
      { phase: "MID", summary: "primary mid summary" },
      { phase: "LATE", summary: "primary late summary" },
    ],
    strengths: [
      { id: "str_short_1", title: "short strength 1", description: "short strength description 1", relatedEventIds: [] },
      { id: "str_short_2", title: "short strength 2", description: "short strength description 2", relatedEventIds: [] },
    ],
    weaknesses: [
      { id: "wk_1", title: "primary weakness 1", description: "primary weakness description 1", relatedEventIds: [] },
      { id: "wk_2", title: "primary weakness 2", description: "primary weakness description 2", relatedEventIds: [] },
      { id: "wk_3", title: "primary weakness 3", description: "primary weakness description 3", relatedEventIds: [] },
    ],
    actionChecklist: [
      { id: "act_1", text: "primary action 1" },
      { id: "act_2", text: "primary action 2" },
      { id: "act_3", text: "primary action 3" },
    ],
    keyMoments: [
      { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "primary moment 1", description: "primary moment description 1", relatedEventIds: ["evt_001"] },
      { id: "km_2", timestampLabel: "12:00", phase: "MID", title: "primary moment 2", description: "primary moment description 2", relatedEventIds: ["evt_001"] },
      { id: "km_3", timestampLabel: "16:00", phase: "MID", title: "primary moment 3", description: "primary moment description 3", relatedEventIds: ["evt_001"] },
      { id: "km_4", timestampLabel: "20:00", phase: "LATE", title: "primary moment 4", description: "primary moment description 4", relatedEventIds: ["evt_001"] },
    ],
    evidenceIndex: [{ eventId: "evt_001", summary: "primary evidence" }],
    combatAnalysis: [],
    teamfightPhaseAnalysis: [],
  };
}

function normalizedFixture() {
  return {
    matchInfo: { matchId: "KR_STRENGTHS_COUNT", queueLabel: "RANKED_SOLO" },
    playerContext: { riotId: "Strength#KR1", participantId: 1 },
    timelineEvents: [],
    phaseContext: {},
    playerStats: {},
    teamContext: {},
    derivedSignals: {},
  };
}

const result = await buildAnalysis(normalizedFixture(), "sample-strengths-count");

check("primary analysis is preserved", result.matchSummary?.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("strengths are repaired", result.strengths?.map((item) => item.id), ["str_1", "str_2", "str_3"]);
check("strength repair called once", state.strengthRepairCalls, 1);
checkTrue(
  "schemaViolations include short strengths count",
  result.analysisMeta?.schemaViolations?.includes("count.strengths<3"),
);
checkTrue(
  "schemaViolations do not misclassify short strengths as missing",
  !result.analysisMeta?.schemaViolations?.includes("missing.strengths"),
);
checkTrue(
  "schemaViolations do not misclassify short strengths as malformed",
  !result.analysisMeta?.schemaViolations?.includes("shape.strengths.invalid"),
);
check("schemaViolationCount", result.analysisMeta?.schemaViolationCount, 1);

state.primaryResponse = primaryAnalysisFixture();
state.primaryResponse.strengths = [
  { id: "str_over_1", title: "over strength 1", description: "over strength description 1", relatedEventIds: [] },
  { id: "str_over_2", title: "over strength 2", description: "over strength description 2", relatedEventIds: [] },
  { id: "str_over_3", title: "over strength 3", description: "over strength description 3", relatedEventIds: [] },
  { id: "str_over_4", title: "over strength 4", description: "over strength description 4", relatedEventIds: [] },
];
state.fallbackCalls = 0;
state.strengthRepairCalls = 0;

const overStrengthsResult = await buildAnalysis(normalizedFixture(), "sample-strengths-overcount");

check("overfull strengths primary analysis is preserved", overStrengthsResult.matchSummary?.headline, "primary headline");
check("overfull strengths fallback is not used", state.fallbackCalls, 0);
check("overfull strengths are repaired", overStrengthsResult.strengths?.map((item) => item.id), ["str_1", "str_2", "str_3"]);
check("overfull strength repair called once", state.strengthRepairCalls, 1);
checkTrue(
  "schemaViolations include overfull strengths count",
  overStrengthsResult.analysisMeta?.schemaViolations?.includes("count.strengths>3"),
);
checkTrue(
  "schemaViolations do not misclassify overfull strengths as malformed",
  !overStrengthsResult.analysisMeta?.schemaViolations?.includes("shape.strengths.invalid"),
);
check("overfull strengths schemaViolationCount", overStrengthsResult.analysisMeta?.schemaViolationCount, 1);
checkTrue(
  "buildAnalysis tracks short strengths separately",
  buildAnalysisSrc.includes("count.strengths<${INSIGHT_LIST_MIN}"),
);
checkTrue(
  "buildAnalysis tracks overfull strengths separately",
  buildAnalysisSrc.includes("count.strengths>${INSIGHT_LIST_MAX}"),
);
checkTrue(
  "server defines shared insight list minimum helper",
  serverSrc.includes("function hasMinimumInsightList"),
);
checkTrue(
  "hasValidInsightList reuses minimum helper",
  hasValidInsightListSrc.includes("hasMinimumInsightList(items)"),
);
checkTrue(
  "buildAnalysis checks strengths minimum helper for count",
  buildAnalysisSrc.includes("hasMinimumInsightList(primary.strengths)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
