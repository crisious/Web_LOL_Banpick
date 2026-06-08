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
  const commonMissingFullRequiredChecks = [
    { label: "/api/samples list entries omit explicit matchId", status: "missing" },
    { label: "/.env is not publicly served", status: "missing" },
    { label: "/.env has X-Content-Type-Options nosniff", status: "missing" },
    { label: "/server.js is not publicly served", status: "missing" },
    { label: "/server.js has X-Content-Type-Options nosniff", status: "missing" },
    { label: "/data/samples/manifest.json is not publicly served", status: "missing" },
    { label: "/data/samples/manifest.json has X-Content-Type-Options nosniff", status: "missing" },
  ];
  const readonlyMissingFullRequiredChecks = [
    ...commonMissingFullRequiredChecks,
    { label: "readonly mode blocks /api/recent-matches", status: "missing" },
    { label: "/api/recent-matches readonly block returns PUBLIC_DEMO_READONLY", status: "missing" },
    { label: "readonly mode blocks /api/champion-history", status: "missing" },
    { label: "/api/champion-history readonly block returns PUBLIC_DEMO_READONLY", status: "missing" },
    { label: "readonly mode blocks /api/generate-sample", status: "missing" },
    { label: "/api/generate-sample readonly block returns PUBLIC_DEMO_READONLY", status: "missing" },
  ];
  const commonMissingFullRequiredCheckFailures = commonMissingFullRequiredChecks.map((check) =>
    `missing required smoke check: ${check.label}`
  );
  const readonlyMissingFullRequiredCheckFailures = readonlyMissingFullRequiredChecks.map((check) =>
    `missing required smoke check: ${check.label}`
  );

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

  checkThrows("parseRunnerArgs rejects whitespace mode value",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode= readonly"], {}),
    "--mode must be one of: readonly, protected, external-readonly, external-protected");

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

  checkThrows("parseRunnerArgs rejects protected inline token with leading whitespace",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=protected", "--token= secret"], {}),
    "--token must not contain whitespace");

  checkThrows("parseRunnerArgs rejects protected env token with trailing whitespace",
    () => runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs", "--mode=protected"], { PUBLIC_DEMO_TOKEN: "env-token " }),
    "PUBLIC_DEMO_TOKEN must not contain whitespace");

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

  const whitespaceModeOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-whitespace-mode");
  fs.rmSync(whitespaceModeOutputRoot, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects whitespace mode before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", "--mode= readonly", `--output-root=${whitespaceModeOutputRoot}`], {}),
    "--mode must be one of: readonly, protected, external-readonly, external-protected");
  check("whitespace mode rejection does not create output root",
    fs.existsSync(whitespaceModeOutputRoot),
    false);

  const missingTokenOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-missing-token");
  fs.rmSync(missingTokenOutputRoot, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects missing protected token before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", "--mode=protected", `--output-root=${missingTokenOutputRoot}`], {}),
    "--require-token needs --token or PUBLIC_DEMO_TOKEN");
  check("missing protected token does not create output root",
    fs.existsSync(missingTokenOutputRoot),
    false);

  const whitespaceTokenOutputRoot = path.join("test-artifacts", "tmp", "smoke-report-whitespace-token");
  fs.rmSync(whitespaceTokenOutputRoot, { recursive: true, force: true });
  await checkRejects("runSmokeReport rejects whitespace token before artifact creation",
    () => runner.runSmokeReport(["node", "scripts/run-smoke-report.mjs", "--mode=protected", `--output-root=${whitespaceTokenOutputRoot}`], { PUBLIC_DEMO_TOKEN: "env-token " }),
    "PUBLIC_DEMO_TOKEN must not contain whitespace");
  check("whitespace token rejection does not create output root",
    fs.existsSync(whitespaceTokenOutputRoot),
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
    gitContext: {
      branch: "main",
      shortSha: "abc1234",
      fullSha: "abc1234def5678",
      dirty: false,
    },
    ciContext: {
      provider: "github-actions",
      repository: "crisious/Web_LOL_Banpick",
      workflow: "QA",
      job: "test-and-smoke",
      runId: "27123905756",
      runAttempt: "1",
      refName: "main",
      sha: "abc1234def5678",
      serverUrl: "https://github.com",
      runUrl: "https://github.com/crisious/Web_LOL_Banpick/actions/runs/27123905756",
    },
    runtimeContext: {
      nodeVersion: "v20.19.5",
      platform: "linux",
      arch: "x64",
    },
    artifactFileSizes: {
      smokeReportBytes: 2048,
      smokeRunBytes: 512,
    },
    artifactFileHashes: {
      smokeReportSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      smokeRunSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
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
        durationMs: 15000,
        git: {
          branch: "main",
          shortSha: "abc1234",
          fullSha: "abc1234def5678",
          dirty: false,
        },
        ci: {
          provider: "github-actions",
          repository: "crisious/Web_LOL_Banpick",
          workflow: "QA",
          job: "test-and-smoke",
          runId: "27123905756",
          runAttempt: "1",
          refName: "main",
          sha: "abc1234def5678",
          serverUrl: "https://github.com",
          runUrl: "https://github.com/crisious/Web_LOL_Banpick/actions/runs/27123905756",
        },
        runtime: {
          nodeVersion: "v20.19.5",
          platform: "linux",
          arch: "x64",
        },
        generator: {
          name: "smoke-report-runner",
          version: 1,
          script: "scripts/run-smoke-report.mjs",
        },
        reportDir: "test-artifacts/qa-automation/2026-06-08T01-15-30Z-external-protected",
        reportJsonPath: "test-artifacts/qa-automation/2026-06-08T01-15-30Z-external-protected/smoke-report.json",
        smokeRunJsonPath: "test-artifacts/qa-automation/2026-06-08T01-15-30Z-external-protected/smoke-run.json",
        artifactRelativePaths: {
          qaSummary: "qa-summary.json",
          smokeReport: "2026-06-08T01-15-30Z-external-protected/smoke-report.json",
          smokeRun: "2026-06-08T01-15-30Z-external-protected/smoke-run.json",
        },
        artifactFileSizes: {
          smokeReportBytes: 2048,
          smokeRunBytes: 512,
        },
        artifactFileHashes: {
          smokeReportSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          smokeRunSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
        artifactIntegrity: {
          status: "passed",
          smokeReport: {
            bytesPresent: true,
            sha256Present: true,
          },
          smokeRun: {
            bytesPresent: true,
            sha256Present: true,
          },
          failures: [],
        },
        smokeSummary: { passed: 42, failed: 0 },
        checkCount: 1,
        requiredChecks: commonMissingFullRequiredChecks,
        requiredCheckStatus: "failed",
        requiredCheckSummary: {
          total: 7,
          passed: 0,
          failed: 0,
          missing: 7,
        },
        requiredCheckFailures: commonMissingFullRequiredCheckFailures,
      },
    });

  check("protected smoke reports require common checks only",
    runner.requiredSmokeCheckResults?.(protectedConfig, { checks: [] }),
    commonMissingFullRequiredChecks);

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

  const missingRequiredCheckConfig = runner.parseRunnerArgs(["node", "scripts/run-smoke-report.mjs"], {});
  const missingRequiredCheckReport = {
    status: "passed",
    actualMode: "readonly",
    summary: { passed: 42, failed: 0 },
    checks: [{ status: "pass", label: "GET /healthz returns 200" }],
  };

  check("validateRequiredSmokeChecks reports missing full smoke security checks",
    runner.validateRequiredSmokeChecks?.(missingRequiredCheckConfig, missingRequiredCheckReport),
    readonlyMissingFullRequiredCheckFailures);

  const passingRequiredCheckReport = {
    status: "passed",
    actualMode: "readonly",
    summary: { passed: 43, failed: 0 },
    checks: [
      { status: "pass", label: "GET /healthz returns 200" },
      { status: "pass", label: "/api/samples list entries omit explicit matchId" },
      { status: "pass", label: "/.env is not publicly served" },
      { status: "pass", label: "/.env has X-Content-Type-Options nosniff" },
      { status: "pass", label: "/server.js is not publicly served" },
      { status: "pass", label: "/server.js has X-Content-Type-Options nosniff" },
      { status: "pass", label: "/data/samples/manifest.json is not publicly served" },
      { status: "pass", label: "/data/samples/manifest.json has X-Content-Type-Options nosniff" },
      { status: "pass", label: "readonly mode blocks /api/recent-matches" },
      { status: "pass", label: "/api/recent-matches readonly block returns PUBLIC_DEMO_READONLY" },
      { status: "pass", label: "readonly mode blocks /api/champion-history" },
      { status: "pass", label: "/api/champion-history readonly block returns PUBLIC_DEMO_READONLY" },
      { status: "pass", label: "readonly mode blocks /api/generate-sample" },
      { status: "pass", label: "/api/generate-sample readonly block returns PUBLIC_DEMO_READONLY" },
    ],
  };

  check("validateRequiredSmokeChecks passes when full smoke security checks are present",
    runner.validateRequiredSmokeChecks?.(missingRequiredCheckConfig, passingRequiredCheckReport),
    []);

  const passingRequiredSummary = runner.buildQaSummary?.({
    config: missingRequiredCheckConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T06-35-00Z-readonly",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-35-00Z-readonly/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T06-35-00Z-readonly/smoke-run.json",
    startedAt: "2026-06-08T06:35:00.000Z",
    finishedAt: "2026-06-08T06:35:10.000Z",
    exitCode: 0,
    gitContext: {
      branch: "main",
      shortSha: "feed123",
      fullSha: "feed1234567890abcdef",
      dirty: true,
    },
    ciContext: {
      provider: "github-actions",
      repository: "crisious/Web_LOL_Banpick",
      workflow: "QA",
      job: "test-and-smoke",
      runId: "27124000000",
      runAttempt: "2",
      refName: "main",
      sha: "feed1234567890abcdef",
      serverUrl: "https://github.com",
      runUrl: "https://github.com/crisious/Web_LOL_Banpick/actions/runs/27124000000",
    },
    runtimeContext: {
      nodeVersion: "v22.16.0",
      platform: "darwin",
      arch: "arm64",
    },
    artifactFileSizes: {
      smokeReportBytes: 4096,
      smokeRunBytes: 768,
    },
    artifactFileHashes: {
      smokeReportSha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      smokeRunSha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    },
    smokeReport: passingRequiredCheckReport,
  });

  check("buildQaSummary records artifact-relative smoke paths",
    passingRequiredSummary?.latestRun?.artifactRelativePaths,
    {
      qaSummary: "qa-summary.json",
      smokeReport: "2026-06-08T06-35-00Z-readonly/smoke-report.json",
      smokeRun: "2026-06-08T06-35-00Z-readonly/smoke-run.json",
    });

  check("buildQaSummary records artifact file sizes",
    passingRequiredSummary?.latestRun?.artifactFileSizes,
    {
      smokeReportBytes: 4096,
      smokeRunBytes: 768,
    });

  check("buildQaSummary records artifact file hashes",
    passingRequiredSummary?.latestRun?.artifactFileHashes,
    {
      smokeReportSha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      smokeRunSha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    });

  check("buildQaSummary records passing artifact integrity",
    passingRequiredSummary?.latestRun?.artifactIntegrity,
    {
      status: "passed",
      smokeReport: {
        bytesPresent: true,
        sha256Present: true,
      },
      smokeRun: {
        bytesPresent: true,
        sha256Present: true,
      },
      failures: [],
    });

  check("buildQaSummary records generator metadata",
    passingRequiredSummary?.latestRun?.generator,
    {
      name: "smoke-report-runner",
      version: 1,
      script: "scripts/run-smoke-report.mjs",
    });

  check("buildQaSummary records run duration in milliseconds",
    passingRequiredSummary?.latestRun?.durationMs,
    10000);

  check("buildQaSummary records supplied git context",
    passingRequiredSummary?.latestRun?.git,
    {
      branch: "main",
      shortSha: "feed123",
      fullSha: "feed1234567890abcdef",
      dirty: true,
    });

  check("buildQaSummary records supplied CI context",
    passingRequiredSummary?.latestRun?.ci,
    {
      provider: "github-actions",
      repository: "crisious/Web_LOL_Banpick",
      workflow: "QA",
      job: "test-and-smoke",
      runId: "27124000000",
      runAttempt: "2",
      refName: "main",
      sha: "feed1234567890abcdef",
      serverUrl: "https://github.com",
      runUrl: "https://github.com/crisious/Web_LOL_Banpick/actions/runs/27124000000",
    });

  check("buildQaSummary records supplied runtime context",
    passingRequiredSummary?.latestRun?.runtime,
    {
      nodeVersion: "v22.16.0",
      platform: "darwin",
      arch: "arm64",
    });

  check("ciContextFor returns empty context outside GitHub Actions",
    runner.ciContextFor?.({}),
    {
      provider: "",
      repository: "",
      workflow: "",
      job: "",
      runId: "",
      runAttempt: "",
      refName: "",
      sha: "",
      serverUrl: "",
      runUrl: "",
    });

  check("ciContextFor records GitHub Actions run metadata",
    runner.ciContextFor?.({
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "crisious/Web_LOL_Banpick",
      GITHUB_WORKFLOW: "QA",
      GITHUB_JOB: "test-and-smoke",
      GITHUB_RUN_ID: "27123905756",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_REF_NAME: "main",
      GITHUB_SHA: "abc1234def5678",
      GITHUB_SERVER_URL: "https://github.com",
    }),
    {
      provider: "github-actions",
      repository: "crisious/Web_LOL_Banpick",
      workflow: "QA",
      job: "test-and-smoke",
      runId: "27123905756",
      runAttempt: "1",
      refName: "main",
      sha: "abc1234def5678",
      serverUrl: "https://github.com",
      runUrl: "https://github.com/crisious/Web_LOL_Banpick/actions/runs/27123905756",
    });

  check("runtimeContextFor records current Node runtime",
    runner.runtimeContextFor?.({ version: "v20.19.5", platform: "linux", arch: "x64" }),
    {
      nodeVersion: "v20.19.5",
      platform: "linux",
      arch: "x64",
    });

  const artifactSizeFixtureRoot = path.join("test-artifacts", "tmp", "smoke-report-artifact-size-fixture");
  const artifactSizeReportPath = path.join(artifactSizeFixtureRoot, "smoke-report.json");
  const artifactSizeMetadataPath = path.join(artifactSizeFixtureRoot, "smoke-run.json");
  fs.rmSync(artifactSizeFixtureRoot, { recursive: true, force: true });
  fs.mkdirSync(artifactSizeFixtureRoot, { recursive: true });
  fs.writeFileSync(artifactSizeReportPath, "1234567890", "utf8");
  fs.writeFileSync(artifactSizeMetadataPath, "abc", "utf8");
  check("artifactFileSizesFor records smoke artifact byte sizes",
    runner.artifactFileSizesFor?.(artifactSizeReportPath, artifactSizeMetadataPath),
    {
      smokeReportBytes: 10,
      smokeRunBytes: 3,
      });
  fs.rmSync(artifactSizeFixtureRoot, { recursive: true, force: true });

  const artifactHashFixtureRoot = path.join("test-artifacts", "tmp", "smoke-report-artifact-hash-fixture");
  const artifactHashReportPath = path.join(artifactHashFixtureRoot, "smoke-report.json");
  const artifactHashMetadataPath = path.join(artifactHashFixtureRoot, "smoke-run.json");
  fs.rmSync(artifactHashFixtureRoot, { recursive: true, force: true });
  fs.mkdirSync(artifactHashFixtureRoot, { recursive: true });
  fs.writeFileSync(artifactHashReportPath, "abc", "utf8");
  fs.writeFileSync(artifactHashMetadataPath, "123", "utf8");
  check("artifactFileHashesFor records smoke artifact SHA-256 hashes",
    runner.artifactFileHashesFor?.(artifactHashReportPath, artifactHashMetadataPath),
    {
      smokeReportSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      smokeRunSha256: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    });
  fs.rmSync(artifactHashFixtureRoot, { recursive: true, force: true });

  check("buildQaSummary records passing required check summary",
    passingRequiredSummary?.latestRun?.requiredCheckSummary,
    {
      total: 13,
      passed: 13,
      failed: 0,
      missing: 0,
    });

  check("buildQaSummary records passing required check status",
    passingRequiredSummary?.latestRun?.requiredCheckStatus,
    "passed");

  check("buildQaSummary records no required check failures when required checks pass",
    passingRequiredSummary?.latestRun?.requiredCheckFailures,
    []);

  const missingRequiredSummary = runner.buildQaSummary?.({
    config: missingRequiredCheckConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly/smoke-run.json",
    startedAt: "2026-06-08T06:30:00.000Z",
    finishedAt: "2026-06-08T06:30:10.000Z",
    exitCode: 0,
    smokeReport: missingRequiredCheckReport,
  });

  const missingArtifactSummary = runner.buildQaSummary?.({
    config: missingRequiredCheckConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly/smoke-run.json",
    startedAt: "2026-06-08T06:40:00.000Z",
    finishedAt: "2026-06-08T06:40:10.000Z",
    exitCode: 0,
    smokeReport: passingRequiredCheckReport,
  });

  check("buildQaSummary records failed artifact integrity when artifact metadata is missing",
    missingArtifactSummary?.latestRun?.artifactIntegrity,
    {
      status: "failed",
      smokeReport: {
        bytesPresent: false,
        sha256Present: false,
      },
      smokeRun: {
        bytesPresent: false,
        sha256Present: false,
      },
      failures: [
        "smoke-report artifact is empty or missing",
        "smoke-report artifact SHA-256 is missing",
        "smoke-run artifact is empty or missing",
        "smoke-run artifact SHA-256 is missing",
      ],
    });

  check("buildQaSummary records missing required smoke checks",
    missingRequiredSummary?.latestRun?.requiredChecks,
    readonlyMissingFullRequiredChecks);

  check("buildQaSummary records missing required check summary",
    missingRequiredSummary?.latestRun?.requiredCheckSummary,
    {
      total: 13,
      passed: 0,
      failed: 0,
      missing: 13,
    });

  check("buildQaSummary records missing required check status",
    missingRequiredSummary?.latestRun?.requiredCheckStatus,
    "failed");

  check("buildQaSummary records missing required check failures",
    missingRequiredSummary?.latestRun?.requiredCheckFailures,
    readonlyMissingFullRequiredCheckFailures);

  const mixedRequiredSummary = runner.buildQaSummary?.({
    config: missingRequiredCheckConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T06-40-00Z-readonly/smoke-run.json",
    startedAt: "2026-06-08T06:40:00.000Z",
    finishedAt: "2026-06-08T06:40:10.000Z",
    exitCode: 1,
    smokeReport: {
      status: "failed",
      actualMode: "readonly",
      summary: { passed: 41, failed: 1 },
      checks: [
        { status: "pass", label: "/api/samples list entries omit explicit matchId" },
        { status: "fail", label: "/.env is not publicly served" },
      ],
    },
  });

  check("buildQaSummary records mixed required check summary",
    mixedRequiredSummary?.latestRun?.requiredCheckSummary,
    {
      total: 13,
      passed: 1,
      failed: 1,
      missing: 11,
    });

  check("buildQaSummary records mixed required check status",
    mixedRequiredSummary?.latestRun?.requiredCheckStatus,
    "failed");

  check("buildQaSummary records mixed required check failures",
    mixedRequiredSummary?.latestRun?.requiredCheckFailures,
    [
      "required smoke check failed: /.env is not publicly served",
      "missing required smoke check: /.env has X-Content-Type-Options nosniff",
      "missing required smoke check: /server.js is not publicly served",
      "missing required smoke check: /server.js has X-Content-Type-Options nosniff",
      "missing required smoke check: /data/samples/manifest.json is not publicly served",
      "missing required smoke check: /data/samples/manifest.json has X-Content-Type-Options nosniff",
      "missing required smoke check: readonly mode blocks /api/recent-matches",
      "missing required smoke check: /api/recent-matches readonly block returns PUBLIC_DEMO_READONLY",
      "missing required smoke check: readonly mode blocks /api/champion-history",
      "missing required smoke check: /api/champion-history readonly block returns PUBLIC_DEMO_READONLY",
      "missing required smoke check: readonly mode blocks /api/generate-sample",
      "missing required smoke check: /api/generate-sample readonly block returns PUBLIC_DEMO_READONLY",
    ]);

  const sampleListErrorConfig = runner.parseRunnerArgs([
    "node",
    "scripts/run-smoke-report.mjs",
    "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
  ], {});

  check("sample list error smoke reports skip full-run required checks",
    runner.validateRequiredSmokeChecks?.(sampleListErrorConfig, missingRequiredCheckReport),
    []);

  const sampleListErrorSummary = runner.buildQaSummary?.({
    config: sampleListErrorConfig,
    reportDir: "test-artifacts/qa-automation/2026-06-08T06-45-00Z-readonly",
    reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-45-00Z-readonly/smoke-report.json",
    metadataPath: "test-artifacts/qa-automation/2026-06-08T06-45-00Z-readonly/smoke-run.json",
    startedAt: "2026-06-08T06:45:00.000Z",
    finishedAt: "2026-06-08T06:45:10.000Z",
    exitCode: 0,
    smokeReport: missingRequiredCheckReport,
  });

  check("sample list error smoke reports record zero required check summary",
    sampleListErrorSummary?.latestRun?.requiredCheckSummary,
    {
      total: 0,
      passed: 0,
      failed: 0,
      missing: 0,
    });

  check("sample list error smoke reports record skipped required check status",
    sampleListErrorSummary?.latestRun?.requiredCheckStatus,
    "skipped");

  check("sample list error smoke reports record no required check failures",
    sampleListErrorSummary?.latestRun?.requiredCheckFailures,
    []);

  check("buildQaSummary prefers runner exit status over passed smoke report status",
    runner.buildQaSummary?.({
      config: missingRequiredCheckConfig,
      reportDir: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly",
      reportJsonPath: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly/smoke-report.json",
      metadataPath: "test-artifacts/qa-automation/2026-06-08T06-30-00Z-readonly/smoke-run.json",
      startedAt: "2026-06-08T06:30:00.000Z",
      finishedAt: "2026-06-08T06:30:10.000Z",
      exitCode: 1,
      smokeReport: passingRequiredCheckReport,
    })?.latestRun?.status,
    "failed");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
