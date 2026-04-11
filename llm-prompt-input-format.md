# LLM 프롬프트 입력 포맷 문서

작성일: 2026-04-10

관련 문서:
- [정규화 경기 데이터 스키마 문서](/Users/a1234/Documents/Web_LOL_Banpick/normalized-match-schema.md)
- [분석 JSON 스키마](/Users/a1234/Documents/Web_LOL_Banpick/analysis-json-schema.md)
- [정규화 매핑 규칙 상세서](/Users/a1234/Documents/Web_LOL_Banpick/normalization-mapping-rules.md)

## 1. 문서 목적

이 문서는 LLM에게 경기 분석을 요청할 때 사용할 `입력 프롬프트 구조`를 정의한다.

목표는 아래와 같다.

- 정규화 데이터를 LLM이 해석하기 쉬운 입력으로 전달한다
- 출력이 분석 JSON 스키마를 안정적으로 따르도록 한다
- 근거 없는 일반론을 줄인다
- 장점/단점/체크리스트가 경기 데이터에 밀착되도록 유도한다

## 2. 기본 원칙

- LLM에는 raw Riot 응답을 직접 주지 않는다
- `normalized-match.json` 기반으로 입력한다
- task instruction과 output contract를 분리한다
- 반드시 JSON 출력만 요구한다
- evidence와 relatedEventIds 연결을 강하게 유도한다

## 3. 프롬프트 패키지 구조

권장 프롬프트 구성은 아래 3단계다.

1. 시스템 지시문
2. 작업 지시문
3. 입력 데이터 + 출력 계약

## 4. 시스템 지시문 역할

시스템 지시문은 모델의 역할과 금지사항을 정의한다.

핵심 요구:

- LoL 경기 코치처럼 분석
- 근거 이벤트 기반으로만 판단
- 불확실하면 과장하지 않기
- 비난형 표현 금지
- 결과는 JSON만 출력

권장 시스템 지시문 예시:

```text
당신은 League of Legends 경기 복기 코치다.
입력으로 제공된 구조화 경기 데이터를 바탕으로 경기 요약, 장점, 단점, 개선 행동을 분석한다.
모든 인사이트는 입력 데이터의 이벤트와 지표에 근거해야 한다.
근거가 약한 경우 단정하지 말고 보수적으로 표현한다.
플레이어를 비난하지 말고 코칭형 문장을 사용한다.
출력은 반드시 지정된 JSON 스키마만 따른다.
JSON 외 텍스트는 출력하지 않는다.
```

## 5. 작업 지시문 역할

작업 지시문은 이번 요청에서 무엇을 만들어야 하는지 명시한다.

핵심 요구:

- 경기 요약
- 장점 3개
- 단점 3개
- 체크리스트 3~5개
- key moments 4개 이상
- phase summaries

권장 작업 지시문 예시:

```text
주어진 경기 데이터를 분석해 아래를 생성하라.
1. 경기 한줄 요약
2. 전체 경기 흐름 요약
3. 구간별 요약(EARLY, MID, LATE)
4. 장점 3개
5. 단점 3개
6. 다음 게임 체크리스트 3~5개
7. 핵심 장면 4개 이상
8. 근거 이벤트 인덱스

모든 장점과 단점은 가능한 한 relatedEventIds를 포함하라.
장점과 단점은 서로 중복되지 않게 작성하라.
체크리스트는 바로 행동할 수 있는 문장으로 작성하라.
```

## 6. 입력 데이터 섹션 구조

LLM에 넣는 입력 데이터는 아래 구조를 권장한다.

```json
{
  "taskMeta": {},
  "matchContext": {},
  "phaseContext": {},
  "timelineEvents": [],
  "derivedSignals": {},
  "outputContract": {}
}
```

## 7. `taskMeta` 정의

설명:

- 이번 분석 요청의 메타 정보

권장 필드:

- `language`
- `analysisMode`
- `targetAudience`
- `strengthCount`
- `weaknessCount`
- `checklistCountMin`
- `checklistCountMax`

예시:

```json
{
  "language": "ko",
  "analysisMode": "coaching",
  "targetAudience": "solo_queue_player",
  "strengthCount": 3,
  "weaknessCount": 3,
  "checklistCountMin": 3,
  "checklistCountMax": 5
}
```

## 8. `matchContext` 정의

설명:

- 분석에 필요한 핵심 경기 요약 정보

권장 구성:

- `playerContext`
- `matchInfo`
- `playerStats`
- `teamContext`

예시:

```json
{
  "playerContext": {
    "riotId": "PlayerAlias#KR1",
    "participantId": 5
  },
  "matchInfo": {
    "matchId": "KR_1234567890",
    "queueLabel": "RANKED_SOLO",
    "gameVersion": "15.7.1",
    "durationLabel": "32:04",
    "result": "LOSS",
    "champion": "Ahri",
    "position": "MID"
  },
  "playerStats": {
    "kills": 6,
    "deaths": 5,
    "assists": 7,
    "kda": 2.6,
    "cs": 214,
    "csPerMinute": 6.7,
    "goldEarned": 12750,
    "visionScore": 18,
    "killParticipation": 0.54
  },
  "teamContext": {
    "teamTotalKills": 24,
    "teamDragons": 1,
    "enemyDragons": 3,
    "teamBarons": 0,
    "enemyBarons": 1
  }
}
```

## 9. `phaseContext` 정의

설명:

- 구간별 집계 정보

권장:

- EARLY
- MID
- LATE

예시:

```json
{
  "early": {
    "kills": 2,
    "deaths": 0,
    "assists": 3,
    "notableEventCount": 4
  },
  "mid": {
    "kills": 3,
    "deaths": 4,
    "assists": 2,
    "notableEventCount": 6
  },
  "late": {
    "kills": 1,
    "deaths": 1,
    "assists": 2,
    "notableEventCount": 3
  }
}
```

## 10. `timelineEvents` 정의

설명:

- 분석의 핵심 근거가 되는 이벤트 리스트

권장 규칙:

- importance 3 이상만 전달
- 8~15개 수준으로 제한
- 너무 많은 이벤트를 넣지 않는다

권장 필드:

- `eventId`
- `timestampLabel`
- `phase`
- `eventType`
- `importance`
- `summary`
- `isPlayerInvolved`

예시:

```json
[
  {
    "eventId": "evt_006",
    "timestampLabel": "05:40",
    "phase": "EARLY",
    "eventType": "ROAM_SUCCESS",
    "importance": 4,
    "summary": "미드 주도권 이후 바텀 쪽 첫 로밍 관여로 킬에 기여했다.",
    "isPlayerInvolved": true
  },
  {
    "eventId": "evt_014",
    "timestampLabel": "14:20",
    "phase": "MID",
    "eventType": "OBJECTIVE_SETUP_FAIL",
    "importance": 5,
    "summary": "드래곤 전 강가 시야가 비어 있는 상태에서 늦게 진입했다.",
    "isPlayerInvolved": true
  }
]
```

## 11. `derivedSignals` 정의

설명:

- 모델이 빠르게 테마를 잡도록 돕는 보조 신호

예시:

```json
{
  "hasEarlyLeadMoments": true,
  "hasMidGameThrowRisk": true,
  "hasObjectiveControlIssues": true,
  "hasStrongRoamingPattern": true,
  "hasPositioningRisk": true,
  "candidateThemes": [
    "strong_early_roam_but_weak_objective_setup",
    "mid_game_vision_loss",
    "late_game_reactive_fighting"
  ]
}
```

주의:

- derivedSignals는 힌트일 뿐, evidence보다 우선하면 안 된다

## 12. `outputContract` 정의

설명:

- 모델이 따라야 하는 출력 포맷 요구사항

권장 필드:

- `schemaVersion`
- `requiredTopLevelFields`
- `requiredArrayCounts`
- `rules`

예시:

```json
{
  "schemaVersion": "1.0",
  "requiredTopLevelFields": [
    "analysisMeta",
    "matchSummary",
    "coachSummary",
    "phaseSummaries",
    "strengths",
    "weaknesses",
    "actionChecklist",
    "keyMoments",
    "evidenceIndex"
  ],
  "requiredArrayCounts": {
    "strengths": 3,
    "weaknesses": 3,
    "actionChecklistMin": 3,
    "actionChecklistMax": 5,
    "keyMomentsMin": 4
  },
  "rules": [
    "JSON only",
    "No markdown",
    "Use Korean",
    "Prefer evidence-backed claims",
    "Do not invent unsupported facts"
  ]
}
```

## 13. 최종 입력 패키지 예시

```json
{
  "taskMeta": {
    "language": "ko",
    "analysisMode": "coaching",
    "targetAudience": "solo_queue_player",
    "strengthCount": 3,
    "weaknessCount": 3,
    "checklistCountMin": 3,
    "checklistCountMax": 5
  },
  "matchContext": {
    "playerContext": {
      "riotId": "PlayerAlias#KR1",
      "participantId": 5
    },
    "matchInfo": {
      "matchId": "KR_1234567890",
      "queueLabel": "RANKED_SOLO",
      "gameVersion": "15.7.1",
      "durationLabel": "32:04",
      "result": "LOSS",
      "champion": "Ahri",
      "position": "MID"
    },
    "playerStats": {
      "kills": 6,
      "deaths": 5,
      "assists": 7,
      "kda": 2.6,
      "cs": 214,
      "csPerMinute": 6.7,
      "goldEarned": 12750,
      "visionScore": 18,
      "killParticipation": 0.54
    },
    "teamContext": {
      "teamTotalKills": 24,
      "teamDragons": 1,
      "enemyDragons": 3,
      "teamBarons": 0,
      "enemyBarons": 1
    }
  },
  "phaseContext": {
    "early": {
      "kills": 2,
      "deaths": 0,
      "assists": 3,
      "notableEventCount": 4
    },
    "mid": {
      "kills": 3,
      "deaths": 4,
      "assists": 2,
      "notableEventCount": 6
    },
    "late": {
      "kills": 1,
      "deaths": 1,
      "assists": 2,
      "notableEventCount": 3
    }
  },
  "timelineEvents": [
    {
      "eventId": "evt_006",
      "timestampLabel": "05:40",
      "phase": "EARLY",
      "eventType": "ROAM_SUCCESS",
      "importance": 4,
      "summary": "미드 주도권 이후 바텀 쪽 첫 로밍 관여로 킬에 기여했다.",
      "isPlayerInvolved": true
    },
    {
      "eventId": "evt_014",
      "timestampLabel": "14:20",
      "phase": "MID",
      "eventType": "OBJECTIVE_SETUP_FAIL",
      "importance": 5,
      "summary": "드래곤 전 강가 시야가 비어 있는 상태에서 늦게 진입했다.",
      "isPlayerInvolved": true
    },
    {
      "eventId": "evt_018",
      "timestampLabel": "18:05",
      "phase": "MID",
      "eventType": "BAD_ENGAGE",
      "importance": 4,
      "summary": "아군과 거리 차이가 있는 상태에서 먼저 들어가며 교전 손해가 커졌다.",
      "isPlayerInvolved": true
    }
  ],
  "derivedSignals": {
    "hasEarlyLeadMoments": true,
    "hasMidGameThrowRisk": true,
    "hasObjectiveControlIssues": true,
    "hasStrongRoamingPattern": true,
    "hasPositioningRisk": true,
    "candidateThemes": [
      "strong_early_roam_but_weak_objective_setup",
      "mid_game_vision_loss",
      "late_game_reactive_fighting"
    ]
  },
  "outputContract": {
    "schemaVersion": "1.0",
    "requiredTopLevelFields": [
      "analysisMeta",
      "matchSummary",
      "coachSummary",
      "phaseSummaries",
      "strengths",
      "weaknesses",
      "actionChecklist",
      "keyMoments",
      "evidenceIndex"
    ],
    "requiredArrayCounts": {
      "strengths": 3,
      "weaknesses": 3,
      "actionChecklistMin": 3,
      "actionChecklistMax": 5,
      "keyMomentsMin": 4
    },
    "rules": [
      "JSON only",
      "No markdown",
      "Use Korean",
      "Prefer evidence-backed claims",
      "Do not invent unsupported facts"
    ]
  }
}
```

## 14. 입력 길이 최적화 원칙

- raw event 전체를 넣지 않는다
- importance 높은 이벤트만 전달한다
- 중복 의미 이벤트는 합친다
- 수치와 이벤트가 균형 있게 들어가야 한다

권장 크기:

- timelineEvents: `8~15개`
- candidateThemes: `2~5개`

## 15. 출력 품질 가드레일

프롬프트에는 아래 규칙을 포함하는 것이 좋다.

- 장점/단점은 서로 중복 금지
- 같은 사건을 장점과 단점 양쪽에 반복하지 않기
- evidence가 없는 인사이트는 만들지 않기
- event summary를 그대로 복붙하지 말고 해석할 것
- 모호한 경우 보수적으로 표현할 것

## 16. 추천 실제 프롬프트 조합

권장 형태:

1. 시스템 메시지
2. 개발자 메시지 또는 작업 지시문
3. JSON 입력 payload

실무 팁:

- 출력 스키마는 텍스트 설명보다 JSON 구조 예시를 함께 주는 편이 안정적이다
- 분석 모드가 바뀌면 `taskMeta.analysisMode`만 바꾸고 나머지 구조는 유지한다

## 17. 현재 권장 결정

현재 LLM 입력 포맷은 아래 원칙으로 확정한다.

- 입력은 `normalized-match.json`에서 추린 구조화 payload
- 시스템 지시문 + 작업 지시문 + JSON payload 3층 구조
- outputContract로 출력 스키마를 강하게 제한
- evidence와 relatedEventIds 연결을 핵심 품질 기준으로 삼는다

## 18. 다음 단계

이 문서 다음으로 가장 자연스러운 작업은 아래다.

1. 실제 샘플 경기 1건에 대해 입력 payload 초안 작성
2. LLM 출력 예시 1세트 작성
3. 프롬프트 튜닝 기준 문서 작성

