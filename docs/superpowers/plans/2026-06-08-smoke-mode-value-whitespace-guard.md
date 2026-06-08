# Smoke Mode Value Whitespace Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject whitespace-padded smoke mode option values before network probes or report artifact creation.

**Architecture:** Keep the existing mode allowlists, but stop normalizing mode option values with `trim()`. Direct smoke validates raw lowercase `--expect-mode=<value>` against `full`, `protected`, and `readonly`; the report runner validates raw `--mode=<value>` against its four mode names before deriving expected mode and artifact paths.

**Tech Stack:** Node.js ESM smoke scripts, script-level parser tests, README/runbook operator docs.

---

### Task 1: Add RED Tests For Whitespace-Padded Mode Values

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke parser rejection tests**

```js
checkThrows("parseSmokeArgs rejects whitespace expected mode",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expect-mode= readonly"], {}),
  "--expect-mode must be one of: full, protected, readonly");

checkThrows("parseSmokeArgs rejects empty expected mode option",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expect-mode="], {}),
  "--expect-mode must be one of: full, protected, readonly");
```

- [x] **Step 2: Add report runner parser rejection tests**

```js
checkThrows("parseRunnerArgs rejects whitespace mode value",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode= readonly"], {}),
  "--mode must be one of: readonly, protected, external-readonly, external-protected");

const whitespaceModeOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-whitespace-mode");
fs.rmSync(whitespaceModeOutputRoot, { recursive: true, force: true });
await checkRejects("runSmokeReport rejects whitespace mode before artifact creation",
  () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", "--mode= readonly", `--output-root=${whitespaceModeOutputRoot}`], {}),
  "--mode must be one of: readonly, protected, external-readonly, external-protected");
check("whitespace mode rejection does not create output root",
  fs.existsSync(whitespaceModeOutputRoot),
  false);
```

- [x] **Step 3: Run focused tests and confirm RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke fails the new whitespace/empty `--expect-mode` tests; report runner fails the new whitespace `--mode` parser and pre-artifact tests.

### Task 2: Validate Raw Mode Values

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Stop trimming direct smoke expected mode**

Replace the `--expect-mode` parsing with raw lowercase validation:

```js
const expectedMode = modeArg ? modeArg.slice("--expect-mode=".length).toLowerCase() : "";
if (modeArg && !validExpectedModes.includes(expectedMode)) {
  throw new Error("--expect-mode must be one of: " + validExpectedModes.join(", "));
}
```

Use the same raw lowercase value for external URL preflight label selection:

```js
const modeForLabel = modeArg?.slice("--expect-mode=".length).toLowerCase();
```

- [x] **Step 2: Stop trimming report runner mode**

Replace runner mode parsing with raw value validation:

```js
const mode = modeArg ? modeArg.slice("--mode=".length) : "readonly";
if (!VALID_MODES.includes(mode)) {
  throw new Error("--mode must be one of: " + VALID_MODES.join(", "));
}
```

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node --check scripts/run-smoke-report.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke tests and runner tests pass with the new raw mode guard.

### Task 3: Update Operator Docs And Full QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update mode value contract docs**

Document that `--expect-mode` and `--mode` values must exactly match their allowlisted lowercase values with no leading/trailing whitespace.

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

### Verification Results

- RED direct smoke: 188 passed, 2 failed on the new whitespace/empty `--expect-mode` tests.
- RED smoke report runner: 94 passed, 3 failed; `--mode= readonly` reached child smoke and created a report output root before this guard.
- GREEN direct smoke: 190 passed, 0 failed.
- GREEN smoke report runner: 97 passed, 0 failed.
- Full local QA: `npm test` 876 passed, 0 failed across 25 test files; `git diff --check` passed.
