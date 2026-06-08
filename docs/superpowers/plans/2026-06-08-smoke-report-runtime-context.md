# Smoke Report Runtime Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record Node.js runtime and OS context in `qa-summary.json.latestRun.runtime` so QA artifacts show the basic execution environment that produced the smoke evidence.

**Architecture:** Add a small runtime context helper to `scripts/run-smoke-report.mjs`, next to the existing git and CI context helpers. `buildQaSummary()` accepts an optional supplied runtime context for tests, and real report runs pass the current `process` values explicitly.

**Tech Stack:** Node.js ESM, built-in `process`, existing zero-dependency test harness, Markdown docs, GitHub Actions artifact verification.

---

## File Structure

- Modify: `scripts/run-smoke-report.mjs`
  - Add `runtimeContextFor(runtimeProcess)` helper.
  - Record `latestRun.runtime` inside `buildQaSummary()`.
  - Pass `runtimeContextFor(process)` from `runSmokeReport()`.
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Extend the exact protected `qaSummary` fixture with supplied runtime context.
  - Add focused assertions for supplied runtime context and runtime helper extraction.
- Modify: `README.md`
  - Document that `qa-summary.json` records Node/runtime context.
- Modify: `docs/external-demo-runbook.md`
  - Mirror the operator-facing artifact field list.
- Create: `docs/superpowers/plans/2026-06-08-smoke-report-runtime-context.md`
  - Track RED/GREEN, local QA, staged QA, GitHub Actions artifact, and Obsidian evidence.

## Task 1: Add Failing Runtime Context Tests

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Extend the protected exact summary fixture**

Add this to the protected `runner.buildQaSummary()` call:

```js
runtimeContext: {
  nodeVersion: "v20.19.5",
  platform: "linux",
  arch: "x64",
},
```

Then add the same object under the expected `latestRun.runtime` key.

- [x] **Step 2: Add focused runtime assertions**

Pass this to the existing `passingRequiredSummary` build call:

```js
runtimeContext: {
  nodeVersion: "v22.16.0",
  platform: "darwin",
  arch: "arm64",
},
```

Add these assertions after the CI context assertions:

```js
check("buildQaSummary records supplied runtime context",
  passingRequiredSummary?.latestRun?.runtime,
  {
    nodeVersion: "v22.16.0",
    platform: "darwin",
    arch: "arm64",
  });

check("runtimeContextFor records process runtime fields",
  runner.runtimeContextFor?.({
    version: "v20.19.5",
    platform: "linux",
    arch: "x64",
  }),
  {
    nodeVersion: "v20.19.5",
    platform: "linux",
    arch: "x64",
  });
```

- [x] **Step 3: Verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Actual: `124 passed, 3 failed`. Failures were the exact summary missing `latestRun.runtime`, the focused supplied runtime context assertion, and the missing `runtimeContextFor()` export.

## Task 2: Implement Runtime Context in the Runner

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add runtime helper**

Add after `ciContextFor()`:

```js
export function runtimeContextFor(runtimeProcess = process) {
  const nodeVersion = typeof runtimeProcess?.nodeVersion === "string"
    ? runtimeProcess.nodeVersion
    : runtimeProcess?.version;
  return {
    nodeVersion: ciText(nodeVersion),
    platform: ciText(runtimeProcess?.platform),
    arch: ciText(runtimeProcess?.arch),
  };
}
```

- [x] **Step 2: Inject runtime context into `buildQaSummary()`**

Add `runtimeContext = null` to the destructured parameters and record it under `latestRun` after `ci`:

```js
runtime: runtimeContext || emptyRuntimeContext(),
```

- [x] **Step 3: Pass runtime context from real runs**

In the `buildQaSummary({ ... })` call inside `runSmokeReport()`, pass:

```js
runtimeContext: runtimeContextFor(process),
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Actual: `127 passed, 0 failed`.

## Task 3: Document and Verify the Artifact Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-runtime-context.md`

- [x] **Step 1: Update docs**

Change the `qa-summary.json` field list from:

```md
CI workflow/run context, smoke pass/fail
```

to:

```md
CI workflow/run context, Node/runtime context, smoke pass/fail
```

Apply equivalent wording to the English runbook paragraph.

- [x] **Step 2: Run local QA**

Run:

```bash
rg -n -e "TO""DO" -e "TB""D" -e "fill"" in" -e "implement"" later" -e "Similar"" to" -e "appropriate"" error" docs/superpowers/plans/2026-06-08-smoke-report-runtime-context.md
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --check
```

Expected:
- Placeholder scan exits 1 with no matches.
- Syntax checks exit 0.
- Focused runner tests pass.
- Full suite passes.
- Diff whitespace check exits 0.

Actual:
- Placeholder scan exited 1 with no matches.
- `node --check scripts/run-smoke-report.mjs` exited 0.
- `node --check test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0.
- `node test-artifacts/scripts/smoke-report-runner-tests.mjs`: `127 passed, 0 failed`.
- `npm test`: `1304 passed, 0 failed across 40 test file(s)`.
- `git diff --check` exited 0.

- [x] **Step 3: Verify a local smoke report**

Start a read-only server and run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/qa-runtime-context-local npm run smoke:report:readonly
node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync("test-artifacts/tmp/qa-runtime-context-local/qa-summary.json","utf8")); if (!s.latestRun.runtime.nodeVersion || !s.latestRun.runtime.platform || !s.latestRun.runtime.arch) process.exit(1); console.log(JSON.stringify(s.latestRun.runtime, null, 2));'
```

Expected: local summary passes smoke and records non-empty runtime context.

Actual: local read-only smoke report passed with `156 passed, 0 failed`; `qa-summary.json.latestRun.runtime` recorded `nodeVersion: "v25.9.0"`, `platform: "darwin"`, and `arch: "arm64"`. Required checks passed with `13 passed, 0 failed, 0 missing`; sensitive evidence scan found no matches.

## Task 4: Commit, Push, and Capture Remote Evidence

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Stage and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-runtime-context.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --cached --check
```

Expected: focused and full suites pass; cached diff has no whitespace errors.

Actual:
- `git diff --cached --check` exited 0.
- Placeholder scan exited 1 with no matches.
- `node test-artifacts/scripts/smoke-report-runner-tests.mjs`: `127 passed, 0 failed`.
- `npm test`: `1304 passed, 0 failed across 40 test file(s)`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git commit -m "ci: record smoke report runtime context"
git push origin main
```

Expected: commit lands on `main` and push updates `origin/main`.

- [ ] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 5
gh run view <run-id> --json status,conclusion,headSha,url,workflowName,createdAt,updatedAt
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/qa-runtime-context-gh
```

Expected: run succeeds for the pushed commit, downloaded `qa-summary.json` has non-empty `latestRun.runtime.nodeVersion`, `platform`, and `arch`, plus the existing git and CI context.

- [ ] **Step 4: Update Obsidian**

Append a log section before `## 리스크 관리` with:
- commit SHA and message
- RED/GREEN evidence
- local QA counts and runtime context
- GitHub run id, artifact id, artifact runtime context
- final `main...origin/main` sync evidence

## Self-Review

- Spec coverage: the plan covers test-first behavior, runner implementation, docs, local QA, staged QA, remote artifact inspection, and Obsidian tracking.
- Placeholder scan target: the plan avoids unresolved placeholder wording and includes concrete commands, expected outputs, and file paths.
- Type consistency: the new payload key is consistently named `runtime`; its fields are `nodeVersion`, `platform`, and `arch`.
