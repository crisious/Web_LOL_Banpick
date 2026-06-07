# External Smoke Unencoded Space Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject embedded raw spaces in external smoke URLs before the WHATWG URL parser percent-encodes them.

**Architecture:** Add a trimmed-value guard in `scripts/validate-external-smoke-url.mjs` before `new URL(value)` so unencoded spaces inside the URL body fail with a concise preflight error. Preserve the existing operator-friendly leading/trailing whitespace trim behavior and keep percent-encoded URL data governed by the parser.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests.

---

### Task 1: Add RED Coverage for Raw Embedded Spaces

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add failing validator tests**

Add these checks after the existing trimmed URL accept check:

```js
  checkThrows("validateExternalSmokeUrl rejects unencoded path space",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/pa th"),
    "external_readonly_url must not include unencoded spaces");

  checkThrows("validateExternalSmokeUrl rejects unencoded nested path space",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/a b/c"),
    "external_readonly_url must not include unencoded spaces");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the two new checks fail because `new URL()` encodes raw path spaces to `%20` and the current validator accepts the normalized result.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `75 passed, 2 failed`; both raw embedded-space checks failed because no error was thrown.

### Task 2: Reject Embedded Raw Spaces

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add unencoded space guard**

Add this block in `validateExternalSmokeUrl` after the ASCII control-character guard and before the backslash guard:

```js
  if (value.includes(" ")) {
    throw new Error(`${safeLabel} must not include unencoded spaces`);
  }
```

- [x] **Step 2: Update docs and test count**

Update README's `npm test` count from `636` to `638`. In README and `docs/external-demo-runbook.md`, update the manual external URL paragraph to state that unencoded spaces are rejected.

- [x] **Step 3: Run GREEN focused tests**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass and report `77 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `77 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-unencoded-space-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes. Full suite should report `638 passed, 0 failed across 24 test file(s)` after the two new checks.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Validator tests reported `77 passed, 0 failed`; full suite reported `638 passed, 0 failed across 24 test file(s)`.

- [x] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-unencoded-space-preflight.md
git commit -m "ci: reject unencoded space smoke urls"
git push origin main
```

Observed: committed and pushed `a8dea7c ci: reject unencoded space smoke urls` to `origin/main`.

- [x] **Step 3: Confirm remote QA and artifact**

Run:

```bash
gh run watch <run-id> --exit-status
gh run view <run-id> --json name,status,conclusion,url,headSha,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: GitHub Actions QA succeeds, read-only smoke artifact uploads, and artifact summary reports `150 passed / 0 failed`.

Observed: GitHub Actions QA run `27101788418` succeeded for `a8dea7c`; artifact `qa-automation-27101788418` uploaded with id `7467027019` and expires at `2026-06-21T18:59:35Z`. Downloaded artifact summary reported `smokeSummary.passed = 150`, `smokeSummary.failed = 0`; sensitive-value scan returned no matches.

- [x] **Step 4: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed: appended Obsidian log at `2026-06-08 04:00 KST` with local RED/GREEN/full QA, code commit `a8dea7c`, remote QA run `27101788418`, artifact id `7467027019`, and no-match sensitive scan result.
