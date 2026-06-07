# External Smoke Canonical IPv4 Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject non-canonical IPv4 literal spellings in external smoke URLs before the URL parser silently normalizes them.

**Architecture:** Add a tiny raw authority host extractor in `scripts/validate-external-smoke-url.mjs` and compare it against the parsed IPv4 hostname. If WHATWG URL parsing normalizes a raw IPv4-like host such as `134744072` or `8.8.2056` into dotted decimal, reject it with a concise canonical IPv4 error. Existing canonical dotted-decimal public IPv4, FQDN, local/private, reserved/special-use, and IPv6 behavior stay unchanged.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests.

---

### Task 1: Add RED Coverage for Non-Canonical IPv4 Literals

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add failing validator tests**

Add these checks after the existing public IPv4 literal accept check:

```js
  checkThrows("validateExternalSmokeUrl rejects integer IPv4 literal",
    () => validateExternalSmokeUrl("external_readonly_url", "https://134744072/path"),
    "external_readonly_url must use canonical dotted-decimal IPv4 literals");

  checkThrows("validateExternalSmokeUrl rejects shortened IPv4 literal",
    () => validateExternalSmokeUrl("external_readonly_url", "https://8.8.2056/path"),
    "external_readonly_url must use canonical dotted-decimal IPv4 literals");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the two new checks fail because `new URL()` normalizes both examples to `8.8.8.8`, which the current validator accepts as a public IPv4 literal.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `67 passed, 2 failed`; both new non-canonical IPv4 checks failed while the existing canonical public IPv4 check passed.

### Task 2: Reject Non-Canonical IPv4 Literal Spellings

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add raw host extraction helper**

Add this helper after `ipv4Parts`:

```js
function rawHostFromUrlValue(value) {
  const withoutScheme = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const authority = withoutScheme.split(/[/?#]/, 1)[0] || "";
  const hostPort = authority.includes("@") ? authority.slice(authority.lastIndexOf("@") + 1) : authority;
  if (hostPort.startsWith("[")) {
    const closingBracketIndex = hostPort.indexOf("]");
    return closingBracketIndex >= 0 ? hostPort.slice(0, closingBracketIndex + 1).toLowerCase() : hostPort.toLowerCase();
  }
  return hostPort.split(":")[0].toLowerCase();
}
```

- [x] **Step 2: Add canonical IPv4 guard**

Add this block in `validateExternalSmokeUrl` after `const host = parsed.hostname.toLowerCase();`:

```js
  const rawHost = rawHostFromUrlValue(value);
  if (ipv4Parts(host) && rawHost !== host) {
    throw new Error(`${safeLabel} must use canonical dotted-decimal IPv4 literals`);
  }
```

- [x] **Step 3: Update docs and test count**

Update README's `npm test` count from `628` to `630`. In README and `docs/external-demo-runbook.md`, update the manual external URL paragraph to state that non-canonical IPv4 literal spellings are rejected.

- [x] **Step 4: Run GREEN focused tests**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass and report `69 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `69 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-canonical-ipv4-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes. Full suite should report `630 passed, 0 failed across 24 test file(s)` after the two new checks.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Focused validator tests reported `69 passed, 0 failed`; full suite reported `630 passed, 0 failed across 24 test file(s)`.

- [x] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-canonical-ipv4-preflight.md
git commit -m "ci: reject noncanonical smoke ipv4 urls"
git push origin main
```

Observed: committed and pushed `3fb93a5 ci: reject noncanonical smoke ipv4 urls` to `main`.

- [x] **Step 3: Confirm remote QA and artifact**

Run:

```bash
gh run watch <run-id> --exit-status
gh run view <run-id> --json name,status,conclusion,url,headSha,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: GitHub Actions QA succeeds, read-only smoke artifact uploads, and artifact summary reports `150 passed / 0 failed`.

Observed: GitHub Actions QA run `27101149314` completed with conclusion `success` for head SHA `3fb93a52083d641b391f05b0f3f373914ac5f953`. Artifact `qa-automation-27101149314` uploaded as id `7466816736` and expires at `2026-06-21T18:32:17Z`; downloaded artifact `qa-summary.json` reported read-only smoke `150 passed / 0 failed`, and the artifact sensitive-value scan produced no matches.

- [x] **Step 4: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed: appended the `2026-06-08 03:32 KST - external smoke canonical IPv4 preflight` log with code commit, local RED/GREEN/full QA, GitHub Actions run, artifact id, artifact download verification, and no-match sensitive-value scan.
