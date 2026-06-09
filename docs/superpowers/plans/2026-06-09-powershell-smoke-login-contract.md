# PowerShell Smoke Login Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `scripts/qa-smoke.ps1` verify the current read-only login surface instead of a stale `Replay Coach Dashboard` heading.

**Architecture:** Keep the PowerShell smoke structure and Chrome DOM dump flow unchanged. Add a source regression test that rejects stale dashboard-era assertions and requires the current localized login signals, then update only the DOM assertion strings in `qa-smoke.ps1`.

**Tech Stack:** PowerShell smoke script, static HTML, Node.js source/string regression tests in `test-artifacts/main`, existing local smoke/GitHub QA flow.

---

### Task 1: Add RED Coverage For The PowerShell Smoke Login Contract

**Files:**
- Create: `test-artifacts/main/qa-smoke-login-contract-tests.mjs`
- Modify: `docs/superpowers/plans/2026-06-09-powershell-smoke-login-contract.md`

- [x] **Step 1: Add the failing smoke contract test**

Create `test-artifacts/main/qa-smoke-login-contract-tests.mjs`:

```js
// PowerShell smoke first-screen contract regression tests.
//
// qa-smoke.ps1 should verify the current read-only login surface. It should not
// keep stale layout-era headings that no longer exist in index.html.

import fs from "fs";

const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const qaSmokeSrc = fs.readFileSync(new URL("../../scripts/qa-smoke.ps1", import.meta.url), "utf8");

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

checkTrue("index no longer has stale dashboard heading", !indexSrc.includes("Replay Coach Dashboard"));
checkTrue("PowerShell smoke no longer expects stale dashboard heading", !qaSmokeSrc.includes("Replay Coach Dashboard"));
checkTrue("PowerShell smoke checks localized login eyebrow", qaSmokeSrc.includes("리플레이 리뷰"));
checkTrue("PowerShell smoke checks stored sample entry CTA", qaSmokeSrc.includes("저장 샘플 열기"));
checkTrue("PowerShell smoke still checks localized title", qaSmokeSrc.includes("<title>LoL 리플레이 코치 리포트</title>"));
checkTrue("PowerShell smoke still checks product name", qaSmokeSrc.includes("LoL Replay Coach"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node --check test-artifacts/main/qa-smoke-login-contract-tests.mjs
node test-artifacts/main/qa-smoke-login-contract-tests.mjs
```

Observed: syntax passed; runtime failed as expected with `3 passed, 3 failed` because `scripts/qa-smoke.ps1` still expects `Replay Coach Dashboard` and does not yet assert the localized login eyebrow or stored sample CTA.

### Task 2: Update `qa-smoke.ps1` First-Screen Assertions

**Files:**
- Modify: `scripts/qa-smoke.ps1`

- [x] **Step 1: Replace the stale dashboard assertion**

In `scripts/qa-smoke.ps1`, replace:

```powershell
Assert-Condition ($dom -match "Replay Coach Dashboard") "DOM dump is missing the dashboard heading."
```

with:

```powershell
Assert-Condition ($dom -match "리플레이 리뷰") "DOM dump is missing the localized login eyebrow."
Assert-Condition ($dom -match "저장 샘플 열기") "DOM dump is missing the stored sample entry action."
```

Keep the localized title and `LoL Replay Coach` product-name assertions unchanged.

### Task 3: GREEN And Regression QA

**Files:**
- Verify: `scripts/qa-smoke.ps1`
- Verify: `test-artifacts/main/qa-smoke-login-contract-tests.mjs`

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check test-artifacts/main/qa-smoke-login-contract-tests.mjs
node test-artifacts/main/qa-smoke-login-contract-tests.mjs
node test-artifacts/main/login-entry-label-tests.mjs
node test-artifacts/main/overview-metric-label-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Observed: syntax check and focused smoke/login/demo checks passed: `qa-smoke-login-contract-tests` 6/0, `login-entry-label-tests` 8/0, `overview-metric-label-tests` 7/0, `demo-mode-ui-tests` 16/0.

- [x] **Step 2: Run full local QA**

Run:

```bash
npm test
git diff --check
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/powershell-smoke-login-contract-local npm run smoke:report:readonly
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/powershell-smoke-login-contract-local
```

Observed: `npm test` passed with `2401 passed, 0 failed across 109 test file(s)`; `git diff --check` passed; read-only smoke report passed with `156 passed, 0 failed` and required checks `13 passed / 0 failed / 0 missing`; sensitive scan exited with no matches.

### Task 4: Commit, Push, GitHub QA, And Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-powershell-smoke-login-contract.md`
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Commit and push implementation**

Run:

```bash
git add scripts/qa-smoke.ps1 test-artifacts/main/qa-smoke-login-contract-tests.mjs docs/superpowers/plans/2026-06-09-powershell-smoke-login-contract.md
git commit -m "test: align powershell smoke login contract"
git push origin main
```

Observed: committed and pushed `7d142ba test: align powershell smoke login contract` to `main`.

- [x] **Step 2: Verify GitHub QA artifact**

Use `gh run watch`, artifact listing, artifact download, `qa-summary.json`, and sensitive pattern scan. Confirm the pushed short SHA, `dirty: false`, smoke `156 passed / 0 failed`, required checks total 13 / passed 13 / failed 0 / missing 0.

Observed: GitHub QA run `27194712115` passed for `7d142ba`; artifact `7502801987` (`qa-automation-27194712115`) downloaded successfully; `qa-summary.json` reported `dirty: false`, smoke `156 passed / 0 failed`, required checks `13 passed / 0 failed / 0 missing`, artifact integrity `passed`, QA verdict `passed`; sensitive scan exited with no matches.

- [ ] **Step 3: Update Obsidian and final sync**

Record RED/GREEN/full QA, local smoke, GitHub run/artifact, sensitive scan, and final sync evidence in Obsidian. Then run:

```bash
rm -rf test-artifacts/tmp
git fetch origin --prune
git merge --ff-only origin/main
git rev-list --left-right --count main...origin/main
git status --short --branch
```

Expected: `main...origin/main` is `0 0` and the working tree is clean.

### Self-Review

- Spec coverage: The plan removes the stale `Replay Coach Dashboard` assertion and replaces it with current login surface checks.
- Placeholder scan: No `TBD`, `TODO`, "implement later", or unresolved placeholder steps remain.
- Type consistency: The change is limited to PowerShell smoke assertion strings and a Node source regression test.
