# Sample Generation Duplicate Payload Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate sample generation 409 responses from exposing match identifiers while preserving the stable `SAMPLE_GENERATION_IN_PROGRESS` code.

**Architecture:** Keep the same-process `platformRegion + matchId` lock key internal. Change only the public duplicate-work payload so it contains `ok`, `code`, and user-facing `error`, with no `matchId` or lock-derived identifier fields.

**Tech Stack:** Node.js HTTP server, Node ESM regression tests, README/runbook Markdown docs, GitHub Actions read-only smoke artifact.

---

## File Structure

- Modify: `test-artifacts/server/generate-sample-lock-tests.mjs`
  - Change the payload assertions so `sampleGenerationInProgressPayload()` and duplicate lock errors do not expose `matchId`.
  - Keep existing assertions that the lock key still uses `platformRegion + matchId` internally and rejects duplicates with HTTP 409.
- Modify: `server.js`
  - Remove `matchId` from `sampleGenerationInProgressPayload()`.
  - Stop deriving public payload data from the lock key inside `withSampleGenerationLock()`.
- Modify: `README.md`
  - Document that duplicate generation 409 responses expose only the stable code and user copy, not match IDs or lock keys.
- Modify: `docs/external-demo-runbook.md`
  - Document the same protected/writable demo expectation.
- Create: `docs/superpowers/plans/2026-06-08-sample-generation-duplicate-payload-privacy.md`
  - Track RED/GREEN, local QA, staged QA, GitHub Actions artifact, and Obsidian update evidence.

## Task 1: Write The Failing Regression Test

**Files:**
- Modify: `test-artifacts/server/generate-sample-lock-tests.mjs`

- [ ] **Step 1: Replace the direct payload matchId assertion**

Replace:

```js
  check("in-progress payload includes matchId", payload.matchId, "KR_8242613150");
```

with:

```js
  check("in-progress payload does not expose matchId",
    Object.prototype.hasOwnProperty.call(payload, "matchId"),
    false);
  checkTrue("in-progress payload does not expose lock-derived identifiers",
    !JSON.stringify(payload).includes("KR_8242613150"));
```

- [ ] **Step 2: Replace the duplicate lock matchId assertion**

Replace:

```js
  check("duplicate lock does not run second job", secondError?.payload?.matchId, "KR_8242613150");
```

with:

```js
  check("duplicate lock payload does not expose matchId",
    Object.prototype.hasOwnProperty.call(secondError?.payload || {}, "matchId"),
    false);
  checkTrue("duplicate lock payload does not expose lock-derived identifiers",
    !JSON.stringify(secondError?.payload || {}).includes("KR_8242613150"));
```

- [ ] **Step 3: Run the focused test and confirm RED**

Run:

```bash
node test-artifacts/server/generate-sample-lock-tests.mjs
```

Expected result before implementation: command exits 1 because `sampleGenerationInProgressPayload("KR_8242613150")` still includes `matchId`, and duplicate lock errors still expose that match ID in the payload.

## Task 2: Remove Public Match IDs From Duplicate Generation Payloads

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Change the payload helper signature and body**

Replace:

```js
function sampleGenerationInProgressPayload(matchId) {
  return {
    ok: false,
    code: "SAMPLE_GENERATION_IN_PROGRESS",
    error: "이미 이 경기 샘플 생성이 진행 중입니다. 완료 후 샘플 목록을 확인하세요.",
    matchId,
  };
}
```

with:

```js
function sampleGenerationInProgressPayload() {
  return {
    ok: false,
    code: "SAMPLE_GENERATION_IN_PROGRESS",
    error: "이미 이 경기 샘플 생성이 진행 중입니다. 완료 후 샘플 목록을 확인하세요.",
  };
}
```

- [ ] **Step 2: Stop passing lock-derived IDs into the payload helper**

Replace:

```js
    error.payload = sampleGenerationInProgressPayload(String(lockKey || "").split(":").slice(1).join(":"));
```

with:

```js
    error.payload = sampleGenerationInProgressPayload();
```

- [ ] **Step 3: Run the focused test and confirm GREEN**

Run:

```bash
node test-artifacts/server/generate-sample-lock-tests.mjs
```

Expected result after implementation: command exits 0 with every check passing.

## Task 3: Update Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update README security note**

Change:

```md
- 중복 생성 방지: 동일 `platformRegion + matchId` 샘플 생성이 진행 중이면 `/api/generate-sample`은 409 `SAMPLE_GENERATION_IN_PROGRESS`로 새 작업을 막음
```

to:

```md
- 중복 생성 방지: 동일 `platformRegion + matchId` 샘플 생성이 진행 중이면 `/api/generate-sample`은 409 `SAMPLE_GENERATION_IN_PROGRESS`로 새 작업을 막고, 응답에는 matchId나 lock key를 포함하지 않음
```

- [ ] **Step 2: Update external demo runbook cloud deploy paragraph**

Change:

```md
Writable sample generation now has a same-process `platformRegion + matchId` lock that returns 409 `SAMPLE_GENERATION_IN_PROGRESS` for duplicate work;
```

to:

```md
Writable sample generation now has a same-process `platformRegion + matchId` lock that returns 409 `SAMPLE_GENERATION_IN_PROGRESS` for duplicate work without exposing match IDs or lock keys in the response;
```

## Task 4: Verify Local And Staged QA

**Files:**
- Check: `server.js`
- Check: `test-artifacts/server/generate-sample-lock-tests.mjs`
- Check: all test files reached by `npm test`

- [ ] **Step 1: Run local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/generate-sample-lock-tests.mjs
node test-artifacts/server/generate-sample-lock-tests.mjs
npm test
git diff --check
```

Expected result: every command exits 0.

- [ ] **Step 2: Stage exact files and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-sample-generation-duplicate-payload-privacy.md server.js test-artifacts/server/generate-sample-lock-tests.mjs
node --check server.js
node --check test-artifacts/server/generate-sample-lock-tests.mjs
node test-artifacts/server/generate-sample-lock-tests.mjs
npm test
git diff --cached --check
```

Expected staged files:

```text
M	README.md
M	docs/external-demo-runbook.md
A	docs/superpowers/plans/2026-06-08-sample-generation-duplicate-payload-privacy.md
M	server.js
M	test-artifacts/server/generate-sample-lock-tests.mjs
```

## Task 5: Commit, Push, Remote QA, And Obsidian

**Files:**
- Commit staged files.
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Commit and push**

Run:

```bash
git commit -m "ci: hide duplicate generation match ids"
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
RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr.api.riotgames.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey
```

Expected result: QA concludes `success`; read-only smoke has 155 passed and 0 failed; sensitive scan has no matches.

- [ ] **Step 3: Update Obsidian**

Update the project note top QA/status lines and append:

```md
### 2026-06-08 HH:MM KST - Sample generation duplicate payload privacy
```

Include RED/GREEN, local QA, staged QA, GitHub Actions run/artifact, sensitive scan, and final `main...origin/main` sync evidence.

---

## Progress Log

- [x] Plan saved.
- [x] RED confirmed: `node test-artifacts/server/generate-sample-lock-tests.mjs` exited 1 with `19 passed, 4 failed`; failures showed `sampleGenerationInProgressPayload("KR_8242613150")` and duplicate lock errors exposed `matchId` / lock-derived identifiers.
- [x] GREEN confirmed: `node test-artifacts/server/generate-sample-lock-tests.mjs` exited 0 with `23 passed, 0 failed` after removing `matchId` from the public duplicate-generation payload and no longer deriving payload fields from `lockKey`.
- [x] Local QA completed: placeholder scan exit `1`; `node --check server.js`; `node --check test-artifacts/server/generate-sample-lock-tests.mjs`; `node test-artifacts/server/generate-sample-lock-tests.mjs` `23 passed, 0 failed`; `npm test` `1266 passed, 0 failed across 39 test file(s)`; `git diff --check`.
- [x] Staged QA completed: `node --check server.js`; `node --check test-artifacts/server/generate-sample-lock-tests.mjs`; `node test-artifacts/server/generate-sample-lock-tests.mjs` `23 passed, 0 failed`; `npm test` `1266 passed, 0 failed across 39 test file(s)`; `git diff --cached --check`.
- [ ] Commit pushed to `origin/main`.
- [ ] GitHub Actions artifact checked.
- [ ] Obsidian updated.
