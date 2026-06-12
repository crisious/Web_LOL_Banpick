# External Protected Analysis Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let invited external users save newly generated analysis data from the external demo page without weakening the default read-only public demo.

**Architecture:** Keep `PUBLIC_DEMO_MODE=readonly` as the public-safe default. Add a protected-mode browser token flow that stores the demo token only in `sessionStorage`, sends it only to same-origin protected API endpoints through `x-demo-token`, and reuses the existing `/api/generate-sample` server pipeline for writing sample files plus manifest entries under `SAMPLES_DIR`.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, static HTML/CSS in `index.html` / `styles.css`, Node HTTP server in `server.js`, existing manifest utilities in `lib/sample-manifest.js`, Node source-extraction tests in `test-artifacts/main` and server gate tests in `test-artifacts/server`.

**Implementation status (2026-06-12 11:25 KST):** Implemented on `codex/external-protected-analysis-save` and pushed. Focused tests passed (`protected-demo-token-ui` 18/0, `demo-mode-ui` 23/0, `public-demo-mode-gate` 70/0), `npm test` passed 2968/0 across 135 files, `git diff --check` passed, local protected smoke passed on `http://127.0.0.1:8124`, read-only/protected smoke reports passed on `8125`/`8124`, browser QA confirmed token panel lock/unlock with no console warn/error, and local sensitive artifact scan found no matches. Draft PR: https://github.com/crisious/Web_LOL_Banpick/pull/2. GitHub QA run `27390380803` passed for PR merge SHA `ba1c9d0`; artifact `qa-automation-27390380803` had QA verdict passed, 161 smoke checks passed / 0 failed, 13 required checks passed, artifact integrity passed, and sensitive artifact scan found no matches. GitHub protected smoke was skipped because repository secret `PUBLIC_DEMO_TOKEN` was not available; local protected smoke remains the protected-mode evidence.

---

## Current-State Analysis

Observed from the current codebase:

- External read-only mode intentionally blocks writes. `requireLiveApiAccess()` returns `403 PUBLIC_DEMO_READONLY` for `/api/recent-matches`, `/api/champion-history`, and `/api/generate-sample` when `PUBLIC_DEMO_MODE=readonly`.
- Protected mode already exists server-side. `requireLiveApiAccess()` accepts either exact `Authorization: Bearer <token>` or exact `x-demo-token: <token>`, and the existing tests cover malformed token rejection.
- The browser does not currently have a demo-token input, session state, or request-header injection. In protected mode, live controls are visually available but requests fail with `401 PUBLIC_DEMO_UNAUTHORIZED` unless a caller manually adds a token header.
- The save path already exists. `handleGenerateSample()` validates Riot ID + match id, calls Riot match/timeline APIs, runs `buildAnalysis()`, writes `raw-account.json`, `raw-match.json`, `raw-timeline.json`, `normalized-match.json`, `analysis-result.json`, optional `comparison-result.json`, notes markdown, then `upsertManifestEntry()` updates `manifest.json`.
- Sample storage is already configurable with `SAMPLES_DIR`; manifest writes are guarded by an in-process queue plus `.manifest.lock` directory, and JSON writes use temp-file plus rename. This is sufficient for a protected single-instance external demo. Multi-instance cloud deploys still need provider-level persistent volume validation.
- Current dirty worktree contains sample/runbook/smoke changes that should not be reverted by this work. This plan adds new work around those files without assuming they are committed.

Recommended direction:

1. Keep external Quick Tunnel/public demo read-only for anonymous access.
2. For saving analysis externally, run `PUBLIC_DEMO_MODE=protected PUBLIC_DEMO_TOKEN=<strong-token> SAMPLES_DIR=<persistent-dir> TRUST_PROXY=1 npm start`.
3. Add a browser-side protected-token panel and attach `x-demo-token` only to same-origin protected API requests.
4. Add a lightweight `/api/demo-auth` endpoint so the UI can validate the token without touching Riot APIs or creating samples.
5. Reuse the existing candidate-match → `generate-sample` workflow for actual saves.

Rejected alternatives:

- `full` mode on an external URL: too broad; every visitor can call live Riot/write endpoints.
- Browser-only storage: does not persist for other users and cannot feed `/api/samples`.
- Storing a long-lived token in `localStorage`: survives browser sessions and is harder to clear safely. Use `sessionStorage`.
- Writing directly to static `data/samples` in production: workable locally, but for deployment use `SAMPLES_DIR` on a persistent writable volume.

---

### Task 1: Add Protected Demo Token State And Request Header Tests

**Files:**
- Create: `test-artifacts/main/protected-demo-token-ui-tests.mjs`
- Modify: `main.js`

- [x] **Step 1: Write the failing source-extraction test**

Create `test-artifacts/main/protected-demo-token-ui-tests.mjs`:

```js
// Protected demo token UI regression tests.
//
// External protected demos need a browser-entered token for live/write APIs.
// The token must be session-scoped and sent only to same-origin protected API
// endpoints, never static assets or sample reads.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const fetchJsonSrc = extractFunctionSource(mainSrc, "fetchJson");
const serverModeUiSrc = extractFunctionSource(mainSrc, "serverModeUi");
const currentServerModeUiSrc = extractFunctionSource(mainSrc, "currentServerModeUi");
const isLiveControlLockedSrc = extractFunctionSource(mainSrc, "isLiveControlLocked");
const liveControlLockedMessageSrc = extractFunctionSource(mainSrc, "liveControlLockedMessage");

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

checkTrue("main declares DEMO_TOKEN_STORAGE_KEY",
  mainSrc.includes("const DEMO_TOKEN_STORAGE_KEY = \"lol-coach-demo-token\";"));
checkTrue("main state includes demoToken",
  mainSrc.includes("demoToken: loadDemoToken()"));
checkTrue("main defines loadDemoToken",
  mainSrc.includes("function loadDemoToken()"));
checkTrue("main defines saveDemoToken",
  mainSrc.includes("function saveDemoToken(token)"));
checkTrue("main stores demo token in sessionStorage",
  mainSrc.includes("sessionStorage.setItem(DEMO_TOKEN_STORAGE_KEY"));
checkTrue("main does not store demo token in localStorage",
  !mainSrc.includes("localStorage.setItem(DEMO_TOKEN_STORAGE_KEY"));
checkTrue("main defines isProtectedApiPath",
  mainSrc.includes("function isProtectedApiPath(path)"));
checkTrue("protected API list includes recent matches",
  mainSrc.includes("\"/api/recent-matches\""));
checkTrue("protected API list includes champion history",
  mainSrc.includes("\"/api/champion-history\""));
checkTrue("protected API list includes generate sample",
  mainSrc.includes("\"/api/generate-sample\""));
checkTrue("protected API list includes demo auth",
  mainSrc.includes("\"/api/demo-auth\""));
checkTrue("fetchJson adds x-demo-token",
  fetchJsonSrc.includes("\"x-demo-token\""));
checkTrue("fetchJson adds token only for protected API paths",
  fetchJsonSrc.includes("isProtectedApiPath(path)"));
checkTrue("fetchJson preserves caller headers",
  fetchJsonSrc.includes("new Headers(fetchOptions.headers || {})"));
checkTrue("serverModeUi protected mode can lock without token",
  serverModeUiSrc.includes("demoTokenConfigured"));
checkTrue("isLiveControlLocked checks current mode state",
  isLiveControlLockedSrc.includes("currentServerModeUi().lockLiveControls"));
checkTrue("liveControlLockedMessage uses current mode state",
  liveControlLockedMessageSrc.includes("currentServerModeUi().liveControlMessage"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/protected-demo-token-ui-tests.mjs
node test-artifacts/main/protected-demo-token-ui-tests.mjs
```

Expected before implementation: syntax passes; runtime fails because `DEMO_TOKEN_STORAGE_KEY`, session token helpers, protected path header injection, and protected-token UI gating do not exist yet.

- [x] **Step 3: Implement demo token state helpers in `main.js`**

Add near existing localStorage helpers:

```js
const DEMO_TOKEN_STORAGE_KEY = "lol-coach-demo-token";

function loadDemoToken() {
  try {
    return sessionStorage.getItem(DEMO_TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveDemoToken(token) {
  const value = String(token || "");
  try {
    if (value) sessionStorage.setItem(DEMO_TOKEN_STORAGE_KEY, value);
    else sessionStorage.removeItem(DEMO_TOKEN_STORAGE_KEY);
  } catch {}
  return value;
}

function hasDemoToken() {
  return Boolean(String(state.demoToken || "").trim());
}
```

Extend `state`:

```js
demoToken: loadDemoToken(),
demoTokenStatus: "",
demoTokenPending: false,
```

- [x] **Step 4: Add protected API header injection**

Add helpers near `fetchJson()`:

```js
const PROTECTED_API_PATHS = new Set([
  "/api/demo-auth",
  "/api/recent-matches",
  "/api/champion-history",
  "/api/generate-sample",
]);

function isProtectedApiPath(path) {
  if (typeof path !== "string") return false;
  try {
    const url = new URL(path, window.location.origin);
    return url.origin === window.location.origin && PROTECTED_API_PATHS.has(url.pathname);
  } catch {
    return false;
  }
}

function headersWithDemoToken(path, headers) {
  const next = new Headers(headers || {});
  if (isProtectedApiPath(path) && state.demoToken) {
    next.set("x-demo-token", state.demoToken);
  }
  return next;
}
```

Change `fetchJson()` before `fetch()`:

```js
const requestHeaders = headersWithDemoToken(path, fetchOptions.headers);
finalOptions = { ...finalOptions, headers: requestHeaders };
const response = await fetch(path, finalOptions);
```

This keeps tokens off `/`, static assets, `/api/samples`, and `/api/samples/:id`.

- [x] **Step 5: Verify token helper GREEN**

Run:

```bash
node test-artifacts/main/protected-demo-token-ui-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
node --check main.js
node --check test-artifacts/main/protected-demo-token-ui-tests.mjs
```

Expected after implementation: all pass.

---

### Task 2: Add A Lightweight Protected Token Validation Endpoint

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/public-demo-mode-gate-tests.mjs`
- Test: `test-artifacts/server/public-demo-mode-gate-tests.mjs`

- [x] **Step 1: Add failing endpoint source assertions**

Append to `test-artifacts/server/public-demo-mode-gate-tests.mjs` after the existing protected gate assertions:

```js
checkTrue("server handles /api/demo-auth",
  serverSrc.includes('url.pathname === "/api/demo-auth"'));
checkTrue("demo auth uses requireLiveApiAccess",
  serverSrc.includes("handleDemoAuth(req, res)"));
checkTrue("server defines handleDemoAuth",
  serverSrc.includes("async function handleDemoAuth(req, res)"));
```

Expected before implementation: these new checks fail.

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/server/public-demo-mode-gate-tests.mjs
```

Expected before implementation: existing protected gate checks pass; the new `/api/demo-auth` source checks fail.

- [x] **Step 3: Implement `handleDemoAuth()`**

Add before `handleApi()`:

```js
async function handleDemoAuth(req, res) {
  if (!requireLiveApiAccess(req, res)) {
    return true;
  }
  sendJson(res, 200, {
    ok: true,
    mode: publicDemoMode,
    protected: isProtectedDemoMode(),
    readonly: isReadOnlyDemoMode(),
  });
  return true;
}
```

Add to `handleApi()` before the live/write endpoints:

```js
if (req.method === "POST" && url.pathname === "/api/demo-auth") {
  await handleDemoAuth(req, res);
  return true;
}
```

This endpoint validates the same protected token contract without Riot API calls or storage writes.

- [x] **Step 4: Verify endpoint GREEN**

Run:

```bash
node test-artifacts/server/public-demo-mode-gate-tests.mjs
node --check server.js
```

Expected after implementation: all pass.

---

### Task 3: Add Protected Token UI To The External Page

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `main.js`
- Modify: `test-artifacts/main/demo-mode-ui-tests.mjs`
- Test: `test-artifacts/main/demo-mode-ui-tests.mjs`

- [x] **Step 1: Add failing UI contract checks**

Extend `test-artifacts/main/demo-mode-ui-tests.mjs`:

```js
checkTrue("index has protected token form",
  indexSrc.includes("data-demo-token-form"));
checkTrue("index has protected token input",
  indexSrc.includes("data-demo-token-input"));
checkTrue("index has protected token clear button",
  indexSrc.includes("data-demo-token-clear"));
checkTrue("main renders protected token panel",
  mainSrc.includes("renderDemoTokenPanel()"));
checkTrue("main verifies protected token through demo auth endpoint",
  mainSrc.includes('fetchJson("/api/demo-auth"'));
```

Expected before implementation: these checks fail.

- [x] **Step 2: Add HTML controls**

Add below `.login-mode-panel` in `index.html`:

```html
<form class="demo-token-form" data-demo-token-form hidden>
  <label for="demo-token-input">
    <span>외부 저장 토큰</span>
    <input id="demo-token-input" name="demoToken" type="password" data-demo-token-input autocomplete="off" placeholder="초대받은 저장 토큰" />
  </label>
  <div class="demo-token-actions">
    <button type="submit" class="demo-token-submit">저장 권한 연결</button>
    <button type="button" class="demo-token-clear" data-demo-token-clear>토큰 지우기</button>
  </div>
  <p class="demo-token-status" data-demo-token-status role="status" aria-live="polite"></p>
</form>
```

- [x] **Step 3: Add compact CSS**

Add to `styles.css` near login styles:

```css
.demo-token-form {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(10, 14, 24, 0.48);
}

.demo-token-form[hidden] {
  display: none;
}

.demo-token-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.demo-token-status {
  min-height: 1.2em;
  margin: 0;
  color: var(--muted);
}
```

- [x] **Step 4: Wire UI state in `main.js`**

Add DOM refs:

```js
demoTokenForm: document.querySelector("[data-demo-token-form]"),
demoTokenInput: document.querySelector("[data-demo-token-input]"),
demoTokenClear: document.querySelector("[data-demo-token-clear]"),
demoTokenStatus: document.querySelector("[data-demo-token-status]"),
```

Update `serverModeUi(status, error)` protected branch:

```js
if (status.protected) {
  const configured = status.publicDemoTokenValid !== false;
  const connected = hasDemoToken();
  return {
    mode: "protected",
    label: connected ? "저장 가능" : "보호 모드",
    note: connected
      ? "저장 토큰이 연결되어 live 조회와 분석 저장을 사용할 수 있습니다."
      : "초대받은 저장 토큰을 입력하면 live 조회와 분석 저장을 사용할 수 있습니다.",
    lockLiveControls: !configured || !connected,
    demoTokenConfigured: configured,
    liveControlMessage: configured
      ? "저장 토큰을 연결하면 Riot ID 조회와 분석 저장을 사용할 수 있습니다."
      : "서버 저장 토큰 설정이 올바르지 않습니다. 운영자에게 문의하세요.",
  };
}
```

Add render/submit handlers:

```js
function renderDemoTokenPanel() {
  if (!dom.demoTokenForm) return;
  const mode = currentServerModeUi();
  const visible = mode.mode === "protected";
  dom.demoTokenForm.hidden = !visible;
  if (!visible) return;
  if (dom.demoTokenInput && dom.demoTokenInput.value !== state.demoToken) {
    dom.demoTokenInput.value = state.demoToken || "";
  }
  if (dom.demoTokenStatus) {
    dom.demoTokenStatus.textContent = state.demoTokenStatus ||
      (hasDemoToken() ? "저장 토큰이 이 탭에 연결되어 있습니다." : "저장하려면 초대 토큰을 입력하세요.");
  }
}

async function verifyDemoToken(token) {
  state.demoToken = saveDemoToken(token);
  state.demoTokenPending = true;
  state.demoTokenStatus = "저장 권한을 확인하는 중입니다.";
  renderDemoTokenPanel();
  applyPendingUi();
  try {
    await fetchJson("/api/demo-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    state.demoTokenStatus = "저장 권한이 연결되었습니다.";
  } catch (error) {
    state.demoToken = saveDemoToken("");
    state.demoTokenStatus = `저장 권한 확인 실패: ${formatRetryMessage(error)}`;
  } finally {
    state.demoTokenPending = false;
    renderLoginDemoStatus();
    renderDemoTokenPanel();
    applyPendingUi();
  }
}
```

Call `renderDemoTokenPanel()` inside `renderLoginDemoStatus()` and `applyPendingUi()`.

Add listeners during initialization:

```js
dom.demoTokenForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const token = dom.demoTokenInput?.value?.trim() || "";
  if (!token) {
    state.demoToken = saveDemoToken("");
    state.demoTokenStatus = "토큰을 입력하세요.";
    renderDemoTokenPanel();
    applyPendingUi();
    return;
  }
  verifyDemoToken(token);
});

dom.demoTokenClear?.addEventListener("click", () => {
  state.demoToken = saveDemoToken("");
  state.demoTokenStatus = "저장 토큰을 지웠습니다.";
  renderLoginDemoStatus();
  renderDemoTokenPanel();
  applyPendingUi();
});
```

- [x] **Step 5: Verify UI GREEN**

Run:

```bash
node test-artifacts/main/demo-mode-ui-tests.mjs
node test-artifacts/main/protected-demo-token-ui-tests.mjs
node --check main.js
```

Expected after implementation: all pass.

---

### Task 4: Make External Save Flow Operational

**Files:**
- Modify: `main.js`
- Modify: `docs/external-demo-runbook.md`
- Test: browser QA through protected mode

- [x] **Step 1: Confirm generated sample refresh behavior**

Keep `handleGenerateSample(matchId)` behavior:

```js
const result = await fetchJson("/api/generate-sample", {
  method: "POST",
  timeoutMs: 0,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

state.manifest = await loadManifest();
```

Because `fetchJson()` now attaches `x-demo-token` for `/api/generate-sample`, this existing path should work in protected external mode.

- [x] **Step 2: Improve user copy after save**

After successful sample generation, make the newly saved sample easy to open:

```js
dom.fetchStatus.textContent = `${result.sampleId} 저장 완료 · 저장 샘플 목록에서 바로 열 수 있습니다.`;
renderSampleSwitcher();
```

Optionally call `await selectSample(result.sampleId); setView("DETAIL_VIEW");` only if this does not interrupt expected match-list flow. Keep this optional behavior behind a follow-up plan if UX feels too jumpy.

- [x] **Step 3: Document protected save runbook**

Add to `docs/external-demo-runbook.md`:

````md
## Protected external save mode

Use this only for invited testers who are allowed to create stored analysis samples.

```bash
mkdir -p runtime/samples
cp -R data/samples/* runtime/samples/
PUBLIC_DEMO_MODE=protected \
PUBLIC_DEMO_TOKEN='replace-with-long-random-token' \
SAMPLES_DIR=runtime/samples \
TRUST_PROXY=1 \
npm start
```

Then create a tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:8123 --no-autoupdate
```

Validate:

```bash
npm run smoke:external:protected -- https://your-url.trycloudflare.com --token=replace-with-long-random-token
```

Do not use `PUBLIC_DEMO_MODE=full` for external save testing. Do not put the token in the URL. Share the token out of band and rotate it after the session.
````

- [x] **Step 4: Run local protected smoke**

Run:

```bash
PUBLIC_DEMO_TOKEN='dev-save-token' PUBLIC_DEMO_MODE=protected SAMPLES_DIR=test-artifacts/tmp/protected-save-samples PORT=8124 npm start
PUBLIC_DEMO_TOKEN='dev-save-token' npm run smoke:protected
```

Expected: smoke passes; protected mode without token blocks live/write APIs; protected mode with token passes auth gate.

- [x] **Step 5: Run browser QA**

Use the in-app browser against `http://127.0.0.1:8124`:

1. Confirm protected token panel is visible.
2. Confirm live controls are locked before token entry.
3. Enter `dev-save-token`.
4. Confirm `/api/demo-auth` succeeds and live controls unlock.
5. Run recent match lookup using a valid Riot API key.
6. Click a candidate "save/generate" action.
7. Confirm `/api/generate-sample` returns `ok: true`.
8. Confirm `/api/samples` count increases or the generated `sampleId` appears first.
9. Confirm new sample detail opens.
10. Confirm no console warn/error output.

If a live Riot key is unavailable, complete steps 1-4 and verify steps 5-9 with a server-side mocked Riot fixture in a follow-up implementation plan.

---

### Task 5: QA, Security Gates, And Publish

**Files:**
- Update: `docs/superpowers/plans/2026-06-12-external-protected-analysis-save.md`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run focused tests**

Run:

```bash
node test-artifacts/main/protected-demo-token-ui-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
node test-artifacts/server/public-demo-mode-gate-tests.mjs
node --check main.js
node --check server.js
```

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/external-protected-save-readonly npm run smoke:report:readonly
PUBLIC_DEMO_TOKEN='dev-save-token' SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/external-protected-save-protected npm run smoke:report:protected
```

Expected:

- All unit/source-extraction tests pass.
- Read-only smoke still proves anonymous external mode cannot write.
- Protected smoke proves token-gated live/write APIs pass auth only with token.

- [x] **Step 3: Run sensitive artifact scan**

Run:

```bash
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|x-demo-token: [^[:space:]]|access_token|token=|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/external-protected-save-readonly test-artifacts/tmp/external-protected-save-protected
```

Expected: no matches. If matches are expected labels rather than secrets, narrow the scan to artifact files and document the exact harmless context before proceeding.

- [x] **Step 4: Commit implementation**

Run:

```bash
git add index.html styles.css main.js server.js docs/external-demo-runbook.md test-artifacts/main/protected-demo-token-ui-tests.mjs test-artifacts/main/demo-mode-ui-tests.mjs test-artifacts/server/public-demo-mode-gate-tests.mjs docs/superpowers/plans/2026-06-12-external-protected-analysis-save.md
git commit -m "feat: enable protected external analysis save"
git push origin codex/external-protected-analysis-save
```

- [x] **Step 5: Verify GitHub Actions artifact**

Watch the `main` QA run, download `qa-automation-*`, inspect `qa-summary.json`, and run the same sensitive scan over the downloaded artifact.

- [x] **Step 6: Record operations**

Update Obsidian with:

- Mode decision: anonymous external remains read-only; save is protected-token only.
- Storage requirement: `SAMPLES_DIR` must be persistent.
- Token rule: session-only browser storage; rotate after test session.
- QA evidence: focused tests, full `npm test`, readonly smoke, protected smoke, external protected smoke if available, browser QA, artifact scan, GitHub Actions run/artifact ids.

---

## Rollout Checklist

- [ ] Choose a strong `PUBLIC_DEMO_TOKEN` and share it out of band.
- [ ] Start protected server with `SAMPLES_DIR` pointing at a writable persistent directory.
- [ ] Start Cloudflare Tunnel or deploy behind HTTPS.
- [ ] Run `npm run smoke:external:protected -- <https-url> --token=<token>`.
- [ ] Verify the page shows "보호 모드" and the token panel.
- [ ] Verify save flow creates a new sample entry and reloads the stored sample list.
- [ ] After the session, stop the tunnel and rotate `PUBLIC_DEMO_TOKEN`.
