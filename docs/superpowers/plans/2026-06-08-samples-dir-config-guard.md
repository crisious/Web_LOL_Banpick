# Samples Dir Config Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make server `SAMPLES_DIR` config fail fast on accidental leading/trailing whitespace or control characters instead of silently normalizing the sample storage root.

**Architecture:** Tighten the existing `resolveSamplesDir()` helper in `server.js` so only missing/empty values use the default app data directory. Update the existing extracted-function `samples-dir-tests.mjs` coverage, then document the operator-facing path contract beside the external demo storage notes.

**Tech Stack:** Node.js CommonJS server, extracted function regression tests, README/runbook operator docs.

---

### Task 1: Add RED Tests For Samples Dir Config Guard

**Files:**
- Modify: `test-artifacts/server/samples-dir-tests.mjs`

- [x] **Step 1: Update path config tests**

Change the current trimming expectation:

```js
check("resolveSamplesDir trims and resolves relative paths from app root",
  resolveSamplesDir("  runtime/samples  ", "/app/lol-ai-coach"),
  "/app/lol-ai-coach/runtime/samples");
```

to exact-path expectations:

```js
check("resolveSamplesDir resolves relative paths from app root",
  resolveSamplesDir("runtime/samples", "/app/lol-ai-coach"),
  "/app/lol-ai-coach/runtime/samples");
check("resolveSamplesDir preserves internal path spaces",
  resolveSamplesDir("runtime/sample store", "/app/lol-ai-coach"),
  "/app/lol-ai-coach/runtime/sample store");
```

Add throwing cases:

```js
const samplesDirError = "SAMPLES_DIR must be empty or a filesystem path without leading/trailing whitespace or control characters.";

for (const [label, rawDir] of [
  ["leading whitespace SAMPLES_DIR is rejected", " runtime/samples"],
  ["trailing whitespace SAMPLES_DIR is rejected", "runtime/samples "],
  ["whitespace-only SAMPLES_DIR is rejected", "   "],
  ["tab SAMPLES_DIR is rejected", "runtime\tsamples"],
  ["newline SAMPLES_DIR is rejected", "runtime\nsamples"],
]) {
  checkThrows(label, () => resolveSamplesDir(rawDir, "/app/lol-ai-coach"), samplesDirError);
}
```

- [x] **Step 2: Run focused RED**

Run:

```bash
node test-artifacts/server/samples-dir-tests.mjs
```

Expected: new rejection tests fail because the current helper trims configured paths and accepts control characters.

Result: RED confirmed. Samples dir tests reported `16 passed, 5 failed`; leading/trailing whitespace and control-character values were normalized or accepted instead of rejected.

### Task 2: Tighten `resolveSamplesDir()`

**Files:**
- Modify: `server.js`

- [x] **Step 1: Replace trimming behavior**

Change:

```js
function resolveSamplesDir(configuredDir, appRoot) {
  const raw = String(configuredDir || "").trim();
  if (!raw) {
    return path.join(appRoot, "data", "samples");
  }
  return path.resolve(appRoot, raw);
}
```

to:

```js
function resolveSamplesDir(configuredDir, appRoot) {
  const value = configuredDir === undefined || configuredDir === null ? "" : String(configuredDir);
  if (value === "") {
    return path.join(appRoot, "data", "samples");
  }
  if (value.trim() !== value || /[\u0000-\u001F\u007F]/u.test(value)) {
    throw new Error("SAMPLES_DIR must be empty or a filesystem path without leading/trailing whitespace or control characters.");
  }
  return path.resolve(appRoot, value);
}
```

- [x] **Step 2: Run focused GREEN**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/samples-dir-tests.mjs &&
node test-artifacts/server/samples-dir-tests.mjs
```

Expected: syntax checks exit 0 and samples dir tests pass.

Result: Focused GREEN passed. Syntax checks exited 0 and samples dir tests reported `21 passed, 0 failed`.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-samples-dir-config-guard.md`

- [x] **Step 1: Document `SAMPLES_DIR` contract**

Document that `SAMPLES_DIR` defaults to `./data/samples` only when missing or empty. Non-empty values may be relative or absolute filesystem paths, including internal spaces, but leading/trailing whitespace and ASCII control characters fail before startup.

- [x] **Step 2: Run full QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-samples-dir-config-guard.md
node --check server.js &&
node --check test-artifacts/server/samples-dir-tests.mjs &&
node test-artifacts/server/samples-dir-tests.mjs &&
npm test &&
git diff --check
```

Expected: placeholder scan has no matches, all commands exit 0, and the full suite keeps all sample storage path checks green.

Result: Full QA passed. Placeholder scan exited 1 with no matches, syntax checks exited 0, focused samples dir tests reported `21 passed, 0 failed`, `npm test` reported `974 passed, 0 failed across 30 test file(s)`, and `git diff --check` exited 0.
