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
| 32-live | qa | DONE | 라이브 검증 — KR_8215889762 (Seraphine SUP LOSS) generate-sample에서 combatAnalysis 5건 정상 생성, schemaViolations=0 |

**테스트**: `npm test` → 147 passed / 0 failed across 6 test file(s) (Phase 32에서 +25)

---

## 1. 라이브 검증 결과 (2026-05-04)

### Track D — Phase 25 Track C 효과 측정 (PASS N=8 누적, 0 violations)

| sampleId | 매치 형태 | sourceType | violations | combatAnalysis |
| --- | --- | --- | --- | --- |
| 8193501785 | Thresh SUP WIN, 28:39, 0/6/22 | claude_ai | 0 | n/a (Phase 32 이전) |
| 8193453153 | Ezreal SUP WIN, 34:39, 6/4/9 | claude_ai | 0 | n/a |
| 8194679229 | Rell SUP LOSS, 39:55, 2/16/24 | claude_ai | 0 | n/a |
| 8192043774 | Milio SUP WIN (Phase 30 1차 검증) | claude_ai | 0 | n/a |
| 8204958574 | Pantheon SUP LOSS, 33:39, 6/12/7 | claude_ai | 0 | n/a |
| 8205009929 | Seraphine SUP WIN, 0/8/27, vision 114 | claude_ai | 0 | n/a |
| 8205002542 | Seraphine SUP WIN, **3:27 초단기/엣지** | claude_ai | 0 | n/a |
| 8215889762 | Seraphine SUP LOSS, 5데스, vision 66 (**Phase 32 라이브**) | claude_ai | 0 | **5건 채움** |

8/8 = 0 위반. Phase 32 라이브 검증(2026-05-16)에서 신규 `combatAnalysis` 필드가
encounter 5건 모두 정상 생성됨을 실측 확인. 각 항목 encounterId/situationLabel/
playerDecision/takeaway/relatedEventIds 정확. 8205002542는 surrender/remake 추정
초단기 매치 엣지 케이스. 서버측 정규화 안전망은 8건 전부 미발화 — 다른 모델 /
프롬프트 변경 시 안전판으로 유지.

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

- **Phase 33: `summarizeMatch` 회귀 테스트 — DONE (2026-08-01)**
  - `summarizeMatch` + 직접 의존 helper(`durationLabel`/`normalizeRole`/`queueLabel`)를 `lib/match-summary.js`로 동작 불변 추출하고, 실제 Match-V5 fixture(`test-artifacts/fixtures/match-v5-summary-fixture.mjs`) 기반 직접-import 회귀 테스트를 추가했다.
  - 기존 `fetch-resilience-tests.mjs`는 `new Function`으로 소스를 재구성하면서 **`normalizeRole`을 항상 `"SUPPORT"`로 반환하는 가짜와 함께** 검증하고 있었다 — role 정규화가 어떻게 깨져도 통과하는 상태였다. 실제 모듈 import로 전환해 이 사각지대를 닫았다.
  - `challenges`는 현 계약에서 미사용이므로, 블록 누락/부분 누락이 동일 summary를 유지하도록 고정했다.
- **Phase 34: `buildKeyMoments` / `buildActionChecklist` fixture — DONE (2026-08-01)**
  - 두 fallback 빌더를 `lib/rule-based-fallback.js`로 동작 불변 추출하고, 정상/단시간/빈 timeline 및 다중/빈/비배열 weaknesses fixture로 상한·필수 필드·정렬 계약을 고정했다 (계약 테스트 9건).
  - 착시 제거가 핵심이었다: `match-summary-missing-tracking` / `strengths-count-tracking` / `phase-summaries-missing-tracking` 세 파일이 **같은 이름의 로컬 stub 함수**를 정의하고 있어, 테스트가 있는 것처럼 보였지만 실제 빌더는 한 줄도 검증되지 않았다. 세 파일 모두 실제 모듈 주입으로 교체했다.
- **Phase 32 후속: `detectCombatEncounters` 임계값 실측 — DONE (2026-08-01, 27경기)**
  - 재실행: `node scripts/measure-combat-encounters.mjs --window-ms=25000 --max-encounters=8`. 매치당 uncapped encounter 분포는 `1:1, 2:1, 4:2, 5:1, 6:4, 7:1, 8:4, 10:3, 11:2, 12:1, 14:1, 15:1, 16:1, 17:2, 18:1, 21:1`(encounter 수:매치 수), 중앙값 8 / p90 17 / 최대 21.
  - **윈도우 25초 유지**: encounter 간 234개 간격 중 25~30초 경계 쌍은 2개(0.85%, 각 26.138s/26.148s)뿐이다. 30초로 넓혀도 두 쌍만 합쳐지고 cap에 잘린 매치는 13개로 동일해, 장기 한타 분할의 코호트 근거가 부족하다.
  - **max 8 → 24 조정**: 8 이상인 매치 17개 중 실제 truncation은 13개(48.1%), 총 78개가 잘렸고 MID 42 / LATE 36이었다. 13개 중 12개에서 후반 encounter가 누락됐으며, KR_8255072093의 35:13~35:32와 37:31~37:53 두 건은 `eventCount>=3`인 후반 한타 후보였다. 24는 관측 최대 21을 모두 보존하면서 hard bound를 남기며, 변경 후 이 코호트 truncation은 0개다.
  - 한계: 27경기는 max 8을 기각하기에는 충분히 강한 신호지만 장기적인 상한 분위수를 확정하기에는 작다. 따라서 24를 영구 최적값으로 간주하지 않고, 코호트가 늘면 같은 스크립트로 재측정한다.

### Tier B — 새 사용자 시나리오에서만 의미

- **N개 매치 누적 추세 뷰**
  - 트리거: 사용자가 "최근 패치 들어 KDA가 떨어진다" 같은 시계열 질문을 함
  - 노력: 큼 (~반나절) — 현재 tab-trends는 단일 매치 비교만
- **Codex 대체 에이전트 검토** (GPT-4o-mini, Gemini, 등)
  - 트리거: 사용자가 Codex CLI 업그레이드가 어렵거나 비용 측면에서 다른 모델 선호
  - 노력: 중간 (~3h) — 어댑터 추출은 2026-08-01에 끝났으므로(`lib/agent-adapter.js`) 남은 일은 새 구현체 하나 추가뿐
  - 상태: **미구현 유지.** `AGENT_BACKEND=api`는 Claude만 담당하고 Codex 레그는 비활성이므로, api 모드는 이중 교차검증 없이 단일 에이전트로 돈다
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

**분석 엔진 어댑터화 + API 백엔드 완료 (2026-08-01~02, 브랜치 `crisious/agent-adapter-api`).** `docs/superpowers/plans/2026-08-01-agent-adapter-external-deploy.md` Task 1~5 실행. `npm test` **3401 → 3440 passed / 0 failed / 158 → 162 files**.

가능해진 것:

- **`AGENT_BACKEND=api`로 CLI 없는 호스트에서 라이브 분석 가능.** Node ≥ 20이면 되고 루트 의존성은 여전히 0 (`lib/anthropic-client.js`가 내장 `fetch`로 Messages API 직접 호출). 미설정/오타는 `cli`로 폴백해 기존 동작이 그대로 보존된다 — 실측: `AGENT_BACKEND` 미설정 시 `claude` CLI를 실제로 spawn, `api`면 Messages API 경로, `sdk` 같은 오타면 CLI 복귀.
- 구조화 출력(`output_config.format` + `lib/analysis-json-schema.js`)으로 스키마 강제. 배열 최소 길이는 구조화 출력이 지원하지 않으므로 `validateAnalysisOutput`이 계속 담당한다.

남은 것 / 한계:

- **Codex 대체 어댑터는 미구현** (Tier B 유지). `AGENT_BACKEND=api`에서 Codex 레그는 비활성이라 api 모드는 단일 에이전트다.
- **`schemaViolations` 실측 미완.** 구조화 출력 전/후 비교는 실제 API 키로 동일 샘플을 돌려야 하는데 이번 사이클에서 수행하지 못했다. 근거 없이 효과를 주장하지 않는다 — 기준선부터 다시 잡아야 한다.
- Riot RSO OAuth는 여전히 Tier C DEFER (외부 의존).

이번 사이클에서 드러난 함정 2건:

- **`additionalProperties: false`는 나열하지 않은 필드를 금지한다.** 스키마를 명세(`analysis-json-schema.md` §3)만 보고 짰으면 프롬프트가 요구하는 `teamplayRecommendationSelections`가 막혀 teamplay v2 코칭 선택 경로가 통째로 죽었다. 스키마 `properties`는 명세가 아니라 **프롬프트가 실제로 요구하는 것 + 실데이터에 나타나는 것**의 상위집합이어야 한다. 저장된 분석 36건을 스키마에 대고 훑는 테스트로 고정했다.
- **명세와 실데이터가 여러 곳에서 다르다.** `actionChecklist`는 `action`/`reason`이 아니라 `text`/`linkedWeaknessId`를 쓰고 `priority`가 number가 아니라 string이다. `evidenceIndex`는 `timestamp`/`summary`가 아니라 `timestampLabel`/`shortNote`다. `phaseSummaries`의 `rating`/`focus`는 36건 중 0회다. 전부 실데이터를 따랐다.

**Tier A 3종 전부 완료 (2026-08-01, Orca orchestration 병렬 3워커).** Phase 33 / Phase 34 / Phase 32-후속을 각각 독립 워크트리에서 진행한 뒤 순차 머지했다. `npm test` **3388 → 3401 passed / 0 failed / 156 → 158 files**, `server.js` 4,539 → 4,285줄(−254, 로직 3개 모듈로 이동).

이 사이클에서 걷어낸 공통 취약점: **소스 문자열을 `new Function`/`includes()`로 재구성·검사하는 테스트**는 코드가 이동하면 깨지고 배선 버그는 못 잡는다. 신규·전환 테스트는 모두 실제 모듈 import 방식이다.

현 시점 자동 진행 가능한 후보:

- **A**: `AGENT_BACKEND=api` 라이브 검증 + `schemaViolations` 전후 실측 (~1h, 실제 API 키 필요)
- **B**: Tier B — N개 매치 누적 추세 뷰 (~반나절). 현재 tab-trends는 단일 매치 비교만 가능
- **C**: Tier B — Codex 대체 에이전트 어댑터 (새 구현체 추가, ~1h로 축소)
- **D**: 현재 stable — 외부 트리거 대기

권장: **A** — api 백엔드는 코드·테스트상 완결이지만 실제 API를 한 번도 치지 않았다. 구조화 출력의 효과 주장은 실측 전까지 근거가 없고, 라이브 1회가 그 둘을 동시에 해소한다.
