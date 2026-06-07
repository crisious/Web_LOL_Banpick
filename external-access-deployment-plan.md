# External Access Deployment Plan

## Goal

외부 사용자가 HTTPS URL로 LoL Replay Coach를 열어 저장 샘플을 보고, 제한된 범위에서 Riot ID 조회/분석 흐름을 시험할 수 있게 만든다.

1차 목표는 "초대된 테스터가 안전하게 써보는 데모"이고, 2차 목표는 "상시 접속 가능한 클라우드 배포"다.

## Current Constraints

- 서버는 `server.js` 단일 Node HTTP 서버이며 `PORT` 환경변수를 사용한다.
- 저장 샘플은 `data/samples/manifest.json`과 하위 JSON 파일에 직접 기록된다.
- 라이브 분석은 Riot API 키와 `claude` / `codex` CLI 세션에 의존한다.
- `AGENT_DISABLE_CODEX=1`로 Codex CLI 실패 환경을 우회할 수 있다.
- 현재 정적 파일 서버는 저장소 루트 기준으로 파일을 제공하므로, 외부 공개 전 보안 hardening이 반드시 필요하다.

## Non-Negotiable Security Work Before Public Exposure

### 1. Static File Allowlist

현재 상태로 외부에 열면 `.env`, `server.js`, `scripts/`, `test-artifacts/`, raw sample JSON 등이 URL로 노출될 수 있다. `handleStatic`을 allowlist 방식으로 바꾼다.

허용:

- `/`, `/index.html`, `/admin.html`
- `/styles.css`, `/admin.css`
- `/main.js`, `/admin.js`, `/draft-state.js`
- 필요한 공개 이미지/폰트/정적 asset

차단:

- dotfile 전체: `.env`, `.git/**`, `.claude/**`
- 서버/운영 파일: `server.js`, `package.json`, `scripts/**`
- 문서/테스트 산출물: `docs/**`, `test-artifacts/**`, `*.md`
- raw 수집 파일: `raw-account.json`, `raw-match.json`, `raw-timeline.json`

샘플 데이터는 API를 통해서만 제공한다. 필요하면 API 응답에서도 raw payload는 제외한다.

### 2. Public Demo Mode

환경변수로 외부 데모 범위를 제어한다.

```env
PUBLIC_DEMO_MODE=readonly
PUBLIC_DEMO_TOKEN=...
TRUST_PROXY=1
```

모드:

- `readonly`: 저장 샘플과 UI만 공개. `/api/recent-matches`, `/api/generate-sample`, `/api/champion-history`는 403.
- `protected`: 토큰 또는 Cloudflare Access 통과 사용자만 라이브 API 허용.
- `full`: 내부 QA 전용. 외부 공개 기본값으로 사용하지 않는다.

### 3. Request Identity And Rate Limit

현재 rate limiter는 `req.socket.remoteAddress` 기반이다. 터널/프록시 뒤에서는 `X-Forwarded-For` 또는 Cloudflare `CF-Connecting-IP`를 신뢰할지 선택해야 한다.

작업:

- `getClientIp(req)` helper 추가
- `TRUST_PROXY=1`일 때만 proxy header 사용
- read-only가 아닌 API에는 더 긴 window 적용
- generate-sample 동시 실행 lock 또는 queue 추가

### 4. Secret Handling

- `.env`는 절대 정적 서빙 대상이 아니어야 한다.
- 외부 페이지에서 사용자 Riot API 키 입력은 가능하더라도 HTTPS + 접근 제한이 있는 환경에서만 허용한다.
- 서버 로그에 Riot key, Claude/Codex prompt 전문, raw 개인정보성 payload가 찍히지 않게 한다.

## Deployment Options

### Option A — Fast Private Demo: Cloudflare Tunnel + Access

가장 빠른 경로다. 로컬 Mac에서 `node server.js`를 실행하고 Cloudflare Tunnel이 공개 HTTPS hostname을 로컬 `http://localhost:8123`으로 연결한다.

Pros:

- 라우터 포트포워딩 없이 외부 접속 가능
- 로컬 Claude/Codex CLI 세션과 기존 파일 저장 구조를 그대로 사용 가능
- Cloudflare Access로 이메일 allowlist를 걸 수 있음

Cons:

- Mac이 켜져 있어야 한다.
- 로컬 파일 시스템에 샘플이 계속 쌓인다.
- 공개 전 static allowlist와 demo mode가 필수다.

Recommended use:

- 1차 외부 테스트, 3~10명 초대 테스터, 짧은 QA 세션.

### Option B — Stable Cloud Demo: Render / Fly.io / Railway

Node 서비스를 클라우드에 배포한다. `PORT`를 플랫폼이 주는 값으로 사용하고, host는 명시적으로 `0.0.0.0` 바인딩을 지원한다.

Required changes:

- `HOST=0.0.0.0` 지원
- read-only 또는 protected demo mode
- persistent storage path 분리: `SAMPLES_DIR=/data/samples`
- Dockerfile 또는 platform config 추가
- health check endpoint: `GET /healthz`

Storage choices:

- read-only demo: repo에 포함된 curated sample만 제공, `generate-sample` 비활성화
- writable demo: persistent volume을 `data/samples` 또는 `/data/samples`에 mount
- production-ish: object storage + DB로 sample metadata 분리

AI caveat:

클라우드에서 `claude` / `codex` CLI 세션 인증을 안정적으로 유지하기 어렵다. 클라우드 데모 1차는 `readonly` 또는 `AGENT_DISABLE_CODEX=1` + Claude 처리 방식을 별도 검증한 뒤 제한 공개한다.

### Option C — Production Track

상시 공개 서비스를 목표로 하면 현재 구조를 더 크게 나눈다.

- Auth: 로그인 또는 초대 코드
- DB: sample manifest, user, job 상태
- Object storage: raw/normalized/analysis JSON
- Queue: generate-sample 비동기 job
- Persistent rate limit: Redis/DB
- Riot key strategy: 사용자별 키 입력이 아닌 서버 승인 키 또는 OAuth/정책 검토
- AI: CLI 대신 서버용 API/worker 계층으로 전환 검토

## Recommended Plan

### Phase 0 — Exposure Policy Decision

Output:

- 외부 URL 대상: private tester only / public link
- 기능 범위: sample only / recent match lookup / generate sample
- 도메인: 임시 tunnel URL / 소유 도메인

Default decision:

- `Cloudflare Tunnel + Access`
- `PUBLIC_DEMO_MODE=readonly`
- 저장 샘플 탐색과 상세 리포트 확인만 공개

### Phase 1 — Public-Safe Server Hardening

Tasks:

- `handleStatic` allowlist/denylist 적용
- `/healthz` 추가
- `PUBLIC_DEMO_MODE` gate 추가
- `PUBLIC_DEMO_TOKEN` 또는 basic bearer token middleware 추가
- `getClientIp(req)` + `TRUST_PROXY` 추가
- raw sample 파일 직접 접근 차단

Acceptance:

- `curl /server.js` -> 404 또는 403
- `curl /.env` -> 404 또는 403
- `curl /test-artifacts/...` -> 404 또는 403
- `PUBLIC_DEMO_MODE=readonly`에서 write/live API는 403
- 저장 샘플 상세는 정상 표시

### Phase 2 — Local Tunnel Demo

Tasks:

- `scripts/external-demo-smoke.mjs` 작성
- `docs/external-demo-runbook.md` 작성
- Cloudflare Tunnel 실행 절차 문서화
- Access allowlist 설정 절차 문서화

Example run:

```bash
PUBLIC_DEMO_MODE=readonly npm start
cloudflared tunnel --url http://localhost:8123
```

Acceptance:

- 외부 HTTPS URL에서 홈 화면 로드
- `/api/samples` 200
- 저장 샘플 상세 진입 가능
- live/generate endpoint는 정책대로 차단

### Phase 3 — Cloud Deployment Profile

Tasks:

- `HOST` 환경변수 지원
- `SAMPLES_DIR` 환경변수 지원
- Dockerfile 또는 Render/Fly/Railway config 중 하나 선택
- read-only cloud demo 배포
- HTTPS URL smoke QA

Acceptance:

- 플랫폼 health check 통과
- deploy 후 restart해도 sample list 유지
- secret env가 응답/정적 파일로 노출되지 않음

### Phase 4 — Controlled Live Features

Tasks:

- `/api/recent-matches` protected mode에서만 허용
- `/api/generate-sample`은 admin/tester token + queue/lock 적용 후 허용
- AI CLI 실패 시 사용자에게 "저장 샘플만 이용 가능" fallback 표시
- Riot 401/429 사용자 메시지 유지 확인

Acceptance:

- 초대 테스터 1명이 Riot ID 조회 성공
- generate-sample은 1회만 실행되고 중복 클릭 방지
- 실패해도 기존 상세 화면이 유지됨

### Phase 5 — Feedback Loop

Tasks:

- 테스트 시나리오 5개 작성
- 피드백 폼 또는 GitHub issue template 추가
- 최소 로그: request id, route, status, duration
- 오류 재현용 QA checklist 업데이트

Acceptance:

- 외부 테스터가 15분 안에 샘플 리포트를 열고 피드백 제출
- 운영자가 실패 원인을 로그와 report로 추적 가능

## Validation Matrix

Before sharing external URL:

```bash
npm test
node --check server.js
node --check main.js
node scripts/design-audit.js --scope all --format text --top 8
node scripts/external-demo-smoke.mjs http://127.0.0.1:8123
```

External URL smoke:

```bash
node scripts/external-demo-smoke.mjs https://demo.example.com
```

Browser checks:

- desktop screenshot: 1440 x 1600
- mobile screenshot: 430 x 1600
- stored sample detail renders
- combat analysis section exists
- blocked endpoint test passes in read-only mode

## Recommended Milestones

### M1 — Safe Local Public Demo

Target: 0.5~1 day

- Static allowlist
- read-only demo mode
- healthz
- external smoke script
- Cloudflare Tunnel runbook

### M2 — Private Tester Demo

Target: 1~2 days

- Cloudflare Access or token protection
- 외부 URL smoke
- feedback checklist
- 3명 이하 private test

### M3 — Always-On Cloud Demo

Target: 2~4 days

- cloud provider selection
- Docker/config
- persistent/read-only sample strategy
- restart persistence verification

## Provider Notes

- Cloudflare Tunnel: public hostname을 local service로 라우팅할 수 있고, inbound port를 열지 않아도 된다.
- Cloudflare Access: Tunnel과 결합해 외부 사용자를 identity provider 기반으로 제한할 수 있다.
- Render: web service는 HTTP를 제공하려면 `0.0.0.0`에 바인딩해야 하며, persistent disk는 web service에 붙일 수 있다.
- Fly.io: volume은 앱 상태 저장에 쓸 수 있지만 volume 간 자동 복제는 되지 않는다.
- Railway: service volume과 data storage 옵션을 제공한다.

## Open Decisions

- 외부 접속 URL은 임시 tunnel URL인가, 소유 도메인인가?
- 외부 테스터는 몇 명인가?
- 1차 공개 범위는 read-only인가, Riot ID 조회까지인가?
- generate-sample을 외부에서 열 것인가?
- 클라우드 배포가 필요한가, 아니면 로컬 tunnel 데모면 충분한가?
