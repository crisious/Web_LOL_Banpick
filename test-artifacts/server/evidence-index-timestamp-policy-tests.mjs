// server.js evidence index timestamp policy regression tests

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

const rawTimestampSource = functionSourceOrFallback(
  serverSrc,
  "rawEventTimestampMs",
  "function rawEventTimestampMs(event) { return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0; }",
);
const buildEvidenceIndexSrc = extractFunctionSource(serverSrc, "buildEvidenceIndex");

const { buildEvidenceIndex } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    rawTimestampSource,
    buildEvidenceIndexSrc,
    "return { buildEvidenceIndex };",
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

function timing(item) {
  return { timestamp: item?.timestamp, statNote: item?.statNote };
}

const evidence = buildEvidenceIndex({
  matchInfo: { position: "MID" },
  playerStats: { cs: 180, csPerMinute: 7.5, visionScore: 28, killParticipation: 0.42 },
  timelineEvents: [
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
      importance: 4,
      summary: "negative timestamp assist",
    },
    {
      eventId: "evt_infinite",
      eventType: "TOWER_TAKE",
      timestampMs: Infinity,
      timestampLabel: "Infinity:NaN",
      phase: "LATE",
      importance: 4,
      summary: "infinite timestamp tower",
    },
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
      eventId: "evt_low",
      eventType: "SKIRMISH_WIN",
      timestampMs: 180000,
      timestampLabel: "3:00",
      phase: "EARLY",
      importance: 3,
      summary: "low importance event",
    },
  ],
});

const byId = new Map(evidence.map((item) => [item.eventId, item]));

check("string evidence timestamp normalizes to display 0", timing(byId.get("evt_string")), {
  timestamp: "0:00",
  statNote: "EARLY · 중요도 5",
});
check("negative evidence timestamp normalizes to display 0", timing(byId.get("evt_negative")), {
  timestamp: "0:00",
  statNote: "EARLY · 중요도 4",
});
check("infinite evidence timestamp normalizes to display 0", timing(byId.get("evt_infinite")), {
  timestamp: "0:00",
  statNote: "EARLY · 중요도 4",
});
check("valid evidence timestamp derives fresh label and phase", timing(byId.get("evt_valid")), {
  timestamp: "2:00",
  statNote: "EARLY · 중요도 5",
});
check("low importance event stays excluded", byId.has("evt_low"), false);
check("stat summary evidence rows stay appended", evidence.slice(-2).map((item) => item.eventId), ["stat_cs", "stat_vision"]);
check("stat summary rows keep stable timestamps", evidence.slice(-2).map((item) => item.timestamp), ["FULL", "FULL"]);
checkTrue(
  "buildEvidenceIndex normalizes event timestamp",
  buildEvidenceIndexSrc.includes("const time = rawEventTimestampMs({ timestamp: event.timestampMs });"),
);
checkTrue(
  "buildEvidenceIndex derives phase from normalized time",
  buildEvidenceIndexSrc.includes("const phase = phaseFor(time);"),
);
checkTrue(
  "buildEvidenceIndex derives timestamp label from normalized time",
  buildEvidenceIndexSrc.includes("timestamp: timestampLabel(time),"),
);
checkTrue(
  "buildEvidenceIndex no longer copies event.timestampLabel",
  !buildEvidenceIndexSrc.includes("timestamp: event.timestampLabel"),
);
checkTrue(
  "buildEvidenceIndex no longer copies event.phase in statNote",
  !buildEvidenceIndexSrc.includes("`${event.phase} · 중요도 ${event.importance}`"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
