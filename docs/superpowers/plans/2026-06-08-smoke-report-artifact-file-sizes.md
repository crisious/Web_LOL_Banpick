# Smoke Report Artifact File Sizes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record smoke artifact file sizes in `qa-summary.json.latestRun.artifactFileSizes` so downloaded QA evidence can prove the report and run metadata files were written with non-empty content.

**Architecture:** Add a small file-size helper to `scripts/run-smoke-report.mjs` near the existing artifact path helpers. `buildQaSummary()` accepts supplied artifact sizes for deterministic tests, while real report runs compute sizes after `smoke-run.json` has been written.

**Tech Stack:** Node.js ESM, `fs.statSync`, existing zero-dependency test harness, Markdown docs, GitHub Actions artifact verification.

---

## File Structure

- Modify: `scripts/run-smoke-report.mjs`
  - Add `artifactFileSizesFor(reportJsonPath, metadataPath)` helper.
  - Record `latestRun.artifactFileSizes` inside `buildQaSummary()`.
  - Pass computed file sizes from `runSmokeReport()` after writing `smoke-run.json`.
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Extend the exact protected `qaSummary` fixture with supplied artifact file sizes.
  - Add focused assertions for supplied artifact file sizes.
  - Add a helper test using two small files under `test-artifacts/tmp`.
- Modify: `README.md`
  - Document that `qa-summary.json` records artifact file sizes.
- Modify: `docs/external-demo-runbook.md`
  - Mirror the operator-facing artifact field list.
- Create: `docs/superpowers/plans/2026-06-08-smoke-report-artifact-file-sizes.md`
  - Track RED/GREEN, local QA, staged QA, GitHub Actions artifact, and Obsidian evidence.

## Task 1: Add Failing Artifact File Size Tests

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Extend the protected exact summary fixture**

Add this to the protected `runner.buildQaSummary()` call:

```js
artifactFileSizes: {
  smokeReportBytes: 2048,
  smokeRunBytes: 512,
},
```

Then add the same object under the expected `latestRun.artifactFileSizes` key after `artifactRelativePaths`.

- [x] **Step 2: Add focused supplied-size assertions**

Pass this to the existing `passingRequiredSummary` build call:

```js
artifactFileSizes: {
  smokeReportBytes: 4096,
  smokeRunBytes: 768,
},
```

Add this assertion after the artifact-relative path assertion:

```js
check("buildQaSummary records artifact file sizes",
  passingRequiredSummary?.latestRun?.artifactFileSizes,
  {
    smokeReportBytes: 4096,
    smokeRunBytes: 768,
  });
```

- [x] **Step 3: Add filesystem helper assertion**

Add this helper test after the runtime context assertion:

```js
const artifactSizeFixtureRoot = path.join("test-artifacts", "tmp", "smoke-report-artifact-size-fixture");
const artifactSizeReportPath = path.join(artifactSizeFixtureRoot, "smoke-report.json");
const artifactSizeMetadataPath = path.join(artifactSizeFixtureRoot, "smoke-run.json");
fs.rmSync(artifactSizeFixtureRoot, { recursive: true, force: true });
fs.mkdirSync(artifactSizeFixtureRoot, { recursive: true });
fs.writeFileSync(artifactSizeReportPath, "1234567890", "utf8");
fs.writeFileSync(artifactSizeMetadataPath, "abc", "utf8");
check("artifactFileSizesFor records smoke artifact byte sizes",
  runner.artifactFileSizesFor?.(artifactSizeReportPath, artifactSizeMetadataPath),
  {
    smokeReportBytes: 10,
    smokeRunBytes: 3,
  });
fs.rmSync(artifactSizeFixtureRoot, { recursive: true, force: true });
```

- [x] **Step 4: Verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Actual: `126 passed, 3 failed`. Failures were the exact summary missing `latestRun.artifactFileSizes`, the focused supplied file-size assertion, and the missing `artifactFileSizesFor()` export.

## Task 2: Implement Artifact File Sizes in the Runner

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add file-size helpers**

Add before `buildQaSummary()`:

```js
function fileSizeBytes(filePath) {
  try {
    const size = fs.statSync(filePath).size;
    return Number.isSafeInteger(size) && size > 0 ? size : 0;
  } catch {
    return 0;
  }
}

function emptyArtifactFileSizes() {
  return {
    smokeReportBytes: 0,
    smokeRunBytes: 0,
  };
}

export function artifactFileSizesFor(reportJsonPath, metadataPath) {
  return {
    smokeReportBytes: fileSizeBytes(reportJsonPath),
    smokeRunBytes: fileSizeBytes(metadataPath),
  };
}
```

- [x] **Step 2: Inject file sizes into `buildQaSummary()`**

Add `artifactFileSizes = null` to the destructured parameters and record it under `latestRun` after `artifactRelativePaths`:

```js
artifactFileSizes: artifactFileSizes || emptyArtifactFileSizes(),
```

- [x] **Step 3: Pass file sizes from real runs**

In the `buildQaSummary({ ... })` call inside `runSmokeReport()`, pass:

```js
artifactFileSizes: artifactFileSizesFor(reportJsonPath, metadataPath),
```

This call must stay after `writeRunMetadata(metadataPath, ...)` so `smoke-run.json` already exists when its size is measured.

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Actual: `129 passed, 0 failed`.

## Task 3: Document and Verify the Artifact Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-artifact-file-sizes.md`

- [x] **Step 1: Update docs**

Change the `qa-summary.json` field list from:

```md
artifact-root relative paths, artifact paths
```

to:

```md
artifact-root relative paths, artifact file sizes, artifact paths
```

Apply equivalent wording to the Korean README paragraph.

- [x] **Step 2: Run local QA**

Run:

```bash
rg -n -e "TO""DO" -e "TB""D" -e "fill"" in" -e "implement"" later" -e "Similar"" to" -e "appropriate"" error" docs/superpowers/plans/2026-06-08-smoke-report-artifact-file-sizes.md
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
- `node test-artifacts/scripts/smoke-report-runner-tests.mjs`: `129 passed, 0 failed`.
- `npm test`: `1306 passed, 0 failed across 40 test file(s)`.
- `git diff --check` exited 0.

- [x] **Step 3: Verify a local smoke report**

Start a read-only server and run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/qa-artifact-file-sizes-local npm run smoke:report:readonly
node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync("test-artifacts/tmp/qa-artifact-file-sizes-local/qa-summary.json","utf8")); console.log(JSON.stringify(s.latestRun.artifactFileSizes, null, 2)); if (!s.latestRun.artifactFileSizes || s.latestRun.artifactFileSizes.smokeReportBytes < 1 || s.latestRun.artifactFileSizes.smokeRunBytes < 1) process.exit(1); if (s.latestRun.status !== "passed" || s.latestRun.smokeSummary.passed !== 156 || s.latestRun.smokeSummary.failed !== 0 || s.latestRun.requiredCheckStatus !== "passed") process.exit(1);'
```

Expected: local summary passes smoke and records positive `smokeReportBytes` and `smokeRunBytes`.

Actual: local read-only smoke report passed with `156 passed, 0 failed`; `qa-summary.json.latestRun.artifactFileSizes` recorded `smokeReportBytes: 17409` and `smokeRunBytes: 617`. Required checks passed with `13 passed, 0 failed, 0 missing`; sensitive evidence scan found no matches.

## Task 4: Commit, Push, and Capture Remote Evidence

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Stage and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-artifact-file-sizes.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
git diff --cached --check
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
```

Expected: cached diff has no whitespace errors; focused and full suites pass.

Actual:
- `git diff --cached --check` exited 0.
- Placeholder scan exited 1 with no matches.
- `node test-artifacts/scripts/smoke-report-runner-tests.mjs`: `129 passed, 0 failed`.
- `npm test`: `1306 passed, 0 failed across 40 test file(s)`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git commit -m "ci: record smoke report artifact file sizes"
git push origin main
```

Expected: commit lands on `main` and push updates `origin/main`.

- [ ] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 5 --json databaseId,status,conclusion,headSha,displayTitle,createdAt,url
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/qa-artifact-file-sizes-gh
node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync("test-artifacts/tmp/qa-artifact-file-sizes-gh/qa-summary.json","utf8")); console.log(JSON.stringify(s.latestRun.artifactFileSizes, null, 2)); if (!s.latestRun.artifactFileSizes || s.latestRun.artifactFileSizes.smokeReportBytes < 1 || s.latestRun.artifactFileSizes.smokeRunBytes < 1) process.exit(1);'
```

Expected: GitHub artifact `qa-summary.json` records positive file sizes and the QA workflow succeeds.
