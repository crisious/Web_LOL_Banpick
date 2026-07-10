# 분석 JSON 스키마 문서: LoL 리플레이 분석 웹페이지 MVP

작성일: 2026-04-10

관련 문서:
- [의사결정 문서](decision-replay-processing.md)
- [MVP PRD](prd-mvp-replay-analysis.md)
- [와이어프레임 문서](wireframes-mvp-replay-analysis.md)
- [개발 작업 티켓](tickets-mvp-replay-analysis.md)

## 1. 문서 목적

이 문서는 MVP에서 사용할 `분석 결과 JSON 포맷`을 정의한다.

목표는 아래와 같다.

- 프론트엔드가 안정적으로 렌더링할 수 있는 출력 구조를 고정한다
- 분석 로직과 UI가 같은 계약을 공유하게 한다
- LLM 응답이 너무 자유로운 텍스트로 흐르지 않도록 제한한다

## 2. 스키마 설계 원칙

- 모든 핵심 출력은 `구조화된 필드`로 반환한다
- UI에 필요한 정보만 우선 포함한다
- 근거 없는 분석을 줄이기 위해 `evidence` 필드를 필수에 가깝게 취급한다
- 텍스트는 짧고 스캔 가능해야 한다
- MVP에서는 복잡한 중첩보다 `읽기 쉬운 명시적 구조`를 우선한다

## 3. 최상위 스키마

최상위 객체는 아래 필드를 가진다.

```json
{
  "schemaVersion": "1.0",
  "analysisMeta": {},
  "matchSummary": {},
  "coachSummary": {},
  "phaseSummaries": [],
  "strengths": [],
  "weaknesses": [],
  "actionChecklist": [],
  "keyMoments": [],
  "evidenceIndex": [],
  "combatAnalysis": [],
  "teamfightPhaseAnalysis": [],
  "teamplayAnalysisV2": {}
}
```

## 4. 필드 정의

## 4.1 `schemaVersion`

설명:
- 분석 응답 포맷 버전

타입:
- `string`

예시:

```json
"1.0"
```

## 4.2 `analysisMeta`

설명:
- 분석 생성 메타데이터

타입:
- `object`

주요 필드:

- `analysisId`: `string`
- `generatedAt`: `string`
- `sourceType`: `string`
- `language`: `string`
- `confidence`: `number` (룰 기반 fallback에서만 채워짐 — 라이브 AI 샘플에는 없을 수 있음)
- `schemaViolations`: `array<string>` — 서버측 정규화 중 발견된 위반 패턴 (Track C 측정, `server.js`에서 기록)
- `schemaViolationCount`: `number` — `schemaViolations` 개수 편의 필드

예시:

```json
{
  "analysisId": "analysis_20260410_match_001",
  "generatedAt": "2026-04-10T13:30:00+09:00",
  "sourceType": "match_timeline",
  "language": "ko",
  "confidence": 0.82,
  "schemaViolations": [],
  "schemaViolationCount": 0
}
```

필드 메모:

- `sourceType`은 `match_timeline`, `mock`, `manual`, `other` 중 하나를 권장
- `confidence`는 0~1 범위를 사용
- 위 목록은 주요 필드이며, 레거시 샘플은 `champion`/`matchId`/`position`/`result`/`riotId`/`schemaVersion`을 `analysisMeta`에 추가로 담고 있을 수 있다 (계약상 닫힌 집합 아님)

## 4.3 `matchSummary`

설명:
- 경기의 기본 메타 정보와 한줄 요약에 필요한 필드

타입:
- `object`

필드:

- `matchId`: `string`
- `queueType`: `string`
- `gameVersion`: `string`
- `durationSeconds`: `number`
- `result`: `string`
- `champion`: `string`
- `role`: `string`
- `headline`: `string`

예시:

```json
{
  "matchId": "KR_1234567890",
  "queueType": "RANKED_SOLO",
  "gameVersion": "15.7.1",
  "durationSeconds": 1924,
  "result": "LOSS",
  "champion": "Ahri",
  "role": "MID",
  "headline": "초반 주도권은 있었지만 중반 시야 공백과 무리한 합류 타이밍으로 흐름을 잃은 경기"
}
```

## 4.4 `coachSummary`

설명:
- 사람이 읽는 경기 해석 요약

타입:
- `object`

필드:

- `overallSummary`: `string`
- `gameFlowSummary`: `string`
- `winLossReason`: `string`

예시:

```json
{
  "overallSummary": "라인전과 초반 로밍은 괜찮았지만, 중반 오브젝트 구도에서 시야 우위 없이 먼저 진입한 장면이 누적되며 패배로 이어졌다.",
  "gameFlowSummary": "초반에는 라인 주도권을 바탕으로 킬 관여를 만들었지만, 14분 이후 드래곤과 사이드 시야를 잃으면서 주도권이 급격히 넘어갔다.",
  "winLossReason": "중반 이후 시야 정보 없이 시작한 교전과 늦은 합류 타이밍이 핵심 패인으로 보인다."
}
```

작성 원칙:

- 각 문장은 1~3문장 내로 제한
- 과도하게 일반적인 표현보다 경기 기반 문장을 우선

## 4.5 `phaseSummaries`

설명:
- 경기 구간별 평가

타입:
- `array<object>`

배열 원소 필드:

- `phase`: `string`
- `rating`: `string`
- `summary`: `string`
- `focus`: `string`

권장 phase 값:

- `EARLY`
- `MID`
- `LATE`

권장 rating 값:

- `GOOD`
- `NEUTRAL`
- `BAD`

예시:

```json
[
  {
    "phase": "EARLY",
    "rating": "GOOD",
    "summary": "라인 주도권과 첫 로밍 타이밍은 좋았다.",
    "focus": "주도권을 만들었을 때 시야와 오브젝트로 연결하는 흐름이 필요하다."
  },
  {
    "phase": "MID",
    "rating": "BAD",
    "summary": "드래곤과 강가 시야가 비는 구간에서 위험한 진입이 반복됐다.",
    "focus": "오브젝트 40초 전 선시야 확보와 팀 합류 타이밍 정리가 필요하다."
  },
  {
    "phase": "LATE",
    "rating": "NEUTRAL",
    "summary": "후반에는 교전 참여는 했지만 이미 불리한 시야 구도를 뒤집지 못했다.",
    "focus": "후반에는 진입보다 생존과 후속 딜 각 유지의 우선순위가 더 높다."
  }
]
```

## 4.6 `strengths`

설명:
- 잘한 점 인사이트 목록

타입:
- `array<object>`

배열 원소 필드:

- `id`: `string`
- `title`: `string`
- `description`: `string`
- `evidence`: `string`
- `impact`: `string`
- `relatedEventIds`: `array<string>`

예시:

```json
[
  {
    "id": "str_01",
    "title": "초반 로밍 타이밍 선택이 좋았음",
    "description": "라인을 먼저 밀어 넣은 뒤 사이드 개입 타이밍을 잘 잡아 초반 주도권 형성에 기여했다.",
    "evidence": "6분대 첫 로밍 관여와 9분대 스커미시 합류에서 킬 관여를 만들었다.",
    "impact": "초반 골드 흐름을 앞당기고 팀 전체 압박을 높이는 데 도움이 됐다.",
    "relatedEventIds": ["evt_006", "evt_009"]
  }
]
```

규칙:

- MVP에서는 기본적으로 3개 권장
- 각 항목은 근거 문장 포함 권장

## 4.7 `weaknesses`

설명:
- 아쉬운 점 인사이트 목록

타입:
- `array<object>`

배열 원소 필드:

- `id`: `string`
- `title`: `string`
- `description`: `string`
- `evidence`: `string`
- `impact`: `string`
- `improvementHint`: `string`
- `relatedEventIds`: `array<string>`

예시:

```json
[
  {
    "id": "weak_01",
    "title": "중반 오브젝트 전 시야 준비가 부족했음",
    "description": "드래곤과 바론 구도에서 정보 없이 먼저 접근하는 장면이 반복됐다.",
    "evidence": "14분, 22분 구간에서 강가 시야를 잃은 상태로 교전이 시작됐다.",
    "impact": "선포지션을 내주고 불리한 진입을 하게 되어 팀 교전 효율이 떨어졌다.",
    "improvementHint": "오브젝트 30~40초 전에 먼저 강가 진입 타이밍을 잡고 혼자 앞시야를 먹지 않는 습관이 필요하다.",
    "relatedEventIds": ["evt_014", "evt_022"]
  }
]
```

규칙:

- MVP에서는 기본적으로 3개 권장
- 비난형 문장보다 코칭형 문장을 사용

## 4.8 `actionChecklist`

설명:
- 다음 게임에서 바로 실행할 행동 목록

타입:
- `array<object>`

배열 원소 필드:

- `id`: `string`
- `priority`: `number`
- `action`: `string`
- `reason`: `string`

예시:

```json
[
  {
    "id": "act_01",
    "priority": 1,
    "action": "오브젝트 40초 전 강가 시야 확보를 먼저 시작하기",
    "reason": "중반 이후 시야 공백에서 시작한 교전이 반복적으로 손해로 이어졌다."
  },
  {
    "id": "act_02",
    "priority": 2,
    "action": "사이드 압박 전 적 정글 위치가 안 보이면 진입 각을 늦추기",
    "reason": "정보 없이 먼저 들어간 장면에서 데스 리스크가 크게 올라갔다."
  }
]
```

규칙:

- 3~5개 권장
- 한 문장으로 바로 실천 가능한 행동이어야 함

## 4.9 `keyMoments`

설명:
- 경기 흐름에서 중요한 전환점 목록

타입:
- `array<object>`

배열 원소 필드 (별칭 허용 — 둘 중 하나가 non-blank이면 통과):

- `eventId`: `string` (별칭 `id`) — 필수
- `timestamp`: `string` (별칭 `timestampLabel`) — 필수
- `phase`: `string` — `EARLY`/`MID`/`LATE` 필수
- `label`: `string` (별칭 `title`) — 필수
- `reason`: `string` (별칭 `description`) — 필수
- `relatedEventIds`: `array<string>` — **필수.** 비어 있지 않은 evidenceIndex `eventId` 참조 (누락 시 `keyMoments invalid` throw)
- `impact`: `string` — 선택 (검증 안 함)
- `importance`: `number` — 선택 (검증 안 함, 1~5 권장)

예시:

```json
[
  {
    "eventId": "evt_006",
    "timestamp": "05:40",
    "phase": "EARLY",
    "label": "첫 로밍 관여 성공",
    "reason": "라인 주도권을 활용해 먼저 합류하면서 수적 우위를 만들었다.",
    "relatedEventIds": ["evt_006"],
    "impact": "초반 템포를 잡는 계기가 됐다.",
    "importance": 4
  },
  {
    "eventId": "evt_014",
    "timestamp": "14:20",
    "phase": "MID",
    "label": "드래곤 전 시야 손실",
    "reason": "강가 시야가 없는 상태에서 늦게 진입해 상대에게 선포지션을 줬다.",
    "relatedEventIds": ["evt_014"],
    "impact": "중반 주도권이 넘어가는 결정적 장면이었다.",
    "importance": 5
  }
]
```

규칙:

- 최소 4개 (`KEY_MOMENTS_MIN`), 4~8개 권장
- 중요도는 1~5 범위 사용
- 각 항목에 `relatedEventIds` 필수

## 4.10 `evidenceIndex`

설명:
- 인사이트와 연결되는 원시 근거 이벤트 목록

타입:
- `array<object>`

배열 원소 필드:

- `eventId`: `string`
- `timestamp`: `string`
- `eventType`: `string`
- `summary`: `string`
- `statNote`: `string`

예시:

```json
[
  {
    "eventId": "evt_006",
    "timestamp": "05:40",
    "eventType": "ROAM_SUCCESS",
    "summary": "미드 라인 푸시 후 바텀 스커미시에 먼저 합류해 킬 관여를 만들었다.",
    "statNote": "초반 킬 관여율 상승 구간"
  },
  {
    "eventId": "evt_014",
    "timestamp": "14:20",
    "eventType": "OBJECTIVE_SETUP_FAIL",
    "summary": "드래곤 전 강가 시야 없이 진입하며 교전 시작 위치를 내줬다.",
    "statNote": "중반 시야 열세 구간"
  }
]
```

역할:

- 카드별 `relatedEventIds`가 참조할 수 있는 공통 인덱스
- UI에서 추후 펼침형 상세 근거로 확장 가능

## 4.11 `combatAnalysis` (Phase 32 추가, 선택적)

설명:

- 전투 KDA 상황(한타·교전 단위)별 집중 분석
- 서버가 `timelineEvents`의 CHAMPION_KILL / PLAYER_DEATH를 25초 윈도우로 인접 그룹화해 사전 계산한 `combatEncounters`를 페이로드에 포함하면, AI가 각 encounter마다 한 항목씩 작성한다.
- 입력 encounter가 0개면 빈 배열이 정상.

타입:

- `array<object>`

배열 원소 필드:

- `encounterId`: `string` — 입력 payload의 encounterId와 동일 (예: `"enc_001"`) — 필수
- `situation`: `"PLAYER_DOMINANT"` \| `"PLAYER_DOWN"` \| `"TRADED"` — encounter의 KDA 결과 enum, 입력값 그대로 반영 — **필수**
- `situationLabel`: `string` — 교전 상황을 한 줄로 요약 (예: "초반 라인전 솔로킬", "오브젝트 셋업 중 cut off") — 필수
- `playerDecision`: `string` — 그 순간 플레이어의 판단/포지셔닝 (사실 기반) — 필수
- `takeaway`: `string` — 다음에 같은 상황에서 적용할 짧은 교훈 — 필수
- `relatedEventIds`: `array<string>` — encounter에 포함된 timeline 이벤트 ID 목록 (비어 있지 않은 string) — 필수

예시:

```json
[
  {
    "encounterId": "enc_001",
    "situation": "PLAYER_DOMINANT",
    "situationLabel": "초반 라인전 솔로킬",
    "playerDecision": "상대 정글 동선이 탑으로 빠진 타이밍에 E 가드 후 W 진입",
    "takeaway": "초반 솔로킬은 정글 시야 + W 쿨다운이 갖춰진 타이밍에만 시도",
    "relatedEventIds": ["evt_001", "evt_002"]
  }
]
```

검증 규칙 (`validateAnalysisOutput`):

- 필드 누락(`undefined`)/`null`/빈 배열 → 통과 (선택적, 기존 코호트 backward-compat)
- 배열이 아닌 값 → throw `"combatAnalysis not array"`
- 항목별로 다음이 비면 throw: `encounterId`(missing encounterId), `situation`(missing situation — enum 외 값도 throw), `situationLabel`, `playerDecision`, `takeaway`, `relatedEventIds`(빈 배열 또는 non-string 포함 시 throw)

역할:

- 한 경기 내 여러 교전 상황을 분리해 패턴을 드러내 줌 (단일 weaknesses/keyMoments로는 묻히는 반복 행동을 카드 단위로 분해)
- UI는 `data-combat-analysis` 영역에 카드 형태로 렌더링하며, `relatedEventIds`의 첫 번째 ID로 시작 시간을 보조 표시

## 4.12 `teamfightPhaseAnalysis` (선택 필드)

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

## 4.13 `teamplayAnalysisV2` (추가·서버 파생 필드)

설명:

- 원본 타임라인에서 서버가 만든 v2 사실 모델에 검증된 코칭 선택을 결합한 최종 응답
- `normalized.teamplayAnalysisV2`와 같은 도메인 배열을 유지하되 `personalReviews[].narrative`가 채워진다
- `combatAnalysis`와 `teamfightPhaseAnalysis`는 구버전 소비자를 위해 유지한다. renderable v2가 있으면 새 UI는 v2만 표시한다
- 최종 응답의 사실, 시각, 위치, 획득 팀, fact ID는 AI가 생성하거나 수정할 수 없다

`narrative` 필드:

- `factStatements`: 표시 가능한 모든 review fact에 대한 서버 렌더 문장. 각 항목은 `factId`, `claimCode`, `text`, `evidenceIds`, `source: "SERVER_FACT_TEMPLATE"`을 가진다
- `decisionAssessment`: 확인된 개인 킬·어시스트·사망 중 하나를 서버 템플릿으로 표시하거나 근거가 없으면 `null`
- `positioningObservation`: 과거 위치 프레임 기반 관찰을 서버 템플릿으로 표시하거나 근거가 없으면 `null`
- `coaching`: 검증된 추천이 있으면 아래 객체, 허용 근거가 없으면 `null`

```json
{
  "recommendationCode": "DECIDE_JOIN_OR_TRADE_EARLY",
  "betterChoice": "오브젝트 생성 전에 합류 또는 반대편 교환 계획을 먼저 확정하세요.",
  "nextGameRule": "오브젝트 30초 전 5,000보다 멀면 합류와 교환 중 하나를 결정하세요.",
  "evidenceIds": ["fact_far"],
  "selectionSource": "AI_SELECTED"
}
```

허용 `recommendationCode`는 `GROUP_BEFORE_OBJECTIVE`, `DECIDE_JOIN_OR_TRADE_EARLY`, `REVIEW_OPENING_DEATH`, `RESET_AFTER_CAPTURE`다. `selectionSource`는 `AI_SELECTED` 또는 `RULE_FALLBACK`이다. `betterChoice`와 `nextGameRule`은 recommendationCode에 고정된 서버 문구와 정확히 일치해야 한다.

통합 테스트 합성 경기에서 생성된 실제 최종 응답 발췌:

```json
{
  "schemaVersion": "2.0",
  "coverage": {
    "level": "FULL",
    "source": "RAW_TIMELINE",
    "usablePositionSceneRatio": 1,
    "limitationCodes": [
      "INCOMPLETE_TEAM_SNAPSHOT",
      "STALE_TEAM_SNAPSHOT"
    ]
  },
  "encounters": [
    {
      "id": "enc_e32e8df57424ca46bd1c",
      "type": "TEAMFIGHT_CANDIDATE",
      "allyDeaths": 1,
      "enemyDeaths": 3,
      "firstTakedownTeam": "ALLY",
      "startTimestamp": 600000,
      "endTimestamp": 618000,
      "confidence": "HIGH"
    }
  ],
  "objectiveEngagements": [
    {
      "id": "obj_002cadf98b3ac9e40f4c",
      "objectiveType": "DRAGON",
      "captureCounts": { "ally": 0, "enemy": 1, "unknown": 0 },
      "captureTeam": "ENEMY",
      "linkedEncounterIds": ["enc_e32e8df57424ca46bd1c"]
    }
  ],
  "scenes": [
    {
      "sceneId": "scene_3d929d1e0bafdd6cafa9",
      "primaryType": "OBJECTIVE",
      "effectiveInvolvementLevel": "CONFIRMED",
      "importanceScore": 110
    }
  ],
  "personalReviews": [
    {
      "reviewId": "review_0325899addd9b093534f",
      "sceneId": "scene_3d929d1e0bafdd6cafa9",
      "effectiveInvolvementLevel": "CONFIRMED",
      "evidenceIds": [
        "fact_5545ee34f0170285ec28",
        "fact_1e88a355823416cd5b14",
        "fact_5bc2297db5edbe6934a2",
        "fact_85e023cf6f30f9ab67a6",
        "fact_73023c5e2f3a105bc3bd",
        "fact_c27f0d8873cd0ac97d47",
        "fact_fdfda55f7519b94adf81",
        "fact_cf0913564de8bd76fe76",
        "fact_8efaa5b4c6e6971f71c4",
        "fact_af296a454908ba42deb1"
      ],
      "narrative": {
        "decisionAssessment": {
          "claimCode": "PLAYER_RECORDED_ASSIST",
          "text": "대상 플레이어의 어시스트가 기록됐습니다.",
          "evidenceIds": ["fact_fdfda55f7519b94adf81"],
          "source": "SERVER_FACT_TEMPLATE"
        },
        "positioningObservation": {
          "claimCode": "POSITION_DISTANCE_LE_2500",
          "text": "사용 가능한 과거 프레임에서 교전 중심과의 거리는 2,500 이하였습니다.",
          "evidenceIds": ["fact_8efaa5b4c6e6971f71c4"],
          "source": "SERVER_FACT_TEMPLATE"
        },
        "coaching": null
      },
      "teamAppendixId": "appendix_80656060a13e87cc7411"
    }
  ],
  "teamAppendix": [
    {
      "teamAppendixId": "appendix_80656060a13e87cc7411",
      "reviewId": "review_0325899addd9b093534f",
      "firstTakedownTeam": "ALLY",
      "allyDeaths": 1,
      "enemyDeaths": 3,
      "captureTeam": "ENEMY"
    }
  ]
}
```

위 예시는 도메인 객체의 대표 필드만 발췌했다. 전체 필드와 fact closed enum은 `normalized-match-schema.md`의 §5.10을 따른다.

### AI 임시 선택 봉투

AI 입력에는 사실 원문 대신 `teamplayRecommendationCandidates.reviews`의 허용 코드와 fact ID만 전달한다. AI는 다음 임시 필드만 반환한다.

```json
{
  "teamplayRecommendationSelections": {
    "reviews": [
      {
        "reviewId": "review_id_from_payload",
        "recommendationCode": "eligible_code_from_payload",
        "evidenceIds": ["permitted_fact_id_from_payload"]
      }
    ]
  }
}
```

이 봉투는 정확한 key 집합과 허용 후보를 검증한 뒤 삭제된다. `teamplayRecommendationSelections`는 최종 API 응답이나 저장 분석에 남지 않는다. 자유 코칭 문장, 새 코드, 새 fact ID, 변경된 시각은 모두 거부하며 해당 리뷰는 `RULE_FALLBACK`을 사용하고 `INVALID_AI_SELECTION`을 기록한다.

저장 분석을 다시 열 때도 같은 신뢰 경계를 적용한다. raw match/timeline이 있으면 도메인 사실을 원본에서 다시 만들고, 저장된 `AI_SELECTED` 코드는 새로 생성된 허용 후보와 다시 대조한다. raw 파일이 없으면 각 fact의 type별 `value` shape, sourceRef의 정확한 공개 필드, limitation, review 기반 stable `factId`를 검증하고 encounter/objective/scene 값과 다시 대조한다. 저장된 `factStatements`, 판단·포지셔닝 문장, 코칭 자유 문구는 그대로 신뢰하지 않고 서버 fact template과 검증된 recommendation template으로 재생성한다. 팀 부록의 사망·획득·전환 결과와 fact ID도 검증된 개인 리뷰 fact에서 다시 만들며, 팀 소속을 원본으로 확인할 수 없는 직접 참가자 목록은 비운다. 교전 전 골드와 획득 후 사망 정보는 각각 모든 frame의 교전 이전성 및 실제 획득 시각과의 millisecond 차이를 검증한다. 부적합한 fact는 해당 리뷰와 부록에서 격리하고 `INVALID_V2_ITEM`을, 부적합한 추천은 `INVALID_AI_SELECTION`을 기록한다.

## 5. 최소 유효 응답 조건

아래 조건을 **모두** 만족해야 `validateAnalysisOutput`이 통과한다(하나라도 어기면 throw).

- `schemaVersion` 존재 (non-blank)
- `analysisMeta.sourceType` 존재 (non-blank)
- `analysisMeta.language` 존재 (non-blank)
- `matchSummary.headline` 존재
- `coachSummary.overallSummary` 존재
- `phaseSummaries` 최소 3개 (각 항목 `phase`는 EARLY/MID/LATE, `summary` 필수)
- `strengths` 정확히 3개 (min = max = 3)
- `weaknesses` 정확히 3개 (min = max = 3)
- `actionChecklist` 3~5개
- `keyMoments` 최소 4개 (각 항목 shape는 §4.9 참조 — `relatedEventIds` 필수)
- `evidenceIndex` 최소 1개 (각 항목 `eventId` + `summary`|`shortNote`)
- `combatAnalysis` (있는 경우) 각 항목에 `situation`(enum)·`situationLabel`·`playerDecision`·`takeaway`·`relatedEventIds` 필수 (§4.11)
- `teamplayAnalysisV2` (있는 경우) schemaVersion, coverage, 5개 도메인 배열을 포함하는 유효한 v2 root여야 한다 (§4.13)

> 위 수치는 `server.js` 상수에서 파생된다: `PHASE_SUMMARIES_MIN = 3`, `INSIGHT_LIST_MIN = INSIGHT_LIST_MAX = 3`,
> `ACTION_CHECKLIST_MIN = 3` / `ACTION_CHECKLIST_MAX = 5`, `KEY_MOMENTS_MIN = 4`, `EVIDENCE_INDEX_MIN = 1`.

## 6. 타입 규칙

- `confidence`: 0 이상 1 이하
- `importance`: 1 이상 5 이하
- `priority`: 1 이상 5 이하
- `timestamp`: `MM:SS` 형식 권장
- `result`: `WIN` 또는 `LOSS`
- `role`: `TOP`, `JUNGLE`, `MID`, `ADC`, `SUPPORT` 중 하나 권장

## 7. 작성 금지 규칙

LLM 또는 분석 로직은 아래를 피해야 한다.

- 근거 없는 추상적 칭찬
- 근거 없는 추상적 비난
- 같은 의미의 중복 인사이트
- 플레이어 챔피언/포지션과 무관한 일반론 남발
- UI 렌더링에 불필요한 장문 에세이

## 8. LLM 출력 원칙

- 반드시 JSON만 출력한다
- 설명문이나 코드블록 바깥 텍스트를 추가하지 않는다
- 필드 이름을 임의 변경하지 않는다
- `strengths`, `weaknesses`, `actionChecklist`는 비어 있지 않아야 한다
- 가능하면 모든 인사이트에 `relatedEventIds`를 연결한다
- `teamplayRecommendationSelections`는 입력 후보의 reviewId, recommendationCode, evidenceIds만 그대로 선택한다. 후보 밖 사실이나 자유 문장을 만들지 않는다
- AI가 반환한 `teamplayRecommendationSelections`는 서버 병합 후 삭제되며 `teamplayAnalysisV2` 자체는 AI 출력으로 받지 않는다

## 9. 예시 전체 응답

```json
{
  "schemaVersion": "1.0",
  "analysisMeta": {
    "analysisId": "analysis_20260410_match_001",
    "generatedAt": "2026-04-10T13:30:00+09:00",
    "sourceType": "match_timeline",
    "language": "ko",
    "confidence": 0.82
  },
  "matchSummary": {
    "matchId": "KR_1234567890",
    "queueType": "RANKED_SOLO",
    "gameVersion": "15.7.1",
    "durationSeconds": 1924,
    "result": "LOSS",
    "champion": "Ahri",
    "role": "MID",
    "headline": "초반 주도권은 있었지만 중반 시야 공백과 무리한 합류 타이밍으로 흐름을 잃은 경기"
  },
  "coachSummary": {
    "overallSummary": "라인전과 초반 로밍은 괜찮았지만, 중반 오브젝트 구도에서 시야 우위 없이 먼저 진입한 장면이 누적되며 패배로 이어졌다.",
    "gameFlowSummary": "초반에는 라인 주도권을 바탕으로 킬 관여를 만들었지만, 14분 이후 드래곤과 사이드 시야를 잃으면서 주도권이 급격히 넘어갔다.",
    "winLossReason": "중반 이후 시야 정보 없이 시작한 교전과 늦은 합류 타이밍이 핵심 패인으로 보인다."
  },
  "phaseSummaries": [
    {
      "phase": "EARLY",
      "rating": "GOOD",
      "summary": "라인 주도권과 첫 로밍 타이밍은 좋았다.",
      "focus": "주도권을 만들었을 때 시야와 오브젝트로 연결하는 흐름이 필요하다."
    },
    {
      "phase": "MID",
      "rating": "BAD",
      "summary": "드래곤과 강가 시야가 비는 구간에서 위험한 진입이 반복됐다.",
      "focus": "오브젝트 40초 전 선시야 확보와 팀 합류 타이밍 정리가 필요하다."
    },
    {
      "phase": "LATE",
      "rating": "NEUTRAL",
      "summary": "후반에는 교전 참여는 했지만 이미 불리한 시야 구도를 뒤집지 못했다.",
      "focus": "후반에는 진입보다 생존과 후속 딜 각 유지의 우선순위가 더 높다."
    }
  ],
  "strengths": [
    {
      "id": "str_01",
      "title": "초반 로밍 타이밍 선택이 좋았음",
      "description": "라인을 먼저 밀어 넣은 뒤 사이드 개입 타이밍을 잘 잡아 초반 주도권 형성에 기여했다.",
      "evidence": "6분대 첫 로밍 관여와 9분대 스커미시 합류에서 킬 관여를 만들었다.",
      "impact": "초반 골드 흐름을 앞당기고 팀 전체 압박을 높이는 데 도움이 됐다.",
      "relatedEventIds": ["evt_006", "evt_009"]
    },
    {
      "id": "str_02",
      "title": "초반 라인 주도권 활용이 안정적이었음",
      "description": "라인을 급하게 손해 보지 않으면서도 먼저 움직일 여지를 만들었다.",
      "evidence": "초반 웨이브 우위와 선합류 타이밍이 여러 번 확인됐다.",
      "impact": "초반 주도권 형성과 로밍 선택지 확보에 도움이 됐다.",
      "relatedEventIds": ["evt_003", "evt_006"]
    },
    {
      "id": "str_03",
      "title": "불리해진 뒤에도 주요 교전에 계속 관여했음",
      "description": "중반 이후 밀리는 구도에서도 팀 교전에 완전히 고립되지 않았다.",
      "evidence": "후반 두 차례 주요 교전에서 후속 합류와 스킬 연계가 있었다.",
      "impact": "완전히 무너지는 속도를 늦추고 역전 가능성을 일부 남겼다.",
      "relatedEventIds": ["evt_024", "evt_027"]
    }
  ],
  "weaknesses": [
    {
      "id": "weak_01",
      "title": "중반 오브젝트 전 시야 준비가 부족했음",
      "description": "드래곤과 바론 구도에서 정보 없이 먼저 접근하는 장면이 반복됐다.",
      "evidence": "14분, 22분 구간에서 강가 시야를 잃은 상태로 교전이 시작됐다.",
      "impact": "선포지션을 내주고 불리한 진입을 하게 되어 팀 교전 효율이 떨어졌다.",
      "improvementHint": "오브젝트 30~40초 전에 먼저 강가 진입 타이밍을 잡고 혼자 앞시야를 먹지 않는 습관이 필요하다.",
      "relatedEventIds": ["evt_014", "evt_022"]
    },
    {
      "id": "weak_02",
      "title": "합류 각을 서두르며 위험한 진입을 했음",
      "description": "아군과 적의 위치 정보가 완전히 정리되지 않은 상태에서 먼저 들어간 장면이 있었다.",
      "evidence": "18분대 교전에서 후속 진입이 아니라 선진입 형태가 되며 손해를 봤다.",
      "impact": "중반 손해가 더 커지며 상대가 오브젝트 주도권을 굳히게 됐다.",
      "improvementHint": "아군 핵심 스킬과 시야 확보 여부를 확인한 뒤 후속 진입 우선순위를 잡는 편이 더 안정적이다.",
      "relatedEventIds": ["evt_018"]
    },
    {
      "id": "weak_03",
      "title": "주도권을 오브젝트 이득으로 연결하는 마무리가 약했음",
      "description": "초반에 만든 압박을 시야나 드래곤 준비로 충분히 연결하지 못했다.",
      "evidence": "초반 유리 구간 이후에도 강가 장악과 오브젝트 준비가 느렸다.",
      "impact": "앞선 흐름을 유지하지 못하고 중반 주도권을 상대에게 넘겨줬다.",
      "improvementHint": "라인 이득을 만들었을 때 다음 행동을 로밍, 시야, 오브젝트 중 하나로 빠르게 고정할 필요가 있다.",
      "relatedEventIds": ["evt_009", "evt_014"]
    }
  ],
  "actionChecklist": [
    {
      "id": "act_01",
      "priority": 1,
      "action": "오브젝트 40초 전 강가 시야 확보를 먼저 시작하기",
      "reason": "중반 이후 시야 공백에서 시작한 교전이 반복적으로 손해로 이어졌다."
    },
    {
      "id": "act_02",
      "priority": 2,
      "action": "사이드 압박 전 적 정글 위치가 안 보이면 진입 각을 늦추기",
      "reason": "정보 없이 먼저 들어간 장면에서 데스 리스크가 크게 올라갔다."
    },
    {
      "id": "act_03",
      "priority": 3,
      "action": "라인 주도권을 만든 뒤 다음 행동을 시야 또는 로밍으로 바로 연결하기",
      "reason": "초반 주도권을 중반 오브젝트 이득으로 이어가지 못했다."
    }
  ],
  "keyMoments": [
    {
      "eventId": "evt_006",
      "timestamp": "05:40",
      "phase": "EARLY",
      "label": "첫 로밍 관여 성공",
      "reason": "라인 주도권을 활용해 먼저 합류하면서 수적 우위를 만들었다.",
      "relatedEventIds": ["evt_006"],
      "impact": "초반 템포를 잡는 계기가 됐다.",
      "importance": 4
    },
    {
      "eventId": "evt_014",
      "timestamp": "14:20",
      "phase": "MID",
      "label": "드래곤 전 시야 손실",
      "reason": "강가 시야가 없는 상태에서 늦게 진입해 상대에게 선포지션을 줬다.",
      "relatedEventIds": ["evt_014"],
      "impact": "중반 주도권이 넘어가는 결정적 장면이었다.",
      "importance": 5
    },
    {
      "eventId": "evt_018",
      "timestamp": "18:05",
      "phase": "MID",
      "label": "무리한 선진입으로 교전 손해",
      "reason": "아군과의 거리 차이가 있는 상태에서 먼저 각을 보며 위험한 진입이 됐다.",
      "relatedEventIds": ["evt_018"],
      "impact": "불리한 흐름을 더 크게 만들었다.",
      "importance": 4
    },
    {
      "eventId": "evt_022",
      "timestamp": "22:30",
      "phase": "MID",
      "label": "바론 시야 열세 누적",
      "reason": "바론 주변 시야 장악이 늦어 상대의 압박에 대응만 하게 됐다.",
      "relatedEventIds": ["evt_022"],
      "impact": "후반 주도권 회복 기회를 잃었다.",
      "importance": 5
    }
  ],
  "evidenceIndex": [
    {
      "eventId": "evt_003",
      "timestamp": "03:10",
      "eventType": "LANE_PRIORITY",
      "summary": "초반 웨이브를 안정적으로 밀며 먼저 움직일 수 있는 시간을 확보했다.",
      "statNote": "초반 라인 주도권 구간"
    },
    {
      "eventId": "evt_006",
      "timestamp": "05:40",
      "eventType": "ROAM_SUCCESS",
      "summary": "미드 라인 푸시 후 바텀 스커미시에 먼저 합류해 킬 관여를 만들었다.",
      "statNote": "초반 킬 관여율 상승 구간"
    },
    {
      "eventId": "evt_009",
      "timestamp": "09:15",
      "eventType": "SKIRMISH_WIN",
      "summary": "강가 교전에서 먼저 합류해 유리한 교환을 만들었다.",
      "statNote": "초반 우세 유지 구간"
    },
    {
      "eventId": "evt_014",
      "timestamp": "14:20",
      "eventType": "OBJECTIVE_SETUP_FAIL",
      "summary": "드래곤 전 강가 시야 없이 진입하며 교전 시작 위치를 내줬다.",
      "statNote": "중반 시야 열세 구간"
    },
    {
      "eventId": "evt_018",
      "timestamp": "18:05",
      "eventType": "BAD_ENGAGE",
      "summary": "아군 거리와 시야가 맞지 않은 상태에서 먼저 각을 보며 데스가 발생했다.",
      "statNote": "중반 손해 확대 구간"
    },
    {
      "eventId": "evt_022",
      "timestamp": "22:30",
      "eventType": "BARON_VISION_LOSS",
      "summary": "바론 지역 시야를 계속 내주며 상대 압박에 밀렸다.",
      "statNote": "후반 오브젝트 압박 구간"
    },
    {
      "eventId": "evt_024",
      "timestamp": "24:40",
      "eventType": "TEAMFIGHT_FOLLOWUP",
      "summary": "불리한 상황에서도 후속 합류로 딜 기여를 했다.",
      "statNote": "후반 저항 구간"
    },
    {
      "eventId": "evt_027",
      "timestamp": "29:10",
      "eventType": "LAST_TEAMFIGHT",
      "summary": "마지막 주요 교전에서 끝까지 합류했지만 시야와 포지션 열세를 뒤집지 못했다.",
      "statNote": "종결 교전"
    }
  ]
}
```

## 10. 다음 단계

이 문서 다음으로 필요한 작업은 아래다.

1. 이 스키마에 맞는 `샘플 경기 데이터` 범위를 결정한다
2. 입력 데이터 스키마와 분석 출력 스키마를 1:1로 매핑한다
3. Mock 응답 생성기를 만든다
4. UI 컴포넌트 props와 연결한다
