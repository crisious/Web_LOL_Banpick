# Comparison Item Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the AI comparison panel renderable when comparison bucket arrays contain malformed items.

**Architecture:** Reuse the existing `comparisonItems(value)` helper as the render-boundary sanitizer. It should return only object entries from array buckets and fall back to `[]` for non-arrays, so `renderComparison(sample)` counts and renders only card-shaped items.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, Node extraction regression tests in `test-artifacts/main`, existing read-only smoke report workflow.

---

### Task 1: Capture The Malformed Item Regression

**Files:**
- Modify: `test-artifacts/main/comparison-array-guard-tests.mjs`

- [x] **Step 1: Extend helper tests**

Add assertions that `comparisonItems([null, "bad", 7, [], { topic: "ok" }])` returns only the valid object entry.

- [x] **Step 2: Assert render skips malformed items**

Render a comparison object with mixed malformed and valid items:

```js
renderComparison({
  comparison: {
    comparison: {
      agreementRate: 88,
      agreements: [null, "bad", { category: "strength", topic: "공통", claudeNote: "C", codexNote: "D" }],
      claudeOnly: [7, { category: "weakness", topic: "Claude", note: "only" }],
      codexOnly: [[], { category: "strength", topic: "Codex", note: "only" }],
    },
  },
});
```

Expected behavior after implementation: no throw, counts `1건` for all three buckets, exactly `3` comparison cards, and no `undefined`/`null` text in the grid.

- [x] **Step 3: Verify RED**

Run:

```bash
node test-artifacts/main/comparison-array-guard-tests.mjs
```

Expected result before implementation: FAIL because current `comparisonItems()` preserves malformed array entries and `renderComparison()` tries to read properties from `null`.

Actual RED result: `node test-artifacts/main/comparison-array-guard-tests.mjs` failed with `27 passed / 5 failed`, confirming malformed array item preservation and a `TypeError: Cannot read properties of null (reading 'category')` render crash.

### Task 2: Filter Comparison Items

**Files:**
- Modify: `main.js`
- Test: `test-artifacts/main/comparison-array-guard-tests.mjs`

- [x] **Step 1: Update helper**

Change `comparisonItems(value)` to:

```js
function comparisonItems(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
}
```

- [x] **Step 2: Verify GREEN**

Run:

```bash
node test-artifacts/main/comparison-array-guard-tests.mjs
node test-artifacts/main/comparison-card-escaping-tests.mjs
```

Expected result after implementation: both tests pass, proving item filtering does not regress escaping/clamp behavior.

Actual GREEN result:

- `node test-artifacts/main/comparison-array-guard-tests.mjs` -> `32 passed / 0 failed`
- `node test-artifacts/main/comparison-card-escaping-tests.mjs` -> `29 passed / 0 failed`
- `node --check main.js` and `node --check` for both comparison tests passed

### Task 3: QA And Publish

**Files:**
- Read-only QA artifacts under `test-artifacts/tmp`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/comparison-item-guard-local npm run smoke:report:readonly
```

Expected result: all tests pass, whitespace diff check passes, smoke report passes with required checks complete, and sensitive-pattern scan over local artifacts returns no matches.

Actual local QA:

- `npm test` -> `2581 passed / 0 failed across 117 test file(s)`
- `git diff --check` passed
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/comparison-item-guard-local npm run smoke:report:readonly` passed
- Local `qa-summary.json`: `status: passed`, `exitCode: 0`, `shortSha: "8ad1c6d"`, `dirty: true`, smoke `156 passed / 0 failed`, required checks `13 passed / 0 failed / 0 missing`
- Sensitive-pattern scan over `test-artifacts/tmp/comparison-item-guard-local` returned no matches

- [x] **Step 2: Run browser QA**

Use an isolated temporary sample root with mixed malformed and valid comparison items for `sample-kr-8242613150`, open the readonly app, and verify the comparison panel renders only valid cards with correct counts and no console warn/error output.

Actual browser QA: ran `PUBLIC_DEMO_MODE=readonly PORT=8124 SAMPLES_DIR=test-artifacts/tmp/comparison-item-browser-samples npm start`, opened `http://127.0.0.1:8124`, and loaded the saved sample. The comparison panel rendered `3` cards, rate label `88%`, fill style `width: 88%`, meta `동의 1건 Claude 1건 Codex 1건`, all three valid card texts, no malformed `bad`/`null`/`undefined` leaks, and `0` console warn/error entries. The temporary server and artifacts were cleaned up.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/comparison-array-guard-tests.mjs docs/superpowers/plans/2026-06-09-comparison-item-guard.md
git commit -m "test: guard comparison item rendering"
git push origin main
```

- [x] **Step 4: Verify GitHub Actions artifact**

Watch the resulting `main` workflow run, download its `qa-automation-*` artifact, inspect `qa-summary.json`, and run the sensitive-string scan against the downloaded artifact.

Actual implementation publish QA: commit `b2bbd05 test: guard comparison item rendering` pushed to `origin/main`. GitHub Actions QA run `27201270837` completed with `success`; artifact `7505566354` (`qa-automation-27201270837`, digest `sha256:7272daecb4e73fdf2c4b4e0b15065da0e3e8d51260f0a80fd1d9c88bd2779170`) was downloaded and parsed. `qa-summary.json` reported `status: passed`, `exitCode: 0`, `shortSha: "b2bbd05"`, `dirty: false`, smoke `156 passed / 0 failed`, required checks `13 passed / 0 failed / 0 missing`, artifact integrity `passed`, and QA verdict `passed`. Sensitive-pattern scan over `test-artifacts/tmp/github-qa-27201270837` returned no matches.

- [x] **Step 5: Record the cycle**

Update the Obsidian project improvement plan with the issue, implementation, local QA, browser QA, GitHub run, artifact digest, and final sync status.

Actual record: repository plan and Obsidian project plan were updated with the comparison item guard scope, evidence, QA outputs, GitHub run/artifact identifiers, and final sync status.
