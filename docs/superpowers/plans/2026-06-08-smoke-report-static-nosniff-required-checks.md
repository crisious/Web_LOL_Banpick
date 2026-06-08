# Smoke Report Static Nosniff Required Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make smoke report QA summaries prove that core sensitive static block responses include `X-Content-Type-Options: nosniff`.

**Architecture:** Extend the existing label-driven `requiredChecks` list in `scripts/run-smoke-report.mjs`. Normal full smoke reports must include pass/missing/fail status for sample list privacy, core sensitive static block status, and the corresponding `nosniff` header checks for `/.env`, `/server.js`, and `/data/samples/manifest.json`; targeted sample-list/detail error probes stay exempt because they exit before static path probes.

**Tech Stack:** Node.js ESM smoke report runner, Node-based runner tests, Markdown README/runbook.

---

### Task 1: Add Failing Runner Tests for Static Nosniff Required Checks

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Inspect: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Write the failing tests**

Update the existing `missingFullRequiredChecks` constant in `test-artifacts/scripts/smoke-report-runner-tests.mjs` so it contains seven missing labels:

```js
const missingFullRequiredChecks = [
  { label: "/api/samples list entries omit explicit matchId", status: "missing" },
  { label: "/.env is not publicly served", status: "missing" },
  { label: "/.env has X-Content-Type-Options nosniff", status: "missing" },
  { label: "/server.js is not publicly served", status: "missing" },
  { label: "/server.js has X-Content-Type-Options nosniff", status: "missing" },
  { label: "/data/samples/manifest.json is not publicly served", status: "missing" },
  { label: "/data/samples/manifest.json has X-Content-Type-Options nosniff", status: "missing" },
];
```

Update the missing-check validation expectation to include these three extra messages:

```js
"missing required smoke check: /.env has X-Content-Type-Options nosniff",
"missing required smoke check: /server.js has X-Content-Type-Options nosniff",
"missing required smoke check: /data/samples/manifest.json has X-Content-Type-Options nosniff",
```

Update `passingRequiredCheckReport.checks` to include passing entries for these three labels:

```js
{ status: "pass", label: "/.env has X-Content-Type-Options nosniff" },
{ status: "pass", label: "/server.js has X-Content-Type-Options nosniff" },
{ status: "pass", label: "/data/samples/manifest.json has X-Content-Type-Options nosniff" },
```

- [x] **Step 2: Run the focused test to verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits non-zero because `scripts/run-smoke-report.mjs` still requires block labels but not the corresponding `nosniff` labels.

### Task 2: Add Static Nosniff Labels to Required Full Smoke Checks

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Extend the required label list**

Update `REQUIRED_FULL_SMOKE_CHECK_LABELS` to:

```js
const REQUIRED_FULL_SMOKE_CHECK_LABELS = [
  "/api/samples list entries omit explicit matchId",
  "/.env is not publicly served",
  "/.env has X-Content-Type-Options nosniff",
  "/server.js is not publicly served",
  "/server.js has X-Content-Type-Options nosniff",
  "/data/samples/manifest.json is not publicly served",
  "/data/samples/manifest.json has X-Content-Type-Options nosniff",
];
```

No helper changes should be needed because `requiredSmokeCheckResults()` is label-driven.

- [x] **Step 2: Run the focused test to verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the command exits zero with the expanded required check expectations.

### Task 3: Document the Expanded Artifact Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update README**

Update the smoke report security sentence to mention `nosniff`:

```markdown
`npm run smoke:report:*` also records this privacy gate plus core sensitive static block and `nosniff` gates in `qa-summary.json.latestRun.requiredChecks`, and fails normal report runs if any required full-smoke check is missing from the smoke report.
```

- [x] **Step 2: Update runbook**

Update the expected checklist wording to:

```markdown
Smoke report summaries must include the required sample-list privacy, core sensitive static block, and static block `nosniff` check results so CI artifacts prove those gates were part of the run.
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
npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-static-nosniff-required-check-local
node -e "const fs=require('fs'); const p='test-artifacts/tmp/qa-static-nosniff-required-check-local/qa-summary.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify(j.latestRun.requiredChecks, null, 2));"
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" test-artifacts/tmp/qa-static-nosniff-required-check-local
rm -rf test-artifacts/tmp/qa-static-nosniff-required-check-local
```

Expected: smoke report passes with 156 checks, all seven `requiredChecks` statuses are `pass`, sensitive scan has no matches, and the temporary artifact directory is removed.

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
git commit -m "ci: require static nosniff smoke report checks"
git push origin main
```

Expected: push succeeds and `main...origin/main` returns `0	0` after fetch.

- [ ] **Step 5: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --dir /tmp/lol-ai-coach-static-nosniff-required-checks
rg -n "requiredChecks|/.env has X-Content-Type-Options nosniff|/server.js has X-Content-Type-Options nosniff|/data/samples/manifest.json has X-Content-Type-Options nosniff" /tmp/lol-ai-coach-static-nosniff-required-checks
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" /tmp/lol-ai-coach-static-nosniff-required-checks
```

Expected: the run completes successfully, artifact required checks all pass, and sensitive scan has no matches.

### Self-Review

- Spec coverage: The plan covers nosniff required check tests, runner implementation, docs/runbook updates, local/staged QA, local report artifact proof, GitHub Actions artifact proof, sensitive scan, and Obsidian capture.
- Placeholder scan: The plan uses exact file paths, labels, commands, expected outputs, and no deferred implementation markers.
- Type consistency: The required check labels exactly match the existing `scripts/external-demo-smoke.mjs` labels for blocked static path `nosniff` checks.

### Observed Results

- RED confirmed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited non-zero with `103 passed, 3 failed`; failures showed the required checks included block labels but omitted the three static `nosniff` labels.
- GREEN confirmed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited zero with `106 passed, 0 failed`.
- Local QA confirmed:
  - `node --check scripts/run-smoke-report.mjs` passed
  - `node --check test-artifacts/scripts/smoke-report-runner-tests.mjs` passed
  - placeholder scan found no plan placeholders
  - `npm test` passed with `1283 passed, 0 failed across 40 test file(s)`
  - `git diff --check` passed
  - actual `npm run smoke:report:readonly -- --output-root=test-artifacts/tmp/qa-static-nosniff-required-check-local` passed with `156 passed, 0 failed`
  - local `qa-summary.json.latestRun.requiredChecks` recorded seven pass statuses for sample list `matchId`, static block, and static `nosniff` checks
  - local temporary report artifact sensitive scan found no matches
- Staged QA confirmed:
  - `node --check scripts/run-smoke-report.mjs` passed
  - `node --check test-artifacts/scripts/smoke-report-runner-tests.mjs` passed
  - `node test-artifacts/scripts/smoke-report-runner-tests.mjs` passed with `106 passed, 0 failed`
  - `npm test` passed with `1283 passed, 0 failed across 40 test file(s)`
  - `git diff --cached --check` passed
