# Sample List Manifest Error Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a targeted external smoke probe that verifies `GET /api/samples` returns the expected structured JSON error when the stored sample manifest is invalid.

**Architecture:** Reuse the existing external smoke script's health and mode checks. Add an opt-in sample-list negative probe that calls `/api/samples`, verifies status, JSON/nosniff headers, `ok=false`, stable `code`, optional exact `error`, then exits before home/assets/sample-detail/live probes.

**Tech Stack:** Node.js 20+, vanilla HTTP test servers, existing zero-dependency test runner, existing `scripts/external-demo-smoke.mjs`.

---

### Task 1: Parser Contract

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Test: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Write failing parser tests**

Add assertions:

```js
check("parseSmokeArgs reads expected sample list error probe",
  parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "https://demo.example",
    "--expect-mode=readonly",
    "--expect-sample-list-error-status=500",
    "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-list-error-message=Sample manifest entry missing required field: label.",
  ], {}),
  {
    baseUrl: "https://demo.example",
    demoToken: "",
    expectedMode: "readonly",
    minSamples: 1,
    requestTimeoutMs: 10000,
    expectedSampleListError: {
      status: 500,
      code: "SAMPLE_MANIFEST_INVALID",
      message: "Sample manifest entry missing required field: label.",
    },
  });
```

Add validation assertions:

```js
checkThrows("parseSmokeArgs requires sample list error code when list error options are set",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-list-error-status=500",
  ], {}),
  "--expect-sample-list-error-code is required when sample list error options are set");

checkThrows("parseSmokeArgs rejects invalid sample list error status",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-list-error-status=ok",
  ], {}),
  "--expect-sample-list-error-status must be a positive integer");
```

- [x] **Step 2: Run parser tests and verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: FAIL because the parser does not yet return or validate `expectedSampleListError`.

- [x] **Step 3: Implement minimal parser support**

Add parsing for:

```js
const sampleListErrorCodeArg = args.find((arg) => arg.startsWith("--expect-sample-list-error-code="));
const sampleListErrorStatusArg = args.find((arg) => arg.startsWith("--expect-sample-list-error-status="));
const sampleListErrorMessageArg = args.find((arg) => arg.startsWith("--expect-sample-list-error-message="));
```

Return `expectedSampleListError` only when one of those flags is present. Default `status` to `500`, require non-empty `code`, and validate status as a positive integer.

- [x] **Step 4: Run parser tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: parser assertions pass; CLI probe tests may still fail until Task 2.

### Task 2: Targeted List Error Probe

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Test: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Write failing CLI tests**

Create a local HTTP server that records requests, returns valid `/healthz`, and returns:

```js
{
  ok: false,
  code: "SAMPLE_MANIFEST_INVALID",
  error: "Sample manifest entry missing required field: label."
}
```

for `/api/samples` with status `500` and `X-Content-Type-Options: nosniff`. Run:

```bash
node scripts/external-demo-smoke.mjs "$URL" \
  --expect-mode=readonly \
  --expect-sample-list-error-status=500 \
  --expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID \
  --expect-sample-list-error-message="Sample manifest entry missing required field: label."
```

Assert status `0`, stdout includes `PASS sample list error returns 500`, and recorded requests are exactly `/healthz`, `/api/samples`.

Add a wrong-code server and assert exit `1` with `FAIL sample list error returns SAMPLE_MANIFEST_INVALID`.

- [x] **Step 2: Run tests and verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: FAIL because the smoke script still proceeds through the normal full flow and expects `/api/samples` status `200`.

- [x] **Step 3: Implement the probe**

After health and mode checks, before home/assets probes, add:

```js
if (expectedSampleListError) {
  const samplesOut = await request("/api/samples");
  expectStructuredErrorResponse(samplesOut, "sample list error", expectedSampleListError);
  if (process.exitCode) process.exit(process.exitCode);
  console.log(`External demo sample list error smoke passed for ${baseUrl}`);
  process.exit(0);
}
```

If useful, extract the shared status/header/body checks used by sample detail errors into `expectStructuredErrorResponse(out, label, expected)`.

- [x] **Step 4: Run tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: all script tests pass.

### Task 3: Runtime QA And Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document the list error probe**

Add a concise command:

```bash
node scripts/external-demo-smoke.mjs http://127.0.0.1:8123 \
  --expect-mode=readonly \
  --expect-sample-list-error-status=500 \
  --expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID \
  --expect-sample-list-error-message="Sample manifest entry missing required field: label."
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

- [x] **Step 3: Run runtime negative smoke**

Start a read-only server with a temporary `SAMPLES_DIR` whose `manifest.json` has a sample entry missing `label`. Run the new list-error smoke and verify it exits `0` with `External demo sample list error smoke passed`.

- [x] **Step 4: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-08-sample-list-manifest-error-smoke.md scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md "/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md"
git commit -m "test: add sample list manifest error smoke"
git push origin main
```

Expected: `git rev-list --left-right --count main...origin/main` returns `0 0`.

### Self-Review

- Spec coverage: Parser, CLI behavior, docs, runtime smoke, commit/push are covered.
- Placeholder scan: No incomplete placeholders remain.
- Type consistency: `expectedSampleListError` consistently uses `status`, `code`, and `message`.
