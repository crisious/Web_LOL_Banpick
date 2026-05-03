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
const buildLlmPayload = new Function(`${buildSrc}\nreturn buildLlmPayload;`)();

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
    ["analysisMeta", "matchSummary", "coachSummary", "phaseSummaries", "strengths", "weaknesses", "actionChecklist", "keyMoments", "evidenceIndex"]);
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
}

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
