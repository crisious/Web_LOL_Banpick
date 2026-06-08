// server.js key moment timestamp policy regression tests

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
const buildKeyMomentsSrc = extractFunctionSource(serverSrc, "buildKeyMoments");

const { buildKeyMoments } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    rawTimestampSource,
    extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
    extractConstSource(serverSrc, "ELITE_OBJECTIVE_FIGHT_EVENT_TYPES"),
    extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    extractFunctionSource(serverSrc, "isEliteObjectiveFightEvent"),
    extractFunctionSource(serverSrc, "isStructureTakeEvent"),
    extractFunctionSource(serverSrc, "labelForMoment"),
    extractFunctionSource(serverSrc, "impactForMoment"),
    buildKeyMomentsSrc,
    "return { buildKeyMoments };",
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

function timing(moment) {
  return { timestamp: moment?.timestamp, phase: moment?.phase };
}

const keyMoments = buildKeyMoments({
  matchInfo: { result: "LOSS" },
  timelineEvents: [
    {
      eventId: "evt_valid",
      eventType: "CHAMPION_KILL",
      timestampMs: 120000,
      timestampLabel: "stale-label",
      phase: "LATE",
      importance: 5,
      summary: "valid timestamp kill",
    },
    {
      eventId: "evt_string",
      eventType: "PLAYER_DEATH",
      timestampMs: "abc",
      timestampLabel: "NaN:NaN",
      phase: "LATE",
      importance: 5,
      summary: "string timestamp death",
    },
    {
      eventId: "evt_negative",
      eventType: "TEAMFIGHT_FOLLOWUP",
      timestampMs: -100,
      timestampLabel: "-1:-1",
      phase: "LATE",
      importance: 5,
      summary: "negative timestamp assist",
    },
    {
      eventId: "evt_infinite",
      eventType: "TOWER_TAKE",
      timestampMs: Infinity,
      timestampLabel: "Infinity:NaN",
      phase: "LATE",
      importance: 5,
      summary: "infinite timestamp tower",
    },
  ],
});

const byId = new Map(keyMoments.map((moment) => [moment.eventId, moment]));

check("key moments sort by normalized timestamp", keyMoments.map((moment) => moment.eventId), [
  "evt_string",
  "evt_negative",
  "evt_infinite",
  "evt_valid",
]);
check("string key moment timestamp normalizes to display 0", timing(byId.get("evt_string")), { timestamp: "0:00", phase: "EARLY" });
check("negative key moment timestamp normalizes to display 0", timing(byId.get("evt_negative")), { timestamp: "0:00", phase: "EARLY" });
check("infinite key moment timestamp normalizes to display 0", timing(byId.get("evt_infinite")), { timestamp: "0:00", phase: "EARLY" });
check("valid key moment timestamp derives fresh label and phase", timing(byId.get("evt_valid")), { timestamp: "2:00", phase: "EARLY" });
check("key moment labels and related ids stay intact", {
  label: byId.get("evt_valid")?.label,
  reason: byId.get("evt_valid")?.reason,
  relatedEventIds: byId.get("evt_valid")?.relatedEventIds,
}, {
  label: "직접 킬 확보",
  reason: "valid timestamp kill",
  relatedEventIds: ["evt_valid"],
});
checkTrue(
  "buildKeyMoments normalizes sort timestamps",
  buildKeyMomentsSrc.includes("rawEventTimestampMs({ timestamp: a.timestampMs })"),
);
checkTrue(
  "buildKeyMoments derives timestamp label from normalized time",
  buildKeyMomentsSrc.includes("timestamp: timestampLabel(time),"),
);
checkTrue(
  "buildKeyMoments derives phase from normalized time",
  buildKeyMomentsSrc.includes("phase: phaseFor(time),"),
);
checkTrue(
  "buildKeyMoments no longer copies event.timestampLabel",
  !buildKeyMomentsSrc.includes("timestamp: event.timestampLabel"),
);
checkTrue(
  "buildKeyMoments no longer copies event.phase",
  !buildKeyMomentsSrc.includes("phase: event.phase"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
