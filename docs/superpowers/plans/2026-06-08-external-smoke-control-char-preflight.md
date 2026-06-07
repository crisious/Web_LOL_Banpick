# External Smoke Control Character Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject raw ASCII control characters in external smoke URLs before the WHATWG URL parser strips or encodes them.

**Architecture:** Add a raw input guard in `scripts/validate-external-smoke-url.mjs` before `new URL(value)` so embedded newline/tab/control character URL spellings fail with a concise preflight error. Keep ordinary leading/trailing spaces trimmed, and keep percent-encoded path data such as `%0a` governed by the existing URL/parser behavior.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests.

---

### Task 1: Add RED Coverage for Raw Control Characters

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add failing validator tests**

Add these checks after the existing trimmed URL accept check:

```js
  checkThrows("validateExternalSmokeUrl rejects embedded newline",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/pa\nth"),
    "external_readonly_url must not include ASCII control characters");

  checkThrows("validateExternalSmokeUrl rejects embedded tab",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/pa\tth"),
    "external_readonly_url must not include ASCII control characters");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the two new checks fail because `new URL()` strips raw newline/tab characters and the current validator accepts the normalized result.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `73 passed, 2 failed`; both raw control-character checks failed because no error was thrown.

### Task 2: Reject Raw ASCII Control Characters

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add raw control character guard**

Replace the first two lines in `validateExternalSmokeUrl` with this raw-value preserving block:

```js
  const safeLabel = label && !String(label).startsWith("--") ? String(label) : "external_url";
  const rawValue = String(rawUrl || "");
  const value = rawValue.trim();
  if (/[\u0000-\u001f\u007f]/.test(rawValue)) {
    throw new Error(`${safeLabel} must not include ASCII control characters`);
  }
```

Keep the existing backslash guard after this block:

```js
  if (value.includes("\\")) {
    throw new Error(`${safeLabel} must not include backslashes`);
  }
```

- [x] **Step 2: Update docs and test count**

Update README's `npm test` count from `634` to `636`. In README and `docs/external-demo-runbook.md`, update the manual external URL paragraph to state that raw ASCII control characters are rejected.

- [x] **Step 3: Run GREEN focused tests**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass and report `75 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `75 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-control-char-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes. Full suite should report `636 passed, 0 failed across 24 test file(s)` after the two new checks.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Focused validator tests reported `75 passed, 0 failed`; full suite reported `636 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-control-char-preflight.md
git commit -m "ci: reject control char smoke urls"
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
