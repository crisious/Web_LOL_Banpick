# Strength Fight Title Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `buildStrengths()` compute the fight summary title once and reuse it for the fight insight branch.

**Architecture:** `buildStrengths()` already stores `objectiveTitle` once, but calls `bestFightSummary(normalized)` separately for the branch guard and the `title` field. Add source-shape tests that fail while the duplicate call remains, then introduce `const fightTitle = bestFightSummary(normalized);` and reuse it in the guard and emitted insight.

**Tech Stack:** Node.js zero-dependency extracted-function tests, `server.js`, local read-only smoke reports, GitHub Actions QA artifact verification.

---

### Task 1: Add RED Source-Shape Coverage

**Files:**
- Modify: `test-artifacts/server/strength-weakness-tests.mjs`

- [x] **Step 1: Add source-shape checks for cached fight title**

After the existing `buildStrengths A titles` check, add:

```js
checkTrue(
  "buildStrengths caches fightTitle",
  buildStrengthsSrc.includes("const fightTitle = bestFightSummary(normalized);"),
);
checkTrue(
  "buildStrengths uses cached fightTitle as title",
  buildStrengthsSrc.includes("title: fightTitle,"),
);
```

- [x] **Step 2: Run focused RED test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected before implementation:

```text
58 passed, 2 failed
```

The two failures should be:

```text
FAIL  buildStrengths caches fightTitle
FAIL  buildStrengths uses cached fightTitle as title
```

### Task 2: Reuse Cached Fight Title

**Files:**
- Modify: `server.js`

- [x] **Step 1: Define `fightTitle` beside `objectiveTitle`**

Inside `buildStrengths()`, after:

```js
const objectiveTitle = bestObjectiveSummary(normalized);
```

Add:

```js
const fightTitle = bestFightSummary(normalized);
```

- [x] **Step 2: Use `fightTitle` for the fight insight branch**

Change:

```js
if (bestFightSummary(normalized)) {
```

To:

```js
if (fightTitle) {
```

Change:

```js
title: bestFightSummary(normalized),
```

To:

```js
title: fightTitle,
```

- [x] **Step 3: Run focused GREEN test**

Run:

```bash
node test-artifacts/server/strength-weakness-tests.mjs
```

Expected after implementation:

```text
60 passed, 0 failed
```

### Task 3: QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-strength-fight-title-cache.md`

- [x] **Step 1: Static verification**

Run:

```bash
node --check server.js
node --check test-artifacts/server/strength-weakness-tests.mjs
git diff --check
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-06-09-strength-fight-title-cache.md
```

Expected: the first three commands exit 0; the placeholder scan exits 1 with no matches.

- [x] **Step 2: Full verification**

Run:

```bash
npm test
```

Expected:

```text
1458 passed, 0 failed
```

- [x] **Step 3: Local read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/strength-fight-title-cache-local npm run smoke:report:readonly
jq '{latestRun: {status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary}, reportStatus, reportSummary}' test-artifacts/tmp/strength-fight-title-cache-local/qa-summary.json
```

Expected: `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and all required checks pass.

- [x] **Step 4: Scan smoke artifacts for sensitive patterns**

Run:

```bash
if rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/strength-fight-title-cache-local; then echo "sensitive matches found"; exit 1; else rg_status=$?; if [ "$rg_status" -eq 1 ]; then echo "no sensitive matches"; else exit "$rg_status"; fi; fi
```

Expected:

```text
no sensitive matches
```

### Task 4: Commit, Push, And Remote QA

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-09-strength-fight-title-cache.md`

- [x] **Step 1: Update Obsidian project log**

Record the intent, changed files, RED/GREEN output, full test count, local smoke result, commits, GitHub run, and artifact id in:

```text
/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md
```

- [x] **Step 2: Commit implementation**

Run:

```bash
git add server.js test-artifacts/server/strength-weakness-tests.mjs docs/superpowers/plans/2026-06-09-strength-fight-title-cache.md
git commit -m "test: cache strength fight title"
git push origin main
```

- [x] **Step 3: Verify GitHub QA artifact**

Run:

```bash
RUN_ID=$(gh run list --branch main --workflow QA --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/strength-fight-title-cache-gh
jq '{status: .latestRun.status, durationMs: .latestRun.durationMs, smokeSummary: .latestRun.smokeSummary, qaVerdict: .latestRun.qaVerdict.status, requiredCheckSummary: .latestRun.requiredCheckSummary, git: .latestRun.git, ci: .latestRun.ci}' test-artifacts/tmp/strength-fight-title-cache-gh/qa-summary.json
```

Expected: workflow conclusion is success, `latestRun.status` is `passed`, `smokeSummary.failed` is `0`, and `latestRun.git.shortSha` matches the pushed commit.

---

## Completion Evidence

- RED focused test: `node test-artifacts/server/strength-weakness-tests.mjs` returned 58 passed, 2 failed.
- RED failures:
  - `buildStrengths caches fightTitle`
  - `buildStrengths uses cached fightTitle as title`
- GREEN focused test: `node test-artifacts/server/strength-weakness-tests.mjs` returned 60 passed, 0 failed.
- Static verification:
  - `node --check server.js`: passed
  - `node --check test-artifacts/server/strength-weakness-tests.mjs`: passed
  - `git diff --check`: passed
  - placeholder scan: no matches
- Full verification: `npm test` passed with 1458 passed, 0 failed across 40 test file(s).
- Local read-only smoke report: 156 passed, 0 failed, `durationMs: 249`, `qaVerdict: "passed"`, required checks total 13 / passed 13 / failed 0 / missing 0.
- Local smoke artifact sensitive-pattern scan: no matches.
- Implementation commit: `a670520 test: cache strength fight title`, pushed to `origin/main`.
- GitHub Actions QA: run `27149211232` completed successfully for `a670520474d25facb8163ba0122d832bf3156e96`.
- GitHub artifact: `7485239419` (`qa-automation-27149211232`, 3551 bytes), read-only smoke 156 passed / 0 failed, `durationMs: 219`, `latestRun.git.shortSha: "a670520"`, `dirty: false`.
- GitHub artifact sensitive-pattern scan: no matches.
- Obsidian project log updated at `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`.

---

## Self-Review

- Spec coverage: This plan removes the duplicate `bestFightSummary(normalized)` call in `buildStrengths()` while preserving existing output behavior.
- Placeholder scan: The plan contains no placeholder implementation steps.
- Type consistency: `fightTitle`, `buildStrengths`, and `title: fightTitle` are named consistently across tests and implementation.
