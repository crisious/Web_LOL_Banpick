# Phase Summaries Output Count Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `phaseSummariesMin` to the LLM payload `outputContract.requiredArrayCounts` so the payload contract exposes the same phase summary minimum enforced by `validateAnalysisOutput()`.

**Architecture:** Keep runtime validation and repair behavior unchanged. Add one focused payload contract assertion, then add `phaseSummariesMin: PHASE_SUMMARIES_MIN` to `buildLlmPayload()` and update the test extraction closure so the shared constant is available.

**Tech Stack:** Node.js, ES modules, local text extraction tests, single-server `server.js` runtime.

---

## File Map

- Modify: `test-artifacts/server/llm-payload-tests.mjs`
  - Extract `PHASE_SUMMARIES_MIN` into the evaluated test closure.
  - Add a focused assertion for `requiredArrayCounts.phaseSummariesMin`.
- Modify: `server.js`
  - Add `phaseSummariesMin: PHASE_SUMMARIES_MIN` to `outputContract.requiredArrayCounts` inside `buildLlmPayload()`.
- Modify: `README.md`
  - Update the `npm run test:llm-payload` count from 57 to 58.
- Create: `docs/superpowers/plans/2026-06-08-phase-summaries-output-count-contract.md`
  - Track RED, GREEN, QA, commit, push, and GitHub artifact verification.

## Task 1: Add RED Output Count Test

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`

- [x] **Step 1: Extract the phase summary minimum constant**

Change the `tfConstants` array from:

```js
const tfConstants = [
  extractConstSource(serverSrc, "TEAMFIGHT_MIN_EVENTS"),
  extractConstSource(serverSrc, "CLEANUP_GAP_MS"),
  extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
].join("\n") + "\n";
```

to:

```js
const tfConstants = [
  extractConstSource(serverSrc, "TEAMFIGHT_MIN_EVENTS"),
  extractConstSource(serverSrc, "CLEANUP_GAP_MS"),
  extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
  extractConstSource(serverSrc, "PHASE_SUMMARIES_MIN"),
].join("\n") + "\n";
```

- [x] **Step 2: Add explicit count check**

Add this line before the existing `requiredArrayCounts.strengths` check:

```js
check("requiredArrayCounts.phaseSummariesMin", out.outputContract.requiredArrayCounts.phaseSummariesMin, 3);
```

- [x] **Step 3: Run RED**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
FAIL  requiredArrayCounts.phaseSummariesMin

57 passed, 1 failed
```

## Task 2: Add Missing Array Count

**Files:**
- Modify: `server.js`

- [x] **Step 1: Update `buildLlmPayload()` output contract**

Change:

```js
requiredArrayCounts: { strengths: 3, weaknesses: 3, actionChecklistMin: 3, actionChecklistMax: 5, keyMomentsMin: KEY_MOMENTS_MIN },
```

to:

```js
requiredArrayCounts: { phaseSummariesMin: PHASE_SUMMARIES_MIN, strengths: 3, weaknesses: 3, actionChecklistMin: 3, actionChecklistMax: 5, keyMomentsMin: KEY_MOMENTS_MIN },
```

- [x] **Step 2: Run GREEN**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
58 passed, 0 failed
```

## Task 3: Update Docs And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-phase-summaries-output-count-contract.md`

- [x] **Step 1: Update README test count**

Change:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 57건
```

to:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 58건
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
58 passed, 0 failed
1416 passed, 0 failed across 40 test file(s)
```

- [x] **Step 4: Run local readonly smoke report**

Run with the local server already listening on `127.0.0.1:8123` or start it with `node server.js`:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-output-count-contract-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Then inspect:

```bash
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/phase-summaries-output-count-contract-local/qa-summary.json
```

Expected: smoke summary shows 156 passed / 0 failed, QA verdict passed, and required check summary shows 13 passed / 0 failed / 0 missing.

- [x] **Step 5: Scan and remove temporary artifacts**

Run:

```bash
rg -n "RGAPI-[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]{8,}|Authorization:|api_key=|/Users/a1234|secret\\.json" test-artifacts/tmp/phase-summaries-output-count-contract-local || true
rm -rf test-artifacts/tmp
```

Expected: the sensitive scan prints no matches, and `test-artifacts/tmp` is removed.

- [x] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/server/llm-payload-tests.mjs docs/superpowers/plans/2026-06-08-phase-summaries-output-count-contract.md
git commit -m "test: require phase summaries output count"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [x] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/phase-summaries-output-count-contract-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan aligns `outputContract.requiredArrayCounts` with the `PHASE_SUMMARIES_MIN` validator contract.
- Placeholder scan: The plan uses concrete file paths, exact code snippets, commands, expected outputs, commit message, and artifact handling.
- Type consistency: The property name `phaseSummariesMin` maps directly to the `phaseSummaries` top-level array and `PHASE_SUMMARIES_MIN` server constant.
