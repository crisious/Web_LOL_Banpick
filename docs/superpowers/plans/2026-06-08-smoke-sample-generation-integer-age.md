# Smoke Sample Generation Integer Age Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make external demo smoke reject `/healthz.sampleGeneration.oldestAgeMs` when it is not an integer millisecond value.

**Architecture:** Keep validation in `scripts/external-demo-smoke.mjs` inside `validateSampleGenerationHealth(body)`, because the smoke CLI already treats `/healthz` as the first fail-fast gate. Add one focused fake-server regression test that returns `activeCount: 1` with fractional `oldestAgeMs`, then document the integer aggregate contract in the README, runbook, and Obsidian QA log.

**Tech Stack:** Node.js ESM scripts, built-in `http` fake servers, existing `test-artifacts/run-tests.mjs` suite, GitHub Actions QA workflow.

---

### Task 1: Add Fractional Age Regression Test

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [ ] **Step 1: Write the failing test**

Insert after the inactive sample generation age test:

```js
const fractionalSampleGenerationAgeRequests = [];
const fractionalSampleGenerationAgeServer = http.createServer((req, res) => {
  fractionalSampleGenerationAgeRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") {
    return sendJson(200, {
      ok: true,
      publicDemoMode: "readonly",
      sampleGeneration: {
        activeCount: 1,
        oldestAgeMs: 1200.5,
      },
    });
  }
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  return sendJson(404, { error: "not found" });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the new status check may already be non-zero because later probes fail, but the stderr label and fail-fast request checks fail because the smoke CLI does not yet reject fractional `oldestAgeMs` at `/healthz`.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` produced `110 passed, 2 failed`; the new stderr label check and `/healthz` fail-fast request check failed because fractional `oldestAgeMs` was accepted and the smoke continued to page/static/sample/live probes.

### Task 2: Enforce Integer Milliseconds

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`

- [ ] **Step 1: Implement minimal validator change**

Change the oldest age assertion to require an integer:

```js
expectFatal(
  Number.isInteger(sampleGeneration.oldestAgeMs) && sampleGeneration.oldestAgeMs >= 0,
  "healthz sampleGeneration oldestAgeMs is a non-negative integer",
  `oldestAgeMs=${sampleGeneration.oldestAgeMs}`,
);
```

- [ ] **Step 2: Run GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: all external demo smoke tests pass, including the fractional age fail-fast checks.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` produced `112 passed, 0 failed`.

### Task 3: Update Docs And Evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-sample-generation-integer-age.md`

- [ ] **Step 1: Document the contract**

State that `sampleGeneration.activeCount` and `sampleGeneration.oldestAgeMs` must both be non-negative integers, and that smoke fails before sample/live/write probes if fractional age appears.

- [ ] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check
```

Expected: syntax check passes, focused smoke tests pass, full project test suite passes, and whitespace check passes.

Observed: `node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check` exited 0. Focused external demo smoke tests reported `112 passed, 0 failed`; full suite reported `716 passed, 0 failed across 25 test file(s)`.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-sample-generation-integer-age.md
git commit -m "ci: validate sample generation age integer"
git push origin main
```

Expected: commit lands on `main` and push triggers GitHub Actions QA.

Observed: committed and pushed `62dda58 ci: validate sample generation age integer` to `origin/main`.

- [ ] **Step 4: Verify remote QA**

Run:

```bash
gh run list --branch main --workflow QA --limit 5
gh run view <run-id> --json conclusion,headSha,status,url
```

Expected: latest run for the pushed head SHA completes with conclusion `success`, uploads `qa-automation-*`, read-only smoke summary has zero failures, and artifact sensitive-value scan has no matches.

Observed: GitHub Actions QA run `27105156958` completed with conclusion `success` for head SHA `62dda58edb6e8bc7871fdb0592870c5f3dfb6f27`. Artifact `qa-automation-27105156958` uploaded as artifact id `7468091822` and expires at `2026-06-21T21:21:11Z`; downloaded artifact `qa-summary.json` reported read-only smoke `155 passed / 0 failed`, and sensitive-value search for `Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey` returned no matches.
