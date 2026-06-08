# Key Moments Minimum Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Align the server-side analysis validator and normalization gate with the existing AI output contract that requires at least four `keyMoments`.

**Architecture:** Keep the AI prompt and LLM payload contract unchanged because they already request `keyMomentsMin: 4`. Add a shared server constant for the minimum, use it in the payload, validator, and primary-analysis repair gate, then pin the behavior with schema tests.

**Tech Stack:** Node.js CommonJS server, no-dependency `.mjs` regression tests, markdown docs.

---

### Task 1: Add Failing Schema Contract Test

**Files:**
- Modify: `test-artifacts/schema/schema-tests.mjs`

- [x] **Step 1: Let the schema test harness load the future constant/helper when present**

Add these helpers after `extractFunctionSource()`:

```js
function extractConstSource(source, name) {
  const m = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[0];
}

const keyMomentsSupportSrc = serverSrc.includes("const KEY_MOMENTS_MIN =")
  ? [
      extractConstSource(serverSrc, "KEY_MOMENTS_MIN"),
      extractFunctionSource(serverSrc, "hasMinimumKeyMoments"),
    ].join("\n")
  : "";
```

Then build `validateAnalysisOutput` with:

```js
const validateAnalysisOutput = new Function(
  `${keyMomentsSupportSrc}\n${validateSrc}\nreturn validateAnalysisOutput;`,
)();
```

- [x] **Step 2: Expand the valid fixture to four key moments**

Change `validFixture().keyMoments` to:

```js
    keyMoments: [
      { id: "km_1", timestampLabel: "08:00", title: "t", description: "d" },
      { id: "km_2", timestampLabel: "12:00", title: "t", description: "d" },
      { id: "km_3", timestampLabel: "16:00", title: "t", description: "d" },
      { id: "km_4", timestampLabel: "20:00", title: "t", description: "d" },
    ],
```

- [x] **Step 3: Add the new failing minimum test**

Add this after the existing one-key-moment failure:

```js
expectThrows("keyMoments only 3 throws (need >=4)", () => {
  const f = validFixture(); f.keyMoments = f.keyMoments.slice(0, 3);
  validateAnalysisOutput(f);
}, "keyMoments");
```

- [x] **Step 4: Run RED**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
```

Expected: `keyMoments only 3 throws (need >=4)` fails because the current validator still accepts two or more key moments.

### Task 2: Implement Shared Minimum Contract

**Files:**
- Modify: `server.js`
- Modify: `test-artifacts/server/llm-payload-tests.mjs`

- [x] **Step 1: Add the shared minimum constant and helper**

Add near the analysis constants:

```js
const KEY_MOMENTS_MIN = 4;
```

Add near `validateAnalysisOutput()`:

```js
function hasMinimumKeyMoments(keyMoments) {
  return Array.isArray(keyMoments) && keyMoments.length >= KEY_MOMENTS_MIN;
}
```

- [x] **Step 2: Use the constant in the LLM payload contract**

Change `buildLlmPayload()`:

```js
requiredArrayCounts: { strengths: 3, weaknesses: 3, actionChecklistMin: 3, actionChecklistMax: 5, keyMomentsMin: KEY_MOMENTS_MIN },
```

- [x] **Step 3: Strengthen the validator**

Change `validateAnalysisOutput()`:

```js
if (!hasMinimumKeyMoments(json?.keyMoments)) throw new Error(`keyMoments < ${KEY_MOMENTS_MIN}`);
```

- [x] **Step 4: Strengthen primary-analysis repair before validation**

Change the `buildAnalysis()` repair gate:

```js
if (!hasMinimumKeyMoments(primary.keyMoments)) {
  primary.keyMoments = buildKeyMoments(normalized);
  violations.push(`count.keyMoments<${KEY_MOMENTS_MIN}`);
}
```

- [x] **Step 5: Let the payload test harness load the constant**

In `test-artifacts/server/llm-payload-tests.mjs`, include `extractConstSource(serverSrc, "KEY_MOMENTS_MIN")` in the source passed to `new Function()` before `buildLlmPayload`.

- [x] **Step 6: Run GREEN**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
```

Expected: schema tests pass with one additional case; LLM payload tests still confirm `requiredArrayCounts.keyMomentsMin` is `4`.

### Task 3: Docs and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-08-key-moments-minimum-contract.md`

- [x] **Step 1: Update the schema test count in README**

Change:

```markdown
npm run test:schema      # validateAnalysisOutput 위반 패턴 18건
```

to:

```markdown
npm run test:schema      # validateAnalysisOutput 위반 패턴 19건
```

- [x] **Step 2: Static checks**

Run:

```bash
node -e 'const fs=require("fs"); const p="docs/superpowers/plans/2026-06-08-key-moments-minimum-contract.md"; const s=fs.readFileSync(p,"utf8"); const needles=[["T","BD"],["TO","DO"],["implement"," later"],["fill"," in details"],["Similar"," to Task"],["Add"," appropriate"],["Write"," tests for the above"]].map((parts)=>parts.join("")); const hits=needles.filter((needle)=>s.includes(needle)); if (hits.length) { console.error(hits.join("\n")); process.exit(1); }'
node --check server.js
node --check test-artifacts/schema/schema-tests.mjs
node --check test-artifacts/server/llm-payload-tests.mjs
git diff --check
```

Expected: placeholder scan has no matches, and all syntax/diff checks pass.

- [x] **Step 3: Full QA**

Run:

```bash
node test-artifacts/schema/schema-tests.mjs
node test-artifacts/server/llm-payload-tests.mjs
npm test
```

Expected: focused tests pass, and full tests pass with one additional schema case.

- [x] **Step 4: Local read-only smoke**

Run a read-only server and smoke report:

```bash
PORT=8123 PUBLIC_DEMO_MODE=readonly node server.js
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-contract-local npm run smoke:report:readonly
```

Expected: local smoke still passes with `156` checks, `latestRun.qaVerdict.status: "passed"`, `latestRun.sampleEvidence.status: "passed"`, and `latestRun.demoSafetyEvidence.status: "passed"`.

- [x] **Step 5: Commit, push, and GitHub artifact verification**

Run:

```bash
git add server.js README.md test-artifacts/schema/schema-tests.mjs test-artifacts/server/llm-payload-tests.mjs docs/superpowers/plans/2026-06-08-key-moments-minimum-contract.md
git commit -m "test: enforce key moments minimum contract"
git push origin main
```

After GitHub Actions completes, download `qa-automation-<run-id>` and verify the pushed SHA passed QA, read-only smoke remains `156 passed / 0 failed`, `qaVerdict.status` is `passed`, and sensitive token/path patterns do not appear in the artifact.

### Actual Verification

- RED: `node test-artifacts/schema/schema-tests.mjs` failed with `18 passed, 1 failed`; `keyMoments only 3 throws (need >=4)` did not throw under the old validator.
- GREEN: `node test-artifacts/schema/schema-tests.mjs` passed with `19 passed, 0 failed`.
- Payload contract: `node test-artifacts/server/llm-payload-tests.mjs` passed with `35 passed, 0 failed` and still reports `requiredArrayCounts.keyMomentsMin: 4`.
- Static QA: placeholder scan, `node --check` for server/schema/payload tests, and `git diff --check` passed.
- Full QA: `npm test` passed with `1321 passed, 0 failed across 40 test file(s)`.
- Local smoke: `SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/key-moments-contract-local npm run smoke:report:readonly` passed with `156` checks, `latestRun.qaVerdict.status: "passed"`, `latestRun.sampleEvidence.status: "passed"`, and `latestRun.demoSafetyEvidence.status: "passed"`.
- Sensitive artifact scan: no matches for token, Riot key, match id, or lock key patterns in the local smoke artifact.
