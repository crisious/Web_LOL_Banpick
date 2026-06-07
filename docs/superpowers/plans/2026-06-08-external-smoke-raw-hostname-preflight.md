# External Smoke Raw Hostname Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject external smoke URLs whose raw DNS hostname spelling is normalized by the WHATWG URL parser before validation.

**Architecture:** Reuse the existing `rawHostFromUrlValue(value)` extraction and validate DNS hostnames before relying on the parsed hostname. For DNS hostnames, require the raw host labels to already be DNS-compatible ASCII labels; this rejects Unicode, fullwidth, percent-encoded, underscore, empty, edge-hyphen, and overlong raw labels. Keep canonical public IPv4, public IPv6, and explicit punycode `xn--...` hostnames working as before.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests.

---

### Task 1: Add RED Coverage for Raw Hostname Normalization

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add failing validator tests**

Add these checks near the existing DNS hostname label tests:

```js
  checkThrows("validateExternalSmokeUrl rejects Unicode hostname label",
    () => validateExternalSmokeUrl("external_readonly_url", "https://bücher.example"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects Unicode TLD label",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.例子"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects percent-encoded hostname label",
    () => validateExternalSmokeUrl("external_readonly_url", "https://%65xample.com"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects fullwidth hostname label",
    () => validateExternalSmokeUrl("external_readonly_url", "https://ｅxample.com"),
    "external_readonly_url must use DNS-compatible public hostname labels");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the four new checks fail because `new URL()` normalizes Unicode/fullwidth hostnames to punycode or ASCII and percent-encoded hostnames to ASCII before the current validator inspects `parsed.hostname`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `84 passed, 4 failed`; the four raw hostname normalization checks failed because no error was thrown.

### Task 2: Reject Raw DNS Hostnames That Need Parser Normalization

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add raw DNS hostname compatibility helper**

Add this helper near `isDnsCompatibleHostname`:

```js
function isDnsHostnameRawHostCompatible(rawHost) {
  return !isIpLiteralHost(rawHost) && isDnsCompatibleHostname(rawHost);
}
```

- [x] **Step 2: Add raw hostname guard**

Add this block in `validateExternalSmokeUrl` after `const rawHost = rawHostFromUrlValue(value);` and after the canonical IPv4 guard:

```js
  if (!isIpLiteralHost(host) && !isDnsHostnameRawHostCompatible(rawHost)) {
    throw new Error(`${safeLabel} must use DNS-compatible public hostname labels`);
  }
```

Keep the existing parsed-host `isDnsCompatibleHostname(host)` guard so parser output is still checked independently.

- [x] **Step 3: Update docs and test count**

Update README's `npm test` count from `645` to `649`. In README and `docs/external-demo-runbook.md`, update the manual external URL paragraph to state that raw DNS hostname labels must already be ASCII letters/digits/hyphen, while explicit punycode labels are allowed.

- [x] **Step 4: Run GREEN focused tests**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass and report `88 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `88 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-raw-hostname-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes. Full suite should report `649 passed, 0 failed across 24 test file(s)` after the four new checks.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Validator tests reported `88 passed, 0 failed`; full suite reported `649 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-raw-hostname-preflight.md
git commit -m "ci: reject normalized smoke hostnames"
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
