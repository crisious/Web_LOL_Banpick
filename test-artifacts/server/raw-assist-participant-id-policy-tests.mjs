// server.js raw assist participant-id policy regression tests

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

const rawParticipantSource = serverSrc.includes("function rawParticipantId(value)")
  ? extractFunctionSource(serverSrc, "rawParticipantId")
  : "function rawParticipantId(value) { return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null; }";

const rawEventPolicySources = [
  extractConstSource(serverSrc, "RAW_CHAMPION_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "RAW_ELITE_MONSTER_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "RAW_BUILDING_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "SUPPORTED_RAW_TIMELINE_EVENT_TYPES"),
  rawParticipantSource,
  extractFunctionSource(serverSrc, "isRawChampionKillEvent"),
  extractFunctionSource(serverSrc, "isRawEliteMonsterKillEvent"),
  extractFunctionSource(serverSrc, "isRawBuildingKillEvent"),
  extractFunctionSource(serverSrc, "isSupportedRawTimelineEvent"),
  serverSrc.includes("function rawAssistingParticipantIds(rawEvent)")
    ? extractFunctionSource(serverSrc, "rawAssistingParticipantIds")
    : "function rawAssistingParticipantIds(rawEvent) { return Array.isArray(rawEvent.assistingParticipantIds) ? rawEvent.assistingParticipantIds.map(rawParticipantId).filter((participantId) => participantId !== null) : []; }",
  extractFunctionSource(serverSrc, "isRawPlayerInvolved"),
  extractFunctionSource(serverSrc, "isKnownRawTeamId"),
  extractFunctionSource(serverSrc, "isRawEnemyBuildingKill"),
];

const rawAssistingParticipantIdsSrc = extractFunctionSource(serverSrc, "rawAssistingParticipantIds");
const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");

const { rawAssistingParticipantIds, isRawPlayerInvolved, buildEventType } = new Function(
  [
    ...rawEventPolicySources,
    buildEventTypeSrc,
    "return { rawAssistingParticipantIds, isRawPlayerInvolved, buildEventType };",
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

const targetParticipantId = 2;
const malformedAssistItemsEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: ["2", 11, 2.5, Infinity, 3] };
const mixedBoundaryAssistItemsEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [1, 10, 0, null, "5"] };
const malformedTargetAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: ["2"] };
const validTargetAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [2] };
const malformedMultiAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: ["2", 11, 2.5] };
const validMultiAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [2, 3] };

check("rawAssistingParticipantIds keeps valid assist ids", rawAssistingParticipantIds(validMultiAssistEvent), [2, 3]);
check("rawAssistingParticipantIds maps missing assists to []", rawAssistingParticipantIds({ type: "CHAMPION_KILL", killerId: 7, victimId: 8 }), []);
check("rawAssistingParticipantIds maps non-array assists to []", rawAssistingParticipantIds({ type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: "2,3" }), []);
check("rawAssistingParticipantIds drops malformed array items", rawAssistingParticipantIds(malformedAssistItemsEvent), [3]);
check("rawAssistingParticipantIds keeps only participant id boundaries", rawAssistingParticipantIds(mixedBoundaryAssistItemsEvent), [1, 10]);
check("isRawPlayerInvolved ignores malformed assist target strings", isRawPlayerInvolved(malformedTargetAssistEvent, targetParticipantId), false);
check("isRawPlayerInvolved keeps valid assist target numbers", isRawPlayerInvolved(validTargetAssistEvent, targetParticipantId), true);
check("buildEventType ignores malformed assist ids when counting follow-up fights", buildEventType(malformedMultiAssistEvent, targetParticipantId, 100, false), "SKIRMISH_WIN");
check("buildEventType keeps valid multi-assist follow-up classification", buildEventType(validMultiAssistEvent, targetParticipantId, 100, false), "TEAMFIGHT_FOLLOWUP");
checkTrue(
  "rawAssistingParticipantIds uses rawParticipantId mapping",
  rawAssistingParticipantIdsSrc.includes(".map(rawParticipantId)"),
);
checkTrue(
  "rawAssistingParticipantIds filters invalid participant ids",
  rawAssistingParticipantIdsSrc.includes(".filter((participantId) => participantId !== null)"),
);
checkTrue(
  "rawAssistingParticipantIds no longer returns the raw assist array directly",
  !rawAssistingParticipantIdsSrc.includes("? rawEvent.assistingParticipantIds\n    : [];"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
