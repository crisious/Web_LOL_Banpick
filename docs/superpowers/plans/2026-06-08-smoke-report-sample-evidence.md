# Smoke Report Sample Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact `latestRun.sampleEvidence` rollup to smoke report QA summaries so reviewers can see how many sample list/detail/report-essential checks backed the artifact.

**Architecture:** Keep the direct smoke runner unchanged; it already records sample list count and per-sample detail labels in `smoke-report.json`. Add a runner-side summarizer in `scripts/run-smoke-report.mjs` that derives sample evidence from existing check labels and folds its status into `latestRun.qaVerdict`.

**Tech Stack:** Node.js ES modules, existing no-dependency test harness in `test-artifacts/scripts/smoke-report-runner-tests.mjs`, markdown docs.

---

### Task 1: Add Failing Summary Tests

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [ ] **Step 1: Add reusable sample evidence fixtures**

Add this helper near the existing `readonlyMissingFullRequiredCheckFailures` declarations:

```js
  function sampleEvidenceChecks(count = 19) {
    return Array.from({ length: count }, (_, index) => {
      const id = `sample-kr-${String(index + 1).padStart(10, "0")}`;
      return [
        { status: "pass", label: `GET /api/samples/:id returns 200 for ${id}` },
        { status: "pass", label: `sample detail ${id} includes report essentials` },
      ];
    }).flat();
  }
```

- [ ] **Step 2: Expect failed sample evidence in the existing minimal summary fixture**

In the exact `buildQaSummary records latest run evidence without token values` expected object, add:

```js
        sampleEvidence: {
          status: "failed",
          requiredMin: 19,
          listedSamples: null,
          detailChecks: {
            passed: 0,
            failed: 0,
          },
          reportEssentialChecks: {
            passed: 0,
            failed: 0,
          },
          failures: [
            "sample list check missing",
            "sample detail checks below required minimum",
            "sample report essentials checks below required minimum",
          ],
        },
```

Also change that fixture's `qaVerdict` to include:

```js
            sampleEvidence: "failed",
```

and:

```js
          failures: ["required smoke checks failed", "sample evidence incomplete"],
```

- [ ] **Step 3: Make passing required-check fixtures include sample evidence**

Add the sample count and sample detail fixtures to `passingRequiredCheckReport.checks`:

```js
      { status: "pass", label: "/api/samples has at least 19 samples" },
      ...sampleEvidenceChecks(19),
```

- [ ] **Step 4: Expect passing sample evidence**

Add this check after the artifact integrity assertion for `passingRequiredSummary`:

```js
  check("buildQaSummary records passing sample evidence",
    passingRequiredSummary?.latestRun?.sampleEvidence,
    {
      status: "passed",
      requiredMin: 19,
      listedSamples: null,
      detailChecks: {
        passed: 19,
        failed: 0,
      },
      reportEssentialChecks: {
        passed: 19,
        failed: 0,
      },
      failures: [],
    });
```

Update the passing QA verdict expectation to include:

```js
        sampleEvidence: "passed",
```

- [ ] **Step 5: Add a partial evidence failure test**

Add this fixture near the missing artifact summary checks:

```js
  const partialSampleEvidenceSummary = runner.buildQaSummary?.({
    config: missingRequiredCheckConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T06-50-00Z-readonly",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-50-00Z-readonly/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T06-50-00Z-readonly/smoke-run.json",
    startedAt: "2026-06-08T06:50:00.000Z",
    finishedAt: "2026-06-08T06:50:10.000Z",
    exitCode: 0,
    artifactFileSizes: {
      smokeReportBytes: 4096,
      smokeRunBytes: 768,
    },
    artifactFileHashes: {
      smokeReportSha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      smokeRunSha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    },
    smokeReport: {
      status: "passed",
      actualMode: "readonly",
      summary: { passed: 20, failed: 0 },
      checks: [
        { status: "fail", label: "/api/samples has at least 19 samples", detail: "count=18" },
        ...sampleEvidenceChecks(18),
      ],
    },
  });

  check("buildQaSummary records failed sample evidence when detail coverage is short",
    partialSampleEvidenceSummary?.latestRun?.sampleEvidence,
    {
      status: "failed",
      requiredMin: 19,
      listedSamples: 18,
      detailChecks: {
        passed: 18,
        failed: 0,
      },
      reportEssentialChecks: {
        passed: 18,
        failed: 0,
      },
      failures: [
        "sample list below required minimum",
        "sample detail checks below required minimum",
        "sample report essentials checks below required minimum",
      ],
    });

  check("buildQaSummary records failed QA verdict when sample evidence is incomplete",
    partialSampleEvidenceSummary?.latestRun?.qaVerdict?.failures,
    ["required smoke checks failed", "sample evidence incomplete"]);
```

- [ ] **Step 6: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: fails because `latestRun.sampleEvidence` and `qaVerdict.components.sampleEvidence` do not exist yet.

### Task 2: Implement Runner Sample Evidence

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [ ] **Step 1: Add label patterns and helper functions**

Add near `requiredSmokeCheckFailureMessages()`:

```js
const SAMPLE_COUNT_LABEL_PATTERN = /^\/api\/samples has at least (\d+) samples$/;
const SAMPLE_COUNT_DETAIL_PATTERN = /^count=(\d+)$/;
const SAMPLE_DETAIL_OK_LABEL_PATTERN = /^GET \/api\/samples\/:id returns 200 for sample-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAMPLE_REPORT_ESSENTIALS_LABEL_PATTERN = /^sample detail sample-[a-z0-9]+(?:-[a-z0-9]+)* includes report essentials$/;

function smokeCheckCount(checks, pattern, status) {
  return checks.filter((check) => pattern.test(check?.label || "") && check?.status === status).length;
}

function listedSampleCountFor(checks) {
  const countCheck = checks.find((check) => SAMPLE_COUNT_LABEL_PATTERN.test(check?.label || ""));
  const match = SAMPLE_COUNT_DETAIL_PATTERN.exec(countCheck?.detail || "");
  return match ? Number(match[1]) : null;
}
```

- [ ] **Step 2: Add `sampleEvidenceFor()`**

Add:

```js
function sampleEvidenceFor(config, smokeReport) {
  if (isEarlySampleErrorProbe(config)) {
    return {
      status: "skipped",
      requiredMin: 0,
      listedSamples: null,
      detailChecks: { passed: 0, failed: 0 },
      reportEssentialChecks: { passed: 0, failed: 0 },
      failures: [],
    };
  }
  const checks = Array.isArray(smokeReport?.checks) ? smokeReport.checks : [];
  const requiredMin = MIN_SAMPLES;
  const listedSamples = listedSampleCountFor(checks);
  const detailChecks = {
    passed: smokeCheckCount(checks, SAMPLE_DETAIL_OK_LABEL_PATTERN, "pass"),
    failed: smokeCheckCount(checks, SAMPLE_DETAIL_OK_LABEL_PATTERN, "fail"),
  };
  const reportEssentialChecks = {
    passed: smokeCheckCount(checks, SAMPLE_REPORT_ESSENTIALS_LABEL_PATTERN, "pass"),
    failed: smokeCheckCount(checks, SAMPLE_REPORT_ESSENTIALS_LABEL_PATTERN, "fail"),
  };
  const failures = [];
  if (!Number.isSafeInteger(listedSamples)) failures.push("sample list count missing");
  else if (listedSamples < requiredMin) failures.push("sample list below required minimum");
  if (detailChecks.passed < requiredMin) failures.push("sample detail checks below required minimum");
  if (reportEssentialChecks.passed < requiredMin) failures.push("sample report essentials checks below required minimum");
  return {
    status: failures.length ? "failed" : "passed",
    requiredMin,
    listedSamples,
    detailChecks,
    reportEssentialChecks,
    failures,
  };
}
```

- [ ] **Step 3: Include sample evidence in QA verdict**

Change `qaVerdictFor()` signature and body:

```js
function qaVerdictFor({ runStatus, exitCode, requiredCheckStatus, artifactIntegrity, sampleEvidence }) {
  const smokeStatus = exitCode === 0 && runStatus === "passed" ? "passed" : "failed";
  const resolvedRequiredCheckStatus = requiredCheckStatus || "failed";
  const artifactIntegrityStatus = artifactIntegrity?.status === "passed" ? "passed" : "failed";
  const sampleEvidenceStatus = ["passed", "skipped"].includes(sampleEvidence?.status) ? sampleEvidence.status : "failed";
  const failures = [];
  if (smokeStatus !== "passed") failures.push("smoke report failed");
  if (!["passed", "skipped"].includes(resolvedRequiredCheckStatus)) failures.push("required smoke checks failed");
  if (artifactIntegrityStatus !== "passed") failures.push("artifact integrity failed");
  if (!["passed", "skipped"].includes(sampleEvidenceStatus)) failures.push("sample evidence incomplete");
  return {
    status: failures.length ? "failed" : "passed",
    shareable: failures.length === 0,
    components: {
      smoke: smokeStatus,
      requiredChecks: resolvedRequiredCheckStatus,
      artifactIntegrity: artifactIntegrityStatus,
      sampleEvidence: sampleEvidenceStatus,
    },
    failures,
  };
}
```

- [ ] **Step 4: Wire `sampleEvidence` into `buildQaSummary()`**

Compute before the returned object:

```js
  const sampleEvidence = sampleEvidenceFor(config, smokeReport);
```

Add `sampleEvidence` after `qaVerdict` or before `smokeSummary`, and pass it into `qaVerdictFor()`.

- [ ] **Step 5: Run GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: `139 passed, 0 failed`.

### Task 3: Update Documentation and Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update field list docs**

In both docs, add `sample evidence coverage rollup` beside `QA verdict/shareable rollup`.

- [ ] **Step 2: Static checks**

Run:

```bash
node -e 'const fs=require("fs"); const p="docs/superpowers/plans/2026-06-08-smoke-report-sample-evidence.md"; const s=fs.readFileSync(p,"utf8"); const needles=[["T","BD"],["TO","DO"],["implement"," later"],["fill"," in details"],["Similar"," to Task"],["Add"," appropriate"],["Write"," tests for the above"]].map((parts)=>parts.join("")); const hits=needles.filter((needle)=>s.includes(needle)); if (hits.length) { console.error(hits.join("\n")); process.exit(1); }'
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
git diff --check
```

Expected: placeholder scan has no matches; all other commands exit 0.

- [ ] **Step 3: Full test and local smoke**

Run:

```bash
npm test
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/sample-evidence-local npm run smoke:report:readonly
```

Expected: full tests pass; local smoke passes with 156 checks and `latestRun.sampleEvidence.status: "passed"`, `requiredMin: 19`, `detailChecks.passed: 19`, `reportEssentialChecks.passed: 19`, and `latestRun.qaVerdict.shareable: true`.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-08-smoke-report-sample-evidence.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md
git commit -m "ci: record smoke report sample evidence"
git push origin main
```

- [ ] **Step 5: GitHub artifact verification**

After GitHub Actions completes, download `qa-automation-<run-id>` and verify `qa-summary.json.latestRun.sampleEvidence.status` is `passed`, `detailChecks.passed` is `19`, `reportEssentialChecks.passed` is `19`, `qaVerdict.components.sampleEvidence` is `passed`, read-only smoke remains `156 passed / 0 failed`, and sensitive token/path patterns do not appear.
