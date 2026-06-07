# Smoke Report Root Slash Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `run-smoke-report` from accepting `test-artifacts/` or `test-artifacts//` as an output root, so QA reports cannot be written directly into the artifact root through a trailing slash variant.

**Architecture:** Keep the existing `normalizeOutputRoot()` guard in `scripts/run-smoke-report.mjs`, but canonicalize path segments before validating. Require the normalized path to have `test-artifacts` plus at least one child segment, and return the canonical slash-joined path.

**Tech Stack:** Node.js ESM scripts, repository-local `.mjs` test runner, GitHub Actions QA workflow.

---

### Task 1: Add RED Coverage For Root Slash Variants

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add failing parser checks**

Add these cases near the existing artifact root output root rejection:

```js
checkThrows("parseRunnerArgs rejects artifact root output root with trailing slash",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/"], {}),
  "--output-root must be a relative path under a test-artifacts subdirectory");

checkThrows("parseRunnerArgs rejects artifact root output root with repeated trailing slash",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts//"], {}),
  "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [x] **Step 2: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected before implementation: 2 failures because the trailing slash variants are accepted.

Observed before implementation: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `42 passed, 2 failed`; only `test-artifacts/` and `test-artifacts//` root output variants failed to throw.

### Task 2: Normalize Output Root By Path Segments

**Files:**
- Modify: `scripts/run-smoke-report.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Update `normalizeOutputRoot()`**

Replace the final prefix check with segment validation:

```js
const normalized = path.posix.normalize(comparable);
const parts = normalized.split("/").filter(Boolean);
if (parts.length < 2 || parts[0] !== "test-artifacts") {
  throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
}
return parts.join("/");
```

- [x] **Step 2: Add a canonicalization check**

Add this parser check near the default/URL parsing checks:

```js
check("parseRunnerArgs normalizes child output root trailing slash",
  runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/qa-automation/"], {}),
  {
    mode: "readonly",
    baseUrl: "http://127.0.0.1:8123",
    expectedMode: "readonly",
    outputRoot: "test-artifacts/qa-automation",
    requiresUrl: false,
    requiresHttps: false,
    requiresToken: false,
    extraSmokeArgs: [],
  });
```

- [x] **Step 3: Run focused GREEN**

Run:

```bash
node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected after implementation: all runner tests pass.

Observed after implementation: `node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0 with `45 passed, 0 failed`.

### Task 3: Document And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-root-slash-guard.md`

- [x] **Step 1: Document the trailing slash guard**

In the existing `--output-root` documentation, state that `test-artifacts/` and repeated slash root variants are rejected before artifact creation.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: all commands exit 0.

Observed locally:

```bash
node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Result: exit 0. Focused runner tests `45 passed, 0 failed`; full suite `768 passed, 0 failed across 25 test file(s)`.

- [x] **Step 3: Commit and push main**

```bash
git add scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-root-slash-guard.md
git commit -m "ci: reject root slash smoke report output"
git push origin main
```

Observed implementation commit and push:

- Commit: `162e486 ci: reject root slash smoke report output`
- Branch: `main`
- Push target: `origin/main`

- [x] **Step 4: Verify remote QA and artifact**

Use `gh run list`, `gh run watch`, and `gh run download` for the pushed SHA. Confirm `qa-summary.json` reports read-only smoke success and no sensitive token patterns appear in the downloaded artifact.

Observed implementation remote QA:

- GitHub Actions run: `27107724910`
- Head SHA: `162e48656041146cfc57480650655c4930aab157`
- Conclusion: `success`
- Artifact: `qa-automation-27107724910`
- Artifact id: `7468920662`
- `qa-summary.json`: read-only smoke `155 passed / 0 failed`, `actualMode=readonly`, `expectedMode=readonly`, `checkCount=155`
- Sensitive artifact search: no matches for `Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|asset-secret|script-secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey`

- [ ] **Step 5: Update Obsidian**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, RED/GREEN/full QA, remote run id, artifact id, and sensitive-value search result.
