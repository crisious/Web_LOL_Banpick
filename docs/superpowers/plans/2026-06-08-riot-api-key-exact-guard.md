# Riot API Key Exact Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Riot API key values with whitespace or control characters from being silently normalized before live Riot requests.

**Architecture:** Add a small `parseRiotApiKeyConfig()` helper in `server.js` and route `resolveApiKey()` through it for both request body overrides and `RIOT_API_KEY` from the environment. Cover the helper behavior through extracted-function tests, then document that the frontend may trim typed input before submit but the server does not normalize direct API/env secret material.

**Tech Stack:** Node.js CommonJS server, extracted function regression tests, README operator docs.

---

### Task 1: Add RED Tests For Exact Riot API Key Handling

**Files:**
- Create: `test-artifacts/server/riot-api-key-config-tests.mjs`

- [x] **Step 1: Write the failing tests**

Create a test harness that extracts `resolveApiKey()` from `server.js` and executes it with a fake `process.env`.

Use fake non-secret keys:

```js
const userKey = "RGAPI-user-key-abcdefghijklmnopqrstuvwxyz";
const envKey = "RGAPI-env-key-abcdefghijklmnopqrstuvwxyz";
```

Test cases:

- exact request body key returns `userKey`
- missing or empty request body key falls back to exact `envKey`
- invalid request body key such as `"not-a-key"` falls back to exact `envKey`
- request body key with trailing whitespace returns `null` when no env key exists
- request body key with internal whitespace returns `null` when no env key exists
- env key with trailing whitespace returns `null`
- env key with internal whitespace returns `null`
- whitespace-only env key returns `null`

- [x] **Step 2: Run focused RED**

Run:

```bash
node test-artifacts/server/riot-api-key-config-tests.mjs
```

Expected: whitespace request/env key tests fail because the current resolver trims request body keys and returns raw environment keys.

Result: RED confirmed. Riot API key config tests reported `4 passed, 5 failed`; request body keys were trimmed and environment keys with whitespace/control material were returned.

### Task 2: Add Exact Riot API Key Parser

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add parser**

Add:

```js
function parseRiotApiKeyConfig(rawKey) {
  const value = rawKey === undefined || rawKey === null ? "" : String(rawKey);
  if (value === "") {
    return "";
  }
  if (value.trim() !== value || /\s/u.test(value) || /[\u0000-\u001F\u007F]/u.test(value)) {
    return "";
  }
  if (!value.startsWith("RGAPI-") || value.length <= 20) {
    return "";
  }
  return value;
}
```

- [x] **Step 2: Use parser in `resolveApiKey()`**

Change:

```js
function resolveApiKey(userKey) {
  if (typeof userKey === "string" && userKey.startsWith("RGAPI-") && userKey.length > 20) {
    return userKey.trim();
  }
  return process.env.RIOT_API_KEY || null;
}
```

to:

```js
function resolveApiKey(userKey) {
  const userApiKey = parseRiotApiKeyConfig(userKey);
  if (userApiKey) {
    return userApiKey;
  }
  return parseRiotApiKeyConfig(process.env.RIOT_API_KEY) || null;
}
```

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/riot-api-key-config-tests.mjs &&
node test-artifacts/server/riot-api-key-config-tests.mjs
```

Expected: syntax checks exit 0 and Riot API key config tests pass.

Result: Focused GREEN passed. Syntax checks exited 0 and Riot API key config tests reported `9 passed, 0 failed`.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-riot-api-key-exact-guard.md`

- [x] **Step 1: Document `RIOT_API_KEY` contract**

Document that server-side `RIOT_API_KEY` and direct API `riotApiKey` override values must be exact `RGAPI-...` strings without whitespace or control characters. The browser login form may trim typed input before sending, but the server does not trim direct API/env secret material.

- [x] **Step 2: Run full QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-riot-api-key-exact-guard.md
node --check server.js &&
node --check test-artifacts/server/riot-api-key-config-tests.mjs &&
node test-artifacts/server/riot-api-key-config-tests.mjs &&
npm test &&
git diff --check
```

Expected: placeholder scan has no matches, all commands exit 0, and the full suite includes the new Riot API key config test file.

Result: Full QA passed. Placeholder scan exited 1 with no matches, syntax checks exited 0, focused Riot API key config tests reported `9 passed, 0 failed`, `npm test` reported `983 passed, 0 failed across 31 test file(s)`, and `git diff --check` exited 0.
