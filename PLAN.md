# 작업 계획 — Phase 30+

**기준 시점**: 2026-05-04
**상위 컨텍스트**: Phase 25~29 + 라이브 검증 완료. progress.md "다음 추천 작업" 1·2·3·4번 처리, 5번(RSO OAuth)은 외부 의존 DEFER 유지. 본 문서는 stable-state 회고 + 잔여 하나의 open issue + 후속 후보 목록.

---

## 0. Phase 25~29 누적 회고

| Phase | 트랙 | 결과 | 주요 변경 |
| --- | --- | --- | --- |
| 25 | B/A2/C | DONE | Riot 키 만료 UX + 탭 전환 가속 + AI 스키마 측정 도입 |
| 26 | G/H/N | DONE | validateAnalysisOutput 회귀 테스트 + schemaViolations UI pill + 문서 정합성 |
| 27 | Q/R | DONE | npm test runner + buildLlmPayload 회귀 |
| 28 | S/T | DONE | utils 함수 테스트 (delta NaN 버그 수정) + aggregateRecentStats 회귀 |
| 29 | U/V | DONE | CHANGELOG 백필 + riotErrorPayload 회귀 |

**테스트**: `npm test` → 122 passed / 0 failed across 6 test file(s)

---

## 1. 라이브 검증 결과 (2026-05-04)

### Track D — Phase 25 Track C 효과 측정 (PASS N=3)

| sampleId | 매치 형태 | sourceType | violations |
| --- | --- | --- | --- |
| 8193501785 | Thresh SUP WIN, 28:39, 0/6/22 | claude_ai | 0 |
| 8193453153 | Ezreal SUP WIN, 34:39, 6/4/9 | claude_ai | 0 |
| 8194679229 | Rell SUP LOSS, 39:55, 2/16/24 | claude_ai | 0 |

3/3 = 0 위반. Phase 26 수용 기준 ("위반 0건 또는 정규화 호출 절반 이하") 명확히 초과 달성. Claude는 OUTPUT_SCHEMA_EXAMPLE 추가 이후 일관되게 스키마 준수 출력 생성. 서버측 정규화 안전망은 미발화 — 다른 모델 / 프롬프트 변경 시 안전판으로 유지.

### Track E — Riot 키 만료 UX (정적 검증 + 라이브 happy-path 200 확인)

라이브 환경 Riot 키가 유효해 401/403 트리거는 불가했으나:

- happy-path: `/api/recent-matches` HTTP 200 정상
- 정적 검증: Track V 25 케이스로 `riotErrorPayload`의 401/403/429/500/null 분기 모두 PASS
- 프런트 wiring: 5개 catch 사이트에 `maybeHandleRiotKeyError(error)` 호출 확인 (커밋 `aa2deca`)

만료 시점에 한 번 라이브 트리거되면 시각 검증 가능. 현 시점은 코드 무결성만 검증.

### 부수 발견 — AUGMENTED_PATH win32 호환 (FIXED `d7d9f13`)

라이브 검증 도중 발견:

- 기존: `process.env.PATH` + `:` (unix separator) + `/opt/homebrew/bin` + `${HOME}/.local/bin` 하드코딩
- win32 영향: PATH 마지막 항목이 깨지고 codex/claude CLI 발견 실패 가능
- 수정: `path.delimiter` 사용 + `USERPROFILE\\.local\\bin` + `USERPROFILE\\.codex\\.sandbox-bin` + `EXTRA_CLI_PATH` env 후크

---

## 2. 알려진 open issue

### Codex CLI win32 실행 실패 (KNOWN)

라이브 검증에서 3/3 케이스 모두 `[AI] Codex failed: codex exited 1` 로그 발생. 원인 추정:

- PATH 아님 — `d7d9f13` 수정 후에도 동일 실패. 즉, 발견은 됐지만 실행 자체가 즉시 1로 종료
- 가능성: codex CLI 인증/세션 상태 부재, win32 sandbox 모드 비호환, `-s read-only` 플래그 미지원, stdin EOF 후 즉시 종료

영향:

- AI Comparison(claude vs codex agreementRate) 기능 win32에서 작동 불가
- Track C 검증은 Claude 단독 cohort로 완료 — 측정 의의는 유지
- 사용자 경험 저하 없음 (서버측 fallback이 정상 작동, primary=claude_ai로 분석 성공)

다음 액션 후보:

- A. 진단 페이즈 (Phase 30): 단독 codex CLI 실행 + stderr 캡처 + 인증 상태 확인
- B. 에이전트 분리: Windows 환경에서 Codex 비활성화 옵션 (`AGENT_DISABLE_CODEX=1` env) 추가 → 깨끗한 fallback
- C. DEFER: macOS 환경에서는 작동하므로 우선순위 낮음 (Track C 측정 유지)

권장: **B** — 30분 작업, win32 사용자 경험 정리 + 측정 데이터 노이즈 제거

---

## 3. 후속 후보 백로그

### 우선순위 P2 (요청 시 실행)

- **Phase 30 — Codex win32 cleanup**: 위 권장안 B 실행 (env hook + 서버 로그에서 missing CLI 명시 노출)
- **Phase 31 — `summarizeMatch` 회귀 테스트**: server.js의 raw-match → summary 추출 함수. Riot 응답 형태 변화 회귀 차단
- **Phase 32 — `buildKeyMoments` / `buildActionChecklist` 테스트**: 현재 fallback 안전망의 출력 품질을 fixture로 고정

### 우선순위 P3 (검토 후 결정)

- **N개 매치 누적 추세**: 현재는 sample 1건당 분석. 시즌별/패치별 비교 뷰
- **Codex 대체 에이전트 검토**: GPT-4o-mini 등 다른 레드팀 에이전트로 교체 가능성
- **Riot RSO OAuth**: progress.md 5번 — 프로덕션 승인 필요, 별도 트리거 시

### 우선순위 P4 (DEFER)

- CSS iteration 20+ — 후보 없음
- 본문 폰트 16px — 전 사이트 시각 변화
- admin.html 리팩토링 — 주 작업 흐름 아님
- schemaVersion v2 — v1 안정화 우선

---

## 4. 다음 액션

라이브 검증을 통해 PLAN Phase 26의 Track D/E 모두 처리됨. 현 시점 자동 진행 가능한 후보:

- **A**: Phase 30 (Codex win32 cleanup) — env hook 추가 + 로그 정돈, 30분
- **B**: Phase 31 (summarizeMatch 테스트) — 함수 추출 + fixture, 1h
- **C**: 두 트랙 묶음 — 1.5h
- **D**: 현재 stable — 외부 트리거 대기 (새 feature, 새 회귀, RSO 승인 등)

권장: **D** — 항목별 ROI가 떨어지는 시점. 새로운 사용자 시나리오/요구가 생길 때까지 stable로 둠.
