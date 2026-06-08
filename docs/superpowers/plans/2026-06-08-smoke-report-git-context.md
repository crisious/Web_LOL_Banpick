# Smoke Report Git Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record sanitized git branch/commit context in `qa-summary.json.latestRun` so uploaded smoke report artifacts can be tied back to the exact code revision without opening the workflow UI first.

**Architecture:** Keep the smoke report runner as the single artifact writer. Add a small git context collector that shells out to non-mutating `git` commands, returns empty strings when git is unavailable, and injects the result into `buildQaSummary()`.

**Tech Stack:** Node.js ESM, built-in `child_process`, existing zero-dependency test runner, Markdown docs, GitHub Actions QA artifact.

---

## File Structure

- Modify: `scripts/run-smoke-report.mjs`
  - Add `execFileSync` import.
  - Add `gitContextFor(cwd)` helper that reads current branch, short SHA, full SHA, and dirty status with non-mutating git commands.
  - Add optional `gitContext` input to `buildQaSummary()` and record it as `latestRun.git`.
  - Pass `gitContextFor(process.cwd())` from `runSmokeReport()`.
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
  - Extend the exact protected `qaSummary` expectation with `latestRun.git`.
  - Add a focused assertion that passing summaries retain supplied git context.
- Modify: `README.md`
  - Document that `qa-summary.json` records git branch/commit context.
- Modify: `docs/external-demo-runbook.md`
  - Mirror the operator-facing artifact field list.
- Create: `docs/superpowers/plans/2026-06-08-smoke-report-git-context.md`
  - Track RED/GREEN, local QA, staged QA, GitHub Actions artifact, and Obsidian evidence.

## Task 1: Add Failing Git Context Summary Tests

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Extend the protected exact summary fixture**

Insert `gitContext` in the protected `runner.buildQaSummary()` call:

```js
gitContext: {
  branch: "main",
  shortSha: "abc1234",
  fullSha: "abc1234def5678",
  dirty: false,
},
```

Then add the matching expected payload under `latestRun`:

```js
git: {
  branch: "main",
  shortSha: "abc1234",
  fullSha: "abc1234def5678",
  dirty: false,
},
```

- [x] **Step 2: Add a focused passing summary assertion**

After the run duration assertion for `passingRequiredSummary`, add:

```js
check("buildQaSummary records supplied git context",
  passingRequiredSummary?.latestRun?.git,
  {
    branch: "main",
    shortSha: "feed123",
    fullSha: "feed1234567890abcdef",
    dirty: true,
  });
```

Also pass that `gitContext` object into the `passingRequiredSummary` `runner.buildQaSummary()` call.

- [x] **Step 3: Verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: the new git context assertions fail because `buildQaSummary()` does not yet expose `latestRun.git`.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 1 with `120 passed, 2 failed`; both failures showed `latestRun.git` was missing from `buildQaSummary()`.

## Task 2: Implement Git Context in the Runner

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Import `execFileSync`**

Change:

```js
import { spawn } from "node:child_process";
```

to:

```js
import { execFileSync, spawn } from "node:child_process";
```

- [x] **Step 2: Add git helpers**

Add after `runDurationMs()`:

```js
function gitOutput(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function gitContextFor(cwd = process.cwd()) {
  try {
    const branch = gitOutput(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    const shortSha = gitOutput(["rev-parse", "--short", "HEAD"], cwd);
    const fullSha = gitOutput(["rev-parse", "HEAD"], cwd);
    const status = gitOutput(["status", "--porcelain"], cwd);
    return {
      branch,
      shortSha,
      fullSha,
      dirty: status.length > 0,
    };
  } catch {
    return {
      branch: "",
      shortSha: "",
      fullSha: "",
      dirty: false,
    };
  }
}
```

- [x] **Step 3: Inject git context into `buildQaSummary()`**

Add `gitContext = null` to the destructured parameters and add this under `latestRun` after `durationMs`:

```js
git: gitContext || {
  branch: "",
  shortSha: "",
  fullSha: "",
  dirty: false,
},
```

- [x] **Step 4: Pass runtime git context**

In `runSmokeReport()`, pass:

```js
gitContext: gitContextFor(process.cwd()),
```

inside the `buildQaSummary({ ... })` call.

- [x] **Step 5: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: focused runner tests pass with one new git context assertion.

Observed: `node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0 with `122 passed, 0 failed`.

## Task 3: Document and Verify the Artifact Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-report-git-context.md`

- [x] **Step 1: Update docs**

Change the `qa-summary.json` field list from:

```md
run duration, smoke pass/fail 요약
```

to:

```md
run duration, git branch/commit context, smoke pass/fail 요약
```

Apply the same wording to the English runbook paragraph.

Observed: `README.md` and `docs/external-demo-runbook.md` now describe `qa-summary.json` as recording git branch/commit context.

- [x] **Step 2: Run local QA**

Run:

```bash
rg -n -e "TO""DO" -e "TB""D" -e "fill"" in" -e "implement"" later" -e "Similar"" to" -e "appropriate"" error" docs/superpowers/plans/2026-06-08-smoke-report-git-context.md
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
- Focused runner tests passed: `122 passed, 0 failed`.
- Full suite passed: `1299 passed, 0 failed across 40 test file(s)`.
- `git diff --check` exited 0.
- Local read-only smoke report passed with `156 passed, 0 failed`; `qa-summary.json.latestRun.git` recorded `branch: "main"`, `shortSha: "b8707e3"`, `fullSha: "b8707e355da0e78f2d594c18c9818e471c8cb756"`, and `dirty: true`; required checks were total 13 / passed 13 / failed 0 / missing 0; local artifact sensitive-value scan returned no matches.

## Task 4: Commit, Push, and Capture Remote Evidence

**Files:**
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Stage and run staged QA**

Run:

```bash
git add README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-git-context.md scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
npm test
git diff --cached --check
```

Expected: focused and full suites pass; cached diff has no whitespace errors.

Observed: staged files were `README.md`, `docs/external-demo-runbook.md`, `docs/superpowers/plans/2026-06-08-smoke-report-git-context.md`, `scripts/run-smoke-report.mjs`, and `test-artifacts/scripts/smoke-report-runner-tests.mjs`. Focused runner tests passed with `122 passed, 0 failed`; placeholder scan exited 1 with no matches; `git diff --cached --check` exited 0; full suite passed with `1299 passed, 0 failed across 40 test file(s)`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git commit -m "ci: record smoke report git context"
git push origin main
```

Expected: commit lands on `main` and push updates `origin/main`.

- [ ] **Step 3: Verify GitHub Actions artifact**

Run:

```bash
gh run list --workflow QA --branch main --limit 5
gh run view <run-id> --json status,conclusion,headSha,url,workflowName,createdAt,updatedAt
gh run download <run-id> --name qa-automation-<run-id> --dir test-artifacts/tmp/qa-git-context-gh
```

Expected: run succeeds for the pushed commit, downloaded `qa-summary.json` has `latestRun.git.shortSha` matching the pushed commit, and sensitive-value scan has no matches.

- [ ] **Step 4: Update Obsidian**

Append a log section before `## 리스크 관리` with:
- commit SHA and message
- RED/GREEN evidence
- local QA counts
- GitHub run id, artifact id, artifact `latestRun.git` evidence
- final `main...origin/main` sync evidence

## Self-Review

- Spec coverage: the plan covers test-first behavior, runner implementation, docs, local QA, staged QA, remote artifact inspection, and Obsidian tracking.
- Placeholder scan target: the plan avoids unresolved placeholder text and includes concrete commands, expected outputs, and file paths.
- Type consistency: the new payload key is consistently named `git`; its fields are `branch`, `shortSha`, `fullSha`, and `dirty`.
