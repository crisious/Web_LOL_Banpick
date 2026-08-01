// server.js combat/teamfight timestamp policy regression tests

import fs from "fs";
import combatEncounterModule from "../../lib/combat-encounters.js";

const { detectCombatEncounters: detectCombatEncountersFromPolicy } = combatEncounterModule;

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
  const match = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

const detectCombatEncountersSrc = extractFunctionSource(serverSrc, "detectCombatEncounters");
const buildTeamfightPhasesSrc = extractFunctionSource(serverSrc, "buildTeamfightPhases");

const { detectCombatEncounters, buildTeamfightPhases } = new Function(
  "detectCombatEncountersFromPolicy",
  [
    extractConstSource(serverSrc, "TEAMFIGHT_MIN_EVENTS"),
    extractConstSource(serverSrc, "CLEANUP_GAP_MS"),
    extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
    extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
    extractConstSource(serverSrc, "PLAYER_COMBAT_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isPlayerKillEvent"),
    extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    extractFunctionSource(serverSrc, "isPlayerCombatEvent"),
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    detectCombatEncountersSrc,
    buildTeamfightPhasesSrc,
    "return { detectCombatEncounters, buildTeamfightPhases };",
  ].join("\n"),
)(detectCombatEncountersFromPolicy);

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

function combatEvent(eventId, timestampMs, eventType, extra = {}) {
  return {
    eventId,
    timestampMs,
    timestampLabel: extra.timestampLabel ?? "stale-label",
    phase: extra.phase ?? "LATE",
    eventType,
    isPlayerInvolved: extra.isPlayerInvolved ?? true,
  };
}

function encounterTiming(encounter) {
  return {
    phase: encounter?.phase,
    startLabel: encounter?.startLabel,
    endLabel: encounter?.endLabel,
    relatedEventIds: encounter?.relatedEventIds,
  };
}

function teamfightTiming(teamfight) {
  return {
    startLabel: teamfight?.startLabel,
    endLabel: teamfight?.endLabel,
  };
}

const malformedEvents = [
  combatEvent("evt_valid", 120000, "CHAMPION_KILL", { timestampLabel: "stale-valid", phase: "LATE" }),
  combatEvent("evt_string", "abc", "PLAYER_DEATH", { timestampLabel: "NaN:NaN", phase: "LATE" }),
  combatEvent("evt_negative", -100, "PLAYER_DEATH", { timestampLabel: "-1:-1", phase: "LATE" }),
  combatEvent("evt_infinite", Infinity, "CHAMPION_KILL", { timestampLabel: "Infinity:NaN", phase: "LATE" }),
  combatEvent("evt_noncombat", 0, "TOWER_TAKE", { timestampLabel: "0:00", phase: "EARLY" }),
];

const encounters = detectCombatEncounters(malformedEvents);

check("combat encounters keep normalized grouping", encounters.map((encounter) => encounter.relatedEventIds), [
  ["evt_string", "evt_negative", "evt_infinite"],
  ["evt_valid"],
]);
check("combat encounter normalizes malformed event labels", encounterTiming(encounters[0]), {
  phase: "EARLY",
  startLabel: "0:00",
  endLabel: "0:00",
  relatedEventIds: ["evt_string", "evt_negative", "evt_infinite"],
});
check("valid event splits after normalized malformed group", encounterTiming(encounters[1]), {
  phase: "EARLY",
  startLabel: "2:00",
  endLabel: "2:00",
  relatedEventIds: ["evt_valid"],
});
check("combat encounter counts stay unchanged", {
  eventCount: encounters[0].eventCount,
  playerKills: encounters[0].playerKills,
  playerDeaths: encounters[0].playerDeaths,
  situation: encounters[0].situation,
}, {
  eventCount: 3,
  playerKills: 1,
  playerDeaths: 2,
  situation: "PLAYER_DOWN",
});

const teamfight = buildTeamfightPhases([
  {
    encounterId: "enc_001",
    phase: "LATE",
    eventCount: 3,
    playerKills: 1,
    playerDeaths: 2,
    situation: "PLAYER_DOWN",
    relatedEventIds: ["evt_valid", "evt_string", "evt_negative"],
  },
], malformedEvents)[0];

check("teamfight top-level labels derive from normalized event time", teamfightTiming(teamfight), {
  startLabel: "0:00",
  endLabel: "2:00",
});
check("teamfight phase labels derive from normalized event time", teamfight.phases.map((phase) => ({
  phase: phase.phase,
  startLabel: phase.startLabel,
  endLabel: phase.endLabel,
})), [
  { phase: "ENGAGE", startLabel: "0:00", endLabel: "0:00" },
  { phase: "TRADE", startLabel: "0:00", endLabel: "0:00" },
  { phase: "CLEANUP", startLabel: "2:00", endLabel: "2:00" },
]);
check("teamfight phase event order derives from normalized timestamps", teamfight.phases.map((phase) => phase.relatedEventIds), [
  ["evt_string"],
  ["evt_negative"],
  ["evt_valid"],
]);
check("teamfight game phase still follows encounter phase contract", teamfight.gamePhase, "LATE");
check("teamfight outcome policy stays intact", teamfight.phases.map((phase) => phase.outcomeTag), [
  "CAUGHT_OUT",
  "TRADE_LOST",
  "CLOSED_OUT",
]);

checkTrue(
  "buildTeamfightPhases normalizes sort timestamps",
  buildTeamfightPhasesSrc.includes("rawEventTimestampMs({ timestamp: a.timestampMs })"),
);
checkTrue(
  "buildTeamfightPhases derives phase labels from normalized time",
  buildTeamfightPhasesSrc.includes('startLabel: evs.length ? timestampLabel(eventTime(evs[0])) : "",') &&
    buildTeamfightPhasesSrc.includes('endLabel: evs.length ? timestampLabel(eventTime(evs[evs.length - 1])) : "",'),
);
checkTrue(
  "buildTeamfightPhases derives top-level labels from normalized time",
  buildTeamfightPhasesSrc.includes("startLabel: timestampLabel(eventTime(events[0])),") &&
    buildTeamfightPhasesSrc.includes("endLabel: timestampLabel(eventTime(events[last])),"),
);
checkTrue(
  "buildTeamfightPhases cleanup gap uses normalized time",
  buildTeamfightPhasesSrc.includes("const gap = eventTime(lastEvt) - eventTime(prevEvt);"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
