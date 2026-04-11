Original prompt pivot: LoL 밴픽 방송 화면 와이어프레임 -> LoL 리플레이/경기 분석 웹 MVP

## 현재 목표

- Riot API 기반 경기 데이터를 불러와 한 경기 요약, 장점/약점, 핵심 장면, 다음 판 체크리스트를 보여주는 웹페이지를 만드는 중.
- MVP 기준으로는 `.rofl` 직접 업로드/파싱이 아니라 Riot Match-V5 + Timeline API를 사용.

## 핵심 의사결정

- `.rofl` 원본 직접 처리는 가능하더라도 비공식/불안정하므로 MVP에서는 채택하지 않음.
- 샘플 수집 파이프라인은 `Riot ID -> PUUID -> Match IDs -> Match detail -> Timeline` 순서로 설계.
- KR 계정 기준 account/match 호출은 `asia.api.riotgames.com`, platform 입력은 `KR`.

## 현재 완료된 문서

- `decision-replay-processing.md`
- `prd-mvp-replay-analysis.md`
- `wireframes-mvp-replay-analysis.md`
- `tickets-mvp-replay-analysis.md`
- `analysis-json-schema.md`
- `plan-riot-api-sample-data.md`
- `sample-match-selection-criteria.md`
- `riot-api-call-spec.md`
- `normalized-match-schema.md`
- `normalization-mapping-rules.md`
- `normalization-implementation-checklist.md`
- `sample-data-ops-runbook.md`
- `llm-prompt-input-format.md`
- `sample-001-execution-plan.md`
- `test-riot-id-input-management.md`
- `sample-001-live-collection-checklist.md`

## 샘플 데이터 상태

- 실제 Riot API 기반 샘플 2건 저장 완료.

### sample-001

- Match ID: `KR_8166489844`
- Champion/Role/Result: `Nasus / MID / LOSS`
- Theme: 초반 라인 불안 + 오브젝트 합류는 꾸준 + 바론 이후 전환/생존 아쉬움

### sample-002

- Match ID: `KR_8166674448`
- Champion/Role/Result: `Dr. Mundo / JUNGLE / WIN`
- Theme: 정글 오브젝트 템포 좋음 + 데스 관리 아쉬움 + 후반 구조물 마무리 보완 필요

### 저장 위치

- `data/samples/sample-001/`
- `data/samples/sample-002/`
- 각 샘플에 `raw-account.json`, `raw-match-ids.json`, `raw-match.json`, `raw-timeline.json`, `normalized-match.json`, `analysis-result.json`, `sample-xxx-notes.md` 저장
- `data/samples/manifest.json`로 샘플 인덱스 관리

## 현재 웹 앱 상태

### 백엔드

- `server.js`를 정적 서버 + 간단한 API 서버로 전환 완료.
- `.env` 자동 로딩 추가.
- `.env.example` 추가.
- `.gitignore` 추가.

### 현재 API

- `GET /api/samples`
- `GET /api/samples/:id`
- `POST /api/recent-matches`
- `POST /api/generate-sample`

### `POST /api/recent-matches`

- Riot ID 기준 최근 경기 후보 조회
- 후보별 `champion / role / result / duration / KDA / sampleFitScore` 반환

### `POST /api/generate-sample`

- 선택한 경기 1건으로 새 샘플 자동 생성
- 원본 응답, 정규화 JSON, 분석 JSON, notes 파일까지 함께 기록
- manifest 자동 갱신

## 현재 프런트엔드 상태

- 기존 밴픽 방송 화면 대신 리플레이 분석 대시보드로 전환 완료.
- 메인 파일:
  - `index.html`
  - `main.js`
  - `styles.css`

### 현재 레이아웃

- 상단: 전적 사이트형 topbar
- 좌측: Player Hub 사이드 레일
- 우측 본문:
  - Headline
  - Quick View
  - 핵심 지표
  - Saved Reports
  - Phase Review
  - Strengths / Weaknesses
  - Next Game Checklist
  - Key Moments
  - Evidence Ledger

### GUI 방향

- OP.GG / U.GG / Mobalytics 류의 정보 구조를 참고해 재배치.
- 최근 경기 후보 카드와 저장 리포트 카드의 문법을 통일.
- 헤드라인은 긴 해설 대신 `챔피언 + 포지션 + 승패 + 핵심 테마` 형태의 짧은 자동 요약으로 압축.
- Queue/Patch 표기 축약 적용:
  - `RANKED_SOLO -> 솔랭`
  - `RANKED_FLEX -> 자랭`
  - `NORMAL_BLIND -> 일반`
  - `ARAM -> 칼바람`
  - `16.7.760.9485 -> 16.7`

### AX 반영

- skip link 추가
- `aside`, `main`, `nav`, `section` 랜드마크 정리
- `aria-labelledby` 정리
- 동적 상태 영역 `aria-live="polite"` 적용
- 샘플 선택 버튼 `aria-pressed` 적용

## 검증 메모

- Homebrew로 Node 설치 완료.
- 현재 환경:
  - `node v25.9.0`
  - `npm 11.12.1`
- `node server.js` 기동 성공
- `GET /api/samples` 정상 응답 확인
- `GET /api/samples/sample-001` 정상 응답 확인
- Headless Chrome로 데스크톱/모바일 스크린샷 캡처 후 레이아웃 확인
- 모바일에서 상단 허브가 너무 길어지는 문제를 한 차례 조정 완료

## 현재 남은 블로커

- 이전에 제공된 Riot 개발 키는 현재 라이브 호출 시 `403 / error code: 1010`.
- 따라서 라이브 `recent-matches` / `generate-sample` 재검증은 새 `RGAPI-...` 키가 필요.

## 현재 파일 상태 메모

- 현재 실제 작업 대상은 리플레이 분석 앱 쪽 파일들.
- 예전 밴픽 와이어프레임 파일(`admin.html`, `admin.js`, `admin.css`, `draft-state.js`)은 워크스페이스에 남아 있지만 현재 주 작업 흐름은 아님.

---

## AI 에이전트 분석 파이프라인 (진행 중)

### 아키텍처 결정

기존 `buildAnalysis()`의 규칙 기반 템플릿 분석을 두 AI CLI 에이전트로 교체.

```
normalized-match.json
  ↓ buildLlmPayload()
payload
  ├→ callClaudeAgent()   [claude --print --output-format json]  → 코칭 분석
  └→ callCodexAgent()    [codex exec - --json --ephemeral]      → 레드팀 비판 분석
       ↓ Promise.allSettled (병렬 실행)
  buildComparison()
       ↓
  analysis-result.json     ← 기존 스키마 유지 (primary = Claude)
  comparison-result.json   ← 신규 (레드팀 비교 결과)
```

### 에이전트 역할 구분

| 에이전트 | CLI | 역할 | sourceType |
|---|---|---|---|
| Claude | `claude --print` | 코칭 분석 (균형, 개선점 중심) | `claude_ai` |
| Codex | `codex exec -` | 레드팀 비판 (놓친 패턴, 구조적 약점) | `codex_redteam` |

### 핵심 구현 사항

- `runCli(args, stdin, timeoutMs)` — 공통 subprocess 헬퍼, `settled` 플래그로 이중 reject 방지
- `buildLlmPayload(normalized)` — importance ≥ 3 이벤트 최대 15개로 필터, rawRef/laneHint 제거
- `buildComparison(claude, codex, sampleId)` — 장점/단점 키워드 교집합으로 agreements/claudeOnly/codexOnly 분류
- `buildRuleBasedAnalysis()` — 기존 규칙 분석 함수로 분리, 양쪽 CLI 실패 시 fallback
- `buildAnalysis()` — async 전환, `__comparison` 임시 필드로 비교 결과 전달

### Codex CLI JSONL 포맷 (실측)

```jsonl
{"type":"thread.started","thread_id":"..."}
{"type":"turn.started"}
{"type":"item.completed","item":{"type":"agent_message","text":"...응답 텍스트..."}}
{"type":"turn.completed","usage":{...}}
```

파싱 키: `evt.type === "item.completed" && evt.item?.type === "agent_message"` → `evt.item.text`

### Codex 모델 참고

- `-m o4-mini` — ChatGPT 계정에서 미지원 (실측 확인)
- 모델 미지정 시 계정 기본 모델 사용 (권장)

### 새로 추가되는 파일

- `data/samples/{id}/comparison-result.json` — 레드팀 비교 결과 저장

### API 키 불필요

- 두 CLI 모두 자체 세션 인증 사용 (ANTHROPIC_API_KEY, OPENAI_API_KEY 불필요)
- `.env.example` 변경 없음

## 다음 추천 작업

1. 새 Riot 개발 키 발급 후 `.env` 반영
2. `/api/generate-sample` 실행해 AI 에이전트 분석 결과 검증
3. `comparison-result.json` UI 뷰 추가 (레드팀 비교 패널)
4. 다중 경기 누적 분석 뷰 추가
