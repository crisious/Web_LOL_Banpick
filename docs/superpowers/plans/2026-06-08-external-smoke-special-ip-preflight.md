# External Smoke Special IP Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject manual external smoke URLs whose IP literal targets are reserved, documentation-only, benchmarking, multicast, or otherwise special-use rather than publicly routable demo targets.

**Architecture:** Extend `scripts/validate-external-smoke-url.mjs` after the existing local/private network check. Keep the existing local/private error contract intact, then add a separate special-use IP literal check so invalid public-looking literals fail before smoke networking starts. Hostname validation remains unchanged.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests, GitHub Actions QA.

---

### Task 1: Add Special-Use IP Literal Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Write failing tests**

Add these checks after the existing carrier-grade NAT IPv4 reject check and around the IPv6 reject checks:

```js
  checkThrows("validateExternalSmokeUrl rejects documentation IPv4 TEST-NET-1",
    () => validateExternalSmokeUrl("external_readonly_url", "https://192.0.2.10"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects documentation IPv4 TEST-NET-2",
    () => validateExternalSmokeUrl("external_readonly_url", "https://198.51.100.10"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects documentation IPv4 TEST-NET-3",
    () => validateExternalSmokeUrl("external_readonly_url", "https://203.0.113.10"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects benchmarking IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://198.18.0.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects multicast IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://224.0.0.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects reserved IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://240.0.0.1"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects limited broadcast IPv4",
    () => validateExternalSmokeUrl("external_readonly_url", "https://255.255.255.255"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects documentation IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[2001:db8::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects benchmarking IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[2001:2::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects multicast IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[ff02::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects IPv4-mapped documentation IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[::ffff:203.0.113.10]"),
    "external_readonly_url must not point to a reserved or special-use network target");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the eleven special-use IP literal checks fail while existing public IPv4, public IPv6, and IPv4-mapped public IPv6 checks continue to pass.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `40 passed, 11 failed`; the eleven new special-use IP literal checks failed while existing public IPv4, public IPv6, and IPv4-mapped public IPv6 checks passed.

### Task 2: Reject Special-Use IP Literal Targets

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add IPv4 special-use helper**

Add this helper after `isPrivateOrLocalIpv4`:

```js
function isReservedOrSpecialIpv4(host) {
  const parts = ipv4Parts(host);
  if (!parts) return false;
  const [a, b, c] = parts;
  return (
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}
```

- [x] **Step 2: Add IPv6 and IP literal special-use helpers**

Add these helpers after `isPrivateOrLocalIpv6`:

```js
function isReservedOrSpecialIpv6(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  const mappedIpv4Parts = mappedIpv4PartsFromIpv6(normalized);
  if (mappedIpv4Parts) {
    return isReservedOrSpecialIpv4(mappedIpv4Parts.join("."));
  }
  return (
    normalized.startsWith("2001:2:") ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("ff")
  );
}

function isReservedOrSpecialIpLiteralHost(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (ipv4Parts(host)) return isReservedOrSpecialIpv4(host);
  if (!normalized.includes(":")) return false;
  return isReservedOrSpecialIpv6(normalized);
}
```

- [x] **Step 3: Reject special-use IP literal targets**

Add this check after the existing `isLocalOrPrivateHost(host)` block:

```js
  if (isReservedOrSpecialIpLiteralHost(host)) {
    throw new Error(`${safeLabel} must not point to a reserved or special-use network target`);
  }
```

- [x] **Step 4: Document the preflight rule**

Update README and `docs/external-demo-runbook.md` manual external URL paragraphs to say IP literals must be publicly routable and that documentation, benchmarking, multicast, and reserved/special-use IP literal targets are rejected.

Observed: README and `docs/external-demo-runbook.md` now document publicly routable IP literal requirements and reject documentation/benchmarking/multicast/reserved/special-use IP literals.

- [x] **Step 5: Run GREEN validator test**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass and report `51 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `51 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-special-ip-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes. Full suite should report `606 passed, 0 failed across 24 test file(s)` after the eleven new checks.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` passed; validator tests reported `51 passed, 0 failed`, full suite reported `606 passed, 0 failed across 24 test file(s)`, and diff whitespace check passed.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-special-ip-preflight.md
git commit -m "ci: reject special-use smoke ip targets"
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
