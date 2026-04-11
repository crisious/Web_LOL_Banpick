# Riot API 호출 설계서

작성일: 2026-04-10

관련 문서:
- [Riot API 샘플 경기 데이터 수집 계획서](/Users/a1234/Documents/Web_LOL_Banpick/plan-riot-api-sample-data.md)
- [샘플 경기 선정 기준 문서](/Users/a1234/Documents/Web_LOL_Banpick/sample-match-selection-criteria.md)
- [분석 JSON 스키마](/Users/a1234/Documents/Web_LOL_Banpick/analysis-json-schema.md)

## 1. 문서 목적

이 문서는 MVP에서 샘플 경기 데이터를 가져오기 위한 `Riot API 호출 구조`를 정의한다.

목표는 아래와 같다.

- 어떤 API를 어떤 순서로 호출할지 고정한다
- 프론트엔드, 백엔드, 수집 스크립트가 같은 계약을 공유하게 한다
- 오류 처리와 보안 규칙을 미리 정한다
- 샘플 경기 1건 수집부터 이후 사용자 입력 확장까지 같은 구조를 재사용한다

## 2. 범위

이 문서의 범위는 아래다.

- Riot ID 기반 샘플 경기 조회
- Match-V5 기반 경기 상세 수집
- Timeline 기반 이벤트 수집
- 내부 정규화 직전까지의 호출 설계

이 문서의 범위 밖은 아래다.

- `.rofl` 직접 처리
- RSO 인증 플로우 상세 구현
- Production 운영 인프라
- 분석 프롬프트 상세 설계

## 3. 최종 호출 흐름

MVP 샘플 수집의 표준 흐름은 아래와 같다.

```text
Riot ID 입력
-> account-v1: PUUID 조회
-> match-v5: 최근 matchId 목록 조회
-> match-v5: 후보 경기 상세 조회
-> match-v5: 최종 경기 timeline 조회
-> 원본 저장
-> 내부 정규화
-> 분석 생성
```

## 4. 시스템 구성 가정

### 프론트엔드

- 사용자 입력: `Riot ID`, `region`
- 결과: 분석 요청 시작

### 백엔드 또는 수집 스크립트

- Riot API 호출 수행
- 원본 JSON 저장
- 샘플 선정 로직 수행
- 정규화 데이터 생성

### 분석 모듈

- 정규화된 입력을 받아 분석 JSON 생성

## 5. 인증 방식

Riot API 호출 시 헤더에 API 키를 넣는다.

### 헤더

```http
X-Riot-Token: {RIOT_API_KEY}
```

### 보안 원칙

- API 키는 절대 프론트엔드에 노출하지 않는다
- 모든 Riot API 호출은 서버 측에서만 수행한다
- `.env` 또는 서버 시크릿 저장소로 관리한다

## 6. 호스트 라우팅 규칙

Riot 공식 문서상 LoL API는 `platform routing`과 `regional routing`을 구분한다.

MVP에서 사용할 기본 규칙은 아래다.

### regional host 사용

- `account-v1`
- `match-v5`

### platform host 사용

- `summoner-v4`

### KR 기준 권장 호스트

- `account-v1`: `https://asia.api.riotgames.com`
- `match-v5`: `https://asia.api.riotgames.com`
- `summoner-v4`: `https://kr.api.riotgames.com`

MVP 샘플 수집 기준으로 `summoner-v4`는 선택 사항이다.

## 7. 입력 계약

샘플 수집 시작 입력은 아래 형식을 따른다.

```json
{
  "gameName": "ExamplePlayer",
  "tagLine": "KR1",
  "platformRegion": "KR",
  "matchCount": 5
}
```

### 필드 정의

- `gameName`: Riot ID 이름
- `tagLine`: Riot ID 태그
- `platformRegion`: `KR`, `NA1`, `EUW1` 같은 플랫폼 힌트
- `matchCount`: 최근 조회할 경기 수

### 기본값

- `matchCount`: `5`

## 8. API 1: Riot ID -> PUUID 조회

### 목적

- Riot ID를 내부 조회 기준인 `PUUID`로 변환한다

### 엔드포인트

```http
GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
Host: asia.api.riotgames.com
```

### 예시 요청

```bash
curl -s \
  -H "X-Riot-Token: $RIOT_API_KEY" \
  "https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/ExamplePlayer/KR1"
```

### 기대 응답 예시

```json
{
  "puuid": "sample-puuid-value",
  "gameName": "ExamplePlayer",
  "tagLine": "KR1"
}
```

### 내부 반환 형식

```json
{
  "puuid": "sample-puuid-value",
  "riotId": "ExamplePlayer#KR1"
}
```

### 실패 처리

- `404`: Riot ID 없음 또는 잘못된 region 경로 추정
- `401/403`: 키 문제
- `429`: 재시도 대기

## 9. API 2: PUUID -> 최근 matchId 목록 조회

### 목적

- 최근 경기 후보를 확보한다

### 엔드포인트

```http
GET /lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=5
Host: asia.api.riotgames.com
```

### 예시 요청

```bash
curl -s \
  -H "X-Riot-Token: $RIOT_API_KEY" \
  "https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/sample-puuid-value/ids?start=0&count=5"
```

### 기대 응답 예시

```json
[
  "KR_1234567890",
  "KR_1234567889",
  "KR_1234567888"
]
```

### 내부 반환 형식

```json
{
  "puuid": "sample-puuid-value",
  "matchIds": [
    "KR_1234567890",
    "KR_1234567889",
    "KR_1234567888"
  ]
}
```

### 호출 전략

- 기본 `count=5`
- 후보가 부족하면 `count=10`까지 확대 가능

## 10. API 3: matchId -> 경기 상세 조회

### 목적

- 샘플 후보 필터링
- 헤더, 요약, 지표 카드에 필요한 메타 수집

### 엔드포인트

```http
GET /lol/match/v5/matches/{matchId}
Host: asia.api.riotgames.com
```

### 예시 요청

```bash
curl -s \
  -H "X-Riot-Token: $RIOT_API_KEY" \
  "https://asia.api.riotgames.com/lol/match/v5/matches/KR_1234567890"
```

### 원본 응답에서 주로 사용할 필드

`metadata`
- `matchId`
- `participants`

`info`
- `gameCreation`
- `gameDuration`
- `queueId`
- `mapId`
- `gameVersion`
- `participants[]`

`participants[]`에서 주로 사용할 필드 예:

- `puuid`
- `championName`
- `teamPosition`
- `kills`
- `deaths`
- `assists`
- `goldEarned`
- `totalMinionsKilled`
- `neutralMinionsKilled`
- `visionScore`
- `totalDamageDealtToChampions`
- `win`
- `summoner1Id`
- `summoner2Id`
- `item0~item6`

### 내부 반환 형식 예시

```json
{
  "matchId": "KR_1234567890",
  "gameVersion": "15.7.1",
  "queueId": 420,
  "durationSeconds": 1924,
  "player": {
    "puuid": "sample-puuid-value",
    "champion": "Ahri",
    "role": "MIDDLE",
    "kills": 6,
    "deaths": 5,
    "assists": 7,
    "visionScore": 18,
    "goldEarned": 12750,
    "win": false
  }
}
```

### 상세 조회 시 필터 규칙

후보 경기 중 아래 항목을 우선 확인한다.

- `queueId`
- 경기 길이
- 플레이어 역할
- 승패
- 챔피언

## 11. API 4: matchId -> 타임라인 조회

### 목적

- 핵심 이벤트와 구간별 흐름을 확보한다
- 장단점과 근거 이벤트를 생성할 재료를 만든다

### 엔드포인트

```http
GET /lol/match/v5/matches/{matchId}/timeline
Host: asia.api.riotgames.com
```

### 예시 요청

```bash
curl -s \
  -H "X-Riot-Token: $RIOT_API_KEY" \
  "https://asia.api.riotgames.com/lol/match/v5/matches/KR_1234567890/timeline"
```

### 원본 응답에서 주로 사용할 구조

- `info.frames[]`
- `info.frames[].events[]`
- `info.frameInterval`

### 주로 관심 가질 이벤트 타입 예

- `CHAMPION_KILL`
- `ELITE_MONSTER_KILL`
- `BUILDING_KILL`
- `SKILL_LEVEL_UP`
- `ITEM_PURCHASED`
- `ITEM_SOLD`
- `WARD_PLACED`
- `WARD_KILL`

### 내부 반환 형식 예시

```json
{
  "matchId": "KR_1234567890",
  "frameInterval": 60000,
  "events": [
    {
      "eventId": "evt_006",
      "timestampMs": 340000,
      "eventType": "CHAMPION_KILL",
      "phase": "EARLY",
      "summary": "미드 주도권 이후 바텀 쪽 첫 로밍 관여",
      "participants": [5, 8]
    }
  ]
}
```

### 타임라인 정규화 시 주의점

- 이벤트 원본은 그대로 보관한다
- MVP에서는 모든 이벤트를 다 쓰지 않고, 분석에 필요한 이벤트만 추린다
- 일부 패치나 이슈 상황에서는 이벤트 중복이나 누락 방어 로직이 필요하다

## 12. 선택 API: PUUID -> Summoner 정보

### 목적

- 필요 시 소환사 레벨, 암호화된 summonerId 등 보조 정보 확보

### 엔드포인트

```http
GET /lol/summoner/v4/summoners/by-puuid/{puuid}
Host: kr.api.riotgames.com
```

### 사용 시점

- MVP 샘플 수집에는 필수 아님
- 이후 플레이어 프로필 정보가 필요할 때만 사용

## 13. 내부 서비스 인터페이스 제안

Riot API 호출을 바로 페이지에서 다루기보다, 내부 서비스 레이어를 둔다.

### 제안 함수 구조

```ts
getAccountByRiotId(gameName, tagLine)
getRecentMatchIdsByPuuid(puuid, count)
getMatchDetail(matchId)
getMatchTimeline(matchId)
selectSampleMatch(candidateMatches, selectionCriteria)
normalizeMatchData(matchDetail, matchTimeline, targetPuuid)
```

### 장점

- UI와 Riot API 세부 구현을 분리할 수 있다
- 이후 RSO나 캐싱을 붙일 때 구조를 유지할 수 있다

## 14. 샘플 수집 전용 엔드포인트 제안

내부 API는 아래처럼 단순화할 수 있다.

### 엔드포인트

```http
POST /api/sample-match/fetch
```

### 요청 형식

```json
{
  "gameName": "ExamplePlayer",
  "tagLine": "KR1",
  "platformRegion": "KR",
  "matchCount": 5
}
```

### 응답 형식 예시

```json
{
  "riotId": "ExamplePlayer#KR1",
  "puuid": "sample-puuid-value",
  "candidateMatchIds": [
    "KR_1234567890",
    "KR_1234567889",
    "KR_1234567888"
  ],
  "selectedMatchId": "KR_1234567890",
  "savedFiles": [
    "raw-account.json",
    "raw-match-ids.json",
    "raw-match.json",
    "raw-timeline.json",
    "normalized-match.json"
  ]
}
```

## 15. 샘플 선정 로직 연결

후보 경기 선정은 [sample-match-selection-criteria.md](/Users/a1234/Documents/Web_LOL_Banpick/sample-match-selection-criteria.md)를 따른다.

### 기본 로직

1. 최근 경기 5개 조회
2. 각 경기 상세를 읽고 필수 조건 미달 경기 제거
3. 남은 경기 중 점수화
4. 최상위 1건 선택
5. 선택된 경기만 timeline 정밀 정규화

### 후보 필터 예시

- `queueId`가 Summoner's Rift 랭크/일반이 아닌 경우 제외
- 경기 길이가 25분 미만인 경우 제외
- 역할이 불명확한 경우 제외

## 16. 데이터 저장 설계

샘플 경기 수집 시 아래 파일 세트를 남긴다.

### 원본 저장

- `raw-account.json`
- `raw-match-ids.json`
- `raw-match.json`
- `raw-timeline.json`

### 정규화 저장

- `normalized-match.json`

### 분석 저장

- `analysis-result.json`

### 저장 원칙

- 원본과 정규화 결과를 분리한다
- 디버깅 가능성을 위해 원본은 그대로 둔다
- 공개용 데모에는 익명화된 정규화 버전을 사용한다

## 17. 요청 제한과 호출 전략

Riot Developer Portal 문서 기준 Personal key 제한은 아래다.

- `20 requests every 1 second`
- `100 requests every 2 minutes`

Development key는 프로토타입용이며 24시간마다 비활성화된다.

### MVP 호출 전략

- 샘플 수집은 순차 호출로 충분하다
- 후보 경기 5개 수준에서는 rate limit 문제가 거의 없다
- 대량 백필은 하지 않는다

## 18. 에러 처리 규칙

### `400`

원인 예:

- 잘못된 파라미터

대응:

- 입력 형식 검증

### `401`

원인 예:

- API 키 누락
- 만료된 키

대응:

- 키 상태 확인

### `403`

원인 예:

- 키 권한 문제

대응:

- key 종류와 프로젝트 상태 확인

### `404`

원인 예:

- Riot ID 없음
- matchId 없음
- 잘못된 region 경로

대응:

- 입력값 재확인
- regional/platform host 점검

### `429`

원인 예:

- rate limit 초과

대응:

- 백오프 후 재시도
- 샘플 수집은 병렬보다 순차 처리 유지

### `5xx`

원인 예:

- Riot API 일시 장애

대응:

- 재시도
- 원본 저장 도중 실패 시 전체 중단보다 단계별 실패 기록 권장

## 19. 정규화 매핑 규칙

원본 Riot 응답은 내부 샘플 스키마로 변환한다.

### match 상세 -> `matchInfo`

- `metadata.matchId` -> `matchInfo.matchId`
- `info.gameDuration` -> `matchInfo.duration`
- `info.gameVersion` -> `matchInfo.gameVersion`
- 참가자의 `championName` -> `matchInfo.champion`
- 참가자의 `teamPosition` -> `matchInfo.position`
- 참가자의 `win` -> `matchInfo.result`

### participants -> `playerStats`

- `kills`
- `deaths`
- `assists`
- `goldEarned`
- `visionScore`
- `totalDamageDealtToChampions`
- `totalMinionsKilled`
- `neutralMinionsKilled`

### timeline -> `timelineEvents`

- `timestamp` -> `timestamp`
- `type` -> `eventType`
- 플레이어 관련 ID -> `actor/target`
- 이벤트 설명 생성 -> `summary`
- 구간 계산 -> `phase`

## 20. 비기능 요구사항

### 보안

- API 키 서버 보관
- 공개 저장소에 키 금지

### 재현성

- 같은 Riot ID 입력 시 같은 순서의 recent match를 안정적으로 다시 조회 가능해야 함

### 디버깅 가능성

- 각 단계 원본 JSON 저장
- 실패 단계 명확히 기록

## 21. 구현 우선순위

### Phase 1

- `account-v1` 호출
- `match ids` 호출

### Phase 2

- `match detail` 호출
- 후보 경기 필터링

### Phase 3

- `timeline` 호출
- 정규화

### Phase 4

- 분석 결과 생성
- UI 연결

## 22. 예시 전체 실행 시나리오

```text
입력: ExamplePlayer#KR1

1. account-v1 호출
2. puuid 확보
3. 최근 matchId 5개 조회
4. 각 match 상세 조회
5. 점수표로 후보 평가
6. 최종 matchId 1건 선택
7. 선택 match의 timeline 조회
8. raw JSON 저장
9. normalized-match.json 생성
10. analysis-result.json 생성
```

## 23. 현재 권장 결정

현재 MVP에서 Riot API 호출 설계는 아래처럼 확정한다.

- 사용자 입력은 `Riot ID`
- 조회 기준은 `PUUID`
- 샘플 수집은 `Match-V5 + Timeline`
- API 호출은 서버 측에서만 수행
- 원본 JSON과 정규화 JSON을 분리 저장
- 샘플 선정은 최근 경기 5건 기준 점수화 방식 사용

## 24. 참고 자료

- Riot Developer Portal: [https://developer.riotgames.com/docs/portal](https://developer.riotgames.com/docs/portal)
- Riot LoL 문서: [https://developer.riotgames.com/docs/lol](https://developer.riotgames.com/docs/lol)
- Riot API Reference: [https://developer.riotgames.com/apis/](https://developer.riotgames.com/apis/)
- Riot Summoner Names to Riot IDs 안내: [https://developer.riotgames.com/docs/lol](https://developer.riotgames.com/docs/lol)

