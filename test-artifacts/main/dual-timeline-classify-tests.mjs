// Dual-timeline pure-function regression tests (characterization).
//
// Covers the dual-track timeline helpers in main.js:
//   - parseMsFromLabel  (M:SS → ms, plus its lenient fallback behavior)
//   - classifyTimelineEvent  (ALLY/ENEMY track assignment; DRAGON/BARON
//     objective-proximity matching against objectiveTimeline)
//   - computeMomentum  (5-minute ally/enemy bucket counts)
//
// Expected values were derived by reading main.js and confirmed against the
// real implementation — no behavior is stubbed or paraphrased.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

// ── source extraction (mirrors the harness convention used by sibling tests) ─
function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  // Skip the parameter list first so destructured params don't trip the body
  // brace counter.
  let parenDepth = 0;
  let i = source.indexOf("(", startIdx);
  for (; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    else if (source[i] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { i += 1; break; }
    }
  }
  const bodyStart = source.indexOf("{", i);
  let depth = 0;
  for (let j = bodyStart; j < source.length; j += 1) {
    if (source[j] === "{") depth += 1;
    else if (source[j] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, j + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

function extractSetSource(source, name) {
  const startIdx = source.indexOf(`const ${name} = new Set(`);
  if (startIdx < 0) throw new Error(`const ${name} not found`);
  const end = source.indexOf("]);", startIdx);
  if (end < 0) throw new Error(`const ${name} not closed`);
  return source.slice(startIdx, end + 3);
}

function extractConstObjectSource(source, name) {
  const pattern = new RegExp(`const ${name} = \\{[\\s\\S]*?\\};`);
  const match = source.match(pattern);
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

// classifyTimelineEvent depends on: parseMsFromLabel, the ALLY/ENEMY Sets, and
// the LANE_LABELS / EVENT_ICONS lookup objects. (`isPlayerInvolved` is a field
// on the event object, not a helper function.) computeMomentum is standalone.
const allyEventTypesSrc = extractSetSource(mainSrc, "ALLY_EVENT_TYPES");
const enemyEventTypesSrc = extractSetSource(mainSrc, "ENEMY_EVENT_TYPES");
const eventIconsSrc = extractConstObjectSource(mainSrc, "EVENT_ICONS");
const laneLabelsSrc = extractConstObjectSource(mainSrc, "LANE_LABELS");
const parseMsFromLabelSrc = extractFunctionSource(mainSrc, "parseMsFromLabel");
const classifyTimelineEventSrc = extractFunctionSource(mainSrc, "classifyTimelineEvent");
const computeMomentumSrc = extractFunctionSource(mainSrc, "computeMomentum");

const {
  parseMsFromLabel,
  classifyTimelineEvent,
  computeMomentum,
  ALLY_EVENT_TYPES,
  ENEMY_EVENT_TYPES,
} = new Function(
  `${allyEventTypesSrc}
${enemyEventTypesSrc}
${eventIconsSrc}
${laneLabelsSrc}
${parseMsFromLabelSrc}
${classifyTimelineEventSrc}
${computeMomentumSrc}
return { parseMsFromLabel, classifyTimelineEvent, computeMomentum, ALLY_EVENT_TYPES, ENEMY_EVENT_TYPES };`,
)();

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkTrue(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${condition || !detail ? "" : `  — ${detail}`}`);
  condition ? pass++ : fail++;
}

// ── 1) parseMsFromLabel: M:SS → ms ────────────────────────────────────────
check('parseMsFromLabel("0:00") === 0', parseMsFromLabel("0:00"), 0);
check('parseMsFromLabel("1:05") === 65000', parseMsFromLabel("1:05"), 65000);
check('parseMsFromLabel("15:00") === 900000', parseMsFromLabel("15:00"), 900000);
check('parseMsFromLabel("60:00") === 3600000', parseMsFromLabel("60:00"), 3600000);
check('parseMsFromLabel("75:30") === 4530000 (>60 min handled)', parseMsFromLabel("75:30"), 4530000);

// parseInt("1:60") parses the minutes part as 1 and seconds as 60 → 120000.
// (No 0-59 clamping; documents the raw arithmetic.)
check('parseMsFromLabel("1:60") === 120000 (no seconds clamp)', parseMsFromLabel("1:60"), 120000);

// 1:05 must round-trip from a known ms value formatted as M:SS.
const formatMs = (ms) => {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
};
for (const ms of [0, 65000, 900000, 3600000, 187000]) {
  check(`parseMsFromLabel(format(${ms})) round-trips`, parseMsFromLabel(formatMs(ms)), ms);
}

// Malformed labels do NOT throw — `parseInt(...) || 0` swallows NaN, returning
// 0 for empty/null/non-numeric input. Captured as the current behavior.
check('parseMsFromLabel("") === 0 (no throw)', parseMsFromLabel(""), 0);
check("parseMsFromLabel(null) === 0 (no throw)", parseMsFromLabel(null), 0);
check("parseMsFromLabel(undefined) === 0 (no throw)", parseMsFromLabel(undefined), 0);
check('parseMsFromLabel("abc") === 0 (NaN→0 fallback)', parseMsFromLabel("abc"), 0);
check('parseMsFromLabel("12:ab") === 720000 (bad seconds→0)', parseMsFromLabel("12:ab"), 720000);

// A colon-less label is treated as the minutes field only (seconds → 0).
check('parseMsFromLabel("5") === 300000 (colon-less = minutes)', parseMsFromLabel("5"), 300000);
check('parseMsFromLabel("12") === 720000 (colon-less = minutes)', parseMsFromLabel("12"), 720000);

// A third ":" segment is ignored — only parts[0]/parts[1] are read.
check('parseMsFromLabel("1:2:3") === 62000 (third segment ignored)', parseMsFromLabel("1:2:3"), 62000);

// parseInt tolerates surrounding whitespace per part.
check('parseMsFromLabel("  3:7 ") === 187000 (parseInt trims)', parseMsFromLabel("  3:7 "), 187000);

// ── 2) classifyTimelineEvent: track assignment ────────────────────────────
// Guard the assumed Set membership so the test fails loudly if main.js retypes
// these events rather than silently asserting the wrong track.
checkTrue("CHAMPION_KILL is an ALLY event type", ALLY_EVENT_TYPES.has("CHAMPION_KILL"));
checkTrue("TOWER_TAKE is an ALLY event type", ALLY_EVENT_TYPES.has("TOWER_TAKE"));
checkTrue("PLAYER_DEATH is an ENEMY event type", ENEMY_EVENT_TYPES.has("PLAYER_DEATH"));
checkTrue("SKIRMISH_LOSS is an ENEMY event type", ENEMY_EVENT_TYPES.has("SKIRMISH_LOSS"));

check(
  "CHAMPION_KILL → ALLY track + lane label + sword icon",
  classifyTimelineEvent({ eventType: "CHAMPION_KILL", laneHint: "MID_LANE" }, []),
  { track: "ALLY", laneZone: "미드", icon: "⚔️" },
);
check(
  "TOWER_TAKE → ALLY track + bot lane label + tower icon",
  classifyTimelineEvent({ eventType: "TOWER_TAKE", laneHint: "BOT_LANE" }, []),
  { track: "ALLY", laneZone: "봇", icon: "🏰" },
);
check(
  "PLAYER_DEATH → ENEMY track + top lane label + skull icon",
  classifyTimelineEvent({ eventType: "PLAYER_DEATH", laneHint: "TOP_LANE" }, []),
  { track: "ENEMY", laneZone: "탑", icon: "💀" },
);

// Unknown event types fall back to isPlayerInvolved; icon falls back to the
// generic star (no EVENT_ICONS entry for the type).
check(
  "unknown type + isPlayerInvolved → ALLY w/ star fallback icon",
  classifyTimelineEvent({ eventType: "WEIRD", isPlayerInvolved: true }, []),
  { track: "ALLY", laneZone: "", icon: "⭐" },
);
check(
  "unknown type, no player involvement → ENEMY w/ star fallback icon",
  classifyTimelineEvent({ eventType: "WEIRD", isPlayerInvolved: false }, []),
  { track: "ENEMY", laneZone: "", icon: "⭐" },
);

// ── DRAGON_FIGHT / BARON_FIGHT: objectiveTimeline proximity matching ──────
// Within 30000ms of an OBJECTIVE entry → that entry's team decides the track.
check(
  "DRAGON_FIGHT within 30s of ALLY objective → ALLY track",
  classifyTimelineEvent(
    { eventType: "DRAGON_FIGHT", timestampMs: 600000, laneHint: "DRAGON_RIVER" },
    [{ timeLabel: "10:05", type: "OBJECTIVE", team: "ALLY" }], // 605000ms, Δ5000 < 30000
  ),
  { track: "ALLY", laneZone: "봇", icon: "🐉" },
);
check(
  "DRAGON_FIGHT within 30s of ENEMY objective → ENEMY track",
  classifyTimelineEvent(
    { eventType: "DRAGON_FIGHT", timestampMs: 600000 },
    [{ timeLabel: "10:05", type: "OBJECTIVE", team: "ENEMY" }],
  ),
  { track: "ENEMY", laneZone: "", icon: "🐉" },
);
check(
  "BARON_FIGHT within 30s of ALLY objective → ALLY track + baron icon",
  classifyTimelineEvent(
    { eventType: "BARON_FIGHT", timestampMs: 1200000 },
    [{ timeLabel: "20:10", type: "OBJECTIVE", team: "ALLY" }], // 1210000ms, Δ10000 < 30000
  ),
  { track: "ALLY", laneZone: "", icon: "🐲" },
);

// A matched objective whose team is anything other than "ALLY" → ENEMY track.
check(
  "DRAGON_FIGHT matched objective with non-ALLY team → ENEMY track",
  classifyTimelineEvent(
    { eventType: "DRAGON_FIGHT", timestampMs: 600000 },
    [{ timeLabel: "10:00", type: "OBJECTIVE", team: "NEUTRAL" }],
  ),
  { track: "ENEMY", laneZone: "", icon: "🐉" },
);

// >30s away → no match → isPlayerInvolved fallback.
check(
  "DRAGON_FIGHT >30s from objective → isPlayerInvolved fallback (ALLY)",
  classifyTimelineEvent(
    { eventType: "DRAGON_FIGHT", timestampMs: 600000, isPlayerInvolved: true },
    [{ timeLabel: "11:00", type: "OBJECTIVE", team: "ALLY" }], // 660000ms, Δ60000 > 30000
  ),
  { track: "ALLY", laneZone: "", icon: "🐉" },
);

// Close in time but wrong entry type (not OBJECTIVE) → no match → fallback.
check(
  "DRAGON_FIGHT near a non-OBJECTIVE entry → isPlayerInvolved fallback (ENEMY)",
  classifyTimelineEvent(
    { eventType: "DRAGON_FIGHT", timestampMs: 600000, isPlayerInvolved: false },
    [{ timeLabel: "10:00", type: "STRUCTURE", team: "ALLY" }],
  ),
  { track: "ENEMY", laneZone: "", icon: "🐉" },
);

// Null/missing objectiveTimeline → (objectiveTimeline || []) → fallback path.
check(
  "DRAGON_FIGHT with null objectiveTimeline → isPlayerInvolved fallback (ALLY)",
  classifyTimelineEvent(
    { eventType: "DRAGON_FIGHT", timestampMs: 600000, isPlayerInvolved: true },
    null,
  ),
  { track: "ALLY", laneZone: "", icon: "🐉" },
);

// ── 3) computeMomentum: 5-minute ally/enemy buckets ───────────────────────
// Segment boundaries are [start, end): an event exactly at 300000 lands in the
// SECOND bucket, not the first.
check(
  "computeMomentum buckets events into [start,end) 5-min segments",
  computeMomentum(
    [
      { timestampMs: 0, track: "ALLY" },        // seg 0
      { timestampMs: 299999, track: "ENEMY" },  // seg 0
      { timestampMs: 300000, track: "ALLY" },   // boundary → seg 1
      { timestampMs: 600000, track: "ENEMY" },  // boundary → seg 2
    ],
    900000,
  ),
  [
    { start: 0, end: 300000, ally: 1, enemy: 1, total: 2 },
    { start: 300000, end: 600000, ally: 1, enemy: 0, total: 1 },
    { start: 600000, end: 900000, ally: 0, enemy: 1, total: 1 },
  ],
);

// Empty events → every segment is zeroed, segments still span totalMs.
check(
  "computeMomentum with no events yields all-zero segments",
  computeMomentum([], 900000),
  [
    { start: 0, end: 300000, ally: 0, enemy: 0, total: 0 },
    { start: 300000, end: 600000, ally: 0, enemy: 0, total: 0 },
    { start: 600000, end: 900000, ally: 0, enemy: 0, total: 0 },
  ],
);

// Non-divisible totalMs → final segment is clamped to totalMs.
check(
  "computeMomentum clamps the final partial segment to totalMs",
  computeMomentum([{ timestampMs: 650000, track: "ALLY" }], 700000),
  [
    { start: 0, end: 300000, ally: 0, enemy: 0, total: 0 },
    { start: 300000, end: 600000, ally: 0, enemy: 0, total: 0 },
    { start: 600000, end: 700000, ally: 1, enemy: 0, total: 1 },
  ],
);

// totalMs === 0 → the `start < totalMs` loop never runs → no segments.
check("computeMomentum with totalMs 0 yields no segments", computeMomentum([{ timestampMs: 0, track: "ALLY" }], 0), []);

// Events with neither ALLY nor ENEMY track are counted in neither tally but
// are NOT reflected in `total` (total = ally + enemy).
check(
  "computeMomentum ignores non-ALLY/ENEMY tracks in counts",
  computeMomentum(
    [
      { timestampMs: 10000, track: "ALLY" },
      { timestampMs: 20000, track: "NEUTRAL" },
      { timestampMs: 30000, track: "ENEMY" },
    ],
    300000,
  ),
  [{ start: 0, end: 300000, ally: 1, enemy: 1, total: 2 }],
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
