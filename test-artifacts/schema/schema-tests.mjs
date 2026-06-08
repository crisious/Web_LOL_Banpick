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

function extractConstSource(source, name) {
  const m = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[0];
}

const validatorSupportSources = [];
if (serverSrc.includes("const KEY_MOMENTS_MIN =")) {
  validatorSupportSources.push(
    extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
    extractFunctionSource(serverSrc, "hasMinimumKeyMoments"),
  );
}
if (serverSrc.includes("const PHASE_SUMMARIES_MIN =")) {
  validatorSupportSources.push(
    extractConstSource(serverSrc, "PHASE_SUMMARIES_MIN"),
    extractFunctionSource(serverSrc, "hasValidPhaseSummaries"),
  );
}
if (serverSrc.includes("function hasAnalysisMetaObject(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasAnalysisMetaObject"));
}
if (serverSrc.includes("function hasValidEvidenceIndex(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidEvidenceIndex"));
}
if (serverSrc.includes("const ACTION_CHECKLIST_MIN =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "ACTION_CHECKLIST_MIN"));
}
if (serverSrc.includes("const ACTION_CHECKLIST_MAX =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "ACTION_CHECKLIST_MAX"));
}
if (serverSrc.includes("function hasValidActionChecklist(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidActionChecklist"));
}
if (serverSrc.includes("const INSIGHT_LIST_MIN =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "INSIGHT_LIST_MIN"));
}
if (serverSrc.includes("const INSIGHT_LIST_MAX =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "INSIGHT_LIST_MAX"));
}
if (serverSrc.includes("function hasValidInsightList(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidInsightList"));
}

const validateSrc = extractFunctionSource(serverSrc, "validateAnalysisOutput");
const validateAnalysisOutput = new Function(
  `${validatorSupportSources.join("\n")}\n${validateSrc}\nreturn validateAnalysisOutput;`,
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
      { id: "km_2", timestampLabel: "12:00", title: "t", description: "d" },
      { id: "km_3", timestampLabel: "16:00", title: "t", description: "d" },
      { id: "km_4", timestampLabel: "20:00", title: "t", description: "d" },
    ],
    evidenceIndex: [{ eventId: "evt_001", summary: "핵심 근거" }],
  };
}

// ─── 케이스 ──────────────────────────────────────────────────────────────────

expectOk("valid fixture passes", () => validateAnalysisOutput(validFixture()));

expectThrows("missing schemaVersion throws", () => {
  const f = validFixture(); delete f.schemaVersion;
  validateAnalysisOutput(f);
}, "schemaVersion");

expectThrows("missing analysisMeta throws", () => {
  const f = validFixture();
  delete f.analysisMeta;
  validateAnalysisOutput(f);
}, "analysisMeta");

expectThrows("analysisMeta as string throws", () => {
  const f = validFixture();
  f.analysisMeta = "claude_ai";
  validateAnalysisOutput(f);
}, "analysisMeta");

expectThrows("analysisMeta missing sourceType throws", () => {
  const f = validFixture();
  delete f.analysisMeta.sourceType;
  validateAnalysisOutput(f);
}, "analysisMeta.sourceType");

expectThrows("analysisMeta empty sourceType throws", () => {
  const f = validFixture();
  f.analysisMeta.sourceType = "";
  validateAnalysisOutput(f);
}, "analysisMeta.sourceType");

expectThrows("analysisMeta missing language throws", () => {
  const f = validFixture();
  delete f.analysisMeta.language;
  validateAnalysisOutput(f);
}, "analysisMeta.language");

expectThrows("analysisMeta empty language throws", () => {
  const f = validFixture();
  f.analysisMeta.language = "";
  validateAnalysisOutput(f);
}, "analysisMeta.language");

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

expectThrows("strengths item missing id throws", () => {
  const f = validFixture();
  f.strengths = [{ title: "좋은 합류", description: "설명", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths item missing title throws", () => {
  const f = validFixture();
  f.strengths = [{ id: "str_1", description: "설명", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths item missing description throws", () => {
  const f = validFixture();
  f.strengths = [{ id: "str_1", title: "좋은 합류", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths item missing relatedEventIds throws", () => {
  const f = validFixture();
  f.strengths = [{ id: "str_1", title: "좋은 합류", description: "설명" }];
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths over 3 throws", () => {
  const f = validFixture();
  f.strengths = Array.from({ length: 4 }, (_, index) => ({
    id: `str_${index + 1}`,
    title: `강점 ${index + 1}`,
    description: "설명",
    relatedEventIds: [],
  }));
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("weaknesses empty throws", () => {
  const f = validFixture(); f.weaknesses = [];
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("weaknesses item missing id throws", () => {
  const f = validFixture();
  f.weaknesses = [{ title: "아쉬운 전환", description: "설명", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("weaknesses item missing title throws", () => {
  const f = validFixture();
  f.weaknesses = [{ id: "wk_1", description: "설명", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("weaknesses item missing description throws", () => {
  const f = validFixture();
  f.weaknesses = [{ id: "wk_1", title: "아쉬운 전환", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("weaknesses item missing relatedEventIds throws", () => {
  const f = validFixture();
  f.weaknesses = [{ id: "wk_1", title: "아쉬운 전환", description: "설명" }];
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("weaknesses over 3 throws", () => {
  const f = validFixture();
  f.weaknesses = Array.from({ length: 4 }, (_, index) => ({
    id: `wk_${index + 1}`,
    title: `약점 ${index + 1}`,
    description: "설명",
    relatedEventIds: [],
  }));
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("actionChecklist empty throws", () => {
  const f = validFixture(); f.actionChecklist = [];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item empty id throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "", text: "준비하기" }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item missing id throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ text: "준비하기" }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item missing text/action throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "act_1", reason: "근거" }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item empty text/action throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "act_1", text: "" }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist over 5 throws", () => {
  const f = validFixture();
  f.actionChecklist = Array.from({ length: 6 }, (_, index) => ({
    id: `act_${index + 1}`,
    text: `체크 ${index + 1}`,
  }));
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("keyMoments only 1 throws (need ≥2)", () => {
  const f = validFixture(); f.keyMoments = [f.keyMoments[0]];
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments only 3 throws (need >=4)", () => {
  const f = validFixture(); f.keyMoments = f.keyMoments.slice(0, 3);
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("evidenceIndex missing throws", () => {
  const f = validFixture();
  delete f.evidenceIndex;
  validateAnalysisOutput(f);
}, "evidenceIndex");

expectThrows("evidenceIndex object throws", () => {
  const f = validFixture();
  f.evidenceIndex = { evt_001: { summary: "x" } };
  validateAnalysisOutput(f);
}, "evidenceIndex");

expectThrows("evidenceIndex empty throws", () => {
  const f = validFixture();
  f.evidenceIndex = [];
  validateAnalysisOutput(f);
}, "evidenceIndex");

expectThrows("evidenceIndex item missing eventId throws", () => {
  const f = validFixture();
  f.evidenceIndex = [{ summary: "근거" }];
  validateAnalysisOutput(f);
}, "evidenceIndex");

expectThrows("evidenceIndex item missing summary throws", () => {
  const f = validFixture();
  f.evidenceIndex = [{ eventId: "evt_001" }];
  validateAnalysisOutput(f);
}, "evidenceIndex");

expectThrows("phaseSummaries as object throws", () => {
  const f = validFixture();
  f.phaseSummaries = { early: { summary: "x" }, mid: { summary: "y" }, late: { summary: "z" } };
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries missing throws", () => {
  const f = validFixture();
  delete f.phaseSummaries;
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries only 2 throws", () => {
  const f = validFixture();
  f.phaseSummaries = f.phaseSummaries.slice(0, 2);
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries item missing phase throws", () => {
  const f = validFixture();
  f.phaseSummaries = [{ summary: "early" }, { phase: "MID", summary: "mid" }, { phase: "LATE", summary: "late" }];
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries item missing summary throws", () => {
  const f = validFixture();
  f.phaseSummaries = [{ phase: "EARLY" }, { phase: "MID", summary: "mid" }, { phase: "LATE", summary: "late" }];
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries item object missing throws", () => {
  const f = validFixture();
  f.phaseSummaries = [null, { phase: "MID", summary: "mid" }, { phase: "LATE", summary: "late" }];
  validateAnalysisOutput(f);
}, "phaseSummaries");

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
