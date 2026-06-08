// server.js timeline consumer policy regression tests
//
// These tests pin the remaining KDA/phase-context consumers to the shared
// fight contribution policy while preserving their current count behavior.

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

const playerKillPolicySources = serverSrc.includes("const PLAYER_KILL_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isPlayerKillEvent"),
    ]
  : [
      'const PLAYER_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);',
      'function isPlayerKillEvent(event) { return PLAYER_KILL_EVENT_TYPES.has(event.eventType); }',
    ];

const playerDeathPolicySources = serverSrc.includes("const PLAYER_DEATH_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    ]
  : [
      'const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);',
      'function isPlayerDeathEvent(event) { return PLAYER_DEATH_EVENT_TYPES.has(event.eventType); }',
    ];

const rawTimestampSource = functionSourceOrFallback(
  serverSrc,
  "rawEventTimestampMs",
  "function rawEventTimestampMs(event) { return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0; }",
);

const buildPhaseContextSrc = extractFunctionSource(serverSrc, "buildPhaseContext");
const buildKdaTimelineSrc = extractFunctionSource(serverSrc, "buildKdaTimeline");

const { buildPhaseContext, buildKdaTimeline } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    rawTimestampSource,
    ...playerKillPolicySources,
    ...playerDeathPolicySources,
    extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isFightContributionEvent"),
    extractFunctionSource(serverSrc, "buildPhaseContext"),
    extractFunctionSource(serverSrc, "buildKdaTimeline"),
    "return { buildPhaseContext, buildKdaTimeline };",
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

const phaseContext = buildPhaseContext([
  { phase: "EARLY", eventType: "CHAMPION_KILL", importance: 5 },
  { phase: "EARLY", eventType: "TEAMFIGHT_FOLLOWUP", importance: 4 },
  { phase: "EARLY", eventType: "SKIRMISH_WIN", importance: 3 },
  { phase: "EARLY", eventType: "PLAYER_DEATH", importance: 5 },
  { phase: "MID", eventType: "TEAMFIGHT_FOLLOWUP", importance: 4 },
]);

check("phaseContext EARLY keeps kill/death/assist counts", {
  kills: phaseContext.early.kills,
  deaths: phaseContext.early.deaths,
  assists: phaseContext.early.assists,
  notableEventCount: phaseContext.early.notableEventCount,
}, { kills: 1, deaths: 1, assists: 2, notableEventCount: 3 });
check("phaseContext MID counts followup assist", phaseContext.mid.assists, 1);

const kdaTimeline = buildKdaTimeline({
  timelineEvents: [
    { eventType: "TEAMFIGHT_FOLLOWUP", isPlayerInvolved: true, timestampMs: 100000, timestampLabel: "1:40", phase: "EARLY", summary: "follow" },
    { eventType: "SKIRMISH_WIN", isPlayerInvolved: true, timestampMs: 200000, timestampLabel: "3:20", phase: "EARLY", summary: "skirmish" },
    { eventType: "CHAMPION_KILL", isPlayerInvolved: true, timestampMs: 300000, timestampLabel: "5:00", phase: "EARLY", summary: "kill" },
    { eventType: "PLAYER_DEATH", isPlayerInvolved: true, timestampMs: 400000, timestampLabel: "6:40", phase: "EARLY", summary: "death" },
    { eventType: "TOWER_TAKE", isPlayerInvolved: true, timestampMs: 500000, timestampLabel: "8:20", phase: "EARLY", summary: "tower" },
  ],
});
const finalKdaPoint = kdaTimeline[kdaTimeline.length - 1];

check("kdaTimeline ignores non-KDA tower event", kdaTimeline.length, 5);
check("kdaTimeline final counts", {
  kills: finalKdaPoint.kills,
  deaths: finalKdaPoint.deaths,
  assists: finalKdaPoint.assists,
  kda: finalKdaPoint.kda,
}, { kills: 1, deaths: 1, assists: 2, kda: 3 });
checkTrue(
  "server defines PLAYER_KILL_EVENT_TYPES",
  serverSrc.includes('const PLAYER_KILL_EVENT_TYPES = new Set(["CHAMPION_KILL"]);'),
);
checkTrue(
  "server defines isPlayerKillEvent",
  serverSrc.includes("function isPlayerKillEvent(event)"),
);
checkTrue(
  "buildPhaseContext uses isPlayerKillEvent for kills",
  buildPhaseContextSrc.includes("if (isPlayerKillEvent(event))"),
);
checkTrue(
  "buildPhaseContext uses isPlayerDeathEvent for deaths",
  buildPhaseContextSrc.includes("} else if (isPlayerDeathEvent(event))"),
);
checkTrue(
  "buildKdaTimeline uses isPlayerKillEvent for kills",
  buildKdaTimelineSrc.includes("} else if (isPlayerKillEvent(evt))"),
);
checkTrue(
  "buildKdaTimeline uses isPlayerDeathEvent for deaths",
  buildKdaTimelineSrc.includes("if (isPlayerDeathEvent(evt))"),
);
checkTrue(
  "buildPhaseContext uses isFightContributionEvent for assist-like events",
  buildPhaseContextSrc.includes("isFightContributionEvent(event)"),
);
checkTrue(
  "buildKdaTimeline uses isFightContributionEvent for assist-like events",
  buildKdaTimelineSrc.includes("isFightContributionEvent(evt)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
