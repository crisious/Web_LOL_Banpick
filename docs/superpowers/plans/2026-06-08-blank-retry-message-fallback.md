# Blank Retry Message Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent blank or whitespace-only client error messages from rendering as an empty sentence followed by the retry hint.

**Architecture:** Keep the existing retry hint behavior in `formatRetryMessage()`. Normalize the raw error message first, then fall back to the existing Korean unknown-error copy whenever the trimmed message is empty.

**Tech Stack:** Vanilla browser JavaScript in `main.js`, existing zero-dependency main UI contract tests, Node.js test runner, GitHub Actions QA.

---

## File Structure

- Modify: `test-artifacts/main/demo-mode-ui-tests.mjs`
  - Adds a focused contract test for whitespace-only error messages.
- Modify: `main.js`
  - Updates `formatRetryMessage()` to use the default unknown-error copy after trimming blank messages.
- Modify: `docs/superpowers/plans/2026-06-08-blank-retry-message-fallback.md`
  - Records RED/GREEN/full QA/remote QA evidence as tasks complete.

### Task 1: Add Failing Blank Message Test

**Files:**
- Modify: `test-artifacts/main/demo-mode-ui-tests.mjs`

- [x] **Step 1: Add one formatter assertion after the generic retryable error assertion**

```js
check("blank error messages fall back to unknown error copy",
  formatRetryMessage({ message: "   " }),
  "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
```

- [x] **Step 2: Run focused main UI tests and verify RED**

Run:

```bash
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected:

```text
7 passed, 1 failed
```

The new blank-message check should fail because `formatRetryMessage()` currently trims the whitespace to an empty string, then appends the retry hint to that empty string.

Observed: `node test-artifacts/main/demo-mode-ui-tests.mjs` reported `7 passed, 1 failed`. The blank-message check failed with actual output `" 잠시 후 다시 시도하세요."`.

### Task 2: Use Fallback Copy After Trimming Blank Messages

**Files:**
- Modify: `main.js`

- [x] **Step 1: Update `formatRetryMessage()` raw message normalization**

Replace:

```js
  const baseMessage = String(error?.message || "알 수 없는 오류가 발생했습니다.").trim();
```

with:

```js
  const rawMessage = String(error?.message || "");
  const baseMessage = rawMessage.trim() || "알 수 없는 오류가 발생했습니다.";
```

- [x] **Step 2: Run focused main UI tests and verify GREEN**

Run:

```bash
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected:

```text
8 passed, 0 failed
```

Observed: `node test-artifacts/main/demo-mode-ui-tests.mjs` reported `8 passed, 0 failed`.

### Task 3: Full QA, Commit, Push, and Remote Artifact Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-blank-retry-message-fallback.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local full QA**

Run:

```bash
node --check main.js && node test-artifacts/main/demo-mode-ui-tests.mjs && npm test && git diff --check
```

Expected:

```text
8 passed, 0 failed
674 passed, 0 failed across 24 test file(s)
```

Observed: `node --check main.js && node test-artifacts/main/demo-mode-ui-tests.mjs && npm test && git diff --check` exited 0. Focused demo-mode UI tests reported `8 passed, 0 failed`; the full suite reported `674 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/demo-mode-ui-tests.mjs docs/superpowers/plans/2026-06-08-blank-retry-message-fallback.md
git commit -m "fix: fallback blank retry messages"
git push origin main
```

- [ ] **Step 3: Verify GitHub Actions QA artifact**

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

- [ ] **Step 4: Download and scan the QA artifact**

Run:

```bash
tmp_dir=$(mktemp -d /tmp/lol-ai-coach-blank-message.XXXXXX)
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

- [ ] **Step 5: Commit and push documentation evidence**

Run:

```bash
git add docs/superpowers/plans/2026-06-08-blank-retry-message-fallback.md
git commit -m "docs: record blank retry message qa"
git push origin main
```

- [ ] **Step 6: Verify final sync**

Run:

```bash
npm test && git pull --ff-only && git status -sb && git rev-list --left-right --count origin/main...HEAD && git log --oneline -8
```

Expected:

```text
674 passed, 0 failed across 24 test file(s)
Already up to date.
0	0
```
