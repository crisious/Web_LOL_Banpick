# Smoke Healthz Mode Validity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make external smoke fail fast when `/healthz` reports `publicDemoModeValid: false`.

**Architecture:** Keep the existing `publicDemoMode` / legacy boolean mode detection, then add a separate explicit validity check immediately after `/healthz ok=true`. This preserves compatibility for servers that do not yet expose `publicDemoModeValid` while using the new field as a stronger diagnostic when present.

**Tech Stack:** Node.js smoke CLI, zero-dependency test harness, README/runbook docs, GitHub Actions QA.

---

### Task 1: Add Smoke Regression Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify later: `scripts/external-demo-smoke.mjs`

- [x] **Step 1: Write the failing test**

Add a fake server case where `/healthz` returns:

```js
{ ok: true, publicDemoMode: "readonly", publicDemoModeValid: false }
```

The smoke CLI should exit non-zero, print `FAIL public demo mode config is valid`, and stop before live/write probes.

- [x] **Step 2: Run the test to verify RED**

Run: `node test-artifacts/scripts/external-demo-smoke-tests.mjs`

Expected: failure because the current smoke CLI does not inspect `publicDemoModeValid`.

Observed: focused RED reported `100 passed, 3 failed`. The new failures showed that the CLI exited 0, did not print `FAIL public demo mode config is valid`, and continued from `/healthz` to `/api/samples`.

### Task 2: Implement Smoke Validity Check

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Test: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Add the check after healthz ok**

After:

```js
expectFatal(health.body?.ok === true, "healthz ok=true");
```

add:

```js
if (health.body?.publicDemoModeValid === false) {
  fatal("public demo mode config is valid", `publicDemoMode=${health.body?.publicDemoMode || "(missing)"}`);
}
```

Do not require the field when it is absent, so old local servers remain compatible during transition.

- [x] **Step 2: Run focused GREEN**

Run: `node test-artifacts/scripts/external-demo-smoke-tests.mjs`

Expected: all external smoke CLI tests pass.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` reported `103 passed, 0 failed`.

### Task 3: Document and Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: this plan file
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document smoke behavior**

Update docs to state that smoke treats `publicDemoModeValid: false` as a fatal preflight failure before live/write probes.

- [x] **Step 2: Run local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs
node test-artifacts/scripts/external-demo-smoke-tests.mjs
npm test
git diff --check
```

Expected: focused smoke tests pass and the full suite reports zero failures.

Observed: `node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check` exited 0. Focused smoke tests reported `103 passed, 0 failed`; the full suite reported `702 passed, 0 failed across 25 test file(s)`.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-healthz-mode-validity.md
git commit -m "ci: validate healthz demo mode in smoke"
git push origin main
```

Observed: committed and pushed `be98d0d ci: validate healthz demo mode in smoke` to `origin/main`.

- [x] **Step 4: Verify remote QA artifact**

Run:

```bash
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
gh run download <run-id> -n qa-automation-<run-id> -D <tmp-dir>
```

Expected: run conclusion `success`, artifact contains `qa-summary.json`, and the read-only smoke summary is `150 passed / 0 failed` with no sensitive token/header matches.

Observed: GitHub Actions QA run `27104451579` completed with conclusion `success` for head SHA `be98d0dae55d46af43c8884bf633a46ccb34f3cf`. Artifact `qa-automation-27104451579` / id `7467861662` downloaded to `/tmp/lol-ai-coach-smoke-healthz-validity.60NlbJ`; `qa-summary.json` recorded read-only smoke `150 passed / 0 failed`, and the sensitive scan returned no matches.
