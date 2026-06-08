# Combat Analysis Shape Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure provided `combatAnalysis` items contain the player decision text and evidence links that the UI renders.

**Architecture:** `combatAnalysis` remains optional for backward compatibility, so missing, null, and empty arrays still pass. When the field is present with items, the final validator will require non-blank `encounterId`, `situationLabel`, `playerDecision`, `takeaway`, and a string-only `relatedEventIds` array. Malformed AI-provided combat analysis is repaired to an empty optional list before final validation.

**Tech Stack:** Node.js, plain JavaScript, local schema harness in `test-artifacts/schema/schema-tests.mjs`.

---

## File Map

- Modify: `server.js`
  - Add `hasValidCombatAnalysis()` near the other output schema validators.
  - Replace the inline combat validation loop in `validateAnalysisOutput()`.
  - Tighten `buildAnalysis()` combat repair so malformed optional combat analysis does not force a full rule-based fallback.
- Modify: `test-artifacts/schema/schema-tests.mjs`
  - Extract `hasValidCombatAnalysis()` for the isolated validator harness.
  - Add RED tests for malformed combat item fields.
- Modify: `README.md`
  - Update the documented schema focused test count from 63 to 69.
- Create: `docs/superpowers/plans/2026-06-08-combat-analysis-shape-contract.md`
  - Record the implementation plan and QA checklist.

## Task 1: Add RED Schema Tests

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Extend helper extraction**

Add this extraction block after the `hasValidInsightList` extraction block:

```js
if (serverSrc.includes("function hasValidCombatAnalysis(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidCombatAnalysis"));
}
```

- [ ] **Step 2: Update the valid combat item fixture**

Replace the existing valid combat item:

```js
{ encounterId: "enc_001", situationLabel: "초반 갱킹 손실", takeaway: "와드 우선" },
```

With:

```js
{
  encounterId: "enc_001",
  situationLabel: "초반 갱킹 손실",
  playerDecision: "시야 없이 라인 압박을 유지",
  takeaway: "와드 우선",
  relatedEventIds: ["evt_001"],
},
```

- [ ] **Step 3: Add failing combat shape tests**

Insert these tests after `combatAnalysis: missing takeaway throws`:

```js
expectThrows("combatAnalysis: blank encounterId throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "   ",
    situationLabel: "x",
    playerDecision: "판단",
    takeaway: "y",
    relatedEventIds: ["evt_001"],
  }])),
  "encounterId");

expectThrows("combatAnalysis: missing playerDecision throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    takeaway: "y",
    relatedEventIds: ["evt_001"],
  }])),
  "playerDecision");

expectThrows("combatAnalysis: blank playerDecision throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    playerDecision: "   ",
    takeaway: "y",
    relatedEventIds: ["evt_001"],
  }])),
  "playerDecision");

expectThrows("combatAnalysis: blank takeaway throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    playerDecision: "판단",
    takeaway: "   ",
    relatedEventIds: ["evt_001"],
  }])),
  "takeaway");

expectThrows("combatAnalysis: missing relatedEventIds throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    playerDecision: "판단",
    takeaway: "y",
  }])),
  "relatedEventIds");

expectThrows("combatAnalysis: invalid relatedEventIds throws",
  () => validateAnalysisOutput(withCombat([{
    encounterId: "enc_001",
    situationLabel: "x",
    playerDecision: "판단",
    takeaway: "y",
    relatedEventIds: ["evt_001", ""],
  }])),
  "relatedEventIds");
```

- [ ] **Step 4: Verify RED**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
63 passed, 6 failed
```

The six new tests fail because the current validator accepts truthy-but-invalid combat item fields and missing evidence links.

## Task 2: Implement Combat Analysis Shape Validator

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add `hasValidCombatAnalysis()`**

Add this helper after `hasValidInsightList()`:

```js
function hasValidCombatAnalysis(combatAnalysis) {
  return combatAnalysis === undefined ||
    combatAnalysis === null ||
    (
      Array.isArray(combatAnalysis) &&
      combatAnalysis.every((item) =>
        item &&
        isNonBlankString(item.encounterId) &&
        isNonBlankString(item.situationLabel) &&
        isNonBlankString(item.playerDecision) &&
        isNonBlankString(item.takeaway) &&
        Array.isArray(item.relatedEventIds) &&
        item.relatedEventIds.every((id) => isNonBlankString(id))
      )
    );
}
```

- [ ] **Step 2: Replace inline combat validation**

Replace the current `combatAnalysis` block in `validateAnalysisOutput()`:

```js
  // Phase 32: combatAnalysis는 선택적 — 없거나 빈 배열이면 통과 (기존 코호트 backward-compat).
  // 있으면 배열 타입과 각 항목 필수 필드만 검증.
  if (json.combatAnalysis !== undefined && json.combatAnalysis !== null) {
    if (!Array.isArray(json.combatAnalysis)) throw new Error("combatAnalysis not array");
    for (const item of json.combatAnalysis) {
      if (!item || typeof item.encounterId !== "string") throw new Error("combatAnalysis item missing encounterId");
      if (typeof item.situationLabel !== "string" || !item.situationLabel) throw new Error("combatAnalysis item missing situationLabel");
      if (typeof item.takeaway !== "string" || !item.takeaway) throw new Error("combatAnalysis item missing takeaway");
    }
  }
```

With:

```js
  // Phase 32: combatAnalysis는 선택적 — 없거나 빈 배열이면 통과 (기존 코호트 backward-compat).
  // 있으면 UI가 렌더링하는 판단/교훈/근거 링크 필드까지 검증.
  if (json.combatAnalysis !== undefined && json.combatAnalysis !== null) {
    if (!Array.isArray(json.combatAnalysis)) throw new Error("combatAnalysis not array");
    for (const item of json.combatAnalysis) {
      if (!item || !isNonBlankString(item.encounterId)) throw new Error("combatAnalysis item missing encounterId");
      if (!isNonBlankString(item.situationLabel)) throw new Error("combatAnalysis item missing situationLabel");
      if (!isNonBlankString(item.playerDecision)) throw new Error("combatAnalysis item missing playerDecision");
      if (!isNonBlankString(item.takeaway)) throw new Error("combatAnalysis item missing takeaway");
      if (!Array.isArray(item.relatedEventIds) || !item.relatedEventIds.every((id) => isNonBlankString(id))) {
        throw new Error("combatAnalysis item missing relatedEventIds");
      }
    }
  }
```

- [ ] **Step 3: Tighten AI repair before final validation**

Replace the current `combatAnalysis` normalization block in `buildAnalysis()`:

```js
  // Phase 32: combatAnalysis 정규화 — 누락 시 빈 배열, 비배열이면 빈 배열로 강제.
  // 형태 오류는 violation에 등재하되 fallback 트리거하지 않음 (선택적 필드).
  if (primary.combatAnalysis === undefined || primary.combatAnalysis === null) {
    primary.combatAnalysis = [];
  } else if (!Array.isArray(primary.combatAnalysis)) {
    primary.combatAnalysis = [];
    violations.push("type.combatAnalysis.notArray");
  }
```

With:

```js
  // Phase 32: combatAnalysis 정규화 — 선택 필드이므로 깨진 AI 응답은 빈 배열로 복구.
  if (primary.combatAnalysis === undefined || primary.combatAnalysis === null) {
    primary.combatAnalysis = [];
  } else if (!hasValidCombatAnalysis(primary.combatAnalysis)) {
    primary.combatAnalysis = [];
    violations.push("shape.combatAnalysis.invalid");
  }
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
69 passed, 0 failed
```

## Task 3: Documentation And QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-combat-analysis-shape-contract.md`

- [ ] **Step 1: Update README test count**

Replace:

```text
validateAnalysisOutput 위반 패턴 63건
```

With:

```text
validateAnalysisOutput 위반 패턴 69건
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
69 passed, 0 failed
1371 passed, 0 failed across 40 test file(s)
```

- [ ] **Step 4: Run local read-only smoke report**

Start the app:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/combat-analysis-shape-contract-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Inspect `test-artifacts/tmp/combat-analysis-shape-contract-local/qa-summary.json` and confirm:

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
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/combat-analysis-shape-contract-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
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
git add server.js README.md test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-08-combat-analysis-shape-contract.md
git commit -m "test: enforce combat analysis shape contract"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [ ] **Step 7: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/combat-analysis-shape-contract-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan covers `combatAnalysis` optional compatibility, item-level display text, evidence link shape, AI repair behavior, focused tests, full tests, smoke report, GitHub QA, and documentation.
- Placeholder scan: The plan contains concrete file paths, code snippets, commands, and expected outputs.
- Type consistency: The helper name used by tests and implementation is `hasValidCombatAnalysis()`, and it reuses the existing `isNonBlankString()` helper.
