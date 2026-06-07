# Shared Sample Manifest Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move sample manifest schema constants and validation helpers into a shared CommonJS module so server runtime checks and stored fixture integrity tests use the same criteria.

**Architecture:** Create `lib/sample-manifest.js` as a side-effect-free CommonJS module. `server.js` imports validation from that module, while `test-artifacts/server/manifest-validation-tests.mjs` and `test-artifacts/samples/manifest-tests.mjs` import the same module instead of duplicating field/path rules.

**Tech Stack:** Node.js CommonJS server, ESM test files using `createRequire`, existing zero-dependency test runner and smoke scripts.

---

### Task 1: Shared Module Regression Tests

**Files:**
- Create: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/manifest-shared-module-tests.mjs`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/manifest-validation-tests.mjs`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/samples/manifest-tests.mjs`

- [x] **Step 1: Add failing shared module test**

Create `test-artifacts/server/manifest-shared-module-tests.mjs`:

```js
import { createRequire } from "module";

const require = createRequire(import.meta.url);
let manifestModule = null;
let loadError = null;
try {
  manifestModule = require("../../lib/sample-manifest.js");
} catch (error) {
  loadError = error;
}

let pass = 0;
let fail = 0;

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

checkTrue("sample manifest module loads", Boolean(manifestModule), loadError?.message || "");

if (manifestModule) {
  const {
    SAMPLE_MANIFEST_SCHEMA_VERSION,
    REQUIRED_MANIFEST_ENTRY_FIELDS,
    MANIFEST_ENTRY_PATH_FIELDS,
    MANIFEST_ENTRY_RAW_PATH_PATTERN,
    validateManifestEntryPaths,
    validateManifest,
  } = manifestModule;

  const validSample = {
    id: "sample-kr-1",
    matchId: "KR_1",
    label: "sample-kr-1 · MID WIN",
    champion: "Ahri",
    publicAlias: "Tester#KR1",
    collectedDate: "2026-06-07",
    theme: "Runtime manifest validation fixture",
    normalizedPath: "/data/samples/sample-kr-1/normalized-match.json",
    analysisPath: "/data/samples/sample-kr-1/analysis-result.json",
    notesPath: "/data/samples/sample-kr-1/sample-kr-1-notes.md",
  };

  check("schema version export", SAMPLE_MANIFEST_SCHEMA_VERSION, 1);
  check("required entry fields export", REQUIRED_MANIFEST_ENTRY_FIELDS, [
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
  ]);
  check("path fields export", MANIFEST_ENTRY_PATH_FIELDS, ["normalizedPath", "analysisPath", "notesPath"]);
  checkTrue("raw path pattern export", MANIFEST_ENTRY_RAW_PATH_PATTERN instanceof RegExp);
  check("valid entry paths return null", validateManifestEntryPaths(validSample), null);
  check("escaped entry path error",
    validateManifestEntryPaths({ ...validSample, analysisPath: "/data/samples/other-sample/analysis-result.json" }),
    "Sample manifest entry path must stay under /data/samples/sample-kr-1/: analysisPath.");
  check("raw entry path error",
    validateManifestEntryPaths({ ...validSample, notesPath: "/data/samples/sample-kr-1/manifest.json" }),
    "Sample manifest entry path must not expose raw/internal files: notesPath.");
  check("legacy manifest normalizes through shared module",
    validateManifest({ samples: [validSample] }),
    { schemaVersion: 1, samples: [validSample] });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Refactor tests to require the shared module**

In `test-artifacts/server/manifest-validation-tests.mjs`, replace source-extracted validation constants/functions with:

```js
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const manifestModule = require("../../lib/sample-manifest.js");
const { validateManifest } = manifestModule;
```

Keep `loadManifest()` / `saveManifest()` extraction, but pass `validateManifest` into the harness so server persistence wrappers still get tested.

In `test-artifacts/samples/manifest-tests.mjs`, require:

```js
const {
  REQUIRED_MANIFEST_ENTRY_FIELDS,
  MANIFEST_ENTRY_PATH_FIELDS,
  MANIFEST_ENTRY_RAW_PATH_PATTERN,
  validateManifest,
  validateManifestEntryPaths,
} = require("../../lib/sample-manifest.js");
```

Use these exports instead of hard-coded `requiredEntryFields`, path field arrays, and raw path regex.

- [x] **Step 3: Verify RED**

Run:

```bash
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/samples/manifest-tests.mjs
```

Observed RED: commands failed because `lib/sample-manifest.js` did not exist yet. The shared module test reported `0 passed, 1 failed`; the runtime and stored manifest tests failed with `MODULE_NOT_FOUND`.

### Task 2: Shared Validation Module

**Files:**
- Create: `/Users/a1234/Documents/Web_LOL_Banpick/lib/sample-manifest.js`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/server.js`

- [x] **Step 1: Add the shared CommonJS module**

Create `lib/sample-manifest.js` with:

```js
const SAMPLE_MANIFEST_SCHEMA_VERSION = 1;
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
const MANIFEST_ENTRY_PATH_FIELDS = ["normalizedPath", "analysisPath", "notesPath"];
const MANIFEST_ENTRY_RAW_PATH_PATTERN = /(?:^|\/)(?:raw-|manifest\.json$)/;

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

function validateManifestEntryPaths(sample) {
  const expectedPrefix = `/data/samples/${sample.id}/`;
  for (const field of MANIFEST_ENTRY_PATH_FIELDS) {
    const publicPath = sample[field].trim();
    if (!publicPath.startsWith(expectedPrefix)) {
      return `Sample manifest entry path must stay under ${expectedPrefix}: ${field}.`;
    }
    const relativePath = publicPath.slice(expectedPrefix.length);
    if (MANIFEST_ENTRY_RAW_PATH_PATTERN.test(relativePath)) {
      return `Sample manifest entry path must not expose raw/internal files: ${field}.`;
    }
  }
  return null;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw manifestValidationError("Sample manifest must be a JSON object.");
  }
  const hasSchemaVersion = Object.prototype.hasOwnProperty.call(manifest, "schemaVersion");
  const schemaVersion = hasSchemaVersion ? manifest.schemaVersion : SAMPLE_MANIFEST_SCHEMA_VERSION;
  if (schemaVersion !== SAMPLE_MANIFEST_SCHEMA_VERSION) {
    throw manifestValidationError(`Unsupported sample manifest schemaVersion: ${String(schemaVersion)}.`);
  }
  const versionedManifest = hasSchemaVersion ? manifest : { schemaVersion, ...manifest };

  if (!Array.isArray(manifest.samples)) {
    throw manifestValidationError("Sample manifest must include a samples array.");
  }

  let invalidEntryMessage = null;
  const hasInvalidEntry = versionedManifest.samples.some((sample) => {
    if (!sample || typeof sample !== "object") {
      return true;
    }
    const missingField = REQUIRED_MANIFEST_ENTRY_FIELDS.find((field) =>
      typeof sample[field] !== "string" || sample[field].trim() === ""
    );
    if (missingField) {
      invalidEntryMessage = `Sample manifest entry missing required field: ${missingField}.`;
      return true;
    }
    const pathError = validateManifestEntryPaths(sample);
    if (pathError) {
      invalidEntryMessage = pathError;
      return true;
    }
    return false;
  });
  if (hasInvalidEntry) {
    throw manifestValidationError(invalidEntryMessage || "Sample manifest contains an invalid sample entry.");
  }

  return versionedManifest;
}

module.exports = {
  SAMPLE_MANIFEST_SCHEMA_VERSION,
  REQUIRED_MANIFEST_ENTRY_FIELDS,
  MANIFEST_ENTRY_PATH_FIELDS,
  MANIFEST_ENTRY_RAW_PATH_PATTERN,
  manifestValidationError,
  validateManifestEntryPaths,
  validateManifest,
};
```

- [x] **Step 2: Import shared validation in `server.js`**

Near the top of `server.js`, add:

```js
const {
  validateManifest,
} = require("./lib/sample-manifest");
```

Remove the duplicated manifest constants and validation functions from `server.js`. Keep `loadManifest()` and `saveManifest()` unchanged so they call the imported `validateManifest`.

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/samples/manifest-tests.mjs
```

Observed GREEN: `manifest-shared-module-tests.mjs` reported `9 passed, 0 failed`; `manifest-validation-tests.mjs` reported `44 passed, 0 failed`; `manifest-tests.mjs` reported `10 passed, 0 failed`.

### Task 3: Documentation, QA, Commit, Push

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/README.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document shared validation module**

Update the manifest stability notes to mention that runtime and fixture integrity tests share the validation module.

- [x] **Step 2: Run verification**

Run:

```bash
node --check lib/sample-manifest.js
node --check server.js
node --check test-artifacts/server/manifest-shared-module-tests.mjs
node --check test-artifacts/server/manifest-validation-tests.mjs
node --check test-artifacts/samples/manifest-tests.mjs
git diff --check
npm test
```

Observed: all commands exited 0; `npm test` reported `458 passed, 0 failed across 21 test file(s)`.

- [x] **Step 3: Run runtime smoke checks**

Run:

```bash
PORT=8123 HOST=127.0.0.1 SAMPLES_DIR=/tmp/lol-ai-coach-shared-module-invalid npm run start:readonly
```

Then request `/api/samples` and expect a 500 `SAMPLE_MANIFEST_INVALID` response for an escaped sample path. Then run normal read-only/protected smoke against a copied sample directory:

```bash
SAMPLES_DIR=/tmp/lol-ai-coach-samples-smoke PORT=8123 HOST=127.0.0.1 npm run start:readonly
npm run smoke:readonly
SAMPLES_DIR=/tmp/lol-ai-coach-samples-smoke PORT=8123 HOST=127.0.0.1 PUBLIC_DEMO_TOKEN=smoke-token npm run start:protected
PUBLIC_DEMO_TOKEN=smoke-token npm run smoke:protected
```

Observed: negative smoke returned `500` / `SAMPLE_MANIFEST_INVALID` / `Sample manifest entry path must stay under /data/samples/sample-kr-1/: normalizedPath.`; both normal smoke scripts passed; temp directories were removed; port 8123 had no listener; no `.manifest.lock` or `*.tmp` files remained under `data/samples`.

- [x] **Step 4: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-07-shared-sample-manifest-validation.md lib/sample-manifest.js server.js test-artifacts/server/manifest-shared-module-tests.mjs test-artifacts/server/manifest-validation-tests.mjs test-artifacts/samples/manifest-tests.mjs
git commit -m "refactor: share sample manifest validation"
git push origin main
```
