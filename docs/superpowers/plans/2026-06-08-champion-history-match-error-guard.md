# Champion History Match Error Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `/api/champion-history` SSE `match-error` progress events from exposing raw Riot/upstream error details when individual match detail requests fail.

**Architecture:** Keep champion history resilient when a few match detail calls fail: continue emitting `match-error` progress and keep counting omitted matches, but replace the raw `error.message` payload with a fixed Korean message. Add a helper-level and source-contract regression test so both the safe copy and the `safeWrite("progress", ...)` call site are proven.

**Tech Stack:** Node.js ESM regression scripts, `server.js` SSE progress events, README/runbook Markdown docs, GitHub Actions read-only smoke artifact.

---

## File Structure

- Create: `test-artifacts/server/champion-history-match-error-tests.mjs`
  - Extract `championHistoryMatchErrorMessage()` from `server.js`.
  - Verify fixed message output for raw Riot/upstream/path/parser error inputs.
  - Verify `/api/champion-history` no longer sends `message: error.message` in `match-error` progress events.
- Modify: `server.js`
  - Add `championHistoryMatchErrorMessage()`.
  - Replace the `match-error` SSE `message` field with that helper.
- Modify: `README.md`
  - Document that champion history partial match failures use a fixed SSE message.
- Modify: `docs/external-demo-runbook.md`
  - Record a protected/live smoke expectation for champion history partial match failures.
- Create: `docs/superpowers/plans/2026-06-08-champion-history-match-error-guard.md`
  - Track RED/GREEN, local QA, staged QA, GitHub Actions artifact, and Obsidian update evidence.

## Task 1: Write The Failing Regression Test

**Files:**
- Create: `test-artifacts/server/champion-history-match-error-tests.mjs`

- [ ] **Step 1: Add helper extraction and no-leak checks**

Create this test harness:

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

const src = extractFunctionSource(serverSrc, "championHistoryMatchErrorMessage");
const championHistoryMatchErrorMessage = new Function(`${src}\nreturn championHistoryMatchErrorMessage;`)();
```

Expected helper output:

```js
const SAFE_MATCH_ERROR = "일부 경기 정보를 불러오지 못했습니다.";
```

Test these inputs:

```js
new Error("getaddrinfo ENOTFOUND kr.api.riotgames.com?api_key=RGAPI-secret")
new Error("ENOENT: no such file or directory, open '/runtime/samples/secret.json'")
new Error("Unexpected token < in JSON at position 0")
null
undefined
```

For each input, assert the output is `SAFE_MATCH_ERROR` and does not contain:

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

Add source checks:

```js
checkTrue("match-error progress uses safe helper",
  serverSrc.includes("message: championHistoryMatchErrorMessage()"));

checkTrue("match-error progress no longer sends raw error.message",
  !serverSrc.includes('phase: "match-error", matchId: id, message: error.message'));
```

- [ ] **Step 3: Run the test and confirm RED**

Run:

```bash
node test-artifacts/server/champion-history-match-error-tests.mjs
```

Expected result before implementation: FAIL because `championHistoryMatchErrorMessage` does not exist and the `match-error` progress event still sends `message: error.message`.

## Task 2: Implement Safe Champion History Match Error Copy

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add helper near the other user-facing error copy helpers**

Add this helper after `rankedLookupErrorMessage()`:

```js
function championHistoryMatchErrorMessage() {
  return "일부 경기 정보를 불러오지 못했습니다.";
}
```

- [ ] **Step 2: Use the helper in the `match-error` SSE event**

Replace:

```js
safeWrite("progress", { phase: "match-error", matchId: id, message: error.message });
```

with:

```js
safeWrite("progress", { phase: "match-error", matchId: id, message: championHistoryMatchErrorMessage() });
```

Keep the `phase` and `matchId` fields unchanged so the client can still count omitted matches.

## Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update README security notes**

Add:

```md
- Champion history SSE `match-error` progress events keep `phase` and `matchId` for omission counting but use a fixed message without upstream hostnames, request URLs, parser text, local paths, or token-like strings.
```

- [ ] **Step 2: Update external demo runbook smoke expectations**

Add:

```md
- Champion history partial match failures should emit `match-error` progress with fixed copy; responses/events must not include `RGAPI`, `api_key`, local paths, upstream hostnames, DNS text, or parser text.
```

## Task 4: Verify Local And Staged QA

**Files:**
- Check: `server.js`
- Check: `test-artifacts/server/champion-history-match-error-tests.mjs`
- Check: all test files reached by `npm test`

- [ ] **Step 1: Run local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/champion-history-match-error-tests.mjs
node test-artifacts/server/champion-history-match-error-tests.mjs
npm test
git diff --check
```

Expected result: every command exits 0.

- [ ] **Step 2: Stage exact files and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-champion-history-match-error-guard.md server.js test-artifacts/server/champion-history-match-error-tests.mjs
node --check server.js
node --check test-artifacts/server/champion-history-match-error-tests.mjs
node test-artifacts/server/champion-history-match-error-tests.mjs
npm test
git diff --cached --check
```

Expected staged files:

```text
M	README.md
M	docs/external-demo-runbook.md
A	docs/superpowers/plans/2026-06-08-champion-history-match-error-guard.md
M	server.js
A	test-artifacts/server/champion-history-match-error-tests.mjs
```

## Task 5: Commit, Push, Remote QA, And Obsidian

**Files:**
- Commit staged files.
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Commit and push**

Run:

```bash
git commit -m "ci: hide champion history match errors"
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
### 2026-06-08 HH:MM KST - Champion history match error guard
```

Include RED/GREEN, local QA, staged QA, GitHub Actions run/artifact, sensitive scan, and final `main...origin/main` sync evidence.

---

## Progress Log

- [x] Plan saved.
- [x] RED confirmed: `node test-artifacts/server/champion-history-match-error-tests.mjs` exited 1 with `0 passed, 3 failed` before production changes. Failures showed `championHistoryMatchErrorMessage` missing, `match-error` progress not using the helper, and raw `error.message` still sent in SSE progress payloads.
- [x] GREEN confirmed: `node test-artifacts/server/champion-history-match-error-tests.mjs` exited 0 with `48 passed, 0 failed` after `championHistoryMatchErrorMessage()` was wired into the `match-error` progress event.
- [x] Local QA completed: placeholder scan exit `1`; `node --check server.js`; `node --check test-artifacts/server/champion-history-match-error-tests.mjs`; `node test-artifacts/server/champion-history-match-error-tests.mjs` `48 passed, 0 failed`; `npm test` `1254 passed, 0 failed across 39 test file(s)`; `git diff --check`.
- [x] Staged QA completed: staged files were `README.md`, `docs/external-demo-runbook.md`, this plan file, `server.js`, and `test-artifacts/server/champion-history-match-error-tests.mjs`; `node --check server.js`; `node --check test-artifacts/server/champion-history-match-error-tests.mjs`; focused champion history match-error regression `48 passed, 0 failed`; `npm test` `1254 passed, 0 failed across 39 test file(s)`; `git diff --cached --check`.
- [ ] Commit pushed to `origin/main`.
- [ ] GitHub Actions artifact checked.
- [ ] Obsidian updated.
