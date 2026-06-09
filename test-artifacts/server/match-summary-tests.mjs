// Phase 33 — server.js summarizeMatch 회귀 테스트
//
// 동작 원리: server.js를 텍스트로 읽어 함수를 추출 → new Function 평가
// (llm-payload-tests.mjs / riot-error-tests.mjs 와 동일 패턴, 외부 의존 없음).
//
// 검증 대상: summarizeMatch는 Riot Match-V5 raw → 최근경기 요약 카드/샘플 적합도의
// 진입점. 깨지면 최근경기 목록·샘플 후보 점수가 통째로 손상.
// 함께 평가하는 순수 의존: normalizeRole, queueLabel, durationLabel, sampleFitScore.

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

const { summarizeMatch, normalizeRole, queueLabel, durationLabel, sampleFitScore } = new Function(
  [
    extractFunctionSource(serverSrc, "normalizeRole"),
    extractFunctionSource(serverSrc, "queueLabel"),
    extractFunctionSource(serverSrc, "durationLabel"),
    extractFunctionSource(serverSrc, "sampleFitScore"),
    extractFunctionSource(serverSrc, "summarizeMatch"),
    "return { summarizeMatch, normalizeRole, queueLabel, durationLabel, sampleFitScore };",
  ].join("\n"),
)();

let pass = 0, fail = 0;
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

// ─── normalizeRole ───────────────────────────────────────────────────────────
check("normalizeRole MIDDLE→MID", normalizeRole("MIDDLE"), "MID");
check("normalizeRole BOTTOM→ADC", normalizeRole("BOTTOM"), "ADC");
check("normalizeRole UTILITY→SUPPORT", normalizeRole("UTILITY"), "SUPPORT");
check("normalizeRole TOP→TOP", normalizeRole("TOP"), "TOP");
check("normalizeRole JUNGLE→JUNGLE", normalizeRole("JUNGLE"), "JUNGLE");
check("normalizeRole unknown passthrough", normalizeRole("INVADER"), "INVADER");
check("normalizeRole empty→UNKNOWN", normalizeRole(""), "UNKNOWN");
check("normalizeRole undefined→UNKNOWN", normalizeRole(undefined), "UNKNOWN");

// ─── queueLabel ──────────────────────────────────────────────────────────────
check("queueLabel 420→RANKED_SOLO", queueLabel(420), "RANKED_SOLO");
check("queueLabel 440→RANKED_FLEX", queueLabel(440), "RANKED_FLEX");
check("queueLabel 450→ARAM", queueLabel(450), "ARAM");
check("queueLabel unknown→QUEUE_n", queueLabel(999), "QUEUE_999");

// ─── durationLabel ───────────────────────────────────────────────────────────
check("durationLabel 125→2:05", durationLabel(125), "2:05");
check("durationLabel 60→1:00", durationLabel(60), "1:00");
check("durationLabel 7→0:07 (zero-pad)", durationLabel(7), "0:07");

// ─── sampleFitScore ──────────────────────────────────────────────────────────
// 420 랭크(+4) + 1800s 황금구간(+4) + role!=UNKNOWN(+3) + LOSS(+2) + 지정role(+2) = 15
check("sampleFitScore solo loss 30min", sampleFitScore({ queueId: 420, durationSeconds: 1800, role: "SUPPORT", result: "LOSS" }), 15);
// 450(미해당,0) + 1000s(짧음,0) + UNKNOWN(0) + WIN(+1) + 비지정role(0) = 1
check("sampleFitScore aram unknown win", sampleFitScore({ queueId: 450, durationSeconds: 1000, role: "UNKNOWN", result: "WIN" }), 1);
// 440(+4) + 1350s(준구간 +2) + TOP(+3) + WIN(+1) + 지정role(+2) = 12
check("sampleFitScore flex top win 22.5min", sampleFitScore({ queueId: 440, durationSeconds: 1350, role: "TOP", result: "WIN" }), 12);

// ─── summarizeMatch ──────────────────────────────────────────────────────────
function matchFixture(overrides = {}) {
  const me = {
    puuid: "ME", teamId: 100, teamPosition: "UTILITY", individualPosition: "UTILITY",
    championName: "Seraphine", win: false, kills: 1, deaths: 5, assists: 20,
    totalMinionsKilled: 30, neutralMinionsKilled: 0, visionScore: 60, goldEarned: 9000,
    totalDamageDealtToChampions: 12000,
    item0: 1, item1: 2, item2: 3, item3: 4, item4: 5, item5: 6, item6: 7,
    summoner1Id: 4, summoner2Id: 14,
    ...overrides,
  };
  return {
    metadata: { matchId: "KR_TEST_1" },
    info: {
      queueId: 420, gameDuration: 1800, gameVersion: "14.1.1", gameCreation: 1700000000000,
      participants: [
        me,
        { puuid: "ALLY1", teamId: 100, kills: 9 },
        { puuid: "ALLY2", teamId: 100, kills: 4 },
        { puuid: "ENEMY1", teamId: 200, kills: 3 },
      ],
    },
  };
}

// participant 미발견 → null
check("summarizeMatch unknown puuid → null", summarizeMatch(matchFixture(), "NOBODY"), null);

// 전체 요약 형태 (team100 kills=1+9+4=14, KP=(1+20)/14=1.5→clamp 1, cs=30 / 30min=1.0)
check("summarizeMatch full summary", summarizeMatch(matchFixture(), "ME"), {
  matchId: "KR_TEST_1",
  queueId: 420,
  queueLabel: "RANKED_SOLO",
  durationSeconds: 1800,
  durationLabel: "30:00",
  gameVersion: "14.1.1",
  champion: "Seraphine",
  role: "SUPPORT",
  result: "LOSS",
  kills: 1,
  deaths: 5,
  assists: 20,
  csPerMin: 1,
  visionScore: 60,
  goldEarned: 9000,
  damageToChampions: 12000,
  killParticipation: 1,
  timestamp: 1700000000000,
  items: [1, 2, 3, 4, 5, 6, 7],
  summonerSpells: [4, 14],
  sampleFitScore: 15,
});

// killParticipation는 1을 넘지 않도록 clamp (Math.min(1, ...))
const clamped = summarizeMatch(matchFixture(), "ME");
checkTrue("killParticipation clamped to <= 1", clamped.killParticipation <= 1);

// clamp 미발동 케이스: KP = (2+3)/20 = 0.25, csPerMin = 75cs / 10min = 7.5
const unclamped = summarizeMatch(
  {
    metadata: { matchId: "KR_TEST_2" },
    info: {
      queueId: 420, gameDuration: 600, gameVersion: "14.1.1", gameCreation: 1,
      participants: [
        { puuid: "ME", teamId: 100, teamPosition: "MIDDLE", championName: "Ahri", win: true,
          kills: 2, deaths: 1, assists: 3, totalMinionsKilled: 70, neutralMinionsKilled: 5,
          visionScore: 20, goldEarned: 8000, totalDamageDealtToChampions: 15000,
          item0: 0, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0,
          summoner1Id: 4, summoner2Id: 12 },
        { puuid: "A", teamId: 100, kills: 10 },
        { puuid: "B", teamId: 100, kills: 8 },
      ],
    },
  },
  "ME",
);
check("summarizeMatch KP unclamped 0.25", unclamped.killParticipation, 0.25);
check("summarizeMatch csPerMin 7.5", unclamped.csPerMin, 7.5);
check("summarizeMatch role MIDDLE→MID", unclamped.role, "MID");
check("summarizeMatch result win→WIN", unclamped.result, "WIN");

const sparse = summarizeMatch(
  {
    metadata: { matchId: "KR_TEST_SPARSE" },
    info: {
      queueId: 420, gameDuration: 1200, gameVersion: "14.2.1", gameCreation: 2,
      participants: [
        { puuid: "ME", teamId: 100, teamPosition: "UTILITY", championName: "Milio", win: false },
        { puuid: "ALLY", teamId: 100, kills: 0 },
      ],
    },
  },
  "ME",
);
check("summarizeMatch sparse kills default", sparse.kills, 0);
check("summarizeMatch sparse deaths default", sparse.deaths, 0);
check("summarizeMatch sparse assists default", sparse.assists, 0);
check("summarizeMatch sparse killParticipation default", sparse.killParticipation, 0);
check("summarizeMatch sparse items default", sparse.items, [0, 0, 0, 0, 0, 0, 0]);
check("summarizeMatch sparse summoner spells default", sparse.summonerSpells, [0, 0]);
checkTrue("summarizeMatch sparse values are finite", Number.isFinite(sparse.killParticipation));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
