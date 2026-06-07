# Invalid Demo Mode Fail-Closed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent misspelled or unknown `PUBLIC_DEMO_MODE` values from silently enabling live/write APIs.

**Architecture:** Add a small server-side demo-mode validation helper beside the existing read-only/protected helpers. Keep `/healthz` reporting the raw configured mode for diagnostics, but make `requireLiveApiAccess()` fail closed before protected/full logic when the mode is not one of `full`, `readonly`, or `protected`.

**Tech Stack:** Node.js server, existing function-extraction test pattern under `test-artifacts/server`, npm test runner, GitHub Actions QA.

---

### Task 1: Add a Server Gate Regression Test

**Files:**
- Create: `test-artifacts/server/public-demo-mode-gate-tests.mjs`
- Modify later: `server.js`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/public-demo-mode-gate-tests.mjs` with extraction helpers matching the existing server tests. Include this core assertion:

```js
const invalidModeGate = makeGate({ publicDemoMode: "readnoly", publicDemoToken: "" });
const invalidModeRes = makeResponseRecorder();
check("unknown demo mode blocks live API access",
  invalidModeGate.requireLiveApiAccess({ headers: {} }, invalidModeRes),
  false);
check("unknown demo mode returns stable code",
  invalidModeRes.body.code,
  "PUBLIC_DEMO_MODE_INVALID");
```

- [x] **Step 2: Run the test to verify RED**

Run: `node test-artifacts/server/public-demo-mode-gate-tests.mjs`

Expected: failure because `server.js` does not yet define `isInvalidDemoMode` / `sendDemoModeInvalid` or unknown modes still pass the live gate.

Observed: after adjusting the harness to summarize cleanly, focused RED reported `0 passed, 1 failed` with `function isInvalidDemoMode not found`.

### Task 2: Implement Fail-Closed Demo Mode Handling

**Files:**
- Modify: `server.js`
- Test: `test-artifacts/server/public-demo-mode-gate-tests.mjs`

- [x] **Step 1: Add helpers**

Add the valid-mode set and helper near existing demo-mode helpers:

```js
const validPublicDemoModes = new Set(["full", "readonly", "protected"]);

function isInvalidDemoMode() {
  return !validPublicDemoModes.has(publicDemoMode);
}
```

- [x] **Step 2: Add blocked response**

Add a stable JSON response:

```js
function sendDemoModeInvalid(res) {
  sendJson(res, 403, {
    ok: false,
    code: "PUBLIC_DEMO_MODE_INVALID",
    error: "PUBLIC_DEMO_MODE 값이 full, readonly, protected 중 하나가 아니라 live API를 차단했습니다.",
  });
}
```

- [x] **Step 3: Wire the gate**

In `requireLiveApiAccess()`, check invalid mode after read-only and before protected:

```js
if (isInvalidDemoMode()) {
  sendDemoModeInvalid(res);
  return false;
}
```

- [x] **Step 4: Run focused GREEN**

Run: `node test-artifacts/server/public-demo-mode-gate-tests.mjs`

Expected: all checks pass.

Observed: `node test-artifacts/server/public-demo-mode-gate-tests.mjs` reported `14 passed, 0 failed`.

### Task 3: Document and Verify

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: this plan file
- Modify outside repo: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document fail-closed behavior**

Update the public demo docs to state that invalid `PUBLIC_DEMO_MODE` values keep `/healthz` diagnostic visibility but block live/write APIs with `PUBLIC_DEMO_MODE_INVALID`.

- [x] **Step 2: Run local QA**

Run:

```bash
node --check server.js
node test-artifacts/server/public-demo-mode-gate-tests.mjs
npm test
git diff --check
```

Expected: focused test passes and the full suite reports zero failures.

Observed: `node --check server.js && node test-artifacts/server/public-demo-mode-gate-tests.mjs && npm test && git diff --check` exited 0. Focused gate tests reported `14 passed, 0 failed`; the full suite reported `688 passed, 0 failed across 25 test file(s)`.

- [ ] **Step 3: Commit and push implementation**

Run:

```bash
git add server.js test-artifacts/server/public-demo-mode-gate-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-invalid-demo-mode-fail-closed.md
git commit -m "fix: fail closed for invalid demo mode"
git push origin main
```

- [ ] **Step 4: Verify remote QA artifact**

Run:

```bash
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
gh run download <run-id> -n qa-automation-<run-id> -D <tmp-dir>
```

Expected: run conclusion `success`, artifact contains `qa-summary.json`, and the read-only smoke summary is `150 passed / 0 failed` with no sensitive token/header matches.
