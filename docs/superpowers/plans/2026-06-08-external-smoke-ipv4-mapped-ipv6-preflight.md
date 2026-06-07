# External Smoke IPv4-Mapped IPv6 Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject private/local IPv4 targets when they are encoded as IPv4-mapped IPv6 literals in manual external smoke URLs.

**Architecture:** Extend the existing `scripts/validate-external-smoke-url.mjs` host classifier. The validator already runs after Node URL normalization, so the implementation can detect normalized `::ffff:<hex>:<hex>` hostnames and reuse the existing IPv4 private/local range policy.

**Tech Stack:** Node.js ES modules, built-in `URL`, custom lightweight test scripts, GitHub Actions QA.

---

### Task 1: Add IPv4-Mapped IPv6 Validator Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Write failing tests**

Add checks inside the existing `if (fs.existsSync(validatorPath))` block after the plain IPv6 private/local checks:

```js
checkThrows("validateExternalSmokeUrl rejects IPv4-mapped loopback IPv6",
  () => validateExternalSmokeUrl("external_readonly_url", "https://[::ffff:127.0.0.1]"),
  "external_readonly_url must not point to a local or private network target");

checkThrows("validateExternalSmokeUrl rejects IPv4-mapped private IPv6",
  () => validateExternalSmokeUrl("external_readonly_url", "https://[::ffff:192.168.1.1]"),
  "external_readonly_url must not point to a local or private network target");

checkThrows("validateExternalSmokeUrl rejects IPv4-mapped carrier-grade NAT IPv6",
  () => validateExternalSmokeUrl("external_readonly_url", "https://[::ffff:100.64.0.1]"),
  "external_readonly_url must not point to a local or private network target");

check("validateExternalSmokeUrl accepts IPv4-mapped public IPv6",
  validateExternalSmokeUrl("external_readonly_url", "https://[::ffff:8.8.8.8]/path"),
  "https://[::ffff:808:808]/path");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the three private/local IPv4-mapped IPv6 reject checks fail, while the public IPv4-mapped IPv6 check passes.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `27 passed, 3 failed`; the three IPv4-mapped private/local reject checks failed and the public IPv4-mapped IPv6 check passed.

### Task 2: Detect IPv4-Mapped IPv6 Private/Local Targets

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add IPv4-mapped IPv6 helper**

Add this helper after `isPrivateOrLocalIpv4`:

```js
function mappedIpv4PartsFromIpv6(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  const match = normalized.match(/^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!match) return null;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  if (!Number.isInteger(high) || !Number.isInteger(low) || high > 0xffff || low > 0xffff) return null;
  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}
```

- [x] **Step 2: Reuse IPv4 private/local policy**

Update `isPrivateOrLocalIpv6` so IPv4-mapped IPv6 is classified before the existing prefix checks:

```js
function isPrivateOrLocalIpv6(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  const mappedIpv4Parts = mappedIpv4PartsFromIpv6(normalized);
  if (mappedIpv4Parts) {
    return isPrivateOrLocalIpv4(mappedIpv4Parts.join("."));
  }
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}
```

- [x] **Step 3: Document the preflight rule**

Update README and runbook manual external URL sections to say private/internal IP target rejection includes IPv4-mapped IPv6 literals.

Observed: README and `docs/external-demo-runbook.md` now mention IPv4-mapped IPv6 private/internal targets in manual external smoke URL preflight.

- [x] **Step 4: Run GREEN test**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: all validator tests pass.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `30 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-ipv4-mapped-ipv6-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full test suite passes, and diff whitespace check passes.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0; validator tests reported `30 passed, 0 failed` and full suite reported `584 passed, 0 failed across 24 test file(s)`.

- [x] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-ipv4-mapped-ipv6-preflight.md
git commit -m "ci: reject mapped private smoke targets"
git push origin main
```

Observed: committed `701585a ci: reject mapped private smoke targets` and pushed to `origin/main`.

- [x] **Step 3: Confirm remote QA and artifact**

Run:

```bash
gh run watch <run-id> --exit-status
gh run view <run-id> --json name,status,conclusion,url,headSha,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: GitHub Actions QA succeeds, read-only smoke artifact uploads, and artifact summary reports `150 passed / 0 failed`.

Observed: GitHub Actions run `27099315724` succeeded for `701585a`; artifact `qa-automation-27099315724` uploaded as artifact id `7466249774`, expires `2026-06-21T17:13:45Z`. Downloaded artifact contained `qa-summary.json`, `2026-06-07T17-13-44Z-readonly/smoke-report.json`, and `2026-06-07T17-13-44Z-readonly/smoke-run.json`; `qa-summary.json` reported `150 passed / 0 failed`. Sensitive-value search for `Authorization`, `Bearer`, non-empty `PUBLIC_DEMO_TOKEN`, non-empty external URL env, `access_token=`, `token=secret`, and `user:pass@` returned no matches.

- [x] **Step 4: Update Obsidian project log**

Append a QA log under `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` before `## 리스크 관리` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed: Obsidian project note updated with `584 passed / 0 failed`, run `27099315724`, artifact `7466249774`, and sensitive-value search result.
