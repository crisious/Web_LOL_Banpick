// server.js raw player involvement helper regression tests

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
  serverSrc.includes("function isRawPlayerInvolved(rawEvent, targetParticipantId)")
    ? extractFunctionSource(serverSrc, "isRawPlayerInvolved")
    : "function isRawPlayerInvolved(rawEvent, targetParticipantId) { const assistingParticipantIds = rawAssistingParticipantIds(rawEvent); return rawEvent.killerId === targetParticipantId || rawEvent.victimId === targetParticipantId || assistingParticipantIds.includes(targetParticipantId); }",
  serverSrc.includes("function isKnownRawTeamId(teamId)")
    ? extractFunctionSource(serverSrc, "isKnownRawTeamId")
    : "function isKnownRawTeamId(teamId) { return teamId === 100 || teamId === 200; }",
  serverSrc.includes("function isRawEnemyBuildingKill(rawEvent, targetTeamId)")
    ? extractFunctionSource(serverSrc, "isRawEnemyBuildingKill")
    : "function isRawEnemyBuildingKill(rawEvent, targetTeamId) { return isKnownRawTeamId(rawEvent.teamId) && rawEvent.teamId !== targetTeamId; }",
];

const shouldKeepEventSrc = extractFunctionSource(serverSrc, "shouldKeepEvent");
const extractTimelineEventsSrc = extractFunctionSource(serverSrc, "extractTimelineEvents");

const { isRawPlayerInvolved, shouldKeepEvent } = new Function(
  [
    ...rawEventPolicySources,
    shouldKeepEventSrc,
    "return { isRawPlayerInvolved, shouldKeepEvent };",
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
const targetTeamId = 100;
const killerEvent = { type: "CHAMPION_KILL", killerId: 2, victimId: 7, assistingParticipantIds: [] };
const victimEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 2, assistingParticipantIds: [] };
const assistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8, assistingParticipantIds: [2, 3] };
const missingAssistEvent = { type: "CHAMPION_KILL", killerId: 7, victimId: 8 };
const enemyTowerWithoutAssists = { type: "BUILDING_KILL", killerId: 7, victimId: null, teamId: 200 };

check("helper detects killer involvement", isRawPlayerInvolved(killerEvent, targetParticipantId), true);
check("helper detects victim involvement", isRawPlayerInvolved(victimEvent, targetParticipantId), true);
check("helper detects assist involvement", isRawPlayerInvolved(assistEvent, targetParticipantId), true);
check("helper treats missing assists as no involvement", isRawPlayerInvolved(missingAssistEvent, targetParticipantId), false);
check("shouldKeep champion kill with missing assists does not throw", safeCall(() => shouldKeepEvent(missingAssistEvent, targetParticipantId, targetTeamId)), { ok: true, value: false });
check("shouldKeep enemy tower with missing assists does not throw", safeCall(() => shouldKeepEvent(enemyTowerWithoutAssists, targetParticipantId, targetTeamId)), { ok: true, value: true });

checkTrue(
  "server defines isRawPlayerInvolved",
  serverSrc.includes("function isRawPlayerInvolved(rawEvent, targetParticipantId)"),
);
checkTrue(
  "isRawPlayerInvolved uses rawAssistingParticipantIds",
  serverSrc.includes("function rawAssistingParticipantIds(rawEvent)") &&
    serverSrc.includes("const assistingParticipantIds = rawAssistingParticipantIds(rawEvent);") &&
    serverSrc.includes("assistingParticipantIds.includes(targetParticipantId)"),
);
checkTrue(
  "shouldKeepEvent uses isRawPlayerInvolved",
  shouldKeepEventSrc.includes("const playerInvolved = isRawPlayerInvolved(rawEvent, targetParticipantId);"),
);
checkTrue(
  "shouldKeepEvent no longer inlines killer involvement",
  !shouldKeepEventSrc.includes("rawEvent.killerId === targetParticipantId"),
);
checkTrue(
  "extractTimelineEvents uses isRawPlayerInvolved for isPlayerInvolved",
  extractTimelineEventsSrc.includes("isPlayerInvolved: isRawPlayerInvolved(rawEvent, targetParticipantId),"),
);
checkTrue(
  "extractTimelineEvents no longer inlines killer involvement in the output object",
  !extractTimelineEventsSrc.includes("isPlayerInvolved:\n          rawEvent.killerId === targetParticipantId"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
