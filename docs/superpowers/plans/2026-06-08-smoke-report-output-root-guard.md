# Smoke Report Output Root Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent smoke report runners from writing QA artifacts outside the intended `test-artifacts/...` tree.

**Architecture:** Keep `scripts/run-smoke-report.mjs` as the owner of report output paths. Add parser-level output root validation so bad `--output-root` or `SMOKE_REPORT_OUTPUT_ROOT` values fail before report directories, metadata, or `qa-summary.json` are created.

**Tech Stack:** Node.js ESM scripts, zero-dependency runner parser tests under `test-artifacts/scripts`, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Coverage For Unsafe Output Roots

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Write failing parser tests**

Add checks that reject absolute, non-artifact, and traversal output roots:

```js
  checkThrows("parseRunnerArgs rejects absolute output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=/tmp/qa-automation"], {}),
    "--output-root must be a relative path under test-artifacts");

  checkThrows("parseRunnerArgs rejects non-artifact output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=.github/qa-automation"], {}),
    "--output-root must be a relative path under test-artifacts");

  checkThrows("parseRunnerArgs rejects traversal output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/../qa-automation"], {}),
    "--output-root must be a relative path under test-artifacts");
```

- [x] **Step 2: Write failing no-artifact test**

Add a run-level regression proving env-provided unsafe roots fail before directory creation:

```js
  const unsafeEnvOutputRoot = "test-artifacts/../smoke-report-unsafe-output-root";
  const unsafeEnvCreatedPath = "smoke-report-unsafe-output-root";
  fs.rmSync(unsafeEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects unsafe env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: unsafeEnvOutputRoot }),
    "--output-root must be a relative path under test-artifacts");
  check("unsafe env output root rejection does not create output root",
    fs.existsSync(unsafeEnvCreatedPath),
    false);
```

- [x] **Step 3: Run RED test**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the new checks fail because `parseRunnerArgs` currently accepts unsafe output roots and `runSmokeReport` creates the env output directory before the child smoke fails.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `36 passed, 5 failed`. The new parser checks for absolute, non-artifact, and traversal output roots failed, and the env output root test created `smoke-report-unsafe-output-root/...` before child smoke failed to connect.

### Task 2: Validate Output Root In The Runner Parser

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add helper**

Add a helper near the existing option helpers:

```js
function normalizeOutputRoot(outputRoot) {
  const raw = outputRoot.trim();
  if (!raw) {
    throw new Error("--output-root needs a directory path");
  }
  const comparable = raw.replace(/\\/g, "/");
  if (path.isAbsolute(raw) || path.win32.isAbsolute(raw) || comparable.split("/").includes("..")) {
    throw new Error("--output-root must be a relative path under test-artifacts");
  }
  const normalized = path.posix.normalize(comparable);
  if (normalized !== "test-artifacts" && !normalized.startsWith("test-artifacts/")) {
    throw new Error("--output-root must be a relative path under test-artifacts");
  }
  return normalized;
}
```

- [x] **Step 2: Use helper in `parseRunnerArgs`**

Replace the current output root trim-only validation with:

```js
  const outputRoot = normalizeOutputRoot(outputRootArg
    ? outputRootArg.slice("--output-root=".length)
    : env.SMOKE_REPORT_OUTPUT_ROOT || DEFAULT_OUTPUT_ROOT);
```

- [x] **Step 3: Run focused GREEN test**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: all focused runner tests pass.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0 and reported `41 passed, 0 failed`.

### Task 3: Document Operator Contract And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-output-root-guard.md`

- [x] **Step 1: Document output root restrictions**

State that `--output-root` and `SMOKE_REPORT_OUTPUT_ROOT` must be relative `test-artifacts/...` paths. Absolute paths, traversal, and non-artifact roots fail before artifact creation.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: command exits 0, focused runner tests pass, full suite passes, and diff check has no output.

Observed: `node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` exited 0. Focused runner tests reported `41 passed, 0 failed`; full suite reported `747 passed, 0 failed across 25 test file(s)`; diff whitespace check had no output.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-output-root-guard.md
git commit -m "ci: restrict smoke report output roots"
git push origin main
```

Expected: commit lands on `main` and pushes to `origin/main`.

Observed:

- [ ] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 6
gh run watch <run-id> --exit-status
gh run view <run-id> --json conclusion,headSha,status,url,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Download the uploaded `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, and scan for sensitive values.

Expected: latest run for the pushed head SHA succeeds, uploaded artifact contains `qa-summary.json`, read-only smoke reports zero failures, and sensitive-value search has no matches.

Observed:

- [ ] **Step 5: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed:
