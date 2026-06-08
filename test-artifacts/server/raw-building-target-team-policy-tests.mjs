// server.js raw building target team policy regression tests

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

function extractConstSource(source, name) {
  const m = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[0];
}

function functionSourceOrFallback(source, name, fallback) {
  return source.includes(`function ${name}(`)
    ? extractFunctionSource(source, name)
    : fallback;
}

const rawTimestampSource = functionSourceOrFallback(
  serverSrc,
  "rawEventTimestampMs",
  "function rawEventTimestampMs(event) { return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0; }",
);
const rawParticipantSource = functionSourceOrFallback(
  serverSrc,
  "rawParticipantId",
  "function rawParticipantId(value) { return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null; }",
);
const isKnownRawTeamIdSrc = functionSourceOrFallback(
  serverSrc,
  "isKnownRawTeamId",
  "function isKnownRawTeamId(teamId) { return teamId === 100 || teamId === 200; }",
);
const isRawEnemyBuildingKillSrc = functionSourceOrFallback(
  serverSrc,
  "isRawEnemyBuildingKill",
  "function isRawEnemyBuildingKill(rawEvent, targetTeamId) { return isKnownRawTeamId(rawEvent.teamId) && rawEvent.teamId !== targetTeamId; }",
);
const rawObjectiveTeamSource = functionSourceOrFallback(
  serverSrc,
  "rawObjectiveTeamId",
  "function rawObjectiveTeamId(rawEvent) { const mappedTeamId = participantTeam(rawEvent.killerId); return isKnownRawTeamId(mappedTeamId) ? mappedTeamId : null; }",
);

const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");
const shouldKeepEventSrc = extractFunctionSource(serverSrc, "shouldKeepEvent");
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const {
  isRawEnemyBuildingKill,
  buildEventType,
  shouldKeepEvent,
  extractTimelineEvents,
} = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "participantTeam"),
    extractFunctionSource(serverSrc, "phaseFor"),
    rawTimestampSource,
    rawParticipantSource,
    extractConstSource(serverSrc, "RAW_CHAMPION_KILL_EVENT_TYPES"),
    extractConstSource(serverSrc, "RAW_ELITE_MONSTER_KILL_EVENT_TYPES"),
    extractConstSource(serverSrc, "RAW_BUILDING_KILL_EVENT_TYPES"),
    extractConstSource(serverSrc, "SUPPORTED_RAW_TIMELINE_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isRawChampionKillEvent"),
    extractFunctionSource(serverSrc, "isRawEliteMonsterKillEvent"),
    extractFunctionSource(serverSrc, "isRawBuildingKillEvent"),
    extractFunctionSource(serverSrc, "isSupportedRawTimelineEvent"),
    extractFunctionSource(serverSrc, "rawAssistingParticipantIds"),
    extractFunctionSource(serverSrc, "isRawPlayerInvolved"),
    isKnownRawTeamIdSrc,
    isRawEnemyBuildingKillSrc,
    extractConstSource(serverSrc, "ELITE_OBJECTIVE_FIGHT_EVENT_TYPES"),
    extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
    extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
    extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
    extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isEliteObjectiveFightEventType"),
    extractFunctionSource(serverSrc, "isStructureTakeEventType"),
    extractFunctionSource(serverSrc, "isPlayerKillEventType"),
    extractFunctionSource(serverSrc, "isPlayerDeathEventType"),
    extractFunctionSource(serverSrc, "isFightContributionEventType"),
    extractFunctionSource(serverSrc, "laneHintForEvent"),
    extractFunctionSource(serverSrc, "importanceForEvent"),
    extractFunctionSource(serverSrc, "summaryForEvent"),
    rawObjectiveTeamSource,
    buildEventTypeSrc,
    shouldKeepEventSrc,
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    "return { isRawEnemyBuildingKill, buildEventType, shouldKeepEvent, extractTimelineEvents };",
  ].join("\n"),
)();

let pass = 0;
let fail = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

const knownEnemyTower = {
  type: "BUILDING_KILL",
  timestamp: 3000,
  killerId: 7,
  victimId: null,
  assistingParticipantIds: [],
  teamId: 200,
  buildingType: "TOWER_BUILDING",
  towerType: "OUTER_TURRET",
  laneType: "MID_LANE",
};

check("known enemy tower with numeric target remains enemy", isRawEnemyBuildingKill(knownEnemyTower, 100), true);
check("known tower with string target fails closed", isRawEnemyBuildingKill(knownEnemyTower, "100"), false);
check("known tower with missing target fails closed", isRawEnemyBuildingKill(knownEnemyTower, null), false);
check("known tower with neutral target fails closed", isRawEnemyBuildingKill(knownEnemyTower, 300), false);
check("buildEventType invalid target stays conservative", buildEventType(knownEnemyTower, 2, "100", false), "OBJECTIVE_SETUP_FAIL");
check("shouldKeepEvent invalid target drops non-involved tower", shouldKeepEvent(knownEnemyTower, 2, "100"), false);

const eventsWithInvalidTarget = extractTimelineEvents({
}, {
  info: {
    frames: [
      {
        events: [knownEnemyTower],
      },
    ],
  },
}, 2, "100");
check("extractTimelineEvents invalid target drops non-involved tower", eventsWithInvalidTarget.length, 0);

checkTrue(
  "isRawEnemyBuildingKill validates target team id",
  isRawEnemyBuildingKillSrc.includes("isKnownRawTeamId(targetTeamId)"),
);
checkTrue(
  "isRawEnemyBuildingKill no longer compares against unvalidated target only",
  !isRawEnemyBuildingKillSrc.includes("isKnownRawTeamId(rawEvent.teamId) && rawEvent.teamId !== targetTeamId"),
);
checkTrue(
  "buildEventType still delegates building team direction",
  buildEventTypeSrc.includes("isRawEnemyBuildingKill(rawEvent, targetTeamId)"),
);
checkTrue(
  "shouldKeepEvent still delegates building keep policy",
  shouldKeepEventSrc.includes("isRawEnemyBuildingKill(rawEvent, targetTeamId)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
