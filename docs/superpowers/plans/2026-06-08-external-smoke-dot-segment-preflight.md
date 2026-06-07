# External Smoke Dot Segment Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject raw and percent-encoded dot-segment path spellings in external smoke URLs before the WHATWG URL parser normalizes them.

**Architecture:** Add a raw-path extractor in `scripts/validate-external-smoke-url.mjs` and inspect path segments before `new URL(value)`. Reject only path segments that normalize to `.` or `..` when `%2e` is treated as a dot, leaving hostname dots and ordinary path segments such as `...` unchanged. Update validator coverage and external demo documentation so manual operators know dot-segment paths are not accepted for evidence collection URLs.

**Tech Stack:** Node.js ES modules, built-in `URL`, zero-dependency validator tests.

---

### Task 1: Add RED Coverage for Path Dot Segments

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add failing validator tests**

Add these checks after the existing unencoded-space checks:

```js
  checkThrows("validateExternalSmokeUrl rejects parent path segment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/a/../admin"),
    "external_readonly_url must not include path dot segments");

  checkThrows("validateExternalSmokeUrl rejects current path segment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/a/./admin"),
    "external_readonly_url must not include path dot segments");

  checkThrows("validateExternalSmokeUrl rejects encoded parent path segment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/%2e%2e/admin"),
    "external_readonly_url must not include path dot segments");

  checkThrows("validateExternalSmokeUrl rejects mixed encoded parent path segment",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/.%2e/admin"),
    "external_readonly_url must not include path dot segments");

  check("validateExternalSmokeUrl accepts non-dot ellipsis path segment",
    validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/.../admin"),
    "https://demo.example.com/.../admin");
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the four new reject checks fail because `new URL()` normalizes dot segments and the current validator accepts the normalized result. The ellipsis accept check should pass.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `78 passed, 4 failed`. The four new dot-segment reject checks failed because no error was thrown; the ellipsis accept check passed.

### Task 2: Reject Raw Path Dot Segments

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Add raw path helper and dot-segment detector**

Add these helpers near `rawHostFromUrlValue`:

```js
function rawPathFromUrlValue(value) {
  const withoutScheme = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const pathStartIndex = withoutScheme.search(/[/?#]/);
  if (pathStartIndex < 0 || withoutScheme[pathStartIndex] !== "/") return "";
  return withoutScheme.slice(pathStartIndex).split(/[?#]/, 1)[0] || "";
}

function isPathDotSegment(segment) {
  const dotDecoded = segment.toLowerCase().replace(/%2e/g, ".");
  return dotDecoded === "." || dotDecoded === "..";
}
```

- [x] **Step 2: Add pre-parser guard**

Add this block in `validateExternalSmokeUrl` after the backslash guard and before `new URL(value)`:

```js
  if (rawPathFromUrlValue(value).split("/").some(isPathDotSegment)) {
    throw new Error(`${safeLabel} must not include path dot segments`);
  }
```

- [x] **Step 3: Update docs and test count**

Update README's `npm test` count from `638` to `643`. In README and `docs/external-demo-runbook.md`, update the manual external URL paragraph to state that path dot segments are rejected.

- [x] **Step 4: Run GREEN focused tests**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: validator tests pass and report `82 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `82 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-dot-segment-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests pass, full suite passes, and diff whitespace check passes. Full suite should report `643 passed, 0 failed across 24 test file(s)` after the five new checks.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Validator tests reported `82 passed, 0 failed`; full suite reported `643 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-dot-segment-preflight.md
git commit -m "ci: reject dot segment smoke urls"
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
