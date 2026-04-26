import fs from "fs";

const main = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

// nested-brace-safe 함수 본체 추출 — `function name(`부터 시작해 균형 잡힌 } 에서 종료
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

// computeKdaRatio는 aggregateChampionHistory 내부에서 호출되므로 같은 스코프에 함께 평가
const computeSrc = extractFunctionSource(main, "computeKdaRatio");
const aggSrc = extractFunctionSource(main, "aggregateChampionHistory");
// eslint-disable-next-line no-new-func
const aggregateChampionHistory = new Function(
  `${computeSrc}\n${aggSrc}\nreturn aggregateChampionHistory;`,
)();

let pass = 0, fail = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

// 케이스 1: 빈 배열
const r1 = aggregateChampionHistory([]);
check("empty: totalGames=0", r1.totalGames, 0);
check("empty: byChampion=[]", r1.byChampion, []);
check("empty: mostPlayed=null", r1.mostPlayed, null);
check("empty: bestWr=null", r1.bestWr, null);

// 케이스 2: 1게임 win
const m1 = { champion: "Ahri", result: "WIN", kills: 5, deaths: 2, assists: 7, csPerMin: 8.1, durationSeconds: 1800, damageToChampions: 22000, killParticipation: 0.6 };
const r2 = aggregateChampionHistory([m1]);
check("1win: totalGames=1", r2.totalGames, 1);
check("1win: wrPct=100", r2.wrPct, 100);
check("1win: byChampion[0].wrPct=100", r2.byChampion[0].wrPct, 100);
check("1win: avgKp=60", r2.byChampion[0].avgKp, 60);

// 케이스 3: 4 win, 1 loss 동일 챔피언
const matches3 = Array.from({ length: 5 }, (_, i) => ({
  champion: "Yasuo", result: i < 4 ? "WIN" : "LOSS", kills: 6, deaths: 3, assists: 4,
  csPerMin: 7.8, durationSeconds: 1800, damageToChampions: 25000, killParticipation: 0.55,
}));
const r3 = aggregateChampionHistory(matches3);
check("5g: count=5", r3.byChampion[0].count, 5);
check("5g: wrPct=80", r3.byChampion[0].wrPct, 80);

// 케이스 4: 베스트 후보는 3경기 이상만
const mixed = [
  ...Array.from({ length: 2 }, () => ({ champion: "Lux", result: "WIN", kills: 5, deaths: 1, assists: 8, csPerMin: 6.5, durationSeconds: 1700, damageToChampions: 20000, killParticipation: 0.6 })),
  ...Array.from({ length: 5 }, (_, i) => ({ champion: "Ahri", result: i < 3 ? "WIN" : "LOSS", kills: 4, deaths: 3, assists: 6, csPerMin: 8.0, durationSeconds: 1800, damageToChampions: 22000, killParticipation: 0.55 })),
];
const r4 = aggregateChampionHistory(mixed);
check("bestWr filter ≥3: Lux 100%(2g) is excluded, Ahri 60%(5g) wins", r4.bestWr.champion, "Ahri");

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
