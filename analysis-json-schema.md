# 분석 JSON 스키마 문서: LoL 리플레이 분석 웹페이지 MVP

작성일: 2026-04-10

관련 문서:
- [의사결정 문서](/Users/a1234/Documents/Web_LOL_Banpick/decision-replay-processing.md)
- [MVP PRD](/Users/a1234/Documents/Web_LOL_Banpick/prd-mvp-replay-analysis.md)
- [와이어프레임 문서](/Users/a1234/Documents/Web_LOL_Banpick/wireframes-mvp-replay-analysis.md)
- [개발 작업 티켓](/Users/a1234/Documents/Web_LOL_Banpick/tickets-mvp-replay-analysis.md)

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
  "evidenceIndex": []
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

필드:

- `analysisId`: `string`
- `generatedAt`: `string`
- `sourceType`: `string`
- `language`: `string`
- `confidence`: `number`

예시:

```json
{
  "analysisId": "analysis_20260410_match_001",
  "generatedAt": "2026-04-10T13:30:00+09:00",
  "sourceType": "match_timeline",
  "language": "ko",
  "confidence": 0.82
}
```

필드 메모:

- `sourceType`은 `match_timeline`, `mock`, `manual`, `other` 중 하나를 권장
- `confidence`는 0~1 범위를 사용

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

배열 원소 필드:

- `eventId`: `string`
- `timestamp`: `string`
- `phase`: `string`
- `label`: `string`
- `reason`: `string`
- `impact`: `string`
- `importance`: `number`

예시:

```json
[
  {
    "eventId": "evt_006",
    "timestamp": "05:40",
    "phase": "EARLY",
    "label": "첫 로밍 관여 성공",
    "reason": "라인 주도권을 활용해 먼저 합류하면서 수적 우위를 만들었다.",
    "impact": "초반 템포를 잡는 계기가 됐다.",
    "importance": 4
  },
  {
    "eventId": "evt_014",
    "timestamp": "14:20",
    "phase": "MID",
    "label": "드래곤 전 시야 손실",
    "reason": "강가 시야가 없는 상태에서 늦게 진입해 상대에게 선포지션을 줬다.",
    "impact": "중반 주도권이 넘어가는 결정적 장면이었다.",
    "importance": 5
  }
]
```

규칙:

- 4~8개 권장
- 중요도는 1~5 범위 사용

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

## 5. 최소 유효 응답 조건

아래 조건을 만족해야 `유효한 분석 결과`로 간주한다.

- `schemaVersion` 존재
- `matchSummary.headline` 존재
- `coachSummary.overallSummary` 존재
- `strengths` 최소 1개
- `weaknesses` 최소 1개
- `actionChecklist` 최소 1개
- `keyMoments` 최소 2개

MVP 권장 기준은 아래와 같다.

- `strengths` 3개
- `weaknesses` 3개
- `actionChecklist` 3~5개
- `keyMoments` 4개 이상

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
      "impact": "초반 템포를 잡는 계기가 됐다.",
      "importance": 4
    },
    {
      "eventId": "evt_014",
      "timestamp": "14:20",
      "phase": "MID",
      "label": "드래곤 전 시야 손실",
      "reason": "강가 시야가 없는 상태에서 늦게 진입해 상대에게 선포지션을 줬다.",
      "impact": "중반 주도권이 넘어가는 결정적 장면이었다.",
      "importance": 5
    },
    {
      "eventId": "evt_018",
      "timestamp": "18:05",
      "phase": "MID",
      "label": "무리한 선진입으로 교전 손해",
      "reason": "아군과의 거리 차이가 있는 상태에서 먼저 각을 보며 위험한 진입이 됐다.",
      "impact": "불리한 흐름을 더 크게 만들었다.",
      "importance": 4
    },
    {
      "eventId": "evt_022",
      "timestamp": "22:30",
      "phase": "MID",
      "label": "바론 시야 열세 누적",
      "reason": "바론 주변 시야 장악이 늦어 상대의 압박에 대응만 하게 됐다.",
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

