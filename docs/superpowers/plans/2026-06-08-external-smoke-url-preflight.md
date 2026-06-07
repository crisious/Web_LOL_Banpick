# External Smoke URL Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fail manual GitHub Actions external smoke runs early when the provided demo URL is not a shareable external HTTPS URL.

**Architecture:** Add a small zero-dependency CLI validator used by the `QA` workflow before any external smoke command. The smoke scripts still perform their own network-facing validation, but the workflow gives faster, clearer feedback for bad manual dispatch inputs.

**Tech Stack:** Node 20 ESM, package script contract tests, GitHub Actions workflow contract tests.

---

### Task 1: URL Validator CLI

**Files:**
- Create: `scripts/validate-external-smoke-url.mjs`
- Create: `test-artifacts/scripts/external-smoke-url-validator-tests.mjs`

- [x] **Step 1: Write failing validator tests**

Create `test-artifacts/scripts/external-smoke-url-validator-tests.mjs` with checks for:

```js
validateExternalSmokeUrl("external_readonly_url", "https://demo.example.com/path")
```

Expected return:

```js
"https://demo.example.com/path"
```

And throws:

```js
"external_readonly_url needs an https:// URL"
"external_readonly_url must not include username/password, query string, or fragment"
"external_readonly_url must not point to localhost or loopback"
```

Also spawn the CLI to verify concise stderr:

```bash
node scripts/validate-external-smoke-url.mjs external_readonly_url 'https://demo.example.com/?token=secret'
```

Expected exit 1 and:

```text
FAIL external_readonly_url must not include username/password, query string, or fragment
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: fails because the validator script does not exist.

Observed: `node test-artifacts/scripts/external-smoke-url-validator-tests.mjs` failed on missing `scripts/validate-external-smoke-url.mjs`.

- [x] **Step 3: Implement validator**

Create `scripts/validate-external-smoke-url.mjs` exporting:

```js
export function validateExternalSmokeUrl(label, rawUrl) {
  const safeLabel = label && !label.startsWith("--") ? label : "external_url";
  const value = String(rawUrl || "").trim();
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${safeLabel} needs an https:// URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${safeLabel} needs an https:// URL`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${safeLabel} must not include username/password, query string, or fragment`);
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost")) {
    throw new Error(`${safeLabel} must not point to localhost or loopback`);
  }
  return parsed.toString();
}
```

The CLI should print `OK <label> <normalized-url>` on success and `FAIL <message>` on stderr with exit code 1 on failure.

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
```

Expected: all validator tests pass.

Observed: validator tests reported 16 passed / 0 failed.

### Task 2: Workflow and Package Integration

**Files:**
- Modify: `package.json`
- Modify: `test-artifacts/scripts/package-scripts-tests.mjs`
- Modify: `.github/workflows/qa.yml`
- Modify: `test-artifacts/scripts/github-actions-workflow-tests.mjs`

- [x] **Step 1: Write failing integration tests**

In `package-scripts-tests.mjs`, assert:

```js
scripts["smoke:validate:external-url"] === "node scripts/validate-external-smoke-url.mjs"
```

In `github-actions-workflow-tests.mjs`, assert the workflow has:

```yaml
- name: Validate external read-only smoke URL
  run: npm run smoke:validate:external-url -- external_readonly_url "$EXTERNAL_READONLY_URL"

- name: Validate external protected smoke URL
  run: npm run smoke:validate:external-url -- external_protected_url "$EXTERNAL_PROTECTED_URL"
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/package-scripts-tests.mjs
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Expected: both tests fail on missing package script/workflow validation steps.

Observed: package script contract reported 28 passed / 2 failed, and workflow contract reported 25 passed / 2 failed because the validator script and validation steps were missing.

- [x] **Step 3: Implement integration**

Add to `package.json`:

```json
"smoke:validate:external-url": "node scripts/validate-external-smoke-url.mjs"
```

Add workflow validation steps before each external smoke report step. Protected validation must run before the missing-token guard.

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/package-scripts-tests.mjs
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Expected: package and workflow contract tests pass.

Observed: package script contract reported 30 passed / 0 failed, and workflow contract reported 27 passed / 0 failed.

### Task 3: Docs, QA, Push

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document manual dispatch URL preflight**

Document that external smoke URLs must be `https://` URLs without username/password, query string, fragment, localhost, or loopback targets.

Observed: `README.md` and `docs/external-demo-runbook.md` now document the external URL preflight rules and the `smoke:validate:external-url` command.

- [x] **Step 2: Run full verification**

Run:

```bash
node --check scripts/validate-external-smoke-url.mjs
node test-artifacts/scripts/external-smoke-url-validator-tests.mjs
node test-artifacts/scripts/package-scripts-tests.mjs
node test-artifacts/scripts/github-actions-workflow-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0.

Observed: syntax check exited 0, validator tests reported 16 passed / 0 failed, package script tests reported 30 passed / 0 failed, workflow contract tests reported 27 passed / 0 failed, `npm test` reported 570 passed / 0 failed across 24 test files, and `git diff --check` exited 0.

- [x] **Step 3: Commit, push, and verify remote QA**

Run:

```bash
git add scripts/validate-external-smoke-url.mjs test-artifacts/scripts/external-smoke-url-validator-tests.mjs package.json test-artifacts/scripts/package-scripts-tests.mjs .github/workflows/qa.yml test-artifacts/scripts/github-actions-workflow-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-url-preflight.md
git commit -m "ci: preflight external smoke urls"
git push origin main
gh run watch <run-id> --exit-status
```

Expected: push-triggered `QA` passes; external validation steps are skipped on push events and run only when manual URL inputs are provided.

Observed: commit `97db8d8` pushed to `origin/main`; remote `QA` run `27098872219` passed. Push-triggered external URL validation and external smoke steps were skipped as expected. Artifact `qa-automation-27098872219` included `qa-summary.json`, readonly `smoke-report.json`, and readonly `smoke-run.json`; summary reported 150 passed / 0 failed and sensitive pattern search found no matches.
