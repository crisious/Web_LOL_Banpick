import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  makeFrame,
  makeMatchFixture,
  makeTimelineFixture,
} from "../fixtures/teamplay-v2-fixtures.mjs";

const require = createRequire(import.meta.url);
const { buildTeamplayAnalysisV2 } = require(
  "../../lib/teamplay-analysis-v2.js",
);
const { hydrateStoredTeamplayV2 } = require(
  "../../lib/teamplay-stored-v2.js",
);
const serverSource = fs.readFileSync(
  new URL("../../server.js", import.meta.url),
  "utf8",
);

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

const validNormalized = {
  playerContext: { participantId: 1, puuid: "puuid-1" },
  matchInfo: { matchId: "KR_TEAMPLAY_FIXTURE" },
};
const validAnalysis = {
  matchSummary: { headline: "Stored fixture" },
  coachSummary: { overallSummary: "Stored fixture summary" },
};

function loadFixture({ rawMatch, rawTimeline, legacyAnalysis }) {
  return hydrateStoredTeamplayV2({
    normalized: structuredClone(validNormalized),
    analysis: structuredClone(legacyAnalysis),
    matchDetail: rawMatch,
    timeline: rawTimeline,
  });
}

test("raw stored bundle receives in-memory v2 without write", () => {
  const bundle = loadFixture({
    rawMatch: makeMatchFixture(),
    rawTimeline: makeTimelineFixture([makeFrame(60000)]),
    legacyAnalysis: validAnalysis,
  });
  assert.equal(
    bundle.analysis.teamplayAnalysisV2.coverage.source,
    "RAW_TIMELINE",
  );
  assert.equal(bundle.normalized.teamplayAnalysisV2.schemaVersion, "2.0");
});

test("analysis-only legacy bundle uses PLAYER_ONLY", () => {
  const bundle = loadFixture({
    rawMatch: null,
    rawTimeline: null,
    legacyAnalysis: {
      ...validAnalysis,
      combatAnalysis: [],
      teamfightPhaseAnalysis: [],
    },
  });
  assert.equal(bundle.analysis.teamplayAnalysisV2.coverage.level, "PLAYER_ONLY");
  assert.equal(
    bundle.analysis.teamplayAnalysisV2.coverage.source,
    "LEGACY_ADAPTER",
  );
});

test("no raw and no legacy uses UNAVAILABLE", () => {
  const bundle = loadFixture({
    rawMatch: null,
    rawTimeline: null,
    legacyAnalysis: validAnalysis,
  });
  assert.equal(bundle.analysis.teamplayAnalysisV2.coverage.level, "UNAVAILABLE");
});

test("one malformed stored v2 is rebuilt from raw", () => {
  const bundle = loadFixture({
    rawMatch: makeMatchFixture(),
    rawTimeline: makeTimelineFixture([makeFrame(60000)]),
    legacyAnalysis: {
      ...validAnalysis,
      teamplayAnalysisV2: { schemaVersion: "2.0" },
    },
  });
  assert.equal(
    bundle.analysis.teamplayAnalysisV2.coverage.source,
    "RAW_TIMELINE",
  );
});

test("player-only envelope upgrades when raw files are available", () => {
  const legacyEnvelope = {
    schemaVersion: "2.0",
    coverage: {
      level: "PLAYER_ONLY",
      source: "LEGACY_ADAPTER",
      usablePositionSceneRatio: 0,
      limitationCodes: [],
    },
    encounters: [],
    objectiveEngagements: [],
    scenes: [],
    personalReviews: [],
    teamAppendix: [],
  };
  const bundle = loadFixture({
    rawMatch: makeMatchFixture(),
    rawTimeline: makeTimelineFixture([makeFrame(60000)]),
    legacyAnalysis: { ...validAnalysis, teamplayAnalysisV2: legacyEnvelope },
  });
  assert.equal(
    bundle.analysis.teamplayAnalysisV2.coverage.source,
    "RAW_TIMELINE",
  );
});

test("malformed analysis v2 does not mask valid normalized raw v2", () => {
  const rawFacts = buildTeamplayAnalysisV2(
    makeMatchFixture(),
    makeTimelineFixture([makeFrame(60000)]),
    1,
  );
  const bundle = hydrateStoredTeamplayV2({
    normalized: { ...validNormalized, teamplayAnalysisV2: rawFacts },
    analysis: {
      ...validAnalysis,
      teamplayAnalysisV2: { schemaVersion: "2.0" },
    },
    matchDetail: null,
    timeline: null,
  });
  assert.equal(
    bundle.normalized.teamplayAnalysisV2.coverage.source,
    "RAW_TIMELINE",
  );
  assert.equal(
    bundle.analysis.teamplayAnalysisV2.coverage.source,
    "RAW_TIMELINE",
  );
});

test("stored hydration module has no persistence capability", () => {
  const source = fs.readFileSync(
    new URL("../../lib/teamplay-stored-v2.js", import.meta.url),
    "utf8",
  );
  for (const forbidden of ["node:fs", "writeJson", "saveManifest", "writeFile"]) {
    assert.ok(!source.includes(forbidden), forbidden);
  }
});

test("stored sample loader hydrates teamplay in memory", () => {
  assert.ok(serverSource.includes('require("./lib/teamplay-stored-v2")'));
  assert.ok(serverSource.includes("const hydratedTeamplay = hydrateStoredTeamplayV2({"));
  assert.ok(serverSource.includes("normalized = hydratedTeamplay.normalized;"));
  assert.ok(serverSource.includes("analysis = hydratedTeamplay.analysis;"));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
