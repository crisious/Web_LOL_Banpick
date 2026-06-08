# Action Checklist Prompt Count Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `OUTPUT_SCHEMA_EXAMPLE` explicitly state that `actionChecklist` must contain three to five array items, matching the payload output contract.

**Architecture:** Keep runtime validation, repair behavior, and the JSON example shape unchanged. Add one focused prompt-contract assertion to the zero-dependency LLM payload harness, then update the schema explanation text embedded into both Claude and Codex prompts.

**Tech Stack:** Node.js, ES modules, local text extraction tests, single-server `server.js` runtime.

---

## File Map

- Modify: `test-artifacts/server/llm-payload-tests.mjs`
  - Add a focused assertion that `OUTPUT_SCHEMA_EXAMPLE` says `actionChecklist` is a three-to-five item array.
- Modify: `server.js`
  - Update the `OUTPUT_SCHEMA_EXAMPLE` preamble with the action checklist count contract.
- Modify: `README.md`
  - Update the `npm run test:llm-payload` count from 63 to 64.
- Create: `docs/superpowers/plans/2026-06-08-action-checklist-prompt-count-contract.md`
  - Track RED, GREEN, QA, commit, push, and GitHub artifact verification.

## Task 1: Add RED Prompt Contract Test

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`

- [x] **Step 1: Add explicit action checklist prompt count check**

Add this check inside the existing output schema preamble test block, before the `phaseSummaries` check:

```js
checkTrue("output schema states actionChecklist count range", OUTPUT_SCHEMA_EXAMPLE.includes("actionChecklist는 3~5개의 배열"));
```

- [x] **Step 2: Run RED**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
FAIL  output schema states actionChecklist count range

63 passed, 1 failed
```

## Task 2: Update Prompt Schema Text

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add action checklist count range to the preamble**

Change:

```js
phaseSummaries는 3개 이상의 배열이다 (객체 아님). keyMoments는 4개 이상의 배열이다.
```

to:

```js
phaseSummaries는 3개 이상의 배열이다 (객체 아님). keyMoments는 4개 이상의 배열이다.
actionChecklist는 3~5개의 배열이다.
```

- [x] **Step 2: Run GREEN**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
64 passed, 0 failed
```

## Task 3: Update Docs And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-action-checklist-prompt-count-contract.md`

- [x] **Step 1: Update README test count**

Change:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 63건
```

to:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 64건
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
64 passed, 0 failed
1422 passed, 0 failed across 40 test file(s)
```

- [x] **Step 4: Run local readonly smoke report**

Run with the local server already listening on `127.0.0.1:8123` or start it with `node server.js`:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-prompt-count-contract-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Then inspect:

```bash
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/action-checklist-prompt-count-contract-local/qa-summary.json
```

Expected: smoke summary shows 156 passed / 0 failed, QA verdict passed, and required check summary shows 13 passed / 0 failed / 0 missing.

- [x] **Step 5: Scan and remove temporary artifacts**

Run:

```bash
rg -n "RGAPI-[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]{8,}|Authorization:|api_key=|/Users/a1234|secret\\.json" test-artifacts/tmp/action-checklist-prompt-count-contract-local || true
rm -rf test-artifacts/tmp
```

Expected: the sensitive scan prints no matches, and `test-artifacts/tmp` is removed.

- [ ] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/server/llm-payload-tests.mjs docs/superpowers/plans/2026-06-08-action-checklist-prompt-count-contract.md
git commit -m "test: require action checklist prompt count"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [ ] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/action-checklist-prompt-count-contract-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan aligns the prompt schema preamble with `outputContract.requiredArrayCounts.actionChecklistMin` and `actionChecklistMax`.
- Placeholder scan: Check the plan for empty placeholders, vague implementation language, and angle-bracket template markers; expected no matches.
- Type consistency: The phrase `actionChecklist는 3~5개의 배열` maps directly to the `actionChecklist` top-level array and the existing `3~5개` prompt instruction.
