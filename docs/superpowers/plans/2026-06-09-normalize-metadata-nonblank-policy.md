# Normalize Metadata Nonblank Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize whitespace-only AI metadata before final schema validation so valid primary AI analysis is preserved instead of falling back to rule-based analysis.

**Architecture:** Keep final schema validation strict, but make `buildAnalysis()`'s server-side normalization use `isNonBlankString()` for `schemaVersion`, `analysisMeta.sourceType`, and `analysisMeta.language`. This mirrors the validator contract and records the same `missing.*` schema violation labels when whitespace-only metadata is repaired.

**Tech Stack:** Node.js ESM test scripts, source-extracted `server.js` harnesses, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Pin AI Metadata Normalization Before Validation

**Files:**
- Create: `test-artifacts/server/analysis-metadata-normalization-tests.mjs`
- Modify: `server.js`
- Modify: `docs/superpowers/plans/2026-06-09-normalize-metadata-nonblank-policy.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/analysis-metadata-normalization-tests.mjs` with a source-extracted `buildAnalysis()` harness. The test must stub agent calls and fallback builders while evaluating the real `buildAnalysis()` source. It must prove:

```js
const result = await buildAnalysis(normalizedFixture(), "sample-meta");

check("primary analysis is preserved", result.matchSummary.headline, "primary headline");
check("schemaVersion whitespace normalizes", result.schemaVersion, "1.0");
check("sourceType whitespace normalizes", result.analysisMeta.sourceType, "claude_ai");
check("language tab normalizes", result.analysisMeta.language, "ko");
checkTrue("schemaViolations include schemaVersion", result.analysisMeta.schemaViolations.includes("missing.schemaVersion"));
checkTrue("schemaViolations include sourceType", result.analysisMeta.schemaViolations.includes("missing.analysisMeta.sourceType"));
checkTrue("schemaViolations include language", result.analysisMeta.schemaViolations.includes("missing.analysisMeta.language"));
check("schemaViolationCount", result.analysisMeta.schemaViolationCount, 3);

checkTrue(
  "buildAnalysis uses nonblank schemaVersion normalization",
  buildAnalysisSrc.includes("!isNonBlankString(primary.schemaVersion)"),
);
checkTrue(
  "buildAnalysis uses nonblank sourceType normalization",
  buildAnalysisSrc.includes("!isNonBlankString(primary.analysisMeta.sourceType)"),
);
checkTrue(
  "buildAnalysis uses nonblank language normalization",
  buildAnalysisSrc.includes("!isNonBlankString(primary.analysisMeta.language)"),
);
```

The fixture should give the primary AI response whitespace-only `schemaVersion`, `analysisMeta.sourceType`, and `analysisMeta.language`, plus otherwise valid analysis fields. The fallback stub must return a distinct `matchSummary.headline` such as `"fallback headline"` so the test fails if schema validation rejects the primary response and falls back.

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
```

Expected: syntax check passes, runtime test fails because whitespace-only metadata currently reaches `validateAnalysisOutput()`, triggers fallback, and the source-shape checks do not find `isNonBlankString()` in the normalization branches.

Actual RED evidence at 2026-06-09 09:19 KST:

```text
node --check test-artifacts/server/analysis-metadata-normalization-tests.mjs
# passed

node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 2 passed, 10 failed
# primary analysis fell back to "fallback headline"; fallbackCalls=1.
# sourceType stayed rule_based via fallback, schemaViolations were missing, and source-shape checks did not find isNonBlankString normalization.
```

- [x] **Step 3: Implement the minimal normalization policy**

In `server.js`, update only the metadata normalization checks in `buildAnalysis()`:

```js
if (!isNonBlankString(primary.schemaVersion)) {
  primary.schemaVersion = "1.0";
  violations.push("missing.schemaVersion");
}
// ...
if (!isNonBlankString(primary.analysisMeta.sourceType)) {
  primary.analysisMeta.sourceType = inferredPrimarySourceType;
  violations.push("missing.analysisMeta.sourceType");
}
if (!isNonBlankString(primary.analysisMeta.language)) {
  primary.analysisMeta.language = "ko";
  violations.push("missing.analysisMeta.language");
}
```

Do not change final validation, violation labels, agent selection, comparison logic, or any fallback builders.

- [x] **Step 4: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/server/analysis-metadata-normalization-tests.mjs
node test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/normalize-metadata-nonblank-policy-local npm run smoke:report:readonly
```

Expected: focused normalization and schema tests pass, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN and local QA evidence at 2026-06-09 09:21 KST:

```text
node --check server.js
# passed

node --check test-artifacts/server/analysis-metadata-normalization-tests.mjs
# passed

node test-artifacts/server/analysis-metadata-normalization-tests.mjs
# 12 passed, 0 failed

node test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs
# 7 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed

node test-artifacts/server/llm-payload-tests.mjs
# 84 passed, 0 failed

npm test
# 2001 passed, 0 failed across 77 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/normalize-metadata-nonblank-policy-local npm run smoke:report:readonly
# qaStatus=passed, requiredChecks=13/13, smoke=156 passed / 0 failed, durationMs=268, mode=readonly

rg sensitive-output scan on test-artifacts/tmp/normalize-metadata-nonblank-policy-local
# no matches
```

- [ ] **Step 5: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-normalize-metadata-nonblank-policy.md server.js test-artifacts/server/analysis-metadata-normalization-tests.mjs
git commit -m "fix: normalize analysis metadata strings"
git push origin main
```

- [ ] **Step 6: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the implementation evidence.

- [ ] **Step 7: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-normalize-metadata-nonblank-policy.md
git commit -m "docs: finalize normalize metadata string policy"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean after removing temporary QA artifacts.
