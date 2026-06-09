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
if (serverSrc.includes("function hasValidKeyMoments(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidKeyMoments"));
}
if (serverSrc.includes("const PHASE_SUMMARIES_MIN =")) {
  validatorSupportSources.push(
    extractConstSource(serverSrc, "PHASE_SUMMARIES_MIN"),
  );
}
if (serverSrc.includes("const GAME_PHASES =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "GAME_PHASES"));
}
if (serverSrc.includes("function isValidGamePhase(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "isValidGamePhase"));
}
if (serverSrc.includes("function hasValidPhaseSummaries(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidPhaseSummaries"));
}
if (serverSrc.includes("function hasAnalysisMetaObject(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasAnalysisMetaObject"));
}
if (serverSrc.includes("function isNonBlankString(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "isNonBlankString"));
}
if (serverSrc.includes("function hasValidMatchSummary(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidMatchSummary"));
}
if (serverSrc.includes("function hasValidCoachSummary(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidCoachSummary"));
}
if (serverSrc.includes("const EVIDENCE_INDEX_MIN =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "EVIDENCE_INDEX_MIN"));
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
if (serverSrc.includes("function hasValidCombatAnalysis(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidCombatAnalysis"));
}
if (serverSrc.includes("function hasValidTeamfightPhaseAnalysis(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidTeamfightPhaseAnalysis"));
}

const validateSrc = extractFunctionSource(serverSrc, "validateAnalysisOutput");
const validateAnalysisOutput = new Function(
  `${validatorSupportSources.join("\n")}\n${validateSrc}\nreturn validateAnalysisOutput;`,
)();
const evidenceIndexValidatorSrc = extractFunctionSource(serverSrc, "hasValidEvidenceIndex");

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

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
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
    strengths: [
      { id: "str_1", title: "t1", description: "d1", relatedEventIds: [] },
      { id: "str_2", title: "t2", description: "d2", relatedEventIds: [] },
      { id: "str_3", title: "t3", description: "d3", relatedEventIds: [] },
    ],
    weaknesses: [
      { id: "wk_1", title: "t1", description: "d1", relatedEventIds: [] },
      { id: "wk_2", title: "t2", description: "d2", relatedEventIds: [] },
      { id: "wk_3", title: "t3", description: "d3", relatedEventIds: [] },
    ],
    actionChecklist: [
      { id: "act_1", text: "t1" },
      { id: "act_2", text: "t2" },
      { id: "act_3", text: "t3" },
    ],
    keyMoments: [
      { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "t", description: "d", relatedEventIds: ["evt_001"] },
      { id: "km_2", timestampLabel: "12:00", phase: "MID", title: "t", description: "d", relatedEventIds: ["evt_001"] },
      { id: "km_3", timestampLabel: "16:00", phase: "MID", title: "t", description: "d", relatedEventIds: ["evt_001"] },
      { id: "km_4", timestampLabel: "20:00", phase: "LATE", title: "t", description: "d", relatedEventIds: ["evt_001"] },
    ],
    evidenceIndex: [{ eventId: "evt_001", summary: "핵심 근거" }],
  };
}

// ─── 케이스 ──────────────────────────────────────────────────────────────────

expectOk("valid fixture passes", () => validateAnalysisOutput(validFixture()));

expectOk("evidenceIndex shortNote passes", () => {
  const f = validFixture();
  f.evidenceIndex = [{ eventId: "evt_001", shortNote: "핵심 근거" }];
  validateAnalysisOutput(f);
});

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

expectThrows("matchSummary headline array throws", () => {
  const f = validFixture();
  f.matchSummary = { headline: ["한 줄 요약"] };
  validateAnalysisOutput(f);
}, "matchSummary.headline");

expectThrows("matchSummary headline number throws", () => {
  const f = validFixture();
  f.matchSummary = { headline: 123 };
  validateAnalysisOutput(f);
}, "matchSummary.headline");

expectThrows("matchSummary blank headline throws", () => {
  const f = validFixture();
  f.matchSummary = { headline: "   " };
  validateAnalysisOutput(f);
}, "matchSummary.headline");

expectThrows("coachSummary missing overallSummary throws", () => {
  const f = validFixture(); f.coachSummary = {};
  validateAnalysisOutput(f);
}, "coachSummary.overallSummary");

expectThrows("coachSummary overallSummary array throws", () => {
  const f = validFixture();
  f.coachSummary = { overallSummary: ["전체 흐름 요약"] };
  validateAnalysisOutput(f);
}, "coachSummary.overallSummary");

expectThrows("coachSummary overallSummary number throws", () => {
  const f = validFixture();
  f.coachSummary = { overallSummary: 123 };
  validateAnalysisOutput(f);
}, "coachSummary.overallSummary");

expectThrows("coachSummary blank overallSummary throws", () => {
  const f = validFixture();
  f.coachSummary = { overallSummary: "   " };
  validateAnalysisOutput(f);
}, "coachSummary.overallSummary");

expectThrows("strengths empty throws", () => {
  const f = validFixture(); f.strengths = [];
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths only 2 throws", () => {
  const f = validFixture();
  f.strengths = f.strengths.slice(0, 2);
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

expectThrows("strengths item whitespace id throws", () => {
  const f = validFixture();
  f.strengths[0] = { ...f.strengths[0], id: "   " };
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths item whitespace title throws", () => {
  const f = validFixture();
  f.strengths[0] = { ...f.strengths[0], title: "   " };
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths item whitespace relatedEventIds throws", () => {
  const f = validFixture();
  f.strengths[0] = { ...f.strengths[0], relatedEventIds: ["evt_001", "   "] };
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

expectThrows("weaknesses only 2 throws", () => {
  const f = validFixture();
  f.weaknesses = f.weaknesses.slice(0, 2);
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

expectThrows("weaknesses item whitespace description throws", () => {
  const f = validFixture();
  f.weaknesses[0] = { ...f.weaknesses[0], description: "   " };
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

expectThrows("actionChecklist only 2 throws", () => {
  const f = validFixture();
  f.actionChecklist = f.actionChecklist.slice(0, 2);
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item empty id throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "", text: "준비하기" }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item whitespace id throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "   ", text: "준비하기" }];
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

expectThrows("actionChecklist item whitespace text/action throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "act_1", text: "   " }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item whitespace action throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "act_1", action: "   " }];
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

expectThrows("keyMoments item missing id/eventId throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { timestampLabel: "08:00", phase: "EARLY", title: "장면", description: "설명", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item whitespace id/eventId throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], id: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item missing timestamp throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", phase: "EARLY", title: "장면", description: "설명", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item whitespace timestamp throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], timestampLabel: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item missing phase throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", title: "장면", description: "설명", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item invalid phase throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", phase: "LANING", title: "장면", description: "설명", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item missing title/label throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", phase: "EARLY", description: "설명", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item whitespace title/label throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], title: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item missing description/reason throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "장면", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item whitespace description/reason throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], description: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item missing relatedEventIds throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "장면", description: "설명" };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item invalid relatedEventIds throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "장면", description: "설명", relatedEventIds: [""] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item whitespace relatedEventIds throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], relatedEventIds: ["evt_001", "   "] };
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

checkTrue(
  "hasValidEvidenceIndex uses EVIDENCE_INDEX_MIN",
  evidenceIndexValidatorSrc.includes("evidenceIndex.length >= EVIDENCE_INDEX_MIN"),
);

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

expectThrows("phaseSummaries item invalid phase throws", () => {
  const f = validFixture();
  f.phaseSummaries = [{ phase: "LANING", summary: "early" }, { phase: "MID", summary: "mid" }, { phase: "LATE", summary: "late" }];
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries item missing summary throws", () => {
  const f = validFixture();
  f.phaseSummaries = [{ phase: "EARLY" }, { phase: "MID", summary: "mid" }, { phase: "LATE", summary: "late" }];
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries item whitespace summary throws", () => {
  const f = validFixture();
  f.phaseSummaries[0] = { ...f.phaseSummaries[0], summary: "   " };
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries item tab-only summary throws", () => {
  const f = validFixture();
  f.phaseSummaries[1] = { ...f.phaseSummaries[1], summary: "\t" };
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
    {
      encounterId: "enc_001",
      situationLabel: "초반 갱킹 손실",
      playerDecision: "시야 없이 라인 압박을 유지",
      takeaway: "와드 우선",
      relatedEventIds: ["evt_001"],
    },
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
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    playerDecision: "판단",
    relatedEventIds: ["evt_001"],
  }])),
  "takeaway");

expectThrows("combatAnalysis: blank encounterId throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "   ",
    situationLabel: "x",
    playerDecision: "판단",
    takeaway: "y",
    relatedEventIds: ["evt_001"],
  }])),
  "encounterId");

expectThrows("combatAnalysis: missing playerDecision throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    takeaway: "y",
    relatedEventIds: ["evt_001"],
  }])),
  "playerDecision");

expectThrows("combatAnalysis: blank playerDecision throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    playerDecision: "   ",
    takeaway: "y",
    relatedEventIds: ["evt_001"],
  }])),
  "playerDecision");

expectThrows("combatAnalysis: blank takeaway throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    playerDecision: "판단",
    takeaway: "   ",
    relatedEventIds: ["evt_001"],
  }])),
  "takeaway");

expectThrows("combatAnalysis: missing relatedEventIds throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    playerDecision: "판단",
    takeaway: "y",
  }])),
  "relatedEventIds");

expectThrows("combatAnalysis: invalid relatedEventIds throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    playerDecision: "판단",
    takeaway: "y",
    relatedEventIds: ["evt_001", ""],
  }])),
  "relatedEventIds");

expectThrows("combatAnalysis: empty string situationLabel throws",
  () => validateAnalysisOutput(withCombat([{ encounterId: "enc_001", situationLabel: "", takeaway: "y" }])),
  "situationLabel");

// ─── teamfightPhaseAnalysis 검증 (선택적 필드, shape contract) ───────────────

function teamfightPhaseItem(overrides = {}) {
  return {
    teamfightId: "enc_001",
    gamePhase: "MID",
    startLabel: "18:10",
    endLabel: "18:56",
    takeaway: "한타 전 시야와 포지션을 먼저 잡자.",
    phases: [
      {
        phase: "ENGAGE",
        outcomeTag: "INITIATED_KILL",
        playerKills: 1,
        playerDeaths: 0,
        coaching: "선제 진입은 좋았다.",
        relatedEventIds: ["evt_001"],
      },
    ],
    ...overrides,
  };
}

function withTeamfightPhaseAnalysis(items) {
  const f = validFixture();
  f.teamfightPhaseAnalysis = items;
  return f;
}

expectOk("teamfightPhaseAnalysis: undefined → tolerated", () => {
  const f = validFixture();
  delete f.teamfightPhaseAnalysis;
  validateAnalysisOutput(f);
});

expectOk("teamfightPhaseAnalysis: null → tolerated", () => {
  const f = validFixture();
  f.teamfightPhaseAnalysis = null;
  validateAnalysisOutput(f);
});

expectOk("teamfightPhaseAnalysis: empty array → tolerated", () => {
  validateAnalysisOutput(withTeamfightPhaseAnalysis([]));
});

expectOk("teamfightPhaseAnalysis: valid item passes", () => {
  validateAnalysisOutput(withTeamfightPhaseAnalysis([teamfightPhaseItem()]));
});

expectThrows("teamfightPhaseAnalysis: object instead of array throws",
  () => validateAnalysisOutput(withTeamfightPhaseAnalysis({ enc_001: teamfightPhaseItem() })),
  "teamfightPhaseAnalysis not array");

expectThrows("teamfightPhaseAnalysis: blank teamfightId throws",
  () => validateAnalysisOutput(withTeamfightPhaseAnalysis([teamfightPhaseItem({ teamfightId: "   " })])),
  "teamfightId");

expectThrows("teamfightPhaseAnalysis: missing takeaway throws",
  () => {
    const item = teamfightPhaseItem();
    delete item.takeaway;
    validateAnalysisOutput(withTeamfightPhaseAnalysis([item]));
  },
  "takeaway");

expectThrows("teamfightPhaseAnalysis: blank takeaway throws",
  () => validateAnalysisOutput(withTeamfightPhaseAnalysis([teamfightPhaseItem({ takeaway: "   " })])),
  "takeaway");

expectThrows("teamfightPhaseAnalysis: phases empty throws",
  () => validateAnalysisOutput(withTeamfightPhaseAnalysis([teamfightPhaseItem({ phases: [] })])),
  "phases");

expectThrows("teamfightPhaseAnalysis: phase row missing coaching throws",
  () => {
    const item = teamfightPhaseItem();
    delete item.phases[0].coaching;
    validateAnalysisOutput(withTeamfightPhaseAnalysis([item]));
  },
  "coaching");

expectThrows("teamfightPhaseAnalysis: phase row invalid kills throws",
  () => {
    const item = teamfightPhaseItem();
    item.phases[0].playerKills = "1";
    validateAnalysisOutput(withTeamfightPhaseAnalysis([item]));
  },
  "playerKills");

expectThrows("teamfightPhaseAnalysis: phase row invalid relatedEventIds throws",
  () => {
    const item = teamfightPhaseItem();
    item.phases[0].relatedEventIds = ["evt_001", ""];
    validateAnalysisOutput(withTeamfightPhaseAnalysis([item]));
  },
  "relatedEventIds");

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
