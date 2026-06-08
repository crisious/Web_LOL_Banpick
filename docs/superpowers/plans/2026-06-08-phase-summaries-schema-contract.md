# Phase Summaries Schema Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `phaseSummaries` a required array contract in the final analysis validator so malformed AI responses cannot pass the last schema gate.

**Architecture:** `server.js` already normalizes common model drift before calling `validateAnalysisOutput()`. This change adds a small `phaseSummaries` validator helper, repairs invalid primary agent output with `buildPhaseSummaries(normalized)`, and expands the zero-dependency schema harness so direct validator tests enforce the same output shape described in the prompt.

**Tech Stack:** Node.js ESM test scripts, CommonJS-compatible `server.js`, zero-dependency CLI tests, GitHub Actions QA artifacts.

---

### Task 1: Capture The Schema Contract In Tests

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Replace the tolerated object case with a real rejection**

Change the existing `phaseSummaries as object (not array) — currently silent` block to:

```js
expectThrows("phaseSummaries as object throws", () => {
  const f = validFixture();
  f.phaseSummaries = { early: { summary: "x" }, mid: { summary: "y" }, late: { summary: "z" } };
  validateAnalysisOutput(f);
}, "phaseSummaries");
```

- [ ] **Step 2: Add missing and short-array cases**

Insert immediately after the object rejection:

```js
expectThrows("phaseSummaries missing throws", () => {
  const f = validFixture();
  delete f.phaseSummaries;
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries only 2 throws", () => {
  const f = validFixture();
  f.phaseSummaries = f.phaseSummaries.slice(0, 2);
  validateAnalysisOutput(f);
}, "phaseSummaries");
```

- [ ] **Step 3: Add invalid item-shape cases**

Insert after the short-array case:

```js
expectThrows("phaseSummaries item missing phase throws", () => {
  const f = validFixture();
  f.phaseSummaries = [{ summary: "early" }, { phase: "MID", summary: "mid" }, { phase: "LATE", summary: "late" }];
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries item missing summary throws", () => {
  const f = validFixture();
  f.phaseSummaries = [{ phase: "EARLY" }, { phase: "MID", summary: "mid" }, { phase: "LATE", summary: "late" }];
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries item object missing throws", () => {
  const f = validFixture();
  f.phaseSummaries = [null, { phase: "MID", summary: "mid" }, { phase: "LATE", summary: "late" }];
  validateAnalysisOutput(f);
}, "phaseSummaries");
```

- [ ] **Step 4: Run the RED test**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
18 passed, 6 failed
```

The six new/changed `phaseSummaries` cases must fail because `validateAnalysisOutput()` does not validate that field yet.

### Task 2: Wire Validator Support Into The Test Harness

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Generalize helper extraction**

Replace `keyMomentsSupportSrc` with:

```js
const validatorSupportSources = [];
if (serverSrc.includes("const KEY_MOMENTS_MIN =")) {
  validatorSupportSources.push(
    extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
    extractFunctionSource(serverSrc, "hasMinimumKeyMoments"),
  );
}
if (serverSrc.includes("const PHASE_SUMMARIES_MIN =")) {
  validatorSupportSources.push(
    extractConstSource(serverSrc, "PHASE_SUMMARIES_MIN"),
    extractFunctionSource(serverSrc, "hasValidPhaseSummaries"),
  );
}
```

- [ ] **Step 2: Evaluate the validator with all support helpers**

Update the `new Function` call to:

```js
const validateAnalysisOutput = new Function(
  `${validatorSupportSources.join("\n")}\n${validateSrc}\nreturn validateAnalysisOutput;`,
)();
```

### Task 3: Enforce And Repair `phaseSummaries`

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add the minimum constant**

Add near `KEY_MOMENTS_MIN`:

```js
const PHASE_SUMMARIES_MIN = 3;
```

- [ ] **Step 2: Add the validator helper**

Add below `hasMinimumKeyMoments()`:

```js
function hasValidPhaseSummaries(phaseSummaries) {
  return Array.isArray(phaseSummaries) &&
    phaseSummaries.length >= PHASE_SUMMARIES_MIN &&
    phaseSummaries.every((item) =>
      item &&
      typeof item.phase === "string" &&
      item.phase &&
      typeof item.summary === "string" &&
      item.summary
    );
}
```

- [ ] **Step 3: Enforce the helper in `validateAnalysisOutput()`**

Add after the `coachSummary.overallSummary` check:

```js
if (!hasValidPhaseSummaries(json?.phaseSummaries)) throw new Error(`phaseSummaries < ${PHASE_SUMMARIES_MIN}`);
```

- [ ] **Step 4: Repair invalid agent output before final validation**

Add after the object-to-array normalization block in `buildAnalysis()`:

```js
if (!hasValidPhaseSummaries(primary.phaseSummaries)) {
  primary.phaseSummaries = buildPhaseSummaries(normalized);
  violations.push(`count.phaseSummaries<${PHASE_SUMMARIES_MIN}`);
}
```

### Task 4: Update Test Count Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the schema test count**

Change:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 19건
```

To:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 24건
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
24 passed, 0 failed
```

- [ ] **Step 2: Run the full zero-dependency suite**

Run:

```bash
npm test
```

Expected output includes:

```text
1326 passed, 0 failed across 40 test file(s)
```

- [ ] **Step 3: Run read-only smoke report**

Run:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-contract-local npm run smoke:report:readonly
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
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/phase-summaries-contract-local
```

Expected: no matches and exit code `1`.

### Task 6: Publish And Record Evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-phase-summaries-schema-contract.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Stage and commit**

Run:

```bash
git add server.js README.md test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-08-phase-summaries-schema-contract.md
git commit -m "test: enforce phase summaries schema contract"
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

Expected: the run for the pushed commit succeeds and includes a `qa-smoke-report` artifact.

- [ ] **Step 4: Update Obsidian project notes**

Record the commit SHA, GitHub run ID, artifact ID, local QA summary, GitHub QA summary, and sensitive artifact scan result under `게임 기획/LOL AI Coach`.
