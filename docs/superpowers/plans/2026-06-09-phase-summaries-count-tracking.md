# Phase Summaries Count Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Valid-shape but short `phaseSummaries` arrays are explicitly tracked as `count.phaseSummaries<3`, with phase summary minimum-count validation isolated in a reusable helper.

**Architecture:** Mirror the existing key moments minimum helper pattern. Keep deterministic repair through `buildPhaseSummaries()`, split phase summary minimum-count validation into `hasMinimumPhaseSummaries()`, and add a dedicated source-extracted regression harness for the valid-short count path.

**Tech Stack:** Node.js ESM regression harnesses, local `server.js` source extraction tests, npm test suite, GitHub Actions QA smoke workflow.

---

### Task 1: Add RED Coverage For Valid-Short Phase Summaries

**Files:**
- Create: `test-artifacts/server/phase-summaries-count-tracking-tests.mjs`

- [x] **Step 1: Write the failing test**

Create a source-extracted `buildAnalysis()` harness with a primary AI response containing two valid phase summaries:

```js
phaseSummaries: [
  { phase: "EARLY", summary: "valid early summary" },
  { phase: "MID", summary: "valid mid summary" },
]
```

The harness must assert:

```js
result.analysisMeta?.schemaViolations?.includes("count.phaseSummaries<3")
!result.analysisMeta?.schemaViolations?.includes("missing.phaseSummaries")
!result.analysisMeta?.schemaViolations?.includes("shape.phaseSummaries.invalid")
result.analysisMeta?.schemaViolationCount === 1
```

It must also assert:

```js
serverSrc.includes("function hasMinimumPhaseSummaries")
hasValidPhaseSummariesSrc.includes("hasMinimumPhaseSummaries(phaseSummaries)")
buildAnalysisSrc.includes("hasMinimumPhaseSummaries(primary.phaseSummaries)")
```

- [x] **Step 2: Run the RED test**

Run:

```bash
node --check test-artifacts/server/phase-summaries-count-tracking-tests.mjs
node test-artifacts/server/phase-summaries-count-tracking-tests.mjs
```

Expected before implementation:

```text
PASS behavior assertions for repaired short valid phase summaries
FAIL source defines reusable phase summary minimum helper
FAIL hasValidPhaseSummaries reuses minimum helper
FAIL buildAnalysis checks phase summary minimum helper for count
```

RED evidence captured on 2026-06-09 KST:

```text
node --check test-artifacts/server/phase-summaries-count-tracking-tests.mjs
PASS

node test-artifacts/server/phase-summaries-count-tracking-tests.mjs
8 passed, 3 failed
Failures:
- server defines shared phase summary minimum helper
- hasValidPhaseSummaries reuses minimum helper
- buildAnalysis checks phase summary minimum helper for count
```

### Task 2: Split Phase Summary Minimum Validation

**Files:**
- Modify: `server.js`
- Modify as needed: `test-artifacts/server/*.mjs`, `test-artifacts/schema/*.mjs`

- [x] **Step 1: Add the helper**

Add:

```js
function hasMinimumPhaseSummaries(phaseSummaries) {
  return Array.isArray(phaseSummaries) && phaseSummaries.length >= PHASE_SUMMARIES_MIN;
}
```

- [x] **Step 2: Reuse the helper in the validator**

Change `hasValidPhaseSummaries()` to:

```js
function hasValidPhaseSummaries(phaseSummaries) {
  return hasMinimumPhaseSummaries(phaseSummaries) &&
    hasValidPhaseSummaryItemShapes(phaseSummaries);
}
```

- [x] **Step 3: Reuse the helper in count classification**

Inside `buildAnalysis()`, count violation must be selected with:

```js
Array.isArray(primary.phaseSummaries) &&
!hasMinimumPhaseSummaries(primary.phaseSummaries) &&
phaseSummariesHaveValidItemShapes
```

Missing and empty inputs must still be classified by the existing `missing.phaseSummaries` branch before this count branch.

- [x] **Step 4: Update source-extraction harnesses**

Any harness that extracts `hasValidPhaseSummaries()` must extract `hasMinimumPhaseSummaries()` before it. Schema policy source assertions should keep checking that `hasValidPhaseSummaries()` delegates both minimum count and item shape.

Implementation evidence:

```text
server.js
- Added hasMinimumPhaseSummaries(phaseSummaries).
- hasValidPhaseSummaries() now delegates minimum-count validation to hasMinimumPhaseSummaries().
- buildAnalysis() now uses !hasMinimumPhaseSummaries(primary.phaseSummaries) for the count.phaseSummaries<3 branch.

test-artifacts/server/*.mjs and test-artifacts/schema/*.mjs
- Source-extraction harnesses that load hasValidPhaseSummaries() now load hasMinimumPhaseSummaries().
- Phase summary nonblank and phase enum policy tests assert minimum-helper delegation.
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
node --check test-artifacts/server/phase-summaries-count-tracking-tests.mjs
node test-artifacts/server/phase-summaries-count-tracking-tests.mjs
node test-artifacts/server/phase-summaries-shape-before-count-tests.mjs
node test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
node test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
node test-artifacts/schema/schema-tests.mjs
```

- [x] **Step 2: Full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-count-tracking-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/phase-summaries-count-tracking-local
rm -rf test-artifacts/tmp/phase-summaries-count-tracking-local
```

Expected sensitive scan: no matches.

Focused QA evidence:

```text
node --check server.js
PASS
node --check test-artifacts/server/phase-summaries-count-tracking-tests.mjs
PASS
node test-artifacts/server/phase-summaries-count-tracking-tests.mjs
11 passed, 0 failed
node test-artifacts/server/phase-summaries-shape-before-count-tests.mjs
11 passed, 0 failed
node test-artifacts/server/phase-summaries-shape-tracking-tests.mjs
9 passed, 0 failed
node test-artifacts/server/phase-summaries-missing-tracking-tests.mjs
8 passed, 0 failed
node test-artifacts/server/phase-summaries-object-shape-tracking-tests.mjs
9 passed, 0 failed
node test-artifacts/schema/phase-summaries-nonblank-policy-tests.mjs
7 passed, 0 failed
node test-artifacts/schema/schema-phase-enum-policy-tests.mjs
11 passed, 0 failed
node test-artifacts/schema/schema-tests.mjs
105 passed, 0 failed
```

Full local QA evidence:

```text
npm test
2206 passed, 0 failed across 99 test file(s)

git diff --check
PASS

SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/phase-summaries-count-tracking-local npm run smoke:report:readonly
Smoke summary: 156 passed, 0 failed
durationMs: 208
qaVerdict.status: passed
sampleEvidence.detailChecks: 19 passed, 0 failed
demoSafetyEvidence.status: passed
requiredCheckSummary: total 13 / passed 13 / failed 0 / missing 0

Sensitive artifact scan:
No matches for RGAPI, api_key, RIOT_API_KEY, Authorization, Bearer, Riot hostnames, /lol/, live Riot, or sample generation.
```

### Task 4: Publish And Verify GitHub Sync

**Files:**
- Commit: `server.js`
- Commit: `test-artifacts/server/phase-summaries-count-tracking-tests.mjs`
- Commit: updated extraction harnesses
- Commit: this plan document
- Update outside git: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add server.js test-artifacts/server test-artifacts/schema docs/superpowers/plans/2026-06-09-phase-summaries-count-tracking.md
git commit -m "test: track short phase summaries"
git push origin main
```

- [x] **Step 2: Verify GitHub Actions**

Use `gh run list`, `gh run watch`, `gh run view`, artifact download, and artifact sensitive scans to confirm the pushed commit passes GitHub QA.

Implementation publish evidence:

```text
git commit -m "test: track short phase summaries"
[main 23bb6de] test: track short phase summaries

git push origin main
df8a8bb..23bb6de main -> main

git rev-list --left-right --count main...origin/main
0 0
```

Implementation GitHub QA evidence:

```text
gh run watch 27183975618 --exit-status
PASS

Run:
- id: 27183975618
- workflow: QA
- job: test-and-smoke
- head SHA: 23bb6deeff42c57c87b6e74129281a23ce71c97d
- URL: https://github.com/crisious/Web_LOL_Banpick/actions/runs/27183975618

Artifact:
- id: 7498546810
- name: qa-automation-27183975618
- size: 3549 bytes

Artifact qa-summary:
- smokeSummary: 156 passed, 0 failed
- durationMs: 206
- qaVerdict.status: passed
- sampleEvidence.detailChecks: 19 passed, 0 failed
- demoSafetyEvidence.status: passed
- latestRun.git.shortSha: 23bb6de
- latestRun.git.dirty: false
- requiredCheckSummary: total 13 / passed 13 / failed 0 / missing 0

Artifact sensitive scan:
No matches for RGAPI, api_key, RIOT_API_KEY, Authorization, Bearer, Riot hostnames, /lol/, live Riot, or sample generation.
```

- [x] **Step 3: Final docs commit**

After QA evidence is recorded in this plan and Obsidian, commit plan completion updates:

```bash
git add docs/superpowers/plans/2026-06-09-phase-summaries-count-tracking.md
git commit -m "docs: finalize phase summaries count tracking"
git push origin main
```

Final docs evidence:

```text
git commit -m "docs: finalize phase summaries count tracking"
[main 594d2f4] docs: finalize phase summaries count tracking

git push origin main
23bb6de..594d2f4 main -> main

gh run watch 27184034631 --exit-status
PASS

Run:
- id: 27184034631
- workflow: QA
- job: test-and-smoke
- head SHA: 594d2f4f0a7c122b0538f8012804bbf1b26d507f
- URL: https://github.com/crisious/Web_LOL_Banpick/actions/runs/27184034631

Artifact:
- id: 7498568672
- name: qa-automation-27184034631
- size: 3549 bytes

Artifact qa-summary:
- smokeSummary: 156 passed, 0 failed
- durationMs: 208
- qaVerdict.status: passed
- sampleEvidence.detailChecks: 19 passed, 0 failed
- demoSafetyEvidence.status: passed
- latestRun.git.shortSha: 594d2f4
- latestRun.git.dirty: false
- requiredCheckSummary: total 13 / passed 13 / failed 0 / missing 0

Artifact sensitive scan:
No matches for RGAPI, api_key, RIOT_API_KEY, Authorization, Bearer, Riot hostnames, /lol/, live Riot, or sample generation.
```

- [x] **Step 4: Final sync check**

Run:

```bash
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
git status --short --branch
```

Expected: `0 0` and clean `main`.

Sync evidence after final docs commit:

```text
git rev-list --left-right --count main...origin/main
0 0

git status --short --branch
## main...origin/main
```
