# 샘플 1건 생성용 실행 계획서

작성일: 2026-04-10

관련 문서:
- [Riot API 샘플 경기 데이터 수집 계획서](/Users/a1234/Documents/Web_LOL_Banpick/plan-riot-api-sample-data.md)
- [샘플 경기 선정 기준 문서](/Users/a1234/Documents/Web_LOL_Banpick/sample-match-selection-criteria.md)
- [샘플 수집-정규화-분석 운영 절차서](/Users/a1234/Documents/Web_LOL_Banpick/sample-data-ops-runbook.md)
- [정규화 구현 체크리스트](/Users/a1234/Documents/Web_LOL_Banpick/normalization-implementation-checklist.md)
- [분석 JSON 스키마](/Users/a1234/Documents/Web_LOL_Banpick/analysis-json-schema.md)

## 1. 문서 목적

이 문서는 MVP 첫 샘플 경기 `sample-001`을 실제로 만들기 위한 실행 계획을 정의한다.

목표는 아래와 같다.

- 샘플 1건을 실제 Riot API 데이터로 확보한다
- raw 데이터, 정규화 데이터, 분석 결과를 하나의 세트로 완성한다
- 이후 UI와 분석 품질 검증에 바로 사용할 수 있게 한다

## 2. 샘플 1건의 목표 정의

`sample-001`은 아래 역할을 수행해야 한다.

- 랜딩 페이지 데모용 기본 샘플
- 결과 페이지 UI 연결용 기준 데이터
- 분석 프롬프트와 출력 품질 검증용 기준 경기
- 향후 추가 샘플과 비교할 기준선

## 3. 샘플 1건 목표 프로필

현재 권장 프로필은 아래와 같다.

- 게임 타입: `Summoner's Rift`
- 큐: `랭크 솔로` 또는 `일반 게임`
- 역할: `MID`
- 결과: `LOSS`
- 경기 길이: `29~31분`
- 챔피언: 대중적인 미드 챔피언
- 경기 테마:
  - 초반 라인 주도권 또는 로밍 장점 존재
  - 중반 시야/오브젝트 준비 부족 존재
  - 후반 종결 구도에서 역전 실패

## 4. 최종 산출물

`sample-001` 완료 시 아래 파일이 있어야 한다.

- `raw-account.json`
- `raw-match-ids.json`
- `raw-match.json`
- `raw-timeline.json`
- `normalized-match.json`
- `analysis-result.json`
- 선택적으로 `sample-001-notes.md`

권장 폴더:

```text
data/samples/sample-001/
```

## 5. 사전 준비물

- Riot Development Key
- 테스트용 Riot ID 1개
- 샘플 저장 디렉터리
- 공개용/내부용 구분 결정
- 익명화 규칙 결정

## 6. 성공 기준

`sample-001`은 아래 조건을 만족하면 성공이다.

- 후보 경기 1건이 선정되었다
- `normalized-match.json`이 생성되었다
- `analysis-result.json`이 생성되었다
- 분석 결과에서 장점 3개, 단점 3개, 체크리스트 3개 이상이 자연스럽게 나온다
- 결과 페이지 상단 요약, 장단점 카드, 타임라인이 충분히 채워진다

## 7. 전체 실행 흐름

```text
테스트용 Riot ID 확정
-> 최근 경기 5건 수집
-> 후보 경기 점수 평가
-> 최종 match 1건 선정
-> raw 데이터 저장
-> 정규화 수행
-> 분석 결과 생성
-> 품질 검토
-> sample-001 확정
```

## 8. 단계별 실행 계획

## Phase 1. 대상 계정 확정

### 작업

- 테스트용 Riot ID 1개 선택
- region 정보 확정
- 공개용 샘플이면 익명화 정책 확정

### 완료 조건

- Riot ID와 region이 확정되었다
- 샘플 공개 가능 여부가 정리되었다

### 리스크

- 계정 경기 수가 부족할 수 있음

### 대응

- 필요 시 백업 테스트 계정 준비

## Phase 2. 최근 경기 후보 수집

### 작업

- Riot ID -> PUUID 조회
- 최근 `matchId` 5개 조회
- 각 경기 상세 수집

### 산출물

- `raw-account.json`
- `raw-match-ids.json`
- 후보 경기 메모

### 완료 조건

- 최소 3개 이상의 유효 후보가 확보되었다

## Phase 3. 후보 경기 평가

### 작업

- [sample-match-selection-criteria.md](/Users/a1234/Documents/Web_LOL_Banpick/sample-match-selection-criteria.md) 기준으로 각 경기 평가
- 필수 조건 미달 경기 제거
- 점수표로 상위 2경기 선별

### 평가 항목

- 서사성
- 장점 도출 가능성
- 단점 도출 가능성
- 체크리스트 전환 가능성
- UI 데모 적합성
- 일반 사용자 이해도

### 완료 조건

- 최종 후보 1경기가 결정되었다

### 산출물

- `sample-001-notes.md` 또는 간단 평가표

## Phase 4. raw 데이터 고정

### 작업

- 선택된 경기의 match 상세 재저장
- 선택된 경기의 timeline 저장

### 산출물

- `raw-match.json`
- `raw-timeline.json`

### 완료 조건

- 선택 샘플의 raw 데이터가 폴더에 고정 저장되었다

## Phase 5. 정규화 생성

### 작업

- 대상 participant 식별
- `matchInfo` 생성
- `playerStats` 생성
- `teamContext` 생성
- `timelineEvents` 추출
- `phaseContext` 집계
- `derivedSignals` 계산

### 기준 문서

- [normalized-match-schema.md](/Users/a1234/Documents/Web_LOL_Banpick/normalized-match-schema.md)
- [normalization-mapping-rules.md](/Users/a1234/Documents/Web_LOL_Banpick/normalization-mapping-rules.md)
- [normalization-implementation-checklist.md](/Users/a1234/Documents/Web_LOL_Banpick/normalization-implementation-checklist.md)

### 산출물

- `normalized-match.json`

### 완료 조건

- 필수 필드가 채워졌다
- timelineEvents가 8개 이상 확보되었다
- candidateThemes가 2개 이상 생성되었다

## Phase 6. 분석 결과 생성

### 작업

- LLM 입력 payload 생성
- 시스템/작업 지시문 조합
- output contract 포함
- 분석 JSON 생성

### 기준 문서

- [llm-prompt-input-format.md](/Users/a1234/Documents/Web_LOL_Banpick/llm-prompt-input-format.md)
- [analysis-json-schema.md](/Users/a1234/Documents/Web_LOL_Banpick/analysis-json-schema.md)

### 산출물

- `analysis-result.json`

### 완료 조건

- strengths 3개
- weaknesses 3개
- actionChecklist 3~5개
- keyMoments 4개 이상
- evidenceIndex가 채워짐

## Phase 7. 품질 검토 및 확정

### 검토 질문

- 경기 한줄 요약이 자연스러운가
- 장점과 단점이 균형 잡혔는가
- 체크리스트가 행동 가능한가
- 결과 페이지 카드가 충분히 풍성한가
- 이 샘플이 MVP 대표 데모로 적합한가

### 완료 조건

- sample-001 확정 또는 후보 2위 경기로 교체 결정

## 9. 시간 기준 계획

권장 소요 추정:

- 후보 수집: 20~30분
- 후보 평가: 20분
- raw 고정: 10분
- 정규화 생성: 30~60분
- 분석 생성/조정: 30~60분
- 품질 검토: 20분

총합:

- 약 `2~4시간`

## 10. 의사결정 포인트

실행 중 아래 지점에서 판단이 필요하다.

### 판단 A. 테스트 계정 선택

선택지:

- 본인 계정
- 별도 테스트 계정

권장:

- 공개 가능성과 데이터 안정성을 생각하면 별도 테스트 계정이 더 안전

### 판단 B. 첫 샘플 테마 유지 여부

기본 권장:

- `MID LOSS`

예외:

- 후보가 전부 부적합하면 `JUNGLE WIN` 백업 플랜으로 전환

### 판단 C. 익명화 수준

선택지:

- 내부 전용: 원본 식별자 유지
- 공개 데모: Riot ID 가명화

권장:

- 샘플은 처음부터 공개 가능 형태로 정리

## 11. 실패 대응 계획

### 실패 시나리오 1. 최근 경기 후보가 부적합

대응:

- count를 10으로 늘림
- 다른 테스트 계정 사용

### 실패 시나리오 2. 역할이 불명확한 경기만 있음

대응:

- 다음 계정 또는 다음 경기 세트로 이동

### 실패 시나리오 3. timeline 이벤트가 빈약함

대응:

- 후보 2위 경기로 교체

### 실패 시나리오 4. 분석 결과가 너무 일반적임

대응:

- sample 교체 검토
- derivedSignals 보강
- timelineEvents 선택 품질 점검

## 12. sample-001 채택 기준

아래를 모두 만족하면 `sample-001`로 채택한다.

- 미드 패배 경기이거나 그에 준하는 서사 품질이 있다
- 장점과 단점이 모두 설득력 있게 나온다
- 체크리스트가 구체적이다
- UI에 넣었을 때 비어 보이지 않는다
- 추후 프롬프트 튜닝 기준 데이터로 사용 가능하다

## 13. sample-001 메모 템플릿

권장 메모 형식:

```text
Sample ID: sample-001
Match ID: KR_xxxxxxxxxx
Theme: 초반 로밍은 좋았지만 중반 오브젝트 준비 부족으로 흐름을 잃은 미드 패배 경기
Why selected:
- 장점 3개와 단점 3개가 자연스럽게 나옴
- key moment가 충분히 풍부함
- 체크리스트가 행동 단위로 잘 전환됨
Anonymized: yes
```

## 14. 현재 권장 실행안

지금 바로 샘플 생성 작업을 시작한다면 아래 순서를 권장한다.

1. 테스트용 Riot ID 확정
2. 최근 경기 5건 수집
3. 점수표로 1건 선택
4. raw 데이터 고정
5. 정규화 생성
6. 분석 결과 생성
7. sample-001 확정

## 15. 다음 단계

이 문서 다음으로 가장 자연스러운 작업은 아래다.

1. 실제 수집에 사용할 테스트용 Riot ID 입력 방식 확정
2. sample-001 실데이터 수집 실행
3. 결과 페이지용 mock 연결

