# Direct Smoke Report Trailing Slash Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent direct smoke `--report-json` file paths from silently accepting trailing slash variants such as `test-artifacts/tmp/smoke-report.json/`.

**Architecture:** Keep direct smoke report path validation inside `scripts/external-demo-smoke.mjs`. Reject raw report paths whose slash-normalized value ends in `/` before the existing segment filtering strips that slash, so operator typos fail before network requests or report writes.

**Tech Stack:** Node.js ESM scripts, repository-local `.mjs` test runner, GitHub Actions QA workflow.

---

### Task 1: Add RED Coverage For Trailing Slash Report Paths

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Add parser reject tests**

Add these checks near the existing `--report-json` path validation cases:

```js
checkThrows("parseSmokeArgs rejects trailing slash report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/smoke-report.json/"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");

checkThrows("parseSmokeArgs rejects repeated trailing slash report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json=test-artifacts/tmp/smoke-report.json//"], {}),
  "--report-json must be a relative .json path under a test-artifacts subdirectory");
```

- [x] **Step 2: Add CLI preflight reject coverage**

Add a CLI check near the existing unsafe report JSON path checks:

```js
const trailingSlashReportJsonPath = "test-artifacts/tmp/smoke-report-trailing.json/";
const trailingSlashReportJson = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
  `--report-json=${trailingSlashReportJsonPath}`,
]);

check("CLI exits non-zero for trailing slash report JSON path",
  trailingSlashReportJson.status,
  1);

check("CLI reports trailing slash report JSON path without network request",
  trailingSlashReportJson.stderr.includes("FAIL --report-json must be a relative .json path under a test-artifacts subdirectory"),
  true);
```

- [x] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected before implementation: the two parser trailing slash checks and CLI preflight message check fail because the raw trailing slash is stripped during normalization.

Observed before implementation: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `139 passed, 3 failed`; the failures were the two parser trailing slash reject checks and the CLI preflight message check.

### Task 2: Reject Trailing Slash Direct Report Paths

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`

- [x] **Step 1: Extend raw path guard**

Change the raw path guard to include `comparable.endsWith("/")`:

```js
if (comparable.startsWith("/") || /^[A-Za-z]:\//.test(comparable) || comparable.startsWith("//") || comparable.endsWith("/") || rawSegments.includes(".") || rawSegments.includes("..")) {
  throw new Error("--report-json must be a relative .json path under a test-artifacts subdirectory");
}
```

- [x] **Step 2: Run focused GREEN**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected after implementation: focused direct smoke tests pass.

Observed after implementation: `node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 0 with `142 passed, 0 failed`.

### Task 3: Document, Commit, Push, And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-direct-smoke-report-trailing-slash-guard.md`

- [x] **Step 1: Document the trailing slash guard**

In the existing direct smoke `--report-json` contract, state that trailing slash file paths are rejected before network requests or report writes.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check
```

Expected: all commands exit 0.

Observed locally:

```bash
node --check scripts/external-demo-smoke.mjs && node --check test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check
```

Result: exit 0. Focused direct smoke tests `142 passed, 0 failed`; full suite `776 passed, 0 failed across 25 test file(s)`.

- [x] **Step 3: Commit and push main**

```bash
git add scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-direct-smoke-report-trailing-slash-guard.md
git commit -m "ci: reject trailing slash smoke report paths"
git push origin main
```

Observed implementation commit and push:

- Commit: `514e5dd ci: reject trailing slash smoke report paths`
- Branch: `main`
- Push target: `origin/main`

- [x] **Step 4: Verify remote QA and artifact**

Use `gh run list`, `gh run watch`, and `gh run download` for the pushed SHA. Confirm `qa-summary.json` reports read-only smoke success and no sensitive token patterns appear in the downloaded artifact.

Observed implementation remote QA:

- GitHub Actions run: `27108029509`
- Head SHA: `514e5dd1c271715ffcd2b0134726d10f9a5725fd`
- Conclusion: `success`
- Artifact: `qa-automation-27108029509`
- Artifact id: `7469013057`
- `qa-summary.json`: read-only smoke `155 passed / 0 failed`, `actualMode=readonly`, `expectedMode=readonly`, `checkCount=155`
- Sensitive artifact search: no matches for `Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|asset-secret|script-secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey`

- [ ] **Step 5: Update Obsidian**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, RED/GREEN/full QA, remote run id, artifact id, and sensitive-value search result.
