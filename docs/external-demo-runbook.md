# External Demo Runbook

## Purpose

초대된 외부 사용자가 HTTPS URL로 LoL Replay Coach 저장 샘플을 볼 수 있게 하는 운영 절차다. 기본 모드는 안전한 read-only 데모다.

## Safe Default

```bash
npm run start:readonly
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
npm run smoke:readonly
```

Expected:

- `/healthz` 200
- `/` exposes stored sample entry UI in read-only mode
- `/` returns `X-Content-Type-Options: nosniff`
- `/` references `styles.css` and `main.js`
- the exact referenced `styles.css` and `main.js` URLs, including cache query strings, return 200
- referenced `styles.css` returns a CSS content type and `main.js` returns a JavaScript content type
- referenced `styles.css` and `main.js` return `X-Content-Type-Options: nosniff`
- smoke stops immediately when `/healthz` does not return a 200 JSON `ok=true` response before it can touch live/write API probes
- smoke accepts only known public demo modes: `full`, `protected`, or `readonly`
- smoke tokens are sent only to same-origin live/write API probes, not to page, asset, sample, blocked static, or cross-origin asset requests
- smoke stops immediately on `--expect-mode` mismatch before it can touch live/write API probes
- `/api/samples` 200
- `/healthz`, `/api/samples`, sample details, and live/write API responses use a JSON content type and return `X-Content-Type-Options: nosniff`
- `/api/samples` includes at least 19 stored samples
- first 19 sample details return 200
- first 19 sample details include `matchSummary`, `coachSummary`, strengths, weaknesses, actions, and key moments
- sensitive static paths and encoded variants 403/404
- sensitive static path block responses return `X-Content-Type-Options: nosniff`
- read-only mode live/write APIs 403: `/api/recent-matches`, `/api/champion-history`, `/api/generate-sample`
- protected mode without a token blocks live/write APIs with `PUBLIC_DEMO_UNAUTHORIZED` or `PUBLIC_DEMO_TOKEN_REQUIRED`
- protected mode with a token passes the live/write API auth gate instead of returning 401/403
- read-only mode is inferred from `publicDemoMode: "readonly"` or the legacy `readonly: true` health field

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
npm run smoke:external:readonly -- https://your-tunnel-url.trycloudflare.com
```

`smoke:external:readonly` requires an explicit `https://` URL and at least 19 stored samples. Invalid or non-http(s) base URLs fail before any network request with `FAIL base URL must be an http(s) URL`. Use `npm run smoke:readonly` for local `http://127.0.0.1:8123` checks.

If the external URL is unreachable, the smoke should fail fast on the first network request with `FAIL request /healthz failed` rather than a Node stack trace or a long cascade of endpoint failures.
Each smoke request times out after 10 seconds by default; use `--timeout-ms=<ms>` only when debugging slow tunnels.

4. Share URL only after smoke passes.

## Protected Live Demo

Use this only for a small trusted tester group.

```bash
PUBLIC_DEMO_TOKEN='replace-with-long-random-token' TRUST_PROXY=1 npm run start:protected
```

Smoke with token:

```bash
PUBLIC_DEMO_TOKEN='replace-with-long-random-token' npm run smoke:protected
npm run smoke:external:protected -- https://demo.example.com --token=replace-with-long-random-token
```

`smoke:protected` targets local `http://127.0.0.1:8123`; use it after starting `npm run start:protected`.
`smoke:external:protected` requires an explicit `https://` URL and a token from `--token` or `PUBLIC_DEMO_TOKEN` before it makes any network request.
The smoke CLI sends the token only to the demo origin. If `index.html` references cross-origin client assets, those requests must remain unauthenticated.

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

The first cloud deploy should stay read-only. Writable sample generation now has a same-process `platformRegion + matchId` lock that returns 409 `SAMPLE_GENERATION_IN_PROGRESS` for duplicate work, local JSON writes use a temp file plus rename to reduce partial-write corruption, and manifest read-modify-write operations are queued inside a single process. Persistent storage and cross-process queue/lock verification are still required before multi-instance protected demos.

## Pre-Share Checklist

- [ ] `npm test` passes
- [ ] `npm run smoke:external:readonly -- <https-url>` passes for external HTTPS URLs
- [ ] `npm run smoke:readonly` passes for local read-only smoke
- [ ] External `/api/samples` exposes at least 19 stored samples
- [ ] `curl <url>/.env` returns 403 or 404
- [ ] `curl <url>/server.js` returns 403 or 404
- [ ] `curl <url>/data/samples/manifest.json` returns 403 or 404
- [ ] `POST <url>/api/recent-matches`, `/api/champion-history`, `/api/generate-sample` return 403 in read-only mode
- [ ] Stored sample detail opens in desktop browser
- [ ] Stored sample detail opens in mobile viewport
- [ ] External URL is behind Cloudflare Access or shared only with intended testers
