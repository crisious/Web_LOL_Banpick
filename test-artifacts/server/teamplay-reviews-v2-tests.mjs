import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  makeMatchFixture,
  makeFrame,
  makeTimelineFixture,
  championKill,
  eliteKill,
} from "../fixtures/teamplay-v2-fixtures.mjs";

const require = createRequire(import.meta.url);
const { extractTeamplaySource } = require("../../lib/teamplay-source-v2.js");
const {
  buildScenes,
  scoreScene,
  buildCoverage,
} = require("../../lib/teamplay-reviews-v2.js");
const { buildTeamplayAnalysisV2 } = require("../../lib/teamplay-analysis-v2.js");

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

const NOT_INVOLVED = { level: "NOT_INVOLVED", records: [] };
const CONFIRMED_ASSIST = {
  level: "CONFIRMED",
  records: [{
    timestamp: 100000,
    basis: "ASSIST",
    stage: "ENCOUNTER",
    sourceRefs: [{
      kind: "TIMELINE_EVENT",
      id: "KR_TEAMPLAY_FIXTURE:0:0",
      timestamp: 100000,
      participantId: null,
    }],
    distance: null,
    frameAgeSeconds: null,
  }],
};

function modelFromFrames(frames) {
  return buildTeamplayAnalysisV2(
    makeMatchFixture(),
    makeTimelineFixture(frames),
    1,
  );
}

function buildModelWithLinkedObjectiveEncounter() {
  return modelFromFrames([
    makeFrame(600000, [
      championKill(605000, 2, 6, [1], { x: 5000, y: 5000 }),
      eliteKill(610000, 2, 100, "DRAGON", { x: 5000, y: 5000 }),
    ]),
  ]);
}

function buildSceneWithObjectiveNotInvolvedAndEncounterConfirmed() {
  const source = extractTeamplaySource(
    makeMatchFixture(),
    makeTimelineFixture([makeFrame(0)]),
    1,
  );
  const encounter = {
    id: "enc_1",
    type: "PICK",
    startTimestamp: 100000,
    endTimestamp: 110000,
    sourceRefs: [{
      kind: "TIMELINE_EVENT",
      id: "event_1",
      timestamp: 100000,
      participantId: null,
    }],
    playerInvolvement: CONFIRMED_ASSIST,
    confidence: "HIGH",
    limitationCodes: [],
    allyDeaths: 0,
    enemyDeaths: 1,
    firstTakedownTeam: "ALLY",
  };
  const objective = {
    id: "obj_1",
    sourceRefs: [{
      kind: "TIMELINE_EVENT",
      id: "event_2",
      timestamp: 110000,
      participantId: null,
    }],
    setupWindow: { startMs: 20000 },
    contestWindow: { linkedEncounterIds: ["enc_1"] },
    conversionWindow: { endMsExclusive: 230000 },
    linkedEncounterIds: ["enc_1"],
    linkedEncounterInvolvements: [{
      encounterId: "enc_1",
      associationConfidence: "HIGH",
    }],
    playerInvolvement: NOT_INVOLVED,
    confidence: "HIGH",
    limitationCodes: [],
    structureConversions: [],
  };
  return buildScenes(source, [encounter], [objective])[0];
}

function buildRepeatableModel() {
  return buildModelWithLinkedObjectiveEncounter();
}

function buildSixEqualScenesModel() {
  const events = Array.from({ length: 6 }, (_, index) =>
    championKill(100000 + index * 100000, 1, 6, [], { x: 1000, y: 1000 }));
  return modelFromFrames([makeFrame(0, events)]);
}

function buildCoverageModel(mode) {
  if (mode === "all") {
    return modelFromFrames([
      makeFrame(100000, [
        championKill(100000, 1, 6, [], { x: 1000, y: 1000 }),
      ]),
      makeFrame(200000, [
        championKill(200000, 1, 6, [], { x: 1000, y: 1000 }),
      ]),
    ]);
  }
  if (mode === "some") {
    return modelFromFrames([
      makeFrame(100000, [
        championKill(100000, 1, 6, [], { x: 1000, y: 1000 }),
        championKill(200000, 1, 6, [], { x: 1000, y: 1000 }),
      ]),
    ]);
  }
  return modelFromFrames([
    makeFrame(0, [
      championKill(100000, 1, 6, [], { x: 1000, y: 1000 }),
    ]),
  ]);
}

function modelWithFramesBeforeAndAfterScene() {
  return modelFromFrames([
    makeFrame(540000, [
      championKill(550000, 1, 6, [], { x: 1000, y: 1000 }),
    ]),
    makeFrame(560000),
  ]);
}

function modelWithPostCaptureTargetDeath() {
  return modelFromFrames([
    makeFrame(590000, [
      eliteKill(600000, 2, 100, "DRAGON", { x: 5000, y: 5000 }, [1]),
      championKill(650000, 6, 1, [], { x: 5100, y: 5000 }),
    ], { 1: { x: 5000, y: 5000 } }),
  ]);
}

test("objective-linked encounter produces one scene and one review", () => {
  const model = buildModelWithLinkedObjectiveEncounter();
  assert.equal(model.scenes.length, 1);
  assert.equal(model.personalReviews.length, 1);
  assert.equal(
    model.personalReviews[0].objectiveEngagementId,
    model.objectiveEngagements[0].id,
  );
  assert.deepEqual(
    model.personalReviews[0].encounterIds,
    [model.encounters[0].id],
  );
});

test("scene effective level keeps original domain involvement", () => {
  const scene = buildSceneWithObjectiveNotInvolvedAndEncounterConfirmed();
  assert.equal(scene.involvements[0].playerInvolvement.level, "NOT_INVOLVED");
  assert.equal(scene.involvements[1].playerInvolvement.level, "CONFIRMED");
  assert.equal(scene.effectiveInvolvementLevel, "CONFIRMED");
});

test("importance score follows the approved weights", () => {
  const scene = {
    primaryType: "OBJECTIVE",
    effectiveInvolvementLevel: "CONFIRMED",
    objectiveEngagementId: "obj_1",
    encounterIds: ["enc_1"],
    playerFirstRecordedInvolvement: true,
    allyDeaths: 3,
    enemyDeaths: 0,
    structureConversionCount: 1,
  };
  assert.equal(scoreScene(scene, { encounterType: "TEAMFIGHT_CANDIDATE" }), 115);
});

test("review facts use closed types and stable IDs", () => {
  const model = buildRepeatableModel();
  const firstIds = model.personalReviews.flatMap((review) => review.evidenceIds);
  const secondIds = buildRepeatableModel().personalReviews
    .flatMap((review) => review.evidenceIds);
  assert.deepEqual(firstIds, secondIds);
  assert.ok(model.personalReviews.every((review) =>
    review.evidenceIds.every((id) => id.startsWith("fact_"))));
});

test("review cap is five with deterministic tie order", () => {
  const model = buildSixEqualScenesModel();
  assert.equal(model.personalReviews.length, 5);
  assert.deepEqual(
    model.personalReviews.map((review) => review.startTimestamp),
    [100000, 200000, 300000, 400000, 500000],
  );
});

test("not-involved scenes never become personal reviews", () => {
  const model = modelFromFrames([
    makeFrame(90000, [
      championKill(100000, 2, 6, [], { x: 9000, y: 9000 }),
    ], { 1: { x: 1000, y: 1000 } }),
  ]);
  assert.equal(model.scenes[0].effectiveInvolvementLevel, "NOT_INVOLVED");
  assert.equal(model.personalReviews.length, 0);
});

test("coverage uses all candidates before the top-five response cap", () => {
  const events = Array.from({ length: 6 }, (_, index) =>
    championKill(100000 + index * 100000, 1, 6, [], { x: 1000, y: 1000 }));
  const frames = events.map((event) => makeFrame(event.timestamp, [event], {
    1: { x: 1000, y: 1000 },
  }));
  const model = modelFromFrames(frames);
  assert.equal(model.personalReviews.length, 5);
  assert.equal(model.coverage.level, "FULL");
  assert.equal(model.coverage.usablePositionSceneRatio, 1);
});

test("coverage distinguishes full partial and event only", () => {
  assert.equal(buildCoverageModel("all").coverage.level, "FULL");
  assert.equal(buildCoverageModel("some").coverage.level, "PARTIAL");
  assert.equal(buildCoverageModel("none").coverage.level, "EVENT_ONLY");
});

test("pre-encounter gold never uses a later frame", () => {
  const appendix = modelWithFramesBeforeAndAfterScene().teamAppendix[0];
  assert.equal(appendix.preEncounterGoldDifference.value.snapshotTimestamp, 540000);
  assert.ok(appendix.preEncounterGoldDifference.value.snapshotTimestamp <= 550000);
});

test("confirmed objective participant receives factual post-capture death outcome", () => {
  const review = modelWithPostCaptureTargetDeath().personalReviews[0];
  const fact = review.outcomeFacts.find((row) =>
    row.type === "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE");
  assert.equal(fact.value.secondsAfterCapture, 50);
});

test("team appendix direct participants use numeric participant order", () => {
  const model = modelFromFrames([
    makeFrame(100000, [
      championKill(100000, 2, 6, [1], { x: 1000, y: 1000 }),
      championKill(108000, 3, 7, [4], { x: 1100, y: 1000 }),
      championKill(116000, 5, 8, [9, 10], { x: 1200, y: 1000 }),
    ]),
  ]);
  assert.deepEqual(
    model.teamAppendix[0].enemyDirectParticipants.map((row) => row.participantId),
    [6, 7, 8, 9, 10],
  );
});

test("coverage helper is exported for contract consumers", () => {
  assert.equal(typeof buildCoverage, "function");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
