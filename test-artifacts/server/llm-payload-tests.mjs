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

const buildSrc = extractFunctionSource(serverSrc, "buildLlmPayload");
const detectSrc = extractFunctionSource(serverSrc, "detectCombatEncounters");
// buildLlmPayload는 detectCombatEncounters를 내부에서 호출 → 같은 클로저에 함께 평가
const { buildLlmPayload, detectCombatEncounters } = new Function(
  `${detectSrc}\n${buildSrc}\nreturn { buildLlmPayload, detectCombatEncounters };`,
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
  check("requiredTopLevelFields list",
    out.outputContract.requiredTopLevelFields,
    ["analysisMeta", "matchSummary", "coachSummary", "phaseSummaries", "strengths", "weaknesses", "actionChecklist", "keyMoments", "evidenceIndex", "combatAnalysis"]);
  check("requiredArrayCounts.strengths", out.outputContract.requiredArrayCounts.strengths, 3);
  check("requiredArrayCounts.weaknesses", out.outputContract.requiredArrayCounts.weaknesses, 3);
  check("requiredArrayCounts.keyMomentsMin", out.outputContract.requiredArrayCounts.keyMomentsMin, 4);
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

// 케이스 13: encounterId 패딩 + 8개 cap
{
  const events = [];
  // 10개 분리 그룹 (30초 간격) — 8개로 cap 돼야 함
  for (let i = 0; i < 10; i += 1) {
    events.push(makeCombatEvent(`evt_${i}`, "CHAMPION_KILL", 60000 + i * 60000, true));
  }
  const out = detectCombatEncounters(events);
  checkTrue("encounters: capped at 8", out.length === 8);
  check("encounter id padding (1st)", out[0].encounterId, "enc_001");
  check("encounter id padding (8th)", out[7].encounterId, "enc_008");
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

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
