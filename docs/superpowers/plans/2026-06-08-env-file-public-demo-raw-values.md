# Env File Public Demo Raw Values Implementation Plan

> **For agentic workers:** Use TDD. Add failing regression tests first, then implement the smallest `.env` loader change that makes them pass.

**Goal:** Ensure `.env` values for public demo configuration are not silently normalized before the server's fail-closed guards see them. `PUBLIC_DEMO_MODE= readonly` and `PUBLIC_DEMO_TOKEN=secret ` should remain raw values so the exact mode/token validators can reject them.

**Architecture:** Keep the lightweight local `.env` loader. Change value parsing so it skips blank/comment lines and still accepts whitespace around the key and `=`, but preserves the raw value text after `=`. Quoted values are unwrapped only when the first and last value characters are quotes. This keeps `KEY=value` and `KEY="value"` working while preventing whitespace after `=` or at the end of a value from being hidden.

**Tech Stack:** Node.js CommonJS server, extracted function regression test, README/runbook operator docs.

---

### Task 1: Add RED Tests For `.env` Value Normalization

**Files:**
- Add: `test-artifacts/server/env-file-tests.mjs`

- [x] **Step 1: Extract and run `loadEnvFile()` with fake fs/process**

Create a test harness that extracts `loadEnvFile()` from `server.js`, injects a fake `fs` object and fake `process.env`, then calls it with in-memory file contents.

- [x] **Step 2: Cover raw public demo config values**

Add coverage that:

- `PUBLIC_DEMO_MODE= readonly` remains `" readonly"`
- `PUBLIC_DEMO_TOKEN=secret ` remains `"secret "`
- exact quoted values such as `PUBLIC_DEMO_TOKEN="secret value"` unwrap to `"secret value"`
- existing process env values are not overwritten

- [x] **Step 3: Run focused tests and confirm RED**

Run:

```bash
node test-artifacts/server/env-file-tests.mjs
```

Expected: the new raw whitespace preservation tests fail because the current loader trims values and consumes whitespace after `=`.

Result: RED confirmed. Env-file tests reported `5 passed, 2 failed`; `PUBLIC_DEMO_MODE= readonly` was loaded as `readonly`, and `PUBLIC_DEMO_TOKEN=demo-secret ` was loaded as `demo-secret`.

### Task 2: Preserve Raw `.env` Values After `=`

**Files:**
- Modify: `server.js`

- [x] **Step 1: Match against the raw line**

Keep `line.trim()` only for blank/comment detection. Match the original line with a pattern that permits whitespace around the key and equals sign, but captures everything after `=` as the raw value.

- [x] **Step 2: Stop trimming before quote handling**

Remove `rawValue.trim()`. Unwrap quotes only when the raw value starts and ends with the same quote character.

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/env-file-tests.mjs &&
node test-artifacts/server/env-file-tests.mjs
```

Expected: env-file tests pass and syntax checks exit 0.

Result: Focused GREEN passed. Syntax checks exited 0 and env-file tests reported `7 passed, 0 failed`.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Document `.env` raw value behavior**

Document that `.env` values for `PUBLIC_DEMO_MODE` and `PUBLIC_DEMO_TOKEN` are not trimmed before validation, so accidental whitespace is surfaced through the existing fail-closed checks.

- [x] **Step 2: Run full QA**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/env-file-tests.mjs &&
node test-artifacts/server/env-file-tests.mjs &&
npm test &&
git diff --check
```

Expected: all commands exit 0 with no whitespace errors.

Result: Full QA passed. Placeholder scan reported no matches, focused env-file checks reported `7 passed, 0 failed`, `npm test` reported `924 passed, 0 failed across 26 test file(s)`, and `git diff --check` exited 0.
