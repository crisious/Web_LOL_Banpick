# sample-001 실수집 실행 체크리스트

작성일: 2026-04-11

관련 문서:
- [샘플 1건 생성용 실행 계획서](/Users/a1234/Documents/Web_LOL_Banpick/sample-001-execution-plan.md)
- [정규화 구현 체크리스트](/Users/a1234/Documents/Web_LOL_Banpick/normalization-implementation-checklist.md)
- [샘플 수집-정규화-분석 운영 절차서](/Users/a1234/Documents/Web_LOL_Banpick/sample-data-ops-runbook.md)

## 1. 문서 목적

이 문서는 `sample-001`을 실제로 수집할 때 바로 따라갈 수 있는 실행 체크리스트다.

목표는 아래와 같다.

- 실수집 전에 빠진 준비물이 없는지 확인한다
- 각 단계 완료 여부를 빠르게 체크한다
- 실패 시 어디에서 막혔는지 바로 알 수 있게 한다

## 2. 시작 전 체크

- [ ] 오늘 기준 Riot API 키가 유효하다
- [ ] 테스트용 Riot ID가 준비되었다
- [ ] `gameName`, `tagLine`, `platformRegion`이 정리되었다
- [ ] 샘플 저장 폴더를 정했다
- [ ] 공개용/내부용 여부를 정했다
- [ ] 공개용이면 publicAlias를 정했다

## 3. 수집 단계 체크

### Riot ID 확인

- [ ] Riot ID 형식이 `name#tag`다
- [ ] `gameName`과 `tagLine`으로 분리했다
- [ ] region을 `KR`로 확정했다

### account-v1 호출

- [ ] PUUID 조회 성공
- [ ] `raw-account.json` 저장

### recent match IDs 호출

- [ ] 최근 경기 5개 조회
- [ ] `raw-match-ids.json` 저장
- [ ] matchId 3개 이상 확보

## 4. 후보 평가 단계 체크

- [ ] 각 후보 경기의 상세를 확인했다
- [ ] 25분 미만 경기를 제거했다
- [ ] custom match를 제거했다
- [ ] 역할 불명확 경기를 제거했다
- [ ] 샘플 기준 점수표로 평가했다
- [ ] 최종 1경기를 선택했다

## 5. raw 데이터 고정 체크

- [ ] 선택된 경기의 `raw-match.json` 저장
- [ ] 선택된 경기의 `raw-timeline.json` 저장
- [ ] sample-001 폴더에 저장
- [ ] 파일명이 일관적이다

## 6. 정규화 체크

- [ ] targetPuuid로 participant 식별
- [ ] `matchInfo` 생성
- [ ] `playerStats` 생성
- [ ] `teamContext` 생성
- [ ] `timelineEvents` 추출
- [ ] `phaseContext` 집계
- [ ] `derivedSignals` 계산
- [ ] `normalized-match.json` 저장

품질 기준:

- [ ] timelineEvents 8개 이상
- [ ] candidateThemes 2개 이상
- [ ] champion/position/result가 읽힌다

## 7. 분석 생성 체크

- [ ] LLM 입력 payload 준비
- [ ] output contract 포함
- [ ] `analysis-result.json` 생성

최소 품질 기준:

- [ ] strengths 3개
- [ ] weaknesses 3개
- [ ] actionChecklist 3개 이상
- [ ] keyMoments 4개 이상
- [ ] evidenceIndex 존재

## 8. 공개용 샘플 체크

- [ ] Riot ID가 공개용 별칭으로 치환되었다
- [ ] 실제 식별자가 프론트엔드 노출 파일에 남지 않았다
- [ ] 공개 가능한 샘플인지 다시 확인했다

## 9. 최종 확정 체크

- [ ] sample-001 테마가 한 문장으로 정리된다
- [ ] 장점/단점이 균형적이다
- [ ] UI 데모에 넣어도 비어 보이지 않는다
- [ ] 추후 프롬프트 튜닝 기준 데이터로 사용할 수 있다

## 10. 실패 시 빠른 대응

### PUUID 조회 실패

- [ ] Riot ID 오타 재확인
- [ ] API 키 상태 확인

### 후보 경기 부족

- [ ] count를 10으로 늘린다
- [ ] 다른 테스트 계정 사용 검토

### 역할이 불명확

- [ ] 해당 경기 탈락

### timeline 품질 부족

- [ ] 후보 2위 경기로 교체

### 분석 결과가 빈약

- [ ] sample 교체 여부 검토
- [ ] timelineEvents 선택 품질 재검토
- [ ] derivedSignals 보강 검토

## 11. sample-001 완료 조건

- [ ] raw, normalized, analysis 3단계 파일이 모두 존재
- [ ] 샘플 테마가 명확하다
- [ ] 공개용 별칭 적용 완료
- [ ] MVP 데모에 바로 사용할 수 있다

