# Smoke Report Required Check Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make smoke report QA summaries record and enforce that the normal external demo smoke actually ran the `/api/samples` explicit `matchId` privacy check.

**Architecture:** Keep `scripts/external-demo-smoke.mjs` as the source of smoke checks, and add a lightweight required-check layer in `scripts/run-smoke-report.mjs`. Normal smoke reports must include the selected privacy check as a passing check; early sample-list/detail error probes are exempt because they intentionally exit before the full checklist.

**Tech Stack:** Node.js ESM scripts, Node-based runner tests, Markdown docs/runbook.

---

### Task 1: Add Failing Runner Tests for Required Smoke Checks

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Inspect: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Write the failing tests**

Add these checks inside the existing `if (fs.existsSync(runnerPath)) { ... }` block after the current `buildQaSummary` token/URL redaction tests:

```js
const missingRequiredCheckConfig = runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs"], {});
const missingRequiredCheckReport = {
  status: "passed",
  actualMode: "readonly",
  summary: { passed: 42, failed: 0 },
  checks: [{ status: "pass", label: "GET /healthz returns 200" }],
};

check("validateRequiredSmokeChecks reports missing sample list matchId check",
  runner.validateRequiredSmokeChecks?.(missingRequiredCheckConfig, missingRequiredCheckReport),
  ["missing required smoke check: /api/samples list entries omit explicit matchId"]);

const passingRequiredCheckReport = {
  status: "passed",
  actualMode: "readonly",
  summary: { passed: 43, failed: 0 },
  checks: [
    { status: "pass", label: "GET /healthz returns 200" },
    { status: "pass", label: "/api/samples list entries omit explicit matchId" },
  ],
};

check("validateRequiredSmokeChecks passes when sample list matchId check is present",
  runner.validateRequiredSmokeChecks?.(missingRequiredCheckConfig, passingRequiredCheckReport),
  []);

const missingRequiredSummary = runner.buildQaSummary?.({
  config: missingRequiredCheckConfig,
  reportDir: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly",
  reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly/smoke-report.json",
  metadataPath: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly/smoke-run.json",
  startedAt: "2026-06-08T06:30:00.000Z",
  finishedAt: "2026-06-08T06:30:10.000Z",
  exitCode: 0,
  smokeReport: missingRequiredCheckReport,
});

check("buildQaSummary records missing required smoke checks",
  missingRequiredSummary?.latestRun?.requiredChecks,
  [{ label: "/api/samples list entries omit explicit matchId", status: "missing" }]);

const sampleListErrorConfig = runner.parseRunnerArgs([
  "node",
  "scripts/run-smoke-report.mjs",
  "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
], {});

check("sample list error smoke reports skip full-run required checks",
  runner.validateRequiredSmokeChecks?.(sampleListErrorConfig, missingRequiredCheckReport),
  []);

check("buildQaSummary prefers runner exit status over passed smoke report status",
  runner.buildQaSummary?.({
    config: missingRequiredCheckConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly/smoke-run.json",
    startedAt: "2026-06-08T06:30:00.000Z",
    finishedAt: "2026-06-08T06:30:10.000Z",
    exitCode: 1,
    smokeReport: passingRequiredCheckReport,
  })?.latestRun?.status,
  "failed");
```

- [x] **Step 2: Run the focused test to verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits non-zero because `validateRequiredSmokeChecks` and `latestRun.requiredChecks` do not exist yet, and summary status still follows `smokeReport.status` even when the runner exit code is non-zero.

### Task 2: Enforce Required Checks in the Smoke Report Runner

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add required check helpers**

Add these constants and helpers near the existing smoke option constants:

```js
const REQUIRED_FULL_SMOKE_CHECK_LABELS = [
  "/api/samples list entries omit explicit matchId",
];

function isEarlySampleErrorProbe(config) {
  return (config?.extraSmokeArgs || []).some((arg) =>
    SAMPLE_DETAIL_ERROR_OPTIONS.some((prefix) => arg.startsWith(prefix)) ||
    SAMPLE_LIST_ERROR_OPTIONS.some((prefix) => arg.startsWith(prefix))
  );
}

export function requiredSmokeCheckResults(config, smokeReport) {
  if (isEarlySampleErrorProbe(config)) return [];
  const checks = Array.isArray(smokeReport?.checks) ? smokeReport.checks : [];
  return REQUIRED_FULL_SMOKE_CHECK_LABELS.map((label) => {
    const check = checks.find((item) => item?.label === label);
    if (!check) return { label, status: "missing" };
    return { label, status: check.status === "pass" ? "pass" : "fail" };
  });
}

export function validateRequiredSmokeChecks(config, smokeReport) {
  return requiredSmokeCheckResults(config, smokeReport)
    .filter((check) => check.status !== "pass")
    .map((check) =>
      check.status === "missing"
        ? `missing required smoke check: ${check.label}`
        : `required smoke check failed: ${check.label}`
    );
}
```

- [x] **Step 2: Wire the helpers into summary and runner exit**

Update `buildQaSummary()` so `latestRun.requiredChecks` is populated and the final status honors the runner exit code first:

```js
status: exitCode ? "failed" : (smokeReport?.status || "passed"),
requiredChecks: requiredSmokeCheckResults(config, smokeReport),
```

Update `runSmokeReport()` to read the smoke report once, fail the runner when a successful smoke is missing a required check, and write metadata/summary with the final exit code:

```js
const smokeReport = readJsonIfExists(reportJsonPath);
const requiredCheckFailures = exitCode === 0
  ? validateRequiredSmokeChecks(config, smokeReport)
  : [];
const finalExitCode = requiredCheckFailures.length ? 1 : exitCode;
for (const message of requiredCheckFailures) {
  console.error(`FAIL ${message}`);
}
```

Pass `finalExitCode` to `writeRunMetadata()`, `buildQaSummary()`, and `return`.

- [x] **Step 3: Run the focused test to verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits zero and includes passes for missing/passing required checks, error-probe exemption, and final status precedence.

### Task 3: Document the Report Coverage Gate

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update README**

Extend the `/api/samples` privacy bullet with this sentence:

```markdown
`npm run smoke:report:*` also records this privacy gate in `qa-summary.json.latestRun.requiredChecks` and fails normal report runs if the check is missing from the smoke report.
```

- [x] **Step 2: Update the runbook**

Extend the read-only checklist bullet with this sentence:

```markdown
Smoke report summaries must include the required check result so CI artifacts prove the privacy gate was part of the run.
```

### Task 4: Verify and Publish

**Files:**
- Read: changed files
- Update after publish: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --check
```

Expected: every command exits zero.

- [x] **Step 2: Run staged QA**

After staging only the changed project files, run:

```bash
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --cached --check
```

Expected: every command exits zero.

- [ ] **Step 3: Commit and push to main**

Run:

```bash
git commit -m "ci: require smoke report privacy checks"
git push origin main
```

Expected: push succeeds and `main...origin/main` returns `0	0` after fetch.

- [ ] **Step 4: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --dir /tmp/lol-ai-coach-smoke-report-required-check
rg -n "requiredChecks|/api/samples list entries omit explicit matchId" /tmp/lol-ai-coach-smoke-report-required-check
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" /tmp/lol-ai-coach-smoke-report-required-check
```

Expected: the run completes successfully, the artifact summary records the required check, and the sensitive scan exits with no matches.

### Self-Review

- Spec coverage: The plan covers test-first runner regression, required check implementation, docs/runbook updates, local QA, staged QA, GitHub Actions artifact confirmation, sensitive scan, and Obsidian capture.
- Placeholder scan: The plan contains exact file paths, commands, code snippets, RED/GREEN expectations, and no deferred implementation markers.
- Type consistency: The label `/api/samples list entries omit explicit matchId`, helper names, summary field `requiredChecks`, and commit message are used consistently.

### Observed Results

- RED confirmed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited non-zero with `100 passed, 6 failed`; failures showed missing `requiredChecks`, missing `validateRequiredSmokeChecks`, and runner status not honoring non-zero exit.
- GREEN confirmed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited zero with `106 passed, 0 failed`.
- Local QA confirmed:
  - `node --check scripts/run-smoke-report.mjs` passed
  - `node --check test-artifacts/scripts/smoke-report-runner-tests.mjs` passed
  - placeholder scan found no plan placeholders
  - `npm test` passed with `1283 passed, 0 failed across 40 test file(s)`
  - `git diff --check` passed
  - actual `npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-required-check-local` passed with `156 passed, 0 failed`, `requiredChecks[0].status = "pass"`, and no sensitive pattern matches in the temporary report artifact
- Staged QA confirmed:
  - `node --check scripts/run-smoke-report.mjs` passed
  - `node --check test-artifacts/scripts/smoke-report-runner-tests.mjs` passed
  - `node test-artifacts/scripts/smoke-report-runner-tests.mjs` passed with `106 passed, 0 failed`
  - `npm test` passed with `1283 passed, 0 failed across 40 test file(s)`
  - `git diff --cached --check` passed
