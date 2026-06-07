# External Smoke Scheme Separator Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject external smoke URLs whose raw input does not begin with the literal `https://` authority separator before the WHATWG URL parser normalizes them.

**Architecture:** Extend `scripts/validate-external-smoke-url.mjs` with a pre-parser raw prefix guard after trimming and before `new URL(value)`. This keeps the existing `parsed.protocol === "https:"` check as a defensive parser validation, but ensures operator-entered evidence URLs are already spelled as canonical HTTPS origins.

**Tech Stack:** Node.js ES modules, existing hand-rolled test runner in `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`, README/runbook documentation, GitHub Actions QA.

---

### Task 1: Add Failing Scheme Separator Tests

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add raw scheme separator reject checks**

Add these checks after the existing valid trim/root URL assertions and before path validation checks:

```js
  checkThrows("validateExternalSmokeUrl rejects missing scheme authority separator",
    () => validateExternalSmokeUrl("external_readonly_url", "https:demo.example.com"),
    "external_readonly_url must begin with https://");

  checkThrows("validateExternalSmokeUrl rejects single slash scheme authority separator",
    () => validateExternalSmokeUrl("external_readonly_url", "https:/demo.example.com"),
    "external_readonly_url must begin with https://");

  checkThrows("validateExternalSmokeUrl rejects uppercase scheme spelling",
    () => validateExternalSmokeUrl("external_readonly_url", "HTTPS://demo.example.com"),
    "external_readonly_url must begin with https://");
```

- [x] **Step 2: Run validator tests and verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the three new checks fail because the current validator lets `new URL()` normalize `https:demo.example.com`, `https:/demo.example.com`, and `HTTPS://demo.example.com` into `https://demo.example.com/`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `88 passed, 3 failed`; the three new raw scheme spelling checks failed because no error was thrown.

### Task 2: Implement Raw `https://` Prefix Guard

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`

- [x] **Step 1: Add pre-parser guard**

Insert this block after the existing backslash guard and before the dot-segment path guard:

```js
  if (/^https:/i.test(value) && !value.startsWith("https://")) {
    throw new Error(`${safeLabel} must begin with https://`);
  }
```

Observed: the initial broader `!value.startsWith("https://")` guard made existing `http://` and invalid URL tests report `must begin with https://` instead of the existing `needs an https:// URL` message. The final guard only catches raw inputs that look like HTTPS scheme spellings but are not literal lowercase `https://`.

- [x] **Step 2: Run validator tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: `91 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `91 passed, 0 failed`.

### Task 3: Update Operator Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Document literal `https://` input requirement**

Update the manual external URL paragraphs to state that external evidence URLs must begin with literal lowercase `https://`, and that parser-normalized scheme spellings such as `https:demo.example.com`, `https:/demo.example.com`, or `HTTPS://demo.example.com` are rejected.

Observed: README and `docs/external-demo-runbook.md` now document literal lowercase `https://` origin/root URL input and reject parser-normalized raw scheme spelling.

- [x] **Step 2: Update expected validator test count**

Update README's test-count summary from `649` only if the full suite count changes. The expected new total is `652 passed, 0 failed across 24 test file(s)`.

Observed: README `npm test` count updated from `649` to `652`.

### Task 4: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-scheme-separator-preflight.md`
- Modify external Obsidian project note: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests report `91 passed, 0 failed`, full suite reports `652 passed, 0 failed across 24 test file(s)`, and diff whitespace check passes.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Validator tests reported `91 passed, 0 failed`; full suite reported `652 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-scheme-separator-preflight.md
git commit -m "ci: require canonical smoke url scheme"
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
