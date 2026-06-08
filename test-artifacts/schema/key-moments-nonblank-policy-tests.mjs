// server.js key moments nonblank schema regression tests

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

const hasValidKeyMomentsSrc = extractFunctionSource(serverSrc, "hasValidKeyMoments");

const supportSources = [
  extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
  extractConstSource(serverSrc, "PHASE_SUMMARIES_MIN"),
  extractConstSource(serverSrc, "GAME_PHASES"),
  extractConstSource(serverSrc, "EVIDENCE_INDEX_MIN"),
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MIN"),
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MAX"),
  extractConstSource(serverSrc, "INSIGHT_LIST_MIN"),
  extractConstSource(serverSrc, "INSIGHT_LIST_MAX"),
  extractFunctionSource(serverSrc, "isValidGamePhase"),
  extractFunctionSource(serverSrc, "isNonBlankString"),
  extractFunctionSource(serverSrc, "hasMinimumKeyMoments"),
  hasValidKeyMomentsSrc,
  extractFunctionSource(serverSrc, "hasValidPhaseSummaries"),
  extractFunctionSource(serverSrc, "hasAnalysisMetaObject"),
  extractFunctionSource(serverSrc, "hasValidMatchSummary"),
  extractFunctionSource(serverSrc, "hasValidCoachSummary"),
  extractFunctionSource(serverSrc, "hasValidEvidenceIndex"),
  extractFunctionSource(serverSrc, "hasValidActionChecklist"),
  extractFunctionSource(serverSrc, "hasValidInsightList"),
  extractFunctionSource(serverSrc, "hasValidCombatAnalysis"),
  extractFunctionSource(serverSrc, "hasValidTeamfightPhaseAnalysis"),
];

const validateAnalysisOutput = new Function(
  `${supportSources.join("\n")}\n${extractFunctionSource(serverSrc, "validateAnalysisOutput")}\nreturn validateAnalysisOutput;`,
)();

let pass = 0;
let fail = 0;

function expectThrows(label, fn, expectedSubstring) {
  try {
    fn();
    console.log(`FAIL  ${label} - expected throw but did not`);
    fail += 1;
  } catch (err) {
    const ok = expectedSubstring ? err.message.includes(expectedSubstring) : true;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) console.log(`  expected message containing "${expectedSubstring}"\n  got "${err.message}"`);
    ok ? pass++ : fail++;
  }
}

function expectOk(label, fn) {
  try {
    fn();
    console.log(`PASS  ${label}`);
    pass += 1;
  } catch (err) {
    console.log(`FAIL  ${label} - unexpected throw: ${err.message}`);
    fail += 1;
  }
}

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

function validFixture() {
  return {
    schemaVersion: "1.0",
    analysisMeta: { sourceType: "claude_ai", language: "ko" },
    matchSummary: { headline: "한 줄 요약" },
    coachSummary: { overallSummary: "전체 흐름 요약" },
    phaseSummaries: [
      { phase: "EARLY", summary: "초반" },
      { phase: "MID", summary: "중반" },
      { phase: "LATE", summary: "후반" },
    ],
    strengths: [
      { id: "str_1", title: "좋은 합류", description: "교전 합류가 빨랐습니다.", relatedEventIds: [] },
      { id: "str_2", title: "시야 유지", description: "목표물 전 시야를 유지했습니다.", relatedEventIds: [] },
      { id: "str_3", title: "성장 관리", description: "CS 손실을 낮게 유지했습니다.", relatedEventIds: [] },
    ],
    weaknesses: [
      { id: "wk_1", title: "전환 지연", description: "처치 후 목표물 전환이 늦었습니다.", relatedEventIds: [] },
      { id: "wk_2", title: "귀환 타이밍", description: "라인 정리 전 귀환으로 웨이브를 잃었습니다.", relatedEventIds: [] },
      { id: "wk_3", title: "과한 진입", description: "시야 없이 깊게 진입했습니다.", relatedEventIds: [] },
    ],
    actionChecklist: [
      { id: "act_1", text: "첫 전령 전 강가 시야 확보" },
      { id: "act_2", text: "킬 이후 가까운 오브젝트 핑 확인" },
      { id: "act_3", text: "귀환 전 다음 웨이브 위치 확인" },
    ],
    keyMoments: [
      { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "초반 교전", description: "첫 교전 손실", relatedEventIds: ["evt_001"] },
      { id: "km_2", timestampLabel: "12:00", phase: "MID", title: "전령 전환", description: "전령 전환 성공", relatedEventIds: ["evt_001"] },
      { id: "km_3", timestampLabel: "16:00", phase: "MID", title: "용 시야", description: "용 전 시야 장악", relatedEventIds: ["evt_001"] },
      { id: "km_4", timestampLabel: "20:00", phase: "LATE", title: "후반 한타", description: "후반 한타 패배", relatedEventIds: ["evt_001"] },
    ],
    evidenceIndex: [{ eventId: "evt_001", summary: "핵심 근거" }],
  };
}

expectOk("valid key moments pass", () => validateAnalysisOutput(validFixture()));

expectOk("valid alternate key moment fields pass", () => {
  const f = validFixture();
  f.keyMoments[0] = {
    eventId: "km_event_1",
    timestamp: "08:30",
    phase: "EARLY",
    label: "초반 교전",
    reason: "정글 개입 이후 라인 손실",
    relatedEventIds: ["evt_001"],
  };
  validateAnalysisOutput(f);
});

expectThrows("keyMoments rejects whitespace id without eventId", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], id: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments rejects whitespace timestampLabel without timestamp", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], timestampLabel: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments rejects whitespace title without label", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], title: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments rejects whitespace description without reason", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], description: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments rejects whitespace relatedEventIds", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], relatedEventIds: ["evt_001", "   "] };
  validateAnalysisOutput(f);
}, "keyMoments");

checkTrue(
  "hasValidKeyMoments uses nonblank id alternate",
  hasValidKeyMomentsSrc.includes("isNonBlankString(item.id)") &&
    hasValidKeyMomentsSrc.includes("isNonBlankString(item.eventId)"),
);
checkTrue(
  "hasValidKeyMoments uses nonblank timestamp alternate",
  hasValidKeyMomentsSrc.includes("isNonBlankString(item.timestampLabel)") &&
    hasValidKeyMomentsSrc.includes("isNonBlankString(item.timestamp)"),
);
checkTrue(
  "hasValidKeyMoments uses nonblank title alternate",
  hasValidKeyMomentsSrc.includes("isNonBlankString(item.title)") &&
    hasValidKeyMomentsSrc.includes("isNonBlankString(item.label)"),
);
checkTrue(
  "hasValidKeyMoments uses nonblank description alternate",
  hasValidKeyMomentsSrc.includes("isNonBlankString(item.description)") &&
    hasValidKeyMomentsSrc.includes("isNonBlankString(item.reason)"),
);
checkTrue(
  "hasValidKeyMoments uses nonblank related event ids",
  hasValidKeyMomentsSrc.includes("item.relatedEventIds.every((id) => isNonBlankString(id))"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
