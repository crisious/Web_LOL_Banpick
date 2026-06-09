# Comparison Item Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the AI comparison panel renderable when comparison bucket arrays contain malformed items.

**Architecture:** Reuse the existing `comparisonItems(value)` helper as the render-boundary sanitizer. It should return only object entries from array buckets and fall back to `[]` for non-arrays, so `renderComparison(sample)` counts and renders only card-shaped items.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, Node extraction regression tests in `test-artifacts/main`, existing read-only smoke report workflow.

---

### Task 1: Capture The Malformed Item Regression

**Files:**
- Modify: `test-artifacts/main/comparison-array-guard-tests.mjs`

- [ ] **Step 1: Extend helper tests**

Add assertions that `comparisonItems([null, "bad", 7, [], { topic: "ok" }])` returns only the valid object entry.

- [ ] **Step 2: Assert render skips malformed items**

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

- [ ] **Step 3: Verify RED**

Run:

```bash
node test-artifacts/main/comparison-array-guard-tests.mjs
```

Expected result before implementation: FAIL because current `comparisonItems()` preserves malformed array entries and `renderComparison()` tries to read properties from `null`.

### Task 2: Filter Comparison Items

**Files:**
- Modify: `main.js`
- Test: `test-artifacts/main/comparison-array-guard-tests.mjs`

- [ ] **Step 1: Update helper**

Change `comparisonItems(value)` to:

```js
function comparisonItems(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
}
```

- [ ] **Step 2: Verify GREEN**

Run:

```bash
node test-artifacts/main/comparison-array-guard-tests.mjs
node test-artifacts/main/comparison-card-escaping-tests.mjs
```

Expected result after implementation: both tests pass, proving item filtering does not regress escaping/clamp behavior.

### Task 3: QA And Publish

**Files:**
- Read-only QA artifacts under `test-artifacts/tmp`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Run local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/comparison-item-guard-local npm run smoke:report:readonly
```

Expected result: all tests pass, whitespace diff check passes, smoke report passes with required checks complete, and sensitive-pattern scan over local artifacts returns no matches.

- [ ] **Step 2: Run browser QA**

Use an isolated temporary sample root with mixed malformed and valid comparison items for `sample-kr-8242613150`, open the readonly app, and verify the comparison panel renders only valid cards with correct counts and no console warn/error output.

- [ ] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/comparison-array-guard-tests.mjs docs/superpowers/plans/2026-06-09-comparison-item-guard.md
git commit -m "test: guard comparison item rendering"
git push origin main
```

- [ ] **Step 4: Verify GitHub Actions artifact**

Watch the resulting `main` workflow run, download its `qa-automation-*` artifact, inspect `qa-summary.json`, and run the sensitive-string scan against the downloaded artifact.

- [ ] **Step 5: Record the cycle**

Update the Obsidian project improvement plan with the issue, implementation, local QA, browser QA, GitHub run, artifact digest, and final sync status.
