# Smoke Singleton Option Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent direct smoke and smoke report commands from silently accepting duplicate singleton options.

**Architecture:** Add a small singleton option parser helper to the direct smoke CLI and the report runner. Direct smoke rejects repeated value options such as `--expect-mode=` and `--report-json=` before network requests or report writes. The report runner rejects repeated runner-owned options such as `--mode=` and `--output-root=` before report directory or artifact metadata creation.

**Tech Stack:** Node.js ESM scripts, zero-dependency parser tests under `test-artifacts/scripts`, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Parser Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke duplicate singleton test**

Add this near the existing `parseSmokeArgs` validation tests:

```js
checkThrows("parseSmokeArgs rejects duplicate singleton options",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expect-mode=readonly", "--expect-mode=protected"], {}),
  "--expect-mode accepts only one value");
```

- [x] **Step 2: Add report runner duplicate singleton tests**

Add these near the existing `parseRunnerArgs` validation tests:

```js
checkThrows("parseRunnerArgs rejects duplicate mode options",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--mode=protected"], {}),
  "--mode accepts only one value");

checkThrows("parseRunnerArgs rejects duplicate output root options",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/a", "--output-root=test-artifacts/b"], {}),
  "--output-root accepts only one value");
```

- [x] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the new direct smoke check fails because `parseSmokeArgs` currently uses the first `--expect-mode=` value. Both new report runner checks fail because `parseRunnerArgs` currently uses the first runner option and treats later duplicate options as extra smoke args.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` produced `113 passed, 1 failed`, with the new duplicate singleton check failing because no error was thrown. `node test-artifacts/scripts/smoke-report-runner-tests.mjs` produced `17 passed, 2 failed`, with both duplicate runner option checks failing because no error was thrown.

### Task 2: Implement Singleton Guards

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add and use direct smoke singleton helper**

Add this helper inside `parseSmokeArgs` in `scripts/external-demo-smoke.mjs` so the existing parser extraction tests evaluate it with the function body:

```js
function singleOptionArg(args, prefix) {
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) {
    throw new Error(`${prefix.slice(0, -1)} accepts only one value`);
  }
  return matches[0];
}
```

Then replace direct smoke singleton lookups:

```js
const tokenArg = singleOptionArg(args, "--token=");
const modeArg = singleOptionArg(args, "--expect-mode=");
const minSamplesArg = singleOptionArg(args, "--min-samples=");
const timeoutArg = singleOptionArg(args, "--timeout-ms=");
const sampleDetailErrorIdArg = singleOptionArg(args, "--expect-sample-detail-error-id=");
const sampleDetailErrorCodeArg = singleOptionArg(args, "--expect-sample-detail-error-code=");
const sampleDetailErrorStatusArg = singleOptionArg(args, "--expect-sample-detail-error-status=");
const sampleDetailErrorMessageArg = singleOptionArg(args, "--expect-sample-detail-error-message=");
const sampleListErrorCodeArg = singleOptionArg(args, "--expect-sample-list-error-code=");
const sampleListErrorStatusArg = singleOptionArg(args, "--expect-sample-list-error-status=");
const sampleListErrorMessageArg = singleOptionArg(args, "--expect-sample-list-error-message=");
const reportJsonArg = singleOptionArg(args, "--report-json=");
```

- [x] **Step 2: Add and use report runner singleton helper**

Add this helper near the top of `scripts/run-smoke-report.mjs`:

```js
function singleOptionArg(args, prefix) {
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) {
    throw new Error(`${prefix.slice(0, -1)} accepts only one value`);
  }
  return matches[0];
}
```

Then replace:

```js
const modeArg = args.find((arg) => arg.startsWith("--mode="));
const outputRootArg = args.find((arg) => arg.startsWith("--output-root="));
```

with:

```js
const modeArg = singleOptionArg(args, "--mode=");
const outputRootArg = singleOptionArg(args, "--output-root=");
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: focused parser suites pass with one new direct smoke test and two new report runner tests.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0. External demo smoke tests reported `114 passed, 0 failed`; smoke report runner tests reported `19 passed, 0 failed`.

### Task 3: Verify, Document, And Sync

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-singleton-option-guard.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document operator contract**

State that singleton smoke and report runner options accept one value only, and duplicate values fail before network requests or artifact creation.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: syntax checks, focused parser suites, full test suite, and whitespace check all pass.

Observed: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` exited 0. External demo smoke tests reported `114 passed, 0 failed`; smoke report runner tests reported `19 passed, 0 failed`; full suite reported `722 passed, 0 failed across 25 test file(s)`.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-singleton-option-guard.md
git commit -m "ci: reject duplicate smoke singleton options"
git push origin main
```

Expected: commit lands on `main` and push triggers GitHub Actions QA.

- [ ] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 5
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: latest run for the pushed head SHA succeeds, uploaded artifact contains `qa-summary.json`, read-only smoke reports zero failures, and sensitive-value search has no matches.
