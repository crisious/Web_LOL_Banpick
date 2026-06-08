# Smoke Report Message Redaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent sample manifest expectation message pass-through values from leaking token-like or URL secret material into persisted `smoke-run.json` command metadata.

**Architecture:** Keep the existing runner-owned metadata path intact. Extend `redactSmokeArgs()` with a focused redaction branch for sample expectation message options, while leaving smoke execution arguments unchanged.

**Tech Stack:** Node.js ESM scripts, existing smoke report runner tests, README/runbook docs.

---

### Task 1: Lock Metadata Message Redaction With RED Tests

**Files:**
- Modify: `test-artifacts/scripts/smoke-report-runner-tests.mjs`

- [ ] **Step 1: Add failing assertions near existing `redactSmokeArgs` coverage**

```js
  const sampleMessageRedactedArgs = runner.redactSmokeArgs([
    "--expect-sample-detail-error-message=see https://user:pass@demo.example/path?token=secret#secret token=secret",
    "--expect-sample-list-error-message=Authorization: Bearer secret access_token=secret",
  ]);
  const sampleMessageRedactedText = JSON.stringify(sampleMessageRedactedArgs);

  check("redactSmokeArgs keeps sample detail message prefix after redaction",
    sampleMessageRedactedArgs[0].startsWith("--expect-sample-detail-error-message="),
    true);
  check("redactSmokeArgs keeps sample list message prefix after redaction",
    sampleMessageRedactedArgs[1].startsWith("--expect-sample-list-error-message="),
    true);
  check("redactSmokeArgs removes sample message URL credentials",
    sampleMessageRedactedText.includes("user:pass@"),
    false);
  check("redactSmokeArgs removes sample message token query material",
    sampleMessageRedactedText.includes("token=secret"),
    false);
  check("redactSmokeArgs removes sample message access token material",
    sampleMessageRedactedText.includes("access_token=secret"),
    false);
  check("redactSmokeArgs removes sample message bearer material",
    sampleMessageRedactedText.includes("Bearer secret"),
    false);
```

- [ ] **Step 2: Run focused runner tests and confirm RED**

Run: `node test-artifacts/scripts/smoke-report-runner-tests.mjs`

Expected: FAIL on the new sample message redaction checks, proving current metadata redaction is too narrow.

### Task 2: Redact Message Pass-Through Metadata

**Files:**
- Modify: `scripts/run-smoke-report.mjs`

- [ ] **Step 1: Add a message option allowlist for metadata redaction**

```js
const SMOKE_METADATA_MESSAGE_REDACTION_PREFIXES = [
  "--expect-sample-detail-error-message=",
  "--expect-sample-list-error-message=",
];
```

- [ ] **Step 2: Add a helper that redacts URL and token-like text inside one argument**

```js
function redactSmokeMessageArg(arg) {
  return redactUrlForEvidence(arg)
    .replace(/access_token=[^\s"'<>]+/gi, "access_token=<redacted>")
    .replace(/token=[^\s"'<>]+/gi, "token=<redacted>")
    .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer <redacted>");
}
```

- [ ] **Step 3: Route only sample error message options through the helper**

```js
export function redactSmokeArgs(args) {
  return args.map((arg) => {
    if (arg.startsWith("--token=")) return "--token=<redacted>";
    if (/^https?:\/\//.test(arg)) return redactUrlForEvidence(arg);
    if (SMOKE_METADATA_MESSAGE_REDACTION_PREFIXES.some((prefix) => arg.startsWith(prefix))) {
      return redactSmokeMessageArg(arg);
    }
    return arg;
  });
}
```

- [ ] **Step 4: Run focused runner tests and confirm GREEN**

Run: `node --check scripts/run-smoke-report.mjs && node test-artifacts/scripts/smoke-report-runner-tests.mjs`

Expected: syntax check exits 0 and all runner tests pass.

### Task 3: Document Artifact Metadata Guarantees

**Files:**
- Modify: `README.md`
- Modify: `docs/external-demo-runbook.md`

- [ ] **Step 1: Update README artifact metadata paragraph**

Document that `smoke-run.json` command metadata redacts inline tokens, URL secrets, and token-like/Bearer text inside sample manifest error message expectation arguments.

- [ ] **Step 2: Update runbook artifact metadata paragraph**

Document the same operator-facing guarantee where report runner artifacts are described.

- [ ] **Step 3: Run full QA**

Run:

```bash
node --check scripts/external-demo-smoke.mjs &&
node --check scripts/run-smoke-report.mjs &&
node --check test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node --check test-artifacts/scripts/smoke-report-runner-tests.mjs &&
node test-artifacts/scripts/external-demo-smoke-tests.mjs &&
node test-artifacts/scripts/smoke-report-runner-tests.mjs &&
npm test &&
git diff --check
```

Expected: all commands exit 0; no whitespace errors.
