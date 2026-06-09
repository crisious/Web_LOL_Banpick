# Schema Metadata Nonblank Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject AI analysis outputs whose top-level schema metadata fields contain only whitespace.

**Architecture:** Keep the policy in `server.js`'s final schema validator. Reuse the existing `isNonBlankString()` helper in `validateAnalysisOutput()` for `schemaVersion`, `analysisMeta.sourceType`, and `analysisMeta.language`, without changing the existing schema version value contract.

**Tech Stack:** Node.js ESM test scripts, `server.js` pure helper extraction, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Pin Schema Metadata Nonblank Validation

**Files:**
- Create: `test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/schema/schema-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-schema-metadata-nonblank-policy.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs` with a source-extracted validator harness. The test must prove these behaviors:

```js
expectOk("valid metadata passes", () => validateAnalysisOutput(validFixture()));

expectThrows("schemaVersion rejects whitespace", () => {
  const f = validFixture();
  f.schemaVersion = "   ";
  validateAnalysisOutput(f);
}, "schemaVersion");

expectThrows("analysisMeta.sourceType rejects whitespace", () => {
  const f = validFixture();
  f.analysisMeta.sourceType = "   ";
  validateAnalysisOutput(f);
}, "analysisMeta.sourceType");

expectThrows("analysisMeta.language rejects tab-only", () => {
  const f = validFixture();
  f.analysisMeta.language = "\t";
  validateAnalysisOutput(f);
}, "analysisMeta.language");

checkTrue(
  "validateAnalysisOutput uses nonblank schemaVersion",
  validateAnalysisOutputSrc.includes("isNonBlankString(json?.schemaVersion)"),
);

checkTrue(
  "validateAnalysisOutput uses nonblank sourceType",
  validateAnalysisOutputSrc.includes("isNonBlankString(json.analysisMeta.sourceType)"),
);

checkTrue(
  "validateAnalysisOutput uses nonblank language",
  validateAnalysisOutputSrc.includes("isNonBlankString(json.analysisMeta.language)"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs
```

Expected: syntax check passes, runtime test fails because whitespace-only metadata fields still pass and `validateAnalysisOutput()` does not use `isNonBlankString()` for these fields.

Actual RED evidence at 2026-06-09 09:05 KST:

```text
node --check test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs
# passed

node test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs
# 1 passed, 6 failed
# whitespace schemaVersion/sourceType/language did not throw, and source-shape checks did not find isNonBlankString usage.
```

- [x] **Step 3: Implement the minimal validator policy**

In `server.js`, update only the first metadata checks in `validateAnalysisOutput()`:

```js
function validateAnalysisOutput(json) {
  if (!isNonBlankString(json?.schemaVersion)) throw new Error("missing schemaVersion");
  if (!hasAnalysisMetaObject(json?.analysisMeta)) throw new Error("missing analysisMeta");
  if (!isNonBlankString(json.analysisMeta.sourceType)) throw new Error("missing analysisMeta.sourceType");
  if (!isNonBlankString(json.analysisMeta.language)) throw new Error("missing analysisMeta.language");
  // Keep the rest of the function unchanged.
}
```

- [x] **Step 4: Extend the broad schema regression suite**

Add these cases to `test-artifacts/schema/schema-tests.mjs` near the existing schemaVersion and analysisMeta tests:

```js
expectThrows("blank schemaVersion throws", () => {
  const f = validFixture();
  f.schemaVersion = "   ";
  validateAnalysisOutput(f);
}, "schemaVersion");

expectThrows("analysisMeta whitespace sourceType throws", () => {
  const f = validFixture();
  f.analysisMeta.sourceType = "   ";
  validateAnalysisOutput(f);
}, "analysisMeta.sourceType");

expectThrows("analysisMeta tab-only language throws", () => {
  const f = validFixture();
  f.analysisMeta.language = "\t";
  validateAnalysisOutput(f);
}, "analysisMeta.language");
```

- [x] **Step 5: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs
node --check test-artifacts/schema/schema-tests.mjs
node test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/schema-metadata-nonblank-policy-local npm run smoke:report:readonly
```

Expected: every focused test passes, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN and local QA evidence at 2026-06-09 09:10 KST:

```text
node --check server.js
# passed

node --check test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs
# passed

node --check test-artifacts/schema/schema-tests.mjs
# passed

node test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs
# 7 passed, 0 failed

node test-artifacts/schema/schema-tests.mjs
# 105 passed, 0 failed

node test-artifacts/server/llm-payload-tests.mjs
# 84 passed, 0 failed

npm test
# 1989 passed, 0 failed across 76 test file(s)

git diff --check
# passed

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/schema-metadata-nonblank-policy-local npm run smoke:report:readonly
# qaStatus=passed, requiredChecks=13/13, smoke=156 passed / 0 failed, durationMs=195, mode=readonly

rg sensitive-output scan on test-artifacts/tmp/schema-metadata-nonblank-policy-local
# no matches
```

- [x] **Step 6: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-schema-metadata-nonblank-policy.md server.js test-artifacts/schema/schema-metadata-nonblank-policy-tests.mjs test-artifacts/schema/schema-tests.mjs
git commit -m "test: guard schema metadata strings"
git push origin main
```

Actual implementation commit evidence:

```text
commit d807cd2 test: guard schema metadata strings
push: f9ac203..d807cd2 main -> main
```

- [x] **Step 7: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the final evidence.

Actual implementation GitHub QA evidence at 2026-06-09 09:12 KST:

```text
workflow: QA
run: 27175216796
headSha: d807cd21232474d5bc5cfca4d1e1e29aa6f4fe29
artifact: qa-automation-27175216796 / 7495477224
qaStatus: passed
requiredChecks: 13/13
smoke: 156 passed / 0 failed
durationMs: 207
mode: readonly
artifact sensitive-output scan: no matches
```

- [ ] **Step 8: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-schema-metadata-nonblank-policy.md
git commit -m "docs: finalize schema metadata string policy"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean except for intentionally untracked local runtime artifacts that are removed before final status.
