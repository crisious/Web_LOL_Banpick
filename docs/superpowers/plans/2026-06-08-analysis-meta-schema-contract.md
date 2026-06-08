# Analysis Meta Schema Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `analysisMeta.sourceType` and `analysisMeta.language` required final-output fields so AI analysis responses cannot pass validation without provenance and language metadata.

**Architecture:** `buildLlmPayload()` already declares `analysisMeta` as a required top-level field and the prompts require `analysisMeta.sourceType`. This change tightens `validateAnalysisOutput()` to enforce the same contract, and updates `buildAnalysis()` to repair missing AI metadata before validation using the selected primary agent as the source-type hint.

**Tech Stack:** Node.js ESM test scripts, CommonJS-compatible `server.js`, zero-dependency CLI tests, GitHub Actions QA artifacts.

---

### Task 1: Capture `analysisMeta` Contract In Tests

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Add missing and invalid object tests**

Insert after `missing schemaVersion throws`:

```js
expectThrows("missing analysisMeta throws", () => {
  const f = validFixture();
  delete f.analysisMeta;
  validateAnalysisOutput(f);
}, "analysisMeta");

expectThrows("analysisMeta as string throws", () => {
  const f = validFixture();
  f.analysisMeta = "claude_ai";
  validateAnalysisOutput(f);
}, "analysisMeta");
```

- [ ] **Step 2: Add source type tests**

Insert after the string test:

```js
expectThrows("analysisMeta missing sourceType throws", () => {
  const f = validFixture();
  delete f.analysisMeta.sourceType;
  validateAnalysisOutput(f);
}, "analysisMeta.sourceType");

expectThrows("analysisMeta empty sourceType throws", () => {
  const f = validFixture();
  f.analysisMeta.sourceType = "";
  validateAnalysisOutput(f);
}, "analysisMeta.sourceType");
```

- [ ] **Step 3: Add language tests**

Insert after the source type tests:

```js
expectThrows("analysisMeta missing language throws", () => {
  const f = validFixture();
  delete f.analysisMeta.language;
  validateAnalysisOutput(f);
}, "analysisMeta.language");

expectThrows("analysisMeta empty language throws", () => {
  const f = validFixture();
  f.analysisMeta.language = "";
  validateAnalysisOutput(f);
}, "analysisMeta.language");
```

- [ ] **Step 4: Run the RED test**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
24 passed, 6 failed
```

The six new `analysisMeta` cases must fail because `validateAnalysisOutput()` does not validate the metadata object yet.

### Task 2: Wire Validator Support Into The Test Harness

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Extract the new helper for direct validator evaluation**

Add to the support-source section before `validateSrc`:

```js
if (serverSrc.includes("function hasAnalysisMetaObject(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasAnalysisMetaObject"));
}
```

This is needed because `schema-tests.mjs` evaluates `validateAnalysisOutput()` in isolation with `new Function()`.

### Task 3: Enforce And Repair `analysisMeta`

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add the object-shape helper**

Add below `hasValidPhaseSummaries()`:

```js
function hasAnalysisMetaObject(analysisMeta) {
  return analysisMeta && typeof analysisMeta === "object" && !Array.isArray(analysisMeta);
}
```

- [ ] **Step 2: Enforce the helper in `validateAnalysisOutput()`**

Add after the `schemaVersion` check:

```js
if (!hasAnalysisMetaObject(json?.analysisMeta)) throw new Error("missing analysisMeta");
if (typeof json.analysisMeta.sourceType !== "string" || !json.analysisMeta.sourceType) throw new Error("missing analysisMeta.sourceType");
if (typeof json.analysisMeta.language !== "string" || !json.analysisMeta.language) throw new Error("missing analysisMeta.language");
```

- [ ] **Step 3: Repair invalid agent metadata before final validation**

Replace the current metadata completion block:

```js
if (!primary.schemaVersion) { primary.schemaVersion = "1.0"; violations.push("missing.schemaVersion"); }
if (!primary.analysisMeta) { primary.analysisMeta = {}; violations.push("missing.analysisMeta"); }
if (!primary.analysisMeta.language) primary.analysisMeta.language = "ko";
```

With:

```js
if (!primary.schemaVersion) { primary.schemaVersion = "1.0"; violations.push("missing.schemaVersion"); }
const inferredPrimarySourceType = primary === claudeResult ? "claude_ai" : "codex_redteam";
if (!hasAnalysisMetaObject(primary.analysisMeta)) {
  const violation = primary.analysisMeta ? "type.analysisMeta.invalid" : "missing.analysisMeta";
  primary.analysisMeta = {};
  violations.push(violation);
}
if (typeof primary.analysisMeta.sourceType !== "string" || !primary.analysisMeta.sourceType) {
  primary.analysisMeta.sourceType = inferredPrimarySourceType;
  violations.push("missing.analysisMeta.sourceType");
}
if (typeof primary.analysisMeta.language !== "string" || !primary.analysisMeta.language) {
  primary.analysisMeta.language = "ko";
  violations.push("missing.analysisMeta.language");
}
```

### Task 4: Update Test Count Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the schema test count**

Change:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 24건
```

To:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 30건
```

### Task 5: Verify Locally

**Files:**
- Verify only

- [ ] **Step 1: Run focused checks**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
node --check server.js
node --check test-artifacts/schema/schema-tests.mjs
git diff --check
```

Expected output includes:

```text
30 passed, 0 failed
```

- [ ] **Step 2: Run the full zero-dependency suite**

Run:

```bash
npm test
```

Expected output includes:

```text
1332 passed, 0 failed across 40 test file(s)
```

- [ ] **Step 3: Run read-only smoke report**

Run:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/analysis-meta-contract-local npm run smoke:report:readonly
```

Expected `qa-summary.json` values:

```json
{
  "latestRun.status": "passed",
  "latestRun.smokeSummary.passed": 156,
  "latestRun.smokeSummary.failed": 0,
  "latestRun.qaVerdict.status": "passed",
  "latestRun.qaVerdict.shareable": true,
  "latestRun.sampleEvidence.status": "passed",
  "latestRun.demoSafetyEvidence.status": "passed",
  "latestRun.artifactIntegrity.status": "passed",
  "latestRun.requiredCheckStatus": "passed"
}
```

- [ ] **Step 4: Scan smoke artifacts for sensitive tokens**

Run:

```bash
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/analysis-meta-contract-local
```

Expected: no matches and exit code `1`.

### Task 6: Publish And Record Evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-analysis-meta-schema-contract.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Stage and commit**

Run:

```bash
git add server.js README.md test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-08-analysis-meta-schema-contract.md
git commit -m "test: enforce analysis meta schema contract"
```

- [ ] **Step 2: Push main**

Run:

```bash
git push origin main
```

- [ ] **Step 3: Verify GitHub QA artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 5 --json databaseId,headSha,status,conclusion,url,createdAt,displayTitle
RUN_ID="$(gh run list --workflow QA --branch main --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run view "$RUN_ID" --json status,conclusion,headSha,url,workflowName,createdAt,updatedAt
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, size_in_bytes, expired, created_at}'
```

Expected: the run for the pushed commit succeeds and includes a `qa-automation` artifact.

- [ ] **Step 4: Update Obsidian project notes**

Record the commit SHA, GitHub run ID, artifact ID, local QA summary, GitHub QA summary, and sensitive artifact scan result under `게임 기획/LOL AI Coach`.
