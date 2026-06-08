// server.js objective timeline structure team policy regression tests

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

function functionSourceOrFallback(source, name, fallback) {
  return source.includes(`function ${name}(`)
    ? extractFunctionSource(source, name)
    : fallback;
}

const objectiveStructureTeamSrc = functionSourceOrFallback(
  serverSrc,
  "objectiveStructureTeam",
  "function objectiveStructureTeam(event, targetTeamId) { return event.teamId === targetTeamId ? \"ENEMY\" : \"ALLY\"; }",
);
const buildObjectiveTimelineSrc = extractFunctionSource(serverSrc, "buildObjectiveTimeline");

const { objectiveStructureTeam, buildObjectiveTimeline } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    extractFunctionSource(serverSrc, "rawParticipantId"),
    extractFunctionSource(serverSrc, "isKnownRawTeamId"),
    extractFunctionSource(serverSrc, "buildStructureLabel"),
    extractFunctionSource(serverSrc, "objectiveMonsterSubTypeLabel"),
    extractFunctionSource(serverSrc, "buildObjectiveLabel"),
    extractFunctionSource(serverSrc, "objectiveKillerTeamId"),
    objectiveStructureTeamSrc,
    buildObjectiveTimelineSrc,
    "return { objectiveStructureTeam, buildObjectiveTimeline };",
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

const participantTeamMap = new Map([[2, 100], [7, 200]]);
const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "BUILDING_KILL", timestamp: 1000, teamId: 200, buildingType: "TOWER_BUILDING", towerType: "OUTER_TURRET", laneType: "MID_LANE" },
          { type: "BUILDING_KILL", timestamp: 2000, teamId: 100, buildingType: "TOWER_BUILDING", towerType: "INNER_TURRET", laneType: "TOP_LANE" },
          { type: "BUILDING_KILL", timestamp: 3000, teamId: "200", buildingType: "TOWER_BUILDING", towerType: "OUTER_TURRET", laneType: "BOT_LANE" },
          { type: "BUILDING_KILL", timestamp: 4000, buildingType: "INHIBITOR_BUILDING", laneType: "TOP_LANE" },
          { type: "BUILDING_KILL", timestamp: 5000, teamId: 300, buildingType: "TOWER_BUILDING", towerType: "NEXUS_TURRET", laneType: "MID_LANE" },
          { type: "ELITE_MONSTER_KILL", timestamp: 6000, killerTeamId: 100, monsterType: "DRAGON" },
        ],
      },
    ],
  },
};

const events = buildObjectiveTimeline(timeline, 100, participantTeamMap);
const byLabel = (label) => events.find((event) => event.label === label);

check("known enemy structure destroyed renders as allied pressure", byLabel("미드 외곽 타워")?.team, "ALLY");
check("known own structure destroyed renders as enemy pressure", byLabel("탑 내부 타워")?.team, "ENEMY");
check("string enemy team id stays conservative enemy", byLabel("봇 외곽 타워")?.team, "ENEMY");
check("missing team id stays conservative enemy", byLabel("탑 억제기")?.team, "ENEMY");
check("neutral team id stays conservative enemy", byLabel("미드 넥서스 타워")?.team, "ENEMY");
check("objective rows keep objective killer team policy", byLabel("드래곤")?.team, "ALLY");

check("helper maps known enemy destroyed team to ALLY", objectiveStructureTeam({ teamId: 200 }, 100), "ALLY");
check("helper maps known own destroyed team to ENEMY", objectiveStructureTeam({ teamId: 100 }, 100), "ENEMY");
check("helper rejects string team id conservatively", objectiveStructureTeam({ teamId: "200" }, 100), "ENEMY");
check("helper rejects missing team id conservatively", objectiveStructureTeam({}, 100), "ENEMY");
check("helper rejects neutral team id conservatively", objectiveStructureTeam({ teamId: 300 }, 100), "ENEMY");
check("helper rejects invalid target team id conservatively", objectiveStructureTeam({ teamId: 200 }, "100"), "ENEMY");

checkTrue(
  "server defines objectiveStructureTeam",
  serverSrc.includes("function objectiveStructureTeam(event, targetTeamId)"),
);
checkTrue(
  "objectiveStructureTeam validates event team id",
  objectiveStructureTeamSrc.includes("isKnownRawTeamId(event.teamId)"),
);
checkTrue(
  "objectiveStructureTeam validates target team id",
  objectiveStructureTeamSrc.includes("isKnownRawTeamId(targetTeamId)"),
);
checkTrue(
  "buildObjectiveTimeline uses objectiveStructureTeam",
  buildObjectiveTimelineSrc.includes("team: objectiveStructureTeam(event, targetTeamId),"),
);
checkTrue(
  "buildObjectiveTimeline no longer compares structure team inline",
  !buildObjectiveTimelineSrc.includes('team: event.teamId === targetTeamId ? "ENEMY" : "ALLY",'),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
