// Phase 33 — server.js 룰 기반 fallback 빌더 회귀 테스트 (강점/약점/액션)
//
// 동작 원리: server.js를 텍스트로 읽어 함수/상수를 추출 → new Function 평가.
// 검증 대상: AI 분석이 실패할 때 사용되는 룰 기반 fallback의 분기 경계를 고정.
//   - bestObjectiveSummary / bestFightSummary: 임계 분기
//   - lowFarmThreshold (+ CS_LOW_FARM_THRESHOLDS): 포지션별 저파밍 바닥선
//   - buildStrengths: 4분기 + while 패딩 → 항상 길이 3
//   - buildWeaknesses: 4분기 + while 패딩 → 항상 길이 3
//   - buildActionChecklist: index 기반 액션 매핑
//   - filterPostObjectiveDeaths (+ POST_OBJECTIVE_DEATH_WINDOW_MS): 120s 윈도 경계

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

const objectiveFailPolicySources = serverSrc.includes("const OBJECTIVE_FAIL_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "OBJECTIVE_FAIL_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isObjectiveFailEvent"),
    ]
  : [
      'const OBJECTIVE_FAIL_EVENT_TYPES = new Set(["OBJECTIVE_SETUP_FAIL"]);',
      'function isObjectiveFailEvent(event) { return OBJECTIVE_FAIL_EVENT_TYPES.has(event.eventType); }',
    ];

const structureTakePolicySources = serverSrc.includes("const STRUCTURE_TAKE_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "STRUCTURE_TAKE_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isStructureTakeEvent"),
    ]
  : [
      'const STRUCTURE_TAKE_EVENT_TYPES = new Set(["TOWER_TAKE"]);',
      'function isStructureTakeEvent(event) { return STRUCTURE_TAKE_EVENT_TYPES.has(event.eventType); }',
    ];

const playerDeathPolicySources = serverSrc.includes("const PLAYER_DEATH_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    ]
  : [
      'const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);',
      'function isPlayerDeathEvent(event) { return PLAYER_DEATH_EVENT_TYPES.has(event.eventType); }',
    ];

const env = new Function(
  [
    extractConstSource(serverSrc, "POST_OBJECTIVE_DEATH_WINDOW_MS"),
    extractConstSource(serverSrc, "CS_LOW_FARM_THRESHOLDS"),
    extractFunctionSource(serverSrc, "timestampLabel"),
    extractFunctionSource(serverSrc, "phaseFor"),
    extractFunctionSource(serverSrc, "rawEventTimestampMs"),
    extractFunctionSource(serverSrc, "timelineEventTimestampLabel"),
    extractFunctionSource(serverSrc, "filterPostObjectiveDeaths"),
    extractConstSource(serverSrc, "OBJECTIVE_WIN_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isObjectiveWinEvent"),
    ...objectiveFailPolicySources,
    ...structureTakePolicySources,
    ...playerDeathPolicySources,
    extractConstSource(serverSrc, "MACRO_OBJECTIVE_WIN_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isMacroObjectiveWinEvent"),
    extractConstSource(serverSrc, "FIGHT_CONTRIBUTION_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isFightContributionEvent"),
    extractFunctionSource(serverSrc, "bestObjectiveSummary"),
    extractFunctionSource(serverSrc, "bestFightSummary"),
    extractFunctionSource(serverSrc, "lowFarmThreshold"),
    extractConstSource(serverSrc, "ACTION_CHECKLIST_MIN"),
    extractConstSource(serverSrc, "ACTION_CHECKLIST_MAX"),
    extractConstSource(serverSrc, "INSIGHT_LIST_MIN"),
    extractConstSource(serverSrc, "INSIGHT_LIST_MAX"),
    extractConstSource(serverSrc, "VISION_STRENGTH_THRESHOLDS"),
    extractFunctionSource(serverSrc, "visionStrengthThreshold"),
    extractFunctionSource(serverSrc, "buildStrengths"),
    extractFunctionSource(serverSrc, "buildWeaknesses"),
    extractFunctionSource(serverSrc, "buildActionChecklist"),
    "return { filterPostObjectiveDeaths, bestObjectiveSummary, bestFightSummary, lowFarmThreshold, buildStrengths, buildWeaknesses, buildActionChecklist };",
  ].join("\n"),
)();
const {
  filterPostObjectiveDeaths, bestObjectiveSummary, bestFightSummary, lowFarmThreshold,
  buildStrengths, buildWeaknesses, buildActionChecklist,
} = env;
const buildStrengthsSrc = extractFunctionSource(serverSrc, "buildStrengths");
const buildWeaknessesSrc = extractFunctionSource(serverSrc, "buildWeaknesses");
const bestObjectiveSummarySrc = extractFunctionSource(serverSrc, "bestObjectiveSummary");
const bestFightSummarySrc = extractFunctionSource(serverSrc, "bestFightSummary");
const buildDerivedSignalsSrc = extractFunctionSource(serverSrc, "buildDerivedSignals");
const buildPhaseSummariesSrc = extractFunctionSource(serverSrc, "buildPhaseSummaries");

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

const obj = (eventType, extra = {}) => ({ eventType, ...extra });
function ev(eventType, i, extra = {}) {
  return { eventType, eventId: `e${i}`, timestampLabel: `${i}:00`, summary: `s${i}`, laneHint: `l${i}`, ...extra };
}

// ─── bestObjectiveSummary (>=4 / >=2 / else) ──────────────────────────────────
const dragons = (n) => Array.from({ length: n }, (_, i) => obj("DRAGON_FIGHT", { eventId: `d${i}` }));
check("bestObjectiveSummary 4 wins", bestObjectiveSummary({ timelineEvents: dragons(4) }), "주요 오브젝트 타이밍을 꾸준히 챙겼음");
check("bestObjectiveSummary 2 wins", bestObjectiveSummary({ timelineEvents: dragons(2) }), "오브젝트 타이밍에 자주 합류했음");
check("bestObjectiveSummary 1 win → null", bestObjectiveSummary({ timelineEvents: dragons(1) }), null);
check("bestObjectiveSummary 0 win → null", bestObjectiveSummary({ timelineEvents: [] }), null);
checkTrue(
  "server defines OBJECTIVE_WIN_EVENT_TYPES",
  serverSrc.includes('const OBJECTIVE_WIN_EVENT_TYPES = new Set(["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"]);'),
);
checkTrue(
  "bestObjectiveSummary uses isObjectiveWinEvent",
  bestObjectiveSummarySrc.includes("timelineEvents.filter(isObjectiveWinEvent)"),
);
checkTrue(
  "server defines OBJECTIVE_FAIL_EVENT_TYPES",
  serverSrc.includes('const OBJECTIVE_FAIL_EVENT_TYPES = new Set(["OBJECTIVE_SETUP_FAIL"]);'),
);
checkTrue(
  "server defines isObjectiveFailEvent",
  serverSrc.includes("function isObjectiveFailEvent(event)"),
);
checkTrue(
  "buildDerivedSignals uses isObjectiveFailEvent",
  buildDerivedSignalsSrc.includes("events.filter(isObjectiveFailEvent)"),
);
checkTrue(
  "buildPhaseSummaries uses isObjectiveFailEvent",
  buildPhaseSummariesSrc.includes("phaseEvents.filter(isObjectiveFailEvent).length"),
);
checkTrue(
  "server defines MACRO_OBJECTIVE_WIN_EVENT_TYPES",
  serverSrc.includes('const MACRO_OBJECTIVE_WIN_EVENT_TYPES = new Set([...OBJECTIVE_WIN_EVENT_TYPES, "TOWER_TAKE"]);'),
);
checkTrue(
  "server defines isMacroObjectiveWinEvent",
  serverSrc.includes("function isMacroObjectiveWinEvent(event)"),
);
checkTrue(
  "buildDerivedSignals uses isMacroObjectiveWinEvent",
  buildDerivedSignalsSrc.includes("events.filter(isMacroObjectiveWinEvent)"),
);
checkTrue(
  "buildDerivedSignals late structure uses isStructureTakeEvent",
  buildDerivedSignalsSrc.includes('eventPhase(event) === "LATE" && isStructureTakeEvent(event)'),
);
checkTrue(
  "server defines PLAYER_DEATH_EVENT_TYPES",
  serverSrc.includes('const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);'),
);
checkTrue(
  "server defines isPlayerDeathEvent",
  serverSrc.includes("function isPlayerDeathEvent(event)"),
);
checkTrue(
  "buildDerivedSignals uses isPlayerDeathEvent",
  buildDerivedSignalsSrc.includes("events.filter(isPlayerDeathEvent)"),
);
checkTrue(
  "buildPhaseSummaries uses isMacroObjectiveWinEvent",
  buildPhaseSummariesSrc.includes("phaseEvents.filter(isMacroObjectiveWinEvent).length"),
);

// ─── bestFightSummary (combat>=3 OR KP>=0.35) ─────────────────────────────────
const STR = "교전 후속 합류 기여가 좋았음";
check("bestFightSummary 3 combat, low KP", bestFightSummary({ timelineEvents: [obj("CHAMPION_KILL"), obj("SKIRMISH_WIN"), obj("TEAMFIGHT_FOLLOWUP")], playerStats: { killParticipation: 0 } }), STR);
check("bestFightSummary 0 combat, KP 0.35 (boundary)", bestFightSummary({ timelineEvents: [], playerStats: { killParticipation: 0.35 } }), STR);
check("bestFightSummary 0 combat, KP 0.34999 → null", bestFightSummary({ timelineEvents: [], playerStats: { killParticipation: 0.34999 } }), null);
check("bestFightSummary 2 combat, low KP → null", bestFightSummary({ timelineEvents: [obj("CHAMPION_KILL"), obj("SKIRMISH_WIN")], playerStats: { killParticipation: 0.1 } }), null);
checkTrue(
  "server defines FIGHT_CONTRIBUTION_EVENT_TYPES",
  serverSrc.includes('const FIGHT_CONTRIBUTION_EVENT_TYPES = new Set(["CHAMPION_KILL", "TEAMFIGHT_FOLLOWUP", "SKIRMISH_WIN"]);'),
);
checkTrue(
  "server defines isFightContributionEvent",
  serverSrc.includes("function isFightContributionEvent(event)"),
);
checkTrue(
  "bestFightSummary uses isFightContributionEvent",
  bestFightSummarySrc.includes("timelineEvents.filter(isFightContributionEvent)"),
);
checkTrue(
  "buildStrengths fight evidence uses isFightContributionEvent",
  buildStrengthsSrc.includes(".filter(isFightContributionEvent)"),
);

// ─── lowFarmThreshold (CS_LOW_FARM_THRESHOLDS + ||0) ──────────────────────────
check("lowFarmThreshold TOP", lowFarmThreshold("TOP"), 6);
check("lowFarmThreshold ADC", lowFarmThreshold("ADC"), 6.5);
check("lowFarmThreshold JUNGLE", lowFarmThreshold("JUNGLE"), 4.5);
check("lowFarmThreshold SUPPORT", lowFarmThreshold("SUPPORT"), 0);
check("lowFarmThreshold UNKNOWN → 0", lowFarmThreshold("UNKNOWN"), 0);

// ─── filterPostObjectiveDeaths (120s 윈도 경계) ───────────────────────────────
const objWin = [{ timestampMs: 100000 }];
check("postObj death at +120000ms (boundary, included)", filterPostObjectiveDeaths([{ timestampMs: 220000 }], objWin).length, 1);
check("postObj death at +120001ms (excluded)", filterPostObjectiveDeaths([{ timestampMs: 220001 }], objWin).length, 0);
check("postObj death BEFORE objective (excluded)", filterPostObjectiveDeaths([{ timestampMs: 50000 }], objWin).length, 0);

// ─── buildStrengths — 항상 길이 3 (while 패딩) ────────────────────────────────
// A) objective(4 dragon) + fight(3 kill) + vision(ADC>=25) → str_01/02/03
const strA = buildStrengths({
  timelineEvents: [
    ev("DRAGON_FIGHT", 1), ev("DRAGON_FIGHT", 2), ev("DRAGON_FIGHT", 3), ev("DRAGON_FIGHT", 4),
    ev("CHAMPION_KILL", 5), ev("CHAMPION_KILL", 6), ev("SKIRMISH_WIN", 7),
  ],
  matchInfo: { result: "WIN", position: "ADC" },
  playerStats: { visionScore: 30, killParticipation: 0.5 },
});
check("buildStrengths A length 3", strA.length, 3);
check("buildStrengths A ids", strA.map((s) => s.id), ["str_01", "str_02", "str_03"]);
check("buildStrengths A titles", strA.map((s) => s.title), [
  "주요 오브젝트 타이밍을 꾸준히 챙겼음",
  "교전 후속 합류 기여가 좋았음",
  "시야 투자량이 높은 편이었음",
]);
checkTrue(
  "buildStrengths caches fightTitle",
  buildStrengthsSrc.includes("const fightTitle = bestFightSummary(normalized);"),
);
checkTrue(
  "buildStrengths uses cached fightTitle as title",
  buildStrengthsSrc.includes("title: fightTitle,"),
);
check("buildStrengths A objective relatedEventIds (4 dragons)", strA[0].relatedEventIds, ["e1", "e2", "e3", "e4"]);
check("buildStrengths A fight relatedEventIds (3 combat)", strA[1].relatedEventIds, ["e5", "e6", "e7"]);
checkTrue(
  "buildStrengths objective evidence uses isObjectiveWinEvent",
  buildStrengthsSrc.includes(".filter(isObjectiveWinEvent)"),
);
checkTrue(
  "server defines VISION_STRENGTH_THRESHOLDS",
  serverSrc.includes("const VISION_STRENGTH_THRESHOLDS = { JUNGLE: 35, DEFAULT: 25 };"),
);
checkTrue(
  "buildStrengths uses visionStrengthThreshold",
  buildStrengthsSrc.includes("visionStrengthThreshold(normalized.matchInfo.position)"),
);

// B) 모든 분기 미발동 → while 패딩으로 3개
const strB = buildStrengths({
  timelineEvents: [],
  matchInfo: { result: "LOSS", position: "ADC" },
  playerStats: { visionScore: 5, killParticipation: 0 },
});
check("buildStrengths B padded length 3", strB.length, 3);
check("buildStrengths B all padding title", strB.every((s) => s.title === "주요 구도에 계속 합류했음"), true);
check("buildStrengths B ids sequential", strB.map((s) => s.id), ["str_01", "str_02", "str_03"]);
checkTrue(
  "buildStrengths uses INSIGHT_LIST_MIN padding",
  buildStrengthsSrc.includes("while (strengths.length < INSIGHT_LIST_MIN)"),
);

// C) tower fallback (WIN + TOWER_TAKE, objective<2)
const strC = buildStrengths({
  timelineEvents: [ev("DRAGON_FIGHT", 1), ev("TOWER_TAKE", 2), ev("TOWER_TAKE", 3)],
  matchInfo: { result: "WIN", position: "TOP" },
  playerStats: { visionScore: 5, killParticipation: 0 },
});
check("buildStrengths C first is tower fallback", strC[0].title, "구조물 압박으로 승리 조건을 연결했음");
check("buildStrengths C length 3", strC.length, 3);
checkTrue(
  "buildStrengths tower fallback gate uses isStructureTakeEvent",
  buildStrengthsSrc.includes("events.some(isStructureTakeEvent)"),
);
checkTrue(
  "buildStrengths tower fallback evidence uses isStructureTakeEvent",
  buildStrengthsSrc.includes(".filter(isStructureTakeEvent)"),
);
checkTrue(
  "buildStrengths tower fallback gate uses INSIGHT_LIST_MIN",
  buildStrengthsSrc.includes("strengths.length < INSIGHT_LIST_MIN &&"),
);
checkTrue(
  "buildStrengths uses INSIGHT_LIST_MAX cap",
  buildStrengthsSrc.includes("return strengths.slice(0, INSIGHT_LIST_MAX);"),
);

// JUNGLE vision 경계: 35 추가 / 34 미추가
const strJ35 = buildStrengths({ timelineEvents: [], matchInfo: { result: "LOSS", position: "JUNGLE" }, playerStats: { visionScore: 35, killParticipation: 0 } });
checkTrue("buildStrengths JUNGLE vision 35 → vision strength present", strJ35.some((s) => s.id === "str_03" && s.title === "시야 투자량이 높은 편이었음"));
const strJ34 = buildStrengths({ timelineEvents: [], matchInfo: { result: "LOSS", position: "JUNGLE" }, playerStats: { visionScore: 34, killParticipation: 0 } });
checkTrue("buildStrengths JUNGLE vision 34 → no vision strength", !strJ34.some((s) => s.title === "시야 투자량이 높은 편이었음"));
const strAdc25 = buildStrengths({ timelineEvents: [], matchInfo: { result: "LOSS", position: "ADC" }, playerStats: { visionScore: 25, killParticipation: 0 } });
checkTrue("buildStrengths ADC vision 25 -> vision strength present", strAdc25.some((s) => s.id === "str_03" && s.title === "시야 투자량이 높은 편이었음"));
const strAdc24 = buildStrengths({ timelineEvents: [], matchInfo: { result: "LOSS", position: "ADC" }, playerStats: { visionScore: 24, killParticipation: 0 } });
checkTrue("buildStrengths ADC vision 24 -> no vision strength", !strAdc24.some((s) => s.title === "시야 투자량이 높은 편이었음"));

// ─── buildWeaknesses — 항상 길이 3 (while 패딩) ─────────────────────────────
// A) early(2) + cs(ADC csPerMinute 3<6.5) + postObjective → weak_01/02/03
const wkA = buildWeaknesses({
  timelineEvents: [
    { eventType: "DRAGON_FIGHT", timestampMs: 100000, eventId: "o1", timestampLabel: "1:40", summary: "dragon" },
    { eventType: "PLAYER_DEATH", phase: "EARLY", timestampMs: 30000, eventId: "d1", timestampLabel: "0:30", summary: "death1" },
    { eventType: "PLAYER_DEATH", phase: "EARLY", timestampMs: 50000, eventId: "d2", timestampLabel: "0:50", summary: "death2" },
    { eventType: "PLAYER_DEATH", phase: "MID", timestampMs: 150000, eventId: "d3", timestampLabel: "2:30", summary: "death3" },
  ],
  matchInfo: { result: "LOSS", position: "ADC" },
  playerStats: { csPerMinute: 3, cs: 60, deaths: 3 },
});
check("buildWeaknesses A length 3", wkA.length, 3);
check("buildWeaknesses A ids", wkA.map((w) => w.id), ["weak_01", "weak_02", "weak_03"]);
check("buildWeaknesses A titles", wkA.map((w) => w.title), [
  "초반 안정감이 낮았음",
  "자원 전환 속도가 느렸음",
  "오브젝트 이후 생존과 전환이 아쉬웠음",
]);
checkTrue(
  "buildWeaknesses objective wins use isObjectiveWinEvent",
  buildWeaknessesSrc.includes("const objectiveWins = events.filter(isObjectiveWinEvent);"),
);
checkTrue(
  "buildWeaknesses deaths use isPlayerDeathEvent",
  buildWeaknessesSrc.includes("const deaths = events.filter(isPlayerDeathEvent);"),
);

// B) SUPPORT는 CS 약점 안 만듦(임계 0). 모든 분기 skip → fallback 3개로 패딩.
const wkB = buildWeaknesses({
  timelineEvents: [],
  matchInfo: { result: "WIN", position: "SUPPORT" },
  playerStats: { csPerMinute: 0.5, cs: 10, deaths: 2 },
});
check("buildWeaknesses B padded length 3", wkB.length, 3);
check("buildWeaknesses B ids sequential", wkB.map((w) => w.id), ["weak_01", "weak_02", "weak_03"]);
check("buildWeaknesses B all fallback title", wkB.every((w) => w.title === "중요 구도 판단을 더 빠르게 정리할 필요가 있음"), true);
checkTrue(
  "buildWeaknesses objective fails use isObjectiveFailEvent",
  buildWeaknessesSrc.includes("const objectiveFailEvents = events.filter(isObjectiveFailEvent);"),
);
checkTrue(
  "buildWeaknesses fallback uses cached objectiveFailEvents",
  buildWeaknessesSrc.includes("objectiveFailEvents.length ? objectiveFailEvents.slice(0, 2) : deaths.slice(0, 2);"),
);
checkTrue(
  "buildWeaknesses uses INSIGHT_LIST_MIN padding",
  buildWeaknessesSrc.includes("while (weaknesses.length < INSIGHT_LIST_MIN)"),
);

// C) WIN deaths>=5 → 3번 분기, then fallback으로 3개까지 패딩. cs는 SUPPORT라 skip.
const wkC = buildWeaknesses({
  timelineEvents: [],
  matchInfo: { result: "WIN", position: "SUPPORT" },
  playerStats: { csPerMinute: 1, cs: 20, deaths: 5 },
});
check("buildWeaknesses C padded length 3", wkC.length, 3);
check("buildWeaknesses C ids", wkC.map((w) => w.id), ["weak_01", "weak_02", "weak_03"]);
checkTrue(
  "buildWeaknesses uses INSIGHT_LIST_MAX cap",
  buildWeaknessesSrc.includes("return weaknesses.slice(0, INSIGHT_LIST_MAX);"),
);
check("buildWeaknesses C first title (objective-after via death count)", wkC[0].title, "오브젝트 이후 생존과 전환이 아쉬웠음");

// LOSS deaths>=4 경계: 4 발동 / 3 미발동(SUPPORT, 다른 분기 모두 skip 시 fallback만)
const wkLoss4 = buildWeaknesses({ timelineEvents: [], matchInfo: { result: "LOSS", position: "SUPPORT" }, playerStats: { csPerMinute: 1, cs: 20, deaths: 4 } });
checkTrue("buildWeaknesses LOSS deaths 4 → objective-after present", wkLoss4.some((w) => w.title === "오브젝트 이후 생존과 전환이 아쉬웠음"));
const wkLoss3 = buildWeaknesses({ timelineEvents: [], matchInfo: { result: "LOSS", position: "SUPPORT" }, playerStats: { csPerMinute: 1, cs: 20, deaths: 3 } });
checkTrue("buildWeaknesses LOSS deaths 3 → no objective-after", !wkLoss3.some((w) => w.title === "오브젝트 이후 생존과 전환이 아쉬웠음"));

// ─── buildActionChecklist — index 기반 매핑, max cap + min padding ─────────────
const hints = ["h0", "h1", "h2", "h3", "h4", "h5"].map((h) => ({ improvementHint: h }));
const acts = buildActionChecklist({}, hints);
check("actionChecklist length capped at max 5", acts.length, 5);
check("actionChecklist ids", acts.map((a) => a.id), ["act_01", "act_02", "act_03", "act_04", "act_05"]);
check("actionChecklist priorities", acts.map((a) => a.priority), [1, 2, 3, 4, 5]);
check("actionChecklist reasons mirror improvementHint", acts.map((a) => a.reason), ["h0", "h1", "h2", "h3", "h4"]);
check("actionChecklist action[0]", acts[0].action, "초반 주요 구도 직후에는 한 템포 먼저 빠지는 기준 만들기");
check("actionChecklist action[1]", acts[1].action, "교전이 비는 구간에는 웨이브나 캠프를 더 확실하게 챙겨 자원 손실 줄이기");
check("actionChecklist action[2]", acts[2].action, "드래곤·바론 직후에는 추가 추격보다 리셋과 라인 정리를 먼저 선택하기");
check("actionChecklist action[3+]", acts[3].action, "시야가 밀릴 때는 contest와 이탈 중 하나를 더 빠르게 결정하기");
check("actionChecklist action[4+]", acts[4]?.action, "시야가 밀릴 때는 contest와 이탈 중 하나를 더 빠르게 결정하기");

const singleWeaknessChecklist = buildActionChecklist({}, [{ improvementHint: "only" }]);
check("actionChecklist single weakness pads to min 3", singleWeaknessChecklist.length, 3);
check("actionChecklist single weakness keeps first reason", singleWeaknessChecklist[0].reason, "only");
check("actionChecklist single weakness pads fallback reasons",
  singleWeaknessChecklist.slice(1).every((a) => a.reason === "체크리스트 최소 항목을 채우기 위한 기본 개선 루틴"), true);

const emptyWeaknessChecklist = buildActionChecklist({}, []);
check("actionChecklist empty weakness list pads to min 3", emptyWeaknessChecklist.length, 3);
check("actionChecklist empty weakness ids", emptyWeaknessChecklist.map((a) => a.id), ["act_01", "act_02", "act_03"]);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
