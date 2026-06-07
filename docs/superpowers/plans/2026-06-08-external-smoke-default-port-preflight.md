# External Smoke Default HTTPS Port Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject explicit non-default ports in external smoke URLs so manual/public smoke evidence only targets normal HTTPS endpoints.

**Architecture:** Extend `scripts/validate-external-smoke-url.mjs` after protocol/userinfo/query/fragment validation to reject parsed URLs whose `port` field is non-empty. Keep plain `https://demo.example.com/path` and explicit default `:443` behavior aligned with WHATWG URL normalization. Update focused validator coverage and external demo documentation.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests.

---

### Task 1: Add RED Coverage for Explicit Non-Default Ports

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add failing validator tests**

Add these checks after the existing trimmed URL accept check:

```js
  check("validateExternalSmokeUrl accepts explicit default HTTPS port",
    validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com:443/path"),
    "https://demo.example.com/path");

  checkThrows("validateExternalSmokeUrl rejects explicit non-default HTTPS port",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com:4443/path"),
    "external_readonly_url must use the default HTTPS port");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the explicit default `:443` check passes because `URL` normalizes it away, and the non-default `:4443` check fails because the validator currently allows parsed ports.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `70 passed, 1 failed`; explicit `:443` passed and explicit `:4443` failed because no error was thrown.

### Task 2: Reject Non-Default HTTPS Ports

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add non-default port guard**

Add this block in `validateExternalSmokeUrl` after the username/password/query/fragment guard:

```js
  if (parsed.port) {
    throw new Error(`${safeLabel} must use the default HTTPS port`);
  }
```

- [x] **Step 2: Update docs and test count**

Update README's `npm test` count from `630` to `632`. In README and `docs/external-demo-runbook.md`, update the manual external URL paragraph to state that explicit non-default ports are rejected.

- [x] **Step 3: Run GREEN focused tests**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass and report `71 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `71 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-default-port-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes. Full suite should report `632 passed, 0 failed across 24 test file(s)` after the two new checks.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Focused validator tests reported `71 passed, 0 failed`; full suite reported `632 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-default-port-preflight.md
git commit -m "ci: reject nondefault smoke url ports"
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
