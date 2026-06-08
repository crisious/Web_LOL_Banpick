# Host Config Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make server `HOST` config fail fast on whitespace or control-character values instead of passing ambiguous bind targets into `server.listen()`.

**Architecture:** Add a focused `parseHostConfig()` helper in `server.js` and use it for startup host selection. Cover the helper with extracted-function regression tests, then document the operator-facing host value contract beside the existing `PORT`, `TRUST_PROXY`, and public demo environment notes.

**Tech Stack:** Node.js CommonJS server, extracted function regression tests, README/runbook operator docs.

---

### Task 1: Add RED Tests For Host Config Guard

**Files:**
- Create: `test-artifacts/server/host-config-tests.mjs`

- [x] **Step 1: Write the failing tests**

Create a test harness that extracts `parseHostConfig()` from `server.js`. If the helper does not exist yet, define this fallback to mirror the current startup expression:

```js
function parseHostConfig(rawHost, defaultHost = "127.0.0.1") {
  return rawHost || defaultHost;
}
```

Test cases:

- `parseHostConfig(undefined, "127.0.0.1")` returns `"127.0.0.1"`
- `parseHostConfig("", "127.0.0.1")` returns `"127.0.0.1"`
- `"localhost"`, `"0.0.0.0"`, `"::1"`, and `"demo.example.com"` are preserved exactly
- `" 0.0.0.0"`, `"0.0.0.0 "`, `"local host"`, `"local\thost"`, and `"host\nname"` throw `HOST must be empty or a hostname/IP literal without whitespace or control characters.`

- [x] **Step 2: Run focused RED**

Run:

```bash
node test-artifacts/server/host-config-tests.mjs
```

Expected: whitespace/control-character host tests fail because the current startup expression passes non-empty `HOST` values through unchanged.

Result: RED confirmed. Host config tests reported `6 passed, 5 failed`; leading/trailing/internal whitespace and control-character values were passed through instead of rejected.

### Task 2: Use Host Config Parser

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add host parser**

Add:

```js
function parseHostConfig(rawHost, defaultHost = "127.0.0.1") {
  const value = rawHost === undefined || rawHost === null ? "" : String(rawHost);
  if (value === "") {
    return defaultHost;
  }
  if (/\s/u.test(value) || /[\u0000-\u001F\u007F]/u.test(value)) {
    throw new Error("HOST must be empty or a hostname/IP literal without whitespace or control characters.");
  }
  return value;
}
```

- [x] **Step 2: Use parser at startup**

Change:

```js
const host = process.env.HOST || "127.0.0.1";
```

to:

```js
const host = parseHostConfig(process.env.HOST);
```

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/host-config-tests.mjs &&
node test-artifacts/server/host-config-tests.mjs
```

Expected: syntax checks exit 0 and host config tests pass.

Result: Focused GREEN passed. Syntax checks exited 0 and host config tests reported `11 passed, 0 failed`.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-host-config-guard.md`

- [x] **Step 1: Document `HOST` contract**

Document that `HOST` defaults to `127.0.0.1` only when missing or empty. Non-empty `HOST` values must be literal hostname/IP bind targets without whitespace or control characters, so accidental values such as `HOST= 0.0.0.0` fail before startup.

- [x] **Step 2: Run full QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-host-config-guard.md
node --check server.js &&
node --check test-artifacts/server/host-config-tests.mjs &&
node test-artifacts/server/host-config-tests.mjs &&
npm test &&
git diff --check
```

Expected: placeholder scan has no matches, all commands exit 0, and the full suite includes the new host config test file.

Result: Full QA passed. Placeholder scan exited 1 with no matches, syntax checks exited 0, focused host config tests reported `11 passed, 0 failed`, `npm test` reported `968 passed, 0 failed across 30 test file(s)`, and `git diff --check` exited 0.
