# External Smoke BOM Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject raw `\uFEFF` byte order mark characters in external smoke URLs before `String.trim()` or the WHATWG URL parser silently removes them.

**Architecture:** Extend the existing Unicode whitespace guard in `scripts/validate-external-smoke-url.mjs` to include `\uFEFF`. Keep the existing error message (`must not include Unicode whitespace`) so operator-facing preflight failures remain concise and grouped with the broader invisible-whitespace policy.

**Tech Stack:** Node.js ES modules, existing zero-dependency test runner in `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`, README/runbook documentation, GitHub Actions QA.

---

### Task 1: Add Failing BOM Tests

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add raw BOM reject checks**

Add these checks after the existing Unicode whitespace checks:

```js
  checkThrows("validateExternalSmokeUrl rejects leading byte order mark",
    () => validateExternalSmokeUrl("external_readonly_url", "\ufeffhttps://demo.example.com"),
    "external_readonly_url must not include Unicode whitespace");

  checkThrows("validateExternalSmokeUrl rejects trailing byte order mark",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com\ufeff"),
    "external_readonly_url must not include Unicode whitespace");

  checkThrows("validateExternalSmokeUrl rejects root path byte order mark",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/\ufeff"),
    "external_readonly_url must not include Unicode whitespace");
```

- [x] **Step 2: Run validator tests and verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the three new checks fail because current validation lets `\uFEFFhttps://demo.example.com`, `https://demo.example.com\uFEFF`, and `https://demo.example.com/\uFEFF` normalize into `https://demo.example.com/`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `94 passed, 3 failed`; the three new BOM checks failed because no error was thrown.

### Task 2: Extend Unicode Whitespace Guard

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`

- [x] **Step 1: Include `\uFEFF` in helper**

Change `hasUnicodeWhitespace` to:

```js
function hasUnicodeWhitespace(value) {
  return /[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/u.test(value);
}
```

- [x] **Step 2: Run validator tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: `97 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `97 passed, 0 failed`.

### Task 3: Update Operator Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Document BOM rejection**

Update the manual external URL paragraphs to say raw Unicode whitespace or byte order mark characters are rejected.

Observed: README and `docs/external-demo-runbook.md` now document raw Unicode whitespace or byte order mark rejection.

- [x] **Step 2: Update expected test count**

Update README's test count from `655` to `658`.

Observed: README `npm test` count updated from `655` to `658`.

### Task 4: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-bom-preflight.md`
- Modify external Obsidian project note: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests report `97 passed, 0 failed`, full suite reports `658 passed, 0 failed across 24 test file(s)`, and diff whitespace check passes.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Validator tests reported `97 passed, 0 failed`; full suite reported `658 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-bom-preflight.md
git commit -m "ci: reject bom smoke urls"
git push origin main
```

- [ ] **Step 3: Confirm remote QA and artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 10 --json databaseId,headSha,status,conclusion,createdAt,url,event,name
gh run watch <run-id> --exit-status
gh run view <run-id> --json name,status,conclusion,url,headSha,createdAt,updatedAt,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: GitHub Actions QA succeeds, read-only smoke artifact uploads, and artifact summary reports `150 passed / 0 failed`.

- [ ] **Step 4: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local RED/GREEN/full QA, remote run URL, artifact id, and sensitive-value search result.
