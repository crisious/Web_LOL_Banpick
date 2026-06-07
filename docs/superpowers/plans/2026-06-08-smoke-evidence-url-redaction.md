# Smoke Evidence URL Redaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent smoke report artifacts and QA summaries from storing sensitive URL userinfo, query strings, or fragments while preserving the original URL for network requests.

**Architecture:** Add a small redaction helper shared by `scripts/external-demo-smoke.mjs` and `scripts/run-smoke-report.mjs`. The smoke scripts continue to request the original `baseUrl`, but all persisted evidence fields and persisted command metadata use the redacted URL.

**Tech Stack:** Node 20 ESM, existing zero-dependency smoke CLI tests, existing smoke report runner tests.

---

### Task 1: External Smoke Report Redaction Contract

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `scripts/external-demo-smoke.mjs`
- Create: `lib/qa-evidence-redaction.mjs`

- [x] **Step 1: Write failing report JSON test**

Update the existing passed report fixture URL so it includes URL-only secret material:

```js
const sampleListReportInputUrl = `${sampleListReportUrl}/?access_token=report-secret#report-secret-fragment`;
```

Pass `sampleListReportInputUrl` to the CLI and add:

```js
check("passed smoke report redacts base URL query and fragment",
  JSON.stringify(passedReport).includes("report-secret"),
  false);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: fails because `smoke-report.json` currently writes raw `baseUrl`.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` failed only on `passed smoke report redacts base URL query and fragment`; the report JSON still included `report-secret`.

- [x] **Step 3: Implement report redaction**

Create `lib/qa-evidence-redaction.mjs`:

```js
export function redactUrlForEvidence(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    parsed.username = "";
    parsed.password = "";
    if (parsed.search) parsed.search = "?redacted";
    if (parsed.hash) parsed.hash = "#redacted";
    return parsed.toString();
  } catch {
    return "<redacted-invalid-url>";
  }
}
```

Import it in `scripts/external-demo-smoke.mjs` and use `redactUrlForEvidence(baseUrl)` for the persisted `baseUrl` field in `writeReport()`.

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: all external smoke tests pass.

Observed: external smoke tests reported 96 passed / 0 failed after using `redactUrlForEvidence(baseUrl)` for persisted report evidence.

### Task 2: Smoke Runner Evidence Redaction

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Write failing runner tests**

Add a `redactSmokeArgs` case with URL credentials/query/fragment:

```js
check("redactSmokeArgs removes URL credentials, query, and fragment",
  runner.redactSmokeArgs([
    "scripts/external-demo-smoke.mjs",
    "https://user:pass@demo.example/path?access_token=secret#secret",
  ]),
  [
    "scripts/external-demo-smoke.mjs",
    "https://demo.example/path?redacted#redacted",
  ]);
```

Add a `buildQaSummary` case that expects `latestRun.baseUrl` to be redacted for a sensitive external URL.

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: fails because runner metadata and summary currently preserve raw URL material.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` failed on raw URL command metadata and `latestRun.baseUrl`; sensitive URL material remained in the summary.

- [x] **Step 3: Implement runner redaction**

Import `redactUrlForEvidence` in `scripts/run-smoke-report.mjs`.

Use it in:

```js
export function redactSmokeArgs(args) {
  return args.map((arg) => {
    if (arg.startsWith("--token=")) return "--token=<redacted>";
    if (/^https?:\/\//.test(arg)) return redactUrlForEvidence(arg);
    return arg;
  });
}
```

Use `redactUrlForEvidence(config.baseUrl)` for `latestRun.baseUrl` in `buildQaSummary()` and for `baseUrl` in `smoke-run.json` metadata.

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: all smoke runner tests pass.

Observed: smoke report runner tests reported 14 passed / 0 failed, and external smoke tests still reported 96 passed / 0 failed.

### Task 3: Docs, QA, Push

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document redacted evidence behavior**

Document that smoke artifacts redact URL credentials, query strings, and fragments, while still using the original URL for the request.

Observed: `README.md` and `docs/external-demo-runbook.md` now document that smoke requests use the original URL while persisted report evidence redacts URL userinfo, query strings, and fragments.

- [x] **Step 2: Run full verification**

Run:

```bash
node --check lib/qa-evidence-redaction.mjs
node --check scripts/external-demo-smoke.mjs
node --check scripts/run-smoke-report.mjs
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0.

Observed: syntax checks exited 0, external smoke tests reported 96 passed / 0 failed, smoke report runner tests reported 14 passed / 0 failed, `npm test` reported 550 passed / 0 failed across 23 test files, and `git diff --check` exited 0.

- [ ] **Step 3: Commit, push, and verify remote QA**

Run:

```bash
git add lib/qa-evidence-redaction.mjs scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-evidence-url-redaction.md
git commit -m "chore: redact smoke evidence urls"
git push origin main
gh run watch <run-id> --exit-status
```

Expected: push-triggered `QA` passes and artifact URL/token sensitive-pattern searches find no matches.
