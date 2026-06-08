# Smoke Report Path Unicode Cf Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the smoke report path "Unicode format character" contract with implementation by rejecting the full Unicode `Cf` category before network requests or artifact creation.

**Architecture:** Keep validation inside the existing direct smoke and report runner path normalizers. Add RED tests for `\u061c` Arabic Letter Mark, which is `\p{Cf}` but is not covered by the current hardcoded ranges, then replace the narrow format-character regex with a Unicode property escape.

**Tech Stack:** Node.js ESM scripts, existing custom test harness under `test-artifacts/scripts`, GitHub Actions QA artifact verification.

---

### Task 1: Direct Smoke Full Unicode Cf Guard

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `scripts/external-demo-smoke.mjs`

- [ ] **Step 1: Write the failing parser test**

Add this check immediately after the existing `parseSmokeArgs rejects unicode format report JSON path` test:

```js
checkThrows("parseSmokeArgs rejects unicode Cf report JSON path outside common ranges",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/smoke-report-\u061cformat.json"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [ ] **Step 2: Write the failing CLI preflight test**

Add this check immediately after the existing unicode format CLI preflight test:

```js
const unicodeCfReportJsonPath = path.join("test-artifacts", "tmp", "smoke-report-\u061cformat.json");
fs.rmSync(unicodeCfReportJsonPath, { force: true });
const unicodeCfReportJson = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  "--report-json=test-artifacts/tmp/smoke-report-\u061cformat.json",
]);

check("CLI exits non-zero for unicode Cf report JSON path",
  unicodeCfReportJson.status,
  1);

check("CLI reports unicode Cf report JSON path without network request",
  unicodeCfReportJson.stderr.includes("FAIL --report-json must be a relative .json path under a test-artifacts subdirectory"),
  true);

check("CLI unicode Cf report JSON path does not create file",
  fs.existsSync(unicodeCfReportJsonPath),
  false);
```

- [ ] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: direct smoke tests fail because `\u061c` is currently accepted and can create `test-artifacts/tmp/smoke-report-\u061cformat.json` after the smoke attempt.

- [ ] **Step 4: Implement the direct smoke guard**

Replace the existing narrow Unicode format guard:

```js
if (/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(raw)) {
  throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
}
```

with:

```js
if (/\p{Cf}/u.test(raw)) {
  throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
}
```

- [ ] **Step 5: Run direct smoke GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: syntax check passes and direct smoke tests pass.

### Task 2: Smoke Report Runner Full Unicode Cf Guard

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [ ] **Step 1: Write the failing parser test**

Add this check immediately after the existing `parseRunnerArgs rejects unicode format output root` test:

```js
checkThrows("parseRunnerArgs rejects unicode Cf output root outside common ranges",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\u061cformat-root"], {}),
  "--output-root must be a relative path under a test-artifacts subdirectory");
```

- [ ] **Step 2: Write the failing env artifact-creation test**

Add this check immediately after the existing unicode format env output root test:

```js
const unicodeCfEnvOutputRoot = "test-artifacts/tmp/smoke-report-\u061cformat-root";
const unicodeCfEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-\u061cformat-root");
fs.rmSync(unicodeCfEnvCreatedPath, { recursive: true, force: true });
await checkRejects("runSmokeReport rejects unicode Cf env output root before artifact creation",
  () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: unicodeCfEnvOutputRoot }),
  "--output-root must be a relative path under a test-artifacts subdirectory");
check("unicode Cf env output root rejection does not create output root",
  fs.existsSync(unicodeCfEnvCreatedPath),
  false);
```

- [ ] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: runner tests fail because `\u061c` is currently accepted and can create `test-artifacts/tmp/smoke-report-\u061cformat-root/...`.

- [ ] **Step 4: Implement the runner guard**

Replace the existing narrow Unicode format guard:

```js
if (/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(raw)) {
  throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
}
```

with:

```js
if (/\p{Cf}/u.test(raw)) {
  throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
}
```

- [ ] **Step 5: Run runner GREEN**

Run:

```bash
node --check scripts/run-smoke-report.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: syntax check passes and runner tests pass.

### Task 3: QA Evidence, GitHub Sync, and Project Notes

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-path-unicode-cf-guard.md`
- Update outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Run full local QA**

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

Expected: all checks exit 0, direct smoke tests include the new `\u061c` checks, runner tests include the new `\u061c` checks, and the full suite passes.

- [ ] **Step 2: Commit and push implementation**

Stage only the implementation, tests, and this plan:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs docs/superpowers/plans/2026-06-08-smoke-report-path-unicode-cf-guard.md
git diff --cached --check
git commit -m "ci: reject unicode cf smoke report paths"
git push origin main
```

- [ ] **Step 3: Verify GitHub Actions artifact**

Wait for the `QA` workflow on the pushed commit, download the `qa-automation-*` artifact, inspect `qa-summary.json`, and search the artifact for sensitive token/API patterns.

- [ ] **Step 4: Commit QA evidence and sync**

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
  - Result: `169 passed, 3 failed`
  - Expected failures:
    - `parseSmokeArgs rejects unicode Cf report JSON path outside common ranges` accepted `test-artifacts/tmp/smoke-report-\u061cformat.json`.
    - CLI path preflight did not emit the canonical `--report-json` failure before the smoke attempt.
    - `test-artifacts/tmp/smoke-report-\u061cformat.json` was created.
- Smoke report runner RED:
  - Command: `node test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Result: `70 passed, 3 failed`
  - Expected failures:
    - `parseRunnerArgs rejects unicode Cf output root outside common ranges` accepted `test-artifacts/tmp/smoke-report-\u061cformat-root`.
    - Runner env preflight did not reject `SMOKE_REPORT_OUTPUT_ROOT` before smoke execution.
    - `test-artifacts/tmp/smoke-report-\u061cformat-root/...` was created.
- RED artifact cleanup:
  - Command: `find test-artifacts/tmp -maxdepth 1 -name '*format*' -print -exec rm -rf {} +`
  - Removed: `test-artifacts/tmp/smoke-report-\u061cformat.json`, `test-artifacts/tmp/smoke-report-\u061cformat-root`

### GREEN

- Focused GREEN:
  - Command: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Direct smoke tests: `172 passed, 0 failed`
  - Smoke report runner tests: `73 passed, 0 failed`
- Full local QA:
  - Command: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check`
  - Direct smoke tests: `172 passed, 0 failed`
  - Smoke report runner tests: `73 passed, 0 failed`
  - Full suite: `834 passed, 0 failed across 25 test file(s)`

### Implementation Commit and Remote QA

- Implementation commit:
  - Commit: `4443550 ci: reject unicode cf smoke report paths`
  - Push target: `origin/main`
- GitHub Actions:
  - Run: `27109837081`
  - Head SHA: `4443550d30ca9d0d8b9145151463f0d6636320c4`
  - Conclusion: `success`
- Artifact:
  - Name: `qa-automation-27109837081`
  - ID: `7469567019`
  - Download path: `/tmp/lol-ai-coach-path-cf-27109837081`
  - `qa-summary.json`: `actualMode=readonly`, `status=passed`, `exitCode=0`, `passed=155`, `failed=0`, `checkCount=155`
- Sensitive value scan:
  - Command: `rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|asset-secret|script-secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" /tmp/lol-ai-coach-path-cf-27109837081`
  - Result: no matches
