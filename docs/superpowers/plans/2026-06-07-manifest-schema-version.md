# Manifest Schema Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sample manifest metadata explicitly versioned while preserving legacy manifests that do not yet declare a version.

**Architecture:** Introduce a current manifest schema version constant. `validateManifest()` treats missing `schemaVersion` as legacy v1, returns a normalized v1 manifest, and rejects unsupported versions with the existing `SAMPLE_MANIFEST_INVALID` payload.

**Tech Stack:** Node.js, existing source-extraction tests, stored sample manifest integrity tests, npm smoke scripts.

---

### Task 1: Schema Version Regression Tests

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/manifest-validation-tests.mjs`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/samples/manifest-tests.mjs`

- [x] **Step 1: Add failing schema version tests**

Add coverage that proves:

```js
check("legacy manifest defaults to schemaVersion 1",
  validateManifest({ samples: [validSample] }),
  { schemaVersion: 1, samples: [validSample] });

check("manifest with unsupported schemaVersion is rejected: code",
  caught?.payload?.code,
  "SAMPLE_MANIFEST_INVALID");

check("saveManifest writes legacy manifest as versioned v1",
  events,
  [{ op: "writeJson", filePath: "/samples/manifest.json", data: { schemaVersion: 1, samples: [validSample] } }]);
```

Also require committed `data/samples/manifest.json` to declare `schemaVersion: 1`.

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/samples/manifest-tests.mjs
```

Expected: fails because runtime validation does not normalize missing `schemaVersion` yet and the stored fixture does not declare it yet.

### Task 2: Minimal Schema Version Implementation

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/server.js`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/data/samples/manifest.json`

- [x] **Step 1: Add current version constant**

Add:

```js
const SAMPLE_MANIFEST_SCHEMA_VERSION = 1;
```

- [x] **Step 2: Normalize and validate version**

Inside `validateManifest()`:

```js
const hasSchemaVersion = Object.prototype.hasOwnProperty.call(manifest, "schemaVersion");
const schemaVersion = hasSchemaVersion ? manifest.schemaVersion : SAMPLE_MANIFEST_SCHEMA_VERSION;
if (schemaVersion !== SAMPLE_MANIFEST_SCHEMA_VERSION) {
  throw manifestValidationError(`Unsupported sample manifest schemaVersion: ${String(schemaVersion)}.`);
}
const versionedManifest = hasSchemaVersion ? manifest : { schemaVersion, ...manifest };
```

Then validate and return `versionedManifest`.

- [x] **Step 3: Update stored fixture**

Add:

```json
"schemaVersion": 1
```

at the root of `data/samples/manifest.json`.

- [x] **Step 4: Verify GREEN**

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

- [x] **Step 1: Document schema version behavior**

Update manifest stability notes to mention `schemaVersion: 1`, legacy missing-version normalization, and unsupported version diagnostics.

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
git add README.md data/samples/manifest.json docs/external-demo-runbook.md docs/superpowers/plans/2026-06-07-manifest-schema-version.md server.js test-artifacts/samples/manifest-tests.mjs test-artifacts/server/manifest-validation-tests.mjs
git commit -m "feat: version sample manifest schema"
git push origin main
```
