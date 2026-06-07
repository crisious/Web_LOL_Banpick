# External Smoke Unicode Whitespace Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject raw Unicode whitespace in external smoke URLs before `String.trim()` or the WHATWG URL parser silently removes or normalizes it.

**Architecture:** Add a pre-parser guard in `scripts/validate-external-smoke-url.mjs` that scans `rawValue` for non-ASCII whitespace code points. Keep the existing operator-friendly ASCII leading/trailing space trimming and ASCII space/control-character messages unchanged.

**Tech Stack:** Node.js ES modules, existing zero-dependency test runner in `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`, README/runbook documentation, GitHub Actions QA.

---

### Task 1: Add Failing Unicode Whitespace Tests

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add raw Unicode whitespace reject checks**

Add these checks after the existing trim assertion and before the raw scheme separator checks:

```js
  checkThrows("validateExternalSmokeUrl rejects leading non-breaking space",
    () => validateExternalSmokeUrl("external_readonly_url", "\u00a0https://demo.example.com"),
    "external_readonly_url must not include Unicode whitespace");

  checkThrows("validateExternalSmokeUrl rejects root path non-breaking space",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/\u00a0"),
    "external_readonly_url must not include Unicode whitespace");

  checkThrows("validateExternalSmokeUrl rejects root path ideographic space",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/\u3000"),
    "external_readonly_url must not include Unicode whitespace");
```

- [x] **Step 2: Run validator tests and verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the three new checks fail because current validation trims or parses these Unicode whitespace spellings into `https://demo.example.com/`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `91 passed, 3 failed`; the three new Unicode whitespace checks failed because no error was thrown.

### Task 2: Add Raw Unicode Whitespace Guard

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`

- [x] **Step 1: Add helper**

Add this helper near the existing path helper functions:

```js
function hasUnicodeWhitespace(value) {
  return /[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/u.test(value);
}
```

- [x] **Step 2: Add pre-parser guard**

Add this block in `validateExternalSmokeUrl` after the ASCII control-character guard and before the ASCII space guard:

```js
  if (hasUnicodeWhitespace(rawValue)) {
    throw new Error(`${safeLabel} must not include Unicode whitespace`);
  }
```

- [x] **Step 3: Run validator tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: `94 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `94 passed, 0 failed`.

### Task 3: Update Operator Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Document Unicode whitespace rejection**

Update the manual external URL paragraphs to list raw Unicode whitespace among rejected external evidence URL inputs.

Observed: README and `docs/external-demo-runbook.md` now list raw Unicode whitespace among rejected manual external evidence URL inputs.

- [x] **Step 2: Update expected test count**

Update README's test count from `652` to `655`.

Observed: README `npm test` count updated from `652` to `655`.

### Task 4: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-unicode-whitespace-preflight.md`
- Modify external Obsidian project note: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests report `94 passed, 0 failed`, full suite reports `655 passed, 0 failed across 24 test file(s)`, and diff whitespace check passes.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Validator tests reported `94 passed, 0 failed`; full suite reported `655 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-unicode-whitespace-preflight.md
git commit -m "ci: reject unicode whitespace smoke urls"
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
