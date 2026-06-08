// server.js raw participant id policy regression tests

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

const rawParticipantSource = functionSourceOrFallback(
  serverSrc,
  "rawParticipantId",
  "function rawParticipantId(value) { return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null; }",
);

const rawTimestampSource = functionSourceOrFallback(
  serverSrc,
  "rawEventTimestampMs",
  "function rawEventTimestampMs(event) { return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0; }",
);

const rawObjectiveTeamSource = functionSourceOrFallback(
  serverSrc,
  "rawObjectiveTeamId",
  "function rawObjectiveTeamId(rawEvent) { const mappedTeamId = participantTeam(rawEvent.killerId); return isKnownRawTeamId(mappedTeamId) ? mappedTeamId : null; }",
);

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
  rawObjectiveTeamSource,
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

const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const { rawParticipantId, extractTimelineEvents } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "participantTeam"),
    extractFunctionSource(serverSrc, "phaseFor"),
    rawTimestampSource,
    rawParticipantSource,
    ...rawTimelinePolicySources,
    ...eventTypePolicySources,
    extractFunctionSource(serverSrc, "laneHintForEvent"),
    extractFunctionSource(serverSrc, "importanceForEvent"),
    extractFunctionSource(serverSrc, "summaryForEvent"),
    extractFunctionSource(serverSrc, "buildEventType"),
    extractFunctionSource(serverSrc, "shouldKeepEvent"),
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    "return { rawParticipantId, extractTimelineEvents };",
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

check("rawParticipantId accepts first participant", rawParticipantId(1), 1);
check("rawParticipantId accepts last participant", rawParticipantId(10), 10);
check("rawParticipantId rejects zero", rawParticipantId(0), null);
check("rawParticipantId rejects string id", rawParticipantId("2"), null);
check("rawParticipantId rejects fractional id", rawParticipantId(2.5), null);
check("rawParticipantId rejects out-of-range id", rawParticipantId(11), null);
check("rawParticipantId rejects Infinity", rawParticipantId(Infinity), null);
check("rawParticipantId rejects missing id", rawParticipantId(null), null);

const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "ELITE_MONSTER_KILL", timestamp: 1000, killerId: "2", monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 2000, killerId: 2.5, monsterType: "RIFTHERALD" },
          { type: "ELITE_MONSTER_KILL", timestamp: 3000, killerId: 2, monsterType: "DRAGON" },
        ],
      },
    ],
  },
};

const events = extractTimelineEvents({}, timeline, 2, 100);
check("extractTimelineEvents keeps three objective events", events.length, 3);
check("string killer id does not award dragon fight", {
  timestampMs: events[0]?.timestampMs,
  eventType: events[0]?.eventType,
  isPlayerInvolved: events[0]?.isPlayerInvolved,
}, { timestampMs: 1000, eventType: "OBJECTIVE_SETUP_FAIL", isPlayerInvolved: false });
check("fractional killer id does not award objective setup win", {
  timestampMs: events[1]?.timestampMs,
  eventType: events[1]?.eventType,
  isPlayerInvolved: events[1]?.isPlayerInvolved,
}, { timestampMs: 2000, eventType: "OBJECTIVE_SETUP_FAIL", isPlayerInvolved: false });
check("valid numeric killer id still awards dragon fight", {
  timestampMs: events[2]?.timestampMs,
  eventType: events[2]?.eventType,
  isPlayerInvolved: events[2]?.isPlayerInvolved,
}, { timestampMs: 3000, eventType: "DRAGON_FIGHT", isPlayerInvolved: true });

checkTrue(
  "server defines rawParticipantId",
  serverSrc.includes("function rawParticipantId(value)"),
);
checkTrue(
  "rawParticipantId requires integer in participant range",
  serverSrc.includes("Number.isInteger(value)") &&
    serverSrc.includes("value >= 1") &&
    serverSrc.includes("value <= 10"),
);
checkTrue(
  "extractTimelineEvents uses rawParticipantId for killerId",
  extractTimelineEventsSrc.includes("killerId: rawParticipantId(event.killerId),"),
);
checkTrue(
  "extractTimelineEvents uses rawParticipantId for victimId",
  extractTimelineEventsSrc.includes("victimId: rawParticipantId(event.victimId),"),
);
checkTrue(
  "extractTimelineEvents no longer uses participant id fallback expressions",
  !extractTimelineEventsSrc.includes("killerId: event.killerId || null") &&
    !extractTimelineEventsSrc.includes("victimId: event.victimId || null"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
