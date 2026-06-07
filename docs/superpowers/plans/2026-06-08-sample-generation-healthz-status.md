# Sample Generation Healthz Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose safe, read-only sample generation lock status in `/healthz` so operators can tell whether a writable demo has work in progress without calling write APIs.

**Architecture:** Keep the existing in-memory `sampleGenerationLocks` map as the source of truth. Add a pure `sampleGenerationHealth(nowMs)` helper that returns only aggregate operational data, then include it in the existing `/healthz` response.

**Tech Stack:** Node.js `http` server, source-extraction regression tests, README/runbook/Obsidian documentation.

---

### Task 1: Healthz Status Regression Test

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/server/generate-sample-lock-tests.mjs`

- [x] **Step 1: Write the failing test**

Add assertions after the duplicate lock behavior test:

```js
sampleGenerationLocks.set("KR:KR_8242613150", 1000);
sampleGenerationLocks.set("NA1:NA1_1111111111", 2500);
check("sample generation health reports active count",
  sampleGenerationHealth(4000).activeCount,
  2);
check("sample generation health reports oldest age",
  sampleGenerationHealth(4000).oldestAgeMs,
  3000);
check("sample generation health does not expose lock keys",
  Object.keys(sampleGenerationHealth(4000)).sort(),
  ["activeCount", "oldestAgeMs"]);
sampleGenerationLocks.clear();
check("sample generation health reports zero active work",
  sampleGenerationHealth(4000),
  { activeCount: 0, oldestAgeMs: 0 });
```

Also add a static assertion that `/healthz` includes the helper result:

```js
checkTrue("healthz includes sample generation aggregate status",
  /sampleGeneration:\s*sampleGenerationHealth\(\)/.test(serverSrc));
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/server/generate-sample-lock-tests.mjs
```

Expected: fails because `sampleGenerationHealth` is not implemented and `/healthz` does not include the aggregate status.

Observed: `node test-artifacts/server/generate-sample-lock-tests.mjs` failed with `3 passed, 2 failed`; failures were `function sampleGenerationHealth not found` and `healthz includes sample generation aggregate status`.

### Task 2: Minimal Healthz Implementation

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/server.js`

- [x] **Step 1: Add pure aggregate helper**

Add this helper near the sample generation lock helpers:

```js
function sampleGenerationHealth(nowMs = Date.now()) {
  let oldestStartedAt = null;
  for (const startedAt of sampleGenerationLocks.values()) {
    if (!Number.isFinite(startedAt)) continue;
    if (oldestStartedAt === null || startedAt < oldestStartedAt) {
      oldestStartedAt = startedAt;
    }
  }
  return {
    activeCount: sampleGenerationLocks.size,
    oldestAgeMs: oldestStartedAt === null ? 0 : Math.max(0, nowMs - oldestStartedAt),
  };
}
```

- [x] **Step 2: Include aggregate in `/healthz`**

Extend the existing health response:

```js
sendJson(res, 200, {
  ok: true,
  service: "lol-replay-coach",
  ...publicDemoModeHealth(),
  sampleGeneration: sampleGenerationHealth(),
  timestamp: new Date().toISOString(),
});
```

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/server/generate-sample-lock-tests.mjs
```

Expected: sample generation lock tests pass with the new health aggregate coverage.

Observed: `node test-artifacts/server/generate-sample-lock-tests.mjs` reported `20 passed, 0 failed`.

### Task 3: Documentation, QA, And Sync

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/README.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/superpowers/plans/2026-06-08-sample-generation-healthz-status.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document the healthz field**

Record that `/healthz.sampleGeneration.activeCount` and `/healthz.sampleGeneration.oldestAgeMs` expose only aggregate lock status and no match IDs, Riot IDs, tokens, or raw payloads.

- [x] **Step 2: Run local verification**

Run:

```bash
node --check server.js
node test-artifacts/server/generate-sample-lock-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0; full suite reports zero failures.

Observed: `node --check server.js && node test-artifacts/server/generate-sample-lock-tests.mjs && npm test && git diff --check` exited 0. Focused sample generation lock tests reported `20 passed, 0 failed`; the full suite reported `707 passed, 0 failed across 25 test file(s)`.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-sample-generation-healthz-status.md server.js test-artifacts/server/generate-sample-lock-tests.mjs
git commit -m "feat: report sample generation health"
git push origin main
```

- [ ] **Step 4: Verify remote QA artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 5 --json databaseId,headSha,status,conclusion,url
gh run watch <run-id> --exit-status
gh run download <run-id> -n qa-automation-<run-id> -D <tmp-dir>
```

Expected: run conclusion `success`, `qa-summary.json` read-only smoke summary is `150 passed / 0 failed`, and artifact scan has no sensitive token/header matches.
