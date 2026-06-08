# Manifest Duplicate Sample Id Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject operator-provided sample manifests that contain duplicate `samples[].id` values before `/api/samples` or `/api/samples/:id` can publish ambiguous sample metadata.

**Architecture:** Keep the guard inside `lib/sample-manifest.js` so runtime load/save validation and stored fixture checks share one contract. Extend focused manifest module tests and runtime validation tests, then document the new `SAMPLE_MANIFEST_INVALID` condition for external demo operations.

**Tech Stack:** Node.js CommonJS helpers, repository custom `.mjs` test harnesses, markdown ops docs.

---

### Task 1: Add RED Tests For Duplicate Sample Ids

**Files:**
- Modify: `test-artifacts/server/manifest-shared-module-tests.mjs`
- Modify: `test-artifacts/server/manifest-validation-tests.mjs`

- [x] **Step 1: Add shared module regression coverage**

Add this check after the existing `legacy manifest normalizes through shared module` assertion in `test-artifacts/server/manifest-shared-module-tests.mjs`:

```js
  {
    let caught = null;
    try {
      validateManifest({
        samples: [
          validSample,
          {
            ...validSample,
            matchId: "KR_2",
            label: "sample-kr-1 duplicate",
          },
        ],
      });
    } catch (error) {
      caught = error;
    }
    check("duplicate sample ids reject through shared module",
      caught?.payload?.error,
      "Sample manifest entry id must be unique: sample-kr-1.");
  }
```

- [x] **Step 2: Add runtime manifest validation coverage**

Add this case inside the invalid manifest table in `test-artifacts/server/manifest-validation-tests.mjs`, immediately after the malformed sample id cases:

```js
    ["manifest duplicate sample id is rejected", {
      samples: [
        validSample,
        {
          ...validSample,
          matchId: "KR_2",
          label: "sample-kr-1 duplicate",
        },
      ],
    }, "Sample manifest entry id must be unique: sample-kr-1."],
```

- [x] **Step 3: Run RED command**

Run:

```bash
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
```

Expected result before implementation:

```text
FAIL  duplicate sample ids reject through shared module
FAIL  manifest duplicate sample id is rejected: status
FAIL  manifest duplicate sample id is rejected: code
FAIL  manifest duplicate sample id is rejected: message
```

Observed: command exited 1. Shared module tests reported `24 passed, 1 failed`; runtime validation tests reported `59 passed, 3 failed`.

### Task 2: Implement Shared Duplicate Id Validation

**Files:**
- Modify: `lib/sample-manifest.js`

- [x] **Step 1: Add a seen-id set inside `validateManifest`**

Inside `validateManifest`, create a set immediately before `versionedManifest.samples.some(...)`:

```js
  const seenSampleIds = new Set();
```

- [x] **Step 2: Reject duplicates after id format validation**

Inside the sample validation callback, immediately after `isValidSampleId(sample.id)` succeeds and before path validation, add:

```js
    if (seenSampleIds.has(sample.id)) {
      invalidEntryMessage = `Sample manifest entry id must be unique: ${sample.id}.`;
      return true;
    }
    seenSampleIds.add(sample.id);
```

- [x] **Step 3: Run focused GREEN command**

Run:

```bash
node --check lib/sample-manifest.js
node --check test-artifacts/server/manifest-shared-module-tests.mjs
node --check test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
```

Expected result after implementation:

```text
duplicate sample ids reject through shared module
manifest duplicate sample id is rejected: status
manifest duplicate sample id is rejected: code
manifest duplicate sample id is rejected: message
0 failed
```

Observed: command exited 0. Syntax checks passed, shared module tests reported `25 passed, 0 failed`, and runtime validation tests reported `62 passed, 0 failed`.

### Task 3: Document The Operator-Facing Failure Mode

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update README manifest validation text**

Extend the sample manifest validation paragraph in `README.md` so it states that duplicate `samples[].id` values fail as `SAMPLE_MANIFEST_INVALID`.

- [x] **Step 2: Update external demo runbook cloud notes**

Extend the cloud deploy manifest paragraph in `docs/external-demo-runbook.md` so duplicate sample entry ids are listed with the other invalid runtime manifest states.

### Task 4: Verify, Commit, Push, And Record Evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-manifest-duplicate-sample-id-guard.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-manifest-duplicate-sample-id-guard.md
placeholder_scan=$?
printf 'placeholder_scan_exit=%s\n' "$placeholder_scan"
test "$placeholder_scan" -eq 1
node --check lib/sample-manifest.js
node --check test-artifacts/server/manifest-shared-module-tests.mjs
node --check test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
npm test
git diff --check
```

Expected result:

```text
placeholder_scan_exit=1
0 failed
git diff --check exits 0
```

Observed: command exited 0. Placeholder scan reported `placeholder_scan_exit=1`; focused tests reported `25 passed, 0 failed` and `62 passed, 0 failed`; full `npm test` reported `1094 passed, 0 failed across 35 test file(s)`; `git diff --check` exited 0.

- [x] **Step 2: Stage and re-run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-manifest-duplicate-sample-id-guard.md lib/sample-manifest.js test-artifacts/server/manifest-shared-module-tests.mjs test-artifacts/server/manifest-validation-tests.mjs
git diff --cached --name-status
node --check lib/sample-manifest.js
node --check test-artifacts/server/manifest-shared-module-tests.mjs
node --check test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
npm test
git diff --cached --check
```

Expected result:

```text
README.md
docs/external-demo-runbook.md
docs/superpowers/plans/2026-06-08-manifest-duplicate-sample-id-guard.md
lib/sample-manifest.js
test-artifacts/server/manifest-shared-module-tests.mjs
test-artifacts/server/manifest-validation-tests.mjs
0 failed
git diff --cached --check exits 0
```

Observed: command exited 0. Cached name-status contained the six expected files; syntax checks passed; focused tests reported `25 passed, 0 failed` and `62 passed, 0 failed`; full `npm test` reported `1094 passed, 0 failed across 35 test file(s)`; `git diff --cached --check` exited 0.

- [ ] **Step 3: Commit and push**

Run:

```bash
git commit -m "ci: reject duplicate manifest sample ids"
git push origin main
```

- [ ] **Step 4: Confirm GitHub Actions and Obsidian**

Use `gh run list`, `gh run watch`, `gh run download`, and the read-only smoke summary to confirm the pushed `main` run passes. Update the Obsidian project note with commit, local QA, GitHub Actions run, artifact id, smoke result, and sync status.
