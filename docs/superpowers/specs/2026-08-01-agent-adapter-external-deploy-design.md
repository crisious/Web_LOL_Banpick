# 분석 엔진 어댑터화 + 초대 기반 외부 배포 설계

- 상태: 사용자 명세 승인 완료
- 작성일: 2026-08-01
- 요청: "LOL 계정 입력해서 해당 유저 솔랭 게임 리플레이를 분석하도록 기능 작업하고 외부 사이트로 배포"
- 결정 사항: 의존성 0 유지 (`node:https`), 초대 기반 `protected` 모드, 상시 접속 필요

## 배경

요청받은 기능 중 **계정 입력 → 솔랭 리플레이 분석은 이미 로컬에서 동작한다.**

| 기능 | 위치 |
|---|---|
| Riot ID(게임명 + 태그 + 지역) 입력 UI | `index.html` |
| 사용자 Riot API 키 입력 | `main.js:247-257` `getUserApiKey()` |
| 솔랭 필터 | `server.js:3195` `getCurrentSeasonRankedMatchIds(… queue=queueId …)`, `RANKED_SOLO_5x5` |
| 리플레이 수집 → AI 코칭 분석 | `server.js` 전반 |
| 정적 파일 allowlist 하드닝 | `server.js:4184` |
| 공개 데모 모드 3종 | `full` / `readonly` / `protected` |
| Cloudflare 어댑터 + 빌드 | `sites/` (vite + worker) |

따라서 이 설계의 대상은 "기능 신규 개발"이 아니라 **외부 배포를 막고 있는 두 개의 구조적 블로커 제거**다.

### 블로커 1 — 배포 대상이 해당 엔드포인트를 차단한다

`sites/worker/index.js`가 명시적으로 막는 경로:

```js
"/api/demo-auth", "/api/recent-matches", "/api/champion-history", "/api/generate-sample"
// "외부 데모 모드에서는 라이브 Riot API/샘플 생성 기능이 비활성화되어 있습니다."
```

### 블로커 2 — 분석 엔진이 로컬 CLI subprocess다

`server.js:7`의 `spawn`으로 `claude` / `codex` 바이너리를 실행한다(`AUGMENTED_PATH`로 PATH 보강). **Cloudflare Worker에는 프로세스도 CLI도 없다.** 차단을 푸는 것으로 해결되지 않으며, 배포 환경에서 분석을 돌릴 방법 자체가 없다.

블로커 2가 근본 원인이다. 이것을 제거하면 블로커 1은 배포 대상 선택 문제로 축소된다.

## 목표

1. 분석 엔진을 CLI subprocess에 묶이지 않도록 어댑터 뒤로 분리한다.
2. Anthropic Messages API를 직접 호출하는 구현체를 추가한다. **루트 의존성 0을 유지한다.**
3. 초대 기반 `protected` 모드로 상시 접속 가능한 외부 배포를 가능하게 한다.
4. 기존 동작(`AGENT_BACKEND=cli`)을 기본값으로 보존한다.

## 비목표

- **Riot RSO OAuth** — Riot Games 프로덕션 승인이 필요한 외부 의존 (`PLAN.md` Tier C, DEFER 유지)
- **Cloudflare Worker에서의 라이브 분석** — `server.js`가 `node:http`/`fs` 기반이라 별도 재작성이 필요하다
- **Codex 대체 어댑터 구현** — 인터페이스는 열어두되 구현은 별도 (`PLAN.md` Tier B)
- **구체적 호스팅 업체 선정** — 사용자 인프라 결정
- **`sites/` 어댑터 변경** — read-only 데모로 계속 유효하다

## 제약 (확인된 사실)

- **루트 의존성 0**: `package.json`의 `dependencies`/`devDependencies` 모두 `null`, `node_modules` 0개. `engines.node >= 20`. (`sites/`만 devDependency 3개.) 이 원칙을 깨지 않는다.
- **교체 표면이 좁다**: CLI 호출 지점은 `server.js:2395`(claude)와 `:2446`(codex) 두 곳, 헬퍼는 `runCli`(`:2281`) 하나.
- **회귀 기준선**: `npm test` → 3401 passed / 0 failed / 158 test files.
- **사용 규모**: 본인 + 지인 5명 이하, 동시 분석 거의 없음. 큐·오토스케일 불필요(YAGNI).
- **상시 접속 필요**: 사용자 맥의 가동 여부와 무관해야 한다. 터널 방식은 탈락.

## 아키텍처

단일 인터페이스로 좁힌다.

```
analyzeWithAgent({ prompt, timeoutMs, signal }) → { text, meta }
```

`signal`은 기존 `runCli`의 타임아웃 경로와 동일한 취소 의미를 갖는다 — CLI 구현체에서는 `proc.kill()`, API 구현체에서는 스트림 abort로 매핑된다.

구현체 두 개가 이 인터페이스를 만족하고, `AGENT_BACKEND=cli|api`로 선택한다. 기본값은 `cli`로 두어 **기존 로컬 개발 흐름을 그대로 보존**한다.

### `AGENT_BACKEND=api`에서 Codex 레그는 비활성이다

현재 구조는 Claude와 Codex를 **병렬로 실행하고 전체 소요 = max(둘)** 이다. Codex는 OpenAI CLI이며 Anthropic Messages API에 대응물이 없다. 따라서:

| `AGENT_BACKEND` | Claude 레그 | Codex 레그 |
|---|---|---|
| `cli` (기본) | `claude` CLI | `codex` CLI — 현행 유지 |
| `api` | Messages API | **비활성** |

`server.js:2831-2837`에 이미 `AGENT_DISABLE_CODEX=1` → "Claude only" 경로가 있으므로 이를 재사용한다. 새 분기를 만들지 않는다.

**결과적으로 배포 환경은 단일 에이전트로 동작한다.** 이는 의도된 축소이며, 이중 에이전트의 교차 검증 효과가 사라진다는 뜻이다. Codex 대체 어댑터(`PLAN.md` Tier B)가 구현되면 복원 가능하다.

### 컴포넌트

| 파일 | 책임 |
|---|---|
| `lib/agent-adapter.js` | 인터페이스 정의 + `AGENT_BACKEND` 기반 구현체 선택. `server.js`가 아는 유일한 진입점 |
| `lib/agent-cli.js` | 기존 `runCli` + PATH 보강 + claude/codex argv 이동. **동작 불변** |
| `lib/agent-api.js` | Messages API 호출. 프롬프트 → 요청 조립, 응답 → 텍스트 |
| `lib/anthropic-client.js` | 최소 HTTP 계층 — 요청, SSE 누적, 재시도, 타임아웃. `agent-api.js`가 유일한 소비자 |

`server.js`는 `require("./lib/agent-adapter")` 한 줄이 늘고 CLI 관련 약 120줄이 빠진다. `AGENT_DISABLE_CODEX`·`EXTRA_CLI_PATH` 등 기존 탈출구는 `agent-cli.js` 안에 그대로 남는다.

## 데이터 흐름

```
POST /api/generate-sample
  → buildLlmPayload (기존)
  → analyzeWithAgent × 2 병렬 (기존 병렬 구조 유지)
      ├─ cli:  spawn(claude|codex) → stdout JSON
      └─ api:  POST /v1/messages (stream) → 누적 → text
  → validateAnalysisOutput (기존, server.js:2663)
  → analysisMeta.schemaViolations 기록 (기존)
```

### API 구현체 요청 형태

- **모델**: `claude-opus-5` (1M 컨텍스트, 128K 출력, $5/$25 per MTok)
- **스트리밍 필수**: 분석은 100초를 넘고 `max_tokens`가 크다. 비스트리밍은 HTTP 타임아웃에 걸린다.
- **`output_config: { effort: "high" }`**: 기본값. 비용이 문제되면 `medium`부터 스윕한다.
- **`max_tokens`는 thinking + 응답을 합쳐 제한한다.** Opus 5는 thinking이 기본 on이므로 여유를 둔다(64K에서 시작).
- **`thinking.display`는 기본 `omitted`로 둔다** — 분석 결과 텍스트만 사용한다.
- 인증은 `ANTHROPIC_API_KEY` 환경변수. CLI 경로의 PATH 보강과는 무관하다.

## 에러 처리

`runCli`가 이미 가진 수준(타임아웃 300초, `settled` 이중 reject 방지, stdout tail 진단)을 API 쪽에서도 맞춘다.

| 상황 | 처리 |
|---|---|
| 429 | `retry-after` 헤더 존중 + 지수 백오프, 최대 2회 |
| 5xx / 529 | 지수 백오프 재시도 |
| 400 / 401 | 즉시 실패. 재시도 무의미. 키 누락은 기동 시 진단한다 |
| 타임아웃 | 스트림 abort. 기존과 동일한 에러 형태를 유지 |
| **`stop_reason: "refusal"`** | `content`를 읽기 **전에** 분기한다. Opus 5는 안전 분류기가 요청을 거절할 수 있고, 게임 데이터라 드물지만 `content[0]`을 무조건 읽는 코드는 깨진다 |
| `stop_reason: "max_tokens"` | 잘린 출력. 기존 rule-based fallback 경로로 넘긴다 |

**기존 fallback을 그대로 살린다** — AI 양쪽 실패 시 `buildKeyMoments` / `buildActionChecklist` 경로. Phase 34(2026-08-01)에서 `lib/rule-based-fallback.js`로 추출하고 계약을 고정해 둔 코드다.

## 구조화 출력 — 적용 범위와 한계

`output_config.format`에 `analysis-json-schema.md` 기반 json_schema를 넣는다. 스키마는 최상위 13필드(객체 3 + 배열 10), 리프 약 75개, **재귀 없음**이므로 구조화 출력 제약 안에 들어간다.

**`validateAnalysisOutput`은 제거하지 않는다.** 구조화 출력은 배열 최소 길이(`minItems`)와 수치 제약을 지원하지 않기 때문이다.

| 현재 검증이 잡는 것 | 구조화 출력으로 막히는가 |
|---|---|
| 필드 누락 (`schemaVersion`, `analysisMeta`, `matchSummary.headline` 등) | **막힌다** |
| 타입 오류 | **막힌다** |
| `phaseSummaries < PHASE_SUMMARIES_MIN` | **막히지 않는다** (`minItems` 미지원) |
| `strengths` / `weaknesses` / `actionChecklist` / `keyMoments` 내용 유효성 | 막히지 않는다 |

따라서 구조화 출력은 **위반의 한 종류만** 제거한다. `validateAnalysisOutput`과 `schemaViolations` 측정을 모두 유지하고, **도입 전후 `schemaViolations` 분포를 실측해 효과를 기록한다.** 근거 없이 "스키마 준수율이 개선됐다"고 주장하지 않는다.

## 테스트

회귀 기준선은 3401 passed / 0 failed / 158 test files다.

- `agent-cli.js` 이동은 **동작 불변 리팩터**이므로 기존 테스트가 그대로 통과해야 한다.
- 신규 테스트는 **실제 모듈을 import**하고 HTTP 계층만 대역으로 바꾼다. `new Function`으로 소스를 재구성하는 방식은 쓰지 않는다 — 이 레포의 알려진 함정이며, 배선 버그를 놓친다.
- 커버 대상: SSE 누적, 429 재시도(`retry-after` 존중), 타임아웃, `refusal` 분기, `max_tokens` 절단 시 fallback 진입.
- **실제 API 호출은 테스트에 넣지 않는다** — 비용과 비결정성 때문이다. 라이브 검증은 수동 절차로 남긴다.

## 배포

CLI 의존이 사라지면 `server.js`는 Node가 도는 아무 호스트에서 상시 구동된다.

- `PUBLIC_DEMO_MODE=protected` + `PUBLIC_DEMO_TOKEN` — 초대 기반 접근
- 정적 파일 allowlist는 이미 적용돼 있다 (`server.js:4184`, "allowlist 전용 — 기본 거부")
- `sites/` Cloudflare 어댑터는 변경하지 않는다. read-only 데모로 계속 유효하며, 라이브 분석은 새 호스트가 담당한다
- Riot 키는 서버 환경변수 1개(소유자 개발 키). 24시간 만료 UX는 Track E에서 이미 구현됐다
- `sites/` 번들이 바뀌지 않으므로 **dist 재빌드는 불필요**하다

## 단계 구분

구현 계획은 아래 순서로 나눈다. 각 단계는 독립적으로 착지 가능하며, 앞 단계가 통과해야 다음으로 넘어간다.

| 단계 | 내용 | 성격 |
|---|---|---|
| 1 | `agent-adapter.js` + `agent-cli.js` 추출 (`AGENT_BACKEND=cli`만) | **동작 불변 리팩터.** 기존 3401 테스트가 그대로 통과해야 한다 |
| 2 | `anthropic-client.js` — HTTP·SSE·재시도·타임아웃 | 신규. 실제 모듈 import 테스트로 검증 |
| 3 | `agent-api.js` + `AGENT_BACKEND=api` 배선 | 신규. 여기까지가 배포를 가능하게 하는 최소 범위 |
| 4 | 구조화 출력 도입 + `schemaViolations` 전후 실측 | **분리 가능.** 1~3 없이는 의미 없고, 1~3만으로도 배포는 성립한다 |
| 5 | `protected` 모드 배포 설정 + 라이브 검증 | 코드 변경보다 설정·운영 |

4단계를 3단계와 묶지 않는 이유는, 배포 가능 상태에 먼저 도달한 뒤 스키마 준수율 효과를 **격리해서 측정**하기 위해서다. 둘을 함께 넣으면 변화의 원인을 분리할 수 없다.

## 열린 위험

- **Riot 개발 키 24시간 만료** — 초대 사용자가 만료 시간대에 접속하면 분석이 실패한다. 만료 UX는 있으나 자동 갱신은 없다. 운영 부담으로 남는다.
- **API 비용** — 5명 규모에서는 미미하지만, `effort`와 `max_tokens`를 실측 없이 크게 잡으면 낭비가 된다. 도입 후 실제 토큰 사용량을 측정해 조정한다.
- **개인정보** — 초대 기반이라 공개 노출은 아니지만, 분석 대상이 실제 계정이다. `sites/` 공개 경로의 식별자 제거 원칙은 이 배포에 적용되지 않으며(별도 호스트), 혼동하지 않도록 구분해 둔다.
