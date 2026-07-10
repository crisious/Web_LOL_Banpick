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
const contract = require("../../lib/teamplay-contract-v2.js");
const sourceModule = require("../../lib/teamplay-source-v2.js");

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

test("stable ID ignores object key order", () => {
  assert.equal(
    contract.stableId("enc", { b: 2, a: 1 }),
    contract.stableId("enc", { a: 1, b: 2 }),
  );
});

test("unknown team remains UNKNOWN", () => {
  assert.equal(contract.relationForTeam(300, 100), "UNKNOWN");
  assert.equal(contract.relationForTeam(null, 100), "UNKNOWN");
});

test("render predicate accepts only valid raw render levels", () => {
  const root = {
    schemaVersion: "2.0",
    coverage: contract.createCoverageEnvelope({ level: "FULL", source: "RAW_TIMELINE" }),
    encounters: [],
    objectiveEngagements: [],
    scenes: [],
    personalReviews: [],
    teamAppendix: [],
  };
  assert.equal(contract.isRenderableV2(root), true);
  assert.equal(contract.isRenderableV2({
    ...root,
    coverage: contract.createCoverageEnvelope({
      level: "PLAYER_ONLY",
      source: "LEGACY_ADAPTER",
    }),
  }), false);
  assert.equal(contract.isRenderableV2({
    ...root,
    coverage: { ...root.coverage, source: "ENEMY_GUESS" },
  }), false);
});

test("source preserves observer kills and typed refs", () => {
  const match = makeMatchFixture();
  const timeline = makeTimelineFixture([
    makeFrame(60000, [
      championKill(61000, 6, 7, [8], { x: 9000, y: 9000 }),
      eliteKill(62000, 2, 100, "DRAGON"),
      buildingKill(63000, 6, 100),
    ]),
  ]);
  const source = sourceModule.extractTeamplaySource(match, timeline, 1);
  assert.equal(source.killEvents.length, 1);
  assert.equal(source.killEvents[0].sourceRef.kind, "TIMELINE_EVENT");
  assert.equal(source.objectiveEvents.length, 1);
  assert.equal(source.structureEvents[0].takerRelation, "ENEMY");
});

test("empty and malformed frame arrays are not usable raw timelines", () => {
  const match = makeMatchFixture();
  const missingTimestampFrame = makeFrame(1000);
  delete missingTimestampFrame.timestamp;
  for (const frames of [
    [],
    [null],
    [{}],
    [{ events: [] }],
    [{ events: [null, {}, { type: "ITEM_PURCHASED" }] }],
    [{ events: [{ type: "CHAMPION_KILL" }] }],
    [{ participantFrames: {} }],
    [{ participantFrames: { 1: null, 2: {} } }],
    [{ participantFrames: { 1: { participantId: 1 } } }],
    [missingTimestampFrame],
  ]) {
    const source = sourceModule.extractTeamplaySource(
      match,
      { info: { frames } },
      1,
    );
    assert.equal(source.hasRawTimeline, false);
    assert.equal(source.snapshots.length, 0);
  }
});

test("a supported event is usable without participant frames", () => {
  const source = sourceModule.extractTeamplaySource(
    makeMatchFixture(),
    { info: { frames: [{ timestamp: 1000, events: [championKill(1000, 1, 6)] }] } },
    1,
  );
  assert.equal(source.hasRawTimeline, true);
  assert.equal(source.killEvents.length, 1);
});

test("prior-frame lookup never returns a future frame", () => {
  const match = makeMatchFixture();
  const source = sourceModule.extractTeamplaySource(
    match,
    makeTimelineFixture([makeFrame(60000), makeFrame(120000)]),
    1,
  );
  const frame = sourceModule.latestParticipantFrameAtOrBefore(source, 1, 90000, 30000);
  assert.equal(frame.timestamp, 60000);
  assert.equal(
    sourceModule.latestParticipantFrameAtOrBefore(source, 1, 59000, 30000),
    null,
  );
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
