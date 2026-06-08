# Smoke Sample List Match Id Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the external demo smoke test fail when `/api/samples` list entries expose an explicit `matchId` field.

**Architecture:** Keep the server-side public list projection from the previous change, and move the same contract into the external smoke script. The smoke test should validate all returned list entries before sample detail checks, record only sample ids in failure detail, and avoid storing API response bodies in reports.

**Tech Stack:** Node.js smoke CLI, Node-based CLI regression tests, Markdown runbook/README.

---

### Task 1: Add a Smoke Regression for Public Sample List `matchId`

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Inspect: `scripts/external-demo-smoke.mjs`

- [ ] **Step 1: Write the failing CLI test**

Add this server and assertion near the existing sample count/report-essential CLI tests in `test-artifacts/scripts/external-demo-smoke-tests.mjs`:

```js
const matchIdListServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, {
    samples: [{ id: "sample-complete", matchId: "KR_8242613150" }],
  });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => matchIdListServer.listen(0, "127.0.0.1", resolve));
const matchIdListUrl = `http://127.0.0.1:${matchIdListServer.address().port}`;
const matchIdList = await runNode([
  smokePath,
  matchIdListUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => matchIdListServer.close(resolve));

check("CLI exits non-zero when sample list exposes matchId",
  matchIdList.status,
  1);

check("CLI reports sample list matchId exposure",
  matchIdList.stderr.includes("FAIL /api/samples list entries omit explicit matchId"),
  true);
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the command exits non-zero because the new CLI test expects a failure that the current smoke script does not produce yet.

### Task 2: Enforce the Contract in External Smoke

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`

- [ ] **Step 1: Add the sample list `matchId` check**

After the existing `/api/samples` array and minimum-count checks in `scripts/external-demo-smoke.mjs`, add:

```js
const sampleListEntries = samples.body?.samples || [];
const samplesWithMatchId = sampleListEntries
  .filter((sample) => Object.prototype.hasOwnProperty.call(sample || {}, "matchId"))
  .map((sample) => sample?.id || "(missing id)");
expect(
  samplesWithMatchId.length === 0,
  "/api/samples list entries omit explicit matchId",
  samplesWithMatchId.length ? `ids=${samplesWithMatchId.slice(0, 5).join(",")}` : "",
);
```

Keep the failure detail limited to public sample ids, not raw match IDs.

- [ ] **Step 2: Run the focused test to verify GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
```

Expected: the command exits zero and includes passes for the new matchId exposure regression.

### Task 3: Document the Smoke Gate

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update README**

Extend the existing `/api/samples` privacy bullet to:

```markdown
- `/api/samples` public list response keeps sample display metadata and detail paths but omits explicit `matchId`; the browser can still match stored samples through sample id/path inference, and external smoke fails if a list entry reintroduces `matchId`.
```

- [ ] **Step 2: Update the external demo runbook**

Extend the existing checklist bullet to:

```markdown
- `/api/samples` list entries omit explicit `matchId`; smoke fails on any list entry that reintroduces the field, while sample detail fetches continue to use public `sample-*` ids and must not require match IDs from the list payload
```

### Task 4: Verify and Publish

**Files:**
- Read: changed files
- Update after publish: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Run local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs
node --check test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/external-demo-smoke-tests.mjs
npm test
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 2: Run staged QA**

After staging only the changed project files, run:

```bash
node --check scripts/external-demo-smoke.mjs
node --check test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/external-demo-smoke-tests.mjs
npm test
git diff --cached --check
```

Expected: every command exits zero.

- [ ] **Step 3: Commit and push to main**

Run:

```bash
git commit -m "ci: guard sample list match ids in smoke"
git push origin main
```

Expected: push succeeds and `main...origin/main` returns `0	0` after fetch.

- [ ] **Step 4: Verify GitHub Actions artifact**

Run:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --dir /tmp/lol-ai-coach-smoke-sample-list-guard
rg -n "RGAPI|api_key|Authorization|/Users/|/runtime/samples|ENOENT|Unexpected token|kr\\.api\\.riotgames\\.com|getaddrinfo|Bearer|token=|access_token|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey|\\\"matchId\\\"" /tmp/lol-ai-coach-smoke-sample-list-guard
```

Expected: the run completes successfully and the sensitive scan exits with no matches.

### Self-Review

- Spec coverage: The plan covers test-first CLI regression, smoke enforcement, docs/runbook updates, local QA, staged QA, GitHub Actions artifact scan, and Obsidian capture.
- Placeholder scan: The plan contains exact file paths, commands, code snippets, RED/GREEN expectations, and no deferred implementation markers.
- Type consistency: The visible smoke label `/api/samples list entries omit explicit matchId` is used consistently in test, implementation, and documentation.
