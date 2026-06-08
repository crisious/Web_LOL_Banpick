# Summary Text Shape Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent malformed summary text values from passing the final analysis schema gate.

**Architecture:** `validateAnalysisOutput()` is the final server-side safety gate before generated analysis reaches stored reports and the UI. This change adds small summary validators for `matchSummary.headline` and `coachSummary.overallSummary`, repairs malformed AI output with existing deterministic builders, and expands the zero-dependency schema tests.

**Tech Stack:** Node.js, plain JavaScript, local schema harness in `test-artifacts/schema/schema-tests.mjs`.

---

## File Map

- Modify: `server.js`
  - Add summary text helper functions near the existing output schema validators.
  - Replace truthy-only summary checks in `validateAnalysisOutput()`.
  - Repair malformed AI summary values in `buildAnalysis()` before final validation.
- Modify: `test-artifacts/schema/schema-tests.mjs`
  - Extract the new helper functions into the isolated validator harness.
  - Add RED tests for truthy but invalid summary values.
- Modify: `README.md`
  - Update the documented schema focused test count from 57 to 63.
- Create: `docs/superpowers/plans/2026-06-08-summary-text-shape-contract.md`
  - Record the implementation plan and QA checklist.

## Task 1: Add RED Schema Tests

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Extend helper extraction**

Add the following extraction block after the `hasAnalysisMetaObject` extraction block:

```js
if (serverSrc.includes("function isNonBlankString(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "isNonBlankString"));
}
if (serverSrc.includes("function hasValidMatchSummary(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidMatchSummary"));
}
if (serverSrc.includes("function hasValidCoachSummary(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidCoachSummary"));
}
```

- [ ] **Step 2: Add failing match summary tests**

Insert these tests after `matchSummary as string throws (no .headline)`:

```js
expectThrows("matchSummary headline array throws", () => {
  const f = validFixture();
  f.matchSummary = { headline: ["한 줄 요약"] };
  validateAnalysisOutput(f);
}, "matchSummary.headline");

expectThrows("matchSummary headline number throws", () => {
  const f = validFixture();
  f.matchSummary = { headline: 123 };
  validateAnalysisOutput(f);
}, "matchSummary.headline");

expectThrows("matchSummary blank headline throws", () => {
  const f = validFixture();
  f.matchSummary = { headline: "   " };
  validateAnalysisOutput(f);
}, "matchSummary.headline");
```

- [ ] **Step 3: Add failing coach summary tests**

Insert these tests after `coachSummary missing overallSummary throws`:

```js
expectThrows("coachSummary overallSummary array throws", () => {
  const f = validFixture();
  f.coachSummary = { overallSummary: ["전체 흐름 요약"] };
  validateAnalysisOutput(f);
}, "coachSummary.overallSummary");

expectThrows("coachSummary overallSummary number throws", () => {
  const f = validFixture();
  f.coachSummary = { overallSummary: 123 };
  validateAnalysisOutput(f);
}, "coachSummary.overallSummary");

expectThrows("coachSummary blank overallSummary throws", () => {
  const f = validFixture();
  f.coachSummary = { overallSummary: "   " };
  validateAnalysisOutput(f);
}, "coachSummary.overallSummary");
```

- [ ] **Step 4: Verify RED**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
57 passed, 6 failed
```

The six new tests fail because the current validator accepts truthy arrays, numbers, and whitespace-only strings.

## Task 2: Implement Summary Validators And Repair

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add summary helper functions**

Add these helpers after `hasAnalysisMetaObject()`:

```js
function isNonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidMatchSummary(matchSummary) {
  return Boolean(matchSummary) &&
    typeof matchSummary === "object" &&
    !Array.isArray(matchSummary) &&
    isNonBlankString(matchSummary.headline);
}

function hasValidCoachSummary(coachSummary) {
  return Boolean(coachSummary) &&
    typeof coachSummary === "object" &&
    !Array.isArray(coachSummary) &&
    isNonBlankString(coachSummary.overallSummary);
}
```

- [ ] **Step 2: Replace final validation checks**

Replace:

```js
if (!json?.matchSummary?.headline) throw new Error("missing matchSummary.headline");
if (!json?.coachSummary?.overallSummary) throw new Error("missing coachSummary.overallSummary");
```

With:

```js
if (!hasValidMatchSummary(json?.matchSummary)) throw new Error("missing matchSummary.headline");
if (!hasValidCoachSummary(json?.coachSummary)) throw new Error("missing coachSummary.overallSummary");
```

- [ ] **Step 3: Tighten match summary repair**

Replace the current `matchSummary` normalization block in `buildAnalysis()` with:

```js
  // matchSummary: AI가 string으로 반환하는 경우 → 객체로 정규화
  if (typeof primary.matchSummary === "string") {
    primary.matchSummary = { headline: primary.matchSummary };
    violations.push("type.matchSummary.string");
  } else if (!primary.matchSummary || typeof primary.matchSummary !== "object" || Array.isArray(primary.matchSummary)) {
    primary.matchSummary = {};
    violations.push("type.matchSummary.invalid");
  }
  if (!hasValidMatchSummary(primary.matchSummary)) {
    const fb = buildRuleBasedAnalysis(normalized, sampleId);
    primary.matchSummary.headline = fb.matchSummary.headline;
    violations.push("missing.matchSummary.headline");
  }
```

- [ ] **Step 4: Tighten coach summary repair**

Replace the current `coachSummary` normalization block in `buildAnalysis()` with:

```js
  // coachSummary: AI가 string으로 반환하는 경우 → 객체로 정규화
  if (typeof primary.coachSummary === "string") {
    primary.coachSummary = { overallSummary: primary.coachSummary };
    violations.push("type.coachSummary.string");
  } else if (!primary.coachSummary || typeof primary.coachSummary !== "object" || Array.isArray(primary.coachSummary)) {
    primary.coachSummary = {};
    violations.push("type.coachSummary.invalid");
  }
  if (!hasValidCoachSummary(primary.coachSummary)) {
    const fb = buildCoachSummary(normalized);
    primary.coachSummary.overallSummary = fb.overallSummary;
    violations.push("missing.coachSummary.overallSummary");
  }
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
63 passed, 0 failed
```

## Task 3: Documentation And QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-summary-text-shape-contract.md`

- [ ] **Step 1: Update README test count**

Replace the schema focused test count:

```text
57 passed, 0 failed
```

With:

```text
63 passed, 0 failed
```

- [ ] **Step 2: Run syntax and diff checks**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/schema-tests.mjs
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Run focused and full test suites**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
npm test
```

Expected:

```text
63 passed, 0 failed
1365 passed, 0 failed across 40 test file(s)
```

- [ ] **Step 4: Run local read-only smoke report**

Start the app:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/summary-text-shape-contract-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Inspect `test-artifacts/tmp/summary-text-shape-contract-local/qa-summary.json` and confirm:

```json
{
  "status": "passed",
  "smoke": { "passed": 156, "failed": 0 },
  "qaVerdict": "passed",
  "shareable": true,
  "sample": "passed",
  "demo": "passed",
  "artifact": "passed",
  "required": "passed"
}
```

- [ ] **Step 5: Scan temporary smoke output for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/summary-text-shape-contract-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

- [ ] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-08-summary-text-shape-contract.md
git commit -m "test: enforce summary text shape contract"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [ ] **Step 7: Verify GitHub QA artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 8 --json databaseId,headSha,status,conclusion,url,createdAt,displayTitle
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/summary-text-shape-contract-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan covers the two user-visible summary text fields, final validator behavior, AI repair behavior, focused tests, full tests, smoke report, GitHub QA, and documentation.
- Placeholder scan: The plan contains concrete file paths, code snippets, commands, and expected outputs.
- Type consistency: The helper names used by tests and implementation are `isNonBlankString`, `hasValidMatchSummary`, and `hasValidCoachSummary`.
