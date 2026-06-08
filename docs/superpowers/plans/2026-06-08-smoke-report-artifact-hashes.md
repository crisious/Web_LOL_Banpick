# Smoke Report Artifact Hashes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record SHA-256 hashes for smoke artifact files in `qa-summary.json.latestRun.artifactFileHashes` so downloaded QA evidence can verify artifact content identity without re-running smoke.

**Architecture:** Add a small file-hash helper to `scripts/run-smoke-report.mjs` next to the existing artifact file size helper. `buildQaSummary()` accepts supplied hashes for deterministic tests, while real report runs compute hashes after `smoke-run.json` has been written.

**Tech Stack:** Node.js ESM, built-in `crypto`, existing zero-dependency test harness, Markdown docs, GitHub Actions artifact verification.

---

## File Structure

- Modify: `scripts/run-smoke-report.mjs`
  - Import `createHash` from `node:crypto`.
  - Add `artifactFileHashesFor(reportJsonPath, metadataPath)` helper.
  - Record `latestRun.artifactFileHashes` inside `buildQaSummary()`.
  - Pass computed hashes from `runSmokeReport()` after writing `smoke-run.json`.
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Extend the exact protected `qaSummary` fixture with supplied artifact hashes.
  - Add focused assertions for supplied artifact hashes.
  - Add a helper test using two small files under `test-artifacts/tmp`.
- Modify: `README.md`
  - Document that `qa-summary.json` records artifact SHA-256 hashes.
- Modify: `docs/external-demo-runbook.md`
  - Mirror the operator-facing artifact field list.
- Create: `docs/superpowers/plans/2026-06-08-smoke-report-artifact-hashes.md`
  - Track RED/GREEN, local QA, staged QA, GitHub Actions artifact, and Obsidian evidence.

## Task 1: Add Failing Artifact Hash Tests

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Extend the protected exact summary fixture**

Add this to the protected `runner.buildQaSummary()` call:

```js
artifactFileHashes: {
  smokeReportSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  smokeRunSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
},
```

Then add the same object under the expected `latestRun.artifactFileHashes` key after `artifactFileSizes`.

- [x] **Step 2: Add focused supplied-hash assertions**

Pass this to the existing `passingRequiredSummary` build call:

```js
artifactFileHashes: {
  smokeReportSha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  smokeRunSha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
},
```

Add this assertion after the artifact file-size assertion:

```js
check("buildQaSummary records artifact file hashes",
  passingRequiredSummary?.latestRun?.artifactFileHashes,
  {
    smokeReportSha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    smokeRunSha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  });
```

- [x] **Step 3: Add filesystem helper assertion**

Add this helper test after the artifact file-size helper assertion:

```js
const artifactHashFixtureRoot = path.join("test-artifacts", "tmp", "smoke-report-artifact-hash-fixture");
const artifactHashReportPath = path.join(artifactHashFixtureRoot, "smoke-report.json");
const artifactHashMetadataPath = path.join(artifactHashFixtureRoot, "smoke-run.json");
fs.rmSync(artifactHashFixtureRoot, { recursive: true, force: true });
fs.mkdirSync(artifactHashFixtureRoot, { recursive: true });
fs.writeFileSync(artifactHashReportPath, "abc", "utf8");
fs.writeFileSync(artifactHashMetadataPath, "123", "utf8");
check("artifactFileHashesFor records smoke artifact SHA-256 hashes",
  runner.artifactFileHashesFor?.(artifactHashReportPath, artifactHashMetadataPath),
  {
    smokeReportSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    smokeRunSha256: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
  });
fs.rmSync(artifactHashFixtureRoot, { recursive: true, force: true });
```

- [x] **Step 4: Verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Actual: `128 passed, 3 failed`. Failures were the exact summary missing `latestRun.artifactFileHashes`, the focused supplied hash assertion, and the missing `artifactFileHashesFor()` export.

## Task 2: Implement Artifact Hashes in the Runner

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add crypto import**

Add near the top import list:

```js
import { createHash } from "node:crypto";
```

- [x] **Step 2: Add hash helpers**

Add after `artifactFileSizesFor()`:

```js
function fileSha256Hex(filePath) {
  try {
    return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  } catch {
    return "";
  }
}

function emptyArtifactFileHashes() {
  return {
    smokeReportSha256: "",
    smokeRunSha256: "",
  };
}

export function artifactFileHashesFor(reportJsonPath, metadataPath) {
  return {
    smokeReportSha256: fileSha256Hex(reportJsonPath),
    smokeRunSha256: fileSha256Hex(metadataPath),
  };
}
```

- [x] **Step 3: Inject hashes into `buildQaSummary()`**

Add `artifactFileHashes = null` to the destructured parameters and record it under `latestRun` after `artifactFileSizes`:

```js
artifactFileHashes: artifactFileHashes || emptyArtifactFileHashes(),
```

- [x] **Step 4: Pass hashes from real runs**

In the `buildQaSummary({ ... })` call inside `runSmokeReport()`, pass:

```js
artifactFileHashes: artifactFileHashesFor(reportJsonPath, metadataPath),
```

This call must stay after `writeRunMetadata(metadataPath, ...)` so `smoke-run.json` already exists when its hash is measured.

- [x] **Step 5: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Actual: `131 passed, 0 failed`.

## Task 3: Document and Verify the Artifact Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-artifact-hashes.md`

- [x] **Step 1: Update docs**

Change the `qa-summary.json` field list from:

```md
artifact file sizes, artifact paths
```

to:

```md
artifact file sizes, artifact SHA-256 hashes, artifact paths
```

Apply equivalent wording to the Korean README paragraph.

- [x] **Step 2: Run local QA**

Run:

```bash
rg -n -e "TO""DO" -e "TB""D" -e "fill"" in" -e "implement"" later" -e "Similar"" to" -e "appropriate"" error" docs/superpowers/plans/2026-06-08-smoke-report-artifact-hashes.md
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
- `node test-artifacts/scripts/smoke-report-runner-tests.mjs`: `131 passed, 0 failed`.
- `npm test`: `1308 passed, 0 failed across 40 test file(s)`.
- `git diff --check` exited 0.

- [x] **Step 3: Verify a local smoke report**

Start a read-only server and run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/qa-artifact-hashes-local npm run smoke:report:readonly
node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync("test-artifacts/tmp/qa-artifact-hashes-local/qa-summary.json","utf8")); console.log(JSON.stringify(s.latestRun.artifactFileHashes, null, 2)); if (!/^[a-f0-9]{64}$/.test(s.latestRun.artifactFileHashes?.smokeReportSha256 || "") || !/^[a-f0-9]{64}$/.test(s.latestRun.artifactFileHashes?.smokeRunSha256 || "")) process.exit(1); if (s.latestRun.status !== "passed" || s.latestRun.smokeSummary.passed !== 156 || s.latestRun.smokeSummary.failed !== 0 || s.latestRun.requiredCheckStatus !== "passed") process.exit(1);'
```

Expected: local summary passes smoke and records 64-character lowercase hex SHA-256 hashes.

Actual: local read-only smoke report passed with `156 passed, 0 failed`; `qa-summary.json.latestRun.artifactFileHashes` recorded `smokeReportSha256: "6fcfb4441aeba7843e961465e0e689c51b98a63edd176f41eef95493616e8246"` and `smokeRunSha256: "8783e3e33c806cb9bdc9cf619c8c5a604affaffc97547f0bc2d3297b1af6500b"`. Required checks passed with `13 passed, 0 failed, 0 missing`; sensitive evidence scan found no matches.

## Task 4: Commit, Push, and Capture Remote Evidence

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Stage and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-artifact-hashes.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
git diff --cached --check
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
```

Expected: cached diff has no whitespace errors; focused and full suites pass.

Actual:
- `git diff --cached --check` exited 0.
- Placeholder scan exited 1 with no matches.
- `node test-artifacts/scripts/smoke-report-runner-tests.mjs`: `131 passed, 0 failed`.
- `npm test`: `1308 passed, 0 failed across 40 test file(s)`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git commit -m "ci: record smoke report artifact hashes"
git push origin main
```

Expected: commit lands on `main` and push updates `origin/main`.

- [ ] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 5 --json databaseId,status,conclusion,headSha,displayTitle,createdAt,url
gh run watch <run-id> --exit-status
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/qa-artifact-hashes-gh
node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync("test-artifacts/tmp/qa-artifact-hashes-gh/qa-summary.json","utf8")); console.log(JSON.stringify(s.latestRun.artifactFileHashes, null, 2)); if (!/^[a-f0-9]{64}$/.test(s.latestRun.artifactFileHashes?.smokeReportSha256 || "") || !/^[a-f0-9]{64}$/.test(s.latestRun.artifactFileHashes?.smokeRunSha256 || "")) process.exit(1);'
```

Expected: GitHub artifact `qa-summary.json` records 64-character lowercase hex SHA-256 hashes and the QA workflow succeeds.
