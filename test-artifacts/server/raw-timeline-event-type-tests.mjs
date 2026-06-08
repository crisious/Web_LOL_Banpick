// server.js raw timeline event type policy regression tests

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

const rawParticipantSource = serverSrc.includes("function rawParticipantId(value)")
  ? extractFunctionSource(serverSrc, "rawParticipantId")
  : "function rawParticipantId(value) { return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null; }";

const rawEventPolicySources = [
  serverSrc.includes("const RAW_CHAMPION_KILL_EVENT_TYPES =")
    ? extractConstSource(serverSrc, "RAW_CHAMPION_KILL_EVENT_TYPES")
    : 'const RAW_CHAMPION_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);',
  serverSrc.includes("const RAW_ELITE_MONSTER_KILL_EVENT_TYPES =")
    ? extractConstSource(serverSrc, "RAW_ELITE_MONSTER_KILL_EVENT_TYPES")
    : 'const RAW_ELITE_MONSTER_KILL_EVENT_TYPES = new Set(["ELITE_MONSTER_KILL"]);',
  serverSrc.includes("const RAW_BUILDING_KILL_EVENT_TYPES =")
    ? extractConstSource(serverSrc, "RAW_BUILDING_KILL_EVENT_TYPES")
    : 'const RAW_BUILDING_KILL_EVENT_TYPES = new Set(["BUILDING_KILL"]);',
  serverSrc.includes("const SUPPORTED_RAW_TIMELINE_EVENT_TYPES =")
    ? extractConstSource(serverSrc, "SUPPORTED_RAW_TIMELINE_EVENT_TYPES")
    : 'const SUPPORTED_RAW_TIMELINE_EVENT_TYPES = new Set([...RAW_CHAMPION_KILL_EVENT_TYPES, ...RAW_ELITE_MONSTER_KILL_EVENT_TYPES, ...RAW_BUILDING_KILL_EVENT_TYPES]);',
  rawParticipantSource,
  serverSrc.includes("function isRawChampionKillEvent(rawEvent)")
    ? extractFunctionSource(serverSrc, "isRawChampionKillEvent")
    : "function isRawChampionKillEvent(rawEvent) { return RAW_CHAMPION_KILL_EVENT_TYPES.has(rawEvent.type); }",
  serverSrc.includes("function isRawEliteMonsterKillEvent(rawEvent)")
    ? extractFunctionSource(serverSrc, "isRawEliteMonsterKillEvent")
    : "function isRawEliteMonsterKillEvent(rawEvent) { return RAW_ELITE_MONSTER_KILL_EVENT_TYPES.has(rawEvent.type); }",
  serverSrc.includes("function isRawBuildingKillEvent(rawEvent)")
    ? extractFunctionSource(serverSrc, "isRawBuildingKillEvent")
    : "function isRawBuildingKillEvent(rawEvent) { return RAW_BUILDING_KILL_EVENT_TYPES.has(rawEvent.type); }",
  serverSrc.includes("function isSupportedRawTimelineEvent(rawEvent)")
    ? extractFunctionSource(serverSrc, "isSupportedRawTimelineEvent")
    : "function isSupportedRawTimelineEvent(rawEvent) { return SUPPORTED_RAW_TIMELINE_EVENT_TYPES.has(rawEvent.type); }",
  serverSrc.includes("function rawAssistingParticipantIds(rawEvent)")
    ? extractFunctionSource(serverSrc, "rawAssistingParticipantIds")
    : "function rawAssistingParticipantIds(rawEvent) { return Array.isArray(rawEvent.assistingParticipantIds) ? rawEvent.assistingParticipantIds : []; }",
  serverSrc.includes("function isRawPlayerInvolved(rawEvent, targetParticipantId)")
    ? extractFunctionSource(serverSrc, "isRawPlayerInvolved")
    : "function isRawPlayerInvolved(rawEvent, targetParticipantId) { const assistingParticipantIds = rawAssistingParticipantIds(rawEvent); return rawEvent.killerId === targetParticipantId || rawEvent.victimId === targetParticipantId || assistingParticipantIds.includes(targetParticipantId); }",
  serverSrc.includes("function isKnownRawTeamId(teamId)")
    ? extractFunctionSource(serverSrc, "isKnownRawTeamId")
    : "function isKnownRawTeamId(teamId) { return teamId === 100 || teamId === 200; }",
  serverSrc.includes("function isRawEnemyBuildingKill(rawEvent, targetTeamId)")
    ? extractFunctionSource(serverSrc, "isRawEnemyBuildingKill")
    : "function isRawEnemyBuildingKill(rawEvent, targetTeamId) { return isKnownRawTeamId(rawEvent.teamId) && rawEvent.teamId !== targetTeamId; }",
];

const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");
const shouldKeepEventSrc = extractFunctionSource(serverSrc, "shouldKeepEvent");
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const { buildEventType, shouldKeepEvent } = new Function(
  [
    ...rawEventPolicySources,
    buildEventTypeSrc,
    shouldKeepEventSrc,
    "return { buildEventType, shouldKeepEvent };",
  ].join("\n"),
)();

let pass = 0, fail = 0;
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

const championKill = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [2, 3], teamId: null };
const playerKill = { type: "CHAMPION_KILL", killerId: 2, victimId: 7, assistingParticipantIds: [], teamId: null };
const playerDeath = { type: "CHAMPION_KILL", killerId: 7, victimId: 2, assistingParticipantIds: [], teamId: null };
const dragon = { type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", killerId: 7, victimId: null, assistingParticipantIds: [], teamId: null };
const baron = { type: "ELITE_MONSTER_KILL", monsterType: "BARON_NASHOR", killerId: 7, victimId: null, assistingParticipantIds: [], teamId: null };
const horde = { type: "ELITE_MONSTER_KILL", monsterType: "HORDE", killerId: 2, victimId: null, assistingParticipantIds: [], teamId: null };
const enemyTower = { type: "BUILDING_KILL", killerId: 2, victimId: null, assistingParticipantIds: [], teamId: 200 };
const ownTower = { type: "BUILDING_KILL", killerId: 7, victimId: null, assistingParticipantIds: [], teamId: 100 };
const wardKill = { type: "WARD_KILL", killerId: 2, victimId: null, assistingParticipantIds: [], teamId: null };

check("buildEventType player kill", buildEventType(playerKill, 2, 100, false), "CHAMPION_KILL");
check("buildEventType player death", buildEventType(playerDeath, 2, 100, false), "PLAYER_DEATH");
check("buildEventType assisted multi fight", buildEventType(championKill, 2, 100, false), "TEAMFIGHT_FOLLOWUP");
check("buildEventType dragon won", buildEventType(dragon, 2, 100, true), "DRAGON_FIGHT");
check("buildEventType dragon lost", buildEventType(dragon, 2, 100, false), "OBJECTIVE_SETUP_FAIL");
check("buildEventType baron won", buildEventType(baron, 2, 100, true), "BARON_FIGHT");
check("buildEventType baron lost", buildEventType(baron, 2, 100, false), "OBJECTIVE_SETUP_FAIL");
check("buildEventType horde won", buildEventType(horde, 2, 100, true), "OBJECTIVE_SETUP_WIN");
check("buildEventType enemy tower", buildEventType(enemyTower, 2, 100, false), "TOWER_TAKE");
check("buildEventType own tower lost", buildEventType(ownTower, 2, 100, false), "OBJECTIVE_SETUP_FAIL");
check("shouldKeep player involved champion kill", shouldKeepEvent(playerKill, 2, 100), true);
check("shouldKeep non-involved champion kill", shouldKeepEvent({ ...championKill, assistingParticipantIds: [] }, 2, 100), false);
check("shouldKeep elite monster", shouldKeepEvent(dragon, 2, 100), true);
check("shouldKeep enemy tower", shouldKeepEvent(enemyTower, 2, 100), true);
check("shouldKeep unsupported raw event", shouldKeepEvent(wardKill, 2, 100), false);

checkTrue(
  "server defines RAW_CHAMPION_KILL_EVENT_TYPES",
  serverSrc.includes('const RAW_CHAMPION_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);'),
);
checkTrue(
  "server defines RAW_ELITE_MONSTER_KILL_EVENT_TYPES",
  serverSrc.includes('const RAW_ELITE_MONSTER_KILL_EVENT_TYPES = new Set(["ELITE_MONSTER_KILL"]);'),
);
checkTrue(
  "server defines RAW_BUILDING_KILL_EVENT_TYPES",
  serverSrc.includes('const RAW_BUILDING_KILL_EVENT_TYPES = new Set(["BUILDING_KILL"]);'),
);
checkTrue(
  "server defines SUPPORTED_RAW_TIMELINE_EVENT_TYPES",
  serverSrc.includes("const SUPPORTED_RAW_TIMELINE_EVENT_TYPES = new Set([...RAW_CHAMPION_KILL_EVENT_TYPES, ...RAW_ELITE_MONSTER_KILL_EVENT_TYPES, ...RAW_BUILDING_KILL_EVENT_TYPES]);"),
);
checkTrue(
  "server defines isRawChampionKillEvent",
  serverSrc.includes("function isRawChampionKillEvent(rawEvent)"),
);
checkTrue(
  "server defines isRawEliteMonsterKillEvent",
  serverSrc.includes("function isRawEliteMonsterKillEvent(rawEvent)"),
);
checkTrue(
  "server defines isRawBuildingKillEvent",
  serverSrc.includes("function isRawBuildingKillEvent(rawEvent)"),
);
checkTrue(
  "server defines isSupportedRawTimelineEvent",
  serverSrc.includes("function isSupportedRawTimelineEvent(rawEvent)"),
);
checkTrue(
  "buildEventType uses isRawChampionKillEvent",
  buildEventTypeSrc.includes("if (isRawChampionKillEvent(rawEvent))"),
);
checkTrue(
  "buildEventType uses isRawEliteMonsterKillEvent",
  buildEventTypeSrc.includes("if (isRawEliteMonsterKillEvent(rawEvent))"),
);
checkTrue(
  "buildEventType uses isRawBuildingKillEvent",
  buildEventTypeSrc.includes("if (isRawBuildingKillEvent(rawEvent))"),
);
checkTrue(
  "shouldKeepEvent uses isRawChampionKillEvent",
  shouldKeepEventSrc.includes("if (isRawChampionKillEvent(rawEvent))"),
);
checkTrue(
  "shouldKeepEvent uses isRawEliteMonsterKillEvent",
  shouldKeepEventSrc.includes("if (isRawEliteMonsterKillEvent(rawEvent))"),
);
checkTrue(
  "shouldKeepEvent uses isRawBuildingKillEvent",
  shouldKeepEventSrc.includes("if (isRawBuildingKillEvent(rawEvent))"),
);
checkTrue(
  "extractTimelineEvents uses isSupportedRawTimelineEvent",
  extractTimelineEventsSrc.includes("if (!isSupportedRawTimelineEvent(rawEvent))"),
);
checkTrue(
  "extractTimelineEvents horde dedupe uses isRawEliteMonsterKillEvent",
  extractTimelineEventsSrc.includes("isRawEliteMonsterKillEvent(rawEvent) &&\n        rawEvent.monsterType === \"HORDE\""),
);
checkTrue(
  "extractTimelineEvents horde timestamp uses isRawEliteMonsterKillEvent",
  extractTimelineEventsSrc.includes('if (isRawEliteMonsterKillEvent(rawEvent) && rawEvent.monsterType === "HORDE")'),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
