# 작업 계획 — Phase 25+

**기준 시점**: 2026-05-03
**상위 컨텍스트**: [CHANGELOG.md](CHANGELOG.md) Phase 1~24 + iter.11(챔피언 탭) 완료 / [design-tokens.md](design-tokens.md) §10 항목 1~21 완료 / styles.css iteration 4~19 토큰 정리 아크 종료.

---

## 0. 토큰 리팩토링 아크 종료 선언

iter.4~19에 걸친 CSS 토큰 정리는 사실상 마무리 단계. 잔여 하드코딩은 모두 의도적 예외로 등재됨:

| 카테고리 | 잔여 | 상태 |
| --- | --- | --- |
| `font-size` 비-토큰 | 3건 (body 16/15/14px responsive) | [design-tokens.md §2 "Responsive body base 예외"](design-tokens.md) |
| `border-radius` 비-토큰 | 2건 (`5px 0 0 5px` / `10px 0 0 10px` 비대칭 쇼트핸드) | [design-tokens.md §4 "보존 대상"](design-tokens.md) |
| `gap` 비-토큰 | 6건 (1-2px 극한 타이트) | [design-tokens.md §3 "Outlier 보류"](design-tokens.md) |
| 컬러 비-토큰 단독 사용 | 10종 | [design-tokens.md §1 "수용된 단독 사용"](design-tokens.md) |

styles.css 라인 수는 iter.18 기준 4345→4213(-132)로 dead-CSS도 정리됨.

**결론**: iteration 20을 더 돌릴 만한 명확 후보 없음. 추가 토큰 작업은 새 컴포넌트가 들어올 때까지 보류.

---

## 1. 다음 트랙 후보 (3개)

기준: progress.md "다음 추천 작업" + 최근 회귀 위험 + 사용자 임팩트.

### 트랙 A — 탭 전환 초기 로딩 지연 최적화 (UX 폴리싱)

**문제**: Overview는 즉시 그려지지만 Progress / Mastery / AI Comparison / Champions 탭 첫 진입 시 200ms 스켈레톤 + 본격 렌더가 합쳐져 첫 탭 전환에 0.5~0.8s 지연 체감. iter.6에서 깐 `data-rendered-once` 캐시는 작동하나 "처음 그 탭으로 가는 순간"의 비용은 여전.

**해결 방향**:

- 옵션 A1 — 탭 prefetch 렌더: 사용자가 Overview에 머무는 동안 idle 시점에 Progress·Mastery 탭의 DOM을 미리 그리되 `display:none`으로 숨김. 첫 탭 클릭은 단순 visibility toggle.
- 옵션 A2 — 데이터 셰이핑 사전 계산: 무거운 집계(visionScore/min, KDA delta, mastery 정렬)를 sample load 직후 1회 계산해 `state.precomputed.*`에 캐시.

**대상**: [main.js](main.js) `switchTab` / `renderProgressTab` / `renderMasteryTab` / `state` 캐시.
**노력**: 옵션 A2가 더 적음(~1.5h). A1은 DOM 비용까지 절약하지만 마크업 영향 큼(~3h).
**권장**: **A2 먼저** → 측정 후 필요시 A1.

**수용 기준**:

- Overview→Progress 전환 시 사용자 인지 지연 < 100ms
- 셀렉터 회귀 없음 (`[data-view]` / `[data-result]` / `[data-score-category]` 보존)
- 회귀 axe 0 violations

### 트랙 B — Riot 개발 키 만료 UX 개선

**문제**: Riot 개발 키 24h 유효. 만료 시 현재는 `/api/recent-matches` / `/api/generate-sample` 응답이 401/403 + 모호한 에러 메시지로 사용자 멈춤. progress.md "현재 남은 블로커"로 명시됨.

**해결 방향**:

- 서버: 401/403 응답을 `{ error: "RIOT_KEY_EXPIRED", hint: "...", devOnly: true }` 구조로 normalize
- 프런트: 해당 코드 감지 시 토스트가 아니라 sticky 배너로 "Riot 개발 키가 만료된 것 같습니다. `.env` 갱신 후 서버 재시작" + Riot Developer Portal 링크 표시
- 캐시된 샘플(저장된 분석)은 여전히 열람 가능함을 안내

**대상**: [server.js](server.js) `/api/recent-matches` & `/api/generate-sample` 에러 핸들링, [main.js](main.js) `fetchRecentMatches` / `generateSample` catch 처리, [styles.css](styles.css) 신규 `.riot-key-banner` 컴포넌트(`--tint-rose` 재사용).
**노력**: ~1h.
**권장**: **B 단독으로 빠르게 처리** — 라이브 데모/스크린레코딩 직전 항상 아쉬웠던 부분.

**수용 기준**:

- 키 만료 상태에서도 페이지가 멈추지 않고 안내 배너만 노출
- 저장된 샘플 전환 / 챔피언 탭 모두 정상 작동
- 키 갱신 후 배너 자동 dismiss

### 트랙 C — AI 프롬프트 스키마 준수율 개선

**문제**: server.js의 응답 정규화 레이어(matchSummary string→객체, phaseSummaries object→array 등)가 비대해진 이유 = AI(특히 Codex)의 스키마 일탈이 빈번. 서버측 보정이 깨지면 프런트가 빈 카드를 그림.

**해결 방향**:

- 단계 1: 스키마 위반 패턴 5개를 sample-kr-8190642410 / 8190721866의 raw 응답에서 grep해 빈도 카운트
- 단계 2: 시스템 프롬프트에 명시적 "출력은 정확히 이 JSON 키만, 누락/이름변경/중첩 금지" 한 줄 + few-shot 1개 추가
- 단계 3: `validateAnalysisOutput`에 위반 카운터를 붙여 manifest에 `analysisMeta.schemaViolations: N` 기록 → 후속 회귀 추적

**대상**: server.js `buildLlmPayload` / `callClaudeAgent` / `callCodexAgent` / `validateAnalysisOutput`, [llm-prompt-input-format.md](llm-prompt-input-format.md) 갱신.
**노력**: ~2h(grep + 프롬프트 1회 수정 + 측정).
**권장**: **신규 샘플 2건이 마침 들어와 있어 측정 코호트로 사용 가능**.

**수용 기준**:

- 새 샘플 3건 더 생성 후 위반 0건 또는 정규화 호출 절반 이하
- 기존 정규화 레이어는 안전망으로 유지 (제거하지 않음)

---

## 2. 권장 실행 순서

```text
B (Riot key UX, 1h)        ──→  즉시 사용성 개선, 회귀 위험 최소
A2 (delta 사전 계산, 1.5h) ──→  탭 전환 체감 속도 향상
C (프롬프트 준수율, 2h)    ──→  데이터 품질 + 분석 안정성
```

**총 예상**: 4.5h. 셋 다 독립적이므로 순서 변경 가능.

---

## 3. 명시적 SKIP / DEFER

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| CSS iteration 20 (토큰 추가 정리) | DEFER | §0 결론 — 후보 없음. 신규 컴포넌트 도입 시 재개 |
| Riot RSO OAuth 전환 | DEFER | Riot 프로덕션 승인 필요(외부 의존성), MVP 범위 밖 |
| admin.html / draft-state.js 라인 정리 | SKIP | 현재 주 작업 흐름 아님(progress.md 명시) |
| 본문 폰트 16px 전환(이전 Phase 24 옵션 B) | DEFER | 전 사이트 시각 변화 큼, A/B 검토 후행 |
| 미커밋 신규 샘플 2건(`sample-kr-8190642410/8190721866`) | 처리 필요 | 트랙 C에서 코호트로 활용 후 manifest 검수 + 커밋 |

---

## 4. 다음 액션

이 계획 검토 후 결정:

- **A**: 트랙 B(Riot 키 UX)부터 즉시 실행 → 1h 마무리 후 다음 트랙 검토
- **B**: 트랙 C(AI 프롬프트) 우선 — 신규 샘플 측정 코호트가 신선할 때 처리
- **C**: 트랙 A2(delta 사전 계산) 우선 — UX 임팩트 가장 직접적
- **D**: 세 트랙 순차 자동 실행 (B → A2 → C)
- **E**: 계획 자체 수정 (트랙 추가/제외/우선순위 조정)
