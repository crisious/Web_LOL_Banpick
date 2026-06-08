// server.js phase context/summary timestamp policy regression tests

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

const buildPhaseContextSrc = extractFunctionSource(serverSrc, "buildPhaseContext");
const buildPhaseSummariesSrc = extractFunctionSource(serverSrc, "buildPhaseSummaries");

const { buildPhaseContext, buildPhaseSummaries } = new Function(
  [
    extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
    extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
    extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
    extractConstSource(serverSrc, "OBJECTIVE_WIN_EVENT_TYPES"),
    extractConstSource(serverSrc, "OBJECTIVE_FAIL_EVENT_TYPES"),
    extractConstSource(serverSrc, "MACRO_OBJECTIVE_WIN_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isPlayerKillEvent"),
    extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    extractFunctionSource(serverSrc, "isFightContributionEvent"),
    extractFunctionSource(serverSrc, "isObjectiveFailEvent"),
    extractFunctionSource(serverSrc, "isMacroObjectiveWinEvent"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    buildPhaseContextSrc,
    buildPhaseSummariesSrc,
    "return { buildPhaseContext, buildPhaseSummaries };",
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

function event(eventId, timestampMs, phase, eventType, importance = 5) {
  return {
    eventId,
    timestampMs,
    timestampLabel: "stale-label",
    phase,
    eventType,
    importance,
    summary: eventId,
  };
}

function compactBucket(bucket) {
  return {
    kills: bucket.kills,
    deaths: bucket.deaths,
    assists: bucket.assists,
    notableEventCount: bucket.notableEventCount,
  };
}

function phaseCounts(context) {
  return {
    early: compactBucket(context.early),
    mid: compactBucket(context.mid),
    late: compactBucket(context.late),
  };
}

function pickSummary(summaries, phase) {
  const item = summaries.find((summary) => summary.phase === phase);
  return { phase: item?.phase, rating: item?.rating, summary: item?.summary };
}

const timelineEvents = [
  event("evt_string_kill", "abc", "LATE", "CHAMPION_KILL", 5),
  event("evt_negative_death", -100, "LATE", "PLAYER_DEATH", 5),
  event("evt_mid_dragon", 960000, "EARLY", "DRAGON_FIGHT", 5),
  event("evt_mid_tower", 970000, "EARLY", "TOWER_TAKE", 5),
  event("evt_mid_assist", 1000000, "LATE", "TEAMFIGHT_FOLLOWUP", 4),
  event("evt_late_fail", 1900000, "EARLY", "OBJECTIVE_SETUP_FAIL", 4),
];

const phaseContext = buildPhaseContext(timelineEvents);
check("phaseContext buckets by normalized timestamp", phaseCounts(phaseContext), {
  early: { kills: 1, deaths: 1, assists: 0, notableEventCount: 2 },
  mid: { kills: 0, deaths: 0, assists: 1, notableEventCount: 3 },
  late: { kills: 0, deaths: 0, assists: 0, notableEventCount: 1 },
});

const summaries = buildPhaseSummaries({
  timelineEvents,
  phaseContext,
  matchInfo: { result: "LOSS" },
});

check("phase summaries count mid objectives by normalized phase", pickSummary(summaries, "MID"), {
  phase: "MID",
  rating: "GOOD",
  summary: "중반에는 오브젝트나 한타 후속 합류가 살아 있어 경기 핵심 구도를 주도했다.",
});
check("phase summaries keep late loss summary with normalized late fail", pickSummary(summaries, "LATE"), {
  phase: "LATE",
  rating: "NEUTRAL",
  summary: "후반에는 교전 영향력은 있었지만 마지막 수비 구도를 지키지 못했다.",
});
check("phase summaries keep three fixed phases", summaries.map((summary) => summary.phase), ["EARLY", "MID", "LATE"]);

checkTrue(
  "buildPhaseContext normalizes event timestamp",
  buildPhaseContextSrc.includes("const time = rawEventTimestampMs({ timestamp: event.timestampMs });"),
);
checkTrue(
  "buildPhaseContext derives phase from normalized time",
  buildPhaseContextSrc.includes("const phase = phaseFor(time);"),
);
checkTrue(
  "buildPhaseContext no longer buckets by event.phase",
  !buildPhaseContextSrc.includes("const bucket = phases[event.phase];"),
);
checkTrue(
  "buildPhaseSummaries derives phase groups from normalized time",
  buildPhaseSummariesSrc.includes("phaseFor(rawEventTimestampMs({ timestamp: event.timestampMs })) === phaseKey"),
);
checkTrue(
  "buildPhaseSummaries no longer filters by event.phase",
  !buildPhaseSummariesSrc.includes('event.phase === "EARLY"') &&
    !buildPhaseSummariesSrc.includes('event.phase === "MID"') &&
    !buildPhaseSummariesSrc.includes('event.phase === "LATE"'),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
