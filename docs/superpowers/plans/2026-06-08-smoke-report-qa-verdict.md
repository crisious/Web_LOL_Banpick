# Smoke Report QA Verdict Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact QA verdict to `qa-summary.json` so reviewers can tell whether the latest smoke artifact is shareable evidence without inspecting several fields manually.

**Architecture:** Derive `latestRun.qaVerdict` from existing summary fields: smoke run status, required smoke check status, and artifact integrity status. The verdict is deterministic and secret-free; it does not change runner exit behavior.

**Tech Stack:** Node.js ES modules, zero-dependency smoke runner tests, existing `scripts/run-smoke-report.mjs` summary builder.

---

### Task 1: Add QA Verdict Rollup

**Files:**
- Modify: `scripts/run-smoke-report.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Write the failing summary tests**

Add this expected object after `artifactIntegrity` in the exact summary assertion:

```js
        qaVerdict: {
          status: "failed",
          shareable: false,
          components: {
            smoke: "passed",
            requiredChecks: "failed",
            artifactIntegrity: "passed",
          },
          failures: ["required smoke checks failed"],
        },
```

Add this focused passing assertion after the artifact integrity assertion:

```js
  check("buildQaSummary records passing QA verdict",
    passingRequiredSummary?.latestRun?.qaVerdict,
    {
      status: "passed",
      shareable: true,
      components: {
        smoke: "passed",
        requiredChecks: "passed",
        artifactIntegrity: "passed",
      },
      failures: [],
    });
```

Add this failed artifact assertion after the missing artifact integrity assertion:

```js
  check("buildQaSummary records failed QA verdict when artifact integrity fails",
    missingArtifactSummary?.latestRun?.qaVerdict,
    {
      status: "failed",
      shareable: false,
      components: {
        smoke: "passed",
        requiredChecks: "passed",
        artifactIntegrity: "failed",
      },
      failures: ["artifact integrity failed"],
    });
```

- [ ] **Step 2: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: fails because `latestRun.qaVerdict` is missing.

- [ ] **Step 3: Implement verdict helper**

Add this helper near the existing summary helpers:

```js
function qaVerdictFor({ runStatus, exitCode, requiredCheckStatus, artifactIntegrity }) {
  const smokeStatus = exitCode === 0 && runStatus === "passed" ? "passed" : "failed";
  const requiredChecksStatus = requiredCheckStatus || "failed";
  const artifactIntegrityStatus = artifactIntegrity?.status === "passed" ? "passed" : "failed";
  const failures = [];
  if (smokeStatus !== "passed") failures.push("smoke report failed");
  if (!["passed", "skipped"].includes(requiredChecksStatus)) failures.push("required smoke checks failed");
  if (artifactIntegrityStatus !== "passed") failures.push("artifact integrity failed");
  return {
    status: failures.length ? "failed" : "passed",
    shareable: failures.length === 0,
    components: {
      smoke: smokeStatus,
      requiredChecks: requiredChecksStatus,
      artifactIntegrity: artifactIntegrityStatus,
    },
    failures,
  };
}
```

In `buildQaSummary`, compute `runStatus`, `artifactIntegrity`, `requiredCheckStatus`, and add:

```js
      qaVerdict: qaVerdictFor({
        runStatus,
        exitCode,
        requiredCheckStatus,
        artifactIntegrity,
      }),
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: `136 passed, 0 failed`.

- [ ] **Step 5: Update docs**

Update README and external demo runbook field lists to mention:

```text
QA verdict/shareable rollup
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
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/qa-verdict-local npm run smoke:report:readonly
```

Confirm `test-artifacts/tmp/qa-verdict-local/qa-summary.json` contains:

```json
{
  "status": "passed",
  "shareable": true,
  "components": {
    "smoke": "passed",
    "requiredChecks": "passed",
    "artifactIntegrity": "passed"
  },
  "failures": []
}
```

- [ ] **Step 8: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-08-smoke-report-qa-verdict.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md
git commit -m "ci: record smoke report QA verdict"
git push origin main
```

- [ ] **Step 9: Verify GitHub artifact**

After GitHub Actions completes, download `qa-automation-<run-id>` and verify `qa-summary.json.latestRun.qaVerdict.status` is `passed`, `shareable` is `true`, read-only smoke remains `156 passed / 0 failed`, required checks pass, artifact integrity passes, and sensitive token/path patterns do not appear.
