# External Smoke Single-Label Host Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject manual external smoke URLs that use single-label DNS hostnames such as `https://demo`.

**Architecture:** Extend `scripts/validate-external-smoke-url.mjs` after the existing local/private target check. Hostnames must be either fully qualified DNS names containing a dot or public IP literals; public IPv4/IPv6 literals remain allowed, while single-label DNS names fail fast with a concise validator error.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests, GitHub Actions QA.

---

### Task 1: Add Single-Label Host Validator Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Write failing tests**

Add these checks after the existing `.localhost` reject test and before the private IP tests:

```js
  checkThrows("validateExternalSmokeUrl rejects single-label hostname",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo/path"),
    "external_readonly_url must use a fully qualified public hostname or IP address");

  check("validateExternalSmokeUrl accepts public IPv4 literal",
    validateExternalSmokeUrl("external_readonly_url", "https://8.8.8.8/path"),
    "https://8.8.8.8/path");

  check("validateExternalSmokeUrl accepts public IPv6 literal",
    validateExternalSmokeUrl("external_readonly_url", "https://[2001:4860:4860::8888]/path"),
    "https://[2001:4860:4860::8888]/path");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the new single-label hostname reject check fails; public IPv4/IPv6 literal checks pass.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `32 passed, 1 failed`; only the single-label hostname reject check failed, while public IPv4/IPv6 literal checks passed.

### Task 2: Reject Single-Label DNS Hostnames

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add host classification helpers**

Add these helpers after `isPrivateOrLocalIpv6`:

```js
function isIpLiteralHost(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  return Boolean(ipv4Parts(host)) || normalized.includes(":");
}

function isSingleLabelHostname(host) {
  return !isIpLiteralHost(host) && !host.includes(".");
}
```

- [x] **Step 2: Reject single-label hostnames in validator**

Add this check after the existing `isLocalOrPrivateHost(host)` block:

```js
  if (isSingleLabelHostname(host)) {
    throw new Error(`${safeLabel} must use a fully qualified public hostname or IP address`);
  }
```

- [x] **Step 3: Document the preflight rule**

Update README and `docs/external-demo-runbook.md` manual external URL paragraphs to say single-label hostnames are rejected and public FQDN or public IP literal targets are required.

Observed: README and `docs/external-demo-runbook.md` now document that manual external URLs require a public FQDN or public IP literal and reject single-label hostnames.

- [x] **Step 4: Run GREEN validator test**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `33 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-single-label-host-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0; validator tests reported `33 passed, 0 failed` and full suite reported `588 passed, 0 failed across 24 test file(s)`.

- [x] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-single-label-host-preflight.md
git commit -m "ci: reject single-label smoke hosts"
git push origin main
```

Observed: committed `a8741ea ci: reject single-label smoke hosts` and pushed to `origin/main`.

- [x] **Step 3: Confirm remote QA and artifact**

Run:

```bash
gh run watch <run-id> --exit-status
gh run view <run-id> --json name,status,conclusion,url,headSha,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: GitHub Actions QA succeeds, read-only smoke artifact uploads, and artifact summary reports `150 passed / 0 failed`.

Observed: GitHub Actions run `27099734530` succeeded for `a8741ea`; artifact `qa-automation-27099734530` uploaded as artifact id `7466378297`, expires `2026-06-21T17:31:49Z`. Downloaded artifact contained `qa-summary.json`, `2026-06-07T17-31-48Z-readonly/smoke-report.json`, and `2026-06-07T17-31-48Z-readonly/smoke-run.json`; `qa-summary.json` reported `150 passed / 0 failed`. Sensitive-value search for `Authorization`, `Bearer`, non-empty `PUBLIC_DEMO_TOKEN`, non-empty external URL env, `access_token=`, `token=secret`, and `user:pass@` returned no matches.

- [x] **Step 4: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed: Obsidian project note updated with `588 passed / 0 failed`, run `27099734530`, artifact `7466378297`, and sensitive-value search result.
