# Sample Generation Health Integer Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the server-side `/healthz.sampleGeneration.oldestAgeMs` helper always returns an integer millisecond value.

**Architecture:** Keep the server health helper as the single source for `/healthz.sampleGeneration`. Add a focused source-extraction unit test that injects fractional lock timestamps and verifies `sampleGenerationHealth()` floors the elapsed age before returning it, matching the external smoke contract.

**Tech Stack:** Node.js CommonJS server, existing function-extraction tests in `test-artifacts/server/generate-sample-lock-tests.mjs`, zero-dependency npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Coverage

**Files:**
- Modify: `test-artifacts/server/generate-sample-lock-tests.mjs`

- [ ] **Step 1: Write the failing test**

Insert after the existing oldest-age assertion:

```js
sampleGenerationLocks.set("KR:KR_FRACTIONAL", 1000.25);
check("sample generation health floors fractional age to integer milliseconds",
  sampleGenerationHealth(4000.75).oldestAgeMs,
  3000);
sampleGenerationLocks.delete("KR:KR_FRACTIONAL");
```

- [ ] **Step 2: Run RED**

Run:

```bash
node test-artifacts/server/generate-sample-lock-tests.mjs
```

Expected: one new failure because `sampleGenerationHealth(4000.75).oldestAgeMs` currently returns a fractional value.

Observed: `node test-artifacts/server/generate-sample-lock-tests.mjs` produced `20 passed, 1 failed`; the new integer milliseconds assertion expected `3000` and got `3000.75`.

### Task 2: Floor Health Age Output

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Implement minimal change**

Change the helper return to floor the non-negative age:

```js
oldestAgeMs: oldestStartedAt === null ? 0 : Math.floor(Math.max(0, nowMs - oldestStartedAt)),
```

- [ ] **Step 2: Run GREEN**

Run:

```bash
node test-artifacts/server/generate-sample-lock-tests.mjs
```

Expected: the sample generation lock tests pass with the new integer output assertion.

Observed: `node test-artifacts/server/generate-sample-lock-tests.mjs` produced `21 passed, 0 failed`.

### Task 3: Verify, Document, And Sync

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-sample-generation-health-integer-output.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Document server-side integer guarantee**

Clarify that the `/healthz.sampleGeneration.oldestAgeMs` server helper floors elapsed time to integer milliseconds before exposing it.

- [ ] **Step 2: Run full local QA**

Run:

```bash
node --check server.js && node test-artifacts/server/generate-sample-lock-tests.mjs && npm test && git diff --check
```

Expected: syntax check, focused server tests, full suite, and whitespace check all pass.

Observed: `node --check server.js && node test-artifacts/server/generate-sample-lock-tests.mjs && npm test && git diff --check` exited 0. Focused sample generation lock tests reported `21 passed, 0 failed`; full suite reported `717 passed, 0 failed across 25 test file(s)`.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add server.js test-artifacts/server/generate-sample-lock-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-sample-generation-health-integer-output.md
git commit -m "fix: return integer sample generation age"
git push origin main
```

Expected: commit lands on `main` and push triggers GitHub Actions QA.

- [ ] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 5
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: latest run for the pushed head SHA succeeds, the uploaded `qa-automation-*` artifact contains `qa-summary.json`, read-only smoke reports `0` failures, and sensitive-value search has no matches.
