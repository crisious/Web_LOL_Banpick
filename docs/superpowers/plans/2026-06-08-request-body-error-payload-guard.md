# Request Body Error Payload Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return stable 400/413 JSON responses for malformed or oversized live API request bodies instead of letting parser errors surface as generic 500 responses.

**Architecture:** Keep body parsing in `server.js` inside `parseBody()`, and keep API catch blocks using `riotErrorPayload()`. Add request-body-specific metadata to parser errors, then teach `riotErrorPayload()` to honor safe HTTP error status codes before the Riot-specific mappings.

**Tech Stack:** Node.js built-in HTTP streams, plain JavaScript, existing `test-artifacts/**/*-tests.mjs` runner.

---

### Task 1: Add RED Coverage For Structured Request Body Errors

**Files:**
- Create: `test-artifacts/server/request-body-error-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-08-request-body-error-payload-guard.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/request-body-error-tests.mjs` with these checks:

```js
// Request body parser regression tests.
//
// Live API endpoints should return stable 400/413 JSON errors for malformed or
// oversized request bodies rather than exposing parser exceptions as 500s.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
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

function extractConstLine(source, name) {
  const match = source.match(new RegExp(`const ${name} = [^;]+;`));
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

const harness = new Function([
  extractConstLine(serverSrc, "MAX_BODY_BYTES"),
  extractFunctionSource(serverSrc, "parseBody"),
  extractFunctionSource(serverSrc, "riotErrorPayload"),
  "return { MAX_BODY_BYTES, parseBody, riotErrorPayload };",
].join("\n"))();

function reqFromChunks(chunks) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield Buffer.from(chunk);
      }
    },
  };
}

async function captureParseError(chunks) {
  try {
    await harness.parseBody(reqFromChunks(chunks));
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

check("valid JSON body parses",
  await harness.parseBody(reqFromChunks(["{\"gameName\":\"Lux\"}"])),
  { gameName: "Lux" });

check("empty body parses as object",
  await harness.parseBody(reqFromChunks([])),
  {});

const invalidJsonError = await captureParseError(["{\"gameName\":"]);
check("invalid JSON parse error status",
  invalidJsonError?.statusCode,
  400);
check("invalid JSON parse error code",
  invalidJsonError?.code,
  "INVALID_JSON_BODY");
check("invalid JSON payload maps to stable response",
  harness.riotErrorPayload(invalidJsonError),
  {
    status: 400,
    body: {
      ok: false,
      code: "INVALID_JSON_BODY",
      error: "요청 본문이 올바른 JSON 형식이 아닙니다.",
    },
  });
checkTrue("invalid JSON response does not expose SyntaxError",
  !JSON.stringify(harness.riotErrorPayload(invalidJsonError)).includes("SyntaxError"));

const oversizedError = await captureParseError(["x".repeat(harness.MAX_BODY_BYTES + 1)]);
check("oversized body error status",
  oversizedError?.statusCode,
  413);
check("oversized body error code",
  oversizedError?.code,
  "REQUEST_BODY_TOO_LARGE");
check("oversized body maps to stable response",
  harness.riotErrorPayload(oversizedError),
  {
    status: 413,
    body: {
      ok: false,
      code: "REQUEST_BODY_TOO_LARGE",
      error: "요청 본문이 너무 큽니다.",
    },
  });

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node test-artifacts/server/request-body-error-tests.mjs
```

Expected result before implementation: exit 1. The valid and empty body checks pass, while malformed JSON lacks `statusCode`/`code` and oversized body lacks a stable `code` plus `riotErrorPayload()` mapping.

Observed: `node test-artifacts/server/request-body-error-tests.mjs` exited 1 with `4 passed, 5 failed`. The failed assertions showed malformed JSON returning no `statusCode`/`code` and mapping to 500 `"Unexpected end of JSON input"`, while oversized body had no stable code and mapped to 500 `"Payload too large"`.

### Task 2: Implement Stable Request Body Error Mapping

**Files:**
- Modify: `server.js`
- Test: `test-artifacts/server/request-body-error-tests.mjs`

- [x] **Step 1: Add parser metadata for oversized and malformed JSON bodies**

Change `parseBody()` in `server.js` so it throws request errors like this:

```js
if (total > MAX_BODY_BYTES) {
  const error = new Error("요청 본문이 너무 큽니다.");
  error.statusCode = 413;
  error.code = "REQUEST_BODY_TOO_LARGE";
  throw error;
}
```

Then wrap `JSON.parse(raw)`:

```js
try {
  return raw ? JSON.parse(raw) : {};
} catch {
  const error = new Error("요청 본문이 올바른 JSON 형식이 아닙니다.");
  error.statusCode = 400;
  error.code = "INVALID_JSON_BODY";
  throw error;
}
```

- [x] **Step 2: Map safe statusCode errors before Riot-specific handling**

At the top of `riotErrorPayload(error)`, add:

```js
if (
  error &&
  Number.isInteger(error.statusCode) &&
  error.statusCode >= 400 &&
  error.statusCode <= 599
) {
  return {
    status: error.statusCode,
    body: {
      ok: false,
      ...(typeof error.code === "string" && error.code ? { code: error.code } : {}),
      error: error.message || "요청 처리 중 오류가 발생했습니다.",
    },
  };
}
```

- [x] **Step 3: Run focused test to verify it passes**

Run:

```bash
node --check server.js && node --check test-artifacts/server/request-body-error-tests.mjs && node test-artifacts/server/request-body-error-tests.mjs
```

Expected result after implementation: exit 0 with `9 passed, 0 failed`.

Observed: `node --check server.js && node --check test-artifacts/server/request-body-error-tests.mjs && node test-artifacts/server/request-body-error-tests.mjs` exited 0 with request body tests `9 passed, 0 failed`.

### Task 3: Document The Live API Body Error Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-request-body-error-payload-guard.md`

- [x] **Step 1: Add operator-facing contract text**

In `README.md`, add this sentence near the public demo/environment hardening paragraph:

```markdown
Live API POST endpoints return structured JSON for bad request bodies: malformed JSON returns HTTP 400 `INVALID_JSON_BODY`, and bodies over 1MB return HTTP 413 `REQUEST_BODY_TOO_LARGE`.
```

In `docs/external-demo-runbook.md`, add:

```markdown
Malformed live API JSON bodies should fail as HTTP 400 `INVALID_JSON_BODY`; request bodies over 1MB should fail as HTTP 413 `REQUEST_BODY_TOO_LARGE`, without leaking parser stack details.
```

- [x] **Step 2: Scan plan for placeholder failures**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-request-body-error-payload-guard.md
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
- Modify: `server.js`
- Create: `test-artifacts/server/request-body-error-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-08-request-body-error-payload-guard.md`

- [x] **Step 1: Run full local QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-request-body-error-payload-guard.md
placeholder_scan=$?
printf 'placeholder_scan_exit=%s\n' "$placeholder_scan"
test "$placeholder_scan" -eq 1
node --check server.js
node --check test-artifacts/server/request-body-error-tests.mjs
node test-artifacts/server/request-body-error-tests.mjs
npm test
git diff --check
```

Expected: exit 0, focused request body tests `9 passed, 0 failed`, and full suite has zero failures.

Observed: full local QA exited 0. Placeholder scan printed `placeholder_scan_exit=1`, syntax checks passed, focused request body tests reported `9 passed, 0 failed`, `npm test` reported `1029 passed, 0 failed across 33 test file(s)`, and `git diff --check` passed.

- [x] **Step 2: Stage and run cached QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-request-body-error-payload-guard.md server.js test-artifacts/server/request-body-error-tests.mjs
git diff --cached --name-status
node --check server.js
node --check test-artifacts/server/request-body-error-tests.mjs
node test-artifacts/server/request-body-error-tests.mjs
npm test
git diff --cached --check
```

Expected: exit 0 and staged files match the planned file list.

Observed: cached QA exited 0. Staged files were `README.md`, `docs/external-demo-runbook.md`, `docs/superpowers/plans/2026-06-08-request-body-error-payload-guard.md`, `server.js`, and `test-artifacts/server/request-body-error-tests.mjs`; focused request body tests reported `9 passed, 0 failed`; `npm test` reported `1029 passed, 0 failed across 33 test file(s)`; `git diff --cached --check` passed.

- [ ] **Step 3: Commit and push to main**

Run:

```bash
git commit -m "ci: return structured request body errors"
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

Expected: new run for the pushed commit concludes `success`, the `qa-automation-<run-id>` artifact exists, and read-only smoke reports `155 passed, 0 failed`.

### Self-Review

- Spec coverage: The plan covers malformed JSON, oversized body, response mapping, docs, local QA, push, remote artifact verification, and Obsidian evidence updates after execution.
- Placeholder scan target: The command in Task 3 checks the exact plan file for forbidden placeholders.
- Type consistency: `parseBody()` throws `Error` objects with `statusCode` and `code`; `riotErrorPayload()` consumes the same names.
