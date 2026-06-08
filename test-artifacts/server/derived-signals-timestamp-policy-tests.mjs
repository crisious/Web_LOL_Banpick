// server.js derived signals / weakness timestamp policy regression tests

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

const filterPostObjectiveDeathsSrc = extractFunctionSource(serverSrc, "filterPostObjectiveDeaths");
const buildDerivedSignalsSrc = extractFunctionSource(serverSrc, "buildDerivedSignals");
const buildWeaknessesSrc = extractFunctionSource(serverSrc, "buildWeaknesses");

const { filterPostObjectiveDeaths, buildDerivedSignals, buildWeaknesses } = new Function(
  [
    extractConstSource(serverSrc, "POST_OBJECTIVE_DEATH_WINDOW_MS"),
    extractConstSource(serverSrc, "CS_LOW_FARM_THRESHOLDS"),
    extractConstSource(serverSrc, "OBJECTIVE_WIN_EVENT_TYPES"),
    extractConstSource(serverSrc, "OBJECTIVE_FAIL_EVENT_TYPES"),
    extractConstSource(serverSrc, "MACRO_OBJECTIVE_WIN_EVENT_TYPES"),
    extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
    extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
    extractConstSource(serverSrc, "INSIGHT_LIST_MIN"),
    extractConstSource(serverSrc, "INSIGHT_LIST_MAX"),
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    extractFunctionSource(serverSrc, "timelineEventTimestampLabel"),
    extractFunctionSource(serverSrc, "isObjectiveWinEvent"),
    extractFunctionSource(serverSrc, "isObjectiveFailEvent"),
    extractFunctionSource(serverSrc, "isMacroObjectiveWinEvent"),
    extractFunctionSource(serverSrc, "isStructureTakeEvent"),
    extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    extractFunctionSource(serverSrc, "lowFarmThreshold"),
    filterPostObjectiveDeathsSrc,
    buildDerivedSignalsSrc,
    buildWeaknessesSrc,
    "return { filterPostObjectiveDeaths, buildDerivedSignals, buildWeaknesses };",
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

function event(eventId, timestampMs, phase, eventType, summary = eventId) {
  return {
    eventId,
    timestampMs,
    timestampLabel: "stale-label",
    phase,
    eventType,
    summary,
  };
}

function compactDerivedSignals(signals) {
  return {
    hasEarlyLeadMoments: signals.hasEarlyLeadMoments,
    hasMidGameThrowRisk: signals.hasMidGameThrowRisk,
    candidateThemes: signals.candidateThemes,
  };
}

function compactWeakness(weakness) {
  return {
    title: weakness?.title,
    relatedEventIds: weakness?.relatedEventIds,
  };
}

const normalized = {
  timelineEvents: [
    event("d_bad", "abc", "LATE", "PLAYER_DEATH", "bad timestamp death"),
    event("d_negative", -100, "LATE", "PLAYER_DEATH", "negative timestamp death"),
    event("d_mid_1", 960000, "EARLY", "PLAYER_DEATH", "mid death 1"),
    event("d_mid_2", 970000, "LATE", "PLAYER_DEATH", "mid death 2"),
    event("obj_early", "abc", "LATE", "DRAGON_FIGHT", "early objective win"),
    event("late_tower", 1900000, "MID", "TOWER_TAKE", "late tower"),
  ],
  matchInfo: { result: "WIN", position: "SUPPORT" },
  playerStats: { csPerMinute: 1, cs: 20, deaths: 2 },
};

const derived = buildDerivedSignals(normalized);
check("derived signals derive early/mid/late gates from normalized timestamp", compactDerivedSignals(derived), {
  hasEarlyLeadMoments: true,
  hasMidGameThrowRisk: true,
  candidateThemes: ["weak_early_stability", "late_structure_closeout"],
});

const weaknesses = buildWeaknesses(normalized);
check("weaknesses derive early death weakness from normalized timestamp", compactWeakness(weaknesses[0]), {
  title: "초반 안정감이 낮았음",
  relatedEventIds: ["d_bad", "d_negative"],
});

const malformedObjectives = [event("bad_obj", -200000, "EARLY", "DRAGON_FIGHT")];
const malformedDeaths = [event("bad_death", -100000, "EARLY", "PLAYER_DEATH")];
check("post objective death window normalizes malformed timestamps", filterPostObjectiveDeaths(malformedDeaths, malformedObjectives), []);

checkTrue(
  "buildDerivedSignals normalizes event phase",
  buildDerivedSignalsSrc.includes("const eventPhase = (event) => phaseFor(rawEventTimestampMs({ timestamp: event.timestampMs }));"),
);
checkTrue(
  "buildDerivedSignals no longer filters by event.phase",
  !buildDerivedSignalsSrc.includes('event.phase === "EARLY"') &&
    !buildDerivedSignalsSrc.includes('event.phase === "MID"') &&
    !buildDerivedSignalsSrc.includes('event.phase === "LATE"'),
);
checkTrue(
  "buildWeaknesses normalizes event phase",
  buildWeaknessesSrc.includes("const eventPhase = (event) => phaseFor(rawEventTimestampMs({ timestamp: event.timestampMs }));"),
);
checkTrue(
  "buildWeaknesses no longer filters early deaths by event.phase",
  !buildWeaknessesSrc.includes('deaths.filter((event) => event.phase === "EARLY")'),
);
checkTrue(
  "filterPostObjectiveDeaths normalizes objective/death timestamps",
  filterPostObjectiveDeathsSrc.includes("const deathTime = rawEventTimestampMs({ timestamp: deathEvent.timestampMs });") &&
    filterPostObjectiveDeathsSrc.includes("const objectiveTime = rawEventTimestampMs({ timestamp: objectiveEvent.timestampMs });"),
);
checkTrue(
  "filterPostObjectiveDeaths no longer compares raw timestampMs fields",
  !filterPostObjectiveDeathsSrc.includes("objectiveEvent.timestampMs < deathEvent.timestampMs"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
