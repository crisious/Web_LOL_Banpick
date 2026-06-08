# Teamfight Phase Analysis Shape Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure provided `teamfightPhaseAnalysis` items contain the phase coaching shape that the UI renders.

**Architecture:** `teamfightPhaseAnalysis` remains optional for backward compatibility, so missing, null, and empty arrays still pass. When the field is present with items, the final validator will require non-blank teamfight/takeaway fields plus valid phase rows with outcome tags, numeric K/D counters, non-blank coaching, and evidence links. `buildAnalysis()` already rewrites this field through `mergeTeamfightCoaching()`, so this change mainly hardens final validation and stored-analysis safety.

**Tech Stack:** Node.js, plain JavaScript, local schema harness in `test-artifacts/schema/schema-tests.mjs`.

---

## File Map

- Modify: `server.js`
  - Add `hasValidTeamfightPhaseAnalysis()` near the other output schema validators.
  - Replace the shallow inline `teamfightPhaseAnalysis` validation block in `validateAnalysisOutput()`.
- Modify: `test-artifacts/schema/schema-tests.mjs`
  - Extract `hasValidTeamfightPhaseAnalysis()` for the isolated validator harness.
  - Add RED tests for malformed teamfight phase items.
- Modify: `README.md`
  - Update the documented schema focused test count from 69 to 81.
- Create: `docs/superpowers/plans/2026-06-08-teamfight-phase-analysis-shape-contract.md`
  - Record the implementation plan and QA checklist.

## Task 1: Add RED Schema Tests

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Extend helper extraction**

Add this extraction block after the `hasValidCombatAnalysis` extraction block:

```js
if (serverSrc.includes("function hasValidTeamfightPhaseAnalysis(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidTeamfightPhaseAnalysis"));
}
```

- [ ] **Step 2: Add test helper and baseline optional cases**

Insert this block before the result section:

```js
// ─── teamfightPhaseAnalysis 검증 (선택적 필드, shape contract) ───────────────

function teamfightPhaseItem(overrides = {}) {
  return {
    teamfightId: "enc_001",
    gamePhase: "MID",
    startLabel: "18:10",
    endLabel: "18:56",
    takeaway: "한타 전 시야와 포지션을 먼저 잡자.",
    phases: [
      {
        phase: "ENGAGE",
        outcomeTag: "INITIATED_KILL",
        playerKills: 1,
        playerDeaths: 0,
        coaching: "선제 진입은 좋았다.",
        relatedEventIds: ["evt_001"],
      },
    ],
    ...overrides,
  };
}

function withTeamfightPhaseAnalysis(items) {
  const f = validFixture();
  f.teamfightPhaseAnalysis = items;
  return f;
}

expectOk("teamfightPhaseAnalysis: undefined → tolerated", () => {
  const f = validFixture();
  delete f.teamfightPhaseAnalysis;
  validateAnalysisOutput(f);
});

expectOk("teamfightPhaseAnalysis: null → tolerated", () => {
  const f = validFixture();
  f.teamfightPhaseAnalysis = null;
  validateAnalysisOutput(f);
});

expectOk("teamfightPhaseAnalysis: empty array → tolerated", () => {
  validateAnalysisOutput(withTeamfightPhaseAnalysis([]));
});

expectOk("teamfightPhaseAnalysis: valid item passes", () => {
  validateAnalysisOutput(withTeamfightPhaseAnalysis([teamfightPhaseItem()]));
});
```

- [ ] **Step 3: Add failing teamfight shape tests**

Insert these tests after the valid teamfight item test:

```js
expectThrows("teamfightPhaseAnalysis: object instead of array throws",
  () => validateAnalysisOutput(withTeamfightPhaseAnalysis({ enc_001: teamfightPhaseItem() })),
  "teamfightPhaseAnalysis not array");

expectThrows("teamfightPhaseAnalysis: blank teamfightId throws",
  () => validateAnalysisOutput(withTeamfightPhaseAnalysis([teamfightPhaseItem({ teamfightId: "   " })])),
  "teamfightId");

expectThrows("teamfightPhaseAnalysis: missing takeaway throws",
  () => {
    const item = teamfightPhaseItem();
    delete item.takeaway;
    validateAnalysisOutput(withTeamfightPhaseAnalysis([item]));
  },
  "takeaway");

expectThrows("teamfightPhaseAnalysis: blank takeaway throws",
  () => validateAnalysisOutput(withTeamfightPhaseAnalysis([teamfightPhaseItem({ takeaway: "   " })])),
  "takeaway");

expectThrows("teamfightPhaseAnalysis: phases empty throws",
  () => validateAnalysisOutput(withTeamfightPhaseAnalysis([teamfightPhaseItem({ phases: [] })])),
  "phases");

expectThrows("teamfightPhaseAnalysis: phase row missing coaching throws",
  () => {
    const item = teamfightPhaseItem();
    delete item.phases[0].coaching;
    validateAnalysisOutput(withTeamfightPhaseAnalysis([item]));
  },
  "coaching");

expectThrows("teamfightPhaseAnalysis: phase row invalid kills throws",
  () => {
    const item = teamfightPhaseItem();
    item.phases[0].playerKills = "1";
    validateAnalysisOutput(withTeamfightPhaseAnalysis([item]));
  },
  "playerKills");

expectThrows("teamfightPhaseAnalysis: phase row invalid relatedEventIds throws",
  () => {
    const item = teamfightPhaseItem();
    item.phases[0].relatedEventIds = ["evt_001", ""];
    validateAnalysisOutput(withTeamfightPhaseAnalysis([item]));
  },
  "relatedEventIds");
```

- [ ] **Step 4: Verify RED**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
74 passed, 7 failed
```

The four optional/baseline cases pass. The object-instead-of-array case already fails in the current validator, and the remaining seven malformed item cases fail because the current validator only checks that `teamfightId` is a string and `phases` is an array.

## Task 2: Implement Teamfight Phase Shape Validator

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add `hasValidTeamfightPhaseAnalysis()`**

Add this helper after `hasValidCombatAnalysis()`:

```js
function hasValidTeamfightPhaseAnalysis(teamfightPhaseAnalysis) {
  return teamfightPhaseAnalysis === undefined ||
    teamfightPhaseAnalysis === null ||
    (
      Array.isArray(teamfightPhaseAnalysis) &&
      teamfightPhaseAnalysis.every((tf) =>
        tf &&
        isNonBlankString(tf.teamfightId) &&
        isNonBlankString(tf.takeaway) &&
        Array.isArray(tf.phases) &&
        tf.phases.length > 0 &&
        tf.phases.every((phase) =>
          phase &&
          isNonBlankString(phase.phase) &&
          isNonBlankString(phase.outcomeTag) &&
          Number.isInteger(phase.playerKills) &&
          phase.playerKills >= 0 &&
          Number.isInteger(phase.playerDeaths) &&
          phase.playerDeaths >= 0 &&
          isNonBlankString(phase.coaching) &&
          Array.isArray(phase.relatedEventIds) &&
          phase.relatedEventIds.every((id) => isNonBlankString(id))
        )
      )
    );
}
```

- [ ] **Step 2: Replace shallow teamfight validation**

Replace the current `teamfightPhaseAnalysis` block in `validateAnalysisOutput()`:

```js
  // 한타 단계별 분석은 선택적 — 있으면 배열 + 각 항목 형태만 검증.
  if (json.teamfightPhaseAnalysis !== undefined && json.teamfightPhaseAnalysis !== null) {
    if (!Array.isArray(json.teamfightPhaseAnalysis)) throw new Error("teamfightPhaseAnalysis not array");
    for (const tf of json.teamfightPhaseAnalysis) {
      if (!tf || typeof tf.teamfightId !== "string") throw new Error("teamfightPhaseAnalysis item missing teamfightId");
      if (!Array.isArray(tf.phases)) throw new Error("teamfightPhaseAnalysis item phases not array");
    }
  }
```

With:

```js
  // 한타 단계별 분석은 선택적 — 있으면 UI가 렌더링하는 phase/coaching shape까지 검증.
  if (json.teamfightPhaseAnalysis !== undefined && json.teamfightPhaseAnalysis !== null) {
    if (!Array.isArray(json.teamfightPhaseAnalysis)) throw new Error("teamfightPhaseAnalysis not array");
    for (const tf of json.teamfightPhaseAnalysis) {
      if (!tf || !isNonBlankString(tf.teamfightId)) throw new Error("teamfightPhaseAnalysis item missing teamfightId");
      if (!isNonBlankString(tf.takeaway)) throw new Error("teamfightPhaseAnalysis item missing takeaway");
      if (!Array.isArray(tf.phases) || tf.phases.length === 0) throw new Error("teamfightPhaseAnalysis item phases not array");
      for (const phase of tf.phases) {
        if (!phase || !isNonBlankString(phase.phase)) throw new Error("teamfightPhaseAnalysis phase missing phase");
        if (!isNonBlankString(phase.outcomeTag)) throw new Error("teamfightPhaseAnalysis phase missing outcomeTag");
        if (!Number.isInteger(phase.playerKills) || phase.playerKills < 0) throw new Error("teamfightPhaseAnalysis phase missing playerKills");
        if (!Number.isInteger(phase.playerDeaths) || phase.playerDeaths < 0) throw new Error("teamfightPhaseAnalysis phase missing playerDeaths");
        if (!isNonBlankString(phase.coaching)) throw new Error("teamfightPhaseAnalysis phase missing coaching");
        if (!Array.isArray(phase.relatedEventIds) || !phase.relatedEventIds.every((id) => isNonBlankString(id))) {
          throw new Error("teamfightPhaseAnalysis phase missing relatedEventIds");
        }
      }
    }
  }
```

- [ ] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
81 passed, 0 failed
```

## Task 3: Documentation And QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-teamfight-phase-analysis-shape-contract.md`

- [ ] **Step 1: Update README test count**

Replace:

```text
validateAnalysisOutput 위반 패턴 69건
```

With:

```text
validateAnalysisOutput 위반 패턴 81건
```

- [ ] **Step 2: Run syntax and diff checks**

Run:

```bash
node --check server.js
node --check test-artifacts/schema/schema-tests.mjs
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Run focused and full test suites**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
npm test
```

Expected:

```text
81 passed, 0 failed
1383 passed, 0 failed across 40 test file(s)
```

- [ ] **Step 4: Run local read-only smoke report**

Start the app:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/teamfight-phase-analysis-shape-contract-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Inspect `test-artifacts/tmp/teamfight-phase-analysis-shape-contract-local/qa-summary.json` and confirm:

```json
{
  "status": "passed",
  "smoke": { "passed": 156, "failed": 0 },
  "qaVerdict": "passed",
  "shareable": true,
  "sample": "passed",
  "demo": "passed",
  "artifact": "passed",
  "required": "passed"
}
```

- [ ] **Step 5: Scan temporary smoke output for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/teamfight-phase-analysis-shape-contract-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

- [ ] **Step 6: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add server.js README.md test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-08-teamfight-phase-analysis-shape-contract.md
git commit -m "test: enforce teamfight phase analysis shape contract"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [ ] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/teamfight-phase-analysis-shape-contract-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan covers optional compatibility, teamfight item shape, phase row shape, UI-rendered fields, focused tests, full tests, smoke report, GitHub QA, and documentation.
- Placeholder scan: The plan contains concrete file paths, code snippets, commands, and expected outputs.
- Type consistency: The helper name used by tests and implementation is `hasValidTeamfightPhaseAnalysis()`, and it reuses the existing `isNonBlankString()` helper.
