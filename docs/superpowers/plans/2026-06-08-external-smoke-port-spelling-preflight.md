# External Smoke Port Spelling Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject raw external smoke URL port spellings that the WHATWG URL parser silently normalizes to the default HTTPS origin.

**Architecture:** Keep exact `:443` accepted because current operator docs and tests allow explicit default HTTPS ports. Add raw authority port extraction in `scripts/validate-external-smoke-url.mjs` and reject any raw port marker that is present but not exactly `443` after the existing parsed non-default port check, so `:4443` keeps the existing "default HTTPS port" failure while `:`, `:0443`, and `:000443` get a canonical-port spelling failure.

**Tech Stack:** Node.js ES modules, built-in `URL`, existing zero-dependency validator tests, README/runbook documentation, GitHub Actions QA.

---

### Task 1: Add Failing Raw Port Spelling Tests

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add empty and zero-padded port reject checks**

Add these checks after the existing explicit default HTTPS port accept check:

```js
  checkThrows("validateExternalSmokeUrl rejects empty HTTPS port marker",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com:/"),
    "external_readonly_url must use canonical HTTPS port spelling");

  checkThrows("validateExternalSmokeUrl rejects zero-padded default HTTPS port",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com:0443/"),
    "external_readonly_url must use canonical HTTPS port spelling");

  checkThrows("validateExternalSmokeUrl rejects multi-zero-padded default HTTPS port",
    () => validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com:000443/"),
    "external_readonly_url must use canonical HTTPS port spelling");
```

- [x] **Step 2: Run validator tests and verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the three new checks fail because `new URL()` normalizes `https://demo.example.com:/`, `https://demo.example.com:0443/`, and `https://demo.example.com:000443/` to `https://demo.example.com/`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `97 passed, 3 failed`; the three new raw port spelling checks failed because no error was thrown.

### Task 2: Reject Parser-Normalized Raw Port Spellings

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`

- [x] **Step 1: Add raw port extraction helper**

Add this helper after `rawHostFromUrlValue`:

```js
function rawPortFromUrlValue(value) {
  const withoutScheme = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const authority = withoutScheme.split(/[/?#]/, 1)[0] || "";
  const hostPort = authority.includes("@") ? authority.slice(authority.lastIndexOf("@") + 1) : authority;
  if (hostPort.startsWith("[")) {
    const closingBracketIndex = hostPort.indexOf("]");
    if (closingBracketIndex < 0) return null;
    const rest = hostPort.slice(closingBracketIndex + 1);
    return rest.startsWith(":") ? rest.slice(1) : null;
  }
  const portSeparatorIndex = hostPort.lastIndexOf(":");
  return portSeparatorIndex >= 0 ? hostPort.slice(portSeparatorIndex + 1) : null;
}
```

- [x] **Step 2: Reject non-canonical raw default port spellings**

Keep the existing parsed non-default port guard:

```js
  if (parsed.port) {
    throw new Error(`${safeLabel} must use the default HTTPS port`);
  }
```

Then add:

```js
  const rawPort = rawPortFromUrlValue(value);
  if (rawPort !== null && rawPort !== "443") {
    throw new Error(`${safeLabel} must use canonical HTTPS port spelling`);
  }
```

- [x] **Step 3: Run validator tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: `100 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `100 passed, 0 failed`.

### Task 3: Update Operator Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Document raw port spelling rejection**

Update the manual external URL paragraphs to say parser-normalized raw port spellings are rejected, while preserving the existing explicit non-default port language.

Observed: README and `docs/external-demo-runbook.md` now document parser-normalized raw port spelling rejection.

- [x] **Step 2: Update expected test count**

Update README's test count from `658` to `661`.

Observed: README `npm test` count updated from `658` to `661`.

### Task 4: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-port-spelling-preflight.md`
- Modify external Obsidian project note: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests report `100 passed, 0 failed`, full suite reports `661 passed, 0 failed across 24 test file(s)`, and diff whitespace check passes.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Validator tests reported `100 passed, 0 failed`; full suite reported `661 passed, 0 failed across 24 test file(s)`.

- [ ] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-port-spelling-preflight.md
git commit -m "ci: reject normalized smoke url ports"
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
