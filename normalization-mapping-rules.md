# 정규화 매핑 규칙 상세서

작성일: 2026-04-10

관련 문서:
- [정규화 경기 데이터 스키마 문서](/Users/a1234/Documents/Web_LOL_Banpick/normalized-match-schema.md)
- [Riot API 호출 설계서](/Users/a1234/Documents/Web_LOL_Banpick/riot-api-call-spec.md)
- [분석 JSON 스키마](/Users/a1234/Documents/Web_LOL_Banpick/analysis-json-schema.md)

## 1. 문서 목적

이 문서는 Riot API 원본 응답을 `normalized-match.json`으로 변환하는 구체 규칙을 정의한다.

목표는 아래와 같다.

- 구현자가 그대로 따라갈 수 있는 매핑 기준 제공
- raw 데이터의 누락/예외/중복 처리 기준 고정
- timeline 이벤트를 분석 친화적인 형태로 가공하는 규칙 명시

## 2. 입력 파일

정규화 로직의 입력은 아래 파일들을 기준으로 한다.

- `raw-account.json`
- `raw-match.json`
- `raw-timeline.json`

선택 입력:

- `raw-match-ids.json`
- `raw-summoner.json`

## 3. 출력 파일

정규화 로직의 출력은 아래 파일이다.

- `normalized-match.json`

## 4. 구현 원칙

- raw 응답은 수정하지 않는다
- 정규화는 `분석 대상 플레이어 1명` 중심으로 수행한다
- 값이 없으면 기본값을 채우되, 핵심 식별자는 누락 시 실패 처리한다
- Riot 필드명을 그대로 노출하지 않고 내부 도메인 용어로 변환한다

## 5. 사전 준비 단계

정규화 시작 전에 아래 값을 먼저 확정한다.

### 5.1 대상 플레이어 결정

입력 우선순위:

1. `targetPuuid`
2. `riotId`
3. 후보 참가자 탐색

권장 규칙:

- 기본적으로 `account-v1`에서 얻은 `puuid`를 기준으로 raw match의 `participants[]` 중 분석 대상 1명을 식별한다

### 5.2 참가자 객체 찾기

`raw-match.json`에서 아래 조건으로 참가자를 찾는다.

- `participant.puuid === targetPuuid`

찾지 못하면:

- 정규화 실패 처리

### 5.3 팀/상대 팀 결정

분석 대상 참가자의 `teamId` 기준으로 아래를 계산한다.

- `allyParticipants`
- `enemyParticipants`

## 6. 최상위 매핑 규칙

## 6.1 `schemaVersion`

고정값:

```json
"1.0"
```

## 6.2 `sourceMeta`

매핑 규칙:

- `sourceType`: `"riot_match_v5"`
- `fetchedAt`: 정규화 실행 시각 ISO 문자열
- `platformRegion`: 입력 region
- `regionalCluster`: 입력 또는 라우팅값
- `rawMatchId`: `raw-match.metadata.matchId`

## 6.3 `playerContext`

매핑 규칙:

- `puuid`: `raw-account.puuid` 또는 대상 participant의 `puuid`
- `riotId`: 익명화 정책 적용 결과 문자열
- `isAnonymous`: 공개용 샘플이면 `true`
- `participantId`: 대상 participant의 `participantId`

### 익명화 규칙

- 공개용 샘플: `PlayerAlias#KR1` 같은 가명 사용
- 내부 테스트: 실제 Riot ID 유지 가능

## 7. `matchInfo` 매핑 규칙

## 7.1 기본 필드

- `matchId`: `raw-match.metadata.matchId`
- `queueId`: `raw-match.info.queueId`
- `mapId`: `raw-match.info.mapId`
- `gameVersion`: `raw-match.info.gameVersion`
- `gameCreation`: `raw-match.info.gameCreation`을 ISO 문자열로 변환
- `durationSeconds`: `raw-match.info.gameDuration`
- `teamId`: 대상 participant의 `teamId`

## 7.2 파생 필드

### `durationLabel`

규칙:

- `durationSeconds`를 `MM:SS` 형식으로 변환

예:

- `1924` -> `32:04`

### `result`

규칙:

- 대상 participant의 `win === true`면 `WIN`
- 아니면 `LOSS`

### `champion`

규칙:

- 대상 participant의 `championName`

### `position`

우선순위:

1. `teamPosition`
2. `individualPosition`
3. fallback 규칙

fallback 규칙:

- 비어 있거나 `INVALID` 성격이면 빈 문자열 대신 가능한 역할 추정값 사용
- MVP에서는 역할이 불명확하면 샘플 탈락 권장

### `queueLabel`

기본 매핑:

- `420` -> `RANKED_SOLO`
- `430` -> `NORMAL_BLIND`
- `440` -> `RANKED_FLEX`
- `450` -> `ARAM`

그 외:

- `QUEUE_{queueId}`

### `mapLabel`

기본 매핑:

- `11` -> `SUMMONERS_RIFT`
- `12` -> `HOWLING_ABYSS`

그 외:

- `MAP_{mapId}`

## 8. `playerStats` 매핑 규칙

## 8.1 raw 직접 매핑

- `kills`: `participant.kills || 0`
- `deaths`: `participant.deaths || 0`
- `assists`: `participant.assists || 0`
- `goldEarned`: `participant.goldEarned || 0`
- `damageToChampions`: `participant.totalDamageDealtToChampions || 0`
- `visionScore`: `participant.visionScore || 0`
- `champLevel`: `participant.champLevel || 0`

## 8.2 파생 계산

### `kda`

```text
(kills + assists) / max(1, deaths)
```

소수 처리:

- 소수점 첫째 자리 또는 둘째 자리 반올림

### `cs`

```text
(totalMinionsKilled || 0) + (neutralMinionsKilled || 0)
```

### `csPerMinute`

```text
cs / (durationSeconds / 60)
```

소수 처리:

- 소수점 첫째 자리 반올림

### `killParticipation`

```text
(kills + assists) / max(1, allyTeamTotalKills)
```

소수 처리:

- 0~1 사이 실수로 저장

## 8.3 배열 필드

### `summonerSpells`

규칙:

- `[participant.summoner1Id, participant.summoner2Id]`
- null/undefined는 제외하지 말고 0으로 치환 가능

### `items`

규칙:

- `[item0, item1, item2, item3, item4, item5, item6]`
- 누락값은 `0`

## 9. `teamContext` 매핑 규칙

## 9.1 킬 수

- `teamTotalKills`: ally team의 `kills` 총합

## 9.2 오브젝트 요약

우선순위:

1. `raw-match.info.teams[]` 활용
2. 없거나 부족하면 timeline 이벤트로 재계산

매핑:

- `teamDragons`
- `teamBarons`
- `teamTowers`
- `enemyDragons`
- `enemyBarons`
- `enemyTowers`

### `teamGoldEstimate`

규칙:

- raw match detail에서 직접 안정적으로 제공되지 않으면 `0` 또는 생략 가능
- MVP에서는 필수 필드로 보지 않는다

## 10. `phaseContext` 매핑 규칙

## 10.1 구간 정의

- `EARLY`: `0 <= timestampMs <= 900000`
- `MID`: `900000 < timestampMs <= 1800000`
- `LATE`: `timestampMs > 1800000`

## 10.2 집계 대상

각 구간마다 아래를 집계한다.

- 플레이어 킬 수
- 플레이어 데스 수
- 플레이어 어시스트 수
- 중요 이벤트 수

## 10.3 집계 방식

킬/데스/어시스트는 `timeline events` 기반으로 집계한다.

규칙:

- `CHAMPION_KILL`에서 killer/victim/assistingParticipantIds 기준으로 대상 플레이어 관여 여부 판정
- 관여 시 해당 구간의 kills/deaths/assists 누적

`notableEventCount`는 아래 기준의 이벤트 개수다.

- `importance >= 3`

## 11. `timelineEvents` 추출 규칙

## 11.1 원칙

- 모든 raw 이벤트를 저장하지 않는다
- 분석 가치가 있는 이벤트만 추린다
- 하지만 원본 추적을 위해 `rawRef`를 남긴다

## 11.2 추출 대상 raw event type

기본 추출 대상:

- `CHAMPION_KILL`
- `ELITE_MONSTER_KILL`
- `BUILDING_KILL`
- `WARD_PLACED`
- `WARD_KILL`
- `SKILL_LEVEL_UP`

보조 추출 대상:

- `ITEM_PURCHASED`
- `ITEM_DESTROYED`
- `ITEM_SOLD`

MVP 권장:

- 보조 추출 대상은 기본적으로 저장하지 않아도 됨

## 11.3 공통 필드 매핑

- `eventId`: `evt_{순번}` 형식
- `timestampMs`: raw event `timestamp`
- `timestampLabel`: `MM:SS`
- `phase`: timestamp 기반 구간 계산
- `rawRef.frameIndex`: frames 인덱스
- `rawRef.eventIndex`: events 인덱스

## 11.4 `isPlayerInvolved` 판정 규칙

### `CHAMPION_KILL`

아래 중 하나면 `true`

- `killerId === participantId`
- `victimId === participantId`
- `assistingParticipantIds`에 participantId 포함

### `ELITE_MONSTER_KILL`

아래 중 하나면 `true`

- `killerId === participantId`
- 팀 단위 오브젝트에서 ally 참여가 명확하고 대상 플레이어가 근처 교전에 관여한 경우, 별도 파생 로직으로 `true` 처리 가능

MVP 기본:

- 직접 관여만 `true`

### `WARD_PLACED`, `WARD_KILL`

- `creatorId` 또는 `killerId`가 participantId면 `true`

## 11.5 `eventType` 가공 규칙

raw event를 그대로 두지 않고 아래처럼 변환한다.

### `CHAMPION_KILL`

조건별 가공:

- 플레이어가 킬 주체면 `CHAMPION_KILL`
- 플레이어가 피해자면 `PLAYER_DEATH`
- 플레이어가 어시스트만 했다면 `SKIRMISH_WIN` 또는 `TEAMFIGHT_FOLLOWUP`

세부 규칙:

- 근처 다수 관여가 있으면 `TEAMFIGHT_FOLLOWUP`
- 단일 소규모 전투면 `SKIRMISH_WIN`

### `ELITE_MONSTER_KILL`

monsterType 기준:

- `DRAGON` 관련 -> `DRAGON_FIGHT` 또는 `OBJECTIVE_SETUP_WIN`
- `BARON_NASHOR` -> `BARON_FIGHT`
- `RIFTHERALD` -> `OBJECTIVE_SETUP_WIN`

패배 맥락일 경우:

- 직전 시야 열세/교전 손실이 있으면 `OBJECTIVE_SETUP_FAIL`

### `BUILDING_KILL`

- 우리 팀이 타워 획득 -> `TOWER_TAKE`
- 적 팀이 타워 획득 -> 중요도에 따라 `SKIRMISH_LOSS` 또는 별도 요약용 이벤트

### `WARD_PLACED`

- 중요 지역이고 오브젝트 직전이면 `VISION_GAIN`
- 일반 상황이면 생략 가능

### `WARD_KILL`

- 오브젝트 직전 시야 제거면 `VISION_GAIN`
- 우리 시야가 제거된 상황 요약에 쓰이면 `VISION_LOSS`

## 11.6 `importance` 점수 규칙

기본 규칙:

- 1: 분석 가치 낮음
- 2: 보조 정보
- 3: 구간 설명에 유용
- 4: 장점/단점 근거 가능
- 5: 승패 흐름 전환점

### 권장 휴리스틱

`CHAMPION_KILL`

- 솔로킬/첫 킬/오브젝트 직전 킬: `4~5`
- 일반 단일 킬: `3`

`PLAYER_DEATH`

- 오브젝트 직전 데스: `4~5`
- 일반 데스: `3`

`ELITE_MONSTER_KILL`

- 드래곤/바론: `4~5`
- 전령: `3~4`

`BUILDING_KILL`

- 외곽 타워: `3`
- 억제기/넥서스 타워 근처: `4~5`

`VISION_GAIN`, `VISION_LOSS`

- 오브젝트 직전 강가/바론 시야 변화: `4`
- 일반 와드 교환: `2`

## 11.7 `laneHint` 생성 규칙

우선순위:

1. raw event position이 있으면 좌표 기반 간단 구역 매핑
2. 없으면 monster/building/context 기반 문자열 생성

권장 값 예:

- `MID_LANE`
- `TOP_RIVER`
- `BOT_SIDE_RIVER`
- `DRAGON_RIVER`
- `BARON_RIVER`
- `ALLY_JUNGLE`
- `ENEMY_JUNGLE`

MVP에서는 정밀 좌표 시스템보다 단순 구역 레이블을 우선한다.

## 11.8 `summary` 생성 규칙

규칙:

- 1문장
- 사람이 읽을 수 있는 한국어
- 시간/맥락/영향 중 최소 2개 반영

좋은 예:

- `미드 주도권 이후 바텀 쪽 첫 로밍 관여로 킬에 기여했다.`
- `드래곤 전 강가 시야가 비어 있는 상태에서 늦게 진입했다.`

나쁜 예:

- `킬 이벤트가 발생했다.`
- `중요한 장면이었다.`

## 12. 이벤트 중복/노이즈 제거 규칙

## 12.1 중복 제거

아래 조합이 같으면 중복 후보로 본다.

- `timestamp`
- `type`
- `killerId` 또는 `creatorId`
- `victimId` 또는 대상 몬스터

중복일 경우:

- 첫 이벤트만 유지

## 12.2 저가치 이벤트 제거

아래 조건이면 기본적으로 버린다.

- 플레이어 관여 없음
- importance 2 이하
- 분석 테마와 무관

단, 예외:

- 바론/드래곤/중요 타워는 플레이어 직접 관여가 없어도 팀 흐름상 보존 가능

## 13. `derivedSignals` 계산 규칙

## 13.1 boolean 신호

### `hasEarlyLeadMoments`

조건 예:

- EARLY 구간 중요 이벤트 중 `ROAM_SUCCESS`, `SKIRMISH_WIN`, `CHAMPION_KILL`이 2개 이상

### `hasMidGameThrowRisk`

조건 예:

- MID 구간 `PLAYER_DEATH`, `BAD_ENGAGE`, `OBJECTIVE_SETUP_FAIL` 중요 이벤트가 2개 이상

### `hasObjectiveControlIssues`

조건 예:

- `OBJECTIVE_SETUP_FAIL`, `DRAGON_FIGHT` 패배 맥락, `BARON_FIGHT` 열세 맥락이 존재

### `hasStrongRoamingPattern`

조건 예:

- EARLY 또는 MID 구간 `ROAM_SUCCESS`가 1개 이상

### `hasPositioningRisk`

조건 예:

- `BAD_ENGAGE`, `PLAYER_DEATH`, 후반 교전 손실 이벤트 조합이 존재

## 13.2 `candidateThemes`

규칙:

- boolean 신호와 주요 이벤트 조합을 바탕으로 2~5개 문자열 생성

예:

- `strong_early_roam_but_weak_objective_setup`
- `mid_game_vision_loss`
- `late_game_reactive_fighting`

## 14. 실패 처리 규칙

아래 조건이면 정규화 실패 처리 권장:

- 대상 participant를 찾지 못함
- `matchId` 누락
- `champion` 누락
- `result` 판정 불가
- usable timeline event가 4개 미만

실패 시 반환 권장 형식:

```json
{
  "ok": false,
  "stage": "normalize_match",
  "reason": "target participant not found"
}
```

## 15. 검증 체크리스트

정규화 완료 후 아래를 확인한다.

- `matchInfo`가 채워졌는가
- `playerStats.kda`, `csPerMinute`, `killParticipation` 계산값이 상식적인가
- `timelineEvents`가 4개 이상인가
- `phaseContext` 3구간이 모두 존재하는가
- `derivedSignals`가 최소 2개 이상의 theme를 생성했는가
- 공개용이면 Riot ID가 익명화되었는가

## 16. 권장 구현 순서

1. 대상 participant 식별
2. `matchInfo` 생성
3. `playerStats` 계산
4. `teamContext` 계산
5. raw timeline 순회
6. 중요 이벤트 추출 및 가공
7. `phaseContext` 집계
8. `derivedSignals` 계산
9. 유효성 검증
10. `normalized-match.json` 저장

## 17. 현재 권장 결정

현재 정규화 매핑은 아래 원칙으로 확정한다.

- 참가자 식별은 `PUUID` 기준
- 역할은 `teamPosition` 우선
- timeline은 전부 저장하지 않고 중요 이벤트만 정규화
- importance 3 이상 이벤트를 중심으로 분석에 사용
- derivedSignals는 LLM 분석 보조용으로 계산한다

