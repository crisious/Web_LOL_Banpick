# Personal Objective and Teamfight Analysis v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a deterministic ten-player objective and combat model that presents evidence-backed personal decision and positioning reviews first, with team context in a collapsed appendix.

**Architecture:** Add focused CommonJS modules under lib for stable contracts, raw source extraction, encounter grouping, objective progression, personal reviews, and closed-code coaching. server.js attaches the deterministic model to normalized and analysis responses, asks AI agents to select only eligible recommendation codes, and backfills stored samples in memory. main.js validates renderability, shows v2 personal reviews and objective-combat flow when usable, and otherwise renders the existing legacy sections.

**Tech Stack:** Node.js 20+, CommonJS server modules, browser-native HTML/CSS/JavaScript, Riot Match-v5 timeline JSON, existing custom test-artifacts runner, SHA-256 from node:crypto, no new runtime dependencies.

## Global Constraints

- Keep Node.js engine support at >=20 and add no npm runtime or test dependency.
- Preserve combatAnalysis and teamfightPhaseAnalysis in the API; teamplayAnalysisV2 is additive.
- Never classify an unknown team as ENEMY; keep UNKNOWN.
- Use all ten players' CHAMPION_KILL events. A direct participant is a killer, victim, or assisting participant recorded by Riot.
- Encounter grouping uses: total duration <=45 seconds; adjacent gap <=25 seconds; <=15-second positioned events need distance <=5,000; 15-25-second positioned events need distance <=3,000; a new positioned event in a cluster with at least two positions must be <=4,000 from the current medoid.
- If either kill position is missing, join only when gap <=15 seconds and the events share a direct participant.
- Classification is exclusive: one death PICK; otherwise >=3 deaths, >=2 known participants per team, and >=6 known participants total TEAMFIGHT_CANDIDATE; every other group SKIRMISH.
- Phases are monotonic OPENING, EXCHANGE, LATE_SEQUENCE. Never emit CLEANUP or causal labels such as CAUGHT_OUT and OVERCHASE_DEATH in v2.
- Objective anchors are ELITE_MONSTER_KILL only. Structures are conversion events, not anchors.
- Windows are half-open: setup [captureStart-90s, captureStart-20s), contest [captureStart-20s, captureEnd+20s), conversion [captureEnd, captureEnd+120s).
- Group split VOID_GRUB captures into one camp, preserve captureCounts by side, and allow captureTeam SPLIT.
- Use only the latest participant frame at or before an event. Never use a future frame. Position evidence older than 30 seconds is unusable.
- APPROXIMATE means proximity estimate, not participation. It cannot support decisionAssessment.
- Objective CONFIRMED involvement requires OBJECTIVE_KILLER or OBJECTIVE_ASSIST. A linked encounter record never upgrades objective involvement.
- Personal review ranking is deterministic, returns at most five reviews, and the UI initially shows min(3, review count).
- AI may select only an eligible recommendationCode plus permitted fact IDs. All personal-review claim and coaching text comes from server templates; the timeline flow may format validated structured counts and team enums but may not add causal claims.
- isRenderableV2 is true only when root validation passes, source is RAW_TIMELINE, and level is FULL, PARTIAL, or EVENT_ONLY.
- Valid v2 and legacy combat/teamfight content must never be visible together.
- Team appendix and evidence panels start collapsed and use native buttons with aria-expanded and aria-controls.
- Do not commit newly collected raw samples, data/samples/manifest.json changes for those samples, or test-artifacts/tmp.
- Use synthetic fixtures and already committed samples only.

## File Structure

### New production modules

- lib/teamplay-contract-v2.js — schema constants, canonical hashing, typed source references, confidence ordering, coverage envelopes, root validation, and isRenderableV2.
- lib/teamplay-source-v2.js — ten-player participant map, normalized raw kill/objective/structure events, timeline snapshots, prior-frame lookup, and complete team snapshots.
- lib/teamplay-encounters-v2.js — spatial-temporal encounter grouping, medoid calculation, exclusive classification, monotonic phases, and encounter involvement.
- lib/teamplay-objectives-v2.js — neutral-objective anchors, split-grub grouping, window assignment, encounter links, structure conversion, and objective involvement.
- lib/teamplay-reviews-v2.js — scene de-duplication, effective involvement, fact atoms, importance scoring, personal reviews, team appendix, and coverage.
- lib/teamplay-coaching-v2.js — deterministic fact templates, eligible recommendation codes, AI selection validation, rule fallback, and final coaching merge.
- lib/teamplay-analysis-v2.js — public orchestration entry point for the modules above.
- lib/teamplay-stored-v2.js — pure stored-bundle hydration from optional raw match/timeline inputs.

### New synthetic test support

- test-artifacts/fixtures/teamplay-v2-fixtures.mjs — ten-player match and timeline builders; no production sample data.

### New test files

- test-artifacts/server/teamplay-source-v2-tests.mjs
- test-artifacts/server/teamplay-encounters-v2-tests.mjs
- test-artifacts/server/teamplay-objectives-v2-tests.mjs
- test-artifacts/server/teamplay-reviews-v2-tests.mjs
- test-artifacts/server/teamplay-coaching-v2-tests.mjs
- test-artifacts/server/teamplay-server-integration-tests.mjs
- test-artifacts/server/load-sample-teamplay-v2-compat-tests.mjs
- test-artifacts/main/teamplay-v2-render-tests.mjs
- test-artifacts/main/teamplay-v2-accessibility-tests.mjs
- test-artifacts/server/teamplay-v2-integration-tests.mjs

### Existing files to modify

- server.js:1-12, 982-1115, 2107-2145, 2328-2500, 2770-2835, 2897-3220, 3385-3470 — module imports, normalized attachment, rule fallback, AI candidate payload, AI selection merge, validation, and stored-sample backfill.
- index.html:257-319 — shared v2/legacy analysis slot and objective-combat flow slot.
- main.js:1-75, 2553-2645, 3106-3330, 3586-3630, 4515-4556 — DOM handles, render-mode sanitation, personal reviews, flow rendering, event delegation, and tab navigation.
- styles.css: existing combat/timeline blocks and responsive rules near 4400 — personal review cards, fact rows, disclosure panels, flow cards, focus, and mobile layout.
- test-artifacts/server/llm-payload-tests.mjs — candidate payload and output contract.
- test-artifacts/schema/schema-tests.mjs — additive analysis v2 shape.
- test-artifacts/server/sample-bundle-error-tests.mjs — loadSampleBundle harness dependencies after backfill integration.
- analysis-json-schema.md — final teamplayAnalysisV2 response contract.
- normalized-match-schema.md — deterministic normalized teamplayAnalysisV2 contract.
- replay-coach-qa-checklist.md — manual review, fallback, keyboard, zoom, and no-new-sample checks.

### Test file convention

Every new test file begins with this harness unless the task supplies a source-extraction harness:

~~~js
import assert from "node:assert/strict";

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log("PASS  " + name);
    pass += 1;
  } catch (error) {
    console.log("FAIL  " + name + "\n  " + error.message);
    fail += 1;
  }
}

process.on("beforeExit", () => {
  console.log("\n" + pass + " passed, " + fail + " failed");
  if (fail) process.exitCode = 1;
});
~~~

For async cases, await the callback inside an async test runner and print the same final count format. Every file must end with N passed, N failed so test-artifacts/run-tests.mjs can aggregate it.

## Approved-Spec Coverage Map

| Approved design area | Owning task(s) | Required proof |
|---|---|---|
| Stable IDs, typed source references, confidence, limitations, render predicate | 1, 5 | Source/contract tests plus fatal-root and item-isolation tests |
| All ten-player kill extraction and privacy-safe participant metadata | 1, 2 | Observer-fight and no-private-identifier assertions |
| Spatial-temporal grouping, medoid, exclusive classification, monotonic phases | 2 | Exact 15s/25s/45s and 3,000/4,000/5,000 boundary tables |
| Objective anchors, split grubs, half-open windows, single assignment, conversions | 3 | Boundary, overlap, split, UNKNOWN, and conversion ownership tests |
| Domain-specific involvement, scene de-duplication, personal-review ranking | 2-4 | Direct/approximate separation, one review per scene, NOT_INVOLVED exclusion, deterministic top-five tests |
| Fact atoms, positioning confidence, complete prior snapshots, team appendix | 1, 3, 4 | No-future-frame, 5s/15s/30s, incomplete-frame, stale-frame, and gold-snapshot tests |
| Server fact copy and closed AI recommendation selection | 5, 6 | Template mapping, payload minimization, invalid-selection isolation, rule-fallback tests |
| Live generation and stored-sample compatibility | 6, 7 | Additive server contract, RAW/PLAYER_ONLY/UNAVAILABLE hydration, no-write tests |
| Personal-first UI, separate collapsed team appendix, mutual legacy exclusion | 8 | Render-mode, escaping, 0/1/2/3/5 visibility, and legacy fallback tests |
| Objective-combat flow, keyboard access, scene focus, responsive behavior | 9 | Factual-outcome, native-button, unique-ID, focus-order, and reduced-motion tests |
| Documentation, end-to-end regression, committed-sample/browser QA | 10 | Synthetic integration, existing committed sample, full suite, and manual QA checklist |

---

### Task 1: Stable Contract and Ten-Player Source Extraction

**Files:**
- Create: lib/teamplay-contract-v2.js
- Create: lib/teamplay-source-v2.js
- Create: test-artifacts/fixtures/teamplay-v2-fixtures.mjs
- Test: test-artifacts/server/teamplay-source-v2-tests.mjs

**Interfaces:**
- Produces: TEAMPLAY_SCHEMA_VERSION, COVERAGE_LEVELS, COVERAGE_SOURCES, LIMITATION_CODES, canonicalJson(value), stableId(prefix, parts), makeTimelineEventRef(matchId, frameIndex, eventIndex, timestamp), makeParticipantFrameRef(matchId, frameIndex, participantId, timestamp), makeFactId(reviewId, fact), relationForTeam(teamId, targetTeamId), lowerConfidence(a, b), createCoverageEnvelope(options), validateTeamplayRoot(value), isRenderableV2(value).
- Produces: extractTeamplaySource(matchDetail, timeline, targetParticipantId), eventParticipantIds(event), latestParticipantFrameAtOrBefore(source, participantId, timestamp, maxAgeMs), resolveCompleteTeamSnapshotAtOrBefore(source, relation, timestamp, maxAgeMs), completeTeamSnapshotAtOrBefore(source, relation, timestamp, maxAgeMs).
- Consumed by: Tasks 2-7.

- [ ] **Step 1: Write the synthetic fixture and failing source tests**

Create fixture helpers with ten public participants and raw timeline builders:

~~~js
export function makeMatchFixture(targetParticipantId = 1) {
  const participants = Array.from({ length: 10 }, (_, index) => {
    const participantId = index + 1;
    return {
      participantId,
      puuid: "puuid-" + participantId,
      teamId: participantId <= 5 ? 100 : 200,
      championName: "Champion" + participantId,
      teamPosition: ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"][index % 5],
    };
  });
  return {
    metadata: { matchId: "KR_TEAMPLAY_FIXTURE" },
    info: { mapId: 11, gameDuration: 1800, participants },
    targetParticipantId,
  };
}

export function championKill(timestamp, killerId, victimId, assistingParticipantIds = [], position = null) {
  return {
    type: "CHAMPION_KILL",
    timestamp,
    killerId,
    victimId,
    assistingParticipantIds,
    position,
  };
}

export function eliteKill(
  timestamp,
  killerId,
  killerTeamId,
  monsterType,
  position = null,
  assistingParticipantIds = [],
) {
  return {
    type: "ELITE_MONSTER_KILL",
    timestamp,
    killerId,
    killerTeamId,
    monsterType,
    position,
    assistingParticipantIds,
  };
}

export function buildingKill(timestamp, killerId, destroyedTeamId, position = null) {
  return {
    type: "BUILDING_KILL",
    timestamp,
    killerId,
    teamId: destroyedTeamId,
    buildingType: "TOWER_BUILDING",
    towerType: "OUTER_TURRET",
    laneType: "MID_LANE",
    position,
  };
}

export function makeFrame(timestamp, events = [], positions = {}) {
  const participantFrames = {};
  for (let participantId = 1; participantId <= 10; participantId += 1) {
    const position = positions[participantId] || { x: participantId * 100, y: participantId * 100 };
    participantFrames[String(participantId)] = {
      participantId,
      currentHealth: 1000,
      totalGold: 5000 + participantId * 100,
      xp: 6000 + participantId * 100,
      level: 10,
      position,
    };
  }
  return { timestamp, participantFrames, events };
}

export function makeTimelineFixture(frames) {
  return { info: { frames } };
}
~~~

Write tests that require the new modules and assert:

~~~js
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
  try { fn(); console.log("PASS  " + name); pass += 1; }
  catch (error) { console.log("FAIL  " + name + "\n  " + error.message); fail += 1; }
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
    coverage: contract.createCoverageEnvelope({ level: "PLAYER_ONLY", source: "LEGACY_ADAPTER" }),
  }), false);
  assert.equal(contract.isRenderableV2({ ...root, coverage: { ...root.coverage, source: "ENEMY_GUESS" } }), false);
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

test("prior-frame lookup never returns a future frame", () => {
  const match = makeMatchFixture();
  const source = sourceModule.extractTeamplaySource(
    match,
    makeTimelineFixture([makeFrame(60000), makeFrame(120000)]),
    1,
  );
  const frame = sourceModule.latestParticipantFrameAtOrBefore(source, 1, 90000, 30000);
  assert.equal(frame.timestamp, 60000);
  assert.equal(sourceModule.latestParticipantFrameAtOrBefore(source, 1, 59000, 30000), null);
});

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
~~~

- [ ] **Step 2: Run the source tests to verify failure**

Run: node test-artifacts/server/teamplay-source-v2-tests.mjs

Expected: FAIL with ERR_MODULE_NOT_FOUND or MODULE_NOT_FOUND for lib/teamplay-contract-v2.js.

- [ ] **Step 3: Implement the stable contract**

Implement the contract with deterministic canonical JSON and the exact render predicate:

~~~js
const { createHash } = require("node:crypto");

const TEAMPLAY_SCHEMA_VERSION = "2.0";
const CONFIDENCE_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const COVERAGE_LEVELS = new Set(["FULL", "PARTIAL", "EVENT_ONLY", "PLAYER_ONLY", "UNAVAILABLE"]);
const COVERAGE_SOURCES = new Set(["RAW_TIMELINE", "LEGACY_ADAPTER", "NONE"]);
const RENDERABLE_LEVELS = new Set(["FULL", "PARTIAL", "EVENT_ONLY"]);
const LIMITATION_CODES = new Set([
  "PARTIAL_POSITION_FRAMES",
  "NO_POSITION_FRAMES",
  "MISSING_SPATIAL_LINK",
  "INCOMPLETE_ALLY_FRAME_COVERAGE",
  "UNKNOWN_TEAM",
  "INCOMPLETE_TEAM_SNAPSHOT",
  "STALE_TEAM_SNAPSHOT",
  "INVALID_V2_ITEM",
  "INVALID_AI_SELECTION",
]);

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalValue(value[key]);
      return out;
    }, {});
  }
  return value === undefined ? null : value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function stableId(prefix, parts) {
  const digest = createHash("sha256").update(canonicalJson(parts)).digest("hex").slice(0, 20);
  return prefix + "_" + digest;
}

function makeTimelineEventRef(matchId, frameIndex, eventIndex, timestamp) {
  return {
    kind: "TIMELINE_EVENT",
    id: String(matchId) + ":" + frameIndex + ":" + eventIndex,
    timestamp: Math.round(Number(timestamp) || 0),
    participantId: null,
  };
}

function makeParticipantFrameRef(matchId, frameIndex, participantId, timestamp) {
  return {
    kind: "PARTICIPANT_FRAME",
    id: String(matchId) + ":" + frameIndex + ":" + participantId,
    timestamp: Math.round(Number(timestamp) || 0),
    participantId,
  };
}

function makeFactId(reviewId, fact) {
  return stableId("fact", {
    schemaVersion: TEAMPLAY_SCHEMA_VERSION,
    reviewId,
    type: fact.type,
    timestamp: Math.round(Number(fact.timestamp) || 0),
    sourceRefIds: (fact.sourceRefs || []).map((ref) => ref.id).sort(),
    value: fact.value,
  });
}

function relationForTeam(teamId, targetTeamId) {
  if (teamId !== 100 && teamId !== 200) return "UNKNOWN";
  if (targetTeamId !== 100 && targetTeamId !== 200) return "UNKNOWN";
  return teamId === targetTeamId ? "ALLY" : "ENEMY";
}

function lowerConfidence(left, right) {
  const a = Object.hasOwn(CONFIDENCE_ORDER, left) ? left : "LOW";
  const b = Object.hasOwn(CONFIDENCE_ORDER, right) ? right : "LOW";
  return CONFIDENCE_ORDER[a] <= CONFIDENCE_ORDER[b] ? a : b;
}

function createCoverageEnvelope({ level, source, usablePositionSceneRatio = 0, limitationCodes = [] }) {
  if (!COVERAGE_LEVELS.has(level) || !COVERAGE_SOURCES.has(source)) {
    throw new TypeError("invalid teamplay coverage envelope");
  }
  return {
    level,
    source,
    usablePositionSceneRatio: Math.max(0, Math.min(1, Number(usablePositionSceneRatio) || 0)),
    limitationCodes: [...new Set(limitationCodes)].filter((code) => LIMITATION_CODES.has(code)).sort(),
  };
}

function validateTeamplayRoot(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.schemaVersion === TEAMPLAY_SCHEMA_VERSION &&
    value.coverage &&
    COVERAGE_LEVELS.has(value.coverage.level) &&
    COVERAGE_SOURCES.has(value.coverage.source) &&
    Number.isFinite(value.coverage.usablePositionSceneRatio) &&
    value.coverage.usablePositionSceneRatio >= 0 &&
    value.coverage.usablePositionSceneRatio <= 1 &&
    Array.isArray(value.coverage.limitationCodes) &&
    value.coverage.limitationCodes.every((code) => LIMITATION_CODES.has(code)) &&
    Array.isArray(value.encounters) &&
    Array.isArray(value.objectiveEngagements) &&
    Array.isArray(value.scenes) &&
    Array.isArray(value.personalReviews) &&
    Array.isArray(value.teamAppendix)
  );
}

function isRenderableV2(value) {
  return validateTeamplayRoot(value) &&
    value.coverage.source === "RAW_TIMELINE" &&
    RENDERABLE_LEVELS.has(value.coverage.level);
}

module.exports = {
  TEAMPLAY_SCHEMA_VERSION,
  LIMITATION_CODES,
  COVERAGE_LEVELS,
  COVERAGE_SOURCES,
  canonicalJson,
  stableId,
  makeTimelineEventRef,
  makeParticipantFrameRef,
  makeFactId,
  relationForTeam,
  lowerConfidence,
  createCoverageEnvelope,
  validateTeamplayRoot,
  isRenderableV2,
};
~~~

- [ ] **Step 4: Implement source normalization**

Implement extractTeamplaySource so it returns this exact internal shape:

~~~js
{
  schemaVersion: "2.0",
  matchId: "KR_TEAMPLAY_FIXTURE",
  targetParticipantId: 1,
  targetTeamId: 100,
  hasRawTimeline: true,
  participants: [],
  participantById: new Map(),
  snapshots: [],
  killEvents: [],
  objectiveEvents: [],
  structureEvents: []
}
~~~

Use these normalization rules in lib/teamplay-source-v2.js:

~~~js
const {
  makeTimelineEventRef,
  makeParticipantFrameRef,
  relationForTeam,
} = require("./teamplay-contract-v2");

function validParticipantId(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null;
}

function normalizedPosition(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return { x: Math.round(value.x), y: Math.round(value.y) };
}

function eventParticipantIds(event) {
  return [...new Set([
    event.killerId,
    event.victimId,
    ...(event.assistingParticipantIds || []),
  ].filter((id) => Number.isInteger(id)))].sort((a, b) => a - b);
}

function extractTeamplaySource(matchDetail, timeline, targetParticipantId) {
  const matchId = String(matchDetail?.metadata?.matchId || "UNKNOWN_MATCH");
  const participants = Array.isArray(matchDetail?.info?.participants)
    ? matchDetail.info.participants.map((participant) => ({
        participantId: validParticipantId(participant.participantId),
        teamId: participant.teamId,
        champion: participant.championName || "Unknown",
        role: participant.teamPosition || participant.individualPosition || "UNKNOWN",
      })).filter((participant) => participant.participantId !== null)
    : [];
  const participantById = new Map(participants.map((participant) => [participant.participantId, participant]));
  const targetTeamId = participantById.get(targetParticipantId)?.teamId ?? null;
  const snapshots = [];
  const killEvents = [];
  const objectiveEvents = [];
  const structureEvents = [];
  const hasRawTimeline = Array.isArray(timeline?.info?.frames);
  const frames = hasRawTimeline ? timeline.info.frames : [];

  frames.forEach((frame, frameIndex) => {
    const timestamp = Math.round(Number(frame.timestamp) || 0);
    const frameParticipants = new Map();
    Object.values(frame.participantFrames || {}).forEach((rawFrame) => {
      const participantId = validParticipantId(rawFrame.participantId);
      if (participantId === null) return;
      frameParticipants.set(participantId, {
        participantId,
        timestamp,
        currentHealth: Number(rawFrame.currentHealth) || 0,
        totalGold: Number(rawFrame.totalGold) || 0,
        xp: Number(rawFrame.xp) || 0,
        level: Number(rawFrame.level) || 0,
        position: normalizedPosition(rawFrame.position),
        sourceRef: makeParticipantFrameRef(matchId, frameIndex, participantId, timestamp),
      });
    });
    snapshots.push({ frameIndex, timestamp, participants: frameParticipants });

    (Array.isArray(frame.events) ? frame.events : []).forEach((rawEvent, eventIndex) => {
      const eventTimestamp = Math.round(Number(rawEvent.timestamp) || timestamp);
      const sourceRef = makeTimelineEventRef(matchId, frameIndex, eventIndex, eventTimestamp);
      const killerId = validParticipantId(rawEvent.killerId);
      const victimId = validParticipantId(rawEvent.victimId);
      const assistingParticipantIds = [...new Set(
        (Array.isArray(rawEvent.assistingParticipantIds) ? rawEvent.assistingParticipantIds : [])
          .map(validParticipantId)
          .filter((id) => id !== null),
      )].sort((a, b) => a - b);
      const common = {
        timestamp: eventTimestamp,
        sourceRef,
        killerId,
        victimId,
        assistingParticipantIds,
        position: normalizedPosition(rawEvent.position),
      };
      if (rawEvent.type === "CHAMPION_KILL") {
        killEvents.push(common);
      } else if (rawEvent.type === "ELITE_MONSTER_KILL") {
        objectiveEvents.push({
          ...common,
          killerTeamId: rawEvent.killerTeamId,
          monsterType: rawEvent.monsterType === "HORDE" ? "VOID_GRUB" : rawEvent.monsterType,
          monsterSubType: rawEvent.monsterSubType || null,
        });
      } else if (rawEvent.type === "BUILDING_KILL") {
        const killerTeamId = participantById.get(killerId)?.teamId ?? null;
        const destroyedTeamId = rawEvent.teamId === 100 || rawEvent.teamId === 200 ? rawEvent.teamId : null;
        const takerTeamId = killerTeamId || (destroyedTeamId === 100 ? 200 : destroyedTeamId === 200 ? 100 : null);
        structureEvents.push({
          ...common,
          destroyedTeamId,
          takerTeamId,
          takerRelation: relationForTeam(takerTeamId, targetTeamId),
          buildingType: rawEvent.buildingType || null,
          towerType: rawEvent.towerType || null,
          laneType: rawEvent.laneType || null,
        });
      }
    });
  });

  return {
    schemaVersion: "2.0",
    matchId,
    targetParticipantId,
    targetTeamId,
    hasRawTimeline,
    participants,
    participantById,
    snapshots: snapshots.sort((a, b) => a.timestamp - b.timestamp),
    killEvents: killEvents.sort((a, b) => a.timestamp - b.timestamp || a.sourceRef.id.localeCompare(b.sourceRef.id)),
    objectiveEvents: objectiveEvents.sort((a, b) => a.timestamp - b.timestamp || a.sourceRef.id.localeCompare(b.sourceRef.id)),
    structureEvents: structureEvents.sort((a, b) => a.timestamp - b.timestamp || a.sourceRef.id.localeCompare(b.sourceRef.id)),
  };
}

function latestParticipantFrameAtOrBefore(source, participantId, timestamp, maxAgeMs) {
  for (let index = source.snapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = source.snapshots[index];
    if (snapshot.timestamp > timestamp) continue;
    if (timestamp - snapshot.timestamp > maxAgeMs) return null;
    const row = snapshot.participants.get(participantId);
    if (row) return row;
  }
  return null;
}

function resolveCompleteTeamSnapshotAtOrBefore(source, relation, timestamp, maxAgeMs = 60000) {
  const ids = source.participants
    .filter((participant) => relationForTeam(participant.teamId, source.targetTeamId) === relation)
    .map((participant) => participant.participantId);
  let sawSnapshotAtOrBefore = false;
  let sawIncompleteInRange = false;
  for (let index = source.snapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = source.snapshots[index];
    if (snapshot.timestamp > timestamp) continue;
    sawSnapshotAtOrBefore = true;
    if (timestamp - snapshot.timestamp > maxAgeMs) break;
    const rows = ids.map((id) => snapshot.participants.get(id)).filter(Boolean);
    if (rows.length !== 5) {
      sawIncompleteInRange = true;
      continue;
    }
    return {
      snapshot: {
        snapshotTimestamp: snapshot.timestamp,
        frameAgeSeconds: Math.round((timestamp - snapshot.timestamp) / 1000),
        totalGold: rows.reduce((sum, row) => sum + row.totalGold, 0),
        totalXp: rows.reduce((sum, row) => sum + row.xp, 0),
        livingParticipantIds: rows.filter((row) => row.currentHealth > 0).map((row) => row.participantId),
        positionedParticipantIds: rows.filter((row) => row.position).map((row) => row.participantId),
        participantFrames: rows.map((row) => ({
          participantId: row.participantId,
          currentHealth: row.currentHealth,
          position: row.position,
          sourceRef: row.sourceRef,
        })),
      },
      limitationCode: null,
    };
  }
  return {
    snapshot: null,
    limitationCode: sawIncompleteInRange || !sawSnapshotAtOrBefore
      ? "INCOMPLETE_TEAM_SNAPSHOT"
      : "STALE_TEAM_SNAPSHOT",
  };
}

function completeTeamSnapshotAtOrBefore(source, relation, timestamp, maxAgeMs = 60000) {
  return resolveCompleteTeamSnapshotAtOrBefore(
    source,
    relation,
    timestamp,
    maxAgeMs,
  ).snapshot;
}

module.exports = {
  extractTeamplaySource,
  eventParticipantIds,
  latestParticipantFrameAtOrBefore,
  resolveCompleteTeamSnapshotAtOrBefore,
  completeTeamSnapshotAtOrBefore,
};
~~~

- [ ] **Step 5: Run tests and commit**

Run: node test-artifacts/server/teamplay-source-v2-tests.mjs

Expected: all source tests pass and the final line reports 5 passed, 0 failed.

Run: node --check lib/teamplay-contract-v2.js && node --check lib/teamplay-source-v2.js

Expected: exit 0 with no output.

Commit:

~~~bash
git add lib/teamplay-contract-v2.js lib/teamplay-source-v2.js test-artifacts/fixtures/teamplay-v2-fixtures.mjs test-artifacts/server/teamplay-source-v2-tests.mjs
git commit -m "feat: add teamplay v2 source contract"
~~~

### Task 2: Spatial-Temporal Encounter Detection

**Files:**
- Create: lib/teamplay-encounters-v2.js
- Test: test-artifacts/server/teamplay-encounters-v2-tests.mjs

**Interfaces:**
- Consumes: extractTeamplaySource output, eventParticipantIds, stableId, relationForTeam, latestParticipantFrameAtOrBefore.
- Produces: distanceBetween(left, right), medoidPosition(events), buildEncounters(source).
- Encounter output fields: id, type, classificationBasis, phaseEvents, participants, allyDeaths, enemyDeaths, firstTakedownTeam, centerPosition, playerInvolvement, linkedObjectiveEngagementIds, sourceRefs, startTimestamp, endTimestamp, confidence, limitationCodes.
- Consumed by: Tasks 3-7.

- [ ] **Step 1: Write table-driven failing encounter tests**

At the top of the test, import makeMatchFixture, makeFrame, makeTimelineFixture, championKill, extractTeamplaySource, and buildEncounters. Define these local helpers before the assertions:

~~~js
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
~~~

Use synthetic kill rows to cover the exact boundaries:

~~~js
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
    [...encounter.participants.ally.map((row) => row.participantId)].sort((a, b) => a - b),
  );
  assert.ok(!JSON.stringify(encounter.participants).includes("puuid"));
  assert.ok(!JSON.stringify(encounter.participants).includes("summoner"));
});

test("observer teamfight includes target as NOT_INVOLVED", () => {
  const encounter = observerTeamfight();
  assert.equal(encounter.playerInvolvement.level, "NOT_INVOLVED");
});
~~~

- [ ] **Step 2: Run tests to verify failure**

Run: node test-artifacts/server/teamplay-encounters-v2-tests.mjs

Expected: FAIL with MODULE_NOT_FOUND for lib/teamplay-encounters-v2.js.

- [ ] **Step 3: Implement grouping, medoid, classification, and phases**

Use these exact decision functions:

~~~js
const { stableId, relationForTeam } = require("./teamplay-contract-v2");
const {
  eventParticipantIds,
  latestParticipantFrameAtOrBefore,
} = require("./teamplay-source-v2");

function distanceBetween(left, right) {
  if (!left || !right) return null;
  return Math.round(Math.hypot(left.x - right.x, left.y - right.y));
}

function medoidPosition(events) {
  const positioned = events.filter((event) => event.position);
  if (positioned.length === 0) return null;
  return positioned
    .map((event) => ({
      event,
      sum: positioned.reduce((total, other) => total + distanceBetween(event.position, other.position), 0),
    }))
    .sort((a, b) => a.sum - b.sum || a.event.timestamp - b.event.timestamp ||
      a.event.sourceRef.id.localeCompare(b.event.sourceRef.id))[0].event.position;
}

function sharesDirectParticipant(left, right) {
  const leftIds = new Set(eventParticipantIds(left));
  return eventParticipantIds(right).some((id) => leftIds.has(id));
}

function canJoin(cluster, event) {
  const first = cluster[0];
  const last = cluster[cluster.length - 1];
  const gap = event.timestamp - last.timestamp;
  if (gap > 25000 || event.timestamp - first.timestamp > 45000) return false;
  if (!last.position || !event.position) {
    return gap <= 15000 && sharesDirectParticipant(last, event);
  }
  const lastDistance = distanceBetween(last.position, event.position);
  const adjacentLimit = gap <= 15000 ? 5000 : 3000;
  if (lastDistance > adjacentLimit) return false;
  const positionedCount = cluster.filter((row) => row.position).length;
  if (positionedCount >= 2 && distanceBetween(medoidPosition(cluster), event.position) > 4000) return false;
  return true;
}

function phaseRows(events) {
  const start = events[0].timestamp;
  let lateStart = Infinity;
  for (let index = 1; index < events.length; index += 1) {
    if (events[index].timestamp - events[index - 1].timestamp > 10000) {
      lateStart = events[index].timestamp;
      break;
    }
  }
  return events.map((event) => ({
    phase: event.timestamp < start + 2000
      ? "OPENING"
      : event.timestamp >= lateStart ? "LATE_SEQUENCE" : "EXCHANGE",
    timestamp: event.timestamp,
    sourceRef: event.sourceRef,
    killerId: event.killerId,
    victimId: event.victimId,
    assistingParticipantIds: event.assistingParticipantIds,
  }));
}

function classifyEncounter(events, source) {
  const known = new Map();
  events.flatMap(eventParticipantIds).forEach((participantId) => {
    const teamId = source.participantById.get(participantId)?.teamId;
    const relation = relationForTeam(teamId, source.targetTeamId);
    if (relation !== "UNKNOWN") known.set(participantId, relation);
  });
  const ally = [...known.values()].filter((value) => value === "ALLY").length;
  const enemy = [...known.values()].filter((value) => value === "ENEMY").length;
  const deathCount = events.length;
  const type = deathCount === 1
    ? "PICK"
    : deathCount >= 3 && ally >= 2 && enemy >= 2 && known.size >= 6
      ? "TEAMFIGHT_CANDIDATE"
      : "SKIRMISH";
  return { type, classificationBasis: { deathCount, knownAllyDirect: ally, knownEnemyDirect: enemy, knownUniqueDirect: known.size } };
}
~~~

Complete buildEncounters by:

1. Sorting killEvents by timestamp and sourceRef ID.
2. Creating clusters with canJoin.
3. Counting victim relations into allyDeaths and enemyDeaths. firstTakedownTeam is the opposite relation of the first sorted victim (enemy victim -> ALLY, ally victim -> ENEMY); an unknown victim produces UNKNOWN and never defaults to ENEMY.
4. Building participants as { ally, enemy, unknown } arrays of { participantId, champion, role }; sort each by participantId and never include puuid, summonerName, or Riot ID.
5. Building direct involvement records for target killer, victim, and assist.
6. If no direct record exists, using only prior frames with age <=15 seconds, currentHealth >0, and distance <=4,000 to create POSITION_PROXIMITY; 16-30 second frames may create LOW positioning facts later but never APPROXIMATE. The proximity record has stage ENCOUNTER, distance, frameAgeSeconds, and both the participant-frame and encounter-event sourceRefs. Direct records have stage ENCOUNTER and their event sourceRef. Sort every record by event timestamp, basis, then sourceRef ID.
7. Setting confidence MEDIUM with MISSING_SPATIAL_LINK when any event lacks position, otherwise HIGH.
8. Counting direct participants whose team relation is UNKNOWN in classificationBasis.unknownUniqueDirect, excluding them from knownUniqueDirect, and adding UNKNOWN_TEAM to limitationCodes.
9. Generating id with stableId("enc", { schemaVersion, matchId, type, startTimestamp, sourceRefIds }).

Export:

~~~js
module.exports = {
  distanceBetween,
  medoidPosition,
  buildEncounters,
};
~~~

- [ ] **Step 4: Run tests and commit**

Run: node test-artifacts/server/teamplay-encounters-v2-tests.mjs

Expected: every boundary, classification, phase, and involvement test passes.

Run: node --check lib/teamplay-encounters-v2.js

Expected: exit 0.

Commit:

~~~bash
git add lib/teamplay-encounters-v2.js test-artifacts/server/teamplay-encounters-v2-tests.mjs
git commit -m "feat: detect ten-player combat encounters"
~~~

### Task 3: Objective Engagements and Team Progression

**Files:**
- Create: lib/teamplay-objectives-v2.js
- Test: test-artifacts/server/teamplay-objectives-v2-tests.mjs

**Interfaces:**
- Consumes: source output, buildEncounters output, stableId, relationForTeam, lowerConfidence, distanceBetween, resolveCompleteTeamSnapshotAtOrBefore.
- Produces: groupObjectiveAnchors(source), buildObjectiveEngagements(source, encounters).
- Returns: { objectiveEngagements, encounters } where returned encounters include linkedObjectiveEngagementIds.
- Consumed by: Tasks 4-7.

- [ ] **Step 1: Write failing objective tests**

Import the shared fixture builders plus extractTeamplaySource, buildEncounters, and buildObjectiveEngagements. Define the complete local fixture layer:

~~~js
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
    structures: [buildingKill(structureTimestamp, killerId, destroyedTeamId, { x: 5100, y: 5000 })],
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
~~~

Cover each contract boundary with synthetic events:

~~~js
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
  assert.deepEqual(startIncluded.objectiveEngagements[0].setupWindow.linkedEncounterIds,
    [startIncluded.encounters[0].id]);
  assert.deepEqual(setupEndExcluded.objectiveEngagements[0].contestWindow.linkedEncounterIds,
    [setupEndExcluded.encounters[0].id]);
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
  assert.equal(objective.linkedEncounterInvolvements[0].encounterPlayerInvolvement.level, "CONFIRMED");
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
  const objective = objectiveWithFramesAt([480000, 600000, 660000]);
  assert.equal(objective.setupWindow.teamSnapshots.end.ally.snapshotTimestamp, 480000);
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
~~~

- [ ] **Step 2: Run tests to verify failure**

Run: node test-artifacts/server/teamplay-objectives-v2-tests.mjs

Expected: FAIL with MODULE_NOT_FOUND for lib/teamplay-objectives-v2.js.

- [ ] **Step 3: Implement neutral-objective grouping**

Implement split-grub grouping without team-based separation:

~~~js
function objectiveCaptureRelation(event, source) {
  const killerTeamId = source.participantById.get(event.killerId)?.teamId;
  const fallbackTeamId = event.killerTeamId === 100 || event.killerTeamId === 200
    ? event.killerTeamId
    : null;
  return relationForTeam(killerTeamId || fallbackTeamId, source.targetTeamId);
}

function groupObjectiveAnchors(source) {
  const out = [];
  for (const event of source.objectiveEvents) {
    const relation = objectiveCaptureRelation(event, source);
    if (event.monsterType !== "VOID_GRUB") {
      out.push({ objectiveType: event.monsterType || "UNKNOWN_NEUTRAL_OBJECTIVE", events: [event], relations: [relation] });
      continue;
    }
    const last = out[out.length - 1];
    const canJoin = last &&
      last.objectiveType === "VOID_GRUB_CAMP" &&
      event.timestamp - last.events[last.events.length - 1].timestamp <= 20000 &&
      event.timestamp - last.events[0].timestamp <= 60000;
    if (canJoin) {
      last.events.push(event);
      last.relations.push(relation);
    } else {
      out.push({ objectiveType: "VOID_GRUB_CAMP", events: [event], relations: [relation] });
    }
  }
  return out;
}

function captureSummary(anchor) {
  const captureCounts = { ally: 0, enemy: 0, unknown: 0 };
  anchor.relations.forEach((relation) => {
    const key = relation === "ALLY" ? "ally" : relation === "ENEMY" ? "enemy" : "unknown";
    captureCounts[key] += 1;
  });
  const knownSides = ["ally", "enemy"].filter((side) => captureCounts[side] > 0);
  const captureTeam = knownSides.length > 1
    ? "SPLIT"
    : knownSides[0] === "ally" ? "ALLY" : knownSides[0] === "enemy" ? "ENEMY" : "UNKNOWN";
  return { captureCounts, captureTeam };
}
~~~

- [ ] **Step 4: Implement windows, single-anchor assignment, conversions, and involvement**

For every anchor:

~~~js
const captureStartTimestamp = anchor.events[0].timestamp;
const captureEndTimestamp = anchor.events[anchor.events.length - 1].timestamp;
const windows = {
  setupWindow: { startMs: captureStartTimestamp - 90000, endMsExclusive: captureStartTimestamp - 20000 },
  contestWindow: { startMs: captureStartTimestamp - 20000, endMsExclusive: captureEndTimestamp + 20000 },
  conversionWindow: { startMs: captureEndTimestamp, endMsExclusive: captureEndTimestamp + 120000 },
};
~~~

Set objective startTimestamp to setupWindow.startMs, endTimestamp to conversionWindow.endMsExclusive, and sourceRefs to every grouped capture event sourceRef sorted by ID.
Set objective centerPosition to medoidPosition(anchor.events); use null when every capture event lacks position.
Generate id with stableId("obj", { schemaVersion, matchId, objectiveType, startTimestamp, sourceRefIds }). Start confidence at HIGH; use MEDIUM when either a grouped capture team or capture position is missing, and LOW when every capture team is UNKNOWN and centerPosition is null. Add UNKNOWN_TEAM whenever captureCounts.unknown > 0. Later association/snapshot limitations do not erase the capture facts; they append limitation codes and lower only the affected association or fact confidence.

Assign each encounter to one objective only:

~~~js
function distanceToCaptureInterval(timestamp, start, end) {
  if (timestamp < start) return start - timestamp;
  if (timestamp > end) return timestamp - end;
  return 0;
}

function chooseObjectiveForEncounter(encounter, objectives) {
  const centerTime = Math.round((encounter.startTimestamp + encounter.endTimestamp) / 2);
  return objectives
    .filter((objective) =>
      centerTime >= objective.setupWindow.startMs &&
      centerTime < objective.contestWindow.endMsExclusive)
    .map((objective) => ({
      objective,
      timeDistance: distanceToCaptureInterval(
        centerTime,
        objective.captureStartTimestamp,
        objective.captureEndTimestamp,
      ),
    }))
    .sort((a, b) => a.timeDistance - b.timeDistance ||
      a.objective.captureStartTimestamp - b.objective.captureStartTimestamp ||
      a.objective.id.localeCompare(b.objective.id))[0]?.objective || null;
}
~~~

Apply these exact rules:

- Assign every kill event to at most one eligible objective by the same minimum distance-to-capture-interval rule. Put it in setupWindow or contestWindow according to its timestamp; if it is eligible for both stages of different objectives, choose the objective first and then derive the stage for that objective.
- setupWindow.deathCounts and contestWindow.deathCounts independently increment ally or enemy for their single-assigned kill events from the victim participant relation. UNKNOWN victims do not increment either side and add UNKNOWN_TEAM. conversionWindow.deathCounts is null.
- Store encounter IDs in the selected setupWindow.linkedEncounterIds or contestWindow.linkedEncounterIds. objective.linkedEncounterIds is their sorted union, while Task 4 merges only contestWindow encounters into the objective-primary scene.
- If both encounter and objective positions exist, link only at distance <=5,000 and set spatialLinkConfidence to HIGH. If either position is missing, allow a nominal contest-window link, set spatialLinkConfidence to MEDIUM, and add MISSING_SPATIAL_LINK. associationConfidence is lowerConfidence(encounter.confidence, lowerConfidence(objective.confidence, spatialLinkConfidence)).
- objective playerInvolvement is CONFIRMED only for target OBJECTIVE_KILLER or OBJECTIVE_ASSIST.
- Objective involvement records use stage CONTEST and the capture event sourceRef. linkedEncounterInvolvements rows are { encounterId, encounterPlayerInvolvement, associationConfidence } and preserve encounter involvement without merging it into objective playerInvolvement.
- conversion structure selection uses the most recent prior captureEndTimestamp within 120 seconds.
- Assign every later neutral-objective capture event as a conversion macro sourceRef to the one most-recent prior captureEndTimestamp within [0, 120000) milliseconds; never assign an anchor to its own conversion window.
- ALLY and ENEMY captures include only same-side structures; SPLIT preserves both sides; UNKNOWN includes none.
- Resolve each team snapshot independently at startMs and endMsExclusive through resolveCompleteTeamSnapshotAtOrBefore. Put null in the response and append its INCOMPLETE_TEAM_SNAPSHOT or STALE_TEAM_SNAPSHOT result to both the window and objective limitationCodes; never silently substitute a future or partial snapshot.
- Window response snapshots keep snapshotTimestamp, frameAgeSeconds, totalGold, totalXp, livingParticipantIds, and positionedParticipantIds; participantFrames is internal input for positioning facts and is not serialized.
- Each window has sourceRefs and limitationCodes. setupWindow and contestWindow sourceRefs contain only their single-assigned kill/objective-linked encounter evidence; conversionWindow sourceRefs contain its single-assigned structure events and later neutral-objective macro events. Window arrays and sourceRefs are sorted by timestamp then sourceRef ID.

Export:

~~~js
module.exports = {
  groupObjectiveAnchors,
  buildObjectiveEngagements,
};
~~~

- [ ] **Step 5: Run tests and commit**

Run: node test-artifacts/server/teamplay-objectives-v2-tests.mjs

Expected: all objective grouping, window, conversion, UNKNOWN, and involvement tests pass.

Run: node --check lib/teamplay-objectives-v2.js

Expected: exit 0.

Commit:

~~~bash
git add lib/teamplay-objectives-v2.js test-artifacts/server/teamplay-objectives-v2-tests.mjs
git commit -m "feat: model objective engagement progressions"
~~~

### Task 4: Scene De-duplication, Personal Reviews, and Orchestration

**Files:**
- Create: lib/teamplay-reviews-v2.js
- Create: lib/teamplay-analysis-v2.js
- Test: test-artifacts/server/teamplay-reviews-v2-tests.mjs

**Interfaces:**
- Consumes: source, encounters, objectiveEngagements, makeFactId, stableId, createCoverageEnvelope, latestParticipantFrameAtOrBefore, resolveCompleteTeamSnapshotAtOrBefore.
- Produces: buildScenes(source, encounters, objectives), scoreScene(scene, context), buildPersonalReviewCandidates(source, scenes, encounters, objectives), selectTopPersonalReviews(candidates, limit), buildTeamAppendix(source, review, scene), buildCoverage(source, candidates, domains), buildTeamplayAnalysisV2(matchDetail, timeline, targetParticipantId).
- Public model shape: schemaVersion, coverage, encounters, objectiveEngagements, scenes, personalReviews, teamAppendix.
- Consumed by: Tasks 5-10.

- [ ] **Step 1: Write failing review and coverage tests**

Import the shared raw fixture builders plus extractTeamplaySource, buildTeamplayAnalysisV2, buildScenes, scoreScene, and buildCoverage. Define:

~~~js
const NOT_INVOLVED = { level: "NOT_INVOLVED", records: [] };
const CONFIRMED_ASSIST = {
  level: "CONFIRMED",
  records: [{
    basis: "ASSIST",
    stage: "ENCOUNTER",
    sourceRefs: [{ kind: "TIMELINE_EVENT", id: "KR_TEAMPLAY_FIXTURE:0:0", timestamp: 100000, participantId: null }],
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
  const source = extractTeamplaySource(makeMatchFixture(), makeTimelineFixture([makeFrame(0)]), 1);
  const encounter = {
    id: "enc_1",
    startTimestamp: 100000,
    endTimestamp: 110000,
    sourceRefs: [{ kind: "TIMELINE_EVENT", id: "event_1", timestamp: 100000, participantId: null }],
    playerInvolvement: CONFIRMED_ASSIST,
    confidence: "HIGH",
  };
  const objective = {
    id: "obj_1",
    sourceRefs: [{ kind: "TIMELINE_EVENT", id: "event_2", timestamp: 110000, participantId: null }],
    setupWindow: { startMs: 20000 },
    contestWindow: { linkedEncounterIds: ["enc_1"] },
    conversionWindow: { endMsExclusive: 230000 },
    linkedEncounterIds: ["enc_1"],
    linkedEncounterInvolvements: [{ encounterId: "enc_1", associationConfidence: "HIGH" }],
    playerInvolvement: NOT_INVOLVED,
    confidence: "HIGH",
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
      makeFrame(100000, [championKill(100000, 1, 6, [], { x: 1000, y: 1000 })]),
      makeFrame(200000, [championKill(200000, 1, 6, [], { x: 1000, y: 1000 })]),
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
    makeFrame(0, [championKill(100000, 1, 6, [], { x: 1000, y: 1000 })]),
  ]);
}

function modelWithFramesBeforeAndAfterScene() {
  return modelFromFrames([
    makeFrame(540000, [championKill(550000, 1, 6, [], { x: 1000, y: 1000 })]),
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
~~~

Write explicit fixtures for the following behavior:

~~~js
test("objective-linked encounter produces one scene and one review", () => {
  const model = buildModelWithLinkedObjectiveEncounter();
  assert.equal(model.scenes.length, 1);
  assert.equal(model.personalReviews.length, 1);
  assert.equal(model.personalReviews[0].objectiveEngagementId, model.objectiveEngagements[0].id);
  assert.deepEqual(model.personalReviews[0].encounterIds, [model.encounters[0].id]);
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
  const secondIds = buildRepeatableModel().personalReviews.flatMap((review) => review.evidenceIds);
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
    makeFrame(90000, [championKill(100000, 2, 6, [], { x: 9000, y: 9000 })], {
      1: { x: 1000, y: 1000 },
    }),
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
~~~

The weight assertion is: OBJECTIVE_CONTEST 30 + CONFIRMED 30 + first recorded involvement 15 + objective-and-encounter 15 + death differential cap 15 + structure conversion 10 = 115.

- [ ] **Step 2: Run tests to verify failure**

Run: node test-artifacts/server/teamplay-reviews-v2-tests.mjs

Expected: FAIL with MODULE_NOT_FOUND for lib/teamplay-reviews-v2.js or lib/teamplay-analysis-v2.js.

- [ ] **Step 3: Implement scene construction and effective involvement**

Implement one objective-primary scene per objective and one scene for every unlinked encounter:

~~~js
const INVOLVEMENT_RANK = { NOT_INVOLVED: 0, APPROXIMATE: 1, CONFIRMED: 2 };

function effectiveLevel(involvements) {
  return involvements.reduce((best, entry) => {
    const level = entry.playerInvolvement?.level || "NOT_INVOLVED";
    return INVOLVEMENT_RANK[level] > INVOLVEMENT_RANK[best] ? level : best;
  }, "NOT_INVOLVED");
}

function buildScenes(source, encounters, objectives) {
  const encounterById = new Map(encounters.map((row) => [row.id, row]));
  const linkedIds = new Set();
  const scenes = objectives.map((objective) => {
    const linked = objective.contestWindow.linkedEncounterIds
      .map((id) => encounterById.get(id))
      .filter(Boolean);
    linked.forEach((encounter) => linkedIds.add(encounter.id));
    const involvements = [
      {
        domainType: "OBJECTIVE",
        domainId: objective.id,
        playerInvolvement: objective.playerInvolvement,
        associationConfidence: objective.confidence,
      },
      ...linked.map((encounter) => ({
        domainType: "ENCOUNTER",
        domainId: encounter.id,
        playerInvolvement: encounter.playerInvolvement,
        associationConfidence: objective.linkedEncounterInvolvements
          .find((row) => row.encounterId === encounter.id)?.associationConfidence || "LOW",
      })),
    ];
    const startTimestamp = Math.min(objective.setupWindow.startMs, ...linked.map((row) => row.startTimestamp));
    const endTimestamp = Math.max(objective.conversionWindow.endMsExclusive, ...linked.map((row) => row.endTimestamp));
    return {
      sceneId: stableId("scene", {
        matchId: source.matchId,
        primaryType: "OBJECTIVE",
        startTimestamp,
        sourceRefIds: objective.sourceRefs.map((ref) => ref.id).sort(),
      }),
      primaryType: "OBJECTIVE",
      objectiveEngagementId: objective.id,
      encounterIds: linked.map((row) => row.id).sort(),
      startTimestamp,
      endTimestamp,
      involvements,
      effectiveInvolvementLevel: effectiveLevel(involvements),
    };
  });

  encounters.filter((encounter) => !linkedIds.has(encounter.id)).forEach((encounter) => {
    const involvements = [{
      domainType: "ENCOUNTER",
      domainId: encounter.id,
      playerInvolvement: encounter.playerInvolvement,
      associationConfidence: encounter.confidence,
    }];
    scenes.push({
      sceneId: stableId("scene", {
        matchId: source.matchId,
        primaryType: "ENCOUNTER",
        startTimestamp: encounter.startTimestamp,
        sourceRefIds: encounter.sourceRefs.map((ref) => ref.id).sort(),
      }),
      primaryType: "ENCOUNTER",
      objectiveEngagementId: null,
      encounterIds: [encounter.id],
      startTimestamp: encounter.startTimestamp,
      endTimestamp: encounter.endTimestamp,
      involvements,
      effectiveInvolvementLevel: effectiveLevel(involvements),
    });
  });
  return scenes.sort((a, b) => a.startTimestamp - b.startTimestamp || a.sceneId.localeCompare(b.sceneId));
}
~~~

Before returning scenes, derive each scene's score inputs from unique sourceRef IDs so an objective-linked encounter cannot double-count a kill. Set scene.sourceRefs to the sorted union of its domains, scene.confidence to the lowest domain/association confidence, and scene.limitationCodes to the sorted union. Set allyDeaths and enemyDeaths from unique victim events, structureConversionCount from unique structure sourceRefs, and playerFirstRecordedInvolvement only when the target is killer, victim, or assistant on the earliest sorted CHAMPION_KILL in the scene. For an encounter-only scene use its encounter type; for an objective-primary scene use OBJECTIVE base scoring. Store scoreScene(scene, context) as scene.importanceScore. Sort nested involvement records by domainType, domainId, record timestamp, basis, then sourceRef ID without merging records across domains.

- [ ] **Step 4: Implement score, facts, reviews, appendix, and coverage**

Use this exact deterministic score:

~~~js
function scoreScene(scene, context) {
  const base = scene.primaryType === "OBJECTIVE"
    ? 30
    : context.encounterType === "TEAMFIGHT_CANDIDATE" ? 30
      : context.encounterType === "SKIRMISH" ? 20 : 10;
  const involvement = scene.effectiveInvolvementLevel === "CONFIRMED"
    ? 30
    : scene.effectiveInvolvementLevel === "APPROXIMATE" ? 10 : 0;
  const first = scene.playerFirstRecordedInvolvement ? 15 : 0;
  const combined = scene.objectiveEngagementId && scene.encounterIds.length > 0 ? 15 : 0;
  const deathSwing = Math.min(15, Math.abs((scene.allyDeaths || 0) - (scene.enemyDeaths || 0)) * 5);
  const conversion = scene.structureConversionCount > 0 ? 10 : 0;
  return base + involvement + first + combined + deathSwing + conversion;
}
~~~

Build each fact with an exact closed type, typed sourceRefs, confidence, limitationCodes, and a factId generated after reviewId exists:

~~~js
function finalizeFact(reviewId, fact) {
  const normalized = {
    type: fact.type,
    timestamp: Math.round(fact.timestamp),
    value: fact.value,
    confidence: fact.confidence,
    sourceRefs: fact.sourceRefs.slice().sort((a, b) => a.id.localeCompare(b.id)),
    limitationCodes: [...new Set(fact.limitationCodes || [])].sort(),
  };
  return { factId: makeFactId(reviewId, normalized), ...normalized };
}
~~~

Use only these fact types:

~~~js
const FACT_TYPES = new Set([
  "ENCOUNTER_CLASSIFICATION",
  "ALLY_DEATH_COUNT",
  "ENEMY_DEATH_COUNT",
  "FIRST_TAKEDOWN_TEAM",
  "PLAYER_CONFIRMED_KILL",
  "PLAYER_CONFIRMED_ASSIST",
  "PLAYER_CONFIRMED_DEATH",
  "PLAYER_FIRST_RECORDED_INVOLVEMENT",
  "PLAYER_DISTANCE_LE_2500",
  "PLAYER_DISTANCE_2500_5000",
  "PLAYER_DISTANCE_GT_5000",
  "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT",
  "OBJECTIVE_CAPTURE_TEAM",
  "OBJECTIVE_CAPTURE_COUNTS",
  "PLAYER_OBJECTIVE_KILLER",
  "PLAYER_OBJECTIVE_ASSIST",
  "STRUCTURE_CONVERSION",
  "PRE_ENCOUNTER_GOLD_DIFFERENCE",
  "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE",
]);
~~~

Build every candidate review with this complete public shape before ranking:

~~~js
{
  reviewId,
  sceneId: scene.sceneId,
  encounterIds: [...scene.encounterIds],
  objectiveEngagementId: scene.objectiveEngagementId,
  sourceRefs,
  startTimestamp: scene.startTimestamp,
  endTimestamp: scene.endTimestamp,
  confidence,
  limitationCodes,
  importanceScore: scene.importanceScore,
  involvements: scene.involvements,
  effectiveInvolvementLevel: scene.effectiveInvolvementLevel,
  situationFacts,
  decisionFacts,
  positioningFacts,
  outcomeFacts,
  evidenceIds,
  narrative: null,
  teamAppendixId,
}
~~~

The review ID is stableId("review", { schemaVersion, matchId, sceneId, startTimestamp, sourceRefIds }) using only the scene's domain event sourceRef IDs, so adding a usable participant frame does not rename the scene review. The appendix ID is stableId("appendix", { schemaVersion, matchId, reviewId, sourceRefIds }) with the same domain refs. The public review sourceRefs may additionally include participant-frame evidence. sourceRefs, facts, involvements, limitationCodes, and evidenceIds are de-duplicated and deterministically sorted. Every fact has at least one sourceRef. Review confidence is the lowest of scene confidence and every emitted fact confidence; when there are no facts, use scene confidence. Review limitations are the union of scene and fact limitations. scene.importanceScore is populated before the scene is returned; do not keep the score only on the review.

Use these exact fact value requirements:

| Fact family | Required value keys |
|---|---|
| ENCOUNTER_CLASSIFICATION | encounterId, type |
| ALLY_DEATH_COUNT / ENEMY_DEATH_COUNT | count |
| FIRST_TAKEDOWN_TEAM / OBJECTIVE_CAPTURE_TEAM | team |
| OBJECTIVE_CAPTURE_COUNTS | ally, enemy, unknown |
| PLAYER_CONFIRMED_KILL / ASSIST / DEATH | participantId, phase, eventTimestamp |
| PLAYER_FIRST_RECORDED_INVOLVEMENT | participantId, basis, eventTimestamp |
| PLAYER_DISTANCE_* | distance, frameTimestamp, frameAgeSeconds, stage |
| NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT | frameTimestamp, frameAgeSeconds, radius |
| PLAYER_OBJECTIVE_KILLER / ASSIST | participantId, stage, eventTimestamp |
| STRUCTURE_CONVERSION | takerTeam, buildingType, towerType, laneType |
| PRE_ENCOUNTER_GOLD_DIFFERENCE | value, allyGold, enemyGold, snapshotTimestamp, frameAgeSeconds |
| PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE | eventTimestamp, secondsAfterCapture |

Fact-category assignment is fixed. situationFacts contains encounter classification, de-duplicated side death counts, first takedown, objective capture team, and capture counts. decisionFacts contains only the target's directly recorded kill, assist, death, objective killer/assist, and first-recorded-involvement facts; proximity alone never enters this array. positioningFacts contains the one distance fact plus the complete-snapshot nearby-ally fact when supported. outcomeFacts contains structure conversions and, for an objective scene, the earliest target-victim CHAMPION_KILL in [captureEndTimestamp, captureEndTimestamp + 120000). PRE_ENCOUNTER_GOLD_DIFFERENCE lives only in the appendix. Omit unsupported optional facts; never emit a zero/UNKNOWN claim by guessing missing source data.

Build positioning from one deterministic anchor per candidate scene: sort the scene's original involvement records by their TIMELINE_EVENT timestamp, domainType, domainId, basis, and sourceRef ID; use the first record's event position, or its domain centerPosition only when that event position is absent. Look up the target's latest frame at or before that anchor with maxAgeMs 30000. Emit one PLAYER_DISTANCE_* fact from the rounded Euclidean distance. Frame ages <=5s are HIGH, >5s and <=15s MEDIUM, >15s and <=30s LOW, and older/missing frames produce no positioning fact. APPROXIMATE records remain positioning-only and never generate decisionFacts.

For NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT, inspect the exact snapshot used by the target positioning frame. Require the target plus all four allied participant frames at that same timestamp, currentHealth for all four allies, and positions for every living ally. Measure living-ally distance from the target frame position. If any required row is missing, omit the fact and add INCOMPLETE_ALLY_FRAME_COVERAGE to the review and root limitations.

For positions:

- Frame age <=5 seconds produces HIGH.
- 5-15 seconds produces MEDIUM.
- 15-30 seconds produces LOW.
- More than 30 seconds produces no position fact.
- Emit NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT only when all four allied frames exist at the same snapshot and every living ally is farther than 2,500.

For team appendix gold:

~~~js
function preEncounterGoldDifference(source, reviewId, scene) {
  const allyResult = resolveCompleteTeamSnapshotAtOrBefore(source, "ALLY", scene.startTimestamp, 60000);
  const enemyResult = resolveCompleteTeamSnapshotAtOrBefore(source, "ENEMY", scene.startTimestamp, 60000);
  if (!allyResult.snapshot || !enemyResult.snapshot) {
    return {
      fact: null,
      limitationCodes: [allyResult.limitationCode, enemyResult.limitationCode].filter(Boolean),
    };
  }
  const ally = allyResult.snapshot;
  const enemy = enemyResult.snapshot;
  const timestamp = Math.min(ally.snapshotTimestamp, enemy.snapshotTimestamp);
  return {
    fact: finalizeFact(reviewId, {
      type: "PRE_ENCOUNTER_GOLD_DIFFERENCE",
      timestamp,
      value: {
        value: ally.totalGold - enemy.totalGold,
        allyGold: ally.totalGold,
        enemyGold: enemy.totalGold,
        snapshotTimestamp: timestamp,
        frameAgeSeconds: Math.max(ally.frameAgeSeconds, enemy.frameAgeSeconds),
      },
      confidence: Math.max(ally.frameAgeSeconds, enemy.frameAgeSeconds) <= 30 ? "MEDIUM" : "LOW",
      sourceRefs: [...ally.participantFrames, ...enemy.participantFrames].map((row) => row.sourceRef),
      limitationCodes: [],
    }),
    limitationCodes: [],
  };
}
~~~

teamAppendix.preEncounterGoldDifference is the returned fact atom or null. teamAppendix.factIds includes that fact ID plus the capture, death-count, first-takedown, and structure-conversion fact IDs used by the appendix. Its limitationCodes includes incomplete/stale snapshot diagnostics. The appendix remains factual; it does not contain betterChoice, nextGameRule, or team-level coaching prose.

Build the appendix as:

~~~js
{
  teamAppendixId: review.teamAppendixId,
  reviewId: review.reviewId,
  allyDirectParticipants,
  enemyDirectParticipants,
  firstTakedownTeam,
  allyDeaths,
  enemyDeaths,
  preEncounterGoldDifference,
  captureTeam,
  structureConversions,
  factIds,
  limitationCodes,
}
~~~

Direct participant lists are the unique killer, victim, and assistant participant IDs from the scene's encounter and capture source events, mapped to only { participantId, champion, role } and sorted by participantId. UNKNOWN-team participants are not moved into enemy; omit them from both side columns and retain UNKNOWN_TEAM. Death counts de-duplicate kill sourceRefs. firstTakedownTeam uses the earliest sorted kill event. Encounter-only appendices use captureTeam null and an empty structureConversions array.

Coverage rules:

~~~js
function buildCoverage(source, reviewCandidates, domains = []) {
  if (!source.hasRawTimeline) {
    return createCoverageEnvelope({ level: "UNAVAILABLE", source: "NONE" });
  }
  const total = reviewCandidates.length;
  const positioned = reviewCandidates.filter((review) => review.positioningFacts.length > 0).length;
  const ratio = total === 0 ? 0 : positioned / total;
  const inheritedLimitations = [...new Set([
    ...reviewCandidates.flatMap((review) => review.limitationCodes || []),
    ...domains.flatMap((row) => row.limitationCodes || []),
  ])];
  if (total === 0 || positioned === total) {
    return createCoverageEnvelope({
      level: "FULL",
      source: "RAW_TIMELINE",
      usablePositionSceneRatio: ratio,
      limitationCodes: inheritedLimitations,
    });
  }
  if (positioned === 0) {
    return createCoverageEnvelope({
      level: "EVENT_ONLY",
      source: "RAW_TIMELINE",
      usablePositionSceneRatio: 0,
      limitationCodes: [...inheritedLimitations, "NO_POSITION_FRAMES"],
    });
  }
  return createCoverageEnvelope({
    level: "PARTIAL",
    source: "RAW_TIMELINE",
    usablePositionSceneRatio: ratio,
    limitationCodes: [...inheritedLimitations, "PARTIAL_POSITION_FRAMES"],
  });
}
~~~

buildPersonalReviewCandidates excludes effectiveInvolvementLevel NOT_INVOLVED and returns every candidate. selectTopPersonalReviews sorts candidates by importanceScore descending, startTimestamp ascending, reviewId ascending, then keeps five. Build coverage from the uncapped candidates and one teamAppendix row per retained review.

Export the review module explicitly:

~~~js
module.exports = {
  buildScenes,
  scoreScene,
  buildPersonalReviewCandidates,
  selectTopPersonalReviews,
  buildTeamAppendix,
  buildCoverage,
};
~~~

- [ ] **Step 5: Implement the orchestration module**

lib/teamplay-analysis-v2.js must expose one entry point:

~~~js
const { extractTeamplaySource } = require("./teamplay-source-v2");
const { buildEncounters } = require("./teamplay-encounters-v2");
const { buildObjectiveEngagements } = require("./teamplay-objectives-v2");
const {
  buildScenes,
  buildPersonalReviewCandidates,
  selectTopPersonalReviews,
  buildTeamAppendix,
  buildCoverage,
} = require("./teamplay-reviews-v2");

function buildTeamplayAnalysisV2(matchDetail, timeline, targetParticipantId) {
  const source = extractTeamplaySource(matchDetail, timeline, targetParticipantId);
  const baseEncounters = buildEncounters(source);
  const linked = buildObjectiveEngagements(source, baseEncounters);
  const scenes = buildScenes(source, linked.encounters, linked.objectiveEngagements);
  const reviewCandidates = buildPersonalReviewCandidates(
    source,
    scenes,
    linked.encounters,
    linked.objectiveEngagements,
  );
  const personalReviews = selectTopPersonalReviews(reviewCandidates, 5);
  const teamAppendix = personalReviews.map((review) =>
    buildTeamAppendix(source, review, scenes.find((scene) => scene.sceneId === review.sceneId)));
  return {
    schemaVersion: "2.0",
    coverage: buildCoverage(source, reviewCandidates, [
      ...linked.encounters,
      ...linked.objectiveEngagements,
      ...scenes,
      ...teamAppendix,
    ]),
    encounters: linked.encounters,
    objectiveEngagements: linked.objectiveEngagements,
    scenes,
    personalReviews,
    teamAppendix,
  };
}

module.exports = { buildTeamplayAnalysisV2 };
~~~

- [ ] **Step 6: Run tests and commit**

Run: node test-artifacts/server/teamplay-reviews-v2-tests.mjs

Expected: all scene, score, stable fact, cap, coverage, and gold snapshot tests pass.

Run: node --check lib/teamplay-reviews-v2.js && node --check lib/teamplay-analysis-v2.js

Expected: exit 0.

Commit:

~~~bash
git add lib/teamplay-reviews-v2.js lib/teamplay-analysis-v2.js lib/teamplay-source-v2.js test-artifacts/server/teamplay-reviews-v2-tests.mjs
git commit -m "feat: build personal teamplay review model"
~~~

### Task 5: Closed-Code Coaching and v2 Validation

**Files:**
- Create: lib/teamplay-coaching-v2.js
- Modify: lib/teamplay-contract-v2.js
- Test: test-artifacts/server/teamplay-coaching-v2-tests.mjs

**Interfaces:**
- Consumes: complete teamplay model and its review fact atoms.
- Produces: buildFactNarrative(review), eligibleRecommendations(review, model), buildRecommendationCandidatePayload(model), validateRecommendationSelections(envelope, model), applyRecommendationSelections(model, envelope), createLegacyTeamplayEnvelope(), createUnavailableTeamplayEnvelope(), sanitizeTeamplayAnalysisV2(value).
- Consumed by: server integration, stored-sample backfill, UI contract tests.

- [ ] **Step 1: Write failing coaching tests**

Define exact in-memory facts and model builders in the test:

~~~js
function fact(factId, type, confidence = "HIGH", value = {}) {
  return {
    factId,
    type,
    timestamp: 600000,
    value,
    confidence,
    sourceRefs: [{ kind: "TIMELINE_EVENT", id: "event_" + factId, timestamp: 600000, participantId: null }],
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
    decisionFacts: [death],
    positioningFacts: [distance],
    outcomeFacts: [],
    situationFacts: [],
    evidenceIds: [death.factId, distance.factId],
  };
}

function objectiveReviewFarFromFight() {
  const capture = fact("fact_capture", "OBJECTIVE_CAPTURE_TEAM", "HIGH", { team: "ENEMY" });
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
    coverage: { level: "PARTIAL", source: "RAW_TIMELINE", usablePositionSceneRatio: 1, limitationCodes: [] },
    encounters: [],
    objectiveEngagements: [{
      id: "obj_1",
      startTimestamp: 580000,
      endTimestamp: 720000,
      sourceRefs: [{ kind: "TIMELINE_EVENT", id: "event_obj_1", timestamp: 600000, participantId: null }],
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
  const noAlly = fact("fact_no_ally", "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT", "MEDIUM", {
    frameTimestamp: 590000,
    frameAgeSeconds: 10,
    radius: 2500,
  });
  const allyCapture = fact("fact_ally_capture", "OBJECTIVE_CAPTURE_TEAM", "HIGH", { team: "ALLY" });
  const postDeath = fact("fact_post_death", "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE", "HIGH", {
    eventTimestamp: 650000,
    secondsAfterCapture: 40,
  });
  review.positioningFacts.push(noAlly);
  review.situationFacts = [allyCapture];
  review.outcomeFacts.push(postDeath);
  review.evidenceIds.push(noAlly.factId, allyCapture.factId, postDeath.factId);
  return model;
}

function modelWithOneBrokenSceneReference() {
  const model = objectiveModel();
  model.personalReviews[0] = { ...model.personalReviews[0], sceneId: "missing_scene" };
  return model;
}
~~~

Test all fixed mappings:

~~~js
test("fact narrative is server rendered", () => {
  const narrative = buildFactNarrative(reviewWithOpeningDeathAndMediumDistance());
  assert.ok(narrative.factStatements.every((row) => row.source === "SERVER_FACT_TEMPLATE"));
  assert.equal(narrative.decisionAssessment.claimCode, "PLAYER_RECORDED_DEATH");
  assert.equal(narrative.decisionAssessment.source, "SERVER_FACT_TEMPLATE");
  assert.equal(narrative.positioningObservation.claimCode, "POSITION_DISTANCE_2500_5000");
});

test("eligible codes expose only permitted evidence", () => {
  const rows = eligibleRecommendations(objectiveReviewFarFromFight(), objectiveModel());
  assert.deepEqual(rows.map((row) => row.recommendationCode), ["DECIDE_JOIN_OR_TRADE_EARLY"]);
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
    reviews: [{ reviewId, recommendationCode: eligible.recommendationCode, evidenceIds: eligible.evidenceIds }],
  });
  assert.equal(merged.personalReviews[0].narrative.coaching.selectionSource, "AI_SELECTED");
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
  assert.equal(merged.personalReviews[0].narrative.coaching.selectionSource, "RULE_FALLBACK");
  assert.ok(merged.coverage.limitationCodes.includes("INVALID_AI_SELECTION"));
});

test("AI failure uses deterministic fallback priority", () => {
  const merged = applyRecommendationSelections(multiEligibleModel(), null);
  assert.equal(merged.personalReviews[0].narrative.coaching.recommendationCode, "RESET_AFTER_CAPTURE");
  assert.equal(merged.personalReviews[0].narrative.coaching.selectionSource, "RULE_FALLBACK");
});

test("root fatal error differs from item error", () => {
  assert.equal(sanitizeTeamplayAnalysisV2(null).rootValid, false);
  const result = sanitizeTeamplayAnalysisV2(modelWithOneBrokenSceneReference());
  assert.equal(result.rootValid, true);
  assert.ok(result.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
  assert.equal(result.data.personalReviews.length, 0);
});
~~~

- [ ] **Step 2: Run tests to verify failure**

Run: node test-artifacts/server/teamplay-coaching-v2-tests.mjs

Expected: FAIL with MODULE_NOT_FOUND for lib/teamplay-coaching-v2.js.

- [ ] **Step 3: Implement fixed fact templates and recommendation registry**

Use a closed registry; no AI-provided text is accepted:

~~~js
const RECOMMENDATIONS = {
  GROUP_BEFORE_OBJECTIVE: {
    priority: 2,
    requiredFactTypes: ["NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT"],
    allowedFactTypes: ["NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT", "OBJECTIVE_CAPTURE_TEAM"],
    requiresObjective: true,
    minConfidence: "MEDIUM",
    betterChoice: "오브젝트 진입 전에 가까운 아군과 같은 경로를 선택하세요.",
    nextGameRule: "오브젝트 20초 전에는 2,500 이내 생존 아군이 있는지 확인하세요.",
  },
  DECIDE_JOIN_OR_TRADE_EARLY: {
    priority: 3,
    requiredFactTypes: ["PLAYER_DISTANCE_GT_5000"],
    allowedFactTypes: ["PLAYER_DISTANCE_GT_5000", "OBJECTIVE_CAPTURE_TEAM"],
    requiresObjective: true,
    minConfidence: "MEDIUM",
    betterChoice: "오브젝트 생성 전에 합류 또는 반대편 교환 계획을 먼저 확정하세요.",
    nextGameRule: "오브젝트 30초 전 5,000보다 멀면 합류와 교환 중 하나를 결정하세요.",
  },
  REVIEW_OPENING_DEATH: {
    priority: 4,
    requiredFactTypes: ["PLAYER_CONFIRMED_DEATH"],
    allowedFactTypes: ["PLAYER_CONFIRMED_DEATH"],
    requiresObjective: false,
    phase: "OPENING",
    betterChoice: "첫 교환 전에 가까운 아군과 사용할 이탈 경로를 확인하세요.",
    nextGameRule: "첫 행동 전에 생존 경로 하나를 정하세요.",
  },
  RESET_AFTER_CAPTURE: {
    priority: 1,
    requiredFactTypes: ["OBJECTIVE_CAPTURE_TEAM", "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE"],
    allowedFactTypes: ["OBJECTIVE_CAPTURE_TEAM", "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE"],
    requiresObjective: true,
    captureTeam: "ALLY",
    betterChoice: "획득 직후 추격보다 생존과 리셋을 먼저 검토하세요.",
    nextGameRule: "오브젝트 획득 후 체력과 생존 인원을 확인한 뒤 다음 행동을 선택하세요.",
  },
};
~~~

buildFactNarrative must map:

~~~js
const DECISION_TEMPLATE_BY_FACT = {
  PLAYER_CONFIRMED_KILL: ["PLAYER_RECORDED_KILL", "대상 플레이어의 킬이 기록됐습니다."],
  PLAYER_CONFIRMED_ASSIST: ["PLAYER_RECORDED_ASSIST", "대상 플레이어의 어시스트가 기록됐습니다."],
  PLAYER_CONFIRMED_DEATH: ["PLAYER_RECORDED_DEATH", "대상 플레이어의 사망이 기록됐습니다."],
  PLAYER_FIRST_RECORDED_INVOLVEMENT: ["PLAYER_FIRST_RECORDED_INVOLVEMENT", "대상 플레이어의 첫 기록 시점을 확인했습니다."],
};

const POSITION_TEMPLATE_BY_FACT = {
  PLAYER_DISTANCE_LE_2500: ["POSITION_DISTANCE_LE_2500", "사용 가능한 과거 프레임에서 교전 중심과의 거리는 2,500 이하였습니다."],
  PLAYER_DISTANCE_2500_5000: ["POSITION_DISTANCE_2500_5000", "사용 가능한 과거 프레임에서 교전 중심과의 거리는 2,500 초과 5,000 이하였습니다."],
  PLAYER_DISTANCE_GT_5000: ["POSITION_DISTANCE_GT_5000", "사용 가능한 과거 프레임에서 교전 중심과의 거리는 5,000 초과였습니다."],
  NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT: ["NO_NEARBY_LIVING_ALLY_AT_SNAPSHOT", "완전한 과거 스냅샷에서 2,500 이내 생존 아군이 기록되지 않았습니다."],
};
~~~

buildFactNarrative also emits factStatements for every surviving situation, decision, positioning, and outcome fact:

~~~js
{
  factId: fact.factId,
  claimCode: fact.type,
  text: fixedText,
  evidenceIds: [fact.factId],
  source: "SERVER_FACT_TEMPLATE",
}
~~~

Use fixed templates for all closed fact types: encounter classification -> "킬 로그 기준 {PICK|소규모 교전|한타 후보}입니다."; ally/enemy deaths -> "아군/상대 사망 {count}명이 기록됐습니다."; first takedown -> "첫 사망 기록의 획득 팀은 {아군|상대|팀 미상}입니다."; player kill/assist/death and first involvement -> the fixed decision copy above; distance/no-nearby-ally -> the fixed positioning copy above; capture team/counts -> "획득 팀은 {label}입니다." and "획득 수는 아군 {ally}, 상대 {enemy}, 미상 {unknown}입니다."; objective killer/assist -> "대상 플레이어가 오브젝트 처치/어시스트에 기록됐습니다."; structure conversion -> "{takerTeam}의 {buildingType} 전환이 기록됐습니다."; pre-fight gold -> "교전 전 완전한 스냅샷의 아군-상대 골드 차이는 {signed value}입니다."; post-capture death -> "획득 후 {secondsAfterCapture}초에 대상 플레이어 사망이 기록됐습니다.". Team and encounter enum labels come from closed server maps; unknown values render 미상 and are never treated as ENEMY.

Sort factStatements by the review fact-category order situation, decision, positioning, outcome, then timestamp, type, factId. The browser renders these supplied texts for personal-review claims and never constructs a judgment sentence from raw fact values.

For LOW confidence positioning, prefix the fixed text with 낮은 신뢰도의 과거 프레임에서. Never create decisionAssessment from APPROXIMATE or LOW-only facts.

When several facts map to the same narrative slot, sort by timestamp, the fixed type order shown in the mapping tables, then factId and select the first. decisionAssessment can cite only a direct CONFIRMED decision fact. positioningObservation may cite APPROXIMATE or CONFIRMED scene facts but must include the visible 근접 추정 label when the scene is APPROXIMATE. Return null for a slot with no eligible fact instead of inventing copy.

- [ ] **Step 4: Implement candidate validation, fallback, and model sanitation**

AI selection shape:

~~~js
{
  reviews: [
    {
      reviewId: "review_id",
      recommendationCode: "DECIDE_JOIN_OR_TRADE_EARLY",
      evidenceIds: ["fact_id"]
    }
  ]
}
~~~

Validation rules:

- reviews must be an array of at most five.
- reviewId must be requested and unique; duplicate IDs invalidate all rows for that ID.
- each row has exactly reviewId, recommendationCode, evidenceIds.
- evidenceIds contains 1-6 unique IDs, all from that review.
- evidence includes every required fact type and no type outside allowedFactTypes.
- model facts, timestamps, teams, scores, confidence, and involvement are never copied from AI output.

Eligibility rules are exact: GROUP_BEFORE_OBJECTIVE requires an objective scene and a HIGH/MEDIUM NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT fact; DECIDE_JOIN_OR_TRADE_EARLY additionally requires PLAYER_DISTANCE_GT_5000.value.stage to be SETUP or CONTEST; REVIEW_OPENING_DEATH requires PLAYER_CONFIRMED_DEATH.value.phase OPENING; RESET_AFTER_CAPTURE requires OBJECTIVE_CAPTURE_TEAM.value.team ALLY plus PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE. Sort eligible rows by numeric priority then recommendationCode.

For each eligible row, choose evidence deterministically: take the earliest timestamp/factId fact for every required type, then append other allowed facts in timestamp/type/factId order up to six IDs. Never truncate a required type; if the required set cannot fit the 1-6 contract, do not expose that recommendation. Candidate evidence IDs are unique and always belong to the same review.

applyRecommendationSelections returns a deep copied public model and never mutates the normalized fact model. It first attaches buildFactNarrative output to every copied review, then merges one validated coaching selection. Fallback selection is the eligible code with the smallest priority number. A missing envelope uses fallback without adding an invalid-selection limitation; a present malformed or invalid row uses fallback only for that review and appends INVALID_AI_SELECTION. coaching is null if no code is eligible.

Candidate payload contains only IDs and allowed codes:

~~~js
function buildRecommendationCandidatePayload(model) {
  return {
    reviews: (model?.personalReviews || []).map((review) => ({
      reviewId: review.reviewId,
      eligibleRecommendations: eligibleRecommendations(review, model).map((row) => ({
        recommendationCode: row.recommendationCode,
        evidenceIds: row.evidenceIds,
      })),
    })).filter((row) => row.eligibleRecommendations.length > 0),
  };
}
~~~

Sanitation rules:

- Fatal root errors: missing object, wrong schemaVersion, coverage object absent, or any of encounters/objectiveEngagements/scenes/personalReviews/teamAppendix not an array.
- Item errors: duplicate domain ID, end before start, missing scene/encounter/objective reference. Drop that item and dependent children, append INVALID_V2_ITEM.
- Coaching selection errors: drop only coaching, append INVALID_AI_SELECTION.

sanitizeTeamplayAnalysisV2 performs dependency-ordered item isolation: validate and de-duplicate encounters and objectives first; remove scenes with missing domain references; remove reviews with missing scenes or malformed closed fact arrays; then remove appendices with missing reviews or duplicate appendix IDs. Every timed domain requires a non-empty stable ID, finite start/end with end >= start, confidence in HIGH/MEDIUM/LOW, an array of allowed limitation codes, and at least one valid typed sourceRef when the approved contract requires source evidence. Duplicate IDs invalidate every duplicate row, not merely later rows. Preserve surviving order only after stable timestamp/ID sorting, and append INVALID_V2_ITEM once when anything is removed.

Add envelope helpers:

~~~js
function createLegacyTeamplayEnvelope() {
  return {
    schemaVersion: "2.0",
    coverage: createCoverageEnvelope({ level: "PLAYER_ONLY", source: "LEGACY_ADAPTER" }),
    encounters: [],
    objectiveEngagements: [],
    scenes: [],
    personalReviews: [],
    teamAppendix: [],
  };
}

function createUnavailableTeamplayEnvelope() {
  return {
    schemaVersion: "2.0",
    coverage: createCoverageEnvelope({ level: "UNAVAILABLE", source: "NONE" }),
    encounters: [],
    objectiveEngagements: [],
    scenes: [],
    personalReviews: [],
    teamAppendix: [],
  };
}
~~~

Export the exact server integration names:

~~~js
module.exports = {
  buildFactNarrative,
  eligibleRecommendations,
  buildRecommendationCandidatePayload,
  validateRecommendationSelections,
  applyRecommendationSelections,
  createLegacyTeamplayEnvelope,
  createUnavailableTeamplayEnvelope,
  sanitizeTeamplayAnalysisV2,
};
~~~

- [ ] **Step 5: Run tests and commit**

Run: node test-artifacts/server/teamplay-coaching-v2-tests.mjs

Expected: fact templates, eligibility, invalid selection isolation, fixed copy, fallback priority, and sanitation tests all pass.

Run: node --check lib/teamplay-coaching-v2.js && node --check lib/teamplay-contract-v2.js

Expected: exit 0.

Commit:

~~~bash
git add lib/teamplay-coaching-v2.js lib/teamplay-contract-v2.js test-artifacts/server/teamplay-coaching-v2-tests.mjs
git commit -m "feat: validate closed teamplay coaching"
~~~

### Task 6: Live Server and AI Selection Integration

**Files:**
- Modify: server.js:1-12, 982-1115, 2107-2145, 2328-2500, 2770-2835, 2897-3220
- Modify: test-artifacts/server/llm-payload-tests.mjs
- Modify: test-artifacts/schema/schema-tests.mjs
- Test: test-artifacts/server/teamplay-server-integration-tests.mjs

**Interfaces:**
- Consumes: buildTeamplayAnalysisV2, buildRecommendationCandidatePayload, applyRecommendationSelections, sanitizeTeamplayAnalysisV2.
- Produces: normalized.teamplayAnalysisV2, analysis.teamplayAnalysisV2, AI payload teamplayRecommendationCandidates, AI output sub-contract teamplayRecommendationSelections.
- Later consumed by: stored sample loader and UI.

- [ ] **Step 1: Write failing server integration tests**

In test-artifacts/server/teamplay-server-integration-tests.mjs, define the source extractor and direct contract import:

~~~js
import fs from "node:fs";
import assert from "node:assert/strict";
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const start = source.indexOf("function " + name + "(");
  if (start < 0) throw new Error("function not found: " + name);
  let depth = 0;
  let opened = false;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") { depth += 1; opened = true; }
    if (source[index] === "}") {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("function not closed: " + name);
}

const buildNormalizedSrc = extractFunctionSource(serverSrc, "buildNormalized");
const buildRuleBasedAnalysisSrc = extractFunctionSource(serverSrc, "buildRuleBasedAnalysis");
~~~

In the existing test-artifacts/server/llm-payload-tests.mjs file, add this valid v2 helper next to its existing baseFixture function:

~~~js
function validTeamplayModel() {
  const fact = {
    factId: "fact_far",
    type: "PLAYER_DISTANCE_GT_5000",
    timestamp: 600000,
    value: { distance: 6200, stage: "SETUP", frameTimestamp: 590000, frameAgeSeconds: 10 },
    confidence: "MEDIUM",
    sourceRefs: [{ kind: "TIMELINE_EVENT", id: "event_far", timestamp: 600000, participantId: null }],
    limitationCodes: [],
  };
  return {
    schemaVersion: "2.0",
    coverage: { level: "PARTIAL", source: "RAW_TIMELINE", usablePositionSceneRatio: 1, limitationCodes: [] },
    encounters: [],
    objectiveEngagements: [{
      id: "obj_1",
      startTimestamp: 510000,
      endTimestamp: 720000,
      sourceRefs: [{ kind: "TIMELINE_EVENT", id: "event_obj_1", timestamp: 600000, participantId: null }],
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
      sourceRefs: [fact.sourceRefs[0]],
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

function modelWithOneEligibleReview() {
  return validTeamplayModel();
}
~~~

The new focused file asserts source-level wiring and direct contract behavior:

~~~js
assert.ok(serverSrc.includes('require("./lib/teamplay-analysis-v2")'));
assert.ok(buildNormalizedSrc.includes("normalized.teamplayAnalysisV2 = buildTeamplayAnalysisV2("));
assert.ok(buildRuleBasedAnalysisSrc.includes("teamplayAnalysisV2: applyRecommendationSelections("));
console.log("3 passed, 0 failed");
~~~

The existing llm-payload test uses its existing buildLlmPayload and baseFixture harness:

~~~js
const normalizedFixture = baseFixture();
normalizedFixture.teamplayAnalysisV2 = modelWithOneEligibleReview();
const payload = buildLlmPayload(normalizedFixture);
check("payload exposes one coaching candidate",
  payload.teamplayRecommendationCandidates.reviews.length, 1);
checkTrue("payload strips free coaching text",
  !JSON.stringify(payload.teamplayRecommendationCandidates).includes("betterChoice"));
checkTrue("output contract requests selections",
  payload.outputContract.requiredTopLevelFields.includes("teamplayRecommendationSelections"));
checkTrue("candidate payload contains no raw timeline refs or server coaching copy",
  !JSON.stringify(payload.teamplayRecommendationCandidates).includes("sourceRefs") &&
  !JSON.stringify(payload.teamplayRecommendationCandidates).includes("nextGameRule"));
~~~

In test-artifacts/schema/schema-tests.mjs, preserve the existing top-level response snapshot exactly and assert only these additive paths: normalized.teamplayAnalysisV2 and analysis.teamplayAnalysisV2. Add a legacy-consumer smoke assertion that destructures the prior known fields while ignoring teamplayAnalysisV2 without throwing.

- [ ] **Step 2: Run tests to verify failure**

Run: node test-artifacts/server/teamplay-server-integration-tests.mjs

Expected: FAIL because server.js does not import or attach teamplay v2.

Run: node test-artifacts/server/llm-payload-tests.mjs

Expected: FAIL because teamplayRecommendationCandidates and required output field are absent.

- [ ] **Step 3: Wire deterministic facts into normalization and fallback**

Add imports:

~~~js
const { buildTeamplayAnalysisV2 } = require("./lib/teamplay-analysis-v2");
const {
  buildRecommendationCandidatePayload,
  applyRecommendationSelections,
  sanitizeTeamplayAnalysisV2,
  createUnavailableTeamplayEnvelope,
} = require("./lib/teamplay-coaching-v2");
~~~

After existing normalized timelines are built:

~~~js
normalized.teamplayAnalysisV2 = buildTeamplayAnalysisV2(
  matchDetail,
  timeline,
  participant.participantId,
);
~~~

In buildRuleBasedAnalysis, add:

~~~js
teamplayAnalysisV2: applyRecommendationSelections(normalized.teamplayAnalysisV2, null),
~~~

- [ ] **Step 4: Add the AI candidate sub-contract**

In buildLlmPayload add:

~~~js
teamplayRecommendationCandidates: buildRecommendationCandidatePayload(
  normalized.teamplayAnalysisV2,
),
~~~

Add teamplayRecommendationSelections to outputContract.requiredTopLevelFields.

Extend OUTPUT_SCHEMA_EXAMPLE with:

~~~json
"teamplayRecommendationSelections": {
  "reviews": [
    {
      "reviewId": "review_id_from_payload",
      "recommendationCode": "eligible_code_from_payload",
      "evidenceIds": ["permitted_fact_id_from_payload"]
    }
  ]
}
~~~

Append this exact rule to both agent prompts:

~~~text
teamplayRecommendationSelections: teamplayRecommendationCandidates.reviews에 있는 reviewId만 사용한다. 각 review에서 eligibleRecommendations 중 하나만 선택하고 recommendationCode와 그 항목의 evidenceIds만 그대로 반환한다. 자유 코칭 문장, 새로운 코드, 새로운 fact ID를 만들지 않는다. 후보가 없으면 reviews는 빈 배열이다.
~~~

- [ ] **Step 5: Merge only validated recommendation selections**

Before validateAnalysisOutput(primary):

~~~js
const selectionEnvelope = primary.teamplayRecommendationSelections;
const selectionMissing = !selectionEnvelope || !Array.isArray(selectionEnvelope.reviews);
primary.teamplayAnalysisV2 = applyRecommendationSelections(
  normalized.teamplayAnalysisV2,
  selectionMissing ? null : selectionEnvelope,
);
delete primary.teamplayRecommendationSelections;
if (selectionMissing &&
    buildRecommendationCandidatePayload(normalized.teamplayAnalysisV2).reviews.length > 0) {
  violations.push("missing.teamplayRecommendationSelections");
}
const sanitizedTeamplay = sanitizeTeamplayAnalysisV2(primary.teamplayAnalysisV2);
if (!sanitizedTeamplay.rootValid) {
  primary.teamplayAnalysisV2 = createUnavailableTeamplayEnvelope();
  violations.push("shape.teamplayAnalysisV2.invalid");
} else {
  primary.teamplayAnalysisV2 = sanitizedTeamplay.data;
}
~~~

Extend validateAnalysisOutput:

~~~js
if (json.teamplayAnalysisV2 !== undefined) {
  const validation = sanitizeTeamplayAnalysisV2(json.teamplayAnalysisV2);
  if (!validation.rootValid) throw new Error("teamplayAnalysisV2 invalid");
}
~~~

Do not add teamplayAnalysisV2 to AI-generated fields. It is server-derived after the AI response.

Add an integration case where the AI envelope includes extra fact text, a changed timestamp, and an otherwise valid recommendation. The validator must reject the row because the key set is not exact, remove the transient teamplayRecommendationSelections field, keep the original deterministic facts byte-for-byte, add INVALID_AI_SELECTION, and apply that review's rule fallback.

- [ ] **Step 6: Run focused tests and commit**

Run:

~~~bash
node test-artifacts/server/teamplay-server-integration-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node --check server.js
~~~

Expected: all focused tests pass and syntax check exits 0.

Commit:

~~~bash
git add server.js test-artifacts/server/teamplay-server-integration-tests.mjs test-artifacts/server/llm-payload-tests.mjs test-artifacts/schema/schema-tests.mjs
git commit -m "feat: attach teamplay v2 to analysis"
~~~

### Task 7: Stored-Sample Backfill and Legacy Compatibility

**Files:**
- Create: lib/teamplay-stored-v2.js
- Modify: server.js:3385-3470
- Modify: test-artifacts/server/sample-bundle-error-tests.mjs
- Test: test-artifacts/server/load-sample-teamplay-v2-compat-tests.mjs

**Interfaces:**
- Consumes: buildTeamplayAnalysisV2, applyRecommendationSelections, sanitizeTeamplayAnalysisV2, createLegacyTeamplayEnvelope, createUnavailableTeamplayEnvelope.
- Produces: hydrateStoredTeamplayV2({ normalized, analysis, matchDetail, timeline }).
- Guarantees: in-memory only; no writeJson or manifest mutation; raw timeline produces renderable v2; analysis-only legacy produces PLAYER_ONLY; absent raw and legacy produces UNAVAILABLE.

- [ ] **Step 1: Write failing stored compatibility tests**

Import node:fs, hydrateStoredTeamplayV2 directly from lib/teamplay-stored-v2.js, buildTeamplayAnalysisV2 from lib/teamplay-analysis-v2.js, and the shared match/timeline fixture builders. Define a pure loadFixture helper:

~~~js
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
  assert.equal(bundle.analysis.teamplayAnalysisV2.coverage.source, "RAW_TIMELINE");
  assert.equal(bundle.normalized.teamplayAnalysisV2.schemaVersion, "2.0");
});

test("analysis-only legacy bundle uses PLAYER_ONLY", () => {
  const bundle = loadFixture({
    rawMatch: null,
    rawTimeline: null,
    legacyAnalysis: { ...validAnalysis, combatAnalysis: [], teamfightPhaseAnalysis: [] },
  });
  assert.equal(bundle.analysis.teamplayAnalysisV2.coverage.level, "PLAYER_ONLY");
  assert.equal(bundle.analysis.teamplayAnalysisV2.coverage.source, "LEGACY_ADAPTER");
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
    legacyAnalysis: { ...validAnalysis, teamplayAnalysisV2: { schemaVersion: "2.0" } },
  });
  assert.equal(bundle.analysis.teamplayAnalysisV2.coverage.source, "RAW_TIMELINE");
});

test("player-only envelope upgrades when raw files are available", () => {
  const legacyEnvelope = {
    schemaVersion: "2.0",
    coverage: { level: "PLAYER_ONLY", source: "LEGACY_ADAPTER", usablePositionSceneRatio: 0, limitationCodes: [] },
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
  assert.equal(bundle.analysis.teamplayAnalysisV2.coverage.source, "RAW_TIMELINE");
});

test("malformed analysis v2 does not mask valid normalized raw v2", () => {
  const rawFacts = buildTeamplayAnalysisV2(
    makeMatchFixture(),
    makeTimelineFixture([makeFrame(60000)]),
    1,
  );
  const bundle = hydrateStoredTeamplayV2({
    normalized: { ...validNormalized, teamplayAnalysisV2: rawFacts },
    analysis: { ...validAnalysis, teamplayAnalysisV2: { schemaVersion: "2.0" } },
    matchDetail: null,
    timeline: null,
  });
  assert.equal(bundle.normalized.teamplayAnalysisV2.coverage.source, "RAW_TIMELINE");
  assert.equal(bundle.analysis.teamplayAnalysisV2.coverage.source, "RAW_TIMELINE");
});

test("stored hydration module has no persistence capability", () => {
  const source = fs.readFileSync(new URL("../../lib/teamplay-stored-v2.js", import.meta.url), "utf8");
  for (const forbidden of ["node:fs", "writeJson", "saveManifest", "writeFile"]) {
    assert.ok(!source.includes(forbidden), forbidden);
  }
});
~~~

- [ ] **Step 2: Run tests to verify failure**

Run: node test-artifacts/server/load-sample-teamplay-v2-compat-tests.mjs

Expected: FAIL with MODULE_NOT_FOUND for lib/teamplay-stored-v2.js.

- [ ] **Step 3: Implement in-memory hydration**

Create lib/teamplay-stored-v2.js as a pure module:

~~~js
const { buildTeamplayAnalysisV2 } = require("./teamplay-analysis-v2");
const {
  applyRecommendationSelections,
  sanitizeTeamplayAnalysisV2,
  createLegacyTeamplayEnvelope,
  createUnavailableTeamplayEnvelope,
} = require("./teamplay-coaching-v2");

function hasLegacyTeamplayAnalysis(analysis) {
  return Array.isArray(analysis?.combatAnalysis) ||
    Array.isArray(analysis?.teamfightPhaseAnalysis);
}

function hydrateStoredTeamplayV2({ normalized, analysis, matchDetail, timeline }) {
  const normalizedOut = { ...(normalized || {}) };
  const analysisOut = { ...(analysis || {}) };
  const analysisExisting = sanitizeTeamplayAnalysisV2(analysisOut.teamplayAnalysisV2);
  const normalizedExisting = sanitizeTeamplayAnalysisV2(normalizedOut.teamplayAnalysisV2);
  const analysisRaw = analysisExisting.rootValid &&
    analysisExisting.data.coverage.source === "RAW_TIMELINE";
  const normalizedRaw = normalizedExisting.rootValid &&
    normalizedExisting.data.coverage.source === "RAW_TIMELINE";

  if (analysisRaw && normalizedRaw) {
    analysisOut.teamplayAnalysisV2 = analysisExisting.data;
    normalizedOut.teamplayAnalysisV2 = normalizedExisting.data;
    return { normalized: normalizedOut, analysis: analysisOut };
  }

  if (normalizedRaw) {
    normalizedOut.teamplayAnalysisV2 = normalizedExisting.data;
    analysisOut.teamplayAnalysisV2 = analysisRaw
      ? analysisExisting.data
      : applyRecommendationSelections(normalizedExisting.data, null);
    return { normalized: normalizedOut, analysis: analysisOut };
  }

  if (matchDetail && timeline) {
    const participants = Array.isArray(matchDetail?.info?.participants)
      ? matchDetail.info.participants
      : [];
    const target = participants.find((row) =>
      row.participantId === normalizedOut.playerContext?.participantId) ||
      participants.find((row) => row.puuid === normalizedOut.playerContext?.puuid);
    if (target) {
      const facts = buildTeamplayAnalysisV2(matchDetail, timeline, target.participantId);
      normalizedOut.teamplayAnalysisV2 = facts;
      analysisOut.teamplayAnalysisV2 = analysisRaw
        ? analysisExisting.data
        : applyRecommendationSelections(facts, null);
      return { normalized: normalizedOut, analysis: analysisOut };
    }
  }

  if (analysisRaw) {
    analysisOut.teamplayAnalysisV2 = analysisExisting.data;
    return { normalized: normalizedOut, analysis: analysisOut };
  }

  const existingEnvelope = analysisExisting.rootValid
    ? analysisExisting.data
    : normalizedExisting.rootValid ? normalizedExisting.data : null;
  if (existingEnvelope) {
    analysisOut.teamplayAnalysisV2 = existingEnvelope;
    return { normalized: normalizedOut, analysis: analysisOut };
  }

  analysisOut.teamplayAnalysisV2 = hasLegacyTeamplayAnalysis(analysisOut)
    ? createLegacyTeamplayEnvelope()
    : createUnavailableTeamplayEnvelope();
  return { normalized: normalizedOut, analysis: analysisOut };
}

module.exports = { hydrateStoredTeamplayV2 };
~~~

In server.js, import hydrateStoredTeamplayV2. After the required normalized and analysis files load, read the raw pair optionally and call the pure helper:

~~~js
let storedRawMatch = null;
let storedRawTimeline = null;
try {
  [storedRawMatch, storedRawTimeline] = await Promise.all([
    readJson(sampleStoragePath(sampleId, "raw-match.json")),
    readJson(sampleStoragePath(sampleId, "raw-timeline.json")),
  ]);
} catch {}
const hydratedTeamplay = hydrateStoredTeamplayV2({
  normalized,
  analysis,
  matchDetail: storedRawMatch,
  timeline: storedRawTimeline,
});
normalized = hydratedTeamplay.normalized;
analysis = hydratedTeamplay.analysis;
~~~

lib/teamplay-stored-v2.js must not import fs and must not call writeJson, saveManifest, or fsp.writeFile.

- [ ] **Step 4: Update the existing sample-bundle harness**

Pass hydrateStoredTeamplayV2 into the new Function harness in sample-bundle-error-tests.mjs:

~~~js
"hydrateStoredTeamplayV2",
~~~

Provide this identity dependency for required-file error tests:

~~~js
({ normalized, analysis }) => ({ normalized, analysis })
~~~

Keep the existing SAMPLE_BUNDLE_UNAVAILABLE assertions unchanged.

- [ ] **Step 5: Run tests and commit**

Run:

~~~bash
node test-artifacts/server/load-sample-teamplay-v2-compat-tests.mjs
node test-artifacts/server/sample-bundle-error-tests.mjs
node --check lib/teamplay-stored-v2.js
node --check server.js
~~~

Expected: raw, legacy, unavailable, malformed rebuild, and existing bundle error tests all pass.

Commit:

~~~bash
git add lib/teamplay-stored-v2.js server.js test-artifacts/server/load-sample-teamplay-v2-compat-tests.mjs test-artifacts/server/sample-bundle-error-tests.mjs
git commit -m "feat: backfill stored teamplay analysis"
~~~

### Task 8: Client Render Mode and Personal Decision Reviews

**Files:**
- Modify: index.html:257-276
- Modify: main.js:1-75, 2553-2645, 3586-3630
- Modify: styles.css
- Test: test-artifacts/main/teamplay-v2-render-tests.mjs

**Interfaces:**
- Consumes: sample.analysis.teamplayAnalysisV2, sample.normalized.teamplayAnalysisV2, legacy combatAnalysis, legacy teamfightPhaseAnalysis.
- Produces: sanitizeClientTeamplayV2(value), selectTeamplayRenderModel(sample), teamplayDomToken(value), renderTeamplayReviewCard(review, appendix, index), renderTeamplayReviewCollection(reviews, appendixByReview), setTeamplayBusy(isBusy), renderTeamplayAnalysis(sample).
- DOM: data-teamplay-v2, data-teamplay-status, data-teamplay-reviews, data-teamplay-more, data-teamplay-legacy.
- Later consumed by: Task 9 event delegation and flow navigation.

- [ ] **Step 1: Write failing render-mode and card tests**

Define complete client fixtures:

~~~js
function baseClientModel(level = "FULL", source = "RAW_TIMELINE") {
  return {
    schemaVersion: "2.0",
    coverage: { level, source, usablePositionSceneRatio: 1, limitationCodes: [] },
    encounters: [],
    objectiveEngagements: [],
    scenes: [{
      sceneId: "scene_1",
      objectiveEngagementId: null,
      encounterIds: [],
      startTimestamp: 600000,
      endTimestamp: 610000,
    }],
    personalReviews: [],
    teamAppendix: [],
  };
}

function sampleWithCoverage(level, source) {
  return { analysis: { teamplayAnalysisV2: baseClientModel(level, source) }, normalized: {} };
}

function sampleWithLegacy(level) {
  const source = level === "PLAYER_ONLY" ? "LEGACY_ADAPTER" : "NONE";
  return {
    analysis: {
      teamplayAnalysisV2: baseClientModel(level, source),
      combatAnalysis: [],
      teamfightPhaseAnalysis: [],
    },
    normalized: {},
  };
}

function sampleWithoutLegacy() {
  return {
    analysis: { teamplayAnalysisV2: baseClientModel("UNAVAILABLE", "NONE") },
    normalized: {},
  };
}

function sampleWithOneBrokenReview() {
  const model = baseClientModel();
  model.personalReviews = [{
    reviewId: "review_broken",
    sceneId: "missing_scene",
    startTimestamp: 700000,
    endTimestamp: 600000,
  }];
  return { analysis: { teamplayAnalysisV2: model }, normalized: {} };
}

function reviewWithMarkup(index = 0) {
  return {
    reviewId: "review_" + index,
    sceneId: "scene_" + index,
    startTimestamp: 600000 + index,
    endTimestamp: 610000 + index,
    importanceScore: 80,
    effectiveInvolvementLevel: "APPROXIMATE",
    situationFacts: [],
    decisionFacts: [],
    positioningFacts: [{
      factId: "fact_" + index,
      type: "PLAYER_DISTANCE_2500_5000",
      value: { distance: 3200 },
      confidence: "MEDIUM",
    }],
    outcomeFacts: [],
    evidenceIds: ["fact_" + index],
    narrative: {
      decisionAssessment: null,
      positioningObservation: {
        claimCode: "POSITION_DISTANCE_2500_5000",
        text: "<script>alert(1)</script>",
        evidenceIds: ["fact_" + index],
        source: "SERVER_FACT_TEMPLATE",
      },
      coaching: null,
    },
  };
}

function appendixWithMarkup(index = 0) {
  return {
    teamAppendixId: "appendix_" + index,
    reviewId: "review_" + index,
    allyDirectParticipants: ["<img src=x>"],
    enemyDirectParticipants: [],
    allyDeaths: 1,
    enemyDeaths: 0,
    captureTeam: "UNKNOWN",
    structureConversions: [],
  };
}

function renderFiveReviewModel() {
  const reviews = Array.from({ length: 5 }, (_, index) => reviewWithMarkup(index));
  return renderTeamplayReviewCollection(
    reviews,
    new Map(reviews.map((review, index) => [review.reviewId, appendixWithMarkup(index)])),
  );
}
~~~

Extract pure rendering helpers from main.js and test:

~~~js
test("raw full partial and event-only models select V2", () => {
  for (const level of ["FULL", "PARTIAL", "EVENT_ONLY"]) {
    assert.equal(selectTeamplayRenderModel(sampleWithCoverage(level, "RAW_TIMELINE")).mode, "V2");
  }
});

test("player-only and unavailable with legacy select LEGACY", () => {
  assert.equal(selectTeamplayRenderModel(sampleWithLegacy("PLAYER_ONLY")).mode, "LEGACY");
  assert.equal(selectTeamplayRenderModel(sampleWithLegacy("UNAVAILABLE")).mode, "LEGACY");
});

test("unavailable without legacy selects EMPTY", () => {
  assert.equal(selectTeamplayRenderModel(sampleWithoutLegacy()).mode, "EMPTY");
});

test("malformed item is removed without discarding valid root", () => {
  const model = sampleWithOneBrokenReview();
  const selected = selectTeamplayRenderModel(model);
  assert.equal(selected.mode, "V2");
  assert.equal(selected.data.personalReviews.length, 0);
  assert.ok(selected.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("review card escapes content and starts disclosures closed", () => {
  const html = renderTeamplayReviewCard(reviewWithMarkup(), appendixWithMarkup(), 0);
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(html.includes("hidden"));
  assert.ok(html.includes("근접 추정"));
});

test("missing position and coaching render explicit normal states", () => {
  const review = reviewWithMarkup();
  review.positioningFacts = [];
  review.narrative.positioningObservation = null;
  const html = renderTeamplayReviewCard(review, appendixWithMarkup(), 0);
  assert.ok(html.includes("위치 근거 부족"));
  assert.ok(html.includes("코칭을 생성할 근거가 없습니다."));
});

test("only first three review cards are initially visible", () => {
  const html = renderFiveReviewModel();
  assert.equal((html.match(/data-teamplay-review-visible/g) || []).length, 3);
  assert.equal((html.match(/data-teamplay-review-extra/g) || []).length, 2);
});

test("review collection handles 0 1 2 3 and 5 deterministically", () => {
  for (const count of [0, 1, 2, 3, 5]) {
    const reviews = Array.from({ length: count }, (_, index) => reviewWithMarkup(index));
    const html = renderTeamplayReviewCollection(reviews, new Map());
    assert.equal((html.match(/data-teamplay-review-visible/g) || []).length, Math.min(3, count));
    assert.equal((html.match(/data-teamplay-review-extra/g) || []).length, Math.max(0, count - 3));
    assert.equal((html.match(/id="teamplay-extra-reviews"/g) || []).length, 1);
  }
});
~~~

- [ ] **Step 2: Run tests to verify failure**

Run: node test-artifacts/main/teamplay-v2-render-tests.mjs

Expected: FAIL because teamplay render helpers and DOM containers do not exist.

- [ ] **Step 3: Replace the two legacy analysis sections with one mutual-exclusion slot**

Use this structure in index.html:

~~~html
<section class="section-block" id="teamplay-analysis" aria-labelledby="teamplay-analysis-title">
  <div data-teamplay-v2 hidden>
    <div class="section-heading">
      <h2 id="teamplay-analysis-title">개인 판단 리뷰</h2>
      <p class="section-copy">확인된 행동과 과거 위치 근거를 바탕으로 다음 경기에서 바꿀 선택을 정리합니다.</p>
    </div>
    <p class="teamplay-status" data-teamplay-status role="status"></p>
    <div class="teamplay-review-list" data-teamplay-reviews></div>
    <button type="button" class="secondary-button" data-teamplay-more data-teamplay-toggle aria-expanded="false" aria-controls="teamplay-extra-reviews" hidden>전체 리뷰 보기</button>
  </div>
  <div data-teamplay-legacy>
    <div class="section-heading">
      <h2>전투·한타 분석</h2>
      <p class="section-copy">이전 저장 분석이라 플레이어 관여 장면만 표시합니다.</p>
    </div>
    <div class="moment-list" data-combat-analysis></div>
    <div class="moment-list" data-teamfight-phases></div>
  </div>
</section>
~~~

Add DOM handles:

~~~js
teamplayV2: document.querySelector("[data-teamplay-v2]"),
teamplayStatus: document.querySelector("[data-teamplay-status]"),
teamplayReviews: document.querySelector("[data-teamplay-reviews]"),
teamplayMore: document.querySelector("[data-teamplay-more]"),
teamplayLegacy: document.querySelector("[data-teamplay-legacy]"),
~~~

- [ ] **Step 4: Implement client sanitation and the single render predicate**

Use the same formula as the server:

~~~js
const TEAMPLAY_RENDER_LEVELS = new Set(["FULL", "PARTIAL", "EVENT_ONLY"]);
const TEAMPLAY_COVERAGE_LEVELS = new Set([
  "FULL", "PARTIAL", "EVENT_ONLY", "PLAYER_ONLY", "UNAVAILABLE",
]);
const TEAMPLAY_COVERAGE_SOURCES = new Set(["RAW_TIMELINE", "LEGACY_ADAPTER", "NONE"]);
const TEAMPLAY_LIMITATIONS = new Set([
  "PARTIAL_POSITION_FRAMES", "NO_POSITION_FRAMES", "MISSING_SPATIAL_LINK",
  "INCOMPLETE_ALLY_FRAME_COVERAGE", "UNKNOWN_TEAM", "INCOMPLETE_TEAM_SNAPSHOT",
  "STALE_TEAM_SNAPSHOT", "INVALID_V2_ITEM", "INVALID_AI_SELECTION",
]);

function sanitizeClientTeamplayV2(value) {
  const rootValid = Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.schemaVersion === "2.0" &&
    value.coverage &&
    TEAMPLAY_COVERAGE_LEVELS.has(value.coverage.level) &&
    TEAMPLAY_COVERAGE_SOURCES.has(value.coverage.source) &&
    Number.isFinite(value.coverage.usablePositionSceneRatio) &&
    value.coverage.usablePositionSceneRatio >= 0 &&
    value.coverage.usablePositionSceneRatio <= 1 &&
    Array.isArray(value.coverage.limitationCodes) &&
    value.coverage.limitationCodes.every((code) => TEAMPLAY_LIMITATIONS.has(code)) &&
    Array.isArray(value.encounters) &&
    Array.isArray(value.objectiveEngagements) &&
    Array.isArray(value.scenes) &&
    Array.isArray(value.personalReviews) &&
    Array.isArray(value.teamAppendix)
  );
  if (!rootValid) return { rootValid: false, data: null };

  let invalidItem = false;
  function uniqueTimedRows(rows, idKey) {
    const counts = new Map();
    rows.forEach((row) => {
      const id = row?.[idKey];
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    });
    return rows.filter((row) => {
      const id = row?.[idKey];
      const validTime = Number.isFinite(row?.startTimestamp) &&
        Number.isFinite(row?.endTimestamp) &&
        row.endTimestamp >= row.startTimestamp;
      const valid = Boolean(id) && counts.get(id) === 1 && validTime;
      if (!valid) invalidItem = true;
      return valid;
    });
  }

  let encounters = uniqueTimedRows(value.encounters, "id");
  let objectiveEngagements = uniqueTimedRows(value.objectiveEngagements, "id");
  let graphChanged = true;
  while (graphChanged) {
    const encounterIdsNow = new Set(encounters.map((row) => row.id));
    const objectiveIdsNow = new Set(objectiveEngagements.map((row) => row.id));
    const nextEncounters = encounters.filter((row) =>
      Array.isArray(row.linkedObjectiveEngagementIds) &&
      row.linkedObjectiveEngagementIds.every((id) => objectiveIdsNow.has(id)));
    const nextObjectives = objectiveEngagements.filter((row) =>
      Array.isArray(row.linkedEncounterIds) &&
      row.linkedEncounterIds.every((id) => encounterIdsNow.has(id)));
    graphChanged = nextEncounters.length !== encounters.length ||
      nextObjectives.length !== objectiveEngagements.length;
    if (graphChanged) invalidItem = true;
    encounters = nextEncounters;
    objectiveEngagements = nextObjectives;
  }
  const encounterIds = new Set(encounters.map((row) => row.id));
  const objectiveIds = new Set(objectiveEngagements.map((row) => row.id));
  const scenes = uniqueTimedRows(value.scenes, "sceneId").filter((scene) => {
    const validObjective = scene.objectiveEngagementId === null ||
      objectiveIds.has(scene.objectiveEngagementId);
    const validEncounters = Array.isArray(scene.encounterIds) &&
      scene.encounterIds.every((id) => encounterIds.has(id));
    if (!validObjective || !validEncounters) invalidItem = true;
    return validObjective && validEncounters;
  });
  const sceneIds = new Set(scenes.map((row) => row.sceneId));
  const reviewCounts = new Map();
  value.personalReviews.forEach((row) => {
    if (row?.reviewId) reviewCounts.set(row.reviewId, (reviewCounts.get(row.reviewId) || 0) + 1);
  });
  const personalReviews = value.personalReviews.filter((review) => {
    const valid = review && review.reviewId && reviewCounts.get(review.reviewId) === 1 &&
      sceneIds.has(review.sceneId) &&
      Array.isArray(review.encounterIds) &&
      review.encounterIds.every((id) => encounterIds.has(id)) &&
      (review.objectiveEngagementId === null || objectiveIds.has(review.objectiveEngagementId)) &&
      Number.isFinite(review.startTimestamp) &&
      Number.isFinite(review.endTimestamp) &&
      review.endTimestamp >= review.startTimestamp &&
      Array.isArray(review.situationFacts) &&
      Array.isArray(review.decisionFacts) &&
      Array.isArray(review.positioningFacts) &&
      Array.isArray(review.outcomeFacts) &&
      Array.isArray(review.evidenceIds);
    if (!valid) invalidItem = true;
    return valid;
  });
  const reviewIds = new Set(personalReviews.map((row) => row.reviewId));
  const appendixCounts = new Map();
  value.teamAppendix.forEach((row) => {
    if (row?.teamAppendixId) {
      appendixCounts.set(row.teamAppendixId, (appendixCounts.get(row.teamAppendixId) || 0) + 1);
    }
  });
  const teamAppendix = value.teamAppendix.filter((row) => {
    const valid = row?.teamAppendixId && appendixCounts.get(row.teamAppendixId) === 1 &&
      reviewIds.has(row.reviewId);
    if (!valid) invalidItem = true;
    return valid;
  });
  const limitationCodes = [...new Set([
    ...(Array.isArray(value.coverage.limitationCodes) ? value.coverage.limitationCodes : []),
    ...(invalidItem ? ["INVALID_V2_ITEM"] : []),
  ])];
  return {
    rootValid: true,
    data: {
      ...value,
      coverage: { ...value.coverage, limitationCodes },
      encounters,
      objectiveEngagements,
      scenes,
      personalReviews,
      teamAppendix,
    },
  };
}

function hasLegacyTeamplayUi(sample) {
  return Array.isArray(sample.analysis?.combatAnalysis) ||
    Array.isArray(sample.analysis?.teamfightPhaseAnalysis);
}

function selectTeamplayRenderModel(sample) {
  for (const candidate of [
    sample.analysis?.teamplayAnalysisV2,
    sample.normalized?.teamplayAnalysisV2,
  ]) {
    const sanitized = sanitizeClientTeamplayV2(candidate);
    if (sanitized.rootValid &&
        sanitized.data.coverage.source === "RAW_TIMELINE" &&
        TEAMPLAY_RENDER_LEVELS.has(sanitized.data.coverage.level)) {
      return { mode: "V2", data: sanitized.data };
    }
  }
  if (hasLegacyTeamplayUi(sample)) return { mode: "LEGACY", data: null };
  return { mode: "EMPTY", data: null };
}
~~~

- [ ] **Step 5: Render personal review cards and mutual visibility**

Each card must contain:

- Timestamp, encounter/objective type, importance, effective involvement, and position confidence.
- Server-rendered situation facts, confirmed action, result, and positioning observation.
- Fixed betterChoice and nextGameRule when coaching exists.
- Native buttons for evidence and team appendix; both panels hidden initially.
- A native 전체 흐름 보기 button with data-teamplay-flow-target equal to sceneId.
- First min(3, count) cards marked data-teamplay-review-visible.
- Remaining cards wrapped by id teamplay-extra-reviews and hidden.

Generate every disclosure ID through a collision-free DOM token, and escape every server or stored value even though server templates are trusted:

~~~js
function teamplayDomToken(value) {
  const bytes = new TextEncoder().encode(String(value || "empty"));
  return "tp_" + [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
~~~

renderTeamplayReviewCard uses the tokenized reviewId to create unique evidence and appendix IDs. Its two disclosure controls are native buttons with data-teamplay-toggle, aria-expanded="false", and aria-controls; both target panels have class teamplay-disclosure and hidden. The visible situation/action/result rows use narrative.factStatements text selected by the corresponding factId, plus decisionAssessment and positioningObservation; never synthesize judgment copy in the browser. Evidence lists fact type, visible confidence text, event/frame timestamp, frameAgeSeconds, distance, death order, and escaped sourceRef IDs. Team appendix content is a factual table only; do not put team-level betterChoice or nextGameRule in the card. If an appendix was removed during sanitation, omit its disclosure button and render no broken aria-controls reference. The flow control is a native button with data-teamplay-flow-target. APPROXIMATE renders the text 근접 추정 and never 직접 참여. When positioningFacts is empty, render 위치 근거 부족 and no positioning advice. When narrative.coaching is null, render 코칭을 생성할 근거가 없습니다. The default card mode is visible; mode extra adds data-teamplay-review-extra while visible/default adds data-teamplay-review-visible.

~~~js
function renderTeamplayReviewCollection(reviews, appendixByReview) {
  const visible = reviews.slice(0, 3).map((review, index) =>
    renderTeamplayReviewCard(review, appendixByReview.get(review.reviewId), index, "visible"));
  const extra = reviews.slice(3).map((review, index) =>
    renderTeamplayReviewCard(review, appendixByReview.get(review.reviewId), index + 3, "extra"));
  return visible.join("") +
    '<div id="teamplay-extra-reviews" hidden>' + extra.join("") + "</div>";
}
~~~

Visibility:

~~~js
function renderTeamplayAnalysis(sample) {
  const selected = selectTeamplayRenderModel(sample);
  const showV2 = selected.mode === "V2";
  dom.teamplayV2.hidden = !showV2;
  dom.teamplayLegacy.hidden = showV2 || selected.mode === "EMPTY";
  if (selected.mode === "LEGACY") {
    renderCombatAnalysis(sample);
    renderTeamfightPhases(sample);
    return;
  }
  if (selected.mode === "EMPTY") {
    dom.teamplayV2.hidden = false;
    dom.teamplayStatus.textContent = "검토할 수 있는 주요 교전 데이터가 없습니다.";
    dom.teamplayReviews.innerHTML = '<div id="teamplay-extra-reviews" hidden></div>';
    dom.teamplayMore.hidden = true;
    dom.teamplayMore.setAttribute("aria-expanded", "false");
    return;
  }
  const reviews = selected.data.personalReviews.slice(0, 5);
  const appendixByReview = new Map(
    selected.data.teamAppendix.map((row) => [row.reviewId, row]),
  );
  dom.teamplayStatus.textContent = reviews.length === 0
    ? "검토할 수 있는 주요 교전 데이터가 없습니다."
    : selected.data.coverage.level === "FULL"
    ? "전체 사건과 위치 근거를 사용했습니다."
    : selected.data.coverage.level === "PARTIAL"
      ? "일부 장면은 위치 근거가 제한됩니다."
      : "사건 기록만 사용했으며 포지셔닝 조언은 생략합니다.";
  dom.teamplayReviews.innerHTML = renderTeamplayReviewCollection(reviews, appendixByReview);
  dom.teamplayMore.hidden = reviews.length <= 3;
  dom.teamplayMore.setAttribute("aria-expanded", "false");
}
~~~

Replace the two direct calls in renderSample with renderTeamplayAnalysis(sample).

Expose asynchronous loading state on both v2 regions:

~~~js
function setTeamplayBusy(isBusy) {
  [document.getElementById("teamplay-analysis"), document.getElementById("teamplay-flow")]
    .filter(Boolean)
    .forEach((node) => node.setAttribute("aria-busy", isBusy ? "true" : "false"));
}
~~~

In selectSample, call setTeamplayBusy(true) after allocating loadToken. Add a finally block that calls setTeamplayBusy(false) only when loadToken still equals state.sampleLoadSeq, so an older request cannot clear a newer request's busy state. Existing role=status text remains the visible loading/error announcement.

- [ ] **Step 6: Add focused styles**

Add:

~~~css
.teamplay-review-list {
  display: grid;
  gap: var(--space-4);
}

.teamplay-review {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--panel);
  padding: var(--space-5);
}

.teamplay-review__meta,
.teamplay-review__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.teamplay-facts {
  display: grid;
  grid-template-columns: minmax(120px, .35fr) minmax(0, 1fr);
  gap: var(--space-2) var(--space-4);
}

.teamplay-disclosure[hidden],
#teamplay-extra-reviews[hidden] {
  display: none;
}

.teamplay-review button:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

@media (max-width: 600px) {
  .teamplay-facts {
    grid-template-columns: 1fr;
  }
}
~~~

Use existing design tokens; do not add a new color system.

- [ ] **Step 7: Run tests and commit**

Run:

~~~bash
node test-artifacts/main/teamplay-v2-render-tests.mjs
node --check main.js
~~~

Expected: render mode, sanitation, escaping, collapsed panels, and 3-of-5 tests pass.

Commit:

~~~bash
git add index.html main.js styles.css test-artifacts/main/teamplay-v2-render-tests.mjs
git commit -m "feat: render personal teamplay reviews"
~~~

### Task 9: Objective-Combat Flow, Team Appendix, and Accessibility

**Files:**
- Modify: index.html:279-319
- Modify: main.js:3106-3330, 3400-3460, 4515-4556
- Modify: styles.css
- Test: test-artifacts/main/teamplay-v2-accessibility-tests.mjs

**Interfaces:**
- Consumes: selected v2 model, sceneId, encounters, objectiveEngagements, teamAppendix.
- Produces: renderTeamplayFlowScene(scene, model), renderTeamplayFlow(sample), bindTeamplayEvents(), focusTeamplayScene(sceneId), toggleTeamplayDisclosure(button).
- DOM: data-teamplay-flow-v2, data-teamplay-flow-list, data-teamplay-flow-status, data-teamplay-flow-legacy.

- [ ] **Step 1: Write failing flow and accessibility tests**

Define flow fixtures with independent capture and death results:

~~~js
function makeFlowModel(captureTeam, captureCounts, allyDeaths, enemyDeaths) {
  const objective = {
    id: "obj_flow",
    startTimestamp: 510000,
    endTimestamp: 740000,
    sourceRefs: [{ kind: "TIMELINE_EVENT", id: "event_obj_flow", timestamp: 600000, participantId: null }],
    confidence: "HIGH",
    limitationCodes: [],
    objectiveType: "VOID_GRUB_CAMP",
    captureStartTimestamp: 600000,
    captureEndTimestamp: 620000,
    captureTeam,
    captureCounts,
    setupWindow: { startMs: 510000, endMsExclusive: 580000 },
    contestWindow: {
      startMs: 580000,
      endMsExclusive: 640000,
      deathCounts: { ally: allyDeaths, enemy: enemyDeaths },
    },
    conversionWindow: { startMs: 620000, endMsExclusive: 740000 },
    linkedEncounterIds: [],
    structureConversions: [],
  };
  const scene = {
    sceneId: "scene_flow",
    primaryType: "OBJECTIVE",
    objectiveEngagementId: objective.id,
    encounterIds: [],
    startTimestamp: 510000,
    endTimestamp: 740000,
  };
  return {
    schemaVersion: "2.0",
    coverage: { level: "FULL", source: "RAW_TIMELINE", usablePositionSceneRatio: 1, limitationCodes: [] },
    encounters: [],
    objectiveEngagements: [objective],
    scenes: [scene],
    personalReviews: [],
    teamAppendix: [],
  };
}

function splitObjectiveModel() {
  return makeFlowModel("SPLIT", { ally: 2, enemy: 1, unknown: 0 }, 1, 1);
}

function splitObjectiveScene() {
  return splitObjectiveModel().scenes[0];
}

function enemyCaptureAllyKillLeadModel() {
  return makeFlowModel("ENEMY", { ally: 0, enemy: 1, unknown: 0 }, 1, 3);
}

function enemyCaptureAllyKillLeadScene() {
  return enemyCaptureAllyKillLeadModel().scenes[0];
}

function accessibleReview() {
  return {
    reviewId: "review_accessible",
    sceneId: "scene_flow",
    startTimestamp: 600000,
    endTimestamp: 620000,
    importanceScore: 80,
    effectiveInvolvementLevel: "CONFIRMED",
    situationFacts: [],
    decisionFacts: [],
    positioningFacts: [],
    outcomeFacts: [],
    evidenceIds: ["fact_accessible"],
    narrative: { decisionAssessment: null, positioningObservation: null, coaching: null },
  };
}

function accessibleAppendix() {
  return {
    teamAppendixId: "appendix_accessible",
    reviewId: "review_accessible",
    allyDirectParticipants: [],
    enemyDirectParticipants: [],
    allyDeaths: 0,
    enemyDeaths: 0,
    captureTeam: "SPLIT",
    structureConversions: [],
  };
}

function renderAccessibleReviewAndFlow() {
  return renderTeamplayReviewCard(accessibleReview(), accessibleAppendix(), 0) +
    renderTeamplayFlowScene(splitObjectiveScene(), splitObjectiveModel());
}
~~~

Test generated HTML and navigation behavior:

~~~js
test("flow presents factual sequence without setup failure language", () => {
  const html = renderTeamplayFlowScene(splitObjectiveScene(), splitObjectiveModel());
  assert.ok(html.includes("준비"));
  assert.ok(html.includes("교전 사실"));
  assert.ok(html.includes("획득 팀"));
  assert.ok(html.includes("후속 전환"));
  assert.ok(html.includes("분할 획득"));
  assert.ok(!html.includes("준비 실패"));
});

test("enemy capture and ally kill advantage remain independent", () => {
  const html = renderTeamplayFlowScene(enemyCaptureAllyKillLeadScene(), enemyCaptureAllyKillLeadModel());
  assert.ok(html.includes("상대 획득"));
  assert.ok(html.includes("아군 사망 1"));
  assert.ok(html.includes("상대 사망 3"));
});

test("unknown capture never becomes enemy", () => {
  const model = makeFlowModel("UNKNOWN", { ally: 0, enemy: 0, unknown: 1 }, 0, 0);
  const html = renderTeamplayFlowScene(model.scenes[0], model);
  assert.ok(html.includes("팀 미상"));
  assert.ok(!html.includes("상대 획득"));
});

test("all disclosures use native buttons and unique targets", () => {
  const html = renderAccessibleReviewAndFlow();
  const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(controls).size, controls.length);
  assert.ok(!html.includes('role="button"'));
  assert.ok(html.includes('aria-expanded="false"'));
});

test("flow navigation changes tab then focuses scene heading", () => {
  const calls = [];
  focusTeamplayScene("scene_1", {
    switchTab: (id) => calls.push(["tab", id]),
    requestFrame: (fn) => fn(),
    target: {
      scrollIntoView: (options) => calls.push(["scroll", options.behavior]),
      focus: () => calls.push(["focus"]),
    },
    reducedMotion: true,
  });
  assert.deepEqual(calls, [["tab", "tab-timeline"], ["scroll", "auto"], ["focus"]]);
});

test("missing scene leaves position and announces status", () => {
  const status = { textContent: "" };
  focusTeamplayScene("missing", {
    switchTab: () => {},
    requestFrame: (fn) => fn(),
    target: null,
    status,
    reducedMotion: false,
  });
  assert.equal(status.textContent, "근거 장면을 찾지 못했습니다.");
});

test("busy state is exposed on analysis and flow regions", () => {
  const attrs = [];
  const oldDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => ({ setAttribute: (name, value) => attrs.push([id, name, value]) }),
  };
  try {
    setTeamplayBusy(true);
  } finally {
    globalThis.document = oldDocument;
  }
  assert.deepEqual(attrs, [
    ["teamplay-analysis", "aria-busy", "true"],
    ["teamplay-flow", "aria-busy", "true"],
  ]);
});
~~~

- [ ] **Step 2: Run tests to verify failure**

Run: node test-artifacts/main/teamplay-v2-accessibility-tests.mjs

Expected: FAIL because flow and navigation helpers are absent.

- [ ] **Step 3: Add the mutual-exclusion flow slot**

Replace the visible dual timeline heading area with:

~~~html
<section class="section-block" id="teamplay-flow" aria-labelledby="teamplay-flow-title">
  <div data-teamplay-flow-v2 hidden>
    <div class="section-heading">
      <h2 id="teamplay-flow-title">오브젝트·교전 흐름</h2>
      <p class="section-copy">준비, 교전 사실, 획득 팀, 후속 전환을 시간순으로 확인합니다.</p>
    </div>
    <p data-teamplay-flow-status role="status"></p>
    <div class="teamplay-flow-list" data-teamplay-flow-list></div>
  </div>
  <div data-teamplay-flow-legacy>
    <div class="section-heading">
      <h2>이전 행동 타임라인</h2>
      <p class="section-copy">이전 저장 분석이라 플레이어 이벤트 중심으로 표시합니다.</p>
    </div>
    <div class="dual-tl" data-dual-timeline></div>
    <div class="dual-tl-detail" data-dual-detail></div>
  </div>
</section>
~~~

Add the three v2 flow DOM handles and one legacy wrapper handle.

- [ ] **Step 4: Render factual scene flow**

For each scene, render an article with:

~~~html
<article class="teamplay-flow-card" data-teamplay-scene="scene_id">
  <h3 id="teamplay-scene-tp_7363656e655f6964" tabindex="-1">18:42 · 오브젝트 교전</h3>
  <ol class="teamplay-flow-steps">
    <li><strong>준비</strong><span>확인된 준비 구간 사실</span></li>
    <li><strong>교전 사실</strong><span>아군 사망 1 · 상대 사망 3</span></li>
    <li><strong>획득 팀</strong><span>상대 획득</span></li>
    <li><strong>후속 전환</strong><span>상대 포탑 0 · 아군 포탑 1</span></li>
  </ol>
</article>
~~~

Use actual IDs and escaped values. Team labels:

~~~js
function teamplayTeamLabel(value) {
  if (value === "ALLY") return "아군";
  if (value === "ENEMY") return "상대";
  if (value === "SPLIT") return "분할 획득";
  return "팀 미상";
}
~~~

Never render 승리 or 실패 from captureTeam alone. Render death counts, capture team, and structures as independent rows.

Flow text is deterministic and non-causal. For an objective scene, 준비 shows setupWindow death counts and linked-encounter count or "준비 구간 기록 없음"; 교전 사실 shows contestWindow ally/enemy death counts plus linked encounter types; 획득 팀 shows captureTeam and captureCounts independently; 후속 전환 shows structure counts by takerRelation and the count of later neutral macro sourceRefs or "확인된 후속 전환 없음". For an encounter-only scene, 준비 says "독립 교전", 교전 사실 shows its type and death counts, 획득 팀 says "연결된 중립 오브젝트 없음", and 후속 전환 says "확인된 후속 전환 없음". UNKNOWN always renders 팀 미상. These are closed client formatting templates over sanitized enums/counts and never use 준비 실패, 승리, 패배, 과진입, or 추격 성공.

renderTeamplayFlow uses the same selectTeamplayRenderModel result:

- V2: show v2 flow, hide legacy dual timeline, sort scenes by startTimestamp then sceneId, and render every valid scene including NOT_INVOLVED scenes. If there are no scenes, render the normal empty status rather than an error.
- LEGACY: hide v2 flow, show legacy and call renderDualTimeline.
- EMPTY: show v2 empty status, hide legacy.

Replace the direct renderDualTimeline(sample) call in renderSample with renderTeamplayFlow(sample). Keep renderObjectiveTimeline(sample) as its separate existing objective table. This makes analysis-slot and flow-slot mode selection use the same predicate on every render.

- [ ] **Step 5: Implement native disclosure and scene navigation events**

Use one delegated click handler:

~~~js
function toggleTeamplayDisclosure(button) {
  const targetId = button.getAttribute("aria-controls");
  const target = targetId ? document.getElementById(targetId) : null;
  if (!target) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", expanded ? "false" : "true");
  target.hidden = expanded;
  if (expanded) button.focus();
}

function focusTeamplayScene(sceneId, deps = {}) {
  const switchTabFn = deps.switchTab || switchTab;
  const requestFrame = deps.requestFrame || requestAnimationFrame;
  const status = deps.status || dom.teamplayFlowStatus;
  const reducedMotion = deps.reducedMotion ??
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  switchTabFn("tab-timeline");
  requestFrame(() => {
    const target = deps.target === undefined
      ? document.getElementById("teamplay-scene-" + teamplayDomToken(sceneId))
      : deps.target;
    if (!target) {
      if (status) status.textContent = "근거 장면을 찾지 못했습니다.";
      return;
    }
    if (status) status.textContent = "";
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    target.focus();
  });
}

function bindTeamplayEvents() {
  const root = document.getElementById("main-content");
  if (!root || root.dataset.teamplayBound === "true") return;
  root.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-teamplay-toggle]");
    if (toggle) {
      toggleTeamplayDisclosure(toggle);
      return;
    }
    const flow = event.target.closest("[data-teamplay-flow-target]");
    if (flow) focusTeamplayScene(flow.dataset.teamplayFlowTarget);
  });
  root.dataset.teamplayBound = "true";
}
~~~

Call bindTeamplayEvents during bootstrap next to bindDualTimelineEvents.

renderTeamplayFlowScene must use id="teamplay-scene-${teamplayDomToken(scene.sceneId)}" so the card button and focus lookup share one collision-free ID rule. renderTeamplayReviewCard marks its article with data-teamplay-review-visible for mode visible/default and data-teamplay-review-extra for mode extra; only the shared extra wrapper owns hidden. Every render resets the whole-review button to collapsed so aria-expanded always matches the wrapper's hidden state.

- [ ] **Step 6: Complete table and responsive accessibility**

Team appendix table must contain:

~~~html
<table class="teamplay-team-table">
  <caption>이 개인 리뷰의 팀 상황 근거</caption>
  <thead>
    <tr><th scope="col">항목</th><th scope="col">아군</th><th scope="col">상대</th></tr>
  </thead>
  <tbody></tbody>
</table>
~~~

Also add caption and scope="col" to the existing objective table.

CSS requirements:

~~~css
.teamplay-flow-list {
  display: grid;
  gap: var(--space-4);
}

.teamplay-flow-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
  list-style: none;
  padding: 0;
}

.teamplay-flow-card h3:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 4px;
}

@media (max-width: 600px) {
  .teamplay-flow-steps {
    grid-template-columns: 1fr;
  }
  .teamplay-review,
  .teamplay-flow-card {
    overflow-wrap: anywhere;
  }
}

@media (prefers-reduced-motion: reduce) {
  .teamplay-review *,
  .teamplay-flow-card * {
    scroll-behavior: auto;
    transition-duration: .01ms !important;
  }
}
~~~

At 320 CSS px and 200% zoom, no fact or action text may require horizontal scrolling.

- [ ] **Step 7: Run tests and commit**

Run:

~~~bash
node test-artifacts/main/teamplay-v2-accessibility-tests.mjs
node test-artifacts/main/teamplay-v2-render-tests.mjs
node --check main.js
~~~

Expected: factual flow, independent outcomes, button semantics, unique IDs, navigation order, missing-target status, and existing render tests all pass.

Commit:

~~~bash
git add index.html main.js styles.css test-artifacts/main/teamplay-v2-accessibility-tests.mjs test-artifacts/main/teamplay-v2-render-tests.mjs
git commit -m "feat: add objective combat flow navigation"
~~~

### Task 10: Contract Documentation, Integration QA, and Full Verification

**Files:**
- Modify: analysis-json-schema.md
- Modify: normalized-match-schema.md
- Modify: replay-coach-qa-checklist.md
- Test: test-artifacts/server/teamplay-v2-integration-tests.mjs

**Interfaces:**
- Consumes: final server model, stored-sample hydration, AI selection merge, and UI render predicates.
- Produces: documented additive contracts, end-to-end synthetic regression, manual QA record, and a verified implementation branch.

- [ ] **Step 1: Write the failing end-to-end synthetic integration test**

Import the shared fixture builders, buildTeamplayAnalysisV2, applyRecommendationSelections, and isRenderableV2. Build one exact synthetic match:

~~~js
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
~~~

Assert:

~~~js
const facts = buildTeamplayAnalysisV2(match, timeline, 1);
const finalModel = applyRecommendationSelections(facts, null);
assert.equal(finalModel.encounters[0].type, "TEAMFIGHT_CANDIDATE");
assert.equal(finalModel.objectiveEngagements[0].captureTeam, "ENEMY");
assert.equal(finalModel.objectiveEngagements[0].contestWindow.deathCounts.ally, 1);
assert.equal(finalModel.objectiveEngagements[0].contestWindow.deathCounts.enemy, 3);
assert.equal(finalModel.personalReviews[0].effectiveInvolvementLevel, "CONFIRMED");
assert.ok(finalModel.personalReviews[0].evidenceIds.length > 0);
assert.ok(finalModel.teamAppendix[0]);
assert.equal(isRenderableV2(finalModel), true);
assert.ok(!JSON.stringify(finalModel).includes("puuid-"));
~~~

Add a second case with events on opposite sides of the map at the same timestamp and assert two encounters.

~~~js
const splitMapTimeline = makeTimelineFixture([
  makeFrame(90000, [
    championKill(100000, 1, 6, [], { x: 1000, y: 1000 }),
    championKill(100000, 2, 7, [], { x: 12000, y: 12000 }),
  ]),
]);
const splitMapFacts = buildTeamplayAnalysisV2(match, splitMapTimeline, 1);
assert.equal(splitMapFacts.encounters.length, 2);
~~~

Add one read-only regression using the already tracked sample data/samples/sample-kr-8186180726/raw-match.json and raw-timeline.json with target participantId 5 from its tracked normalized-match.json. Parse those three files directly, call buildTeamplayAnalysisV2, and assert schemaVersion 2.0, isRenderableV2 true, array shapes present, stable repeat output for encounter/objective/review IDs, and no puuid or Riot ID in the serialized result. Do not read the working-tree manifest and do not create or update any sample file.

- [ ] **Step 2: Run integration test to verify any remaining gap**

Run: node test-artifacts/server/teamplay-v2-integration-tests.mjs

Expected before final fixes: at least one assertion fails if any module boundary is inconsistent. If it unexpectedly passes, continue to documentation.

- [ ] **Step 3: Fix only integration-boundary defects**

Allowed fixes in this step:

- Interface/property name mismatch between the new lib modules.
- Missing deterministic sort.
- Missing sourceRef or factId propagation.
- Wrong import/export name.
- Incorrect source/coverage envelope assembly.

Do not change thresholds, copy, scoring weights, or fallback policy in this step; those require returning to the task that owns the contract and its focused test.

Run: node test-artifacts/server/teamplay-v2-integration-tests.mjs

Expected: all integration assertions pass.

- [ ] **Step 4: Update schema documentation**

In normalized-match-schema.md document:

- teamplayAnalysisV2 schemaVersion 2.0.
- coverage levels and sources.
- encounter, objectiveEngagement, scene, personalReview, and teamAppendix fields.
- typed sourceRefs and closed fact types.
- deterministic model contains no AI-created facts.

In analysis-json-schema.md document:

- analysis.teamplayAnalysisV2 is additive and server-derived.
- narrative decision and positioning copy uses SERVER_FACT_TEMPLATE.
- narrative.factStatements carries server-rendered claim text for every displayed review fact and is never AI-authored.
- coaching includes recommendationCode, fixed betterChoice, fixed nextGameRule, evidenceIds, and selectionSource.
- combatAnalysis and teamfightPhaseAnalysis remain for legacy consumers.
- teamplayRecommendationSelections is transient AI output and is not stored in the final response.

Use the field names and enums exactly as implemented; copy the final JSON example from the passing synthetic integration fixture.

- [ ] **Step 5: Update the manual QA checklist**

Add these checks to replay-coach-qa-checklist.md:

~~~markdown
### 개인 판단·오브젝트 교전 v2

- [ ] 개인 판단 리뷰가 팀 부록보다 먼저 보인다.
- [ ] 리뷰가 4개 이상일 때만 전체 리뷰 보기가 나타난다.
- [ ] 근거 보기와 팀 상황 보기는 기본적으로 닫혀 있다.
- [ ] 직접 어시스트는 직접 관여, 근접 위치만 있으면 근접 추정으로 표시된다.
- [ ] 위치 프레임이 없으면 위치 근거 부족이 표시되고 포지셔닝 제안이 없다.
- [ ] 오브젝트 획득 팀과 사망 교환 결과가 별도로 표시된다.
- [ ] 분할 유충은 양 팀 획득 수가 따로 보인다.
- [ ] 전체 흐름 보기는 타임라인 탭의 같은 장면 제목으로 포커스를 옮긴다.
- [ ] 키보드만으로 모든 펼치기 버튼을 열고 닫을 수 있다.
- [ ] 320px 너비와 200% 확대에서 본문 정보가 잘리지 않는다.
- [ ] prefers-reduced-motion에서 부드러운 스크롤이 비활성화된다.
- [ ] valid v2 화면에서 기존 전투·한타 본문이 동시에 보이지 않는다.
- [ ] PLAYER_ONLY 저장 샘플에서는 기존 분석만 보인다.
- [ ] AI 선택 실패에서도 사실 카드와 rule fallback이 유지된다.
- [ ] 신규 원시 샘플, manifest 변경, test-artifacts/tmp를 커밋하지 않는다.
~~~

- [ ] **Step 6: Run the complete verification suite**

Run:

~~~bash
node --check server.js
node --check main.js
node --check lib/teamplay-contract-v2.js
node --check lib/teamplay-source-v2.js
node --check lib/teamplay-encounters-v2.js
node --check lib/teamplay-objectives-v2.js
node --check lib/teamplay-reviews-v2.js
node --check lib/teamplay-coaching-v2.js
node --check lib/teamplay-analysis-v2.js
node --check lib/teamplay-stored-v2.js
npm test
git diff --check
~~~

Expected: every syntax check exits 0; npm test reports 0 failed across all test files; git diff --check produces no output.

- [ ] **Step 7: Perform browser QA**

Start the local app:

~~~bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
~~~

Open http://127.0.0.1:8123 and verify:

1. The committed raw-backed sample sample-kr-8186180726 shows v2 personal reviews or the valid v2 normal-empty state when it has no eligible personal scene.
2. A PLAYER_ONLY fixture or mocked response shows legacy content only.
3. Evidence and team appendix buttons toggle aria-expanded and hidden together.
4. 전체 흐름 보기 switches to the timeline tab, scrolls, and focuses the matching heading.
5. Unknown and split teams use text labels.
6. Keyboard-only interaction works.
7. Responsive widths 320, 768, and desktop preserve all text.
8. 200% zoom preserves reading order and controls.
9. Reduced motion uses instant scene navigation.

Stop the server after QA.

- [ ] **Step 8: Stage only in-scope implementation files**

Run:

~~~bash
git status --short
git diff --name-only
~~~

Confirm that data/samples/manifest.json, untracked sample directories, and test-artifacts/tmp remain unstaged.

Stage only production modules, server/UI files, committed tests, and documentation changed by Tasks 1-10.

- [ ] **Step 9: Commit final documentation and integration QA**

~~~bash
git add analysis-json-schema.md normalized-match-schema.md replay-coach-qa-checklist.md test-artifacts/server/teamplay-v2-integration-tests.mjs
git commit -m "docs: record teamplay v2 contract and QA"
~~~

- [ ] **Step 10: Verify branch state**

Run:

~~~bash
git log --oneline --decorate -12
git status --short
~~~

Expected: the feature commits are on codex/personal-objective-teamfight-analysis; only the intentionally excluded manifest, new sample directories, and test-artifacts/tmp remain in the worktree.
