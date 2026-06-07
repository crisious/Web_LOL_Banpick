# External Smoke Root Path Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require manual external smoke URLs to point at the demo origin/root so persisted evidence matches the actual `/healthz` and `/api/*` smoke targets.

**Architecture:** Keep the existing raw-input guards for control characters, spaces, backslashes, and dot segments before parsing. After `new URL(value)` and protocol/userinfo/query/fragment/default-port checks, reject any parsed URL whose `pathname` is not `/`, because the smoke runner builds requests with absolute paths like `new URL("/healthz", baseUrl)`, which ignores any non-root base path. Update focused validator tests and external demo docs so operators supply `https://demo.example.com` or `https://demo.example.com/`, not a routed subpath.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests.

---

### Task 1: Add RED Coverage for Non-Root Base Paths

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Adjust accept cases and add failing rejects**

Change the first accept check to use a pathless URL and add an explicit root-slash accept check:

```js
  check("validateExternalSmokeUrl accepts external https URL",
    validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com"),
    "https://demo.example.com/");

  check("validateExternalSmokeUrl accepts explicit root slash URL",
    validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/"),
    "https://demo.example.com/");
```

Add this reject check after the trimmed input check:

```js
  checkThrows("validateExternalSmokeUrl rejects non-root path",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/app"),
    "external_readonly_url must point to the demo origin root path");
```

Change the ellipsis path case to reject with the same root-path message:

```js
  checkThrows("validateExternalSmokeUrl rejects non-root ellipsis path segment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/.../admin"),
    "external_readonly_url must point to the demo origin root path");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the ordinary non-root path and ellipsis path reject checks fail because the current validator still accepts non-root paths. The pathless/root accept checks should pass.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `82 passed, 2 failed`. The ordinary non-root path and ellipsis path reject checks failed because no error was thrown; pathless/root accept checks passed.

### Task 2: Reject Non-Root External Smoke URL Paths

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add root-path guard**

Add this block in `validateExternalSmokeUrl` after host classification and DNS-compatible hostname checks:

```js
  if (parsed.pathname !== "/") {
    throw new Error(`${safeLabel} must point to the demo origin root path`);
  }
```

Keep the existing dot-segment guard before `new URL(value)` so `a/../admin` and `%2e%2e/admin` still fail with the more specific `path dot segments` message.

- [x] **Step 2: Update docs and test count**

Update README's `npm test` count from `643` to `645`. In README and `docs/external-demo-runbook.md`, update the manual external URL paragraph to state that external smoke URLs must use the origin/root path and reject non-root paths.

- [x] **Step 3: Run GREEN focused tests**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass and report `84 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `84 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-root-path-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes. Full suite should report `645 passed, 0 failed across 24 test file(s)` after the two new checks.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Validator tests reported `84 passed, 0 failed`; full suite reported `645 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-root-path-preflight.md
git commit -m "ci: reject non-root smoke urls"
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
