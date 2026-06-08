# Champion History Progress Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unused PUUID exposure from the `/api/champion-history` SSE `account` progress event while preserving the existing progress UI.

**Architecture:** The browser only needs `phase: "account"` to show the next progress label, so the server can keep account lookup internal and stream a phase-only event. A source-level regression test locks the SSE payload shape, and the external demo docs record the privacy contract for future QA.

**Tech Stack:** Node.js vanilla HTTP server, vanilla browser JavaScript, Node-based regression scripts, Markdown runbooks.

---

### Task 1: Lock the SSE Account Progress Contract

**Files:**
- Modify: `test-artifacts/server/champion-history-match-error-tests.mjs`
- Inspect: `server.js`
- Inspect: `main.js`

- [ ] **Step 1: Write the failing test**

Add these assertions after the existing `match-error` progress assertions in `test-artifacts/server/champion-history-match-error-tests.mjs`:

```js
checkTrue("account progress no longer emits puuid",
  !serverSrc.includes('safeWrite("progress", { phase: "account", puuid: account.puuid });'));

checkTrue("account progress keeps phase-only status",
  serverSrc.includes('safeWrite("progress", { phase: "account" });'));
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
node test-artifacts/server/champion-history-match-error-tests.mjs
```

Expected: the command exits non-zero and reports failures for `account progress no longer emits puuid` and `account progress keeps phase-only status`.

### Task 2: Emit Phase-Only Account Progress

**Files:**
- Modify: `server.js`
- Read-only confirmation: `main.js`

- [ ] **Step 1: Write the minimal implementation**

Change the `/api/champion-history` account progress event from:

```js
safeWrite("progress", { phase: "account", puuid: account.puuid });
```

to:

```js
safeWrite("progress", { phase: "account" });
```

Do not change `account.puuid` use in match ID lookup, ranked lookup, summaries, or local client cache logic.

- [ ] **Step 2: Run the focused test to verify GREEN**

Run:

```bash
node test-artifacts/server/champion-history-match-error-tests.mjs
```

Expected: the command exits zero, including passes for both account progress checks.

### Task 3: Document External Demo QA Coverage

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update the README security note**

Add a bullet near the external demo/data-pipeline security notes:

```markdown
- 챔피언 히스토리 SSE `account` progress event는 UI 진행 표시용 `phase`만 전송하고 PUUID를 브라우저 이벤트 payload에 포함하지 않습니다.
```

- [ ] **Step 2: Update the external demo runbook**

Extend the champion history QA checklist item to state:

```markdown
- champion history account progress emits only phase-level status without PUUID; partial match failures emit `match-error` progress with fixed copy; responses/events must not contain `RGAPI`, `api_key`, local paths, upstream hostnames, DNS text, parser text, or PUUID from the account lookup progress event
```

### Task 4: Verify and Publish

**Files:**
- Read: changed files
- Update after publish: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Run local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/champion-history-match-error-tests.mjs
node test-artifacts/server/champion-history-match-error-tests.mjs
npm test
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 2: Run staged QA**

After staging only the changed project files, run:

```bash
node --check server.js
node --check test-artifacts/server/champion-history-match-error-tests.mjs
node test-artifacts/server/champion-history-match-error-tests.mjs
npm test
git diff --cached --check
```

Expected: every command exits zero.

- [ ] **Step 3: Commit and push to main**

Run:

```bash
git commit -m "ci: hide champion history progress puuid"
git push origin main
```

Expected: push succeeds and `main...origin/main` returns `0	0` after fetch.

- [ ] **Step 4: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --name <artifact-name> --dir /tmp/lol-ai-coach-progress-privacy
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" /tmp/lol-ai-coach-progress-privacy
```

Expected: the run completes successfully and the sensitive scan exits with no matches.

### Self-Review

- Spec coverage: The plan covers test-first regression, server payload minimization, README/runbook documentation, local QA, staged QA, GitHub Actions verification, and Obsidian status capture.
- Placeholder scan: The plan contains concrete file paths, commands, snippets, expected failures, expected passes, and no deferred implementation markers.
- Type consistency: The tested strings match the intended `safeWrite("progress", { phase: "account" });` implementation and the existing Node test helper names.
