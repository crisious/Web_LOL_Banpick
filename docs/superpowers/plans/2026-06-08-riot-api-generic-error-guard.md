# Riot API Generic Error Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize non-auth and non-rate Riot/live API failures into a stable `RIOT_API_ERROR` response that does not expose upstream messages, local paths, URLs, or tokens.

**Architecture:** Keep the existing `riotErrorPayload(error)` boundary in `server.js`. Preserve the special user-facing mappings for Riot 401/403 and 429, while routing every other Riot or generic thrown error to one generic 500 payload. Extend the existing helper-level regression test so the expected behavior is proven before production code changes.

**Tech Stack:** Node.js ESM regression scripts, `server.js` HTTP API helper functions, README/runbook Markdown docs, GitHub Actions smoke artifact.

---

## File Structure

- Modify: `test-artifacts/server/riot-error-tests.mjs`
  - Update helper-level regression cases for `riotErrorPayload(error)`.
  - Add no-leak checks for path, URL, token-like, DNS, and parser details.
- Modify: `server.js`
  - Add `genericRiotApiErrorPayload()`.
  - Update `riotErrorPayload(error)` fallback branches to use the generic payload.
- Modify: `README.md`
  - Document that generic Riot/live API failures return `RIOT_API_ERROR` without raw upstream details.
- Modify: `docs/external-demo-runbook.md`
  - Record the external-demo QA expectation for generic Riot/live API errors.
- Create: `docs/superpowers/plans/2026-06-08-riot-api-generic-error-guard.md`
  - Track the plan, RED/GREEN evidence, local QA, staged QA, GitHub Actions, and Obsidian update.

## Task 1: Write The Failing Regression Test

**Files:**
- Modify: `test-artifacts/server/riot-error-tests.mjs`

- [ ] **Step 1: Replace the generic fallback expectations**

Use this expected payload inside the test file:

```js
const GENERIC_RIOT_API_ERROR = {
  ok: false,
  code: "RIOT_API_ERROR",
  error: "Riot API 요청을 처리하는 중 오류가 발생했습니다.",
};
```

Update the 500, 404, plain Error, null, undefined, and string `riotStatus` cases so they expect:

```js
check("500: status", out.status, 500);
check("500: body", out.body, GENERIC_RIOT_API_ERROR);
```

Add no-leak assertions for sensitive raw strings:

```js
function checkNoRawDetails(label, payloadText) {
  const blocked = [
    "ENOENT",
    "/runtime/samples",
    "secret.json",
    "kr.api.riotgames.com",
    "RGAPI-secret",
    "api_key",
    "getaddrinfo",
    "Unexpected token",
  ];
  for (const token of blocked) {
    checkTrue(`${label}: does not expose ${token}`,
      !payloadText.includes(token));
  }
}
```

Use `JSON.stringify(out.body)` as the `payloadText` for each generic fallback case.

- [ ] **Step 2: Run the regression script and confirm RED**

Run:

```bash
node test-artifacts/server/riot-error-tests.mjs
```

Expected result before production changes: FAIL on the generic fallback cases because `riotErrorPayload(error)` still returns raw `error.message` or `String(error)`.

## Task 2: Implement The Generic Riot API Error Payload

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add a helper near `riotErrorPayload(error)`**

Add this helper immediately before `riotErrorPayload(error)`:

```js
function genericRiotApiErrorPayload() {
  return {
    status: 500,
    body: {
      ok: false,
      code: "RIOT_API_ERROR",
      error: "Riot API 요청을 처리하는 중 오류가 발생했습니다.",
    },
  };
}
```

- [ ] **Step 2: Route non-special fallback paths through the helper**

Keep the existing 401/403 and 429 branches. Replace the final fallback with:

```js
return genericRiotApiErrorPayload();
```

Also route non-numeric `riotStatus`, `null`, and `undefined` into the same helper by relying on the final fallback path.

- [ ] **Step 3: Update the nearby comment**

Use this comment above the helper:

```js
// Track B: Riot 401/403/429 -> 사용자 친화적 코드 + 힌트로 normalize.
// 그 외 Riot/live API 오류는 외부 세부 정보를 숨기는 고정 500 코드로 normalize.
```

## Task 3: Verify Local Behavior

**Files:**
- Check: `server.js`
- Check: `test-artifacts/server/riot-error-tests.mjs`
- Check: all test files reached by `npm test`

- [ ] **Step 1: Run syntax checks**

Run:

```bash
node --check server.js
node --check test-artifacts/server/riot-error-tests.mjs
```

Expected result: both commands exit 0.

- [ ] **Step 2: Run the focused regression script**

Run:

```bash
node test-artifacts/server/riot-error-tests.mjs
```

Expected result after implementation: every check passes and the script exits 0.

- [ ] **Step 3: Run the full local QA suite**

Run:

```bash
npm test
git diff --check
```

Expected result: full suite exits 0, and whitespace check exits 0.

## Task 4: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update README**

Add a note in the Riot/API or external-demo section:

```md
- Riot/live API generic failures return `RIOT_API_ERROR` with a fixed Korean message; raw upstream messages, request URLs, local paths, and token-like strings are not returned to the browser.
```

- [ ] **Step 2: Update external demo runbook**

Add a smoke-test expectation:

```md
- Generic Riot/live API failures should surface `RIOT_API_ERROR` only; confirm responses do not contain `RGAPI`, `api_key`, local file paths, upstream hostnames, parser text, or DNS error strings.
```

## Task 5: Stage, Commit, Push, And Remote QA

**Files:**
- Stage: `README.md`
- Stage: `docs/external-demo-runbook.md`
- Stage: `docs/superpowers/plans/2026-06-08-riot-api-generic-error-guard.md`
- Stage: `server.js`
- Stage: `test-artifacts/server/riot-error-tests.mjs`

- [ ] **Step 1: Stage exact files**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-riot-api-generic-error-guard.md server.js test-artifacts/server/riot-error-tests.mjs
git diff --cached --name-status
```

Expected staged files:

```text
M	README.md
M	docs/external-demo-runbook.md
A	docs/superpowers/plans/2026-06-08-riot-api-generic-error-guard.md
M	server.js
M	test-artifacts/server/riot-error-tests.mjs
```

- [ ] **Step 2: Run staged QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/riot-error-tests.mjs
node test-artifacts/server/riot-error-tests.mjs
npm test
git diff --cached --check
```

Expected result: all commands exit 0.

- [ ] **Step 3: Commit and push main**

Run:

```bash
git commit -m "ci: hide generic riot api errors"
git push origin main
```

Expected result: commit succeeds on `main`, and push updates `origin/main`.

- [ ] **Step 4: Verify GitHub Actions artifact**

Run:

```bash
gh run list --repo crisious/Web_LOL_Banpick --branch main --limit 10 --json databaseId,headSha,status,conclusion,createdAt
```

Then inspect the newest run for the pushed SHA. Download the smoke artifact, inspect `smoke-report.json`, and scan it for `RGAPI`, `api_key`, `/Users/`, `/runtime/samples`, `ENOENT`, `Unexpected token`, `kr.api.riotgames.com`, and `getaddrinfo`.

Expected result: GitHub Actions run concludes `success`; smoke report has 155 passed and 0 failed; sensitive scan has no matches.

## Task 6: Update Obsidian Project Note

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Update current QA/status blocks**

Update the top “최근 QA” and “현재 저장소 상태” sections with:

```md
- Riot API generic error guard regression script result and full `npm test` count.
- GitHub Actions run id, artifact id, smoke result, and sensitive scan result.
- Latest `main` commit hash and `origin/main` sync state.
```

- [ ] **Step 2: Append cycle log before `## 리스크 관리`**

Add a dated entry titled:

```md
### 2026-06-08 HH:MM KST - Riot API generic error guard
```

Record local QA, staged QA, GitHub Actions artifact, and sync evidence in that entry.

---

## Progress Log

- [x] Plan saved.
- [x] RED confirmed: `node test-artifacts/server/riot-error-tests.mjs` exited 1 with `57 passed, 14 failed` before `server.js` changed. Failures showed raw `ENOENT`, `/runtime/samples`, `secret.json`, `Unexpected token`, `kr.api.riotgames.com`, `RGAPI-secret`, `api_key`, and `getaddrinfo` leakage in generic fallback payloads.
- [x] GREEN confirmed: `node test-artifacts/server/riot-error-tests.mjs` exited 0 with `71 passed, 0 failed` after `genericRiotApiErrorPayload()` was wired into `riotErrorPayload(error)`.
- [x] Local QA completed: placeholder scan exit `1`; `node --check server.js`; `node --check test-artifacts/server/riot-error-tests.mjs`; `node --check test-artifacts/server/request-body-error-tests.mjs`; `node test-artifacts/server/request-body-error-tests.mjs` `9 passed, 0 failed`; `node test-artifacts/server/riot-error-tests.mjs` `71 passed, 0 failed`; `npm test` `1158 passed, 0 failed across 37 test file(s)`; `git diff --check`.
- [x] Staged QA completed: staged files were `README.md`, `docs/external-demo-runbook.md`, this plan file, `server.js`, and `test-artifacts/server/riot-error-tests.mjs`; `node --check server.js`; `node --check test-artifacts/server/riot-error-tests.mjs`; `node --check test-artifacts/server/request-body-error-tests.mjs`; focused request-body and Riot error scripts passed; `npm test` `1158 passed, 0 failed across 37 test file(s)`; `git diff --cached --check`.
- [ ] Commit pushed to `origin/main`.
- [ ] GitHub Actions artifact checked.
- [ ] Obsidian updated.
