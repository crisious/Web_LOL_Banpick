# Smoke Sample Generation Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make external smoke validate the safe aggregate-only shape of `/healthz.sampleGeneration` whenever that health field is present.

**Architecture:** Keep `/healthz.sampleGeneration` backward-compatible for deployments that have not added it yet, but fail fast when it is present and malformed or leaks identifiers. Add a small pure validator in `scripts/external-demo-smoke.mjs` and exercise it through the CLI fake server tests.

**Tech Stack:** Node.js smoke CLI, local HTTP fake server tests, README/runbook/Obsidian documentation.

---

### Task 1: Unsafe Healthz Regression Test

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/scripts/external-demo-smoke-tests.mjs`

- [x] **Step 1: Write the failing test**

Add a fake server after the public demo mode validity tests:

```js
const unsafeSampleGenerationHealthRequests = [];
const unsafeSampleGenerationHealthServer = http.createServer((req, res) => {
  unsafeSampleGenerationHealthRequests.push({ method: req.method, url: req.url });
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
        oldestAgeMs: 1200,
        lockKey: "KR:KR_8242613150",
      },
    });
  }
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => unsafeSampleGenerationHealthServer.listen(0, "127.0.0.1", resolve));
const unsafeSampleGenerationHealthUrl = `http://127.0.0.1:${unsafeSampleGenerationHealthServer.address().port}`;
const unsafeSampleGenerationHealth = await runNode([
  smokePath,
  unsafeSampleGenerationHealthUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => unsafeSampleGenerationHealthServer.close(resolve));

check("CLI exits non-zero when healthz sampleGeneration exposes identifiers",
  unsafeSampleGenerationHealth.status,
  1);
check("CLI reports unsafe sampleGeneration health shape",
  unsafeSampleGenerationHealth.stderr.includes("FAIL healthz sampleGeneration exposes only aggregate fields"),
  true);
check("CLI stops after healthz when sampleGeneration health is unsafe",
  unsafeSampleGenerationHealthRequests.map((request) => request.url),
  ["/healthz"]);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the new checks fail because the smoke currently accepts extra `sampleGeneration` fields and continues past `/healthz`.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` reported `104 passed, 2 failed`; the new stderr/request assertions failed because the smoke accepted unsafe `sampleGeneration.lockKey` and continued past `/healthz`.

### Task 2: Smoke Validator Implementation

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/scripts/external-demo-smoke.mjs`

- [x] **Step 1: Add aggregate-only validator**

Add this helper near `demoModeFromHealth`:

```js
function validateSampleGenerationHealth(body) {
  if (!Object.prototype.hasOwnProperty.call(body || {}, "sampleGeneration")) return;
  const sampleGeneration = body.sampleGeneration;
  const keys = Object.keys(sampleGeneration || {});
  const allowedKeys = ["activeCount", "oldestAgeMs"];
  const hasOnlyAllowedKeys = keys.every((key) => allowedKeys.includes(key));
  expectFatal(
    sampleGeneration && typeof sampleGeneration === "object" && !Array.isArray(sampleGeneration),
    "healthz sampleGeneration is an object",
    `type=${Array.isArray(sampleGeneration) ? "array" : typeof sampleGeneration}`,
  );
  expectFatal(
    hasOnlyAllowedKeys && allowedKeys.every((key) => keys.includes(key)),
    "healthz sampleGeneration exposes only aggregate fields",
    `keys=${keys.length ? keys.join(",") : "(none)"}`,
  );
  expectFatal(
    Number.isInteger(sampleGeneration.activeCount) && sampleGeneration.activeCount >= 0,
    "healthz sampleGeneration activeCount is a non-negative integer",
    `activeCount=${sampleGeneration.activeCount}`,
  );
  expectFatal(
    Number.isFinite(sampleGeneration.oldestAgeMs) && sampleGeneration.oldestAgeMs >= 0,
    "healthz sampleGeneration oldestAgeMs is non-negative",
    `oldestAgeMs=${sampleGeneration.oldestAgeMs}`,
  );
}
```

- [x] **Step 2: Call validator after healthz ok**

Call the helper after `healthz ok=true` and before mode validation:

```js
validateSampleGenerationHealth(health.body);
```

- [x] **Step 3: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: external demo smoke tests pass with the new unsafe healthz case.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` reported `106 passed, 0 failed`.

### Task 3: Documentation, QA, And Sync

**Files:**
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/README.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Web_LOL_Banpick/docs/superpowers/plans/2026-06-08-smoke-sample-generation-health.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document smoke coverage**

Record that external smoke validates `sampleGeneration` as aggregate-only when the field is present and fails before sample/live/write probes if unsafe fields appear.

- [x] **Step 2: Run local verification**

Run:

```bash
node --check scripts/external-demo-smoke.mjs
node test-artifacts/scripts/external-demo-smoke-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0; full suite reports zero failures.

Observed: `node --check scripts/external-demo-smoke.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && npm test && git diff --check` exited 0. Focused external demo smoke tests reported `106 passed, 0 failed`; the full suite reported `710 passed, 0 failed across 25 test file(s)`.

- [x] **Step 3: Commit and push**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-sample-generation-health.md scripts/external-demo-smoke.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs
git commit -m "ci: validate sample generation health in smoke"
git push origin main
```

Observed: committed and pushed `002b3c7 ci: validate sample generation health in smoke` to `origin/main`.

- [x] **Step 4: Verify remote QA artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 5 --json databaseId,headSha,status,conclusion,url
gh run watch <run-id> --exit-status
gh run download <run-id> -n qa-automation-<run-id> -D <tmp-dir>
```

Expected: run conclusion `success`, `qa-summary.json` read-only smoke summary has zero failures, and artifact scan has no sensitive token/header matches.

Observed: GitHub Actions QA run `27104823167` completed with conclusion `success` for head SHA `002b3c716830b43f6af388be31ac110e793b7191`. Artifact `qa-automation-27104823167` / id `7467976684` downloaded to `/tmp/lol-ai-coach-smoke-sample-generation-health.sgpZGz`; `qa-summary.json` recorded read-only smoke `154 passed / 0 failed`, and the sensitive scan returned no matches.
