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

async function checkRejects(label, fn, expectedMessage) {
  try {
    await fn();
    console.log(`FAIL  ${label}`);
    console.log(`  expected reject ${JSON.stringify(expectedMessage)}`);
    fail++;
  } catch (error) {
    const ok = String(error.message) === expectedMessage;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) console.log(`  expected ${JSON.stringify(expectedMessage)}\n  got      ${JSON.stringify(error.message)}`);
    ok ? pass++ : fail++;
  }
}

check("smoke report runner script exists",
  fs.existsSync(runnerPath),
  true);

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

  checkThrows("parseRunnerArgs rejects multiple positional base URLs",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-readonly", "https://demo-one.example", "https://demo-two.example"], {}),
    "external-readonly smoke report accepts only one base URL argument");

  checkThrows("parseRunnerArgs rejects duplicate mode options",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--mode=protected"], {}),
    "--mode accepts only one value");

  checkThrows("parseRunnerArgs rejects duplicate output root options",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/a", "--output-root=test-artifacts/b"], {}),
    "--output-root accepts only one value");

  checkThrows("parseRunnerArgs rejects unknown smoke pass-through options",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--expectmode=readonly"], {}),
    "unknown smoke report option: --expectmode=readonly");

  checkThrows("parseRunnerArgs rejects runner-controlled smoke pass-through options",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--expect-mode=protected"], {}),
    "unknown smoke report option: --expect-mode=protected");

  checkThrows("parseRunnerArgs rejects duplicate smoke pass-through timeout",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--timeout-ms=1000", "--timeout-ms=2000"], {}),
    "--timeout-ms accepts only one value");

  checkThrows("parseRunnerArgs rejects invalid smoke pass-through timeout",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--timeout-ms=0"], {}),
    "--timeout-ms must be a positive integer");

  checkThrows("parseRunnerArgs rejects incomplete sample detail error pass-through",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--expect-sample-detail-error-message=blocked"], {}),
    "--expect-sample-detail-error-id is required when sample detail error options are set");

  checkThrows("parseRunnerArgs rejects invalid sample list error status pass-through",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID", "--expect-sample-list-error-status=0"], {}),
    "--expect-sample-list-error-status must be a positive integer");

  checkThrows("parseRunnerArgs rejects protected mode without token source",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=protected"], {}),
    "--require-token needs --token or PUBLIC_DEMO_TOKEN");

  check("parseRunnerArgs accepts protected mode with env token",
    runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=protected"], { PUBLIC_DEMO_TOKEN: "env-token" }),
    {
      mode: "protected",
      baseUrl: "http://127.0.0.1:8123",
      expectedMode: "protected",
      outputRoot: "test-artifacts/qa-automation",
      requiresUrl: false,
      requiresHttps: false,
      requiresToken: true,
      extraSmokeArgs: [],
    });

  checkThrows("parseRunnerArgs rejects protected mode with empty inline token",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=protected", "--token=   "], { PUBLIC_DEMO_TOKEN: "env-token" }),
    "--require-token needs --token or PUBLIC_DEMO_TOKEN");

  checkThrows("parseRunnerArgs rejects readonly mode with token pass-through",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--token=secret"], {}),
    "--token is only accepted for protected smoke reports");

  checkThrows("parseRunnerArgs rejects external readonly mode with token pass-through",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-readonly", "https://demo.example.com", "--token=secret"], {}),
    "--token is only accepted for protected smoke reports");

  checkThrows("parseRunnerArgs rejects non-https external URL",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-protected", "http://demo.example.com"], {}),
    "external-protected smoke report needs an https:// base URL");

  checkThrows("parseRunnerArgs rejects external readonly private URL via preflight",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-readonly", "https://10.0.0.5"], {}),
    "external_readonly_url must not point to a local or private network target");

  checkThrows("parseRunnerArgs rejects external protected URL query via preflight",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=external-protected", "https://demo.example.com?token=secret"], {}),
    "external_protected_url must not include username/password, query string, or fragment");

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

  check("redactSmokeArgs removes URL credentials, query, and fragment",
    runner.redactSmokeArgs([
      "scripts/external-demo-smoke.mjs",
      "https://user:pass@demo.example/path?access_token=secret#secret",
    ]),
    [
      "scripts/external-demo-smoke.mjs",
      "https://demo.example/path?redacted#redacted",
    ]);

  const invalidOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-invalid-timeout");
  fs.rmSync(invalidOutputRoot, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects invalid pass-through before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", `--output-root=${invalidOutputRoot}`, "--timeout-ms=0"], {}),
    "--timeout-ms must be a positive integer");
  check("invalid pass-through does not create output root",
    fs.existsSync(invalidOutputRoot),
    false);

  const missingTokenOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-missing-token");
  fs.rmSync(missingTokenOutputRoot, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects missing protected token before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", "--mode=protected", `--output-root=${missingTokenOutputRoot}`], {}),
    "--require-token needs --token or PUBLIC_DEMO_TOKEN");
  check("missing protected token does not create output root",
    fs.existsSync(missingTokenOutputRoot),
    false);

  const readonlyTokenOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-readonly-token");
  fs.rmSync(readonlyTokenOutputRoot, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects readonly token before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", `--output-root=${readonlyTokenOutputRoot}`, "--token=secret"], {}),
    "--token is only accepted for protected smoke reports");
  check("readonly token rejection does not create output root",
    fs.existsSync(readonlyTokenOutputRoot),
    false);

  const protectedConfig = runner.parseRunnerArgs([
    "node",
    "scripts/run-smoke-report.mjs",
    "--mode=external-protected",
    "https://demo.example.com",
    "--token=secret",
  ], {});
  const qaSummary = runner.buildQaSummary?.({
    config: protectedConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T01-15-30Z-external-protected",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T01-15-30Z-external-protected/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T01-15-30Z-external-protected/smoke-run.json",
    startedAt: "2026-06-08T01:15:30.000Z",
    finishedAt: "2026-06-08T01:15:45.000Z",
    exitCode: 0,
    smokeReport: {
      status: "passed",
      actualMode: "protected",
      summary: { passed: 42, failed: 0 },
      checks: [{ status: "pass", label: "GET /healthz returns 200" }],
    },
  });
  check("buildQaSummary records latest run evidence without token values",
    qaSummary,
    {
      schemaVersion: 1,
      generatedAt: "2026-06-08T01:15:45.000Z",
      latestRun: {
        mode: "external-protected",
        baseUrl: "https://demo.example.com",
        expectedMode: "protected",
        actualMode: "protected",
        status: "passed",
        exitCode: 0,
        startedAt: "2026-06-08T01:15:30.000Z",
        finishedAt: "2026-06-08T01:15:45.000Z",
        reportDir: "test-artifacts/qa-automation/2026-06-08T01-15-30Z-external-protected",
        reportJsonPath: "test-artifacts/qa-automation/2026-06-08T01-15-30Z-external-protected/smoke-report.json",
        smokeRunJsonPath: "test-artifacts/qa-automation/2026-06-08T01-15-30Z-external-protected/smoke-run.json",
        smokeSummary: { passed: 42, failed: 0 },
        checkCount: 1,
      },
    });

  check("buildQaSummary omits demo token material",
    JSON.stringify(qaSummary || {}).includes("secret"),
    false);

  const sensitiveUrlConfig = {
    mode: "external-readonly",
    baseUrl: "https://user:pass@demo.example/path?access_token=summary-secret#summary-secret",
    expectedMode: "readonly",
  };
  const sensitiveUrlSummary = runner.buildQaSummary?.({
    config: sensitiveUrlConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T01-40-30Z-external-readonly",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T01-40-30Z-external-readonly/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T01-40-30Z-external-readonly/smoke-run.json",
    startedAt: "2026-06-08T01:40:30.000Z",
    finishedAt: "2026-06-08T01:40:45.000Z",
    exitCode: 0,
    smokeReport: {
      status: "passed",
      actualMode: "readonly",
      summary: { passed: 42, failed: 0 },
      checks: [{ status: "pass", label: "GET /healthz returns 200" }],
    },
  });
  check("buildQaSummary redacts URL credentials, query, and fragment",
    sensitiveUrlSummary?.latestRun?.baseUrl,
    "https://demo.example/path?redacted#redacted");

  check("buildQaSummary omits sensitive URL material",
    JSON.stringify(sensitiveUrlSummary || {}).includes("summary-secret"),
    false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
