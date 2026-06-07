# GitHub Actions External Smoke Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let maintainers collect external HTTPS demo smoke artifacts from GitHub Actions without pushing another code change or running the smoke locally.

**Architecture:** Extend `workflow_dispatch` with optional `external_readonly_url` and `external_protected_url` string inputs. The always-on local read-only QA remains unchanged. When the workflow is manually dispatched and an external URL input is present, run the matching `smoke:report:external:*` command and include its report in the existing `test-artifacts/qa-automation/` artifact. External protected smoke additionally requires the existing optional `PUBLIC_DEMO_TOKEN` secret. URL inputs are passed through step-local environment variables and quoted shell variables, not directly interpolated into `run`.

**Reference:** GitHub Actions documentation says `workflow_dispatch` can define inputs and exposes them through the `inputs` and `github.event.inputs` contexts.

**Tech Stack:** GitHub Actions, existing smoke report runner, existing external smoke npm scripts.

---

### Task 1: Workflow Contract

**Files:**
- Modify: `test-artifacts/scripts/github-actions-workflow-tests.mjs`
- Modify: `.github/workflows/qa.yml`

- [x] **Step 1: Write failing contract tests**

Add assertions that the workflow:

- accepts optional `external_readonly_url` string input
- accepts optional `external_protected_url` string input
- runs external read-only smoke only for manual dispatch with a URL
- runs external protected smoke only for manual dispatch with a URL and token availability
- avoids direct shell interpolation of external URL inputs

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Observed: 20 passed / 4 failed because external dispatch inputs and smoke steps did not exist.

- [x] **Step 3: Implement workflow dispatch inputs and steps**

Add:

- `workflow_dispatch.inputs.external_readonly_url`
- `workflow_dispatch.inputs.external_protected_url`
- `Run external read-only smoke report`
- `Run external protected smoke report`

Use `EXTERNAL_READONLY_URL` and `EXTERNAL_PROTECTED_URL` environment variables in shell commands.

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Observed: 24 passed / 0 failed.

### Task 2: Docs, QA, Push

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document manual dispatch behavior**

Document that maintainers can run the `QA` workflow manually with optional external URLs to collect external smoke artifacts:

- `external_readonly_url`
- `external_protected_url` plus `PUBLIC_DEMO_TOKEN`

Observed: README and external demo runbook now document `external_readonly_url`, `external_protected_url`, token requirements, and env-based URL handling.

- [x] **Step 2: Run full verification**

Run:

```bash
node --check test-artifacts/scripts/github-actions-workflow-tests.mjs
node test-artifacts/scripts/github-actions-workflow-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0.

Observed: `node --check`, workflow contract tests, `npm test` (545 passed / 0 failed across 23 files), and `git diff --check` all exited 0.

- [ ] **Step 3: Commit, push, and verify remote QA**

Run:

```bash
git add .github/workflows/qa.yml README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-github-actions-external-smoke-dispatch.md test-artifacts/scripts/github-actions-workflow-tests.mjs
git commit -m "ci: add external smoke dispatch inputs"
git push origin main
gh run watch <run-id> --exit-status
```

Expected: push-triggered `QA` still passes and external smoke steps are skipped unless manually dispatched with external URLs.
