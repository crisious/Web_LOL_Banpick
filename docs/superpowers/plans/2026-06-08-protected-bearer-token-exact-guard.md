# Protected Bearer Token Exact Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make protected demo `Authorization` token parsing accept only the exact `Bearer <token>` header shape so whitespace or scheme-casing normalization cannot grant live API access.

**Architecture:** Keep protected demo access control in `server.js` and narrow `tokenFromRequest()` from a permissive regular expression to an exact prefix check. Extend the existing `test-artifacts/server/public-demo-mode-gate-tests.mjs` gate harness with regression tests for double-space, tab-separated, and lowercase bearer scheme headers, then document the exact header contract in README.

**Tech Stack:** Node.js vanilla HTTP server, zero-dependency extracted-function `.mjs` tests, README operational docs, GitHub Actions QA artifact verification.

---

### Task 1: Add Failing Protected Bearer Header Tests

**Files:**
- Modify: `test-artifacts/server/public-demo-mode-gate-tests.mjs`
- Read: `server.js`

- [x] **Step 1: Add failing tests near the existing protected bearer checks**

Insert this block immediately after the existing `"protected mode success does not write an error response"` check:

```js
  const doubleSpaceBearerRes = makeResponseRecorder();
  check("protected mode rejects bearer token with double-space separator",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "Bearer  demo-secret" } }, doubleSpaceBearerRes),
    false);
  check("protected mode double-space bearer returns unauthorized code",
    doubleSpaceBearerRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const tabBearerRes = makeResponseRecorder();
  check("protected mode rejects bearer token with tab separator",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "Bearer\tdemo-secret" } }, tabBearerRes),
    false);
  check("protected mode tab bearer returns unauthorized code",
    tabBearerRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const lowercaseBearerRes = makeResponseRecorder();
  check("protected mode rejects lowercase bearer scheme",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "bearer demo-secret" } }, lowercaseBearerRes),
    false);
  check("protected mode lowercase bearer returns unauthorized code",
    lowercaseBearerRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node test-artifacts/server/public-demo-mode-gate-tests.mjs
```

Expected result before implementation: `51 passed, 6 failed`. The six failed assertions should show that double-space, tab-separated, and lowercase bearer headers were accepted and did not return `PUBLIC_DEMO_UNAUTHORIZED`.

Observed RED result: `51 passed, 6 failed`.

### Task 2: Implement Exact Bearer Prefix Parsing

**Files:**
- Modify: `server.js`
- Test: `test-artifacts/server/public-demo-mode-gate-tests.mjs`

- [x] **Step 1: Replace permissive bearer regex with exact prefix slicing**

Change `tokenFromRequest()` in `server.js` from:

```js
function tokenFromRequest(req) {
  const auth = firstHeaderValue(req.headers.authorization);
  const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1];
  return firstHeaderValue(req.headers["x-demo-token"]);
}
```

to:

```js
function tokenFromRequest(req) {
  const auth = firstHeaderValue(req.headers.authorization);
  const bearerPrefix = "Bearer ";
  if (auth.startsWith(bearerPrefix)) return auth.slice(bearerPrefix.length);
  return firstHeaderValue(req.headers["x-demo-token"]);
}
```

- [x] **Step 2: Run focused GREEN verification**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/public-demo-mode-gate-tests.mjs &&
node test-artifacts/server/public-demo-mode-gate-tests.mjs
```

Expected result after implementation: syntax checks exit `0`; public demo mode gate tests report `57 passed, 0 failed`.

Observed GREEN result: syntax checks exited `0`; public demo mode gate tests reported `57 passed, 0 failed`.

### Task 3: Document Protected Authorization Header Contract

**Files:**
- Modify: `README.md`

- [x] **Step 1: Update the protected token paragraph**

In the paragraph beginning `서버의 protected PUBLIC_DEMO_TOKEN도 같은 whitespace-free 계약을 따릅니다.`, replace the sentence about Bearer request values with:

```md
Protected request token도 서버에서 보정하지 않습니다. `Authorization`은 exact `Bearer <token>` 형식, 즉 uppercase `Bearer` 뒤 단일 ASCII space 하나만 허용하며, `Bearer  <token>`, `Bearer\t<token>`, `bearer <token>`처럼 parser가 보정할 수 있는 모양은 401 `PUBLIC_DEMO_UNAUTHORIZED`로 실패합니다. `x-demo-token` 요청 값에 붙은 whitespace도 trim하지 않으므로 정확히 일치하지 않으면 401 `PUBLIC_DEMO_UNAUTHORIZED`로 실패합니다.
```

### Task 4: Full QA, Commit, Push, and Remote Artifact Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-protected-bearer-token-exact-guard.md`
- Read: GitHub Actions QA artifact
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Scan plan for placeholder red flags**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-protected-bearer-token-exact-guard.md; placeholder_scan=$?; echo "placeholder_scan_exit=$placeholder_scan"; test "$placeholder_scan" -eq 1
```

Expected: `placeholder_scan_exit=1`.

Observed result: `placeholder_scan_exit=1`.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/public-demo-mode-gate-tests.mjs &&
node test-artifacts/server/public-demo-mode-gate-tests.mjs &&
npm test &&
git diff --check
```

Expected: focused tests `57 passed, 0 failed`; `npm test` reports `1004 passed, 0 failed across 32 test file(s)`; diff check exits `0`.

Observed result: focused tests `57 passed, 0 failed`; `npm test` reported `1004 passed, 0 failed across 32 test file(s)`; `git diff --check` exited `0`.

- [ ] **Step 3: Commit and push main**

Run:

```bash
git fetch origin &&
git rev-list --left-right --count main...origin/main &&
git add server.js README.md test-artifacts/server/public-demo-mode-gate-tests.mjs docs/superpowers/plans/2026-06-08-protected-bearer-token-exact-guard.md &&
git diff --cached --check &&
git commit -m "ci: require exact protected bearer token" &&
git push origin main
```

Expected: before commit `main...origin/main` reports `0 0`; commit succeeds; push updates `origin/main`.

- [ ] **Step 4: Verify GitHub Actions artifact**

Run:

```bash
gh run list --repo crisious/Web_LOL_Banpick --workflow QA --branch main --limit 5
gh run watch <run_id> --repo crisious/Web_LOL_Banpick --exit-status
gh run download <run_id> --repo crisious/Web_LOL_Banpick --dir test-artifacts/tmp/gh-run-<run_id>
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|asset-secret|script-secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/gh-run-<run_id>; scan_status=$?; echo "sensitive_scan_exit=$scan_status"; test "$scan_status" -eq 1
```

Expected: GitHub QA conclusion `success`; read-only smoke artifact reports `155 passed, 0 failed`; sensitive artifact scan exits with `sensitive_scan_exit=1`.

## Self-Review

- Spec coverage: The plan covers the protected demo bearer parsing risk: multiple whitespace, tab separator, and lowercase scheme are no longer normalized into a valid token.
- Placeholder scan target: The plan includes exact paths, code blocks, commands, expected outputs, and no unfinished marker text.
- Type consistency: `tokenFromRequest(req)` still returns a string from the Authorization header or `x-demo-token`; `requireLiveApiAccess()` keeps the same equality comparison with `publicDemoToken`.
