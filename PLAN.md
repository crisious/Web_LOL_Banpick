# 작업 계획 — Phase 26+

**기준 시점**: 2026-05-03
**상위 컨텍스트**: Phase 25 트랙 B/A2/C [aa2deca / 28797a0] 완료. CSS 토큰 리팩토링 아크 (iter.4~19)는 종료됨.

---

## 0. Phase 25 완료 회고

세 트랙이 [CHANGELOG.md "Phase 25 — Track B/A2/C 일괄"](CHANGELOG.md)에 기록됨. 회귀 영향:

- 신규 토큰 0건 (Track B 배너는 `--tint-rose` / `--rose-border` / `--shadow-hover` 재사용)
- index.html `[data-*]` 셀렉터 0 변경
- main.js `fetchJson` 인터페이스는 호환 (`error.code`/`error.hint`는 옵셔널)
- server.js `requestJson` 시그니처 호환

**가시 효과**:

- Track B: Riot 키 만료 시 sticky 배너 + Riot Developer Portal 링크 + dismiss 버튼
- Track A2: 첫 탭 클릭 200ms 인공 지연 제거 + 동일 샘플 재선택 시 25+ 렌더 함수 스킵
- Track C: `analysisMeta.schemaViolations` 배열 + 콘솔 로그로 위반 패턴 측정 가능

**측정 베이스라인**: `sample-kr-8190642410` / `sample-kr-8190721866`는 Track C 적용 *전*에 생성됨. 두 샘플의 `analysisMeta`에는 `schemaViolations` 필드 없음 (베이스라인).

---

## 1. 다음 트랙 후보

Phase 25에서 명확히 도출되는 후속 작업 + progress.md 잔여 추천 항목 정리.

### 트랙 D — Track C 효과 측정

**전제**: Track C 프롬프트 개선이 실제로 위반 패턴을 줄였는지 데이터로 확인.

**조건**: Riot 개발 키 유효 + 새 매치 3건 이상 생성 가능.

**절차**:

1. `/api/generate-sample` 신규 호출 3회 (서로 다른 매치)
2. 각 샘플의 `analysis-result.json.analysisMeta.schemaViolations` 배열 검사
3. 베이스라인 2건과 비교 — 빈 배열이거나 위반 수 절반 이하면 성공
4. 위반이 동일하거나 늘어나면 프롬프트 추가 조정 (예: 위반 패턴별 negative example)

**노력**: ~15분 (생성은 비동기 백그라운드, 검사는 grep)

### 트랙 E — Riot 키 배너 시나리오 검증

Track B 코드 경로가 실제 만료 상황에서 작동하는지 확인.

**시나리오**:

1. 정상 키로 로그인 후 .env 키를 일부러 무효화 → "이전 10개 더 보기" 클릭 → 배너 표시 확인
2. 배너 dismiss 후 새로고침 → 배너 hidden 유지 (sessionStorage 미적용 — 새 키 만료 시 재노출)
3. 챔피언 탭 SSE 만료 → 배너 + 분석 실패 메시지 둘 다 노출
4. 저장된 샘플 전환은 401 영향 없음을 확인 (`/api/samples/:id`는 Riot 호출 안 함)

**노력**: ~10분 수동 테스트

### 트랙 F — Riot RSO OAuth (장기)

progress.md "다음 추천 작업 5번". 프로덕션 승인 필요한 외부 의존성 — 현 시점 SKIP/DEFER 유지. 별도 트리거가 생기면 Phase 27+로 분리.

---

## 2. 권장 실행 순서

```text
D (Track C 측정, 15분)  ──→  Phase 25 검증 종결
E (Track B 시나리오 QA, 10분) ──→ 사용자 발견 가능한 회귀 차단
F (RSO OAuth)           ──→  DEFER 유지
```

**총 예상**: 25분 (D + E). 둘 다 라이브 환경 필요 (Riot 키 유효).

---

## 3. SKIP / DEFER

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| CSS iteration 20+ | DEFER | 후보 없음 (iter.19에서 closing chapter) |
| Riot RSO OAuth (트랙 F) | DEFER | 프로덕션 승인 외부 의존 |
| 본문 폰트 16px 전환 | DEFER | 전 사이트 시각 변화 — A/B 후행 |
| admin.html 정리 | SKIP | 주 작업 흐름 아님 |

---

## 4. 다음 액션

- **A**: 트랙 D만 — Riot 키가 유효할 때 새 샘플 3건 생성 + 위반 카운트 비교
- **B**: 트랙 E만 — Track B 배너 수동 QA
- **C**: D + E 묶음 — 한 세션에 검증 완료
- **D**: 계획 자체 수정 — 새 작업 항목 추가
- **E**: 단순 대기 — 라이브 검증 트리거(키 갱신, 새 매치 발생)까지 보류

라이브 환경 의존 작업이라 자동 실행은 불가. 사용자 트리거 시 진행.
