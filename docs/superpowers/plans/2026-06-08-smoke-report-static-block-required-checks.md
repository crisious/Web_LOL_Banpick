# Smoke Report Static Block Required Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make smoke report QA summaries prove that core sensitive static paths were checked and blocked during full external demo smoke runs.

**Architecture:** Extend the existing `requiredChecks` mechanism in `scripts/run-smoke-report.mjs` instead of adding a new report format. Normal full smoke reports must show pass/missing/fail status for the sample list privacy check plus `.env`, `server.js`, and `/data/samples/manifest.json` static block checks; targeted sample-list/detail error probes remain exempt because they intentionally exit before static path probes.

**Tech Stack:** Node.js ESM smoke report runner, Node-based runner tests, Markdown README/runbook.

---

### Task 1: Add Failing Runner Tests for Static Block Required Checks

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Inspect: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Write the failing tests**

Update the existing `requiredChecks` expectations in `test-artifacts/scripts/smoke-report-runner-tests.mjs` so they include these four full-run labels:

```js
[
  { label: "/api/samples list entries omit explicit matchId", status: "missing" },
  { label: "/.env is not publicly served", status: "missing" },
  { label: "/server.js is not publicly served", status: "missing" },
  { label: "/data/samples/manifest.json is not publicly served", status: "missing" },
]
```

Change the missing-check validation expectation to:

```js
[
  "missing required smoke check: /api/samples list entries omit explicit matchId",
  "missing required smoke check: /.env is not publicly served",
  "missing required smoke check: /server.js is not publicly served",
  "missing required smoke check: /data/samples/manifest.json is not publicly served",
]
```

Update `passingRequiredCheckReport.checks` to include passing entries for all four labels:

```js
{ status: "pass", label: "/api/samples list entries omit explicit matchId" },
{ status: "pass", label: "/.env is not publicly served" },
{ status: "pass", label: "/server.js is not publicly served" },
{ status: "pass", label: "/data/samples/manifest.json is not publicly served" },
```

- [x] **Step 2: Run the focused test to verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits non-zero because `scripts/run-smoke-report.mjs` still requires only the sample list `matchId` check.

### Task 2: Add Static Block Labels to Required Full Smoke Checks

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Extend the required label list**

Update `REQUIRED_FULL_SMOKE_CHECK_LABELS` to:

```js
const REQUIRED_FULL_SMOKE_CHECK_LABELS = [
  "/api/samples list entries omit explicit matchId",
  "/.env is not publicly served",
  "/server.js is not publicly served",
  "/data/samples/manifest.json is not publicly served",
];
```

Do not change `requiredSmokeCheckResults()` or `validateRequiredSmokeChecks()`; the current label-driven implementation should handle the new labels.

- [x] **Step 2: Run the focused test to verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits zero with the updated required check expectations.

### Task 3: Document the Expanded Artifact Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update README**

Extend the security section so the smoke report sentence says:

```markdown
`npm run smoke:report:*` records this privacy gate and core sensitive static block gates in `qa-summary.json.latestRun.requiredChecks`, and fails normal report runs if any required full-smoke check is missing from the smoke report.
```

- [x] **Step 2: Update runbook**

Update the expected checklist wording so it states:

```markdown
Smoke report summaries must include the required sample-list privacy and core sensitive static block check results so CI artifacts prove those gates were part of the run.
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

- [x] **Step 2: Run a local read-only smoke report**

Start the server:

```bash
PORT=8123 HOST=127.0.0.1 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-static-required-check-local
node -e "const fs=require('fs'); const p='test-artifacts/tmp/qa-static-required-check-local/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify(j.latestRun.requiredChecks, null, 2));"
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-static-required-check-local
rm -rf test-artifacts/tmp/qa-static-required-check-local
```

Expected: smoke report passes with 156 checks, all four `requiredChecks` statuses are `pass`, sensitive scan has no matches, and the temporary artifact directory is removed.

- [x] **Step 3: Run staged QA**

After staging only intended files, run:

```bash
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --cached --check
```

Expected: every command exits zero.

- [ ] **Step 4: Commit and push to main**

Run:

```bash
git commit -m "ci: require static block smoke report checks"
git push origin main
```

Expected: push succeeds and `main...origin/main` returns `0	0` after fetch.

- [ ] **Step 5: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --dir /tmp/lol-ai-coach-static-required-checks
rg -n "requiredChecks|/.env is not publicly served|/server.js is not publicly served|/data/samples/manifest.json is not publicly served" /tmp/lol-ai-coach-static-required-checks
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" /tmp/lol-ai-coach-static-required-checks
```

Expected: the run completes successfully, artifact required checks all pass, and sensitive scan has no matches.

### Self-Review

- Spec coverage: The plan covers static block required check tests, runner implementation, docs/runbook updates, local/staged QA, local report artifact proof, GitHub Actions artifact proof, sensitive scan, and Obsidian capture.
- Placeholder scan: The plan uses exact file paths, labels, commands, expected outputs, and no deferred implementation markers.
- Type consistency: The required check labels exactly match the existing `scripts/external-demo-smoke.mjs` labels for sample list privacy and blocked static paths.

### Observed Results

- RED confirmed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited non-zero with `103 passed, 3 failed`; failures showed `requiredChecks` still contained only `/api/samples list entries omit explicit matchId`.
- GREEN confirmed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited zero with `106 passed, 0 failed`.
- Local QA confirmed:
  - `node --check scripts/run-smoke-report.mjs` passed
  - `node --check test-artifacts/scripts/smoke-report-runner-tests.mjs` passed
  - placeholder scan found no plan placeholders
  - `npm test` passed with `1283 passed, 0 failed across 40 test file(s)`
  - `git diff --check` passed
  - actual `npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-static-required-check-local` passed with `156 passed, 0 failed`
  - local `qa-summary.json.latestRun.requiredChecks` recorded four pass statuses for sample list `matchId`, `/.env`, `/server.js`, and `/data/samples/manifest.json`
  - local temporary report artifact sensitive scan found no matches
- Staged QA confirmed:
  - `node --check scripts/run-smoke-report.mjs` passed
  - `node --check test-artifacts/scripts/smoke-report-runner-tests.mjs` passed
  - `node test-artifacts/scripts/smoke-report-runner-tests.mjs` passed with `106 passed, 0 failed`
  - `npm test` passed with `1283 passed, 0 failed across 40 test file(s)`
  - `git diff --cached --check` passed
