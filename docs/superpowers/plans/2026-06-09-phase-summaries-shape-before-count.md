# Phase Summaries Shape-Before-Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Malformed short `phaseSummaries` arrays are reported as `shape.phaseSummaries.invalid`, while valid short arrays continue to be reported as `count.phaseSummaries<3`.

**Architecture:** Keep the repair path in `server.js` and mirror the existing `keyMoments` shape-before-count pattern. Split phase summary item-shape validation into its own helper so count classification only applies after all supplied items have valid shape.

**Tech Stack:** Node.js ESM regression harnesses, local `server.js` source extraction tests, npm test suite, GitHub Actions smoke workflow.

---

### Task 1: Add RED Coverage For Malformed Short Phase Summaries

**Files:**
- Create: `test-artifacts/server/phase-summaries-shape-before-count-tests.mjs`

- [x] **Step 1: Write the failing test**

Create a server extraction regression harness that feeds `buildAnalysis()` a primary AI response with one malformed phase summary item:

```js
phaseSummaries: [
  { phase: "LANING", summary: "malformed short phase summary" },
]
```

The harness must assert:

```js
result.analysisMeta?.schemaViolations?.includes("shape.phaseSummaries.invalid")
!result.analysisMeta?.schemaViolations?.includes("count.phaseSummaries<3")
!result.analysisMeta?.schemaViolations?.includes("missing.phaseSummaries")
result.analysisMeta?.schemaViolationCount === 1
```

It must also assert the source contains a dedicated `hasValidPhaseSummaryItemShapes()` helper, `hasValidPhaseSummaries()` delegates to that helper, and `buildAnalysis()` gates count classification with that helper.

- [x] **Step 2: Run the RED test**

Run:

```bash
node --check test-artifacts/server/phase-summaries-shape-before-count-tests.mjs
node test-artifacts/server/phase-summaries-shape-before-count-tests.mjs
```

Expected before implementation:

```text
FAIL malformed short phase summaries are tracked as shape invalid
FAIL malformed short phase summaries are not tracked as count
FAIL source defines reusable phase summary item shape helper
FAIL hasValidPhaseSummaries delegates item shape validation
FAIL buildAnalysis checks phase summary item shapes before count
```

RED evidence captured on 2026-06-09 KST:

```text
node --check test-artifacts/server/phase-summaries-shape-before-count-tests.mjs
PASS

node test-artifacts/server/phase-summaries-shape-before-count-tests.mjs
6 passed, 5 failed
Failures:
- schemaViolations include malformed phase summaries
- schemaViolations do not misclassify malformed short phase summaries as count
- server defines shared phase summary item shape helper
- hasValidPhaseSummaries reuses item shape helper
- buildAnalysis checks phase summary item shape before count
```

### Task 2: Split Phase Summary Shape Validation

**Files:**
- Modify: `server.js`
- Modify as needed: `test-artifacts/server/*.mjs`, `test-artifacts/schema/*.mjs`

- [x] **Step 1: Add the helper**

Change `server.js` to define:

```js
function hasValidPhaseSummaryItemShapes(phaseSummaries) {
  return Array.isArray(phaseSummaries) &&
    phaseSummaries.every((item) =>
      item &&
      isValidGamePhase(item.phase) &&
      isNonBlankString(item.summary)
    );
}

function hasValidPhaseSummaries(phaseSummaries) {
  return Array.isArray(phaseSummaries) &&
    phaseSummaries.length >= PHASE_SUMMARIES_MIN &&
    hasValidPhaseSummaryItemShapes(phaseSummaries);
}
```

- [x] **Step 2: Gate count classification**

Inside the `if (!hasValidPhaseSummaries(primary.phaseSummaries))` block, compute:

```js
const phaseSummariesHaveValidItemShapes = hasValidPhaseSummaryItemShapes(primary.phaseSummaries);
```

Then classify count only when the supplied array is short and its item shapes are valid:

```js
Array.isArray(primary.phaseSummaries) &&
primary.phaseSummaries.length < PHASE_SUMMARIES_MIN &&
phaseSummariesHaveValidItemShapes
```

Malformed short arrays must fall through to `"shape.phaseSummaries.invalid"`.

- [x] **Step 3: Update source-extraction harnesses**

Any harness that extracts `hasValidPhaseSummaries()` must also extract `hasValidPhaseSummaryItemShapes()` before it when the helper is present. Schema policy source assertions should check the helper for `isNonBlankString(item.summary)` and `isValidGamePhase(item.phase)`, and check that `hasValidPhaseSummaries()` delegates to the helper.

Implementation evidence:

```text
server.js
- Added hasValidPhaseSummaryItemShapes(phaseSummaries).
- hasValidPhaseSummaries() now checks min count and delegates item shape validation.
- buildAnalysis() now computes phaseSummariesHaveValidItemShapes before count classification.
- count.phaseSummaries<3 is emitted only for short arrays with valid item shape.

test-artifacts/server/*.mjs and test-artifacts/schema/*.mjs
- Source-extraction harnesses that load hasValidPhaseSummaries() now load hasValidPhaseSummaryItemShapes().
- Phase summary nonblank and phase enum policy tests assert the helper owns item-shape validation.
```

### Task 3: Local QA

**Files:**
- Verify: `server.js`
- Verify: `test-artifacts/server/phase-summaries-*.mjs`
- Verify: `test-artifacts/schema/*.mjs`

- [x] **Step 1: Focused tests**

Run:

```bash
node --check server.js
node --check test-artifacts/server/phase-summaries-shape-before-count-tests.mjs
node test-artifacts/server/phase-summaries-shape-before-count-tests.mjs
node test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
node test-artifacts/server/key-moments-shape-before-count-tests.mjs
node test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

- [x] **Step 2: Full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-shape-before-count-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/phase-summaries-shape-before-count-local
rm -rf test-artifacts/tmp/phase-summaries-shape-before-count-local
```

Expected sensitive scan: no matches.

Focused QA evidence:

```text
node --check server.js
PASS
node --check test-artifacts/server/phase-summaries-shape-before-count-tests.mjs
PASS
node test-artifacts/server/phase-summaries-shape-before-count-tests.mjs
11 passed, 0 failed
node test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
9 passed, 0 failed
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
8 passed, 0 failed
node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
9 passed, 0 failed
node test-artifacts/server/key-moments-shape-before-count-tests.mjs
11 passed, 0 failed
node test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
6 passed, 0 failed
node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
10 passed, 0 failed
node test-artifacts/schema/schema-tests.mjs
105 passed, 0 failed
```

Full local QA evidence:

```text
npm test
2193 passed, 0 failed across 98 test file(s)

git diff --check
PASS

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-shape-before-count-local npm run smoke:report:readonly
Smoke summary: 156 passed, 0 failed
qa-summary.json qaVerdict.status: passed
sampleEvidence: 19 detail checks passed, 0 failed
demoSafety: 10 static paths blocked, 3 readonly APIs blocked

Sensitive artifact scan:
No matches for RGAPI, api_key, RIOT_API_KEY, Authorization, Bearer, Riot hostnames, /lol/, live Riot, or sample generation.
```

### Task 4: Publish And Verify GitHub Sync

**Files:**
- Commit: `server.js`
- Commit: `test-artifacts/server/phase-summaries-shape-before-count-tests.mjs`
- Commit: updated extraction harnesses
- Commit: this plan document
- Update outside git: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Commit and push implementation**

Run:

```bash
git add server.js test-artifacts/server test-artifacts/schema docs/superpowers/plans/2026-06-09-phase-summaries-shape-before-count.md
git commit -m "test: track malformed short phase summaries"
git push origin main
```

- [ ] **Step 2: Verify GitHub Actions**

Use `gh run list`, `gh run watch`, `gh run view`, and artifact sensitive scans to confirm the pushed commit passes GitHub QA.

- [ ] **Step 3: Final docs commit**

After QA evidence is recorded in this plan and Obsidian, commit plan completion updates:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summaries-shape-before-count.md
git commit -m "docs: finalize phase summaries shape tracking"
git push origin main
```

- [ ] **Step 4: Final sync check**

Run:

```bash
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
git status --short --branch
```

Expected: `0 0` and clean `main`.
