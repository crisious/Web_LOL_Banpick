# Vision Strength Threshold Constant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rule-based strength builder use a named vision-score threshold policy instead of inline `JUNGLE ? 35 : 25` literals.

**Architecture:** `server.js` already stores CS weak-point thresholds in a top-level map and exposes `lowFarmThreshold(position)` for builder use. Add a similar `VISION_STRENGTH_THRESHOLDS` map and `visionStrengthThreshold(position)` helper, then route `buildStrengths()` through that helper while preserving the existing JUNGLE 35 and non-JUNGLE 25 behavior.

**Tech Stack:** Node.js zero-dependency extracted-function tests, `server.js`, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Source-Shape And Boundary Coverage

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Add source-shape checks for the vision threshold policy**

After the existing `buildStrengths A fight relatedEventIds (3 combat)` check, add:

```js
checkTrue(
  "server defines VISION_STRENGTH_THRESHOLDS",
  serverSrc.includes("const VISION_STRENGTH_THRESHOLDS = { JUNGLE: 35, DEFAULT: 25 };"),
);
checkTrue(
  "buildStrengths uses visionStrengthThreshold",
  buildStrengthsSrc.includes("visionStrengthThreshold(normalized.matchInfo.position)"),
);
```

- [x] **Step 2: Add default-position behavior boundary checks**

After the existing JUNGLE vision boundary checks, add:

```js
const strAdc25 = buildStrengths({ timelineEvents: [], matchInfo: { result: "LOSS", position: "ADC" }, playerStats: { visionScore: 25, killParticipation: 0 } });
checkTrue("buildStrengths ADC vision 25 -> vision strength present", strAdc25.some((s) => s.id === "str_03" && s.title === "시야 투자량이 높은 편이었음"));
const strAdc24 = buildStrengths({ timelineEvents: [], matchInfo: { result: "LOSS", position: "ADC" }, playerStats: { visionScore: 24, killParticipation: 0 } });
checkTrue("buildStrengths ADC vision 24 -> no vision strength", !strAdc24.some((s) => s.title === "시야 투자량이 높은 편이었음"));
```

- [x] **Step 3: Run focused RED test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected before implementation:

```text
64 passed, 2 failed
```

The two failures should be:

```text
FAIL  server defines VISION_STRENGTH_THRESHOLDS
FAIL  buildStrengths uses visionStrengthThreshold
```

### Task 2: Introduce Vision Threshold Helper

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Add the top-level threshold map**

After:

```js
const CS_LOW_FARM_THRESHOLDS = { TOP: 6, MID: 6, ADC: 6.5, JUNGLE: 4.5, SUPPORT: 0 };
```

Add:

```js
const VISION_STRENGTH_THRESHOLDS = { JUNGLE: 35, DEFAULT: 25 };
```

- [x] **Step 2: Add `visionStrengthThreshold(position)` beside `lowFarmThreshold(position)`**

After:

```js
function lowFarmThreshold(position) {
  return CS_LOW_FARM_THRESHOLDS[position] || 0;
}
```

Add:

```js
function visionStrengthThreshold(position) {
  return VISION_STRENGTH_THRESHOLDS[position] || VISION_STRENGTH_THRESHOLDS.DEFAULT;
}
```

- [x] **Step 3: Use the helper in `buildStrengths()`**

Change:

```js
if (normalized.playerStats.visionScore >= (normalized.matchInfo.position === "JUNGLE" ? 35 : 25)) {
```

To:

```js
if (normalized.playerStats.visionScore >= visionStrengthThreshold(normalized.matchInfo.position)) {
```

- [x] **Step 4: Inject the helper into the extracted-function harness**

Inside the `new Function([...].join("\n"))` source list in `test-artifacts/server/strength-weakness-tests.mjs`, add these entries before `extractFunctionSource(serverSrc, "buildStrengths")`:

```js
    extractConstSource(serverSrc, "VISION_STRENGTH_THRESHOLDS"),
    extractFunctionSource(serverSrc, "visionStrengthThreshold"),
```

- [x] **Step 5: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected after implementation:

```text
66 passed, 0 failed
```

### Task 3: QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-vision-strength-threshold-constant.md`

- [x] **Step 1: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-vision-strength-threshold-constant.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 2: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1464 passed, 0 failed
```

- [x] **Step 3: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/vision-strength-threshold-constant-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/vision-strength-threshold-constant-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 4: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/vision-strength-threshold-constant-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-09-vision-strength-threshold-constant.md`

- [ ] **Step 1: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs docs/superpowers/plans/2026-06-09-vision-strength-threshold-constant.md
git commit -m "test: share vision strength threshold"
git push origin main
```

- [ ] **Step 2: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/vision-strength-threshold-constant-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/vision-strength-threshold-constant-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

- [ ] **Step 3: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

---

## Self-Review

- Spec coverage: This plan moves the vision strength threshold policy out of an inline conditional while preserving the existing JUNGLE 35 and default 25 behavior.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `VISION_STRENGTH_THRESHOLDS`, `visionStrengthThreshold`, and `buildStrengths` are named consistently across tests and implementation.
