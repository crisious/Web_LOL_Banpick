# GitHub Actions Node24 Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the GitHub Actions JavaScript action runtime deprecation annotation while keeping the app test runtime pinned to Node.js 20.

**Architecture:** Keep `actions/setup-node@v4` configured with `node-version: "20"` for project tests and smoke commands. Add the workflow-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` environment variable so GitHub-hosted JavaScript actions run on the newer runtime ahead of the deprecation deadline.

**Tech Stack:** GitHub Actions, existing `.github/workflows/qa.yml`, zero-dependency workflow contract test.

---

### Task 1: Workflow Runtime Contract

**Files:**
- Modify: `test-artifacts/scripts/github-actions-workflow-tests.mjs`
- Modify: `.github/workflows/qa.yml`

- [ ] **Step 1: Write the failing contract test**

Add this assertion after the read-only permissions check:

```js
check("QA workflow opts JavaScript actions into Node 24 runtime",
  /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*true/.test(workflow),
  workflow);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Expected: FAIL with `QA workflow opts JavaScript actions into Node 24 runtime`.

- [ ] **Step 3: Add workflow env**

In `.github/workflows/qa.yml`, add:

```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
```

Keep:

```yaml
node-version: "20"
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Expected: 13 passed / 0 failed.

### Task 2: Full Verification And Push

**Files:**
- Modify: `README.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Update test count docs**

Update README's `npm test` count from 531 to 532 after full test verification.

- [ ] **Step 2: Run full verification**

Run:

```bash
node --check test-artifacts/scripts/github-actions-workflow-tests.mjs
node test-artifacts/scripts/github-actions-workflow-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add .github/workflows/qa.yml README.md docs/superpowers/plans/2026-06-08-github-actions-node24-runtime.md test-artifacts/scripts/github-actions-workflow-tests.mjs
git commit -m "ci: opt actions into node24 runtime"
git push origin main
```

- [ ] **Step 4: Recheck remote workflow**

Use:

```bash
gh run list --workflow QA --limit 3
gh run watch <run-id> --exit-status
```

Expected: the new workflow run passes without the previous Node.js 20 action runtime annotation.
