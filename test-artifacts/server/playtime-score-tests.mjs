// server.js playtime score (combat/income/vision/survival + buildPlaytimeScore) regression tests
//
// 캡처 대상은 server.js의 순수 점수 함수들의 현재 실제 동작(characterization)이다.
// 기대값은 함수 수식을 직접 계산해 산출하고 node 실행 출력과 일치시켰다.

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
  const m = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[0];
}

// buildPlaytimeScore는 calcObjectiveScore/calcStructureScore를 호출하며, 이들은
// isObjectiveWinEvent/isObjectiveFailEvent/isStructureTakeEvent 와 그 이벤트 타입 상수에 의존한다.
// 필요한 의존 함수/상수를 함께 추출해 주입한다.
const {
  clamp10,
  calcCombatScore,
  calcIncomeScore,
  calcVisionScore,
  calcSurvivalScore,
  buildPlaytimeScore,
} = new Function(
  [
    extractConstSource(serverSrc, "CS_FULL_SCORE_TARGETS"),
    extractConstSource(serverSrc, "OBJECTIVE_WIN_EVENT_TYPES"),
    extractConstSource(serverSrc, "OBJECTIVE_FAIL_EVENT_TYPES"),
    extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "clamp10"),
    extractFunctionSource(serverSrc, "calcCombatScore"),
    extractFunctionSource(serverSrc, "calcIncomeScore"),
    extractFunctionSource(serverSrc, "calcVisionScore"),
    extractFunctionSource(serverSrc, "calcSurvivalScore"),
    extractFunctionSource(serverSrc, "isObjectiveWinEvent"),
    extractFunctionSource(serverSrc, "isObjectiveFailEvent"),
    extractFunctionSource(serverSrc, "isStructureTakeEvent"),
    extractFunctionSource(serverSrc, "calcObjectiveScore"),
    extractFunctionSource(serverSrc, "calcStructureScore"),
    extractFunctionSource(serverSrc, "buildPlaytimeScore"),
    "return { clamp10, calcCombatScore, calcIncomeScore, calcVisionScore, calcSurvivalScore, buildPlaytimeScore };",
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

// ─── clamp10: [0,10] 클램프 + 소수 1자리 반올림 ──────────────────────────────
check("clamp10 clamps above 10", clamp10(12.7), 10);
check("clamp10 clamps below 0", clamp10(-3), 0);
check("clamp10 rounds to one decimal (round half up)", clamp10(5.45), 5.5);
check("clamp10 rounds down", clamp10(5.44), 5.4);
check("clamp10 passes a midrange value through", clamp10(7.3), 7.3);
// +(-0).toFixed(1) === 0 이므로 음수 0 경계도 0으로 클램프
check("clamp10 keeps 0", clamp10(0), 0);

// ─── calcSurvivalScore: deathsPerMin 임계 ───────────────────────────────────
// deathsPerMin = deaths / minutes. minutes=10 으로 고정하면 deaths가 곧 임계*10.
check("survival deathsPerMin 0.1 -> 10", calcSurvivalScore({ deaths: 1 }, 10), 10);
check("survival deathsPerMin 0.2 -> 8", calcSurvivalScore({ deaths: 2 }, 10), 8);
check("survival deathsPerMin 0.3 -> 6", calcSurvivalScore({ deaths: 3 }, 10), 6);
check("survival deathsPerMin 0.4 -> 4", calcSurvivalScore({ deaths: 4 }, 10), 4);
// deathsPerMin = 0.5 (>0.4): clamp10(2 - (0.5-0.4)*5) = clamp10(2 - 0.5) = 1.5
check("survival deathsPerMin 0.5 -> 1.5", calcSurvivalScore({ deaths: 5 }, 10), 1.5);
// deathsPerMin = 0.6: clamp10(2 - (0.6-0.4)*5) = clamp10(2 - 1.0) = 1.0
check("survival deathsPerMin 0.6 -> 1", calcSurvivalScore({ deaths: 6 }, 10), 1);
// 사망 폭주 -> 음수 식이 0으로 클램프되는 경로: deaths=10, minutes=10 -> dpm=1
// clamp10(2 - (1-0.4)*5) = clamp10(2 - 3) = clamp10(-1) = 0
check("survival heavy deaths clamps to 0", calcSurvivalScore({ deaths: 10 }, 10), 0);

// ─── calcCombatScore ────────────────────────────────────────────────────────
// minutes=20. challenges 채워진 경로:
//   dpm = 800 -> dpmPart = min(800/800,1)*2 = 2
//   kda = 6 -> kdaPart = min(6,6)/6*5 = 5
//   killParticipation = 0.6 -> kpPart = min(0.6,0.6)/0.6*2 = 2
//   soloKills = 3 -> soloPart = min(3,3)*0.33 = 0.99
//   합 = 5+2+2+0.99 = 9.99 -> clamp10 -> 10.0 (round half up at .9 -> 10.0)
check("combat full challenges path", calcCombatScore(
  { kda: 6, damageToChampions: 0, killParticipation: 0 },
  { damagePerMinute: 800, killParticipation: 0.6, soloKills: 3 },
  20,
), 10);
// 폴백 경로: challenges.damagePerMinute 없음 -> stats.damageToChampions/minutes
//   damageToChampions=8000, minutes=20 -> dpm=400 -> dpmPart = min(400/800,1)*2 = 1.0
//   kda=3 -> kdaPart = min(3,6)/6*5 = 2.5
//   killParticipation 폴백: challenges.killParticipation 없음 -> stats.killParticipation=0.3
//     kpPart = min(0.3,0.6)/0.6*2 = 1.0
//   soloKills 없음 -> soloPart = 0
//   합 = 2.5 + 1.0 + 1.0 + 0 = 4.5
check("combat stat fallback path (dpm & kp from stats)", calcCombatScore(
  { kda: 3, damageToChampions: 8000, killParticipation: 0.3 },
  {},
  20,
), 4.5);

// ─── calcIncomeScore ────────────────────────────────────────────────────────
// position=MID -> csThreshold = 7. minutes=20.
//   csPerMinute = 8.4 -> csPart = min(8.4/7, 1.2)*4 = min(1.2,1.2)*4 = 4.8
//   goldPerMinute = 540 -> goldPart = min(540/450, 1.2)*4 = min(1.2,1.2)*4 = 4.8
//   turretPlatesTaken = 5 -> platePart = min(5,5)*0.4 = 2.0
//   합 = 4.8+4.8+2.0 = 11.6 -> clamp10 -> 10
check("income capped at 10 (MID threshold)", calcIncomeScore(
  { csPerMinute: 8.4, goldEarned: 0 },
  { goldPerMinute: 540, turretPlatesTaken: 5 },
  "MID",
  20,
), 10);
// 폴백 + 알 수 없는 포지션(csThreshold 기본값 6):
//   gpm 폴백: challenges.goldPerMinute 없음 -> goldEarned/minutes = 6000/20 = 300
//     goldPart = min(300/450, 1.2)*4 = (0.6666..)*4 = 2.6666..
//   csPerMinute=3, csThreshold=6 -> csPart = min(3/6,1.2)*4 = 0.5*4 = 2.0
//   plates 없음 -> 0
//   합 = 2.0 + 2.66666...*? -> 2.0 + 2.6666666666666665 = 4.666666... -> clamp10 -> 4.7
check("income stat fallback path (default threshold)", calcIncomeScore(
  { csPerMinute: 3, goldEarned: 6000 },
  {},
  "UNKNOWN_POS",
  20,
), 4.7);

// ─── calcVisionScore ────────────────────────────────────────────────────────
// minutes=20.
//   visionScorePerMinute = 1.5 -> min(1.5/1.5,1.2)*8 = 1*8 = 8
//   controlWardsPlaced = 8 -> cwPart = min(8,8)*0.25 = 2.0
//   합 = 10 -> clamp10 -> 10
check("vision full challenges path", calcVisionScore(
  { visionScore: 0 },
  { visionScorePerMinute: 1.5, controlWardsPlaced: 8 },
  20,
), 10);
// 폴백: challenges.visionScorePerMinute 없음 -> stats.visionScore/minutes
//   visionScore=15, minutes=20 -> vsPerMin = 0.75 -> min(0.75/1.5,1.2)*8 = 0.5*8 = 4.0
//   controlWards 없음 -> 0
//   합 = 4.0
check("vision stat fallback path", calcVisionScore(
  { visionScore: 15 },
  {},
  20,
), 4);

// ─── buildPlaytimeScore: 가중합 + label 경계 + minutes 하한 ──────────────────
// 헬퍼: 모든 카테고리가 동일 값 X가 되도록 입력을 구성하긴 어려우므로,
// 카테고리별 값을 알고 있는 입력을 만들고 overall 가중합을 직접 계산한다.
//
// 가중치: combat .25, income .20, vision .10, survival .20, objective .15, structure .10
//
// objective: events=[] -> calcObjectiveScore total 0 -> 5
// structure: team={} events=[] -> towerTakes 0, towerDiff 0
//   towerPart=0, diffPart=min(max(0+3,0),6)/6*4 = 3/6*4 = 2 -> clamp10 -> 2

// (A) 모든 카테고리를 10으로 -> overall = 10*(0.25+0.20+0.10+0.20) + 5*0.15 + ...
//     objective/structure는 위 고정값(5, 2)을 갖는다.
//     combat=10, income=10, vision=10, survival=10, objective=5, structure=2
//     overall = 10*.25 + 10*.20 + 10*.10 + 10*.20 + 5*.15 + 2*.10
//             = 2.5 + 2.0 + 1.0 + 2.0 + 0.75 + 0.2 = 8.45
//     주의: IEEE-754 상 8.45는 ...449999.. 로 저장되어 (8.45).toFixed(1) === "8.4".
//     따라서 overall === 8.4 (수학적 8.45가 아님). 이는 함수의 실제 동작이다.
//     label: 8.4 >= 8 -> "MVP급"
const inputMVP = {
  playerStats: {
    kda: 6, damageToChampions: 0, killParticipation: 0,
    csPerMinute: 8.4, goldEarned: 0,
    visionScore: 0,
    deaths: 1, // dpm = 1/20 = 0.05 <= 0.1 -> survival 10
  },
  challengeStats: {
    damagePerMinute: 800, killParticipation: 0.6, soloKills: 3,
    goldPerMinute: 540, turretPlatesTaken: 5,
    visionScorePerMinute: 1.5, controlWardsPlaced: 8,
  },
  matchInfo: { durationSeconds: 1200, position: "MID" }, // minutes = 20
  teamContext: {},
  timelineEvents: [],
};
check("buildPlaytimeScore MVP overall + categories", buildPlaytimeScore(inputMVP), {
  overall: 8.4,
  categories: { combat: 10, income: 10, vision: 10, survival: 10, objective: 5, structure: 2 },
  label: "MVP급",
});

// (B) "양호" 경계: overall 6~7.x 가 되도록.
//   survival을 낮춰 본다. deaths=6, minutes=20 -> dpm=0.3 -> survival 6
//   combat=10, income=10, vision=10, survival=6, objective=5, structure=2
//   overall = 2.5 + 2.0 + 1.0 + 6*.20(=1.2) + 0.75 + 0.2 = 7.65 -> 7.7 (round half? 7.65->7.7)
//   label: 7.7 >= 6 -> "양호"
const inputGood = {
  ...inputMVP,
  playerStats: { ...inputMVP.playerStats, deaths: 6 },
};
check("buildPlaytimeScore 양호 boundary", buildPlaytimeScore(inputGood), {
  overall: 7.7,
  categories: { combat: 10, income: 10, vision: 10, survival: 6, objective: 5, structure: 2 },
  label: "양호",
});

// (C) "보통" 경계: 모든 4개 가변 카테고리를 낮춰 overall 4~5.x.
//   combat 폴백 4.5, income 폴백 4.7, vision 폴백 4, survival deaths=4->dpm0.2->8
//   objective 5, structure 2
//   overall = 4.5*.25 + 4.7*.20 + 4*.10 + 8*.20 + 5*.15 + 2*.10
//           = 1.125 + 0.94 + 0.4 + 1.6 + 0.75 + 0.2 = 5.015 -> 5.0
//   label: 5.0 >= 4 -> "보통"
const inputAvg = {
  playerStats: {
    kda: 3, damageToChampions: 8000, killParticipation: 0.3,
    csPerMinute: 3, goldEarned: 6000,
    visionScore: 15,
    deaths: 4, // dpm 0.2 -> survival 8
  },
  challengeStats: {},
  matchInfo: { durationSeconds: 1200, position: "UNKNOWN_POS" }, // minutes 20, threshold 6
  teamContext: {},
  timelineEvents: [],
};
check("buildPlaytimeScore 보통 boundary", buildPlaytimeScore(inputAvg), {
  overall: 5,
  categories: { combat: 4.5, income: 4.7, vision: 4, survival: 8, objective: 5, structure: 2 },
  label: "보통",
});

// (D) "개선 필요": 모든 가변 카테고리 0에 가깝게.
//   stats 전부 0, deaths 폭주 -> survival 0.
//   combat: kda0->0, kp 폴백 0, dpm 폴백 0/20=0, solo 0 -> 0
//   income: csPart 0, gold 폴백 0, plate 0 -> 0
//   vision: vsPerMin 0 -> 0
//   survival: deaths=20 dpm=1 -> clamp10(2-(0.6)*5)=clamp10(-1)=0
//   objective 5, structure 2
//   overall = 0 + 0 + 0 + 0 + 5*.15 + 2*.10 = 0.75 + 0.2 = 0.95
//   주의: IEEE-754 상 0.95는 ...94999.. 로 저장되어 (0.95).toFixed(1) === "0.9".
//   따라서 overall === 0.9 (실제 동작). 0.9 < 4 -> "개선 필요"
const inputPoor = {
  playerStats: {
    kda: 0, damageToChampions: 0, killParticipation: 0,
    csPerMinute: 0, goldEarned: 0,
    visionScore: 0,
    deaths: 20,
  },
  challengeStats: {},
  matchInfo: { durationSeconds: 1200, position: "ADC" },
  teamContext: {},
  timelineEvents: [],
};
check("buildPlaytimeScore 개선 필요 boundary", buildPlaytimeScore(inputPoor), {
  overall: 0.9,
  categories: { combat: 0, income: 0, vision: 0, survival: 0, objective: 5, structure: 2 },
  label: "개선 필요",
});

// (E) minutes 하한: durationSeconds=0 같은 비정상 매치에서도 overall이 유한수여야 한다.
//   minutes = Math.max(1, 0/60) = 1. 분모 0/NaN 방지.
const inputZeroDuration = {
  playerStats: {
    kda: 2, damageToChampions: 400, killParticipation: 0.2,
    csPerMinute: 5, goldEarned: 400,
    visionScore: 1,
    deaths: 1, // dpm = 1/1 = 1 -> survival 0 경로지만 유한
  },
  challengeStats: {},
  matchInfo: { durationSeconds: 0, position: "TOP" },
  teamContext: {},
  timelineEvents: [],
};
const zeroResult = buildPlaytimeScore(inputZeroDuration);
checkTrue(
  "buildPlaytimeScore durationSeconds=0 -> overall is finite",
  Number.isFinite(zeroResult.overall),
);
checkTrue(
  "buildPlaytimeScore durationSeconds=0 -> all categories finite",
  Object.values(zeroResult.categories).every(Number.isFinite),
);
// negative duration도 하한 1분으로 처리되어 유한해야 한다.
const negResult = buildPlaytimeScore({ ...inputZeroDuration, matchInfo: { durationSeconds: -30, position: "TOP" } });
checkTrue(
  "buildPlaytimeScore negative duration -> overall is finite",
  Number.isFinite(negResult.overall),
);

// (F) challengeStats 자체가 누락(undefined)된 매치에서도 폴백으로 동작해야 한다.
//   buildPlaytimeScore 내부: challenges = normalized.challengeStats || {}
const inputNoChallenges = {
  playerStats: {
    kda: 3, damageToChampions: 8000, killParticipation: 0.3,
    csPerMinute: 3, goldEarned: 6000,
    visionScore: 15,
    deaths: 4,
  },
  // challengeStats 누락
  matchInfo: { durationSeconds: 1200, position: "UNKNOWN_POS" },
  teamContext: {},
  timelineEvents: [],
};
check("buildPlaytimeScore missing challengeStats uses stat fallback", buildPlaytimeScore(inputNoChallenges), {
  overall: 5,
  categories: { combat: 4.5, income: 4.7, vision: 4, survival: 8, objective: 5, structure: 2 },
  label: "보통",
});

// (G) 가중치 합이 1.00 임을 문서화하는 메타 체크 (회귀 가드).
checkTrue(
  "buildPlaytimeScore source uses documented weights",
  buildPlaytimeScore.toString().includes("combat * 0.25")
    && buildPlaytimeScore.toString().includes("income * 0.20")
    && buildPlaytimeScore.toString().includes("vision * 0.10")
    && buildPlaytimeScore.toString().includes("survival * 0.20")
    && buildPlaytimeScore.toString().includes("objective * 0.15")
    && buildPlaytimeScore.toString().includes("structure * 0.10"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
