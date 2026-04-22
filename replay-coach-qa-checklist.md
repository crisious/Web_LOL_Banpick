# Replay Coach QA Checklist

## 목적

이 문서는 현재 웹 프로토타입의 핵심 사용자 흐름을 빠르게 다시 검증하기 위한 실행 체크리스트다.  
범위는 `로그인 -> 최근 경기 조회 -> 경기 카드 진입 -> 상세 화면 유지/복구`까지로 한정한다.

기준 시점: 2026-04-13

## 테스트 환경

- 서버 실행: `node server.js`
- 접속 주소: `http://127.0.0.1:8123`
- `.env`에 유효한 `RIOT_API_KEY` 설정 필요

### Smoke 자동화

- `powershell -ExecutionPolicy Bypass -File scripts/qa-smoke.ps1`
- 범위: 홈 화면 응답, `/api/samples`, 대표 sample 상세, DOM dump, 데스크톱/태블릿/모바일 스크린샷
- 산출물: `test-artifacts/qa-automation/<timestamp>/`
- 이 문서의 체크리스트 중 A, B의 기본 진입 검증을 자동 smoke로 먼저 수행하고, 라이브 Riot API 경로는 수동/E2E로 이어서 확인

## 테스트 계정

### 1. 메인 계정

- `gameName`: `매운맛 비스킷`
- `tagLine`: `KR1`
- `platformRegion`: `KR`

용도:
- 저장된 샘플 즉시 열기
- 최근 10경기 목록 확인
- `429` 실패 복구 확인

### 2. 보조 계정

- `gameName`: `핑거샷`
- `tagLine`: `KR1`
- `platformRegion`: `KR`

용도:
- 미저장 경기 생성 경로 확인
- 보조 계정 샘플 라이브러리 확인

## 저장 샘플 기준

### 메인 계정 저장 샘플

- `KR_8164563430`
- `KR_8164577567`
- `KR_8164613865`
- `KR_8166489844`
- `KR_8166519650`
- `KR_8166546648`
- `KR_8166575303`
- `KR_8166601659`
- `KR_8166637996`
- `KR_8166674448`

### 보조 계정 보존 샘플

- `KR_8048821726`
- `KR_8065601119`
- `KR_8097520888`

## 핵심 플로우 체크리스트

### A. 로그인 / 최근 10경기 조회

- [ ] 첫 진입 시 로그인 화면이 보인다.
- [ ] `매운맛 비스킷#KR1` 로그인 시 `MATCH_LIST`로 전환된다.
- [ ] 최근 10경기 카드가 렌더링된다.
- [ ] 로그인 버튼을 빠르게 두 번 눌러도 `/api/recent-matches` 요청은 1회만 발생한다.
- [ ] `429`가 발생하면 로그인 화면 유지 + 오류 문구 노출이 된다.

기대 결과:
- 실패 시 입력값은 유지된다.
- 자동 재시도는 없다.

### B. 저장된 경기 상세 진입

추천 확인 경기:
- `KR_8166601659`

- [ ] 저장된 경기 카드를 클릭하면 바로 `DETAIL_VIEW`로 전환된다.
- [ ] `generate-sample` 호출 없이 상세가 열린다.
- [ ] `sample-kr-8166601659` 로드 완료 문구가 보인다.
- [ ] 챔피언 / 역할 / 승패 / 매치 ID가 기존 샘플과 일치한다.

기대 결과:
- 상태 문구가 `분석 중...`에 고정되지 않는다.
- 뒤로 가기 버튼으로 다시 목록 복귀가 된다.

### C. 미저장 경기 생성 경로

추천 확인 계정:
- `핑거샷#KR1`

추천 확인 경기:
- 저장되지 않은 최근 경기 1건

이미 생성/보존된 샘플:
- `KR_8048821726`

정리 후 삭제된 예시:
- `KR_8041349600`
- `KR_8048864259`

- [ ] `핑거샷#KR1` 로그인 후 최근 경기 카드가 보인다.
- [ ] 저장되지 않은 경기 클릭 시 `LOADING_DETAIL`로 전환된다.
- [ ] `/api/generate-sample` 요청이 1회만 발생한다.
- [ ] 생성 완료 후 새 샘플을 로드하고 `DETAIL_VIEW`로 전환된다.
- [ ] 최종 상태 문구가 `sample-... 로드 완료`로 바뀐다.

기대 결과:
- 성공 후 `분석 중...` 문구가 남지 않는다.
- 새 샘플이 `manifest`와 샘플 라이브러리에 반영된다.

### D. 상세 화면에서 최근 경기 다시 불러오기

추천 시작 상태:
- `매운맛 비스킷#KR1`
- 저장된 경기 상세 화면 진입 후

- [ ] 상세 화면에서 `최근 경기 불러오기` 버튼이 동작한다.
- [ ] 조회 성공 시 상세 화면이 불필요하게 깨지지 않는다.
- [ ] 조회 직후 다시 눌러 `429`를 유도하면 오류 문구가 노출된다.
- [ ] `429` 이후에도 현재 `DETAIL_VIEW`는 유지된다.
- [ ] 현재 열려 있던 `sampleId`, `heroMatch` 값이 그대로 남는다.

기대 결과:
- 실패해도 상세 본문은 사라지지 않는다.
- 오류는 상태 문구에만 반영된다.

### E. 샘플 라이브러리 정리 상태

- [ ] 샘플 라이브러리에 `sample-kr-8048821726`는 남아 있다.
- [ ] 샘플 라이브러리에서 `sample-kr-8041349600`는 보이지 않는다.
- [ ] 샘플 라이브러리에서 `sample-kr-8048864259`는 보이지 않는다.
- [ ] `/api/samples` 응답에도 위 상태가 동일하게 반영된다.

## 빠른 API 체크

### 최근 경기 조회

```bash
curl -s -X POST http://127.0.0.1:8123/api/recent-matches \
  -H 'Content-Type: application/json' \
  --data '{"gameName":"매운맛 비스킷","tagLine":"KR1","platformRegion":"KR","matchCount":10}'
```

### 샘플 목록 확인

```bash
curl -s http://127.0.0.1:8123/api/samples
```

### 특정 샘플 확인

```bash
curl -s http://127.0.0.1:8123/api/samples/sample-kr-8166601659
```

## 자주 보는 실패 패턴

### 1. `Riot API 401: Unknown apikey`

의미:
- 현재 키가 만료되었거나 잘못된 키다.

조치:
- Riot Developer Portal에서 새 키 발급
- `.env`의 `RIOT_API_KEY` 교체
- 서버 재시작

### 2. `429 rate limit exceeded`

의미:
- Riot API 또는 로컬 재조회 쿨다운에 걸렸다.

조치:
- 10초 정도 기다린 후 재시도
- 상세 화면에서는 데이터 유지가 정상 동작인지 같이 확인

### 3. `LOADING_DETAIL` 장시간 유지

확인 포인트:
- 실제 `generate-sample` 요청이 갔는지
- 새 샘플이 `manifest`에 생겼는지
- 성공 후 상태 문구가 `로드 완료`로 바뀌는지

## 관련 문서

- [README.md](/Users/a1234/Documents/Web_LOL_Banpick/README.md)
- [sample-data-cleanup-plan.md](/Users/a1234/Documents/Web_LOL_Banpick/sample-data-cleanup-plan.md)
- [sample-data-ops-runbook.md](/Users/a1234/Documents/Web_LOL_Banpick/sample-data-ops-runbook.md)
