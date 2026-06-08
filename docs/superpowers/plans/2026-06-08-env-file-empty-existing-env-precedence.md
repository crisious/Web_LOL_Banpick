# Env File Empty Existing Env Precedence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the local `.env` loader never overwrites an already-defined environment key, even when the existing value is an empty string.

**Architecture:** Keep the current lightweight `.env` loader and extracted-function test harness. Replace the truthy-value overwrite guard with an own-property check so `KEY=""` in the ambient environment remains authoritative while absent keys still load from `.env`.

**Tech Stack:** Node.js CommonJS server, extracted function regression tests, README/runbook operator docs.

---

### Task 1: Add RED Test For Empty Existing Env

**Files:**
- Modify: `test-artifacts/server/env-file-tests.mjs`

- [x] **Step 1: Write the failing test**

Add a case after the existing non-empty precedence check:

```js
const emptyExistingEnv = loadEnvFromString("PUBLIC_DEMO_MODE=readonly\n", { PUBLIC_DEMO_MODE: "" });
check("loadEnvFile does not overwrite existing empty env values",
  emptyExistingEnv.PUBLIC_DEMO_MODE,
  "");
```

- [x] **Step 2: Run focused RED**

Run:

```bash
node test-artifacts/server/env-file-tests.mjs
```

Expected: the new empty existing env test fails because the current loader only skips truthy `process.env[key]` values.

Result: RED confirmed. Env-file tests reported `7 passed, 1 failed`; existing `PUBLIC_DEMO_MODE=""` was overwritten by `.env` value `readonly`.

### Task 2: Preserve Existing Env By Key Presence

**Files:**
- Modify: `server.js`

- [x] **Step 1: Replace truthy skip with own-property skip**

Change:

```js
if (process.env[key]) {
  continue;
}
```

to:

```js
if (Object.prototype.hasOwnProperty.call(process.env, key)) {
  continue;
}
```

- [x] **Step 2: Run focused GREEN**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/env-file-tests.mjs &&
node test-artifacts/server/env-file-tests.mjs
```

Expected: syntax checks exit 0 and env-file tests pass.

Result: Focused GREEN passed. Syntax checks exited 0 and env-file tests reported `8 passed, 0 failed`.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-env-file-empty-existing-env-precedence.md`

- [x] **Step 1: Document env precedence**

Document that shell/platform environment variables take precedence over `.env` file entries when the key already exists, including empty string values.

- [x] **Step 2: Run full QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-env-file-empty-existing-env-precedence.md
node --check server.js &&
node --check test-artifacts/server/env-file-tests.mjs &&
node test-artifacts/server/env-file-tests.mjs &&
npm test &&
git diff --check
```

Expected: placeholder scan has no matches, all commands exit 0, and the full test suite includes the new env-file precedence assertion.

Result: Full QA passed. Placeholder scan reported no matches, focused env-file checks reported `8 passed, 0 failed`, `npm test` reported `935 passed, 0 failed across 27 test file(s)`, and `git diff --check` exited 0.
