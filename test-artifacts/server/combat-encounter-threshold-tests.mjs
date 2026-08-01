// Phase 32 follow-up — real-module contract for encounter window/cap behavior.

let detectorModule = null;
let importFailure = null;
try {
  detectorModule = await import(new URL("../../lib/combat-encounters.js", import.meta.url));
} catch (error) {
  importFailure = error;
}

let measurementModule = null;
let measurementImportFailure = null;
try {
  measurementModule = await import(new URL("../../scripts/measure-combat-encounters.mjs", import.meta.url));
} catch (error) {
  measurementImportFailure = error;
}

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  }
  ok ? pass++ : fail++;
}

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

function combatEvent(eventId, timestampMs, eventType = "CHAMPION_KILL") {
  return {
    eventId,
    timestampMs,
    eventType,
    isPlayerInvolved: true,
  };
}

const detectCombatEncounters = detectorModule?.detectCombatEncounters;
checkTrue(
  `actual combat encounter module imports${importFailure ? ` (${importFailure.code || importFailure.message})` : ""}`,
  typeof detectCombatEncounters === "function",
);

if (typeof detectCombatEncounters === "function") {
  const boundary = detectCombatEncounters([
    combatEvent("at_start", 0),
    combatEvent("at_25s", 25_000, "PLAYER_DEATH"),
    combatEvent("after_25s", 50_001),
  ]);
  check("25,000ms stays in the current encounter", boundary[0]?.relatedEventIds, ["at_start", "at_25s"]);
  check("25,001ms starts a new encounter", boundary.map((row) => row.relatedEventIds), [
    ["at_start", "at_25s"],
    ["after_25s"],
  ]);

  const separated = Array.from({ length: 25 }, (_, index) =>
    combatEvent(`event_${String(index + 1).padStart(2, "0")}`, index * 60_000),
  );
  const capped = detectCombatEncounters(separated);
  check("default detector retains 24 separated encounters", capped.length, 24);
  check("default detector keeps the chronological 24th encounter", capped.at(-1)?.relatedEventIds, ["event_24"]);

  const uncapped = detectCombatEncounters(separated, { maxEncounters: Number.POSITIVE_INFINITY });
  check("measurement override can inspect every encounter candidate", uncapped.length, 25);

  const widened = detectCombatEncounters([
    combatEvent("first", 0),
    combatEvent("gap_26s", 26_000),
  ], { windowMs: 30_000 });
  check("measurement override can evaluate a 30s window", widened.map((row) => row.relatedEventIds), [["first", "gap_26s"]]);
} else {
  for (const label of [
    "25,000ms stays in the current encounter",
    "25,001ms starts a new encounter",
    "default detector retains 24 separated encounters",
    "default detector keeps the chronological 24th encounter",
    "measurement override can inspect every encounter candidate",
    "measurement override can evaluate a 30s window",
  ]) {
    checkTrue(label, false);
  }
}

const measureCombatEncounterCohort = measurementModule?.measureCombatEncounterCohort;
checkTrue(
  `actual measurement module imports${measurementImportFailure ? ` (${measurementImportFailure.code || measurementImportFailure.message})` : ""}`,
  typeof measureCombatEncounterCohort === "function",
);

if (typeof measureCombatEncounterCohort === "function") {
  const report = measureCombatEncounterCohort([
    {
      sourcePath: "cohort/match-a/normalized-match.json",
      normalizedMatch: {
        matchInfo: { matchId: "MATCH_A", durationSeconds: 120 },
        timelineEvents: [
          combatEvent("a_1", 0),
          combatEvent("a_2", 26_000),
        ],
      },
    },
    {
      sourcePath: "cohort/match-b/normalized-match.json",
      normalizedMatch: {
        matchInfo: { matchId: "MATCH_B", durationSeconds: 2_000 },
        timelineEvents: [
          combatEvent("b_1", 0),
          combatEvent("b_2", 60_000),
          combatEvent("b_3", 1_900_000, "PLAYER_DEATH"),
        ],
      },
    },
  ], { windowMs: 25_000, maxEncounters: 2 });

  check("measurement reports sample and encounter count range", {
    sampleCount: report.sampleCount,
    min: report.encountersPerMatch.min,
    max: report.encountersPerMatch.max,
  }, { sampleCount: 2, min: 2, max: 3 });
  check("measurement reports the uncapped count distribution", report.encountersPerMatch.distribution, { 2: 1, 3: 1 });
  check("measurement reports a 25-30s boundary pair", report.gaps.boundary25To30Seconds.map((row) => ({
    matchId: row.matchId,
    gapMs: row.gapMs,
  })), [{ matchId: "MATCH_A", gapMs: 26_000 }]);
  check("measurement identifies the capped late encounter", {
    cappedMatches: report.truncation.matchCount,
    truncatedEncounters: report.truncation.encounterCount,
    lateEncounters: report.truncation.byPhase.LATE,
  }, { cappedMatches: 1, truncatedEncounters: 1, lateEncounters: 1 });
} else {
  for (const label of [
    "measurement reports sample and encounter count range",
    "measurement reports the uncapped count distribution",
    "measurement reports a 25-30s boundary pair",
    "measurement identifies the capped late encounter",
  ]) {
    checkTrue(label, false);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
