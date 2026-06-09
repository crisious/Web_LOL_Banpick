# Candidate Row Escaping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent live recent-match candidate rows from rendering raw HTML when Riot-derived match identifiers or display fields contain unsafe strings.

**Architecture:** Keep the `renderCandidates(matches)` layout and click contracts unchanged. Treat the candidate row template as a display boundary: data attributes go through `escapeAttr()`, visible dynamic text goes through `escapeHtml()`, and existing label helpers remain responsible for Korean/fallback labels.

**Tech Stack:** Vanilla JavaScript frontend in `main.js`, Node source-extraction regression tests in `test-artifacts/main`, existing read-only smoke report and browser QA flow.

---

### Task 1: Capture The Candidate Row Escaping Regression

**Files:**
- Create: `test-artifacts/main/candidate-row-escaping-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-09-candidate-row-escaping.md`

- [x] **Step 1: Add the failing render test**

Create a source-extraction test that runs `renderCandidates()` with unsafe match fields:

```js
const unsafeMatchId = 'KR_1"><img src=x onerror=alert(1)>';
const unsafeResult = 'WIN"><svg onload=alert(1)>';
const unsafeChampion = 'Ahri"><img src=x onerror=alert(1)>';
```

Expected behavior after implementation:

- `data-generate-match` and both `data-result` attributes are escaped.
- Candidate champion, queue, patch, duration, KDA, and summary text are escaped.
- Raw `<img`, `<svg`, `<script`, and `<b>` payloads do not appear in rendered candidate HTML.
- Existing role localization and safe result fallback still render.

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/candidate-row-escaping-tests.mjs
node test-artifacts/main/candidate-row-escaping-tests.mjs
```

Expected result before implementation: syntax passes; runtime fails because the candidate row template currently interpolates several live match fields directly.

Actual RED result:

- `node --check test-artifacts/main/candidate-row-escaping-tests.mjs`: passed.
- `node test-artifacts/main/candidate-row-escaping-tests.mjs`: `3 passed, 22 failed`.
- Failures covered `data-generate-match`, row/result `data-result`, queue type, patch label, KDA, duration, card summary, raw `<img`/`<svg`/`<script`/`<b>` payloads, and missing source-level escape calls.

### Task 2: Escape Candidate Row Dynamic Values

**Files:**
- Modify: `main.js`
- Test: `test-artifacts/main/candidate-row-escaping-tests.mjs`

- [x] **Step 1: Escape row attributes**

In `renderCandidates(matches)`, change the row attributes:

```js
data-generate-match="${escapeAttr(match.matchId)}"
data-result="${escapeAttr(match.result)}"
```

Also escape the result pill `data-result` attribute.

- [x] **Step 2: Escape visible candidate text**

In `renderCandidates(matches)`, wrap visible dynamic values:

```js
${escapeHtml(championDisplayName(match.champion))}
${escapeHtml(compactQueueLabel(match.queueType) || "")}
${escapeHtml(matchPatchLabel(match.gameVersion) || "")}
${escapeHtml(`${match.kills}/${match.deaths}/${match.assists}`)}
${escapeHtml(match.durationLabel || "")}
${escapeHtml(buildCandidateCardSummary(match))}
${escapeHtml(resultLabel(match.result))}
```

Keep `roleLabel(match.role)` escaped as it is.

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/main/candidate-row-escaping-tests.mjs
node test-artifacts/main/sample-metadata-label-tests.mjs
node test-artifacts/main/recent-breakdown-escaping-tests.mjs
node --check main.js
node --check test-artifacts/main/candidate-row-escaping-tests.mjs
```

Expected result after implementation: all focused checks pass and existing sample metadata plus recent breakdown contracts remain unchanged.

Actual GREEN result:

- `node test-artifacts/main/candidate-row-escaping-tests.mjs`: `25 passed, 0 failed`.
- `node test-artifacts/main/sample-metadata-label-tests.mjs`: `22 passed, 0 failed`.
- `node test-artifacts/main/recent-breakdown-escaping-tests.mjs`: `18 passed, 0 failed`.
- `node --check main.js`: passed.
- `node --check test-artifacts/main/candidate-row-escaping-tests.mjs`: passed.

### Task 3: QA And Publish

**Files:**
- Read-only QA artifacts under `test-artifacts/tmp`
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/candidate-row-escaping-local npm run smoke:report:readonly
```

Expected result: all tests pass, whitespace diff check passes, smoke report passes with required checks complete, and sensitive-pattern scan over local artifacts returns no matches.

Actual local QA result:

- `npm test`: `2657 passed, 0 failed across 121 test file(s)`.
- `git diff --check`: passed.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/candidate-row-escaping-local npm run smoke:report:readonly`: passed.
- Local smoke summary: `156 passed, 0 failed`; required checks `13 pass`.
- Local artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.

- [x] **Step 2: Run browser QA**

Open the readonly app through the in-app browser, verify the stored-sample entry flow still renders the home and sample UI without console warn/error output, and confirm readonly live candidate generation remains locked.

Actual browser QA result:

- Readonly home opened successfully.
- Live recent-match submit stayed disabled.
- Candidate list container exists and has zero live candidate rows in readonly mode.
- Candidate list dangerous nodes: `img=0`, `script=0`, `svg=0`, inline handlers `0`.
- Candidate list raw dangerous markup scan: false for `<script`, `<svg`, `<img`, `onerror=`, `onclick=`, `onload=`.
- Stored sample entry opened successfully.
- Stored sample switcher rendered 19 buttons and tab bar rendered.
- Stored sample UI dangerous nodes: `script=0`, `svg=0`, inline handlers `0`.
- Stored sample UI raw dangerous markup scan: false for `<script`, `<svg`, `onerror=`, `onclick=`, `onload=`.
- Console warn/error log: `[]`.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add main.js test-artifacts/main/candidate-row-escaping-tests.mjs docs/superpowers/plans/2026-06-09-candidate-row-escaping.md
git commit -m "test: escape candidate row content"
git push origin main
```

Actual implementation commit:

- Commit: `0af0293 test: escape candidate row content`
- Push target: `origin/main`

- [x] **Step 4: Verify GitHub Actions artifact**

Watch the resulting `main` workflow run, download its `qa-automation-*` artifact, inspect `qa-summary.json`, and run the sensitive-string scan against the downloaded artifact.

Actual GitHub QA result:

- Run: `27204402627` (`QA`, `main`, commit `0af029349cc2eed6c5427445edb62a91c0da4a05`)
- URL: `https://github.com/crisious/Web_LOL_Banpick/actions/runs/27204402627`
- Conclusion: success.
- Artifact: `qa-automation-27204402627`
- Artifact id: `7506832219`
- Artifact digest: `sha256:10b7d73dcb930440cc343f5ab52202b7891eb863246f57956443875c4f61ced7`
- `qa-summary.json latestRun.status`: `passed`.
- `qaVerdict.status`: `passed`.
- `exitCode`: `0`.
- `git.shortSha`: `0af0293`; `dirty`: `false`.
- Smoke summary: `156 passed, 0 failed`.
- Required checks: `13 pass`.
- Artifact integrity: `passed`.
- Sample evidence: `passed`.
- Demo safety evidence: `passed`.
- Artifact sensitive scan: no `RGAPI`, `api_key`, `RIOT_API_KEY`, `Authorization`, `Bearer`, Riot host, `/lol/`, live Riot, or sample-generation matches.

- [ ] **Step 5: Record the cycle**

Update the repository plan and Obsidian project plan with RED/GREEN evidence, local QA, browser QA, GitHub run/artifact identifiers, and final sync status.
