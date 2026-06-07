# Smoke Extra Positional URL Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent direct smoke and smoke report commands from silently ignoring extra positional base URL arguments.

**Architecture:** Add argument parser guards in both `scripts/external-demo-smoke.mjs` and `scripts/run-smoke-report.mjs`. Each command accepts at most one positional base URL; all other inputs must be named `--...` options. Keep failures concise so workflow/manual operator mistakes fail before network requests or artifact creation.

**Tech Stack:** Node.js ESM scripts, zero-dependency parser tests under `test-artifacts/scripts`, npm test runner, GitHub Actions QA.

---

### Task 1: Add RED Parser Coverage

**Files:**
- Modify: `test-artifacts/scripts/external-demo-smoke-tests.mjs`
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [x] **Step 1: Add external smoke parser test**

Add:

```js
checkThrows("parseSmokeArgs rejects multiple positional base URLs",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "https://demo-one.example", "https://demo-two.example"], {}),
  "base URL must be the only positional argument");
```

- [x] **Step 2: Add smoke report runner parser test**

Add:

```js
checkThrows("parseRunnerArgs rejects multiple positional base URLs",
  () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-readonly", "https://demo-one.example", "https://demo-two.example"], {}),
  "external-readonly smoke report accepts only one base URL argument");
```

- [x] **Step 3: Run RED**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: both new checks fail because parsers currently use the first positional URL and ignore extra positional values.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs` produced `112 passed, 1 failed`, and `node test-artifacts/scripts/smoke-report-runner-tests.mjs` produced `16 passed, 1 failed`. Both new parser checks failed because the parsers accepted the first positional URL and ignored the second.

### Task 2: Implement Parser Guards

**Files:**
- Modify: `scripts/external-demo-smoke.mjs`
- Modify: `scripts/run-smoke-report.mjs`

- [x] **Step 1: Guard direct smoke positional args**

In `parseSmokeArgs`, replace the single `find()` lookup with:

```js
const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
if (positionalArgs.length > 1) {
  throw new Error("base URL must be the only positional argument");
}
const explicitBaseUrl = positionalArgs[0];
```

- [x] **Step 2: Guard report runner positional args**

In `parseRunnerArgs`, after computing `positionalArgs`, add:

```js
if (positionalArgs.length > 1) {
  throw new Error(`${mode} smoke report accepts only one base URL argument`);
}
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node test-artifacts/scripts/external-demo-smoke-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: both focused parser suites pass.

Observed: `node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs` exited 0. External demo smoke tests reported `113 passed, 0 failed`; smoke report runner tests reported `17 passed, 0 failed`.

### Task 3: Verify, Document, And Sync

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-08-smoke-extra-positional-url-guard.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document operator contract**

State that direct smoke and report runner commands accept exactly one positional base URL; extra URL arguments fail before network requests.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check
```

Expected: syntax checks, focused parser/smoke suites, full suite, and whitespace check all pass.

Observed: `node --check scripts/external-demo-smoke.mjs && node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/external-demo-smoke-tests.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs && npm test && git diff --check` exited 0. External demo smoke tests reported `113 passed, 0 failed`; smoke report runner tests reported `17 passed, 0 failed`; full suite reported `719 passed, 0 failed across 25 test file(s)`.

- [x] **Step 3: Commit and push**

Run:

```bash
git add scripts/external-demo-smoke.mjs scripts/run-smoke-report.mjs test-artifacts/scripts/external-demo-smoke-tests.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-extra-positional-url-guard.md
git commit -m "ci: reject extra smoke url arguments"
git push origin main
```

Expected: commit lands on `main` and push triggers GitHub Actions QA.

Observed: committed `ad603fc` (`ci: reject extra smoke url arguments`) on `main` and pushed it to `origin/main`.

- [x] **Step 4: Verify remote QA and artifact**

Run:

```bash
gh run list --branch main --workflow QA --limit 5
gh run watch <run-id> --exit-status
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: latest run for the pushed head SHA succeeds, uploaded artifact contains `qa-summary.json`, read-only smoke reports zero failures, and sensitive-value search has no matches.

Observed: GitHub Actions QA run `27105509317` for head SHA `ad603fc921e967c1f68ac9a339cc179d14942b1d` completed with conclusion `success`. Artifact `qa-automation-27105509317` (ID `7468210511`) contained `qa-summary.json`, `smoke-report.json`, and `smoke-run.json`; `qa-summary.json` reported read-only smoke `155 passed, 0 failed`. Sensitive-value scan over the downloaded artifact had no matches for token, Riot key, match id, URL credential/query, Authorization, or lock key patterns.
