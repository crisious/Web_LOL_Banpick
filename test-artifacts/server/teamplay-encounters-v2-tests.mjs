import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  makeMatchFixture,
  makeFrame,
  makeTimelineFixture,
  championKill,
} from "../fixtures/teamplay-v2-fixtures.mjs";

const require = createRequire(import.meta.url);
const { extractTeamplaySource } = require("../../lib/teamplay-source-v2.js");
const { buildEncounters } = require("../../lib/teamplay-encounters-v2.js");

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

function killAt(timestamp, killerId, victimId, assists, x, y) {
  return championKill(
    timestamp,
    killerId,
    victimId,
    assists,
    x === null || y === null ? null : { x, y },
  );
}

function sourceWithKills(kills) {
  return extractTeamplaySource(
    makeMatchFixture(),
    makeTimelineFixture([makeFrame(0, kills)]),
    1,
  );
}

function sourceWithFrames(frames, mutateMatch = null) {
  const match = makeMatchFixture();
  if (mutateMatch) mutateMatch(match);
  return extractTeamplaySource(match, makeTimelineFixture(frames), 1);
}

function oneDeathEncounter() {
  return buildEncounters(sourceWithKills([
    killAt(100000, 1, 6, [], 1000, 1000),
  ]))[0];
}

function twoDeathEncounter() {
  return buildEncounters(sourceWithKills([
    killAt(100000, 1, 6, [], 1000, 1000),
    killAt(110000, 2, 7, [], 1100, 1000),
  ]))[0];
}

function sixParticipantThreeDeathEncounter() {
  return buildEncounters(sourceWithKills([
    killAt(100000, 1, 6, [2], 1000, 1000),
    killAt(108000, 3, 7, [4], 1100, 1000),
    killAt(116000, 5, 8, [9], 1200, 1000),
  ]))[0];
}

function encounterAt(offsets) {
  const kills = offsets.map((offset, index) =>
    killAt(
      100000 + offset,
      (index % 5) + 1,
      (index % 5) + 6,
      [],
      1000 + index * 20,
      1000,
    ));
  return buildEncounters(sourceWithKills(kills))[0];
}

function observerTeamfight() {
  return buildEncounters(sourceWithKills([
    killAt(100000, 2, 6, [5], 1000, 1000),
    killAt(108000, 3, 7, [9], 1100, 1000),
    killAt(116000, 4, 8, [], 1200, 1000),
  ]))[0];
}

const cases = [
  { name: "15 seconds and 5000 distance joins", gap: 15000, distance: 5000, expected: 1 },
  { name: "15 seconds and 5001 distance splits", gap: 15000, distance: 5001, expected: 2 },
  { name: "25 seconds and 3000 distance joins", gap: 25000, distance: 3000, expected: 1 },
  { name: "25 seconds and 3001 distance splits", gap: 25000, distance: 3001, expected: 2 },
  { name: "more than 25 seconds splits", gap: 25001, distance: 1, expected: 2 },
];

for (const row of cases) {
  test(row.name, () => {
    const source = sourceWithKills([
      killAt(100000, 1, 6, [], 1000, 1000),
      killAt(100000 + row.gap, 2, 7, [], 1000 + row.distance, 1000),
    ]);
    assert.equal(buildEncounters(source).length, row.expected);
  });
}

test("45-second total boundary is inclusive", () => {
  assert.equal(buildEncounters(sourceWithKills([
    killAt(100000, 1, 6, [], 1000, 1000),
    killAt(125000, 2, 7, [], 1000, 1000),
    killAt(145000, 3, 8, [], 1000, 1000),
  ])).length, 1);
  assert.equal(buildEncounters(sourceWithKills([
    killAt(100000, 1, 6, [], 1000, 1000),
    killAt(125000, 2, 7, [], 1000, 1000),
    killAt(145001, 3, 8, [], 1000, 1000),
  ])).length, 2);
});

test("4000 medoid boundary is inclusive", () => {
  const countAt = (distance) => buildEncounters(sourceWithKills([
    killAt(100000, 1, 6, [], 1000, 1000),
    killAt(105000, 2, 7, [], 1000, 1000),
    killAt(110000, 3, 8, [], 1000 + distance, 1000),
  ])).length;
  assert.equal(countAt(4000), 1);
  assert.equal(countAt(4001), 2);
});

test("missing positions join only with shared participant", () => {
  assert.equal(buildEncounters(sourceWithKills([
    killAt(100000, 1, 6, [2], null, null),
    killAt(110000, 2, 7, [], null, null),
  ])).length, 1);
  assert.equal(buildEncounters(sourceWithKills([
    killAt(100000, 1, 6, [], null, null),
    killAt(110000, 2, 7, [], null, null),
  ])).length, 2);
  assert.equal(buildEncounters(sourceWithKills([
    killAt(100000, 1, 6, [2], null, null),
    killAt(115000, 2, 7, [], null, null),
  ])).length, 1);
  assert.equal(buildEncounters(sourceWithKills([
    killAt(100000, 1, 6, [2], null, null),
    killAt(115001, 2, 7, [], null, null),
  ])).length, 2);
});

test("classification decision tree is exclusive", () => {
  assert.equal(oneDeathEncounter().type, "PICK");
  assert.equal(twoDeathEncounter().type, "SKIRMISH");
  assert.equal(sixParticipantThreeDeathEncounter().type, "TEAMFIGHT_CANDIDATE");
});

test("death counts and first takedown stay factual", () => {
  const encounter = twoDeathEncounter();
  assert.equal(encounter.allyDeaths, 0);
  assert.equal(encounter.enemyDeaths, 2);
  assert.equal(encounter.firstTakedownTeam, "ALLY");
});

test("phases never move back from LATE_SEQUENCE", () => {
  const encounter = encounterAt([0, 1000, 4000, 16000, 18000]);
  assert.deepEqual(
    encounter.phaseEvents.map((row) => row.phase),
    ["OPENING", "OPENING", "EXCHANGE", "LATE_SEQUENCE", "LATE_SEQUENCE"],
  );
});

test("phase boundaries use opening under 2 seconds and late gap over 10 seconds", () => {
  const encounter = encounterAt([0, 1999, 2000, 12000, 22001]);
  assert.deepEqual(
    encounter.phaseEvents.map((row) => row.phase),
    ["OPENING", "OPENING", "EXCHANGE", "EXCHANGE", "LATE_SEQUENCE"],
  );
});

test("approximate involvement requires prior living frame within 15 seconds and 4000", () => {
  function levelAt(frameTimestamp, distance) {
    const source = sourceWithFrames([
      makeFrame(frameTimestamp, [
        killAt(100000, 2, 6, [], 1000 + distance, 1000),
      ], { 1: { x: 1000, y: 1000 } }),
    ]);
    return buildEncounters(source)[0].playerInvolvement.level;
  }
  assert.equal(levelAt(85000, 4000), "APPROXIMATE");
  assert.equal(levelAt(84999, 4000), "NOT_INVOLVED");
  assert.equal(levelAt(85000, 4001), "NOT_INVOLVED");
});

test("unknown direct teams stay out of known classification counts", () => {
  const source = sourceWithFrames([
    makeFrame(0, [
      killAt(100000, 1, 6, [2], 1000, 1000),
      killAt(108000, 3, 7, [4], 1100, 1000),
      killAt(116000, 5, 8, [9], 1200, 1000),
    ]),
  ], (match) => { match.info.participants[8].teamId = 300; });
  const encounter = buildEncounters(source)[0];
  assert.equal(encounter.classificationBasis.unknownUniqueDirect, 1);
  assert.ok(encounter.limitationCodes.includes("UNKNOWN_TEAM"));
});

test("public participant rows are sorted and contain no private identifiers", () => {
  const encounter = sixParticipantThreeDeathEncounter();
  assert.deepEqual(
    encounter.participants.ally.map((row) => row.participantId),
    [...encounter.participants.ally.map((row) => row.participantId)]
      .sort((a, b) => a - b),
  );
  assert.ok(!JSON.stringify(encounter.participants).includes("puuid"));
  assert.ok(!JSON.stringify(encounter.participants).includes("summoner"));
});

test("observer teamfight includes target as NOT_INVOLVED", () => {
  const encounter = observerTeamfight();
  assert.equal(encounter.playerInvolvement.level, "NOT_INVOLVED");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
