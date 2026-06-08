# Smoke Token Whitespace Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject whitespace-containing protected smoke token values before network probes or report artifact creation.

**Architecture:** Preserve existing token scoping: tokens are accepted only for protected token-required smoke. Add a shared local validation pattern in each smoke script so whitespace-only tokens still fail as missing, while non-empty tokens with leading, trailing, or internal whitespace fail with a token-shape error before any request or artifact directory is created.

**Tech Stack:** Node.js ESM smoke scripts, script-level parser tests, README/runbook operator docs.

---

### Task 1: Add RED Tests For Whitespace-Containing Tokens

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke parser rejection tests**

```js
checkThrows("parseSmokeArgs rejects protected inline token with leading whitespace",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--require-token",
    "--expect-mode=protected",
    "--token= secret",
  ], {}),
  "--token must not contain whitespace");

checkThrows("parseSmokeArgs rejects protected env token with trailing whitespace",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--require-token",
    "--expect-mode=protected",
  ], { PUBLIC_DEMO_TOKEN: "env-token " }),
  "PUBLIC_DEMO_TOKEN must not contain whitespace");
```

- [x] **Step 2: Add report runner parser and pre-artifact rejection tests**

```js
checkThrows("parseRunnerArgs rejects protected inline token with leading whitespace",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=protected", "--token= secret"], {}),
  "--token must not contain whitespace");

checkThrows("parseRunnerArgs rejects protected env token with trailing whitespace",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=protected"], { PUBLIC_DEMO_TOKEN: "env-token " }),
  "PUBLIC_DEMO_TOKEN must not contain whitespace");

const whitespaceTokenOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-whitespace-token");
fs.rmSync(whitespaceTokenOutputRoot, { recursive: true, force: true });
await checkRejects("runSmokeReport rejects whitespace token before artifact creation",
  () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", "--mode=protected", `--output-root=${whitespaceTokenOutputRoot}`], { PUBLIC_DEMO_TOKEN: "env-token " }),
  "PUBLIC_DEMO_TOKEN must not contain whitespace");
check("whitespace token rejection does not create output root",
  fs.existsSync(whitespaceTokenOutputRoot),
  false);
```

- [x] **Step 3: Run focused tests and confirm RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke fails the two new token whitespace tests; report runner fails the new parser/pre-artifact token whitespace tests.

Result: RED confirmed. Direct smoke reported `190 passed, 2 failed`; report runner reported `97 passed, 4 failed`. The runner pre-artifact test also showed a whitespace env token could reach child smoke and create the output root before the guard existed.

### Task 2: Validate Token Values Without Trimming Secrets

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add direct smoke token parser**

Inside `parseSmokeArgs()`, add:

```js
function parseDemoTokenValue(rawToken, sourceName) {
  if (!rawToken || rawToken.trim() === "") {
    return "";
  }
  if (rawToken.trim() !== rawToken || /\s/u.test(rawToken)) {
    throw new Error(`${sourceName} must not contain whitespace`);
  }
  return rawToken;
}
```

Use it for both inline and environment tokens:

```js
const demoToken = requireToken
  ? parseDemoTokenValue(tokenArg ? tokenArg.slice("--token=".length) : env.PUBLIC_DEMO_TOKEN || "", tokenArg ? "--token" : "PUBLIC_DEMO_TOKEN")
  : "";
```

- [x] **Step 2: Add report runner token parser**

Add the same `parseDemoTokenValue(rawToken, sourceName)` helper near `inlineTokenValue()`. Update `inlineTokenValue()` and protected env fallback:

```js
function inlineTokenValue(extraSmokeArgs) {
  const tokenArg = passThroughOptionArg(extraSmokeArgs, "--token=");
  return tokenArg ? parseDemoTokenValue(tokenArg.slice("--token=".length), "--token") : "";
}

const demoToken = tokenArg ? inlineTokenValue(extraSmokeArgs) : parseDemoTokenValue(env.PUBLIC_DEMO_TOKEN || "", "PUBLIC_DEMO_TOKEN");
```

Whitespace-only inline tokens should still return an empty string and preserve the existing `--require-token needs --token or PUBLIC_DEMO_TOKEN` failure.

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node --check scripts/run-smoke-report.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke tests and runner tests pass with the new token whitespace guard.

Result: Focused GREEN passed. Direct smoke reported `192 passed, 0 failed`; report runner reported `101 passed, 0 failed`.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update token value contract docs**

Document that protected smoke tokens must be non-empty and must not contain whitespace. Mention that whitespace-only tokens still fail as missing tokens.

- [x] **Step 2: Run full QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node --check scripts/run-smoke-report.mjs &&
node --check test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs &&
npm test &&
git diff --check
```

Expected: all commands exit 0 with no whitespace errors.

Result: Full QA passed. Syntax checks exited 0, direct smoke reported `192 passed, 0 failed`, report runner reported `101 passed, 0 failed`, `npm test` reported `882 passed, 0 failed across 25 test file(s)`, and `git diff --check` exited 0.
