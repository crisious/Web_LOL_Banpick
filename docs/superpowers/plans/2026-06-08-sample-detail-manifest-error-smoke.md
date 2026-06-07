# Sample Detail Manifest Error Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a targeted external smoke probe that verifies `GET /api/samples/:id` returns the expected structured JSON error when the stored sample manifest is invalid.

**Architecture:** Keep the existing full smoke flow unchanged for read-only/protected demos. Add an opt-in negative probe mode to `scripts/external-demo-smoke.mjs` that runs after `/healthz` and mode validation, calls one sample detail endpoint directly, checks status, JSON/nosniff headers, `ok=false`, stable `code`, and optional exact `error`, then exits before home/assets/sample-list/live probes.

**Tech Stack:** Node.js 20+, vanilla HTTP test servers, existing `test-artifacts/scripts/external-demo-smoke-tests.mjs`, existing `sendJson` structured error handling in `server.js`.

---

### Task 1: CLI Argument Contract

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Test: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Write failing parser tests**

Add parser assertions for the new flags:

```js
check("parseSmokeArgs reads expected sample detail error probe",
  parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "https://demo.example",
    "--expect-mode=readonly",
    "--expect-sample-detail-error-id=sample-kr-1",
    "--expect-sample-detail-error-status=500",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-detail-error-message=Sample manifest entry path must not contain traversal segments: normalizedPath.",
  ], {}),
  {
    baseUrl: "https://demo.example",
    demoToken: "",
    expectedMode: "readonly",
    minSamples: 1,
    requestTimeoutMs: 10000,
    expectedSampleDetailError: {
      id: "sample-kr-1",
      status: 500,
      code: "SAMPLE_MANIFEST_INVALID",
      message: "Sample manifest entry path must not contain traversal segments: normalizedPath.",
    },
  });
```

Add validation failures:

```js
checkThrows("parseSmokeArgs requires sample detail error code with id",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-detail-error-id=sample-kr-1",
  ], {}),
  "--expect-sample-detail-error-code is required when --expect-sample-detail-error-id is set");

checkThrows("parseSmokeArgs rejects invalid sample detail error status",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-detail-error-id=sample-kr-1",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-detail-error-status=ok",
  ], {}),
  "--expect-sample-detail-error-status must be a positive integer");
```

- [x] **Step 2: Run parser tests and verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: FAIL because `parseSmokeArgs` does not return `expectedSampleDetailError` and does not validate the new flags.

- [x] **Step 3: Implement minimal parser support**

Add parsing for:

```js
const sampleDetailErrorIdArg = args.find((arg) => arg.startsWith("--expect-sample-detail-error-id="));
const sampleDetailErrorCodeArg = args.find((arg) => arg.startsWith("--expect-sample-detail-error-code="));
const sampleDetailErrorStatusArg = args.find((arg) => arg.startsWith("--expect-sample-detail-error-status="));
const sampleDetailErrorMessageArg = args.find((arg) => arg.startsWith("--expect-sample-detail-error-message="));
const expectedSampleDetailError = sampleDetailErrorIdArg ? {
  id: sampleDetailErrorIdArg.slice("--expect-sample-detail-error-id=".length).trim(),
  status: sampleDetailErrorStatusArg ? Number(sampleDetailErrorStatusArg.slice("--expect-sample-detail-error-status=".length)) : 500,
  code: sampleDetailErrorCodeArg ? sampleDetailErrorCodeArg.slice("--expect-sample-detail-error-code=".length).trim() : "",
  message: sampleDetailErrorMessageArg ? sampleDetailErrorMessageArg.slice("--expect-sample-detail-error-message=".length) : "",
} : null;
```

Validate non-empty id, required code, and positive integer status.

- [x] **Step 4: Run parser tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the new parser assertions pass; remaining CLI behavior may still need Task 2.

### Task 2: Targeted Negative Probe

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Test: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Write failing CLI smoke tests**

Add a local HTTP server that returns a valid `/healthz`, returns `500` for `/api/samples/sample-bad`, and records requests. Run the smoke script with:

```bash
node scripts/external-demo-smoke.mjs "$URL" \
  --expect-mode=readonly \
  --expect-sample-detail-error-id=sample-bad \
  --expect-sample-detail-error-status=500 \
  --expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID \
  --expect-sample-detail-error-message="Sample manifest entry path must not contain traversal segments: normalizedPath."
```

Assert status `0`, stdout contains `PASS sample detail error sample-bad returns 500`, and recorded requests are exactly:

```js
[
  { method: "GET", url: "/healthz" },
  { method: "GET", url: "/api/samples/sample-bad" },
]
```

Add a second server that returns wrong `code` and assert the CLI exits `1` with `FAIL sample detail error sample-bad returns SAMPLE_MANIFEST_INVALID`.

- [x] **Step 2: Run tests and verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: FAIL because the smoke script still continues into home/assets/sample-list probes and lacks targeted detail-error assertions.

- [x] **Step 3: Implement the direct detail probe**

After `/healthz` and optional `--expect-mode` validation, add:

```js
if (expectedSampleDetailError) {
  const detailPath = `/api/samples/${encodeURIComponent(expectedSampleDetailError.id)}`;
  const detail = await request(detailPath);
  expect(detail.response.status === expectedSampleDetailError.status, `sample detail error ${expectedSampleDetailError.id} returns ${expectedSampleDetailError.status}`, `status=${detail.response.status}`);
  expectJsonResponse(detail, `sample detail error ${expectedSampleDetailError.id}`);
  expect(detail.body?.ok === false, `sample detail error ${expectedSampleDetailError.id} has ok=false`);
  expect(detail.body?.code === expectedSampleDetailError.code, `sample detail error ${expectedSampleDetailError.id} returns ${expectedSampleDetailError.code}`, `code=${detail.body?.code || "(missing)"}`);
  if (expectedSampleDetailError.message) {
    expect(detail.body?.error === expectedSampleDetailError.message, `sample detail error ${expectedSampleDetailError.id} returns expected message`, `error=${detail.body?.error || "(missing)"}`);
  }
  if (process.exitCode) process.exit(process.exitCode);
  console.log(`External demo sample detail error smoke passed for ${baseUrl}`);
  process.exit(0);
}
```

- [x] **Step 4: Run tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: all script tests pass.

### Task 3: Runtime QA And Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document the negative smoke option**

Add a concise note that invalid manifest deployments can be checked with:

```bash
node scripts/external-demo-smoke.mjs http://127.0.0.1:8123 \
  --expect-mode=readonly \
  --expect-sample-detail-error-id=sample-kr-1 \
  --expect-sample-detail-error-status=500 \
  --expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID \
  --expect-sample-detail-error-message="Sample manifest entry path must not contain traversal segments: normalizedPath."
```

- [x] **Step 2: Run full verification**

Run:

```bash
node --check scripts/external-demo-smoke.mjs
node --check test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/external-demo-smoke-tests.mjs
git diff --check
npm test
```

Expected: all commands exit `0`.

- [x] **Step 3: Run local runtime smoke**

Start a read-only server with a temporary `SAMPLES_DIR` whose `manifest.json` has one sample entry containing `normalizedPath: "/data/samples/../secret.json"`. Then run the targeted command from Step 1 and verify it exits `0` with `External demo sample detail error smoke passed`.

- [x] **Step 4: Commit and push to main**

Run:

```bash
git status -sb
git add docs/superpowers/plans/2026-06-08-sample-detail-manifest-error-smoke.md scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md "/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md"
git commit -m "test: add sample detail manifest error smoke"
git push origin main
```

Expected: commit and push succeed; `git rev-list --left-right --count main...origin/main` returns `0 0`.

### Self-Review

- Spec coverage: The plan covers parser contract, direct `/api/samples/:id` negative smoke behavior, docs, runtime QA, and `main` push.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague “add tests” placeholders remain.
- Type consistency: The option object is consistently named `expectedSampleDetailError` and contains `id`, `status`, `code`, and `message`.
