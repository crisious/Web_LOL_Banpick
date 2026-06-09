// server.js buildAnalysis metadata normalization regression tests

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
  extractFunctionSource(serverSrc, "hasValidKeyMoments"),
  extractFunctionSource(serverSrc, "hasValidPhaseSummaries"),
  extractFunctionSource(serverSrc, "hasAnalysisMetaObject"),
  extractFunctionSource(serverSrc, "hasValidMatchSummary"),
  extractFunctionSource(serverSrc, "hasValidCoachSummary"),
  extractFunctionSource(serverSrc, "hasValidEvidenceIndex"),
  extractFunctionSource(serverSrc, "hasValidActionChecklist"),
  extractFunctionSource(serverSrc, "hasValidInsightItemShapes"),
  extractFunctionSource(serverSrc, "hasValidInsightList"),
  extractFunctionSource(serverSrc, "hasValidCombatAnalysis"),
  extractFunctionSource(serverSrc, "hasValidTeamfightPhaseAnalysis"),
  extractFunctionSource(serverSrc, "validateAnalysisOutput"),
].join("\n");

const state = {
  fallbackCalls: 0,
  primaryResponse: primaryAnalysisFixture(),
  console: { log() {}, error() {} },
};

const buildAnalysis = new Function("state", `
  const console = state.console;
  ${supportSources}

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function buildLlmPayload() {
    return { teamfightPhases: [] };
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
      strengths: [
        { id: "str_1", title: "fallback strength 1", description: "fallback strength description 1", relatedEventIds: [] },
        { id: "str_2", title: "fallback strength 2", description: "fallback strength description 2", relatedEventIds: [] },
        { id: "str_3", title: "fallback strength 3", description: "fallback strength description 3", relatedEventIds: [] },
      ],
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
    return [
      { phase: "EARLY", summary: "fallback early" },
      { phase: "MID", summary: "fallback mid" },
      { phase: "LATE", summary: "fallback late" },
    ];
  }
  function buildKeyMoments() {
    return buildRuleBasedAnalysis().keyMoments;
  }
  function buildEvidenceIndex() {
    return [{ eventId: "evt_001", summary: "fallback evidence" }];
  }
  function buildStrengths() {
    return buildRuleBasedAnalysis().strengths;
  }
  function buildWeaknesses() {
    return buildRuleBasedAnalysis().weaknesses;
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
    schemaVersion: "   ",
    analysisMeta: { sourceType: "   ", language: "\t" },
    matchSummary: { headline: "primary headline" },
    coachSummary: { overallSummary: "primary coach summary" },
    phaseSummaries: [
      { phase: "EARLY", summary: "primary early summary" },
      { phase: "MID", summary: "primary mid summary" },
      { phase: "LATE", summary: "primary late summary" },
    ],
    strengths: [
      { id: "str_1", title: "primary strength 1", description: "primary strength description 1", relatedEventIds: [] },
      { id: "str_2", title: "primary strength 2", description: "primary strength description 2", relatedEventIds: [] },
      { id: "str_3", title: "primary strength 3", description: "primary strength description 3", relatedEventIds: [] },
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
    matchInfo: { matchId: "KR_META", queueLabel: "RANKED_SOLO" },
    playerContext: { riotId: "Meta#KR1", participantId: 1 },
    timelineEvents: [],
    phaseContext: {},
    playerStats: {},
    teamContext: {},
    derivedSignals: {},
  };
}

const result = await buildAnalysis(normalizedFixture(), "sample-meta");

check("primary analysis is preserved", result.matchSummary?.headline, "primary headline");
check("fallback is not used", state.fallbackCalls, 0);
check("schemaVersion whitespace normalizes", result.schemaVersion, "1.0");
check("sourceType whitespace normalizes", result.analysisMeta?.sourceType, "claude_ai");
check("language tab normalizes", result.analysisMeta?.language, "ko");
checkTrue("schemaViolations include schemaVersion", result.analysisMeta?.schemaViolations?.includes("missing.schemaVersion"));
checkTrue("schemaViolations include sourceType", result.analysisMeta?.schemaViolations?.includes("missing.analysisMeta.sourceType"));
checkTrue("schemaViolations include language", result.analysisMeta?.schemaViolations?.includes("missing.analysisMeta.language"));
check("schemaViolationCount", result.analysisMeta?.schemaViolationCount, 3);

checkTrue(
  "buildAnalysis uses nonblank schemaVersion normalization",
  buildAnalysisSrc.includes("!isNonBlankString(primary.schemaVersion)"),
);
checkTrue(
  "buildAnalysis uses nonblank sourceType normalization",
  buildAnalysisSrc.includes("!isNonBlankString(primary.analysisMeta.sourceType)"),
);
checkTrue(
  "buildAnalysis uses nonblank language normalization",
  buildAnalysisSrc.includes("!isNonBlankString(primary.analysisMeta.language)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
