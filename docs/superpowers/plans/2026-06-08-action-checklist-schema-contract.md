# Action Checklist Schema Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `actionChecklist` reject malformed checklist arrays at the final analysis validator so user-facing coaching tips always have a stable id and visible action text.

**Architecture:** `buildLlmPayload()` asks the model for 3-5 checklist items, while the current rule-based fallback and UI already support both `{ text }` and `{ action }` item shapes. This change keeps the existing legacy-compatible minimum of one item, enforces a maximum of five items plus item shape in `validateAnalysisOutput()`, repairs malformed AI output with `buildActionChecklist()`, and expands the zero-dependency schema tests.

**Tech Stack:** Node.js ESM test scripts, CommonJS-compatible `server.js`, zero-dependency CLI tests, read-only smoke reports, GitHub Actions QA artifacts.

---

### Task 1: Capture `actionChecklist` Shape Contract In Tests

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [ ] **Step 1: Extract action-checklist validator support**

Add to the support-source section before `validateSrc`:

```js
if (serverSrc.includes("const ACTION_CHECKLIST_MIN =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "ACTION_CHECKLIST_MIN"));
}
if (serverSrc.includes("const ACTION_CHECKLIST_MAX =")) {
  validatorSupportSources.push(extractConstSource(serverSrc, "ACTION_CHECKLIST_MAX"));
}
if (serverSrc.includes("function hasValidActionChecklist(")) {
  validatorSupportSources.push(extractFunctionSource(serverSrc, "hasValidActionChecklist"));
}
```

- [ ] **Step 2: Add malformed-item and over-limit cases**

Insert after the existing `actionChecklist empty throws` block:

```js
expectThrows("actionChecklist item empty id throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "", text: "준비하기" }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item missing id throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ text: "준비하기" }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item missing text/action throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "act_1", reason: "근거" }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist item empty text/action throws", () => {
  const f = validFixture();
  f.actionChecklist = [{ id: "act_1", text: "" }];
  validateAnalysisOutput(f);
}, "actionChecklist");

expectThrows("actionChecklist over 5 throws", () => {
  const f = validFixture();
  f.actionChecklist = Array.from({ length: 6 }, (_, index) => ({
    id: `act_${index + 1}`,
    text: `체크 ${index + 1}`,
  }));
  validateAnalysisOutput(f);
}, "actionChecklist");
```

- [ ] **Step 3: Run the RED test**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected output:

```text
35 passed, 5 failed
```

The five new cases fail because `validateAnalysisOutput()` currently only checks that `actionChecklist` is a non-empty array.

### Task 2: Enforce And Repair `actionChecklist`

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add validator constants**

Add near the existing analysis output constants:

```js
const ACTION_CHECKLIST_MIN = 1;
const ACTION_CHECKLIST_MAX = 5;
```

- [ ] **Step 2: Add the validator helper**

Add below `hasValidEvidenceIndex()`:

```js
function hasValidActionChecklist(actionChecklist) {
  return Array.isArray(actionChecklist) &&
    actionChecklist.length >= ACTION_CHECKLIST_MIN &&
    actionChecklist.length <= ACTION_CHECKLIST_MAX &&
    actionChecklist.every((item) =>
      item &&
      typeof item.id === "string" &&
      item.id &&
      (
        (typeof item.text === "string" && item.text) ||
        (typeof item.action === "string" && item.action)
      )
    );
}
```

- [ ] **Step 3: Enforce the helper in `validateAnalysisOutput()`**

Replace:

```js
if (!Array.isArray(json?.actionChecklist) || json.actionChecklist.length < 1) throw new Error("actionChecklist empty");
```

With:

```js
if (!hasValidActionChecklist(json?.actionChecklist)) throw new Error("actionChecklist invalid");
```

- [ ] **Step 4: Repair invalid agent checklist before final validation**

Replace the current action-checklist repair block with:

```js
if (!hasValidActionChecklist(primary.actionChecklist)) {
  const checklistWeaknesses = Array.isArray(primary.weaknesses) && primary.weaknesses.length > 0
    ? primary.weaknesses
    : buildWeaknesses(normalized);
  primary.actionChecklist = buildActionChecklist(normalized, checklistWeaknesses);
  violations.push("shape.actionChecklist.invalid");
}
```

### Task 3: Update Test Count Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the schema test count**

Change:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 35건
```

To:

```text
npm run test:schema      # validateAnalysisOutput 위반 패턴 40건
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
40 passed, 0 failed
```

- [ ] **Step 2: Run the full zero-dependency suite**

Run:

```bash
npm test
```

Expected output includes:

```text
1342 passed, 0 failed across 40 test file(s)
```

- [ ] **Step 3: Run read-only smoke report**

Run:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/action-checklist-contract-local npm run smoke:report:readonly
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
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/action-checklist-contract-local
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
- Create: `docs/superpowers/plans/2026-06-08-action-checklist-schema-contract.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Read completion verification skill**

Run:

```bash
sed -n '1,260p' /Users/a1234/.codex/plugins/cache/openai-curated/superpowers/3f0def1b/skills/verification-before-completion/SKILL.md
```

- [ ] **Step 2: Stage and verify staged files**

Run:

```bash
git add server.js README.md test-artifacts/schema/schema-tests.mjs docs/superpowers/plans/2026-06-08-action-checklist-schema-contract.md
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
git commit -m "test: enforce action checklist shape contract"
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
gh api "repos/crisious/Web_LOL_Banpick/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[] | select(.name=="qa-smoke-report") | {id, name, expired, size_in_bytes}'
```

- [ ] **Step 5: Download and inspect the GitHub QA artifact**

Run:

```bash
mkdir -p test-artifacts/tmp/action-checklist-contract-gh
gh run download "$RUN_ID" -n qa-smoke-report -D test-artifacts/tmp/action-checklist-contract-gh
node -e 'const fs=require("fs"); const p="test-artifacts/tmp/action-checklist-contract-gh/qa-summary.json"; const s=JSON.parse(fs.readFileSync(p,"utf8")); console.log(JSON.stringify({runId:s.latestRun.ci?.runId, shortSha:s.latestRun.git?.shortSha, dirty:s.latestRun.git?.dirty, status:s.latestRun.status, smoke:s.latestRun.smokeSummary, qaVerdict:s.latestRun.qaVerdict?.status, sample:s.latestRun.sampleEvidence?.status, demo:s.latestRun.demoSafetyEvidence?.status, artifact:s.latestRun.artifactIntegrity?.status, required:s.latestRun.requiredCheckStatus}, null, 2));'
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/action-checklist-contract-gh
```

Expected JSON fields include `status: "passed"`, `smoke.passed: 156`, `smoke.failed: 0`, `dirty: false`, and all QA sub-statuses `"passed"`. The `rg` command exits with status 1 because no sensitive values are found.

- [ ] **Step 6: Update Obsidian project note**

Update `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with the new commit SHA, GitHub QA run id, artifact id, schema count, full test count, local/GitHub smoke evidence, sensitive scan result, and main sync status.
