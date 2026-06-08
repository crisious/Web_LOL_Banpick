// server.js objective label monster subtype policy regression tests

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

function functionSourceOrFallback(source, name, fallback) {
  return source.includes(`function ${name}(`)
    ? extractFunctionSource(source, name)
    : fallback;
}

const objectiveMonsterSubTypeLabelSrc = functionSourceOrFallback(
  serverSrc,
  "objectiveMonsterSubTypeLabel",
  'function objectiveMonsterSubTypeLabel(event) { return event.monsterSubType ? ` (${event.monsterSubType.replace(/_/g, " ").toLowerCase()})` : ""; }',
);
const buildObjectiveLabelSrc = extractFunctionSource(serverSrc, "buildObjectiveLabel");
const buildObjectiveTimelineSrc = extractFunctionSource(serverSrc, "buildObjectiveTimeline");

const { objectiveMonsterSubTypeLabel, buildObjectiveLabel, buildObjectiveTimeline } = new Function(
  [
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    extractFunctionSource(serverSrc, "rawParticipantId"),
    extractFunctionSource(serverSrc, "isKnownRawTeamId"),
    extractFunctionSource(serverSrc, "buildStructureLabel"),
    objectiveMonsterSubTypeLabelSrc,
    buildObjectiveLabelSrc,
    extractFunctionSource(serverSrc, "objectiveKillerTeamId"),
    extractFunctionSource(serverSrc, "objectiveStructureTeam"),
    buildObjectiveTimelineSrc,
    "return { objectiveMonsterSubTypeLabel, buildObjectiveLabel, buildObjectiveTimeline };",
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

function labelResult(event) {
  try {
    return { value: buildObjectiveLabel(event), error: null };
  } catch (error) {
    return { value: null, error: error.name };
  }
}

function helperResult(event) {
  try {
    return { value: objectiveMonsterSubTypeLabel(event), error: null };
  } catch (error) {
    return { value: null, error: error.name };
  }
}

check("string monster subtype formats label suffix", labelResult({ monsterType: "DRAGON", monsterSubType: "FIRE_DRAGON" }), { value: "드래곤 (fire dragon)", error: null });
check("number monster subtype is ignored", labelResult({ monsterType: "DRAGON", monsterSubType: 42 }), { value: "드래곤", error: null });
check("array monster subtype is ignored", labelResult({ monsterType: "HORDE", monsterSubType: ["VOID"] }), { value: "공허 유충", error: null });
check("object monster subtype is ignored", labelResult({ monsterType: "BARON_NASHOR", monsterSubType: { name: "BARON" } }), { value: "바론", error: null });
check("whitespace monster subtype is ignored", labelResult({ monsterType: "RIFTHERALD", monsterSubType: "   " }), { value: "전령", error: null });
check("trimmed string monster subtype formats suffix", labelResult({ monsterType: "DRAGON", monsterSubType: "  HEXTECH_DRAGON  " }), { value: "드래곤 (hextech dragon)", error: null });
check("unknown monster type still passes through", labelResult({ monsterType: "UNKNOWN_MONSTER", monsterSubType: 7 }), { value: "UNKNOWN_MONSTER", error: null });

let timelineError = null;
let timelineLabels = [];
try {
  const events = buildObjectiveTimeline({
    info: {
      frames: [
        {
          events: [
            { type: "ELITE_MONSTER_KILL", timestamp: 1000, killerTeamId: 100, monsterType: "DRAGON", monsterSubType: 42 },
            { type: "ELITE_MONSTER_KILL", timestamp: 2000, killerTeamId: 100, monsterType: "DRAGON", monsterSubType: "CLOUD_DRAGON" },
          ],
        },
      ],
    },
  }, 100, new Map());
  timelineLabels = events.map((event) => event.label);
} catch (error) {
  timelineError = error.name;
}

check("timeline with malformed subtype does not throw", timelineError, null);
check("timeline ignores malformed subtype label", timelineLabels[0], "드래곤");
check("timeline keeps valid subtype label", timelineLabels[1], "드래곤 (cloud dragon)");

check("helper formats valid subtype", helperResult({ monsterSubType: "FIRE_DRAGON" }), { value: " (fire dragon)", error: null });
check("helper trims valid subtype", helperResult({ monsterSubType: "  CHEMTECH_DRAGON  " }), { value: " (chemtech dragon)", error: null });
check("helper ignores missing subtype", helperResult({}), { value: "", error: null });
check("helper ignores numeric subtype", helperResult({ monsterSubType: 42 }), { value: "", error: null });

checkTrue(
  "server defines objectiveMonsterSubTypeLabel",
  serverSrc.includes("function objectiveMonsterSubTypeLabel(event)"),
);
checkTrue(
  "objectiveMonsterSubTypeLabel guards subtype type",
  objectiveMonsterSubTypeLabelSrc.includes('typeof event.monsterSubType !== "string"'),
);
checkTrue(
  "objectiveMonsterSubTypeLabel trims subtype",
  objectiveMonsterSubTypeLabelSrc.includes(".trim()"),
);
checkTrue(
  "buildObjectiveLabel uses objectiveMonsterSubTypeLabel",
  buildObjectiveLabelSrc.includes("objectiveMonsterSubTypeLabel(event)"),
);
checkTrue(
  "buildObjectiveLabel no longer calls replace on raw monsterSubType",
  !buildObjectiveLabelSrc.includes("event.monsterSubType.replace"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
