# Smoke Report CI Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record GitHub Actions run context in `qa-summary.json.latestRun.ci` so downloaded QA artifacts can identify their workflow run without relying on the GitHub UI list.

**Architecture:** Keep CI metadata collection inside `scripts/run-smoke-report.mjs`, next to existing git context collection. Local runs get an empty CI context, while GitHub Actions runs get provider, repository, workflow, job, run id, run attempt, ref name, SHA, server URL, and run URL.

**Tech Stack:** Node.js ESM, GitHub Actions environment variables, existing zero-dependency test harness, Markdown docs, GitHub CLI artifact verification.

---

## File Structure

- Modify: `scripts/run-smoke-report.mjs`
  - Add `emptyCiContext()` and `ciContextFor(env)` helpers.
  - Record `latestRun.ci` inside `buildQaSummary()`.
  - Pass `ciContextFor(env)` from `runSmokeReport()`.
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Extend the exact protected `qaSummary` fixture with supplied CI context.
  - Add focused assertions for supplied CI context, local empty context, and GitHub Actions env extraction.
- Modify: `README.md`
  - Document that `qa-summary.json` records CI workflow/run context.
- Modify: `docs/external-demo-runbook.md`
  - Mirror the operator-facing artifact field list.
- Create: `docs/superpowers/plans/2026-06-08-smoke-report-ci-context.md`
  - Track RED/GREEN, local QA, staged QA, GitHub Actions artifact, and Obsidian evidence.

## Task 1: Add Failing CI Context Tests

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Extend the protected exact summary fixture**

Add this to the protected `runner.buildQaSummary()` call:

```js
ciContext: {
  provider: "github-actions",
  repository: "crisious/Web_LOL_Banpick",
  workflow: "QA",
  job: "test-and-smoke",
  runId: "27123905756",
  runAttempt: "1",
  refName: "main",
  sha: "abc1234def5678",
  serverUrl: "https://github.com",
  runUrl: "https://github.com/crisious/Web_LOL_Banpick/actions/runs/27123905756",
},
```

Then add the same object under the expected `latestRun.ci` key.

- [x] **Step 2: Add focused summary assertions**

Pass this to the existing `passingRequiredSummary` build call:

```js
ciContext: {
  provider: "github-actions",
  repository: "crisious/Web_LOL_Banpick",
  workflow: "QA",
  job: "test-and-smoke",
  runId: "27124000000",
  runAttempt: "2",
  refName: "main",
  sha: "feed1234567890abcdef",
  serverUrl: "https://github.com",
  runUrl: "https://github.com/crisious/Web_LOL_Banpick/actions/runs/27124000000",
},
```

Add this assertion after the git context assertion:

```js
check("buildQaSummary records supplied CI context",
  passingRequiredSummary?.latestRun?.ci,
  {
    provider: "github-actions",
    repository: "crisious/Web_LOL_Banpick",
    workflow: "QA",
    job: "test-and-smoke",
    runId: "27124000000",
    runAttempt: "2",
    refName: "main",
    sha: "feed1234567890abcdef",
    serverUrl: "https://github.com",
    runUrl: "https://github.com/crisious/Web_LOL_Banpick/actions/runs/27124000000",
  });
```

- [x] **Step 3: Add helper behavior assertions**

Add these focused helper checks near the git context tests:

```js
check("ciContextFor returns empty context outside GitHub Actions",
  runner.ciContextFor?.({}),
  {
    provider: "",
    repository: "",
    workflow: "",
    job: "",
    runId: "",
    runAttempt: "",
    refName: "",
    sha: "",
    serverUrl: "",
    runUrl: "",
  });

check("ciContextFor records GitHub Actions run metadata",
  runner.ciContextFor?.({
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "crisious/Web_LOL_Banpick",
    GITHUB_WORKFLOW: "QA",
    GITHUB_JOB: "test-and-smoke",
    GITHUB_RUN_ID: "27123905756",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_REF_NAME: "main",
    GITHUB_SHA: "abc1234def5678",
    GITHUB_SERVER_URL: "https://github.com",
  }),
  {
    provider: "github-actions",
    repository: "crisious/Web_LOL_Banpick",
    workflow: "QA",
    job: "test-and-smoke",
    runId: "27123905756",
    runAttempt: "1",
    refName: "main",
    sha: "abc1234def5678",
    serverUrl: "https://github.com",
    runUrl: "https://github.com/crisious/Web_LOL_Banpick/actions/runs/27123905756",
  });
```

- [x] **Step 4: Verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the new CI context assertions fail because `ciContextFor()` and `latestRun.ci` are not yet implemented.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `121 passed, 4 failed`; failures showed `latestRun.ci` was missing and `ciContextFor()` was not exported.

## Task 2: Implement CI Context in the Runner

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Add empty context and string helpers**

Add after `gitContextFor()`:

```js
function emptyCiContext() {
  return {
    provider: "",
    repository: "",
    workflow: "",
    job: "",
    runId: "",
    runAttempt: "",
    refName: "",
    sha: "",
    serverUrl: "",
    runUrl: "",
  };
}

function ciText(value) {
  if (typeof value !== "string" || !value) return "";
  return redactSmokeMessageArg(value).replace(/[\u0000-\u001f\u007f]/g, "");
}
```

- [x] **Step 2: Add GitHub Actions context extraction**

Add:

```js
function githubRunUrlFor(serverUrl, repository, runId) {
  if (!/^https?:\/\//.test(serverUrl) || !repository || !runId) return "";
  return `${serverUrl.replace(/\/$/, "")}/${repository}/actions/runs/${runId}`;
}

export function ciContextFor(env = process.env) {
  if (env?.GITHUB_ACTIONS !== "true") return emptyCiContext();
  const serverUrl = redactUrlForEvidence(env.GITHUB_SERVER_URL || "https://github.com");
  const repository = ciText(env.GITHUB_REPOSITORY);
  const runId = ciText(env.GITHUB_RUN_ID);
  return {
    provider: "github-actions",
    repository,
    workflow: ciText(env.GITHUB_WORKFLOW),
    job: ciText(env.GITHUB_JOB),
    runId,
    runAttempt: ciText(env.GITHUB_RUN_ATTEMPT),
    refName: ciText(env.GITHUB_REF_NAME),
    sha: ciText(env.GITHUB_SHA),
    serverUrl,
    runUrl: githubRunUrlFor(serverUrl, repository, runId),
  };
}
```

- [x] **Step 3: Inject CI context into `buildQaSummary()`**

Add `ciContext = null` to the destructured parameters and record it under `latestRun` after `git`:

```js
ci: ciContext || emptyCiContext(),
```

- [x] **Step 4: Pass runtime CI context**

In the `buildQaSummary({ ... })` call inside `runSmokeReport()`, pass:

```js
ciContext: ciContextFor(env),
```

- [x] **Step 5: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: focused runner tests pass and the count increases by the new CI context checks.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0 with `125 passed, 0 failed`.

## Task 3: Document and Verify the Artifact Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-ci-context.md`

- [x] **Step 1: Update docs**

Change the `qa-summary.json` field list from:

```md
git branch/commit context, smoke pass/fail
```

to:

```md
git branch/commit context, CI workflow/run context, smoke pass/fail
```

Apply equivalent wording to the English runbook paragraph.

Observed: `README.md` and `docs/external-demo-runbook.md` now describe `qa-summary.json` as recording CI workflow/run context.

- [x] **Step 2: Run local QA**

Run:

```bash
rg -n -e "TO""DO" -e "TB""D" -e "fill"" in" -e "implement"" later" -e "Similar"" to" -e "appropriate"" error" docs/superpowers/plans/2026-06-08-smoke-report-ci-context.md
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --check
```

Expected:
- Placeholder scan exits 1 with no matches.
- Syntax checks exit 0.
- Focused runner tests pass.
- Full suite passes.
- Diff whitespace check exits 0.

Observed:
- Placeholder scan exited 1 with no matches.
- `node --check scripts/run-smoke-report.mjs && node --check test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0.
- Focused runner tests passed: `125 passed, 0 failed`.
- Full suite passed: `1302 passed, 0 failed across 40 test file(s)`.
- `git diff --check` exited 0.

- [x] **Step 3: Verify a local smoke report**

Start a read-only server and run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/qa-ci-context-local npm run smoke:report:readonly
node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync("test-artifacts/tmp/qa-ci-context-local/qa-summary.json","utf8")); if (s.latestRun.ci.provider !== "") process.exit(1); console.log(JSON.stringify(s.latestRun.ci, null, 2));'
```

Expected: local summary passes smoke and records empty CI context because the run is not inside GitHub Actions.

Observed: local read-only smoke report passed with `156 passed, 0 failed`; `qa-summary.json.latestRun.ci` recorded empty strings for `provider`, `runId`, and `runUrl`; required checks were total 13 / passed 13 / failed 0 / missing 0; local artifact sensitive-value scan returned no matches.

## Task 4: Commit, Push, and Capture Remote Evidence

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Stage and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-ci-context.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --cached --check
```

Expected: focused and full suites pass; cached diff has no whitespace errors.

Observed: staged files were `README.md`, `docs/external-demo-runbook.md`, `docs/superpowers/plans/2026-06-08-smoke-report-ci-context.md`, `scripts/run-smoke-report.mjs`, and `test-artifacts/scripts/smoke-report-runner-tests.mjs`. Focused runner tests passed with `125 passed, 0 failed`; placeholder scan exited 1 with no matches; `git diff --cached --check` exited 0; full suite passed with `1302 passed, 0 failed across 40 test file(s)`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git commit -m "ci: record smoke report workflow context"
git push origin main
```

Expected: commit lands on `main` and push updates `origin/main`.

- [ ] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 5
gh run view <run-id> --json status,conclusion,headSha,url,workflowName,createdAt,updatedAt
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/qa-ci-context-gh
```

Expected: run succeeds for the pushed commit, downloaded `qa-summary.json` has `latestRun.ci.provider: "github-actions"`, `latestRun.ci.runId` equal to the workflow run id, and `latestRun.ci.runUrl` equal to the GitHub run URL.

- [ ] **Step 4: Update Obsidian**

Append a log section before `## 리스크 관리` with:
- commit SHA and message
- RED/GREEN evidence
- local QA counts
- local empty CI context evidence
- GitHub run id, artifact id, artifact `latestRun.ci` evidence
- final `main...origin/main` sync evidence

## Self-Review

- Spec coverage: the plan covers test-first behavior, runner implementation, docs, local QA, staged QA, remote artifact inspection, and Obsidian tracking.
- Placeholder scan target: the plan avoids unresolved placeholder wording and includes concrete commands, expected outputs, and file paths.
- Type consistency: the new payload key is consistently named `ci`; its fields are `provider`, `repository`, `workflow`, `job`, `runId`, `runAttempt`, `refName`, `sha`, `serverUrl`, and `runUrl`.
