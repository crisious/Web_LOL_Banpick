import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  applyRecommendationSelections,
  buildRecommendationCandidatePayload,
  createUnavailableTeamplayEnvelope,
  sanitizeTeamplayAnalysisV2,
} = require("../../lib/teamplay-coaching-v2.js");
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function not found: ${name}`);
  let depth = 0;
  let opened = false;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") { depth += 1; opened = true; }
    if (source[index] === "}") {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`function not closed: ${name}`);
}

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
    pass += 1;
  } catch (error) {
    console.log(`FAIL  ${name}\n  ${error.message}`);
    fail += 1;
  }
}

function validTeamplayModel() {
  const sourceRef = {
    kind: "TIMELINE_EVENT",
    id: "event_far",
    timestamp: 600000,
    participantId: null,
  };
  const fact = {
    factId: "fact_far",
    type: "PLAYER_DISTANCE_GT_5000",
    timestamp: 600000,
    value: {
      distance: 6200,
      stage: "SETUP",
      frameTimestamp: 590000,
      frameAgeSeconds: 10,
    },
    confidence: "MEDIUM",
    sourceRefs: [sourceRef],
    limitationCodes: [],
  };
  return {
    schemaVersion: "2.0",
    coverage: {
      level: "PARTIAL",
      source: "RAW_TIMELINE",
      usablePositionSceneRatio: 1,
      limitationCodes: [],
    },
    encounters: [],
    objectiveEngagements: [{
      id: "obj_1",
      startTimestamp: 510000,
      endTimestamp: 720000,
      sourceRefs: [{ ...sourceRef, id: "event_obj_1" }],
      confidence: "HIGH",
      limitationCodes: [],
      linkedEncounterIds: [],
    }],
    scenes: [{
      sceneId: "scene_1",
      objectiveEngagementId: "obj_1",
      encounterIds: [],
      startTimestamp: 510000,
      endTimestamp: 720000,
      importanceScore: 40,
      involvements: [],
      effectiveInvolvementLevel: "APPROXIMATE",
    }],
    personalReviews: [{
      reviewId: "review_1",
      sceneId: "scene_1",
      objectiveEngagementId: "obj_1",
      encounterIds: [],
      startTimestamp: 510000,
      endTimestamp: 720000,
      sourceRefs: [sourceRef],
      confidence: "MEDIUM",
      limitationCodes: [],
      importanceScore: 40,
      involvements: [],
      effectiveInvolvementLevel: "APPROXIMATE",
      situationFacts: [],
      decisionFacts: [],
      positioningFacts: [fact],
      outcomeFacts: [],
      evidenceIds: [fact.factId],
      narrative: null,
      teamAppendixId: "appendix_1",
    }],
    teamAppendix: [{
      teamAppendixId: "appendix_1",
      reviewId: "review_1",
      allyDirectParticipants: [],
      enemyDirectParticipants: [],
      firstTakedownTeam: "UNKNOWN",
      allyDeaths: 0,
      enemyDeaths: 0,
      preEncounterGoldDifference: null,
      captureTeam: "ENEMY",
      structureConversions: [],
      factIds: [],
      limitationCodes: [],
    }],
  };
}

const buildNormalizedSrc = extractFunctionSource(serverSrc, "buildNormalized");
const buildRuleBasedAnalysisSrc = extractFunctionSource(serverSrc, "buildRuleBasedAnalysis");

test("server imports the deterministic teamplay builder", () => {
  assert.ok(serverSrc.includes('require("./lib/teamplay-analysis-v2")'));
});

test("normalization attaches deterministic teamplay v2", () => {
  assert.ok(buildNormalizedSrc.includes(
    "normalized.teamplayAnalysisV2 = buildTeamplayAnalysisV2(",
  ));
});

test("rule fallback attaches closed teamplay coaching", () => {
  assert.ok(buildRuleBasedAnalysisSrc.includes(
    "teamplayAnalysisV2: applyRecommendationSelections(",
  ));
});

test("AI selection injection cannot alter deterministic facts", () => {
  const mergeSrc = extractFunctionSource(
    serverSrc,
    "mergeTeamplayRecommendationSelections",
  );
  const mergeTeamplayRecommendationSelections = new Function(
    "applyRecommendationSelections",
    "buildRecommendationCandidatePayload",
    "sanitizeTeamplayAnalysisV2",
    "createUnavailableTeamplayEnvelope",
    `${mergeSrc}\nreturn mergeTeamplayRecommendationSelections;`,
  )(
    applyRecommendationSelections,
    buildRecommendationCandidatePayload,
    sanitizeTeamplayAnalysisV2,
    createUnavailableTeamplayEnvelope,
  );

  const model = validTeamplayModel();
  const deterministicFacts = JSON.stringify(model.personalReviews[0].positioningFacts);
  const primary = {
    teamplayRecommendationSelections: {
      reviews: [{
        reviewId: "review_1",
        recommendationCode: "DECIDE_JOIN_OR_TRADE_EARLY",
        evidenceIds: ["fact_far"],
        factText: "AI가 만든 근거 문장",
        timestamp: 1,
      }],
    },
  };
  const violations = [];

  mergeTeamplayRecommendationSelections(primary, model, violations);

  assert.equal("teamplayRecommendationSelections" in primary, false);
  assert.equal(
    JSON.stringify(primary.teamplayAnalysisV2.personalReviews[0].positioningFacts),
    deterministicFacts,
  );
  assert.ok(primary.teamplayAnalysisV2.coverage.limitationCodes.includes(
    "INVALID_AI_SELECTION",
  ));
  assert.equal(
    primary.teamplayAnalysisV2.personalReviews[0].narrative.coaching.selectionSource,
    "RULE_FALLBACK",
  );
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
