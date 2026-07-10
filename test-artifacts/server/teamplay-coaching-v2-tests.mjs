import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  championKill,
  eliteKill,
  makeFrame,
  makeMatchFixture,
  makeTimelineFixture,
} from "../fixtures/teamplay-v2-fixtures.mjs";

const require = createRequire(import.meta.url);
const { makeFactId } = require("../../lib/teamplay-contract-v2.js");
const { buildTeamplayAnalysisV2 } = require(
  "../../lib/teamplay-analysis-v2.js",
);
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

function realSanitizerModel() {
  const facts = buildTeamplayAnalysisV2(
    makeMatchFixture(),
    makeTimelineFixture([makeFrame(590000, [
      championKill(605000, 2, 6, [1], { x: 5000, y: 5000 }),
      eliteKill(610000, 2, 100, "DRAGON", { x: 5000, y: 5000 }, [1]),
    ], { 1: { x: 5000, y: 5000 } })]),
    1,
  );
  return applyRecommendationSelections(facts, null);
}

function realSanitizerModelWithGold() {
  const facts = buildTeamplayAnalysisV2(
    makeMatchFixture(),
    makeTimelineFixture([
      makeFrame(540000, [
        championKill(550000, 1, 6, [], { x: 1000, y: 1000 }),
      ]),
      makeFrame(560000),
    ]),
    1,
  );
  return applyRecommendationSelections(facts, null);
}

function realSanitizerModelWithPostCaptureDeath() {
  const facts = buildTeamplayAnalysisV2(
    makeMatchFixture(),
    makeTimelineFixture([
      makeFrame(590000, [
        eliteKill(600000, 2, 100, "DRAGON", { x: 5000, y: 5000 }, [1]),
        championKill(650000, 6, 1, [], { x: 5100, y: 5000 }),
      ], { 1: { x: 5000, y: 5000 } }),
    ]),
    1,
  );
  return applyRecommendationSelections(facts, null);
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

test("stored facts require their closed value shape and stable ID", () => {
  const model = realSanitizerModel();
  assert.ok(model.personalReviews.length > 0);
  const review = model.personalReviews[0];
  review.situationFacts[0].value = { inventedResult: "WIN" };
  const result = sanitizeTeamplayAnalysisV2(model);
  assert.equal(result.rootValid, true);
  assert.equal(result.data.personalReviews.length, 0);
  assert.equal(result.data.teamAppendix.length, 0);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("stored narrative is regenerated and ineligible coaching is rejected", () => {
  const model = realSanitizerModel();
  const review = model.personalReviews[0];
  const unrelatedFactId = review.situationFacts[0].factId;
  review.narrative.decisionAssessment = {
    claimCode: "INVENTED_CAUSE",
    text: "이 플레이가 한타 패배의 원인입니다.",
    evidenceIds: [unrelatedFactId],
    source: "AI",
  };
  review.narrative.positioningObservation = {
    claimCode: "INVENTED_POSITION",
    text: "무조건 여기로 이동하세요.",
    evidenceIds: [unrelatedFactId],
    source: "AI",
  };
  review.narrative.coaching = {
    recommendationCode: "REVIEW_OPENING_DEATH",
    betterChoice: "첫 교환 전에 가까운 아군과 사용할 이탈 경로를 확인하세요.",
    nextGameRule: "첫 행동 전에 생존 경로 하나를 정하세요.",
    evidenceIds: [unrelatedFactId],
    selectionSource: "AI_SELECTED",
  };
  const result = sanitizeTeamplayAnalysisV2(model);
  const serialized = JSON.stringify(result.data);
  assert.ok(!serialized.includes("한타 패배의 원인"));
  assert.ok(!serialized.includes("무조건 여기로"));
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_AI_SELECTION"));
  assert.notEqual(
    result.data.personalReviews[0].narrative.coaching?.recommendationCode,
    "REVIEW_OPENING_DEATH",
  );
  assert.ok(result.data.personalReviews[0].narrative.factStatements.every((row) =>
    row.source === "SERVER_FACT_TEMPLATE"));
});

test("stored distance fact type and confidence must match frame values", () => {
  for (const mutate of [
    (factRow, reviewId) => {
      factRow.value.distance = 9000;
      factRow.factId = makeFactId(reviewId, factRow);
    },
    (factRow, reviewId) => {
      factRow.value.frameAgeSeconds = 10;
      factRow.confidence = "HIGH";
      factRow.factId = makeFactId(reviewId, factRow);
    },
  ]) {
    const model = realSanitizerModel();
    const review = model.personalReviews[0];
    const originalId = review.positioningFacts[0].factId;
    mutate(review.positioningFacts[0], review.reviewId);
    const replacementId = review.positioningFacts[0].factId;
    review.evidenceIds = review.evidenceIds.map((id) =>
      id === originalId ? replacementId : id);
    const result = sanitizeTeamplayAnalysisV2(model);
    assert.equal(result.data.personalReviews.length, 0);
    assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
  }
});

test("stored appendix is regenerated from validated review facts", () => {
  const model = realSanitizerModel();
  const appendix = model.teamAppendix[0];
  appendix.allyDeaths = 999;
  appendix.enemyDeaths = 999;
  appendix.captureTeam = "ALLY";
  appendix.factIds = ["invented"];
  appendix.allyDirectParticipants.push({
    participantId: 1,
    champion: "Injected",
    role: "TOP",
    puuid: "private-puuid",
  });
  const result = sanitizeTeamplayAnalysisV2(model);
  const safe = result.data.teamAppendix[0];
  const review = result.data.personalReviews[0];
  const allyDeaths = review.situationFacts.find((factRow) =>
    factRow.type === "ALLY_DEATH_COUNT")?.value.count ?? 0;
  const enemyDeaths = review.situationFacts.find((factRow) =>
    factRow.type === "ENEMY_DEATH_COUNT")?.value.count ?? 0;
  const captureTeam = review.situationFacts.find((factRow) =>
    factRow.type === "OBJECTIVE_CAPTURE_TEAM")?.value.team ?? null;
  assert.equal(safe.allyDeaths, allyDeaths);
  assert.equal(safe.enemyDeaths, enemyDeaths);
  assert.equal(safe.captureTeam, captureTeam);
  assert.ok(!safe.factIds.includes("invented"));
  assert.ok(!JSON.stringify(safe).includes("private-puuid"));
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("valid deterministic gold fact survives a strict sanitizer round trip", () => {
  const model = realSanitizerModelWithGold();
  const before = structuredClone(model.teamAppendix[0].preEncounterGoldDifference);
  assert.ok(before);
  const result = sanitizeTeamplayAnalysisV2(model, {
    preserveAppendixParticipants: true,
  });
  assert.deepEqual(
    result.data.teamAppendix[0].preEncounterGoldDifference,
    before,
  );
  assert.ok(!result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("tampered stored gold fact is removed from the regenerated appendix", () => {
  const model = realSanitizerModelWithGold();
  const review = model.personalReviews[0];
  const appendix = model.teamAppendix[0];
  const gold = appendix.preEncounterGoldDifference;
  const originalId = gold.factId;
  gold.value.allyGold += 1;
  gold.factId = makeFactId(review.reviewId, gold);
  appendix.factIds = appendix.factIds.map((id) =>
    id === originalId ? gold.factId : id);
  const result = sanitizeTeamplayAnalysisV2(model);
  assert.equal(result.data.teamAppendix[0].preEncounterGoldDifference, null);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("stored source refs reject extra private fields", () => {
  const model = realSanitizerModel();
  model.personalReviews[0].positioningFacts[0].sourceRefs[0].puuid = "private";
  const result = sanitizeTeamplayAnalysisV2(model);
  assert.equal(result.data.personalReviews.length, 0);
  assert.ok(!JSON.stringify(result.data).includes("private"));
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("duplicate appendix links fall back to one facts-only appendix", () => {
  const model = realSanitizerModel();
  model.teamAppendix.push({
    ...structuredClone(model.teamAppendix[0]),
    teamAppendixId: "appendix_injected",
    allyDirectParticipants: [{
      participantId: 5,
      champion: "Injected",
      role: "MIDDLE",
    }],
  });
  const result = sanitizeTeamplayAnalysisV2(model);
  assert.equal(result.data.teamAppendix.length, 1);
  assert.deepEqual(result.data.teamAppendix[0].allyDirectParticipants, []);
  assert.ok(!JSON.stringify(result.data).includes("Injected"));
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("stored facts must remain in their generated category", () => {
  const model = realSanitizerModel();
  const review = model.personalReviews[0];
  const [distance] = review.positioningFacts.splice(0, 1);
  review.decisionFacts.push(distance);
  const result = sanitizeTeamplayAnalysisV2(model);
  assert.equal(result.data.personalReviews.length, 0);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("stored team facts must match their referenced objective domain", () => {
  const model = realSanitizerModel();
  const review = model.personalReviews[0];
  const appendix = model.teamAppendix[0];
  const capture = review.situationFacts.find((factRow) =>
    factRow.type === "OBJECTIVE_CAPTURE_TEAM");
  const originalId = capture.factId;
  capture.value.team = capture.value.team === "ALLY" ? "ENEMY" : "ALLY";
  capture.factId = makeFactId(review.reviewId, capture);
  review.evidenceIds = review.evidenceIds.map((id) =>
    id === originalId ? capture.factId : id);
  appendix.captureTeam = capture.value.team;
  appendix.factIds = appendix.factIds.map((id) =>
    id === originalId ? capture.factId : id).sort();
  const result = sanitizeTeamplayAnalysisV2(model);
  assert.equal(result.data.personalReviews.length, 0);
  assert.equal(result.data.teamAppendix.length, 0);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("stored fallback does not trust appendix participant team assignment", () => {
  const model = realSanitizerModel();
  const appendix = model.teamAppendix[0];
  [appendix.allyDirectParticipants, appendix.enemyDirectParticipants] = [
    appendix.enemyDirectParticipants,
    appendix.allyDirectParticipants,
  ];
  const result = sanitizeTeamplayAnalysisV2(model);
  assert.deepEqual(result.data.teamAppendix[0].allyDirectParticipants, []);
  assert.deepEqual(result.data.teamAppendix[0].enemyDirectParticipants, []);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("stored post-capture seconds must match the objective timestamp delta", () => {
  const model = realSanitizerModelWithPostCaptureDeath();
  const review = model.personalReviews[0];
  const postDeath = review.outcomeFacts.find((factRow) =>
    factRow.type === "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE");
  const originalId = postDeath.factId;
  postDeath.value.secondsAfterCapture = 1;
  postDeath.factId = makeFactId(review.reviewId, postDeath);
  review.evidenceIds = review.evidenceIds.map((id) =>
    id === originalId ? postDeath.factId : id);
  const result = sanitizeTeamplayAnalysisV2(model);
  assert.ok(!result.data.personalReviews.some((row) =>
    row.reviewId === review.reviewId));
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("nested domain participant PII is isolated with its encounter", () => {
  const model = JSON.parse(JSON.stringify(realSanitizerModel()));
  model.encounters[0].participants.ally[0].puuid = "private-encounter";
  const result = sanitizeTeamplayAnalysisV2(model);
  assert.ok(!JSON.stringify(result.data).includes("private-encounter"));
  assert.equal(result.data.encounters.length, 0);
  assert.equal(result.data.personalReviews.length, 0);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("nested scene sourceRef PII is isolated with its scene", () => {
  const model = JSON.parse(JSON.stringify(realSanitizerModel()));
  model.scenes[0].sourceRefs[0].puuid = "private-scene";
  const result = sanitizeTeamplayAnalysisV2(model);
  assert.ok(!JSON.stringify(result.data).includes("private-scene"));
  assert.equal(result.data.scenes.length, 0);
  assert.equal(result.data.personalReviews.length, 0);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("stored pre-encounter gold rejects any future participant frame ref", () => {
  const model = JSON.parse(JSON.stringify(realSanitizerModelWithGold()));
  const review = model.personalReviews[0];
  const gold = model.teamAppendix[0].preEncounterGoldDifference;
  gold.sourceRefs[0].timestamp = review.startTimestamp + 1000;
  const result = sanitizeTeamplayAnalysisV2(model, {
    preserveAppendixParticipants: true,
  });
  assert.equal(result.data.teamAppendix[0].preEncounterGoldDifference, null);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("stored pre-encounter gold requires one shared ten-player frame", () => {
  const model = JSON.parse(JSON.stringify(realSanitizerModelWithGold()));
  const gold = model.teamAppendix[0].preEncounterGoldDifference;
  gold.sourceRefs[0].timestamp = gold.timestamp + 5000;
  const result = sanitizeTeamplayAnalysisV2(model, {
    preserveAppendixParticipants: true,
  });
  assert.equal(result.data.teamAppendix[0].preEncounterGoldDifference, null);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
