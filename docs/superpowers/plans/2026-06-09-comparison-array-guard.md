# Comparison Array Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the AI comparison panel renderable when comparison arrays are missing, `null`, or malformed.

**Architecture:** Follow existing frontend defensive-array patterns by adding a tiny `comparisonItems(value)` helper that returns arrays unchanged and falls back to `[]` for non-arrays. `renderComparison(sample)` should derive local `agreements`, `claudeOnly`, and `codexOnly` arrays once, then use those locals for counts and cards.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, Node extraction regression tests in `test-artifacts/main`, existing read-only smoke report workflow.

---

### Task 1: Capture The Malformed Comparison Regression

**Files:**
- Create: `test-artifacts/main/comparison-array-guard-tests.mjs`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/main/comparison-array-guard-tests.mjs` with an extracted `renderComparison()` harness. Include `HTML_ESCAPE`, `escapeHtml()`, `comparisonRatePercent()`, optional fallback extraction for `comparisonItems()`, and `renderComparison()`.

- [x] **Step 2: Assert malformed arrays do not crash**

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

- [x] **Step 3: Assert valid arrays still render**

Render a second valid comparison object with one entry in each bucket and assert `3` comparison cards render and count labels are `1건` for all buckets.

- [x] **Step 4: Verify RED**

Run:

```bash
node test-artifacts/main/comparison-array-guard-tests.mjs
```

Expected result before implementation: FAIL because current `renderComparison()` reads `.length` and `.map()` directly from malformed/nonexistent values.

Actual RED result: `node test-artifacts/main/comparison-array-guard-tests.mjs` failed with `7 passed, 17 failed`, proving `comparisonItems()` was missing and `renderComparison()` threw `TypeError: Cannot read properties of null (reading 'length')` for malformed comparison buckets.

### Task 2: Add The Defensive Array Helper

**Files:**
- Modify: `main.js`
- Test: `test-artifacts/main/comparison-array-guard-tests.mjs`

- [x] **Step 1: Add helper near comparison rate helper**

Add:

```js
function comparisonItems(value) {
  return Array.isArray(value) ? value : [];
}
```

- [x] **Step 2: Use locals in `renderComparison()`**

After `const rate = comparisonRatePercent(comp.agreementRate);`, add:

```js
const agreements = comparisonItems(comp.agreements);
const claudeOnly = comparisonItems(comp.claudeOnly);
const codexOnly = comparisonItems(comp.codexOnly);
```

Use those locals for count labels and `.map()` calls.

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/main/comparison-array-guard-tests.mjs
node test-artifacts/main/comparison-card-escaping-tests.mjs
```

Expected result after implementation: both tests pass, proving malformed arrays are guarded without regressing escaping/clamp behavior.

Actual GREEN result: `node test-artifacts/main/comparison-array-guard-tests.mjs` passed with `24 passed, 0 failed`; `node test-artifacts/main/comparison-card-escaping-tests.mjs` passed with `29 passed, 0 failed`; `node --check` passed for `main.js` and both comparison tests.

### Task 3: QA And Publish

**Files:**
- Read-only QA artifacts under `test-artifacts/tmp`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/comparison-array-guard-local npm run smoke:report:readonly
```

Expected result: all tests pass, whitespace diff check passes, smoke report passes with required checks complete, and sensitive-pattern scan over local artifacts returns no matches.

Actual local QA: `npm test` passed with `2573 passed, 0 failed across 117 test file(s)`. `git diff --check` passed. `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/comparison-array-guard-local npm run smoke:report:readonly` passed with smoke `156 passed, 0 failed` and required checks `13 passed, 0 failed, 0 missing`. Sensitive-pattern scan over `test-artifacts/tmp/comparison-array-guard-local` returned no matches.

- [x] **Step 2: Run browser QA**

Use an isolated temporary sample root with malformed comparison arrays for `sample-kr-8242613150`, open the readonly app, and verify the comparison panel renders `0건` counts and empty-column fallback copy without console warn/error output.

Actual browser QA: created `test-artifacts/tmp/comparison-array-browser-samples` from stored samples, changed `sample-kr-8242613150/comparison-result.json` to `agreementRate: 42`, `agreements: null`, `claudeOnly: { topic: "not an array" }`, and omitted `codexOnly`. In readonly mode at `http://127.0.0.1:8124`, the comparison panel rendered rate label `42%`, fill style `width: 42%`, meta text `동의 0건 Claude 0건 Codex 0건`, empty copy `동의 항목 없음` plus two `없음` copies, card count `0`, and console warn/error count `0`.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/comparison-array-guard-tests.mjs docs/superpowers/plans/2026-06-09-comparison-array-guard.md
git commit -m "test: guard comparison array rendering"
git push origin main
```

- [x] **Step 4: Verify GitHub Actions artifact**

Watch the resulting `main` workflow run, download its `qa-automation-*` artifact, inspect `qa-summary.json`, and run the sensitive-string scan against the downloaded artifact.

Actual GitHub QA: implementation commit `886da6b test: guard comparison array rendering` pushed to `main`; QA run `27200726960` completed successfully. Artifact `7505338368` (`qa-automation-27200726960`, digest `sha256:5605c3805b08d163ec6cdefd49131870c7f2c2b39356a2184ef5b01f29a75ac0`) contained `latestRun.git.shortSha: "886da6b"`, `dirty: false`, smoke `156 passed, 0 failed`, required checks `13 passed, 0 failed, 0 missing`, artifact integrity `passed`, and QA verdict `passed`. Sensitive-pattern scan over `test-artifacts/tmp/github-qa-27200726960` returned no matches.

- [x] **Step 5: Record the cycle**

Update the Obsidian project improvement plan with the issue, implementation, local QA, browser QA, GitHub run, artifact digest, and final sync status.

Actual status: implementation evidence is recorded here; Obsidian will record the final docs QA and sync state after this plan finalization commit is pushed and verified.
