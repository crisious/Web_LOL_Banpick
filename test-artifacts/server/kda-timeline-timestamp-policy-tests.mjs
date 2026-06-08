// server.js KDA timeline timestamp policy regression tests

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

const rawTimestampSource = functionSourceOrFallback(
  serverSrc,
  "rawEventTimestampMs",
  "function rawEventTimestampMs(event) { return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0; }",
);
const buildKdaTimelineSrc = extractFunctionSource(serverSrc, "buildKdaTimeline");

const { buildKdaTimeline } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    rawTimestampSource,
    extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
    extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
    extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isPlayerKillEvent"),
    extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    extractFunctionSource(serverSrc, "isFightContributionEvent"),
    buildKdaTimelineSrc,
    "return { buildKdaTimeline };",
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

function timing(point) {
  return { time: point.time, timeLabel: point.timeLabel, phase: point.phase };
}

function countShape(point) {
  return { kills: point.kills, deaths: point.deaths, assists: point.assists, kda: point.kda };
}

const kdaTimeline = buildKdaTimeline({
  timelineEvents: [
    {
      eventType: "TEAMFIGHT_FOLLOWUP",
      isPlayerInvolved: true,
      timestampMs: "abc",
      timestampLabel: "NaN:NaN",
      phase: "LATE",
      summary: "string timestamp assist",
    },
    {
      eventType: "CHAMPION_KILL",
      isPlayerInvolved: true,
      timestampMs: -100,
      timestampLabel: "-1:-1",
      phase: "LATE",
      summary: "negative timestamp kill",
    },
    {
      eventType: "PLAYER_DEATH",
      isPlayerInvolved: true,
      timestampMs: Infinity,
      timestampLabel: "Infinity:NaN",
      phase: "LATE",
      summary: "infinite timestamp death",
    },
    {
      eventType: "CHAMPION_KILL",
      isPlayerInvolved: true,
      timestampMs: 120000,
      timestampLabel: "stale-label",
      phase: "LATE",
      summary: "valid timestamp kill",
    },
    {
      eventType: "TOWER_TAKE",
      isPlayerInvolved: true,
      timestampMs: 180000,
      timestampLabel: "3:00",
      phase: "EARLY",
      summary: "non-KDA tower",
    },
  ],
});

const [startPoint, stringPoint, negativePoint, infinitePoint, validPoint] = kdaTimeline;

check("KDA timeline keeps start plus four KDA points", kdaTimeline.length, 5);
check("KDA start point stays unchanged", timing(startPoint), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("string KDA timestamp normalizes to 0", timing(stringPoint), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("negative KDA timestamp normalizes to 0", timing(negativePoint), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("infinite KDA timestamp normalizes to 0", timing(infinitePoint), { time: 0, timeLabel: "0:00", phase: "EARLY" });
check("valid KDA timestamp is derived from timestampMs", timing(validPoint), { time: 120000, timeLabel: "2:00", phase: "EARLY" });
check("KDA counts stay unchanged", countShape(validPoint), { kills: 2, deaths: 1, assists: 1, kda: 3 });
checkTrue(
  "buildKdaTimeline normalizes evt.timestampMs with rawEventTimestampMs",
  buildKdaTimelineSrc.includes("const time = rawEventTimestampMs({ timestamp: evt.timestampMs });"),
);
checkTrue(
  "buildKdaTimeline derives labels from normalized time",
  buildKdaTimelineSrc.includes("timeLabel: timestampLabel(time),"),
);
checkTrue(
  "buildKdaTimeline derives phase from normalized time",
  buildKdaTimelineSrc.includes("phase: phaseFor(time),"),
);
checkTrue(
  "buildKdaTimeline no longer copies evt.timestampLabel",
  !buildKdaTimelineSrc.includes("timeLabel: evt.timestampLabel"),
);
checkTrue(
  "buildKdaTimeline no longer copies evt.phase",
  !buildKdaTimelineSrc.includes("phase: evt.phase"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
