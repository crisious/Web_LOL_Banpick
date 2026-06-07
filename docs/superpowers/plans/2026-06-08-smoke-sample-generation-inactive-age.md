# Smoke Sample Generation Inactive Age Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make external smoke reject inconsistent `/healthz.sampleGeneration` status where `activeCount` is `0` but `oldestAgeMs` is non-zero.

**Architecture:** Extend the existing optional `sampleGeneration` health validator in `scripts/external-demo-smoke.mjs`. Keep backward compatibility for health responses without the field, but when present require inactive aggregate status to be internally consistent.

**Tech Stack:** Node.js smoke CLI, local HTTP fake server tests, README/runbook/Obsidian documentation.

---

### Task 1: Inactive Age Regression Test

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Write the failing test**

Add a fake server after the unsafe `sampleGeneration.lockKey` test:

```js
const inactiveSampleGenerationAgeRequests = [];
const inactiveSampleGenerationAgeServer = http.createServer((req, res) => {
  inactiveSampleGenerationAgeRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") {
    return sendJson(200, {
      ok: true,
      publicDemoMode: "readonly",
      sampleGeneration: {
        activeCount: 0,
        oldestAgeMs: 1200,
      },
    });
  }
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => inactiveSampleGenerationAgeServer.listen(0, "127.0.0.1", resolve));
const inactiveSampleGenerationAgeUrl = `http://127.0.0.1:${inactiveSampleGenerationAgeServer.address().port}`;
const inactiveSampleGenerationAge = await runNode([
  smokePath,
  inactiveSampleGenerationAgeUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => inactiveSampleGenerationAgeServer.close(resolve));

check("CLI exits non-zero when inactive sampleGeneration has age",
  inactiveSampleGenerationAge.status,
  1);
check("CLI reports inactive sampleGeneration age mismatch",
  inactiveSampleGenerationAge.stderr.includes("FAIL healthz sampleGeneration oldestAgeMs is zero when inactive"),
  true);
check("CLI stops after healthz when inactive sampleGeneration age is inconsistent",
  inactiveSampleGenerationAgeRequests.map((request) => request.url),
  ["/healthz"]);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the new stderr/request assertions fail because the smoke currently accepts `activeCount: 0` with non-zero `oldestAgeMs` and continues past `/healthz`.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` reported `107 passed, 2 failed`; the new stderr/request assertions failed because the smoke accepted inactive `oldestAgeMs: 1200` and continued past `/healthz`.

### Task 2: Smoke Validator Implementation

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/scripts/external-demo-smoke.mjs`

- [x] **Step 1: Add inactive consistency check**

After validating `oldestAgeMs` is non-negative, add:

```js
if (sampleGeneration.activeCount === 0) {
  expectFatal(
    sampleGeneration.oldestAgeMs === 0,
    "healthz sampleGeneration oldestAgeMs is zero when inactive",
    `oldestAgeMs=${sampleGeneration.oldestAgeMs}`,
  );
}
```

- [x] **Step 2: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: external demo smoke tests pass with the new inactive age case.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` reported `109 passed, 0 failed`.

### Task 3: Documentation, QA, And Sync

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/README.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/superpowers/plans/2026-06-08-smoke-sample-generation-inactive-age.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document inactive age consistency**

Record that `activeCount: 0` must pair with `oldestAgeMs: 0`, and smoke fails before sample/live/write probes if the values are inconsistent.

- [x] **Step 2: Run local verification**

Run:

```bash
node --check scripts/external-demo-smoke.mjs
node test-artifacts/scripts/external-demo-smoke-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0; full suite reports zero failures.

Observed: `node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check` exited 0. Focused external demo smoke tests reported `109 passed, 0 failed`; the full suite reported `713 passed, 0 failed across 25 test file(s)`.

- [x] **Step 3: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-sample-generation-inactive-age.md scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs
git commit -m "ci: validate inactive sample generation health"
git push origin main
```

Observed: committed and pushed `f5841a2 ci: validate inactive sample generation health` to `origin/main`.

- [x] **Step 4: Verify remote QA artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 5 --json databaseId,headSha,status,conclusion,url
gh run watch <run-id> --exit-status
gh run download <run-id> -n qa-automation-<run-id> -D <tmp-dir>
```

Expected: run conclusion `success`, `qa-summary.json` read-only smoke summary has zero failures, and artifact scan has no sensitive token/header matches.

Observed: GitHub Actions QA run `27104966518` completed with conclusion `success` for head SHA `f5841a2220e610c9d6b13689afc1544aa19eb3b3`. Artifact `qa-automation-27104966518` / id `7468027014` downloaded to `/tmp/lol-ai-coach-smoke-inactive-sample-generation-health.Pq4Dfi`; `qa-summary.json` recorded read-only smoke `155 passed / 0 failed`, and the sensitive scan returned no matches.
