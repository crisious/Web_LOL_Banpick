// server.js objective timeline timestamp policy regression tests

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

const buildObjectiveTimelineSrc = extractFunctionSource(serverSrc, "buildObjectiveTimeline");

const { buildObjectiveTimeline } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    extractFunctionSource(serverSrc, "rawParticipantId"),
    extractFunctionSource(serverSrc, "isKnownRawTeamId"),
    extractFunctionSource(serverSrc, "buildStructureLabel"),
    extractFunctionSource(serverSrc, "buildObjectiveLabel"),
    extractFunctionSource(serverSrc, "objectiveKillerTeamId"),
    buildObjectiveTimelineSrc,
    "return { buildObjectiveTimeline };",
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

function timing(event) {
  return {
    time: event?.time,
    timeLabel: event?.timeLabel,
    phase: event?.phase,
  };
}

const participantTeamMap = new Map([[2, 100], [7, 200]]);
const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "ELITE_MONSTER_KILL", timestamp: "abc", killerTeamId: 100, monsterType: "DRAGON", monsterSubType: "FIRE_DRAGON" },
          { type: "ELITE_MONSTER_KILL", timestamp: -100, killerTeamId: 200, monsterType: "BARON_NASHOR" },
          { type: "BUILDING_KILL", timestamp: Infinity, teamId: 200, buildingType: "TOWER_BUILDING", towerType: "OUTER_TURRET", laneType: "MID_LANE" },
          { type: "ELITE_MONSTER_KILL", timestamp: 120000, killerId: 2, monsterType: "RIFTHERALD" },
        ],
      },
    ],
  },
};

const events = buildObjectiveTimeline(timeline, 100, participantTeamMap);
const dragon = events.find((event) => event.label === "드래곤 (fire dragon)");
const baron = events.find((event) => event.label === "바론");
const midTower = events.find((event) => event.label === "미드 외곽 타워");
const herald = events.find((event) => event.label === "전령");

check("objective string timestamp normalizes to 0", timing(dragon), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("objective negative timestamp normalizes to 0", timing(baron), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("structure infinite timestamp normalizes to 0", timing(midTower), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("valid objective timestamp is preserved", timing(herald), { time: 120000, timeLabel: "2:00", phase: "EARLY" });
check("objective team direction is unchanged", {
  dragon: dragon?.team,
  baron: baron?.team,
  midTower: midTower?.team,
  herald: herald?.team,
}, {
  dragon: "ALLY",
  baron: "ENEMY",
  midTower: "ALLY",
  herald: "ALLY",
});

checkTrue(
  "buildObjectiveTimeline uses rawEventTimestampMs for event time",
  buildObjectiveTimelineSrc.includes("const time = rawEventTimestampMs(event);"),
);
checkTrue(
  "buildObjectiveTimeline labels use normalized time",
  buildObjectiveTimelineSrc.includes("timeLabel: timestampLabel(time),") &&
    buildObjectiveTimelineSrc.includes("phase: phaseFor(time),"),
);
checkTrue(
  "buildObjectiveTimeline no longer labels from raw event.timestamp",
  !buildObjectiveTimelineSrc.includes("timeLabel: timestampLabel(event.timestamp)") &&
    !buildObjectiveTimelineSrc.includes("phase: phaseFor(event.timestamp)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
