# Manifest Write Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent invalid manifest shapes from being written back to `manifest.json`.

**Architecture:** Reuse the existing `validateManifest()` guard on the write path. `saveManifest()` validates before calling `writeJson`, so future write callers cannot persist a manifest that the read path would reject.

**Tech Stack:** Node.js `fs.promises`, existing source-extraction tests, npm smoke scripts.

---

### Task 1: Save Manifest Validation Regression Test

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/manifest-validation-tests.mjs`

- [x] **Step 1: Add failing write-path tests**

Add coverage for both valid and invalid saves:

```js
check("saveManifest writes valid manifest", events, [
  { op: "writeJson", filePath: "/samples/manifest.json", data: validManifest },
]);

check("saveManifest rejects invalid manifest before write", caught?.payload?.code, "SAMPLE_MANIFEST_INVALID");
check("saveManifest does not write invalid manifest", events, []);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/server/manifest-validation-tests.mjs
```

Expected: fails because `saveManifest()` currently writes without validating first.

### Task 2: Minimal Write Validation

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/server.js`

- [x] **Step 1: Validate inside `saveManifest`**

Change:

```js
async function saveManifest(manifest) {
  await writeJson(manifestPath, manifest);
}
```

to:

```js
async function saveManifest(manifest) {
  await writeJson(manifestPath, validateManifest(manifest));
}
```

- [x] **Step 2: Verify GREEN**

Run:

```bash
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/server/manifest-mutation-queue-tests.mjs
```

Expected: both pass.

### Task 3: Documentation And Full QA

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/README.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document write-side validation**

Update manifest stability notes to mention validation before both read consumption and write persistence.

- [x] **Step 2: Run verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/manifest-validation-tests.mjs
git diff --check
npm test
```

Expected: all commands exit 0; `npm test` includes the new assertions and reports all tests passed.

- [x] **Step 3: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-07-manifest-write-validation.md server.js test-artifacts/server/manifest-validation-tests.mjs
git commit -m "fix: validate manifest before saving"
git push origin main
```
