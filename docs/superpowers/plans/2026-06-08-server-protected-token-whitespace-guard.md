# Server Protected Token Whitespace Guard Implementation Plan

> **For agentic workers:** Use TDD. Add failing regression tests first, then implement the smallest server/smoke change that makes them pass.

**Goal:** Stop the protected demo server from silently trimming whitespace-containing token values. The server and smoke evidence should fail closed when protected token configuration or request token material contains leading, trailing, or internal whitespace.

**Architecture:** Keep the existing public demo mode gate. Add a small server token parser that preserves valid token bytes, treats blank/whitespace-only env values as missing, and marks non-empty whitespace-containing env values invalid. Expose only a boolean token validity field from `/healthz`, never the token. Update smoke to fail after `/healthz` when that boolean is false.

**Tech Stack:** Node.js CommonJS server, ESM smoke script, existing script/server regression tests, README/runbook operator docs.

---

### Task 1: Add RED Tests For Server Token Normalization Gaps

**Files:**
- Modify: `test-artifacts/server/public-demo-mode-gate-tests.mjs`
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Add server auth gate tests**

Add coverage that:

- protected health marks a clean token config as valid
- non-empty `PUBLIC_DEMO_TOKEN` with leading/trailing/internal whitespace is marked invalid
- invalid protected token config blocks live API with `PUBLIC_DEMO_TOKEN_INVALID`
- matching bearer token with trailing whitespace is rejected instead of trimmed
- matching `x-demo-token` with trailing whitespace is rejected instead of trimmed
- whitespace-only server token remains the existing missing-token failure

- [x] **Step 2: Add smoke health check tests**

Add coverage that:

- smoke exits non-zero when `/healthz` returns `publicDemoTokenValid: false`
- smoke stops after `/healthz` in that case, before home/assets/samples/live probes

- [x] **Step 3: Run focused tests and confirm RED**

Run:

```bash
node test-artifacts/server/public-demo-mode-gate-tests.mjs
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: new server token validity/request token tests fail against the current trimming behavior, and smoke does not yet fail on `publicDemoTokenValid: false`.

Result: RED confirmed. Server gate tests reported `27 passed, 10 failed`; direct smoke tests reported `192 passed, 3 failed`. The failures showed missing `publicDemoTokenValid`, request token trimming, invalid server token config being accepted, and smoke continuing past `/healthz` when `publicDemoTokenValid` was false.

### Task 2: Preserve Token Values And Fail Closed

**Files:**
- Modify: `server.js`
- Modify: `scripts/external-demo-smoke.mjs`

- [x] **Step 1: Parse server token config without trimming valid secrets**

Add a helper similar to:

```js
function parsePublicDemoTokenConfig(rawToken) {
  const value = String(rawToken || "");
  if (!value || value.trim() === "") {
    return { value: "", valid: true };
  }
  if (value.trim() !== value || /\s/u.test(value)) {
    return { value: "", valid: false };
  }
  return { value, valid: true };
}
```

Use it for `PUBLIC_DEMO_TOKEN`, keeping whitespace-only values as missing and non-empty whitespace values invalid.

- [x] **Step 2: Stop trimming request token values**

Update `tokenFromRequest()` so bearer and `x-demo-token` values are compared exactly. Whitespace attached to the token value should not authenticate.

- [x] **Step 3: Expose safe token validity and block invalid config**

Include `publicDemoTokenValid` in `publicDemoModeHealth()`. In protected mode, return 403 `PUBLIC_DEMO_TOKEN_INVALID` before token comparison when the server token config is invalid.

- [x] **Step 4: Fail smoke on invalid protected token config**

Result: Focused GREEN passed. Syntax checks exited 0, server gate tests reported `37 passed, 0 failed`, and direct smoke tests reported `195 passed, 0 failed`.

After `/healthz`, if `publicDemoTokenValid === false`, fail with `public demo token config is valid` before any further probes.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Document server-side token contract**

Document that protected server `PUBLIC_DEMO_TOKEN` must be non-empty and whitespace-free, that invalid non-empty values fail closed with `PUBLIC_DEMO_TOKEN_INVALID`, and that `/healthz` exposes only `publicDemoTokenValid`.

- [x] **Step 2: Run full QA**

Run:

```bash
node --check server.js &&
node --check scripts/external-demo-smoke.mjs &&
node --check test-artifacts/server/public-demo-mode-gate-tests.mjs &&
node --check test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node test-artifacts/server/public-demo-mode-gate-tests.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs &&
npm test &&
git diff --check
```

Expected: all commands exit 0 with no whitespace errors.

Result: Full QA passed. Syntax checks exited 0, server gate tests reported `37 passed, 0 failed`, direct smoke tests reported `195 passed, 0 failed`, `npm test` reported `897 passed, 0 failed across 25 test file(s)`, and `git diff --check` exited 0.
