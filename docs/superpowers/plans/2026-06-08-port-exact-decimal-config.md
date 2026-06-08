# Port Exact Decimal Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make server `PORT` config accept only missing/empty or exact decimal integer values, so whitespace, hex, exponent, float, and out-of-range values cannot be silently normalized.

**Architecture:** Add a small `parsePortConfig()` helper in `server.js` and use it for startup. Cover the helper through an extracted-function regression test, then document the operator-facing port contract beside the existing `.env` notes.

**Tech Stack:** Node.js CommonJS server, extracted function regression tests, README/runbook operator docs.

---

### Task 1: Add RED Tests For Exact Port Config

**Files:**
- Create: `test-artifacts/server/port-config-tests.mjs`

- [x] **Step 1: Write the failing tests**

Create a test harness that extracts `parsePortConfig()` from `server.js`. If the helper does not exist yet, define this fallback to mirror the current startup expression:

```js
function parsePortConfig(rawPort, defaultPort = 8123) {
  return Number(rawPort || defaultPort);
}
```

Test cases:

- `parsePortConfig(undefined, 9000)` returns `9000`
- `parsePortConfig("", 9000)` returns `9000`
- `parsePortConfig("8123")` returns `8123`
- `parsePortConfig("0")` returns `0`
- `parsePortConfig("65535")` returns `65535`
- `parsePortConfig(" 8123")`, `"8123 "`, `"08"`, `"8.5"`, `"8e3"`, `"0x1fbb"`, `"-1"`, `"65536"`, and `"abc"` throw `PORT must be an exact decimal integer between 0 and 65535.`

- [x] **Step 2: Run focused RED**

Run:

```bash
node test-artifacts/server/port-config-tests.mjs
```

Expected: invalid/normalized port value tests fail because the current startup expression accepts several of them through `Number(...)`.

Result: RED confirmed. Port config tests reported `5 passed, 9 failed`; whitespace, leading-zero, float, exponent, hex, negative, out-of-range, and non-numeric values did not throw.

### Task 2: Use Exact Decimal Port Parser

**Files:**
- Modify: `server.js`

- [x] **Step 1: Use parser at startup**

Change:

```js
const port = Number(process.env.PORT || 8123);
```

to:

```js
const port = parsePortConfig(process.env.PORT);
```

- [x] **Step 2: Add exact parser**

Add:

```js
function parsePortConfig(rawPort, defaultPort = 8123) {
  const value = rawPort === undefined || rawPort === null ? "" : String(rawPort);
  if (value === "") {
    return defaultPort;
  }
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("PORT must be an exact decimal integer between 0 and 65535.");
  }
  const portNumber = Number(value);
  if (!Number.isSafeInteger(portNumber) || portNumber < 0 || portNumber > 65535) {
    throw new Error("PORT must be an exact decimal integer between 0 and 65535.");
  }
  return portNumber;
}
```

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/port-config-tests.mjs &&
node test-artifacts/server/port-config-tests.mjs
```

Expected: syntax checks exit 0 and port config tests pass.

Result: Focused GREEN passed. Syntax checks exited 0 and port config tests reported `14 passed, 0 failed`.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-port-exact-decimal-config.md`

- [x] **Step 1: Document port value contract**

Document that `PORT` defaults to `8123` only when missing or empty, and otherwise must be an exact decimal integer from `0` to `65535` without whitespace, hex, exponent, float, or leading-zero normalization.

- [x] **Step 2: Run full QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-port-exact-decimal-config.md
node --check server.js &&
node --check test-artifacts/server/port-config-tests.mjs &&
node test-artifacts/server/port-config-tests.mjs &&
npm test &&
git diff --check
```

Expected: placeholder scan has no matches, all commands exit 0, and the full suite includes the new port config test file.

Result: Full QA passed. Placeholder scan reported no matches, focused port config checks reported `14 passed, 0 failed`, `npm test` reported `949 passed, 0 failed across 28 test file(s)`, and `git diff --check` exited 0.
