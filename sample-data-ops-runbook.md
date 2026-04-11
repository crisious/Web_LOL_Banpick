# 샘플 수집-정규화-분석 운영 절차서

작성일: 2026-04-10

관련 문서:
- [Riot API 샘플 경기 데이터 수집 계획서](/Users/a1234/Documents/Web_LOL_Banpick/plan-riot-api-sample-data.md)
- [샘플 경기 선정 기준 문서](/Users/a1234/Documents/Web_LOL_Banpick/sample-match-selection-criteria.md)
- [정규화 경기 데이터 스키마 문서](/Users/a1234/Documents/Web_LOL_Banpick/normalized-match-schema.md)
- [정규화 매핑 규칙 상세서](/Users/a1234/Documents/Web_LOL_Banpick/normalization-mapping-rules.md)
- [분석 JSON 스키마](/Users/a1234/Documents/Web_LOL_Banpick/analysis-json-schema.md)

## 1. 문서 목적

이 문서는 `샘플 경기 1건`을 실제로 확보하고 분석 결과까지 만드는 운영 절차를 정리한다.

목표는 아래와 같다.

- 누구나 같은 순서로 샘플 데이터를 재현 가능하게 만든다
- 중간 실패 시 어디서 멈췄는지 명확히 알 수 있게 한다
- 샘플 수집, 정규화, 분석을 하나의 실행 흐름으로 연결한다

## 2. 운영 단위

샘플 1건을 만들 때 생성되는 산출물은 아래와 같다.

- `raw-account.json`
- `raw-match-ids.json`
- `raw-match.json`
- `raw-timeline.json`
- `normalized-match.json`
- `analysis-result.json`
- 선택적으로 `sample-evaluation.md`

## 3. 사전 준비

- Riot API 키 준비
- 테스트용 Riot ID 준비
- 저장 디렉터리 준비
- 공개용/내부용 여부 결정
- 익명화 여부 결정

권장 디렉터리 예:

```text
data/
  samples/
    sample-001/
      raw-account.json
      raw-match-ids.json
      raw-match.json
      raw-timeline.json
      normalized-match.json
      analysis-result.json
```

## 4. 전체 운영 흐름

```text
테스트용 Riot ID 준비
-> 최근 경기 조회
-> 후보 경기 필터링
-> 점수표로 최종 샘플 선택
-> raw 데이터 저장
-> 정규화 수행
-> 분석 생성
-> 결과 품질 검토
-> 샘플 고정
```

## 5. Phase 1: 후보 경기 수집

### Step 1. Riot ID 입력

입력값:

- `gameName`
- `tagLine`
- `platformRegion`

산출물:

- 입력 로그 또는 실행 메모

### Step 2. PUUID 조회

산출물:

- `raw-account.json`

확인 포인트:

- `puuid` 존재
- Riot ID 오타 없음

### Step 3. 최근 경기 ID 조회

권장:

- 최근 5경기 조회

산출물:

- `raw-match-ids.json`

확인 포인트:

- `matchIds`가 3개 이상 확보되었는가

## 6. Phase 2: 샘플 후보 평가

### Step 4. 경기 상세 조회

후보 `matchId` 각각에 대해 상세를 조회한다.

산출물:

- 임시 raw match 응답들

확인 포인트:

- Summoner's Rift 경기인가
- 길이가 적절한가
- 역할이 명확한가
- 챔피언과 결과가 샘플 방향과 맞는가

### Step 5. 1차 필터

제외 기준:

- 25분 미만
- custom match
- 역할 불명확
- 서사가 너무 빈약

### Step 6. 점수표 평가

[sample-match-selection-criteria.md](/Users/a1234/Documents/Web_LOL_Banpick/sample-match-selection-criteria.md)의 기준으로 점수화한다.

평가 항목:

- 서사성
- 장점 도출 가능성
- 단점 도출 가능성
- 체크리스트 전환 가능성
- UI 데모 적합성
- 일반 사용자 이해도

산출물:

- `sample-evaluation.md` 또는 간단한 표

### Step 7. 최종 샘플 선택

최종 1경기를 선택한다.

선택 기준:

- 총점 우세
- 장단점 균형
- 타임라인 풍부함

## 7. Phase 3: raw 데이터 고정

선택한 샘플에 대해 아래를 다시 확정 저장한다.

- `raw-account.json`
- `raw-match-ids.json`
- `raw-match.json`
- `raw-timeline.json`

체크:

- 샘플 폴더를 별도 분리했다
- 파일명이 일관되다
- 익명화 전 원본과 공개용 파일 정책을 구분했다

## 8. Phase 4: 정규화 수행

### Step 8. 대상 participant 식별

기준:

- `targetPuuid`

실패 시:

- 다른 샘플로 교체하거나 raw 데이터 상태 확인

### Step 9. 정규화 생성

[normalized-match-schema.md](/Users/a1234/Documents/Web_LOL_Banpick/normalized-match-schema.md)와 [normalization-mapping-rules.md](/Users/a1234/Documents/Web_LOL_Banpick/normalization-mapping-rules.md)를 따라 `normalized-match.json` 생성

출력:

- `normalized-match.json`

### Step 10. 정규화 품질 검토

확인 항목:

- 경기 메타가 채워졌는가
- KDA, CS, KP가 상식적인가
- timelineEvents가 충분한가
- phaseContext가 읽히는가
- derivedSignals가 의미 있는가

## 9. Phase 5: 분석 생성

### Step 11. LLM 입력 패키지 생성

입력 재료:

- `normalized-match.json`
- 분석 태스크 설명
- 출력 스키마 계약

출력:

- LLM 요청 payload

### Step 12. 분석 결과 생성

출력:

- `analysis-result.json`

확인 항목:

- 장점 최소 3개
- 단점 최소 3개
- 행동 체크리스트 최소 3개
- key moments 최소 4개
- evidence 연결이 자연스러운가

## 10. Phase 6: 결과 품질 검토

### Step 13. 분석 품질 검토

질문:

- 경기 요약이 실제 흐름과 맞는가
- 장점과 단점이 균형 잡혔는가
- 체크리스트가 행동 가능한가
- UI 데모에 충분히 풍성한가

### Step 14. 샘플 채택 여부 확정

조건:

- 분석 품질이 충분하면 샘플 확정
- 부족하면 후보 2위 경기로 교체

## 11. 단계별 완료 조건

### 후보 수집 완료

- Riot ID로 최근 경기 5건 확보

### 후보 평가 완료

- 최종 샘플 1건 선정

### 정규화 완료

- `normalized-match.json` 생성

### 분석 완료

- `analysis-result.json` 생성

### 샘플 확정 완료

- UI와 분석 데모에 사용 가능

## 12. 실패 대응 규칙

### Riot ID 조회 실패

- Riot ID 재확인
- region 경로 점검
- API 키 상태 점검

### match 후보 부족

- `count=10`으로 확대
- 다른 테스트 계정 사용

### 역할 불명확

- 해당 경기 탈락

### timeline 품질 부족

- 후보 경기 교체

### 분석 결과가 일반론적

- 다른 샘플 경기 선택
- derivedSignals 강화
- LLM 입력 구조 보강

## 13. 운영 기록 권장

샘플을 최종 확정할 때 아래를 간단히 기록해 두면 좋다.

- 샘플 ID
- 경기 테마 한 줄
- 선정 이유
- 탈락한 후보 경기 이유
- 익명화 여부

예:

```text
sample-001
테마: 초반 로밍은 좋았지만 중반 오브젝트 준비 부족으로 흐름을 잃은 미드 패배 경기
선정 이유: 장점/단점/체크리스트가 모두 자연스럽게 도출됨
```

## 14. 현재 권장 운영안

첫 샘플 운영은 아래 기준을 따른다.

- 최근 경기 5개 수집
- 점수표 기준으로 1건 선택
- raw/normalized/analysis 결과를 모두 저장
- 품질 부족 시 후보 2위 경기로 교체

## 15. 다음 단계

이 절차서 다음으로 바로 이어질 작업은 아래다.

1. 실제 테스트용 Riot ID 확정
2. 샘플 1건 수집 실행
3. 정규화 데이터 생성
4. 분석 결과 생성
5. UI mock 연결

