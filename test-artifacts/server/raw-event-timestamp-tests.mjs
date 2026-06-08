// server.js raw event timestamp helper regression tests

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

const isKnownRawTeamIdSource = functionSourceOrFallback(
  serverSrc,
  "isKnownRawTeamId",
  "function isKnownRawTeamId(teamId) { return teamId === 100 || teamId === 200; }",
);

const rawObjectiveTeamSource = functionSourceOrFallback(
  serverSrc,
  "rawObjectiveTeamId",
  "function rawObjectiveTeamId(rawEvent) { const mappedTeamId = participantTeam(rawEvent.killerId); return isKnownRawTeamId(mappedTeamId) ? mappedTeamId : null; }",
);

const timelineTypePolicySources = [
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
  isKnownRawTeamIdSource,
  rawObjectiveTeamSource,
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

const rawTimestampSource = serverSrc.includes("function rawEventTimestampMs(event)")
  ? extractFunctionSource(serverSrc, "rawEventTimestampMs")
  : "function rawEventTimestampMs(event) { return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0; }";

const rawParticipantSource = serverSrc.includes("function rawParticipantId(value)")
  ? extractFunctionSource(serverSrc, "rawParticipantId")
  : "function rawParticipantId(value) { return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null; }";

const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const { rawEventTimestampMs, extractTimelineEvents } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "participantTeam"),
    extractFunctionSource(serverSrc, "phaseFor"),
    rawTimestampSource,
    rawParticipantSource,
    ...timelineTypePolicySources,
    ...eventTypePolicySources,
    extractFunctionSource(serverSrc, "laneHintForEvent"),
    extractFunctionSource(serverSrc, "importanceForEvent"),
    extractFunctionSource(serverSrc, "summaryForEvent"),
    extractFunctionSource(serverSrc, "buildEventType"),
    extractFunctionSource(serverSrc, "shouldKeepEvent"),
    extractFunctionSource(serverSrc, "dedupeEvents"),
    extractTimelineEventsSrc,
    "return { rawEventTimestampMs, extractTimelineEvents };",
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

check("rawEventTimestampMs keeps finite non-negative numbers", rawEventTimestampMs({ timestamp: 120000 }), 120000);
check("rawEventTimestampMs maps missing timestamp to 0", rawEventTimestampMs({}), 0);
check("rawEventTimestampMs maps string timestamp to 0", rawEventTimestampMs({ timestamp: "120000" }), 0);
check("rawEventTimestampMs maps negative timestamp to 0", rawEventTimestampMs({ timestamp: -1 }), 0);
check("rawEventTimestampMs maps Infinity to 0", rawEventTimestampMs({ timestamp: Infinity }), 0);
check("rawEventTimestampMs maps NaN to 0", rawEventTimestampMs({ timestamp: NaN }), 0);

const timeline = {
  info: {
    frames: [
      {
        events: [
          { type: "CHAMPION_KILL", timestamp: "abc", killerId: 2, victimId: 7 },
          { type: "CHAMPION_KILL", timestamp: -100, killerId: 2, victimId: 8 },
          { type: "CHAMPION_KILL", timestamp: Infinity, killerId: 2, victimId: 9 },
          { type: "CHAMPION_KILL", timestamp: 120000, killerId: 2, victimId: 10 },
        ],
      },
    ],
  },
};

const events = extractTimelineEvents({}, timeline, 2, 100);
check("extractTimelineEvents keeps four timestamp test events", events.length, 4);
check("string timestamp normalizes to output 0", {
  timestampMs: events[0].timestampMs,
  timestampLabel: events[0].timestampLabel,
  phase: events[0].phase,
}, { timestampMs: 0, timestampLabel: "0:00", phase: "EARLY" });
check("negative timestamp normalizes to output 0", {
  timestampMs: events[1].timestampMs,
  timestampLabel: events[1].timestampLabel,
  phase: events[1].phase,
}, { timestampMs: 0, timestampLabel: "0:00", phase: "EARLY" });
check("infinite timestamp normalizes to output 0", {
  timestampMs: events[2].timestampMs,
  timestampLabel: events[2].timestampLabel,
  phase: events[2].phase,
}, { timestampMs: 0, timestampLabel: "0:00", phase: "EARLY" });
check("valid timestamp is preserved", {
  timestampMs: events[3].timestampMs,
  timestampLabel: events[3].timestampLabel,
  phase: events[3].phase,
}, { timestampMs: 120000, timestampLabel: "2:00", phase: "EARLY" });

checkTrue(
  "server defines rawEventTimestampMs",
  serverSrc.includes("function rawEventTimestampMs(event)"),
);
checkTrue(
  "rawEventTimestampMs guards with Number.isFinite and non-negative check",
  serverSrc.includes("Number.isFinite(event.timestamp)") &&
    serverSrc.includes("event.timestamp >= 0"),
);
checkTrue(
  "extractTimelineEvents uses rawEventTimestampMs",
  extractTimelineEventsSrc.includes("timestamp: rawEventTimestampMs(event),"),
);
checkTrue(
  "extractTimelineEvents no longer uses timestamp fallback expression",
  !extractTimelineEventsSrc.includes("timestamp: event.timestamp || 0"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
