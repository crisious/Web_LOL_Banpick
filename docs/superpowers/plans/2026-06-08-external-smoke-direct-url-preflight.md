# External Smoke Direct URL Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make direct `smoke:external:*` and external manifest smoke commands reject unsafe external demo URLs before any network request.

**Architecture:** Reuse `validateExternalSmokeUrl` inside `scripts/external-demo-smoke.mjs` when the caller requests an explicit HTTPS URL (`--require-url --require-https`). Keep local smoke and ad-hoc local HTTP smoke unchanged. The parser receives the validator as a small dependency so the existing source-extraction tests can exercise parsing without executing the whole CLI, while CLI tests verify the real import path.

**Tech Stack:** Node.js ES modules, zero-dependency CLI tests, existing external demo smoke scripts.

---

### Task 1: Add RED Coverage for Direct External Smoke URL Preflight

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Import the shared validator in the test**

Add this after `smokeSrc`:

```js
const { validateExternalSmokeUrl } = await import(new URL("../../scripts/validate-external-smoke-url.mjs", import.meta.url));
const preflightDeps = { validateExternalUrl: validateExternalSmokeUrl };
```

- [x] **Step 2: Add parser preflight tests**

Add these checks after `parseSmokeArgs accepts https when required`:

```js
checkThrows("parseSmokeArgs rejects required external private URL via preflight",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-url", "--require-https", "https://10.0.0.5", "--expect-mode=readonly"], {}, preflightDeps),
  "external_readonly_url must not point to a local or private network target");

checkThrows("parseSmokeArgs rejects required external URL query via preflight",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-url", "--require-https", "https://demo.example.com?token=secret", "--expect-mode=protected"], {}, preflightDeps),
  "external_protected_url must not include username/password, query string, or fragment");
```

- [x] **Step 3: Add CLI preflight tests**

Add this after the existing non-HTTPS CLI failure checks:

```js
const privateRequiredExternalUrl = spawnSync(process.execPath, [
  smokePath,
  "--require-url",
  "--require-https",
  "--expect-mode=readonly",
  "https://10.0.0.5",
], {
  encoding: "utf8",
});

check("CLI exits non-zero when required external URL is private",
  privateRequiredExternalUrl.status,
  1);

check("CLI prints concise private external URL failure without stack trace",
  privateRequiredExternalUrl.stderr.trim(),
  "FAIL external_readonly_url must not point to a local or private network target");
```

- [x] **Step 4: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the parser preflight checks fail because `parseSmokeArgs` does not accept or call the validator dependency yet, and the CLI private URL check exits with a network-level failure or another non-preflight message instead of the concise shared preflight message.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` produced `97 passed, 3 failed`; parser preflight checks did not throw, and the private URL CLI case timed out on `/healthz` instead of failing at preflight.

### Task 2: Reuse External URL Validator in Direct Smoke

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Import the validator**

Add this import near the redaction import:

```js
import { validateExternalSmokeUrl } from "./validate-external-smoke-url.mjs";
```

- [x] **Step 2: Add parser dependency and preflight call**

Change the function signature and add this block after the HTTPS protocol check:

```js
function parseSmokeArgs(argv, env = {}, deps = {}) {
```

```js
  if (requireUrl && requireHttps) {
    const modeForLabel = args.find((arg) => arg.startsWith("--expect-mode="))?.slice("--expect-mode=".length).trim().toLowerCase();
    deps.validateExternalUrl?.(modeForLabel === "protected" ? "external_protected_url" : "external_readonly_url", baseUrl);
  }
```

- [x] **Step 3: Wire the real validator into CLI parsing**

Change the top-level parse call to:

```js
  parsedArgs = parseSmokeArgs(process.argv, process.env, { validateExternalUrl: validateExternalSmokeUrl });
```

- [x] **Step 4: Update docs and test count**

Update README's `npm test` count from `624` to `628`. In README and `docs/external-demo-runbook.md`, update the manual external URL paragraph to state that both direct `smoke:external:*` and report `smoke:report:external:*` commands share the same preflight.

- [x] **Step 5: Run GREEN focused tests**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: external demo smoke tests pass and report `100 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` produced `100 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-direct-url-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, focused smoke tests pass, full suite passes, and diff whitespace check passes. Full suite should report `628 passed, 0 failed across 24 test file(s)` after the four new checks.

Observed: `node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check` passed; focused external smoke tests reported `100 passed, 0 failed`, and the full suite reported `628 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-direct-url-preflight.md
git commit -m "ci: preflight direct external smoke urls"
git push origin main
```

- [ ] **Step 3: Confirm remote QA and artifact**

Run:

```bash
gh run watch <run-id> --exit-status
gh run view <run-id> --json name,status,conclusion,url,headSha,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: GitHub Actions QA succeeds, read-only smoke artifact uploads, and artifact summary reports `150 passed / 0 failed`.

- [ ] **Step 4: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.
