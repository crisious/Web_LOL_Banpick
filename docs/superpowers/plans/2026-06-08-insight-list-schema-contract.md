# Insight List Schema Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `strengths` and `weaknesses` reject malformed insight items at the final analysis validator so insight cards always have visible title/body text and machine-linkable evidence ids.

**Architecture:** The UI renders insight cards from `title`, `description`, and `relatedEventIds`, while `buildStrengths()` and `buildWeaknesses()` already produce those fields deterministically. This change keeps the legacy-compatible minimum of one item, caps insight lists at three items, adds one shared item-shape helper for strengths and weaknesses, repairs malformed AI output with the deterministic builders before final validation, and expands the zero-dependency schema tests.

**Tech Stack:** Node.js ESM test scripts, CommonJS-compatible `server.js`, zero-dependency CLI tests, read-only smoke reports, GitHub Actions QA artifacts.

---

### Task 1: Capture `strengths` / `weaknesses` Item Shape Contract In Tests

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Extract insight-list validator support**

Add to the support-source section before `validateSrc`:

```js
if (serverSrc.includes("const INSIGHT_LIST_MIN =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "INSIGHT_LIST_MIN"));
}
if (serverSrc.includes("const INSIGHT_LIST_MAX =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "INSIGHT_LIST_MAX"));
}
if (serverSrc.includes("function hasValidInsightList(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidInsightList"));
}
```

- [ ] **Step 2: Add strengths malformed-item cases**

Insert after the existing `strengths empty throws` block:

```js
expectThrows("strengths item missing id throws", () => {
  const f = validFixture();
  f.strengths = [{ title: "좋은 합류", description: "설명", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths item missing title throws", () => {
  const f = validFixture();
  f.strengths = [{ id: "str_1", description: "설명", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths item missing description throws", () => {
  const f = validFixture();
  f.strengths = [{ id: "str_1", title: "좋은 합류", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("strengths item missing relatedEventIds throws", () => {
  const f = validFixture();
  f.strengths = [{ id: "str_1", title: "좋은 합류", description: "설명" }];
  validateAnalysisOutput(f);
}, "strengths");
```

- [ ] **Step 3: Add weaknesses malformed-item cases**

Insert after the existing `weaknesses empty throws` block:

```js
expectThrows("weaknesses item missing id throws", () => {
  const f = validFixture();
  f.weaknesses = [{ title: "아쉬운 전환", description: "설명", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("weaknesses item missing title throws", () => {
  const f = validFixture();
  f.weaknesses = [{ id: "wk_1", description: "설명", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("weaknesses item missing description throws", () => {
  const f = validFixture();
  f.weaknesses = [{ id: "wk_1", title: "아쉬운 전환", relatedEventIds: [] }];
  validateAnalysisOutput(f);
}, "weaknesses");

expectThrows("weaknesses item missing relatedEventIds throws", () => {
  const f = validFixture();
  f.weaknesses = [{ id: "wk_1", title: "아쉬운 전환", description: "설명" }];
  validateAnalysisOutput(f);
}, "weaknesses");
```

- [ ] **Step 4: Add list upper-bound cases**

Insert after the malformed-item cases:

```js
expectThrows("strengths over 3 throws", () => {
  const f = validFixture();
  f.strengths = Array.from({ length: 4 }, (_, index) => ({
    id: `str_${index + 1}`,
    title: `강점 ${index + 1}`,
    description: "설명",
    relatedEventIds: [],
  }));
  validateAnalysisOutput(f);
}, "strengths");

expectThrows("weaknesses over 3 throws", () => {
  const f = validFixture();
  f.weaknesses = Array.from({ length: 4 }, (_, index) => ({
    id: `wk_${index + 1}`,
    title: `약점 ${index + 1}`,
    description: "설명",
    relatedEventIds: [],
  }));
  validateAnalysisOutput(f);
}, "weaknesses");
```

- [ ] **Step 5: Run the RED test**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
40 passed, 10 failed
```

The ten new cases fail because `validateAnalysisOutput()` currently only checks that `strengths` and `weaknesses` are non-empty arrays.

### Task 2: Enforce And Repair Insight Lists

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add validator constants**

Add near the existing analysis output constants:

```js
const INSIGHT_LIST_MIN = 1;
const INSIGHT_LIST_MAX = 3;
```

- [ ] **Step 2: Add the shared validator helper**

Add below `hasValidActionChecklist()`:

```js
function hasValidInsightList(items) {
  return Array.isArray(items) &&
    items.length >= INSIGHT_LIST_MIN &&
    items.length <= INSIGHT_LIST_MAX &&
    items.every((item) =>
      item &&
      typeof item.id === "string" &&
      item.id &&
      typeof item.title === "string" &&
      item.title &&
      typeof item.description === "string" &&
      item.description &&
      Array.isArray(item.relatedEventIds) &&
      item.relatedEventIds.every((id) => typeof id === "string" && id)
    );
}
```

- [ ] **Step 3: Enforce the helper in `validateAnalysisOutput()`**

Replace:

```js
if (!Array.isArray(json?.strengths) || json.strengths.length < 1) throw new Error("strengths empty");
if (!Array.isArray(json?.weaknesses) || json.weaknesses.length < 1) throw new Error("weaknesses empty");
```

With:

```js
if (!hasValidInsightList(json?.strengths)) throw new Error("strengths invalid");
if (!hasValidInsightList(json?.weaknesses)) throw new Error("weaknesses invalid");
```

- [ ] **Step 4: Repair invalid agent insight lists before dependent checklist repair**

Add in `buildAnalysis()` before the `actionChecklist` repair block:

```js
if (!hasValidInsightList(primary.strengths)) {
  primary.strengths = buildStrengths(normalized);
  violations.push("shape.strengths.invalid");
}
if (!hasValidInsightList(primary.weaknesses)) {
  primary.weaknesses = buildWeaknesses(normalized);
  violations.push("shape.weaknesses.invalid");
}
```

This must run before `actionChecklist` repair so regenerated weaknesses can feed `buildActionChecklist()`.

### Task 3: Update Test Count Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the schema test count**

Change:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 40건
```

To:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 50건
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
50 passed, 0 failed
```

- [ ] **Step 2: Run the full zero-dependency suite**

Run:

```bash
npm test
```

Expected output includes:

```text
1352 passed, 0 failed across 40 test file(s)
```

- [ ] **Step 3: Run read-only smoke report**

Run:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/insight-list-contract-local npm run smoke:report:readonly
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
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/insight-list-contract-local
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
- Create: `docs/superpowers/plans/2026-06-08-insight-list-schema-contract.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Read completion verification skill**

Run:

```bash
sed -n '1,260p' /Users/a1234/.codex/plugins/cache/openai-curated/superpowers/3f0def1b/skills/verification-before-completion/SKILL.md
```

- [ ] **Step 2: Stage and verify staged files**

Run:

```bash
git add server.js README.md test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-08-insight-list-schema-contract.md
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
git commit -m "test: enforce insight list shape contract"
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
mkdir -p test-artifacts/tmp/insight-list-contract-gh
gh run download "$RUN_ID" -n "qa-automation-$RUN_ID" -D test-artifacts/tmp/insight-list-contract-gh
node -e 'const fs=require("fs"); const p="test-artifacts/tmp/insight-list-contract-gh/qa-summary.json"; const s=JSON.parse(fs.readFileSync(p,"utf8")); console.log(JSON.stringify({runId:s.latestRun.ci?.runId, shortSha:s.latestRun.git?.shortSha, dirty:s.latestRun.git?.dirty, status:s.latestRun.status, smoke:s.latestRun.smokeSummary, qaVerdict:s.latestRun.qaVerdict?.status, sample:s.latestRun.sampleEvidence?.status, demo:s.latestRun.demoSafetyEvidence?.status, artifact:s.latestRun.artifactIntegrity?.status, required:s.latestRun.requiredCheckStatus}, null, 2));'
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/insight-list-contract-gh
```

Expected JSON fields include `status: "passed"`, `smoke.passed: 156`, `smoke.failed: 0`, `dirty: false`, and all QA sub-statuses `"passed"`. The `rg` command exits with status 1 because no sensitive values are found.

- [ ] **Step 6: Update Obsidian project note**

Update `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with the new commit SHA, GitHub QA run id, artifact id, schema count, full test count, local/GitHub smoke evidence, sensitive scan result, and main sync status.
