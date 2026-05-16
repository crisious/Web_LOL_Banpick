# 작업 계획 — Phase 31+

**기준 시점**: 2026-05-04
**상위 컨텍스트**: Phase 25~30 + 라이브 검증 완료. progress.md "다음 추천 작업" 1·2·3·4번 처리, 5번(RSO OAuth)은 외부 의존 DEFER 유지. 본 문서는 stable-state 회고 + 후속 후보 목록.

---

## 0. Phase 25~30 누적 회고

| Phase | 트랙 | 결과 | 주요 변경 |
| --- | --- | --- | --- |
| 25 | B/A2/C | DONE | Riot 키 만료 UX + 탭 전환 가속 + AI 스키마 측정 도입 |
| 26 | G/H/N | DONE | validateAnalysisOutput 회귀 테스트 + schemaViolations UI pill + 문서 정합성 |
| 27 | Q/R | DONE | npm test runner + buildLlmPayload 회귀 |
| 28 | S/T | DONE | utils 함수 테스트 (delta NaN 버그 수정) + aggregateRecentStats 회귀 |
| 29 | U/V | DONE | CHANGELOG 백필 + riotErrorPayload 회귀 |
| 30 | (codex) | DONE | AGENT_DISABLE_CODEX env hook + runCli 에러 stdout tail + 진단 |
| 31 | data | DONE | 측정 코호트 4→7 확장 (Pantheon LOSS + Seraphine WIN×2, 3:27 엣지 포함, 0 violations) |
| 32 | combat | DONE | 전투 KDA 상황별 집중 분석 (`combatEncounters` 사전 계산 + `combatAnalysis` 출력 필드 + UI 카드) |

**테스트**: `npm test` → 147 passed / 0 failed across 6 test file(s) (Phase 32에서 +25)

---

## 1. 라이브 검증 결과 (2026-05-04)

### Track D — Phase 25 Track C 효과 측정 (PASS N=7 누적, 0 violations)

| sampleId | 매치 형태 | sourceType | violations |
| --- | --- | --- | --- |
| 8193501785 | Thresh SUP WIN, 28:39, 0/6/22 | claude_ai | 0 |
| 8193453153 | Ezreal SUP WIN, 34:39, 6/4/9 | claude_ai | 0 |
| 8194679229 | Rell SUP LOSS, 39:55, 2/16/24 | claude_ai | 0 |
| 8192043774 | Milio SUP WIN (Phase 30 1차 검증) | claude_ai | 0 |
| 8204958574 | Pantheon SUP LOSS, 33:39, 6/12/7 | claude_ai | 0 |
| 8205009929 | Seraphine SUP WIN, 0/8/27, vision 114 | claude_ai | 0 |
| 8205002542 | Seraphine SUP WIN, **3:27 초단기/엣지** | claude_ai | 0 |

7/7 = 0 위반. Phase 26 수용 기준 ("위반 0건 또는 정규화 호출 절반 이하") 누적 초과 달성. 8205002542는 surrender/remake 추정 초단기 매치로, 표본 부족 상황에서도 스키마는 정상 출력됨을 확인하는 엣지 케이스. 서버측 정규화 안전망은 7건 전부 미발화 — 다른 모델 / 프롬프트 변경 시 안전판으로 유지.

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

## 2. Codex CLI 이슈 — Phase 30에서 처리됨

**진단 결과** (Phase 30): 환경 문제가 아니라 **설치된 codex CLI 버전이 OpenAI 계정 기본 모델(gpt-5.5)을 거부**. stderr 비어있고 stdout JSONL의 `turn.failed`에 모든 정보가 들어있어 기존 로그가 침묵에 가까웠음.

**처리 (Phase 30 — 커밋 `7b6e3c1` / `5c5febb`)**:

- `AGENT_DISABLE_CODEX=1` env hook 추가 — 켜면 Codex 호출 자체를 건너뜀
- `runCli` 에러가 stderr 비어있으면 stdout tail 포함해 보고 (향후 동일 패턴 진단 향상)
- 라이브 검증: 신규 샘플 1건(Milio SUP WIN, sample-kr-8192043774) 환경 변수 켠 상태에서 정상 생성, schemaViolations=0

**미해결 부분**:

- codex CLI 자체 업그레이드 — 사용자가 OpenAI Codex CLI 새 버전 설치하면 자동 복구. 본 프로젝트에서 처리할 사항 아님.
- macOS 환경에서는 기존대로 작동 가능성 — 검증 안 됨, 신경 쓰지 않음.

---

## 3. 후속 후보 백로그

각 항목은 **트리거**(언제 우선순위가 올라가는가)와 **노력**(예상 시간) 기록.
"즉시 진행 가능"이 아니라 "이런 신호가 보이면 진행"으로 대기.

### Tier A — 회귀 차단 보강 (외부 변화 시 우선)

(노트: 후보 Phase 라벨은 31/32에서 33/34로 재배정 — 31은 데이터 코호트 확장, 32는 combatAnalysis 기능이 차지)

- **Phase 33: `summarizeMatch` 회귀 테스트** (~1h)
  - 트리거: Riot Match-V5 응답 스키마 변경 / 새 challenge 필드 추가 / participant 구조 변경
  - 가치: 서버 단의 raw → summary 추출 깨지면 모든 후속 분석이 손상
- **Phase 34: `buildKeyMoments` / `buildActionChecklist` fixture** (~1h)
  - 트리거: AI 양쪽 실패 케이스가 실제 발생 (서버 콘솔 `rule-based fallback` 로그)
  - 가치: fallback 안전망의 출력 품질을 회귀 차단 — 현재는 fallback 발화 시 결과 불확실
- **Phase 32 후속: `detectCombatEncounters` 보강 후보** (~30m)
  - 트리거: 윈도우(25s) 또는 max(8) 임계값을 조정해야 하는 케이스 발견 — 예: 장기 한타가 두 encounter로 쪼개지거나, 라인전 단계 킬 누적이 cap에 걸려 후반 한타가 누락되는 사례
  - 가치: 현재 임계값은 합리적 디폴트지만, 실제 코호트 통계로 검증되지 않음

### Tier B — 새 사용자 시나리오에서만 의미

- **N개 매치 누적 추세 뷰**
  - 트리거: 사용자가 "최근 패치 들어 KDA가 떨어진다" 같은 시계열 질문을 함
  - 노력: 큼 (~반나절) — 현재 tab-trends는 단일 매치 비교만
- **Codex 대체 에이전트 검토** (GPT-4o-mini, Gemini, 등)
  - 트리거: 사용자가 Codex CLI 업그레이드가 어렵거나 비용 측면에서 다른 모델 선호
  - 노력: 중간 (~3h) — `callCodexAgent` 추상화 + 새 어댑터
- **Riot RSO OAuth**
  - 트리거: Riot Games 프로덕션 승인 (외부 의존)
  - 노력: 큼 — 별도 페이즈

### Tier C — DEFER (의도적 비-진행)

- CSS iteration 20+ — design-tokens.md §10 항목 1~21 모두 완료, 더 정리할 후보 없음
- 본문 폰트 16px 전환 — 전 사이트 영향, A/B 검토 비용 > 이익
- admin.html / draft-state.js 리팩토링 — 현재 메인 작업 흐름이 아님 (progress.md 명시)
- schemaVersion v2 — v1 안정화 우선, 분석 JSON 구조 변경 신호 없음

### 닫힘 (참고용 history)

이전 PLAN 사이클에서 후보였으나 처리 완료:

- Track D — Phase 25 Track C 효과 측정 → 라이브 N=7 누적 모두 0 violations PASS (3:27 초단기 엣지 1건 포함)
- Track E — Riot 키 만료 UX → Track V 25 케이스 + happy-path 200 정적 검증
- Codex win32 진단 + cleanup → Phase 30 (`AGENT_DISABLE_CODEX=1`)
- AUGMENTED_PATH win32 호환 → Phase 30 부수 fix
- progress.md `다음 추천 작업` 1·2·3·4번 → Phase 25에서 모두 처리

---

## 4. 다음 액션

Phase 25~30 + 라이브 Track D/E + Codex 진단 모두 처리됨. 현 시점 자동 진행 가능한 후보:

- **A**: Phase 31 (summarizeMatch 테스트) — 함수 추출 + fixture, 1h
- **B**: Phase 32 (buildKeyMoments / buildActionChecklist fixture) — fallback 품질 고정, 1h
- **C**: 두 트랙 묶음 — 2h
- **D**: 현재 stable — 외부 트리거 대기

권장: **D** — 핵심 검증 다 끝났고 ROI 곡선이 평평해졌음. 새 feature 요청 / 회귀 발견 시 재개.
