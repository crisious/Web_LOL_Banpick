# 한타 단계별 분석 (Teamfight Phase Analysis) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이어가 관여한 교전(encounter)을 진입·딜교환·정리 3단계로 분해해 국면별로 코칭하는 신규 분석 섹션을 추가한다.

**Architecture:** 하이브리드 — 서버가 결정론적 3단계 구조(`buildTeamfightPhases`)와 룰 기반 코칭 템플릿을 만들고, AI가 단계별 코칭을 선택적으로 입힌다(`mergeTeamfightCoaching`). 기존 `combatEncounters → combatAnalysis` 패턴을 그대로 따르며, combatAnalysis는 변경하지 않는다. 신규 출력 필드 `teamfightPhaseAnalysis`와 신규 UI 섹션을 additive로 추가한다.

**Tech Stack:** 빌드리스 Node http 서버(`server.js`) + 바닐라 JS(`main.js`/`index.html`) + CSS. 테스트: `node test-artifacts/run-tests.mjs` (현재 224 passed). 텍스트 추출 + `new Function` 회귀 패턴.

**Spec:** `docs/superpowers/specs/2026-06-02-teamfight-phase-analysis-design.md`

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `server.js` | 단계 분해 구조 + 룰 코칭 + 병합 + 페이로드/분석/검증 배선 + 프롬프트 | 신규 함수 4개, 상수 2개, 배선 5곳 |
| `main.js` | 신규 렌더 + dom 셀렉터 + renderSample 호출 | 추가만 |
| `index.html` | 분석 탭 신규 섹션 | 추가만 |
| `styles.css` | 신규 섹션/단계행/태그 칩 | 추가만 |
| `test-artifacts/server/teamfight-phase-tests.mjs` | 신규 회귀 | 생성 |
| `analysis-json-schema.md` | `teamfightPhaseAnalysis` 출력 스키마 문서화 | 추가 |
| `llm-prompt-input-format.md` | `teamfightPhases` 입력 필드 문서화 | 추가 |

**outcomeTag 최종 정의 (스펙 정련):** encounter 이벤트는 `CHAMPION_KILL`/`PLAYER_DEATH`만 존재하므로 cleanup 마지막은 둘 중 하나다. 따라서 스펙의 `CLEAN`(도달 불가)을 제거하고 cleanup은 `CLOSED_OUT`/`OVERCHASE_DEATH`/`DIED_IN_FIGHT`로 확정. TRADE 단계는 net K/D로 `TRADE_WON`/`TRADE_LOST`/`TRADE_EVEN`.

---

## Task 1: 서버 — `buildTeamfightPhases` 구조 분해 + 상수

**Files:**
- Modify: `server.js` (상수: line 16~19 부근 / 함수: `detectCombatEncounters` 끝(현 1404 부근) 직후 삽입)
- Test: `test-artifacts/server/teamfight-phase-tests.mjs` (Create)

- [ ] **Step 1: 실패 테스트 작성** — `test-artifacts/server/teamfight-phase-tests.mjs` 생성

```js
// Phase 34 — server.js 한타 단계별 분석(buildTeamfightPhases 등) 회귀 테스트
// 텍스트 추출 + new Function 패턴 (llm-payload-tests.mjs / 기존 Phase 33 테스트와 동일).
import fs from "fs";
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0, started = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; started = true; }
    else if (ch === "}") { depth -= 1; if (started && depth === 0) return source.slice(startIdx, i + 1); }
  }
  throw new Error(`function ${name} not closed`);
}
function extractConstSource(source, name) {
  const m = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[0];
}

const env = new Function(
  [
    extractConstSource(serverSrc, "TEAMFIGHT_MIN_EVENTS"),
    extractConstSource(serverSrc, "CLEANUP_GAP_MS"),
    extractFunctionSource(serverSrc, "buildTeamfightPhases"),
    extractFunctionSource(serverSrc, "teamfightPhaseCoaching"),
    extractFunctionSource(serverSrc, "teamfightTakeaway"),
    extractFunctionSource(serverSrc, "mergeTeamfightCoaching"),
    "return { buildTeamfightPhases, teamfightPhaseCoaching, teamfightTakeaway, mergeTeamfightCoaching };",
  ].join("\n"),
)();
const { buildTeamfightPhases, teamfightPhaseCoaching, teamfightTakeaway, mergeTeamfightCoaching } = env;

let pass = 0, fail = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, cond) { console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); cond ? pass++ : fail++; }

// 이벤트/encounter fixture 헬퍼
const ev = (eventId, t, eventType, label) => ({ eventId, timestampMs: t, timestampLabel: label, eventType, isPlayerInvolved: true });
const enc = (id, ids, over = {}) => ({ encounterId: id, phase: "MID", eventCount: ids.length, playerKills: 0, playerDeaths: 0, situation: "TRADED", relatedEventIds: ids, startLabel: "", endLabel: "", ...over });

// TF1: KILL, DEATH, KILL → ENGAGE=INITIATED_KILL, TRADE=TRADE_LOST, CLEANUP=CLOSED_OUT
const tf1Events = [ev("a", 10000, "CHAMPION_KILL", "0:10"), ev("b", 15000, "PLAYER_DEATH", "0:15"), ev("c", 18000, "CHAMPION_KILL", "0:18")];
const tf1 = buildTeamfightPhases([enc("enc_001", ["a", "b", "c"], { situation: "PLAYER_DOMINANT", playerKills: 2, playerDeaths: 1 })], tf1Events);
check("TF1 단일 한타", tf1.length, 1);
check("TF1 단계 3개", tf1[0].phases.map((p) => p.phase), ["ENGAGE", "TRADE", "CLEANUP"]);
check("TF1 outcomeTags", tf1[0].phases.map((p) => p.outcomeTag), ["INITIATED_KILL", "TRADE_LOST", "CLOSED_OUT"]);
check("TF1 teamfightId/gamePhase", [tf1[0].teamfightId, tf1[0].gamePhase], ["enc_001", "MID"]);
check("TF1 단계 K/D", tf1[0].phases.map((p) => [p.playerKills, p.playerDeaths]), [[1, 0], [0, 1], [1, 0]]);

// TF2: DEATH, KILL, DEATH(prev=KILL) → CAUGHT_OUT, TRADE_WON, OVERCHASE_DEATH
const tf2Events = [ev("a", 120000, "PLAYER_DEATH", "2:00"), ev("b", 125000, "CHAMPION_KILL", "2:05"), ev("c", 128000, "PLAYER_DEATH", "2:08")];
const tf2 = buildTeamfightPhases([enc("enc_002", ["a", "b", "c"])], tf2Events);
check("TF2 outcomeTags (추격사: 킬 직후 데스)", tf2[0].phases.map((p) => p.outcomeTag), ["CAUGHT_OUT", "TRADE_WON", "OVERCHASE_DEATH"]);

// TF3: KILL, DEATH, DEATH(prev=DEATH, gap<8s) → INITIATED_KILL, TRADE_LOST, DIED_IN_FIGHT
const tf3Events = [ev("a", 180000, "CHAMPION_KILL", "3:00"), ev("b", 183000, "PLAYER_DEATH", "3:03"), ev("c", 185000, "PLAYER_DEATH", "3:05")];
const tf3 = buildTeamfightPhases([enc("enc_003", ["a", "b", "c"])], tf3Events);
check("TF3 cleanup DIED_IN_FIGHT", tf3[0].phases[2].outcomeTag, "DIED_IN_FIGHT");

// TF4: DEATH, DEATH, DEATH(prev=DEATH, gap>8s) → cleanup OVERCHASE_DEATH (간격 조건)
const tf4Events = [ev("a", 240000, "PLAYER_DEATH", "4:00"), ev("b", 243000, "PLAYER_DEATH", "4:03"), ev("c", 260000, "PLAYER_DEATH", "4:20")];
const tf4 = buildTeamfightPhases([enc("enc_004", ["a", "b", "c"])], tf4Events);
check("TF4 cleanup OVERCHASE_DEATH (간격>8s)", tf4[0].phases[2].outcomeTag, "OVERCHASE_DEATH");

// 필터: eventCount 2 → 제외
const small = buildTeamfightPhases([enc("enc_005", ["a", "b"])], [ev("a", 1, "CHAMPION_KILL", "0:01"), ev("b", 2, "PLAYER_DEATH", "0:02")]);
check("eventCount<3 제외", small.length, 0);

// 룰 코칭: 모든 outcomeTag가 비어있지 않은 문자열
for (const tag of ["INITIATED_KILL", "CAUGHT_OUT", "TRADE_WON", "TRADE_LOST", "TRADE_EVEN", "CLOSED_OUT", "OVERCHASE_DEATH", "DIED_IN_FIGHT"]) {
  checkTrue(`coaching(${tag}) 비어있지 않음`, typeof teamfightPhaseCoaching("ENGAGE", tag) === "string" && teamfightPhaseCoaching("ENGAGE", tag).length > 0);
}

// takeaway 룰: CAUGHT_OUT 우선
const tfCaught = buildTeamfightPhases([enc("enc_006", ["a", "b", "c"])], tf2Events);
check("takeaway CAUGHT_OUT 우선", teamfightTakeaway(tfCaught[0]), "한타 진입 전 시야와 포지션을 먼저 잡아 선제 피해를 줄이자.");

// merge: AI 일부 phase만 → 나머지는 룰, 누락 teamfight → 전부 룰
const merged = mergeTeamfightCoaching(tf1, [{ teamfightId: "enc_001", phases: [{ phase: "ENGAGE", coaching: "AI 진입 코칭" }], takeaway: "AI 교훈" }]);
check("merge AI engage coaching", merged[0].phases[0].coaching, "AI 진입 코칭");
check("merge 룰 trade coaching", merged[0].phases[1].coaching, teamfightPhaseCoaching("TRADE", "TRADE_LOST"));
check("merge AI takeaway", merged[0].takeaway, "AI 교훈");
const mergedNoAi = mergeTeamfightCoaching(tf1, []);
check("merge AI 없음 → 룰 takeaway", mergedNoAi[0].takeaway, teamfightTakeaway(tf1[0]));
checkTrue("merge AI 없음 → 룰 coaching 채움", mergedNoAi[0].phases.every((p) => p.coaching.length > 0));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: 실패 확인**

Run: `node test-artifacts/server/teamfight-phase-tests.mjs`
Expected: FAIL — `Error: const TEAMFIGHT_MIN_EVENTS not found` (함수/상수 미존재)

- [ ] **Step 3: 상수 추가** — `server.js`에서 `const CS_FULL_SCORE_TARGETS = ...;` 줄(현 ~19) 바로 다음에 추가

```js
// 한타 단계별 분석: 이 이상 관여 이벤트면 '한타'로 간주.
const TEAMFIGHT_MIN_EVENTS = 3;
// 한타 정리 단계 추격사 판정용 시간 간격(ms).
const CLEANUP_GAP_MS = 8000;
```

- [ ] **Step 4: `buildTeamfightPhases` 추가** — `server.js`의 `detectCombatEncounters` 함수 닫는 `}` 직후(현 ~1404)에 삽입

```js
// 한타 단계별 분석 — encounter(플레이어 킬/데스 시퀀스)를 진입/딜교환/정리로 분해.
// 데이터 한계: 이벤트는 CHAMPION_KILL/PLAYER_DEATH만 → 단계는 순서·간격으로 추론.
function buildTeamfightPhases(encounters, timelineEvents) {
  const byId = new Map((timelineEvents || []).map((e) => [e.eventId, e]));
  const teamfights = [];
  for (const enc of encounters || []) {
    if ((enc.eventCount ?? 0) < TEAMFIGHT_MIN_EVENTS) continue;
    const events = (enc.relatedEventIds || [])
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.timestampMs ?? 0) - (b.timestampMs ?? 0));
    if (events.length < TEAMFIGHT_MIN_EVENTS) continue;
    const last = events.length - 1;

    const phaseObj = (name, evs) => {
      let pk = 0, pd = 0;
      for (const e of evs) {
        if (!e.isPlayerInvolved) continue;
        if (e.eventType === "CHAMPION_KILL") pk += 1;
        else if (e.eventType === "PLAYER_DEATH") pd += 1;
      }
      return {
        phase: name,
        startLabel: evs.length ? evs[0].timestampLabel : "",
        endLabel: evs.length ? evs[evs.length - 1].timestampLabel : "",
        playerKills: pk,
        playerDeaths: pd,
        outcomeTag: null,
        relatedEventIds: evs.map((e) => e.eventId),
      };
    };

    const engage = phaseObj("ENGAGE", [events[0]]);
    const trade = phaseObj("TRADE", events.slice(1, last));
    const cleanup = phaseObj("CLEANUP", [events[last]]);

    engage.outcomeTag = events[0].eventType === "CHAMPION_KILL" ? "INITIATED_KILL" : "CAUGHT_OUT";
    trade.outcomeTag =
      trade.playerKills > trade.playerDeaths ? "TRADE_WON"
        : trade.playerDeaths > trade.playerKills ? "TRADE_LOST" : "TRADE_EVEN";
    const lastEvt = events[last];
    const prevEvt = events[last - 1];
    if (lastEvt.eventType === "CHAMPION_KILL") {
      cleanup.outcomeTag = "CLOSED_OUT";
    } else {
      const gap = (lastEvt.timestampMs ?? 0) - (prevEvt.timestampMs ?? 0);
      cleanup.outcomeTag =
        prevEvt.eventType === "CHAMPION_KILL" || gap > CLEANUP_GAP_MS ? "OVERCHASE_DEATH" : "DIED_IN_FIGHT";
    }

    const phases = [engage, trade, cleanup].filter((p) => p.relatedEventIds.length > 0);
    teamfights.push({
      teamfightId: enc.encounterId,
      gamePhase: enc.phase,
      startLabel: events[0].timestampLabel,
      endLabel: events[last].timestampLabel,
      totalKills: enc.playerKills,
      totalDeaths: enc.playerDeaths,
      situation: enc.situation,
      phases,
    });
  }
  return teamfights;
}
```

- [ ] **Step 5: 부분 통과 확인** (코칭/병합 함수는 Task 2에서 추가하므로 아직 일부 FAIL 가능)

Run: `node test-artifacts/server/teamfight-phase-tests.mjs`
Expected: `teamfightPhaseCoaching not found` 또는 그 이후 FAIL — buildTeamfightPhases 관련 check(TF1~필터)는 PASS, 코칭/merge는 함수 미존재로 FAIL. (Task 2에서 완성)

- [ ] **Step 6: 커밋**

```bash
git add server.js test-artifacts/server/teamfight-phase-tests.mjs
git commit -m "feat(server): 한타 단계 분해 buildTeamfightPhases + 회귀 테스트(구조)"
```

---

## Task 2: 서버 — 룰 코칭 템플릿 + 병합 함수

**Files:**
- Modify: `server.js` (`buildTeamfightPhases` 직후 삽입)
- Test: `test-artifacts/server/teamfight-phase-tests.mjs` (Task 1에서 생성, 추가 작성 없음 — 이미 코칭/merge 케이스 포함)

- [ ] **Step 1: `teamfightPhaseCoaching` / `teamfightTakeaway` / `mergeTeamfightCoaching` 추가** — `buildTeamfightPhases` 닫는 `}` 직후 삽입

```js
// 단계 + outcomeTag별 룰 기반 코칭 한 줄 (AI 누락 시 폴백).
function teamfightPhaseCoaching(phase, outcomeTag) {
  const map = {
    INITIATED_KILL: "한타 시작을 선제 킬/관여로 좋게 열었다.",
    CAUGHT_OUT: "한타 시작 직후 먼저 끊겨 인원·구도 손해로 출발했다.",
    TRADE_WON: "딜교환 구간에서 킬을 더 챙기며 이득을 봤다.",
    TRADE_LOST: "딜교환 구간에서 데스가 더 많아 손해를 봤다.",
    TRADE_EVEN: "딜교환은 비등하게 주고받았다.",
    CLOSED_OUT: "한타 마무리를 킬로 깔끔하게 정리했다.",
    OVERCHASE_DEATH: "한타가 정리되는 국면에서 무리한 추격으로 데스를 내줬다.",
    DIED_IN_FIGHT: "한타 막바지 교전에서 생존하지 못했다.",
  };
  return map[outcomeTag] || "";
}

function teamfightTakeaway(teamfight) {
  const tags = (teamfight.phases || []).map((p) => p.outcomeTag);
  if (tags.includes("CAUGHT_OUT")) return "한타 진입 전 시야와 포지션을 먼저 잡아 선제 피해를 줄이자.";
  if (tags.includes("OVERCHASE_DEATH")) return "이긴 한타는 추격보다 리셋·정리를 우선하자.";
  if (teamfight.situation === "PLAYER_DOMINANT") return "좋은 한타 흐름을 다음에도 반복하자.";
  return "한타 국면별 판단을 점검해 다음 교전에 적용하자.";
}

// 서버 구조 + AI 코칭 병합 — coaching/takeaway는 AI 우선, 없으면 룰 기반.
function mergeTeamfightCoaching(structure, aiArray) {
  const aiById = new Map((Array.isArray(aiArray) ? aiArray : []).map((t) => [t && t.teamfightId, t]));
  return (structure || []).map((tf) => {
    const ai = aiById.get(tf.teamfightId);
    const aiPhaseMap = new Map((ai && Array.isArray(ai.phases) ? ai.phases : []).map((p) => [p && p.phase, p]));
    const phases = tf.phases.map((p) => {
      const aiP = aiPhaseMap.get(p.phase);
      const coaching = aiP && typeof aiP.coaching === "string" && aiP.coaching.trim()
        ? aiP.coaching.trim()
        : teamfightPhaseCoaching(p.phase, p.outcomeTag);
      return { ...p, coaching };
    });
    const takeaway = ai && typeof ai.takeaway === "string" && ai.takeaway.trim()
      ? ai.takeaway.trim()
      : teamfightTakeaway(tf);
    return { ...tf, phases, takeaway };
  });
}
```

- [ ] **Step 2: 전체 테스트 통과 확인**

Run: `node test-artifacts/server/teamfight-phase-tests.mjs`
Expected: PASS — `N passed, 0 failed` (모든 check 통과)

- [ ] **Step 3: 구문 + 전체 스위트**

Run: `node --check server.js && node test-artifacts/run-tests.mjs | tail -2`
Expected: 구문 OK, 합계 `(224 + 신규)건 passed, 0 failed`

- [ ] **Step 4: 커밋**

```bash
git add server.js
git commit -m "feat(server): 한타 단계 룰 코칭 + AI 병합(mergeTeamfightCoaching)"
```

---

## Task 3: 서버 — 페이로드/분석/검증/폴백 배선 + 프롬프트

**Files:**
- Modify: `server.js` (buildLlmPayload, buildAnalysis, buildRuleBasedAnalysis, validateAnalysisOutput, OUTPUT_SCHEMA_EXAMPLE, CLAUDE/CODEX 프롬프트)

- [ ] **Step 1: `buildLlmPayload`에 teamfightPhases 입력 추가** — `const combatEncounters = detectCombatEncounters(normalized.timelineEvents);`(현 1416) 다음 줄에 추가

```js
  const teamfightPhases = buildTeamfightPhases(combatEncounters, normalized.timelineEvents);
```

그리고 반환 객체의 `combatEncounters,`(현 1433) 다음 줄에 추가:

```js
    teamfightPhases,
```

- [ ] **Step 2: `buildAnalysis` 병합 배선** — combatAnalysis 정규화 블록(현 1791~1798) 다음, `validateAnalysisOutput(primary)` 호출(현 1800) 전에 삽입

```js
  // 한타 단계별 분석: 서버 결정론적 구조 + AI 코칭 병합 (AI 누락/오형식 시 룰 기반 폴백)
  {
    const tfStructure = buildTeamfightPhases(
      detectCombatEncounters(normalized.timelineEvents),
      normalized.timelineEvents,
    );
    primary.teamfightPhaseAnalysis = mergeTeamfightCoaching(
      tfStructure,
      Array.isArray(primary.teamfightPhaseAnalysis) ? primary.teamfightPhaseAnalysis : [],
    );
  }
```

- [ ] **Step 3: `buildRuleBasedAnalysis` 폴백 필드 추가** — 반환 객체의 `combatAnalysis: [],`(현 1340) 다음 줄에 추가

```js
    teamfightPhaseAnalysis: mergeTeamfightCoaching(
      buildTeamfightPhases(detectCombatEncounters(normalized.timelineEvents), normalized.timelineEvents),
      [],
    ),
```

- [ ] **Step 4: `validateAnalysisOutput` 선택 검사 추가** — combatAnalysis 검증 블록 닫는 `}`(현 1642) 다음에 삽입

```js
  // 한타 단계별 분석은 선택적 — 있으면 배열 + 각 항목 형태만 검증.
  if (json.teamfightPhaseAnalysis !== undefined && json.teamfightPhaseAnalysis !== null) {
    if (!Array.isArray(json.teamfightPhaseAnalysis)) throw new Error("teamfightPhaseAnalysis not array");
    for (const tf of json.teamfightPhaseAnalysis) {
      if (!tf || typeof tf.teamfightId !== "string") throw new Error("teamfightPhaseAnalysis item missing teamfightId");
      if (!Array.isArray(tf.phases)) throw new Error("teamfightPhaseAnalysis item phases not array");
    }
  }
```

- [ ] **Step 5: OUTPUT_SCHEMA_EXAMPLE에 필드 추가** — `"evidenceIndex": [...]` 줄(현 1528) 앞에 추가(쉼표 주의: combatAnalysis 줄 끝에 이미 쉼표 있음)

`"combatAnalysis": [...],` 다음, `"evidenceIndex"` 앞 줄에:

```js
  "teamfightPhaseAnalysis": [{ "teamfightId": "enc_001", "phases": [{ "phase": "ENGAGE", "coaching": "진입 국면 코칭 한 줄" }, { "phase": "TRADE", "coaching": "딜교환 코칭" }, { "phase": "CLEANUP", "coaching": "정리 국면 코칭" }], "takeaway": "이 한타 핵심 교훈" }],
```

그리고 스키마 설명 헤더(현 1511 `combatAnalysis는 배열이다 ...` 줄) 다음 줄에 추가:

```js
teamfightPhaseAnalysis는 배열이다. 입력 payload의 teamfightPhases 각 항목당 1개씩 작성하되, 입력에 teamfightPhases가 없으면 빈 배열을 반환한다.
```

- [ ] **Step 6: 두 프롬프트에 지시 추가** — `CLAUDE_COACHING_PROMPT`의 `combatAnalysis: ...` 지시 문단(현 1541~1545) 다음에, 그리고 `CODEX_REDTEAM_PROMPT`의 combatAnalysis 지시(현 1584~1585) 다음에 각각 삽입

CLAUDE용:
```js

teamfightPhaseAnalysis: 입력 payload의 teamfightPhases 각 항목(teamfightId)마다 1개씩 작성. 각 phase(ENGAGE/TRADE/CLEANUP)별로 그 국면의 판단을 coaching 한 줄로, takeaway는 이 한타의 핵심 교훈 한 줄. teamfightId와 phase는 입력값을 그대로 반영. 입력 teamfightPhases가 0개면 빈 배열.
```

CODEX용:
```js

teamfightPhaseAnalysis: 입력 teamfightPhases 각 한타를 진입/딜교환/정리 국면으로 보고, 레드팀 관점에서 국면별 판단 실수를 coaching에 날카롭게 지적. 입력이 0개면 빈 배열.
```

- [ ] **Step 7: 구문 + 전체 스위트 확인**

Run: `node --check server.js && node test-artifacts/run-tests.mjs | tail -2`
Expected: 구문 OK, 합계 변동 없이 `... passed, 0 failed` (배선은 기존 테스트에 영향 없음)

- [ ] **Step 8: 라이브 생성 1건으로 출력 필드 확인** (선택, AI CLI 가능 시) — 불가하면 건너뛰고 Task 8 CDP에서 합성 검증

```bash
node -e "const fs=require('fs');const an=JSON.parse(fs.readFileSync('data/samples/sample-kr-8215889762/analysis-result.json','utf8'));console.log('legacy has field:', 'teamfightPhaseAnalysis' in an)"
```
Expected: `legacy has field: false` (레거시 샘플엔 없음 — 정상. 신규 생성분부터 채워짐)

- [ ] **Step 9: 커밋**

```bash
git add server.js
git commit -m "feat(server): teamfightPhaseAnalysis 페이로드/분석/검증/프롬프트 배선"
```

---

## Task 4: 프론트엔드 — 신규 섹션 DOM + 렌더

**Files:**
- Modify: `index.html` (분석 탭, 현 237~238 사이)
- Modify: `main.js` (dom 셀렉터 현 23 다음 / `renderTeamfightPhases` 신규 / `renderSample` 현 2927 다음)

- [ ] **Step 1: index.html 신규 섹션 추가** — `#combat-analysis` `</section>`(현 237) 다음, `</div><!-- /tab-analysis -->`(현 239) 앞에 삽입

```html
          <section class="section-block" id="teamfight-phases" aria-labelledby="teamfight-phases-title">
            <div class="section-heading">
              <h2 id="teamfight-phases-title">한타 단계별 분석</h2>
              <p class="section-copy">한타를 진입·딜교환·정리 단계로 나눠 어느 국면에서 잘했고 어디서 무너졌는지 짚습니다.</p>
            </div>
            <div class="moment-list" data-teamfight-phases></div>
          </section>
```

- [ ] **Step 2: main.js dom 셀렉터 추가** — `combatAnalysis: document.querySelector("[data-combat-analysis]"),`(현 23) 다음 줄

```js
  teamfightPhases: document.querySelector("[data-teamfight-phases]"),
```

- [ ] **Step 3: `renderTeamfightPhases` 추가** — `renderCombatAnalysis` 함수 닫는 `}`(현 2081) 직후 삽입

```js
// 한타 단계별 분석 카드. 서버가 채운 teamfightPhaseAnalysis(구조+코칭)를 그대로 렌더.
function renderTeamfightPhases(sample) {
  if (!dom.teamfightPhases) return;
  const items = Array.isArray(sample.analysis?.teamfightPhaseAnalysis)
    ? sample.analysis.teamfightPhaseAnalysis
    : [];
  if (items.length === 0) {
    dom.teamfightPhases.innerHTML = '<p class="muted">분석할 만한 대규모 한타가 없었습니다.</p>';
    return;
  }
  const phaseLabel = (p) => (p === "ENGAGE" ? "진입" : p === "TRADE" ? "딜교환" : p === "CLEANUP" ? "정리" : p || "");
  const tagLabel = (t) =>
    ({
      INITIATED_KILL: "선제 이니시", CAUGHT_OUT: "먼저 잘림",
      TRADE_WON: "딜교환 우위", TRADE_LOST: "딜교환 손해", TRADE_EVEN: "딜교환 비등",
      CLOSED_OUT: "마무리 성공", OVERCHASE_DEATH: "추격사", DIED_IN_FIGHT: "교전 중 사망",
    }[t] || "");
  dom.teamfightPhases.innerHTML = items
    .map((tf) => {
      const rows = (Array.isArray(tf.phases) ? tf.phases : [])
        .map(
          (p) => `
            <div class="tf-phase-row" data-outcome="${escapeAttr(p.outcomeTag || "")}">
              <div class="tf-phase-head">
                <strong>${escapeHtml(phaseLabel(p.phase))}</strong>
                <span class="tf-tag">${escapeHtml(tagLabel(p.outcomeTag))}</span>
                <span class="tf-kd">${escapeHtml(String(p.playerKills ?? 0))}K ${escapeHtml(String(p.playerDeaths ?? 0))}D</span>
              </div>
              <p>${escapeHtml(p.coaching || "")}</p>
            </div>`,
        )
        .join("");
      return `
        <article class="moment-card">
          <div class="moment-stamp">
            <span>${escapeHtml(tf.startLabel || "")}~${escapeHtml(tf.endLabel || "")}</span>
            <strong>${escapeHtml(tf.gamePhase || "")}</strong>
          </div>
          <div class="moment-copy">
            ${rows}
            <span class="tf-takeaway">${escapeHtml(tf.takeaway || "")}</span>
          </div>
        </article>`;
    })
    .join("");
}
```

- [ ] **Step 4: renderSample에서 호출** — `renderCombatAnalysis(sample);`(현 2927) 다음 줄에 추가

```js
  renderTeamfightPhases(sample);
```

- [ ] **Step 5: 구문 확인**

Run: `node --check main.js`
Expected: 출력 없음(정상)

- [ ] **Step 6: 커밋**

```bash
git add index.html main.js
git commit -m "feat(ui): 한타 단계별 분석 섹션 + renderTeamfightPhases"
```

---

## Task 5: CSS — 신규 섹션 스타일

**Files:**
- Modify: `styles.css` (파일 끝 또는 moment 관련 블록 인근에 추가)

- [ ] **Step 1: 스타일 추가** — `styles.css` 끝에 추가

```css
/* 한타 단계별 분석 */
.tf-phase-row {
  padding: 0.5rem 0;
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
}
.tf-phase-row:first-child { border-top: none; }
.tf-phase-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}
.tf-tag {
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-muted, #a9b3c1);
}
.tf-phase-row[data-outcome="CAUGHT_OUT"] .tf-tag,
.tf-phase-row[data-outcome="OVERCHASE_DEATH"] .tf-tag,
.tf-phase-row[data-outcome="DIED_IN_FIGHT"] .tf-tag,
.tf-phase-row[data-outcome="TRADE_LOST"] .tf-tag {
  background: rgba(244, 114, 114, 0.18);
  color: #f47272;
}
.tf-phase-row[data-outcome="INITIATED_KILL"] .tf-tag,
.tf-phase-row[data-outcome="CLOSED_OUT"] .tf-tag,
.tf-phase-row[data-outcome="TRADE_WON"] .tf-tag {
  background: rgba(110, 231, 183, 0.16);
  color: #6ee7b7;
}
.tf-kd { margin-left: auto; font-size: 0.78rem; color: var(--text-muted, #a9b3c1); }
.tf-takeaway { display: block; margin-top: 0.5rem; font-weight: 600; }
```

- [ ] **Step 2: 커밋**

```bash
git add styles.css
git commit -m "style: 한타 단계별 분석 카드 스타일"
```

---

## Task 6: 문서 — 스키마/프롬프트 입력 형식

**Files:**
- Modify: `analysis-json-schema.md`
- Modify: `llm-prompt-input-format.md`

- [ ] **Step 1: analysis-json-schema.md에 출력 필드 문서화** — combatAnalysis 섹션을 찾아 그 뒤에 추가

```bash
grep -n "combatAnalysis" analysis-json-schema.md | head
```
해당 섹션 다음에 추가:

```markdown
## `teamfightPhaseAnalysis` (선택 필드)

설명:
- 한타(플레이어 관여 교전, eventCount≥3)를 진입/딜교환/정리 3단계로 분해한 코칭. 서버 결정론적 구조 + AI 또는 룰 기반 코칭 병합. 레거시 샘플에는 없을 수 있음(선택적, requiredTopLevelFields 아님).

타입:
- `array`

항목 필드:
- `teamfightId`: `string` (= combatEncounters의 encounterId)
- `gamePhase`: `string` (EARLY/MID/LATE)
- `startLabel`/`endLabel`: `string`
- `totalKills`/`totalDeaths`: `number`
- `situation`: `string` (PLAYER_DOMINANT/PLAYER_DOWN/TRADED)
- `phases`: `array<{ phase, startLabel, endLabel, playerKills, playerDeaths, outcomeTag, coaching, relatedEventIds }>`
  - `phase`: `ENGAGE`/`TRADE`/`CLEANUP`
  - `outcomeTag`: `INITIATED_KILL`/`CAUGHT_OUT`/`TRADE_WON`/`TRADE_LOST`/`TRADE_EVEN`/`CLOSED_OUT`/`OVERCHASE_DEATH`/`DIED_IN_FIGHT`
- `takeaway`: `string`
```

- [ ] **Step 2: llm-prompt-input-format.md에 입력 필드 문서화** — combatEncounters 관련 섹션을 찾아 그 뒤에 추가

```bash
grep -n "combatEncounters" llm-prompt-input-format.md | head
```
해당 위치에 추가:

```markdown
### `teamfightPhases` (입력)

서버가 combatEncounters 중 eventCount≥3을 진입/딜교환/정리로 분해한 구조. AI는 각 teamfightId·phase에 `coaching` 한 줄과 한타별 `takeaway`를 채워 `teamfightPhaseAnalysis`로 반환한다. 각 항목: `{ teamfightId, gamePhase, startLabel, endLabel, totalKills, totalDeaths, situation, phases: [{ phase, startLabel, endLabel, playerKills, playerDeaths, outcomeTag, relatedEventIds }] }`.
```

- [ ] **Step 3: 커밋**

```bash
git add analysis-json-schema.md llm-prompt-input-format.md
git commit -m "docs: teamfightPhaseAnalysis 출력/입력 스키마 문서화"
```

---

## Task 7: 검증 — 전체 스위트 + 브라우저 스모크(CDP)

**Files:**
- 없음 (검증만). 임시 스크립트는 `/tmp/`에 작성.

- [ ] **Step 1: 전체 node 스위트**

Run: `node test-artifacts/run-tests.mjs | tail -3`
Expected: 합계 `(224 + Task1/2 신규 케이스)건 passed, 0 failed`

- [ ] **Step 2: 서버 + 헤드리스 Chrome 기동** (이미 떠 있으면 재사용)

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
curl -s -o /dev/null -w "server %{http_code}\n" http://localhost:8123/ || (PORT=8123 node server.js > /tmp/lolcoach-server.log 2>&1 &)
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
curl -s -o /dev/null http://localhost:9222/json/version || ("$CHROME" --headless=new --disable-gpu --no-first-run --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-lolcoach about:blank > /tmp/chrome.log 2>&1 &)
sleep 2
```

- [ ] **Step 3: CDP 스모크 작성** — `/tmp/cdp-teamfight.mjs` 생성. 레거시 샘플엔 필드가 없으므로 **합성 데이터**를 주입해 renderTeamfightPhases를 직접 구동(렌더 경로 검증). 빈 상태도 확인.

```js
const CDP = "http://localhost:9222", APP = "http://localhost:8123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = await (await fetch(`${CDP}/json`)).json();
const page = t.find((x) => x.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id).res(m.result ?? m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, { res }); ws.send(JSON.stringify({ id: mid, method, params })); });
await new Promise((r) => ws.addEventListener("open", r));
await send("Page.enable"); await send("Runtime.enable");
const evalJs = async (e, a = false) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: a }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result?.value; };
await send("Page.navigate", { url: APP });
for (let i = 0; i < 60; i++) { if ((await evalJs("document.readyState")) === "complete") break; await sleep(150); }
for (let i = 0; i < 40; i++) { if (await evalJs("typeof selectSample==='function'")) break; await sleep(150); }
await evalJs(`(async()=>{ await selectSample('sample-kr-8215889762'); setView('DETAIL_VIEW'); })()`, true);
// 합성 teamfightPhaseAnalysis 주입(서버 머지 결과 형태) 후 렌더
const r = await evalJs(`(()=>{
  const inject=[{teamfightId:"enc_001",gamePhase:"MID",startLabel:"18:10",endLabel:"18:56",totalKills:2,totalDeaths:1,situation:"PLAYER_DOMINANT",
    phases:[{phase:"ENGAGE",playerKills:1,playerDeaths:0,outcomeTag:"INITIATED_KILL",coaching:"선제 <b>이니시</b>"},
            {phase:"TRADE",playerKills:0,playerDeaths:1,outcomeTag:"TRADE_LOST",coaching:"딜교환 손해"},
            {phase:"CLEANUP",playerKills:1,playerDeaths:0,outcomeTag:"CLOSED_OUT",coaching:"마무리 성공"}],
    takeaway:"좋은 한타 흐름 반복"}];
  state.currentSample.analysis.teamfightPhaseAnalysis = inject;
  renderTeamfightPhases(state.currentSample);
  const host=document.querySelector('[data-teamfight-phases]');
  return { cards: host.querySelectorAll('.moment-card').length, rows: host.querySelectorAll('.tf-phase-row').length,
    escaped: host.innerHTML.includes('&lt;b&gt;'), rawTag: host.querySelectorAll('.tf-phase-row b').length,
    firstCoach: host.querySelector('.tf-phase-row p')?.textContent||'', takeaway: host.querySelector('.tf-takeaway')?.textContent||'' };
})()`);
console.log("INJECT:" + JSON.stringify(r));
// 빈 상태
const empty = await evalJs(`(()=>{ state.currentSample.analysis.teamfightPhaseAnalysis=[]; renderTeamfightPhases(state.currentSample); return document.querySelector('[data-teamfight-phases]').textContent.trim(); })()`);
console.log("EMPTY:" + empty);
ws.close();
const ok = r.cards === 1 && r.rows === 3 && r.escaped === true && r.rawTag === 0 && empty.includes("대규모 한타가 없");
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
```

- [ ] **Step 4: CDP 스모크 실행**

Run: `node /tmp/cdp-teamfight.mjs`
Expected: `INJECT:{"cards":1,"rows":3,"escaped":true,"rawTag":0,...}` + `EMPTY:...대규모 한타가 없었습니다.` + `PASS`

- [ ] **Step 5: 정리 + 최종 확인**

```bash
pkill -f "user-data-dir=/tmp/chrome-lolcoach" 2>/dev/null
node test-artifacts/run-tests.mjs | tail -2
git status --short
```
Expected: 테스트 합계 0 failed, 워킹 트리에 의도한 변경만(샘플 제외).

---

## Self-Review (작성자 체크)

**1. Spec coverage:**
- 3단계 분해 → Task 1 ✓ / 룰 코칭·폴백 → Task 2 ✓ / 하이브리드 배선·AI 프롬프트 → Task 3 ✓ / 신규 독립 섹션·UI → Task 4·5 ✓ / 선택 필드·하위호환 → Task 3 Step4(validate), Step3(폴백) ✓ / 빈 상태·escapeHtml → Task 4 ✓ / 테스트 → Task 1·2·7 ✓ / 문서 → Task 6 ✓ / 데이터 제약(CLEAN 제거) → File Structure 노트 ✓
- 갭 없음.

**2. Placeholder scan:** "적절히/등/TBD" 없음. 모든 코드 스텝에 완전한 코드 포함. ✓

**3. Type consistency:** `buildTeamfightPhases`/`teamfightPhaseCoaching`/`teamfightTakeaway`/`mergeTeamfightCoaching` 시그니처가 Task 1~3·테스트·렌더 전반에서 동일. 출력 `teamfightPhaseAnalysis[].phases[].{phase,outcomeTag,coaching,playerKills,playerDeaths}` 가 서버 머지·검증·렌더·CSS(data-outcome)에서 일관. outcomeTag enum 8종이 코칭맵·tagLabel·CSS·테스트에서 동일. ✓

> **구현 시 정련 (코드 리뷰 반영):** `teamfightPhaseCoaching`는 구현 단계에서 `(outcomeTag)` **단일 인자**로 확정됐다(위 Task 2 코드 블록의 `(phase, outcomeTag)`는 초기 초안). outcomeTag가 단계를 이미 결정하므로(ENGAGE↔INITIATED_KILL/CAUGHT_OUT 등) `phase` 인자는 불필요한 죽은 파라미터였고 제거됨. 호출부·테스트 모두 단일 인자 기준으로 일치.
