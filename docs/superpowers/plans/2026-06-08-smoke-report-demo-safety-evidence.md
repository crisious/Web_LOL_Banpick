# Smoke Report Demo Safety Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add `latestRun.demoSafetyEvidence` to smoke report QA summaries so reviewers can see static exposure and read-only live API block coverage at a glance.

**Architecture:** Keep direct smoke behavior unchanged and derive the new rollup from existing `smoke-report.json.checks`. The runner will summarize sensitive static path blocking, `nosniff` coverage, and read-only live/write API block evidence, then fold that status into `latestRun.qaVerdict`.

**Tech Stack:** Node.js ES modules, existing no-dependency smoke report runner tests, markdown docs.

---

### Task 1: Add Failing Demo Safety Tests

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add reusable demo safety fixtures**

Add this near the existing `sampleEvidenceChecks()` helper:

```js
  const sensitiveStaticPaths = [
    "/.env",
    "/server.js",
    "/package.json",
    "/data/samples/manifest.json",
    "/test-artifacts/run-tests.mjs",
    "/external-access-deployment-plan.md",
    "/%2eenv",
    "/..%2Fserver.js",
    "/%2e%2e%2Fserver.js",
    "/data%2Fsamples%2Fmanifest.json",
  ];

  const readonlyLiveApiLabels = [
    "/api/recent-matches",
    "/api/champion-history",
    "/api/generate-sample",
  ];

  function demoSafetyChecks() {
    return [
      ...sensitiveStaticPaths.flatMap((path) => [
        { status: "pass", label: `${path} is not publicly served` },
        { status: "pass", label: `${path} has X-Content-Type-Options nosniff` },
      ]),
      ...readonlyLiveApiLabels.flatMap((label) => [
        { status: "pass", label: `readonly mode blocks ${label}` },
        { status: "pass", label: `${label} readonly block returns PUBLIC_DEMO_READONLY` },
      ]),
    ];
  }
```

- [x] **Step 2: Expect failed demo safety in the exact minimal summary fixture**

In the exact `buildQaSummary records latest run evidence without token values` expected object, add `demoSafety` to the QA verdict components:

```js
            demoSafety: "failed",
```

Change the failures array to:

```js
          failures: ["required smoke checks failed", "sample evidence incomplete", "demo safety evidence incomplete"],
```

Add this object after `sampleEvidence`:

```js
        demoSafetyEvidence: {
          status: "failed",
          staticPaths: {
            required: 10,
            blocked: { passed: 0, failed: 0, missing: 10 },
            nosniff: { passed: 0, failed: 0, missing: 10 },
          },
          readonlyApis: {
            status: "skipped",
            required: 0,
            blocked: { passed: 0, failed: 0, missing: 0 },
            blockCodes: { passed: 0, failed: 0, missing: 0 },
          },
          failures: [
            "sensitive static path block checks incomplete",
            "sensitive static path nosniff checks incomplete",
          ],
        },
```

- [x] **Step 3: Add passing safety checks to the passing report fixture**

In `passingRequiredCheckReport.checks`, add:

```js
      ...demoSafetyChecks(),
```

- [x] **Step 4: Expect passing demo safety and QA verdict component**

Update the passing QA verdict expectation to include:

```js
        demoSafety: "passed",
```

Add this check after `buildQaSummary records passing sample evidence`:

```js
  check("buildQaSummary records passing demo safety evidence",
    passingRequiredSummary?.latestRun?.demoSafetyEvidence,
    {
      status: "passed",
      staticPaths: {
        required: 10,
        blocked: { passed: 10, failed: 0, missing: 0 },
        nosniff: { passed: 10, failed: 0, missing: 0 },
      },
      readonlyApis: {
        status: "passed",
        required: 3,
        blocked: { passed: 3, failed: 0, missing: 0 },
        blockCodes: { passed: 3, failed: 0, missing: 0 },
      },
      failures: [],
    });
```

- [x] **Step 5: Add a failed safety fixture**

Add this near the partial sample evidence fixture:

```js
  const partialDemoSafetySummary = runner.buildQaSummary?.({
    config: missingRequiredCheckConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T06-55-00Z-readonly",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-55-00Z-readonly/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T06-55-00Z-readonly/smoke-run.json",
    startedAt: "2026-06-08T06:55:00.000Z",
    finishedAt: "2026-06-08T06:55:10.000Z",
    exitCode: 0,
    artifactFileSizes: {
      smokeReportBytes: 4096,
      smokeRunBytes: 768,
    },
    artifactFileHashes: {
      smokeReportSha256: "1111111111111111111111111111111111111111111111111111111111111111",
      smokeRunSha256: "2222222222222222222222222222222222222222222222222222222222222222",
    },
    smokeReport: {
      status: "passed",
      actualMode: "readonly",
      summary: { passed: 70, failed: 1 },
      checks: [
        { status: "pass", label: "/api/samples has at least 19 samples" },
        ...sampleEvidenceChecks(19),
        ...demoSafetyChecks().filter((check) => check.label !== "/server.js is not publicly served"),
        { status: "fail", label: "/server.js is not publicly served" },
      ],
    },
  });

  check("buildQaSummary records failed demo safety evidence",
    partialDemoSafetySummary?.latestRun?.demoSafetyEvidence,
    {
      status: "failed",
      staticPaths: {
        required: 10,
        blocked: { passed: 9, failed: 1, missing: 0 },
        nosniff: { passed: 10, failed: 0, missing: 0 },
      },
      readonlyApis: {
        status: "passed",
        required: 3,
        blocked: { passed: 3, failed: 0, missing: 0 },
        blockCodes: { passed: 3, failed: 0, missing: 0 },
      },
      failures: ["sensitive static path block checks incomplete"],
    });

  check("buildQaSummary records failed QA verdict when demo safety is incomplete",
    partialDemoSafetySummary?.latestRun?.qaVerdict?.failures,
    ["required smoke checks failed", "demo safety evidence incomplete"]);
```

- [x] **Step 6: Ensure early sample error probes skip demo safety**

Add near the existing sample list error summary checks:

```js
  check("sample list error smoke reports skip demo safety evidence",
    sampleListErrorSummary?.latestRun?.demoSafetyEvidence,
    {
      status: "skipped",
      staticPaths: {
        required: 0,
        blocked: { passed: 0, failed: 0, missing: 0 },
        nosniff: { passed: 0, failed: 0, missing: 0 },
      },
      readonlyApis: {
        status: "skipped",
        required: 0,
        blocked: { passed: 0, failed: 0, missing: 0 },
        blockCodes: { passed: 0, failed: 0, missing: 0 },
      },
      failures: [],
    });
```

- [x] **Step 7: Run RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: failures because `latestRun.demoSafetyEvidence` and `qaVerdict.components.demoSafety` are not present yet.

### Task 2: Implement Runner Demo Safety Evidence

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add evidence path constants**

Add near `READONLY_REQUIRED_FULL_SMOKE_CHECK_LABELS`:

```js
const SENSITIVE_STATIC_PATHS = [
  "/.env",
  "/server.js",
  "/package.json",
  "/data/samples/manifest.json",
  "/test-artifacts/run-tests.mjs",
  "/external-access-deployment-plan.md",
  "/%2eenv",
  "/..%2Fserver.js",
  "/%2e%2e%2Fserver.js",
  "/data%2Fsamples%2Fmanifest.json",
];
const READONLY_LIVE_API_LABELS = [
  "/api/recent-matches",
  "/api/champion-history",
  "/api/generate-sample",
];
```

- [x] **Step 2: Add status counter helpers**

Add after `requiredSmokeCheckFailureMessages()`:

```js
function checkStatusFor(checks, label) {
  const check = checks.find((item) => item?.label === label);
  if (!check) return "missing";
  return check.status === "pass" ? "pass" : "fail";
}

function summarizeLabelStatuses(checks, labels) {
  const summary = {
    passed: 0,
    failed: 0,
    missing: 0,
  };
  for (const label of labels) {
    const status = checkStatusFor(checks, label);
    if (status === "pass") summary.passed += 1;
    else if (status === "fail") summary.failed += 1;
    else summary.missing += 1;
  }
  return summary;
}
```

- [x] **Step 3: Add `demoSafetyEvidenceFor()`**

Add:

```js
function emptyDemoSafetyEvidence(status = "skipped") {
  return {
    status,
    staticPaths: {
      required: 0,
      blocked: { passed: 0, failed: 0, missing: 0 },
      nosniff: { passed: 0, failed: 0, missing: 0 },
    },
    readonlyApis: {
      status: "skipped",
      required: 0,
      blocked: { passed: 0, failed: 0, missing: 0 },
      blockCodes: { passed: 0, failed: 0, missing: 0 },
    },
    failures: [],
  };
}

function demoSafetyEvidenceFor(config, smokeReport) {
  if (isEarlySampleErrorProbe(config)) return emptyDemoSafetyEvidence();
  const checks = Array.isArray(smokeReport?.checks) ? smokeReport.checks : [];
  const staticBlockedLabels = SENSITIVE_STATIC_PATHS.map((path) => `${path} is not publicly served`);
  const staticNosniffLabels = SENSITIVE_STATIC_PATHS.map((path) => `${path} has X-Content-Type-Options nosniff`);
  const staticBlocked = summarizeLabelStatuses(checks, staticBlockedLabels);
  const staticNosniff = summarizeLabelStatuses(checks, staticNosniffLabels);
  const readonlyRequired = config?.expectedMode === "readonly";
  const readonlyBlocked = readonlyRequired
    ? summarizeLabelStatuses(checks, READONLY_LIVE_API_LABELS.map((label) => `readonly mode blocks ${label}`))
    : { passed: 0, failed: 0, missing: 0 };
  const readonlyBlockCodes = readonlyRequired
    ? summarizeLabelStatuses(checks, READONLY_LIVE_API_LABELS.map((label) => `${label} readonly block returns PUBLIC_DEMO_READONLY`))
    : { passed: 0, failed: 0, missing: 0 };
  const failures = [];
  if (staticBlocked.passed !== SENSITIVE_STATIC_PATHS.length || staticBlocked.failed || staticBlocked.missing) {
    failures.push("sensitive static path block checks incomplete");
  }
  if (staticNosniff.passed !== SENSITIVE_STATIC_PATHS.length || staticNosniff.failed || staticNosniff.missing) {
    failures.push("sensitive static path nosniff checks incomplete");
  }
  if (readonlyRequired && (readonlyBlocked.passed !== READONLY_LIVE_API_LABELS.length || readonlyBlocked.failed || readonlyBlocked.missing)) {
    failures.push("readonly live API block checks incomplete");
  }
  if (readonlyRequired && (readonlyBlockCodes.passed !== READONLY_LIVE_API_LABELS.length || readonlyBlockCodes.failed || readonlyBlockCodes.missing)) {
    failures.push("readonly live API block code checks incomplete");
  }
  return {
    status: failures.length ? "failed" : "passed",
    staticPaths: {
      required: SENSITIVE_STATIC_PATHS.length,
      blocked: staticBlocked,
      nosniff: staticNosniff,
    },
    readonlyApis: {
      status: readonlyRequired ? (readonlyBlocked.passed === READONLY_LIVE_API_LABELS.length && readonlyBlockCodes.passed === READONLY_LIVE_API_LABELS.length && !readonlyBlocked.failed && !readonlyBlocked.missing && !readonlyBlockCodes.failed && !readonlyBlockCodes.missing ? "passed" : "failed") : "skipped",
      required: readonlyRequired ? READONLY_LIVE_API_LABELS.length : 0,
      blocked: readonlyBlocked,
      blockCodes: readonlyBlockCodes,
    },
    failures,
  };
}
```

- [x] **Step 4: Include demo safety in QA verdict**

Change `qaVerdictFor()` to receive `demoSafetyEvidence`, compute:

```js
  const demoSafetyStatus = ["passed", "skipped"].includes(demoSafetyEvidence?.status) ? demoSafetyEvidence.status : "failed";
```

Add:

```js
  if (!["passed", "skipped"].includes(demoSafetyStatus)) failures.push("demo safety evidence incomplete");
```

and include:

```js
      demoSafety: demoSafetyStatus,
```

- [x] **Step 5: Wire `demoSafetyEvidence` into `buildQaSummary()`**

Compute:

```js
  const demoSafetyEvidence = demoSafetyEvidenceFor(config, smokeReport);
```

Pass it into `qaVerdictFor()` and add `demoSafetyEvidence` to `latestRun`.

- [x] **Step 6: Run GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: `143 passed, 0 failed`.

### Task 3: Update Docs and Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update QA summary field lists**

Add `demo safety evidence rollup` beside `sample evidence coverage rollup`.

- [x] **Step 2: Static checks**

Run:

```bash
node -e 'const fs=require("fs"); const p="docs/superpowers/plans/2026-06-08-smoke-report-demo-safety-evidence.md"; const s=fs.readFileSync(p,"utf8"); const needles=[["T","BD"],["TO","DO"],["implement"," later"],["fill"," in details"],["Similar"," to Task"],["Add"," appropriate"],["Write"," tests for the above"]].map((parts)=>parts.join("")); const hits=needles.filter((needle)=>s.includes(needle)); if (hits.length) { console.error(hits.join("\n")); process.exit(1); }'
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
git diff --check
```

Expected: all commands exit 0.

- [x] **Step 3: Full test and local smoke**

Run:

```bash
npm test
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/demo-safety-local npm run smoke:report:readonly
```

Expected: full tests pass; local smoke passes with 156 checks and `latestRun.demoSafetyEvidence.status: "passed"`, static blocked/nosniff counts 10 each, readonly API block/code counts 3 each, and `latestRun.qaVerdict.shareable: true`.

- [x] **Step 4: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-08-smoke-report-demo-safety-evidence.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md
git commit -m "ci: record smoke report demo safety evidence"
git push origin main
```

- [x] **Step 5: GitHub artifact verification**

After GitHub Actions completes, download `qa-automation-<run-id>` and verify `qa-summary.json.latestRun.demoSafetyEvidence.status` is `passed`, static blocked/nosniff counts are 10 each, readonly API block/code counts are 3 each, `qaVerdict.components.demoSafety` is `passed`, read-only smoke remains `156 passed / 0 failed`, and sensitive token/path patterns do not appear.

### Actual Verification

- RED: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` failed before implementation with missing `latestRun.demoSafetyEvidence` / `qaVerdict.components.demoSafety` expectations.
- GREEN: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` passed with `143 passed, 0 failed`.
- Static QA: placeholder scan, `node --check` for runner/tests, and `git diff --check` passed.
- Full QA: `npm test` passed with `1320 passed, 0 failed across 40 test file(s)`.
- Local smoke: `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/demo-safety-local npm run smoke:report:readonly` passed with `156` checks, `latestRun.demoSafetyEvidence.status: "passed"`, static blocked/nosniff counts `10/10`, readonly API block/code counts `3/3`, and `qaVerdict.components.demoSafety: "passed"`.
- Sensitive artifact scan: no matches for token, Riot key, match id, or lock key patterns in the local smoke artifact.
