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

  check("parseRunnerArgs normalizes child output root trailing slash",
    runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/qa-automation/"], {}),
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

  checkThrows("parseRunnerArgs rejects absolute output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=/tmp/qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects non-artifact output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=.github/qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects artifact root output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects artifact root output root with trailing slash",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects artifact root output root with repeated trailing slash",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts//"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects root repeated separator output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts//qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects child repeated separator output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp//qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects repeated trailing slash child output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/qa-automation//"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects leading whitespace output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root= test-artifacts/qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects trailing whitespace output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/qa-automation "], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects backslash output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts\\qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects control character output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\u0007control-root"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects unicode whitespace output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\u00a0unicode-root"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects unicode format output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\u200bformat-root"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects unicode Cf output root outside common ranges",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\u061cformat-root"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects surrogate output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\ud800surrogate-root"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects replacement character output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/smoke-report-\ufffdreplacement-root"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects root dot-segment output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/./qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects child dot-segment output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/tmp/./qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

  checkThrows("parseRunnerArgs rejects traversal output root",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--output-root=test-artifacts/../qa-automation"], {}),
    "--output-root must be a relative path under a test-artifacts subdirectory");

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

  checkThrows("parseRunnerArgs rejects exponential smoke pass-through timeout",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--timeout-ms=1e3"], {}),
    "--timeout-ms must be a positive integer");

  checkThrows("parseRunnerArgs rejects incomplete sample detail error pass-through",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--expect-sample-detail-error-message=blocked"], {}),
    "--expect-sample-detail-error-id is required when sample detail error options are set");

  checkThrows("parseRunnerArgs rejects invalid sample list error status pass-through",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=readonly", "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID", "--expect-sample-list-error-status=0"], {}),
    "--expect-sample-list-error-status must be a positive integer");

  checkThrows("parseRunnerArgs rejects non-error sample detail status before artifact creation",
    () => runner.parseRunnerArgs([
      "node",
      "scripts/run-smoke-report.mjs",
      "--mode=readonly",
      "--expect-sample-detail-error-id=sample-kr-1",
      "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
      "--expect-sample-detail-error-status=399",
    ], {}),
    "--expect-sample-detail-error-status must be an HTTP error status (400-599)");

  checkThrows("parseRunnerArgs rejects exponential sample detail status before artifact creation",
    () => runner.parseRunnerArgs([
      "node",
      "scripts/run-smoke-report.mjs",
      "--mode=readonly",
      "--expect-sample-detail-error-id=sample-kr-1",
      "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
      "--expect-sample-detail-error-status=5e2",
    ], {}),
    "--expect-sample-detail-error-status must be a positive integer");

  checkThrows("parseRunnerArgs rejects out-of-range sample list status before artifact creation",
    () => runner.parseRunnerArgs([
      "node",
      "scripts/run-smoke-report.mjs",
      "--mode=readonly",
      "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
      "--expect-sample-list-error-status=600",
    ], {}),
    "--expect-sample-list-error-status must be an HTTP error status (400-599)");

  checkThrows("parseRunnerArgs rejects unsafe sample detail error id before artifact creation",
    () => runner.parseRunnerArgs([
      "node",
      "scripts/run-smoke-report.mjs",
      "--mode=readonly",
      "--expect-sample-detail-error-id=https://user:pass@demo.example/path?token=secret",
      "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    ], {}),
    "--expect-sample-detail-error-id must match sample-[a-z0-9]+(-[a-z0-9]+)*");

  checkThrows("parseRunnerArgs rejects sample detail error id empty segment before artifact creation",
    () => runner.parseRunnerArgs([
      "node",
      "scripts/run-smoke-report.mjs",
      "--mode=readonly",
      "--expect-sample-detail-error-id=sample-kr--1",
      "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    ], {}),
    "--expect-sample-detail-error-id must match sample-[a-z0-9]+(-[a-z0-9]+)*");

  checkThrows("parseRunnerArgs rejects sample detail error id trailing separator before artifact creation",
    () => runner.parseRunnerArgs([
      "node",
      "scripts/run-smoke-report.mjs",
      "--mode=readonly",
      "--expect-sample-detail-error-id=sample-bad-",
      "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    ], {}),
    "--expect-sample-detail-error-id must match sample-[a-z0-9]+(-[a-z0-9]+)*");

  checkThrows("parseRunnerArgs rejects unsafe sample detail error code before artifact creation",
    () => runner.parseRunnerArgs([
      "node",
      "scripts/run-smoke-report.mjs",
      "--mode=readonly",
      "--expect-sample-detail-error-id=sample-kr-1",
      "--expect-sample-detail-error-code=sample manifest invalid",
    ], {}),
    "--expect-sample-detail-error-code must match [A-Z0-9_]+");

  checkThrows("parseRunnerArgs rejects unsafe sample list error code before artifact creation",
    () => runner.parseRunnerArgs([
      "node",
      "scripts/run-smoke-report.mjs",
      "--mode=readonly",
      "--expect-sample-list-error-code=sample manifest invalid",
    ], {}),
    "--expect-sample-list-error-code must match [A-Z0-9_]+");

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

  const invalidOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-invalid-timeout");
  fs.rmSync(invalidOutputRoot, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects invalid pass-through before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", `--output-root=${invalidOutputRoot}`, "--timeout-ms=0"], {}),
    "--timeout-ms must be a positive integer");
  check("invalid pass-through does not create output root",
    fs.existsSync(invalidOutputRoot),
    false);

  const exponentialTimeoutOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-exponential-timeout");
  fs.rmSync(exponentialTimeoutOutputRoot, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects exponential timeout before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", `--output-root=${exponentialTimeoutOutputRoot}`, "--timeout-ms=1e3"], {}),
    "--timeout-ms must be a positive integer");
  check("exponential timeout rejection does not create output root",
    fs.existsSync(exponentialTimeoutOutputRoot),
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

  const unsafeEnvOutputRoot = "test-artifacts/../smoke-report-unsafe-output-root";
  const unsafeEnvCreatedPath = "smoke-report-unsafe-output-root";
  fs.rmSync(unsafeEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects unsafe env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: unsafeEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("unsafe env output root rejection does not create output root",
    fs.existsSync(unsafeEnvCreatedPath),
    false);

  const dotSegmentEnvOutputRoot = "test-artifacts/tmp/./smoke-report-dot-output-root";
  const dotSegmentEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-dot-output-root");
  fs.rmSync(dotSegmentEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects dot-segment env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: dotSegmentEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("dot-segment env output root rejection does not create output root",
    fs.existsSync(dotSegmentEnvCreatedPath),
    false);

  const repeatedSeparatorEnvOutputRoot = "test-artifacts/tmp//smoke-report-repeated-separator-root";
  const repeatedSeparatorEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-repeated-separator-root");
  fs.rmSync(repeatedSeparatorEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects repeated separator env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: repeatedSeparatorEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("repeated separator env output root rejection does not create output root",
    fs.existsSync(repeatedSeparatorEnvCreatedPath),
    false);

  const whitespaceEnvOutputRoot = " test-artifacts/tmp/smoke-report-whitespace-root";
  const whitespaceEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-whitespace-root");
  fs.rmSync(whitespaceEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects whitespace env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: whitespaceEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("whitespace env output root rejection does not create output root",
    fs.existsSync(whitespaceEnvCreatedPath),
    false);

  const backslashEnvOutputRoot = "test-artifacts\\tmp\\smoke-report-backslash-root";
  const backslashEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-backslash-root");
  fs.rmSync(backslashEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects backslash env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: backslashEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("backslash env output root rejection does not create output root",
    fs.existsSync(backslashEnvCreatedPath),
    false);

  const controlCharEnvOutputRoot = "test-artifacts/tmp/smoke-report-\u0007control-root";
  const controlCharEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-\u0007control-root");
  fs.rmSync(controlCharEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects control character env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: controlCharEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("control character env output root rejection does not create output root",
    fs.existsSync(controlCharEnvCreatedPath),
    false);

  const unicodeWhitespaceEnvOutputRoot = "test-artifacts/tmp/smoke-report-\u00a0unicode-root";
  const unicodeWhitespaceEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-\u00a0unicode-root");
  fs.rmSync(unicodeWhitespaceEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects unicode whitespace env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: unicodeWhitespaceEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("unicode whitespace env output root rejection does not create output root",
    fs.existsSync(unicodeWhitespaceEnvCreatedPath),
    false);

  const unicodeFormatEnvOutputRoot = "test-artifacts/tmp/smoke-report-\u200bformat-root";
  const unicodeFormatEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-\u200bformat-root");
  fs.rmSync(unicodeFormatEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects unicode format env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: unicodeFormatEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("unicode format env output root rejection does not create output root",
    fs.existsSync(unicodeFormatEnvCreatedPath),
    false);

  const unicodeCfEnvOutputRoot = "test-artifacts/tmp/smoke-report-\u061cformat-root";
  const unicodeCfEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-\u061cformat-root");
  fs.rmSync(unicodeCfEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects unicode Cf env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: unicodeCfEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("unicode Cf env output root rejection does not create output root",
    fs.existsSync(unicodeCfEnvCreatedPath),
    false);

  const replacementCharEnvOutputRoot = "test-artifacts/tmp/smoke-report-\ufffdreplacement-root";
  const replacementCharEnvCreatedPath = path.join("test-artifacts", "tmp", "smoke-report-\ufffdreplacement-root");
  fs.rmSync(replacementCharEnvCreatedPath, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects replacement character env output root before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs"], { SMOKE_REPORT_OUTPUT_ROOT: replacementCharEnvOutputRoot }),
    "--output-root must be a relative path under a test-artifacts subdirectory");
  check("replacement character env output root rejection does not create output root",
    fs.existsSync(replacementCharEnvCreatedPath),
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
