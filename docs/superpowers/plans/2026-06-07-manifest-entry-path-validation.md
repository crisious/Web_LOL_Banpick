# Manifest Entry Path Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make runtime manifest validation reject sample entries whose public paths escape their own sample directory or expose raw/internal payload files.

**Architecture:** Keep validation in `server.js` next to the existing manifest shape and metadata checks. Add a small helper that validates `normalizedPath`, `analysisPath`, and `notesPath` against each entry id before `loadManifest()` or `saveManifest()` can return unsafe manifest data.

**Tech Stack:** Node.js, existing source-extraction server tests, external demo smoke scripts.

---

### Task 1: Runtime Path Safety Regression Tests

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/manifest-validation-tests.mjs`

- [x] **Step 1: Add failing tests**

Add optional helper extraction for the new validator and add invalid manifest cases:

```js
function extractManifestPathFieldsDeclaration(source) {
  const match = source.match(/const MANIFEST_ENTRY_PATH_FIELDS = \[[\s\S]*?\];/);
  if (match) return match[0];
  return "const MANIFEST_ENTRY_PATH_FIELDS = [\"normalizedPath\", \"analysisPath\", \"notesPath\"];";
}
```

Inject it into `makeHelpers()` before `validateManifest()`, then add cases:

```js
["manifest path outside sample directory is rejected", {
  samples: [{ ...validSample, normalizedPath: "/data/samples/other-sample/normalized-match.json" }],
}, "Sample manifest entry path must stay under /data/samples/sample-kr-1/: normalizedPath."],
["manifest raw path exposure is rejected", {
  samples: [{ ...validSample, analysisPath: "/data/samples/sample-kr-1/raw-match.json" }],
}, "Sample manifest entry path must not expose raw/internal files: analysisPath."],
```

Also add source checks:

```js
checkTrue("server declares manifest entry path fields",
  /const MANIFEST_ENTRY_PATH_FIELDS = \[/.test(serverSrc));
checkTrue("server declares manifest raw path exposure pattern",
  /MANIFEST_ENTRY_RAW_PATH_PATTERN/.test(serverSrc));
checkTrue("server declares manifest entry path validator",
  /function validateManifestEntryPaths\(/.test(serverSrc));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/server/manifest-validation-tests.mjs
```

Observed RED: `32 passed, 15 failed` because runtime `validateManifest()` did not yet declare path fields or reject escaped/raw manifest paths.

### Task 2: Runtime Path Safety Validation

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/server.js`

- [x] **Step 1: Add path validation constants and helper**

Add constants near `REQUIRED_MANIFEST_ENTRY_FIELDS`:

```js
const MANIFEST_ENTRY_PATH_FIELDS = ["normalizedPath", "analysisPath", "notesPath"];
const MANIFEST_ENTRY_RAW_PATH_PATTERN = /(?:^|\/)(?:raw-|manifest\.json$)/;
```

Add helper before `validateManifest()`:

```js
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
```

- [x] **Step 2: Call the helper inside `validateManifest()`**

After required field validation inside the sample loop, call:

```js
const pathError = validateManifestEntryPaths(sample);
if (pathError) {
  invalidEntryMessage = pathError;
  return true;
}
```

Update invalid entry handling to prefer `invalidEntryMessage` over the generic message.

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/server/manifest-validation-tests.mjs
node test-artifacts/samples/manifest-tests.mjs
```

Observed GREEN: `manifest-validation-tests.mjs` reported `47 passed, 0 failed`; `manifest-tests.mjs` reported `9 passed, 0 failed`.

### Task 3: Documentation And Full QA

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/README.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document runtime path safety**

Update manifest stability notes to mention runtime checks for per-sample public path prefixes and raw/internal file exposure.

- [x] **Step 2: Run verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/manifest-validation-tests.mjs
git diff --check
npm test
```

Observed: all commands exited 0; `npm test` reported `451 passed, 0 failed across 20 test file(s)`.

- [x] **Step 3: Run runtime smoke checks**

Run a negative smoke with a manifest whose `normalizedPath` points at another sample id:

```bash
PORT=8123 HOST=127.0.0.1 SAMPLES_DIR=/tmp/lol-ai-coach-escaped-path-manifest npm run start:readonly
```

Then request `/api/samples` and expect:

```json
{"status":500,"code":"SAMPLE_MANIFEST_INVALID","ok":false,"error":"Sample manifest entry path must stay under /data/samples/sample-kr-1/: normalizedPath."}
```

Run normal read-only/protected smoke against a copied sample directory:

```bash
SAMPLES_DIR=/tmp/lol-ai-coach-samples-smoke PORT=8123 HOST=127.0.0.1 npm run start:readonly
npm run smoke:readonly
SAMPLES_DIR=/tmp/lol-ai-coach-samples-smoke PORT=8123 HOST=127.0.0.1 PUBLIC_DEMO_TOKEN=smoke-token npm run start:protected
PUBLIC_DEMO_TOKEN=smoke-token npm run smoke:protected
```

Observed: escaped path smoke returned `500` / `SAMPLE_MANIFEST_INVALID` / `Sample manifest entry path must stay under /data/samples/sample-kr-1/: normalizedPath.`; both normal smoke scripts passed; temp directories were removed; port 8123 had no listener; no `.manifest.lock` or `*.tmp` files remained under `data/samples`.

- [x] **Step 4: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-07-manifest-entry-path-validation.md server.js test-artifacts/server/manifest-validation-tests.mjs
git commit -m "fix: validate manifest entry paths"
git push origin main
```
