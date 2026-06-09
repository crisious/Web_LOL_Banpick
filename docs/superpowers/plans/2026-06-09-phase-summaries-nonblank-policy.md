# Phase Summaries Nonblank Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject AI analysis outputs whose phase summary text contains only whitespace.

**Architecture:** Keep the policy in `server.js`'s final schema validator. Reuse the existing `isNonBlankString()` helper in `hasValidPhaseSummaries()` while preserving the existing `GAME_PHASES` enum validation for `phase`.

**Tech Stack:** Node.js ESM test scripts, `server.js` pure helper extraction, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Pin Phase Summaries Nonblank Validation

**Files:**
- Create: `test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/schema/schema-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-phase-summaries-nonblank-policy.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs` with a source-extracted validator harness. The test must prove these behaviors:

```js
expectOk("valid phase summaries pass", () => validateAnalysisOutput(validFixture()));

expectThrows("phaseSummaries rejects whitespace summary", () => {
  const f = validFixture();
  f.phaseSummaries[0] = { ...f.phaseSummaries[0], summary: "   " };
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries rejects tab-only summary", () => {
  const f = validFixture();
  f.phaseSummaries[1] = { ...f.phaseSummaries[1], summary: "\t" };
  validateAnalysisOutput(f);
}, "phaseSummaries");

checkTrue(
  "hasValidPhaseSummaries uses nonblank summary",
  hasValidPhaseSummariesSrc.includes("isNonBlankString(item.summary)"),
);

checkTrue(
  "hasValidPhaseSummaries keeps game phase enum validation",
  hasValidPhaseSummariesSrc.includes("isValidGamePhase(item.phase)"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
node test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
```

Expected: syntax check passes, runtime test fails because whitespace-only phase summary text still passes and `hasValidPhaseSummaries()` does not use `isNonBlankString(item.summary)`.

Actual RED evidence at 2026-06-09 08:55 KST:

```text
node --check test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
# passed

node test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
# 2 passed, 3 failed
# whitespace and tab-only summaries did not throw, and source-shape checks did not find isNonBlankString(item.summary).
```

- [x] **Step 3: Implement the minimal validator policy**

In `server.js`, update only `hasValidPhaseSummaries()`:

```js
function hasValidPhaseSummaries(phaseSummaries) {
  return Array.isArray(phaseSummaries) &&
    phaseSummaries.length >= PHASE_SUMMARIES_MIN &&
    phaseSummaries.every((item) =>
      item &&
      isValidGamePhase(item.phase) &&
      isNonBlankString(item.summary)
    );
}
```

- [x] **Step 4: Extend the broad schema regression suite**

Add these cases to `test-artifacts/schema/schema-tests.mjs` near the existing phaseSummaries validation tests:

```js
expectThrows("phaseSummaries item whitespace summary throws", () => {
  const f = validFixture();
  f.phaseSummaries[0] = { ...f.phaseSummaries[0], summary: "   " };
  validateAnalysisOutput(f);
}, "phaseSummaries");

expectThrows("phaseSummaries item tab-only summary throws", () => {
  const f = validFixture();
  f.phaseSummaries[1] = { ...f.phaseSummaries[1], summary: "\t" };
  validateAnalysisOutput(f);
}, "phaseSummaries");
```

- [x] **Step 5: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
node --check test-artifacts/schema/schema-tests.mjs
node test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-nonblank-policy-local npm run smoke:report:readonly
```

Expected: every focused test passes, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN/local QA evidence at 2026-06-09 08:59 KST:

```text
node --check server.js
# passed
node --check test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
# passed
node --check test-artifacts/schema/schema-tests.mjs
# passed
node test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
# 5 passed, 0 failed
node test-artifacts/schema/schema-tests.mjs
# 102 passed, 0 failed
node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
# 9 passed, 0 failed
node test-artifacts/server/llm-payload-tests.mjs
# 84 passed, 0 failed
npm test
# 1979 passed, 0 failed across 75 test file(s)
git diff --check
# passed
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-nonblank-policy-local npm run smoke:report:readonly
# qaVerdict.status=passed, requiredChecks=13/13, smoke=156 passed / 0 failed, durationMs=291, mode=readonly, gitDirty=true
rg sensitive-output scan over test-artifacts/tmp/phase-summaries-nonblank-policy-local
# no matches
```

- [ ] **Step 6: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summaries-nonblank-policy.md server.js test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs test-artifacts/schema/schema-tests.mjs
git commit -m "test: guard phase summary strings"
git push origin main
```

- [ ] **Step 7: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the final evidence.

- [ ] **Step 8: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summaries-nonblank-policy.md
git commit -m "docs: finalize phase summary string policy"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean except for intentionally untracked local runtime artifacts that are removed before final status.
