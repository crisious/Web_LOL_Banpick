# Protected Token Duplicate Header Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject duplicate or array-shaped protected demo token headers instead of authenticating with the first header value.

**Architecture:** Keep `firstHeaderValue()` unchanged for non-auth uses such as proxy IP extraction. Add a token-specific single-value helper so `Authorization` and `x-demo-token` fail closed when their parsed header value is an array. Preserve the existing exact bearer contract and `Authorization` precedence over `x-demo-token`.

**Tech Stack:** Node.js CommonJS server, custom `.mjs` regression tests, README/runbook documentation, GitHub Actions QA workflow.

---

### Task 1: Add RED Coverage For Duplicate Token Headers

**Files:**
- Modify: `test-artifacts/server/public-demo-mode-gate-tests.mjs`

- [x] **Step 1: Add failing protected mode checks**

Insert these checks after the existing successful exact bearer check:

```js
  const duplicateBearerRes = makeResponseRecorder();
  check("protected mode rejects duplicate Authorization header values",
    protectedGate.requireLiveApiAccess({ headers: { authorization: ["Bearer demo-secret", "Basic other"] } }, duplicateBearerRes),
    false);
  check("protected mode duplicate Authorization returns unauthorized code",
    duplicateBearerRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");
```

Insert these checks after the existing trailing `x-demo-token` checks:

```js
  const duplicateHeaderTokenRes = makeResponseRecorder();
  check("protected mode rejects duplicate x-demo-token values",
    protectedGate.requireLiveApiAccess({ headers: { "x-demo-token": ["demo-secret", "other-secret"] } }, duplicateHeaderTokenRes),
    false);
  check("protected mode duplicate x-demo-token returns unauthorized code",
    duplicateHeaderTokenRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");
```

- [x] **Step 2: Run focused RED test**

Run:

```bash
node test-artifacts/server/public-demo-mode-gate-tests.mjs
```

Expected before implementation: exit `1`; existing tests pass, and the two new duplicate-header allowance checks fail because current `firstHeaderValue()` authenticates the first array entry.

Observed: RED confirmed. Public demo mode gate tests reported `63 passed, 4 failed`; the failing checks were duplicate `Authorization` and duplicate `x-demo-token` values authenticating through the first array entry.

### Task 2: Implement Token-Specific Single Header Guard

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add a token header helper**

Add this helper after `firstHeaderValue()`:

```js
function tokenHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0 ? "\u0000invalid-duplicate-header" : "";
  }
  return String(value || "");
}
```

- [x] **Step 2: Use the helper in `tokenFromRequest()`**

Replace the body of `tokenFromRequest()` with:

```js
function tokenFromRequest(req) {
  const auth = tokenHeaderValue(req.headers.authorization);
  const bearerPrefix = "Bearer ";
  if (auth.startsWith(bearerPrefix)) return auth.slice(bearerPrefix.length);
  if (auth) return "\u0000invalid-authorization";
  return tokenHeaderValue(req.headers["x-demo-token"]);
}
```

- [x] **Step 3: Run focused GREEN test**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/public-demo-mode-gate-tests.mjs &&
node test-artifacts/server/public-demo-mode-gate-tests.mjs
```

Expected after implementation: exit `0`, public demo mode gate tests report `67 passed, 0 failed`.

Observed: GREEN confirmed. Syntax checks for `server.js` and `test-artifacts/server/public-demo-mode-gate-tests.mjs` passed; public demo mode gate tests reported `67 passed, 0 failed`.

### Task 3: Document Duplicate Header Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-protected-token-duplicate-header-guard.md`

- [x] **Step 1: Update protected token documentation**

In the protected token paragraph of `README.md` and `docs/external-demo-runbook.md`, add that duplicate or array-shaped `Authorization` / `x-demo-token` values are rejected rather than using the first value.

- [x] **Step 2: Scan plan placeholders**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-protected-token-duplicate-header-guard.md
```

Expected: exit `1`, no placeholder matches.

Observed: Placeholder scan exited `1`, no matches.

### Task 4: Full QA, Commit, Push, And Remote Evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-protected-token-duplicate-header-guard.md`
- Modify: `server.js`
- Modify: `test-artifacts/server/public-demo-mode-gate-tests.mjs`

- [x] **Step 1: Run local QA**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/public-demo-mode-gate-tests.mjs &&
node test-artifacts/server/public-demo-mode-gate-tests.mjs &&
npm test &&
git diff --check
```

Expected: exit `0`; focused tests report `67 passed, 0 failed`; full suite reports `1014 passed, 0 failed across 32 test file(s)`.

Observed: Local QA exited `0`. Placeholder scan exited `1`; syntax checks passed; public demo mode gate tests reported `67 passed, 0 failed`; `npm test` reported `1014 passed, 0 failed across 32 test file(s)`; `git diff --check` passed.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-protected-token-duplicate-header-guard.md server.js test-artifacts/server/public-demo-mode-gate-tests.mjs
git diff --cached --check
git commit -m "ci: reject duplicate protected token headers"
git push origin main
```

Expected: commit succeeds on `main`, push advances `origin/main`.

- [ ] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --repo crisious/Web_LOL_Banpick --branch main --limit 5
gh run watch <run-id> --repo crisious/Web_LOL_Banpick --exit-status
gh run view <run-id> --repo crisious/Web_LOL_Banpick --json databaseId,headSha,headBranch,status,conclusion,url,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: newest run for the pushed commit succeeds, and the uploaded `qa-automation-<run-id>` artifact contains read-only smoke evidence with `155 passed / 0 failed`.

- [ ] **Step 4: Update Obsidian project note**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local RED/GREEN/full QA, remote run URL, artifact id, artifact smoke count, sensitive scan result, and final `main...origin/main` sync count.
