# Comparison Array Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the AI comparison panel renderable when comparison arrays are missing, `null`, or malformed.

**Architecture:** Follow existing frontend defensive-array patterns by adding a tiny `comparisonItems(value)` helper that returns arrays unchanged and falls back to `[]` for non-arrays. `renderComparison(sample)` should derive local `agreements`, `claudeOnly`, and `codexOnly` arrays once, then use those locals for counts and cards.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, Node extraction regression tests in `test-artifacts/main`, existing read-only smoke report workflow.

---

### Task 1: Capture The Malformed Comparison Regression

**Files:**
- Create: `test-artifacts/main/comparison-array-guard-tests.mjs`

- [ ] **Step 1: Write the failing test**

Create `test-artifacts/main/comparison-array-guard-tests.mjs` with an extracted `renderComparison()` harness. Include `HTML_ESCAPE`, `escapeHtml()`, `comparisonRatePercent()`, optional fallback extraction for `comparisonItems()`, and `renderComparison()`.

- [ ] **Step 2: Assert malformed arrays do not crash**

Render this shape:

```js
renderComparison({
  comparison: {
    comparison: {
      agreementRate: 42,
      agreements: null,
      claudeOnly: { topic: "not an array" },
    },
  },
});
```

Expected behavior after implementation: no throw, empty status, rate `42%`, counts `동의 0건`, `Claude 0건`, `Codex 0건`, and empty-column copy for all three columns.

- [ ] **Step 3: Assert valid arrays still render**

Render a second valid comparison object with one entry in each bucket and assert `3` comparison cards render and count labels are `1건` for all buckets.

- [ ] **Step 4: Verify RED**

Run:

```bash
node test-artifacts/main/comparison-array-guard-tests.mjs
```

Expected result before implementation: FAIL because current `renderComparison()` reads `.length` and `.map()` directly from malformed/nonexistent values.

### Task 2: Add The Defensive Array Helper

**Files:**
- Modify: `main.js`
- Test: `test-artifacts/main/comparison-array-guard-tests.mjs`

- [ ] **Step 1: Add helper near comparison rate helper**

Add:

```js
function comparisonItems(value) {
  return Array.isArray(value) ? value : [];
}
```

- [ ] **Step 2: Use locals in `renderComparison()`**

After `const rate = comparisonRatePercent(comp.agreementRate);`, add:

```js
const agreements = comparisonItems(comp.agreements);
const claudeOnly = comparisonItems(comp.claudeOnly);
const codexOnly = comparisonItems(comp.codexOnly);
```

Use those locals for count labels and `.map()` calls.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/main/comparison-array-guard-tests.mjs
node test-artifacts/main/comparison-card-escaping-tests.mjs
```

Expected result after implementation: both tests pass, proving malformed arrays are guarded without regressing escaping/clamp behavior.

### Task 3: QA And Publish

**Files:**
- Read-only QA artifacts under `test-artifacts/tmp`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Run local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/comparison-array-guard-local npm run smoke:report:readonly
```

Expected result: all tests pass, whitespace diff check passes, smoke report passes with required checks complete, and sensitive-pattern scan over local artifacts returns no matches.

- [ ] **Step 2: Run browser QA**

Use an isolated temporary sample root with malformed comparison arrays for `sample-kr-8242613150`, open the readonly app, and verify the comparison panel renders `0건` counts and empty-column fallback copy without console warn/error output.

- [ ] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/comparison-array-guard-tests.mjs docs/superpowers/plans/2026-06-09-comparison-array-guard.md
git commit -m "test: guard comparison array rendering"
git push origin main
```

- [ ] **Step 4: Verify GitHub Actions artifact**

Watch the resulting `main` workflow run, download its `qa-automation-*` artifact, inspect `qa-summary.json`, and run the sensitive-string scan against the downloaded artifact.

- [ ] **Step 5: Record the cycle**

Update the Obsidian project improvement plan with the issue, implementation, local QA, browser QA, GitHub run, artifact digest, and final sync status.
