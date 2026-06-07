# Sample Entry Storage Path Strictness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make manifest public path to storage path mapping use the same strict prefix and traversal-safety rules as shared sample manifest validation.

**Architecture:** Extend `lib/sample-manifest.js` with a side-effect-free public-path-to-storage-relative-path helper. `server.js` imports that helper for `sampleEntryStoragePath()`, so configured `SAMPLES_DIR` mapping only happens for exact `/data/samples/...` manifest public paths with no traversal segments.

**Tech Stack:** Node.js CommonJS server, ESM test files using source extraction and `createRequire`, existing smoke scripts.

---

### Task 1: Public Path Helper Regression Tests

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/manifest-shared-module-tests.mjs`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/samples-dir-tests.mjs`

- [x] **Step 1: Add failing shared helper tests**

In `test-artifacts/server/manifest-shared-module-tests.mjs`, require the new helper:

```js
const {
  MANIFEST_PUBLIC_SAMPLE_PREFIX,
  sampleManifestPublicPathToStorageRelativePath,
} = manifestModule;
```

Add checks:

```js
check("public sample prefix export", MANIFEST_PUBLIC_SAMPLE_PREFIX, "/data/samples/");
check("public path maps to storage-relative path",
  sampleManifestPublicPathToStorageRelativePath("/data/samples/sample-kr-1/analysis-result.json"),
  "sample-kr-1/analysis-result.json");
check("public path helper requires leading slash",
  sampleManifestPublicPathToStorageRelativePath("data/samples/sample-kr-1/analysis-result.json"),
  null);
check("public path helper rejects traversal segment",
  sampleManifestPublicPathToStorageRelativePath("/data/samples/sample-kr-1/../other/analysis-result.json"),
  null);
check("manifest traversal path error",
  validateManifestEntryPaths({
    ...validSample,
    normalizedPath: "/data/samples/sample-kr-1/../other/normalized-match.json",
  }),
  "Sample manifest entry path must not contain traversal segments: normalizedPath.");
```

- [x] **Step 2: Add failing storage helper tests**

In `test-artifacts/server/samples-dir-tests.mjs`, pass `sampleManifestPublicPathToStorageRelativePath` into the extracted helper harness:

```js
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { sampleManifestPublicPathToStorageRelativePath } = require("../../lib/sample-manifest.js");
```

Update the `new Function` call to receive `sampleManifestPublicPathToStorageRelativePath`, then add:

```js
function checkThrows(label, fn, expectedMessage) {
  let caught = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  check(label, caught?.message, expectedMessage);
}

checkThrows("sampleEntryStoragePath rejects sample paths without public slash",
  () => sampleEntryStoragePath("data/samples/sample-kr-1/analysis-result.json"),
  "Invalid sample manifest public path: data/samples/sample-kr-1/analysis-result.json");
checkThrows("sampleEntryStoragePath rejects traversal in sample public paths",
  () => sampleEntryStoragePath("/data/samples/sample-kr-1/../other/analysis-result.json"),
  "Invalid sample manifest public path: /data/samples/sample-kr-1/../other/analysis-result.json");
checkTrue("sampleEntryStoragePath uses shared public path helper",
  /sampleManifestPublicPathToStorageRelativePath\(publicPath\)/.test(sampleEntryStoragePathSrc));
```

- [x] **Step 3: Verify RED**

Run:

```bash
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/samples-dir-tests.mjs
```

Observed RED: `manifest-shared-module-tests.mjs` reported `9 passed, 3 failed`; `samples-dir-tests.mjs` reported `12 passed, 3 failed` because the shared public-path helper did not exist, traversal paths still passed validation, and `sampleEntryStoragePath()` still accepted unsafe sample public paths.

### Task 2: Shared Path Mapping Implementation

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/lib/sample-manifest.js`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/server.js`

- [x] **Step 1: Add shared public path helper**

In `lib/sample-manifest.js`, add:

```js
const MANIFEST_PUBLIC_SAMPLE_PREFIX = "/data/samples/";

function hasUnsafePathSegments(relativePath) {
  return relativePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

function sampleManifestPublicPathToStorageRelativePath(publicPath) {
  const rawPath = String(publicPath || "");
  if (!rawPath.startsWith(MANIFEST_PUBLIC_SAMPLE_PREFIX)) {
    return null;
  }
  const relativePath = rawPath.slice(MANIFEST_PUBLIC_SAMPLE_PREFIX.length);
  if (!relativePath || hasUnsafePathSegments(relativePath)) {
    return null;
  }
  return relativePath;
}
```

Export `MANIFEST_PUBLIC_SAMPLE_PREFIX` and `sampleManifestPublicPathToStorageRelativePath`.

- [x] **Step 2: Use the helper in manifest entry validation**

Update `validateManifestEntryPaths(sample)`:

```js
if (!sampleManifestPublicPathToStorageRelativePath(publicPath)) {
  if (publicPath.split("/").some((segment) => segment === "." || segment === "..")) {
    return `Sample manifest entry path must not contain traversal segments: ${field}.`;
  }
  return `Sample manifest entry path must stay under ${expectedPrefix}: ${field}.`;
}
```

Keep the existing expected sample prefix and raw/internal file exposure checks.

- [x] **Step 3: Use the helper in `sampleEntryStoragePath()`**

In `server.js`, import the helper:

```js
const {
  sampleManifestPublicPathToStorageRelativePath,
  validateManifest,
} = require("./lib/sample-manifest");
```

Update `sampleEntryStoragePath(publicPath)`:

```js
function sampleEntryStoragePath(publicPath) {
  const storageRelativePath = sampleManifestPublicPathToStorageRelativePath(publicPath);
  if (storageRelativePath) {
    return path.join(samplesDir, storageRelativePath);
  }
  const rawPath = String(publicPath || "");
  if (rawPath.startsWith("/data/samples/") || rawPath.startsWith("data/samples/")) {
    throw new Error(`Invalid sample manifest public path: ${rawPath}`);
  }
  const normalized = rawPath.replace(/^\//, "");
  return path.join(root, normalized);
}
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/server/manifest-shared-module-tests.mjs
node test-artifacts/server/samples-dir-tests.mjs
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/samples/manifest-tests.mjs
```

Observed GREEN: `manifest-shared-module-tests.mjs` reported `15 passed, 0 failed`; `samples-dir-tests.mjs` reported `15 passed, 0 failed`; `manifest-validation-tests.mjs` reported `44 passed, 0 failed`; `manifest-tests.mjs` reported `10 passed, 0 failed`.

### Task 3: Documentation, QA, Commit, Push

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/README.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document storage path strictness**

Update manifest stability notes to mention exact `/data/samples/` prefix mapping and traversal segment rejection.

- [x] **Step 2: Run verification**

Run:

```bash
node --check lib/sample-manifest.js
node --check server.js
node --check test-artifacts/server/manifest-shared-module-tests.mjs
node --check test-artifacts/server/samples-dir-tests.mjs
node --check test-artifacts/server/manifest-validation-tests.mjs
node --check test-artifacts/samples/manifest-tests.mjs
git diff --check
npm test
```

Observed: all commands exited 0; `npm test` reported `466 passed, 0 failed across 21 test file(s)`.

- [x] **Step 3: Run runtime smoke checks**

Run a negative smoke with traversal in a manifest path:

```bash
PORT=8123 HOST=127.0.0.1 SAMPLES_DIR=/tmp/lol-ai-coach-traversal-manifest npm run start:readonly
```

Then request `/api/samples` and expect:

```json
{"status":500,"code":"SAMPLE_MANIFEST_INVALID","ok":false,"error":"Sample manifest entry path must not contain traversal segments: normalizedPath."}
```

Run normal read-only/protected smoke against a copied sample directory:

```bash
SAMPLES_DIR=/tmp/lol-ai-coach-samples-smoke PORT=8123 HOST=127.0.0.1 npm run start:readonly
npm run smoke:readonly
SAMPLES_DIR=/tmp/lol-ai-coach-samples-smoke PORT=8123 HOST=127.0.0.1 PUBLIC_DEMO_TOKEN=smoke-token npm run start:protected
PUBLIC_DEMO_TOKEN=smoke-token npm run smoke:protected
```

Observed: negative smoke returned `500` / `SAMPLE_MANIFEST_INVALID` / `Sample manifest entry path must not contain traversal segments: normalizedPath.`; both normal smoke scripts passed; temp directories were removed; port 8123 had no listener; no `.manifest.lock` or `*.tmp` files remained under `data/samples`.

- [x] **Step 4: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-07-sample-entry-storage-path-strictness.md lib/sample-manifest.js server.js test-artifacts/server/manifest-shared-module-tests.mjs test-artifacts/server/samples-dir-tests.mjs
git commit -m "fix: align sample entry storage paths"
git push origin main
```
