# Teamfight Prompt Instruction Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Claude and Codex teamfightPhaseAnalysis prompt instructions explicitly name every phase row field required by the validator and rendered by the UI.

**Architecture:** Keep the runtime analysis flow unchanged. Add a prompt-contract regression test that extracts the concrete prompt constants from `server.js`, isolates the final `teamfightPhaseAnalysis:` instruction block, and verifies that the field names are explicitly present there instead of relying only on the JSON example.

**Tech Stack:** Node.js, ES modules, local text extraction tests, `server.js` prompt constants.

---

## File Map

- Modify: `test-artifacts/server/llm-payload-tests.mjs`
  - Extract `CLAUDE_COACHING_PROMPT` and `CODEX_REDTEAM_PROMPT` from `server.js`.
  - Add a helper that isolates the final narrative instruction block from each prompt.
  - Add RED checks that require backticked field mentions for `teamfightId`, `phase`, `outcomeTag`, `playerKills`, `playerDeaths`, `coaching`, `relatedEventIds`, and `takeaway`.
- Modify: `server.js`
  - Rewrite the Claude `teamfightPhaseAnalysis:` instruction to state that `phase`, `outcomeTag`, `playerKills`, `playerDeaths`, and `relatedEventIds` come from the input phase row, while `coaching` and `takeaway` are authored by the agent.
  - Rewrite the Codex `teamfightPhaseAnalysis:` instruction with the same field contract and red-team wording.
- Modify: `README.md`
  - Update the `npm run test:llm-payload` count from 39 to 55 after adding 16 prompt instruction checks.
- Create: `docs/superpowers/plans/2026-06-08-teamfight-prompt-instruction-contract.md`
  - Track the TDD and QA work for this change.

## Task 1: Add Prompt Instruction Contract Test

**Files:**
- Modify: `test-artifacts/server/llm-payload-tests.mjs`

- [x] **Step 1: Extract prompt constants**

Add this code after the existing `OUTPUT_SCHEMA_EXAMPLE` extraction:

```js
const claudePromptSrc = extractConstSource(serverSrc, "CLAUDE_COACHING_PROMPT");
const codexPromptSrc = extractConstSource(serverSrc, "CODEX_REDTEAM_PROMPT");
const { CLAUDE_COACHING_PROMPT, CODEX_REDTEAM_PROMPT } = new Function(
  `${outputSchemaExampleSrc}\n${claudePromptSrc}\n${codexPromptSrc}\nreturn { CLAUDE_COACHING_PROMPT, CODEX_REDTEAM_PROMPT };`,
)();
```

- [x] **Step 2: Add instruction snippet helper**

Add this helper after `checkTrue`:

```js
function finalTeamfightInstructionSnippet(prompt) {
  const start = prompt.lastIndexOf("teamfightPhaseAnalysis:");
  const end = prompt.indexOf("분석할 경기 데이터:", start);
  if (start < 0 || end < 0 || end <= start) return "";
  return prompt.slice(start, end);
}
```

- [x] **Step 3: Add RED checks**

Add this case before the result section:

```js
// ─── 케이스 16: teamfight 지시문 본문은 필수 phase row 필드를 명시해야 함 ──

{
  const requiredFields = [
    "teamfightId",
    "phase",
    "outcomeTag",
    "playerKills",
    "playerDeaths",
    "coaching",
    "relatedEventIds",
    "takeaway",
  ];
  for (const [label, prompt] of [
    ["Claude", CLAUDE_COACHING_PROMPT],
    ["Codex", CODEX_REDTEAM_PROMPT],
  ]) {
    const snippet = finalTeamfightInstructionSnippet(prompt);
    for (const field of requiredFields) {
      checkTrue(`${label} teamfight instruction names ${field}`, snippet.includes(`\`${field}\``));
    }
  }
}
```

- [x] **Step 4: Run RED**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
FAIL  Claude teamfight instruction names teamfightId
FAIL  Claude teamfight instruction names phase
FAIL  Claude teamfight instruction names outcomeTag
FAIL  Claude teamfight instruction names playerKills
FAIL  Claude teamfight instruction names playerDeaths
FAIL  Claude teamfight instruction names coaching
FAIL  Claude teamfight instruction names relatedEventIds
FAIL  Claude teamfight instruction names takeaway
FAIL  Codex teamfight instruction names teamfightId
FAIL  Codex teamfight instruction names phase
FAIL  Codex teamfight instruction names outcomeTag
FAIL  Codex teamfight instruction names playerKills
FAIL  Codex teamfight instruction names playerDeaths
FAIL  Codex teamfight instruction names coaching
FAIL  Codex teamfight instruction names relatedEventIds
FAIL  Codex teamfight instruction names takeaway

39 passed, 16 failed
```

## Task 2: Update Prompt Instructions

**Files:**
- Modify: `server.js`

- [x] **Step 1: Replace the Claude teamfight instruction**

Replace the single `teamfightPhaseAnalysis:` paragraph in `CLAUDE_COACHING_PROMPT` with:

```text
teamfightPhaseAnalysis: 입력 payload의 teamfightPhases 각 항목(`teamfightId`)마다 1개씩 작성. 각 `phases` row는 입력 phase row의 `phase`, `outcomeTag`, `playerKills`, `playerDeaths`, `relatedEventIds`를 그대로 반영하고, `coaching`은 그 국면 판단 코칭 한 줄로 작성. `takeaway`는 이 한타의 핵심 교훈 한 줄. 입력 teamfightPhases가 0개면 빈 배열.
```

- [x] **Step 2: Replace the Codex teamfight instruction**

Replace the single `teamfightPhaseAnalysis:` paragraph in `CODEX_REDTEAM_PROMPT` with:

```text
teamfightPhaseAnalysis: 입력 payload의 teamfightPhases 각 항목(`teamfightId`)마다 1개씩 작성. 각 `phases` row는 입력 phase row의 `phase`, `outcomeTag`, `playerKills`, `playerDeaths`, `relatedEventIds`를 그대로 반영하고, `coaching`은 레드팀 관점에서 국면별 판단 실수를 날카롭게 지적. `takeaway`는 이 한타의 핵심 교훈 한 줄. 입력 teamfightPhases가 0개면 빈 배열.
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node test-artifacts/server/llm-payload-tests.mjs
```

Expected:

```text
55 passed, 0 failed
```

## Task 3: Update Docs And Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-teamfight-prompt-instruction-contract.md`

- [x] **Step 1: Update README test count**

Change:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 39건
```

to:

```text
npm run test:llm-payload # buildLlmPayload importance/cap/sort/필드 추출 55건
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
55 passed, 0 failed
1413 passed, 0 failed across 40 test file(s)
```

- [x] **Step 4: Run local readonly smoke report**

Run with the local server already listening on `127.0.0.1:8123` or start it with `node server.js`:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-prompt-instruction-contract-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Then inspect:

```bash
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/teamfight-prompt-instruction-contract-local/*/../qa-summary.json
```

Expected: smoke summary shows 156 passed / 0 failed, QA verdict passed, and required check summary shows 13 passed / 0 failed / 0 missing.

- [x] **Step 5: Scan and remove temporary artifacts**

Run:

```bash
rg -n "RGAPI-[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]{8,}|Authorization:|api_key=|/Users/a1234|secret\\.json" test-artifacts/tmp/teamfight-prompt-instruction-contract-local || true
rm -rf test-artifacts/tmp
```

Expected: the sensitive scan prints no matches, and `test-artifacts/tmp` is removed.

- [x] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/server/llm-payload-tests.mjs docs/superpowers/plans/2026-06-08-teamfight-prompt-instruction-contract.md
git commit -m "test: enforce teamfight prompt instructions"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [x] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/teamfight-prompt-instruction-contract-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan covers the remaining prompt/validator mismatch by testing the actual Claude and Codex instruction blocks, updating the prompt text, refreshing README test counts, and validating locally and remotely.
- Placeholder scan: The plan uses concrete file paths, exact code snippets, commands, expected outputs, commit message, and artifact handling.
- Type consistency: The field names in the tests match `hasValidTeamfightPhaseAnalysis()` and the UI-rendered phase row contract: `teamfightId`, `phase`, `outcomeTag`, `playerKills`, `playerDeaths`, `coaching`, `relatedEventIds`, and `takeaway`.
