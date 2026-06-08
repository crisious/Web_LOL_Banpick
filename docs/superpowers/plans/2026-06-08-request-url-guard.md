# Request URL Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep malformed request targets or Host headers from escaping the top-level request error handler, and return stable HTTP 400 JSON instead.

**Architecture:** Add a small `requestUrlFrom(req)` helper in `server.js` that wraps `new URL()` and throws a structured `INVALID_REQUEST_TARGET` error. Move URL parsing inside the existing top-level `try` block so the existing `sendJson(res, error?.statusCode || 500, error?.payload || ...)` catch handles invalid request URLs.

**Tech Stack:** Node.js built-in HTTP server, WHATWG `URL`, plain JavaScript regression tests under `test-artifacts/server`.

---

### Task 1: Add RED Coverage For Malformed Request URL Handling

**Files:**
- Create: `test-artifacts/server/request-url-guard-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-08-request-url-guard.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/request-url-guard-tests.mjs`:

```js
// Request URL guard regression tests.
//
// The top-level HTTP handler should parse request URLs inside its guarded block
// and map malformed request targets or Host headers to a stable 400 JSON error.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  let startIdx = source.indexOf(`function ${name}(`);
  const asyncStartIdx = source.indexOf(`async function ${name}(`);
  if (asyncStartIdx >= 0 && (startIdx < 0 || asyncStartIdx < startIdx)) {
    startIdx = asyncStartIdx;
  }
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const requestUrlFromSource = serverSrc.includes("function requestUrlFrom(")
  ? extractFunctionSource(serverSrc, "requestUrlFrom")
  : [
      "function requestUrlFrom(req) {",
      "  return new URL(req.url, `http://${req.headers.host}`);",
      "}",
    ].join("\n");

const harness = new Function([
  extractFunctionSource(serverSrc, "firstHeaderValue"),
  requestUrlFromSource,
  "return { requestUrlFrom };",
].join("\n"))();

function makeReq({ url = "/healthz", host = "localhost:8123" } = {}) {
  return {
    url,
    headers: { host },
  };
}

function captureUrlError(req) {
  try {
    harness.requestUrlFrom(req);
    return null;
  } catch (error) {
    return error;
  }
}

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkTrue(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition && detail) console.log(`  ${detail}`);
  condition ? pass++ : fail++;
}

const validUrl = harness.requestUrlFrom(makeReq({ url: "/healthz?ready=1", host: "127.0.0.1:8123" }));
check("valid request URL pathname",
  validUrl.pathname,
  "/healthz");
check("valid request URL search",
  validUrl.search,
  "?ready=1");

const invalidTargetError = captureUrlError(makeReq({ url: "http://[::1", host: "localhost:8123" }));
check("invalid request target status",
  invalidTargetError?.statusCode,
  400);
check("invalid request target code",
  invalidTargetError?.payload?.code,
  "INVALID_REQUEST_TARGET");
check("invalid request target body",
  invalidTargetError?.payload,
  {
    ok: false,
    code: "INVALID_REQUEST_TARGET",
    error: "요청 URL이 올바르지 않습니다.",
  });

const invalidHostError = captureUrlError(makeReq({ url: "/healthz", host: "bad host" }));
check("invalid Host header status",
  invalidHostError?.statusCode,
  400);
check("invalid Host header code",
  invalidHostError?.payload?.code,
  "INVALID_REQUEST_TARGET");

checkTrue("server parses request URL inside top-level try",
  /try\s*\{[\s\S]*const url = requestUrlFrom\(req\);[\s\S]*handleApi\(req,\s*res,\s*url\)/.test(serverSrc));

checkTrue("server no longer parses request URL before top-level try",
  !/createServer\(async\s*\(req,\s*res\)\s*=>\s*\{\s*const url = new URL/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node test-artifacts/server/request-url-guard-tests.mjs
```

Expected result before implementation: exit 1. The valid URL checks pass, while malformed request target/Host errors lack `statusCode` and `payload`, and source checks show URL parsing still happens before the top-level `try`.

Observed: `node test-artifacts/server/request-url-guard-tests.mjs` exited 1 with `2 passed, 7 failed`. The failures showed invalid request target and Host errors without `statusCode`/`payload`, plus source checks confirming URL parsing was still outside the top-level `try`.

### Task 2: Implement Guarded Request URL Parsing

**Files:**
- Modify: `server.js`
- Test: `test-artifacts/server/request-url-guard-tests.mjs`

- [x] **Step 1: Add `requestUrlFrom(req)`**

Insert this helper before `const server = http.createServer(...)`:

```js
function requestUrlFrom(req) {
  const host = firstHeaderValue(req.headers.host) || "127.0.0.1";
  try {
    return new URL(req.url || "/", `http://${host}`);
  } catch {
    const error = new Error("요청 URL이 올바르지 않습니다.");
    error.statusCode = 400;
    error.payload = {
      ok: false,
      code: "INVALID_REQUEST_TARGET",
      error: "요청 URL이 올바르지 않습니다.",
    };
    throw error;
  }
}
```

- [x] **Step 2: Move URL parsing into the existing `try` block**

Change:

```js
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
```

to:

```js
const server = http.createServer(async (req, res) => {
  try {
    const url = requestUrlFrom(req);
```

- [x] **Step 3: Run focused test**

Run:

```bash
node --check server.js && node --check test-artifacts/server/request-url-guard-tests.mjs && node test-artifacts/server/request-url-guard-tests.mjs
```

Expected result after implementation: exit 0 with `9 passed, 0 failed`.

Observed: `node --check server.js && node --check test-artifacts/server/request-url-guard-tests.mjs && node test-artifacts/server/request-url-guard-tests.mjs` exited 0 with request URL guard tests `9 passed, 0 failed`.

### Task 3: Document The Request URL Error Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-request-url-guard.md`

- [x] **Step 1: Add operator-facing notes**

Add to `README.md` near the public demo hardening paragraph:

```markdown
Malformed request targets or Host headers are caught inside the top-level request handler and return HTTP 400 `INVALID_REQUEST_TARGET`.
```

Add to `docs/external-demo-runbook.md` Expected list:

```markdown
- malformed request targets or Host headers fail as HTTP 400 `INVALID_REQUEST_TARGET` instead of escaping the request handler
```

- [x] **Step 2: Scan plan for placeholder failures**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-request-url-guard.md
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
- Create: `docs/superpowers/plans/2026-06-08-request-url-guard.md`
- Modify: `server.js`
- Create: `test-artifacts/server/request-url-guard-tests.mjs`

- [x] **Step 1: Run full local QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-request-url-guard.md
placeholder_scan=$?
printf 'placeholder_scan_exit=%s\n' "$placeholder_scan"
test "$placeholder_scan" -eq 1
node --check server.js
node --check test-artifacts/server/request-url-guard-tests.mjs
node test-artifacts/server/request-url-guard-tests.mjs
npm test
git diff --check
```

Expected: exit 0, request URL guard tests `9 passed, 0 failed`, and the full suite has zero failures.

Observed: full local QA exited 0. Placeholder scan printed `placeholder_scan_exit=1`, syntax checks passed, focused request URL guard tests reported `9 passed, 0 failed`, `npm test` reported `1038 passed, 0 failed across 34 test file(s)`, and `git diff --check` passed.

- [x] **Step 2: Stage and run cached QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-request-url-guard.md server.js test-artifacts/server/request-url-guard-tests.mjs
git diff --cached --name-status
node --check server.js
node --check test-artifacts/server/request-url-guard-tests.mjs
node test-artifacts/server/request-url-guard-tests.mjs
npm test
git diff --cached --check
```

Expected: exit 0 and staged files match the planned file list.

Observed: cached QA exited 0. Staged files were `README.md`, `docs/external-demo-runbook.md`, `docs/superpowers/plans/2026-06-08-request-url-guard.md`, `server.js`, and `test-artifacts/server/request-url-guard-tests.mjs`; focused request URL guard tests reported `9 passed, 0 failed`; `npm test` reported `1038 passed, 0 failed across 34 test file(s)`; `git diff --cached --check` passed.

- [ ] **Step 3: Commit and push to main**

Run:

```bash
git commit -m "ci: guard malformed request urls"
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

- Spec coverage: The plan covers malformed request target parsing, malformed Host parsing, top-level try placement, docs, local QA, push, remote artifact verification, and Obsidian evidence updates after execution.
- Placeholder scan target: Task 3 scans this exact plan file for forbidden placeholders.
- Type consistency: `requestUrlFrom(req)` throws `statusCode` and `payload`; the existing top-level catch already consumes those names.
