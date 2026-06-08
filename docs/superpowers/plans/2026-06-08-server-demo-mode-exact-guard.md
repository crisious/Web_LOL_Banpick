# Server Demo Mode Exact Guard Implementation Plan

> **For agentic workers:** Use TDD. Add failing regression tests first, then implement the smallest server/smoke change that makes them pass.

**Goal:** Stop the server and smoke evidence from silently normalizing `PUBLIC_DEMO_MODE` values. Demo mode must be exactly one of `full`, `readonly`, or `protected`; values with whitespace, uppercase letters, or other spelling changes must fail closed.

**Architecture:** Replace the server's top-level `trim().toLowerCase()` mode parsing with an exact parser that defaults only missing/empty mode to `full`. Preserve the raw configured value in `/healthz.publicDemoMode` for invalid non-empty values and expose `publicDemoModeValid: false`. Update smoke to treat raw `publicDemoMode` strings exactly, so a legacy or external target cannot hide whitespace/case mistakes unless it explicitly exposes a valid lowercase mode.

**Tech Stack:** Node.js CommonJS server, ESM smoke script, existing server/smoke regression tests, README/runbook operator docs.

---

### Task 1: Add RED Tests For Mode Normalization Gaps

**Files:**
- Modify: `test-artifacts/server/public-demo-mode-gate-tests.mjs`
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Add server mode config tests**

Add coverage that:

- missing or empty `PUBLIC_DEMO_MODE` defaults to `full`
- clean lowercase `readonly` remains valid
- `PUBLIC_DEMO_MODE=" readonly"` is preserved as raw invalid mode
- `PUBLIC_DEMO_MODE="READONLY"` is preserved as raw invalid mode
- invalid mode config blocks live API with `PUBLIC_DEMO_MODE_INVALID`

- [x] **Step 2: Add smoke raw health mode tests**

Add coverage that:

- `/healthz.publicDemoMode: " readonly"` exits non-zero
- `/healthz.publicDemoMode: "READONLY"` exits non-zero
- smoke stops after `/healthz` for those raw invalid mode values

- [x] **Step 3: Run focused tests and confirm RED**

Run:

```bash
node test-artifacts/server/public-demo-mode-gate-tests.mjs
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: server tests fail because the current top-level parser trims/lowercases mode values, and smoke tests fail because `demoModeFromHealth()` trims/lowercases raw health values.

Result: RED confirmed. Server gate tests reported `43 passed, 8 failed`; direct smoke tests reported `197 passed, 4 failed`. The failures showed `PUBLIC_DEMO_MODE=" readonly"` and `PUBLIC_DEMO_MODE="READONLY"` being normalized to `readonly`, and smoke continuing past `/healthz` for raw whitespace/case mode values.

### Task 2: Preserve Mode Values And Fail Closed

**Files:**
- Modify: `server.js`
- Modify: `scripts/external-demo-smoke.mjs`

- [x] **Step 1: Add exact server mode parser**

Add a helper similar to:

```js
function parsePublicDemoModeConfig(rawMode) {
  const value = String(rawMode || "");
  if (!value) {
    return { value: "full", valid: true };
  }
  if (!validPublicDemoModes.has(value)) {
    return { value, valid: false };
  }
  return { value, valid: true };
}
```

Use it for `PUBLIC_DEMO_MODE`. Do not trim or lowercase non-empty values.

- [x] **Step 2: Use parser validity in health and live API gate**

Expose `publicDemoModeValid` from the parser and keep `PUBLIC_DEMO_MODE_INVALID` fail-closed behavior for invalid non-empty values.

- [x] **Step 3: Make smoke interpret raw health mode exactly**

Result: Focused GREEN passed. Syntax checks exited 0, server gate tests reported `51 passed, 0 failed`, and direct smoke tests reported `201 passed, 0 failed`.

Update `demoModeFromHealth()` so string `publicDemoMode` values are not trimmed or lowercased. Legacy boolean fields may continue to infer `readonly` or `protected` only when `publicDemoMode` is absent.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Document exact server-side mode contract**

Document that server `PUBLIC_DEMO_MODE` defaults to `full` only when missing/empty, and any non-empty value must exactly match lowercase `full`, `readonly`, or `protected`.

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

Result: Full QA passed. Syntax checks exited 0, server gate tests reported `51 passed, 0 failed`, direct smoke tests reported `201 passed, 0 failed`, `npm test` reported `917 passed, 0 failed across 25 test file(s)`, and `git diff --check` exited 0.
