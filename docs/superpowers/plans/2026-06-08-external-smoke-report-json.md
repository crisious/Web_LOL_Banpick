# External Smoke Report JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in JSON report artifact to `scripts/external-demo-smoke.mjs` so local and external demo smoke runs leave shareable QA evidence.

**Architecture:** Keep the existing console output and exit behavior as the source of truth. Record every `PASS`/`FAIL` check in memory, then write a bounded JSON file when `--report-json=<path>` is provided, including mode metadata, final status, exit code, summary counts, and check labels/details without request bodies or demo tokens.

**Tech Stack:** Node.js 20+, built-in `fs`, built-in `path`, existing vanilla HTTP smoke CLI tests in `test-artifacts/scripts/external-demo-smoke-tests.mjs`.

---

### Task 1: Argument Contract

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `scripts/external-demo-smoke.mjs`

- [ ] **Step 1: Write the failing parser tests**

Add parser assertions near the existing `parseSmokeArgs` tests:

```js
check("parseSmokeArgs reads report JSON path",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "https://demo.example", "--expect-mode=readonly", "--report-json=test-artifacts/tmp/smoke-report.json"], {}),
  { baseUrl: "https://demo.example", demoToken: "", expectedMode: "readonly", minSamples: 1, requestTimeoutMs: 10000, reportJsonPath: "test-artifacts/tmp/smoke-report.json" });

checkThrows("parseSmokeArgs rejects empty report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json="], {}),
  "--report-json needs a file path");
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: FAIL on the two new report JSON parser checks because `reportJsonPath` is not parsed yet.

- [ ] **Step 3: Implement the parser option**

In `parseSmokeArgs`, read and validate `--report-json=<path>`:

```js
const reportJsonArg = args.find((arg) => arg.startsWith("--report-json="));
const reportJsonPath = reportJsonArg ? reportJsonArg.slice("--report-json=".length).trim() : "";
if (reportJsonArg && !reportJsonPath) {
  throw new Error("--report-json needs a file path");
}
```

Add `...(reportJsonPath ? { reportJsonPath } : {})` to the returned object so existing exact-object tests remain stable when the option is omitted.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: All external-demo-smoke tests pass.

### Task 2: Report Writer

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `scripts/external-demo-smoke.mjs`

- [ ] **Step 1: Write the failing CLI report tests**

Import temp path helpers at the top of `test-artifacts/scripts/external-demo-smoke-tests.mjs`:

```js
import os from "node:os";
import path from "node:path";
```

Add two CLI tests after the existing sample list error tests:

```js
const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), "lol-smoke-report-"));
const passedReportPath = path.join(reportDir, "passed", "smoke.json");
const failedReportPath = path.join(reportDir, "failed", "smoke.json");
```

Use a successful targeted sample list error server with `--report-json=${passedReportPath}` and assert:

```js
const passedReport = JSON.parse(fs.readFileSync(passedReportPath, "utf8"));
check("CLI writes passed smoke report JSON", passedReport.status, "passed");
check("passed smoke report records summary counts", passedReport.summary.failed === 0 && passedReport.summary.passed > 0, true);
check("passed smoke report records observed mode", passedReport.actualMode, "readonly");
check("passed smoke report excludes demo token", JSON.stringify(passedReport).includes("secret-smoke-token"), false);
```

Use a wrong sample list error code server with `--report-json=${failedReportPath}` and assert:

```js
const failedReport = JSON.parse(fs.readFileSync(failedReportPath, "utf8"));
check("CLI writes failed smoke report JSON", failedReport.status, "failed");
check("failed smoke report records exit code", failedReport.exitCode, 1);
check("failed smoke report records failing check", failedReport.checks.some((item) => item.status === "fail" && item.label === "sample list error returns SAMPLE_MANIFEST_INVALID"), true);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: FAIL because `--report-json` is accepted only after Task 1 and no JSON file is written yet.

- [ ] **Step 3: Implement bounded check recording and report writing**

In `scripts/external-demo-smoke.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
```

After parsing:

```js
const { baseUrl, demoToken, expectedMode, minSamples, requestTimeoutMs, expectedSampleDetailError, expectedSampleListError, reportJsonPath } = parsedArgs;
const startedAt = new Date().toISOString();
const reportChecks = [];
let observedMode = "";
let reportWritten = false;
```

Add helpers:

```js
function recordCheck(status, label, detail = "") {
  reportChecks.push(detail ? { status, label, detail } : { status, label });
}

function writeReport(exitCode) {
  if (!reportJsonPath || reportWritten) return;
  reportWritten = true;
  const passed = reportChecks.filter((item) => item.status === "pass").length;
  const failed = reportChecks.filter((item) => item.status === "fail").length;
  const reportPath = path.resolve(reportJsonPath);
  const payload = {
    schemaVersion: 1,
    baseUrl,
    expectedMode,
    actualMode: observedMode,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: exitCode ? "failed" : "passed",
    exitCode,
    summary: { passed, failed },
    checks: reportChecks,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
```

Update `pass`, `fail`, `fatal`, targeted probe exits, and final exit to call `recordCheck` and `writeReport` before `process.exit(...)`. Set `observedMode = actualMode` immediately after deriving `actualMode`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: All external-demo-smoke tests pass and the report tests assert both passed and failed reports.

### Task 3: Documentation And Runtime QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Document report usage**

Add examples:

```bash
npm run smoke:readonly -- --report-json=test-artifacts/qa-automation/smoke-readonly.json
npm run smoke:external:readonly -- https://your-demo-url.example --report-json=test-artifacts/qa-automation/external-readonly.json
```

Document that the JSON report contains labels, summary counts, mode metadata, and no demo token.

- [ ] **Step 2: Run full verification**

Run:

```bash
node --check scripts/external-demo-smoke.mjs
node --check test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/external-demo-smoke-tests.mjs
npm test
git diff --check
```

Expected: All commands exit 0.

- [ ] **Step 3: Run local runtime smoke with report**

Start a read-only server and run:

```bash
HOST=127.0.0.1 npm run start:readonly
npm run smoke:readonly -- --report-json=/tmp/lol-ai-coach-readonly-smoke-report.json
```

Expected: smoke exits 0 and `/tmp/lol-ai-coach-readonly-smoke-report.json` has `status: "passed"` and `summary.failed: 0`.

- [ ] **Step 4: Commit and push main**

Stage only intended files, commit:

```bash
git add docs/superpowers/plans/2026-06-08-external-smoke-report-json.md scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md "/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md"
git commit -m "chore: add external smoke JSON reports"
git push origin main
```

Expected: `main` is pushed to `origin/main`.
