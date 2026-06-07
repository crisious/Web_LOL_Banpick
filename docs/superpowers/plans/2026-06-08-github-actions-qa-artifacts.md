# GitHub Actions QA Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions QA workflow that runs the zero-dependency test suite, performs read-only smoke with the report runner, and uploads generated QA evidence as a workflow artifact.

**Architecture:** Keep local QA commands as the source of truth. The workflow starts a read-only demo server in the CI runner, waits for `/healthz`, runs `npm run smoke:report:readonly`, uploads `test-artifacts/qa-automation/` with `actions/upload-artifact@v4`, and always tears down the background server.

**Tech Stack:** GitHub Actions, Node.js 20, built-in shell commands, existing `npm test`, existing `smoke:report:readonly`.

---

### Task 1: Workflow Contract Test

**Files:**
- Create: `test-artifacts/scripts/github-actions-workflow-tests.mjs`
- Create: `.github/workflows/qa.yml`

- [ ] **Step 1: Write the failing test**

Create `test-artifacts/scripts/github-actions-workflow-tests.mjs`:

```js
// GitHub Actions QA workflow contract tests.

import fs from "fs";

const workflowPath = new URL("../../.github/workflows/qa.yml", import.meta.url);

let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  const ok = Boolean(condition);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok && detail) console.log(`  ${detail}`);
  ok ? pass++ : fail++;
}

const exists = fs.existsSync(workflowPath);
check("QA workflow exists", exists, ".github/workflows/qa.yml is missing");

if (exists) {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  check("QA workflow is named", /name:\s*QA/.test(workflow), workflow);
  check("QA workflow runs on main pushes", /push:\s*\n\s+branches:\s*\[\s*"main"\s*\]/.test(workflow), workflow);
  check("QA workflow runs on pull requests", /pull_request:/.test(workflow), workflow);
  check("QA workflow can run manually", /workflow_dispatch:/.test(workflow), workflow);
  check("QA workflow uses read-only permissions", /permissions:\s*\n\s+contents:\s*read/.test(workflow), workflow);
  check("QA workflow pins Node 20", /node-version:\s*"20"/.test(workflow), workflow);
  check("QA workflow runs npm test", /run:\s*npm test/.test(workflow), workflow);
  check("QA workflow runs read-only smoke report", /run:\s*npm run smoke:report:readonly/.test(workflow), workflow);
  check("QA workflow uploads QA automation artifacts", /uses:\s*actions\/upload-artifact@v4/.test(workflow) && /path:\s*test-artifacts\/qa-automation\//.test(workflow), workflow);
  check("QA workflow uploads artifacts even after failure", /if:\s*always\(\)/.test(workflow), workflow);
  check("QA workflow does not require a demo token secret", !/PUBLIC_DEMO_TOKEN|secrets\./.test(workflow), workflow);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Expected: FAIL because `.github/workflows/qa.yml` does not exist.

- [ ] **Step 3: Add the workflow**

Create `.github/workflows/qa.yml` with:

```yaml
name: QA

on:
  push:
    branches: ["main"]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  test-and-smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Run unit tests
        run: npm test

      - name: Start read-only demo
        run: |
          HOST=127.0.0.1 npm run start:readonly > /tmp/lol-ai-coach-readonly.log 2>&1 &
          echo $! > /tmp/lol-ai-coach-readonly.pid
          for attempt in {1..30}; do
            if curl -fsS http://127.0.0.1:8123/healthz >/dev/null; then
              exit 0
            fi
            sleep 1
          done
          cat /tmp/lol-ai-coach-readonly.log
          exit 1

      - name: Run read-only smoke report
        run: npm run smoke:report:readonly

      - name: Stop read-only demo
        if: always()
        run: |
          if [ -f /tmp/lol-ai-coach-readonly.pid ]; then
            kill "$(cat /tmp/lol-ai-coach-readonly.pid)" 2>/dev/null || true
          fi
          cat /tmp/lol-ai-coach-readonly.log 2>/dev/null || true

      - name: Upload QA automation artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: qa-automation-${{ github.run_id }}
          path: test-artifacts/qa-automation/
          if-no-files-found: ignore
          retention-days: 14
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Expected: All workflow contract tests pass.

### Task 2: Documentation And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Document CI artifact behavior**

Add a short note that the `QA` workflow runs `npm test`, `smoke:report:readonly`, and uploads `test-artifacts/qa-automation/`.

- [ ] **Step 2: Run full verification**

Run:

```bash
node --check test-artifacts/scripts/github-actions-workflow-tests.mjs
node test-artifacts/scripts/github-actions-workflow-tests.mjs
npm test
git diff --check
```

Expected: All commands exit 0.

- [ ] **Step 3: Runtime confidence check**

Run local read-only smoke through the same command used by CI:

```bash
HOST=127.0.0.1 npm run start:readonly
npm run smoke:report:readonly
```

Expected: smoke passes and latest `test-artifacts/qa-automation/<timestamp>-readonly/smoke-report.json` has `status: "passed"`.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add .github/workflows/qa.yml README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-github-actions-qa-artifacts.md test-artifacts/scripts/github-actions-workflow-tests.mjs
git commit -m "ci: add qa artifact workflow"
git push origin main
```
