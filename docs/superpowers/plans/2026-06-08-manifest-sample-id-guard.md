# Manifest Sample Id Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject malformed sample ids in runtime `manifest.json` validation and make the HTTP sample detail route use the same shared id contract.

**Architecture:** Move the lowercase generated sample id rule into `lib/sample-manifest.js` as `SAMPLE_ID_PATTERN` plus `isValidSampleId(sampleId)`. `validateManifest()` rejects entries whose `id` does not match the shared helper before path validation, and `server.js` reuses the same helper for `/api/samples/:id` routing.

**Tech Stack:** Node.js CommonJS shared module, Node HTTP server, plain JavaScript regression tests under `test-artifacts/server`.

---

### Task 1: Add RED Coverage For Manifest Sample Id Shape

**Files:**
- Modify: `test-artifacts/server/manifest-shared-module-tests.mjs`
- Modify: `test-artifacts/server/manifest-validation-tests.mjs`
- Modify: `test-artifacts/server/sample-detail-id-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-08-manifest-sample-id-guard.md`

- [x] **Step 1: Extend shared manifest module tests**

In `test-artifacts/server/manifest-shared-module-tests.mjs`, include these names in the destructuring block:

```js
    SAMPLE_ID_PATTERN,
    isValidSampleId,
```

After the existing `raw path pattern export` check, add:

```js
  checkTrue("sample id pattern export", SAMPLE_ID_PATTERN instanceof RegExp);
  checkTrue("sample id helper export", typeof isValidSampleId === "function");
  check("sample id helper accepts generated id",
    typeof isValidSampleId === "function" ? isValidSampleId("sample-kr-1") : null,
    true);
  check("sample id helper accepts short demo id",
    typeof isValidSampleId === "function" ? isValidSampleId("sample-complete") : null,
    true);
  check("sample id helper rejects uppercase",
    typeof isValidSampleId === "function" ? isValidSampleId("Sample-KR-1") : null,
    false);
  check("sample id helper rejects slash",
    typeof isValidSampleId === "function" ? isValidSampleId("sample-kr/1") : null,
    false);
  check("sample id helper rejects encoded slash",
    typeof isValidSampleId === "function" ? isValidSampleId("sample%2Fsecret") : null,
    false);
  check("sample id helper rejects whitespace",
    typeof isValidSampleId === "function" ? isValidSampleId("sample-kr-1 ") : null,
    false);
  check("sample id helper rejects trailing hyphen",
    typeof isValidSampleId === "function" ? isValidSampleId("sample-kr-1-") : null,
    false);
```

- [x] **Step 2: Extend runtime manifest validation tests**

In `test-artifacts/server/manifest-validation-tests.mjs`, add this helper near `validManifest` and `legacyManifest`:

```js
  const sampleWithId = (id) => ({
    ...validSample,
    id,
    normalizedPath: `/data/samples/${id}/normalized-match.json`,
    analysisPath: `/data/samples/${id}/analysis-result.json`,
    notesPath: `/data/samples/${id}/${id}-notes.md`,
  });
```

In the invalid manifest loop, add these cases before the path validation cases:

```js
    ["manifest uppercase sample id is rejected", { samples: [sampleWithId("Sample-KR-1")] }, "Sample manifest entry id must be a lowercase generated sample id."],
    ["manifest slash sample id is rejected", { samples: [sampleWithId("sample-kr/1")] }, "Sample manifest entry id must be a lowercase generated sample id."],
    ["manifest encoded slash sample id is rejected", { samples: [sampleWithId("sample%2Fsecret")] }, "Sample manifest entry id must be a lowercase generated sample id."],
    ["manifest whitespace sample id is rejected", { samples: [sampleWithId("sample-kr-1 ")] }, "Sample manifest entry id must be a lowercase generated sample id."],
    ["manifest trailing hyphen sample id is rejected", { samples: [sampleWithId("sample-kr-1-")] }, "Sample manifest entry id must be a lowercase generated sample id."],
```

- [x] **Step 3: Extend sample detail route tests for shared helper use**

In `test-artifacts/server/sample-detail-id-tests.mjs`, keep the harness local id pattern fallback for the old implementation and add the shared helper stub immediately after it:

```js
  "const SAMPLE_DETAIL_ID_PATTERN = /^sample-[a-z0-9]+(?:-[a-z0-9]+)*$/;",
  "function isValidSampleId(sampleId) { return /^sample-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(sampleId || '')); }",
```

After the existing `server declares sample detail id helper` check, add:

```js
checkTrue("server imports shared sample id helper",
  /isValidSampleId/.test(serverSrc) && /require\("\.\/lib\/sample-manifest"\)/.test(serverSrc));
checkTrue("sample detail helper uses shared sample id validator",
  /function sampleDetailIdFromPathname\(pathname\)[\s\S]*isValidSampleId\(sampleId\)/.test(serverSrc));
```

- [x] **Step 4: Run tests to verify they fail**

Run:

```bash
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/server/sample-detail-id-tests.mjs
```

Expected result before implementation: exit non-zero. The shared module tests fail because `SAMPLE_ID_PATTERN` and `isValidSampleId` are not exported, manifest validation fails because malformed ids are not rejected with the new id message, and route tests fail because `server.js` still owns a local `SAMPLE_DETAIL_ID_PATTERN`.

Observed: command exited 1. Shared module tests reported `15 passed, 9 failed`; manifest validation tests reported `44 passed, 15 failed`; sample detail id tests reported `22 passed, 2 failed`.

### Task 2: Implement Shared Sample Id Validation

**Files:**
- Modify: `lib/sample-manifest.js`
- Modify: `server.js`
- Test: `test-artifacts/server/manifest-shared-module-tests.mjs`
- Test: `test-artifacts/server/manifest-validation-tests.mjs`
- Test: `test-artifacts/server/sample-detail-id-tests.mjs`

- [x] **Step 1: Add shared sample id pattern and helper**

In `lib/sample-manifest.js`, add this constant beside the other manifest constants:

```js
const SAMPLE_ID_PATTERN = /^sample-[a-z0-9]+(?:-[a-z0-9]+)*$/;
```

Add this helper after `manifestValidationError(message)`:

```js
function isValidSampleId(sampleId) {
  return SAMPLE_ID_PATTERN.test(String(sampleId || ""));
}
```

Add both names to `module.exports`:

```js
  SAMPLE_ID_PATTERN,
  isValidSampleId,
```

- [x] **Step 2: Reject malformed manifest sample ids before path validation**

In `validateManifest(manifest)`, after the missing required field check and before `validateManifestEntryPaths(sample)`, add:

```js
    if (!isValidSampleId(sample.id)) {
      invalidEntryMessage = "Sample manifest entry id must be a lowercase generated sample id.";
      return true;
    }
```

- [x] **Step 3: Reuse the shared helper in the HTTP route**

In `server.js`, add `isValidSampleId` to the existing `require("./lib/sample-manifest")` destructuring:

```js
  isValidSampleId,
```

Remove the local `SAMPLE_DETAIL_ID_PATTERN` constant.

Change `sampleDetailIdFromPathname(pathname)` from:

```js
  if (!SAMPLE_DETAIL_ID_PATTERN.test(sampleId)) {
    return null;
  }
```

to:

```js
  if (!isValidSampleId(sampleId)) {
    return null;
  }
```

- [x] **Step 4: Run focused tests**

Run:

```bash
node --check lib/sample-manifest.js
node --check server.js
node --check test-artifacts/server/manifest-shared-module-tests.mjs
node --check test-artifacts/server/manifest-validation-tests.mjs
node --check test-artifacts/server/sample-detail-id-tests.mjs
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/server/sample-detail-id-tests.mjs
```

Expected result after implementation: exit 0 with shared module tests `24 passed, 0 failed`, manifest validation tests `59 passed, 0 failed`, and sample detail id tests `24 passed, 0 failed`.

Observed: command exited 0. Syntax checks passed, shared module tests reported `24 passed, 0 failed`, manifest validation tests reported `59 passed, 0 failed`, and sample detail id tests reported `24 passed, 0 failed`.

### Task 3: Document Manifest Sample Id Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-manifest-sample-id-guard.md`

- [x] **Step 1: Add operator-facing notes**

In `README.md`, append this sentence after the stored sample detail route sentence:

```markdown
Runtime `manifest.json` validation enforces the same sample id rule so operator-provided `SAMPLES_DIR` manifests cannot publish ids that the detail route rejects.
```

In `docs/external-demo-runbook.md`, append this sentence to the long cloud deploy paragraph that describes `manifest.json` validation:

```markdown
Sample entry `id` values must also match the lowercase generated `sample-...` contract used by `/api/samples/:id`; uppercase, slash, encoded slash, whitespace, or trailing-hyphen ids fail with `SAMPLE_MANIFEST_INVALID`.
```

- [x] **Step 2: Scan plan for placeholder failures**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-manifest-sample-id-guard.md
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
- Create: `docs/superpowers/plans/2026-06-08-manifest-sample-id-guard.md`
- Modify: `lib/sample-manifest.js`
- Modify: `server.js`
- Modify: `test-artifacts/server/manifest-shared-module-tests.mjs`
- Modify: `test-artifacts/server/manifest-validation-tests.mjs`
- Modify: `test-artifacts/server/sample-detail-id-tests.mjs`

- [x] **Step 1: Run full local QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-manifest-sample-id-guard.md
placeholder_scan=$?
printf 'placeholder_scan_exit=%s\n' "$placeholder_scan"
test "$placeholder_scan" -eq 1
node --check lib/sample-manifest.js
node --check server.js
node --check test-artifacts/server/manifest-shared-module-tests.mjs
node --check test-artifacts/server/manifest-validation-tests.mjs
node --check test-artifacts/server/sample-detail-id-tests.mjs
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/server/sample-detail-id-tests.mjs
npm test
git diff --check
```

Expected: exit 0, focused tests match their zero-failure counts, and the full suite has zero failures.

Observed: command exited 0. Placeholder scan returned `placeholder_scan_exit=1`, syntax checks passed, shared module tests reported `24 passed, 0 failed`, manifest validation tests reported `59 passed, 0 failed`, sample detail id tests reported `24 passed, 0 failed`, `npm test` reported `1090 passed, 0 failed across 35 test file(s)`, and `git diff --check` passed.

- [x] **Step 2: Stage and run cached QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-manifest-sample-id-guard.md lib/sample-manifest.js server.js test-artifacts/server/manifest-shared-module-tests.mjs test-artifacts/server/manifest-validation-tests.mjs test-artifacts/server/sample-detail-id-tests.mjs
git diff --cached --name-status
node --check lib/sample-manifest.js
node --check server.js
node --check test-artifacts/server/manifest-shared-module-tests.mjs
node --check test-artifacts/server/manifest-validation-tests.mjs
node --check test-artifacts/server/sample-detail-id-tests.mjs
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/server/sample-detail-id-tests.mjs
npm test
git diff --cached --check
```

Expected: exit 0 and staged files match the planned file list.

Observed: command exited 0. Staged files were `README.md`, `docs/external-demo-runbook.md`, `docs/superpowers/plans/2026-06-08-manifest-sample-id-guard.md`, `lib/sample-manifest.js`, `server.js`, `test-artifacts/server/manifest-shared-module-tests.mjs`, `test-artifacts/server/manifest-validation-tests.mjs`, and `test-artifacts/server/sample-detail-id-tests.mjs`. Syntax checks passed, focused tests reported `24 passed, 0 failed`, `59 passed, 0 failed`, and `24 passed, 0 failed`, `npm test` reported `1090 passed, 0 failed across 35 test file(s)`, and `git diff --cached --check` passed.

- [ ] **Step 3: Commit and push to main**

Run:

```bash
git commit -m "ci: reject malformed manifest sample ids"
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

- Spec coverage: The plan covers malformed manifest sample ids, preservation of route behavior through the shared helper, docs, local QA, push, remote artifact verification, and Obsidian evidence updates after execution.
- Placeholder scan target: Task 3 scans this exact plan file for forbidden placeholders.
- Type consistency: `isValidSampleId(sampleId)` returns a boolean. `validateManifest()` consumes `false` by raising `SAMPLE_MANIFEST_INVALID`, while `sampleDetailIdFromPathname(pathname)` consumes `false` by returning `null` so `handleApi()` sends HTTP 400 `INVALID_SAMPLE_ID`.
