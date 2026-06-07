# External Smoke IANA IPv4 Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject manual external smoke URLs whose IPv4 literal targets are IANA special-purpose ranges that are not appropriate public demo targets.

**Architecture:** Extend the existing `isReservedOrSpecialIpv4` helper in `scripts/validate-external-smoke-url.mjs`. Keep the local/private error contract and existing public IPv4 literal behavior intact, but reject remaining IANA special-purpose IPv4 examples that currently slip through. Hostname and IPv6 behavior remain unchanged.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests, GitHub Actions QA.

---

### Task 1: Add IANA IPv4 Special-Purpose Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Write failing tests**

Add these checks after the existing limited broadcast IPv4 reject check:

```js
  checkThrows("validateExternalSmokeUrl rejects IETF protocol assignment IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.0.0.8"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects PCP anycast IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.0.0.9"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects NAT64 discovery IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.0.0.170"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects AS112 IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.31.196.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects AMT IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.52.193.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects deprecated 6to4 relay IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.88.99.2"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects direct delegation AS112 IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.175.48.1"),
    "external_readonly_url must not point to a reserved or special-use network target");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the seven new IPv4 special-purpose checks fail while the existing public IPv4 literal check continues to pass.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `60 passed, 7 failed`; the seven new IANA IPv4 special-purpose checks failed while the existing public IPv4 literal check passed.

### Task 2: Reject Remaining IANA IPv4 Special-Purpose Ranges

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Extend IPv4 special-use helper**

Replace the return block in `isReservedOrSpecialIpv4` with:

```js
  return (
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 31 && c === 196) ||
    (a === 192 && b === 52 && c === 193) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 175 && c === 48) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
```

- [x] **Step 2: Document the preflight rule**

Update README and `docs/external-demo-runbook.md` manual external URL paragraphs to mention IANA special-purpose IPv4 literal targets.

- [x] **Step 3: Run GREEN validator test**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass and report `67 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `67 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-iana-ipv4-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes. Full suite should report `622 passed, 0 failed across 24 test file(s)` after the seven new checks.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` passed; validator reported `67 passed, 0 failed`, and the full suite reported `622 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-iana-ipv4-preflight.md
git commit -m "ci: reject reserved smoke ipv4 targets"
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
