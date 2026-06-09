# Sample Switcher Escaping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent stored-sample switcher chips and report cards from rendering raw HTML when manifest sample ids, aliases, champion names, result metadata, or themes contain unsafe strings.

**Architecture:** Keep the existing sample switcher, report strip, and avatar layout unchanged. Treat manifest-derived values as display-boundary inputs: data attributes go through `escapeAttr()`, visible text goes through `escapeHtml()`, and champion art URL path segments are encoded before they enter inline style attributes.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, Node source-extraction regression tests in `test-artifacts/main`, existing read-only smoke report and browser QA flow.

---

### Task 1: Capture The Stored Sample Switcher Regression

**Files:**
- Create: `test-artifacts/main/sample-switcher-escaping-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-sample-switcher-escaping.md`

- [x] **Step 1: Add the failing render test**

Create a source-extraction test that runs `renderSampleSwitcher()` with unsafe manifest fields:

```js
const unsafeId = 'sample-1"><img src=x onerror=alert(1)>';
const unsafeChampion = 'Ahri"><img src=x onerror=alert(1)>';
const unsafeAlias = 'Tester<script>alert(1)</script>';
const unsafeTheme = 'macro<script>alert(1)</script> plan';
```

Expected behavior after implementation:

- `data-sample-button` attributes in sample chips and report cards are escaped.
- Sample chip champion text, report card champion text, sample aliases, report card id label, result text, and manifest card summaries are escaped.
- Report card result `data-result` is escaped.
- Champion avatar markup does not place raw champion strings inside inline style attributes.
- Raw `<img`, `<svg`, `<script`, and `<b>` payloads do not appear in rendered switcher/report HTML.
- Existing Korean sample report label, role label, and result fallback behavior remain unchanged.

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/sample-switcher-escaping-tests.mjs
node test-artifacts/main/sample-switcher-escaping-tests.mjs
```

Expected result before implementation: syntax passes; runtime fails because `renderSampleSwitcher()` currently interpolates several manifest values directly.

Actual RED result:

- `node --check test-artifacts/main/sample-switcher-escaping-tests.mjs`: passed.
- `node test-artifacts/main/sample-switcher-escaping-tests.mjs`: `8 passed, 22 failed`.
- Failures covered champion art URL encoding, avatar inline style raw payload, sample/report `data-sample-button`, report `data-result`, sample aliases, manifest summary, raw `<img`/`<svg`/`<script` payloads, broken sample id attribute, and missing source-level escape calls.

### Task 2: Escape Stored Sample Switcher Dynamic Values

**Files:**
- Modify: `main.js`
- Test: `test-artifacts/main/sample-switcher-escaping-tests.mjs`

- [x] **Step 1: Encode champion art URL path segments**

In `championArtUrl(name)` and `championSquareUrl(name)`, encode the Data Dragon path segment:

```js
const key = encodeURIComponent(championAssetKey(name));
```

Keep known champion names rendering the same for ordinary asset keys.

- [x] **Step 2: Escape sample chip attributes and visible text**

In `renderSampleSwitcher()`, change sample chip values:

```js
data-sample-button="${escapeAttr(sample.id)}"
<em class="sample-chip__champion">${escapeHtml(championDisplayName(sample.champion))}</em>
<strong>${escapeHtml(sample.publicAlias || "")}</strong>
```

Keep `sampleReportLabel(sample)` escaped.

- [x] **Step 3: Escape report card attributes and visible text**

In the report strip template, escape:

```js
data-sample-button="${escapeAttr(sample.id)}"
<span class="meta-label">${escapeHtml(sample.id)}</span>
<span class="report-card__champion">${escapeHtml(championDisplayName(sample.champion))}</span>
data-result="${escapeAttr(meta.result)}"
${escapeHtml(resultText)}
<p>${escapeHtml(buildManifestCardSummary(sample))}</p>
<strong>${escapeHtml(sample.publicAlias || "")}</strong>
```

Keep `roleLabel(meta.role)` and `sampleReportLabel(sample)` escaped.

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/main/sample-switcher-escaping-tests.mjs
node test-artifacts/main/sample-metadata-label-tests.mjs
node test-artifacts/main/champion-history-escaping-tests.mjs
node --check main.js
node --check test-artifacts/main/sample-switcher-escaping-tests.mjs
```

Expected result after implementation: all focused checks pass and existing metadata/champion avatar contracts remain unchanged.

Actual GREEN result:

- `node test-artifacts/main/sample-switcher-escaping-tests.mjs`: `30 passed, 0 failed`.
- `node test-artifacts/main/sample-metadata-label-tests.mjs`: `22 passed, 0 failed`.
- `node test-artifacts/main/champion-history-escaping-tests.mjs`: `20 passed, 0 failed`.
- `node --check main.js`: passed.
- `node --check test-artifacts/main/sample-switcher-escaping-tests.mjs`: passed.

### Task 3: QA And Publish

**Files:**
- Read-only QA artifacts under `test-artifacts/tmp`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/sample-switcher-escaping-local npm run smoke:report:readonly
```

Expected result: all tests pass, whitespace diff check passes, smoke report passes with required checks complete, and sensitive-pattern scan over local artifacts returns no matches.

Actual local QA result:

- `npm test`: `2687 passed, 0 failed across 122 test file(s)`.
- `git diff --check`: passed.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/sample-switcher-escaping-local npm run smoke:report:readonly`: passed.
- Local smoke summary: `156 passed, 0 failed`; required checks `13 pass`.
- Local artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.

- [x] **Step 2: Run browser QA**

Open the readonly app through the in-app browser with a temporary copied `SAMPLES_DIR` manifest containing unsafe stored sample fields. Verify the home sample switcher and report strip render escaped text without raw dangerous nodes or console warn/error output.

Actual browser QA result:

- Temporary `SAMPLES_DIR=test-artifacts/tmp/sample-switcher-browser-samples` copied from `data/samples`.
- Invalid unsafe sample id fixture was rejected by the server with `SAMPLE_MANIFEST_INVALID`, so browser fixture kept a valid generated sample id and injected unsafe `label`, `champion`, `publicAlias`, and `theme` display fields.
- Readonly home opened successfully and stored-sample entry CTA rendered.
- Stored sample entry opened successfully.
- Sample switcher rendered 19 sample chips.
- Report strip rendered 6 report cards.
- Total `[data-sample-button]` controls after entry: 25.
- First sample button kept valid `data-sample-button="sample-kr-8242613150"`.
- Unsafe alias rendered as text in sample switcher and report strip.
- Escaped champion and escaped manifest summary were present in sample switcher/report HTML.
- Result fallback `결과 미상` rendered for unsafe result metadata.
- Sample switcher dangerous attributes: `[onerror]`, `[onclick]`, `[onload]` count `0`.
- Report strip dangerous attributes: `[onerror]`, `[onclick]`, `[onload]` count `0`.
- Sample switcher raw dangerous tags: `<img`, `<script`, `<svg` all false.
- Report strip raw dangerous tags: `<img`, `<script`, `<svg` all false.
- Avatar inline style encoded unsafe champion asset key as `Ahri%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E.png`; avatar `onerror` attribute false.
- Console warn/error log: `[]`.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/sample-switcher-escaping-tests.mjs docs/superpowers/plans/2026-06-09-sample-switcher-escaping.md
git commit -m "test: escape sample switcher content"
git push origin main
```

Actual implementation commit:

- Commit: `1075ebf test: escape sample switcher content`
- Push target: `origin/main`

- [x] **Step 4: Verify GitHub Actions artifact**

Watch the resulting `main` workflow run, download its `qa-automation-*` artifact, inspect `qa-summary.json`, and run the sensitive-string scan against the downloaded artifact.

Actual GitHub QA result:

- Run: `27205951679` (`QA`, `main`, commit `1075ebf4d8614b10f7595e8461306498bef798a3`)
- URL: `https://github.com/crisious/Web_LOL_Banpick/actions/runs/27205951679`
- Conclusion: success.
- Artifact: `qa-automation-27205951679`
- Artifact id: `7507499757`
- Artifact digest: `sha256:d3ee4cfcf92b52e4ba520563fd8ba4d7f93dda847cadb3070132175b50420801`
- `qa-summary.json latestRun.status`: `passed`.
- `qaVerdict.status`: `passed`.
- `exitCode`: `0`.
- `git.shortSha`: `1075ebf`; `dirty`: `false`.
- Smoke summary: `156 passed, 0 failed`.
- Required checks: `13 pass`.
- Artifact integrity: `passed`.
- Sample evidence: `passed`.
- Demo safety evidence: `passed`.
- Artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.

- [x] **Step 5: Record the cycle**

Update the repository plan and Obsidian project plan with RED/GREEN evidence, local QA, browser QA, GitHub run/artifact identifiers, and final sync status.

Repository plan record:

- Final docs commit: `ec048d0 docs: finalize sample switcher escaping plan`
- Final docs QA run: `27206028000`
- Final docs QA URL: `https://github.com/crisious/Web_LOL_Banpick/actions/runs/27206028000`
- Final docs artifact: `qa-automation-27206028000`
- Final docs artifact id: `7507531666`
- Final docs artifact digest: `sha256:150f9de2b5cd5cf3b6882082b5507f6d1d2a49857bbc41187c8bf887718cc6b5`
- Final docs artifact summary: `latestRun.status=passed`, `qaVerdict=passed`, `exitCode=0`, `shortSha=ec048d0`, `dirty=false`, smoke `156 passed / 0 failed`, required checks `13 pass`, artifact integrity `passed`, sample evidence `passed`, demo safety `passed`.
- Final docs artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.
