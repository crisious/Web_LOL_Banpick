# Direct Smoke Report JSON Path Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent direct smoke `--report-json` from writing JSON evidence outside the intended `test-artifacts/...` tree.

**Architecture:** Keep direct smoke report writing in `scripts/external-demo-smoke.mjs`, but move report path validation into `parseSmokeArgs()` so bad paths fail before network requests or `fs.mkdirSync()`. The parser allows only relative `test-artifacts/.../*.json` paths and rejects absolute paths, traversal, non-artifact roots, and non-JSON targets.

**Tech Stack:** Node.js ESM scripts, zero-dependency CLI/parser tests under `test-artifacts/scripts`, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Coverage For Unsafe Direct Report JSON Paths

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Write failing parser tests**

Add checks near the existing empty `--report-json=` test:

```js
checkThrows("parseSmokeArgs rejects absolute report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=/tmp/smoke-report.json"], {}),
  "--report-json must be a relative .json path under test-artifacts");

checkThrows("parseSmokeArgs rejects non-artifact report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=smoke-report.json"], {}),
  "--report-json must be a relative .json path under test-artifacts");

checkThrows("parseSmokeArgs rejects traversal report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/../smoke-report.json"], {}),
  "--report-json must be a relative .json path under test-artifacts");

checkThrows("parseSmokeArgs rejects non-json report path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/smoke-report.txt"], {}),
  "--report-json must be a relative .json path under test-artifacts");
```

- [x] **Step 2: Write failing CLI no-file test**

Add a CLI test after a closed local port is available:

```js
const unsafeReportJsonPath = "smoke-report-unsafe.json";
fs.rmSync(unsafeReportJsonPath, { force: true });
const unsafeReportJson = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  `--report-json=${unsafeReportJsonPath}`,
]);

check("CLI exits non-zero for unsafe report JSON path",
  unsafeReportJson.status,
  1);

check("CLI reports unsafe report JSON path without network request",
  unsafeReportJson.stderr.includes("FAIL --report-json must be a relative .json path under test-artifacts"),
  true);

check("CLI unsafe report JSON path does not create file",
  fs.existsSync(unsafeReportJsonPath),
  false);
```

- [x] **Step 3: Run RED test**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the new parser checks fail because `parseSmokeArgs()` currently accepts unsafe report paths; the CLI no-file check also proves the unsafe path can be written during an early network failure.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `118 passed, 6 failed`. The parser accepted absolute, non-artifact, traversal, and non-JSON report paths; the CLI unsafe report path case wrote `smoke-report-unsafe.json` after the first network failure.

### Task 2: Validate Report JSON Path In The Direct Smoke Parser

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`

- [x] **Step 1: Add parser-local helper**

Inside `parseSmokeArgs()`, near `singleOptionArg()`, add:

```js
  function normalizeReportJsonPath(reportPath) {
    const raw = reportPath.trim();
    if (!raw) {
      throw new Error("--report-json needs a file path");
    }
    const comparable = raw.replace(/\\/g, "/");
    if (comparable.startsWith("/") || /^[A-Za-z]:\//.test(comparable) || comparable.startsWith("//") || comparable.split("/").includes("..")) {
      throw new Error("--report-json must be a relative .json path under test-artifacts");
    }
    const normalized = comparable.split("/").filter(Boolean).join("/");
    if (!normalized.startsWith("test-artifacts/") || !normalized.toLowerCase().endsWith(".json")) {
      throw new Error("--report-json must be a relative .json path under test-artifacts");
    }
    return normalized;
  }
```

- [x] **Step 2: Use helper for `reportJsonPath`**

Replace the current trim-only path extraction with:

```js
  const reportJsonPath = reportJsonArg
    ? normalizeReportJsonPath(reportJsonArg.slice("--report-json=".length))
    : "";
```

Remove the later empty-path check because the helper now owns that error.

- [x] **Step 3: Run focused GREEN test**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: all external demo smoke tests pass.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 0 and reported `124 passed, 0 failed`.

### Task 3: Document Contract And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-direct-smoke-report-json-path-guard.md`

- [x] **Step 1: Document report JSON path restrictions**

State that direct smoke `--report-json` accepts only relative `test-artifacts/.../*.json` paths and fails before network requests/report writes for absolute, traversal, non-artifact, or non-JSON paths.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check
```

Expected: command exits 0, focused direct smoke tests pass, full suite passes, and diff check has no output.

Observed: `node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check` exited 0. Focused direct smoke tests reported `124 passed, 0 failed`; full suite reported `754 passed, 0 failed across 25 test file(s)`; diff whitespace check had no output.

- [x] **Step 3: Commit and push**

Run:

```bash
git add scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-direct-smoke-report-json-path-guard.md
git commit -m "ci: restrict direct smoke report json paths"
git push origin main
```

Expected: commit lands on `main` and pushes to `origin/main`.

Observed: commit `2cb224d ci: restrict direct smoke report json paths` pushed to `origin/main`.

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

Observed: GitHub Actions QA run `27106927801` completed successfully for head SHA `2cb224d82490454be748023ace70b2f7fc4a72be`. Artifact `qa-automation-27106927801` / ID `7468673114` contained `qa-summary.json`, `smoke-run.json`, and `smoke-report.json`; `qa-summary.json` recorded read-only smoke `155 passed, 0 failed`. Sensitive-value search across the downloaded artifact directory found no matches.

- [ ] **Step 5: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed:
