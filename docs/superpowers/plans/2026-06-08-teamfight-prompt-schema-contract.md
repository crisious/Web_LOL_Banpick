# Teamfight Prompt Schema Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI output schema example for `teamfightPhaseAnalysis` include the same phase row fields that the UI and final validator require.

**Architecture:** Keep runtime analysis, validator, and merge logic unchanged. Add prompt-contract tests in the existing `test-artifacts/server/llm-payload-tests.mjs` harness, then update only `OUTPUT_SCHEMA_EXAMPLE` so the model sees `outcomeTag`, `playerKills`, `playerDeaths`, `coaching`, and `relatedEventIds` in each teamfight phase row.

**Tech Stack:** Node.js, plain JavaScript, text-extraction test harnesses, local smoke runner.

---

## File Map

- Modify: `test-artifacts/server/llm-payload-tests.mjs`
  - Extract `OUTPUT_SCHEMA_EXAMPLE`.
  - Add RED checks for teamfight phase row fields in the prompt example.
- Modify: `server.js`
  - Expand the `teamfightPhaseAnalysis` JSON example inside `OUTPUT_SCHEMA_EXAMPLE`.
- Modify: `README.md`
  - Update the documented `npm run test:llm-payload` count from 35 to 39.
- Create: `docs/superpowers/plans/2026-06-08-teamfight-prompt-schema-contract.md`
  - Record the implementation plan and QA checklist.

## Task 1: Add RED Prompt Contract Tests

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`

- [x] **Step 1: Extract `OUTPUT_SCHEMA_EXAMPLE`**

After:

```js
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");
```

Add:

```js
const outputSchemaExampleSrc = extractConstSource(serverSrc, "OUTPUT_SCHEMA_EXAMPLE");
const OUTPUT_SCHEMA_EXAMPLE = new Function(
  `${outputSchemaExampleSrc}\nreturn OUTPUT_SCHEMA_EXAMPLE;`,
)();
```

- [x] **Step 2: Add scoped teamfight prompt checks**

Insert this block before the result section:

```js
// ─── 케이스 15: teamfight prompt 예시는 validator/UI phase row 필드를 모두 보여줘야 함 ──

{
  const start = OUTPUT_SCHEMA_EXAMPLE.indexOf('"teamfightPhaseAnalysis"');
  const end = OUTPUT_SCHEMA_EXAMPLE.indexOf('"evidenceIndex"', start);
  const snippet = OUTPUT_SCHEMA_EXAMPLE.slice(start, end);
  checkTrue("teamfight prompt includes outcomeTag", snippet.includes('"outcomeTag"'));
  checkTrue("teamfight prompt includes playerKills", snippet.includes('"playerKills"'));
  checkTrue("teamfight prompt includes playerDeaths", snippet.includes('"playerDeaths"'));
  checkTrue("teamfight prompt includes relatedEventIds", snippet.includes('"relatedEventIds"'));
}
```

- [x] **Step 3: Verify RED**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected output includes:

```text
FAIL  teamfight prompt includes outcomeTag
FAIL  teamfight prompt includes playerKills
FAIL  teamfight prompt includes playerDeaths
FAIL  teamfight prompt includes relatedEventIds
35 passed, 4 failed
```

This proves the prompt example omits fields required by `hasValidTeamfightPhaseAnalysis()` and rendered by `renderTeamfightPhases()`.

## Task 2: Update `OUTPUT_SCHEMA_EXAMPLE`

**Files:**
- Modify: `server.js`

- [x] **Step 1: Replace the teamfight example**

Replace the current single-line `teamfightPhaseAnalysis` example:

```js
  "teamfightPhaseAnalysis": [{ "teamfightId": "enc_001", "phases": [{ "phase": "ENGAGE", "coaching": "진입 국면 코칭 한 줄" }, { "phase": "TRADE", "coaching": "딜교환 코칭" }, { "phase": "CLEANUP", "coaching": "정리 국면 코칭" }], "takeaway": "이 한타 핵심 교훈" }],
```

With:

```js
  "teamfightPhaseAnalysis": [{
    "teamfightId": "enc_001",
    "phases": [
      { "phase": "ENGAGE", "outcomeTag": "INITIATED_KILL", "playerKills": 1, "playerDeaths": 0, "coaching": "진입 국면 코칭 한 줄", "relatedEventIds": ["evt_004"] },
      { "phase": "TRADE", "outcomeTag": "TRADE_EVEN", "playerKills": 0, "playerDeaths": 0, "coaching": "딜교환 코칭", "relatedEventIds": ["evt_005"] },
      { "phase": "CLEANUP", "outcomeTag": "CLOSED_OUT", "playerKills": 1, "playerDeaths": 0, "coaching": "정리 국면 코칭", "relatedEventIds": ["evt_006"] }
    ],
    "takeaway": "이 한타 핵심 교훈"
  }],
```

- [x] **Step 2: Verify GREEN**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected output:

```text
39 passed, 0 failed
```

## Task 3: Update Docs And Run QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-teamfight-prompt-schema-contract.md`

- [x] **Step 1: Update README llm-payload count**

Replace:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 35건
```

With:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 39건
```

- [x] **Step 2: Run syntax and focused checks**

Run:

```bash
node --check server.js
node --check test-artifacts/server/llm-payload-tests.mjs
git diff --check
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
39 passed, 0 failed
```

- [x] **Step 3: Run full tests**

Run:

```bash
npm test
```

Expected:

```text
1397 passed, 0 failed across 40 test file(s)
```

- [x] **Step 4: Run local read-only smoke report**

Use an existing read-only server if `/healthz` reports `publicDemoMode: "readonly"`, or start one:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-prompt-schema-contract-local npm run smoke:report:readonly
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
rg -n "RGAPI-[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]{8,}|Authorization:|api_key=|/Users/a1234|secret\\.json" test-artifacts/tmp/teamfight-prompt-schema-contract-local || true
```

Expected: no output.

- [x] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/server/llm-payload-tests.mjs docs/superpowers/plans/2026-06-08-teamfight-prompt-schema-contract.md
git commit -m "fix: align teamfight prompt schema"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [x] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/teamfight-prompt-schema-contract-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan covers the prompt/schema/UI mismatch, a RED prompt-contract test, the minimal prompt example update, README count update, local QA, GitHub QA, and sensitive artifact scanning.
- Placeholder scan: The plan uses concrete file paths, code snippets, commands, expected outputs, commit message, and artifact handling.
- Type consistency: The tested prompt fields are `outcomeTag`, `playerKills`, `playerDeaths`, `coaching`, and `relatedEventIds`, matching `hasValidTeamfightPhaseAnalysis()` and `renderTeamfightPhases()`.
