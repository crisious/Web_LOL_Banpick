# Manifest Entry Metadata Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make runtime manifest validation enforce the same required sample entry metadata that stored fixture validation already requires.

**Architecture:** Define a shared required-entry-field list in `server.js`. `validateManifest()` checks every sample entry for non-empty string values across metadata and path fields before API use or persistence.

**Tech Stack:** Node.js, existing source-extraction tests, npm smoke scripts.

---

### Task 1: Required Metadata Regression Test

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/manifest-validation-tests.mjs`

- [x] **Step 1: Add failing tests**

Add coverage that proves:

```js
check("manifest with missing metadata field is rejected: code",
  caught?.payload?.code,
  "SAMPLE_MANIFEST_INVALID");
check("manifest with missing metadata field is rejected: message",
  caught?.payload?.error,
  "Sample manifest entry missing required field: label.");
checkTrue("server declares required manifest entry fields",
  /const REQUIRED_MANIFEST_ENTRY_FIELDS = \[/.test(serverSrc));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/server/manifest-validation-tests.mjs
```

Expected: fails because `validateManifest()` still accepts entries missing `label`, `matchId`, `notesPath`, and other metadata fields.

### Task 2: Runtime Metadata Validation

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/server.js`

- [x] **Step 1: Add required field list**

Add:

```js
const REQUIRED_MANIFEST_ENTRY_FIELDS = [
  "id",
  "matchId",
  "label",
  "champion",
  "publicAlias",
  "collectedDate",
  "theme",
  "normalizedPath",
  "analysisPath",
  "notesPath",
];
```

- [x] **Step 2: Validate every required entry field**

Inside `validateManifest()`, replace the minimal `id/normalizedPath/analysisPath` check with:

```js
let missingEntryField = null;
const hasInvalidEntry = versionedManifest.samples.some((sample) => {
  if (!sample || typeof sample !== "object") return true;
  const missingField = REQUIRED_MANIFEST_ENTRY_FIELDS.find((field) =>
    typeof sample[field] !== "string" || sample[field].trim() === ""
  );
  if (missingField) {
    missingEntryField = missingField;
    return true;
  }
  return false;
});
if (hasInvalidEntry) {
  throw manifestValidationError(missingEntryField
    ? `Sample manifest entry missing required field: ${missingEntryField}.`
    : "Sample manifest contains an invalid sample entry.");
}
```

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/samples/manifest-tests.mjs
```

Expected: both pass.

### Task 3: Documentation And Full QA

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/README.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document metadata validation**

Update manifest stability notes to mention required entry metadata validation before API use and persistence.

- [x] **Step 2: Run verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/manifest-validation-tests.mjs
git diff --check
npm test
```

Expected: all commands exit 0; `npm test` reports all tests passed.

- [x] **Step 3: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-07-manifest-entry-metadata-validation.md server.js test-artifacts/server/manifest-validation-tests.mjs
git commit -m "fix: validate manifest entry metadata"
git push origin main
```
