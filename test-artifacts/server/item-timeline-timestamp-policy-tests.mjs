// server.js item timeline timestamp policy regression tests

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

const buildItemTimelineSrc = extractFunctionSource(serverSrc, "buildItemTimeline");

const { buildItemTimeline } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    buildItemTimelineSrc,
    "return { buildItemTimeline };",
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

const itemTimeline = buildItemTimeline({
  info: {
    frames: [
      {
        events: [
          { type: "ITEM_PURCHASED", timestamp: "abc", participantId: 2, itemId: 1001 },
          { type: "ITEM_PURCHASED", timestamp: -100, participantId: 2, itemId: 2003 },
          { type: "ITEM_PURCHASED", timestamp: Infinity, participantId: 2, itemId: 3340 },
          { type: "ITEM_PURCHASED", timestamp: 120000, participantId: 2, itemId: 1055 },
          { type: "ITEM_PURCHASED", timestamp: 180000, participantId: 7, itemId: 1056 },
          { type: "ITEM_SOLD", timestamp: 240000, participantId: 2, itemId: 1001 },
        ],
      },
    ],
  },
}, 2);

const byItem = (itemId) => itemTimeline.find((event) => event.itemId === itemId);
const stringItem = byItem(1001);
const negativeItem = byItem(2003);
const infiniteItem = byItem(3340);
const validItem = byItem(1055);

check("target participant item purchases are kept", itemTimeline.map((event) => event.itemId), [1001, 2003, 3340, 1055]);
check("string item timestamp normalizes to 0", timing(stringItem), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("negative item timestamp normalizes to 0", timing(negativeItem), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("infinite item timestamp normalizes to 0", timing(infiniteItem), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("valid item timestamp is preserved", timing(validItem), { time: 120000, timeLabel: "2:00", phase: "EARLY" });

checkTrue(
  "buildItemTimeline uses rawEventTimestampMs",
  buildItemTimelineSrc.includes("const time = rawEventTimestampMs(event);"),
);
checkTrue(
  "buildItemTimeline labels use normalized time",
  buildItemTimelineSrc.includes("timeLabel: timestampLabel(time),") &&
    buildItemTimelineSrc.includes("phase: phaseFor(time),"),
);
checkTrue(
  "buildItemTimeline no longer labels from raw event.timestamp",
  !buildItemTimelineSrc.includes("timeLabel: timestampLabel(event.timestamp)") &&
    !buildItemTimelineSrc.includes("phase: phaseFor(event.timestamp)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
