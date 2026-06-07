# External Demo Runbook

## Purpose

초대된 외부 사용자가 HTTPS URL로 LoL Replay Coach 저장 샘플을 볼 수 있게 하는 운영 절차다. 기본 모드는 안전한 read-only 데모다.

## Safe Default

```bash
PUBLIC_DEMO_MODE=readonly npm start
```

read-only 모드에서 허용:

- `GET /`
- `GET /api/samples`
- `GET /api/samples/:id`
- 정적 앱 파일: `index.html`, CSS, JS

read-only 모드에서 차단:

- `POST /api/recent-matches`
- `POST /api/champion-history`
- `POST /api/generate-sample`
- `.env`, `server.js`, `package.json`, `data/**`, `test-artifacts/**`, `*.md`

## Local Smoke

```bash
npm test
node --check server.js
node --check main.js
npm run smoke:external -- http://127.0.0.1:8123
```

Expected:

- `/healthz` 200
- `/api/samples` 200
- first sample detail 200
- sensitive static paths 403/404
- read-only mode live/write APIs 403: `/api/recent-matches`, `/api/champion-history`, `/api/generate-sample`

## Cloudflare Tunnel Demo

1. Start server:

```bash
PUBLIC_DEMO_MODE=readonly TRUST_PROXY=1 npm start
```

2. Start tunnel:

```bash
cloudflared tunnel --url http://localhost:8123
```

3. Run smoke against the issued HTTPS URL:

```bash
npm run smoke:external -- https://your-tunnel-url.trycloudflare.com
```

4. Share URL only after smoke passes.

## Protected Live Demo

Use this only for a small trusted tester group.

```bash
PUBLIC_DEMO_MODE=protected PUBLIC_DEMO_TOKEN='replace-with-long-random-token' TRUST_PROXY=1 npm start
```

Smoke with token:

```bash
npm run smoke:external -- https://demo.example.com --token=replace-with-long-random-token
```

Client/API callers must send:

```http
Authorization: Bearer replace-with-long-random-token
```

or:

```http
X-Demo-Token: replace-with-long-random-token
```

## Cloud Host Notes

For Render/Fly/Railway-like environments:

```env
HOST=0.0.0.0
PORT=<platform-provided-port>
PUBLIC_DEMO_MODE=readonly
TRUST_PROXY=1
```

The first cloud deploy should stay read-only. Writable sample generation needs persistent storage and generate-sample queue/lock verification.

## Pre-Share Checklist

- [ ] `npm test` passes
- [ ] `npm run smoke:external -- <url>` passes
- [ ] `curl <url>/.env` returns 403 or 404
- [ ] `curl <url>/server.js` returns 403 or 404
- [ ] `curl <url>/data/samples/manifest.json` returns 403 or 404
- [ ] `POST <url>/api/recent-matches`, `/api/champion-history`, `/api/generate-sample` return 403 in read-only mode
- [ ] Stored sample detail opens in desktop browser
- [ ] Stored sample detail opens in mobile viewport
- [ ] External URL is behind Cloudflare Access or shared only with intended testers
