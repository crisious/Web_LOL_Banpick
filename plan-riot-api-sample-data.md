# Riot API 샘플 경기 데이터 수집 계획서

작성일: 2026-04-10

관련 문서:
- [의사결정 문서](/Users/a1234/Documents/Web_LOL_Banpick/decision-replay-processing.md)
- [MVP PRD](/Users/a1234/Documents/Web_LOL_Banpick/prd-mvp-replay-analysis.md)
- [분석 JSON 스키마](/Users/a1234/Documents/Web_LOL_Banpick/analysis-json-schema.md)

## 1. 문서 목적

이 문서는 MVP에서 사용할 `샘플 경기 데이터`를 `Riot API`를 통해 확보하는 방법을 정리한다.

목표는 아래와 같다.

- `.rofl` 없이도 분석 가능한 실제 경기 데이터를 확보한다
- 공식 API 기준으로 재현 가능한 수집 경로를 설계한다
- 샘플 1건을 안정적으로 확보하기 위한 실행 순서를 고정한다

## 2. 결론 요약

가장 권장하는 방법은 아래다.

- `Riot ID -> PUUID -> 최근 Match IDs -> Match 상세 -> Match Timeline`

즉, MVP 샘플 데이터는 `Riot Match-V5 + Timeline`으로 수집한다.

이 방식은 아래 이유로 가장 적합하다.

- 공식 API 경로다
- `.rofl` 직접 처리 없이도 경기 요약과 장단점 분석에 필요한 데이터가 충분하다
- 웹 MVP와 구조적으로 잘 맞는다
- 샘플 데이터 재수집과 교체가 쉽다

## 3. 조사 기반 핵심 사실

### 3.1 Riot ID 중심 전환

Riot는 2023년 11월 20일 이후 플레이어 식별 기준을 `Summoner Name`에서 `Riot ID`로 전환하고 있으며, 프론트엔드 입력도 `Riot ID(gameName + tagLine)` 기준으로 변경할 것을 권장한다.

실무적으로는 아래 의미를 가진다.

- 사용자 입력은 `Riot ID`를 우선으로 설계한다
- 내부 조회 키는 `PUUID`를 기준으로 관리한다

### 3.2 프로토타입은 Development Key로 가능

Riot Developer Portal 문서 기준:

- Development API key는 로그인 즉시 발급된다
- 다만 `24시간마다 비활성화`되므로 자주 재발급해야 한다

즉, 지금 단계의 샘플 데이터 확보와 프로토타입 제작은 `Development Key`로 시작 가능하다.

### 3.3 Personal/Production 확장 가능

Riot Developer Portal 문서 기준:

- Personal key는 개인 프로젝트/개인 연구에 적합하다
- Personal key 기본 제한은 `초당 20회`, `2분당 100회`
- Production key 기본 제한은 `10초당 500회`, `10분당 30,000회`

MVP 초기에는 트래픽이 많지 않으므로 `Development -> Personal -> Production` 단계 확장이 자연스럽다.

### 3.4 정책상 주의점

Riot LoL 정책 문서 기준:

- `custom match queue`의 플레이어 매치 히스토리는 플레이어 명시적 opt-in 없이는 공개 표시하면 안 된다
- 그렇지 않으면 본인에게만 `RSO` 기반으로 제공해야 한다

따라서 MVP 샘플 경기는 아래 중 하나여야 한다.

- 본인 경기
- 명시적 동의를 받은 테스트 계정 경기
- 공개 표시 정책에 문제가 없는 일반 매치 데이터

초기 샘플은 `랭크 솔로/일반 게임`을 권장한다.

## 4. 수집 후보 경로 비교

## 옵션 A. 특정 플레이어의 최근 경기 가져오기

### 흐름

- Riot ID 입력
- PUUID 조회
- 최근 matchId 조회
- match 상세 조회
- timeline 조회

### 장점

- 가장 재현 가능하다
- 샘플 선별이 쉽다
- 특정 역할/챔피언/승패 조건으로 고르기 쉽다
- 분석 품질 검증에 유리하다

### 단점

- 테스트용 Riot ID가 필요하다
- 개인정보/공개 여부를 조심해야 한다

### 판단

- `가장 추천`

## 옵션 B. Featured Games 기반 샘플 확보

### 흐름

- Spectator API로 현재 추천 경기 목록 확보
- 게임 종료 후 matchId 기준으로 상세/타임라인 조회

### 장점

- 특정 개인 계정 의존이 줄어든다
- 고티어/흥미로운 경기 후보를 찾기 쉽다

### 단점

- 실시간 경기 종료를 기다려야 한다
- 샘플 재현성이 낮다
- 원하는 역할/챔피언/패배 경기 같은 조건 통제가 어렵다

### 판단

- `보조 경로`

## 옵션 C. Tournament/Custom 게임 기반 직접 샘플 생성

### 장점

- 원하는 조건으로 경기를 설계할 수 있다

### 단점

- MVP 목적에 과하다
- 정책/권한/운영 복잡도가 높다
- custom queue 표시 정책도 더 민감하다

### 판단

- `현재 단계에서는 비추천`

## 5. 최종 선택

샘플 경기 데이터 수집은 아래 경로로 결정한다.

- `옵션 A. 특정 플레이어의 최근 경기 가져오기`

구체적으로는 아래 원칙을 따른다.

- 입력 기준: `Riot ID`
- 내부 조회 기준: `PUUID`
- 샘플 유형: `랭크 솔로` 또는 `일반 게임`
- 첫 샘플 목표: `분석 품질이 잘 드러나는 1경기`

## 6. 권장 샘플 경기 조건

첫 샘플은 아래 조건을 만족하는 경기를 고른다.

- `Summoner's Rift`
- `랭크 솔로` 또는 `일반 게임`
- 경기 길이 `28~32분`
- 특정 역할이 분명한 경기
- 초반 잘한 장면 최소 2개
- 중반 실수 또는 흐름 전환 장면 최소 2개
- 오브젝트 구도 변화 최소 1개
- 장점 3개, 단점 3개, 체크리스트 3개 이상이 자연스럽게 나오는 경기

현재 기준 추천 샘플 타입:

- `MID`
- `패배 경기`
- 초반 로밍 성공
- 중반 시야/오브젝트 준비 부족
- 후반 역전 실패

이 조건은 장점/단점이 함께 살아 있고, 코칭형 피드백을 만들기 좋다.

## 7. API 수집 흐름

## Step 1. Riot ID 입력

입력 형식:

- `gameName`
- `tagLine`
- `regionHint`

예시:

- gameName: `ExamplePlayer`
- tagLine: `KR1`
- regionHint: `KR`

### 주의점

- `Summoner Name`가 아니라 `Riot ID`를 받는다
- 사용자 입력 실수 방지를 위해 `name#tag` UI를 제공하는 것이 좋다

## Step 2. Riot ID로 PUUID 조회

계획 경로:

- `account-v1`
- `/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`

결과:

- `puuid`
- `gameName`
- `tagLine`

### 목적

- 이후 모든 경기 조회의 기준 키 확보

## Step 3. PUUID로 최근 matchId 목록 조회

계획 경로:

- `match-v5`
- `/lol/match/v5/matches/by-puuid/{puuid}/ids`

권장 파라미터:

- `start=0`
- `count=5~10`

### 목적

- 최근 경기 중 샘플 후보를 고른다

### 선택 전략

- 1차로 최근 5~10경기를 조회
- 각 matchId에 대해 상세를 본 뒤 조건에 맞는 1경기를 선택

## Step 4. matchId로 경기 상세 조회

계획 경로:

- `match-v5`
- `/lol/match/v5/matches/{matchId}`

활용 데이터 예:

- 게임 길이
- 승패
- 챔피언
- 포지션
- KDA
- CS
- 골드
- 딜량
- 시야 점수
- 오브젝트 참여

### 목적

- 샘플 후보 필터링
- 경기 개요 메타 수집

## Step 5. matchId로 타임라인 조회

계획 경로:

- `match-v5`
- `/lol/match/v5/matches/{matchId}/timeline`

활용 데이터 예:

- 프레임 단위 상태
- 주요 이벤트
- 킬/데스
- 오브젝트
- 스킬 레벨업
- 게임 흐름 전환 장면

### 목적

- 장단점 근거가 되는 이벤트 확보
- 타임라인 기반 분석용 재료 확보

## Step 6. 내부 정규화

수집한 Riot 원본 응답을 아래 3단계로 저장한다.

1. 원본 응답 저장
2. 정규화된 내부 입력 스키마로 변환
3. 분석 결과 JSON 생성

권장 저장 파일:

- `raw-account.json`
- `raw-match-ids.json`
- `raw-match.json`
- `raw-timeline.json`
- `normalized-match.json`
- `analysis-result.json`

## 8. 지역 라우팅 계획

Riot 공식 문서 기준 LoL API는 `platform`과 `regional` 라우팅을 구분한다.

실행 계획은 아래와 같다.

- `account-v1`: `regional host`
- `match-v5`: `regional host`
- `summoner-v4`: `platform host`

KR 기준 권장:

- `account-v1`: `asia.api.riotgames.com`
- `match-v5`: `asia.api.riotgames.com`
- `summoner-v4`: `kr.api.riotgames.com`

이 문서에서는 MVP 샘플 수집에 `summoner-v4`는 필수로 보지 않는다.

## 9. 샘플 선정 절차

실제 운영 절차는 아래처럼 단순하게 가져간다.

1. 테스트용 Riot ID 1개 준비
2. 최근 matchId 5~10개 조회
3. 각 경기 상세를 보고 조건에 맞는 경기 후보 2개 선정
4. 후보 2개 중 타임라인이 더 풍부한 경기 1개를 최종 선택
5. 원본/정규화/분석 결과를 모두 저장

### 선정 체크리스트

- 경기 길이가 너무 짧지 않은가
- 역할이 명확한가
- 초반/중반/후반 서사가 존재하는가
- 장점만 있거나 단점만 있는 일방적 경기가 아닌가
- 체크리스트형 개선 포인트가 명확히 도출되는가

## 10. 데이터 정규화 계획

Riot API 응답은 MVP UI에 그대로 쓰기보다 내부 형식으로 한 번 정규화한다.

### 내부 정규화 대상

- 경기 메타
- 플레이어 핵심 지표
- 타임라인 이벤트
- 구간별 요약 재료

### 정규화 시 유의사항

- Riot 응답은 `non-empty field only` 규칙이 있으므로 누락 필드를 기본값으로 채워야 한다
- 숫자 0, 빈 배열, 빈 문자열은 응답에 없을 수 있다
- 필드 누락을 오류로 간주하지 않는다

## 11. 품질 필터 기준

샘플 경기는 아래 기준을 만족해야 한다.

- 결과 페이지 헤더를 채우는 메타 정보가 충분하다
- 장점 3개를 만들 수 있다
- 단점 3개를 만들 수 있다
- 타임라인 핵심 장면 4개 이상을 뽑을 수 있다
- 근거 이벤트 인덱스를 최소 6개 이상 만들 수 있다

이 기준을 만족하지 못하면 다른 matchId로 교체한다.

## 12. 개인정보 및 공개 범위 원칙

- 공개 데모에서는 Riot ID를 그대로 노출하지 않는다
- 샘플 데이터 공개 시 `가명 처리` 또는 `익명화`를 적용한다
- MVP 내부 테스트에서는 원본 식별자를 별도 저장 가능하나, 프론트엔드에 그대로 노출하지 않는 것을 권장한다

## 13. 인증/권한 단계별 계획

### 단계 1. Development Key

용도:

- 초기 연구
- 샘플 경기 1건 수집
- 프로토타입 개발

주의:

- 24시간마다 키 재발급 필요

### 단계 2. Personal Key

용도:

- 개인 프로젝트 운영
- 반복 테스트
- 개인용 분석툴 수준 검증

### 단계 3. Production Key

용도:

- 공개 웹서비스
- 사용자 입력 기반 경기 조회
- RSO 연동 검토

## 14. 오류 및 예외 처리 계획

예상 오류:

- 잘못된 Riot ID
- 지역 라우팅 오류
- 만료된 API 키
- rate limit 초과
- 타임라인 누락 또는 불완전 데이터

대응 원칙:

- 401/403: 키 상태 점검
- 404: Riot ID 또는 matchId 재확인
- 429: 재시도 지연
- 필드 누락: 기본값 채우기
- 샘플 품질 부족: 다른 경기로 교체

## 15. 구현 단계별 액션

## Phase 1. 문서/설계

- 입력 파라미터 확정
- 내부 정규화 스키마 연결
- 샘플 선정 기준 확정

## Phase 2. 수집 스크립트

- Riot ID -> PUUID 조회 구현
- PUUID -> matchId 목록 조회 구현
- match 상세 조회 구현
- timeline 조회 구현
- 원본 JSON 저장 구현

## Phase 3. 샘플 선택

- 최근 경기 후보 조회
- 샘플 기준 평가
- 1건 최종 선정

## Phase 4. 정규화/분석 연결

- 내부 스키마 변환
- 분석 JSON 생성
- UI 연결

## 16. 현재 권장 실행안

지금 당장 가장 실용적인 실행안은 아래다.

1. Development Key 발급
2. 테스트용 Riot ID 1개 준비
3. 최근 matchId 5개 수집
4. 상세/타임라인 확인 후 1경기 최종 선택
5. 원본 + 정규화 + 분석 결과 세트를 샘플 데이터로 고정

## 17. 오픈 질문

- 테스트용 Riot ID는 본인 계정을 쓸지 별도 테스트 계정을 쓸지
- 첫 샘플을 `MID 패배 경기`로 확정할지
- 샘플 공개 시 어느 수준까지 익명화할지
- 샘플 경기 원본 JSON을 저장소에 둘지, 로컬 개발 데이터로만 둘지

## 18. 참고 자료

- Riot Developer Portal: [https://developer.riotgames.com/docs/portal](https://developer.riotgames.com/docs/portal)
- Riot LoL 문서: [https://developer.riotgames.com/docs/lol](https://developer.riotgames.com/docs/lol)
- Riot API Reference: [https://developer.riotgames.com/apis/](https://developer.riotgames.com/apis/)

