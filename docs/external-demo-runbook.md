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
- `/healthz.sampleGeneration` reports only aggregate sample generation status: `activeCount` and `oldestAgeMs`
- `/` exposes stored sample entry UI in read-only mode
- `/` returns `X-Content-Type-Options: nosniff`
- `/` references `styles.css` and `main.js`
- the exact referenced `styles.css` and `main.js` URLs, including cache query strings, return 200
- referenced `styles.css` returns a CSS content type and `main.js` returns a JavaScript content type
- referenced `styles.css` and `main.js` return `X-Content-Type-Options: nosniff`
- smoke stops immediately when `/healthz` does not return a 200 JSON `ok=true` response before it can touch live/write API probes
- smoke accepts only known public demo modes: `full`, `protected`, or `readonly`
- smoke treats `publicDemoModeValid: false` as a fatal mode configuration failure before sample or live/write probes
- unknown `PUBLIC_DEMO_MODE` values remain visible in `/healthz` with `publicDemoModeValid: false` for diagnostics but live/write APIs fail closed with 403 `PUBLIC_DEMO_MODE_INVALID`
- smoke validates `sampleGeneration` as aggregate-only when the field is present and fails before sample/live/write probes if lock keys, match IDs, Riot IDs, tokens, raw payload hints, fractional `oldestAgeMs`, or inactive `activeCount: 0` plus non-zero `oldestAgeMs` appear; the server floors `oldestAgeMs` to integer milliseconds before exposing it
- smoke tokens are sent only to same-origin live/write API probes, not to page, asset, sample, blocked static, or cross-origin asset requests
- smoke stops immediately on `--expect-mode` mismatch before it can touch live/write API probes
- `/api/samples` 200
- `/healthz`, `/api/samples`, sample details, and live/write API responses use a JSON content type and return `X-Content-Type-Options: nosniff`
- `/api/samples` includes at least 20 stored samples
- first 19 sample details return 200
- first 19 sample details include `matchSummary`, `coachSummary`, strengths, weaknesses, actions, and key moments
- `/api/samples` list entries omit explicit `matchId`; smoke fails on any list entry that reintroduces the field, while sample detail fetches continue to use public `sample-*` ids and must not require match IDs from the list payload. Smoke report summaries must include the required sample-list privacy, core sensitive static block, static block `nosniff`, and read-only live/write block check results so CI artifacts prove those gates were part of the run.
- sensitive static paths and encoded variants 403/404
- sensitive static path block responses return `X-Content-Type-Options: nosniff`
- read-only mode live/write APIs 403: `/api/recent-matches`, `/api/champion-history`, `/api/generate-sample`
- protected mode without a token blocks live/write APIs with `PUBLIC_DEMO_UNAUTHORIZED` or `PUBLIC_DEMO_TOKEN_REQUIRED`
- protected mode with a token passes the live/write API auth gate instead of returning 401/403
- generic Riot/live API failures surface only `RIOT_API_ERROR`; responses must not contain `RGAPI`, `api_key`, local file paths, upstream hostnames, parser text, or DNS error strings
- partial ranked lookup failures in `/api/recent-matches` keep `rankedStatus: "error"` with a fixed `rankedError`; responses must not contain `RGAPI`, `api_key`, local paths, upstream hostnames, DNS text, or parser text
- champion history account progress emits only phase-level status without PUUID; partial match failures emit `match-error` progress with fixed copy; responses/events must not contain `RGAPI`, `api_key`, local paths, upstream hostnames, DNS text, parser text, or PUUID from the account lookup progress event
- frontend status/error text should not display raw `RGAPI`, `api_key`, local paths, upstream hostnames, DNS text, parser text, bearer fragments, or token URL fragments even when a client fetch fails before structured server JSON is available
- malformed, absolute-form, protocol-relative request targets or invalid Host headers fail as HTTP 400 `INVALID_REQUEST_TARGET` instead of escaping the request handler
- malformed live API JSON bodies, including `/api/champion-history`, fail as HTTP 400 `INVALID_JSON_BODY`; request bodies over 1MB fail as HTTP 413 `REQUEST_BODY_TOO_LARGE`, without leaking parser stack details
- read-only mode is inferred from `publicDemoMode: "readonly"` or the legacy `readonly: true` health field
- targeted sample list/detail error smoke can verify `/api/samples` or `/api/samples/:id` returns JSON `ok=false`, a stable `code`, and `X-Content-Type-Options: nosniff` before running the full sample flow
- malformed `/api/samples/:id` values, including empty ids, encoded slashes, spaces, or uppercase ids, fail as HTTP 400 `INVALID_SAMPLE_ID` before manifest lookup
- missing or malformed required stored sample report files fail sample detail requests as HTTP 500 `SAMPLE_BUNDLE_UNAVAILABLE` without exposing filesystem paths, `ENOENT`, or JSON parser text
- payload-less top-level server exceptions fail as HTTP 500 `INTERNAL_SERVER_ERROR` without exposing raw exception messages

## Cloudflare Tunnel Demo

1. Start server:

```bash
PUBLIC_DEMO_MODE=readonly TRUST_PROXY=1 npm start
```

`HOST` defaults to `127.0.0.1` only when it is missing or empty. Set `HOST=0.0.0.0` when the server must bind for a tunnel or external reverse proxy, and keep the value free of whitespace and control characters. Values such as `HOST= 0.0.0.0`, `HOST=0.0.0.0 `, or `HOST=local host` fail before startup instead of being normalized.

`SAMPLES_DIR` defaults to `./data/samples` only when it is missing or empty. Non-empty values may be relative or absolute filesystem paths, including internal spaces, but leading/trailing whitespace and ASCII control characters fail before startup so a demo cannot silently use a different sample storage root.

2. Start tunnel:

```bash
cloudflared tunnel --url http://localhost:8123
```

3. Run smoke against the issued HTTPS URL:

```bash
npm run smoke:external:readonly -- https://your-tunnel-url.trycloudflare.com
```

`smoke:external:readonly` requires an explicit `https://` URL and at least 20 stored samples. Invalid or non-http(s) base URLs fail before any network request with `FAIL base URL must be an http(s) URL`. Use `npm run smoke:readonly` for local `http://127.0.0.1:8123` checks.

If the external URL is unreachable, the smoke should fail fast on the first network request with `FAIL request /healthz failed` rather than a Node stack trace or a long cascade of endpoint failures.
Each smoke request times out after 10 seconds by default; use `--timeout-ms=<ms>` only when debugging slow tunnels. Numeric smoke options such as `--min-samples`, `--timeout-ms`, and sample error statuses must be plain decimal digits; whitespace, decimal notation, and exponential notation fail before network probes or artifact creation.
Append `--report-json=<path>` when the QA result needs to be shared or archived:

```bash
npm run smoke:readonly -- --report-json=test-artifacts/qa-automation/smoke-readonly.json
npm run smoke:external:readonly -- https://demo.example.com --report-json=test-artifacts/qa-automation/external-readonly.json
```

The JSON report contains the same PASS/FAIL check labels used in console output, summary counts, expected/actual public demo mode, timestamps, and exit code. URL evidence inside `baseUrl`, check labels, and check details redacts userinfo, query strings, and fragments; relative asset paths are persisted with markers such as `/styles.css?redacted` instead of raw query values. It does not store the demo token, Authorization header, or API response bodies.

Direct smoke `--report-json=<path>` accepts only relative `test-artifacts/<subdir>/.../*.json` paths. Absolute paths, `.` / `..` path segments, path values wrapped in leading/trailing whitespace, path values containing ASCII control characters, Unicode whitespace, byte order mark characters, invisible Unicode format characters, Unicode surrogate code units, Unicode replacement characters, or literal backslashes, repeated slash separators such as `test-artifacts//tmp/...`, paths outside the artifact tree, root-level `test-artifacts/*.json` targets, file paths with trailing slashes, or non-JSON targets fail before any network request or report write with `FAIL --report-json must be a relative .json path under a test-artifacts subdirectory`.

Direct smoke and `smoke:report:*` commands accept at most one positional base URL. Extra positional URL arguments fail before any network request or report artifact creation, so operators do not accidentally collect evidence for the wrong URL.

Direct smoke singleton options such as `--expect-mode=<mode>` and `--report-json=<path>`, plus runner-owned singleton options such as `--mode=<mode>` and `--output-root=<path>`, accept only one value. Duplicate singleton options fail before network requests or artifact creation, so the first value cannot silently win over a later operator correction. Mode values must exactly match their lowercase allowlist entries; values with leading/trailing whitespace such as `--expect-mode= readonly` or `--mode= readonly` fail before network probes or artifact creation.

Direct smoke also rejects unknown `--...` options before any network request or report JSON write. This keeps typos such as `--expectmode=readonly` from silently falling back to a weaker smoke configuration. Sample manifest error expectation probes accept only `sample-[a-z0-9]+(-[a-z0-9]+)*` sample detail ids, `[A-Z0-9_]+` diagnostic codes, and HTTP error statuses in the `400-599` range, so URL-like values, whitespace-containing values, ids with empty hyphen segments, or non-error statuses fail before network probes.

Direct smoke token material is scoped to protected token-required checks. Inline `--token=<value>` is accepted only with `--require-token --expect-mode=protected`; read-only/full smoke rejects inline tokens before network requests, and ambient `PUBLIC_DEMO_TOKEN` is ignored unless the smoke is protected and token-required. `--require-token` also fails outside `--expect-mode=protected`. Protected token values must be non-empty and must not contain whitespace. Values with leading, trailing, or internal whitespace fail before network requests with a token-shape error, while whitespace-only values continue to fail as missing tokens.

The protected server `PUBLIC_DEMO_TOKEN` follows the same whitespace-free contract. The local `.env` loader preserves value text after `=`, so accidental whitespace in the file reaches the server validator instead of being normalized away. Non-empty server token values with leading, trailing, or internal whitespace make `/healthz` expose only `publicDemoTokenValid: false`, never the secret value, and live/write APIs fail closed with 403 `PUBLIC_DEMO_TOKEN_INVALID`. Bearer and `x-demo-token` request values are compared exactly, so whitespace attached to the token value does not authenticate. Duplicate or array-shaped `Authorization` / `x-demo-token` values are also rejected instead of authenticating the first value. Smoke fails immediately after `/healthz` with `FAIL public demo token config is valid` when `publicDemoTokenValid` is false.

Report runner output roots from `--output-root=<path>` or `SMOKE_REPORT_OUTPUT_ROOT` must be relative `test-artifacts/<subdir>` paths. Absolute paths, `.` / `..` path segments, path values wrapped in leading/trailing whitespace, path values containing ASCII control characters, Unicode whitespace, byte order mark characters, invisible Unicode format characters, Unicode surrogate code units, Unicode replacement characters, or literal backslashes, repeated slash separators such as `test-artifacts//qa-automation`, root-level `test-artifacts`, trailing slash root variants such as `test-artifacts/` or `test-artifacts//`, or non-artifact roots such as `.github/...` fail before any report directory or `qa-summary.json` is created with `FAIL --output-root must be a relative path under a test-artifacts subdirectory`. Valid child roots with a single trailing slash are normalized to their canonical path.

The `smoke:report:*` runner only forwards allowlisted smoke pass-through options: `--token=`, `--timeout-ms=`, and sample manifest error expectation options. Unknown options or runner-owned smoke options such as `--expect-mode=<mode>` fail in the runner before report directories or metadata files are created. Allowlisted pass-through options are also checked for singleton, value, required-field, token-shape, decimal integer text, and HTTP error status contracts in the runner, so invalid values such as `--timeout-ms=0`, `--timeout-ms=1e3`, duplicate timeout flags, incomplete sample manifest error expectations, URL-like sample detail ids, ids with empty hyphen segments, whitespace-containing diagnostic codes, or sample error statuses outside `400-599` fail before artifact creation.

Protected report runners, `smoke:report:protected` and `smoke:report:external:protected`, require a non-empty `--token=<value>` or `PUBLIC_DEMO_TOKEN` before artifact creation. Protected token values must not contain leading, trailing, or internal whitespace; invalid inline/env tokens fail before report directories or `qa-summary.json` are created. An empty inline `--token=` or whitespace-only inline token does not fall back to the environment token and fails immediately with `FAIL --require-token needs --token or PUBLIC_DEMO_TOKEN`.

Read-only report runners, `smoke:report:readonly` and `smoke:report:external:readonly`, reject `--token` pass-through options before artifact creation. Tokens are meaningful only for protected report modes; passing one to a read-only report fails with `FAIL --token is only accepted for protected smoke reports`.

For repeatable QA evidence, prefer the report runner commands. They create a top-level `test-artifacts/qa-automation/qa-summary.json`, plus `test-artifacts/qa-automation/<timestamp>-<mode>/smoke-report.json` and a sanitized `smoke-run.json` automatically:

```bash
npm run smoke:report:readonly
PUBLIC_DEMO_TOKEN='replace-with-long-random-token' npm run smoke:report:protected
npm run smoke:report:external:readonly -- https://demo.example.com
npm run smoke:report:external:protected -- https://demo.example.com --token=replace-with-long-random-token
npm run smoke:validate:external-url -- external_readonly_url https://demo.example.com
```

`qa-summary.json` records the latest run's mode, redacted URL, status, exit code, run duration, git branch/commit context, CI workflow/run context, Node/runtime context, runner generator metadata, pass/fail counts, check count, required check label results, required check overall status, required check pass/fail/missing totals, required check failure messages, artifact-root relative paths, artifact file sizes, artifact SHA-256 hashes, artifact integrity verdict, sample evidence coverage rollup, demo safety evidence rollup, QA verdict/shareable rollup, and artifact paths. The smoke request still uses the original URL, but persisted evidence redacts URL userinfo, query strings, and fragments. `smoke-run.json` also redacts inline `--token=<value>` arguments before writing command metadata. If sample manifest error message expectation arguments contain embedded URL credentials, query strings, fragments, `token=...`, `access_token=...`, or `Bearer ...` text, the persisted command metadata stores only redacted values.

The GitHub Actions `QA` workflow runs `npm test` and `npm run smoke:report:readonly` on `main` pushes, pull requests, and manual dispatch. It uploads `test-artifacts/qa-automation/` with `actions/upload-artifact@v7`, so the read-only smoke report can be inspected from the workflow run without rerunning the demo locally.

If repository secret `PUBLIC_DEMO_TOKEN` is configured, the same `QA` workflow also starts a protected demo server and runs `npm run smoke:report:protected`. The workflow detects the secret through a step-local environment variable and gates protected smoke steps on that detection result. The token is not passed as a `--token` command argument, so `smoke-run.json` keeps its command metadata token-free.

For external HTTPS evidence collection, run the `QA` workflow manually and fill `external_readonly_url` with the deployed or tunneled demo URL. Manual external URLs are preflighted near the start of the workflow before unit/local smoke work, and direct `smoke:external:*` / `smoke:external:manifest:*` commands plus the `smoke:report:external:*` runner apply the same preflight before launching external smoke: URLs must be literal lowercase `https://` origin/root URLs and must target a public FQDN or publicly routable IP literal. Parser-normalized scheme spellings such as `https:demo.example.com`, `https:/demo.example.com`, or `HTTPS://demo.example.com` are rejected. Raw DNS hostname labels may use only ASCII letters, digits, and hyphens, and cannot start or end with a hyphen. IDNs are allowed only when entered directly as `xn--` punycode labels. They must not include username/password, query strings, fragments, raw ASCII control characters, raw Unicode whitespace or byte order mark characters, unencoded spaces, literal backslashes, path dot segments, paths other than `/`, parser-normalized raw port spellings, explicit non-default ports, localhost, loopback targets, single-label hostnames, DNS-incompatible hostname labels, parser-normalized raw scheme spellings, parser-normalized raw hostname spellings, non-canonical IPv4 literal spellings, non-canonical IPv6 literal spellings, private/internal IP targets, IPv4-mapped IPv6 private/internal targets, documentation/benchmarking/multicast/reserved/special-use IP literals, IANA special-purpose IPv4 literals, or IANA special-purpose/reserved IPv6 literals. Validator labels are sanitized before log output so arbitrary CLI labels cannot add new lines or terminal control text to preflight logs. The workflow runs `npm run smoke:report:external:readonly -- "$EXTERNAL_READONLY_URL"` and uploads the resulting report alongside the normal read-only artifact. To collect protected external evidence, also configure repository secret `PUBLIC_DEMO_TOKEN` and fill `external_protected_url`; the workflow runs the protected external smoke only when both the URL and token are available. If `external_protected_url` is filled without that secret, the workflow fails with `external_protected_url requires repository secret PUBLIC_DEMO_TOKEN` instead of silently skipping the protected smoke.

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

## Protected External Save Mode

Use this only for invited testers who are allowed to create stored analysis samples from the external page.
Anonymous external access should remain `PUBLIC_DEMO_MODE=readonly`.

```bash
mkdir -p runtime/samples
cp -R data/samples/* runtime/samples/
PUBLIC_DEMO_MODE=protected \
PUBLIC_DEMO_TOKEN='replace-with-long-random-token' \
SAMPLES_DIR=runtime/samples \
TRUST_PROXY=1 \
npm start
```

Then create an HTTPS tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:8123 --no-autoupdate
```

Validate the protected external endpoint:

```bash
npm run smoke:external:protected -- https://demo.example.com --token=replace-with-long-random-token
```

Browser flow:

- Open the external URL and confirm the page shows `보호 모드`.
- Enter the invited tester token in `외부 저장 토큰`.
- Confirm the status changes to `저장 권한이 연결되었습니다.`
- Use Riot ID lookup, choose a candidate match, and generate/save the analysis sample.
- Confirm the saved sample list refreshes and the generated sample opens.

Share the token out of band, never put it in a URL, and rotate it after the session. Do not use `PUBLIC_DEMO_MODE=full` for external save testing.

## Cloud Host Notes

For Render/Fly/Railway-like environments:

```env
HOST=0.0.0.0
PORT=<platform-provided-port>
PUBLIC_DEMO_MODE=readonly
TRUST_PROXY=1
SAMPLES_DIR=/var/lib/lol-ai-coach/samples
```

The first cloud deploy should stay read-only. `PUBLIC_DEMO_MODE` defaults to `full` only when missing or empty; any non-empty value must exactly match lowercase `full`, `readonly`, or `protected`. The local `.env` loader does not trim or lowercase mode values after `=`, so values that could be normalized, such as ` readonly` or `READONLY`, remain invalid and block live/write APIs with 403 `PUBLIC_DEMO_MODE_INVALID` while preserving the raw mode and `publicDemoModeValid: false` in `/healthz` for diagnosis. Shell or platform environment keys take precedence over `.env` entries even when the existing value is an empty string. `PORT` defaults to `8123` only when missing or empty; any non-empty value must be an exact decimal integer from `0` to `65535` without whitespace, leading-zero, hex, exponent, or float normalization. `TRUST_PROXY` is also an exact opt-in: only `TRUST_PROXY=1` enables forwarded IP headers, while values such as `TRUST_PROXY= 1` keep proxy trust disabled and rate limiting keyed to the socket IP. Even with `TRUST_PROXY=1`, duplicate or array-shaped `cf-connecting-ip`, `x-forwarded-for`, or `x-real-ip` values are not trusted; rate limiting falls back to the socket IP instead of the first forwarded value. Non-empty `x-forwarded-for` values with leading, trailing, or middle empty comma segments are also treated as malformed and fall back to the socket IP. `SAMPLES_DIR` should point at a persistent volume; when unset, the server uses `./data/samples`. Writable sample generation now has a same-process `platformRegion + matchId` lock that returns 409 `SAMPLE_GENERATION_IN_PROGRESS` for duplicate work without exposing match IDs or lock keys in the response; `/healthz.sampleGeneration` exposes only aggregate lock status with `activeCount` and integer `oldestAgeMs`, not lock keys, match IDs, Riot IDs, tokens, or raw payloads. Local JSON writes use a temp file plus rename to reduce partial-write corruption, manifest read-modify-write operations are queued inside a single process, and processes sharing the same `SAMPLES_DIR` coordinate through a `.manifest.lock` directory. A lock directory older than 5 minutes is treated as stale and removed before retrying acquisition. `manifest.json` declares `schemaVersion: 1`; legacy manifests without the field are normalized as v1, and unsupported versions, invalid runtime shape, missing required sample entry metadata, missing exact `/data/samples/` public prefixes, escaped per-sample public paths, traversal segments, raw/internal path exposure, malformed sample entry ids, or duplicate sample entry ids use the `SAMPLE_MANIFEST_INVALID` diagnostic code. Sample entry `id` values must also match the lowercase generated `sample-...` contract used by `/api/samples/:id`; uppercase, slash, encoded slash, whitespace, trailing-hyphen, or duplicate ids fail with `SAMPLE_MANIFEST_INVALID`. If a validated manifest points `normalizedPath` or `analysisPath` at a missing or malformed required JSON file, sample detail returns `SAMPLE_BUNDLE_UNAVAILABLE` without local path or parser detail leakage. Runtime validation and stored fixture integrity tests share `lib/sample-manifest.js` so path and metadata criteria stay aligned. Multi-instance protected demos still need provider-level persistent storage validation before wider use.

## Pre-Share Checklist

- [ ] `npm test` passes
- [ ] `npm run smoke:external:readonly -- <https-url>` passes for external HTTPS URLs
- [ ] `npm run smoke:readonly` passes for local read-only smoke
- [ ] External `/api/samples` exposes at least 20 stored samples
- [ ] `curl <url>/.env` returns 403 or 404
- [ ] `curl <url>/server.js` returns 403 or 404
- [ ] `curl <url>/data/samples/manifest.json` returns 403 or 404
- [ ] `POST <url>/api/recent-matches`, `/api/champion-history`, `/api/generate-sample` return 403 in read-only mode
- [ ] Stored sample detail opens in desktop browser
- [ ] Stored sample detail opens in mobile viewport
- [ ] External URL is behind Cloudflare Access or shared only with intended testers
