// Phase 33 — server.js buildCoachSummary 회귀 테스트
//
// 동작 원리: server.js를 텍스트로 읽어 함수/상수 추출 → new Function 평가.
// 검증 대상: buildCoachSummary는 프런트 코칭 요약 카드의 룰 기반 fallback 텍스트.
// 3개 필드(overallSummary/gameFlowSummary/winLossReason)가 각각:
//   - result(WIN/LOSS)
//   - objectiveEvents.length >= 3
//   - postObjectiveDeaths.length >= 1 (120s 윈도)
// 분기로 갈린다. 정확한 문자열을 핀으로 고정해 텍스트 드리프트를 차단.

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

const playerDeathPolicySources = serverSrc.includes("const PLAYER_DEATH_EVENT_TYPES =")
  ? [
      extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
      extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
    ]
  : [
      'const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);',
      'function isPlayerDeathEvent(event) { return PLAYER_DEATH_EVENT_TYPES.has(event.eventType); }',
    ];

const buildCoachSummarySrc = extractFunctionSource(serverSrc, "buildCoachSummary");
const calcObjectiveScoreSrc = extractFunctionSource(serverSrc, "calcObjectiveScore");

const { buildCoachSummary, calcObjectiveScore } = new Function(
  [
    extractConstSource(serverSrc, "POST_OBJECTIVE_DEATH_WINDOW_MS"),
    extractConstSource(serverSrc, "OBJECTIVE_WIN_EVENT_TYPES"),
    extractFunctionSource(serverSrc, "isObjectiveWinEvent"),
    ...objectiveFailPolicySources,
    ...playerDeathPolicySources,
    extractFunctionSource(serverSrc, "filterPostObjectiveDeaths"),
    extractFunctionSource(serverSrc, "clamp10"),
    extractFunctionSource(serverSrc, "calcObjectiveScore"),
    extractFunctionSource(serverSrc, "buildCoachSummary"),
    "return { buildCoachSummary, calcObjectiveScore };",
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

const T = {
  winOverall: "초반 흔들린 장면이 있었지만, 오브젝트 템포와 후속 한타 기여를 계속 만들어 결국 승리 구조를 유지한 경기였다.",
  lossOverall: "초반 손해와 반복된 데스로 성장 템포는 느렸지만, 오브젝트 타이밍에 계속 합류하며 끝까지 역전 기회를 만들었던 경기였다.",
  flowMany: "드래곤과 바론, 혹은 정글 오브젝트 관여가 꾸준히 나왔고, 경기의 핵심 흐름은 오브젝트 이후 전환을 얼마나 안정적으로 했는지에서 갈렸다.",
  flowFew: "교전과 구조물 구도가 반복되며 경기 흐름이 요동쳤고, 중요한 순간의 데스와 후속 합류가 승패에 큰 영향을 줬다.",
  reasonPostObj: "큰 오브젝트를 챙긴 뒤의 생존과 전환이 승패 차이를 만들었다.",
  reasonWin: "오브젝트 템포와 구조물 압박 연결이 승리의 핵심이었다.",
  reasonLoss: "초반 안정감과 중후반 운영 연결이 아쉬웠다.",
};

const objEvent = (ts) => ({ eventType: "DRAGON_FIGHT", timestampMs: ts });

check("calcObjectiveScore no objective events -> neutral", calcObjectiveScore([]), 5);
check("calcObjectiveScore 3 wins / 1 fail", calcObjectiveScore([
  { eventType: "DRAGON_FIGHT" },
  { eventType: "BARON_FIGHT" },
  { eventType: "OBJECTIVE_SETUP_WIN" },
  { eventType: "OBJECTIVE_SETUP_FAIL" },
]), 7.2);
check("calcObjectiveScore ignores tower take as objective win", calcObjectiveScore([
  { eventType: "TOWER_TAKE" },
  { eventType: "OBJECTIVE_SETUP_FAIL" },
]), 0);
checkTrue(
  "buildCoachSummary uses isObjectiveWinEvent",
  buildCoachSummarySrc.includes("timelineEvents.filter(isObjectiveWinEvent)"),
);
checkTrue(
  "buildCoachSummary deaths use isPlayerDeathEvent",
  buildCoachSummarySrc.includes("timelineEvents.filter(isPlayerDeathEvent)"),
);
checkTrue(
  "calcObjectiveScore uses isObjectiveWinEvent",
  calcObjectiveScoreSrc.includes("events.filter(isObjectiveWinEvent)"),
);
checkTrue(
  "calcObjectiveScore objective fails use isObjectiveFailEvent",
  calcObjectiveScoreSrc.includes("events.filter(isObjectiveFailEvent).length"),
);

// A) WIN, objectiveEvents=3 (>=3), postObjectiveDeaths=0
check("coachSummary WIN / 3 obj / 0 postObj", buildCoachSummary({
  matchInfo: { result: "WIN" },
  timelineEvents: [objEvent(100000), objEvent(200000), objEvent(300000)],
}), {
  overallSummary: T.winOverall,
  gameFlowSummary: T.flowMany,
  winLossReason: T.reasonWin,
});

// B) LOSS, objectiveEvents=1 (<3), postObjectiveDeaths>=1 (death 50s after dragon)
check("coachSummary LOSS / 1 obj / postObj death", buildCoachSummary({
  matchInfo: { result: "LOSS" },
  timelineEvents: [objEvent(100000), { eventType: "PLAYER_DEATH", timestampMs: 150000 }],
}), {
  overallSummary: T.lossOverall,
  gameFlowSummary: T.flowFew,
  winLossReason: T.reasonPostObj,
});

// C) LOSS, objectiveEvents=0, postObjectiveDeaths=0 → loss reason
check("coachSummary LOSS / 0 obj / 0 postObj", buildCoachSummary({
  matchInfo: { result: "LOSS" },
  timelineEvents: [{ eventType: "PLAYER_DEATH", timestampMs: 30000 }],
}), {
  overallSummary: T.lossOverall,
  gameFlowSummary: T.flowFew,
  winLossReason: T.reasonLoss,
});

// D) WIN, objectiveEvents=3, postObjectiveDeaths>=1 → postObj reason 우선
check("coachSummary WIN / postObj overrides win reason", buildCoachSummary({
  matchInfo: { result: "WIN" },
  timelineEvents: [objEvent(100000), objEvent(200000), objEvent(300000), { eventType: "PLAYER_DEATH", timestampMs: 150000 }],
}), {
  overallSummary: T.winOverall,
  gameFlowSummary: T.flowMany,
  winLossReason: T.reasonPostObj,
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
