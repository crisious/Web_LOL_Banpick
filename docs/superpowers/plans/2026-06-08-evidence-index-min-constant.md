# Evidence Index Min Constant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the evidence index minimum count use a shared `EVIDENCE_INDEX_MIN` constant across the LLM payload contract and final validator.

**Architecture:** `buildLlmPayload()` currently advertises `requiredArrayCounts.evidenceIndexMin: 1`, while `hasValidEvidenceIndex()` separately checks `evidenceIndex.length > 0`. Introduce `EVIDENCE_INDEX_MIN = 1` next to the other output count constants, then wire both payload and validator to that constant. Focused source-shape tests will fail first because the constant does not exist and the two call sites still use literals.

**Tech Stack:** Node.js zero-dependency extracted-function tests, `server.js`, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Source-Shape Coverage

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`
- Modify: `test-artifacts/schema/schema-tests.mjs`
- Modify: `README.md`

- [x] **Step 1: Add payload source-shape checks**

Inside `test-artifacts/server/llm-payload-tests.mjs`, in case 5 after the existing `requiredArrayCounts.evidenceIndexMin` value check, add:

```js
  checkTrue("server defines EVIDENCE_INDEX_MIN", serverSrc.includes("const EVIDENCE_INDEX_MIN = 1;"));
  checkTrue("buildLlmPayload requiredArrayCounts uses EVIDENCE_INDEX_MIN", buildSrc.includes("evidenceIndexMin: EVIDENCE_INDEX_MIN"));
```

When implementing the constant, also add this entry to `tfConstants` after `PHASE_SUMMARIES_MIN` so the extracted `buildLlmPayload()` closure can evaluate the new constant:

```js
  extractConstSource(serverSrc, "EVIDENCE_INDEX_MIN"),
```

- [x] **Step 2: Add schema harness support and validator source-shape check**

Inside `test-artifacts/schema/schema-tests.mjs`, before the existing `hasValidEvidenceIndex` helper extraction block, add:

```js
if (serverSrc.includes("const EVIDENCE_INDEX_MIN =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "EVIDENCE_INDEX_MIN"));
}
```

Then store the extracted validator helper source after `validateAnalysisOutput` is created:

```js
const evidenceIndexValidatorSrc = extractFunctionSource(serverSrc, "hasValidEvidenceIndex");
```

Add this source-shape check after the existing `evidenceIndex empty throws` case:

```js
checkTrue("hasValidEvidenceIndex uses EVIDENCE_INDEX_MIN", evidenceIndexValidatorSrc.includes("evidenceIndex.length >= EVIDENCE_INDEX_MIN"));
```

If `schema-tests.mjs` does not yet define `checkTrue`, add this helper after `expectOk`:

```js
function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}
```

- [x] **Step 3: Run focused RED tests**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected before implementation:

```text
llm-payload: 82 passed, 2 failed
schema: 85 passed, 1 failed
```

The value-level evidence index behavior is already correct, so RED intentionally checks that the payload and validator source use the shared constant rather than duplicated literals.

### Task 2: Wire Evidence Index Minimum To Shared Constant

**Files:**
- Modify: `server.js`

- [x] **Step 1: Define `EVIDENCE_INDEX_MIN` with the output count constants**

Add this after `PHASE_SUMMARIES_MIN`:

```js
// evidenceIndex는 인사이트 근거 추적을 위해 최소 1개 이상을 검증한다.
const EVIDENCE_INDEX_MIN = 1;
```

- [x] **Step 2: Replace payload literal**

Change:

```js
evidenceIndexMin: 1,
```

To:

```js
evidenceIndexMin: EVIDENCE_INDEX_MIN,
```

- [x] **Step 3: Replace validator literal**

Change:

```js
evidenceIndex.length > 0 &&
```

To:

```js
evidenceIndex.length >= EVIDENCE_INDEX_MIN &&
```

- [x] **Step 4: Run focused GREEN tests**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

Expected after implementation:

```text
llm-payload: 84 passed, 0 failed
schema: 86 passed, 0 failed
```

### Task 3: QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-evidence-index-min-constant.md`

- [x] **Step 1: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/llm-payload-tests.mjs
node --check test-artifacts/schema/schema-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-08-evidence-index-min-constant.md
```

Expected: the first four commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 2: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1451 passed, 0 failed
```

- [x] **Step 3: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/evidence-index-min-constant-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/evidence-index-min-constant-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 4: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/evidence-index-min-constant-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-08-evidence-index-min-constant.md`

- [ ] **Step 1: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/llm-payload-tests.mjs test-artifacts/schema/schema-tests.mjs README.md docs/superpowers/plans/2026-06-08-evidence-index-min-constant.md
git commit -m "test: share evidence index minimum"
git push origin main
```

- [ ] **Step 3: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/evidence-index-min-constant-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/evidence-index-min-constant-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

---

## Self-Review

- Spec coverage: This plan aligns the evidence index minimum across payload contract metadata and final validator logic.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `EVIDENCE_INDEX_MIN`, `evidenceIndexMin`, `hasValidEvidenceIndex`, and `evidenceIndex.length >= EVIDENCE_INDEX_MIN` are named consistently across tests and implementation.
