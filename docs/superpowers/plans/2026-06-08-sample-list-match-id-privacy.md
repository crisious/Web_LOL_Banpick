# Sample List Match Id Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `/api/samples` from adding or exposing an explicit `matchId` field in the public stored-sample list response.

**Architecture:** Keep stored manifest entries and sample detail bundles unchanged so local sample management still has full metadata. Add a small public projection helper for the list endpoint that removes `matchId`; the browser can still correlate stored samples with recent matches through existing sample id/path inference.

**Tech Stack:** Node.js vanilla HTTP server, vanilla browser JavaScript, Node-based regression scripts, Markdown runbooks.

---

### Task 1: Lock the Public Sample List Contract

**Files:**
- Create: `test-artifacts/server/sample-list-privacy-tests.mjs`
- Inspect: `server.js`
- Inspect: `main.js`

- [ ] **Step 1: Write the failing test**

Create `test-artifacts/server/sample-list-privacy-tests.mjs` with this content:

```js
// Public sample list privacy regression tests.
//
// /api/samples is used by read-only external demos. It should provide enough
// sample metadata to render the library and fetch details by sample id, without
// adding an explicit Riot matchId field to each list entry.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  let startIdx = source.indexOf(`function ${name}(`);
  const asyncStartIdx = source.indexOf(`async function ${name}(`);
  if (asyncStartIdx >= 0 && (startIdx < 0 || asyncStartIdx < startIdx)) {
    startIdx = asyncStartIdx;
  }
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const maybePublicSampleListEntrySource = serverSrc.includes("function publicSampleListEntry(")
  ? extractFunctionSource(serverSrc, "publicSampleListEntry")
  : "function publicSampleListEntry(sample) { return sample; }";

const manifestFixture = {
  schemaVersion: 1,
  samples: [{
    id: "sample-kr-8242613150",
    matchId: "KR_8242613150",
    label: "sample-kr-8242613150 · MID LOSS",
    champion: "Ahri",
    publicAlias: "Demo Player#KR1",
    collectedDate: "2026-06-08",
    theme: "Mid-game side lane collapse",
    normalizedPath: "/data/samples/sample-kr-8242613150/normalized-match.json",
    analysisPath: "/data/samples/sample-kr-8242613150/analysis-result.json",
    notesPath: "/data/samples/sample-kr-8242613150/sample-kr-8242613150-notes.md",
  }],
};

const harness = new Function("manifestFixture", [
  "function sendJson(res, status, body) { res.sent = { status, body }; }",
  "function publicDemoModeHealth() { return {}; }",
  "function sampleGenerationHealth() { return {}; }",
  "async function loadManifest() { return manifestFixture; }",
  maybePublicSampleListEntrySource,
  extractFunctionSource(serverSrc, "handleApi"),
  "return { handleApi };",
].join("\n"))(manifestFixture);

function makeRes() {
  return { sent: null };
}

async function requestSamples() {
  const res = makeRes();
  const handled = await harness.handleApi({ method: "GET" }, res, { pathname: "/api/samples" });
  return { handled, res };
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

const out = await requestSamples();
const sample = out.res.sent?.body?.samples?.[0];

check("sample list request is handled", out.handled, true);
check("sample list status", out.res.sent?.status, 200);
check("sample list keeps schemaVersion", out.res.sent?.body?.schemaVersion, 1);
check("sample list keeps sample id", sample?.id, "sample-kr-8242613150");
check("sample list keeps display metadata", {
  label: sample?.label,
  champion: sample?.champion,
  publicAlias: sample?.publicAlias,
  theme: sample?.theme,
}, {
  label: "sample-kr-8242613150 · MID LOSS",
  champion: "Ahri",
  publicAlias: "Demo Player#KR1",
  theme: "Mid-game side lane collapse",
});
check("sample list does not expose explicit matchId",
  Object.prototype.hasOwnProperty.call(sample || {}, "matchId"),
  false);

checkTrue("server declares public sample list projection helper",
  /function publicSampleListEntry\(sample\)/.test(serverSrc));

checkTrue("sample list endpoint uses public sample list projection helper",
  /samples:\s*manifest\.samples\.map\(publicSampleListEntry\)/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
node test-artifacts/server/sample-list-privacy-tests.mjs
```

Expected: the command exits non-zero. It should show that the current `/api/samples` projection still exposes `matchId` and does not yet use a dedicated public sample list helper.

### Task 2: Project Public Sample List Entries

**Files:**
- Modify: `server.js`
- Read-only confirmation: `main.js`

- [ ] **Step 1: Add a public projection helper**

Add this helper near the sample detail helpers in `server.js`:

```js
function publicSampleListEntry(sample) {
  const { matchId, ...publicSample } = sample || {};
  return publicSample;
}
```

- [ ] **Step 2: Use the helper in `/api/samples`**

Change the list response from:

```js
samples: manifest.samples.map((sample) => ({
  ...sample,
  matchId: inferMatchIdFromSampleEntry(sample),
})),
```

to:

```js
samples: manifest.samples.map(publicSampleListEntry),
```

Do not remove `matchId` from `data/samples/manifest.json`, sample detail bundles, or generated sample entries.

- [ ] **Step 3: Run the focused test to verify GREEN**

Run:

```bash
node test-artifacts/server/sample-list-privacy-tests.mjs
```

Expected: the command exits zero and reports no failures.

### Task 3: Document the Public List Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update README security notes**

Add this bullet near the existing external demo/privacy notes:

```markdown
- `/api/samples` public list response keeps sample display metadata and detail paths but omits explicit `matchId`; the browser can still match stored samples through sample id/path inference.
```

- [ ] **Step 2: Update the external demo runbook checklist**

Add this checklist item:

```markdown
- `/api/samples` list entries omit explicit `matchId`; sample detail fetches continue to use public `sample-*` ids and must not require match IDs from the list payload
```

### Task 4: Verify and Publish

**Files:**
- Read: changed files
- Update after publish: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Run local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/sample-list-privacy-tests.mjs
node test-artifacts/server/sample-list-privacy-tests.mjs
npm test
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 2: Run staged QA**

After staging only the changed project files, run:

```bash
node --check server.js
node --check test-artifacts/server/sample-list-privacy-tests.mjs
node test-artifacts/server/sample-list-privacy-tests.mjs
npm test
git diff --cached --check
```

Expected: every command exits zero.

- [ ] **Step 3: Commit and push to main**

Run:

```bash
git commit -m "ci: hide sample list match ids"
git push origin main
```

Expected: push succeeds and `main...origin/main` returns `0	0` after fetch.

- [ ] **Step 4: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --dir /tmp/lol-ai-coach-sample-list-privacy
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\"matchId\"" /tmp/lol-ai-coach-sample-list-privacy
```

Expected: the run completes successfully and the sensitive scan exits with no matches.

### Self-Review

- Spec coverage: The plan covers test-first regression, public `/api/samples` payload minimization, docs/runbook updates, local QA, staged QA, GitHub Actions artifact scan, and Obsidian capture.
- Placeholder scan: The plan contains exact file paths, commands, code snippets, RED/GREEN expectations, and no deferred implementation markers.
- Type consistency: The helper name `publicSampleListEntry` is used consistently in the test, implementation, and endpoint projection.
