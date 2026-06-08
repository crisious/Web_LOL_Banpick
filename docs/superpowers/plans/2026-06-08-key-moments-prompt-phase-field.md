# Key Moments Prompt Phase Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `OUTPUT_SCHEMA_EXAMPLE` key moment sample include the required `phase` field so the prompt example matches the final analysis validator and UI display contract.

**Architecture:** Keep runtime validation, repair behavior, and payload construction unchanged. Add one prompt-shape assertion to the zero-dependency LLM payload harness, then update only the `keyMoments` sample object embedded into both Claude and Codex prompts.

**Tech Stack:** Node.js, ES modules, local text extraction tests, single-server `server.js` runtime.

---

## File Map

- Modify: `test-artifacts/server/llm-payload-tests.mjs`
  - Add a focused assertion that the `keyMoments` snippet in `OUTPUT_SCHEMA_EXAMPLE` includes `"phase"`.
- Modify: `server.js`
  - Add `"phase": "EARLY"` to the `keyMoments` sample object in `OUTPUT_SCHEMA_EXAMPLE`.
- Modify: `README.md`
  - Update the `npm run test:llm-payload` count from 65 to 66.
- Create: `docs/superpowers/plans/2026-06-08-key-moments-prompt-phase-field.md`
  - Track RED, GREEN, QA, commit, push, and GitHub artifact verification.

## Task 1: Add RED Prompt Shape Test

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`

- [x] **Step 1: Add key moments phase prompt check**

Add this block after the existing teamfight prompt snippet test and before the output schema preamble checks:

```js
// ─── 케이스 16: keyMoments prompt 예시는 validator/UI phase 필드를 보여줘야 함 ──

{
  const start = OUTPUT_SCHEMA_EXAMPLE.indexOf('"keyMoments"');
  const end = OUTPUT_SCHEMA_EXAMPLE.indexOf('"combatAnalysis"', start);
  const snippet = OUTPUT_SCHEMA_EXAMPLE.slice(start, end);
  checkTrue("keyMoments prompt includes phase", snippet.includes('"phase"'));
}
```

- [x] **Step 2: Run RED**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
FAIL  keyMoments prompt includes phase

65 passed, 1 failed
```

## Task 2: Update Prompt Schema Example

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add `phase` to the key moment example**

Change:

```js
"keyMoments": [{ "id": "km_1", "timestampLabel": "...", "title": "...", "description": "...", "relatedEventIds": ["evt_003"] }],
```

to:

```js
"keyMoments": [{ "id": "km_1", "timestampLabel": "...", "phase": "EARLY", "title": "...", "description": "...", "relatedEventIds": ["evt_003"] }],
```

- [x] **Step 2: Run GREEN**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
66 passed, 0 failed
```

## Task 3: Update Docs And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-key-moments-prompt-phase-field.md`

- [x] **Step 1: Update README test count**

Change:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 65건
```

to:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 66건
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
66 passed, 0 failed
1424 passed, 0 failed across 40 test file(s)
```

- [x] **Step 4: Run local readonly smoke report**

Run with the local server already listening on `127.0.0.1:8123` or start it with `node server.js`:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-prompt-phase-field-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Then inspect:

```bash
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/key-moments-prompt-phase-field-local/qa-summary.json
```

Expected: smoke summary shows 156 passed / 0 failed, QA verdict passed, and required check summary shows 13 passed / 0 failed / 0 missing.

- [x] **Step 5: Scan and remove temporary artifacts**

Run:

```bash
rg -n "RGAPI-[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]{8,}|Authorization:|api_key=|/Users/a1234|secret\\.json" test-artifacts/tmp/key-moments-prompt-phase-field-local || true
rm -rf test-artifacts/tmp
```

Expected: the sensitive scan prints no matches, and `test-artifacts/tmp` is removed.

- [ ] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/server/llm-payload-tests.mjs docs/superpowers/plans/2026-06-08-key-moments-prompt-phase-field.md
git commit -m "test: require key moment prompt phase"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [ ] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/key-moments-prompt-phase-field-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan aligns the prompt JSON example with `validateAnalysisOutput()` key moment item validation and the UI phase display contract.
- Placeholder scan: Check the plan for empty placeholders, vague implementation language, and angle-bracket template markers; expected no matches.
- Type consistency: The field name is exactly `phase`, matching schema tests, key moment fixtures, and the UI helper `keyMomentPhase`.
