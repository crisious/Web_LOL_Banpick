# Comparison Card Escaping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render AI comparison cards without allowing raw analysis text or invalid agreement rates to alter page markup.

**Architecture:** Keep the existing `renderComparison(sample)` flow and harden only its interpolation points. Text fields go through the existing `escapeHtml()` helper, while agreement rate is normalized through a small dedicated helper before being used in text or inline width.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, Node-based extraction regression tests in `test-artifacts/main`, existing smoke report QA scripts.

---

### Task 1: Capture The Escaping Regression

**Files:**
- Create: `test-artifacts/main/comparison-card-escaping-tests.mjs`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/main/comparison-card-escaping-tests.mjs` with an extracted `renderComparison()` harness. The test should render comparison data containing unsafe `topic`, `claudeNote`, `codexNote`, and `note` strings, then assert that the output contains escaped entities and no literal `<img>`, `<script>`, `<svg>`, or `<b>` payload tags.

- [x] **Step 2: Add agreement rate checks**

In the same test file, include fallback extraction for a future `comparisonRatePercent()` helper. Assert that `135.5` clamps to `100`, `-5` clamps to `0`, `"75"` normalizes to `75`, and invalid input normalizes to `0`. Render a sample with `agreementRate: 135.5` and assert the rate label and fill width both use `100%`.

- [x] **Step 3: Verify RED**

Run:

```bash
node test-artifacts/main/comparison-card-escaping-tests.mjs
```

Expected result before implementation: FAIL, with failures for raw comparison text interpolation and unclamped agreement rate.

Actual RED result: `node test-artifacts/main/comparison-card-escaping-tests.mjs` failed with `1 passed, 28 failed`, proving raw card text interpolation, unclamped `135.5%`, and missing `comparisonRatePercent(comp.agreementRate)`.

### Task 2: Harden Comparison Rendering

**Files:**
- Modify: `main.js`
- Test: `test-artifacts/main/comparison-card-escaping-tests.mjs`

- [x] **Step 1: Add rate normalization helper**

Add this helper near the existing formatting helpers:

```js
function comparisonRatePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}
```

- [x] **Step 2: Use the helper in `renderComparison()`**

Replace the current rate fallback:

```js
const rate = comp.agreementRate ?? 0;
```

with:

```js
const rate = comparisonRatePercent(comp.agreementRate);
```

- [x] **Step 3: Escape comparison card text**

Wrap comparison card user-facing text fields with `escapeHtml()`:

```js
<h4>${escapeHtml(a.topic || "")}</h4>
<p><strong>Claude:</strong> ${escapeHtml(a.claudeNote || "")}</p>
<p><strong>Codex:</strong> ${escapeHtml(a.codexNote || "")}</p>
<h4>${escapeHtml(c.topic || "")}</h4>
<p>${escapeHtml(c.note || "")}</p>
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/main/comparison-card-escaping-tests.mjs
```

Expected result after implementation: PASS, including source-shape checks proving raw `${a.topic}`, `${a.claudeNote}`, `${a.codexNote}`, `${c.topic}`, and `${c.note}` interpolation is gone.

Actual GREEN result: `node test-artifacts/main/comparison-card-escaping-tests.mjs` passed with `29 passed, 0 failed`.

### Task 3: QA And Publish

**Files:**
- Read-only QA artifacts under `test-artifacts/tmp`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/comparison-card-escaping-local npm run smoke:report:readonly
```

Expected result: all tests pass, whitespace diff check passes, smoke report returns a passing QA summary with no sensitive Riot/API token strings in generated artifacts.

Actual local QA: `npm test` passed with `2549 passed, 0 failed across 116 test file(s)`. `git diff --check` passed. `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/comparison-card-escaping-local npm run smoke:report:readonly` passed with smoke `156 passed, 0 failed` and required checks `13 passed, 0 failed, 0 missing`. Sensitive-pattern scan over `test-artifacts/tmp/comparison-card-escaping-local` returned no matches.

- [x] **Step 2: Run browser QA**

Open the local readonly app with either stored comparison samples or an isolated temporary sample root. Verify the comparison panel displays escaped text, a clamped `100%` agreement rate for an unsafe fixture, and no console errors.

Actual browser QA: created an isolated `test-artifacts/tmp/comparison-browser-samples` fixture from stored samples, changed `sample-kr-8242613150/comparison-result.json` to include unsafe comparison strings and `agreementRate: 135.5`, then opened `http://127.0.0.1:8124` in readonly mode. The comparison panel rendered `3` cards, rate label `100%`, fill style `width: 100%`, escaped `img`/`script`/`b`/`svg`/ampersand entities, raw payload tag count `0`, raw `135.5%` count `0`, and console warn/error count `0`.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/comparison-card-escaping-tests.mjs docs/superpowers/plans/2026-06-09-comparison-card-escaping.md
git commit -m "test: escape comparison card content"
git push origin main
```

- [x] **Step 4: Verify GitHub Actions artifact**

Watch the resulting `main` workflow run, download its `qa-automation-*` artifact, inspect `qa-summary.json`, and run the sensitive-string scan against the downloaded artifact.

Actual GitHub QA: implementation commit `bf64986 test: escape comparison card content` pushed to `main`; QA run `27200065403` completed successfully. Artifact `7505061935` (`qa-automation-27200065403`, digest `sha256:2b561aad225d7cab01a34e34dcc32dccd91dfc57dc12a6611dd9affe70edfb94`) contained `latestRun.git.shortSha: "bf64986"`, `dirty: false`, smoke `156 passed, 0 failed`, required checks `13 passed, 0 failed, 0 missing`, artifact integrity `passed`, and QA verdict `passed`. Sensitive-pattern scan over `test-artifacts/tmp/github-qa-27200065403` returned no matches.

- [x] **Step 5: Record the cycle**

Update the Obsidian project improvement plan with the issue, implementation, local QA, browser QA, GitHub run, artifact digest, and final sync status.

Actual status: implementation evidence is recorded here; Obsidian will record the final docs QA and sync state after this plan finalization commit is pushed and verified.
