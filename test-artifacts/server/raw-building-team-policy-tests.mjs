// server.js raw building team policy regression tests

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

const rawTimelinePolicySources = [
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
  functionSourceOrFallback(
    serverSrc,
    "isKnownRawTeamId",
    "function isKnownRawTeamId(teamId) { return teamId === 100 || teamId === 200; }",
  ),
  functionSourceOrFallback(
    serverSrc,
    "isRawEnemyBuildingKill",
    "function isRawEnemyBuildingKill(rawEvent, targetTeamId) { return isKnownRawTeamId(rawEvent.teamId) && rawEvent.teamId !== targetTeamId; }",
  ),
];

const eventTypePolicySources = [
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
];

const rawTimestampSource = functionSourceOrFallback(
  serverSrc,
  "rawEventTimestampMs",
  "function rawEventTimestampMs(event) { return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0; }",
);

const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");
const shouldKeepEventSrc = extractFunctionSource(serverSrc, "shouldKeepEvent");
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const {
  isKnownRawTeamId,
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
    ...rawTimelinePolicySources,
    ...eventTypePolicySources,
    extractFunctionSource(serverSrc, "laneHintForEvent"),
    extractFunctionSource(serverSrc, "importanceForEvent"),
    extractFunctionSource(serverSrc, "summaryForEvent"),
    buildEventTypeSrc,
    shouldKeepEventSrc,
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    "return { isKnownRawTeamId, isRawEnemyBuildingKill, buildEventType, shouldKeepEvent, extractTimelineEvents };",
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

const knownEnemyTower = { type: "BUILDING_KILL", timestamp: 3000, killerId: 7, victimId: null, assistingParticipantIds: [], teamId: 200 };
const knownOwnTower = { type: "BUILDING_KILL", timestamp: 2000, killerId: 7, victimId: null, assistingParticipantIds: [], teamId: 100 };
const missingTeamTower = { type: "BUILDING_KILL", timestamp: 1000, killerId: 7, victimId: null, assistingParticipantIds: [] };
const stringOwnTower = { type: "BUILDING_KILL", timestamp: 1500, killerId: 7, victimId: null, assistingParticipantIds: [], teamId: "100" };
const stringEnemyTower = { type: "BUILDING_KILL", timestamp: 2500, killerId: 7, victimId: null, assistingParticipantIds: [], teamId: "200" };
const playerInvolvedUnknownTower = { type: "BUILDING_KILL", timestamp: 4000, killerId: 2, victimId: null, assistingParticipantIds: [], teamId: null };

check("isKnownRawTeamId accepts 100", isKnownRawTeamId(100), true);
check("isKnownRawTeamId accepts 200", isKnownRawTeamId(200), true);
check("isKnownRawTeamId rejects string team id", isKnownRawTeamId("200"), false);
check("isKnownRawTeamId rejects missing team id", isKnownRawTeamId(null), false);
check("isRawEnemyBuildingKill keeps known enemy team", isRawEnemyBuildingKill(knownEnemyTower, 100), true);
check("isRawEnemyBuildingKill rejects own team", isRawEnemyBuildingKill(knownOwnTower, 100), false);
check("isRawEnemyBuildingKill rejects missing team", isRawEnemyBuildingKill(missingTeamTower, 100), false);
check("isRawEnemyBuildingKill rejects string enemy team", isRawEnemyBuildingKill(stringEnemyTower, 100), false);

check("buildEventType maps known enemy tower to TOWER_TAKE", buildEventType(knownEnemyTower, 2, 100, false), "TOWER_TAKE");
check("buildEventType maps own tower to objective fail", buildEventType(knownOwnTower, 2, 100, false), "OBJECTIVE_SETUP_FAIL");
check("buildEventType maps missing team tower conservatively", buildEventType(missingTeamTower, 2, 100, false), "OBJECTIVE_SETUP_FAIL");
check("buildEventType maps string enemy team tower conservatively", buildEventType(stringEnemyTower, 2, 100, false), "OBJECTIVE_SETUP_FAIL");

check("shouldKeepEvent keeps known enemy tower without player involvement", shouldKeepEvent(knownEnemyTower, 2, 100), true);
check("shouldKeepEvent drops own tower without player involvement", shouldKeepEvent(knownOwnTower, 2, 100), false);
check("shouldKeepEvent drops missing team tower without player involvement", shouldKeepEvent(missingTeamTower, 2, 100), false);
check("shouldKeepEvent drops string own tower without player involvement", shouldKeepEvent(stringOwnTower, 2, 100), false);
check("shouldKeepEvent drops string enemy tower without player involvement", shouldKeepEvent(stringEnemyTower, 2, 100), false);
check("shouldKeepEvent preserves player-involved unknown tower", shouldKeepEvent(playerInvolvedUnknownTower, 2, 100), true);

const timeline = {
  info: {
    frames: [
      {
        events: [
          stringOwnTower,
          missingTeamTower,
          knownEnemyTower,
          stringEnemyTower,
        ],
      },
    ],
  },
};

const events = extractTimelineEvents({}, timeline, 2, 100);
check("extractTimelineEvents only keeps known enemy building event", events.length, 1);
check("kept building event is known enemy tower take", {
  timestampMs: events[0]?.timestampMs,
  eventType: events[0]?.eventType,
}, { timestampMs: 3000, eventType: "TOWER_TAKE" });

checkTrue(
  "server defines isKnownRawTeamId",
  serverSrc.includes("function isKnownRawTeamId(teamId)"),
);
checkTrue(
  "isKnownRawTeamId allows only numeric Riot team ids",
  serverSrc.includes("teamId === 100") && serverSrc.includes("teamId === 200"),
);
checkTrue(
  "server defines isRawEnemyBuildingKill",
  serverSrc.includes("function isRawEnemyBuildingKill(rawEvent, targetTeamId)"),
);
checkTrue(
  "isRawEnemyBuildingKill requires known team id",
  serverSrc.includes("isKnownRawTeamId(rawEvent.teamId)") &&
    serverSrc.includes("rawEvent.teamId !== targetTeamId"),
);
checkTrue(
  "buildEventType uses isRawEnemyBuildingKill",
  buildEventTypeSrc.includes("isRawEnemyBuildingKill(rawEvent, targetTeamId)"),
);
checkTrue(
  "shouldKeepEvent uses isRawEnemyBuildingKill",
  shouldKeepEventSrc.includes("isRawEnemyBuildingKill(rawEvent, targetTeamId)"),
);
checkTrue(
  "buildEventType no longer directly compares building team with ternary",
  !buildEventTypeSrc.includes("rawEvent.teamId === targetTeamId ?"),
);
checkTrue(
  "shouldKeepEvent no longer treats every non-own raw team as enemy",
  !shouldKeepEventSrc.includes("rawEvent.teamId !== targetTeamId"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
