# LoL Replay Coach

리그 오브 레전드 경기 데이터를 Riot API로 수집하고, AI 에이전트(Claude + Codex)가 코칭 관점에서 분석하는 웹 애플리케이션입니다.

## 주요 기능

### Riot ID 로그인 + 최근 경기 리스트
- Riot ID(gameName + tagLine + region) 입력으로 시작
- 최근 10게임 요약을 즉시 표시 (챔피언, 역할, 승패, KDA, CS/분, 시간, 큐타입, 패치)
- "이전 경기 10개 더 보기" 버튼으로 10개 단위 페이지네이션 (API 요청 간 10초 rate-limit)
- localStorage로 계정 기억 — 새로고침 시 자동 로그인
- 랭크 카드: 한글 티어 + 솔로/자유 큐 라벨, Master/GM/Challenger는 디비전 미표시, 솔로 없으면 자유랭크로 fallback, 조회 실패/미랭크 분리

### AI 듀얼 에이전트 분석
- **Claude** (코칭 분석): 장점/약점을 균형 있게 분석, 개선점 중심
- **Codex** (레드팀 비판): 놓치기 쉬운 구조적 문제, 숨겨진 패턴 발견
- 두 에이전트 병렬 실행 후 비교 결과 생성 (동의/불일치 분류)
- 양쪽 실패 시 규칙 기반 분석으로 자동 fallback

### 상세 분석 대시보드
- 경기 헤드라인 + Quick View 스냅샷
- 핵심 지표 (KDA, CS, 골드, 데미지, 시야, 킬관여)
- 플레이타임 스코어 (전투/생존/수입/시야/오브젝트 종합)
- 라인전 지표 (솔로킬, 10분 CS, CS 우위, 터렛 플레이트)
- 초반/중반/후반 페이즈 요약
- 플레이 강점 / 약점
- AI 비교 분석 (동의율 바 + 3열 그리드)
- 다음 경기 체크리스트 + 핵심 장면
- 근거 이벤트 로그
- KDA 변화 타임라인
- 시야 & 와드 분석
- 빌드 오더 타임라인
- 타워 / 오브젝트 타임라인

### 데이터 파이프라인
- Riot API: account-v1 → match-v5 (detail + timeline) → summoner-v4 (level/icon) → league-v4/entries/by-puuid (ranked)
- 정규화: challenges 객체(70+ 필드), 와드/아이템/오브젝트 타임라인 추출
- 분석: AI 에이전트 → 스키마 검증 → 서버측 필드 정규화 → 저장

> **Riot API 변경 대응**: summoner-v4 응답에서 `encryptedSummonerId`가 제거된 이후, 랭크 조회는 `league-v4/entries/by-puuid/{puuid}` 신규 엔드포인트를 사용합니다.

## 화면 흐름

```
[로그인] → Riot ID 입력 → [10게임 요약] → 게임 클릭 → [AI 분석 진행] → [상세 대시보드]
                                ↑                                              │
                                └──────────── ← 10게임 목록으로 ───────────────┘
```

- **이미 저장된 경기**: generate-sample 없이 바로 상세 화면 진입
- **미저장 경기**: 클릭 시 Riot API + AI 분석 후 상세 화면 진입 (2~5분)
- 상세 화면에서 최근 경기 재조회 가능 (실패 시 기존 상세 유지)

## 기술 스택

- **백엔드**: Node.js (vanilla HTTP server, no Express)
- **프론트엔드**: Vanilla JS + CSS (no frameworks)
- **AI**: Claude CLI (`claude --print`) + Codex CLI (`codex exec -`)
- **데이터**: Riot Match-V5 + Timeline API
- **폰트**: Pretendard Variable

## 주요 파일

```text
.
├── index.html          # 대시보드 UI (로그인 + 10게임 + 상세)
├── main.js             # 프론트엔드 상태 머신 + 렌더링
├── styles.css          # 다크 테마 + 반응형 (CSS 변수 기반 토큰 시스템)
├── server.js           # API 서버 + Riot API + AI 에이전트 오케스트레이터
├── .env                # RIOT_API_KEY, PORT (gitignore)
├── .env.example
├── data/
│   └── samples/
│       ├── manifest.json
│       └── sample-kr-XXXXXXXXXX/
│           ├── raw-account.json
│           ├── raw-match.json
│           ├── raw-timeline.json
│           ├── normalized-match.json
│           ├── analysis-result.json
│           ├── comparison-result.json    # AI 비교 결과 (있는 경우)
│           └── sample-*-notes.md
├── design-tokens.md    # 디자인 시스템 토큰 스냅샷 (color / radius / space / font-size)
├── scripts/
│   └── design-audit.js # styles.css 토큰 커버리지 / 하드코딩 literal / breakpoint 감사 CLI
├── .claude/
│   ├── agents/         # design-auditor: styles.css 이터레이티브 개선 전담 에이전트
│   └── commands/       # /design-audit, /design-apply 슬래시 커맨드
└── progress.md         # 프로젝트 진행 상황 기록
```

## 디자인 시스템

[styles.css](styles.css)는 `:root` CSS 변수로 토큰화된 다크 테마입니다.

- **Color**: `--bg`, `--panel`, `--text`, `--accent`, `--mint`/`--rose` 승패 계열, `--surface-1~4` 내부 레이어, `--info*` 정보 블루
- **Radius**: `--radius-sm/md/lg/xl` + `--radius-pill` / `--radius-circle`
- **Space**: `--space-1` ~ `--space-6` (4–22px, gap 통일)
- **Font-size**: `--fs-xs` ~ `--fs-3xl` + `--fs-display` / `--fs-hero` (10단계)
- 상세 표와 미토큰화 예외는 [design-tokens.md](design-tokens.md) 참조

### Claude Code 디자인 자동화

- `node scripts/design-audit.js --scope <scope> --format markdown` — 로컬 감사 CLI. `styles.css`의 color/radius/spacing/font-size/breakpoint 상태를 집계하고, 하드코딩 literal과 미정의 custom property를 잡아줌. `main.js`, `index.html`도 함께 읽어 런타임 CSS 변수 여부를 구분함
- `/design-audit [스코프]` — `design-auditor` 에이전트가 위 감사 결과를 바탕으로 [styles.css](styles.css)를 스코프별(radius/colors/fontsize/gap/breakpoint/all)로 이터레이티브 개선. `index.html` 구조와 `main.js` 속성 셀렉터는 변경하지 않음
- `/design-apply [diff]` — claude.ai Project에서 받은 CSS 제안을 안전하게 반영

## 로컬 실행

### 사전 요구

- Node.js v18+
- (AI 분석 사용 시) `claude` CLI, `codex` CLI 설치 및 로그인

### 1. 환경 변수

```bash
cp .env.example .env
```

`.env`에 Riot 개발 키 입력:

```
RIOT_API_KEY=RGAPI-your-development-key
PORT=8123
```

### 2. 서버 실행

```bash
node server.js
```

브라우저에서 [http://127.0.0.1:8123](http://127.0.0.1:8123) 접속

### 3. 테스트 계정

| gameName | tagLine | region |
|---|---|---|
| 매운맛 비스킷 | KR1 | KR |
| 핑거샷 | KR1 | KR |

## API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/samples` | 저장된 샘플 목록 |
| GET | `/api/samples/:id` | 샘플 번들 (normalized + analysis + comparison) |
| POST | `/api/recent-matches` | Riot ID 기준 최근 경기 요약 (body: `start`, `matchCount` ≤ 20, 응답: `hasMore`) |
| POST | `/api/generate-sample` | 선택한 경기 AI 분석 + 샘플 생성 |

## AI 에이전트 아키텍처

```
normalized-match.json
  ↓ buildLlmPayload()
payload
  ├→ callClaudeAgent()   [claude --print]      → 코칭 분석
  └→ callCodexAgent()    [codex exec -]        → 레드팀 비판
       ↓ Promise.allSettled (병렬)
  buildComparison()
       ↓
  analysis-result.json    (primary = Claude)
  comparison-result.json  (동의/불일치 비교)
```

- API 키 불필요 — 두 CLI 모두 자체 세션 인증 사용
- Fallback 체인: Claude → Codex → 규칙 기반 분석

## 보안

- `RIOT_API_KEY`는 서버에서만 사용, 브라우저에 노출하지 않음
- 프론트엔드 Riot API Key 입력 시 서버 키 대신 사용 (선택)
- 입력 검증: gameName/tagLine 길이/형식 제한 (서버 + 클라이언트)
- Rate limiting: recent-matches 10초, generate-sample 60초 (IP 기반)

## 현재 한계

- Riot 개발 키는 24시간 만료 — 재발급 필요
- `.rofl` 리플레이 원본 직접 업로드/파싱 미지원
- AI 분석은 게임당 2~5분 소요
- Riot RSO OAuth는 프로덕션 승인 필요 (현재 Riot ID 입력 방식)

## 안내

이 프로젝트는 팬메이드 분석 프로토타입입니다.
Riot Games의 공식 제품이 아니며 Riot의 승인이나 보증을 받지 않았습니다.
