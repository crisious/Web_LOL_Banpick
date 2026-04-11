# 테스트용 Riot ID 입력/관리 방식 문서

작성일: 2026-04-11

관련 문서:
- [Riot API 샘플 경기 데이터 수집 계획서](/Users/a1234/Documents/Web_LOL_Banpick/plan-riot-api-sample-data.md)
- [샘플 1건 생성용 실행 계획서](/Users/a1234/Documents/Web_LOL_Banpick/sample-001-execution-plan.md)

## 1. 문서 목적

이 문서는 `sample-001` 실수집에 사용할 테스트용 Riot ID를 어떻게 입력받고 관리할지 정의한다.

목표는 아래와 같다.

- 입력 형식을 고정한다
- 잘못된 Riot ID 입력을 줄인다
- 내부 테스트와 공개 샘플 관리 방식을 분리한다
- 이후 여러 샘플을 만들 때도 같은 규칙을 재사용한다

## 2. 기본 원칙

- 입력 기준은 `Summoner Name`이 아니라 `Riot ID`다
- Riot ID는 `gameName#tagLine` 형식으로 관리한다
- 공개용 샘플은 처음부터 익명화 가능한 구조로 관리한다
- 실제 식별자와 공개용 별칭은 분리한다

## 3. 입력 형식

권장 입력 형식은 아래 2가지 중 하나다.

### 형식 A. 단일 문자열

```text
ExamplePlayer#KR1
```

### 형식 B. 구조화 입력

```json
{
  "gameName": "ExamplePlayer",
  "tagLine": "KR1",
  "platformRegion": "KR"
}
```

권장:

- 내부 구현은 `형식 B`
- 사용자 입력 UI는 `형식 A`

## 4. 내부 저장 모델

테스트용 Riot ID는 아래 구조로 관리하는 것을 권장한다.

```json
{
  "id": "tester-001",
  "gameName": "ExamplePlayer",
  "tagLine": "KR1",
  "platformRegion": "KR",
  "regionalCluster": "ASIA",
  "purpose": "sample-001",
  "visibility": "private",
  "publicAlias": "PlayerAlias#KR1",
  "notes": "MID 샘플 후보 탐색용 계정"
}
```

## 5. 필드 정의

- `id`: 내부 식별자
- `gameName`: Riot ID 이름
- `tagLine`: Riot ID 태그
- `platformRegion`: `KR`, `NA1`, `EUW1` 등
- `regionalCluster`: `ASIA`, `AMERICAS`, `EUROPE` 등
- `purpose`: 어떤 샘플/용도에 쓰는지
- `visibility`: `private` 또는 `public_sample`
- `publicAlias`: 공개용 별칭
- `notes`: 사용 메모

## 6. 입력 검증 규칙

### 최소 검증

- `gameName` 비어 있지 않음
- `tagLine` 비어 있지 않음
- `platformRegion` 비어 있지 않음

### 문자열 입력 파싱 규칙

- `#` 기준으로 분리
- 앞부분은 `gameName`
- 뒷부분은 `tagLine`

실패 처리:

- `#`가 없으면 오류
- `#` 앞뒤 값이 비면 오류

## 7. 권장 운영 방식

### 내부 테스트 단계

- 실제 Riot ID를 저장 가능
- visibility는 `private`
- publicAlias는 선택

### 공개 샘플 단계

- 실제 Riot ID는 내부 관리만
- publicAlias는 필수
- 프론트엔드와 공유되는 데이터는 publicAlias만 사용

## 8. 테스트 계정 선택 기준

테스트용 Riot ID는 아래 조건을 만족하면 좋다.

- 최근 경기 수가 충분함
- Summoner's Rift 일반/랭크 경기 플레이가 있음
- 샘플 테마에 맞는 역할/챔피언 경기가 나올 가능성이 높음
- 공개 데모로 써도 민감하지 않음

## 9. 권장 보관 방식

민감도에 따라 아래처럼 구분한다.

### 내부 전용

- `config/test-riot-ids.local.json`

권장 이유:

- 저장소 커밋 대상에서 제외 가능

### 공개용 메타만 필요할 때

- `config/public-sample-aliases.json`

권장 이유:

- 프론트엔드 공개 데이터와 분리 가능

## 10. sample-001 기준 권장 입력값

sample-001은 아래처럼 관리하는 것을 권장한다.

```json
{
  "id": "tester-001",
  "gameName": "REAL_GAME_NAME",
  "tagLine": "REAL_TAG",
  "platformRegion": "KR",
  "regionalCluster": "ASIA",
  "purpose": "sample-001",
  "visibility": "public_sample",
  "publicAlias": "PlayerAlias#KR1",
  "notes": "MID LOSS 샘플 후보 탐색용"
}
```

## 11. 변경 관리 원칙

- 실제 Riot ID가 바뀌어도 `id`는 유지한다
- `purpose`가 바뀌면 메모를 갱신한다
- 공개용 별칭은 샘플 데이터가 확정된 뒤 고정한다

## 12. 현재 권장 결정

현재 단계에서는 아래 방식을 권장한다.

- 입력 UI는 `gameName#tagLine`
- 내부 저장은 구조화 JSON
- sample-001은 처음부터 `publicAlias` 포함 구조로 관리
- 실제 Riot ID는 공개용 샘플과 분리

