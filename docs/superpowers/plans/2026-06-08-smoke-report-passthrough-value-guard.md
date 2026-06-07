# Smoke Report Passthrough Value Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject invalid allowlisted smoke report pass-through option values before report directories or metadata artifacts are created.

**Architecture:** Keep `scripts/run-smoke-report.mjs` responsible for runner-level preflight. Reuse the direct smoke CLI option contracts for pass-through values that the runner explicitly allows, while still letting runtime smoke checks create evidence for server/API failures.

**Tech Stack:** Node.js ESM scripts, zero-dependency runner parser tests under `test-artifacts/scripts`, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Runner Pass-Through Value Coverage

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add async rejection helper**

Add this helper near `checkThrows`:

```js
async function checkRejects(label, fn, expectedMessage) {
  try {
    await fn();
    console.log(`FAIL  ${label}`);
    console.log(`  expected reject ${JSON.stringify(expectedMessage)}`);
    fail++;
  } catch (error) {
    const ok = String(error.message) === expectedMessage;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) console.log(`  expected ${JSON.stringify(expectedMessage)}\n  got      ${JSON.stringify(error.message)}`);
    ok ? pass++ : fail++;
  }
}
```

- [x] **Step 2: Add duplicate and invalid value parser tests**

Add these near the existing unknown pass-through tests:

```js
checkThrows("parseRunnerArgs rejects duplicate smoke pass-through timeout",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--timeout-ms=1000", "--timeout-ms=2000"], {}),
  "--timeout-ms accepts only one value");

checkThrows("parseRunnerArgs rejects invalid smoke pass-through timeout",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--timeout-ms=0"], {}),
  "--timeout-ms must be a positive integer");

checkThrows("parseRunnerArgs rejects incomplete sample detail error pass-through",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--expect-sample-detail-error-message=blocked"], {}),
  "--expect-sample-detail-error-id is required when sample detail error options are set");

checkThrows("parseRunnerArgs rejects invalid sample list error status pass-through",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID", "--expect-sample-list-error-status=0"], {}),
  "--expect-sample-list-error-status must be a positive integer");
```

- [x] **Step 3: Add no-artifact failure test**

Add this after parser validation checks and before summary builder checks:

```js
const invalidOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-invalid-timeout");
fs.rmSync(invalidOutputRoot, { recursive: true, force: true });
await checkRejects("runSmokeReport rejects invalid pass-through before artifact creation",
  () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", `--output-root=${invalidOutputRoot}`, "--timeout-ms=0"], {}),
  "--timeout-ms must be a positive integer");
check("invalid pass-through does not create output root",
  fs.existsSync(invalidOutputRoot),
  false);
```

- [x] **Step 4: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: new value validation checks fail because `parseRunnerArgs` currently only checks pass-through option names.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `21 passed, 6 failed`. The invalid `--timeout-ms=0` case created `test-artifacts/tmp/smoke-report-invalid-timeout/...` before failing in child smoke, proving the artifact-creation gap.

### Task 2: Implement Runner Pass-Through Value Validation

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add allowed option constants**

Replace the flat `ALLOWED_SMOKE_ARG_PREFIXES` with grouped constants:

```js
const SMOKE_PASSTHROUGH_VALUE_OPTIONS = [
  "--token=",
  "--timeout-ms=",
  "--expect-sample-detail-error-id=",
  "--expect-sample-detail-error-status=",
  "--expect-sample-detail-error-code=",
  "--expect-sample-detail-error-message=",
  "--expect-sample-list-error-status=",
  "--expect-sample-list-error-code=",
  "--expect-sample-list-error-message=",
];
const SAMPLE_DETAIL_ERROR_OPTIONS = [
  "--expect-sample-detail-error-id=",
  "--expect-sample-detail-error-status=",
  "--expect-sample-detail-error-code=",
  "--expect-sample-detail-error-message=",
];
const SAMPLE_LIST_ERROR_OPTIONS = [
  "--expect-sample-list-error-status=",
  "--expect-sample-list-error-code=",
  "--expect-sample-list-error-message=",
];
```

- [x] **Step 2: Add single pass-through value helper**

Add this near `singleOptionArg`:

```js
function passThroughOptionArg(args, prefix) {
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) {
    throw new Error(`${prefix.slice(0, -1)} accepts only one value`);
  }
  return matches[0];
}
```

- [x] **Step 3: Add validation helper**

Add:

```js
function assertPositiveIntegerOption(args, prefix, message) {
  const arg = passThroughOptionArg(args, prefix);
  if (!arg) return;
  const value = Number(arg.slice(prefix.length));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(message);
  }
}

function validateExtraSmokeArgs(extraSmokeArgs) {
  for (const arg of extraSmokeArgs) {
    if (SMOKE_PASSTHROUGH_VALUE_OPTIONS.some((prefix) => arg.startsWith(prefix))) continue;
    throw new Error(`unknown smoke report option: ${arg}`);
  }

  for (const prefix of SMOKE_PASSTHROUGH_VALUE_OPTIONS) {
    passThroughOptionArg(extraSmokeArgs, prefix);
  }
  assertPositiveIntegerOption(extraSmokeArgs, "--timeout-ms=", "--timeout-ms must be a positive integer");
  assertPositiveIntegerOption(extraSmokeArgs, "--expect-sample-detail-error-status=", "--expect-sample-detail-error-status must be a positive integer");
  assertPositiveIntegerOption(extraSmokeArgs, "--expect-sample-list-error-status=", "--expect-sample-list-error-status must be a positive integer");

  const hasSampleDetailErrorArg = SAMPLE_DETAIL_ERROR_OPTIONS.some((prefix) => extraSmokeArgs.some((arg) => arg.startsWith(prefix)));
  if (hasSampleDetailErrorArg) {
    const id = passThroughOptionArg(extraSmokeArgs, "--expect-sample-detail-error-id=")?.slice("--expect-sample-detail-error-id=".length).trim() || "";
    const code = passThroughOptionArg(extraSmokeArgs, "--expect-sample-detail-error-code=")?.slice("--expect-sample-detail-error-code=".length).trim() || "";
    if (!id) throw new Error("--expect-sample-detail-error-id is required when sample detail error options are set");
    if (!code) throw new Error("--expect-sample-detail-error-code is required when --expect-sample-detail-error-id is set");
  }

  const hasSampleListErrorArg = SAMPLE_LIST_ERROR_OPTIONS.some((prefix) => extraSmokeArgs.some((arg) => arg.startsWith(prefix)));
  if (hasSampleListErrorArg) {
    const code = passThroughOptionArg(extraSmokeArgs, "--expect-sample-list-error-code=")?.slice("--expect-sample-list-error-code=".length).trim() || "";
    if (!code) throw new Error("--expect-sample-list-error-code is required when sample list error options are set");
  }
}
```

- [x] **Step 4: Call validation from `parseRunnerArgs`**

Replace the inline unknown-option loop with:

```js
validateExtraSmokeArgs(extraSmokeArgs);
```

- [x] **Step 5: Run GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: runner tests pass with the new validation checks.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0 with `27 passed, 0 failed`, including `invalid pass-through does not create output root`.

### Task 3: Verify, Document, And Sync

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-passthrough-value-guard.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document pass-through value contract**

State that allowlisted `smoke:report:*` pass-through options are also validated for singleton/value requirements before artifact creation.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: syntax check, focused runner suite, full test suite, and whitespace check all pass.

Observed: command exited 0. Focused runner suite reported `27 passed, 0 failed`; full `npm test` reported `733 passed, 0 failed across 25 test file(s)`; `git diff --check` reported no whitespace errors.

- [x] **Step 3: Commit and push**

Run:

```bash
git add scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-passthrough-value-guard.md
git commit -m "ci: validate smoke report passthrough values"
git push origin main
```

Expected: commit lands on `main` and push triggers GitHub Actions QA.

Observed: committed and pushed `0e3146907926eea320c8055a190535146a70f783` to `main` with message `ci: validate smoke report passthrough values`.

- [x] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 5
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: latest run for the pushed head SHA succeeds, uploaded artifact contains `qa-summary.json`, read-only smoke reports zero failures, and sensitive-value search has no matches.

Observed: GitHub Actions QA run `27106249286` completed successfully for head SHA `0e3146907926eea320c8055a190535146a70f783`. Artifact `qa-automation-27106249286` / ID `7468446978` contained `qa-summary.json`, `smoke-run.json`, and `smoke-report.json`; `qa-summary.json` recorded read-only smoke `155 passed, 0 failed`. Sensitive-value search across the downloaded artifact directory found no matches.
