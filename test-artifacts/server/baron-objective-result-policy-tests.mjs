// server.js Baron objective result policy regression tests

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
  extractFunctionSource(serverSrc, "rawObjectiveTeamId"),
  extractFunctionSource(serverSrc, "isRawEnemyBuildingKill"),
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

const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");
const calcObjectiveScoreSrc = extractFunctionSource(serverSrc, "calcObjectiveScore");

const { buildEventType, extractTimelineEvents, calcObjectiveScore } = new Function(
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
    buildEventTypeSrc,
    extractFunctionSource(serverSrc, "shouldKeepEvent"),
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    extractConstSource(serverSrc, "OBJECTIVE_WIN_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isObjectiveWinEvent"),
    extractConstSource(serverSrc, "OBJECTIVE_FAIL_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isObjectiveFailEvent"),
    extractFunctionSource(serverSrc, "clamp10"),
    calcObjectiveScoreSrc,
    "return { buildEventType, extractTimelineEvents, calcObjectiveScore };",
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

const baron = {
  type: "ELITE_MONSTER_KILL",
  monsterType: "BARON_NASHOR",
  killerId: null,
  victimId: null,
  assistingParticipantIds: [],
  teamId: null,
};

check("buildEventType maps won Baron to BARON_FIGHT", buildEventType(baron, 2, 100, true), "BARON_FIGHT");
check("buildEventType maps lost Baron to objective fail", buildEventType(baron, 2, 100, false), "OBJECTIVE_SETUP_FAIL");

const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "ELITE_MONSTER_KILL", timestamp: 1000, killerId: null, killerTeamId: 100, monsterType: "BARON_NASHOR" },
          { type: "ELITE_MONSTER_KILL", timestamp: 2000, killerId: null, killerTeamId: 200, monsterType: "BARON_NASHOR" },
        ],
      },
    ],
  },
};

const events = extractTimelineEvents({}, timeline, 2, 100);
check("extractTimelineEvents keeps two Baron objective events", events.length, 2);
check("allied Baron remains BARON_FIGHT", events[0]?.eventType, "BARON_FIGHT");
check("enemy Baron is objective fail", events[1]?.eventType, "OBJECTIVE_SETUP_FAIL");
check("objective score counts one Baron win and one Baron fail", calcObjectiveScore(events), 4.4);

checkTrue(
  "buildEventType uses playerWonObjective for Baron",
  buildEventTypeSrc.includes('return playerWonObjective ? "BARON_FIGHT" : "OBJECTIVE_SETUP_FAIL";'),
);
checkTrue(
  "buildEventType no longer returns BARON_FIGHT unconditionally",
  !buildEventTypeSrc.includes('if (rawEvent.monsterType === "BARON_NASHOR") {\n      return "BARON_FIGHT";\n    }'),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
