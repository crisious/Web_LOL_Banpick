// server.js participant scoreboard coaching regression tests.

import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { normalizeRole } = require("../../lib/match-summary.js");
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (ch === "}") {
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

const harnessSrc = [
  extractConstSource(serverSrc, "CS_FULL_SCORE_TARGETS"),
  extractFunctionSource(serverSrc, "clamp10"),
  extractFunctionSource(serverSrc, "calcCombatScore"),
  extractFunctionSource(serverSrc, "calcIncomeScore"),
  extractFunctionSource(serverSrc, "calcVisionScore"),
  extractFunctionSource(serverSrc, "calcSurvivalScore"),
  extractFunctionSource(serverSrc, "participantPublicLabel"),
  extractFunctionSource(serverSrc, "participantStatsFromRaw"),
  extractFunctionSource(serverSrc, "participantScoreLabel"),
  extractFunctionSource(serverSrc, "participantCoachingText"),
  extractFunctionSource(serverSrc, "buildParticipantPlayScore"),
  extractFunctionSource(serverSrc, "buildParticipantScoreboard"),
  "return { participantPublicLabel, participantStatsFromRaw, participantScoreLabel, participantCoachingText, buildParticipantPlayScore, buildParticipantScoreboard };",
].join("\n");

const {
  participantPublicLabel,
  participantStatsFromRaw,
  participantScoreLabel,
  participantCoachingText,
  buildParticipantPlayScore,
  buildParticipantScoreboard,
} = new Function("normalizeRole", harnessSrc)(normalizeRole);

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

function participant({
  participantId,
  teamId,
  championName,
  teamPosition,
  kills = 0,
  deaths = 0,
  assists = 0,
  totalMinionsKilled = 0,
  neutralMinionsKilled = 0,
  goldEarned = 0,
  totalDamageDealtToChampions = 0,
  visionScore = 0,
  win = true,
  challenges = {},
}) {
  return {
    participantId,
    teamId,
    championName,
    teamPosition,
    individualPosition: teamPosition,
    kills,
    deaths,
    assists,
    totalMinionsKilled,
    neutralMinionsKilled,
    goldEarned,
    totalDamageDealtToChampions,
    visionScore,
    win,
    puuid: `secret-puuid-${participantId}`,
    summonerName: `secret-summoner-${participantId}`,
    riotIdGameName: `secret-game-${participantId}`,
    riotIdTagline: "KR1",
    challenges,
  };
}

const matchDetail = {
  metadata: { matchId: "KR_1234567890" },
  info: {
    gameDuration: 1800,
    participants: [
      participant({
        participantId: 1,
        teamId: 100,
        championName: "Ahri",
        teamPosition: "MIDDLE",
        kills: 8,
        deaths: 2,
        assists: 7,
        totalMinionsKilled: 230,
        goldEarned: 14500,
        totalDamageDealtToChampions: 26000,
        visionScore: 28,
        challenges: {
          damagePerMinute: 866,
          goldPerMinute: 483,
          visionScorePerMinute: 0.93,
          killParticipation: 0.68,
          soloKills: 2,
        },
      }),
      participant({ participantId: 2, teamId: 100, championName: "LeeSin", teamPosition: "JUNGLE", kills: 4, deaths: 5, assists: 12, neutralMinionsKilled: 144, goldEarned: 11800, totalDamageDealtToChampions: 15000, visionScore: 35, challenges: { killParticipation: 0.72, controlWardsPlaced: 4 } }),
      participant({ participantId: 3, teamId: 100, championName: "Jinx", teamPosition: "BOTTOM", kills: 11, deaths: 4, assists: 5, totalMinionsKilled: 260, goldEarned: 16800, totalDamageDealtToChampions: 32000, visionScore: 18, challenges: { damagePerMinute: 1066, goldPerMinute: 560, killParticipation: 0.73 } }),
      participant({ participantId: 4, teamId: 100, championName: "Nautilus", teamPosition: "UTILITY", kills: 1, deaths: 7, assists: 18, totalMinionsKilled: 38, goldEarned: 8200, totalDamageDealtToChampions: 7000, visionScore: 62, challenges: { killParticipation: 0.86, visionScorePerMinute: 2.06, controlWardsPlaced: 7 } }),
      participant({ participantId: 5, teamId: 100, championName: "Gwen", teamPosition: "TOP", kills: 2, deaths: 6, assists: 3, totalMinionsKilled: 180, goldEarned: 9800, totalDamageDealtToChampions: 11000, visionScore: 14, challenges: { killParticipation: 0.23 } }),
      participant({ participantId: 6, teamId: 200, championName: "Syndra", teamPosition: "MIDDLE", kills: 9, deaths: 3, assists: 6, totalMinionsKilled: 221, goldEarned: 15000, totalDamageDealtToChampions: 31000, visionScore: 25, win: false, challenges: { damagePerMinute: 1033, goldPerMinute: 500, killParticipation: 0.75 } }),
      participant({ participantId: 7, teamId: 200, championName: "Viego", teamPosition: "JUNGLE", kills: 5, deaths: 5, assists: 9, neutralMinionsKilled: 135, goldEarned: 11900, totalDamageDealtToChampions: 17000, visionScore: 31, win: false, challenges: { killParticipation: 0.70 } }),
      participant({ participantId: 8, teamId: 200, championName: "Caitlyn", teamPosition: "BOTTOM", kills: 6, deaths: 6, assists: 4, totalMinionsKilled: 245, goldEarned: 13200, totalDamageDealtToChampions: 24000, visionScore: 16, win: false, challenges: { killParticipation: 0.50 } }),
      participant({ participantId: 9, teamId: 200, championName: "Leona", teamPosition: "UTILITY", kills: 0, deaths: 9, assists: 11, totalMinionsKilled: 35, goldEarned: 7000, totalDamageDealtToChampions: 6000, visionScore: 50, win: false, challenges: { killParticipation: 0.55, visionScorePerMinute: 1.66 } }),
      participant({ participantId: 10, teamId: 200, championName: "Ornn", teamPosition: "TOP", kills: 1, deaths: 5, assists: 8, totalMinionsKilled: 190, goldEarned: 10100, totalDamageDealtToChampions: 13000, visionScore: 20, win: false, challenges: { killParticipation: 0.45 } }),
    ],
  },
};

check("participantPublicLabel player", participantPublicLabel({ relation: "PLAYER", role: "MID", champion: "Ahri" }), "내 MID Ahri");
check("participantPublicLabel ally", participantPublicLabel({ relation: "ALLY", role: "JUNGLE", champion: "LeeSin" }), "아군 JUNGLE LeeSin");
check("participantPublicLabel enemy", participantPublicLabel({ relation: "ENEMY", role: "MID", champion: "Syndra" }), "상대 MID Syndra");

const stats = participantStatsFromRaw(matchDetail.info.participants[0], 22, matchDetail.info.gameDuration);
check("participantStatsFromRaw computes cs", stats.cs, 230);
check("participantStatsFromRaw computes csPerMinute", stats.csPerMinute, 7.67);
check("participantStatsFromRaw computes kda", stats.kda, 7.5);
check("participantStatsFromRaw keeps damage", stats.damageToChampions, 26000);

check("participantScoreLabel elite", participantScoreLabel(8.2), "캐리");
check("participantScoreLabel good", participantScoreLabel(6.2), "양호");
check("participantScoreLabel average", participantScoreLabel(4.4), "보통");
check("participantScoreLabel poor", participantScoreLabel(3.9), "주의");

const score = buildParticipantPlayScore({
  stats,
  challenges: matchDetail.info.participants[0].challenges,
  role: "MID",
  durationSeconds: 1800,
});
checkTrue("buildParticipantPlayScore has overall", Number.isFinite(score.overall));
checkTrue("buildParticipantPlayScore has four categories",
  Object.keys(score.categories).join(",") === "combat,income,vision,survival");
checkTrue("participantCoachingText returns Korean coaching",
  participantCoachingText({ relation: "ENEMY", score, stats, role: "MID" }).includes("상대"));

const scoreboard = buildParticipantScoreboard(matchDetail, { targetPuuid: "secret-puuid-1" });
check("scoreboard schemaVersion", scoreboard.schemaVersion, 1);
check("scoreboard participant count", scoreboard.participants.length, 10);
check("scoreboard ally count", scoreboard.teams.ally.length, 5);
check("scoreboard enemy count", scoreboard.teams.enemy.length, 5);
check("scoreboard target participant id", scoreboard.targetParticipantId, 1);
check("scoreboard player relation", scoreboard.participants.find((p) => p.participantId === 1).relation, "PLAYER");
check("scoreboard top rank starts at 1", scoreboard.participants[0].rankOverall, 1);
checkTrue("scoreboard includes lane matchup",
  scoreboard.laneMatchups.some((m) => m.role === "MID" && m.playerParticipantId === 1 && m.enemyParticipantId === 6));
checkTrue("scoreboard hides puuid",
  !JSON.stringify(scoreboard).includes("secret-puuid"));
checkTrue("scoreboard hides summoner name",
  !JSON.stringify(scoreboard).includes("secret-summoner"));
checkTrue("scoreboard hides riot id",
  !JSON.stringify(scoreboard).includes("secret-game"));
checkTrue("server attaches participantScoreboard in buildNormalized",
  serverSrc.includes("normalized.participantScoreboard = buildParticipantScoreboard(matchDetail"));
checkTrue("loadSampleBundle backfills participantScoreboard",
  serverSrc.includes("!normalized.participantScoreboard") &&
  serverSrc.includes("buildParticipantScoreboard(matchDetail"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
