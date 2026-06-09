# Login Entry Label Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize the first-entry browser title and login eyebrow while keeping `LoL Replay Coach` as the stable product name.

**Architecture:** Keep the H1 product name, login flow, forms, API calls, and data attributes unchanged. Add a source regression test for `index.html` and the legacy PowerShell smoke title expectation, then update only the display strings.

**Tech Stack:** Static HTML, PowerShell smoke script, Node.js source/string regression tests in `test-artifacts/main`, existing local smoke/GitHub QA flow.

---

### Task 1: Add RED Coverage For Login Entry Labels

**Files:**
- Create: `test-artifacts/main/login-entry-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-login-entry-label-localization.md`

- [x] **Step 1: Add the failing login entry label test**

Create `test-artifacts/main/login-entry-label-tests.mjs`:

```js
// Login entry visible label regression tests.
//
// The first viewport should be Korean-first except for the stable product name.
// Keep the H1 app name as the brand signal, but localize the browser title and
// the small login eyebrow label.

import fs from "fs";

const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const qaSmokeSrc = fs.readFileSync(new URL("../../scripts/qa-smoke.ps1", import.meta.url), "utf8");

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

checkTrue("browser title is localized", indexSrc.includes("<title>LoL 리플레이 코치 리포트</title>"));
checkTrue("login eyebrow is localized", indexSrc.includes('<span class="login-eyebrow">리플레이 리뷰</span>'));
checkTrue("login H1 keeps product name", indexSrc.includes('<h1 class="login-title" id="login-title">LoL Replay Coach</h1>'));

checkTrue("raw browser title removed", !indexSrc.includes("<title>LoL Replay Coach Report</title>"));
checkTrue("raw login eyebrow removed", !indexSrc.includes(">Replay Review<"));

checkTrue("PowerShell smoke expects localized browser title", qaSmokeSrc.includes("<title>LoL 리플레이 코치 리포트</title>"));
checkTrue("PowerShell smoke no longer expects raw browser title", !qaSmokeSrc.includes("<title>LoL Replay Coach Report</title>"));
checkTrue("PowerShell smoke still checks product name", qaSmokeSrc.includes("LoL Replay Coach"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/login-entry-label-tests.mjs
node test-artifacts/main/login-entry-label-tests.mjs
```

Expected: syntax passes; runtime fails because the localized title/eyebrow are missing and the PowerShell smoke still expects `<title>LoL Replay Coach Report</title>`.

Result 2026-06-09: `node --check test-artifacts/main/login-entry-label-tests.mjs` passed, and `node test-artifacts/main/login-entry-label-tests.mjs` failed with `2 passed, 6 failed`, confirming the localized title/eyebrow were missing and `scripts/qa-smoke.ps1` still expected the raw browser title.

### Task 2: Localize Login Entry Labels

**Files:**
- Modify: `index.html`
- Modify: `scripts/qa-smoke.ps1`

- [x] **Step 1: Localize the browser title**

In `index.html`, replace:

```html
<title>LoL Replay Coach Report</title>
```

with:

```html
<title>LoL 리플레이 코치 리포트</title>
```

Result 2026-06-09: `index.html` browser title now uses `LoL 리플레이 코치 리포트`.

- [x] **Step 2: Localize the login eyebrow**

In `index.html`, replace:

```html
<span class="login-eyebrow">Replay Review</span>
```

with:

```html
<span class="login-eyebrow">리플레이 리뷰</span>
```

Leave the `LoL Replay Coach` H1 unchanged.

Result 2026-06-09: `index.html` login eyebrow now uses `리플레이 리뷰`, and the `LoL Replay Coach` H1 remains unchanged.

- [x] **Step 3: Update the PowerShell smoke title expectation**

In `scripts/qa-smoke.ps1`, replace both exact title expectations:

```powershell
<title>LoL Replay Coach Report</title>
```

with:

```powershell
<title>LoL 리플레이 코치 리포트</title>
```

Leave the separate product-name assertion for `LoL Replay Coach` unchanged.

Result 2026-06-09: Both exact title expectations in `scripts/qa-smoke.ps1` now use `<title>LoL 리플레이 코치 리포트</title>`, while the product-name assertion for `LoL Replay Coach` remains unchanged.

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `index.html`
- Verify: `scripts/qa-smoke.ps1`
- Verify: `test-artifacts/main/login-entry-label-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check test-artifacts/main/login-entry-label-tests.mjs
node test-artifacts/main/login-entry-label-tests.mjs
node test-artifacts/main/overview-metric-label-tests.mjs
node test-artifacts/main/trend-report-label-tests.mjs
node test-artifacts/main/sample-metadata-label-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all focused frontend label and demo checks pass.

Result 2026-06-09: Focused checks passed: login entry label `8 passed / 0 failed`, overview metric label `7 passed / 0 failed`, trend/report label `18 passed / 0 failed`, sample metadata label `22 passed / 0 failed`, demo mode UI `16 passed / 0 failed`.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/login-entry-label-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/login-entry-label-local
```

Expected: full suite and read-only smoke pass; sensitive scan exits with no matches.

Result 2026-06-09:
- `npm test`: 2395 passed, 0 failed across 108 test file(s).
- `git diff --check`: passed.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/login-entry-label-local npm run smoke:report:readonly`: passed, smoke 156 passed / 0 failed, required checks 13 passed / 0 failed / 0 missing.
- Sensitive scan over `test-artifacts/tmp/login-entry-label-local`: no matches.

### Task 4: Commit, Push, GitHub QA, Browser QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-login-entry-label-localization.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add index.html scripts/qa-smoke.ps1 test-artifacts/main/login-entry-label-tests.mjs docs/superpowers/plans/2026-06-09-login-entry-label-localization.md
git commit -m "test: localize login entry labels"
git push origin main
```

Result 2026-06-09: Implementation commit `cdc7206` (`test: localize login entry labels`) was pushed to `main`.

- [x] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

Result 2026-06-09: GitHub QA run `27194175249` completed successfully for `cdc7206`. Downloaded artifact `qa-automation-27194175249` reported `status: passed`, `exitCode: 0`, `dirty: false`, smoke `156 passed / 0 failed`, required checks `13/13`, artifact integrity `passed`, and QA verdict `passed/shareable`. Sensitive scan over the downloaded artifact produced no matches.

- [x] **Step 3: Run Browser QA**

Open the read-only local app at `http://127.0.0.1:8123/`, inspect the login surface before opening stored samples, and confirm the browser title is `LoL 리플레이 코치 리포트`, the eyebrow is `리플레이 리뷰`, the H1 remains `LoL Replay Coach`, raw `Replay Review` and raw `LoL Replay Coach Report` are not visible, no framework overlay is shown, and console warn/error logs are empty.

Result 2026-06-09: Browser QA opened `http://127.0.0.1:8123/?qa=login-entry-label` and confirmed `document.title` was `LoL 리플레이 코치 리포트`, the login overlay was visible, `리플레이 리뷰` and `LoL Replay Coach` were present, raw `Replay Review` and `LoL Replay Coach Report` were absent, no framework overlay was detected, and console warn/error logs were `0`. Interaction proof: `저장 샘플 열기` resolved to one enabled button, clicking it changed `body[data-view]` to `DETAIL_VIEW` and showed the stored sample list while preserving the localized title.

- [ ] **Step 4: Update Obsidian and final sync**

Record RED/GREEN/full QA, local smoke, GitHub run/artifact, Browser QA, sensitive scan, and final sync evidence in Obsidian. Then run:

```bash
rm -rf test-artifacts/tmp
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
git status --short --branch
```

Expected: `main...origin/main` is `0 0` and the working tree is clean.

### Self-Review

- Spec coverage: The plan covers the browser title, login eyebrow, and matching legacy PowerShell smoke expectation while preserving the product-name H1.
- Placeholder scan: No `TBD`, `TODO`, "implement later", or unresolved placeholder steps remain.
- Type consistency: This is a display-only text change and leaves form fields, data attributes, and runtime flow unchanged.
