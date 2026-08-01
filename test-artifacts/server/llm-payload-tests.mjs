// Track R — server.js의 buildLlmPayload 회귀 테스트
//
// 동작 원리: server.js를 텍스트로 읽어 buildLlmPayload를 추출 → new Function 평가.
// schema-tests.mjs와 동일 패턴 (외부 의존 없음).
//
// 검증 대상: buildLlmPayload는 정규화 매치 → AI 프롬프트 입력 가공의 핵심.
// 깨지면 AI가 잘못된 컨텍스트로 분석하거나 너무 많은 이벤트로 토큰 초과.
// 검증 항목:
//   1) importance < 3 이벤트 필터링
//   2) 최대 15개로 cap
//   3) cap 후 timestamp 오름차순 정렬
//   4) timelineEvents 필드 7개만 유지 (rawRef/laneHint/puuid 등 제거)
//   5) outputContract.schemaVersion = "1.0", 필수 필드 목록 정확
//   6) phaseContext는 kills/deaths/assists/notableEventCount 만 추출

import fs from "fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { detectCombatEncounters: detectCombatEncountersFromPolicy } = require("../../lib/combat-encounters.js");
const { buildRecommendationCandidatePayload } = require(
  "../../lib/teamplay-coaching-v2.js",
);

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

const outputSchemaExampleSrc = extractConstSource(serverSrc, "OUTPUT_SCHEMA_EXAMPLE");
const OUTPUT_SCHEMA_EXAMPLE = new Function(
  `${outputSchemaExampleSrc}\nreturn OUTPUT_SCHEMA_EXAMPLE;`,
)();
const claudePromptSrc = extractConstSource(serverSrc, "CLAUDE_COACHING_PROMPT");
const codexPromptSrc = extractConstSource(serverSrc, "CODEX_REDTEAM_PROMPT");
const { CLAUDE_COACHING_PROMPT, CODEX_REDTEAM_PROMPT } = new Function(
  `${outputSchemaExampleSrc}\n${claudePromptSrc}\n${codexPromptSrc}\nreturn { CLAUDE_COACHING_PROMPT, CODEX_REDTEAM_PROMPT };`,
)();
const actionChecklistCountConstantsSrc = [
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MIN"),
  extractConstSource(serverSrc, "ACTION_CHECKLIST_MAX"),
].join("\n");
const { ACTION_CHECKLIST_MIN, ACTION_CHECKLIST_MAX } = new Function(
  `${actionChecklistCountConstantsSrc}\nreturn { ACTION_CHECKLIST_MIN, ACTION_CHECKLIST_MAX };`,
)();
const insightListCountConstantsSrc = [
  extractConstSource(serverSrc, "INSIGHT_LIST_MIN"),
  extractConstSource(serverSrc, "INSIGHT_LIST_MAX"),
].join("\n");
const { INSIGHT_LIST_MIN, INSIGHT_LIST_MAX } = new Function(
  `${insightListCountConstantsSrc}\nreturn { INSIGHT_LIST_MIN, INSIGHT_LIST_MAX };`,
)();

const playerCombatPolicySources = [
  extractConstSource(serverSrc, "PLAYER_KILL_EVENT_TYPES"),
  extractConstSource(serverSrc, "PLAYER_DEATH_EVENT_TYPES"),
  extractConstSource(serverSrc, "PLAYER_COMBAT_EVENT_TYPES"),
  extractFunctionSource(serverSrc, "isPlayerKillEvent"),
  extractFunctionSource(serverSrc, "isPlayerDeathEvent"),
  extractFunctionSource(serverSrc, "isPlayerCombatEvent"),
].join("\n") + "\n";
const buildSrc = extractFunctionSource(serverSrc, "buildLlmPayload");
const detectSrc = extractFunctionSource(serverSrc, "detectCombatEncounters");
const teamfightPhasesSrc = extractFunctionSource(serverSrc, "buildTeamfightPhases");
const timestampPolicySources = [
  extractFunctionSource(serverSrc, "timestampLabel"),
  extractFunctionSource(serverSrc, "phaseFor"),
  extractFunctionSource(serverSrc, "rawEventTimestampMs"),
].join("\n") + "\n";
// buildTeamfightPhases가 참조하는 모듈 레벨 상수를 server.js에서 라이브 추출
const tfConstants = [
  extractConstSource(serverSrc, "TEAMFIGHT_MIN_EVENTS"),
  extractConstSource(serverSrc, "CLEANUP_GAP_MS"),
  extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
  extractConstSource(serverSrc, "PHASE_SUMMARIES_MIN"),
  extractConstSource(serverSrc, "EVIDENCE_INDEX_MIN"),
  actionChecklistCountConstantsSrc,
  insightListCountConstantsSrc,
].join("\n") + "\n";
// buildLlmPayload는 detectCombatEncounters + buildTeamfightPhases를 내부에서 호출 → 같은 클로저에 함께 평가
const { buildLlmPayload, detectCombatEncounters } = new Function(
  "buildRecommendationCandidatePayload",
  "detectCombatEncountersFromPolicy",
  `${tfConstants}${playerCombatPolicySources}${timestampPolicySources}${detectSrc}\n${teamfightPhasesSrc}\n${buildSrc}\nreturn { buildLlmPayload, detectCombatEncounters };`,
)(buildRecommendationCandidatePayload, detectCombatEncountersFromPolicy);

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

function finalTeamfightInstructionSnippet(prompt) {
  const start = prompt.lastIndexOf("teamfightPhaseAnalysis:");
  const end = prompt.indexOf("분석할 경기 데이터:", start);
  if (start < 0 || end < 0 || end <= start) return "";
  return prompt.slice(start, end);
}

function finalCombatInstructionSnippet(prompt) {
  const start = prompt.lastIndexOf("combatAnalysis:");
  const end = prompt.indexOf("teamfightPhaseAnalysis:", start);
  if (start < 0 || end < 0 || end <= start) return "";
  return prompt.slice(start, end);
}

// 최소 정규화 fixture (필수 필드만)
function baseFixture() {
  return {
    timelineEvents: [],
    phaseContext: {
      early: { kills: 1, deaths: 0, assists: 2, notableEventCount: 3, extraField: "should-be-stripped" },
      mid:   { kills: 2, deaths: 1, assists: 4, notableEventCount: 5 },
      late:  { kills: 1, deaths: 1, assists: 2, notableEventCount: 2 },
    },
    playerContext: { riotId: "P#KR1", participantId: 5, puuid: "should-be-stripped" },
    matchInfo: { matchId: "KR_X", queueLabel: "RANKED_SOLO" },
    playerStats: { kills: 4, deaths: 2, assists: 8 },
    teamContext: { teamTotalKills: 24 },
    derivedSignals: { hasEarlyLeadMoments: true },
  };
}

function validTeamplayModel() {
  const fact = {
    factId: "fact_far",
    type: "PLAYER_DISTANCE_GT_5000",
    timestamp: 600000,
    value: {
      distance: 6200,
      stage: "SETUP",
      frameTimestamp: 590000,
      frameAgeSeconds: 10,
    },
    confidence: "MEDIUM",
    sourceRefs: [{
      kind: "TIMELINE_EVENT",
      id: "event_far",
      timestamp: 600000,
      participantId: null,
    }],
    limitationCodes: [],
  };
  return {
    schemaVersion: "2.0",
    coverage: {
      level: "PARTIAL",
      source: "RAW_TIMELINE",
      usablePositionSceneRatio: 1,
      limitationCodes: [],
    },
    encounters: [],
    objectiveEngagements: [{
      id: "obj_1",
      startTimestamp: 510000,
      endTimestamp: 720000,
      sourceRefs: [{
        kind: "TIMELINE_EVENT",
        id: "event_obj_1",
        timestamp: 600000,
        participantId: null,
      }],
      confidence: "HIGH",
      limitationCodes: [],
      linkedEncounterIds: [],
    }],
    scenes: [{
      sceneId: "scene_1",
      objectiveEngagementId: "obj_1",
      encounterIds: [],
      startTimestamp: 510000,
      endTimestamp: 720000,
      importanceScore: 40,
      involvements: [],
      effectiveInvolvementLevel: "APPROXIMATE",
    }],
    personalReviews: [{
      reviewId: "review_1",
      sceneId: "scene_1",
      objectiveEngagementId: "obj_1",
      encounterIds: [],
      startTimestamp: 510000,
      endTimestamp: 720000,
      sourceRefs: [fact.sourceRefs[0]],
      confidence: "MEDIUM",
      limitationCodes: [],
      importanceScore: 40,
      involvements: [],
      effectiveInvolvementLevel: "APPROXIMATE",
      situationFacts: [],
      decisionFacts: [],
      positioningFacts: [fact],
      outcomeFacts: [],
      evidenceIds: [fact.factId],
      narrative: null,
      teamAppendixId: "appendix_1",
    }],
    teamAppendix: [{
      teamAppendixId: "appendix_1",
      reviewId: "review_1",
      allyDirectParticipants: [],
      enemyDirectParticipants: [],
      firstTakedownTeam: "UNKNOWN",
      allyDeaths: 0,
      enemyDeaths: 0,
      preEncounterGoldDifference: null,
      captureTeam: "ENEMY",
      structureConversions: [],
      factIds: [],
      limitationCodes: [],
    }],
  };
}

function modelWithOneEligibleReview() {
  return validTeamplayModel();
}

function makeEvent(eventId, importance, timestampMs, extra = {}) {
  return {
    eventId,
    timestampLabel: `${Math.floor(timestampMs / 60000)}:00`,
    timestampMs, // 정렬 기준 — buildLlmPayload가 이 값으로 ascending sort
    phase: timestampMs < 600000 ? "EARLY" : timestampMs < 1500000 ? "MID" : "LATE",
    eventType: "KILL",
    importance,
    summary: `event ${eventId}`,
    isPlayerInvolved: true,
    rawRef: "should-be-stripped",
    laneHint: "should-be-stripped",
    ...extra,
  };
}

// ─── 케이스 1: importance < 3 필터링 ─────────────────────────────────────────

{
  const f = baseFixture();
  f.timelineEvents = [
    makeEvent("evt_001", 5, 60000),
    makeEvent("evt_002", 2, 120000),  // 필터아웃
    makeEvent("evt_003", 4, 180000),
    makeEvent("evt_004", 1, 240000),  // 필터아웃
    makeEvent("evt_005", 3, 300000),
  ];
  const out = buildLlmPayload(f);
  check("importance filter: 3건만 통과", out.timelineEvents.map((e) => e.eventId),
    ["evt_001", "evt_003", "evt_005"]);
}

// ─── 케이스 2: max 15 cap (importance 우선 정렬 후 slice) ────────────────────

{
  const f = baseFixture();
  // 20개 이벤트, importance는 3~5, timestamp는 분당 1개
  f.timelineEvents = Array.from({ length: 20 }, (_, i) =>
    makeEvent(`evt_${String(i).padStart(3, "0")}`, 3 + (i % 3), (i + 1) * 60000),
  );
  const out = buildLlmPayload(f);
  checkTrue("max 15 events", out.timelineEvents.length === 15);
}

// ─── 케이스 3: 출력은 timestamp 오름차순 정렬 ────────────────────────────────

{
  const f = baseFixture();
  f.timelineEvents = [
    makeEvent("evt_late", 5, 1500000),
    makeEvent("evt_early", 5, 60000),
    makeEvent("evt_mid", 5, 600000),
  ];
  const out = buildLlmPayload(f);
  check("timestamp ascending order",
    out.timelineEvents.map((e) => e.eventId),
    ["evt_early", "evt_mid", "evt_late"]);
}

// ─── 케이스 4: 내부 필드(rawRef, laneHint) 제거 ──────────────────────────────

{
  const f = baseFixture();
  f.timelineEvents = [makeEvent("evt_001", 5, 60000, { puuid: "leak", customField: "leak2" })];
  const out = buildLlmPayload(f);
  const evt = out.timelineEvents[0];
  const keys = Object.keys(evt).sort();
  check("only 7 known fields kept", keys, [
    "eventId", "eventType", "importance", "isPlayerInvolved", "phase", "summary", "timestampLabel"
  ]);
  checkTrue("rawRef stripped", !("rawRef" in evt));
  checkTrue("laneHint stripped", !("laneHint" in evt));
  checkTrue("puuid stripped", !("puuid" in evt));
  checkTrue("customField stripped", !("customField" in evt));
}

// ─── 케이스 5: outputContract 안정성 ─────────────────────────────────────────

{
  const f = baseFixture();
  const out = buildLlmPayload(f);
  check("outputContract.schemaVersion = 1.0", out.outputContract.schemaVersion, "1.0");
  check("taskMeta.checklistCountMin mirrors ACTION_CHECKLIST_MIN", out.taskMeta.checklistCountMin, ACTION_CHECKLIST_MIN);
  check("taskMeta.checklistCountMax mirrors ACTION_CHECKLIST_MAX", out.taskMeta.checklistCountMax, ACTION_CHECKLIST_MAX);
  check("taskMeta.strengthCount mirrors INSIGHT_LIST_MIN", out.taskMeta.strengthCount, INSIGHT_LIST_MIN);
  check("taskMeta.weaknessCount mirrors INSIGHT_LIST_MIN", out.taskMeta.weaknessCount, INSIGHT_LIST_MIN);
  check("requiredTopLevelFields list",
    out.outputContract.requiredTopLevelFields,
    ["schemaVersion", "analysisMeta", "matchSummary", "coachSummary", "phaseSummaries", "strengths", "weaknesses", "actionChecklist", "keyMoments", "evidenceIndex", "combatAnalysis", "teamfightPhaseAnalysis", "teamplayRecommendationSelections"]);
  checkTrue("outputContract requires schemaVersion", out.outputContract.requiredTopLevelFields.includes("schemaVersion"));
  checkTrue("outputContract requires teamfightPhaseAnalysis", out.outputContract.requiredTopLevelFields.includes("teamfightPhaseAnalysis"));
  check("requiredArrayCounts.phaseSummariesMin", out.outputContract.requiredArrayCounts.phaseSummariesMin, 3);
  check("requiredArrayCounts.evidenceIndexMin", out.outputContract.requiredArrayCounts.evidenceIndexMin, 1);
  checkTrue("server defines EVIDENCE_INDEX_MIN", serverSrc.includes("const EVIDENCE_INDEX_MIN = 1;"));
  checkTrue("buildLlmPayload requiredArrayCounts uses EVIDENCE_INDEX_MIN", buildSrc.includes("evidenceIndexMin: EVIDENCE_INDEX_MIN"));
  check("requiredArrayCounts.strengthsMax mirrors INSIGHT_LIST_MAX", out.outputContract.requiredArrayCounts.strengthsMax, INSIGHT_LIST_MAX);
  check("requiredArrayCounts.weaknessesMax mirrors INSIGHT_LIST_MAX", out.outputContract.requiredArrayCounts.weaknessesMax, INSIGHT_LIST_MAX);
  check("requiredArrayCounts.strengths mirrors INSIGHT_LIST_MIN", out.outputContract.requiredArrayCounts.strengths, INSIGHT_LIST_MIN);
  check("requiredArrayCounts.weaknesses mirrors INSIGHT_LIST_MIN", out.outputContract.requiredArrayCounts.weaknesses, INSIGHT_LIST_MIN);
  check("requiredArrayCounts.actionChecklistMin mirrors ACTION_CHECKLIST_MIN", out.outputContract.requiredArrayCounts.actionChecklistMin, ACTION_CHECKLIST_MIN);
  check("requiredArrayCounts.actionChecklistMax mirrors ACTION_CHECKLIST_MAX", out.outputContract.requiredArrayCounts.actionChecklistMax, ACTION_CHECKLIST_MAX);
  check("requiredArrayCounts.keyMomentsMin", out.outputContract.requiredArrayCounts.keyMomentsMin, 4);
  checkTrue("buildLlmPayload taskMeta uses ACTION_CHECKLIST_MIN", buildSrc.includes("checklistCountMin: ACTION_CHECKLIST_MIN"));
  checkTrue("buildLlmPayload taskMeta uses ACTION_CHECKLIST_MAX", buildSrc.includes("checklistCountMax: ACTION_CHECKLIST_MAX"));
  checkTrue("buildLlmPayload requiredArrayCounts uses ACTION_CHECKLIST_MIN", buildSrc.includes("actionChecklistMin: ACTION_CHECKLIST_MIN"));
  checkTrue("buildLlmPayload requiredArrayCounts uses ACTION_CHECKLIST_MAX", buildSrc.includes("actionChecklistMax: ACTION_CHECKLIST_MAX"));
  checkTrue("buildLlmPayload taskMeta uses INSIGHT_LIST_MIN for strengthCount", buildSrc.includes("strengthCount: INSIGHT_LIST_MIN"));
  checkTrue("buildLlmPayload taskMeta uses INSIGHT_LIST_MIN for weaknessCount", buildSrc.includes("weaknessCount: INSIGHT_LIST_MIN"));
  checkTrue("buildLlmPayload requiredArrayCounts uses INSIGHT_LIST_MIN for strengths", buildSrc.includes("strengths: INSIGHT_LIST_MIN"));
  checkTrue("buildLlmPayload requiredArrayCounts uses INSIGHT_LIST_MIN for weaknesses", buildSrc.includes("weaknesses: INSIGHT_LIST_MIN"));
  checkTrue("buildLlmPayload requiredArrayCounts uses INSIGHT_LIST_MAX for strengthsMax", buildSrc.includes("strengthsMax: INSIGHT_LIST_MAX"));
  checkTrue("buildLlmPayload requiredArrayCounts uses INSIGHT_LIST_MAX for weaknessesMax", buildSrc.includes("weaknessesMax: INSIGHT_LIST_MAX"));
}

// ─── 케이스 6: phaseContext는 4개 필드만 추출 ───────────────────────────────

{
  const f = baseFixture();
  const out = buildLlmPayload(f);
  const earlyKeys = Object.keys(out.phaseContext.early).sort();
  check("phaseContext.early only 4 fields", earlyKeys,
    ["assists", "deaths", "kills", "notableEventCount"]);
  checkTrue("extraField stripped from early", !("extraField" in out.phaseContext.early));
}

// ─── 케이스 7: playerContext는 riotId + participantId만 ─────────────────────

{
  const f = baseFixture();
  const out = buildLlmPayload(f);
  const playerKeys = Object.keys(out.matchContext.playerContext).sort();
  check("playerContext only 2 fields", playerKeys, ["participantId", "riotId"]);
  checkTrue("puuid not in payload", !("puuid" in out.matchContext.playerContext));
}

// ─── 케이스 8: 빈 timelineEvents 안전 ────────────────────────────────────────

{
  const f = baseFixture();
  const out = buildLlmPayload(f);
  check("empty timeline → empty array", out.timelineEvents, []);
  check("empty timeline → empty combatEncounters", out.combatEncounters, []);
  check("empty timeline → empty teamfightPhases", out.teamfightPhases, []);
}

// ─── Phase 32: detectCombatEncounters 단독 검증 ──────────────────────────────

function makeCombatEvent(eventId, eventType, timestampMs, isPlayerInvolved = true, phase = "EARLY") {
  return {
    eventId,
    eventType,
    timestampMs,
    timestampLabel: `${Math.floor(timestampMs / 60000)}:${String(Math.floor((timestampMs % 60000) / 1000)).padStart(2, "0")}`,
    phase,
    importance: 4,
    summary: `${eventType} ${eventId}`,
    isPlayerInvolved,
  };
}

// 케이스 9: 빈 입력 → 빈 배열
{
  check("encounters: empty input → []", detectCombatEncounters([]), []);
}

// 케이스 10: 25초 윈도우 그룹화 — 20초 간격은 같은 encounter, 30초 간격은 분리
{
  const events = [
    makeCombatEvent("evt_1", "CHAMPION_KILL", 60000),
    makeCombatEvent("evt_2", "CHAMPION_KILL", 80000),   // +20s → 같은 그룹
    makeCombatEvent("evt_3", "PLAYER_DEATH", 130000),   // +50s → 새 그룹
    makeCombatEvent("evt_4", "PLAYER_DEATH", 140000),   // +10s → evt_3과 같은 그룹
  ];
  const out = detectCombatEncounters(events);
  checkTrue("encounters: 2 groups from 20s+50s gap", out.length === 2);
  check("encounter 1 events", out[0].relatedEventIds, ["evt_1", "evt_2"]);
  check("encounter 2 events", out[1].relatedEventIds, ["evt_3", "evt_4"]);
}

// 케이스 11: 비전투 이벤트는 제외, 플레이어 미관여 그룹은 제거
{
  const events = [
    makeCombatEvent("evt_kill_a", "CHAMPION_KILL", 60000, true),     // player involved → 채택
    makeCombatEvent("evt_other", "DRAGON_FIGHT", 70000, true),       // 비전투 → 무시
    makeCombatEvent("evt_kill_b", "CHAMPION_KILL", 200000, false),   // observer만 → 제외
    makeCombatEvent("evt_kill_c", "CHAMPION_KILL", 210000, false),   // observer만 → 제외
  ];
  const out = detectCombatEncounters(events);
  checkTrue("encounters: only player-involved groups", out.length === 1);
  check("encounter only contains player events", out[0].relatedEventIds, ["evt_kill_a"]);
}

// 케이스 12: situation 분류 — DOMINANT / DOWN / TRADED
{
  const dominant = detectCombatEncounters([
    makeCombatEvent("k1", "CHAMPION_KILL", 60000, true),
    makeCombatEvent("k2", "CHAMPION_KILL", 65000, true),
  ]);
  check("situation: 2 kills → PLAYER_DOMINANT", dominant[0].situation, "PLAYER_DOMINANT");

  const down = detectCombatEncounters([
    makeCombatEvent("d1", "PLAYER_DEATH", 60000, true),
    makeCombatEvent("d2", "PLAYER_DEATH", 65000, true),
  ]);
  check("situation: 2 deaths → PLAYER_DOWN", down[0].situation, "PLAYER_DOWN");

  const traded = detectCombatEncounters([
    makeCombatEvent("k1", "CHAMPION_KILL", 60000, true),
    makeCombatEvent("d1", "PLAYER_DEATH", 65000, true),
  ]);
  check("situation: 1 kill + 1 death → TRADED", traded[0].situation, "TRADED");
}

// 케이스 13: 측정 코호트 상한(21)을 수용하는 encounterId 패딩 + 24개 cap
{
  const events = [];
  // 26개 분리 그룹 (60초 간격) — 24개로 cap 돼야 함
  for (let i = 0; i < 26; i += 1) {
    events.push(makeCombatEvent(`evt_${i}`, "CHAMPION_KILL", 60000 + i * 60000, true));
  }
  const out = detectCombatEncounters(events);
  checkTrue("encounters: capped at 24", out.length === 24);
  check("encounter id padding (1st)", out[0].encounterId, "enc_001");
  check("encounter id padding (24th)", out[23].encounterId, "enc_024");
}

// 케이스 14: playerKills / playerDeaths 카운트 — observer 이벤트는 제외
{
  const events = [
    makeCombatEvent("evt_player_kill", "CHAMPION_KILL", 60000, true),
    makeCombatEvent("evt_observer_kill", "CHAMPION_KILL", 70000, false), // 같은 그룹이지만 미관여
    makeCombatEvent("evt_player_death", "PLAYER_DEATH", 80000, true),
  ];
  const out = detectCombatEncounters(events);
  check("playerKills counts only involved", out[0].playerKills, 1);
  check("playerDeaths counts only involved", out[0].playerDeaths, 1);
  check("eventCount includes all in group", out[0].eventCount, 3);
}

// ─── 케이스 15: teamfight prompt 예시는 validator/UI phase row 필드를 모두 보여줘야 함 ──

{
  const start = OUTPUT_SCHEMA_EXAMPLE.indexOf('"combatAnalysis"');
  const end = OUTPUT_SCHEMA_EXAMPLE.indexOf('"teamfightPhaseAnalysis"', start);
  const snippet = OUTPUT_SCHEMA_EXAMPLE.slice(start, end);
  checkTrue("combat prompt includes situation", snippet.includes('"situation"'));
  checkTrue(
    "combat prompt includes situation enum",
    OUTPUT_SCHEMA_EXAMPLE.includes("PLAYER_DOMINANT") &&
      OUTPUT_SCHEMA_EXAMPLE.includes("PLAYER_DOWN") &&
      OUTPUT_SCHEMA_EXAMPLE.includes("TRADED"),
  );
}

{
  const start = OUTPUT_SCHEMA_EXAMPLE.indexOf('"teamfightPhaseAnalysis"');
  const end = OUTPUT_SCHEMA_EXAMPLE.indexOf('"evidenceIndex"', start);
  const snippet = OUTPUT_SCHEMA_EXAMPLE.slice(start, end);
  checkTrue("teamfight prompt includes outcomeTag", snippet.includes('"outcomeTag"'));
  checkTrue("teamfight prompt includes playerKills", snippet.includes('"playerKills"'));
  checkTrue("teamfight prompt includes playerDeaths", snippet.includes('"playerDeaths"'));
  checkTrue("teamfight prompt includes relatedEventIds", snippet.includes('"relatedEventIds"'));
}

// ─── 케이스 16: output schema preamble은 evidenceIndex 최소 개수를 명시해야 함 ──

{
  const start = OUTPUT_SCHEMA_EXAMPLE.indexOf('"keyMoments"');
  const end = OUTPUT_SCHEMA_EXAMPLE.indexOf('"combatAnalysis"', start);
  const snippet = OUTPUT_SCHEMA_EXAMPLE.slice(start, end);
  checkTrue("keyMoments prompt includes phase", snippet.includes('"phase"'));
}

{
  checkTrue("output schema states insight list exact count", OUTPUT_SCHEMA_EXAMPLE.includes("strengths와 weaknesses는 각각 3개의 배열"));
  checkTrue("output schema states actionChecklist count range", OUTPUT_SCHEMA_EXAMPLE.includes("actionChecklist는 3~5개의 배열"));
  checkTrue("output schema states phaseSummaries minimum", OUTPUT_SCHEMA_EXAMPLE.includes("phaseSummaries는 3개 이상의 배열"));
  checkTrue("output schema states evidenceIndex non-empty", OUTPUT_SCHEMA_EXAMPLE.includes("evidenceIndex는 1개 이상의 배열"));
}

// ─── 케이스 17: teamfight 지시문 본문은 필수 phase row 필드를 명시해야 함 ──

{
  for (const [label, prompt] of [
    ["Claude", CLAUDE_COACHING_PROMPT],
    ["Codex", CODEX_REDTEAM_PROMPT],
  ]) {
    const snippet = finalCombatInstructionSnippet(prompt);
    checkTrue(`${label} combat instruction names situation`, snippet.includes("situation"));
    checkTrue(`${label} combat instruction names situation enum`, snippet.includes("PLAYER_DOMINANT") && snippet.includes("PLAYER_DOWN") && snippet.includes("TRADED"));
  }
}

{
  const requiredFields = [
    "teamfightId",
    "phase",
    "outcomeTag",
    "playerKills",
    "playerDeaths",
    "coaching",
    "relatedEventIds",
    "takeaway",
  ];
  for (const [label, prompt] of [
    ["Claude", CLAUDE_COACHING_PROMPT],
    ["Codex", CODEX_REDTEAM_PROMPT],
  ]) {
    const snippet = finalTeamfightInstructionSnippet(prompt);
    for (const field of requiredFields) {
      checkTrue(`${label} teamfight instruction names ${field}`, snippet.includes(`\`${field}\``));
    }
  }
}

// ─── Teamplay v2: AI에는 폐쇄형 추천 후보만 노출 ───────────────────────────

{
  const normalizedFixture = baseFixture();
  normalizedFixture.teamplayAnalysisV2 = modelWithOneEligibleReview();
  const payload = buildLlmPayload(normalizedFixture);
  const serializedCandidates = JSON.stringify(
    payload.teamplayRecommendationCandidates,
  ) || "";
  check(
    "payload exposes one coaching candidate",
    payload.teamplayRecommendationCandidates?.reviews?.length,
    1,
  );
  checkTrue(
    "payload strips free coaching text",
    !serializedCandidates.includes("betterChoice"),
  );
  checkTrue(
    "output contract requests selections",
    payload.outputContract.requiredTopLevelFields.includes(
      "teamplayRecommendationSelections",
    ),
  );
  checkTrue(
    "candidate payload contains no raw refs or server coaching copy",
    !serializedCandidates.includes("sourceRefs") &&
      !serializedCandidates.includes("nextGameRule"),
  );
}

{
  const instruction = "teamplayRecommendationSelections: teamplayRecommendationCandidates.reviews에 있는 reviewId만 사용한다. 각 review에서 eligibleRecommendations 중 하나만 선택하고 recommendationCode와 그 항목의 evidenceIds만 그대로 반환한다. 자유 코칭 문장, 새로운 코드, 새로운 fact ID를 만들지 않는다. 후보가 없으면 reviews는 빈 배열이다.";
  checkTrue(
    "output schema includes closed teamplay selection envelope",
    OUTPUT_SCHEMA_EXAMPLE.includes('"teamplayRecommendationSelections"'),
  );
  checkTrue(
    "Claude prompt contains exact closed-selection instruction",
    CLAUDE_COACHING_PROMPT.includes(instruction),
  );
  checkTrue(
    "Codex prompt contains exact closed-selection instruction",
    CODEX_REDTEAM_PROMPT.includes(instruction),
  );
}

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
