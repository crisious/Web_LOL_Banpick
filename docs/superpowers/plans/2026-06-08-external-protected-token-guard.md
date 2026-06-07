# External Protected Smoke Token Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a manual external protected smoke run from silently skipping when `external_protected_url` is provided but repository secret `PUBLIC_DEMO_TOKEN` is missing.

**Architecture:** Keep external read-only smoke unchanged. Add a guard step before `Run external protected smoke report`. The guard runs only for `workflow_dispatch` when `external_protected_url` is non-empty and the token detection step did not report `available=true`. It prints a short actionable error and exits 1. The normal external protected smoke step still runs only when both URL and token are available.

**Tech Stack:** GitHub Actions workflow conditionals, existing workflow contract tests.

---

### Task 1: Workflow Contract

**Files:**
- Modify: `test-artifacts/scripts/github-actions-workflow-tests.mjs`
- Modify: `.github/workflows/qa.yml`

- [x] **Step 1: Write failing contract test**

Assert that the workflow fails external protected smoke when URL input exists but token is missing:

```js
check("QA workflow fails external protected smoke when token is missing",
  /steps\.protected-smoke-token\.outputs\.available\s*!=\s*'true'/.test(workflow) &&
    /external_protected_url requires repository secret PUBLIC_DEMO_TOKEN/.test(workflow) &&
    /exit 1/.test(workflow),
  workflow);
```

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Observed: 24 passed / 1 failed because the missing-token guard did not exist.

- [x] **Step 3: Implement workflow guard**

Add:

```yaml
- name: Require token for external protected smoke
  if: ${{ github.event_name == 'workflow_dispatch' && inputs.external_protected_url != '' && steps.protected-smoke-token.outputs.available != 'true' }}
  run: |
    echo "external_protected_url requires repository secret PUBLIC_DEMO_TOKEN" >&2
    exit 1
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Observed: 25 passed / 0 failed.

### Task 2: Docs, QA, Push

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Document missing-token behavior**

Document that `external_protected_url` without `PUBLIC_DEMO_TOKEN` fails the workflow with an actionable message.

Observed: `README.md` and `docs/external-demo-runbook.md` now document that a manual `external_protected_url` run without `PUBLIC_DEMO_TOKEN` fails with `external_protected_url requires repository secret PUBLIC_DEMO_TOKEN`.

- [x] **Step 2: Run full verification**

Run:

```bash
node --check test-artifacts/scripts/github-actions-workflow-tests.mjs
node test-artifacts/scripts/github-actions-workflow-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0.

Observed: workflow contract test reported 25 passed / 0 failed, `npm test` reported 546 passed / 0 failed across 23 test files, and `git diff --check` exited 0.

- [ ] **Step 3: Commit, push, and verify remote QA**

Run:

```bash
git add .github/workflows/qa.yml README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-protected-token-guard.md test-artifacts/scripts/github-actions-workflow-tests.mjs
git commit -m "ci: guard external protected smoke token"
git push origin main
gh run watch <run-id> --exit-status
```

Expected: push-triggered `QA` still passes; the new guard is skipped unless manual dispatch supplies `external_protected_url` without `PUBLIC_DEMO_TOKEN`.
