# Evidence Index Prompt Min Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `OUTPUT_SCHEMA_EXAMPLE` explicitly state that `evidenceIndex` must be a non-empty array, matching the `validateAnalysisOutput()` evidence validator and payload `evidenceIndexMin` contract.

**Architecture:** Keep runtime validation, repair behavior, and JSON example shape unchanged. Add one prompt-contract assertion to the existing zero-dependency `llm-payload` harness, then update only the schema explanation text that is embedded into both Claude and Codex prompts.

**Tech Stack:** Node.js, ES modules, local text extraction tests, single-server `server.js` runtime.

---

## File Map

- Modify: `test-artifacts/server/llm-payload-tests.mjs`
  - Add a focused assertion that `OUTPUT_SCHEMA_EXAMPLE` says `evidenceIndex` is an array with at least one item.
- Modify: `server.js`
  - Add the evidence index minimum sentence to the `OUTPUT_SCHEMA_EXAMPLE` preamble.
- Modify: `README.md`
  - Update the `npm run test:llm-payload` count from 61 to 62.
- Create: `docs/superpowers/plans/2026-06-08-evidence-index-prompt-min-contract.md`
  - Track RED, GREEN, QA, commit, push, and GitHub artifact verification.

## Task 1: Add RED Prompt Contract Test

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`

- [x] **Step 1: Add explicit evidence index prompt check**

Add this block after the teamfight prompt example test and before the teamfight instruction body test:

```js
// ─── 케이스 16: output schema preamble은 evidenceIndex 최소 개수를 명시해야 함 ──

{
  checkTrue("output schema states evidenceIndex non-empty", OUTPUT_SCHEMA_EXAMPLE.includes("evidenceIndex는 1개 이상의 배열"));
}
```

Then renumber the existing teamfight instruction body comment from `케이스 16` to `케이스 17`.

- [x] **Step 2: Run RED**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
FAIL  output schema states evidenceIndex non-empty

61 passed, 1 failed
```

## Task 2: Update Prompt Schema Text

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add evidence index minimum sentence**

Change this preamble:

```js
phaseSummaries는 배열이다 (객체 아님). keyMoments는 4개 이상의 배열이다.
combatAnalysis는 배열이다. 입력 payload의 combatEncounters 각 항목당 1개씩 작성하되, 입력에 encounter가 없으면 빈 배열을 반환한다.
```

to:

```js
phaseSummaries는 배열이다 (객체 아님). keyMoments는 4개 이상의 배열이다.
evidenceIndex는 1개 이상의 배열이며 각 항목은 eventId와 shortNote 또는 summary를 포함한다.
combatAnalysis는 배열이다. 입력 payload의 combatEncounters 각 항목당 1개씩 작성하되, 입력에 encounter가 없으면 빈 배열을 반환한다.
```

- [x] **Step 2: Run GREEN**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
62 passed, 0 failed
```

## Task 3: Update Docs And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-evidence-index-prompt-min-contract.md`

- [x] **Step 1: Update README test count**

Change:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 61건
```

to:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 62건
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
62 passed, 0 failed
1420 passed, 0 failed across 40 test file(s)
```

- [x] **Step 4: Run local readonly smoke report**

Run with the local server already listening on `127.0.0.1:8123` or start it with `node server.js`:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/evidence-index-prompt-min-contract-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Then inspect:

```bash
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/evidence-index-prompt-min-contract-local/qa-summary.json
```

Expected: smoke summary shows 156 passed / 0 failed, QA verdict passed, and required check summary shows 13 passed / 0 failed / 0 missing.

- [x] **Step 5: Scan and remove temporary artifacts**

Run:

```bash
rg -n "RGAPI-[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]{8,}|Authorization:|api_key=|/Users/a1234|secret\\.json" test-artifacts/tmp/evidence-index-prompt-min-contract-local || true
rm -rf test-artifacts/tmp
```

Expected: the sensitive scan prints no matches, and `test-artifacts/tmp` is removed.

- [x] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/server/llm-payload-tests.mjs docs/superpowers/plans/2026-06-08-evidence-index-prompt-min-contract.md
git commit -m "test: require evidence index prompt minimum"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [x] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/evidence-index-prompt-min-contract-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan aligns the prompt schema preamble with both `hasValidEvidenceIndex()` and `outputContract.requiredArrayCounts.evidenceIndexMin`.
- Placeholder scan: Check the plan for empty placeholders, vague implementation language, and angle-bracket template markers; expected no matches.
- Type consistency: The new phrase uses `evidenceIndex`, `eventId`, `shortNote`, and `summary`, matching the schema example and validator fields.
