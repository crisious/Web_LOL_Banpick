import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  buildingKill,
  championKill,
  eliteKill,
  makeFrame,
  makeMatchFixture,
  makeTimelineFixture,
} from "../fixtures/teamplay-v2-fixtures.mjs";

const require = createRequire(import.meta.url);
const { buildTeamplayAnalysisV2 } = require("../../lib/teamplay-analysis-v2.js");
const { applyRecommendationSelections } = require("../../lib/teamplay-coaching-v2.js");
const { isRenderableV2 } = require("../../lib/teamplay-contract-v2.js");

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

function idSnapshot(model) {
  return {
    encounters: model.encounters.map((row) => row.id),
    objectives: model.objectiveEngagements.map((row) => row.id),
    reviews: model.personalReviews.map((row) => row.reviewId),
  };
}

test("coherent objective teamfight crosses every v2 boundary", () => {
  const match = makeMatchFixture();
  const coherentEvents = [
    championKill(600000, 2, 6, [1], { x: 5000, y: 5000 }),
    championKill(608000, 3, 7, [4], { x: 5100, y: 5000 }),
    eliteKill(610000, 7, 200, "DRAGON", { x: 5050, y: 5000 }),
    championKill(616000, 5, 8, [9], { x: 5200, y: 5000 }),
    championKill(618000, 6, 2, [10], { x: 5150, y: 5000 }),
    buildingKill(625000, 7, 100, { x: 5300, y: 5000 }),
  ];
  const timeline = makeTimelineFixture([
    makeFrame(590000, coherentEvents, {
      1: { x: 4900, y: 5000 },
      2: { x: 5000, y: 5000 },
      3: { x: 5100, y: 5000 },
      4: { x: 5000, y: 5100 },
      5: { x: 5200, y: 5000 },
      6: { x: 5000, y: 4900 },
      7: { x: 5100, y: 4900 },
      8: { x: 5200, y: 4900 },
      9: { x: 5300, y: 4900 },
      10: { x: 5400, y: 4900 },
    }),
  ]);

  const facts = buildTeamplayAnalysisV2(match, timeline, 1);
  const finalModel = applyRecommendationSelections(facts, null);
  assert.equal(finalModel.encounters[0].type, "TEAMFIGHT_CANDIDATE");
  assert.equal(finalModel.objectiveEngagements[0].captureTeam, "ENEMY");
  assert.equal(
    finalModel.objectiveEngagements[0].contestWindow.deathCounts.ally,
    1,
  );
  assert.equal(
    finalModel.objectiveEngagements[0].contestWindow.deathCounts.enemy,
    3,
  );
  assert.equal(
    finalModel.personalReviews[0].effectiveInvolvementLevel,
    "CONFIRMED",
  );
  assert.ok(finalModel.personalReviews[0].evidenceIds.length > 0);
  assert.ok(finalModel.teamAppendix[0]);
  assert.equal(isRenderableV2(finalModel), true);
  assert.ok(!JSON.stringify(finalModel).includes("puuid-"));
});

test("same-time fights on opposite map sides remain separate", () => {
  const match = makeMatchFixture();
  const splitMapTimeline = makeTimelineFixture([
    makeFrame(90000, [
      championKill(100000, 1, 6, [], { x: 1000, y: 1000 }),
      championKill(100000, 2, 7, [], { x: 12000, y: 12000 }),
    ]),
  ]);
  const splitMapFacts = buildTeamplayAnalysisV2(match, splitMapTimeline, 1);
  assert.equal(splitMapFacts.encounters.length, 2);
});

test("tracked raw sample rebuild is stable, renderable, and private", () => {
  const sampleRoot = new URL(
    "../../data/samples/sample-kr-8186180726/",
    import.meta.url,
  );
  const match = JSON.parse(fs.readFileSync(
    new URL("raw-match.json", sampleRoot),
    "utf8",
  ));
  const timeline = JSON.parse(fs.readFileSync(
    new URL("raw-timeline.json", sampleRoot),
    "utf8",
  ));
  const normalized = JSON.parse(fs.readFileSync(
    new URL("normalized-match.json", sampleRoot),
    "utf8",
  ));
  const targetParticipantId = normalized.playerContext.participantId;
  assert.equal(targetParticipantId, 5);

  const first = buildTeamplayAnalysisV2(
    match,
    timeline,
    targetParticipantId,
  );
  const second = buildTeamplayAnalysisV2(
    match,
    timeline,
    targetParticipantId,
  );
  assert.equal(first.schemaVersion, "2.0");
  assert.equal(isRenderableV2(first), true);
  for (const key of [
    "encounters",
    "objectiveEngagements",
    "scenes",
    "personalReviews",
    "teamAppendix",
  ]) {
    assert.ok(Array.isArray(first[key]), key);
  }
  assert.deepEqual(idSnapshot(first), idSnapshot(second));

  const serialized = JSON.stringify(first);
  assert.ok(!serialized.includes("puuid"));
  assert.ok(!serialized.includes(normalized.playerContext.puuid));
  assert.ok(!serialized.includes(normalized.playerContext.riotId));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
