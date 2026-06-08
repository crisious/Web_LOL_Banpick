// server.js raw assist-array helper regression tests

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
    : "function rawAssistingParticipantIds(rawEvent) { return Array.isArray(rawEvent.assistingParticipantIds) ? rawEvent.assistingParticipantIds : []; }",
  extractFunctionSource(serverSrc, "isRawPlayerInvolved"),
];

const buildEventTypeSrc = extractFunctionSource(serverSrc, "buildEventType");
const isRawPlayerInvolvedSrc = extractFunctionSource(serverSrc, "isRawPlayerInvolved");

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
function safeCall(fn) {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

const targetParticipantId = 2;
const normalAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [2, 3] };
const missingAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8 };
const malformedAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: "2,3" };

check("rawAssistingParticipantIds keeps arrays", rawAssistingParticipantIds(normalAssistEvent), [2, 3]);
check("rawAssistingParticipantIds maps missing assists to []", rawAssistingParticipantIds(missingAssistEvent), []);
check("rawAssistingParticipantIds maps malformed assists to []", rawAssistingParticipantIds(malformedAssistEvent), []);
check("isRawPlayerInvolved detects normalized assist arrays", isRawPlayerInvolved(normalAssistEvent, targetParticipantId), true);
check("isRawPlayerInvolved treats malformed assists as no involvement", isRawPlayerInvolved(malformedAssistEvent, targetParticipantId), false);
check("buildEventType missing assists does not throw", safeCall(() => buildEventType(missingAssistEvent, targetParticipantId, 100, false)), { ok: true, value: "SKIRMISH_WIN" });
check("buildEventType malformed assists does not throw", safeCall(() => buildEventType(malformedAssistEvent, targetParticipantId, 100, false)), { ok: true, value: "SKIRMISH_WIN" });

checkTrue(
  "server defines rawAssistingParticipantIds",
  serverSrc.includes("function rawAssistingParticipantIds(rawEvent)"),
);
checkTrue(
  "rawAssistingParticipantIds normalizes array items with rawParticipantId",
  serverSrc.includes("return Array.isArray(rawEvent.assistingParticipantIds)") &&
    serverSrc.includes(".map(rawParticipantId)") &&
    serverSrc.includes(".filter((participantId) => participantId !== null)") &&
    serverSrc.includes(": [];"),
);
checkTrue(
  "isRawPlayerInvolved uses rawAssistingParticipantIds",
  isRawPlayerInvolvedSrc.includes("const assistingParticipantIds = rawAssistingParticipantIds(rawEvent);"),
);
checkTrue(
  "isRawPlayerInvolved no longer owns Array.isArray guard",
  !isRawPlayerInvolvedSrc.includes("Array.isArray(rawEvent.assistingParticipantIds)"),
);
checkTrue(
  "buildEventType uses rawAssistingParticipantIds for assist count",
  buildEventTypeSrc.includes("rawAssistingParticipantIds(rawEvent).length > 1"),
);
checkTrue(
  "buildEventType no longer directly reads assistingParticipantIds.length",
  !buildEventTypeSrc.includes("rawEvent.assistingParticipantIds.length"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
