# Readonly Demo Nonretryable Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop presenting intentional read-only external demo API blocks as retryable lookup failures.

**Architecture:** Keep the existing server-side read-only block unchanged. Add a tiny client-side message classifier used by `formatRetryMessage()` so deterministic public-demo lock messages are shown as-is while transient failures still receive the retry hint.

**Tech Stack:** Vanilla browser JavaScript in `main.js`, existing zero-dependency main UI contract tests, Node.js test runner, GitHub Actions QA.

---

## File Structure

- Modify: `test-artifacts/main/demo-mode-ui-tests.mjs`
  - Extracts `formatRetryMessage()` and its helper from `main.js`.
  - Adds tests for read-only demo block copy, generic retryable errors, and already-actionable messages.
- Modify: `main.js`
  - Adds `isNonRetryablePublicDemoMessage(message)`.
  - Updates `formatRetryMessage(error)` to return read-only demo block messages without appending `잠시 후 다시 시도하세요.`
- Modify: `docs/superpowers/plans/2026-06-08-readonly-demo-nonretryable-message.md`
  - Records RED/GREEN/full QA/remote QA evidence as tasks complete.

### Task 1: Add Failing Message Contract Tests

**Files:**
- Modify: `test-artifacts/main/demo-mode-ui-tests.mjs`

- [x] **Step 1: Extract the retry formatter under test**

Add the helper extraction after `serverModeUi` extraction:

```js
const formatRetryMessageSrc = extractFunctionSource(mainSrc, "formatRetryMessage");
const { formatRetryMessage } = new Function(`${formatRetryMessageSrc}\nreturn { formatRetryMessage };`)();
```

- [x] **Step 2: Add three formatter assertions after the existing demo mode assertions**

```js
check("readonly demo block message is not presented as retryable",
  formatRetryMessage(new Error("외부 데모 모드에서는 라이브 Riot API/샘플 생성 기능이 비활성화되어 있습니다.")),
  "외부 데모 모드에서는 라이브 Riot API/샘플 생성 기능이 비활성화되어 있습니다.");

check("generic lookup errors still include retry hint",
  formatRetryMessage(new Error("네트워크 연결이 불안정합니다.")),
  "네트워크 연결이 불안정합니다. 잠시 후 다시 시도하세요.");

check("already actionable retry messages are not duplicated",
  formatRetryMessage(new Error("샘플 생성이 이미 진행 중입니다. 잠시 후 다시 시도하세요.")),
  "샘플 생성이 이미 진행 중입니다. 잠시 후 다시 시도하세요.");
```

- [x] **Step 3: Run focused main UI tests and verify RED**

Run:

```bash
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected:

```text
6 passed, 1 failed
```

The new read-only demo block check should fail because `formatRetryMessage()` currently appends `잠시 후 다시 시도하세요.`

Observed: `node test-artifacts/main/demo-mode-ui-tests.mjs` reported `6 passed, 1 failed`. The read-only public demo block message failed because it was rendered as `외부 데모 모드에서는 라이브 Riot API/샘플 생성 기능이 비활성화되어 있습니다. 잠시 후 다시 시도하세요.`

### Task 2: Keep Read-Only Demo Blocks Nonretryable

**Files:**
- Modify: `main.js`
- Modify: `test-artifacts/main/demo-mode-ui-tests.mjs`

- [x] **Step 1: Add the classifier next to `formatRetryMessage()`**

```js
function isNonRetryablePublicDemoMessage(message) {
  return message.includes("외부 데모 모드에서는") && message.includes("비활성화");
}
```

- [x] **Step 2: Include the helper in the test extraction**

Change the test extraction to:

```js
const nonRetryablePublicDemoMessageSrc = extractFunctionSource(mainSrc, "isNonRetryablePublicDemoMessage");
const formatRetryMessageSrc = extractFunctionSource(mainSrc, "formatRetryMessage");
const { formatRetryMessage } = new Function(`${nonRetryablePublicDemoMessageSrc}\n${formatRetryMessageSrc}\nreturn { formatRetryMessage };`)();
```

- [x] **Step 3: Update `formatRetryMessage()`**

```js
function formatRetryMessage(error) {
  const baseMessage = String(error?.message || "알 수 없는 오류가 발생했습니다.").trim();
  if (isNonRetryablePublicDemoMessage(baseMessage)) {
    return baseMessage;
  }
  if (baseMessage.includes("다시 시도") || baseMessage.includes("잠시 후")) {
    return baseMessage;
  }
  return `${baseMessage} 잠시 후 다시 시도하세요.`;
}
```

- [x] **Step 4: Run focused main UI tests and verify GREEN**

Run:

```bash
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected:

```text
7 passed, 0 failed
```

Observed: `node test-artifacts/main/demo-mode-ui-tests.mjs` reported `7 passed, 0 failed`.

### Task 3: Full QA, Commit, Push, and Remote Artifact Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-readonly-demo-nonretryable-message.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local full QA**

Run:

```bash
node --check main.js && node test-artifacts/main/demo-mode-ui-tests.mjs && npm test && git diff --check
```

Expected:

```text
7 passed, 0 failed
673 passed, 0 failed across 24 test file(s)
```

Observed: `node --check main.js && node test-artifacts/main/demo-mode-ui-tests.mjs && npm test && git diff --check` exited 0. Focused demo-mode UI tests reported `7 passed, 0 failed`; the full suite reported `673 passed, 0 failed across 24 test file(s)`.

- [x] **Step 2: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/demo-mode-ui-tests.mjs docs/superpowers/plans/2026-06-08-readonly-demo-nonretryable-message.md
git commit -m "fix: clarify readonly demo block message"
git push origin main
```

Observed: committed and pushed `7839f5a fix: clarify readonly demo block message` to `origin/main`.

- [x] **Step 3: Verify GitHub Actions QA artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 10 --json databaseId,headSha,status,conclusion,createdAt,url,event,name
gh run watch <run-id> --exit-status
gh run view <run-id> --json databaseId,headSha,status,conclusion,url
```

Expected:

```text
"conclusion": "success"
```

Observed: GitHub Actions QA run `27103725738` completed with conclusion `success` for head SHA `7839f5a5c6aa61557117f8d2fbc735ff7c4ae6c9`.

- [x] **Step 4: Download and scan the QA artifact**

Run:

```bash
tmp_dir=$(mktemp -d /tmp/lol-ai-coach-readonly-message.XXXXXX)
gh run download <run-id> -n qa-automation-<run-id> -D "$tmp_dir"
find "$tmp_dir" -maxdepth 3 -type f | sort
sed -n '1,260p' "$tmp_dir/qa-summary.json"
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@" "$tmp_dir" || true
```

Expected:

```text
150 passed / 0 failed
no sensitive scan matches
```

Observed: artifact `qa-automation-27103725738` / id `7467628741` downloaded to `/tmp/lol-ai-coach-readonly-message.imcP5I`. `qa-summary.json` recorded read-only smoke `150 passed / 0 failed`, and the sensitive scan returned no matches.

- [ ] **Step 5: Commit and push documentation evidence**

Run:

```bash
git add docs/superpowers/plans/2026-06-08-readonly-demo-nonretryable-message.md
git commit -m "docs: record readonly demo message qa"
git push origin main
```

- [ ] **Step 6: Verify final sync**

Run:

```bash
npm test && git pull --ff-only && git status -sb && git rev-list --left-right --count origin/main...HEAD && git log --oneline -8
```

Expected:

```text
673 passed, 0 failed across 24 test file(s)
Already up to date.
0	0
```
