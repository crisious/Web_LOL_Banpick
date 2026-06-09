# Overview Metric Label Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining English overview metric labels `Queue`, `Patch`, and `Mastery` with Korean visible labels.

**Architecture:** Keep data attributes, metric layout, and dynamic values unchanged. Add one static HTML regression test, then update only the visible `meta-label` text in the overview metric strip.

**Tech Stack:** Vanilla HTML frontend, Node.js source/string regression tests in `test-artifacts/main`, existing local smoke/GitHub QA flow.

---

### Task 1: Add RED Coverage For Overview Metric Labels

**Files:**
- Create: `test-artifacts/main/overview-metric-label-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-overview-metric-label-localization.md`

- [x] **Step 1: Add the failing overview metric label test**

Create `test-artifacts/main/overview-metric-label-tests.mjs`:

```js
// Overview metric visible label regression tests.
//
// The detail overview metric strip is Korean-first UI. Queue, patch, and
// mastery are domain concepts, but the visible labels should not remain as
// English scaffolding.

import fs from "fs";

const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

checkTrue("overview queue label localized", indexSrc.includes('<span class="meta-label">큐</span>'));
checkTrue("overview patch label localized", indexSrc.includes('<span class="meta-label">패치</span>'));
checkTrue("overview mastery label localized", indexSrc.includes('<span class="meta-label">숙련도</span>'));
checkTrue("overview cs per minute label remains Korean", indexSrc.includes('<span class="meta-label">CS/분</span>'));

checkTrue("overview raw Queue label removed", !indexSrc.includes(">Queue<"));
checkTrue("overview raw Patch label removed", !indexSrc.includes(">Patch<"));
checkTrue("overview raw Mastery label removed", !indexSrc.includes(">Mastery<"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/overview-metric-label-tests.mjs
node test-artifacts/main/overview-metric-label-tests.mjs
```

Expected: syntax passes; runtime fails because `큐`, `패치`, and `숙련도` are not present and `Queue`, `Patch`, and `Mastery` still exist.

Result 2026-06-09: `node --check test-artifacts/main/overview-metric-label-tests.mjs` passed, and `node test-artifacts/main/overview-metric-label-tests.mjs` failed with `1 passed, 6 failed`, confirming `Queue`, `Patch`, and `Mastery` still existed while the Korean labels were missing.

### Task 2: Localize Overview Metric Labels

**Files:**
- Modify: `index.html`

- [x] **Step 1: Replace visible overview labels**

In `index.html`, replace:

```html
<span class="meta-label">Queue</span>
<span class="meta-label">Patch</span>
<span class="meta-label">Mastery</span>
```

with:

```html
<span class="meta-label">큐</span>
<span class="meta-label">패치</span>
<span class="meta-label">숙련도</span>
```

Leave `data-snapshot-queue`, `data-snapshot-patch`, and `data-snapshot-mastery` unchanged.

Result 2026-06-09: `index.html` visible overview labels were changed to `큐`, `패치`, and `숙련도`; the `data-snapshot-*` attributes were left unchanged.

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `index.html`
- Verify: `test-artifacts/main/overview-metric-label-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check test-artifacts/main/overview-metric-label-tests.mjs
node test-artifacts/main/overview-metric-label-tests.mjs
node test-artifacts/main/trend-report-label-tests.mjs
node test-artifacts/main/sample-metadata-label-tests.mjs
node test-artifacts/main/key-moment-phase-label-tests.mjs
node test-artifacts/main/phase-card-label-tests.mjs
node test-artifacts/main/utils-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected: all focused frontend label and utility checks pass.

Result 2026-06-09: Focused checks passed: overview metric label `7 passed / 0 failed`, trend/report label `18 passed / 0 failed`, sample metadata label `22 passed / 0 failed`, key moment phase label `12 passed / 0 failed`, phase card label `12 passed / 0 failed`, main utils `38 passed / 0 failed`, demo mode UI `16 passed / 0 failed`.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/overview-metric-label-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/overview-metric-label-local
```

Expected: full suite and read-only smoke pass; sensitive scan exits with no matches.

Result 2026-06-09:
- `npm test`: 2387 passed, 0 failed across 107 test file(s).
- `git diff --check`: passed.
- `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/overview-metric-label-local npm run smoke:report:readonly`: passed, smoke 156 passed / 0 failed, required checks 13 passed / 0 failed / 0 missing.
- Sensitive scan over `test-artifacts/tmp/overview-metric-label-local`: no matches.

### Task 4: Commit, Push, GitHub QA, Browser QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-overview-metric-label-localization.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add index.html test-artifacts/main/overview-metric-label-tests.mjs docs/superpowers/plans/2026-06-09-overview-metric-label-localization.md
git commit -m "test: localize overview metric labels"
git push origin main
```

Result 2026-06-09: Implementation commit `074d47c` (`test: localize overview metric labels`) was pushed to `main`.

- [x] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

Result 2026-06-09: GitHub QA run `27193561933` completed successfully for `074d47c`. Downloaded artifact `qa-automation-27193561933` reported `status: passed`, `exitCode: 0`, `dirty: false`, smoke `156 passed / 0 failed`, required checks `13/13`, artifact integrity `passed`, and QA verdict `passed/shareable`. Sensitive scan over the downloaded artifact produced no matches.

- [x] **Step 3: Run Browser QA**

Open the read-only local app at `http://127.0.0.1:8123/`, open stored samples, inspect the overview metric strip, and confirm `큐`, `패치`, `숙련도`, and `CS/분` appear while visible raw labels `Queue`, `Patch`, and `Mastery` do not. Confirm console warn/error logs are empty.

Result 2026-06-09: Browser QA opened `http://127.0.0.1:8123/?qa=overview-metric-label`, loaded stored samples, selected the `개요` tab, and confirmed the overview metric strip showed `큐`, `패치`, `숙련도`, and `CS/분`. Scoped raw label checks for `Queue`, `Patch`, and `Mastery` returned empty, no framework overlay was detected, screenshot evidence showed the localized metric strip, and console warn/error logs were `0`.

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

- Spec coverage: The plan covers the static overview metric labels that are still visible in English.
- Placeholder scan: No `TBD`, `TODO`, "implement later", or unresolved placeholder steps remain.
- Type consistency: The change is display-only and leaves data attributes and dynamic metric values untouched.
