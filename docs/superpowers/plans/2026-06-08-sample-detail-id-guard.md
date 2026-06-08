# Sample Detail Id Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject malformed `/api/samples/:id` sample detail ids before manifest lookup so external demo requests receive a stable HTTP 400 `INVALID_SAMPLE_ID` response.

**Architecture:** Add a small sample-id route helper in `server.js` that accepts only lowercase generated sample ids shaped like `sample-kr-8242613150` or `sample-complete`. Use it inside the existing `handleApi(req, res, url)` sample detail branch before `loadSampleBundle(sampleId)`, preserving normal 200 and unknown well-formed 404 behavior.

**Tech Stack:** Node.js built-in HTTP server, plain JavaScript regression tests under `test-artifacts/server`, existing README and external demo runbook documentation.

---

### Task 1: Add RED Coverage For Malformed Sample Detail Ids

**Files:**
- Create: `test-artifacts/server/sample-detail-id-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-08-sample-detail-id-guard.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/sample-detail-id-tests.mjs` with this content:

```js
// Sample detail id route guard regression tests.
//
// /api/samples/:id should reject malformed ids before manifest lookup while
// preserving existing valid and not-found behavior for well-formed ids.

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

const maybeSampleDetailIdSource = serverSrc.includes("function sampleDetailIdFromPathname(")
  ? extractFunctionSource(serverSrc, "sampleDetailIdFromPathname")
  : "";
const maybeInvalidSampleIdPayloadSource = serverSrc.includes("function invalidSampleIdPayload(")
  ? extractFunctionSource(serverSrc, "invalidSampleIdPayload")
  : "";

const events = [];
const harness = new Function("events", [
  "const SAMPLE_DETAIL_PATH_PREFIX = '/api/samples/';",
  "const SAMPLE_DETAIL_ID_PATTERN = /^sample-[a-z0-9]+(?:-[a-z0-9]+)*$/;",
  "function sendJson(res, status, body) { res.sent = { status, body }; }",
  "function publicDemoModeHealth() { return {}; }",
  "function sampleGenerationHealth() { return {}; }",
  "async function loadManifest() { events.push({ op: 'loadManifest' }); return { samples: [] }; }",
  "function inferMatchIdFromSampleEntry(sample) { return sample.matchId || null; }",
  "async function loadSampleBundle(sampleId) { events.push({ op: 'loadSampleBundle', sampleId }); return sampleId === 'sample-complete' ? { ok: true, sampleId } : null; }",
  "function requireLiveApiAccess() { events.push({ op: 'requireLiveApiAccess' }); return false; }",
  "async function handleRecentMatches() { events.push({ op: 'handleRecentMatches' }); }",
  "async function handleChampionHistory() { events.push({ op: 'handleChampionHistory' }); }",
  "async function handleGenerateSample() { events.push({ op: 'handleGenerateSample' }); }",
  maybeSampleDetailIdSource,
  maybeInvalidSampleIdPayloadSource,
  extractFunctionSource(serverSrc, "handleApi"),
  "return { handleApi };",
].join("\n"))(events);

function makeRes() {
  return { sent: null };
}

async function requestPath(pathname) {
  events.length = 0;
  const res = makeRes();
  const handled = await harness.handleApi({ method: "GET" }, res, { pathname });
  return { handled, res, events: [...events] };
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

const validDetail = await requestPath("/api/samples/sample-complete");
check("valid sample detail is handled",
  validDetail.handled,
  true);
check("valid sample detail status",
  validDetail.res.sent?.status,
  200);
check("valid sample detail loads requested id",
  validDetail.events,
  [{ op: "loadSampleBundle", sampleId: "sample-complete" }]);

const missingDetail = await requestPath("/api/samples/sample-missing");
check("well-formed missing sample detail status",
  missingDetail.res.sent?.status,
  404);
check("well-formed missing sample still loads manifest path",
  missingDetail.events,
  [{ op: "loadSampleBundle", sampleId: "sample-missing" }]);

for (const [label, pathname] of [
  ["empty id", "/api/samples/"],
  ["uppercase id", "/api/samples/Sample-KR-1"],
  ["encoded slash id", "/api/samples/sample%2Fsecret"],
  ["space encoded id", "/api/samples/sample%20id"],
  ["extra path segment", "/api/samples/sample-complete/analysis"],
]) {
  const out = await requestPath(pathname);
  check(`${label} status`,
    out.res.sent?.status,
    400);
  check(`${label} code`,
    out.res.sent?.body?.code,
    "INVALID_SAMPLE_ID");
  check(`${label} does not load sample bundle`,
    out.events,
    []);
}

checkTrue("server declares sample detail id helper",
  /function sampleDetailIdFromPathname\(pathname\)/.test(serverSrc));
checkTrue("sample detail branch validates id before loadSampleBundle",
  /const sampleId = sampleDetailIdFromPathname\(url\.pathname\);[\s\S]*if \(!sampleId\)[\s\S]*sendJson\(res,\s*400,\s*invalidSampleIdPayload\(\)\);[\s\S]*loadSampleBundle\(sampleId\)/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node test-artifacts/server/sample-detail-id-tests.mjs
```

Expected result before implementation: exit 1. Valid and unknown well-formed detail cases pass, while malformed id cases return 404 and call `loadSampleBundle` until the guard exists.

Observed: `node test-artifacts/server/sample-detail-id-tests.mjs` exited 1 with `5 passed, 17 failed`. The malformed id cases returned 404, exposed no `INVALID_SAMPLE_ID` code, and called `loadSampleBundle` with the raw malformed id.

### Task 2: Implement Sample Detail Id Guard

**Files:**
- Modify: `server.js`
- Test: `test-artifacts/server/sample-detail-id-tests.mjs`

- [x] **Step 1: Add constants and helpers**

Insert these constants near the existing manifest/sample path constants:

```js
const SAMPLE_DETAIL_PATH_PREFIX = "/api/samples/";
const SAMPLE_DETAIL_ID_PATTERN = /^sample-[a-z0-9]+(?:-[a-z0-9]+)*$/;
```

Insert these helpers before `handleApi(req, res, url)`:

```js
function invalidSampleIdPayload() {
  return {
    ok: false,
    code: "INVALID_SAMPLE_ID",
    error: "샘플 ID가 올바르지 않습니다.",
  };
}

function sampleDetailIdFromPathname(pathname) {
  const pathValue = String(pathname || "");
  if (!pathValue.startsWith(SAMPLE_DETAIL_PATH_PREFIX)) {
    return null;
  }
  const sampleId = pathValue.slice(SAMPLE_DETAIL_PATH_PREFIX.length);
  if (!SAMPLE_DETAIL_ID_PATTERN.test(sampleId)) {
    return null;
  }
  return sampleId;
}
```

- [x] **Step 2: Use the helper in the sample detail route**

Change the sample detail branch in `handleApi(req, res, url)` to:

```js
  if (req.method === "GET" && url.pathname.startsWith(SAMPLE_DETAIL_PATH_PREFIX)) {
    const sampleId = sampleDetailIdFromPathname(url.pathname);
    if (!sampleId) {
      sendJson(res, 400, invalidSampleIdPayload());
      return true;
    }
    const bundle = await loadSampleBundle(sampleId);
    if (!bundle) {
      sendJson(res, 404, { ok: false, error: "Sample not found." });
      return true;
    }
    sendJson(res, 200, bundle);
    return true;
  }
```

- [x] **Step 3: Run focused test**

Run:

```bash
node --check server.js
node --check test-artifacts/server/sample-detail-id-tests.mjs
node test-artifacts/server/sample-detail-id-tests.mjs
```

Expected result after implementation: exit 0 with `22 passed, 0 failed`.

Observed: `node --check server.js`, `node --check test-artifacts/server/sample-detail-id-tests.mjs`, and `node test-artifacts/server/sample-detail-id-tests.mjs` exited 0 with sample detail id tests `22 passed, 0 failed`.

### Task 3: Document The Sample Detail Id Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-sample-detail-id-guard.md`

- [x] **Step 1: Add operator-facing notes**

Append this sentence after the existing request body error sentence in `README.md`:

```markdown
Stored sample detail routes only accept lowercase generated ids shaped like `sample-...`; malformed `/api/samples/:id` values return HTTP 400 `INVALID_SAMPLE_ID` before manifest lookup.
```

Add this bullet after the sample detail smoke bullet in `docs/external-demo-runbook.md`:

```markdown
- malformed `/api/samples/:id` values, including empty ids, encoded slashes, spaces, or uppercase ids, fail as HTTP 400 `INVALID_SAMPLE_ID` before manifest lookup
```

- [x] **Step 2: Scan plan for placeholder failures**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-sample-detail-id-guard.md
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
- Create: `docs/superpowers/plans/2026-06-08-sample-detail-id-guard.md`
- Modify: `server.js`
- Create: `test-artifacts/server/sample-detail-id-tests.mjs`

- [x] **Step 1: Run full local QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-sample-detail-id-guard.md
placeholder_scan=$?
printf 'placeholder_scan_exit=%s\n' "$placeholder_scan"
test "$placeholder_scan" -eq 1
node --check server.js
node --check test-artifacts/server/sample-detail-id-tests.mjs
node test-artifacts/server/sample-detail-id-tests.mjs
npm test
git diff --check
```

Expected: exit 0, sample detail id tests `22 passed, 0 failed`, and the full suite has zero failures.

Observed: command exited 0. Placeholder scan returned `placeholder_scan_exit=1`, syntax checks passed, sample detail id tests reported `22 passed, 0 failed`, `npm test` reported `1064 passed, 0 failed across 35 test file(s)`, and `git diff --check` passed.

- [x] **Step 2: Stage and run cached QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-sample-detail-id-guard.md server.js test-artifacts/server/sample-detail-id-tests.mjs
git diff --cached --name-status
node --check server.js
node --check test-artifacts/server/sample-detail-id-tests.mjs
node test-artifacts/server/sample-detail-id-tests.mjs
npm test
git diff --cached --check
```

Expected: exit 0 and staged files match the planned file list.

Observed: command exited 0. Staged files were `README.md`, `docs/external-demo-runbook.md`, `docs/superpowers/plans/2026-06-08-sample-detail-id-guard.md`, `server.js`, and `test-artifacts/server/sample-detail-id-tests.mjs`. Placeholder scan returned `placeholder_scan_exit=1`, syntax checks passed, sample detail id tests reported `22 passed, 0 failed`, `npm test` reported `1064 passed, 0 failed across 35 test file(s)`, and `git diff --cached --check` passed.

- [ ] **Step 3: Commit and push to main**

Run:

```bash
git commit -m "ci: reject malformed sample detail ids"
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

- Spec coverage: The plan covers malformed sample detail ids, preservation of valid 200 behavior, preservation of well-formed unknown 404 behavior, docs, local QA, push, remote artifact verification, and Obsidian evidence updates after execution.
- Placeholder scan target: Task 3 scans this exact plan file for forbidden placeholders.
- Type consistency: `sampleDetailIdFromPathname(pathname)` returns a string id or `null`; `handleApi()` consumes `null` by sending HTTP 400 `INVALID_SAMPLE_ID` and returning `true`.
