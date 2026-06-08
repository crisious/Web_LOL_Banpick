# Ranked Error Message Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent optional ranked lookup failures inside `/api/recent-matches` from returning raw Riot/upstream error details in the successful match-list JSON response.

**Architecture:** Keep `/api/recent-matches` resilient when account, match IDs, and match details succeed but `league-v4/entries/by-puuid` fails. Replace the direct `rankedLookupError.message` pass-through with a small helper that returns a fixed Korean message, then prove the helper and the call site through regression tests. Preserve the existing `rankedStatus: "error"` signal so the UI can still explain that rank information is temporarily unavailable.

**Tech Stack:** Node.js ESM regression scripts, `server.js` HTTP API helper functions, README/runbook Markdown docs, GitHub Actions read-only smoke artifact.

---

## File Structure

- Create: `test-artifacts/server/ranked-error-message-tests.mjs`
  - Extract helper source from `server.js`.
  - Verify fixed ranked lookup fallback copy.
  - Verify raw `ENOENT`, local paths, Riot token-like values, URL query keys, upstream hostnames, DNS text, and parser text are not exposed.
  - Verify `/api/recent-matches` no longer assigns `rankedLookupError?.message` to `rankedError`.
- Modify: `server.js`
  - Add `rankedLookupErrorMessage()`.
  - Replace `rankedError = rankedLookupError?.message || "ranked lookup failed";` with `rankedError = rankedLookupErrorMessage();`.
- Modify: `README.md`
  - Document that optional ranked lookup failures use a fixed browser-facing message.
- Modify: `docs/external-demo-runbook.md`
  - Record a smoke/QA expectation for ranked lookup partial failures.
- Create: `docs/superpowers/plans/2026-06-08-ranked-error-message-guard.md`
  - Track RED/GREEN, local QA, staged QA, GitHub Actions artifact, and Obsidian update evidence.

## Task 1: Write The Failing Regression Test

**Files:**
- Create: `test-artifacts/server/ranked-error-message-tests.mjs`

- [ ] **Step 1: Add helper extraction and checks**

Create the test file with this structure:

```js
import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const src = extractFunctionSource(serverSrc, "rankedLookupErrorMessage");
const rankedLookupErrorMessage = new Function(`${src}\nreturn rankedLookupErrorMessage;`)();
```

Expected helper return value:

```js
const SAFE_RANKED_ERROR = "랭크 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.";
```

Test these inputs:

```js
new Error("getaddrinfo ENOTFOUND kr.api.riotgames.com?api_key=RGAPI-secret")
new Error("ENOENT: no such file or directory, open '/runtime/samples/secret.json'")
new Error("Unexpected token < in JSON at position 0")
null
undefined
```

Each input should return `SAFE_RANKED_ERROR` and not contain:

```js
[
  "ENOENT",
  "/runtime/samples",
  "secret.json",
  "kr.api.riotgames.com",
  "RGAPI-secret",
  "api_key",
  "getaddrinfo",
  "Unexpected token",
]
```

- [ ] **Step 2: Add source contract checks**

Add checks against `serverSrc`:

```js
checkTrue("recent matches uses rankedLookupErrorMessage for rankedError",
  serverSrc.includes("rankedError = rankedLookupErrorMessage();"));

checkTrue("recent matches no longer passes raw ranked error messages",
  !serverSrc.includes("rankedError = rankedLookupError?.message"));
```

- [ ] **Step 3: Run the test and confirm RED**

Run:

```bash
node test-artifacts/server/ranked-error-message-tests.mjs
```

Expected result before implementation: FAIL because `rankedLookupErrorMessage` does not exist and the source still assigns `rankedLookupError?.message`.

## Task 2: Implement Safe Ranked Lookup Error Copy

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add helper near `riotErrorPayload(error)`**

Add this helper after `genericRiotApiErrorPayload()`:

```js
function rankedLookupErrorMessage() {
  return "랭크 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.";
}
```

- [ ] **Step 2: Use the helper in `/api/recent-matches`**

Replace:

```js
rankedError = rankedLookupError?.message || "ranked lookup failed";
```

with:

```js
rankedError = rankedLookupErrorMessage();
```

Keep `rankedStatus = "error";` unchanged.

## Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update README security notes**

Add:

```md
- Recent match responses keep `rankedStatus: "error"` for optional ranked lookup failures but use a fixed `rankedError` message without upstream hostnames, request URLs, parser text, local paths, or token-like strings.
```

- [ ] **Step 2: Update external demo runbook smoke expectations**

Add:

```md
- Partial ranked lookup failures in `/api/recent-matches` should keep a stable `rankedStatus: "error"` and a fixed `rankedError`; confirm the response does not include `RGAPI`, `api_key`, local paths, upstream hostnames, DNS text, or parser text.
```

## Task 4: Verify Local And Staged QA

**Files:**
- Check: `server.js`
- Check: `test-artifacts/server/ranked-error-message-tests.mjs`
- Check: all test files reached by `npm test`

- [ ] **Step 1: Run local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/ranked-error-message-tests.mjs
node test-artifacts/server/ranked-error-message-tests.mjs
npm test
git diff --check
```

Expected result: every command exits 0.

- [ ] **Step 2: Stage exact files and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-ranked-error-message-guard.md server.js test-artifacts/server/ranked-error-message-tests.mjs
node --check server.js
node --check test-artifacts/server/ranked-error-message-tests.mjs
node test-artifacts/server/ranked-error-message-tests.mjs
npm test
git diff --cached --check
```

Expected staged files:

```text
M	README.md
M	docs/external-demo-runbook.md
A	docs/superpowers/plans/2026-06-08-ranked-error-message-guard.md
M	server.js
A	test-artifacts/server/ranked-error-message-tests.mjs
```

## Task 5: Commit, Push, Remote QA, And Obsidian

**Files:**
- Commit staged files.
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Commit and push**

Run:

```bash
git commit -m "ci: hide ranked lookup errors"
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
### 2026-06-08 HH:MM KST - Ranked lookup error message guard
```

Include RED/GREEN, local QA, staged QA, GitHub Actions run/artifact, sensitive scan, and final `main...origin/main` sync evidence.

---

## Progress Log

- [x] Plan saved.
- [x] RED confirmed: `node test-artifacts/server/ranked-error-message-tests.mjs` exited 1 with `0 passed, 3 failed` before production changes. Failures showed `rankedLookupErrorMessage` missing, `/api/recent-matches` not using the helper, and raw `rankedLookupError?.message` still assigned to `rankedError`.
- [x] GREEN confirmed: `node test-artifacts/server/ranked-error-message-tests.mjs` exited 0 with `48 passed, 0 failed` after `rankedLookupErrorMessage()` was wired into `/api/recent-matches`.
- [x] Local QA completed: placeholder scan exit `1`; `node --check server.js`; `node --check test-artifacts/server/ranked-error-message-tests.mjs`; `node test-artifacts/server/ranked-error-message-tests.mjs` `48 passed, 0 failed`; `npm test` `1206 passed, 0 failed across 38 test file(s)`; `git diff --check`.
- [x] Staged QA completed: staged files were `README.md`, `docs/external-demo-runbook.md`, this plan file, `server.js`, and `test-artifacts/server/ranked-error-message-tests.mjs`; `node --check server.js`; `node --check test-artifacts/server/ranked-error-message-tests.mjs`; focused ranked regression `48 passed, 0 failed`; `npm test` `1206 passed, 0 failed across 38 test file(s)`; `git diff --cached --check`.
- [ ] Commit pushed to `origin/main`.
- [ ] GitHub Actions artifact checked.
- [ ] Obsidian updated.
