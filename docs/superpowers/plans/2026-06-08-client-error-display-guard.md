# Client Error Display Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent frontend status/error UI from displaying raw sensitive error details when client-side fetches fail before or outside structured server error handling.

**Architecture:** Strengthen the existing `formatRetryMessage(error)` formatter in `main.js` so DNS, parser, local path, request URL, and token-like details are replaced with a fixed Korean retry message. Route remaining direct `error.message` UI call sites through that formatter: sample load status, recent stats status, and champion history failure text. Use existing main UI contract tests to prove both formatter behavior and source-level call-site usage.

**Tech Stack:** Vanilla JS frontend, Node.js ESM source-extraction tests, README/runbook Markdown docs, GitHub Actions read-only smoke artifact.

---

## File Structure

- Modify: `test-artifacts/main/demo-mode-ui-tests.mjs`
  - Add `formatRetryMessage()` no-leak cases for raw DNS/token, local path, parser, and request URL-like details.
  - Add source-contract checks that sample load, recent stats, and champion history failure UI uses `formatRetryMessage(error)` instead of raw `error.message`.
- Modify: `main.js`
  - Update `formatRetryMessage(error)` to replace sensitive raw messages with a fixed base message.
  - Update `selectSample()` catch to use `formatRetryMessage(error)`.
  - Update `fetchRecentStats()` catch to store/render `formatRetryMessage(error)`.
  - Update `startChampionHistoryFetch()` catch to display `formatRetryMessage(error)`.
- Modify: `README.md`
  - Document the client-side display guard for sensitive raw error details.
- Modify: `docs/external-demo-runbook.md`
  - Record a QA expectation for frontend status/error messages.
- Create: `docs/superpowers/plans/2026-06-08-client-error-display-guard.md`
  - Track RED/GREEN, local QA, staged QA, GitHub Actions artifact, and Obsidian update evidence.

## Task 1: Write The Failing Regression Test

**Files:**
- Modify: `test-artifacts/main/demo-mode-ui-tests.mjs`

- [ ] **Step 1: Add formatter no-leak cases**

Add these checks after the existing `formatRetryMessage()` tests:

```js
check("sensitive DNS/token errors use generic retry copy",
  formatRetryMessage(new Error("getaddrinfo ENOTFOUND kr.api.riotgames.com?api_key=RGAPI-secret")),
  "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.");

check("sensitive local path errors use generic retry copy",
  formatRetryMessage(new Error("ENOENT: no such file or directory, open '/runtime/samples/secret.json'")),
  "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.");

check("sensitive parser errors use generic retry copy",
  formatRetryMessage(new Error("Unexpected token < in JSON at position 0")),
  "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
```

- [ ] **Step 2: Add source contract checks**

Add checks against `mainSrc`:

```js
check("sample load failure uses retry formatter",
  mainSrc.includes("샘플 로드 실패: ${escapeHtml(formatRetryMessage(error))}"),
  true);

check("recent matches failure escapes retry formatter output",
  mainSrc.includes("최근 경기 조회 실패: ${escapeHtml(formatRetryMessage(error))}"),
  true);

check("recent stats error stores retry formatter output",
  mainSrc.includes("state.recentStatsError = formatRetryMessage(error);"),
  true);

check("champion history failure uses retry formatter",
  mainSrc.includes("분석 실패: ${formatRetryMessage(error)}"),
  true);

check("sample load failure no longer renders raw error.message",
  !mainSrc.includes("샘플 로드 실패: ${escapeHtml(error.message)}"),
  true);
```

- [ ] **Step 3: Run the test and confirm RED**

Run:

```bash
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected result before implementation: FAIL because sensitive raw messages are returned directly and the three frontend catch sites still use raw `error.message` or do not use `formatRetryMessage(error)`.

## Task 2: Implement Safe Client Error Formatting

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Strengthen `formatRetryMessage(error)`**

Change the formatter to compute a sanitized `baseMessage`:

```js
function formatRetryMessage(error) {
  const rawMessage = String(error?.message || "");
  const trimmed = rawMessage.trim();
  const sensitivePatterns = [
    "RGAPI",
    "api_key",
    "Authorization",
    "Bearer ",
    "token=",
    "access_token",
    "/runtime/samples",
    "/Users/",
    "ENOENT",
    "Unexpected token",
    "getaddrinfo",
    "ENOTFOUND",
    ".api.riotgames.com",
  ];
  const baseMessage = sensitivePatterns.some((token) => trimmed.includes(token))
    ? "요청 처리 중 오류가 발생했습니다."
    : trimmed || "알 수 없는 오류가 발생했습니다.";
  if (isNonRetryablePublicDemoMessage(baseMessage)) {
    return baseMessage;
  }
  if (baseMessage.includes("다시 시도") || baseMessage.includes("잠시 후")) {
    return baseMessage;
  }
  return `${baseMessage} 잠시 후 다시 시도하세요.`;
}
```

- [ ] **Step 2: Route sample load failure through the formatter**

Replace:

```js
dom.fetchStatus.innerHTML = `샘플 로드 실패: ${escapeHtml(error.message)} <button class="retry-btn" data-retry-sample="${escapeAttr(sampleId)}">다시 시도</button>`;
```

with:

```js
dom.fetchStatus.innerHTML = `샘플 로드 실패: ${escapeHtml(formatRetryMessage(error))} <button class="retry-btn" data-retry-sample="${escapeAttr(sampleId)}">다시 시도</button>`;
```

- [ ] **Step 3: Route recent stats failure through the formatter**

Replace:

```js
state.recentStatsError = error.message || String(error);
```

with:

```js
state.recentStatsError = formatRetryMessage(error);
```

- [ ] **Step 4: Route recent match failure through escaped formatter output**

Replace:

```js
dom.fetchStatus.innerHTML = `최근 경기 조회 실패: ${formatRetryMessage(error)} <button class="retry-btn" data-retry-recent>다시 시도</button>`;
```

with:

```js
dom.fetchStatus.innerHTML = `최근 경기 조회 실패: ${escapeHtml(formatRetryMessage(error))} <button class="retry-btn" data-retry-recent>다시 시도</button>`;
```

- [ ] **Step 5: Route champion history failure through the formatter**

Replace:

```js
setChampionHistoryEmpty(`분석 실패: ${error.message}`);
```

with:

```js
setChampionHistoryEmpty(`분석 실패: ${formatRetryMessage(error)}`);
```

## Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update README security notes**

Add:

```md
- Client-side retry/status messages also normalize raw network, parser, path, URL, and token-like errors to fixed Korean copy before rendering.
```

- [ ] **Step 2: Update external demo runbook smoke expectations**

Add:

```md
- Frontend status/error text should not display raw `RGAPI`, `api_key`, local paths, upstream hostnames, DNS text, parser text, or bearer/token fragments even when a client fetch fails before structured server JSON is available.
```

## Task 4: Verify Local And Staged QA

**Files:**
- Check: `main.js`
- Check: `test-artifacts/main/demo-mode-ui-tests.mjs`
- Check: all test files reached by `npm test`

- [ ] **Step 1: Run local QA**

Run:

```bash
node --check main.js
node --check test-artifacts/main/demo-mode-ui-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
npm test
git diff --check
```

Expected result: every command exits 0.

- [ ] **Step 2: Stage exact files and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-client-error-display-guard.md main.js test-artifacts/main/demo-mode-ui-tests.mjs
node --check main.js
node --check test-artifacts/main/demo-mode-ui-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
npm test
git diff --cached --check
```

Expected staged files:

```text
M	README.md
M	docs/external-demo-runbook.md
A	docs/superpowers/plans/2026-06-08-client-error-display-guard.md
M	main.js
M	test-artifacts/main/demo-mode-ui-tests.mjs
```

## Task 5: Commit, Push, Remote QA, And Obsidian

**Files:**
- Commit staged files.
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Commit and push**

Run:

```bash
git commit -m "ui: hide sensitive client errors"
git push origin main
```

Expected result: commit succeeds on `main`, and push updates `origin/main`.

- [ ] **Step 2: Verify GitHub Actions artifact**

Run:

```bash
gh run list --repo crisious/Web_LOL_Banpick --branch main --limit 10 --json databaseId,headSha,status,conclusion,createdAt
```

Watch the run for the pushed SHA, download the artifact, inspect `smoke-report.json`, and scan the artifact for:

```text
RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr.api.riotgames.com|getaddrinfo|Bearer|token=|access_token
```

Expected result: QA concludes `success`; read-only smoke has 155 passed and 0 failed; sensitive scan has no matches.

- [ ] **Step 3: Update Obsidian**

Update the project note top QA/status lines and append:

```md
### 2026-06-08 HH:MM KST - Client error display guard
```

Include RED/GREEN, local QA, staged QA, GitHub Actions run/artifact, sensitive scan, and final `main...origin/main` sync evidence.

---

## Progress Log

- [x] Plan saved.
- [x] RED confirmed: `node test-artifacts/main/demo-mode-ui-tests.mjs` exited 1 with `8 passed, 7 failed` before production changes. Failures showed sensitive DNS/token, local path, and parser messages rendered directly, plus sample load, recent stats, and champion history failure UI not using `formatRetryMessage(error)`.
- [x] Additional RED confirmed: `node test-artifacts/main/demo-mode-ui-tests.mjs` exited 1 with `14 passed, 2 failed` after adding `innerHTML` escaping expectations for sample load and recent match failure status.
- [x] GREEN confirmed: `node test-artifacts/main/demo-mode-ui-tests.mjs` exited 0 with `16 passed, 0 failed` after `formatRetryMessage(error)` sanitized sensitive messages, `innerHTML` status paths escaped formatter output, and the remaining frontend catch sites used the formatter.
- [x] Local QA completed: placeholder scan exit `1`; `node --check main.js`; `node --check test-artifacts/main/demo-mode-ui-tests.mjs`; `node test-artifacts/main/demo-mode-ui-tests.mjs` `16 passed, 0 failed`; `npm test` `1262 passed, 0 failed across 39 test file(s)`; `git diff --check`.
- [x] Staged QA completed: `node --check main.js`; `node --check test-artifacts/main/demo-mode-ui-tests.mjs`; `node test-artifacts/main/demo-mode-ui-tests.mjs` `16 passed, 0 failed`; `npm test` `1262 passed, 0 failed across 39 test file(s)`; `git diff --cached --check`.
- [ ] Commit pushed to `origin/main`.
- [ ] GitHub Actions artifact checked.
- [ ] Obsidian updated.
