# QA Artifact Root Path Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent direct smoke and report runner outputs from writing QA evidence directly into the `test-artifacts` root.

**Architecture:** Keep the existing artifact allowlist rooted at `test-artifacts`, but require at least one child directory below it. Direct `--report-json` must use `test-artifacts/<subdir>/.../*.json`; report runner `--output-root` must use `test-artifacts/<subdir>`.

**Tech Stack:** Node.js ESM scripts, zero-dependency parser tests, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Coverage For Artifact Root Rejection

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add direct smoke parser RED test**

Add a parser check near the existing `--report-json` path tests:

```js
checkThrows("parseSmokeArgs rejects root artifact report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/smoke-report.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [x] **Step 2: Add report runner parser RED test**

Add a parser check near the existing output root tests:

```js
checkThrows("parseRunnerArgs rejects artifact root output root",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts"], {}),
  "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [x] **Step 3: Run RED tests**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the new checks fail because root-level `test-artifacts` destinations are currently accepted.

Observed:

Direct smoke RED: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `133 passed, 1 failed`; `parseSmokeArgs rejects root artifact report JSON path` did not throw. Smoke report runner RED: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `41 passed, 1 failed`; `parseRunnerArgs rejects artifact root output root` did not throw.

### Task 2: Enforce Artifact Subdirectory Paths

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Tighten direct report JSON path normalization**

In `normalizeReportJsonPath()`, require at least one child directory under `test-artifacts`:

```js
const parts = normalized.split("/");
if (parts.length < 3 || parts[0] !== "test-artifacts" || !normalized.toLowerCase().endsWith(".json")) {
  throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
}
```

Keep absolute, traversal, and non-JSON paths rejected before network requests.

- [x] **Step 2: Tighten report runner output root normalization**

In `normalizeOutputRoot()`, reject the root itself:

```js
if (!normalized.startsWith("test-artifacts/")) {
  throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
}
```

Keep absolute, traversal, and non-artifact paths rejected before artifact creation.

- [x] **Step 3: Run focused GREEN tests**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: direct smoke tests and smoke report runner tests pass.

Observed:

`node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0. Direct smoke tests reported `134 passed, 0 failed`; smoke report runner tests reported `42 passed, 0 failed`.

### Task 3: Document, Verify, And Publish

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-qa-artifact-root-path-guard.md`

- [x] **Step 1: Document artifact subdirectory contract**

State that `--report-json` and `--output-root` must target a child directory such as `test-artifacts/qa-automation/...`; root-level `test-artifacts` or `test-artifacts/*.json` destinations fail before writes.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: command exits 0, focused suites pass, full suite passes, and diff check has no output.

Observed:

`node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` exited 0. Focused direct smoke tests reported `134 passed, 0 failed`; smoke report runner tests reported `42 passed, 0 failed`; the full npm suite reported `765 passed, 0 failed across 25 test file(s)`; `git diff --check` produced no output.

- [x] **Step 3: Commit and push**

Run:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-qa-artifact-root-path-guard.md
git commit -m "ci: require qa artifact subdirectories"
git push origin main
```

Expected: commit lands on `main` and pushes to `origin/main`.

Observed:

Commit `e04f36c` (`ci: require qa artifact subdirectories`) landed on `main` and pushed to `origin/main`.

- [x] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 6
gh run watch <run-id> --exit-status
gh run view <run-id> --json conclusion,headSha,status,url,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Download `qa-automation-<run-id>`, inspect `qa-summary.json`, and scan for sensitive values.

Expected: latest run for the pushed head SHA succeeds, uploaded artifact contains `qa-summary.json`, read-only smoke reports zero failures, and sensitive-value search has no matches.

Observed:

GitHub Actions QA run `27107533158` completed successfully for head SHA `e04f36c997d7537b71a08bb5e658f70d00fb3714`. Artifact `qa-automation-27107533158` (`7468860680`) was downloaded and inspected. `qa-summary.json` recorded read-only smoke status `passed`, `actualMode=readonly`, `expectedMode=readonly`, and `155 passed, 0 failed`; `smoke-report.json` matched that summary with `checkCount=155`. Sensitive-value scan across the downloaded artifact produced no matches.

- [ ] **Step 5: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed:
