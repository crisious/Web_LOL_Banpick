# Smoke Report Path Unicode Format Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent direct smoke `--report-json` and smoke report runner `--output-root` paths from containing invisible Unicode format characters that can make QA artifact evidence paths visually ambiguous.

**Architecture:** Keep the existing parser-owned preflight model. Add tests first for direct smoke parser/CLI and report runner parser/env execution, then add one raw-path guard to each normalizer before any network request or artifact creation.

**Tech Stack:** Node.js ESM scripts, existing custom test harness under `test-artifacts/scripts`, Markdown operator docs.

---

### Task 1: Direct Smoke Unicode Format Path Guard

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Write the failing parser test**

Add this check near the other `--report-json` path safety parser tests:

```js
checkThrows("parseSmokeArgs rejects unicode format report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/smoke-report-\u200bformat.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [ ] **Step 2: Write the failing CLI preflight test**

Add this check near the existing unsafe path CLI preflight tests:

```js
const unicodeFormatReportJsonPath = path.join("test-artifacts", "tmp", "smoke-report-\u200bformat.json");
fs.rmSync(unicodeFormatReportJsonPath, { force: true });
const unicodeFormatReportJson = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  "--report-json=test-artifacts/tmp/smoke-report-\u200bformat.json",
]);

check("CLI exits non-zero for unicode format report JSON path",
  unicodeFormatReportJson.status,
  1);

check("CLI reports unicode format report JSON path without network request",
  unicodeFormatReportJson.stderr.includes("FAIL --report-json must be a relative .json path under a test-artifacts subdirectory"),
  true);

check("CLI unicode format report JSON path does not create file",
  fs.existsSync(unicodeFormatReportJsonPath),
  false);
```

- [ ] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the new parser and CLI checks fail because `\u200b` is currently accepted and can create the target report JSON file after the smoke attempt.

- [ ] **Step 4: Implement the direct smoke guard**

In `normalizeReportJsonPath()`, after the existing Unicode whitespace guard, add:

```js
if (/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(raw)) {
  throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
}
```

- [ ] **Step 5: Run direct smoke GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: direct smoke script syntax passes and every direct smoke test passes.

### Task 2: Smoke Report Runner Unicode Format Output Root Guard

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Modify: `scripts/run-smoke-report.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Write the failing parser test**

Add this check near the other `--output-root` path safety parser tests:

```js
checkThrows("parseRunnerArgs rejects unicode format output root",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\u200bformat-root"], {}),
  "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [ ] **Step 2: Write the failing env artifact-creation test**

Add this check near the other `SMOKE_REPORT_OUTPUT_ROOT` preflight tests:

```js
const unicodeFormatEnvOutputRoot = "test-artifacts/tmp/smoke-report-\u200bformat-root";
const unicodeFormatEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-\u200bformat-root");
fs.rmSync(unicodeFormatEnvCreatedPath, { recursive: true, force: true });
await checkRejects("runSmokeReport rejects unicode format env output root before artifact creation",
  () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: unicodeFormatEnvOutputRoot }),
  "--output-root must be a relative path under a test-artifacts subdirectory");
check("unicode format env output root rejection does not create output root",
  fs.existsSync(unicodeFormatEnvCreatedPath),
  false);
```

- [ ] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the new parser and env execution checks fail because `\u200b` is currently accepted and the runner can create the output root before running smoke.

- [ ] **Step 4: Implement the runner guard**

In `normalizeOutputRoot()`, after the existing Unicode whitespace guard, add:

```js
if (/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(raw)) {
  throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
}
```

- [ ] **Step 5: Run runner GREEN**

Run:

```bash
node --check scripts/run-smoke-report.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: runner script syntax passes and every runner test passes.

### Task 3: Docs, Full QA, GitHub Sync, and Project Notes

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-path-unicode-format-guard.md`
- Update outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Document the operator contract**

Update the direct smoke and runner path contract paragraphs to mention invisible Unicode format characters together with ASCII control characters, Unicode whitespace, byte order marks, and literal backslashes.

- [ ] **Step 2: Run full local QA**

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

Expected: all checks exit 0, direct smoke tests include the new checks, runner tests include the new checks, and the full suite passes.

- [ ] **Step 3: Commit and push implementation**

Stage only the implementation, tests, docs, and this plan:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-path-unicode-format-guard.md
git diff --cached --check
git commit -m "ci: reject unicode format smoke report paths"
git push origin main
```

- [ ] **Step 4: Verify GitHub Actions artifact**

Wait for the `QA` workflow on the pushed commit, download the `qa-automation-*` artifact, inspect `qa-summary.json`, and search the artifact for sensitive token/API patterns.

- [ ] **Step 5: Commit QA evidence and sync**

Update this plan with RED/GREEN/local/remote QA evidence, commit it, push it, verify the final GitHub Actions run, update the Obsidian project note, and finish with:

```bash
git pull --ff-only
git status -sb
git rev-list --left-right --count origin/main...HEAD
```

Expected: `main` and `origin/main` are synchronized and the working tree is clean.

---

## Execution Evidence

### RED

- Direct smoke RED:
  - Command: `node test-artifacts/scripts/external-demo-smoke-tests.mjs`
  - Result: `165 passed, 3 failed`
  - Expected failures:
    - `parseSmokeArgs rejects unicode format report JSON path` accepted `test-artifacts/tmp/smoke-report-\u200bformat.json`.
    - CLI path preflight did not emit the canonical `--report-json` failure before the smoke attempt.
    - `test-artifacts/tmp/smoke-report-\u200bformat.json` was created.
- Smoke report runner RED:
  - Command: `node test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Result: `67 passed, 3 failed`
  - Expected failures:
    - `parseRunnerArgs rejects unicode format output root` accepted `test-artifacts/tmp/smoke-report-\u200bformat-root`.
    - Runner env preflight did not reject `SMOKE_REPORT_OUTPUT_ROOT` before smoke execution.
    - `test-artifacts/tmp/smoke-report-\u200bformat-root/...` was created.
- RED artifact cleanup:
  - Command: `find test-artifacts/tmp -maxdepth 1 -name '*format*' -print -exec rm -rf {} +`
  - Removed: `test-artifacts/tmp/smoke-report-\u200bformat.json`, `test-artifacts/tmp/smoke-report-\u200bformat-root`

### GREEN

- Focused GREEN:
  - Command: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Direct smoke tests: `168 passed, 0 failed`
  - Smoke report runner tests: `70 passed, 0 failed`
- Full local QA:
  - Command: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check`
  - Direct smoke tests: `168 passed, 0 failed`
  - Smoke report runner tests: `70 passed, 0 failed`
  - Full suite: `827 passed, 0 failed across 25 test file(s)`

### Implementation Commit and Remote QA

- Implementation commit:
  - Commit: `8935ac6 ci: reject unicode format smoke report paths`
  - Push target: `origin/main`
- GitHub Actions:
  - Run: `27109644817`
  - Head SHA: `8935ac6e0e7a29c41c3439981e22aec194cca49b`
  - Conclusion: `success`
- Artifact:
  - Name: `qa-automation-27109644817`
  - ID: `7469501073`
  - Download path: `/tmp/lol-ai-coach-path-format-27109644817`
  - `qa-summary.json`: `actualMode=readonly`, `status=passed`, `exitCode=0`, `passed=155`, `failed=0`, `checkCount=155`
- Sensitive value scan:
  - Command: `rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|asset-secret|script-secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" /tmp/lol-ai-coach-path-format-27109644817`
  - Result: no matches
