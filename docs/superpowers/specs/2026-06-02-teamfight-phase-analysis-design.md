# 한타 단계별 분석 (Teamfight Phase Analysis) — 설계

**작성일**: 2026-06-02
**상태**: 설계 승인됨 (구현 계획 대기)
**관련 기존 기능**: Phase 32 `combatEncounters` / `combatAnalysis` (전투 KDA 상황별 집중 분석), `phaseSummaries` (게임 단계별 요약)

---

## 1. 목적 · 한 줄 요약

플레이어가 관여한 교전(encounter)을 **진입 → 딜교환 → 정리**의 3단계로 분해해, 한타의 **어느 국면에서 잘했고 어디서 무너졌는지**를 단계별로 코칭한다. 기존 combatAnalysis가 "encounter 1건 = 상황(우세/열세/교환) + 코칭 1개"였다면, 본 기능은 그 한 단계 안으로 들어가 **국면별 판단**을 짚는다.

## 2. 범위 (Scope)

- **대상 교전**: 기존 `detectCombatEncounters` 결과 중 `eventCount >= TEAMFIGHT_MIN_EVENTS`(기본 **3**)인 encounter **전부**. encounter는 이미 `MAX_ENCOUNTERS = 8`로 상한이 있으므로 분석 대상은 자연히 0~8개.
- **3단계**: `ENGAGE`(진입/이니시) · `TRADE`(딜교환) · `CLEANUP`(정리/추격·이탈)
- **In scope**: 서버 결정론적 단계 분해 + outcomeTag, AI 단계별 코칭 서술, 룰 기반 폴백, 신규 UI 섹션, 회귀 테스트.
- **Out of scope (YAGNI)**: 5v5 전체 한타 재구성(데이터 없음), 포지셔닝/체력/스킬 분석(데이터 없음), 기존 combatAnalysis 변경, 게임 단계(EARLY/MID/LATE) 재정의.

## 3. 데이터 제약 (중요)

`detectCombatEncounters`는 `COMBAT_TYPES = {CHAMPION_KILL, PLAYER_DEATH}`만 25초 윈도(`WINDOW_MS = 25000`)로 묶는다. 즉 encounter는 **플레이어 본인이 관여한 킬/데스 시퀀스**이며 5v5 전체 교전이 아니다. 포지셔닝·체력·스킬·시야 데이터는 타임라인에 없다.

→ "내부 단계"는 **킬/데스 이벤트의 순서와 시간 간격**에서만 추론한다. 본 기능의 코칭은 "플레이어 관점에서 이 한타의 진입/딜교환/정리가 어땠는가"로 한정되며, 그 이상을 주장하지 않는다(정직성 원칙).

각 이벤트가 가진 필드: `eventId, timestampMs, timestampLabel, phase, eventType, importance, isPlayerInvolved, laneHint, summary`.

## 4. 아키텍처 · 데이터 흐름

하이브리드 — **서버가 결정론적 구조를 만들고, AI가 단계별 서술을 입힌다** (기존 `combatEncounters → combatAnalysis` 패턴과 동일).

```
normalized.timelineEvents
  → detectCombatEncounters (기존, 변경 없음)
  → buildTeamfightPhases (신규: eventCount>=N 필터 → 3단계 분할 → outcomeTag → 룰 기반 코칭)
  → buildLlmPayload.teamfightPhases (신규 입력 필드)
  → AI
  → analysis.teamfightPhaseAnalysis (신규 출력 필드)
  → 서버 병합/폴백 (AI 누락·오형식 시 룰 기반 구조로 채움)
  → renderTeamfightPhases (신규 렌더)
  → 신규 UI 섹션 [data-teamfight-phases]
```

## 5. 서버 — 결정론적 단계 분해

### 5.1 신규 상수
```js
const TEAMFIGHT_MIN_EVENTS = 3;   // 이 이상 관여 이벤트면 '한타'로 간주
const CLEANUP_GAP_MS = 8000;      // 정리 단계 추격사 판정용 시간 간격
```

### 5.2 신규 함수 `buildTeamfightPhases(encounters, timelineEvents)`
입력: `detectCombatEncounters`가 반환한 encounters + 원본 timelineEvents(eventId→event 매핑용).
처리: 각 encounter 중 `eventCount >= TEAMFIGHT_MIN_EVENTS`인 것만:

1. **이벤트 해석**: `encounter.relatedEventIds`를 시간순 정렬된 이벤트 객체로 매핑.
2. **단계 분할 (① 순서 위치 기반)**:
   - `ENGAGE = [events[0]]`
   - `CLEANUP = [events[last]]` (이벤트 ≥ 2건일 때)
   - `TRADE  = events[1 .. last-1]`
   - len 2 → ENGAGE + CLEANUP (TRADE 빈 배열), len 3 → 각 1건.
3. **단계별 집계**: `playerKills`, `playerDeaths`, `startLabel`, `endLabel`, `relatedEventIds`.
4. **outcomeTag (코칭 신호)**:
   - `engageOutcome`: `events[0].eventType === "CHAMPION_KILL"` → `INITIATED_KILL`(좋은 선제/이니시) / `PLAYER_DEATH` → `CAUGHT_OUT`(먼저 잘림·포지션 미스).
   - `cleanupOutcome`: 마지막 이벤트가 `PLAYER_DEATH`이고 (직전 이벤트가 `CHAMPION_KILL` **또는** 직전과의 간격 > `CLEANUP_GAP_MS`) → `OVERCHASE_DEATH`(추격사·오버익스텐션) / 마지막이 `CHAMPION_KILL` → `CLOSED_OUT`(마무리 성공) / 그 외 → `CLEAN`.
5. **룰 기반 코칭**(폴백용): 단계 + outcomeTag 조합별 템플릿 한국어 한 줄. 예: `CAUGHT_OUT` → "한타 시작 직후 먼저 끊겨 인원·구도 손해로 출발했다." / `OVERCHASE_DEATH` → "한타가 정리되는 국면에서 무리한 추격으로 데스를 내줬다."

반환(한타 1건):
```jsonc
{
  "teamfightId": "enc_001",          // encounterId 재사용
  "gamePhase": "MID",                // encounter.phase (EARLY/MID/LATE)
  "startLabel": "18:10", "endLabel": "18:56",
  "totalKills": 2, "totalDeaths": 1,
  "situation": "PLAYER_DOMINANT",    // encounter.situation 재사용
  "phases": [
    { "phase": "ENGAGE",  "startLabel": "18:10", "endLabel": "18:10",
      "playerKills": 1, "playerDeaths": 0, "outcomeTag": "INITIATED_KILL",
      "ruleCoaching": "…", "relatedEventIds": ["evt_010"] },
    { "phase": "TRADE",   … },
    { "phase": "CLEANUP", … }
  ]
}
```
순수 함수, 외부 의존 없음 → 텍스트 추출 + new Function 패턴으로 단위 테스트 가능.

## 6. AI 입력/출력 스키마

### 6.1 입력 — `buildLlmPayload`에 `teamfightPhases` 추가
서버가 만든 구조(5.2 반환, `ruleCoaching` 제외 가능)를 그대로 페이로드에 실어 AI에 컨텍스트로 제공.

### 6.2 출력 — `analysis.teamfightPhaseAnalysis` (신규, **선택 필드**)
```jsonc
{
  "teamfightId": "enc_001",
  "phases": [
    { "phase": "ENGAGE",  "coaching": "선제 이니시로 시작은 좋았다 …" },
    { "phase": "CLEANUP", "coaching": "다 이긴 한타에서 추격하다 잘렸다 …" }
  ],                       // 비어있지 않은 단계만, 서버 구조의 phase와 매칭
  "takeaway": "이 한타의 핵심 교훈 한 줄"
}
```

### 6.3 하위호환 · 폴백
- 기존 샘플(Track D 등)에는 이 필드가 없으므로 **`requiredTopLevelFields`에 넣지 않는다**(선택 필드 유지).
- AI가 누락·오형식이면 **서버 폴백**이 `buildTeamfightPhases`의 `ruleCoaching`으로 `teamfightPhaseAnalysis`를 채운다 → 필드 항상 존재, AI 없이도 동작.
- `validateAnalysisOutput`/`schemaViolations`: 필드가 **있을 때만** 형태 검사(teamfightId 매칭, phase enum, coaching 문자열). 없으면 위반 아님.

## 7. UI (신규 섹션, additive)

- **index.html**: 분석 탭(`#tab-analysis`)의 `#combat-analysis` 섹션 **뒤에** 신규 섹션 추가. 신규 컨테이너 `[data-teamfight-phases]` + 제목 "한타 단계별 분석". 기존 구조·셀렉터는 **수정하지 않고 추가만** 한다(Phase 32가 `[data-combat-analysis]`를 추가한 선례와 동일 — 디자인 불변식의 "셀렉터 보존"은 기존 셀렉터 변경 금지를 뜻하며 신규 추가는 허용).
- **main.js**: 신규 `renderTeamfightPhases(sample)` — `renderSample`에서 호출. 한타별 카드, 단계 행(시간 · K/D · outcomeTag 칩 · 코칭 텍스트). **모든 AI/파생 텍스트 `escapeHtml`**(커밋 8745858 컨벤션).
- 서버 구조의 `phases`와 AI의 `teamfightPhaseAnalysis.phases`를 `teamfightId`+`phase`로 병합해 렌더. 코칭 텍스트는 AI 우선, 없으면 `ruleCoaching`.
- **빈 상태**: 자격 한타 0개 → "분석할 만한 대규모 한타가 없었습니다."(combatAnalysis 빈 상태와 동일 톤).
- **CSS**: styles.css에 신규 섹션/카드/단계행/outcomeTag 칩 스타일 추가(기존 moment-card / insight 토큰 재사용).

## 8. 에러 처리 · 엣지 케이스

| 케이스 | 처리 |
| --- | --- |
| 자격 한타 0개 (모든 encounter < N건) | 빈 상태 메시지, 섹션은 렌더 |
| 2-이벤트 한타 | ENGAGE + CLEANUP, TRADE 빈 배열(렌더 시 빈 단계 생략) |
| AI가 `teamfightPhaseAnalysis` 누락/오형식 | 서버 룰 기반 폴백으로 채움 |
| AI가 일부 teamfightId만 반환 | 누락분은 룰 기반 폴백으로 보강 |
| 레거시 샘플(필드 없음) | 폴백 없이도 서버가 재생성하지 않음 → UI는 normalized 기반 재계산? **결정: 클라이언트는 `analysis.teamfightPhaseAnalysis`가 없으면 빈 상태**(서버 재생성 없이). 신규 샘플부터 채워짐 |
| 텍스트 내 마크업 | escapeHtml |

## 9. 테스트 전략

- **node 회귀 (신규 `teamfight-phase-tests.mjs`)**, extractFunctionSource + new Function 패턴(Phase 33 테스트와 동일):
  - 단계 분할 경계: len 2 / 3 / 5+ (ENGAGE·TRADE·CLEANUP 배정 정확).
  - outcomeTag 분기: `INITIATED_KILL` / `CAUGHT_OUT` / `OVERCHASE_DEATH`(킬 직후 데스 + 간격>8s 경계) / `CLOSED_OUT` / `CLEAN`.
  - `TEAMFIGHT_MIN_EVENTS` 필터(2건 제외, 3건 포함).
  - 룰 기반 코칭 폴백이 모든 단계/태그에 비어있지 않은 문자열 반환.
- **CDP 브라우저 스모크**(evidence 검증과 동일): 신규 섹션이 실제 샘플에서 한타 카드·단계 행을 렌더하는지, 빈 상태가 정상인지.
- 전체 node 스위트 회귀 무손상(현재 224/0 → 신규 추가분만큼 증가).

## 10. 영향 파일

| 파일 | 변경 |
| --- | --- |
| `server.js` | 상수 2개, `buildTeamfightPhases` 신규, `buildLlmPayload`에 `teamfightPhases`, AI 출력 병합/폴백, `validateAnalysisOutput` 선택 검사 |
| `index.html` | 분석 탭에 신규 섹션 + `[data-teamfight-phases]` (additive) |
| `main.js` | `renderTeamfightPhases` 신규 + `renderSample`에서 호출, dom 셀렉터 1개 추가 |
| `styles.css` | 신규 섹션/카드/칩 스타일 |
| `test-artifacts/server/teamfight-phase-tests.mjs` | 신규 회귀 |
| `analysis-json-schema.md` | `teamfightPhaseAnalysis` 스키마 문서화(선택 필드 명시) |
| `llm-prompt-input-format.md` | `teamfightPhases` 입력 필드 문서화 |

## 11. 기본값(제안, 조정 가능)

`TEAMFIGHT_MIN_EVENTS = 3` · `CLEANUP_GAP_MS = 8000` · 필드명 `teamfightPhaseAnalysis` / `teamfightPhases` · 섹션 제목 "한타 단계별 분석" · 배치: 분석 탭 combat-analysis 직후.
