# Insight Builder Tower Gate Constant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rule-based strength builder use `INSIGHT_LIST_MIN` for the tower fallback gate.

**Architecture:** `buildStrengths()` pads output with `INSIGHT_LIST_MIN` and caps output with `INSIGHT_LIST_MAX`, but the intermediate tower fallback gate still uses `strengths.length < 3`. Add a source-shape test that fails while the literal remains, then change the gate to `strengths.length < INSIGHT_LIST_MIN`.

**Tech Stack:** Node.js zero-dependency extracted-function tests, `server.js`, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Source-Shape Coverage

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Add RED check for shared tower fallback gate**

After the existing `buildStrengths C length 3` check, add:

```js
checkTrue(
  "buildStrengths tower fallback gate uses INSIGHT_LIST_MIN",
  buildStrengthsSrc.includes("strengths.length < INSIGHT_LIST_MIN &&"),
);
```

- [x] **Step 2: Run focused RED test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected before implementation:

```text
57 passed, 1 failed
```

The failure should be:

```text
FAIL  buildStrengths tower fallback gate uses INSIGHT_LIST_MIN
```

### Task 2: Wire Tower Fallback Gate To Shared Min Constant

**Files:**
- Modify: `server.js`

- [x] **Step 1: Replace tower fallback gate literal**

Change:

```js
strengths.length < 3 &&
```

To:

```js
strengths.length < INSIGHT_LIST_MIN &&
```

- [x] **Step 2: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected after implementation:

```text
58 passed, 0 failed
```

### Task 3: QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-insight-builder-tower-gate-constant.md`

- [x] **Step 1: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-insight-builder-tower-gate-constant.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 2: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1456 passed, 0 failed
```

- [x] **Step 3: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-builder-tower-gate-constant-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/insight-builder-tower-gate-constant-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 4: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/insight-builder-tower-gate-constant-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-09-insight-builder-tower-gate-constant.md`

- [x] **Step 1: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

- [x] **Step 2: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs docs/superpowers/plans/2026-06-09-insight-builder-tower-gate-constant.md
git commit -m "test: share strength tower gate min"
git push origin main
```

- [x] **Step 3: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/insight-builder-tower-gate-constant-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/insight-builder-tower-gate-constant-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

---

## Completion Evidence

- Initial RED check mistake: the broad source-shape check matched the existing padding loop, so it was tightened to require `strengths.length < INSIGHT_LIST_MIN &&`.
- RED focused test: `node test-artifacts/server/strength-weakness-tests.mjs` returned 57 passed, 1 failed.
- RED failure: `buildStrengths tower fallback gate uses INSIGHT_LIST_MIN`.
- GREEN focused test: `node test-artifacts/server/strength-weakness-tests.mjs` returned 58 passed, 0 failed.
- Static verification:
  - `node --check server.js`: passed
  - `node --check test-artifacts/server/strength-weakness-tests.mjs`: passed
  - `git diff --check`: passed
  - placeholder scan: no matches
- Full verification: `npm test` passed with 1456 passed, 0 failed across 40 test file(s).
- Local read-only smoke report: 156 passed, 0 failed, `durationMs: 238`, `qaVerdict: "passed"`, required checks total 13 / passed 13 / failed 0 / missing 0.
- Local smoke artifact sensitive-pattern scan: no matches.
- Implementation commit: `427ada4 test: share strength tower gate min`, pushed to `origin/main`.
- GitHub Actions QA: run `27148629078` completed successfully for `427ada49a34ffbda3e32a74de841865210d8b712`.
- GitHub artifact: `7484980915` (`qa-automation-27148629078`, 3554 bytes), read-only smoke 156 passed / 0 failed, `durationMs: 213`, `latestRun.git.shortSha: "427ada4"`, `dirty: false`.
- GitHub artifact sensitive-pattern scan: no matches.
- Obsidian project log updated at `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`.

## Self-Review

- Spec coverage: This plan aligns the strength builder's tower fallback gate with the shared insight-list minimum used by padding, payload metadata, and schema validation.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `INSIGHT_LIST_MIN`, `buildStrengths`, and `strengths.length < INSIGHT_LIST_MIN` are named consistently across tests and implementation.
