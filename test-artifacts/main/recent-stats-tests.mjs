// Track T — main.js의 aggregateRecentStats 회귀 테스트
//
// 검증 대상: tab-trends "최근 20경기 누적" 패널 데이터 가공.
// stat-ribbon delta 비교의 기준값(평균 KDA, CS/분, Damage/분, Vision/분)을
// 생성하므로 깨지면 전체 ▲/▼ 인디케이터가 잘못 표시됨.
//
// 검증 항목:
//   1) 빈 입력 → overall=0, byChampion/byRole 빈 배열
//   2) 단일 WIN → wrPct=100, KDA = (k+a)/d
//   3) 5경기 (4W/1L) — wrPct=80, sum 정확
//   4) 챔피언별 그룹화 + count desc 정렬
//   5) 역할별 그룹화 + roleOrder TOP→SUPPORT 정렬
//   6) damageSum / visionSum 평균 (Phase 15)
//   7) 분당 데미지 정규화 (Phase 17 — durationSeconds 다양한 매치)
//   8) duration=0 매치는 분당 카운트에서 제외
//   9) 비배열 입력 (null/undefined) 안전

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

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

const computeSrc = extractFunctionSource(mainSrc, "computeKdaRatio");
const aggregateSrc = extractFunctionSource(mainSrc, "aggregateRecentStats");
const aggregateRecentStats = new Function(
  `${computeSrc}\n${aggregateSrc}\nreturn aggregateRecentStats;`,
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

function makeMatch(opts = {}) {
  return {
    champion: opts.champion || "Ahri",
    role: opts.role || "MID",
    result: opts.result || "WIN",
    kills: opts.kills ?? 5,
    deaths: opts.deaths ?? 2,
    assists: opts.assists ?? 8,
    csPerMin: opts.csPerMin ?? 7.5,
    durationSeconds: opts.durationSeconds ?? 1800, // 30분
    damageToChampions: opts.damageToChampions ?? 24000,
    visionScore: opts.visionScore ?? 22,
  };
}

// ─── 케이스 1: 빈 입력 ──────────────────────────────────────────────────────

{
  const r = aggregateRecentStats([]);
  check("empty: count=0", r.overall.count, 0);
  check("empty: wrPct=0", r.overall.wrPct, 0);
  check("empty: avgKda=0", r.overall.avgKda, 0);
  check("empty: byChampion=[]", r.byChampion, []);
  check("empty: byRole=[]", r.byRole, []);
}

// ─── 케이스 2: null / undefined / non-array → 안전 ──────────────────────────

{
  const r = aggregateRecentStats(null);
  check("null input: count=0", r.overall.count, 0);
}
{
  const r = aggregateRecentStats(undefined);
  check("undefined input: count=0", r.overall.count, 0);
}
{
  const r = aggregateRecentStats("not-an-array");
  check("string input: count=0", r.overall.count, 0);
}

// ─── 케이스 3: 단일 WIN ─────────────────────────────────────────────────────

{
  const r = aggregateRecentStats([makeMatch({ kills: 5, deaths: 2, assists: 7 })]);
  check("1win: count=1", r.overall.count, 1);
  check("1win: wins=1", r.overall.wins, 1);
  check("1win: losses=0", r.overall.losses, 0);
  check("1win: wrPct=100", r.overall.wrPct, 100);
  check("1win: avgKda=(5+7)/2=6.00", r.overall.avgKda, 6);
}

// ─── 케이스 4: 5경기 (4W/1L) — wrPct=80 ─────────────────────────────────────

{
  const matches = [
    makeMatch({ champion: "Yasuo", result: "WIN", kills: 6, deaths: 3, assists: 4 }),
    makeMatch({ champion: "Yasuo", result: "WIN", kills: 6, deaths: 3, assists: 4 }),
    makeMatch({ champion: "Yasuo", result: "WIN", kills: 6, deaths: 3, assists: 4 }),
    makeMatch({ champion: "Yasuo", result: "WIN", kills: 6, deaths: 3, assists: 4 }),
    makeMatch({ champion: "Yasuo", result: "LOSS", kills: 6, deaths: 3, assists: 4 }),
  ];
  const r = aggregateRecentStats(matches);
  check("5g: count=5", r.overall.count, 5);
  check("5g: wins=4", r.overall.wins, 4);
  check("5g: losses=1", r.overall.losses, 1);
  check("5g: wrPct=80", r.overall.wrPct, 80);
  check("5g: byChampion[0].count=5", r.byChampion[0].count, 5);
  check("5g: byChampion[0].wrPct=80", r.byChampion[0].wrPct, 80);
}

// ─── 케이스 5: 다중 챔피언 + count desc 정렬 ────────────────────────────────

{
  const matches = [
    makeMatch({ champion: "Lux", result: "WIN" }),
    makeMatch({ champion: "Lux", result: "LOSS" }),
    makeMatch({ champion: "Yasuo", result: "WIN" }),
    makeMatch({ champion: "Yasuo", result: "WIN" }),
    makeMatch({ champion: "Yasuo", result: "WIN" }),
  ];
  const r = aggregateRecentStats(matches);
  check("byChampion sorted by count desc", r.byChampion.map((c) => c.champion),
    ["Yasuo", "Lux"]);
  check("byChampion[Yasuo].count=3", r.byChampion[0].count, 3);
  check("byChampion[Lux].count=2", r.byChampion[1].count, 2);
}

// ─── 케이스 6: 역할별 그룹화 + roleOrder 정렬 ───────────────────────────────

{
  const matches = [
    makeMatch({ role: "SUPPORT", result: "WIN" }),
    makeMatch({ role: "TOP", result: "WIN" }),
    makeMatch({ role: "TOP", result: "WIN" }),
    makeMatch({ role: "JUNGLE", result: "WIN" }),
    makeMatch({ role: "JUNGLE", result: "WIN" }),
    makeMatch({ role: "MID", result: "WIN" }),
  ];
  const r = aggregateRecentStats(matches);
  // count desc 우선, 동률이면 roleOrder TOP(1) → JUNGLE(2) → MID(3) → ADC(4) → SUPPORT(5)
  // TOP 2, JUNGLE 2, SUPPORT 1, MID 1
  // count desc → TOP/JUNGLE(2) before SUPPORT/MID(1)
  // 동률 TOP vs JUNGLE → roleOrder TOP(1) < JUNGLE(2) → TOP 먼저
  // 동률 SUPPORT(5) vs MID(3) → MID 먼저
  check("byRole sort: TOP, JUNGLE, MID, SUPPORT",
    r.byRole.map((x) => x.role), ["TOP", "JUNGLE", "MID", "SUPPORT"]);
}

// ─── 케이스 7: avgDamage / avgVisionScore (Phase 15) ────────────────────────

{
  const matches = [
    makeMatch({ damageToChampions: 20000, visionScore: 20 }),
    makeMatch({ damageToChampions: 30000, visionScore: 30 }),
  ];
  const r = aggregateRecentStats(matches);
  check("avgDamage = (20000+30000)/2 = 25000", r.overall.avgDamage, 25000);
  check("avgVisionScore = (20+30)/2 = 25.0", r.overall.avgVisionScore, 25);
}

// ─── 케이스 8: 분당 데미지 정규화 (Phase 17) ────────────────────────────────

{
  const matches = [
    // 25분 게임, 데미지 25000 → 분당 1000
    makeMatch({ durationSeconds: 1500, damageToChampions: 25000 }),
    // 30분 게임, 데미지 30000 → 분당 1000
    makeMatch({ durationSeconds: 1800, damageToChampions: 30000 }),
    // 40분 게임, 데미지 40000 → 분당 1000
    makeMatch({ durationSeconds: 2400, damageToChampions: 40000 }),
  ];
  const r = aggregateRecentStats(matches);
  check("avgDamagePerMin all 1000 → 1000", r.overall.avgDamagePerMin, 1000);
}

// ─── 케이스 9: duration=0 매치는 분당 카운트 제외 ───────────────────────────

{
  const matches = [
    makeMatch({ durationSeconds: 1800, damageToChampions: 30000 }), // 분당 1000
    makeMatch({ durationSeconds: 0, damageToChampions: 99999 }),    // 제외
  ];
  const r = aggregateRecentStats(matches);
  check("duration=0 excluded from dmgPerMin avg",
    r.overall.avgDamagePerMin, 1000);
}

// ─── 케이스 10: 분당 시야 (Phase 18) ────────────────────────────────────────

{
  const matches = [
    makeMatch({ durationSeconds: 1800, visionScore: 30 }), // 30 / 30분 = 1.0/분
    makeMatch({ durationSeconds: 1800, visionScore: 60 }), // 60 / 30분 = 2.0/분
  ];
  const r = aggregateRecentStats(matches);
  check("avgVisionScorePerMin = (1.0+2.0)/2 = 1.5", r.overall.avgVisionScorePerMin, 1.5);
}

// ─── 케이스 11: avgDurationSec = duration 평균 ──────────────────────────────

{
  const matches = [
    makeMatch({ durationSeconds: 1500 }),
    makeMatch({ durationSeconds: 1800 }),
    makeMatch({ durationSeconds: 2100 }),
  ];
  const r = aggregateRecentStats(matches);
  // 평균 1800
  check("avgDurationSec = 1800", r.overall.avgDurationSec, 1800);
}

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
