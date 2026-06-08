# Champion History Body Error Payload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/api/champion-history` malformed and oversized request bodies return the same stable JSON error contract as the other live API POST endpoints.

**Architecture:** Reuse the existing `parseBody(req)` structured errors and `riotErrorPayload(error)` mapper. Add focused request-body source-contract tests that prove the champion history parse-body catch calls `riotErrorPayload(error)` and no longer serializes raw `error.message`.

**Tech Stack:** Node.js HTTP server, vanilla JS app, Node ESM regression tests, Markdown operator docs, GitHub Actions QA artifact.

---

## File Structure

- Modify: `test-artifacts/server/request-body-error-tests.mjs`
  - Add scoped source-contract checks for `handleChampionHistory(req, res)`.
  - Confirm the catch around `parseBody(req)` uses `riotErrorPayload(error)` and sends `{ status, body }`.
  - Confirm the raw `sendJson(res, 400, { ok: false, error: error.message || "invalid body" })` path is removed.
- Modify: `server.js`
  - Change the `/api/champion-history` parse-body catch to call `riotErrorPayload(error)`.
- Modify: `README.md`
  - Clarify that live API POST body errors, including champion history, return `INVALID_JSON_BODY` / `REQUEST_BODY_TOO_LARGE`.
- Modify: `docs/external-demo-runbook.md`
  - Clarify the same external-demo smoke expectation for `/api/champion-history`.
- Create: `docs/superpowers/plans/2026-06-08-champion-history-body-error-payload.md`
  - Track RED/GREEN, local QA, staged QA, GitHub Actions artifact, and Obsidian update evidence.

## Task 1: Write The Failing Regression Test

**Files:**
- Modify: `test-artifacts/server/request-body-error-tests.mjs`

- [ ] **Step 1: Extract the champion history handler source**

Add this line after the `harness` declaration:

```js
const championHistoryHandlerSrc = extractFunctionSource(serverSrc, "handleChampionHistory");
```

- [ ] **Step 2: Add source-contract checks**

Add these checks before the final summary:

```js
checkTrue("champion history body parse errors use stable payload mapper",
  championHistoryHandlerSrc.includes("const { status, body: errorBody } = riotErrorPayload(error);") &&
  championHistoryHandlerSrc.includes("sendJson(res, status, errorBody);"));

checkTrue("champion history body parse errors no longer expose raw error.message",
  !championHistoryHandlerSrc.includes('sendJson(res, 400, { ok: false, error: error.message || "invalid body" });'));
```

- [ ] **Step 3: Run the focused test and confirm RED**

Run:

```bash
node test-artifacts/server/request-body-error-tests.mjs
```

Expected result before implementation: command exits 1 with the new champion history source-contract checks failing.

## Task 2: Route Champion History Body Errors Through Stable Payloads

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Replace the parse-body catch**

Replace this block inside `handleChampionHistory(req, res)`:

```js
  try {
    body = await parseBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || "invalid body" });
    return;
  }
```

with:

```js
  try {
    body = await parseBody(req);
  } catch (error) {
    const { status, body: errorBody } = riotErrorPayload(error);
    sendJson(res, status, errorBody);
    return;
  }
```

- [ ] **Step 2: Run the focused test and confirm GREEN**

Run:

```bash
node test-artifacts/server/request-body-error-tests.mjs
```

Expected result after implementation: command exits 0 with every check passing.

## Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update README security note**

Change the live API body sentence in the environment/demo paragraph from:

```md
Live API POST endpoints return structured JSON for bad request bodies: malformed JSON returns HTTP 400 `INVALID_JSON_BODY`, and bodies over 1MB return HTTP 413 `REQUEST_BODY_TOO_LARGE`.
```

to:

```md
Live API POST endpoints, including `/api/champion-history`, return structured JSON for bad request bodies: malformed JSON returns HTTP 400 `INVALID_JSON_BODY`, and bodies over 1MB return HTTP 413 `REQUEST_BODY_TOO_LARGE`.
```

- [ ] **Step 2: Update external demo runbook expectation**

Change:

```md
- malformed live API JSON bodies fail as HTTP 400 `INVALID_JSON_BODY`; request bodies over 1MB fail as HTTP 413 `REQUEST_BODY_TOO_LARGE`, without leaking parser stack details
```

to:

```md
- malformed live API JSON bodies, including `/api/champion-history`, fail as HTTP 400 `INVALID_JSON_BODY`; request bodies over 1MB fail as HTTP 413 `REQUEST_BODY_TOO_LARGE`, without leaking parser stack details
```

## Task 4: Verify Local And Staged QA

**Files:**
- Check: `server.js`
- Check: `test-artifacts/server/request-body-error-tests.mjs`
- Check: all test files reached by `npm test`

- [ ] **Step 1: Run local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/request-body-error-tests.mjs
node test-artifacts/server/request-body-error-tests.mjs
npm test
git diff --check
```

Expected result: every command exits 0.

- [ ] **Step 2: Stage exact files and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-champion-history-body-error-payload.md server.js test-artifacts/server/request-body-error-tests.mjs
node --check server.js
node --check test-artifacts/server/request-body-error-tests.mjs
node test-artifacts/server/request-body-error-tests.mjs
npm test
git diff --cached --check
```

Expected staged files:

```text
M	README.md
M	docs/external-demo-runbook.md
A	docs/superpowers/plans/2026-06-08-champion-history-body-error-payload.md
M	server.js
M	test-artifacts/server/request-body-error-tests.mjs
```

## Task 5: Commit, Push, Remote QA, And Obsidian

**Files:**
- Commit staged files.
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Commit and push**

Run:

```bash
git commit -m "ci: stabilize champion history body errors"
git push origin main
```

Expected result: commit succeeds on `main`, and push updates `origin/main`.

- [ ] **Step 2: Verify GitHub Actions artifact**

Run:

```bash
gh run list --repo crisious/Web_LOL_Banpick --branch main --limit 10 --json databaseId,headSha,status,conclusion,createdAt
```

Watch the run for the pushed SHA, download the artifact, inspect `qa-summary.json`, and scan the artifact for:

```text
RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr.api.riotgames.com|getaddrinfo|Bearer|token=|access_token
```

Expected result: QA concludes `success`; read-only smoke has 155 passed and 0 failed; sensitive scan has no matches.

- [ ] **Step 3: Update Obsidian**

Update the project note top QA/status lines and append:

```md
### 2026-06-08 HH:MM KST - Champion history body error payload
```

Include RED/GREEN, local QA, staged QA, GitHub Actions run/artifact, sensitive scan, and final `main...origin/main` sync evidence.

---

## Progress Log

- [x] Plan saved.
- [x] RED confirmed: `node test-artifacts/server/request-body-error-tests.mjs` exited 1 with `9 passed, 2 failed`; new checks showed `handleChampionHistory(req, res)` did not use `riotErrorPayload(error)` for body parse failures and still exposed the raw `error.message` catch path.
- [x] GREEN confirmed: `node test-artifacts/server/request-body-error-tests.mjs` exited 0 with `11 passed, 0 failed` after the parse-body catch reused `riotErrorPayload(error)` and sent `sendJson(res, status, errorBody)`.
- [x] Local QA completed: placeholder scan exit `1`; `node --check server.js`; `node --check test-artifacts/server/request-body-error-tests.mjs`; `node test-artifacts/server/request-body-error-tests.mjs` `11 passed, 0 failed`; `npm test` `1264 passed, 0 failed across 39 test file(s)`; `git diff --check`.
- [x] Staged QA completed: `node --check server.js`; `node --check test-artifacts/server/request-body-error-tests.mjs`; `node test-artifacts/server/request-body-error-tests.mjs` `11 passed, 0 failed`; `npm test` `1264 passed, 0 failed across 39 test file(s)`; `git diff --cached --check`.
- [ ] Commit pushed to `origin/main`.
- [ ] GitHub Actions artifact checked.
- [ ] Obsidian updated.
