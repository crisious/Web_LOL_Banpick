# Champion History Escaping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent champion history summary/table content and avatar attributes from rendering raw HTML when champion names or card values contain unsafe strings.

**Architecture:** Keep champion history aggregation, sorting, and table structure unchanged. Treat `renderChampionSummary()`, `renderChampionTable()`, and `championAvatarMarkup()` as display boundaries and reuse existing `escapeHtml()` / `escapeAttr()` helpers for dynamic text and attributes.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, Node source-extraction regression tests in `test-artifacts/main`, existing read-only smoke report and browser QA flow.

---

### Task 1: Capture The Champion History Escaping Regression

**Files:**
- Create: `test-artifacts/main/champion-history-escaping-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-champion-history-escaping.md`

- [x] **Step 1: Add the failing render test**

Create a source-extraction test that runs `championAvatarMarkup()`, `renderChampionSummary()`, and `renderChampionTable()` with unsafe champion names:

```js
const unsafeChampion = 'Ahri"><img src=x onerror=alert(1)>';
const unsafeBestChampion = "Lux<script>alert(1)</script>";
```

Expected behavior after implementation:

- Avatar `title` and `data-champion-name` attributes are escaped.
- Summary card values are escaped.
- Table champion text is escaped.
- Raw `<img` and `<script` payloads do not appear in rendered summary/table/avatar HTML.
- Numeric cells and sort headers continue rendering.

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/champion-history-escaping-tests.mjs
node test-artifacts/main/champion-history-escaping-tests.mjs
```

Expected result before implementation: syntax passes; runtime fails because the champion history rendering boundary currently interpolates champion display text and avatar attributes directly.

Actual RED result:

- `node --check test-artifacts/main/champion-history-escaping-tests.mjs`: passed.
- `node test-artifacts/main/champion-history-escaping-tests.mjs`: `2 passed, 18 failed`.
- Failures covered raw avatar attribute interpolation, summary card value interpolation, table champion text interpolation, and missing source-level escape calls.

### Task 2: Escape Champion History Dynamic Values

**Files:**
- Modify: `main.js`
- Test: `test-artifacts/main/champion-history-escaping-tests.mjs`

- [x] **Step 1: Escape avatar attributes**

In `championAvatarMarkup(name, size)`, change the returned `title`, `data-champion-name`, and `data-monogram` attributes to use `escapeAttr(...)`:

```js
return `<span class="champion-avatar champion-avatar--${size}" aria-hidden="true" title="${escapeAttr(display)}" data-champion-name="${escapeAttr(name || "")}" data-monogram="${escapeAttr(monogram)}"${artStyle}></span>`;
```

- [x] **Step 2: Escape summary cards**

In `renderChampionSummary(stats)`, change the card template to use `escapeHtml(c.label)`, `escapeHtml(c.value)`, and `escapeHtml(c.note)`.

- [x] **Step 3: Escape table champion text**

In `renderChampionTable(byChampion, sortKey, sortDir)`, change the champion text span to:

```js
<span>${escapeHtml(championDisplayName(c.champion))}</span>
```

Do not change numeric formatting, sorting, or empty table behavior.

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/main/champion-history-escaping-tests.mjs
node test-artifacts/main/trend-panel-escaping-tests.mjs
node --check main.js
node --check test-artifacts/main/champion-history-escaping-tests.mjs
```

Expected result after implementation: all focused checks pass and the previous trend-panel escaping contract remains unchanged.

Actual GREEN result:

- `node test-artifacts/main/champion-history-escaping-tests.mjs`: `20 passed, 0 failed`.
- `node test-artifacts/main/trend-panel-escaping-tests.mjs`: `13 passed, 0 failed`.
- `node test-artifacts/main/sample-metadata-label-tests.mjs`: `22 passed, 0 failed`.
- `node --check main.js`: passed.
- `node --check test-artifacts/main/champion-history-escaping-tests.mjs`: passed.

### Task 3: QA And Publish

**Files:**
- Read-only QA artifacts under `test-artifacts/tmp`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/champion-history-escaping-local npm run smoke:report:readonly
```

Expected result: all tests pass, whitespace diff check passes, smoke report passes with required checks complete, and sensitive-pattern scan over local artifacts returns no matches.

Actual local QA result:

- `npm test`: `2614 passed, 0 failed across 119 test file(s)`.
- `git diff --check`: passed.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/champion-history-escaping-local npm run smoke:report:readonly`: passed.
- Local smoke summary: `156 passed, 0 failed`; required checks `13 passed, 0 failed, 0 missing`.
- Local artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.

- [x] **Step 2: Run browser QA**

Open the readonly app through the in-app browser, load a stored sample, switch to the champion tab, and verify the champion history region remains structurally safe.

Actual browser QA result:

- Stored sample opened successfully in readonly mode.
- Champion tab selected successfully.
- Champion history root, summary container, and table container exist.
- Empty-state text stayed correct: `먼저 Riot ID로 로그인해주세요.`
- Dangerous nodes under the champion history root: `img=0`, `script=0`, inline handlers `0`.
- Raw dangerous markup scan on root HTML: false for `<script`, `<img`, `onerror=`, `onclick=`, `onload=`.
- Console warn/error log: `[]`.
- Attempted localStorage fixture injection for unsafe champion-history payloads, but the Browser read-only evaluation scope does not expose `localStorage`/`window.localStorage`; unsafe payload rendering remains covered by the focused source-extraction regression test above.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/champion-history-escaping-tests.mjs docs/superpowers/plans/2026-06-09-champion-history-escaping.md
git commit -m "test: escape champion history content"
git push origin main
```

Actual implementation commit:

- Commit: `060fa7e test: escape champion history content`
- Push target: `origin/main`

- [x] **Step 4: Verify GitHub Actions artifact**

Watch the resulting `main` workflow run, download its `qa-automation-*` artifact, inspect `qa-summary.json`, and run the sensitive-string scan against the downloaded artifact.

Actual GitHub QA result:

- Run: `27203126737` (`QA`, `main`, commit `060fa7e4ac284606f3e5a4c34499a0678bdca880`)
- URL: `https://github.com/crisious/Web_LOL_Banpick/actions/runs/27203126737`
- Conclusion: success.
- Artifact: `qa-automation-27203126737`
- Artifact id: `7506303303`
- Artifact digest: `sha256:8b34273f1aafaafab55a4a4220d215239de64d13beeaede9740734cfaa6a1531`
- `qa-summary.json latestRun.status`: `passed`.
- `qaVerdict.status`: `passed`.
- `exitCode`: `0`.
- `git.shortSha`: `060fa7e`; `dirty`: `false`.
- Smoke summary: `156 passed, 0 failed`.
- Required checks: `13 pass`.
- Artifact integrity: `passed`.
- Sample evidence: `passed`.
- Demo safety evidence: `passed`.
- Artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.

- [x] **Step 5: Record the cycle**

Update the repository plan and Obsidian project plan with RED/GREEN evidence, local QA, browser QA, GitHub run/artifact identifiers, and final sync status.

Repository plan record:

- Final docs commit: `863c67f docs: finalize champion history escaping plan`
- Final docs QA run: `27203217181`
- Final docs QA URL: `https://github.com/crisious/Web_LOL_Banpick/actions/runs/27203217181`
- Final docs artifact: `qa-automation-27203217181`
- Final docs artifact id: `7506339103`
- Final docs artifact digest: `sha256:e5e6f9d0af5762d5c85b9cd1dd055331707946d39852980be0f5c36d712b1a9d`
- Final docs artifact summary: `latestRun.status=passed`, `qaVerdict=passed`, `exitCode=0`, `shortSha=863c67f`, `dirty=false`, smoke `156 passed / 0 failed`, required checks `13 pass`, artifact integrity `passed`, sample evidence `passed`, demo safety `passed`.
- Final docs artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.
