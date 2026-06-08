# Evidence Index Note Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let valid AI analysis output use the prompt-documented `evidenceIndex[].shortNote` field without being repaired as invalid evidence.

**Architecture:** Keep `evidenceIndex[].eventId` required and require one non-blank display note field. Accept `summary` and `shortNote` because the prompt example asks for `shortNote`, the UI already renders `shortNote || note || summary`, and the deterministic rule-based builder still emits `summary`.

**Tech Stack:** Node.js, plain JavaScript, existing schema extraction harness in `test-artifacts/schema/schema-tests.mjs`.

---

## File Map

- Modify: `test-artifacts/schema/schema-tests.mjs`
  - Add one RED test proving `evidenceIndex[].shortNote` is valid.
- Modify: `server.js`
  - Update `hasValidEvidenceIndex()` to accept non-blank `summary` or `shortNote`.
- Modify: `README.md`
  - Update the documented `npm run test:schema` count from 81 to 82.
- Create: `docs/superpowers/plans/2026-06-08-evidence-index-note-compatibility.md`
  - Record the TDD plan and QA checklist.

## Task 1: Add RED Evidence Note Compatibility Test

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [x] **Step 1: Add a passing-contract test for `shortNote`**

Insert this block immediately after `expectOk("valid fixture passes", ...)`:

```js
expectOk("evidenceIndex shortNote passes", () => {
  const f = validFixture();
  f.evidenceIndex = [{ eventId: "evt_001", shortNote: "핵심 근거" }];
  validateAnalysisOutput(f);
});
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output includes:

```text
FAIL  evidenceIndex shortNote passes — unexpected throw: evidenceIndex invalid
81 passed, 1 failed
```

This proves the current validator rejects the prompt-documented field.

## Task 2: Accept `summary` Or `shortNote` In Validator

**Files:**
- Modify: `server.js`

- [x] **Step 1: Update `hasValidEvidenceIndex()`**

Replace:

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

With:

```js
function hasValidEvidenceIndex(evidenceIndex) {
  return Array.isArray(evidenceIndex) &&
    evidenceIndex.length > 0 &&
    evidenceIndex.every((item) =>
      item &&
      isNonBlankString(item.eventId) &&
      (
        isNonBlankString(item.summary) ||
        isNonBlankString(item.shortNote)
      )
    );
}
```

The helper `isNonBlankString()` is already extracted before `validateAnalysisOutput()` in the schema test harness, so this remains testable in isolation.

- [x] **Step 2: Verify GREEN**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
82 passed, 0 failed
```

## Task 3: Update Docs And Run QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-evidence-index-note-compatibility.md`

- [x] **Step 1: Update README schema count**

Replace:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 81건
```

With:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 82건
```

- [x] **Step 2: Run syntax and focused checks**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/schema-tests.mjs
git diff --check
node test-artifacts/schema/schema-tests.mjs
```

Expected:

```text
82 passed, 0 failed
```

- [x] **Step 3: Run full tests**

Run:

```bash
npm test
```

Expected:

```text
1393 passed, 0 failed across 40 test file(s)
```

- [x] **Step 4: Run local read-only smoke report**

Use an existing read-only server if `/healthz` reports `publicDemoMode: "readonly"`, or start one:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/evidence-index-note-compatibility-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Inspect the generated `smoke-report.json` and confirm:

```text
status: passed
summary.passed: 156
summary.failed: 0
```

- [x] **Step 5: Scan temporary smoke output for sensitive patterns**

Run:

```bash
rg -n "RGAPI-[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]{8,}|Authorization:|api_key=|/Users/a1234|secret\\.json" test-artifacts/tmp/evidence-index-note-compatibility-local || true
```

Expected: no output.

- [ ] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-08-evidence-index-note-compatibility.md
git commit -m "fix: accept evidence short notes"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [ ] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/evidence-index-note-compatibility-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan covers the prompt/UI/server mismatch, a RED test that proves `shortNote` is currently rejected, the validator compatibility change, README count update, local QA, GitHub QA, and sensitive artifact scanning.
- Placeholder scan: The plan uses concrete file paths, code snippets, commands, expected output, commit message, and artifact handling.
- Type consistency: The accepted display note fields are `summary` and `shortNote`, matching `OUTPUT_SCHEMA_EXAMPLE` and `renderEvidencePanel()`.
