# Trend Panel Escaping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent manifest-derived trend panel stats and repeated tags from rendering raw HTML when they are inserted through `innerHTML`.

**Architecture:** Keep `buildTrendSnapshot()` data unchanged and treat `renderTrendPanel()` as the display boundary. `headline` and `summary` already use `textContent`; only stat label/value/note and tag/list item template values need the existing `escapeHtml()` helper.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, Node source-extraction regression tests in `test-artifacts/main`, existing read-only smoke report and browser QA flow.

---

### Task 1: Capture The Trend Panel Escaping Regression

**Files:**
- Create: `test-artifacts/main/trend-panel-escaping-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-trend-panel-escaping.md`

- [x] **Step 1: Add the failing render test**

Create a source-extraction test that stubs `buildTrendSnapshot()` with unsafe stat and tag strings, then runs `renderTrendPanel()`.

Expected behavior after implementation:

- `trendHeadline` and `trendSummary` remain assigned through `textContent`.
- Stat label/value/note are escaped before interpolation.
- Recurring, positive, and negative trend tags are escaped before interpolation.
- Raw `<img`, `<script`, `<svg`, and `<b>` payload tags do not appear in the rendered trend panel HTML.

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/trend-panel-escaping-tests.mjs
node test-artifacts/main/trend-panel-escaping-tests.mjs
```

Expected result before implementation: syntax passes; runtime fails because `renderTrendPanel()` currently interpolates stat and tag strings directly into `innerHTML`.

Actual RED result: `node --check test-artifacts/main/trend-panel-escaping-tests.mjs` passed, and `node test-artifacts/main/trend-panel-escaping-tests.mjs` failed with `2 passed / 11 failed`. Failures confirmed raw stat/tag interpolation for label, value, note, recurring tags, positive tags, and negative tags.

### Task 2: Escape Trend Panel Dynamic Values

**Files:**
- Modify: `main.js`
- Test: `test-artifacts/main/trend-panel-escaping-tests.mjs`

- [x] **Step 1: Escape stat card strings**

In `renderTrendPanel()`, change the stat card template to call `escapeHtml(item.label)`, `escapeHtml(item.value)`, and `escapeHtml(item.note)`.

- [x] **Step 2: Escape trend tags**

In `renderTrendPanel()`, change the repeated tag, positive tag, and negative tag templates to call `escapeHtml(tag)` before interpolation. Keep fallback Korean empty-copy strings unchanged.

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/main/trend-panel-escaping-tests.mjs
node test-artifacts/main/trend-report-label-tests.mjs
node --check main.js
node --check test-artifacts/main/trend-panel-escaping-tests.mjs
```

Expected result after implementation: all focused checks pass and trend/report localization remains unchanged.

Actual GREEN result:

- `node test-artifacts/main/trend-panel-escaping-tests.mjs` -> `13 passed / 0 failed`
- `node test-artifacts/main/trend-report-label-tests.mjs` -> `18 passed / 0 failed`
- `node --check main.js`, `node --check test-artifacts/main/trend-panel-escaping-tests.mjs`, and `node --check test-artifacts/main/trend-report-label-tests.mjs` passed

### Task 3: QA And Publish

**Files:**
- Read-only QA artifacts under `test-artifacts/tmp`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/trend-panel-escaping-local npm run smoke:report:readonly
```

Expected result: all tests pass, whitespace diff check passes, smoke report passes with required checks complete, and sensitive-pattern scan over local artifacts returns no matches.

Actual local QA:

- `npm test` -> `2594 passed / 0 failed across 118 test file(s)`
- `git diff --check` passed
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/trend-panel-escaping-local npm run smoke:report:readonly` passed
- Local `qa-summary.json`: `status: passed`, `exitCode: 0`, `shortSha: "c00c1fe"`, `dirty: true`, smoke `156 passed / 0 failed`, required checks `13 passed / 0 failed / 0 missing`
- Sensitive-pattern scan over `test-artifacts/tmp/trend-panel-escaping-local` returned no matches

- [x] **Step 2: Run browser QA**

Use an isolated temporary sample root with an unsafe manifest entry, open the readonly app, and verify the trend panel shows escaped text rather than raw payload elements while keeping console warn/error output at zero.

Actual browser QA: ran `PUBLIC_DEMO_MODE=readonly PORT=8124 SAMPLES_DIR=test-artifacts/tmp/trend-panel-browser-samples npm start`, opened `http://127.0.0.1:8124`, loaded the stored sample, switched to `추세`, and verified the trend panel with unsafe manifest theme strings. `dangerousElementCounts` for `img`, `script`, `svg`, and `b` were all `0`; escaped `svg`, `script`, and `b` payload strings were present in `innerHTML`; raw payload markers were absent; console warn/error count was `0`. The browser tab and temporary server were closed after verification.

- [ ] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/trend-panel-escaping-tests.mjs docs/superpowers/plans/2026-06-09-trend-panel-escaping.md
git commit -m "test: escape trend panel content"
git push origin main
```

- [ ] **Step 4: Verify GitHub Actions artifact**

Watch the resulting `main` workflow run, download its `qa-automation-*` artifact, inspect `qa-summary.json`, and run the sensitive-string scan against the downloaded artifact.

- [ ] **Step 5: Record the cycle**

Update the repository plan and Obsidian project plan with RED/GREEN evidence, local QA, browser QA, GitHub run/artifact identifiers, and final sync status.
