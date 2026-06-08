# Teamfight Output Contract Required Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include `teamfightPhaseAnalysis` in the LLM payload `outputContract.requiredTopLevelFields` so the payload contract matches the prompt example and prompt instructions.

**Architecture:** Keep analysis validation and repair behavior unchanged. Add a focused contract regression in `test-artifacts/server/llm-payload-tests.mjs`, then add the missing field to `server.js` inside `buildLlmPayload()`.

**Tech Stack:** Node.js, ES modules, local text extraction tests, single-server `server.js` runtime.

---

## File Map

- Modify: `test-artifacts/server/llm-payload-tests.mjs`
  - Update the `requiredTopLevelFields list` assertion to include `teamfightPhaseAnalysis`.
  - Add an explicit `outputContract requires teamfightPhaseAnalysis` check so future omissions fail with a clear label.
- Modify: `server.js`
  - Add `teamfightPhaseAnalysis` to `outputContract.requiredTopLevelFields` in `buildLlmPayload()`.
- Modify: `README.md`
  - Update the `npm run test:llm-payload` count from 55 to 56.
- Create: `docs/superpowers/plans/2026-06-08-teamfight-output-contract-required-field.md`
  - Track RED, GREEN, QA, commit, push, and GitHub artifact verification.

## Task 1: Add RED Output Contract Test

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`

- [x] **Step 1: Update required top-level field expectation**

Change the `requiredTopLevelFields list` expected array from:

```js
["analysisMeta", "matchSummary", "coachSummary", "phaseSummaries", "strengths", "weaknesses", "actionChecklist", "keyMoments", "evidenceIndex", "combatAnalysis"]);
```

to:

```js
["analysisMeta", "matchSummary", "coachSummary", "phaseSummaries", "strengths", "weaknesses", "actionChecklist", "keyMoments", "evidenceIndex", "combatAnalysis", "teamfightPhaseAnalysis"]);
```

- [x] **Step 2: Add explicit field presence check**

Add this line immediately after the `requiredTopLevelFields list` check:

```js
checkTrue("outputContract requires teamfightPhaseAnalysis", out.outputContract.requiredTopLevelFields.includes("teamfightPhaseAnalysis"));
```

- [x] **Step 3: Run RED**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
FAIL  requiredTopLevelFields list
FAIL  outputContract requires teamfightPhaseAnalysis

54 passed, 2 failed
```

## Task 2: Add Missing Contract Field

**Files:**
- Modify: `server.js`

- [x] **Step 1: Update `buildLlmPayload()` output contract**

Change:

```js
requiredTopLevelFields: ["analysisMeta", "matchSummary", "coachSummary", "phaseSummaries", "strengths", "weaknesses", "actionChecklist", "keyMoments", "evidenceIndex", "combatAnalysis"],
```

to:

```js
requiredTopLevelFields: ["analysisMeta", "matchSummary", "coachSummary", "phaseSummaries", "strengths", "weaknesses", "actionChecklist", "keyMoments", "evidenceIndex", "combatAnalysis", "teamfightPhaseAnalysis"],
```

- [x] **Step 2: Run GREEN**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
56 passed, 0 failed
```

## Task 3: Update Docs And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-teamfight-output-contract-required-field.md`

- [x] **Step 1: Update README test count**

Change:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 55건
```

to:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 56건
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
56 passed, 0 failed
1414 passed, 0 failed across 40 test file(s)
```

- [x] **Step 4: Run local readonly smoke report**

Run with the local server already listening on `127.0.0.1:8123` or start it with `node server.js`:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-output-contract-required-field-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Then inspect:

```bash
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/teamfight-output-contract-required-field-local/qa-summary.json
```

Expected: smoke summary shows 156 passed / 0 failed, QA verdict passed, and required check summary shows 13 passed / 0 failed / 0 missing.

- [x] **Step 5: Scan and remove temporary artifacts**

Run:

```bash
rg -n "RGAPI-[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]{8,}|Authorization:|api_key=|/Users/a1234|secret\\.json" test-artifacts/tmp/teamfight-output-contract-required-field-local || true
rm -rf test-artifacts/tmp
```

Expected: the sensitive scan prints no matches, and `test-artifacts/tmp` is removed.

- [x] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/server/llm-payload-tests.mjs docs/superpowers/plans/2026-06-08-teamfight-output-contract-required-field.md
git commit -m "test: require teamfight output contract field"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [x] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/teamfight-output-contract-required-field-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan aligns the payload `outputContract` with the JSON example and Claude/Codex prompt instructions for `teamfightPhaseAnalysis`.
- Placeholder scan: The plan uses concrete file paths, exact code snippets, commands, expected outputs, commit message, and artifact handling.
- Type consistency: The field name `teamfightPhaseAnalysis` is identical across the test, payload contract, JSON example, prompt instructions, and final analysis merge path.
