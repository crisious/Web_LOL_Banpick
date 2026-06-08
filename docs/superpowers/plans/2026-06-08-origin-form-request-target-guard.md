# Origin Form Request Target Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject absolute-form and protocol-relative request targets before routing so the demo server only accepts origin-form paths such as `/healthz`.

**Architecture:** Extend the existing `requestUrlFrom(req)` helper in `server.js` with a raw request-target shape check before `new URL()`. Keep the same HTTP 400 `INVALID_REQUEST_TARGET` payload used for malformed targets and invalid Host headers.

**Tech Stack:** Node.js built-in HTTP server, WHATWG `URL`, plain JavaScript regression tests under `test-artifacts/server`.

---

### Task 1: Add RED Coverage For Non-Origin-Form Request Targets

**Files:**
- Modify: `test-artifacts/server/request-url-guard-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-08-origin-form-request-target-guard.md`

- [x] **Step 1: Write the failing test**

In `test-artifacts/server/request-url-guard-tests.mjs`, add these checks after the invalid Host header checks:

```js
const absoluteTargetError = captureUrlError(makeReq({
  url: "http://example.com/healthz",
  host: "localhost:8123",
}));
check("absolute-form request target status",
  absoluteTargetError?.statusCode,
  400);
check("absolute-form request target code",
  absoluteTargetError?.payload?.code,
  "INVALID_REQUEST_TARGET");

const protocolRelativeTargetError = captureUrlError(makeReq({
  url: "//example.com/healthz",
  host: "localhost:8123",
}));
check("protocol-relative request target status",
  protocolRelativeTargetError?.statusCode,
  400);
check("protocol-relative request target code",
  protocolRelativeTargetError?.payload?.code,
  "INVALID_REQUEST_TARGET");
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node test-artifacts/server/request-url-guard-tests.mjs
```

Expected result before implementation: exit 1. Existing request URL checks pass, while the four new absolute/protocol-relative target checks fail because `new URL()` currently accepts those spellings.

Observed: `node test-artifacts/server/request-url-guard-tests.mjs` exited 1 with `9 passed, 4 failed`. The new absolute-form and protocol-relative request target checks failed with missing `statusCode` and `payload.code`.

### Task 2: Implement Origin-Form Request Target Guard

**Files:**
- Modify: `server.js`
- Test: `test-artifacts/server/request-url-guard-tests.mjs`

- [x] **Step 1: Extract a reusable invalid request-target error helper**

Insert this helper before `requestUrlFrom(req)`:

```js
function invalidRequestTargetError() {
  const error = new Error("요청 URL이 올바르지 않습니다.");
  error.statusCode = 400;
  error.payload = {
    ok: false,
    code: "INVALID_REQUEST_TARGET",
    error: "요청 URL이 올바르지 않습니다.",
  };
  return error;
}
```

- [x] **Step 2: Reject non-origin-form request targets before URL parsing**

Change `requestUrlFrom(req)` to:

```js
function requestUrlFrom(req) {
  const rawTarget = firstHeaderValue(req.url) || "/";
  if (!rawTarget.startsWith("/") || rawTarget.startsWith("//")) {
    throw invalidRequestTargetError();
  }
  const host = firstHeaderValue(req.headers.host) || "127.0.0.1";
  try {
    return new URL(rawTarget, `http://${host}`);
  } catch {
    throw invalidRequestTargetError();
  }
}
```

- [x] **Step 3: Run focused test**

Run:

```bash
node --check server.js && node --check test-artifacts/server/request-url-guard-tests.mjs && node test-artifacts/server/request-url-guard-tests.mjs
```

Expected result after implementation: exit 0 with `13 passed, 0 failed`.

Observed: `node --check server.js && node --check test-artifacts/server/request-url-guard-tests.mjs && node test-artifacts/server/request-url-guard-tests.mjs` exited 0 with request URL guard tests `13 passed, 0 failed`.

### Task 3: Document Origin-Form Request Target Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-origin-form-request-target-guard.md`

- [x] **Step 1: Add operator-facing notes**

Update the existing `INVALID_REQUEST_TARGET` sentence in `README.md` so it says:

```markdown
Malformed, absolute-form, protocol-relative request targets or invalid Host headers are caught inside the top-level request handler and return HTTP 400 `INVALID_REQUEST_TARGET`.
```

Update the existing `INVALID_REQUEST_TARGET` bullet in `docs/external-demo-runbook.md` so it says:

```markdown
- malformed, absolute-form, protocol-relative request targets or invalid Host headers fail as HTTP 400 `INVALID_REQUEST_TARGET` instead of escaping the request handler
```

- [x] **Step 2: Scan plan for placeholder failures**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-origin-form-request-target-guard.md
placeholder_scan=$?
printf 'placeholder_scan_exit=%s\n' "$placeholder_scan"
test "$placeholder_scan" -eq 1
```

Expected: `placeholder_scan_exit=1` and command exit 0.

Observed: placeholder scan exited 0 with `placeholder_scan_exit=1`.

### Task 4: QA, Commit, Push, And Remote Evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Create: `docs/superpowers/plans/2026-06-08-origin-form-request-target-guard.md`
- Modify: `server.js`
- Modify: `test-artifacts/server/request-url-guard-tests.mjs`

- [x] **Step 1: Run full local QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-origin-form-request-target-guard.md
placeholder_scan=$?
printf 'placeholder_scan_exit=%s\n' "$placeholder_scan"
test "$placeholder_scan" -eq 1
node --check server.js
node --check test-artifacts/server/request-url-guard-tests.mjs
node test-artifacts/server/request-url-guard-tests.mjs
npm test
git diff --check
```

Expected: exit 0, request URL guard tests `13 passed, 0 failed`, and the full suite has zero failures.

Observed: command exited 0. Placeholder scan returned `placeholder_scan_exit=1`, syntax checks passed, request URL guard tests reported `13 passed, 0 failed`, `npm test` reported `1042 passed, 0 failed across 34 test file(s)`, and `git diff --check` passed.

- [x] **Step 2: Stage and run cached QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-origin-form-request-target-guard.md server.js test-artifacts/server/request-url-guard-tests.mjs
git diff --cached --name-status
node --check server.js
node --check test-artifacts/server/request-url-guard-tests.mjs
node test-artifacts/server/request-url-guard-tests.mjs
npm test
git diff --cached --check
```

Expected: exit 0 and staged files match the planned file list.

Observed: command exited 0. Staged files were `README.md`, `docs/external-demo-runbook.md`, `docs/superpowers/plans/2026-06-08-origin-form-request-target-guard.md`, `server.js`, and `test-artifacts/server/request-url-guard-tests.mjs`. Placeholder scan returned `placeholder_scan_exit=1`, syntax checks passed, request URL guard tests reported `13 passed, 0 failed`, `npm test` reported `1042 passed, 0 failed across 34 test file(s)`, and `git diff --cached --check` passed.

- [ ] **Step 3: Commit and push to main**

Run:

```bash
git commit -m "ci: require origin-form request targets"
git push origin main
```

Expected: `main` pushes successfully to `origin/main`.

- [ ] **Step 4: Verify GitHub Actions artifact**

Run:

```bash
gh run list --repo crisious/Web_LOL_Banpick --branch main --limit 5 --json databaseId,headSha,status,conclusion,displayTitle,url
gh run watch <run-id> --repo crisious/Web_LOL_Banpick --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts --jq '.artifacts[] | {id,name,size_in_bytes,expired}'
gh run download <run-id> --repo crisious/Web_LOL_Banpick --dir test-artifacts/tmp/gh-run-<run-id>
```

Expected: new run for the pushed commit concludes `success`, the `qa-automation-<run-id>` artifact exists, read-only smoke reports `155 passed, 0 failed`, and the artifact sensitive scan finds no token or credential patterns.

### Self-Review

- Spec coverage: The plan covers absolute-form and protocol-relative request target rejection, the existing malformed/Host guard contract, docs, local QA, push, remote artifact verification, and Obsidian evidence updates after execution.
- Placeholder scan target: Task 3 scans this exact plan file for forbidden placeholders.
- Type consistency: `invalidRequestTargetError()` returns the same `statusCode` and `payload` shape consumed by the existing top-level catch.
