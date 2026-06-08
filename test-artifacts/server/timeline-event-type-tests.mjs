// server.js timeline eventType helper policy regression tests

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

const eventTypePolicySources = [
  extractConstSource(serverSrc, "ELITE_OBJECTIVE_FIGHT_EVENT_TYPES"),
  extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
  extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
  extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
  serverSrc.includes("function isEliteObjectiveFightEventType(eventType)")
    ? extractFunctionSource(serverSrc, "isEliteObjectiveFightEventType")
    : "function isEliteObjectiveFightEventType(eventType) { return ELITE_OBJECTIVE_FIGHT_EVENT_TYPES.has(eventType); }",
  serverSrc.includes("function isStructureTakeEventType(eventType)")
    ? extractFunctionSource(serverSrc, "isStructureTakeEventType")
    : "function isStructureTakeEventType(eventType) { return STRUCTURE_TAKE_EVENT_TYPES.has(eventType); }",
  serverSrc.includes("function isPlayerKillEventType(eventType)")
    ? extractFunctionSource(serverSrc, "isPlayerKillEventType")
    : "function isPlayerKillEventType(eventType) { return PLAYER_KILL_EVENT_TYPES.has(eventType); }",
  serverSrc.includes("function isPlayerDeathEventType(eventType)")
    ? extractFunctionSource(serverSrc, "isPlayerDeathEventType")
    : "function isPlayerDeathEventType(eventType) { return PLAYER_DEATH_EVENT_TYPES.has(eventType); }",
  serverSrc.includes("function isFightContributionEventType(eventType)")
    ? extractFunctionSource(serverSrc, "isFightContributionEventType")
    : "function isFightContributionEventType(eventType) { return FIGHT_CONTRIBUTION_EVENT_TYPES.has(eventType); }",
];

const importanceForEventSrc = extractFunctionSource(serverSrc, "importanceForEvent");
const summaryForEventSrc = extractFunctionSource(serverSrc, "summaryForEvent");

const { importanceForEvent, summaryForEvent } = new Function(
  [
    ...eventTypePolicySources,
    importanceForEventSrc,
    summaryForEventSrc,
    "return { importanceForEvent, summaryForEvent };",
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

check("importance early death", importanceForEvent("PLAYER_DEATH", "EARLY", {}), 4);
check("importance late death", importanceForEvent("PLAYER_DEATH", "LATE", {}), 5);
check("importance inhibitor tower", importanceForEvent("TOWER_TAKE", "MID", { buildingType: "INHIBITOR_BUILDING" }), 5);
check("importance early tower", importanceForEvent("TOWER_TAKE", "EARLY", {}), 3);
check("importance champion kill", importanceForEvent("CHAMPION_KILL", "MID", {}), 4);
check("importance early dragon", importanceForEvent("DRAGON_FIGHT", "EARLY", {}), 4);
check("importance late baron", importanceForEvent("BARON_FIGHT", "LATE", {}), 5);
check("summary death early", summaryForEvent("PLAYER_DEATH", "EARLY", {}, false), "초반 교전에서 먼저 끊기며 템포가 흔들렸다.");
check("summary champion kill", summaryForEvent("CHAMPION_KILL", "MID", {}, false), "교전에서 직접 킬을 만들며 흐름을 당겨 왔다.");
check("summary followup", summaryForEvent("TEAMFIGHT_FOLLOWUP", "MID", {}, false), "교전 후속 합류로 킬 관여를 만들었다.");
check("summary skirmish", summaryForEvent("SKIRMISH_WIN", "MID", {}, false), "교전 후속 합류로 킬 관여를 만들었다.");
check("summary tower", summaryForEvent("TOWER_TAKE", "MID", {}, false), "구조물 압박에 관여하며 승리 조건을 구조물로 전환했다.");

checkTrue(
  "server defines isPlayerDeathEventType",
  serverSrc.includes("function isPlayerDeathEventType(eventType)"),
);
checkTrue(
  "server defines isPlayerKillEventType",
  serverSrc.includes("function isPlayerKillEventType(eventType)"),
);
checkTrue(
  "server defines isStructureTakeEventType",
  serverSrc.includes("function isStructureTakeEventType(eventType)"),
);
checkTrue(
  "server defines isFightContributionEventType",
  serverSrc.includes("function isFightContributionEventType(eventType)"),
);
checkTrue(
  "server defines isEliteObjectiveFightEventType",
  serverSrc.includes("function isEliteObjectiveFightEventType(eventType)"),
);
checkTrue(
  "importanceForEvent uses isPlayerDeathEventType",
  importanceForEventSrc.includes("isPlayerDeathEventType(eventType)"),
);
checkTrue(
  "importanceForEvent uses isPlayerKillEventType",
  importanceForEventSrc.includes("isPlayerKillEventType(eventType)"),
);
checkTrue(
  "importanceForEvent uses isStructureTakeEventType",
  importanceForEventSrc.includes("isStructureTakeEventType(eventType)"),
);
checkTrue(
  "importanceForEvent uses isEliteObjectiveFightEventType",
  importanceForEventSrc.includes("isEliteObjectiveFightEventType(eventType)"),
);
checkTrue(
  "summaryForEvent uses isPlayerDeathEventType",
  summaryForEventSrc.includes("isPlayerDeathEventType(eventType)"),
);
checkTrue(
  "summaryForEvent uses isPlayerKillEventType",
  summaryForEventSrc.includes("isPlayerKillEventType(eventType)"),
);
checkTrue(
  "summaryForEvent uses isFightContributionEventType",
  summaryForEventSrc.includes("isFightContributionEventType(eventType)"),
);
checkTrue(
  "summaryForEvent uses isStructureTakeEventType",
  summaryForEventSrc.includes("isStructureTakeEventType(eventType)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
