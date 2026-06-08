# Evidence Index Output Count Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `evidenceIndexMin` to the LLM payload `outputContract.requiredArrayCounts` so the payload contract exposes the same non-empty evidence index requirement enforced by `validateAnalysisOutput()`.

**Architecture:** Keep runtime validation and repair behavior unchanged. Add one focused payload contract assertion, then add `evidenceIndexMin: 1` to `buildLlmPayload()` and update the README test count to match the new assertion.

**Tech Stack:** Node.js, ES modules, local text extraction tests, single-server `server.js` runtime.

---

## File Map

- Modify: `test-artifacts/server/llm-payload-tests.mjs`
  - Add a focused assertion for `requiredArrayCounts.evidenceIndexMin`.
- Modify: `server.js`
  - Add `evidenceIndexMin: 1` to `outputContract.requiredArrayCounts` inside `buildLlmPayload()`.
- Modify: `README.md`
  - Update the `npm run test:llm-payload` count from 58 to 59.
- Create: `docs/superpowers/plans/2026-06-08-evidence-index-output-count-contract.md`
  - Track RED, GREEN, QA, commit, push, and GitHub artifact verification.

## Task 1: Add RED Output Count Test

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`

- [x] **Step 1: Add explicit evidence index count check**

Add this line after the existing `requiredArrayCounts.phaseSummariesMin` check:

```js
check("requiredArrayCounts.evidenceIndexMin", out.outputContract.requiredArrayCounts.evidenceIndexMin, 1);
```

- [x] **Step 2: Run RED**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
FAIL  requiredArrayCounts.evidenceIndexMin
  expected 1
  got      undefined

58 passed, 1 failed
```

## Task 2: Add Missing Array Count

**Files:**
- Modify: `server.js`

- [x] **Step 1: Update `buildLlmPayload()` output contract**

Change:

```js
requiredArrayCounts: { phaseSummariesMin: PHASE_SUMMARIES_MIN, strengths: 3, weaknesses: 3, actionChecklistMin: 3, actionChecklistMax: 5, keyMomentsMin: KEY_MOMENTS_MIN },
```

to:

```js
requiredArrayCounts: { phaseSummariesMin: PHASE_SUMMARIES_MIN, evidenceIndexMin: 1, strengths: 3, weaknesses: 3, actionChecklistMin: 3, actionChecklistMax: 5, keyMomentsMin: KEY_MOMENTS_MIN },
```

- [x] **Step 2: Run GREEN**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
59 passed, 0 failed
```

## Task 3: Update Docs And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-evidence-index-output-count-contract.md`

- [x] **Step 1: Update README test count**

Change:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 58건
```

to:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 59건
```

- [x] **Step 2: Run syntax and diff checks**

Run:

```bash
node --check server.js
node --check test-artifacts/server/llm-payload-tests.mjs
git diff --check
```

Expected: all commands exit 0 with no output.

- [x] **Step 3: Run focused and full tests**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
npm test
```

Expected:

```text
59 passed, 0 failed
1417 passed, 0 failed across 40 test file(s)
```

- [x] **Step 4: Run local readonly smoke report**

Run with the local server already listening on `127.0.0.1:8123` or start it with `node server.js`:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/evidence-index-output-count-contract-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Then inspect:

```bash
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/evidence-index-output-count-contract-local/qa-summary.json
```

Expected: smoke summary shows 156 passed / 0 failed, QA verdict passed, and required check summary shows 13 passed / 0 failed / 0 missing.

- [x] **Step 5: Scan and remove temporary artifacts**

Run:

```bash
rg -n "RGAPI-[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]{8,}|Authorization:|api_key=|/Users/a1234|secret\\.json" test-artifacts/tmp/evidence-index-output-count-contract-local || true
rm -rf test-artifacts/tmp
```

Expected: the sensitive scan prints no matches, and `test-artifacts/tmp` is removed.

- [x] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/server/llm-payload-tests.mjs docs/superpowers/plans/2026-06-08-evidence-index-output-count-contract.md
git commit -m "test: require evidence index output count"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [x] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/evidence-index-output-count-contract-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan aligns `outputContract.requiredArrayCounts` with the `hasValidEvidenceIndex()` validator contract that requires at least one evidence entry.
- Placeholder scan: Check the plan for empty placeholders, vague implementation language, and angle-bracket template markers; expected no matches.
- Type consistency: The property name is `evidenceIndexMin` in both the test assertion and `server.js` implementation.
