// Phase 33 — Riot Match-V5 raw match to recent-match summary contract.
//
// The production module is loaded directly so extraction and server wiring
// cannot silently diverge from the implementation exercised here.

import fs from "node:fs";
import { createRequire } from "node:module";
import {
  MATCH_V5_SUMMARY_TARGET_PUUID,
  makeMatchV5SummaryFixture,
} from "../fixtures/match-v5-summary-fixture.mjs";

const require = createRequire(import.meta.url);
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");
let matchSummaryModule = null;
let loadError = null;

try {
  matchSummaryModule = require("../../lib/match-summary.js");
} catch (error) {
  loadError = error;
}

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkTrue(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition && detail) console.log(`  ${detail}`);
  condition ? pass++ : fail++;
}

checkTrue("match summary module loads", Boolean(matchSummaryModule), loadError?.message || "");

if (matchSummaryModule) {
  const {
    durationLabel,
    normalizeRole,
    queueLabel,
    sampleFitScore,
    summarizeMatch,
  } = matchSummaryModule;

  checkTrue("server wires the shared match summary module",
    serverSrc.includes('require("./lib/match-summary")') &&
      !serverSrc.includes("function summarizeMatch("));

  // normalizeRole
  check("normalizeRole MIDDLE→MID", normalizeRole("MIDDLE"), "MID");
  check("normalizeRole BOTTOM→ADC", normalizeRole("BOTTOM"), "ADC");
  check("normalizeRole UTILITY→SUPPORT", normalizeRole("UTILITY"), "SUPPORT");
  check("normalizeRole TOP→TOP", normalizeRole("TOP"), "TOP");
  check("normalizeRole JUNGLE→JUNGLE", normalizeRole("JUNGLE"), "JUNGLE");
  check("normalizeRole unknown passthrough", normalizeRole("INVADER"), "INVADER");
  check("normalizeRole empty→UNKNOWN", normalizeRole(""), "UNKNOWN");
  check("normalizeRole undefined→UNKNOWN", normalizeRole(undefined), "UNKNOWN");

  // queueLabel
  check("queueLabel 420→RANKED_SOLO", queueLabel(420), "RANKED_SOLO");
  check("queueLabel 440→RANKED_FLEX", queueLabel(440), "RANKED_FLEX");
  check("queueLabel 450→ARAM", queueLabel(450), "ARAM");
  check("queueLabel unknown→QUEUE_n", queueLabel(999), "QUEUE_999");

  // durationLabel
  check("durationLabel 125→2:05", durationLabel(125), "2:05");
  check("durationLabel 60→1:00", durationLabel(60), "1:00");
  check("durationLabel 7→0:07 (zero-pad)", durationLabel(7), "0:07");

  // sampleFitScore
  check("sampleFitScore solo loss 30min", sampleFitScore({
    queueId: 420,
    durationSeconds: 1800,
    role: "SUPPORT",
    result: "LOSS",
  }), 15);
  check("sampleFitScore aram unknown win", sampleFitScore({
    queueId: 450,
    durationSeconds: 1000,
    role: "UNKNOWN",
    result: "WIN",
  }), 1);
  check("sampleFitScore flex top win 22.5min", sampleFitScore({
    queueId: 440,
    durationSeconds: 1350,
    role: "TOP",
    result: "WIN",
  }), 12);

  // Invalid/missing raw match details.
  check("summarizeMatch null match → null", summarizeMatch(null, MATCH_V5_SUMMARY_TARGET_PUUID), null);
  check("summarizeMatch missing info → null", summarizeMatch({}, MATCH_V5_SUMMARY_TARGET_PUUID), null);
  check("summarizeMatch non-array participants → null",
    summarizeMatch({ info: { participants: null } }, MATCH_V5_SUMMARY_TARGET_PUUID),
    null);
  check("summarizeMatch unknown puuid → null", summarizeMatch(makeMatchV5SummaryFixture(), "missing-puuid"), null);

  const expectedFullSummary = {
    matchId: "KR_7033123456",
    queueId: 420,
    queueLabel: "RANKED_SOLO",
    durationSeconds: 1897,
    durationLabel: "31:37",
    gameVersion: "16.15.1.7138319",
    champion: "Ahri",
    role: "MID",
    result: "WIN",
    kills: 7,
    deaths: 4,
    assists: 3,
    csPerMin: 7.1,
    visionScore: 27,
    goldEarned: 12987,
    damageToChampions: 24876,
    killParticipation: 0.67,
    timestamp: 1785412345678,
    items: [1056, 3020, 3089, 3135, 3157, 4645, 3340],
    summonerSpells: [4, 12],
    sampleFitScore: 14,
  };

  check("summarizeMatch maps the complete raw participant summary",
    summarizeMatch(makeMatchV5SummaryFixture(), MATCH_V5_SUMMARY_TARGET_PUUID),
    expectedFullSummary);

  const noChallenges = makeMatchV5SummaryFixture();
  delete noChallenges.info.participants[2].challenges;
  check("summarizeMatch tolerates a missing challenges block",
    summarizeMatch(noChallenges, MATCH_V5_SUMMARY_TARGET_PUUID),
    expectedFullSummary);

  const partialChallenges = makeMatchV5SummaryFixture({
    targetOverrides: { challenges: { killParticipation: 0.01 } },
  });
  check("summarizeMatch tolerates a partial challenges block",
    summarizeMatch(partialChallenges, MATCH_V5_SUMMARY_TARGET_PUUID),
    expectedFullSummary);

  const lossSupportSummary = summarizeMatch(makeMatchV5SummaryFixture({
    targetOverrides: {
      individualPosition: "UTILITY",
      teamPosition: "",
      win: false,
    },
  }), MATCH_V5_SUMMARY_TARGET_PUUID);
  check("summarizeMatch derives loss result", lossSupportSummary.result, "LOSS");
  check("summarizeMatch falls back to individual position", lossSupportSummary.role, "SUPPORT");
  check("summarizeMatch derives loss sample-fit score", lossSupportSummary.sampleFitScore, 15);

  const teamPositionSummary = summarizeMatch(makeMatchV5SummaryFixture({
    targetOverrides: {
      individualPosition: "UTILITY",
      teamPosition: "BOTTOM",
    },
  }), MATCH_V5_SUMMARY_TARGET_PUUID);
  check("summarizeMatch prefers and normalizes team position", teamPositionSummary.role, "ADC");

  const clamped = summarizeMatch(makeMatchV5SummaryFixture({
    targetOverrides: { assists: 20 },
  }), MATCH_V5_SUMMARY_TARGET_PUUID);
  check("summarizeMatch clamps kill participation to one", clamped.killParticipation, 1);

  const sparse = summarizeMatch(makeMatchV5SummaryFixture({
    targetOverrides: {
      assists: undefined,
      deaths: undefined,
      goldEarned: undefined,
      item0: undefined,
      item1: undefined,
      item2: undefined,
      item3: undefined,
      item4: undefined,
      item5: undefined,
      item6: undefined,
      kills: undefined,
      neutralMinionsKilled: undefined,
      summoner1Id: undefined,
      summoner2Id: undefined,
      totalDamageDealtToChampions: undefined,
      totalMinionsKilled: undefined,
      visionScore: undefined,
    },
  }), MATCH_V5_SUMMARY_TARGET_PUUID);
  check("summarizeMatch sparse kills default", sparse.kills, 0);
  check("summarizeMatch sparse deaths default", sparse.deaths, 0);
  check("summarizeMatch sparse assists default", sparse.assists, 0);
  check("summarizeMatch sparse killParticipation default", sparse.killParticipation, 0);
  check("summarizeMatch sparse items default", sparse.items, [0, 0, 0, 0, 0, 0, 0]);
  check("summarizeMatch sparse summoner spells default", sparse.summonerSpells, [0, 0]);
  checkTrue("summarizeMatch sparse values are finite", Number.isFinite(sparse.killParticipation));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
