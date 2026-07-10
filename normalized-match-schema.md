# 정규화 경기 데이터 스키마 문서

작성일: 2026-04-10

관련 문서:
- [Riot API 호출 설계서](riot-api-call-spec.md)
- [분석 JSON 스키마](analysis-json-schema.md)
- [MVP PRD](prd-mvp-replay-analysis.md)

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
  "derivedSignals": {},
  "teamplayAnalysisV2": {}
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

## 5.10 `teamplayAnalysisV2` (추가 필드)

설명:
- 원본 Match/Timeline에서 결정적으로 만든 전체 10인 오브젝트·교전 사실 모델
- 정규화 단계에서는 AI 문장이나 추천 선택을 포함하지 않는다
- 기존 `timelineEvents`와 `derivedSignals`를 대체하지 않는 additive 필드다

최상위 필드:

- `schemaVersion`: 항상 `"2.0"`
- `coverage`: 원본 가용 범위와 한계
- `encounters`: 킬 로그 기반 교전 묶음
- `objectiveEngagements`: 준비·쟁탈·획득·후속 전환 구간
- `scenes`: 연결된 교전과 오브젝트를 중복 없이 묶은 화면 단위
- `personalReviews`: 대상 플레이어가 직접 또는 위치 근거로 관여한 상위 5개 장면
- `teamAppendix`: 개인 리뷰와 1:1로 연결된 팀 사실 부록

`coverage.level`은 `FULL`, `PARTIAL`, `EVENT_ONLY`, `PLAYER_ONLY`, `UNAVAILABLE` 중 하나다. 정규화된 원본 분석은 앞의 세 값을 사용하며, 저장 샘플 호환 계층만 `PLAYER_ONLY` 또는 `UNAVAILABLE`을 만들 수 있다. `coverage.source`는 `RAW_TIMELINE`, `LEGACY_ADAPTER`, `NONE` 중 하나다.

`RAW_TIMELINE`은 유효한 frame timestamp와 체력·골드·경험치·레벨을 가진 participant frame, 또는 type별 필수 값과 timestamp가 있는 지원 이벤트(`CHAMPION_KILL`, `ELITE_MONSTER_KILL`, `BUILDING_KILL`)가 적어도 하나 있을 때만 부여한다. 빈 `frames`, `{ events: [] }`, `{ participantFrames: {} }`, ID/type만 있는 stub, timestamp가 없는 frame처럼 분석 가능한 항목이 없으면 `UNAVAILABLE`/`NONE`으로 처리하며, 저장 샘플에 기존 전투·한타 분석이 있으면 `PLAYER_ONLY`/`LEGACY_ADAPTER`로 내려간다.

`coverage.limitationCodes`는 다음 closed enum만 허용한다.

- `PARTIAL_POSITION_FRAMES`
- `NO_POSITION_FRAMES`
- `MISSING_SPATIAL_LINK`
- `INCOMPLETE_ALLY_FRAME_COVERAGE`
- `UNKNOWN_TEAM`
- `INCOMPLETE_TEAM_SNAPSHOT`
- `STALE_TEAM_SNAPSHOT`
- `INVALID_V2_ITEM`
- `INVALID_AI_SELECTION`

공통 근거 참조:

```json
{
  "kind": "TIMELINE_EVENT",
  "id": "KR_123:18:4",
  "timestamp": 1122000,
  "participantId": null
}
```

- `kind`: `TIMELINE_EVENT` 또는 `PARTICIPANT_FRAME`
- `PARTICIPANT_FRAME`이면 `participantId`가 정수다
- 공개 모델은 `puuid`와 Riot ID를 포함하지 않는다

도메인 요약:

| 배열 | 핵심 필드 |
| --- | --- |
| `encounters` | `id`, `type`, `classificationBasis`, `phaseEvents`, `participants`, `allyDeaths`, `enemyDeaths`, `firstTakedownTeam`, `playerInvolvement`, `linkedObjectiveEngagementIds`, `sourceRefs`, 시각·신뢰도·한계 |
| `objectiveEngagements` | `id`, `objectiveType`, `captureStartTimestamp`, `captureEndTimestamp`, `captureCounts`, `captureTeam`, `setupWindow`, `contestWindow`, `conversionWindow`, `linkedEncounterIds`, `structureConversions`, `playerInvolvement`, 근거·신뢰도·한계 |
| `scenes` | `sceneId`, `primaryType`, `objectiveEngagementId`, `encounterIds`, `involvements`, `effectiveInvolvementLevel`, `importanceScore`, 사망 수·첫 처치 팀·전환 수 |
| `personalReviews` | `reviewId`, `sceneId`, 연결 ID, `effectiveInvolvementLevel`, 4개 fact 배열, `evidenceIds`, `importanceScore`, `teamAppendixId`; 정규화 단계의 `narrative`는 `null` |
| `teamAppendix` | `teamAppendixId`, `reviewId`, 양 팀 직접 기록 참가자, 사망 수, 첫 처치 팀, 획득 팀, 교전 전 골드 차이, 구조물 전환, `factIds` |

교전 `type`은 `PICK`, `SKIRMISH`, `TEAMFIGHT_CANDIDATE` 중 하나고, 교전 단계는 `OPENING`, `EXCHANGE`, `LATE_SEQUENCE` 순서만 사용한다. 관여 `level`은 `CONFIRMED`, `APPROXIMATE`, `NOT_INVOLVED` 중 하나다. `captureTeam`과 팀 관계는 `ALLY`, `ENEMY`, `SPLIT`, `UNKNOWN`을 사용하며, 신뢰도는 `HIGH`, `MEDIUM`, `LOW`다.

개인 리뷰 fact atom의 공통 형태:

```json
{
  "factId": "fact_8efaa5b4c6e6971f71c4",
  "type": "PLAYER_DISTANCE_LE_2500",
  "timestamp": 600000,
  "value": {
    "distance": 100,
    "frameTimestamp": 590000,
    "frameAgeSeconds": 10,
    "stage": "ENCOUNTER"
  },
  "confidence": "MEDIUM",
  "sourceRefs": [
    {
      "kind": "PARTICIPANT_FRAME",
      "id": "KR_TEAMPLAY_FIXTURE:0:1",
      "timestamp": 590000,
      "participantId": 1
    }
  ],
  "limitationCodes": []
}
```

허용 fact `type`:

- `ENCOUNTER_CLASSIFICATION`, `ALLY_DEATH_COUNT`, `ENEMY_DEATH_COUNT`, `FIRST_TAKEDOWN_TEAM`
- `PLAYER_CONFIRMED_KILL`, `PLAYER_CONFIRMED_ASSIST`, `PLAYER_CONFIRMED_DEATH`, `PLAYER_FIRST_RECORDED_INVOLVEMENT`
- `PLAYER_DISTANCE_LE_2500`, `PLAYER_DISTANCE_2500_5000`, `PLAYER_DISTANCE_GT_5000`, `NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT`
- `OBJECTIVE_CAPTURE_TEAM`, `OBJECTIVE_CAPTURE_COUNTS`, `PLAYER_OBJECTIVE_KILLER`, `PLAYER_OBJECTIVE_ASSIST`
- `STRUCTURE_CONVERSION`, `PRE_ENCOUNTER_GOLD_DIFFERENCE`, `PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE`

ID와 배열 순서는 같은 원본 입력에서 항상 동일하다. 사실, 시각, 위치, 획득 팀은 서버 코드가 원본에서 계산하며 AI가 생성하거나 수정하지 않는다.

위치 fact의 `frameAgeSeconds`는 표시를 위해 반올림하지만 신뢰도는 반올림 전 millisecond 차이로 판정한다. 5,000ms 이하는 `HIGH`, 5,000ms 초과 15,000ms 이하는 `MEDIUM`, 그보다 크고 30,000ms 이하인 근거는 `LOW`다.

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
- `teamplayAnalysisV2` -> 분석 결과의 동일 필드에 서버 fact template과 검증된 추천 template을 결합

## 12. 저장 파일 규칙

정규화 결과는 아래 파일로 저장한다.

- `normalized-match.json`

권장 저장 원칙:

- 원본 JSON과 분리 저장
- 공개용 샘플은 익명화 값 사용
- 샘플 교체 시 이전 버전은 보관 가능
- 기존 저장 샘플의 v2 보강은 로드 시 메모리에서만 수행하며 원본 JSON이나 manifest를 수정하지 않는다
- raw match/timeline이 있으면 저장된 v2 도메인 값보다 원본 재빌드를 우선한다
- raw 파일이 없어서 저장 v2를 사용할 때는 fact의 closed value shape와 stable `factId`를 재검증하고, 서술과 코칭을 서버 템플릿 및 허용 추천 코드로 다시 만든다
- 저장된 팀 부록의 사망 수·첫 처치·획득 팀·구조물 전환·fact ID는 encounter/objective/scene과 교차검증된 개인 리뷰 fact에서 재생성한다. raw가 없어 팀 소속을 재검증할 수 없으면 직접 참가자 목록은 비우고 `INVALID_V2_ITEM`을 기록한다. 교전 전 골드 fact는 10인 프레임·골드 합계·시각·신뢰도와 모든 frame이 교전 이전인지 다시 검증한다
- 빈·손상 timeline은 raw 보강으로 간주하지 않으며 valid legacy 분석을 가리지 않는다

## 13. 현재 권장 실행안

이 문서를 기준으로 다음 단계는 아래 순서가 적절하다.

1. 실제 Riot 원본 응답을 이 스키마로 매핑하는 정규화 규칙 구현
2. 샘플 경기 1건을 `normalized-match.json`으로 생성
3. 이 정규화 데이터를 `analysis-json-schema.md` 출력으로 연결
4. UI mock 데이터 소스로 사용
