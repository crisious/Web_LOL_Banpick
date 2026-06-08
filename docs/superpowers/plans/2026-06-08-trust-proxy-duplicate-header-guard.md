# Trust Proxy Duplicate Header Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `TRUST_PROXY=1` rate-limit IP selection from trusting duplicate or array-shaped forwarded IP headers.

**Architecture:** Keep `TRUST_PROXY` as the existing exact opt-in. Add a proxy-header-specific reader that distinguishes three states: missing/empty header, valid single header, and duplicate/array header. If any trusted proxy IP header is parsed as an array, `getClientIp()` falls back to the socket remote address instead of using the first forwarded value.

**Tech Stack:** Node.js CommonJS server, extracted-function `.mjs` regression tests, README/runbook documentation, GitHub Actions QA workflow.

---

### Task 1: Add RED Coverage For Duplicate Proxy IP Headers

**Files:**
- Modify: `test-artifacts/server/trust-proxy-tests.mjs`

- [x] **Step 1: Add failing duplicate header checks**

Insert these checks after the existing `exact TRUST_PROXY trusts cf-connecting-ip` check:

```js
check("exact TRUST_PROXY rejects duplicate cf-connecting-ip values",
  exactProxy.getClientIp(makeReq({
    headers: {
      "cf-connecting-ip": ["198.51.100.5", "198.51.100.6"],
      "x-forwarded-for": "198.51.100.7",
    },
    remoteAddress: "203.0.113.10",
  })),
  "203.0.113.10");
```

Insert these checks after the existing `exact TRUST_PROXY falls back to first x-forwarded-for value` check:

```js
check("exact TRUST_PROXY rejects duplicate x-forwarded-for values",
  exactProxy.getClientIp(makeReq({
    headers: { "x-forwarded-for": ["198.51.100.8", "198.51.100.9"] },
    remoteAddress: "203.0.113.10",
  })),
  "203.0.113.10");

check("exact TRUST_PROXY rejects duplicate x-real-ip values",
  exactProxy.getClientIp(makeReq({
    headers: { "x-real-ip": ["198.51.100.10", "198.51.100.11"] },
    remoteAddress: "203.0.113.10",
  })),
  "203.0.113.10");
```

- [x] **Step 2: Run focused RED test**

Run:

```bash
node test-artifacts/server/trust-proxy-tests.mjs
```

Expected before implementation: exit `1`; existing checks pass, and the three new duplicate proxy header checks fail because current `firstHeaderValue()` uses the first array entry.

Observed: RED confirmed. Trust proxy tests reported `10 passed, 3 failed`; duplicate `cf-connecting-ip`, `x-forwarded-for`, and `x-real-ip` values were selected through the first array entry.

### Task 2: Implement Forwarded IP Single Header Guard

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/trust-proxy-tests.mjs`

- [x] **Step 1: Add proxy header helper**

Add this helper after `tokenHeaderValue()`:

```js
function proxyHeaderValue(value) {
  if (Array.isArray(value)) {
    return { value: "", duplicate: value.length > 0 };
  }
  return { value: String(value || ""), duplicate: false };
}
```

- [x] **Step 2: Use the helper in `getClientIp()`**

Replace the trusted proxy branch in `getClientIp()` with:

```js
  const cfConnectingIp = proxyHeaderValue(req.headers["cf-connecting-ip"]);
  if (cfConnectingIp.duplicate) return req.socket.remoteAddress || "unknown";
  const cfConnectingIpValue = cfConnectingIp.value.trim();
  if (cfConnectingIpValue) return cfConnectingIpValue;

  const forwardedForHeader = proxyHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedForHeader.duplicate) return req.socket.remoteAddress || "unknown";
  const forwardedFor = forwardedForHeader.value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (forwardedFor.length > 0) return forwardedFor[0];

  const realIp = proxyHeaderValue(req.headers["x-real-ip"]);
  if (realIp.duplicate) return req.socket.remoteAddress || "unknown";
  const realIpValue = realIp.value.trim();
  if (realIpValue) return realIpValue;
```

- [x] **Step 3: Update extracted test harness**

In `test-artifacts/server/trust-proxy-tests.mjs`, include:

```js
extractFunctionSource(serverSrc, "proxyHeaderValue"),
```

immediately after the existing `extractFunctionSource(serverSrc, "firstHeaderValue"),` line.

- [x] **Step 4: Run focused GREEN test**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/trust-proxy-tests.mjs &&
node test-artifacts/server/trust-proxy-tests.mjs
```

Expected after implementation: exit `0`, trust proxy tests report `13 passed, 0 failed`.

Observed: GREEN confirmed. Syntax checks for `server.js` and `test-artifacts/server/trust-proxy-tests.mjs` passed; trust proxy tests reported `13 passed, 0 failed`.

### Task 3: Document Duplicate Proxy Header Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-trust-proxy-duplicate-header-guard.md`

- [x] **Step 1: Update proxy trust documentation**

In `README.md` and `docs/external-demo-runbook.md`, update the `TRUST_PROXY` paragraph to state that duplicate or array-shaped `cf-connecting-ip`, `x-forwarded-for`, or `x-real-ip` values are not trusted and the server falls back to the socket remote address for rate-limit IP selection.

- [x] **Step 2: Scan plan placeholders**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-trust-proxy-duplicate-header-guard.md
```

Expected: exit `1`, no placeholder matches.

Observed: Placeholder scan exited `1`, no matches.

### Task 4: Full QA, Commit, Push, And Remote Evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-trust-proxy-duplicate-header-guard.md`
- Modify: `server.js`
- Modify: `test-artifacts/server/trust-proxy-tests.mjs`

- [x] **Step 1: Run local QA**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/trust-proxy-tests.mjs &&
node test-artifacts/server/trust-proxy-tests.mjs &&
npm test &&
git diff --check
```

Expected: exit `0`; focused tests report `13 passed, 0 failed`; full suite reports `1017 passed, 0 failed across 32 test file(s)`.

Observed: Local QA exited `0`. Placeholder scan exited `1`; syntax checks passed; trust proxy tests reported `13 passed, 0 failed`; `npm test` reported `1017 passed, 0 failed across 32 test file(s)`; `git diff --check` passed.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-trust-proxy-duplicate-header-guard.md server.js test-artifacts/server/trust-proxy-tests.mjs
git diff --cached --check
git commit -m "ci: reject duplicate trust proxy headers"
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
