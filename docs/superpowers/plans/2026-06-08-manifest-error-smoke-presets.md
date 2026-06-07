# Manifest Error Smoke Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add short npm preset scripts for the existing sample manifest list/detail error smoke probes so operators do not have to copy long flag-heavy commands.

**Architecture:** Keep `scripts/external-demo-smoke.mjs` behavior unchanged. Add local and external package scripts that wrap the existing flags for the two supported invalid manifest probes: list missing `label`, and detail traversal `normalizedPath`. Extend package script contract tests and docs so the preset names remain stable.

**Tech Stack:** Node.js package scripts, existing zero-dependency package script tests, existing external smoke CLI.

---

### Task 1: Package Script Contract Tests

**Files:**
- Modify: `test-artifacts/scripts/package-scripts-tests.mjs`
- Modify: `package.json`

- [x] **Step 1: Write failing package script tests**

Add tests that require:

```js
check("smoke:manifest:list-error script exists",
  typeof scripts["smoke:manifest:list-error"] === "string",
  "missing package script smoke:manifest:list-error");

check("smoke:manifest:list-error targets local readonly sample list manifest error",
  /scripts\/external-demo-smoke\.mjs/.test(scripts["smoke:manifest:list-error"] || "") &&
    /http:\/\/127\.0\.0\.1:8123/.test(scripts["smoke:manifest:list-error"] || "") &&
    /--expect-mode=readonly/.test(scripts["smoke:manifest:list-error"] || "") &&
    /--expect-sample-list-error-status=500/.test(scripts["smoke:manifest:list-error"] || "") &&
    /--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID/.test(scripts["smoke:manifest:list-error"] || "") &&
    /Sample manifest entry missing required field: label\./.test(scripts["smoke:manifest:list-error"] || ""),
  scripts["smoke:manifest:list-error"] || "(missing)");
```

Repeat the pattern for:

```js
"smoke:manifest:detail-error"
"smoke:external:manifest:list-error"
"smoke:external:manifest:detail-error"
```

External variants must include `--require-url`, `--require-https`, `--expect-mode=readonly`, and the same stable manifest error expectations.

- [x] **Step 2: Run tests and verify RED**

Run:

```bash
node test-artifacts/scripts/package-scripts-tests.mjs
```

Expected: FAIL because the four preset scripts do not exist.

- [x] **Step 3: Add minimal package scripts**

Add:

```json
"smoke:manifest:list-error": "node scripts/external-demo-smoke.mjs http://127.0.0.1:8123 --expect-mode=readonly --expect-sample-list-error-status=500 --expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID --expect-sample-list-error-message=\"Sample manifest entry missing required field: label.\"",
"smoke:manifest:detail-error": "node scripts/external-demo-smoke.mjs http://127.0.0.1:8123 --expect-mode=readonly --expect-sample-detail-error-id=sample-kr-1 --expect-sample-detail-error-status=500 --expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID --expect-sample-detail-error-message=\"Sample manifest entry path must not contain traversal segments: normalizedPath.\"",
"smoke:external:manifest:list-error": "node scripts/external-demo-smoke.mjs --require-url --require-https --expect-mode=readonly --expect-sample-list-error-status=500 --expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID --expect-sample-list-error-message=\"Sample manifest entry missing required field: label.\"",
"smoke:external:manifest:detail-error": "node scripts/external-demo-smoke.mjs --require-url --require-https --expect-mode=readonly --expect-sample-detail-error-id=sample-kr-1 --expect-sample-detail-error-status=500 --expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID --expect-sample-detail-error-message=\"Sample manifest entry path must not contain traversal segments: normalizedPath.\""
```

- [x] **Step 4: Run tests and verify GREEN**

Run:

```bash
node test-artifacts/scripts/package-scripts-tests.mjs
```

Expected: all package script tests pass.

### Task 2: Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [x] **Step 1: Replace long local commands with npm presets**

Document:

```bash
npm run smoke:manifest:list-error
npm run smoke:manifest:detail-error
```

- [x] **Step 2: Add external preset usage**

Document:

```bash
npm run smoke:external:manifest:list-error -- https://your-demo-url.example
npm run smoke:external:manifest:detail-error -- https://your-demo-url.example
```

Make clear that these are read-only invalid-manifest diagnostics and still require an explicit HTTPS URL for external mode.

### Task 3: Verification And Commit

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `package.json`
- Modify: `test-artifacts/scripts/package-scripts-tests.mjs`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Run full verification**

Run:

```bash
node --check test-artifacts/scripts/package-scripts-tests.mjs
node test-artifacts/scripts/package-scripts-tests.mjs
git diff --check
npm test
```

Expected: all commands exit `0`.

- [x] **Step 2: Run local preset runtime smoke**

Run the list preset against a temporary invalid manifest missing `label`:

```bash
PORT=8123 HOST=127.0.0.1 SAMPLES_DIR=/tmp/lol-ai-coach-preset-list-error npm run start:readonly
npm run smoke:manifest:list-error
```

Run the detail preset against a temporary traversal manifest:

```bash
PORT=8123 HOST=127.0.0.1 SAMPLES_DIR=/tmp/lol-ai-coach-preset-detail-error npm run start:readonly
npm run smoke:manifest:detail-error
```

Expected: both npm presets exit `0` and print the matching `External demo sample ... error smoke passed` line.

- [x] **Step 3: Run normal smoke regression**

Run:

```bash
HOST=127.0.0.1 npm run start:readonly
npm run smoke:readonly
HOST=127.0.0.1 PUBLIC_DEMO_TOKEN=smoke-token npm run start:protected
PUBLIC_DEMO_TOKEN=smoke-token npm run smoke:protected
```

Expected: both normal smoke flows exit `0`.

- [x] **Step 4: Commit and push**

Run:

```bash
git add package.json test-artifacts/scripts/package-scripts-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-manifest-error-smoke-presets.md "/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md"
git commit -m "chore: add manifest error smoke presets"
git push origin main
```

Expected: `git rev-list --left-right --count main...origin/main` returns `0 0`.

### Self-Review

- Spec coverage: Covers four preset scripts, contract tests, docs, runtime smoke, normal smoke regression, and GitHub sync.
- Placeholder scan: No incomplete placeholders remain.
- Type consistency: Script names and flag names match existing smoke CLI options.
