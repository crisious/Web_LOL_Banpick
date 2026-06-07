# Smoke Report Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add repeatable `npm run smoke:report:*` commands that run the existing external demo smoke checks and automatically save timestamped JSON QA evidence under `test-artifacts/qa-automation/`.

**Architecture:** Keep `scripts/external-demo-smoke.mjs` as the only smoke checker. Add a small wrapper `scripts/run-smoke-report.mjs` that selects the correct smoke mode, builds a timestamped output directory, passes `--report-json=<dir>/smoke-report.json`, writes a sanitized `smoke-run.json` metadata file, and exits with the underlying smoke status.

**Tech Stack:** Node.js 20+, built-in `child_process`, `fs`, `path`, zero-dependency script tests, existing package script contract tests.

---

### Task 1: Runner Contract Tests

**Files:**
- Create: `test-artifacts/scripts/smoke-report-runner-tests.mjs`
- Create: `scripts/run-smoke-report.mjs`

- [ ] **Step 1: Write failing runner tests**

Create `test-artifacts/scripts/smoke-report-runner-tests.mjs`:

```js
// smoke report runner tests.

import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runnerPath = fileURLToPath(new URL("../../scripts/run-smoke-report.mjs", import.meta.url));

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkThrows(label, fn, expectedMessage) {
  try {
    fn();
    console.log(`FAIL  ${label}`);
    console.log(`  expected throw ${JSON.stringify(expectedMessage)}`);
    fail++;
  } catch (error) {
    const ok = String(error.message) === expectedMessage;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) console.log(`  expected ${JSON.stringify(expectedMessage)}\n  got      ${JSON.stringify(error.message)}`);
    ok ? pass++ : fail++;
  }
}

check("smoke report runner script exists", fs.existsSync(runnerPath), true);

if (fs.existsSync(runnerPath)) {
  const runner = await import(runnerPath);

  check("parseRunnerArgs defaults to local readonly",
    runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs"], {}),
    {
      mode: "readonly",
      baseUrl: "http://127.0.0.1:8123",
      expectedMode: "readonly",
      outputRoot: "test-artifacts/qa-automation",
      requiresUrl: false,
      requiresHttps: false,
      requiresToken: false,
      extraSmokeArgs: [],
    });

  check("parseRunnerArgs reads external readonly URL and forwards smoke flags",
    runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-readonly", "https://demo.example.com", "--timeout-ms=15000"], {}),
    {
      mode: "external-readonly",
      baseUrl: "https://demo.example.com",
      expectedMode: "readonly",
      outputRoot: "test-artifacts/qa-automation",
      requiresUrl: true,
      requiresHttps: true,
      requiresToken: false,
      extraSmokeArgs: ["--timeout-ms=15000"],
    });

  checkThrows("parseRunnerArgs rejects external mode without URL",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-readonly"], {}),
    "external-readonly smoke report needs an explicit base URL");

  checkThrows("parseRunnerArgs rejects non-https external URL",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-protected", "http://demo.example.com"], {}),
    "external-protected smoke report needs an https:// base URL");

  const reportDir = runner.reportDirectoryFor("test-artifacts/qa-automation", "readonly", new Date("2026-06-08T00:45:30.123Z"));
  check("reportDirectoryFor builds timestamped mode directory",
    reportDir,
    path.join("test-artifacts/qa-automation", "2026-06-08T00-45-30Z-readonly"));

  check("smokeArgsFor builds local readonly smoke command",
    runner.smokeArgsFor(runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs"], {}), "/tmp/smoke-report.json"),
    [
      "scripts/external-demo-smoke.mjs",
      "http://127.0.0.1:8123",
      "--expect-mode=readonly",
      "--min-samples=19",
      "--report-json=/tmp/smoke-report.json",
    ]);

  check("smokeArgsFor builds external protected smoke command",
    runner.smokeArgsFor(runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-protected", "https://demo.example.com", "--token=secret"], {}), "/tmp/smoke-report.json"),
    [
      "scripts/external-demo-smoke.mjs",
      "https://demo.example.com",
      "--require-url",
      "--require-https",
      "--require-token",
      "--expect-mode=protected",
      "--min-samples=19",
      "--token=secret",
      "--report-json=/tmp/smoke-report.json",
    ]);

  check("redactSmokeArgs removes inline token value",
    runner.redactSmokeArgs(["scripts/external-demo-smoke.mjs", "--token=secret", "--timeout-ms=15000"]),
    ["scripts/external-demo-smoke.mjs", "--token=<redacted>", "--timeout-ms=15000"]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: FAIL because `scripts/run-smoke-report.mjs` does not exist yet.

- [ ] **Step 3: Implement exported runner helpers**

Create `scripts/run-smoke-report.mjs` with exported `parseRunnerArgs`, `reportDirectoryFor`, `smokeArgsFor`, and `redactSmokeArgs`. Do not spawn smoke work when the module is imported by tests.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/smoke-report-runner-tests.mjs
```

Expected: All runner tests pass.

### Task 2: Package Scripts

**Files:**
- Modify: `package.json`
- Modify: `test-artifacts/scripts/package-scripts-tests.mjs`

- [ ] **Step 1: Write failing package script tests**

Add checks for these scripts:

```json
"smoke:report:readonly": "node scripts/run-smoke-report.mjs --mode=readonly",
"smoke:report:protected": "node scripts/run-smoke-report.mjs --mode=protected",
"smoke:report:external:readonly": "node scripts/run-smoke-report.mjs --mode=external-readonly",
"smoke:report:external:protected": "node scripts/run-smoke-report.mjs --mode=external-protected"
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node test-artifacts/scripts/package-scripts-tests.mjs
```

Expected: FAIL because the four package scripts are missing.

- [ ] **Step 3: Add package scripts**

Add the four `smoke:report:*` scripts to `package.json`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node test-artifacts/scripts/package-scripts-tests.mjs
```

Expected: All package script contract tests pass.

### Task 3: Documentation And Runtime QA

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`
- Modify: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [ ] **Step 1: Document the report runner**

Document:

```bash
npm run smoke:report:readonly
PUBLIC_DEMO_TOKEN=your-demo-token npm run smoke:report:protected
npm run smoke:report:external:readonly -- https://your-demo-url.example
npm run smoke:report:external:protected -- https://your-demo-url.example --token=your-demo-token
```

Explain that each command writes `smoke-report.json` and sanitized `smoke-run.json` under `test-artifacts/qa-automation/<timestamp>-<mode>/`.

- [ ] **Step 2: Run verification**

Run:

```bash
node --check scripts/run-smoke-report.mjs
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/smoke-report-runner-tests.mjs
node test-artifacts/scripts/package-scripts-tests.mjs
npm test
git diff --check
```

Expected: All commands exit 0.

- [ ] **Step 3: Run runtime smoke with generated report directory**

Start read-only and protected servers and run:

```bash
HOST=127.0.0.1 npm run start:readonly
npm run smoke:report:readonly

HOST=127.0.0.1 PUBLIC_DEMO_TOKEN=smoke-token npm run start:protected
PUBLIC_DEMO_TOKEN=smoke-token npm run smoke:report:protected
```

Expected: both smoke commands pass and produce `smoke-report.json` with `status: "passed"` plus `smoke-run.json` with redacted command metadata.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add package.json scripts/run-smoke-report.mjs test-artifacts/scripts/smoke-report-runner-tests.mjs test-artifacts/scripts/package-scripts-tests.mjs README.md docs/external-demo-runbook.md docs/superpowers/plans/2026-06-08-smoke-report-runner.md
git commit -m "chore: add smoke report runner"
git push origin main
```
