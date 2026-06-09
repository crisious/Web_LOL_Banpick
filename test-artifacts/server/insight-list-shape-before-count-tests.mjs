// server.js buildAnalysis insight list shape-before-count regression tests

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

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
const insightItemShapesSource = serverSrc.includes("function hasValidInsightItemShapes(")
  ? extractFunctionSource(serverSrc, "hasValidInsightItemShapes")
  : `
function hasValidInsightItemShapes(items) {
  return Array.isArray(items) &&
    items.every((item) =>
      item &&
      isNonBlankString(item.id) &&
      isNonBlankString(item.title) &&
      isNonBlankString(item.description) &&
      Array.isArray(item.relatedEventIds) &&
      item.relatedEventIds.every((id) => isNonBlankString(id))
    );
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
  insightItemShapesSource,
  extractFunctionSource(serverSrc, "hasMinimumInsightList"),
  extractFunctionSource(serverSrc, "hasValidInsightList"),
  extractFunctionSource(serverSrc, "hasValidCombatAnalysis"),
  extractFunctionSource(serverSrc, "hasValidTeamfightPhaseAnalysis"),
  extractFunctionSource(serverSrc, "validateAnalysisOutput"),
].join("\n");

function createHarness(primaryResponse) {
  const state = {
    fallbackCalls: 0,
    strengthRepairCalls: 0,
    weaknessRepairCalls: 0,
    primaryResponse,
    console: { log() {}, error() {} },
  };

  const buildAnalysis = new Function("state", `
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
    function repairedWeaknesses() {
      return [
        { id: "wk_1", title: "repaired weakness 1", description: "repaired weakness description 1", relatedEventIds: [] },
        { id: "wk_2", title: "repaired weakness 2", description: "repaired weakness description 2", relatedEventIds: [] },
        { id: "wk_3", title: "repaired weakness 3", description: "repaired weakness description 3", relatedEventIds: [] },
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
        weaknesses: repairedWeaknesses(),
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
    function buildKeyMoments() {
      return buildRuleBasedAnalysis().keyMoments;
    }
    function buildEvidenceIndex() {
      return [{ eventId: "evt_001", summary: "fallback evidence" }];
    }
    function buildStrengths() {
      state.strengthRepairCalls += 1;
      return repairedStrengths();
    }
    function buildWeaknesses() {
      state.weaknessRepairCalls += 1;
      return repairedWeaknesses();
    }
    function buildActionChecklist() {
      return buildRuleBasedAnalysis().actionChecklist;
    }
    function mergeTeamfightCoaching() {
      return [];
    }
    function buildComparison() {
      return { agreements: [], disagreements: [] };
    }

    ${buildAnalysisSrc}
    return buildAnalysis;
  `)(state);

  return { state, buildAnalysis };
}

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

function validStrengths() {
  return [
    { id: "str_1", title: "primary strength 1", description: "primary strength description 1", relatedEventIds: [] },
    { id: "str_2", title: "primary strength 2", description: "primary strength description 2", relatedEventIds: [] },
    { id: "str_3", title: "primary strength 3", description: "primary strength description 3", relatedEventIds: [] },
  ];
}

function validWeaknesses() {
  return [
    { id: "wk_1", title: "primary weakness 1", description: "primary weakness description 1", relatedEventIds: [] },
    { id: "wk_2", title: "primary weakness 2", description: "primary weakness description 2", relatedEventIds: [] },
    { id: "wk_3", title: "primary weakness 3", description: "primary weakness description 3", relatedEventIds: [] },
  ];
}

function primaryAnalysisFixture(overrides = {}) {
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
    strengths: validStrengths(),
    weaknesses: validWeaknesses(),
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
    ...overrides,
  };
}

function normalizedFixture(matchId) {
  return {
    matchInfo: { matchId, queueLabel: "RANKED_SOLO" },
    playerContext: { riotId: "Insight#KR1", participantId: 1 },
    timelineEvents: [],
    phaseContext: {},
    playerStats: {},
    teamContext: {},
    derivedSignals: {},
  };
}

const strengthsHarness = createHarness(primaryAnalysisFixture({
  strengths: [
    { id: "", title: "malformed short strength", description: "malformed strength description", relatedEventIds: [] },
  ],
}));
const strengthsResult = await strengthsHarness.buildAnalysis(
  normalizedFixture("KR_INSIGHT_STRENGTH_SHAPE"),
  "sample-insight-strength-shape",
);

check("strengths primary analysis is preserved", strengthsResult.matchSummary?.headline, "primary headline");
check("strengths fallback is not used", strengthsHarness.state.fallbackCalls, 0);
check("strengths are repaired", strengthsResult.strengths?.map((item) => item.id), ["str_1", "str_2", "str_3"]);
check("strength repair called once", strengthsHarness.state.strengthRepairCalls, 1);
check("weakness repair not called for strengths scenario", strengthsHarness.state.weaknessRepairCalls, 0);
checkTrue(
  "schemaViolations include malformed strengths",
  strengthsResult.analysisMeta?.schemaViolations?.includes("shape.strengths.invalid"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short strengths as missing",
  !strengthsResult.analysisMeta?.schemaViolations?.includes("missing.strengths"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short strengths as count",
  !strengthsResult.analysisMeta?.schemaViolations?.includes("count.strengths<3"),
);
check("strengths schemaViolationCount", strengthsResult.analysisMeta?.schemaViolationCount, 1);

const weaknessesHarness = createHarness(primaryAnalysisFixture({
  weaknesses: [
    { id: "", title: "malformed short weakness", description: "malformed weakness description", relatedEventIds: [] },
  ],
}));
const weaknessesResult = await weaknessesHarness.buildAnalysis(
  normalizedFixture("KR_INSIGHT_WEAKNESS_SHAPE"),
  "sample-insight-weakness-shape",
);

check("weaknesses primary analysis is preserved", weaknessesResult.matchSummary?.headline, "primary headline");
check("weaknesses fallback is not used", weaknessesHarness.state.fallbackCalls, 0);
check("weaknesses are repaired", weaknessesResult.weaknesses?.map((item) => item.id), ["wk_1", "wk_2", "wk_3"]);
check("weakness repair called once", weaknessesHarness.state.weaknessRepairCalls, 1);
check("strength repair not called for weaknesses scenario", weaknessesHarness.state.strengthRepairCalls, 0);
checkTrue(
  "schemaViolations include malformed weaknesses",
  weaknessesResult.analysisMeta?.schemaViolations?.includes("shape.weaknesses.invalid"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short weaknesses as missing",
  !weaknessesResult.analysisMeta?.schemaViolations?.includes("missing.weaknesses"),
);
checkTrue(
  "schemaViolations do not misclassify malformed short weaknesses as count",
  !weaknessesResult.analysisMeta?.schemaViolations?.includes("count.weaknesses<3"),
);
check("weaknesses schemaViolationCount", weaknessesResult.analysisMeta?.schemaViolationCount, 1);

checkTrue(
  "server defines shared insight item shape helper",
  serverSrc.includes("function hasValidInsightItemShapes"),
);
checkTrue(
  "buildAnalysis checks strengths item shape before count",
  buildAnalysisSrc.includes("hasValidInsightItemShapes(primary.strengths)"),
);
checkTrue(
  "buildAnalysis checks weaknesses item shape before count",
  buildAnalysisSrc.includes("hasValidInsightItemShapes(primary.weaknesses)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
