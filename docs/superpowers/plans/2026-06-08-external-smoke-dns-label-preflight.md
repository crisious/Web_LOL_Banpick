# External Smoke DNS Label Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject manual external smoke URLs whose DNS hostname labels are not public-DNS compatible.

**Architecture:** Extend `scripts/validate-external-smoke-url.mjs` after the existing local/private/single-label checks. The new rule applies only to DNS hostnames, not IP literals; it rejects empty labels, underscores, labels that start or end with hyphen, overlong labels, and overlong hostnames with one concise error.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests, GitHub Actions QA.

---

### Task 1: Add DNS Label Validator Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Write failing tests**

Add these checks after the single-label hostname reject test:

```js
  checkThrows("validateExternalSmokeUrl rejects hostname label underscore",
    () => validateExternalSmokeUrl("external_readonly_url", "https://bad_host.example.com/path"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects hostname label leading hyphen",
    () => validateExternalSmokeUrl("external_readonly_url", "https://-demo.example.com/path"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects hostname label trailing hyphen",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo-.example.com/path"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects empty hostname label",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo..example.com/path"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  checkThrows("validateExternalSmokeUrl rejects trailing root dot",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com./path"),
    "external_readonly_url must use DNS-compatible public hostname labels");

  check("validateExternalSmokeUrl accepts hyphenated hostname labels",
    validateExternalSmokeUrl("external_readonly_url", "https://demo-edge.example.com/path"),
    "https://demo-edge.example.com/path");

  check("validateExternalSmokeUrl accepts punycoded hostname labels",
    validateExternalSmokeUrl("external_readonly_url", "https://xn--bcher-kva.example/path"),
    "https://xn--bcher-kva.example/path");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the five invalid DNS label checks fail; hyphenated and punycoded hostname checks pass.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `35 passed, 5 failed`; the five invalid DNS label checks failed and the hyphenated/punycoded hostname checks passed.

### Task 2: Reject DNS-Incompatible Hostname Labels

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add DNS label helper**

Add this helper after `isSingleLabelHostname`:

```js
function isDnsCompatibleHostname(host) {
  if (isIpLiteralHost(host)) return true;
  if (host.length > 253) return false;
  const labels = host.split(".");
  return labels.every((label) => (
    label.length >= 1 &&
    label.length <= 63 &&
    /^[a-z0-9-]+$/.test(label) &&
    !label.startsWith("-") &&
    !label.endsWith("-")
  ));
}
```

- [x] **Step 2: Reject DNS-incompatible hostnames in validator**

Add this check after the existing `isSingleLabelHostname(host)` block:

```js
  if (!isDnsCompatibleHostname(host)) {
    throw new Error(`${safeLabel} must use DNS-compatible public hostname labels`);
  }
```

- [x] **Step 3: Document the preflight rule**

Update README and `docs/external-demo-runbook.md` manual external URL paragraphs to say DNS hostname labels must be DNS-compatible and that underscore/empty/edge-hyphen labels are rejected.

Observed: README and `docs/external-demo-runbook.md` now document DNS-compatible hostname label requirements and reject DNS-incompatible labels.

- [x] **Step 4: Run GREEN validator test**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `40 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-dns-label-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` passed; validator tests reported `40 passed, 0 failed`, full suite reported `595 passed, 0 failed across 24 test file(s)`, and diff whitespace check passed.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-dns-label-preflight.md
git commit -m "ci: validate smoke url dns labels"
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
