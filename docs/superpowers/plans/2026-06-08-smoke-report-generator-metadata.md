# Smoke Report Generator Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generator metadata to `qa-summary.json` so each smoke report artifact identifies the runner that produced it.

**Architecture:** Keep the summary shape backwards-compatible by adding `latestRun.generator` under the existing `latestRun` object. The generator object is deterministic and local-only: it records the runner name, runner schema version, and script path without reading package metadata or secrets.

**Tech Stack:** Node.js ES modules, zero-dependency test runner in `test-artifacts/scripts/smoke-report-runner-tests.mjs`, smoke runner in `scripts/run-smoke-report.mjs`.

---

### Task 1: Add Generator Metadata To QA Summary

**Files:**
- Modify: `scripts/run-smoke-report.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Write the failing exact-summary test**

Add this expected object under `latestRun` in the exact `buildQaSummary records latest run evidence without token values` assertion:

```js
        generator: {
          name: "smoke-report-runner",
          version: 1,
          script: "scripts/run-smoke-report.mjs",
        },
```

Add this focused assertion after the existing artifact hash assertion:

```js
  check("buildQaSummary records generator metadata",
    passingRequiredSummary?.latestRun?.generator,
    {
      name: "smoke-report-runner",
      version: 1,
      script: "scripts/run-smoke-report.mjs",
    });
```

- [ ] **Step 2: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: fails because `latestRun.generator` is missing from `buildQaSummary`.

- [ ] **Step 3: Implement generator metadata**

Add a helper near the runtime/artifact helpers:

```js
function generatorMetadata() {
  return {
    name: "smoke-report-runner",
    version: 1,
    script: "scripts/run-smoke-report.mjs",
  };
}
```

Add it to `buildQaSummary().latestRun`:

```js
      generator: generatorMetadata(),
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: `132 passed, 0 failed`.

- [ ] **Step 5: Update docs**

Update the `qa-summary.json` field list in both README and external demo runbook so it mentions generator metadata:

```text
runner generator metadata
```

- [ ] **Step 6: Verify locally**

Run:

```bash
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
git diff --check
npm test
```

Expected: syntax checks and whitespace check pass; `npm test` reports all tests passing.

- [ ] **Step 7: Verify smoke artifact**

Run a read-only local server and smoke report:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/qa-generator-metadata-local npm run smoke:report:readonly
```

Then inspect `test-artifacts/tmp/qa-generator-metadata-local/qa-summary.json` and confirm:

```json
{
  "name": "smoke-report-runner",
  "version": 1,
  "script": "scripts/run-smoke-report.mjs"
}
```

- [ ] **Step 8: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-08-smoke-report-generator-metadata.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md
git commit -m "ci: record smoke report generator metadata"
git push origin main
```

- [ ] **Step 9: Verify GitHub artifact**

After GitHub Actions completes, download the `qa-automation-<run-id>` artifact and verify `qa-summary.json.latestRun.generator` matches:

```json
{
  "name": "smoke-report-runner",
  "version": 1,
  "script": "scripts/run-smoke-report.mjs"
}
```

Also confirm the artifact smoke summary remains `156 passed / 0 failed` and sensitive token/path patterns do not appear.
