# External Smoke IANA IPv6 Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject manual external smoke URLs whose IPv6 literal targets are IANA special-purpose or reserved global-unicast ranges that are not reliable public demo targets.

**Architecture:** Replace the current ad hoc IPv6 string-prefix checks inside `scripts/validate-external-smoke-url.mjs` with a small IPv6 hextet parser and prefix matcher used only by the special-use IP literal preflight. Keep the existing local/private error contract and the existing IPv4/IPv4-mapped public behavior intact. Add tests for IANA special-purpose IPv6 ranges and IANA reserved global-unicast examples that currently slip through.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests, GitHub Actions QA.

---

### Task 1: Add IANA IPv6 Special/Reserved Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Write failing tests**

Add these checks after the existing multicast IPv6 reject check:

```js
  checkThrows("validateExternalSmokeUrl rejects discard-only IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[100::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects dummy IPv6 prefix",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[100:0:0:1::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects local-use translation IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[64:ff9b:1::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects deprecated ORCHID IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[2001:10::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects 6to4 IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[2002::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects SRv6 SID IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[5f00::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects 6bone returned IPv6",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[3ffe::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects new documentation IPv6 block",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[3fff::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");

  checkThrows("validateExternalSmokeUrl rejects IANA reserved IPv6 global-unicast block",
    () => validateExternalSmokeUrl("external_readonly_url", "https://[3000::1]"),
    "external_readonly_url must not point to a reserved or special-use network target");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the nine new IPv6 special/reserved checks fail while the existing public IPv6 and IPv4-mapped public IPv6 checks continue to pass.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `51 passed, 9 failed`; the nine new IANA IPv6 special/reserved checks failed while the existing public IPv6 and IPv4-mapped public IPv6 checks passed.

### Task 2: Add Precise IPv6 Prefix Matching

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add IPv6 parser and prefix matcher**

Add these helpers after `mappedIpv4PartsFromIpv6`:

```js
function ipv6Hextets(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!normalized.includes(":")) return null;
  const compressedParts = normalized.split("::");
  if (compressedParts.length > 2) return null;
  const head = compressedParts[0] ? compressedParts[0].split(":") : [];
  const tail = compressedParts.length === 2 && compressedParts[1] ? compressedParts[1].split(":") : [];
  const missingCount = compressedParts.length === 2 ? 8 - head.length - tail.length : 0;
  if (missingCount < 0 || (compressedParts.length === 1 && head.length !== 8)) return null;
  const labels = [...head, ...Array(missingCount).fill("0"), ...tail];
  if (labels.length !== 8) return null;
  const hextets = labels.map((label) => {
    if (!/^[0-9a-f]{1,4}$/.test(label)) return null;
    return Number.parseInt(label, 16);
  });
  return hextets.every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffff) ? hextets : null;
}

function ipv6PrefixMatches(hextets, prefix, prefixLength) {
  let remainingBits = prefixLength;
  for (let index = 0; remainingBits > 0; index++) {
    const bits = Math.min(remainingBits, 16);
    const mask = bits === 16 ? 0xffff : (0xffff << (16 - bits)) & 0xffff;
    if ((hextets[index] & mask) !== (prefix[index] & mask)) return false;
    remainingBits -= bits;
  }
  return true;
}
```

- [x] **Step 2: Replace special IPv6 string-prefix checks with prefix lists**

Replace the non-mapped return block in `isReservedOrSpecialIpv6` with:

```js
  const hextets = ipv6Hextets(normalized);
  if (!hextets) return false;
  const specialPrefixes = [
    [[0x0064, 0xff9b, 0x0001, 0, 0, 0, 0, 0], 48],
    [[0x0100, 0, 0, 0, 0, 0, 0, 0], 64],
    [[0x0100, 0, 0, 1, 0, 0, 0, 0], 64],
    [[0x2001, 0x0002, 0, 0, 0, 0, 0, 0], 48],
    [[0x2001, 0x0010, 0, 0, 0, 0, 0, 0], 28],
    [[0x2001, 0x0db8, 0, 0, 0, 0, 0, 0], 32],
    [[0x2002, 0, 0, 0, 0, 0, 0, 0], 16],
    [[0x3fff, 0, 0, 0, 0, 0, 0, 0], 20],
    [[0x5f00, 0, 0, 0, 0, 0, 0, 0], 16],
    [[0xff00, 0, 0, 0, 0, 0, 0, 0], 8],
  ];
  const reservedGlobalUnicastPrefixes = [
    [[0x2d00, 0, 0, 0, 0, 0, 0, 0], 8],
    [[0x2e00, 0, 0, 0, 0, 0, 0, 0], 7],
    [[0x3000, 0, 0, 0, 0, 0, 0, 0], 5],
    [[0x3800, 0, 0, 0, 0, 0, 0, 0], 6],
    [[0x3c00, 0, 0, 0, 0, 0, 0, 0], 7],
    [[0x3e00, 0, 0, 0, 0, 0, 0, 0], 8],
    [[0x3f00, 0, 0, 0, 0, 0, 0, 0], 9],
    [[0x3f80, 0, 0, 0, 0, 0, 0, 0], 10],
    [[0x3fc0, 0, 0, 0, 0, 0, 0, 0], 11],
    [[0x3fe0, 0, 0, 0, 0, 0, 0, 0], 12],
    [[0x3ff0, 0, 0, 0, 0, 0, 0, 0], 13],
    [[0x3ff8, 0, 0, 0, 0, 0, 0, 0], 14],
    [[0x3ffc, 0, 0, 0, 0, 0, 0, 0], 15],
    [[0x3ffe, 0, 0, 0, 0, 0, 0, 0], 16],
  ];
  return [...specialPrefixes, ...reservedGlobalUnicastPrefixes].some(
    ([prefix, prefixLength]) => ipv6PrefixMatches(hextets, prefix, prefixLength)
  );
```

- [x] **Step 3: Document the preflight rule**

Update README and `docs/external-demo-runbook.md` manual external URL paragraphs to mention IANA special-purpose/reserved IPv6 literal targets.

Observed: README and `docs/external-demo-runbook.md` now mention IANA special-purpose/reserved IPv6 literal targets, and README's full test count was updated to `615`.

- [x] **Step 4: Run GREEN validator test**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass and report `60 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `60 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-iana-ipv6-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes. Full suite should report `615 passed, 0 failed across 24 test file(s)` after the nine new checks.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` passed; validator tests reported `60 passed, 0 failed`, full suite reported `615 passed, 0 failed across 24 test file(s)`, and diff whitespace check passed.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-iana-ipv6-preflight.md
git commit -m "ci: reject reserved smoke ipv6 targets"
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
