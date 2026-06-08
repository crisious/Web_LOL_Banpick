# Agent Disable Codex Exact Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `AGENT_DISABLE_CODEX` disable Codex only when the value is exactly `1`, so whitespace in `.env` or shell config cannot silently switch AI analysis to Claude-only mode.

**Architecture:** Add a small `parseAgentDisableCodexConfig()` helper in `server.js` and use it inside `buildAnalysis()`. Cover the helper with an extracted-function regression test, then document the operator-facing exact flag contract in the AI architecture notes.

**Tech Stack:** Node.js CommonJS server, extracted function regression tests, README operator docs.

---

### Task 1: Add RED Tests For Exact Codex Disable Flag

**Files:**
- Create: `test-artifacts/server/agent-disable-codex-config-tests.mjs`

- [x] **Step 1: Write the failing tests**

Create a test harness that extracts `parseAgentDisableCodexConfig()` from `server.js`. If the helper does not exist yet, define this fallback to mirror the current expression:

```js
function parseAgentDisableCodexConfig(rawFlag) {
  return String(rawFlag || "").trim() === "1";
}
```

Test cases:

- `parseAgentDisableCodexConfig("1")` returns `true`
- missing, empty, `"0"`, `"true"`, and `"yes"` return `false`
- `" 1"` and `"1 "` return `false`

- [x] **Step 2: Run focused RED**

Run:

```bash
node test-artifacts/server/agent-disable-codex-config-tests.mjs
```

Expected: whitespace flag tests fail because the current expression trims before comparing.

Result: RED confirmed. Agent disable Codex config tests reported `6 passed, 2 failed`; leading/trailing whitespace values disabled Codex.

### Task 2: Use Exact Codex Disable Parser

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add exact parser**

Add:

```js
function parseAgentDisableCodexConfig(rawFlag) {
  return String(rawFlag || "") === "1";
}
```

- [x] **Step 2: Use parser in `buildAnalysis()`**

Change:

```js
const codexDisabled = String(process.env.AGENT_DISABLE_CODEX || "").trim() === "1";
```

to:

```js
const codexDisabled = parseAgentDisableCodexConfig(process.env.AGENT_DISABLE_CODEX);
```

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/agent-disable-codex-config-tests.mjs &&
node test-artifacts/server/agent-disable-codex-config-tests.mjs
```

Expected: syntax checks exit 0 and agent disable Codex config tests pass.

Result: Focused GREEN passed. Syntax checks exited 0 and agent disable Codex config tests reported `8 passed, 0 failed`.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-agent-disable-codex-exact-flag.md`

- [x] **Step 1: Document exact `AGENT_DISABLE_CODEX=1` contract**

Document that `AGENT_DISABLE_CODEX` disables Codex only when exactly `1`; values with whitespace or alternate spellings do not disable Codex.

- [x] **Step 2: Run full QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-agent-disable-codex-exact-flag.md
node --check server.js &&
node --check test-artifacts/server/agent-disable-codex-config-tests.mjs &&
node test-artifacts/server/agent-disable-codex-config-tests.mjs &&
npm test &&
git diff --check
```

Expected: placeholder scan has no matches, all commands exit 0, and the full suite includes the new agent disable Codex config test file.

Result: Full QA passed. Placeholder scan exited 1 with no matches, syntax checks exited 0, focused agent disable Codex config tests reported `8 passed, 0 failed`, `npm test` reported `957 passed, 0 failed across 29 test file(s)`, and `git diff --check` exited 0.
