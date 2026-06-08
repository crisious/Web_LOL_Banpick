// server.js ward timeline timestamp policy regression tests

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

const buildWardTimelineSrc = extractFunctionSource(serverSrc, "buildWardTimeline");

const { buildWardTimeline } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    buildWardTimelineSrc,
    "return { buildWardTimeline };",
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

const wardTimeline = buildWardTimeline({
  info: {
    frames: [
      {
        events: [
          { type: "WARD_PLACED", timestamp: "abc", creatorId: 2, wardType: "YELLOW_TRINKET" },
          { type: "WARD_PLACED", timestamp: -100, creatorId: 2, wardType: "CONTROL_WARD" },
          { type: "WARD_KILL", timestamp: Infinity, killerId: 2, wardType: "CONTROL_WARD" },
          { type: "WARD_PLACED", timestamp: 120000, creatorId: 2, wardType: "SIGHT_WARD" },
          { type: "WARD_PLACED", timestamp: 300000, creatorId: 7, wardType: "BLUE_TRINKET" },
          { type: "WARD_KILL", timestamp: 360000, killerId: 7, wardType: "CONTROL_WARD" },
        ],
      },
      { events: [] },
    ],
  },
}, 2);

const placedString = wardTimeline.events.find((event) => event.action === "PLACED" && event.wardType === "YELLOW_TRINKET");
const placedNegative = wardTimeline.events.find((event) => event.action === "PLACED" && event.wardType === "CONTROL_WARD");
const killedInfinite = wardTimeline.events.find((event) => event.action === "KILLED" && event.wardType === "CONTROL_WARD");
const placedValid = wardTimeline.events.find((event) => event.action === "PLACED" && event.wardType === "SIGHT_WARD");

check("target participant ward events are kept", wardTimeline.events.length, 4);
check("placed string timestamp normalizes to 0", timing(placedString), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("placed negative timestamp normalizes to 0", timing(placedNegative), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("killed infinite timestamp normalizes to 0", timing(killedInfinite), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("valid ward timestamp is preserved", timing(placedValid), { time: 120000, timeLabel: "2:00", phase: "EARLY" });
check("summary counts normalized placed wards in early phase", wardTimeline.summary.byPhase, { EARLY: 3, MID: 0, LATE: 0 });
check("summary ward counts stay unchanged", {
  totalPlaced: wardTimeline.summary.totalPlaced,
  totalKilled: wardTimeline.summary.totalKilled,
  controlWardsPlaced: wardTimeline.summary.controlWardsPlaced,
}, {
  totalPlaced: 3,
  totalKilled: 1,
  controlWardsPlaced: 1,
});

checkTrue(
  "buildWardTimeline uses rawEventTimestampMs",
  buildWardTimelineSrc.includes("const time = rawEventTimestampMs(event);"),
);
checkTrue(
  "buildWardTimeline labels use normalized time",
  buildWardTimelineSrc.includes("timeLabel: timestampLabel(time),") &&
    buildWardTimelineSrc.includes("phase: phaseFor(time),"),
);
checkTrue(
  "buildWardTimeline no longer labels from raw event.timestamp",
  !buildWardTimelineSrc.includes("timeLabel: timestampLabel(event.timestamp)") &&
    !buildWardTimelineSrc.includes("phase: phaseFor(event.timestamp)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
