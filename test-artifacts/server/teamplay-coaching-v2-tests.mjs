import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildFactNarrative,
  eligibleRecommendations,
  validateRecommendationSelections,
  applyRecommendationSelections,
  sanitizeTeamplayAnalysisV2,
} = require("../../lib/teamplay-coaching-v2.js");

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

function fact(factId, type, confidence = "HIGH", value = {}) {
  return {
    factId,
    type,
    timestamp: 600000,
    value,
    confidence,
    sourceRefs: [{
      kind: "TIMELINE_EVENT",
      id: `event_${factId}`,
      timestamp: 600000,
      participantId: null,
    }],
    limitationCodes: [],
  };
}

function reviewWithOpeningDeathAndMediumDistance() {
  const death = fact("fact_death", "PLAYER_CONFIRMED_DEATH", "HIGH", {
    participantId: 1,
    phase: "OPENING",
    eventTimestamp: 600000,
  });
  const distance = fact("fact_distance", "PLAYER_DISTANCE_2500_5000", "MEDIUM", {
    distance: 3200,
    frameTimestamp: 590000,
    frameAgeSeconds: 10,
    stage: "ENCOUNTER",
  });
  return {
    reviewId: "review_1",
    sceneId: "scene_1",
    objectiveEngagementId: null,
    effectiveInvolvementLevel: "CONFIRMED",
    decisionFacts: [death],
    positioningFacts: [distance],
    outcomeFacts: [],
    situationFacts: [],
    evidenceIds: [death.factId, distance.factId],
  };
}

function objectiveReviewFarFromFight() {
  const capture = fact(
    "fact_capture",
    "OBJECTIVE_CAPTURE_TEAM",
    "HIGH",
    { team: "ENEMY" },
  );
  const distance = fact("fact_far", "PLAYER_DISTANCE_GT_5000", "MEDIUM", {
    distance: 6200,
    stage: "SETUP",
    frameTimestamp: 590000,
    frameAgeSeconds: 10,
  });
  return {
    reviewId: "review_objective",
    sceneId: "scene_objective",
    objectiveEngagementId: "obj_1",
    encounterIds: [],
    startTimestamp: 510000,
    endTimestamp: 720000,
    sourceRefs: [capture.sourceRefs[0], distance.sourceRefs[0]],
    confidence: "MEDIUM",
    limitationCodes: [],
    importanceScore: 40,
    involvements: [],
    effectiveInvolvementLevel: "APPROXIMATE",
    situationFacts: [capture],
    decisionFacts: [],
    positioningFacts: [distance],
    outcomeFacts: [],
    evidenceIds: [capture.factId, distance.factId],
    narrative: null,
    teamAppendixId: "appendix_1",
  };
}

function objectiveModel() {
  const review = objectiveReviewFarFromFight();
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
      startTimestamp: 580000,
      endTimestamp: 720000,
      sourceRefs: [{
        kind: "TIMELINE_EVENT",
        id: "event_obj_1",
        timestamp: 600000,
        participantId: null,
      }],
      confidence: "HIGH",
      limitationCodes: [],
      linkedEncounterIds: [],
    }],
    scenes: [{
      sceneId: "scene_objective",
      objectiveEngagementId: "obj_1",
      encounterIds: [],
      startTimestamp: 510000,
      endTimestamp: 720000,
      importanceScore: 40,
      involvements: [],
      effectiveInvolvementLevel: "APPROXIMATE",
    }],
    personalReviews: [review],
    teamAppendix: [{
      teamAppendixId: "appendix_1",
      reviewId: review.reviewId,
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

function multiEligibleModel() {
  const model = objectiveModel();
  const review = model.personalReviews[0];
  const noAlly = fact(
    "fact_no_ally",
    "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT",
    "MEDIUM",
    { frameTimestamp: 590000, frameAgeSeconds: 10, radius: 2500 },
  );
  const allyCapture = fact(
    "fact_ally_capture",
    "OBJECTIVE_CAPTURE_TEAM",
    "HIGH",
    { team: "ALLY" },
  );
  const postDeath = fact(
    "fact_post_death",
    "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE",
    "HIGH",
    { eventTimestamp: 650000, secondsAfterCapture: 40 },
  );
  review.positioningFacts.push(noAlly);
  review.situationFacts = [allyCapture];
  review.outcomeFacts.push(postDeath);
  review.evidenceIds.push(noAlly.factId, allyCapture.factId, postDeath.factId);
  return model;
}

function modelWithOneBrokenSceneReference() {
  const model = objectiveModel();
  model.personalReviews[0] = {
    ...model.personalReviews[0],
    sceneId: "missing_scene",
  };
  return model;
}

test("fact narrative is server rendered", () => {
  const narrative = buildFactNarrative(reviewWithOpeningDeathAndMediumDistance());
  assert.ok(narrative.factStatements.every((row) =>
    row.source === "SERVER_FACT_TEMPLATE"));
  assert.equal(narrative.decisionAssessment.claimCode, "PLAYER_RECORDED_DEATH");
  assert.equal(narrative.decisionAssessment.source, "SERVER_FACT_TEMPLATE");
  assert.equal(
    narrative.positioningObservation.claimCode,
    "POSITION_DISTANCE_2500_5000",
  );
});

test("eligible codes expose only permitted evidence", () => {
  const rows = eligibleRecommendations(objectiveReviewFarFromFight(), objectiveModel());
  assert.deepEqual(
    rows.map((row) => row.recommendationCode),
    ["DECIDE_JOIN_OR_TRADE_EARLY"],
  );
  assert.ok(rows[0].evidenceIds.every((id) => id.startsWith("fact_")));
});

test("invalid AI code and unrelated evidence are rejected per review", () => {
  const model = objectiveModel();
  const result = validateRecommendationSelections({
    reviews: [{
      reviewId: model.personalReviews[0].reviewId,
      recommendationCode: "INVENT_FLASH_COMBO",
      evidenceIds: model.personalReviews[0].evidenceIds,
    }],
  }, model);
  assert.deepEqual(result.validSelections, []);
  assert.deepEqual(result.invalidReviewIds, [model.personalReviews[0].reviewId]);
});

test("valid AI selection renders fixed text", () => {
  const model = objectiveModel();
  const before = structuredClone(model);
  const reviewId = model.personalReviews[0].reviewId;
  const eligible = eligibleRecommendations(model.personalReviews[0], model)[0];
  const merged = applyRecommendationSelections(model, {
    reviews: [{
      reviewId,
      recommendationCode: eligible.recommendationCode,
      evidenceIds: eligible.evidenceIds,
    }],
  });
  assert.equal(
    merged.personalReviews[0].narrative.coaching.selectionSource,
    "AI_SELECTED",
  );
  assert.equal(
    merged.personalReviews[0].narrative.coaching.nextGameRule,
    "오브젝트 30초 전 5,000보다 멀면 합류와 교환 중 하나를 결정하세요.",
  );
  assert.deepEqual(model, before);
});

test("duplicate review IDs invalidate every duplicate row", () => {
  const model = objectiveModel();
  const eligible = eligibleRecommendations(model.personalReviews[0], model)[0];
  const row = {
    reviewId: model.personalReviews[0].reviewId,
    recommendationCode: eligible.recommendationCode,
    evidenceIds: eligible.evidenceIds,
  };
  const result = validateRecommendationSelections({ reviews: [row, { ...row }] }, model);
  assert.deepEqual(result.validSelections, []);
  assert.deepEqual(result.invalidReviewIds, [row.reviewId]);
});

test("invalid selection falls back per review and records the limitation", () => {
  const model = objectiveModel();
  const merged = applyRecommendationSelections(model, {
    reviews: [{
      reviewId: model.personalReviews[0].reviewId,
      recommendationCode: "INVENTED",
      evidenceIds: ["fact_far"],
    }],
  });
  assert.equal(
    merged.personalReviews[0].narrative.coaching.selectionSource,
    "RULE_FALLBACK",
  );
  assert.ok(merged.coverage.limitationCodes.includes("INVALID_AI_SELECTION"));
});

test("AI failure uses deterministic fallback priority", () => {
  const merged = applyRecommendationSelections(multiEligibleModel(), null);
  assert.equal(
    merged.personalReviews[0].narrative.coaching.recommendationCode,
    "RESET_AFTER_CAPTURE",
  );
  assert.equal(
    merged.personalReviews[0].narrative.coaching.selectionSource,
    "RULE_FALLBACK",
  );
});

test("root fatal error differs from item error", () => {
  assert.equal(sanitizeTeamplayAnalysisV2(null).rootValid, false);
  const result = sanitizeTeamplayAnalysisV2(modelWithOneBrokenSceneReference());
  assert.equal(result.rootValid, true);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
  assert.equal(result.data.personalReviews.length, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
