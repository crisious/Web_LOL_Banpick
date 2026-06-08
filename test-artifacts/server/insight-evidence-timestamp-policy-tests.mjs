// server.js strength/weakness evidence timestamp policy regression tests

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

function optionalFunctionSource(source, name, fallback) {
  return source.includes(`function ${name}(`) ? extractFunctionSource(source, name) : fallback;
}

const buildStrengthsSrc = extractFunctionSource(serverSrc, "buildStrengths");
const buildWeaknessesSrc = extractFunctionSource(serverSrc, "buildWeaknesses");
const timelineEventTimestampLabelSrc = optionalFunctionSource(
  serverSrc,
  "timelineEventTimestampLabel",
  "function timelineEventTimestampLabel(event) { return timestampLabel(rawEventTimestampMs({ timestamp: event.timestampMs })); }",
);

const { buildStrengths, buildWeaknesses } = new Function(
  [
    extractConstSource(serverSrc, "POST_OBJECTIVE_DEATH_WINDOW_MS"),
    extractConstSource(serverSrc, "CS_LOW_FARM_THRESHOLDS"),
    extractConstSource(serverSrc, "OBJECTIVE_WIN_EVENT_TYPES"),
    extractConstSource(serverSrc, "OBJECTIVE_FAIL_EVENT_TYPES"),
    extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
    extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
    extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
    extractConstSource(serverSrc, "INSIGHT_LIST_MIN"),
    extractConstSource(serverSrc, "INSIGHT_LIST_MAX"),
    extractConstSource(serverSrc, "VISION_STRENGTH_THRESHOLDS"),
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    timelineEventTimestampLabelSrc,
    extractFunctionSource(serverSrc, "isObjectiveWinEvent"),
    extractFunctionSource(serverSrc, "isObjectiveFailEvent"),
    extractFunctionSource(serverSrc, "isStructureTakeEvent"),
    extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    extractFunctionSource(serverSrc, "isFightContributionEvent"),
    extractFunctionSource(serverSrc, "filterPostObjectiveDeaths"),
    extractFunctionSource(serverSrc, "bestObjectiveSummary"),
    extractFunctionSource(serverSrc, "bestFightSummary"),
    extractFunctionSource(serverSrc, "lowFarmThreshold"),
    extractFunctionSource(serverSrc, "visionStrengthThreshold"),
    buildStrengthsSrc,
    buildWeaknessesSrc,
    "return { buildStrengths, buildWeaknesses };",
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

function event(eventId, eventType, timestampMs, timestampLabel, extra = {}) {
  return {
    eventId,
    eventType,
    timestampMs,
    timestampLabel,
    summary: eventId,
    laneHint: eventId,
    ...extra,
  };
}

const strengthsWithObjectives = buildStrengths({
  timelineEvents: [
    event("obj_bad", "DRAGON_FIGHT", "abc", "NaN:NaN"),
    event("obj_valid", "BARON_FIGHT", 120000, "stale-2m"),
    event("kill_bad", "CHAMPION_KILL", -100, "-1:-1", { summary: "kill" }),
    event("follow_valid", "TEAMFIGHT_FOLLOWUP", 120000, "stale-follow", { summary: "follow" }),
    event("skirmish_valid", "SKIRMISH_WIN", 180000, "stale-skirmish", { summary: "skirmish" }),
  ],
  matchInfo: { result: "LOSS", position: "ADC" },
  playerStats: { visionScore: 0, killParticipation: 0 },
});
check("strength objective evidence derives labels from normalized timestamp", strengthsWithObjectives[0].evidence, "0:00 DRAGON_FIGHT, 2:00 BARON_FIGHT");
check("strength fight evidence derives labels from normalized timestamp", strengthsWithObjectives[1].evidence, "0:00 kill 2:00 follow 3:00 skirmish");

const towerStrengths = buildStrengths({
  timelineEvents: [
    event("tw_bad", "TOWER_TAKE", "bad", "bad-label", { laneHint: "bot" }),
    event("tw_late", "TOWER_TAKE", 1900000, "stale-late", { laneHint: "mid" }),
  ],
  matchInfo: { result: "WIN", position: "TOP" },
  playerStats: { visionScore: 0, killParticipation: 0 },
});
check("strength tower evidence derives labels from normalized timestamp", towerStrengths[0].evidence, "0:00 bot, 31:40 mid");

const earlyWeaknesses = buildWeaknesses({
  timelineEvents: [
    event("death_bad", "PLAYER_DEATH", "abc", "NaN:NaN", { summary: "bad death" }),
    event("death_early", "PLAYER_DEATH", 50000, "stale-early", { summary: "early death" }),
  ],
  matchInfo: { result: "LOSS", position: "SUPPORT" },
  playerStats: { csPerMinute: 1, cs: 20, deaths: 2 },
});
check("weakness early evidence derives labels from normalized timestamp", earlyWeaknesses[0].evidence, "0:00 bad death 0:50 early death");

const postObjectiveWeaknesses = buildWeaknesses({
  timelineEvents: [
    event("objective", "DRAGON_FIGHT", 100000, "stale-objective", { summary: "dragon" }),
    event("post_death", "PLAYER_DEATH", 150000, "stale-post", { summary: "post death" }),
  ],
  matchInfo: { result: "WIN", position: "SUPPORT" },
  playerStats: { csPerMinute: 1, cs: 20, deaths: 1 },
});
check("weakness post-objective evidence derives labels from normalized timestamp", postObjectiveWeaknesses[0].evidence, "2:30 post death");

const fallbackWeaknesses = buildWeaknesses({
  timelineEvents: [
    event("fail_bad", "OBJECTIVE_SETUP_FAIL", "bad", "bad-fail", { summary: "failed setup" }),
    event("fail_late", "OBJECTIVE_SETUP_FAIL", 1900000, "stale-fail", { summary: "late fail" }),
  ],
  matchInfo: { result: "WIN", position: "SUPPORT" },
  playerStats: { csPerMinute: 1, cs: 20, deaths: 0 },
});
check("weakness fallback evidence derives labels from normalized timestamp", fallbackWeaknesses[0].evidence, "0:00 failed setup 31:40 late fail");

checkTrue(
  "server defines timelineEventTimestampLabel helper",
  serverSrc.includes("function timelineEventTimestampLabel(event)"),
);
checkTrue(
  "timelineEventTimestampLabel uses normalized event timestamp",
  serverSrc.includes("return timestampLabel(rawEventTimestampMs({ timestamp: event.timestampMs }));"),
);
checkTrue(
  "buildStrengths evidence uses timelineEventTimestampLabel",
  buildStrengthsSrc.includes("timelineEventTimestampLabel(event)"),
);
checkTrue(
  "buildWeaknesses evidence uses timelineEventTimestampLabel",
  buildWeaknessesSrc.includes("timelineEventTimestampLabel(event)"),
);
checkTrue(
  "buildStrengths no longer copies event.timestampLabel",
  !buildStrengthsSrc.includes("event.timestampLabel"),
);
checkTrue(
  "buildWeaknesses no longer copies event.timestampLabel",
  !buildWeaknessesSrc.includes("event.timestampLabel"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
