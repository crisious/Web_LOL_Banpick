# Sample Bundle Read Error Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return a stable, path-safe `SAMPLE_BUNDLE_UNAVAILABLE` error when required stored sample bundle files cannot be read or parsed.

**Architecture:** Keep manifest validation errors unchanged, but wrap the required `normalizedPath` and `analysisPath` reads inside `loadSampleBundle(sampleId)`. Supplemental raw timeline, raw match, and comparison reads remain best-effort because they already fall back silently.

**Tech Stack:** Node.js HTTP server, repository custom `.mjs` test harnesses, markdown operator docs.

---

### Task 1: Add RED Coverage For Required Bundle Read Failures

**Files:**
- Create: `test-artifacts/server/sample-bundle-error-tests.mjs`

- [x] **Step 1: Create a focused loadSampleBundle harness**

Create `test-artifacts/server/sample-bundle-error-tests.mjs` with this content:

```js
// Stored sample bundle required-file error regression tests.
//
// Operator-provided SAMPLES_DIR manifests can point at missing or malformed
// required report JSON files. The public detail API should return a stable
// diagnostic without leaking local filesystem paths.

import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { validateManifest } = require("../../lib/sample-manifest.js");
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractAsyncFunctionSource(source, name) {
  const startIdx = source.indexOf(`async function ${name}(`);
  if (startIdx < 0) throw new Error(`async function ${name} not found`);
  return extractSourceFromStart(source, startIdx, `async function ${name}`);
}

function extractSourceFromStart(source, startIdx, label) {
  let bodyStartIdx = -1;
  let parenDepth = 0;
  let seenParams = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") { parenDepth += 1; seenParams = true; }
    else if (ch === ")") parenDepth -= 1;
    else if (ch === "{" && seenParams && parenDepth === 0) {
      bodyStartIdx = i;
      break;
    }
  }
  if (bodyStartIdx < 0) throw new Error(`${label} body not found`);

  let depth = 0;
  for (let i = bodyStartIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`${label} not closed`);
}

const validSample = {
  id: "sample-kr-1",
  matchId: "KR_1",
  label: "sample-kr-1 · MID WIN",
  champion: "Ahri",
  publicAlias: "Tester#KR1",
  collectedDate: "2026-06-08",
  theme: "Required bundle read fixture",
  normalizedPath: "/data/samples/sample-kr-1/normalized-match.json",
  analysisPath: "/data/samples/sample-kr-1/analysis-result.json",
  notesPath: "/data/samples/sample-kr-1/sample-kr-1-notes.md",
};
const manifest = { schemaVersion: 1, samples: [validSample] };
const validNormalized = {
  matchInfo: { champion: "Ahri", result: "WIN" },
  playerContext: {},
  playerStats: {},
  timelineEvents: [],
  playtimeScore: { overall: 70 },
  objectiveTimeline: [],
  kdaTimeline: [],
  wardTimeline: [],
  itemTimeline: [],
  challengeStats: {},
};
const validAnalysis = {
  matchSummary: { headline: "Stable sample" },
  coachSummary: { overallSummary: "Keep the report available." },
};

function storagePath(publicPath) {
  return `/runtime/samples/${String(publicPath || "").replace(/^\/data\/samples\//, "")}`;
}

function makeHarness(readJson) {
  return new Function(
    "readJson",
    "validateManifest",
    "sampleEntryStoragePath",
    "sampleStoragePath",
    "buildPlaytimeScore",
    "buildObjectiveTimeline",
    "buildKdaTimeline",
    "buildWardTimeline",
    "buildItemTimeline",
    [
      "const manifestPath = '/runtime/samples/manifest.json';",
      extractAsyncFunctionSource(serverSrc, "loadManifest"),
      extractAsyncFunctionSource(serverSrc, "loadSampleBundle"),
      "return { loadSampleBundle };",
    ].join("\n"),
  )(
    readJson,
    validateManifest,
    storagePath,
    (sampleId, ...segments) => `/runtime/samples/${sampleId}/${segments.join("/")}`,
    () => ({ overall: 0 }),
    () => [],
    () => [],
    () => [],
    () => [],
  );
}

function readJsonFor(mode) {
  return async (filePath) => {
    if (filePath === "/runtime/samples/manifest.json") return manifest;
    if (filePath === storagePath(validSample.normalizedPath)) {
      if (mode === "missing-normalized") {
        throw new Error("ENOENT: no such file or directory, open '/runtime/samples/sample-kr-1/normalized-match.json'");
      }
      return validNormalized;
    }
    if (filePath === storagePath(validSample.analysisPath)) {
      if (mode === "invalid-analysis") {
        throw new Error("Unexpected token < in JSON at position 0 while reading /runtime/samples/sample-kr-1/analysis-result.json");
      }
      return validAnalysis;
    }
    throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
  };
}

async function captureLoad(mode) {
  const { loadSampleBundle } = makeHarness(readJsonFor(mode));
  try {
    return { bundle: await loadSampleBundle("sample-kr-1"), error: null };
  } catch (error) {
    return { bundle: null, error };
  }
}

let pass = 0, fail = 0;

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

const validLoad = await captureLoad("ok");
check("valid bundle returns sample id", validLoad.bundle?.sampleId, "sample-kr-1");
check("valid bundle returns analysis", validLoad.bundle?.analysis, validAnalysis);

for (const [label, mode] of [
  ["missing normalized file", "missing-normalized"],
  ["invalid analysis JSON", "invalid-analysis"],
]) {
  const { error } = await captureLoad(mode);
  const payloadText = JSON.stringify(error?.payload || {});
  check(`${label}: status`, error?.statusCode, 500);
  check(`${label}: code`, error?.payload?.code, "SAMPLE_BUNDLE_UNAVAILABLE");
  check(`${label}: sample id`, error?.payload?.sampleId, "sample-kr-1");
  check(`${label}: safe message`, error?.payload?.error, "저장 샘플 리포트 파일을 읽을 수 없습니다.");
  checkTrue(`${label}: payload does not expose runtime path`,
    !payloadText.includes("/runtime/samples") && !payloadText.includes("ENOENT") && !payloadText.includes("Unexpected token"),
    payloadText);
}

checkTrue("loadSampleBundle declares stable sample bundle error",
  /SAMPLE_BUNDLE_UNAVAILABLE/.test(serverSrc) && /저장 샘플 리포트 파일을 읽을 수 없습니다\./.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run RED command**

Run:

```bash
node test-artifacts/server/sample-bundle-error-tests.mjs
```

Expected result before implementation:

```text
FAIL  missing normalized file: status
FAIL  missing normalized file: code
FAIL  missing normalized file: sample id
FAIL  missing normalized file: safe message
FAIL  missing normalized file: payload does not expose runtime path
FAIL  invalid analysis JSON: status
FAIL  invalid analysis JSON: code
FAIL  invalid analysis JSON: sample id
FAIL  invalid analysis JSON: safe message
FAIL  invalid analysis JSON: payload does not expose runtime path
FAIL  loadSampleBundle declares stable sample bundle error
```

Observed: after adding top-level fallback payload coverage, command exited 1 with `2 passed, 11 failed`. The fallback payload exposed `/runtime/samples/...`, `ENOENT`, and JSON parser text before implementation.

### Task 2: Wrap Required Bundle Reads With A Stable Error

**Files:**
- Modify: `server.js`

- [x] **Step 1: Catch required normalized and analysis read failures**

In `loadSampleBundle(sampleId)`, replace:

```js
  const normalized = await readJson(sampleEntryStoragePath(entry.normalizedPath));
  const analysis = await readJson(sampleEntryStoragePath(entry.analysisPath));
```

with:

```js
  let normalized;
  let analysis;
  try {
    normalized = await readJson(sampleEntryStoragePath(entry.normalizedPath));
    analysis = await readJson(sampleEntryStoragePath(entry.analysisPath));
  } catch {
    const error = new Error("Stored sample bundle is unavailable.");
    error.statusCode = 500;
    error.payload = {
      ok: false,
      code: "SAMPLE_BUNDLE_UNAVAILABLE",
      error: "저장 샘플 리포트 파일을 읽을 수 없습니다.",
      sampleId,
    };
    throw error;
  }
```

- [x] **Step 2: Run focused GREEN command**

Run:

```bash
node --check server.js
node --check test-artifacts/server/sample-bundle-error-tests.mjs
node test-artifacts/server/sample-bundle-error-tests.mjs
```

Expected result after implementation:

```text
13 passed, 0 failed
```

Observed: command exited 0. `server.js` and the new test file passed syntax checks, and `sample-bundle-error-tests.mjs` reported `13 passed, 0 failed`.

### Task 3: Document The Detail Error Diagnostic

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Update README operator note**

Extend the stored sample detail route paragraph in `README.md` so required sample bundle read failures are documented as HTTP 500 `SAMPLE_BUNDLE_UNAVAILABLE` without filesystem path exposure.

- [x] **Step 2: Update external demo runbook smoke notes**

Extend the external demo runbook sample/detail error section so operators know missing or malformed required stored sample JSON should return `SAMPLE_BUNDLE_UNAVAILABLE`, not raw `ENOENT` or parser text.

### Task 4: Verify, Commit, Push, And Record Evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-sample-bundle-read-error-guard.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-sample-bundle-read-error-guard.md
placeholder_scan=$?
printf 'placeholder_scan_exit=%s\n' "$placeholder_scan"
test "$placeholder_scan" -eq 1
node --check server.js
node --check test-artifacts/server/sample-bundle-error-tests.mjs
node test-artifacts/server/sample-bundle-error-tests.mjs
npm test
git diff --check
```

Expected result:

```text
placeholder_scan_exit=1
13 passed, 0 failed
git diff --check exits 0
```

Observed: command exited 0. Placeholder scan reported `placeholder_scan_exit=1`; syntax checks passed; `sample-bundle-error-tests.mjs` reported `13 passed, 0 failed`; full `npm test` reported `1107 passed, 0 failed across 36 test file(s)`; `git diff --check` exited 0.

- [x] **Step 2: Stage and re-run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-sample-bundle-read-error-guard.md server.js test-artifacts/server/sample-bundle-error-tests.mjs
git diff --cached --name-status
node --check server.js
node --check test-artifacts/server/sample-bundle-error-tests.mjs
node test-artifacts/server/sample-bundle-error-tests.mjs
npm test
git diff --cached --check
```

Expected result:

```text
README.md
docs/external-demo-runbook.md
docs/superpowers/plans/2026-06-08-sample-bundle-read-error-guard.md
server.js
test-artifacts/server/sample-bundle-error-tests.mjs
13 passed, 0 failed
git diff --cached --check exits 0
```

Observed: command exited 0. Cached name-status contained the five expected files; syntax checks passed; `sample-bundle-error-tests.mjs` reported `13 passed, 0 failed`; full `npm test` reported `1107 passed, 0 failed across 36 test file(s)`; `git diff --cached --check` exited 0.

- [ ] **Step 3: Commit and push**

Run:

```bash
git commit -m "ci: return structured sample bundle errors"
git push origin main
```

- [ ] **Step 4: Confirm GitHub Actions and Obsidian**

Use `gh run list`, `gh run watch`, `gh run download`, and the read-only smoke summary to confirm the pushed `main` run passes. Update the Obsidian project note with commit, local QA, GitHub Actions run, artifact id, smoke result, sensitive scan result, and sync status.
