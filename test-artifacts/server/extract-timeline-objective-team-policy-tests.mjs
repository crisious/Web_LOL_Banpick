// server.js extract timeline objective team policy regression tests

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

const rawObjectiveTeamIdSrc = functionSourceOrFallback(
  serverSrc,
  "rawObjectiveTeamId",
  "function rawObjectiveTeamId(rawEvent) { const mappedTeamId = participantTeam(rawEvent.killerId); return mappedTeamId === 100 || mappedTeamId === 200 ? mappedTeamId : null; }",
);
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

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
  extractFunctionSource(serverSrc, "isKnownRawTeamId"),
  extractFunctionSource(serverSrc, "isRawEnemyBuildingKill"),
  rawObjectiveTeamIdSrc,
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

const { rawObjectiveTeamId, extractTimelineEvents } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "participantTeam"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    extractFunctionSource(serverSrc, "rawParticipantId"),
    ...rawTimelinePolicySources,
    ...eventTypePolicySources,
    extractFunctionSource(serverSrc, "laneHintForEvent"),
    extractFunctionSource(serverSrc, "importanceForEvent"),
    extractFunctionSource(serverSrc, "summaryForEvent"),
    extractFunctionSource(serverSrc, "buildEventType"),
    extractFunctionSource(serverSrc, "shouldKeepEvent"),
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    "return { rawObjectiveTeamId, extractTimelineEvents };",
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

const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "ELITE_MONSTER_KILL", timestamp: 1000, killerId: null, killerTeamId: 100, monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 2000, killerId: null, killerTeamId: 100, monsterType: "RIFTHERALD" },
          { type: "ELITE_MONSTER_KILL", timestamp: 3000, killerId: null, killerTeamId: 200, monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 4000, killerId: "2", killerTeamId: "100", monsterType: "RIFTHERALD" },
          { type: "ELITE_MONSTER_KILL", timestamp: 5000, killerId: 2, killerTeamId: "100", monsterType: "DRAGON" },
        ],
      },
    ],
  },
};

const events = extractTimelineEvents({}, timeline, 2, 100);
check("extractTimelineEvents keeps all objective events", events.length, 5);
check("known allied killerTeamId awards dragon fight", events[0]?.eventType, "DRAGON_FIGHT");
check("known allied killerTeamId awards non-dragon objective setup win", events[1]?.eventType, "OBJECTIVE_SETUP_WIN");
check("known enemy killerTeamId keeps dragon as objective fail", events[2]?.eventType, "OBJECTIVE_SETUP_FAIL");
check("string killerTeamId with string killerId stays conservative fail", events[3]?.eventType, "OBJECTIVE_SETUP_FAIL");
check("malformed killerTeamId falls back to valid numeric killerId", events[4]?.eventType, "DRAGON_FIGHT");

check("helper uses known killerTeamId without participant fallback", rawObjectiveTeamId({ killerTeamId: 100, killerId: null }), 100);
check("helper prioritizes known killerTeamId over conflicting killerId fallback", rawObjectiveTeamId({ killerTeamId: 200, killerId: 2 }), 200);
check("helper falls back through sanitized raw killerId", rawObjectiveTeamId({ killerTeamId: "100", killerId: 2 }), 100);
check("helper rejects string team and string participant ids", rawObjectiveTeamId({ killerTeamId: "100", killerId: "2" }), null);
check("helper rejects neutral team and neutral participant id", rawObjectiveTeamId({ killerTeamId: 300, killerId: 0 }), null);

checkTrue(
  "server defines rawObjectiveTeamId",
  serverSrc.includes("function rawObjectiveTeamId(rawEvent)"),
);
checkTrue(
  "rawObjectiveTeamId validates raw killerTeamId",
  rawObjectiveTeamIdSrc.includes("isKnownRawTeamId(rawEvent.killerTeamId)"),
);
checkTrue(
  "rawObjectiveTeamId falls back through participantTeam",
  rawObjectiveTeamIdSrc.includes("participantTeam(rawEvent.killerId)"),
);
checkTrue(
  "extractTimelineEvents preserves killerTeamId on rawEvent",
  extractTimelineEventsSrc.includes("killerTeamId: event.killerTeamId ?? null,"),
);
checkTrue(
  "extractTimelineEvents uses rawObjectiveTeamId",
  extractTimelineEventsSrc.includes("const objectiveTeam = rawObjectiveTeamId(rawEvent);"),
);
checkTrue(
  "extractTimelineEvents no longer directly maps objective team from killerId",
  !extractTimelineEventsSrc.includes("const objectiveTeam = participantTeam(rawEvent.killerId);"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
