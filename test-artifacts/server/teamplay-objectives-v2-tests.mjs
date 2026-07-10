import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  makeMatchFixture,
  makeFrame,
  makeTimelineFixture,
  championKill,
  eliteKill,
  buildingKill,
} from "../fixtures/teamplay-v2-fixtures.mjs";

const require = createRequire(import.meta.url);
const { extractTeamplaySource } = require("../../lib/teamplay-source-v2.js");
const { buildEncounters } = require("../../lib/teamplay-encounters-v2.js");
const { buildObjectiveEngagements } = require("../../lib/teamplay-objectives-v2.js");

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

function runObjectiveModel({ objectives = [], kills = [], structures = [], frames = null }) {
  const timelineFrames = frames || [makeFrame(0, [...kills, ...objectives, ...structures])];
  const source = extractTeamplaySource(
    makeMatchFixture(),
    makeTimelineFixture(timelineFrames),
    1,
  );
  return buildObjectiveEngagements(source, buildEncounters(source));
}

function grubAt(timestamp, killerId, killerTeamId) {
  return eliteKill(timestamp, killerId, killerTeamId, "VOID_GRUB", { x: 5000, y: 5000 });
}

function dragonAt(timestamp, killerTeamId) {
  const killerId = killerTeamId === 100 ? 2 : killerTeamId === 200 ? 7 : null;
  return eliteKill(timestamp, killerId, killerTeamId, "DRAGON", { x: 5000, y: 5000 });
}

function heraldAt(timestamp, killerTeamId) {
  const killerId = killerTeamId === 100 ? 2 : killerTeamId === 200 ? 7 : null;
  return eliteKill(timestamp, killerId, killerTeamId, "RIFTHERALD", { x: 5000, y: 5000 });
}

function buildObjectiveFixture(objectives) {
  return runObjectiveModel({ objectives }).objectiveEngagements;
}

function objectivesWithOneEncounterAt(timestamp, objectives) {
  return runObjectiveModel({
    objectives,
    kills: [championKill(timestamp, 1, 6, [2], { x: 5000, y: 5000 })],
  });
}

function objectiveWithStructure(captureTimestamp, structureTimestamp, takerTeamId) {
  const killerId = takerTeamId === 100 ? 2 : 7;
  const destroyedTeamId = takerTeamId === 100 ? 200 : 100;
  return runObjectiveModel({
    objectives: [dragonAt(captureTimestamp, takerTeamId)],
    structures: [
      buildingKill(
        structureTimestamp,
        killerId,
        destroyedTeamId,
        { x: 5100, y: 5000 },
      ),
    ],
  });
}

function unknownObjective() {
  return runObjectiveModel({
    objectives: [eliteKill(600000, null, null, "DRAGON", { x: 5000, y: 5000 })],
  }).objectiveEngagements[0];
}

function objectiveLinkedToTargetAssistWithoutObjectiveAssist() {
  return runObjectiveModel({
    objectives: [dragonAt(610000, 100)],
    kills: [championKill(605000, 2, 6, [1], { x: 5000, y: 5000 })],
  }).objectiveEngagements[0];
}

function objectiveWithDirectAssist() {
  return runObjectiveModel({
    objectives: [eliteKill(
      610000,
      2,
      100,
      "DRAGON",
      { x: 5000, y: 5000 },
      [1],
    )],
  }).objectiveEngagements[0];
}

function objectiveWithFramesAt(frameTimes) {
  const frames = frameTimes.map((timestamp) =>
    makeFrame(
      timestamp,
      timestamp === 600000 ? [dragonAt(600000, 100)] : [],
    ));
  return runObjectiveModel({ frames }).objectiveEngagements[0];
}

test("split grubs become one camp with per-side counts", () => {
  const output = buildObjectiveFixture([
    grubAt(300000, 2, 100),
    grubAt(312000, 7, 200),
    grubAt(325000, 3, 100),
  ]);
  assert.equal(output.length, 1);
  assert.equal(output[0].objectiveType, "VOID_GRUB_CAMP");
  assert.deepEqual(output[0].captureCounts, { ally: 2, enemy: 1, unknown: 0 });
  assert.equal(output[0].captureTeam, "SPLIT");
  assert.equal(output[0].contestWindow.startMs, 280000);
  assert.equal(output[0].contestWindow.endMsExclusive, 345000);
  assert.equal(output[0].conversionWindow.startMs, 325000);
});

test("grub grouping honors 20-second adjacent and 60-second total boundaries", () => {
  assert.equal(buildObjectiveFixture([
    grubAt(300000, 2, 100),
    grubAt(320000, 2, 100),
  ]).length, 1);
  assert.equal(buildObjectiveFixture([
    grubAt(300000, 2, 100),
    grubAt(320001, 2, 100),
  ]).length, 2);
  assert.equal(buildObjectiveFixture([
    grubAt(300000, 2, 100),
    grubAt(320000, 2, 100),
    grubAt(340000, 2, 100),
    grubAt(360000, 2, 100),
  ]).length, 1);
  assert.equal(buildObjectiveFixture([
    grubAt(300000, 2, 100),
    grubAt(320000, 2, 100),
    grubAt(340000, 2, 100),
    grubAt(360000, 2, 100),
    grubAt(360001, 2, 100),
  ]).length, 2);
});

test("overlapping nominal windows assign combat once to nearest anchor", () => {
  const output = objectivesWithOneEncounterAt(590000, [
    dragonAt(600000, 100),
    heraldAt(610000, 200),
  ]);
  const linkedCount = output.objectiveEngagements
    .filter((row) => row.linkedEncounterIds.length > 0).length;
  assert.equal(linkedCount, 1);
});

test("structure in first 20 seconds is a conversion", () => {
  const output = objectiveWithStructure(600000, 610000, 100);
  assert.equal(output.objectiveEngagements[0].structureConversions.length, 1);
});

test("conversion window includes start and excludes end", () => {
  assert.equal(objectiveWithStructure(600000, 600000, 100)
    .objectiveEngagements[0].structureConversions.length, 1);
  assert.equal(objectiveWithStructure(600000, 719999, 100)
    .objectiveEngagements[0].structureConversions.length, 1);
  assert.equal(objectiveWithStructure(600000, 720000, 100)
    .objectiveEngagements[0].structureConversions.length, 0);
});

test("conversion ownership respects capture side and split preserves both", () => {
  const wrongSide = runObjectiveModel({
    objectives: [dragonAt(600000, 100)],
    structures: [buildingKill(610000, 7, 100, { x: 5100, y: 5000 })],
  });
  assert.equal(wrongSide.objectiveEngagements[0].structureConversions.length, 0);

  const split = runObjectiveModel({
    objectives: [grubAt(600000, 2, 100), grubAt(610000, 7, 200)],
    structures: [
      buildingKill(620000, 2, 200, { x: 5100, y: 5000 }),
      buildingKill(625000, 7, 100, { x: 5200, y: 5000 }),
    ],
  }).objectiveEngagements[0];
  assert.deepEqual(
    split.structureConversions.map((row) => row.takerRelation).sort(),
    ["ALLY", "ENEMY"],
  );
});

test("a later neutral objective is a single-assigned conversion macro ref", () => {
  const output = runObjectiveModel({
    objectives: [dragonAt(600000, 100), heraldAt(650000, 200)],
  }).objectiveEngagements;
  const heraldRef = output[1].sourceRefs[0].id;
  assert.ok(output[0].conversionWindow.sourceRefs.some((ref) => ref.id === heraldRef));
  assert.ok(!output[1].conversionWindow.sourceRefs.some((ref) => ref.id === heraldRef));
});

test("setup and contest windows are half-open", () => {
  const startIncluded = objectivesWithOneEncounterAt(510000, [dragonAt(600000, 100)]);
  const setupEndExcluded = objectivesWithOneEncounterAt(580000, [dragonAt(600000, 100)]);
  const contestEndExcluded = objectivesWithOneEncounterAt(620000, [dragonAt(600000, 100)]);
  assert.deepEqual(
    startIncluded.objectiveEngagements[0].setupWindow.linkedEncounterIds,
    [startIncluded.encounters[0].id],
  );
  assert.deepEqual(
    setupEndExcluded.objectiveEngagements[0].contestWindow.linkedEncounterIds,
    [setupEndExcluded.encounters[0].id],
  );
  assert.equal(contestEndExcluded.objectiveEngagements[0].linkedEncounterIds.length, 0);
});

test("half-open kill assignment counts each stage once", () => {
  const output = runObjectiveModel({
    objectives: [dragonAt(600000, 100)],
    kills: [510000, 579999, 580000, 619999, 620000].map((timestamp) =>
      championKill(timestamp, 1, 6, [], { x: 5000, y: 5000 })),
  }).objectiveEngagements[0];
  assert.deepEqual(output.setupWindow.deathCounts, { ally: 0, enemy: 2 });
  assert.deepEqual(output.contestWindow.deathCounts, { ally: 0, enemy: 2 });
  assert.equal(output.conversionWindow.deathCounts, null);
});

test("unknown capture team remains UNKNOWN", () => {
  assert.equal(unknownObjective().captureTeam, "UNKNOWN");
});

test("linked encounter does not upgrade objective direct involvement", () => {
  const objective = objectiveLinkedToTargetAssistWithoutObjectiveAssist();
  assert.equal(objective.playerInvolvement.level, "NOT_INVOLVED");
  assert.equal(
    objective.linkedEncounterInvolvements[0].encounterPlayerInvolvement.level,
    "CONFIRMED",
  );
});

test("objective assist itself creates confirmed objective involvement", () => {
  const objective = objectiveWithDirectAssist();
  assert.equal(objective.playerInvolvement.level, "CONFIRMED");
  assert.equal(objective.playerInvolvement.records[0].basis, "OBJECTIVE_ASSIST");
});

test("known positions require 5000 proximity while missing positions lower confidence", () => {
  const near = objectivesWithOneEncounterAt(590000, [dragonAt(600000, 100)]);
  assert.equal(near.objectiveEngagements[0].linkedEncounterIds.length, 1);

  const far = runObjectiveModel({
    objectives: [dragonAt(600000, 100)],
    kills: [championKill(590000, 1, 6, [], { x: 10001, y: 5000 })],
  });
  assert.equal(far.objectiveEngagements[0].linkedEncounterIds.length, 0);

  const missing = runObjectiveModel({
    objectives: [eliteKill(600000, 2, 100, "DRAGON", null)],
    kills: [championKill(590000, 1, 6, [], null)],
  }).objectiveEngagements[0];
  assert.equal(missing.linkedEncounterIds.length, 1);
  assert.ok(missing.limitationCodes.includes("MISSING_SPATIAL_LINK"));
  assert.equal(missing.linkedEncounterInvolvements[0].associationConfidence, "MEDIUM");
});

test("pre and end snapshots never use frames after their boundary", () => {
  const objective = objectiveWithFramesAt([540000, 600000, 660000]);
  assert.equal(objective.setupWindow.teamSnapshots.end.ally.snapshotTimestamp, 540000);
  assert.equal(objective.contestWindow.teamSnapshots.end.ally.snapshotTimestamp, 600000);
});

test("snapshot failures distinguish incomplete and stale", () => {
  const incompleteFrame = makeFrame(590000, [dragonAt(600000, 100)]);
  delete incompleteFrame.participantFrames["5"];
  const incomplete = runObjectiveModel({ frames: [incompleteFrame] }).objectiveEngagements[0];
  assert.ok(incomplete.limitationCodes.includes("INCOMPLETE_TEAM_SNAPSHOT"));

  const stale = runObjectiveModel({
    frames: [makeFrame(400000), makeFrame(600000, [dragonAt(600000, 100)])],
  }).objectiveEngagements[0];
  assert.ok(stale.setupWindow.limitationCodes.includes("STALE_TEAM_SNAPSHOT"));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
