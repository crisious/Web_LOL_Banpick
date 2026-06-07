# External Smoke Label Sanitization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent external smoke URL validator labels from injecting new lines or terminal control text into CLI logs.

**Architecture:** Keep the existing known labels such as `external_readonly_url` and `external_protected_url`. Replace the current partial `--` guard with a small allowlist helper that accepts only lowercase ASCII labels shaped like `[a-z][a-z0-9_]*`; every other label falls back to `external_url`. Use the sanitized label for both validation error messages and CLI success output.

**Tech Stack:** Node.js ES modules, existing zero-dependency validator tests, README/runbook documentation, GitHub Actions QA.

---

### Task 1: Add Failing Unsafe Label Tests

**Files:**
- Modify: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Add function-level unsafe label checks**

Add these checks after the fragment rejection check:

```js
  checkThrows("validateExternalSmokeUrl falls back for label with spaces",
    () => validateExternalSmokeUrl("bad label", "https://demo.example.com?token=secret"),
    "external_url must not include username/password, query string, or fragment");

  checkThrows("validateExternalSmokeUrl falls back for label with newline",
    () => validateExternalSmokeUrl("bad\nlabel", "https://demo.example.com?token=secret"),
    "external_url must not include username/password, query string, or fragment");

  checkThrows("validateExternalSmokeUrl falls back for label with escape character",
    () => validateExternalSmokeUrl("\u001b[31mred", "https://demo.example.com?token=secret"),
    "external_url must not include username/password, query string, or fragment");
```

- [x] **Step 2: Add CLI unsafe label checks**

Add these checks after the existing bad CLI query-string assertions:

```js
  const badLabelCli = spawnSync(process.execPath, [
    validatorPath,
    "bad\nlabel",
    "https://demo.example.com/?token=secret",
  ], { encoding: "utf8" });

  check("CLI unsafe label exits non-zero for URL with query string",
    badLabelCli.status,
    1);

  check("CLI unsafe label prints sanitized URL preflight failure",
    badLabelCli.stderr.trim(),
    "FAIL external_url must not include username/password, query string, or fragment");
```

Add these checks after the existing good CLI success assertions:

```js
  const goodBadLabelCli = spawnSync(process.execPath, [
    validatorPath,
    "bad\nlabel",
    "https://demo.example.com",
  ], { encoding: "utf8" });

  check("CLI unsafe label exits zero for valid URL",
    goodBadLabelCli.status,
    0);

  check("CLI unsafe label prints sanitized normalized valid URL",
    goodBadLabelCli.stdout.trim(),
    "OK external_url https://demo.example.com/");
```

- [x] **Step 3: Run validator tests and verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: the five new checks fail because current label handling only rejects option-like labels and otherwise echoes raw labels into messages.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` produced `102 passed, 5 failed`; function-level unsafe labels and CLI unsafe-label output checks failed because raw labels were echoed into messages.

### Task 2: Sanitize Validator Labels

**Files:**
- Modify: `scripts/validate-external-smoke-url.mjs`

- [x] **Step 1: Add label helper**

Add this helper before `validateExternalSmokeUrl`:

```js
function safeExternalSmokeUrlLabel(label) {
  const value = String(label || "");
  return /^[a-z][a-z0-9_]*$/.test(value) ? value : "external_url";
}
```

- [x] **Step 2: Use helper inside validation**

Replace:

```js
  const safeLabel = label && !String(label).startsWith("--") ? String(label) : "external_url";
```

with:

```js
  const safeLabel = safeExternalSmokeUrlLabel(label);
```

- [x] **Step 3: Use helper for CLI success output**

Replace the CLI success block with:

```js
  const safeLabel = safeExternalSmokeUrlLabel(label);
  try {
    const normalizedUrl = validateExternalSmokeUrl(safeLabel, rawUrl);
    console.log(`OK ${safeLabel} ${normalizedUrl}`);
  } catch (error) {
    console.error(`FAIL ${error.message || error}`);
    process.exit(1);
  }
```

- [x] **Step 4: Run validator tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: `107 passed, 0 failed`.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` reported `107 passed, 0 failed`.

### Task 3: Update Operator Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Document label sanitization**

Update the manual external URL preflight paragraphs to mention that validator labels are sanitized before being written to logs.

Observed: README and `docs/external-demo-runbook.md` now document validator label sanitization before log output.

- [x] **Step 2: Update expected test count**

Update README's test count from `661` to `668`.

Observed: README `npm test` count updated from `661` to `668`.

### Task 4: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-label-sanitization.md`
- Modify external Obsidian project note: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, validator tests report `107 passed, 0 failed`, full suite reports `668 passed, 0 failed across 24 test file(s)`, and diff whitespace check passes.

Observed: `node --check scripts/validate-external-smoke-url.mjs && node test-artifacts/scripts/external-smoke-url-validator-tests.mjs && npm test && git diff --check` exited 0. Validator tests reported `107 passed, 0 failed`; full suite reported `668 passed, 0 failed across 24 test file(s)`.

- [x] **Step 2: Commit and push to main**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-label-sanitization.md
git commit -m "ci: sanitize smoke url labels"
git push origin main
```

Observed: committed `3d6a228 ci: sanitize smoke url labels` and pushed `main` to `origin/main`.

- [x] **Step 3: Confirm remote QA and artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 10 --json databaseId,headSha,status,conclusion,createdAt,url,event,name
gh run watch <run-id> --exit-status
gh run view <run-id> --json name,status,conclusion,url,headSha,createdAt,updatedAt,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: GitHub Actions QA succeeds, read-only smoke artifact uploads, and artifact summary reports `150 passed / 0 failed`.

Observed: `gh run watch 27103292781 --exit-status` passed for `3d6a228`. Artifact `qa-automation-27103292781` / id `7467496366` / expires `2026-06-21T20:02:54Z` downloaded to `/tmp/lol-ai-coach-label-sanitization.cHcqRC`; `qa-summary.json` reported read-only smoke `150 passed / 0 failed`, and sensitive-value scan found no Authorization/Bearer/token/credential URL matches.

- [x] **Step 4: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local RED/GREEN/full QA, remote run URL, artifact id, and sensitive-value search result.

Observed: Obsidian project log was updated with the validator label sanitization background, commit, local RED/GREEN/full QA, remote run URL, artifact id, smoke summary, and sensitive-value search result.
