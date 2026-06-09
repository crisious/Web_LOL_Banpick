# Recent Breakdown Escaping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent recent aggregate champion/role breakdown rows from rendering raw HTML when live Riot-derived champion or role strings contain unsafe markup.

**Architecture:** Keep recent-stat aggregation and ordering unchanged. Treat `renderChampionBreakdown()` and `renderRoleBreakdown()` as display boundaries and reuse existing `escapeHtml()` / `escapeAttr()` helpers for dynamic text and attributes while leaving numeric formatting intact.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, Node source-extraction regression tests in `test-artifacts/main`, existing read-only smoke report and browser QA flow.

---

### Task 1: Capture The Recent Breakdown Escaping Regression

**Files:**
- Create: `test-artifacts/main/recent-breakdown-escaping-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-recent-breakdown-escaping.md`

- [x] **Step 1: Add the failing render test**

Create a source-extraction test that runs `renderChampionBreakdown()` and `renderRoleBreakdown()` with unsafe values:

```js
const unsafeChampion = 'Ahri"><img src=x onerror=alert(1)>';
const unsafeRole = '"><svg onload=alert(1)>';
```

Expected behavior after implementation:

- Champion row `data-champion` is escaped.
- Champion visible label is escaped.
- Role row `data-role` is escaped.
- Role icon fallback and role label are escaped.
- Raw `<img` and `<svg` payloads do not appear in rendered breakdown HTML.
- Existing count, win-rate, KDA, CS, and footer text continue rendering.

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/recent-breakdown-escaping-tests.mjs
node test-artifacts/main/recent-breakdown-escaping-tests.mjs
```

Expected result before implementation: syntax passes; runtime fails because the recent breakdown templates currently interpolate row attributes and visible labels directly.

Actual RED result:

- `node --check test-artifacts/main/recent-breakdown-escaping-tests.mjs`: passed.
- `node test-artifacts/main/recent-breakdown-escaping-tests.mjs`: `6 passed, 12 failed`.
- Failures covered champion row `data-champion`, raw champion `<img` payload, role row `data-role`, role icon fallback, raw role `<svg` payload, and missing source-level escape calls.

### Task 2: Escape Recent Breakdown Dynamic Values

**Files:**
- Modify: `main.js`
- Test: `test-artifacts/main/recent-breakdown-escaping-tests.mjs`

- [x] **Step 1: Escape champion breakdown row values**

In `renderChampionBreakdown()`, update the row template:

```js
<li class="breakdown-row" data-champion="${escapeAttr(c.champion)}">
  <span class="breakdown-row__icon">${championAvatarMarkup(c.champion, "small")}</span>
  <span class="breakdown-row__label">${escapeHtml(championDisplayName(c.champion))}</span>
```

Do not change `championAvatarMarkup()`, numeric values, footer behavior, or row ordering.

- [x] **Step 2: Escape role breakdown row values**

In `renderRoleBreakdown()`, update the row template:

```js
<li class="breakdown-row" data-role="${escapeAttr(r.role)}">
  <span class="breakdown-row__icon breakdown-row__icon--role">${escapeHtml(ROLE_INITIAL[r.role] || r.role.slice(0, 3))}</span>
  <span class="breakdown-row__label">${escapeHtml(roleLabel(r.role))}</span>
```

Do not change role ordering, numeric values, or empty-state behavior.

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/main/recent-breakdown-escaping-tests.mjs
node test-artifacts/main/champion-history-escaping-tests.mjs
node test-artifacts/main/recent-stats-tests.mjs
node --check main.js
node --check test-artifacts/main/recent-breakdown-escaping-tests.mjs
```

Expected result after implementation: all focused checks pass and existing recent-stat aggregation plus champion-history escaping contracts remain unchanged.

Actual GREEN result:

- `node test-artifacts/main/recent-breakdown-escaping-tests.mjs`: `18 passed, 0 failed`.
- `node test-artifacts/main/champion-history-escaping-tests.mjs`: `20 passed, 0 failed`.
- `node test-artifacts/main/recent-stats-tests.mjs`: `29 passed, 0 failed`.
- `node --check main.js`: passed.
- `node --check test-artifacts/main/recent-breakdown-escaping-tests.mjs`: passed.

### Task 3: QA And Publish

**Files:**
- Read-only QA artifacts under `test-artifacts/tmp`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/recent-breakdown-escaping-local npm run smoke:report:readonly
```

Expected result: all tests pass, whitespace diff check passes, smoke report passes with required checks complete, and sensitive-pattern scan over local artifacts returns no matches.

Actual local QA result:

- `npm test`: `2632 passed, 0 failed across 120 test file(s)`.
- `git diff --check`: passed.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/recent-breakdown-escaping-local npm run smoke:report:readonly`: passed.
- Local smoke summary: `156 passed, 0 failed`; required checks `13 pass`.
- Local artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.

- [x] **Step 2: Run browser QA**

Open the readonly app through the in-app browser, load a stored sample, switch to the trend tab, and verify the recent aggregate breakdown surfaces remain structurally safe in demo-locked state.

Actual browser QA result:

- Readonly home opened successfully.
- Stored sample opened successfully.
- Trend tab selected successfully.
- Recent aggregate root exists.
- Champion breakdown root/list exists.
- Role breakdown root/list exists.
- Readonly live recent-stats state stayed locked with visible aggregate placeholders.
- Dangerous nodes under champion/role breakdown roots: `img=0`, `script=0`, `svg=0`, inline handlers `0`.
- Raw dangerous markup scan on breakdown/recent aggregate HTML: false for `<script`, `<svg`, `<img`, `onerror=`, `onclick=`, `onload=`.
- Console warn/error log: `[]`.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/recent-breakdown-escaping-tests.mjs docs/superpowers/plans/2026-06-09-recent-breakdown-escaping.md
git commit -m "test: escape recent breakdown content"
git push origin main
```

Actual implementation commit:

- Commit: `1b7eba0 test: escape recent breakdown content`
- Push target: `origin/main`

- [x] **Step 4: Verify GitHub Actions artifact**

Watch the resulting `main` workflow run, download its `qa-automation-*` artifact, inspect `qa-summary.json`, and run the sensitive-string scan against the downloaded artifact.

Actual GitHub QA result:

- Run: `27203797424` (`QA`, `main`, commit `1b7eba08ca71370303bddb31255b27f265786bf5`)
- URL: `https://github.com/crisious/Web_LOL_Banpick/actions/runs/27203797424`
- Conclusion: success.
- Artifact: `qa-automation-27203797424`
- Artifact id: `7506584738`
- Artifact digest: `sha256:d704724cd92aba506eacc7044aaf2dbe64f0d75af0b47d59dd8d60d7f075af92`
- `qa-summary.json latestRun.status`: `passed`.
- `qaVerdict.status`: `passed`.
- `exitCode`: `0`.
- `git.shortSha`: `1b7eba0`; `dirty`: `false`.
- Smoke summary: `156 passed, 0 failed`.
- Required checks: `13 pass`.
- Artifact integrity: `passed`.
- Sample evidence: `passed`.
- Demo safety evidence: `passed`.
- Artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.

- [x] **Step 5: Record the cycle**

Update the repository plan and Obsidian project plan with RED/GREEN evidence, local QA, browser QA, GitHub run/artifact identifiers, and final sync status.

Repository plan record:

- Final docs commit: `bac8cc3 docs: finalize recent breakdown escaping plan`
- Final docs QA run: `27203863806`
- Final docs QA URL: `https://github.com/crisious/Web_LOL_Banpick/actions/runs/27203863806`
- Final docs artifact: `qa-automation-27203863806`
- Final docs artifact id: `7506611482`
- Final docs artifact digest: `sha256:abc4da7960aa609c6a4ad0d151d3515e29c27c3a06e08958562cd4328d91f7a2`
- Final docs artifact summary: `latestRun.status=passed`, `qaVerdict=passed`, `exitCode=0`, `shortSha=bac8cc3`, `dirty=false`, smoke `156 passed / 0 failed`, required checks `13 pass`, artifact integrity `passed`, sample evidence `passed`, demo safety `passed`.
- Final docs artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.
