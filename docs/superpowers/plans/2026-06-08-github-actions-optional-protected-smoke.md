# GitHub Actions Optional Protected Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the GitHub Actions `QA` workflow so protected demo mode can be validated automatically when a repository secret is configured, without requiring that secret for normal read-only QA.

**Architecture:** Keep read-only QA as the always-on baseline. Add a token detection step that maps `secrets.PUBLIC_DEMO_TOKEN` into a step environment variable and writes `available=true|false` to `$GITHUB_OUTPUT`. Protected server startup, `npm run smoke:report:protected`, and protected teardown run only when that output is `true`. The token is never passed as a CLI argument, so generated `smoke-run.json` remains token-free.

**Reference:** GitHub Actions workflow syntax documents that secrets cannot be referenced directly in `if:` conditionals; the recommended pattern is to set a secret as an environment variable and condition on that env-derived value/output.

**Tech Stack:** GitHub Actions, existing Node 20 smoke commands, existing `PUBLIC_DEMO_MODE=protected` server mode.

---

### Task 1: Workflow Contract

**Files:**
- Modify: `test-artifacts/scripts/github-actions-workflow-tests.mjs`
- Modify: `.github/workflows/qa.yml`

- [x] **Step 1: Write failing contract tests**

Add assertions that the workflow:

- detects optional `PUBLIC_DEMO_TOKEN` via `secrets.PUBLIC_DEMO_TOKEN`
- gates protected smoke steps on `steps.protected-smoke-token.outputs.available == 'true'`
- runs `npm run smoke:report:protected` only when token is available
- does not pass the demo token via `--token=...`
- only references the optional public demo token secret

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Observed: 16 passed / 3 failed because protected smoke detection and gated protected report execution did not exist.

- [x] **Step 3: Implement optional protected smoke flow**

Add workflow steps after read-only teardown:

- `Detect protected smoke token`
- `Start protected demo`
- `Run protected smoke report`
- `Stop protected demo`

Use step-level `PUBLIC_DEMO_TOKEN: ${{ secrets.PUBLIC_DEMO_TOKEN }}` only for detection and protected smoke steps.

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Observed: 19 passed / 0 failed.

### Task 2: Docs, QA, Push

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document protected CI behavior**

Document that:

- `QA` always runs read-only smoke
- if repository secret `PUBLIC_DEMO_TOKEN` is configured, it also runs protected smoke
- the token is injected through step env and not passed as `--token`

Observed: README and external demo runbook now document optional protected smoke behavior and token handling.

- [x] **Step 2: Run full verification**

Run:

```bash
node --check test-artifacts/scripts/github-actions-workflow-tests.mjs
node test-artifacts/scripts/github-actions-workflow-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0.

Observed: `node --check`, workflow contract tests, `npm test` (540 passed / 0 failed across 23 files), and `git diff --check` all exited 0. A live local protected smoke report also passed with `PUBLIC_DEMO_TOKEN=smoke-token`, generated `qa-summary.json` with 146 passed / 0 failed checks, and token/Authorization string searches returned no matches.

- [ ] **Step 3: Commit, push, and verify remote QA**

Run:

```bash
git add .github/workflows/qa.yml README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-github-actions-optional-protected-smoke.md test-artifacts/scripts/github-actions-workflow-tests.mjs
git commit -m "ci: add optional protected smoke"
git push origin main
gh run watch <run-id> --exit-status
```

Expected: remote `QA` workflow passes. If `PUBLIC_DEMO_TOKEN` is unset, protected smoke steps are skipped and read-only QA still succeeds. If it is set, protected smoke report artifacts are added under `test-artifacts/qa-automation/`.
