# Key Moments Shape Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `keyMoments` reject malformed moment items at the final analysis validator so moment cards always have visible time, phase, title, body text, and evidence links.

**Architecture:** `buildLlmPayload()` already requires at least four key moments, and the UI renders either AI-style fields (`timestampLabel`, `title`, `description`) or fallback fields (`timestamp`, `label`, `reason`). This change adds one key-moment shape helper that accepts both field styles, updates the deterministic builder to include `relatedEventIds`, repairs malformed AI output with `buildKeyMoments()`, and expands the zero-dependency schema tests.

**Tech Stack:** Node.js ESM test scripts, CommonJS-compatible `server.js`, zero-dependency CLI tests, read-only smoke reports, GitHub Actions QA artifacts.

---

### Task 1: Capture `keyMoments` Item Shape Contract In Tests

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Extract key-moment validator support**

Add to the support-source section before `validateSrc`:

```js
if (serverSrc.includes("function hasValidKeyMoments(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidKeyMoments"));
}
```

- [ ] **Step 2: Add key-moment malformed-item cases**

Insert after the existing `keyMoments only 3 throws (need >=4)` block:

```js
expectThrows("keyMoments item missing id/eventId throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { timestampLabel: "08:00", phase: "EARLY", title: "장면", description: "설명", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item missing timestamp throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", phase: "EARLY", title: "장면", description: "설명", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item missing phase throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", title: "장면", description: "설명", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item missing title/label throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", phase: "EARLY", description: "설명", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item missing description/reason throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "장면", relatedEventIds: [] };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item missing relatedEventIds throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "장면", description: "설명" };
  validateAnalysisOutput(f);
}, "keyMoments");

expectThrows("keyMoments item invalid relatedEventIds throws", () => {
  const f = validFixture();
  f.keyMoments[0] = { id: "km_1", timestampLabel: "08:00", phase: "EARLY", title: "장면", description: "설명", relatedEventIds: [""] };
  validateAnalysisOutput(f);
}, "keyMoments");
```

- [ ] **Step 3: Run the RED test**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
50 passed, 7 failed
```

The seven new cases fail because `validateAnalysisOutput()` currently only checks that `keyMoments` has at least four entries.

### Task 2: Enforce And Repair `keyMoments`

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add `relatedEventIds` to deterministic key moments**

Update the `buildKeyMoments()` map result:

```js
    .map((event) => ({
      eventId: event.eventId,
      timestamp: event.timestampLabel,
      phase: event.phase,
      label: labelForMoment(event),
      reason: event.summary,
      impact: impactForMoment(event, normalized.matchInfo.result),
      importance: event.importance,
      relatedEventIds: [event.eventId],
    }));
```

- [ ] **Step 2: Add the validator helper**

Add below `hasMinimumKeyMoments()`:

```js
function hasValidKeyMoments(keyMoments) {
  return Array.isArray(keyMoments) &&
    keyMoments.length >= KEY_MOMENTS_MIN &&
    keyMoments.every((item) =>
      item &&
      (
        (typeof item.id === "string" && item.id) ||
        (typeof item.eventId === "string" && item.eventId)
      ) &&
      (
        (typeof item.timestampLabel === "string" && item.timestampLabel) ||
        (typeof item.timestamp === "string" && item.timestamp)
      ) &&
      typeof item.phase === "string" &&
      item.phase &&
      (
        (typeof item.title === "string" && item.title) ||
        (typeof item.label === "string" && item.label)
      ) &&
      (
        (typeof item.description === "string" && item.description) ||
        (typeof item.reason === "string" && item.reason)
      ) &&
      Array.isArray(item.relatedEventIds) &&
      item.relatedEventIds.every((id) => typeof id === "string" && id)
    );
}
```

- [ ] **Step 3: Enforce the helper in `validateAnalysisOutput()`**

Replace:

```js
if (!hasMinimumKeyMoments(json?.keyMoments)) throw new Error(`keyMoments < ${KEY_MOMENTS_MIN}`);
```

With:

```js
if (!hasValidKeyMoments(json?.keyMoments)) throw new Error("keyMoments invalid");
```

- [ ] **Step 4: Repair invalid agent key moments before final validation**

Replace:

```js
if (!hasMinimumKeyMoments(primary.keyMoments)) {
  primary.keyMoments = buildKeyMoments(normalized);
  violations.push(`count.keyMoments<${KEY_MOMENTS_MIN}`);
}
```

With:

```js
if (!hasValidKeyMoments(primary.keyMoments)) {
  primary.keyMoments = buildKeyMoments(normalized);
  violations.push("shape.keyMoments.invalid");
}
```

### Task 3: Update Test Count Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the schema test count**

Change:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 50건
```

To:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 57건
```

### Task 4: Verify Locally

**Files:**
- Verify only

- [ ] **Step 1: Run focused checks**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
node --check server.js
node --check test-artifacts/schema/schema-tests.mjs
git diff --check
```

Expected output includes:

```text
57 passed, 0 failed
```

- [ ] **Step 2: Run the full zero-dependency suite**

Run:

```bash
npm test
```

Expected output includes:

```text
1359 passed, 0 failed across 40 test file(s)
```

- [ ] **Step 3: Run read-only smoke report**

Run:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-shape-contract-local npm run smoke:report:readonly
```

Expected `qa-summary.json` values:

```json
{
  "latestRun.status": "passed",
  "latestRun.smokeSummary.passed": 156,
  "latestRun.smokeSummary.failed": 0,
  "latestRun.qaVerdict.status": "passed",
  "latestRun.sampleEvidence.status": "passed",
  "latestRun.demoSafetyEvidence.status": "passed",
  "latestRun.artifactIntegrity.status": "passed",
  "latestRun.requiredCheckStatus": "passed"
}
```

- [ ] **Step 4: Scan smoke artifacts for sensitive values**

Run:

```bash
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/key-moments-shape-contract-local
```

Expected output:

```text
```

The command exits with status 1 because no matches are found.

### Task 5: Commit, Push, And Verify GitHub QA

**Files:**
- Modify: `README.md`
- Modify: `server.js`
- Modify: `test-artifacts/schema/schema-tests.mjs`
- Create: `docs/superpowers/plans/2026-06-08-key-moments-shape-contract.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Read completion verification skill**

Run:

```bash
sed -n '1,260p' /Users/a1234/.codex/plugins/cache/openai-curated/superpowers/3f0def1b/skills/verification-before-completion/SKILL.md
```

- [ ] **Step 2: Stage and verify staged files**

Run:

```bash
git add server.js README.md test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-08-key-moments-shape-contract.md
git diff --cached --stat
git diff --cached --check
node test-artifacts/schema/schema-tests.mjs
npm test
```

- [ ] **Step 3: Sync, commit, and push main**

Run:

```bash
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git commit -m "test: enforce key moments shape contract"
git push origin main
```

Expected sync count before commit:

```text
0	0
```

- [ ] **Step 4: Verify the pushed QA workflow**

Run:

```bash
RUN_ID="$(gh run list --workflow QA --branch main --limit 5 --json databaseId,headSha,status,conclusion --jq 'map(select(.headSha == "'"$(git rev-parse HEAD)"'")) | .[0].databaseId')"
gh run watch "$RUN_ID" --exit-status
gh run view "$RUN_ID" --json databaseId,headSha,status,conclusion,url
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | {id, name, expired, size_in_bytes}'
```

- [ ] **Step 5: Download and inspect the GitHub QA artifact**

Run:

```bash
mkdir -p test-artifacts/tmp/key-moments-shape-contract-gh
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/key-moments-shape-contract-gh
node -e 'const fs=require("fs"); const p="test-artifacts/tmp/key-moments-shape-contract-gh/qa-summary.json"; const s=JSON.parse(fs.readFileSync(p,"utf8")); console.log(JSON.stringify({runId:s.latestRun.ci?.runId, shortSha:s.latestRun.git?.shortSha, dirty:s.latestRun.git?.dirty, status:s.latestRun.status, smoke:s.latestRun.smokeSummary, qaVerdict:s.latestRun.qaVerdict?.status, sample:s.latestRun.sampleEvidence?.status, demo:s.latestRun.demoSafetyEvidence?.status, artifact:s.latestRun.artifactIntegrity?.status, required:s.latestRun.requiredCheckStatus}, null, 2));'
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/key-moments-shape-contract-gh
```

Expected JSON fields include `status: "passed"`, `smoke.passed: 156`, `smoke.failed: 0`, `dirty: false`, and all QA sub-statuses `"passed"`. The `rg` command exits with status 1 because no sensitive values are found.

- [ ] **Step 6: Update Obsidian project note**

Update `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with the new commit SHA, GitHub QA run id, artifact id, schema count, full test count, local/GitHub smoke evidence, sensitive scan result, and main sync status.
