# Smoke Unknown Option Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent direct smoke CLI option typos from being silently ignored.

**Architecture:** Add a strict option allowlist inside `parseSmokeArgs`. Positional base URL remains the only non-option argument. Boolean smoke flags and known `--name=value` options are accepted; every other `--...` argument fails before network requests or report JSON writes.

**Tech Stack:** Node.js ESM scripts, zero-dependency parser/CLI tests under `test-artifacts/scripts`, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Unknown Option Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Add parser unknown option test**

Add this near the existing `parseSmokeArgs` validation tests:

```js
checkThrows("parseSmokeArgs rejects unknown smoke options",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expectmode=readonly"], {}),
  "unknown smoke option: --expectmode=readonly");
```

- [x] **Step 2: Add CLI unknown option concise failure test**

Add this near the existing no-server CLI parser failure tests:

```js
const unknownSmokeOption = spawnSync(process.execPath, [smokePath, "--expectmode=readonly"], {
  encoding: "utf8",
});

check("CLI exits non-zero for unknown smoke option",
  unknownSmokeOption.status,
  1);
check("CLI prints concise unknown smoke option failure without stack trace",
  unknownSmokeOption.stderr.trim(),
  "FAIL unknown smoke option: --expectmode=readonly");
```

- [x] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the new parser and CLI checks fail because unknown `--...` smoke options are currently ignored and the CLI proceeds to the default local smoke target.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `115 passed, 2 failed`. The parser check failed because no error was thrown, and the CLI check showed the command proceeding to `/healthz` with `FAIL request /healthz failed` instead of failing on the unknown option.

### Task 2: Implement Unknown Option Guard

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`

- [x] **Step 1: Add strict option allowlist**

Inside `parseSmokeArgs`, after `args` and `singleOptionArg` are available, add:

```js
const booleanOptions = new Set(["--require-url", "--require-https", "--require-token"]);
const valueOptionPrefixes = [
  "--token=",
  "--expect-mode=",
  "--min-samples=",
  "--timeout-ms=",
  "--expect-sample-detail-error-id=",
  "--expect-sample-detail-error-status=",
  "--expect-sample-detail-error-code=",
  "--expect-sample-detail-error-message=",
  "--expect-sample-list-error-status=",
  "--expect-sample-list-error-code=",
  "--expect-sample-list-error-message=",
  "--report-json=",
];
for (const arg of args) {
  if (!arg.startsWith("--")) continue;
  if (booleanOptions.has(arg)) continue;
  if (valueOptionPrefixes.some((prefix) => arg.startsWith(prefix))) continue;
  throw new Error(`unknown smoke option: ${arg}`);
}
```

- [x] **Step 2: Run GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: external demo smoke tests pass with the new parser and CLI unknown option checks.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 0 and reported `117 passed, 0 failed`.

### Task 3: Verify, Document, And Sync

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-unknown-option-guard.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document operator contract**

State that unknown direct smoke options fail before network requests or report artifact writes.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check
```

Expected: syntax check, focused external smoke suite, full test suite, and whitespace check all pass.

Observed: `node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check` exited 0. External demo smoke tests reported `117 passed, 0 failed`; full suite reported `725 passed, 0 failed across 25 test file(s)`.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-unknown-option-guard.md
git commit -m "ci: reject unknown smoke options"
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
