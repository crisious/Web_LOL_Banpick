# Stored Phase Summaries Display Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every stored sample analysis uses the `phaseSummaries[].summary` field that the report UI renders.

**Architecture:** Stored read-only demo samples are validated by `test-artifacts/samples/manifest-tests.mjs`. The new integrity check will fail any committed sample analysis whose `phaseSummaries` entries lack non-blank `phase` and `summary` strings, matching the minimum contract already enforced by `validateAnalysisOutput()`. The single legacy sample using `headline`/`detail` will be migrated to current display fields without changing manifest paths or public sample identity.

**Tech Stack:** Node.js, plain JavaScript, JSON stored sample bundles, local sample manifest test harness.

---

## File Map

- Modify: `test-artifacts/samples/manifest-tests.mjs`
  - Add an `invalidPhaseSummaries` accumulator.
  - Validate each stored analysis bundle's `phaseSummaries` entries for non-blank `phase` and `summary`.
  - Add a dedicated check label for the UI display contract.
- Modify: `data/samples/sample-kr-8190721866/analysis-result.json`
  - Replace legacy `headline`/`detail` phase summary fields with current `summary`/`focus` fields.
- Create: `docs/superpowers/plans/2026-06-08-stored-phase-summaries-display-contract.md`
  - Record this implementation plan and QA checklist.

## Task 1: Add RED Stored Sample Integrity Test

**Files:**
- Modify: `test-artifacts/samples/manifest-tests.mjs`

- [ ] **Step 1: Add an invalid phase summary accumulator**

Add this declaration after `const invalidBundles = [];`:

```js
const invalidPhaseSummaries = [];
```

- [ ] **Step 2: Validate stored analysis phase summaries**

Add this block inside the `try` block after the existing `if (!analysis.matchSummary || !analysis.coachSummary)` check:

```js
    if (
      !Array.isArray(analysis.phaseSummaries) ||
      analysis.phaseSummaries.some((item) =>
        !item ||
        typeof item.phase !== "string" ||
        item.phase.trim() === "" ||
        typeof item.summary !== "string" ||
        item.summary.trim() === ""
      )
    ) {
      invalidPhaseSummaries.push(`${sample.id}:analysis.phaseSummaries`);
    }
```

- [ ] **Step 3: Add the dedicated check**

Add this check after `check("normalized and analysis bundles have report essentials", ...)`:

```js
check("analysis phase summaries match UI display contract",
  invalidPhaseSummaries.length === 0,
  invalidPhaseSummaries.slice(0, 10).join(", "));
```

- [ ] **Step 4: Verify RED**

Run:

```bash
node test-artifacts/samples/manifest-tests.mjs
```

Expected output:

```text
10 passed, 1 failed
```

The failure should list `sample-kr-8190721866:analysis.phaseSummaries` because that stored sample still uses legacy `headline`/`detail` fields instead of the `summary` field rendered by `main.js`.

## Task 2: Migrate Legacy Stored Phase Summary Fields

**Files:**
- Modify: `data/samples/sample-kr-8190721866/analysis-result.json`

- [ ] **Step 1: Replace EARLY phase legacy fields**

Replace the EARLY phase object:

```json
{
  "phase": "EARLY",
  "label": "EARLY",
  "headline": "라인 템포는 흔들렸지만 관여는 유지",
  "detail": "7:50 선데스(evt_002)와 8:34 오브젝트 셋업 실패(evt_004)로 초반 주도권을 내줬지만 1킬 3어시로 합류 빈도는 유지했다. 라인 단계에서 갱 호응 동선과 와드 타이밍을 한 박자 빠르게 가져갈 여지가 있다."
}
```

With:

```json
{
  "phase": "EARLY",
  "label": "EARLY",
  "summary": "라인 템포는 흔들렸지만 관여는 유지",
  "focus": "7:50 선데스(evt_002)와 8:34 오브젝트 셋업 실패(evt_004)로 초반 주도권을 내줬지만 1킬 3어시로 합류 빈도는 유지했다. 라인 단계에서 갱 호응 동선과 와드 타이밍을 한 박자 빠르게 가져갈 여지가 있다."
}
```

- [ ] **Step 2: Replace MID phase legacy fields**

Replace the MID phase object:

```json
{
  "phase": "MID",
  "label": "MID",
  "headline": "오브젝트 직후 생존이 가장 큰 과제",
  "detail": "18:32, 22:07, 24:14, 26:12, 28:53로 데스 5회가 중반에 몰렸고 26:00 오브젝트 셋업 실패와 26:47 바론 헌납이 이어졌다. 다만 14어시로 합류 자체는 적극적이었던 만큼 진입 후 빠지는 타이밍과 백라인 거리감 조절이 핵심 개선점이다."
}
```

With:

```json
{
  "phase": "MID",
  "label": "MID",
  "summary": "오브젝트 직후 생존이 가장 큰 과제",
  "focus": "18:32, 22:07, 24:14, 26:12, 28:53로 데스 5회가 중반에 몰렸고 26:00 오브젝트 셋업 실패와 26:47 바론 헌납이 이어졌다. 다만 14어시로 합류 자체는 적극적이었던 만큼 진입 후 빠지는 타이밍과 백라인 거리감 조절이 핵심 개선점이다."
}
```

- [ ] **Step 3: Replace LATE phase legacy fields**

Replace the LATE phase object:

```json
{
  "phase": "LATE",
  "label": "LATE",
  "headline": "드래곤 합류와 연속 타워 마무리",
  "detail": "31:10 드래곤 합류(evt_039)에 이어 31:25 데스(evt_040)로 한 차례 흔들렸지만, 34:29~34:41 연속 타워 압박(evt_049~evt_051)으로 승리 조건을 구조물로 깔끔하게 전환했다. 후반 진입 각도와 갈고리 셋업이 결정적이었다."
}
```

With:

```json
{
  "phase": "LATE",
  "label": "LATE",
  "summary": "드래곤 합류와 연속 타워 마무리",
  "focus": "31:10 드래곤 합류(evt_039)에 이어 31:25 데스(evt_040)로 한 차례 흔들렸지만, 34:29~34:41 연속 타워 압박(evt_049~evt_051)으로 승리 조건을 구조물로 깔끔하게 전환했다. 후반 진입 각도와 갈고리 셋업이 결정적이었다."
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/samples/manifest-tests.mjs
```

Expected output:

```text
11 passed, 0 failed
```

## Task 3: QA, Commit, Push, And GitHub Verification

**Files:**
- Modify: `test-artifacts/samples/manifest-tests.mjs`
- Modify: `data/samples/sample-kr-8190721866/analysis-result.json`
- Create: `docs/superpowers/plans/2026-06-08-stored-phase-summaries-display-contract.md`

- [ ] **Step 1: Run syntax and focused checks**

Run:

```bash
node --check test-artifacts/samples/manifest-tests.mjs
git diff --check
node test-artifacts/samples/manifest-tests.mjs
```

Expected:

```text
11 passed, 0 failed
```

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected:

```text
1384 passed, 0 failed across 40 test file(s)
```

- [ ] **Step 3: Run local read-only smoke report**

Start the app:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
```

Then run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/stored-phase-summaries-display-contract-local npm run smoke:report:readonly
```

Expected:

```text
External demo smoke passed for http://127.0.0.1:8123
```

Inspect `test-artifacts/tmp/stored-phase-summaries-display-contract-local/qa-summary.json` and confirm latestRun reports:

```json
{
  "status": "passed",
  "smokeSummary": { "passed": 156, "failed": 0 },
  "qaVerdict": { "status": "passed", "shareable": true },
  "artifactIntegrity": { "status": "passed" },
  "sampleEvidence": { "status": "passed" },
  "demoSafetyEvidence": { "status": "passed" }
}
```

- [ ] **Step 4: Scan temporary smoke output for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/stored-phase-summaries-display-contract-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

- [ ] **Step 5: Commit and push**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git add test-artifacts/samples/manifest-tests.mjs data/samples/sample-kr-8190721866/analysis-result.json docs/superpowers/plans/2026-06-08-stored-phase-summaries-display-contract.md
git commit -m "test: enforce stored phase summary display contract"
git push origin main
```

Expected: the ahead/behind count is `0 0` before commit, and push updates `origin/main`.

- [ ] **Step 6: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --workflow QA --branch main --limit 1 --json databaseId,headSha --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/stored-phase-summaries-display-contract-gh
```

Expected: the new run for the pushed commit completes with `conclusion: "success"`, the artifact downloads, `qa-summary.json` reports 156 passed / 0 failed, and the sensitive pattern scan reports no matches.

## Self-Review

- Spec coverage: The plan covers the concrete stored-sample UI contract gap, the failing integrity test, the legacy sample migration, local unit/full/smoke QA, GitHub QA artifact verification, and sensitive-output scanning.
- Placeholder scan: The plan contains concrete file paths, code snippets, commands, expected outputs, run id discovery, and artifact handling.
- Type consistency: The test uses `phaseSummaries[].phase` and `phaseSummaries[].summary`, matching `main.js` and `validateAnalysisOutput()` minimum phase summary shape.
