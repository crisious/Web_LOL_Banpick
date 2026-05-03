# 작업 계획 — Phase 26+

**기준 시점**: 2026-05-03
**상위 컨텍스트**: Phase 25 트랙 B/A2/C [aa2deca / 28797a0] 완료. progress.md "다음 추천 작업" 1·2·3·4번 모두 처리됨 (5번 RSO OAuth는 외부 의존 DEFER 유지). 새로 도출된 작업으로 후속 페이즈 정리.

---

## 0. Phase 25 후 발견 사항

세 트랙을 작업하며 드러난 정합성 갭과 잠재 회귀 위험:

| # | 갭 | 영향 |
| --- | --- | --- |
| 1 | progress.md "26 샘플" 주장 vs 실제 manifest 2건 | 신규 기여자/AI 컨텍스트가 잘못된 전제로 작업 |
| 2 | `/Users/a1234/...` macOS 경로 14개 .md 파일에 잔존 | win32 환경에서 깨짐, 협업 혼란 |
| 3 | `validateAnalysisOutput` 회귀 테스트 부재 | 스키마 변경 시 라이브 호출 없이 검증 불가 |
| 4 | `analysisMeta.schemaViolations` 데이터 → UI 미노출 | Phase 25 Track C 측정 가시성 0 (콘솔 + JSON 파일만) |
| 5 | sample-001/002 삭제 흔적 — 정리 사유/시점 미기록 | 베이스라인 회복 불가, runbook과 불일치 |

---

## 1. 다음 트랙 후보 (4개)

### 트랙 G — 스키마 검증 회귀 테스트 (P1)

**문제**: Phase 25 Track C에서 `validateAnalysisOutput` + 정규화 분기가 핵심 안전장치가 됐지만 라이브 AI 호출 없이는 회귀 검증 불가.

**해결**:

- `test-artifacts/schema/`에 fixture 4개 — `valid.json`, `invalid-string-summary.json`, `invalid-object-phases.json`, `invalid-missing-arrays.json`
- `test-artifacts/schema/schema-tests.mjs` — `aggregate-tests.mjs` 패턴 재사용. server.js에서 `validateAnalysisOutput` 함수 소스를 동적 추출해 fixture별로 `throws / not throws` 단언
- 합쳐서 `buildAnalysis`의 정규화 분기도 fixture 기반으로 검증 → `schemaViolations` 배열 정확성 보장
- 기대 출력: 4 PASS / 0 FAIL, exit code 0

**대상**: `test-artifacts/schema/` 신규 폴더 (test-artifacts/champions-tab과 동일 패턴)

**노력**: ~1.5h (fixture 작성 + 추출 + 단언 6~8개)

**수용 기준**:

- node 환경에서 `node test-artifacts/schema/schema-tests.mjs` 단독 실행 시 전 PASS
- 각 fixture가 어떤 위반 패턴을 검증하는지 파일 헤더에 1줄 주석
- server.js 변경 없이 작동 (소스 추출 기반)

### 트랙 H — schemaViolations UI 노출 (P1)

**문제**: Track C 측정 데이터(`analysisMeta.schemaViolations`)가 JSON 파일과 서버 콘솔에만 존재해 데이터 품질 검토 시 매번 파일을 열어야 함.

**해결**:

- 신규 컴포넌트 `.data-quality-pill` (sample-switcher 카드 우측 상단 또는 evidence-ledger 헤더)
- 0건이면 mint pill "✓ 스키마 0", 1~2건이면 amber "△ 스키마 N", 3+건이면 rose "⚠ 스키마 N"
- 클릭하면 details/summary로 위반 패턴 키 전체 노출 (예: `type.matchSummary.string · count.keyMoments<2`)
- 토큰 재사용: `--mint-bg-soft` / `--amber-bg-soft` / `--rose-bg-soft` + 기존 border 토큰

**대상**: [main.js](main.js) `renderEvidence` 또는 `renderSampleSwitcher` 끝에 데이터 추출 + 마크업 추가, [styles.css](styles.css) 신규 컴포넌트, [index.html](index.html) 변경 0 (동적 마크업)

**노력**: ~1h

**수용 기준**:

- 신규 토큰 0
- main.js 셀렉터 인터페이스 호환 (기존 `[data-*]` 변경 없음)
- `analysisMeta.schemaViolations` 미존재(베이스라인 샘플) 시 pill 자체 비노출 (조건부 렌더)

### 트랙 N — 문서 정합성 정리 (P2)

**문제**: 발견 항목 #1, #2 — 14개 .md 파일에 macOS 경로 + 6+곳 stale 샘플 수치.

**해결**:

- progress.md: "26건" → 현재 정확한 수치(2건), 계정 커버리지/포지션 갱신, "최신 샘플 수집일" 업데이트
- `/Users/a1234/...` 절대경로 → 상대 markdown 링크 (`[normalized-match-schema.md](normalized-match-schema.md)`)
- `sample-data-cleanup-plan.md` 끝부분에 "2026-05-03 정리 완료: sample-001/002 + 메인계정 10건 + 보조 3건 모두 archive" 한 줄 + 사유
- README.md / 기타 14개 문서를 1회 grep & replace로 절대경로 정리

**대상**: 14개 .md 파일

**노력**: ~45분 (수정량은 적지만 14개 파일 분산)

**수용 기준**:

- `grep -r "/Users/a1234"` 결과 0건
- progress.md "샘플 데이터 상태" 섹션이 manifest.json과 일치
- 모든 absolute path 링크가 상대경로 또는 markdown 링크로 전환

### 트랙 P — 샘플 백필 / 마이그레이션 (P3)

**문제**: 발견 항목 #5 — sample-001/002 + 과거 메인계정 샘플 흔적 부재. Track G fixture 작성 시 "유효한 분석 JSON" 베이스가 라이브 생성 분 2건뿐.

**해결**: 2가지 옵션 검토.

- **P-A**: `data/samples/_archive/`에 가벼운 샘플 1건만 백업 보관 (분석 결과만, raw 제외 → ~20KB) — 회귀용 정기 fixture 후보
- **P-B**: 백필 없음. fixture는 라이브 분 2건 + 테스트용 hand-crafted JSON으로만 구성

**권장**: **P-B**가 단순. 라이브 샘플은 manifest에 등재된 것만 유지, fixture는 트랙 G 안에서 self-contained로.

**노력**: 옵션 선택 결정만 (실행 0)

---

## 2. 권장 실행 순서

```text
G (스키마 회귀 테스트, 1.5h)  ──→  Phase 25 Track C 안전망 정착
H (UI 노출, 1h)              ──→  측정 가시화로 데이터 품질 검토 가속
N (문서 정합성, 45분)         ──→  협업 컨텍스트 정리
P (샘플 백필 결정)            ──→  P-B로 결정 → 실행 0
```

**총 예상**: 3.25h (G + H + N). 셋 다 외부 의존 없이 자동 실행 가능.

---

## 3. 명시적 SKIP / DEFER

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| Track D (라이브 위반 카운트 측정) | DEFER | Riot 키 유효 + 새 매치 필요 — 사용자 트리거 시 |
| Track E (배너 수동 QA) | DEFER | 라이브 환경 의존 |
| Track F (RSO OAuth) | DEFER | Riot 프로덕션 승인 필요 |
| CSS iteration 20+ | DEFER | iter.19에서 closing chapter (PLAN Phase 25 §0) |
| 본문 폰트 16px 전환 | DEFER | 전 사이트 시각 변화 — A/B 후행 |
| admin.html 정리 | SKIP | 주 작업 흐름 아님 |
| schemaVersion v2 도입 | DEFER | v1 안정화가 우선 (트랙 G로 견고화) |

---

## 4. 다음 액션

이 계획 검토 후 결정:

- **A**: 트랙 G 단독 — 안전망 우선, 측정 후행
- **B**: 트랙 G + H 묶음 — 안전망 + 가시화 한 번에
- **C**: 세 트랙(G + H + N) 순차 자동 실행 (총 3.25h)
- **D**: 트랙 N만 — 문서 hygiene 즉시 정리
- **E**: 계획 자체 수정 (트랙 추가/제외/우선순위 조정)

권장: **C** (세 트랙 모두 자동 실행) — 모두 외부 의존 없이 완결되고 누적 효과 큼.
