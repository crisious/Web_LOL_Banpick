# Trust Proxy Exact Opt-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `TRUST_PROXY` an exact `1` opt-in so accidental whitespace in `.env` or shell config cannot silently enable trusted forwarded IP handling.

**Architecture:** Add a small server config parser for `TRUST_PROXY`, use it at startup, and cover the parser plus `getClientIp()` behavior with extracted-function regression tests. Keep the runtime behavior unchanged for exact `TRUST_PROXY=1`; all other values continue to disable proxy trust.

**Tech Stack:** Node.js CommonJS server, extracted function regression tests, README/runbook operator docs.

---

### Task 1: Add RED Tests For Exact Trust Proxy Config

**Files:**
- Create: `test-artifacts/server/trust-proxy-tests.mjs`

- [x] **Step 1: Write the failing tests**

Create a test harness that extracts `firstHeaderValue()` and `getClientIp()` from `server.js`. If `parseTrustProxyConfig()` does not exist yet, define a fallback matching the current `String(value || "").trim() === "1"` startup expression so whitespace opt-in tests fail for the current code.

Test cases:

- `parseTrustProxyConfig("1")` returns `true`
- missing, empty, and `"0"` return `false`
- `" 1"` and `"1 "` return `false`
- with raw `" 1"`, `getClientIp()` ignores `cf-connecting-ip` and returns `req.socket.remoteAddress`
- with raw `"1"`, `getClientIp()` trusts `cf-connecting-ip`
- with raw `"1"`, `getClientIp()` falls back to the first `x-forwarded-for` value

- [x] **Step 2: Run focused RED**

Run:

```bash
node test-artifacts/server/trust-proxy-tests.mjs
```

Expected: at least the whitespace opt-in tests fail because the current startup expression trims `TRUST_PROXY`.

Result: RED confirmed. Trust proxy tests reported `6 passed, 4 failed`; `TRUST_PROXY` values with leading/trailing whitespace returned `true`, and raw `" 1"` caused `getClientIp()` to trust `cf-connecting-ip`.

### Task 2: Parse `TRUST_PROXY` Without Normalization

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add exact parser**

Add:

```js
function parseTrustProxyConfig(rawTrustProxy) {
  return String(rawTrustProxy || "") === "1";
}
```

- [x] **Step 2: Use parser at startup**

Change startup config from:

```js
const trustProxy = String(process.env.TRUST_PROXY || "").trim() === "1";
```

to:

```js
const trustProxy = parseTrustProxyConfig(process.env.TRUST_PROXY);
```

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/trust-proxy-tests.mjs &&
node test-artifacts/server/trust-proxy-tests.mjs
```

Expected: syntax checks exit 0 and trust proxy tests pass.

Result: Focused GREEN passed. Syntax checks exited 0 and trust proxy tests reported `10 passed, 0 failed`.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-trust-proxy-exact-opt-in.md`

- [x] **Step 1: Document exact `TRUST_PROXY=1` opt-in**

Document that `TRUST_PROXY` is enabled only by the exact value `1`; `.env` values are not trimmed, so whitespace keeps proxy trust disabled and rate-limit keys fall back to the socket IP.

- [x] **Step 2: Run full QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-trust-proxy-exact-opt-in.md
node --check server.js &&
node --check test-artifacts/server/trust-proxy-tests.mjs &&
node test-artifacts/server/trust-proxy-tests.mjs &&
npm test &&
git diff --check
```

Expected: placeholder scan has no matches, all commands exit 0, and the full test suite includes the new trust proxy tests.

Result: Full QA passed. Placeholder scan reported no matches after avoiding command self-match, focused trust proxy checks reported `10 passed, 0 failed`, `npm test` reported `934 passed, 0 failed across 27 test file(s)`, and `git diff --check` exited 0.
