# External Smoke URL Fail-Fast Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make manual external smoke URL validation fail before the expensive QA steps run.

**Architecture:** Keep the existing `scripts/validate-external-smoke-url.mjs` validator and npm script. Reorder `.github/workflows/qa.yml` so manual external URL validation runs immediately after checkout/setup-node and before `npm test`, local read-only smoke, protected token detection, or external smoke report collection.

**Tech Stack:** GitHub Actions YAML, Node.js zero-dependency test scripts, README/runbook documentation.

---

### Task 1: Add Workflow Ordering Contract Coverage

**Files:**
- Modify: `test-artifacts/scripts/github-actions-workflow-tests.mjs`

- [x] **Step 1: Write failing order test**

Add this check after the existing `QA workflow validates external protected URL before token guard and smoke` assertion:

```js
  check("QA workflow validates manual external URLs before expensive QA steps",
    workflow.indexOf("Setup Node") < workflow.indexOf("Validate external read-only smoke URL") &&
      workflow.indexOf("Setup Node") < workflow.indexOf("Validate external protected smoke URL") &&
      workflow.indexOf("Validate external read-only smoke URL") < workflow.indexOf("Run unit tests") &&
      workflow.indexOf("Validate external protected smoke URL") < workflow.indexOf("Run unit tests") &&
      workflow.indexOf("Validate external protected smoke URL") < workflow.indexOf("Detect protected smoke token") &&
      workflow.indexOf("Validate external read-only smoke URL") < workflow.indexOf("Start read-only demo"),
    workflow);
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Expected: the new ordering check fails because validation currently runs after unit/local/protected smoke setup.

Observed: `node test-artifacts/scripts/github-actions-workflow-tests.mjs` produced `27 passed, 1 failed`; only the new fail-fast ordering contract failed.

### Task 2: Move External URL Validation Earlier

**Files:**
- Modify: `.github/workflows/qa.yml`
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Move validation steps**

Move these two workflow steps to immediately after `Setup Node`:

```yaml
      - name: Validate external read-only smoke URL
        if: ${{ github.event_name == 'workflow_dispatch' && inputs.external_readonly_url != '' }}
        env:
          EXTERNAL_READONLY_URL: ${{ inputs.external_readonly_url }}
        run: npm run smoke:validate:external-url -- external_readonly_url "$EXTERNAL_READONLY_URL"

      - name: Validate external protected smoke URL
        if: ${{ github.event_name == 'workflow_dispatch' && inputs.external_protected_url != '' }}
        env:
          EXTERNAL_PROTECTED_URL: ${{ inputs.external_protected_url }}
        run: npm run smoke:validate:external-url -- external_protected_url "$EXTERNAL_PROTECTED_URL"
```

Remove the duplicate copies from the later external smoke section. Keep `Run external read-only smoke report`, `Require token for external protected smoke`, and `Run external protected smoke report` in their existing report/token positions.

Observed: `.github/workflows/qa.yml` now runs both external URL validation steps immediately after `Setup Node` and before `Run unit tests`, local smoke, and protected token detection.

- [x] **Step 2: Document fail-fast behavior**

Update README and runbook manual external URL paragraphs to say manual external URLs are preflighted near the start of the workflow before unit/local smoke work.

Observed: README and `docs/external-demo-runbook.md` now document early fail-fast preflight for manual external URLs.

- [x] **Step 3: Run GREEN workflow contract test**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs
```

Expected: workflow contract tests pass.

Observed: `node test-artifacts/scripts/github-actions-workflow-tests.mjs` produced `28 passed, 0 failed`.

### Task 3: Verify, Commit, Push, and Record QA

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-external-smoke-url-fail-fast-preflight.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
node test-artifacts/scripts/github-actions-workflow-tests.mjs && npm test && git diff --check
```

Expected: workflow contract tests pass, full suite passes, and diff whitespace check passes.

Observed: `node test-artifacts/scripts/github-actions-workflow-tests.mjs && npm test && git diff --check` exited 0; workflow contract tests reported `28 passed, 0 failed` and full suite reported `585 passed, 0 failed across 24 test file(s)`.

- [x] **Step 2: Commit and push to main**

Run:

```bash
git add .github/workflows/qa.yml test-artifacts/scripts/github-actions-workflow-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-external-smoke-url-fail-fast-preflight.md
git commit -m "ci: fail fast external smoke preflight"
git push origin main
```

Observed: committed `160ded3 ci: fail fast external smoke preflight` and pushed to `origin/main`.

- [x] **Step 3: Confirm remote QA and artifact**

Run:

```bash
gh run watch <run-id> --exit-status
gh run view <run-id> --json name,status,conclusion,url,headSha,jobs
gh api repos/crisious/Web_LOL_Banpick/actions/runs/<run-id>/artifacts
```

Expected: GitHub Actions QA succeeds, read-only smoke artifact uploads, and artifact summary reports `150 passed / 0 failed`.

Observed: GitHub Actions run `27099571193` succeeded for `160ded3`; artifact `qa-automation-27099571193` uploaded as artifact id `7466329951`, expires `2026-06-21T17:24:58Z`. Downloaded artifact contained `qa-summary.json`, `2026-06-07T17-24-58Z-readonly/smoke-report.json`, and `2026-06-07T17-24-58Z-readonly/smoke-run.json`; `qa-summary.json` reported `150 passed / 0 failed`. Sensitive-value search for `Authorization`, `Bearer`, non-empty `PUBLIC_DEMO_TOKEN`, non-empty external URL env, `access_token=`, `token=secret`, and `user:pass@` returned no matches.

- [x] **Step 4: Update Obsidian project log**

Append a QA log before `## 리스크 관리` in `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md` with commit, local test count, remote run URL, artifact id, and sensitive-value search result.

Observed: Obsidian project note updated with `585 passed / 0 failed`, run `27099571193`, artifact `7466329951`, and sensitive-value search result.
