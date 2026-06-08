# Insight List Nonblank Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject AI analysis outputs whose strength or weakness insight fields contain only whitespace.

**Architecture:** Keep the policy in `server.js`'s final schema validator. Reuse the existing `isNonBlankString()` helper in `hasValidInsightList()` so strength/weakness validation matches the stricter behavior used by match summaries, evidence, action checklist, combat analysis, and teamfight phase analysis.

**Tech Stack:** Node.js ESM test scripts, `server.js` pure helper extraction, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Pin Insight List Nonblank Validation

**Files:**
- Create: `test-artifacts/schema/insight-list-nonblank-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/schema/schema-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-insight-list-nonblank-policy.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/schema/insight-list-nonblank-policy-tests.mjs` with a source-extracted validator harness. The test must prove these behaviors:

```js
expectOk("valid insight lists pass", () => validateAnalysisOutput(validFixture()));

expectThrows("strengths rejects whitespace id", () => {
  const f = validFixture();
  f.strengths[0] = { ...f.strengths[0], id: "   " };
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths rejects whitespace title", () => {
  const f = validFixture();
  f.strengths[0] = { ...f.strengths[0], title: "   " };
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("weaknesses rejects whitespace description", () => {
  const f = validFixture();
  f.weaknesses[0] = { ...f.weaknesses[0], description: "   " };
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("strengths rejects whitespace relatedEventIds", () => {
  const f = validFixture();
  f.strengths[0] = { ...f.strengths[0], relatedEventIds: ["evt_001", "   "] };
  validateAnalysisOutput(f);
}, "strengths");

checkTrue(
  "hasValidInsightList uses nonblank ids",
  hasValidInsightListSrc.includes("isNonBlankString(item.id)"),
);
checkTrue(
  "hasValidInsightList uses nonblank titles",
  hasValidInsightListSrc.includes("isNonBlankString(item.title)"),
);
checkTrue(
  "hasValidInsightList uses nonblank descriptions",
  hasValidInsightListSrc.includes("isNonBlankString(item.description)"),
);
checkTrue(
  "hasValidInsightList uses nonblank related event ids",
  hasValidInsightListSrc.includes("item.relatedEventIds.every((id) => isNonBlankString(id))"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/schema/insight-list-nonblank-policy-tests.mjs
node test-artifacts/schema/insight-list-nonblank-policy-tests.mjs
```

Expected: syntax check passes, runtime test fails because whitespace-only insight fields still pass and `hasValidInsightList()` does not use `isNonBlankString()`.

Actual RED evidence at 2026-06-09 08:34 KST:

```text
node --check test-artifacts/schema/insight-list-nonblank-policy-tests.mjs
# passed

node test-artifacts/schema/insight-list-nonblank-policy-tests.mjs
# 1 passed, 8 failed
# whitespace id/title/description/relatedEventIds did not throw, and source-shape checks did not find isNonBlankString usage.
```

- [x] **Step 3: Implement the minimal validator policy**

In `server.js`, update only `hasValidInsightList()`:

```js
function hasValidInsightList(items) {
  return Array.isArray(items) &&
    items.length >= INSIGHT_LIST_MIN &&
    items.length <= INSIGHT_LIST_MAX &&
    items.every((item) =>
      item &&
      isNonBlankString(item.id) &&
      isNonBlankString(item.title) &&
      isNonBlankString(item.description) &&
      Array.isArray(item.relatedEventIds) &&
      item.relatedEventIds.every((id) => isNonBlankString(id))
    );
}
```

- [x] **Step 4: Extend the broad schema regression suite**

Add these cases to `test-artifacts/schema/schema-tests.mjs` near the existing strengths/weaknesses validation tests:

```js
expectThrows("strengths item whitespace id throws", () => {
  const f = validFixture();
  f.strengths[0] = { ...f.strengths[0], id: "   " };
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths item whitespace title throws", () => {
  const f = validFixture();
  f.strengths[0] = { ...f.strengths[0], title: "   " };
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("weaknesses item whitespace description throws", () => {
  const f = validFixture();
  f.weaknesses[0] = { ...f.weaknesses[0], description: "   " };
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("strengths item whitespace relatedEventIds throws", () => {
  const f = validFixture();
  f.strengths[0] = { ...f.strengths[0], relatedEventIds: ["evt_001", "   "] };
  validateAnalysisOutput(f);
}, "strengths");
```

- [x] **Step 5: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/insight-list-nonblank-policy-tests.mjs
node --check test-artifacts/schema/schema-tests.mjs
node test-artifacts/schema/insight-list-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/server/strength-weakness-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-list-nonblank-policy-local npm run smoke:report:readonly
```

Expected: every focused test passes, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN/local QA evidence at 2026-06-09 08:38 KST:

```text
node --check server.js
# passed
node --check test-artifacts/schema/insight-list-nonblank-policy-tests.mjs
# passed
node --check test-artifacts/schema/schema-tests.mjs
# passed
node test-artifacts/schema/insight-list-nonblank-policy-tests.mjs
# 9 passed, 0 failed
node test-artifacts/schema/schema-tests.mjs
# 95 passed, 0 failed
node test-artifacts/server/llm-payload-tests.mjs
# 84 passed, 0 failed
node test-artifacts/server/strength-weakness-tests.mjs
# 89 passed, 0 failed
npm test
# 1955 passed, 0 failed across 73 test file(s)
git diff --check
# passed
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-list-nonblank-policy-local npm run smoke:report:readonly
# qaVerdict.status=passed, requiredChecks=13/13, smoke=156 passed / 0 failed, durationMs=639, mode=readonly, gitDirty=true
rg sensitive-output scan over test-artifacts/tmp/insight-list-nonblank-policy-local
# no matches
```

- [x] **Step 6: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-insight-list-nonblank-policy.md server.js test-artifacts/schema/insight-list-nonblank-policy-tests.mjs test-artifacts/schema/schema-tests.mjs
git commit -m "test: guard insight list strings"
git push origin main
```

Actual implementation publish evidence:

```text
git commit -m "test: guard insight list strings"
# 2fdb208 test: guard insight list strings
git push origin main
# pushed 06a5af1..2fdb208 main -> main
```

- [x] **Step 7: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the final evidence.

Actual implementation GitHub QA evidence:

```text
gh run watch 27173984052 --exit-status
# success

artifact: qa-automation-27173984052
artifact id: 7495060352
artifact size: 3554 bytes
artifact digest: sha256:3c9d2afa2262fc1ab8aabd7279e40c1bd2d622c36bdd831f69c7d1de1d13ab6b

qa-summary.json
# qaVerdict.status=passed
# requiredChecks=13/13
# smoke=156 passed / 0 failed
# durationMs=197
# mode=readonly
# ci.sha=2fdb2089c3e285b7513f5c53099db97b23bbc08e
# git.shortSha=2fdb208
# git.dirty=false

rg sensitive-output scan over test-artifacts/tmp/gh-run-27173984052
# no matches
```

- [ ] **Step 8: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-insight-list-nonblank-policy.md
git commit -m "docs: finalize insight list string policy"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean except for intentionally untracked local runtime artifacts that are removed before final status.
