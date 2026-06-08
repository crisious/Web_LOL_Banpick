// server.js objective timeline killer team policy regression tests

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

const objectiveKillerTeamIdSrc = functionSourceOrFallback(
  serverSrc,
  "objectiveKillerTeamId",
  "function objectiveKillerTeamId(event, participantTeamMap) { const mappedTeamId = participantTeamMap.get(event.killerId); return mappedTeamId === 100 || mappedTeamId === 200 ? mappedTeamId : null; }",
);
const buildObjectiveTimelineSrc = extractFunctionSource(serverSrc, "buildObjectiveTimeline");

const { objectiveKillerTeamId, buildObjectiveTimeline } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    extractFunctionSource(serverSrc, "rawParticipantId"),
    extractFunctionSource(serverSrc, "isKnownRawTeamId"),
    extractFunctionSource(serverSrc, "buildStructureLabel"),
    extractFunctionSource(serverSrc, "buildObjectiveLabel"),
    objectiveKillerTeamIdSrc,
    buildObjectiveTimelineSrc,
    "return { objectiveKillerTeamId, buildObjectiveTimeline };",
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
          { type: "ELITE_MONSTER_KILL", timestamp: 1000, killerId: null, killerTeamId: 100, monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 2000, killerId: null, killerTeamId: 200, monsterType: "BARON_NASHOR" },
          { type: "ELITE_MONSTER_KILL", timestamp: 3000, killerId: "2", killerTeamId: "100", monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 4000, killerId: 2, killerTeamId: "100", monsterType: "DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: 5000, killerId: 0, killerTeamId: 300, monsterType: "RIFTHERALD" },
          { type: "BUILDING_KILL", timestamp: 6000, teamId: 200, buildingType: "TOWER_BUILDING", towerType: "OUTER_TURRET", laneType: "MID_LANE" },
        ],
      },
    ],
  },
};

const events = buildObjectiveTimeline(timeline, 100, participantTeamMap);
check("known raw killerTeamId 100 marks objective as ally", events[0]?.team, "ALLY");
check("known raw killerTeamId 200 marks objective as enemy", events[1]?.team, "ENEMY");
check("string killerTeamId with string killerId stays conservative enemy", events[2]?.team, "ENEMY");
check("malformed killerTeamId falls back to valid numeric killerId", events[3]?.team, "ALLY");
check("neutral or unknown killer team stays conservative enemy", events[4]?.team, "ENEMY");
check("building team direction remains unchanged", events[5]?.team, "ALLY");

check("helper uses known killerTeamId without participant fallback", objectiveKillerTeamId({ killerTeamId: 100, killerId: null }, participantTeamMap), 100);
check("helper prioritizes known killerTeamId over conflicting killerId fallback", objectiveKillerTeamId({ killerTeamId: 200, killerId: 2 }, participantTeamMap), 200);
check("helper falls back through sanitized numeric killerId", objectiveKillerTeamId({ killerTeamId: "100", killerId: 2 }, participantTeamMap), 100);
check("helper rejects string team and string participant ids", objectiveKillerTeamId({ killerTeamId: "100", killerId: "2" }, participantTeamMap), null);
check("helper rejects neutral team and neutral participant id", objectiveKillerTeamId({ killerTeamId: 300, killerId: 0 }, participantTeamMap), null);

checkTrue(
  "server defines objectiveKillerTeamId",
  serverSrc.includes("function objectiveKillerTeamId(event, participantTeamMap)"),
);
checkTrue(
  "objectiveKillerTeamId validates raw killerTeamId",
  objectiveKillerTeamIdSrc.includes("isKnownRawTeamId(event.killerTeamId)"),
);
checkTrue(
  "objectiveKillerTeamId sanitizes fallback killerId",
  objectiveKillerTeamIdSrc.includes("rawParticipantId(event.killerId)"),
);
checkTrue(
  "buildObjectiveTimeline uses objectiveKillerTeamId",
  buildObjectiveTimelineSrc.includes("const killerTeam = objectiveKillerTeamId(event, participantTeamMap);"),
);
checkTrue(
  "buildObjectiveTimeline no longer reads event.killerId directly from the map",
  !buildObjectiveTimelineSrc.includes("participantTeamMap.get(event.killerId)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
