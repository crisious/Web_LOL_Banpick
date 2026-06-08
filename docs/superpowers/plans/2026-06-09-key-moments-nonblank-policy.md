# Key Moments Nonblank Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject AI analysis outputs whose key moment ids, timestamps, display fields, or related event ids contain only whitespace.

**Architecture:** Keep the policy in `server.js`'s final schema validator. Reuse the existing `isNonBlankString()` helper in `hasValidKeyMoments()` while preserving the existing alternate-field contract: `id` or `eventId`, `timestampLabel` or `timestamp`, `title` or `label`, and `description` or `reason`.

**Tech Stack:** Node.js ESM test scripts, `server.js` pure helper extraction, npm QA scripts, GitHub Actions QA workflow.

---

### Task 1: Pin Key Moments Nonblank Validation

**Files:**
- Create: `test-artifacts/schema/key-moments-nonblank-policy-tests.mjs`
- Modify: `server.js`
- Modify: `test-artifacts/schema/schema-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-key-moments-nonblank-policy.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/schema/key-moments-nonblank-policy-tests.mjs` with a source-extracted validator harness. The test must prove these behaviors:

```js
expectOk("valid key moments pass", () => validateAnalysisOutput(validFixture()));

expectOk("valid alternate key moment fields pass", () => {
  const f = validFixture();
  f.keyMoments[0] = {
    eventId: "km_event_1",
    timestamp: "08:30",
    phase: "EARLY",
    label: "초반 교전",
    reason: "정글 개입 이후 라인 손실",
    relatedEventIds: ["evt_001"],
  };
  validateAnalysisOutput(f);
});

expectThrows("keyMoments rejects whitespace id without eventId", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], id: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments rejects whitespace timestampLabel without timestamp", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], timestampLabel: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments rejects whitespace title without label", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], title: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments rejects whitespace description without reason", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], description: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments rejects whitespace relatedEventIds", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], relatedEventIds: ["evt_001", "   "] };
  validateAnalysisOutput(f);
}, "keyMoments");

checkTrue(
  "hasValidKeyMoments uses nonblank id alternate",
  hasValidKeyMomentsSrc.includes("isNonBlankString(item.id)") &&
    hasValidKeyMomentsSrc.includes("isNonBlankString(item.eventId)"),
);
checkTrue(
  "hasValidKeyMoments uses nonblank timestamp alternate",
  hasValidKeyMomentsSrc.includes("isNonBlankString(item.timestampLabel)") &&
    hasValidKeyMomentsSrc.includes("isNonBlankString(item.timestamp)"),
);
checkTrue(
  "hasValidKeyMoments uses nonblank title alternate",
  hasValidKeyMomentsSrc.includes("isNonBlankString(item.title)") &&
    hasValidKeyMomentsSrc.includes("isNonBlankString(item.label)"),
);
checkTrue(
  "hasValidKeyMoments uses nonblank description alternate",
  hasValidKeyMomentsSrc.includes("isNonBlankString(item.description)") &&
    hasValidKeyMomentsSrc.includes("isNonBlankString(item.reason)"),
);
checkTrue(
  "hasValidKeyMoments uses nonblank related event ids",
  hasValidKeyMomentsSrc.includes("item.relatedEventIds.every((id) => isNonBlankString(id))"),
);
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --check test-artifacts/schema/key-moments-nonblank-policy-tests.mjs
node test-artifacts/schema/key-moments-nonblank-policy-tests.mjs
```

Expected: syntax check passes, runtime test fails because whitespace-only key moment fields still pass and `hasValidKeyMoments()` does not use `isNonBlankString()`.

Actual RED evidence at 2026-06-09 08:45 KST:

```text
node --check test-artifacts/schema/key-moments-nonblank-policy-tests.mjs
# passed

node test-artifacts/schema/key-moments-nonblank-policy-tests.mjs
# 2 passed, 10 failed
# whitespace id/timestampLabel/title/description/relatedEventIds did not throw, and source-shape checks did not find isNonBlankString usage.
```

- [x] **Step 3: Implement the minimal validator policy**

In `server.js`, update only `hasValidKeyMoments()`:

```js
function hasValidKeyMoments(keyMoments) {
  return Array.isArray(keyMoments) &&
    keyMoments.length >= KEY_MOMENTS_MIN &&
    keyMoments.every((item) =>
      item &&
      (
        isNonBlankString(item.id) ||
        isNonBlankString(item.eventId)
      ) &&
      (
        isNonBlankString(item.timestampLabel) ||
        isNonBlankString(item.timestamp)
      ) &&
      isValidGamePhase(item.phase) &&
      (
        isNonBlankString(item.title) ||
        isNonBlankString(item.label)
      ) &&
      (
        isNonBlankString(item.description) ||
        isNonBlankString(item.reason)
      ) &&
      Array.isArray(item.relatedEventIds) &&
      item.relatedEventIds.every((id) => isNonBlankString(id))
    );
}
```

- [x] **Step 4: Extend the broad schema regression suite**

Add these cases to `test-artifacts/schema/schema-tests.mjs` near the existing keyMoments validation tests:

```js
expectThrows("keyMoments item whitespace id/eventId throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], id: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item whitespace timestamp throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], timestampLabel: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item whitespace title/label throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], title: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item whitespace description/reason throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], description: "   " };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item whitespace relatedEventIds throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { ...f.keyMoments[0], relatedEventIds: ["evt_001", "   "] };
  validateAnalysisOutput(f);
}, "keyMoments");
```

- [x] **Step 5: Run focused and full local QA**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/key-moments-nonblank-policy-tests.mjs
node --check test-artifacts/schema/schema-tests.mjs
node test-artifacts/schema/key-moments-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
node test-artifacts/server/teamfight-phase-tests.mjs
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-nonblank-policy-local npm run smoke:report:readonly
```

Expected: every focused test passes, full `npm test` passes with zero failures, diff whitespace check passes, and readonly smoke report has `qaVerdict.status = "passed"`.

Actual GREEN/local QA evidence at 2026-06-09 08:49 KST:

```text
node --check server.js
# passed
node --check test-artifacts/schema/key-moments-nonblank-policy-tests.mjs
# passed
node --check test-artifacts/schema/schema-tests.mjs
# passed
node test-artifacts/schema/key-moments-nonblank-policy-tests.mjs
# 12 passed, 0 failed
node test-artifacts/schema/schema-tests.mjs
# 100 passed, 0 failed
node test-artifacts/server/llm-payload-tests.mjs
# 84 passed, 0 failed
node test-artifacts/server/teamfight-phase-tests.mjs
# 38 passed, 0 failed
npm test
# 1972 passed, 0 failed across 74 test file(s)
git diff --check
# passed
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-nonblank-policy-local npm run smoke:report:readonly
# qaVerdict.status=passed, requiredChecks=13/13, smoke=156 passed / 0 failed, durationMs=217, mode=readonly, gitDirty=true
rg sensitive-output scan over test-artifacts/tmp/key-moments-nonblank-policy-local
# no matches
```

- [x] **Step 6: Commit and push implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-key-moments-nonblank-policy.md server.js test-artifacts/schema/key-moments-nonblank-policy-tests.mjs test-artifacts/schema/schema-tests.mjs
git commit -m "test: guard key moment strings"
git push origin main
```

Actual implementation publish evidence:

```text
git commit -m "test: guard key moment strings"
# 0969ceb test: guard key moment strings
git push origin main
# pushed 941b1bc..0969ceb main -> main
```

- [x] **Step 7: Verify GitHub QA and finalize docs**

Use `gh run watch` for the implementation commit's QA run. Download the `qa-automation-<run-id>` artifact, inspect `qa-summary.json`, run the sensitive-output scan, then update this plan and the Obsidian project improvement note with the final evidence.

Actual implementation GitHub QA evidence:

```text
gh run watch 27174395635 --exit-status
# success

artifact: qa-automation-27174395635
artifact id: 7495207360
artifact size: 3550 bytes
artifact digest: sha256:012a729a9c318372110178b3d089896f005a3b5391f45fd13ae77ae40f39d31d

qa-summary.json
# qaVerdict.status=passed
# requiredChecks=13/13
# smoke=156 passed / 0 failed
# durationMs=199
# mode=readonly
# ci.sha=0969ceb6ea38a385d535d4e78fb1402c21f8a98c
# git.shortSha=0969ceb
# git.dirty=false

rg sensitive-output scan over test-artifacts/tmp/gh-run-27174395635
# no matches
```

- [ ] **Step 8: Commit final documentation and sync main**

Run:

```bash
git add docs/superpowers/plans/2026-06-09-key-moments-nonblank-policy.md
git commit -m "docs: finalize key moment string policy"
git push origin main
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
```

Expected: final GitHub QA passes, `main...origin/main` is `0 0`, and the worktree is clean except for intentionally untracked local runtime artifacts that are removed before final status.
