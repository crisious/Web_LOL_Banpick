# Manifest Runtime Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return a stable, diagnosable server error when `manifest.json` is valid JSON but has an invalid runtime shape.

**Architecture:** Add a small manifest validation layer immediately after `readJson(manifestPath)`. Validation failures throw an error with `statusCode` and `payload`, and the top-level request handler reuses that payload instead of leaking TypeError internals.

**Tech Stack:** Node.js `fs.promises`, existing source-extraction tests, npm smoke scripts.

---

### Task 1: Manifest Validation Regression Test

**Files:**
- Create: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/manifest-validation-tests.mjs`

- [x] **Step 1: Add failing validation tests**

Cover these behaviors:

```js
check("valid manifest passes through", validateManifest(validManifest), validManifest);
check("manifest without samples throws stable code", caught?.payload?.code, "SAMPLE_MANIFEST_INVALID");
check("loadManifest validates data after readJson", events, [{ op: "readJson", filePath: "/samples/manifest.json" }]);
checkTrue("server catch reuses structured payload", /error\?\.payload/.test(serverHandlerSrc));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/server/manifest-validation-tests.mjs
```

Expected: fails because `validateManifest` does not exist and the top-level catch does not reuse structured payloads yet.

### Task 2: Minimal Runtime Validation

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/server.js`

- [x] **Step 1: Add a structured manifest error helper**

Add:

```js
function manifestValidationError(message) {
  const error = new Error(message);
  error.statusCode = 500;
  error.payload = {
    ok: false,
    code: "SAMPLE_MANIFEST_INVALID",
    error: message,
  };
  return error;
}
```

- [x] **Step 2: Add `validateManifest`**

Add:

```js
function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw manifestValidationError("Sample manifest must be a JSON object.");
  }
  if (!Array.isArray(manifest.samples)) {
    throw manifestValidationError("Sample manifest must include a samples array.");
  }
  const hasInvalidEntry = manifest.samples.some((sample) =>
    !sample || typeof sample !== "object" ||
    typeof sample.id !== "string" ||
    typeof sample.normalizedPath !== "string" ||
    typeof sample.analysisPath !== "string"
  );
  if (hasInvalidEntry) {
    throw manifestValidationError("Sample manifest contains an invalid sample entry.");
  }
  return manifest;
}
```

- [x] **Step 3: Wire `loadManifest` and top-level catch**

Change `loadManifest` to:

```js
async function loadManifest() {
  return validateManifest(await readJson(manifestPath));
}
```

Change the top-level catch to send `error.payload` when present:

```js
sendJson(res, error?.statusCode || 500, error?.payload || {
  ok: false,
  error: error.message,
});
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/server/samples-dir-tests.mjs
```

Expected: both pass.

### Task 3: Documentation And Full QA

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/README.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document runtime manifest validation**

Update manifest stability notes to mention runtime manifest shape validation and the `SAMPLE_MANIFEST_INVALID` diagnostic code.

- [x] **Step 2: Run verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/manifest-validation-tests.mjs
git diff --check
npm test
```

Expected: all commands exit 0; `npm test` includes the new test file and reports all tests passed.

- [x] **Step 3: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-07-manifest-runtime-validation.md server.js test-artifacts/server/manifest-validation-tests.mjs
git commit -m "fix: validate sample manifest shape"
git push origin main
```
