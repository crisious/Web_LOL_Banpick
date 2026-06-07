# GitHub Actions Node24 Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the GitHub Actions JavaScript action runtime deprecation annotation while keeping the app test runtime pinned to Node.js 20.

**Architecture:** Keep the project test runtime configured with `node-version: "20"` for app tests and smoke commands. Upgrade the GitHub-maintained JavaScript actions to Node 24-native major versions (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`) and remove the temporary `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` override so the workflow no longer relies on forced legacy action runtime behavior.

**Tech Stack:** GitHub Actions, existing `.github/workflows/qa.yml`, zero-dependency workflow contract test.

---

### Task 1: Workflow Runtime Contract

**Files:**
- Modify: `test-artifacts/scripts/github-actions-workflow-tests.mjs`
- Modify: `.github/workflows/qa.yml`

- [x] **Step 1: Write the failing contract test**

Add assertions after the read-only permissions check:

```js
check("QA workflow does not force old JavaScript action runtime",
  !/FORCE_JAVASCRIPT_ACTIONS_TO_NODE24/.test(workflow),
  workflow);

check("QA workflow uses Node 24-native checkout action",
  /uses:\s*actions\/checkout@v6/.test(workflow),
  workflow);

check("QA workflow uses Node 24-native setup-node action",
  /uses:\s*actions\/setup-node@v6/.test(workflow),
  workflow);
```

Update the artifact upload assertion to require `actions/upload-artifact@v7`.

- [x] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Observed: 11 passed / 4 failed for the forced runtime env and old action majors.

- [x] **Step 3: Upgrade workflow actions**

In `.github/workflows/qa.yml`, use:

```yaml
- uses: actions/checkout@v6
- uses: actions/setup-node@v6
- uses: actions/upload-artifact@v7
```

Keep:

```yaml
node-version: "20"
```

Remove:

```yaml
FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Observed: 15 passed / 0 failed.

### Task 2: Full Verification And Push

**Files:**
- Modify: `README.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Update test count docs**

Updated README's `npm test` count to 534 after full-suite verification.

- [x] **Step 2: Run full verification**

Run:

```bash
node --check test-artifacts/scripts/github-actions-workflow-tests.mjs
node test-artifacts/scripts/github-actions-workflow-tests.mjs
npm test
git diff --check
```

Expected: all commands exit 0.

Observed: `node --check`, workflow contract tests, `npm test` (534 passed / 0 failed across 23 files), and `git diff --check` all exited 0.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add .github/workflows/qa.yml README.md docs/superpowers/plans/2026-06-08-github-actions-node24-runtime.md test-artifacts/scripts/github-actions-workflow-tests.mjs
git commit -m "ci: use node24-native actions"
git push origin main
```

- [ ] **Step 4: Recheck remote workflow**

Use:

```bash
gh run list --workflow QA --limit 3
gh run watch <run-id> --exit-status
```

Expected: the new workflow run passes without the previous Node.js 20 action runtime annotation.
