// server.js phase context endMs timestamp policy regression tests

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

const { buildPhaseContext } = new Function(
  [
    extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
    extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
    extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isPlayerKillEvent"),
    extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    extractFunctionSource(serverSrc, "isFightContributionEvent"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    buildPhaseContextSrc,
    "return { buildPhaseContext };",
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

const mixedTimeline = buildPhaseContext([
  { eventType: "CHAMPION_KILL", timestampMs: 1900000, importance: 5 },
  { eventType: "PLAYER_DEATH", timestampMs: "bad", importance: 5 },
  { eventType: "TEAMFIGHT_FOLLOWUP", timestampMs: -100, importance: 4 },
]);

check("late endMs derives max normalized timestamp", mixedTimeline.late.endMs, 1900000);
check("malformed and negative events still bucket by normalized early time", {
  deaths: mixedTimeline.early.deaths,
  assists: mixedTimeline.early.assists,
  notableEventCount: mixedTimeline.early.notableEventCount,
}, { deaths: 1, assists: 1, notableEventCount: 2 });
check("valid late event keeps late counts", {
  kills: mixedTimeline.late.kills,
  notableEventCount: mixedTimeline.late.notableEventCount,
}, { kills: 1, notableEventCount: 1 });
check("empty late endMs keeps default boundary", buildPhaseContext([]).late.endMs, 1800001);

checkTrue(
  "buildPhaseContext derives timelineEndMs with reduce",
  buildPhaseContextSrc.includes("const timelineEndMs = events.reduce((maxTime, event) => {"),
);
checkTrue(
  "timelineEndMs normalizes each event timestamp",
  buildPhaseContextSrc.includes("const time = rawEventTimestampMs({ timestamp: event.timestampMs });"),
);
checkTrue(
  "timelineEndMs keeps max normalized event time",
  buildPhaseContextSrc.includes("return Math.max(maxTime, time);"),
);
checkTrue(
  "buildPhaseContext no longer trusts raw final event timestamp",
  !buildPhaseContextSrc.includes("events[events.length - 1].timestampMs"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
