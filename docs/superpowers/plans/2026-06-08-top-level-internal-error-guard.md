# Top Level Internal Error Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent payload-less top-level request handler exceptions from leaking filesystem paths, parser text, or raw exception messages in public JSON responses.

**Architecture:** Preserve existing structured errors that already set `error.payload`, such as `INVALID_REQUEST_TARGET`, `SAMPLE_MANIFEST_INVALID`, and `SAMPLE_BUNDLE_UNAVAILABLE`. Add a tiny helper in `server.js` for generic payload-less exceptions and update the top-level `http.createServer` catch to use it.

**Tech Stack:** Node.js HTTP server, repository custom `.mjs` tests, markdown docs.

---

### Task 1: Add RED Coverage For Generic Top-Level Errors

**Files:**
- Create: `test-artifacts/server/top-level-error-payload-tests.mjs`

- [x] **Step 1: Create a focused helper/source contract test**

Create `test-artifacts/server/top-level-error-payload-tests.mjs` with this content:

```js
// Top-level request handler generic error payload regression tests.
//
// Structured server errors should keep their explicit payloads. Unstructured
// exceptions should not expose raw error.message text to public JSON responses.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let bodyStartIdx = -1;
  let parenDepth = 0;
  let seenParams = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") { parenDepth += 1; seenParams = true; }
    else if (ch === ")") parenDepth -= 1;
    else if (ch === "{" && seenParams && parenDepth === 0) {
      bodyStartIdx = i;
      break;
    }
  }
  if (bodyStartIdx < 0) throw new Error(`function ${name} body not found`);
  let depth = 0;
  for (let i = bodyStartIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

let helper = null;
let loadError = null;
try {
  helper = new Function([
    extractFunctionSource(serverSrc, "internalServerErrorPayload"),
    "return { internalServerErrorPayload };",
  ].join("\n"))();
} catch (error) {
  loadError = error;
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

checkTrue("internal server error helper exists", Boolean(helper), loadError?.message || "");

if (helper) {
  const payload = helper.internalServerErrorPayload(new Error("ENOENT: no such file or directory, open '/runtime/samples/secret.json'"));
  check("generic internal error payload shape", payload, {
    ok: false,
    code: "INTERNAL_SERVER_ERROR",
    error: "서버 처리 중 오류가 발생했습니다.",
  });
  const payloadText = JSON.stringify(payload);
  checkTrue("generic internal error payload hides raw message",
    !payloadText.includes("ENOENT") && !payloadText.includes("/runtime/samples") && !payloadText.includes("secret.json"),
    payloadText);
}

checkTrue("top-level catch preserves structured payloads",
  /sendJson\(res,\s*error\?\.statusCode\s*\|\|\s*500,\s*error\?\.payload\s*\|\|\s*internalServerErrorPayload\(error\)\)/.test(serverSrc));
checkTrue("top-level catch no longer serializes raw error message",
  !/error:\s*error\.message/.test(serverSrc.slice(serverSrc.indexOf("const server = http.createServer"))));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run RED command**

Run:

```bash
node test-artifacts/server/top-level-error-payload-tests.mjs
```

Expected result before implementation:

```text
FAIL  internal server error helper exists
FAIL  top-level catch preserves structured payloads
FAIL  top-level catch no longer serializes raw error message
```

Observed: command exited 1 with `0 passed, 3 failed`; the helper was missing and the top-level catch still serialized `error.message`.

### Task 2: Add Generic Internal Error Payload Helper

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add a path-safe generic payload helper**

Add this helper near `invalidRequestTargetError()`:

```js
function internalServerErrorPayload() {
  return {
    ok: false,
    code: "INTERNAL_SERVER_ERROR",
    error: "서버 처리 중 오류가 발생했습니다.",
  };
}
```

- [x] **Step 2: Use the helper in the top-level catch**

Replace the existing top-level catch fallback:

```js
    sendJson(res, error?.statusCode || 500, error?.payload || {
      ok: false,
      error: error.message,
    });
```

with:

```js
    sendJson(res, error?.statusCode || 500, error?.payload || internalServerErrorPayload(error));
```

- [x] **Step 3: Run focused GREEN command**

Run:

```bash
node --check server.js
node --check test-artifacts/server/top-level-error-payload-tests.mjs
node test-artifacts/server/top-level-error-payload-tests.mjs
```

Expected result after implementation:

```text
5 passed, 0 failed
```

Observed: command exited 0. `server.js` and the new test file passed syntax checks, and `top-level-error-payload-tests.mjs` reported `5 passed, 0 failed`.

### Task 3: Document The Generic Fallback Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update README public demo error contract**

Extend the public demo environment paragraph in `README.md` so payload-less top-level exceptions are documented as HTTP 500 `INTERNAL_SERVER_ERROR` without raw exception details.

- [x] **Step 2: Update external demo runbook smoke expectations**

Extend the external demo runbook smoke checklist so unexpected server exceptions are expected to use `INTERNAL_SERVER_ERROR` rather than raw local paths, `ENOENT`, or parser details.

### Task 4: Verify, Commit, Push, And Record Evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-top-level-internal-error-guard.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-top-level-internal-error-guard.md
placeholder_scan=$?
printf 'placeholder_scan_exit=%s\n' "$placeholder_scan"
test "$placeholder_scan" -eq 1
node --check server.js
node --check test-artifacts/server/top-level-error-payload-tests.mjs
node test-artifacts/server/top-level-error-payload-tests.mjs
npm test
git diff --check
```

Expected result:

```text
placeholder_scan_exit=1
5 passed, 0 failed
git diff --check exits 0
```

Observed: command exited 0 with `set -e`. Placeholder scan reported `placeholder_scan_exit=1`; syntax checks passed; `top-level-error-payload-tests.mjs` reported `5 passed, 0 failed`; `manifest-validation-tests.mjs` reported `62 passed, 0 failed`; full `npm test` reported `1112 passed, 0 failed across 37 test file(s)`; `git diff --check` exited 0.

- [x] **Step 2: Stage and re-run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-top-level-internal-error-guard.md server.js test-artifacts/server/manifest-validation-tests.mjs test-artifacts/server/top-level-error-payload-tests.mjs
git diff --cached --name-status
node --check server.js
node --check test-artifacts/server/top-level-error-payload-tests.mjs
node test-artifacts/server/top-level-error-payload-tests.mjs
npm test
git diff --cached --check
```

Expected result:

```text
README.md
docs/external-demo-runbook.md
docs/superpowers/plans/2026-06-08-top-level-internal-error-guard.md
server.js
test-artifacts/server/manifest-validation-tests.mjs
test-artifacts/server/top-level-error-payload-tests.mjs
5 passed, 0 failed
git diff --cached --check exits 0
```

Observed: command exited 0 with `set -e`. Cached name-status contained the six expected files; syntax checks passed; `top-level-error-payload-tests.mjs` reported `5 passed, 0 failed`; `manifest-validation-tests.mjs` reported `62 passed, 0 failed`; full `npm test` reported `1112 passed, 0 failed across 37 test file(s)`; `git diff --cached --check` exited 0.

- [ ] **Step 3: Commit and push**

Run:

```bash
git commit -m "ci: hide unstructured server errors"
git push origin main
```

- [ ] **Step 4: Confirm GitHub Actions and Obsidian**

Use `gh run list`, `gh run watch`, `gh run download`, and the read-only smoke summary to confirm the pushed `main` run passes. Update the Obsidian project note with commit, local QA, GitHub Actions run, artifact id, smoke result, sensitive/path scan result, and sync status.
