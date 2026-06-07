# Healthz Demo Mode Validity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/healthz` explicitly report whether the configured public demo mode is valid.

**Architecture:** Keep existing `/healthz` compatibility fields (`publicDemoMode`, `readonly`, `protected`) and add a derived `publicDemoModeValid` boolean. Put the derivation in a small helper beside the demo mode gate helpers so tests can validate known and unknown modes without starting the HTTP server.

**Tech Stack:** Node.js server, existing extraction-style server tests, README/runbook docs, GitHub Actions QA.

---

### Task 1: Add Healthz Diagnostic Regression Coverage

**Files:**
- Modify: `test-artifacts/server/public-demo-mode-gate-tests.mjs`
- Modify later: `server.js`

- [x] **Step 1: Write the failing test**

Extend the test harness to extract `publicDemoModeHealth()` and assert:

```js
const invalidModeGate = makeGate({ publicDemoMode: "readnoly", publicDemoToken: "" });
check("unknown demo mode health marks mode invalid",
  invalidModeGate.publicDemoModeHealth().publicDemoModeValid,
  false);
check("unknown demo mode health preserves raw configured mode",
  invalidModeGate.publicDemoModeHealth().publicDemoMode,
  "readnoly");
```

Also assert that `readonly`, `protected`, and `full` modes report `publicDemoModeValid: true`.

- [x] **Step 2: Run the test to verify RED**

Run: `node test-artifacts/server/public-demo-mode-gate-tests.mjs`

Expected: failure because `server.js` does not yet define `publicDemoModeHealth`.

Observed: focused RED reported `0 passed, 1 failed` with `function publicDemoModeHealth not found`.

### Task 2: Implement Healthz Validity Field

**Files:**
- Modify: `server.js`
- Test: `test-artifacts/server/public-demo-mode-gate-tests.mjs`

- [x] **Step 1: Add the helper**

Add this helper near the existing public demo mode helpers:

```js
function publicDemoModeHealth() {
  return {
    publicDemoMode,
    publicDemoModeValid: !isInvalidDemoMode(),
    readonly: isReadOnlyDemoMode(),
    protected: isProtectedDemoMode(),
  };
}
```

- [x] **Step 2: Wire `/healthz`**

Replace the individual mode fields in the `/healthz` response with the helper spread:

```js
sendJson(res, 200, {
  ok: true,
  service: "lol-replay-coach",
  ...publicDemoModeHealth(),
  timestamp: new Date().toISOString(),
});
```

- [x] **Step 3: Run focused GREEN**

Run: `node test-artifacts/server/public-demo-mode-gate-tests.mjs`

Expected: all checks pass.

Observed: `node test-artifacts/server/public-demo-mode-gate-tests.mjs` reported `25 passed, 0 failed`.

### Task 3: Document and Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: this plan file
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document the healthz field**

Update docs to state that `/healthz` includes `publicDemoModeValid` and that operators should treat `false` as a deployment misconfiguration requiring correction before protected/full testing.

- [x] **Step 2: Run local QA**

Run:

```bash
node --check server.js
node test-artifacts/server/public-demo-mode-gate-tests.mjs
npm test
git diff --check
```

Expected: focused test passes and the full suite reports zero failures.

Observed: `node --check server.js && node test-artifacts/server/public-demo-mode-gate-tests.mjs && npm test && git diff --check` exited 0. Focused gate tests reported `25 passed, 0 failed`; the full suite reported `699 passed, 0 failed across 25 test file(s)`.

- [x] **Step 3: Commit and push implementation**

Run:

```bash
git add server.js test-artifacts/server/public-demo-mode-gate-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-healthz-demo-mode-validity.md
git commit -m "feat: report demo mode validity in healthz"
git push origin main
```

Observed: committed and pushed `d072154 feat: report demo mode validity in healthz` to `origin/main`.

- [x] **Step 4: Verify remote QA artifact**

Run:

```bash
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
gh run download <run-id> -n qa-automation-<run-id> -D <tmp-dir>
```

Expected: run conclusion `success`, artifact contains `qa-summary.json`, and the read-only smoke summary is `150 passed / 0 failed` with no sensitive token/header matches.

Observed: GitHub Actions QA run `27104288253` completed with conclusion `success` for head SHA `d072154528ed5dbf71ff300d6657343450d69227`. Artifact `qa-automation-27104288253` / id `7467813686` downloaded to `/tmp/lol-ai-coach-healthz-mode.Upg3lA`; `qa-summary.json` recorded read-only smoke `150 passed / 0 failed`, and the sensitive scan returned no matches.
