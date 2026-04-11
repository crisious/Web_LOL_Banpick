# 정규화 경기 데이터 스키마 문서

작성일: 2026-04-10

관련 문서:
- [Riot API 호출 설계서](/Users/a1234/Documents/Web_LOL_Banpick/riot-api-call-spec.md)
- [분석 JSON 스키마](/Users/a1234/Documents/Web_LOL_Banpick/analysis-json-schema.md)
- [MVP PRD](/Users/a1234/Documents/Web_LOL_Banpick/prd-mvp-replay-analysis.md)

## 1. 문서 목적

이 문서는 Riot API 원본 응답을 분석 모듈이 바로 사용할 수 있는 `정규화 경기 데이터` 형식으로 정의한다.

목표는 아래와 같다.

- Riot 원본 구조와 분석 입력 구조를 분리한다
- Match 상세와 Timeline을 하나의 일관된 객체로 합친다
- 샘플 경기와 실제 경기 모두 같은 스키마를 사용하게 한다
- UI/분석/저장 로직이 공통 계약을 공유하게 한다

## 2. 정규화 스키마의 역할

정규화 스키마는 아래 사이에 위치한다.

```text
Riot API Raw JSON
-> normalized-match.json
-> analysis-result.json
```

즉, 이 스키마는 `수집`과 `분석` 사이의 표준 포맷이다.

## 3. 설계 원칙

- Riot API 특정 필드명에 직접 의존하지 않게 한다
- 분석에 필요한 정보만 우선 담는다
- 누락 필드는 안전한 기본값으로 채운다
- 플레이어 1명 중심 분석에 맞춘다
- 근거 이벤트 추적이 가능해야 한다

## 4. 최상위 구조

```json
{
  "schemaVersion": "1.0",
  "sourceMeta": {},
  "playerContext": {},
  "matchInfo": {},
  "playerStats": {},
  "teamContext": {},
  "phaseContext": {},
  "timelineEvents": [],
  "derivedSignals": {}
}
```

## 5. 최상위 필드 정의

## 5.1 `schemaVersion`

설명:
- 정규화 스키마 버전

타입:
- `string`

예시:

```json
"1.0"
```

## 5.2 `sourceMeta`

설명:
- 데이터 출처와 수집 메타 정보

타입:
- `object`

필드:

- `sourceType`: `string`
- `fetchedAt`: `string`
- `platformRegion`: `string`
- `regionalCluster`: `string`
- `rawMatchId`: `string`

예시:

```json
{
  "sourceType": "riot_match_v5",
  "fetchedAt": "2026-04-10T14:20:00+09:00",
  "platformRegion": "KR",
  "regionalCluster": "ASIA",
  "rawMatchId": "KR_1234567890"
}
```

## 5.3 `playerContext`

설명:
- 분석 대상 플레이어 식별 및 표시 정보

타입:
- `object`

필드:

- `puuid`: `string`
- `riotId`: `string`
- `isAnonymous`: `boolean`
- `participantId`: `number`

예시:

```json
{
  "puuid": "sample-puuid-value",
  "riotId": "PlayerAlias#KR1",
  "isAnonymous": true,
  "participantId": 5
}
```

## 5.4 `matchInfo`

설명:
- 경기 메타 정보

타입:
- `object`

필드:

- `matchId`: `string`
- `queueId`: `number`
- `queueLabel`: `string`
- `mapId`: `number`
- `mapLabel`: `string`
- `gameVersion`: `string`
- `gameCreation`: `string`
- `durationSeconds`: `number`
- `durationLabel`: `string`
- `result`: `string`
- `champion`: `string`
- `position`: `string`
- `teamId`: `number`

예시:

```json
{
  "matchId": "KR_1234567890",
  "queueId": 420,
  "queueLabel": "RANKED_SOLO",
  "mapId": 11,
  "mapLabel": "SUMMONERS_RIFT",
  "gameVersion": "15.7.1",
  "gameCreation": "2026-04-09T22:14:00+09:00",
  "durationSeconds": 1924,
  "durationLabel": "32:04",
  "result": "LOSS",
  "champion": "Ahri",
  "position": "MID",
  "teamId": 100
}
```

## 5.5 `playerStats`

설명:
- 플레이어 핵심 지표

타입:
- `object`

필드:

- `kills`: `number`
- `deaths`: `number`
- `assists`: `number`
- `kda`: `number`
- `cs`: `number`
- `csPerMinute`: `number`
- `goldEarned`: `number`
- `damageToChampions`: `number`
- `visionScore`: `number`
- `killParticipation`: `number`
- `champLevel`: `number`
- `summonerSpells`: `array<number>`
- `items`: `array<number>`

예시:

```json
{
  "kills": 6,
  "deaths": 5,
  "assists": 7,
  "kda": 2.6,
  "cs": 214,
  "csPerMinute": 6.7,
  "goldEarned": 12750,
  "damageToChampions": 21480,
  "visionScore": 18,
  "killParticipation": 0.54,
  "champLevel": 16,
  "summonerSpells": [4, 14],
  "items": [6655, 3020, 3102, 4645, 3135, 3165, 3363]
}
```

계산 규칙:

- `kda`: `(kills + assists) / max(1, deaths)`
- `cs`: `totalMinionsKilled + neutralMinionsKilled`
- `csPerMinute`: `cs / (durationSeconds / 60)`
- `killParticipation`: `(kills + assists) / teamTotalKills`

## 5.6 `teamContext`

설명:
- 팀 기준 비교 정보

타입:
- `object`

필드:

- `teamTotalKills`: `number`
- `teamGoldEstimate`: `number`
- `teamDragons`: `number`
- `teamBarons`: `number`
- `teamTowers`: `number`
- `enemyDragons`: `number`
- `enemyBarons`: `number`
- `enemyTowers`: `number`

예시:

```json
{
  "teamTotalKills": 24,
  "teamGoldEstimate": 62800,
  "teamDragons": 1,
  "teamBarons": 0,
  "teamTowers": 4,
  "enemyDragons": 3,
  "enemyBarons": 1,
  "enemyTowers": 8
}
```

메모:

- MVP에서는 필요한 최소 비교 정보만 둔다
- `teamGoldEstimate`는 Riot raw에서 직접 없으면 생략 가능

## 5.7 `phaseContext`

설명:
- 경기 구간별 요약 재료

타입:
- `object`

필드:

- `early`: `object`
- `mid`: `object`
- `late`: `object`

각 구간 공통 필드:

- `startMs`: `number`
- `endMs`: `number`
- `kills`: `number`
- `deaths`: `number`
- `assists`: `number`
- `notableEventCount`: `number`

예시:

```json
{
  "early": {
    "startMs": 0,
    "endMs": 900000,
    "kills": 2,
    "deaths": 0,
    "assists": 3,
    "notableEventCount": 4
  },
  "mid": {
    "startMs": 900001,
    "endMs": 1800000,
    "kills": 3,
    "deaths": 4,
    "assists": 2,
    "notableEventCount": 6
  },
  "late": {
    "startMs": 1800001,
    "endMs": 1924000,
    "kills": 1,
    "deaths": 1,
    "assists": 2,
    "notableEventCount": 3
  }
}
```

### 권장 구간 기준

- `EARLY`: 0분 ~ 15분
- `MID`: 15분 ~ 30분
- `LATE`: 30분 이후

## 5.8 `timelineEvents`

설명:
- 분석에 사용할 핵심 이벤트 목록

타입:
- `array<object>`

배열 원소 필드:

- `eventId`: `string`
- `timestampMs`: `number`
- `timestampLabel`: `string`
- `phase`: `string`
- `eventType`: `string`
- `importance`: `number`
- `isPlayerInvolved`: `boolean`
- `laneHint`: `string`
- `summary`: `string`
- `rawRef`: `object`

`rawRef` 필드:

- `frameIndex`: `number`
- `eventIndex`: `number`

예시:

```json
[
  {
    "eventId": "evt_006",
    "timestampMs": 340000,
    "timestampLabel": "05:40",
    "phase": "EARLY",
    "eventType": "ROAM_SUCCESS",
    "importance": 4,
    "isPlayerInvolved": true,
    "laneHint": "BOT_SIDE_RIVER",
    "summary": "미드 주도권 이후 바텀 쪽 첫 로밍 관여로 킬에 기여했다.",
    "rawRef": {
      "frameIndex": 5,
      "eventIndex": 2
    }
  }
]
```

### 권장 `eventType`

- `LANE_PRIORITY`
- `ROAM_SUCCESS`
- `ROAM_FAIL`
- `CHAMPION_KILL`
- `PLAYER_DEATH`
- `SKIRMISH_WIN`
- `SKIRMISH_LOSS`
- `OBJECTIVE_SETUP_WIN`
- `OBJECTIVE_SETUP_FAIL`
- `DRAGON_FIGHT`
- `BARON_FIGHT`
- `TOWER_TAKE`
- `BAD_ENGAGE`
- `TEAMFIGHT_FOLLOWUP`
- `VISION_GAIN`
- `VISION_LOSS`

## 5.9 `derivedSignals`

설명:
- 분석 전에 계산해 두면 유용한 요약 신호

타입:
- `object`

필드:

- `hasEarlyLeadMoments`: `boolean`
- `hasMidGameThrowRisk`: `boolean`
- `hasObjectiveControlIssues`: `boolean`
- `hasStrongRoamingPattern`: `boolean`
- `hasPositioningRisk`: `boolean`
- `candidateThemes`: `array<string>`

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

메모:

- LLM 프롬프트 입력 간소화에 유리하다
- 이후 규칙 기반 분석과 혼합하기 좋다

## 6. 최소 유효 조건

정규화 데이터는 아래 조건을 만족해야 `분석 가능` 상태로 본다.

- `sourceMeta.rawMatchId` 존재
- `playerContext.puuid` 존재
- `matchInfo.matchId` 존재
- `matchInfo.champion` 존재
- `matchInfo.position` 존재
- `matchInfo.result` 존재
- `playerStats.kills/deaths/assists` 존재
- `timelineEvents` 최소 4개 이상

권장 조건:

- `timelineEvents` 8개 이상
- `derivedSignals.candidateThemes` 2개 이상

## 7. 값 규칙

- `result`: `WIN` 또는 `LOSS`
- `position`: `TOP`, `JUNGLE`, `MID`, `ADC`, `SUPPORT`
- `phase`: `EARLY`, `MID`, `LATE`
- `importance`: 1~5
- `timestampLabel`: `MM:SS`

## 8. 기본값 규칙

Riot API는 non-empty 값만 반환할 수 있으므로, 정규화 시 아래 기본값을 사용한다.

- 누락 숫자: `0`
- 누락 문자열: `""`
- 누락 배열: `[]`
- 누락 객체: `{}` 또는 분석 불가 시 생성 실패 처리

단, 아래는 필수값이라 누락 시 실패 처리 권장:

- `matchId`
- `puuid`
- `champion`
- `result`

## 9. Riot Raw -> 정규화 매핑

## 9.1 account-v1

- `puuid` -> `playerContext.puuid`
- `gameName + tagLine` -> `playerContext.riotId`

## 9.2 match-v5 상세

- `metadata.matchId` -> `matchInfo.matchId`
- `info.queueId` -> `matchInfo.queueId`
- `info.mapId` -> `matchInfo.mapId`
- `info.gameVersion` -> `matchInfo.gameVersion`
- `info.gameCreation` -> `matchInfo.gameCreation`
- `info.gameDuration` -> `matchInfo.durationSeconds`

플레이어 참가자 기준:

- `championName` -> `matchInfo.champion`
- `teamPosition` -> `matchInfo.position`
- `teamId` -> `matchInfo.teamId`
- `win` -> `matchInfo.result`
- `kills/deaths/assists` -> `playerStats`
- `totalMinionsKilled + neutralMinionsKilled` -> `playerStats.cs`
- `goldEarned` -> `playerStats.goldEarned`
- `visionScore` -> `playerStats.visionScore`
- `totalDamageDealtToChampions` -> `playerStats.damageToChampions`
- `champLevel` -> `playerStats.champLevel`
- `summoner1Id/summoner2Id` -> `playerStats.summonerSpells`
- `item0~item6` -> `playerStats.items`

## 9.3 timeline

- `timestamp` -> `timelineEvents[].timestampMs`
- `type` -> `timelineEvents[].eventType`
- 프레임 위치 -> `timelineEvents[].rawRef`
- 구간 계산 -> `timelineEvents[].phase`
- 가공 설명 -> `timelineEvents[].summary`

## 10. 예시 전체 객체

```json
{
  "schemaVersion": "1.0",
  "sourceMeta": {
    "sourceType": "riot_match_v5",
    "fetchedAt": "2026-04-10T14:20:00+09:00",
    "platformRegion": "KR",
    "regionalCluster": "ASIA",
    "rawMatchId": "KR_1234567890"
  },
  "playerContext": {
    "puuid": "sample-puuid-value",
    "riotId": "PlayerAlias#KR1",
    "isAnonymous": true,
    "participantId": 5
  },
  "matchInfo": {
    "matchId": "KR_1234567890",
    "queueId": 420,
    "queueLabel": "RANKED_SOLO",
    "mapId": 11,
    "mapLabel": "SUMMONERS_RIFT",
    "gameVersion": "15.7.1",
    "gameCreation": "2026-04-09T22:14:00+09:00",
    "durationSeconds": 1924,
    "durationLabel": "32:04",
    "result": "LOSS",
    "champion": "Ahri",
    "position": "MID",
    "teamId": 100
  },
  "playerStats": {
    "kills": 6,
    "deaths": 5,
    "assists": 7,
    "kda": 2.6,
    "cs": 214,
    "csPerMinute": 6.7,
    "goldEarned": 12750,
    "damageToChampions": 21480,
    "visionScore": 18,
    "killParticipation": 0.54,
    "champLevel": 16,
    "summonerSpells": [4, 14],
    "items": [6655, 3020, 3102, 4645, 3135, 3165, 3363]
  },
  "teamContext": {
    "teamTotalKills": 24,
    "teamGoldEstimate": 62800,
    "teamDragons": 1,
    "teamBarons": 0,
    "teamTowers": 4,
    "enemyDragons": 3,
    "enemyBarons": 1,
    "enemyTowers": 8
  },
  "phaseContext": {
    "early": {
      "startMs": 0,
      "endMs": 900000,
      "kills": 2,
      "deaths": 0,
      "assists": 3,
      "notableEventCount": 4
    },
    "mid": {
      "startMs": 900001,
      "endMs": 1800000,
      "kills": 3,
      "deaths": 4,
      "assists": 2,
      "notableEventCount": 6
    },
    "late": {
      "startMs": 1800001,
      "endMs": 1924000,
      "kills": 1,
      "deaths": 1,
      "assists": 2,
      "notableEventCount": 3
    }
  },
  "timelineEvents": [
    {
      "eventId": "evt_006",
      "timestampMs": 340000,
      "timestampLabel": "05:40",
      "phase": "EARLY",
      "eventType": "ROAM_SUCCESS",
      "importance": 4,
      "isPlayerInvolved": true,
      "laneHint": "BOT_SIDE_RIVER",
      "summary": "미드 주도권 이후 바텀 쪽 첫 로밍 관여로 킬에 기여했다.",
      "rawRef": {
        "frameIndex": 5,
        "eventIndex": 2
      }
    },
    {
      "eventId": "evt_014",
      "timestampMs": 860000,
      "timestampLabel": "14:20",
      "phase": "MID",
      "eventType": "OBJECTIVE_SETUP_FAIL",
      "importance": 5,
      "isPlayerInvolved": true,
      "laneHint": "DRAGON_RIVER",
      "summary": "드래곤 전 강가 시야가 비어 있는 상태에서 늦게 진입했다.",
      "rawRef": {
        "frameIndex": 14,
        "eventIndex": 1
      }
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
  }
}
```

## 11. 분석 스키마와의 연결

정규화 스키마는 아래 출력 생성에 사용된다.

- `matchInfo` -> 분석 결과 `matchSummary`
- `playerStats` -> 지표 기반 요약
- `phaseContext` -> `phaseSummaries`
- `timelineEvents` -> `keyMoments`, `evidenceIndex`
- `derivedSignals` -> 장점/단점 초안 및 프롬프트 힌트

## 12. 저장 파일 규칙

정규화 결과는 아래 파일로 저장한다.

- `normalized-match.json`

권장 저장 원칙:

- 원본 JSON과 분리 저장
- 공개용 샘플은 익명화 값 사용
- 샘플 교체 시 이전 버전은 보관 가능

## 13. 현재 권장 실행안

이 문서를 기준으로 다음 단계는 아래 순서가 적절하다.

1. 실제 Riot 원본 응답을 이 스키마로 매핑하는 정규화 규칙 구현
2. 샘플 경기 1건을 `normalized-match.json`으로 생성
3. 이 정규화 데이터를 `analysis-json-schema.md` 출력으로 연결
4. UI mock 데이터 소스로 사용

