# Protected Authorization Fallback Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make protected demo requests fail closed when an `Authorization` header is present but not exact `Bearer <token>`, instead of falling back to `x-demo-token`.

**Architecture:** Keep the existing `requireLiveApiAccess()` equality check and make `tokenFromRequest()` return an impossible token when `Authorization` is non-empty but malformed. Extend the existing public demo gate tests with combined malformed-Authorization-plus-valid-`x-demo-token` cases, then document that `x-demo-token` is a fallback only when `Authorization` is absent.

**Tech Stack:** Node.js vanilla HTTP server, existing zero-dependency extracted-function test harness, README operational docs, GitHub Actions QA artifact verification.

---

### Task 1: Add Failing Malformed Authorization Fallback Tests

**Files:**
- Modify: `test-artifacts/server/public-demo-mode-gate-tests.mjs`
- Read: `server.js`

- [x] **Step 1: Add failing tests after the lowercase bearer checks**

Insert this block immediately after the existing `"protected mode lowercase bearer returns unauthorized code"` check:

```js
  const lowercaseBearerWithHeaderTokenRes = makeResponseRecorder();
  check("protected mode rejects lowercase bearer even when x-demo-token matches",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "bearer demo-secret", "x-demo-token": "demo-secret" } }, lowercaseBearerWithHeaderTokenRes),
    false);
  check("protected mode lowercase bearer with x-demo-token returns unauthorized code",
    lowercaseBearerWithHeaderTokenRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const basicAuthWithHeaderTokenRes = makeResponseRecorder();
  check("protected mode rejects non-bearer Authorization even when x-demo-token matches",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "Basic demo-secret", "x-demo-token": "demo-secret" } }, basicAuthWithHeaderTokenRes),
    false);
  check("protected mode non-bearer Authorization with x-demo-token returns unauthorized code",
    basicAuthWithHeaderTokenRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const whitespaceAuthWithHeaderTokenRes = makeResponseRecorder();
  check("protected mode rejects whitespace Authorization even when x-demo-token matches",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "   ", "x-demo-token": "demo-secret" } }, whitespaceAuthWithHeaderTokenRes),
    false);
  check("protected mode whitespace Authorization with x-demo-token returns unauthorized code",
    whitespaceAuthWithHeaderTokenRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node test-artifacts/server/public-demo-mode-gate-tests.mjs
```

Expected result before implementation: `57 passed, 6 failed`. The failed assertions should show malformed `Authorization` values falling back to a valid `x-demo-token`.

Observed RED result: `57 passed, 6 failed`.

### Task 2: Implement Fail-Closed Authorization Fallback

**Files:**
- Modify: `server.js`
- Test: `test-artifacts/server/public-demo-mode-gate-tests.mjs`

- [x] **Step 1: Make non-empty malformed Authorization return an impossible token**

Change `tokenFromRequest()` from:

```js
function tokenFromRequest(req) {
  const auth = firstHeaderValue(req.headers.authorization);
  const bearerPrefix = "Bearer ";
  if (auth.startsWith(bearerPrefix)) return auth.slice(bearerPrefix.length);
  return firstHeaderValue(req.headers["x-demo-token"]);
}
```

to:

```js
function tokenFromRequest(req) {
  const auth = firstHeaderValue(req.headers.authorization);
  const bearerPrefix = "Bearer ";
  if (auth.startsWith(bearerPrefix)) return auth.slice(bearerPrefix.length);
  if (auth) return "\u0000invalid-authorization";
  return firstHeaderValue(req.headers["x-demo-token"]);
}
```

This sentinel cannot equal `PUBLIC_DEMO_TOKEN` because server token config rejects control characters.

- [x] **Step 2: Run focused GREEN verification**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/public-demo-mode-gate-tests.mjs &&
node test-artifacts/server/public-demo-mode-gate-tests.mjs
```

Expected result after implementation: syntax checks exit `0`; public demo mode gate tests report `63 passed, 0 failed`.

Observed GREEN result: syntax checks exited `0`; public demo mode gate tests reported `63 passed, 0 failed`.

### Task 3: Document Authorization Precedence Contract

**Files:**
- Modify: `README.md`

- [x] **Step 1: Update protected token docs**

In the protected token paragraph, after the sentence about exact `Authorization`, add this sentence:

```md
`Authorization` header가 존재하지만 exact bearer 형식이 아니면 `x-demo-token`이 함께 맞더라도 fallback하지 않고 401 `PUBLIC_DEMO_UNAUTHORIZED`로 실패합니다.
```

### Task 4: Full QA, Commit, Push, and Remote Artifact Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-protected-authorization-fallback-guard.md`
- Read: GitHub Actions QA artifact
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Scan plan for placeholder red flags**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-protected-authorization-fallback-guard.md; placeholder_scan=$?; echo "placeholder_scan_exit=$placeholder_scan"; test "$placeholder_scan" -eq 1
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

Expected: focused tests `63 passed, 0 failed`; `npm test` reports `1010 passed, 0 failed across 32 test file(s)`; diff check exits `0`.

Observed result: focused tests `63 passed, 0 failed`; `npm test` reported `1010 passed, 0 failed across 32 test file(s)`; `git diff --check` exited `0`.

- [ ] **Step 3: Commit and push main**

Run:

```bash
git fetch origin &&
git rev-list --left-right --count main...origin/main &&
git add server.js README.md test-artifacts/server/public-demo-mode-gate-tests.mjs docs/superpowers/plans/2026-06-08-protected-authorization-fallback-guard.md &&
git diff --cached --check &&
git commit -m "ci: reject malformed protected authorization"
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

- Spec coverage: The plan covers malformed `Authorization` headers combined with valid `x-demo-token`, including lowercase bearer, non-bearer scheme, and whitespace-only authorization.
- Placeholder scan target: The plan includes exact paths, code, commands, expected outputs, and no unfinished marker text.
- Type consistency: `tokenFromRequest(req)` still returns a string; the invalid sentinel cannot equal a valid protected demo token because valid server tokens cannot contain control characters.
