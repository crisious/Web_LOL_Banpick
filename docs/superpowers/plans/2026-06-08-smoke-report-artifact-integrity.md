# Smoke Report Artifact Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact artifact integrity verdict to `qa-summary.json` so reviewers can tell whether `smoke-report.json` and `smoke-run.json` were written with non-empty content and SHA-256 hashes.

**Architecture:** Keep existing artifact file size/hash fields unchanged and derive `latestRun.artifactIntegrity` from them. The new field is deterministic, secret-free, and local to the summary builder: it reports `passed` only when both artifact files have positive byte sizes and 64-character lowercase hex SHA-256 values.

**Tech Stack:** Node.js ES modules, zero-dependency smoke runner tests, existing `scripts/run-smoke-report.mjs` report builder.

---

### Task 1: Add Artifact Integrity Verdict

**Files:**
- Modify: `scripts/run-smoke-report.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Write the failing summary tests**

Add this expected object after `artifactFileHashes` in the exact summary assertion:

```js
        artifactIntegrity: {
          status: "passed",
          smokeReport: {
            bytesPresent: true,
            sha256Present: true,
          },
          smokeRun: {
            bytesPresent: true,
            sha256Present: true,
          },
          failures: [],
        },
```

Add this focused passing assertion after the artifact hash assertion:

```js
  check("buildQaSummary records passing artifact integrity",
    passingRequiredSummary?.latestRun?.artifactIntegrity,
    {
      status: "passed",
      smokeReport: {
        bytesPresent: true,
        sha256Present: true,
      },
      smokeRun: {
        bytesPresent: true,
        sha256Present: true,
      },
      failures: [],
    });
```

Add this failed default assertion near the missing required check summary tests:

```js
  const missingArtifactSummary = runner.buildQaSummary?.({
    config: missingRequiredCheckConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly/smoke-run.json",
    startedAt: "2026-06-08T06:40:00.000Z",
    finishedAt: "2026-06-08T06:40:10.000Z",
    exitCode: 0,
    smokeReport: passingRequiredCheckReport,
  });

  check("buildQaSummary records failed artifact integrity when artifact metadata is missing",
    missingArtifactSummary?.latestRun?.artifactIntegrity,
    {
      status: "failed",
      smokeReport: {
        bytesPresent: false,
        sha256Present: false,
      },
      smokeRun: {
        bytesPresent: false,
        sha256Present: false,
      },
      failures: [
        "smoke-report artifact is empty or missing",
        "smoke-report artifact SHA-256 is missing",
        "smoke-run artifact is empty or missing",
        "smoke-run artifact SHA-256 is missing",
      ],
    });
```

- [ ] **Step 2: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: fails because `latestRun.artifactIntegrity` is missing.

- [ ] **Step 3: Implement artifact integrity**

Add helpers in `scripts/run-smoke-report.mjs` near the artifact size/hash helpers:

```js
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

function artifactIntegrityFor(artifactFileSizes, artifactFileHashes) {
  const smokeReportBytesPresent = Number.isSafeInteger(artifactFileSizes?.smokeReportBytes) && artifactFileSizes.smokeReportBytes > 0;
  const smokeRunBytesPresent = Number.isSafeInteger(artifactFileSizes?.smokeRunBytes) && artifactFileSizes.smokeRunBytes > 0;
  const smokeReportSha256Present = SHA256_HEX_PATTERN.test(artifactFileHashes?.smokeReportSha256 || "");
  const smokeRunSha256Present = SHA256_HEX_PATTERN.test(artifactFileHashes?.smokeRunSha256 || "");
  const failures = [];
  if (!smokeReportBytesPresent) failures.push("smoke-report artifact is empty or missing");
  if (!smokeReportSha256Present) failures.push("smoke-report artifact SHA-256 is missing");
  if (!smokeRunBytesPresent) failures.push("smoke-run artifact is empty or missing");
  if (!smokeRunSha256Present) failures.push("smoke-run artifact SHA-256 is missing");
  return {
    status: failures.length ? "failed" : "passed",
    smokeReport: {
      bytesPresent: smokeReportBytesPresent,
      sha256Present: smokeReportSha256Present,
    },
    smokeRun: {
      bytesPresent: smokeRunBytesPresent,
      sha256Present: smokeRunSha256Present,
    },
    failures,
  };
}
```

In `buildQaSummary`, compute normalized sizes/hashes once and add:

```js
      artifactIntegrity: artifactIntegrityFor(resolvedArtifactFileSizes, resolvedArtifactFileHashes),
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: `134 passed, 0 failed`.

- [ ] **Step 5: Update docs**

Update README and external demo runbook field lists to mention:

```text
artifact integrity verdict
```

- [ ] **Step 6: Verify locally**

Run:

```bash
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
git diff --check
npm test
```

Expected: syntax checks and whitespace check pass; all tests pass.

- [ ] **Step 7: Verify smoke artifact**

Run a read-only local server and report:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/qa-artifact-integrity-local npm run smoke:report:readonly
```

Confirm `test-artifacts/tmp/qa-artifact-integrity-local/qa-summary.json` contains:

```json
{
  "status": "passed",
  "smokeReport": {
    "bytesPresent": true,
    "sha256Present": true
  },
  "smokeRun": {
    "bytesPresent": true,
    "sha256Present": true
  },
  "failures": []
}
```

- [ ] **Step 8: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-08-smoke-report-artifact-integrity.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md
git commit -m "ci: record smoke report artifact integrity"
git push origin main
```

- [ ] **Step 9: Verify GitHub artifact**

After GitHub Actions completes, download `qa-automation-<run-id>` and verify `qa-summary.json.latestRun.artifactIntegrity.status` is `passed`, read-only smoke remains `156 passed / 0 failed`, required checks pass, and sensitive token/path patterns do not appear.
