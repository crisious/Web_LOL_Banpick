# Smoke Report Check Evidence Redaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent direct smoke check labels and details from persisting asset or probe URL query/fragment secrets in `smoke-report.json`.

**Architecture:** Keep request behavior unchanged, but sanitize evidence strings before they are printed or stored in report checks. Reuse `redactUrlForEvidence()` for absolute HTTP(S) URLs and add a small direct-smoke helper for relative URL/path fragments such as `/styles.css?token=...`.

**Tech Stack:** Node.js ESM scripts, zero-dependency CLI smoke tests, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Coverage For Check Label Evidence Redaction

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Write a failing report fixture**

Add a direct smoke fixture that serves a valid read-only demo whose `index.html` references assets with query secrets:

```js
const assetEvidenceReportPath = path.join(reportDir, "asset-evidence", "smoke.json");
const assetEvidenceServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?asset_token=asset-secret">
      <script src="./main.js?script_token=script-secret"></script>
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
    `);
    return;
  }
  if (req.url === "/styles.css?asset_token=asset-secret") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    res.end("body { color: #111; }");
    return;
  }
  if (req.url === "/main.js?script_token=script-secret") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    res.end("window.__smoke = true;");
    return;
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { ok: false, code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { ok: false, error: "not found" });
});
```

Run direct smoke with `--report-json=<assetEvidenceReportPath>` and assert:

```js
check("passed smoke report redacts asset query secrets from checks",
  !JSON.stringify(assetEvidenceReport).includes("asset-secret") &&
    !JSON.stringify(assetEvidenceReport).includes("script-secret"),
  true);

check("passed smoke report keeps redacted asset query markers",
  JSON.stringify(assetEvidenceReport).includes("/styles.css?redacted") &&
    JSON.stringify(assetEvidenceReport).includes("/main.js?redacted"),
  true);
```

- [x] **Step 2: Run RED test**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the new asset query checks fail because direct smoke currently records raw query strings inside check labels.

Observed:

`node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 1 with `131 passed, 2 failed`. The new asset evidence report fixture succeeded, but `smoke-report.json` still contained `asset-secret` / `script-secret` in check labels and did not include `/styles.css?redacted` or `/main.js?redacted`.

### Task 2: Redact Direct Smoke Evidence Text

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`

- [x] **Step 1: Add a report evidence text redactor**

Add a helper near the existing runtime helpers:

```js
function redactRelativeUrlEvidence(rawPath) {
  const firstQuery = rawPath.indexOf("?");
  const firstHash = rawPath.indexOf("#");
  const firstMarker = [firstQuery, firstHash].filter((idx) => idx >= 0).sort((a, b) => a - b)[0];
  if (firstMarker === undefined) return rawPath;
  const pathOnly = rawPath.slice(0, firstMarker);
  return `${pathOnly}${firstQuery >= 0 ? "?redacted" : ""}${firstHash >= 0 ? "#redacted" : ""}`;
}

function redactEvidenceText(value) {
  return String(value)
    .replace(/https?:\/\/[^\s"'<>]+/g, (match) => redactUrlForEvidence(match))
    .replace(/(^|[\s"'`(])((?:\/|\.\.?\/)[^\s"'`<>]*[?#][^\s"'`<>]*)/g, (_match, prefix, rawPath) => {
      return `${prefix}${redactRelativeUrlEvidence(rawPath)}`;
    });
}
```

- [x] **Step 2: Store and print redacted check labels/details**

Update `pass()`, `fail()`, and `recordCheck()` so report checks and console lines use the redacted label/detail:

```js
function pass(label) {
  const safeLabel = redactEvidenceText(label);
  recordCheck("pass", safeLabel);
  console.log(`PASS ${safeLabel}`);
}

function fail(label, detail) {
  const safeLabel = redactEvidenceText(label);
  const safeDetail = detail ? redactEvidenceText(detail) : "";
  recordCheck("fail", safeLabel, safeDetail);
  console.error(`FAIL ${safeLabel}`);
  if (safeDetail) console.error(`  ${safeDetail}`);
  process.exitCode = 1;
}
```

Keep actual `request()` paths unchanged.

- [x] **Step 3: Run focused GREEN test**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: external demo smoke tests pass and the new report fixture stores redacted asset query markers instead of raw query secrets.

Observed:

`node test-artifacts/scripts/external-demo-smoke-tests.mjs` exited 0 with `133 passed, 0 failed`. The asset evidence report fixture no longer included `asset-secret` / `script-secret`, and it recorded `/styles.css?redacted` plus `/main.js?redacted` in check labels.

### Task 3: Document, Verify, And Publish

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-check-evidence-redaction.md`

- [x] **Step 1: Document report check evidence redaction**

Extend the report JSON documentation to say check labels and details also redact URL userinfo/query/fragment values, including relative asset paths.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check
```

Expected: command exits 0, focused direct smoke tests pass, full suite passes, and diff check has no output.

Observed:

`node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check` exited 0. Focused direct smoke tests reported `133 passed, 0 failed`; the full npm suite reported `763 passed, 0 failed across 25 test file(s)`; `git diff --check` produced no output.

- [x] **Step 3: Commit and push**

Run:

```bash
git add scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-check-evidence-redaction.md
git commit -m "ci: redact smoke report check evidence"
git push origin main
```

Expected: commit lands on `main` and pushes to `origin/main`.

Observed:

Commit `9370f82` (`ci: redact smoke report check evidence`) landed on `main` and pushed to `origin/main`.

- [x] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 6
gh run watch <run-id> --exit-status
gh run view <run-id> --json conclusion,headSha,status,url,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Download `qa-automation-<run-id>`, inspect `qa-summary.json`, and scan for sensitive values.

Expected: latest run for the pushed head SHA succeeds, uploaded artifact contains `qa-summary.json`, read-only smoke reports zero failures, and sensitive-value search has no matches.

Observed:

GitHub Actions QA run `27107361569` completed successfully for head SHA `9370f82f0bda952597f679be0ebdcfc03102183f`. Artifact `qa-automation-27107361569` (`7468811054`) was downloaded and inspected. `qa-summary.json` recorded read-only smoke status `passed`, `actualMode=readonly`, `expectedMode=readonly`, and `155 passed, 0 failed`; `smoke-report.json` matched that summary with `checkCount=155`. Sensitive-value scan across the downloaded artifact, including `asset-secret` and `script-secret`, produced no matches.

- [ ] **Step 5: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed:
