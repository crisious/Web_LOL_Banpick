# Smoke Report External URL Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `smoke:report:external:*` reject unsafe external demo URLs with the same preflight rules used by GitHub Actions manual inputs.

**Architecture:** Reuse `validateExternalSmokeUrl` from `scripts/validate-external-smoke-url.mjs` inside `scripts/run-smoke-report.mjs` for external report modes only. Keep local `readonly` / `protected` report modes unchanged so local smoke can still target `http://127.0.0.1:8123`.

**Tech Stack:** Node.js ES modules, zero-dependency script tests, existing smoke report runner.

---

### Task 1: Add RED Coverage for External Report URL Preflight

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add failing parser tests**

Add these checks after the existing `parseRunnerArgs rejects non-https external URL` assertion:

```js
  checkThrows("parseRunnerArgs rejects external readonly private URL via preflight",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-readonly", "https://10.0.0.5"], {}),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("parseRunnerArgs rejects external protected URL query via preflight",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-protected", "https://demo.example.com?token=secret"], {}),
    "external_protected_url must not include username/password, query string, or fragment");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the two new checks fail because `parseRunnerArgs` currently enforces `https://` for external modes but does not call the shared external URL preflight validator.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` produced `14 passed, 2 failed`; both new preflight checks failed because `parseRunnerArgs` did not throw.

### Task 2: Reuse External URL Validator in the Report Runner

**Files:**
- Modify: `scripts/run-smoke-report.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Import the validator**

Add this import near the existing redaction import:

```js
import { validateExternalSmokeUrl } from "./validate-external-smoke-url.mjs";
```

- [x] **Step 2: Validate external report URLs**

Add this block after the existing external `https://` protocol check:

```js
  if (isExternal) {
    validateExternalSmokeUrl(isProtected ? "external_protected_url" : "external_readonly_url", baseUrl);
  }
```

- [x] **Step 3: Update docs and test count**

Update README's `npm test` count from `622` to `624`. In README and `docs/external-demo-runbook.md`, extend the manual external URL paragraph to state that `smoke:report:external:*` uses the same preflight before launching the external smoke report.

- [x] **Step 4: Run GREEN focused tests**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: smoke report runner tests pass and report `16 passed, 0 failed`.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` produced `16 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-external-url-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, runner tests pass, full suite passes, and diff whitespace check passes. Full suite should report `624 passed, 0 failed across 24 test file(s)` after the two new checks.

Observed: `node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` passed; runner tests reported `16 passed, 0 failed`, and the full suite reported `624 passed, 0 failed across 24 test file(s)`.

- [x] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-external-url-preflight.md
git commit -m "ci: preflight external smoke report urls"
git push origin main
```

Observed: committed and pushed `cbd7f6f ci: preflight external smoke report urls` to `origin/main`.

- [x] **Step 3: Confirm remote QA and artifact**

Run:

```bash
gh run watch <run-id> --exit-status
gh run view <run-id> --json name,status,conclusion,url,headSha,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: GitHub Actions QA succeeds, read-only smoke artifact uploads, and artifact summary reports `150 passed / 0 failed`.

Observed: GitHub Actions QA run `27100794018` passed for `cbd7f6f5186a0af64cc93b46002cc3f48fa9629c`. Artifact `qa-automation-27100794018` / artifact id `7466702993` uploaded `qa-summary.json`, `2026-06-07T18-16-48Z-readonly/smoke-report.json`, and `2026-06-07T18-16-48Z-readonly/smoke-run.json`; summary reported `150 passed / 0 failed`. Sensitive-value scan across the downloaded artifact found no Authorization/Bearer/token/credential URL matches.

- [x] **Step 4: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed: Obsidian project log updated at `2026-06-08 03:17 KST`.
