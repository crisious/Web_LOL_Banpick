// Track G — server.js의 validateAnalysisOutput 회귀 테스트
//
// 동작 원리: server.js를 텍스트로 읽어 함수 본체를 추출 → new Function으로 평가.
// test-artifacts/champions-tab/aggregate-tests.mjs와 동일 패턴.
//
// 의존: 없음. node 환경에서 단독 실행:
//   node test-artifacts/schema/schema-tests.mjs
//
// 검증 대상: validateAnalysisOutput는 buildAnalysis의 최종 안전 게이트로,
// 정규화 후에도 남는 스키마 위반을 감지해 rule-based fallback을 트리거한다.
// 이 게이트가 깨지면 깨진 AI 응답이 그대로 사용자에게 노출된다.

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

const validateSrc = extractFunctionSource(serverSrc, "validateAnalysisOutput");
const validateAnalysisOutput = new Function(
  `${validateSrc}\nreturn validateAnalysisOutput;`,
)();

let pass = 0, fail = 0;

function expectThrows(label, fn, expectedSubstring) {
  try {
    fn();
    console.log(`FAIL  ${label} — expected throw but did not`);
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
    console.log(`FAIL  ${label} — unexpected throw: ${err.message}`);
    fail += 1;
  }
}

// 유효한 fixture (모든 분기 통과해야 함)
function validFixture() {
  return {
    schemaVersion: "1.0",
    analysisMeta: { sourceType: "claude_ai", language: "ko" },
    matchSummary: { headline: "한 줄 요약" },
    coachSummary: { overallSummary: "전체 흐름 요약" },
    phaseSummaries: [
      { phase: "EARLY", summary: "..." },
      { phase: "MID", summary: "..." },
      { phase: "LATE", summary: "..." },
    ],
    strengths: [{ id: "str_1", title: "t", description: "d", relatedEventIds: [] }],
    weaknesses: [{ id: "wk_1", title: "t", description: "d", relatedEventIds: [] }],
    actionChecklist: [{ id: "act_1", text: "t" }],
    keyMoments: [
      { id: "km_1", timestampLabel: "08:00", title: "t", description: "d" },
      { id: "km_2", timestampLabel: "20:00", title: "t", description: "d" },
    ],
    evidenceIndex: [],
  };
}

// ─── 케이스 ──────────────────────────────────────────────────────────────────

expectOk("valid fixture passes", () => validateAnalysisOutput(validFixture()));

expectThrows("missing schemaVersion throws", () => {
  const f = validFixture(); delete f.schemaVersion;
  validateAnalysisOutput(f);
}, "schemaVersion");

expectThrows("matchSummary as string throws (no .headline)", () => {
  const f = validFixture(); f.matchSummary = "단순 문자열";
  validateAnalysisOutput(f);
}, "matchSummary.headline");

expectThrows("coachSummary missing overallSummary throws", () => {
  const f = validFixture(); f.coachSummary = {};
  validateAnalysisOutput(f);
}, "coachSummary.overallSummary");

expectThrows("strengths empty throws", () => {
  const f = validFixture(); f.strengths = [];
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("weaknesses empty throws", () => {
  const f = validFixture(); f.weaknesses = [];
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("actionChecklist empty throws", () => {
  const f = validFixture(); f.actionChecklist = [];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("keyMoments only 1 throws (need ≥2)", () => {
  const f = validFixture(); f.keyMoments = [f.keyMoments[0]];
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("phaseSummaries as object (not array) — currently silent",
  () => {
    // validateAnalysisOutput는 phaseSummaries를 검사하지 않는다 (정규화 단계에서
    // 처리 가정). 여기서 명시적 throw가 없는 점이 의도된 동작인지 회귀 추적용으로
    // 기록. 향후 게이트 강화 시 이 테스트는 expectThrows로 전환.
    const f = validFixture();
    f.phaseSummaries = { early: { summary: "x" }, mid: { summary: "y" }, late: { summary: "z" } };
    validateAnalysisOutput(f);
    throw new Error("phaseSummaries-object-tolerated-by-validate"); // 의도된 marker
  },
  "phaseSummaries-object-tolerated-by-validate");

// ─── Phase 32: combatAnalysis 검증 (선택적 필드, backward-compat) ────────────

// 기본 fixture는 combatAnalysis 필드가 없음 → "valid fixture passes" 케이스로 이미
// 통과 확인. 아래는 필드가 있을 때의 형태 검증.

function withCombat(items) {
  const f = validFixture();
  f.combatAnalysis = items;
  return f;
}

expectOk("combatAnalysis: undefined → tolerated", () => {
  const f = validFixture();
  delete f.combatAnalysis;
  validateAnalysisOutput(f);
});

expectOk("combatAnalysis: null → tolerated", () => {
  const f = validFixture();
  f.combatAnalysis = null;
  validateAnalysisOutput(f);
});

expectOk("combatAnalysis: empty array → tolerated", () => {
  validateAnalysisOutput(withCombat([]));
});

expectOk("combatAnalysis: valid item passes", () => {
  validateAnalysisOutput(withCombat([
    { encounterId: "enc_001", situationLabel: "초반 갱킹 손실", takeaway: "와드 우선" },
  ]));
});

expectThrows("combatAnalysis: object instead of array throws",
  () => validateAnalysisOutput(withCombat({ enc_001: { takeaway: "x" } })),
  "combatAnalysis not array");

expectThrows("combatAnalysis: missing encounterId throws",
  () => validateAnalysisOutput(withCombat([{ situationLabel: "x", takeaway: "y" }])),
  "encounterId");

expectThrows("combatAnalysis: missing situationLabel throws",
  () => validateAnalysisOutput(withCombat([{ encounterId: "enc_001", takeaway: "y" }])),
  "situationLabel");

expectThrows("combatAnalysis: missing takeaway throws",
  () => validateAnalysisOutput(withCombat([{ encounterId: "enc_001", situationLabel: "x" }])),
  "takeaway");

expectThrows("combatAnalysis: empty string situationLabel throws",
  () => validateAnalysisOutput(withCombat([{ encounterId: "enc_001", situationLabel: "", takeaway: "y" }])),
  "situationLabel");

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
