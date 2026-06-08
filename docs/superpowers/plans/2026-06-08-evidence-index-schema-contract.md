# Evidence Index Schema Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `evidenceIndex` a required non-empty evidence array in the final analysis validator so generated reports keep a machine-checkable evidence trail.

**Architecture:** `buildLlmPayload()` and the prompt already list `evidenceIndex` as required output, and `buildRuleBasedAnalysis()` always creates it with `buildEvidenceIndex(normalized)`. This change adds a small validator helper, repairs malformed AI output with the deterministic builder before final validation, and expands the zero-dependency schema tests.

**Tech Stack:** Node.js ESM test scripts, CommonJS-compatible `server.js`, zero-dependency CLI tests, GitHub Actions QA artifacts.

---

### Task 1: Capture `evidenceIndex` Contract In Tests

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Make the valid fixture include evidence**

Change the fixture field:

```js
evidenceIndex: [],
```

To:

```js
evidenceIndex: [{ eventId: "evt_001", summary: "핵심 근거" }],
```

- [ ] **Step 2: Add missing, non-array, and empty-array cases**

Insert after the `keyMoments only 3 throws (need >=4)` block:

```js
expectThrows("evidenceIndex missing throws", () => {
  const f = validFixture();
  delete f.evidenceIndex;
  validateAnalysisOutput(f);
}, "evidenceIndex");

expectThrows("evidenceIndex object throws", () => {
  const f = validFixture();
  f.evidenceIndex = { evt_001: { summary: "x" } };
  validateAnalysisOutput(f);
}, "evidenceIndex");

expectThrows("evidenceIndex empty throws", () => {
  const f = validFixture();
  f.evidenceIndex = [];
  validateAnalysisOutput(f);
}, "evidenceIndex");
```

- [ ] **Step 3: Add invalid item-shape cases**

Insert after the empty-array case:

```js
expectThrows("evidenceIndex item missing eventId throws", () => {
  const f = validFixture();
  f.evidenceIndex = [{ summary: "근거" }];
  validateAnalysisOutput(f);
}, "evidenceIndex");

expectThrows("evidenceIndex item missing summary throws", () => {
  const f = validFixture();
  f.evidenceIndex = [{ eventId: "evt_001" }];
  validateAnalysisOutput(f);
}, "evidenceIndex");
```

- [ ] **Step 4: Run the RED test**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
30 passed, 5 failed
```

The five new `evidenceIndex` cases must fail because `validateAnalysisOutput()` does not validate the evidence index yet.

### Task 2: Wire Validator Support Into The Test Harness

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Extract the new helper for direct validator evaluation**

Add to the support-source section before `validateSrc`:

```js
if (serverSrc.includes("function hasValidEvidenceIndex(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidEvidenceIndex"));
}
```

This is needed because `schema-tests.mjs` evaluates `validateAnalysisOutput()` in isolation with `new Function()`.

### Task 3: Enforce And Repair `evidenceIndex`

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add the validator helper**

Add below `hasAnalysisMetaObject()`:

```js
function hasValidEvidenceIndex(evidenceIndex) {
  return Array.isArray(evidenceIndex) &&
    evidenceIndex.length > 0 &&
    evidenceIndex.every((item) =>
      item &&
      typeof item.eventId === "string" &&
      item.eventId &&
      typeof item.summary === "string" &&
      item.summary
    );
}
```

- [ ] **Step 2: Enforce the helper in `validateAnalysisOutput()`**

Add after the `keyMoments` check:

```js
if (!hasValidEvidenceIndex(json?.evidenceIndex)) throw new Error("evidenceIndex invalid");
```

- [ ] **Step 3: Repair invalid agent evidence before final validation**

Add after the `keyMoments` repair block in `buildAnalysis()`:

```js
if (!hasValidEvidenceIndex(primary.evidenceIndex)) {
  primary.evidenceIndex = buildEvidenceIndex(normalized);
  violations.push("missing.evidenceIndex");
}
```

### Task 4: Update Test Count Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the schema test count**

Change:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 30건
```

To:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 35건
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
35 passed, 0 failed
```

- [ ] **Step 2: Run the full zero-dependency suite**

Run:

```bash
npm test
```

Expected output includes:

```text
1337 passed, 0 failed across 40 test file(s)
```

- [ ] **Step 3: Run read-only smoke report**

Run:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/evidence-index-contract-local npm run smoke:report:readonly
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
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/evidence-index-contract-local
```

Expected: no matches and exit code `1`.

### Task 6: Publish And Record Evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-evidence-index-schema-contract.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Stage and commit**

Run:

```bash
git add server.js README.md test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-08-evidence-index-schema-contract.md
git commit -m "test: enforce evidence index schema contract"
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
