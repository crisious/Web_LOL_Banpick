# Insight Builder Max Constant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rule-based insight builders share `INSIGHT_LIST_MAX` when capping generated strengths and weaknesses.

**Architecture:** `buildStrengths()` and `buildWeaknesses()` already produce insight arrays that are validated against `INSIGHT_LIST_MAX`, but both builders still end with literal `slice(0, 3)`. Add source-shape tests that fail while the literals remain, then wire both builders to `INSIGHT_LIST_MAX` and inject the constant into the extracted-function test harness.

**Tech Stack:** Node.js zero-dependency extracted-function tests, `server.js`, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Source-Shape Coverage

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Extract `INSIGHT_LIST_MAX` for the strength/weakness harness**

Inside the `new Function([...].join("\n"))` source list in `test-artifacts/server/strength-weakness-tests.mjs`, add `INSIGHT_LIST_MAX` before `buildStrengths()` and `buildWeaknesses()` are evaluated:

```js
    extractConstSource(serverSrc, "INSIGHT_LIST_MAX"),
```

- [x] **Step 2: Store builder source strings for source-shape assertions**

After the `env` destructuring block, add:

```js
const buildStrengthsSrc = extractFunctionSource(serverSrc, "buildStrengths");
const buildWeaknessesSrc = extractFunctionSource(serverSrc, "buildWeaknesses");
```

- [x] **Step 3: Add RED checks for shared max constant usage**

After the existing `buildStrengths C length 3` check, add:

```js
checkTrue(
  "buildStrengths uses INSIGHT_LIST_MAX cap",
  buildStrengthsSrc.includes("return strengths.slice(0, INSIGHT_LIST_MAX);"),
);
```

After the existing `buildWeaknesses C ids` check, add:

```js
checkTrue(
  "buildWeaknesses uses INSIGHT_LIST_MAX cap",
  buildWeaknessesSrc.includes("return weaknesses.slice(0, INSIGHT_LIST_MAX);"),
);
```

- [x] **Step 4: Run focused RED test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected before implementation:

```text
53 passed, 2 failed
```

The two failures should be:

```text
FAIL  buildStrengths uses INSIGHT_LIST_MAX cap
FAIL  buildWeaknesses uses INSIGHT_LIST_MAX cap
```

### Task 2: Wire Insight Builders To Shared Max Constant

**Files:**
- Modify: `server.js`

- [x] **Step 1: Replace `buildStrengths()` literal cap**

Change:

```js
return strengths.slice(0, 3);
```

To:

```js
return strengths.slice(0, INSIGHT_LIST_MAX);
```

- [x] **Step 2: Replace `buildWeaknesses()` literal cap**

Change:

```js
return weaknesses.slice(0, 3);
```

To:

```js
return weaknesses.slice(0, INSIGHT_LIST_MAX);
```

- [x] **Step 3: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected after implementation:

```text
55 passed, 0 failed
```

### Task 3: QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-insight-builder-max-constant.md`

- [x] **Step 1: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-insight-builder-max-constant.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 2: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1453 passed, 0 failed
```

- [x] **Step 3: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-builder-max-constant-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/insight-builder-max-constant-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 4: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/insight-builder-max-constant-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-09-insight-builder-max-constant.md`

- [x] **Step 1: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

- [x] **Step 2: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs docs/superpowers/plans/2026-06-09-insight-builder-max-constant.md
git commit -m "test: share insight builder max"
git push origin main
```

- [x] **Step 3: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/insight-builder-max-constant-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/insight-builder-max-constant-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

---

## Completion Evidence

- RED focused test: `node test-artifacts/server/strength-weakness-tests.mjs` returned 53 passed, 2 failed.
- RED failures:
  - `buildStrengths uses INSIGHT_LIST_MAX cap`
  - `buildWeaknesses uses INSIGHT_LIST_MAX cap`
- GREEN focused test: `node test-artifacts/server/strength-weakness-tests.mjs` returned 55 passed, 0 failed.
- Static verification:
  - `node --check server.js`: passed
  - `node --check test-artifacts/server/strength-weakness-tests.mjs`: passed
  - `git diff --check`: passed
  - placeholder scan: no matches
- Full verification: `npm test` passed with 1453 passed, 0 failed across 40 test file(s).
- Local read-only smoke report: 156 passed, 0 failed, `durationMs: 224`, `qaVerdict: "passed"`, required checks total 13 / passed 13 / failed 0 / missing 0.
- Local smoke artifact sensitive-pattern scan: no matches.
- Implementation commit: `f631803 test: share insight builder max`, pushed to `origin/main`.
- GitHub Actions QA: run `27147559608` completed successfully for `f631803de7b5dcde72324b32ce7e2d8301b728a7`.
- GitHub artifact: `7484508194` (`qa-automation-27147559608`, 3551 bytes), read-only smoke 156 passed / 0 failed, `durationMs: 213`, `latestRun.git.shortSha: "f631803"`, `dirty: false`.
- GitHub artifact sensitive-pattern scan: no matches.
- Obsidian project log updated at `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`.

## Self-Review

- Spec coverage: This plan aligns builder output caps with the shared insight-list maximum already used by payload metadata and schema validation.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `INSIGHT_LIST_MAX`, `buildStrengths`, `buildWeaknesses`, `strengths.slice(0, INSIGHT_LIST_MAX)`, and `weaknesses.slice(0, INSIGHT_LIST_MAX)` are named consistently across tests and implementation.
