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
- targeted sample list/detail error smoke can verify `/api/samples` or `/api/samples/:id` returns JSON `ok=false`, a stable `code`, and `X-Content-Type-Options: nosniff` before running the full sample flow

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
Append `--report-json=<path>` when the QA result needs to be shared or archived:

```bash
npm run smoke:readonly -- --report-json=test-artifacts/qa-automation/smoke-readonly.json
npm run smoke:external:readonly -- https://demo.example.com --report-json=test-artifacts/qa-automation/external-readonly.json
```

The JSON report contains the same PASS/FAIL check labels used in console output, summary counts, expected/actual public demo mode, timestamps, and exit code. It does not store the demo token, Authorization header, or API response bodies.

For repeatable QA evidence, prefer the report runner commands. They create a top-level `test-artifacts/qa-automation/qa-summary.json`, plus `test-artifacts/qa-automation/<timestamp>-<mode>/smoke-report.json` and a sanitized `smoke-run.json` automatically:

```bash
npm run smoke:report:readonly
PUBLIC_DEMO_TOKEN='replace-with-long-random-token' npm run smoke:report:protected
npm run smoke:report:external:readonly -- https://demo.example.com
npm run smoke:report:external:protected -- https://demo.example.com --token=replace-with-long-random-token
npm run smoke:validate:external-url -- external_readonly_url https://demo.example.com
```

`qa-summary.json` records the latest run's mode, redacted URL, status, exit code, pass/fail counts, check count, and artifact paths. The smoke request still uses the original URL, but persisted evidence redacts URL userinfo, query strings, and fragments. `smoke-run.json` also redacts inline `--token=<value>` arguments before writing command metadata.

The GitHub Actions `QA` workflow runs `npm test` and `npm run smoke:report:readonly` on `main` pushes, pull requests, and manual dispatch. It uploads `test-artifacts/qa-automation/` with `actions/upload-artifact@v7`, so the read-only smoke report can be inspected from the workflow run without rerunning the demo locally.

If repository secret `PUBLIC_DEMO_TOKEN` is configured, the same `QA` workflow also starts a protected demo server and runs `npm run smoke:report:protected`. The workflow detects the secret through a step-local environment variable and gates protected smoke steps on that detection result. The token is not passed as a `--token` command argument, so `smoke-run.json` keeps its command metadata token-free.

For external HTTPS evidence collection, run the `QA` workflow manually and fill `external_readonly_url` with the deployed or tunneled demo URL. Manual external URLs are preflighted near the start of the workflow before unit/local smoke work, and direct `smoke:external:*` / `smoke:external:manifest:*` commands plus the `smoke:report:external:*` runner apply the same preflight before launching external smoke: URLs must be `https://` URLs and must target a public FQDN or publicly routable IP literal. DNS hostname labels may use only letters, digits, and hyphens, and cannot start or end with a hyphen. They must not include username/password, query strings, fragments, raw ASCII control characters, unencoded spaces, literal backslashes, path dot segments, explicit non-default ports, localhost, loopback targets, single-label hostnames, DNS-incompatible hostname labels, non-canonical IPv4 literal spellings, private/internal IP targets, IPv4-mapped IPv6 private/internal targets, documentation/benchmarking/multicast/reserved/special-use IP literals, IANA special-purpose IPv4 literals, or IANA special-purpose/reserved IPv6 literals. The workflow runs `npm run smoke:report:external:readonly -- "$EXTERNAL_READONLY_URL"` and uploads the resulting report alongside the normal read-only artifact. To collect protected external evidence, also configure repository secret `PUBLIC_DEMO_TOKEN` and fill `external_protected_url`; the workflow runs the protected external smoke only when both the URL and token are available. If `external_protected_url` is filled without that secret, the workflow fails with `external_protected_url requires repository secret PUBLIC_DEMO_TOKEN` instead of silently skipping the protected smoke.

4. Share URL only after smoke passes.

## Manifest Error Probe

Use this when a persistent sample volume or copied `manifest.json` is suspected to be invalid and `/api/samples` cannot complete the normal list flow. The probes run `/healthz`, validate the expected public demo mode, call the target sample endpoint directly, check the structured JSON error, and exit before home/assets/live API probes.

Local presets:

```bash
npm run smoke:manifest:list-error
npm run smoke:manifest:detail-error
```

External HTTPS presets:

```bash
npm run smoke:external:manifest:list-error -- https://demo.example.com
npm run smoke:external:manifest:detail-error -- https://demo.example.com
```

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
SAMPLES_DIR=/var/lib/lol-ai-coach/samples
```

The first cloud deploy should stay read-only. `SAMPLES_DIR` should point at a persistent volume; when unset, the server uses `./data/samples`. Writable sample generation now has a same-process `platformRegion + matchId` lock that returns 409 `SAMPLE_GENERATION_IN_PROGRESS` for duplicate work, local JSON writes use a temp file plus rename to reduce partial-write corruption, manifest read-modify-write operations are queued inside a single process, and processes sharing the same `SAMPLES_DIR` coordinate through a `.manifest.lock` directory. A lock directory older than 5 minutes is treated as stale and removed before retrying acquisition. `manifest.json` declares `schemaVersion: 1`; legacy manifests without the field are normalized as v1, and unsupported versions, invalid runtime shape, missing required sample entry metadata, missing exact `/data/samples/` public prefixes, escaped per-sample public paths, traversal segments, or raw/internal path exposure responses use the `SAMPLE_MANIFEST_INVALID` diagnostic code. Runtime validation and stored fixture integrity tests share `lib/sample-manifest.js` so path and metadata criteria stay aligned. Multi-instance protected demos still need provider-level persistent storage validation before wider use.

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
