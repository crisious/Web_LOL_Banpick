#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import combatEncounterModule from "../lib/combat-encounters.js";

const {
  COMBAT_ENCOUNTER_MAX,
  COMBAT_ENCOUNTER_WINDOW_MS,
  detectCombatEncounters,
} = combatEncounterModule;

const BOUNDARY_LOWER_EXCLUSIVE_MS = 25_000;
const BOUNDARY_UPPER_INCLUSIVE_MS = 30_000;
const TEAMFIGHT_MIN_EVENTS = 3;
const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.dirname(path.dirname(scriptPath));

function eventTimestampMs(event) {
  const timestampMs = event?.timestampMs;
  return Number.isFinite(timestampMs) && timestampMs >= 0 ? timestampMs : 0;
}

function findNormalizedMatchFiles(rootDir) {
  const files = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && entry.name === "normalized-match.json") files.push(entryPath);
    }
  }
  visit(rootDir);
  return files.sort();
}

function loadNormalizedMatches(rootDir) {
  return findNormalizedMatchFiles(rootDir).map((sourcePath) => ({
    sourcePath,
    normalizedMatch: JSON.parse(fs.readFileSync(sourcePath, "utf8")),
  }));
}

function percentile(sortedValues, fraction) {
  if (sortedValues.length === 0) return null;
  const index = Math.max(0, Math.ceil(sortedValues.length * fraction) - 1);
  return sortedValues[index];
}

function timedEncounters(encounters, timelineEvents) {
  const timestampsById = new Map();
  for (const event of timelineEvents) {
    const list = timestampsById.get(event?.eventId) || [];
    list.push(eventTimestampMs(event));
    timestampsById.set(event?.eventId, list);
  }

  return encounters.map((encounter) => {
    const timestamps = encounter.relatedEventIds
      .flatMap((eventId) => timestampsById.get(eventId) || [])
      .sort((a, b) => a - b);
    return {
      ...encounter,
      startMs: timestamps[0] ?? 0,
      endMs: timestamps.at(-1) ?? 0,
    };
  });
}

function gapBucket(gapMs) {
  if (gapMs <= 25_000) return "<=25000";
  if (gapMs <= 30_000) return "25001-30000";
  if (gapMs <= 45_000) return "30001-45000";
  if (gapMs <= 60_000) return "45001-60000";
  if (gapMs <= 120_000) return "60001-120000";
  return ">120000";
}

function measureCombatEncounterCohort(records, options = {}) {
  const windowMs = options.windowMs ?? COMBAT_ENCOUNTER_WINDOW_MS;
  const maxEncounters = options.maxEncounters ?? COMBAT_ENCOUNTER_MAX;
  const matches = [];
  const gaps = [];

  for (const record of records) {
    const normalizedMatch = record.normalizedMatch;
    const timelineEvents = normalizedMatch.timelineEvents;
    const matchId = normalizedMatch.matchInfo?.matchId || path.basename(path.dirname(record.sourcePath));
    const uncapped = timedEncounters(
      detectCombatEncounters(timelineEvents, {
        windowMs,
        maxEncounters: Number.POSITIVE_INFINITY,
      }),
      timelineEvents,
    );
    const retained = detectCombatEncounters(timelineEvents, { windowMs, maxEncounters });
    const truncated = uncapped.slice(retained.length);

    for (let index = 1; index < uncapped.length; index += 1) {
      const previous = uncapped[index - 1];
      const current = uncapped[index];
      gaps.push({
        matchId,
        fromEncounterId: previous.encounterId,
        toEncounterId: current.encounterId,
        fromEndLabel: previous.endLabel,
        toStartLabel: current.startLabel,
        fromEndMs: previous.endMs,
        toStartMs: current.startMs,
        gapMs: current.startMs - previous.endMs,
      });
    }

    matches.push({
      matchId,
      sourcePath: record.sourcePath,
      durationSeconds: normalizedMatch.matchInfo?.durationSeconds ?? null,
      uncappedEncounterCount: uncapped.length,
      retainedEncounterCount: retained.length,
      truncatedEncounterCount: truncated.length,
      truncatedEncounters: truncated.map((encounter) => ({
        encounterId: encounter.encounterId,
        phase: encounter.phase,
        startLabel: encounter.startLabel,
        endLabel: encounter.endLabel,
        startMs: encounter.startMs,
        endMs: encounter.endMs,
        eventCount: encounter.eventCount,
        relatedEventIds: encounter.relatedEventIds,
      })),
    });
  }

  const encounterCounts = matches
    .map((match) => match.uncappedEncounterCount)
    .sort((a, b) => a - b);
  const distribution = {};
  for (const count of encounterCounts) distribution[count] = (distribution[count] || 0) + 1;

  const gapDistribution = {
    "<=25000": 0,
    "25001-30000": 0,
    "30001-45000": 0,
    "45001-60000": 0,
    "60001-120000": 0,
    ">120000": 0,
  };
  for (const gap of gaps) gapDistribution[gapBucket(gap.gapMs)] += 1;

  const truncatedEncounters = matches.flatMap((match) =>
    match.truncatedEncounters.map((encounter) => ({
      matchId: match.matchId,
      ...encounter,
    })),
  );
  const byPhase = { EARLY: 0, MID: 0, LATE: 0 };
  for (const encounter of truncatedEncounters) byPhase[encounter.phase] += 1;
  const cappedMatches = matches.filter((match) => match.truncatedEncounterCount > 0);
  const lateTeamfightCandidates = truncatedEncounters.filter((encounter) =>
    encounter.phase === "LATE" && encounter.eventCount >= TEAMFIGHT_MIN_EVENTS,
  );
  const boundary25To30Seconds = gaps.filter((gap) =>
    gap.gapMs > BOUNDARY_LOWER_EXCLUSIVE_MS &&
    gap.gapMs <= BOUNDARY_UPPER_INCLUSIVE_MS,
  );

  return {
    config: {
      windowMs,
      maxEncounters,
      teamfightMinEvents: TEAMFIGHT_MIN_EVENTS,
    },
    sampleCount: matches.length,
    encountersPerMatch: {
      min: encounterCounts[0] ?? null,
      median: percentile(encounterCounts, 0.5),
      p90: percentile(encounterCounts, 0.9),
      max: encounterCounts.at(-1) ?? null,
      distribution,
    },
    cap: {
      matchesAtOrAboveLimit: matches.filter((match) =>
        match.uncappedEncounterCount >= maxEncounters,
      ).length,
      matchesActuallyTruncated: cappedMatches.length,
    },
    gaps: {
      pairCount: gaps.length,
      distribution: gapDistribution,
      boundary25To30Seconds,
      boundary25To30Share: gaps.length === 0
        ? 0
        : boundary25To30Seconds.length / gaps.length,
    },
    truncation: {
      matchCount: cappedMatches.length,
      encounterCount: truncatedEncounters.length,
      byPhase,
      matchesWithLateEncounters: cappedMatches
        .filter((match) => match.truncatedEncounters.some((encounter) => encounter.phase === "LATE"))
        .map((match) => match.matchId),
      teamfightCandidateCount: truncatedEncounters.filter((encounter) =>
        encounter.eventCount >= TEAMFIGHT_MIN_EVENTS,
      ).length,
      lateTeamfightCandidateCount: lateTeamfightCandidates.length,
      matchesWithLateTeamfightCandidates: [...new Set(
        lateTeamfightCandidates.map((encounter) => encounter.matchId),
      )],
    },
    matches,
  };
}

function parsePositiveInteger(rawValue, optionName) {
  if (!/^\d+$/u.test(rawValue)) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    samplesRoot: path.join(repoRoot, "data"),
    windowMs: COMBAT_ENCOUNTER_WINDOW_MS,
    maxEncounters: COMBAT_ENCOUNTER_MAX,
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "--help") options.help = true;
    else if (arg.startsWith("--samples-root=")) {
      const value = arg.slice("--samples-root=".length);
      if (!value) throw new Error("--samples-root requires a path.");
      options.samplesRoot = path.resolve(value);
    } else if (arg.startsWith("--window-ms=")) {
      options.windowMs = parsePositiveInteger(arg.slice("--window-ms=".length), "--window-ms");
    } else if (arg.startsWith("--max-encounters=")) {
      options.maxEncounters = parsePositiveInteger(
        arg.slice("--max-encounters=".length),
        "--max-encounters",
      );
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function usage() {
  return [
    "Usage: node scripts/measure-combat-encounters.mjs [options]",
    "",
    "Options:",
    "  --samples-root=PATH     Root to scan recursively (default: data/)",
    `  --window-ms=N           Grouping window (default: ${COMBAT_ENCOUNTER_WINDOW_MS})`,
    `  --max-encounters=N      Retained encounter cap (default: ${COMBAT_ENCOUNTER_MAX})`,
    "  --json                  Print the complete JSON report",
    "  --help                  Print this help",
  ].join("\n");
}

function formatHumanReport(report, samplesRoot) {
  const countDistribution = Object.entries(report.encountersPerMatch.distribution)
    .map(([count, matches]) => `${count}:${matches}`)
    .join(", ");
  const boundaryPercent = (report.gaps.boundary25To30Share * 100).toFixed(2);
  const lines = [
    "Combat encounter cohort measurement",
    `root: ${samplesRoot}`,
    `config: window=${report.config.windowMs}ms, max=${report.config.maxEncounters}`,
    `samples: ${report.sampleCount}`,
    `encounters/match: min=${report.encountersPerMatch.min}, median=${report.encountersPerMatch.median}, p90=${report.encountersPerMatch.p90}, max=${report.encountersPerMatch.max}`,
    `distribution (encounters:matches): ${countDistribution}`,
    `cap: at-or-above=${report.cap.matchesAtOrAboveLimit}, truncated=${report.cap.matchesActuallyTruncated}`,
    `gaps: pairs=${report.gaps.pairCount}, 25-30s=${report.gaps.boundary25To30Seconds.length} (${boundaryPercent}%)`,
    `truncated encounters: total=${report.truncation.encounterCount}, EARLY=${report.truncation.byPhase.EARLY}, MID=${report.truncation.byPhase.MID}, LATE=${report.truncation.byPhase.LATE}`,
    `truncated late teamfight candidates (eventCount>=${report.config.teamfightMinEvents}): ${report.truncation.lateTeamfightCandidateCount}`,
  ];

  for (const pair of report.gaps.boundary25To30Seconds) {
    lines.push(
      `boundary pair: ${pair.matchId} ${pair.fromEncounterId}->${pair.toEncounterId} gap=${pair.gapMs}ms (${pair.fromEndLabel}->${pair.toStartLabel})`,
    );
  }
  for (const match of report.matches.filter((row) => row.truncatedEncounterCount > 0)) {
    lines.push(
      `capped match: ${match.matchId} uncapped=${match.uncappedEncounterCount}, retained=${match.retainedEncounterCount}, truncated=${match.truncatedEncounterCount}`,
    );
  }
  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const records = loadNormalizedMatches(options.samplesRoot);
  if (records.length === 0) {
    throw new Error(`No normalized-match.json files found under ${options.samplesRoot}`);
  }
  const report = measureCombatEncounterCohort(records, options);
  console.log(options.json
    ? JSON.stringify(report, null, 2)
    : formatHumanReport(report, options.samplesRoot));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL  ${error.message}`);
    process.exitCode = 1;
  }
}

export {
  findNormalizedMatchFiles,
  formatHumanReport,
  loadNormalizedMatches,
  measureCombatEncounterCohort,
  parseArgs,
};
