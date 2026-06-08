// server.js LLM payload timestamp policy regression tests

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
  const match = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

const constantsSrc = [
  extractConstSource(serverSrc, "TEAMFIGHT_MIN_EVENTS"),
  extractConstSource(serverSrc, "CLEANUP_GAP_MS"),
  extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
  extractConstSource(serverSrc, "PHASE_SUMMARIES_MIN"),
  extractConstSource(serverSrc, "EVIDENCE_INDEX_MIN"),
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MIN"),
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MAX"),
  extractConstSource(serverSrc, "INSIGHT_LIST_MIN"),
  extractConstSource(serverSrc, "INSIGHT_LIST_MAX"),
].join("\n");
const playerCombatPolicySrc = [
  extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
  extractConstSource(serverSrc, "PLAYER_COMBAT_EVENT_TYPES"),
  extractFunctionSource(serverSrc, "isPlayerKillEvent"),
  extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
  extractFunctionSource(serverSrc, "isPlayerCombatEvent"),
].join("\n");
const buildLlmPayloadSrc = extractFunctionSource(serverSrc, "buildLlmPayload");

const { buildLlmPayload } = new Function(
  [
    constantsSrc,
    playerCombatPolicySrc,
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    extractFunctionSource(serverSrc, "detectCombatEncounters"),
    extractFunctionSource(serverSrc, "buildTeamfightPhases"),
    buildLlmPayloadSrc,
    "return { buildLlmPayload };",
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
  return { timestampLabel: item?.timestampLabel, phase: item?.phase };
}

function baseFixture() {
  return {
    timelineEvents: [],
    phaseContext: {
      early: { kills: 1, deaths: 0, assists: 2, notableEventCount: 3 },
      mid: { kills: 2, deaths: 1, assists: 4, notableEventCount: 5 },
      late: { kills: 1, deaths: 1, assists: 2, notableEventCount: 2 },
    },
    playerContext: { riotId: "P#KR1", participantId: 5 },
    matchInfo: { matchId: "KR_X", queueLabel: "RANKED_SOLO" },
    playerStats: { kills: 4, deaths: 2, assists: 8 },
    teamContext: { teamTotalKills: 24 },
    derivedSignals: { hasEarlyLeadMoments: true },
  };
}

const fixture = baseFixture();
fixture.timelineEvents = [
  {
    eventId: "evt_valid",
    timestampMs: 120000,
    timestampLabel: "stale-label",
    phase: "LATE",
    eventType: "CHAMPION_KILL",
    importance: 5,
    summary: "valid timestamp kill",
    isPlayerInvolved: true,
    rawRef: "should-be-stripped",
  },
  {
    eventId: "evt_string",
    timestampMs: "abc",
    timestampLabel: "NaN:NaN",
    phase: "LATE",
    eventType: "PLAYER_DEATH",
    importance: 5,
    summary: "string timestamp death",
    isPlayerInvolved: true,
  },
  {
    eventId: "evt_negative",
    timestampMs: -100,
    timestampLabel: "-1:-1",
    phase: "LATE",
    eventType: "TEAMFIGHT_FOLLOWUP",
    importance: 5,
    summary: "negative timestamp assist",
    isPlayerInvolved: true,
  },
  {
    eventId: "evt_infinite",
    timestampMs: Infinity,
    timestampLabel: "Infinity:NaN",
    phase: "LATE",
    eventType: "TOWER_TAKE",
    importance: 5,
    summary: "infinite timestamp tower",
    isPlayerInvolved: true,
  },
  {
    eventId: "evt_low",
    timestampMs: 60000,
    timestampLabel: "1:00",
    phase: "EARLY",
    eventType: "SKIRMISH_WIN",
    importance: 2,
    summary: "low importance event",
    isPlayerInvolved: true,
  },
];

const payload = buildLlmPayload(fixture);
const byOrder = payload.timelineEvents.map((event) => event.eventId);
const byId = new Map(payload.timelineEvents.map((event) => [event.eventId, event]));

check("timeline events sort by normalized timestamp", byOrder, ["evt_string", "evt_negative", "evt_infinite", "evt_valid"]);
check("string LLM timestamp normalizes to display 0", timing(byId.get("evt_string")), {
  timestampLabel: "0:00",
  phase: "EARLY",
});
check("negative LLM timestamp normalizes to display 0", timing(byId.get("evt_negative")), {
  timestampLabel: "0:00",
  phase: "EARLY",
});
check("infinite LLM timestamp normalizes to display 0", timing(byId.get("evt_infinite")), {
  timestampLabel: "0:00",
  phase: "EARLY",
});
check("valid LLM timestamp derives fresh label and phase", timing(byId.get("evt_valid")), {
  timestampLabel: "2:00",
  phase: "EARLY",
});
check("low importance event stays excluded", byId.has("evt_low"), false);
check("LLM timeline event keys stay stable", Object.keys(byId.get("evt_valid")).sort(), [
  "eventId",
  "eventType",
  "importance",
  "isPlayerInvolved",
  "phase",
  "summary",
  "timestampLabel",
]);
checkTrue(
  "buildLlmPayload normalizes sort timestamp",
  buildLlmPayloadSrc.includes("rawEventTimestampMs({ timestamp: a.timestampMs })"),
);
checkTrue(
  "buildLlmPayload normalizes map timestamp",
  buildLlmPayloadSrc.includes("const time = rawEventTimestampMs({ timestamp: event.timestampMs });"),
);
checkTrue(
  "buildLlmPayload derives timestampLabel from normalized time",
  buildLlmPayloadSrc.includes("timestampLabel: timestampLabel(time),"),
);
checkTrue(
  "buildLlmPayload derives phase from normalized time",
  buildLlmPayloadSrc.includes("phase: phaseFor(time),"),
);
checkTrue(
  "buildLlmPayload no longer destructures stale timestamp fields",
  !buildLlmPayloadSrc.includes("map(({ eventId, timestampLabel, phase, eventType, importance, summary, isPlayerInvolved })"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
