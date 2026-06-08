#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { redactUrlForEvidence } from "../lib/qa-evidence-redaction.mjs";
import { validateExternalSmokeUrl } from "./validate-external-smoke-url.mjs";

const LOCAL_BASE_URL = "http://127.0.0.1:8123";
const DEFAULT_OUTPUT_ROOT = "test-artifacts/qa-automation";
const MIN_SAMPLES = 19;
const VALID_MODES = ["readonly", "protected", "external-readonly", "external-protected"];
const SMOKE_PASSTHROUGH_VALUE_OPTIONS = [
  "--token=",
  "--timeout-ms=",
  "--expect-sample-detail-error-id=",
  "--expect-sample-detail-error-status=",
  "--expect-sample-detail-error-code=",
  "--expect-sample-detail-error-message=",
  "--expect-sample-list-error-status=",
  "--expect-sample-list-error-code=",
  "--expect-sample-list-error-message=",
];
const SAMPLE_DETAIL_ERROR_OPTIONS = [
  "--expect-sample-detail-error-id=",
  "--expect-sample-detail-error-status=",
  "--expect-sample-detail-error-code=",
  "--expect-sample-detail-error-message=",
];
const SAMPLE_LIST_ERROR_OPTIONS = [
  "--expect-sample-list-error-status=",
  "--expect-sample-list-error-code=",
  "--expect-sample-list-error-message=",
];
const COMMON_REQUIRED_FULL_SMOKE_CHECK_LABELS = [
  "/api/samples list entries omit explicit matchId",
  "/.env is not publicly served",
  "/.env has X-Content-Type-Options nosniff",
  "/server.js is not publicly served",
  "/server.js has X-Content-Type-Options nosniff",
  "/data/samples/manifest.json is not publicly served",
  "/data/samples/manifest.json has X-Content-Type-Options nosniff",
];
const READONLY_REQUIRED_FULL_SMOKE_CHECK_LABELS = [
  "readonly mode blocks /api/recent-matches",
  "/api/recent-matches readonly block returns PUBLIC_DEMO_READONLY",
  "readonly mode blocks /api/champion-history",
  "/api/champion-history readonly block returns PUBLIC_DEMO_READONLY",
  "readonly mode blocks /api/generate-sample",
  "/api/generate-sample readonly block returns PUBLIC_DEMO_READONLY",
];
const SMOKE_METADATA_MESSAGE_REDACTION_PREFIXES = [
  "--expect-sample-detail-error-message=",
  "--expect-sample-list-error-message=",
];
const SAMPLE_ERROR_ID_PATTERN = /^sample-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAMPLE_ERROR_CODE_PATTERN = /^[A-Z0-9_]+$/;

function assertSampleErrorId(value, optionName) {
  if (!SAMPLE_ERROR_ID_PATTERN.test(value)) {
    throw new Error(`${optionName} must match sample-[a-z0-9]+(-[a-z0-9]+)*`);
  }
}

function assertSampleErrorCode(value, optionName) {
  if (!SAMPLE_ERROR_CODE_PATTERN.test(value)) {
    throw new Error(`${optionName} must match [A-Z0-9_]+`);
  }
}

function singleOptionArg(args, prefix) {
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) {
    throw new Error(`${prefix.slice(0, -1)} accepts only one value`);
  }
  return matches[0];
}

function passThroughOptionArg(args, prefix) {
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) {
    throw new Error(`${prefix.slice(0, -1)} accepts only one value`);
  }
  return matches[0];
}

function normalizeOutputRoot(outputRoot) {
  const raw = outputRoot;
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("--output-root needs a directory path");
  }
  if (trimmed !== raw) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
  if (raw.includes("\\")) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
  if (/[\u0000-\u001f\u007f]/.test(raw)) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
  if (/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/u.test(raw)) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
  if (/\p{Cf}/u.test(raw)) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
  if (/[\ufffd]|\p{Cs}/u.test(raw)) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
  const comparable = raw.replace(/\\/g, "/");
  const rawSegments = comparable.split("/");
  if (path.isAbsolute(raw) || path.win32.isAbsolute(raw) || comparable.includes("//") || rawSegments.includes(".") || rawSegments.includes("..")) {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
  const normalized = path.posix.normalize(comparable);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 2 || parts[0] !== "test-artifacts") {
    throw new Error("--output-root must be a relative path under a test-artifacts subdirectory");
  }
  return parts.join("/");
}

function assertPositiveIntegerOption(args, prefix, message) {
  const arg = passThroughOptionArg(args, prefix);
  if (!arg) return;
  const rawValue = arg.slice(prefix.length);
  if (!/^[0-9]+$/.test(rawValue)) {
    throw new Error(message);
  }
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(message);
  }
}

function assertHttpErrorStatusOption(args, prefix) {
  const arg = passThroughOptionArg(args, prefix);
  if (!arg) return;
  const rawValue = arg.slice(prefix.length);
  const optionName = prefix.slice(0, -1);
  if (!/^[0-9]+$/.test(rawValue)) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  if (value < 400 || value > 599) {
    throw new Error(`${optionName} must be an HTTP error status (400-599)`);
  }
}

function parseDemoTokenValue(rawToken, sourceName) {
  if (!rawToken || rawToken.trim() === "") {
    return "";
  }
  if (rawToken.trim() !== rawToken || /\s/u.test(rawToken)) {
    throw new Error(`${sourceName} must not contain whitespace`);
  }
  return rawToken;
}

function inlineTokenValue(extraSmokeArgs) {
  const tokenArg = passThroughOptionArg(extraSmokeArgs, "--token=");
  return tokenArg ? parseDemoTokenValue(tokenArg.slice("--token=".length), "--token") : "";
}

function validateExtraSmokeArgs(extraSmokeArgs) {
  for (const arg of extraSmokeArgs) {
    if (SMOKE_PASSTHROUGH_VALUE_OPTIONS.some((prefix) => arg.startsWith(prefix))) continue;
    throw new Error(`unknown smoke report option: ${arg}`);
  }

  for (const prefix of SMOKE_PASSTHROUGH_VALUE_OPTIONS) {
    passThroughOptionArg(extraSmokeArgs, prefix);
  }
  assertPositiveIntegerOption(extraSmokeArgs, "--timeout-ms=", "--timeout-ms must be a positive integer");
  assertHttpErrorStatusOption(extraSmokeArgs, "--expect-sample-detail-error-status=");
  assertHttpErrorStatusOption(extraSmokeArgs, "--expect-sample-list-error-status=");

  const hasSampleDetailErrorArg = SAMPLE_DETAIL_ERROR_OPTIONS.some((prefix) => extraSmokeArgs.some((arg) => arg.startsWith(prefix)));
  if (hasSampleDetailErrorArg) {
    const id = passThroughOptionArg(extraSmokeArgs, "--expect-sample-detail-error-id=")?.slice("--expect-sample-detail-error-id=".length).trim() || "";
    const code = passThroughOptionArg(extraSmokeArgs, "--expect-sample-detail-error-code=")?.slice("--expect-sample-detail-error-code=".length).trim() || "";
    if (!id) throw new Error("--expect-sample-detail-error-id is required when sample detail error options are set");
    if (!code) throw new Error("--expect-sample-detail-error-code is required when --expect-sample-detail-error-id is set");
    assertSampleErrorId(id, "--expect-sample-detail-error-id");
    assertSampleErrorCode(code, "--expect-sample-detail-error-code");
  }

  const hasSampleListErrorArg = SAMPLE_LIST_ERROR_OPTIONS.some((prefix) => extraSmokeArgs.some((arg) => arg.startsWith(prefix)));
  if (hasSampleListErrorArg) {
    const code = passThroughOptionArg(extraSmokeArgs, "--expect-sample-list-error-code=")?.slice("--expect-sample-list-error-code=".length).trim() || "";
    if (!code) throw new Error("--expect-sample-list-error-code is required when sample list error options are set");
    assertSampleErrorCode(code, "--expect-sample-list-error-code");
  }
}

export function parseRunnerArgs(argv, env = {}) {
  const args = argv.slice(2);
  const modeArg = singleOptionArg(args, "--mode=");
  const outputRootArg = singleOptionArg(args, "--output-root=");
  const mode = modeArg ? modeArg.slice("--mode=".length) : "readonly";
  if (!VALID_MODES.includes(mode)) {
    throw new Error("--mode must be one of: " + VALID_MODES.join(", "));
  }

  const outputRoot = normalizeOutputRoot(outputRootArg
    ? outputRootArg.slice("--output-root=".length)
    : env.SMOKE_REPORT_OUTPUT_ROOT || DEFAULT_OUTPUT_ROOT);

  const knownOptionArgs = new Set([modeArg, outputRootArg].filter(Boolean));
  const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
  if (positionalArgs.length > 1) {
    throw new Error(`${mode} smoke report accepts only one base URL argument`);
  }
  const extraSmokeArgs = args.filter((arg) => arg.startsWith("--") && !knownOptionArgs.has(arg));
  validateExtraSmokeArgs(extraSmokeArgs);
  const isExternal = mode.startsWith("external-");
  const isProtected = mode.endsWith("protected") || mode === "protected";
  const expectedMode = isProtected ? "protected" : "readonly";
  const baseUrl = positionalArgs[0] || LOCAL_BASE_URL;

  if (isExternal && !positionalArgs[0]) {
    throw new Error(`${mode} smoke report needs an explicit base URL`);
  }

  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error(`${mode} smoke report needs an http(s) base URL`);
  }

  if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
    throw new Error(`${mode} smoke report needs an http(s) base URL`);
  }
  if (isExternal && parsedBaseUrl.protocol !== "https:") {
    throw new Error(`${mode} smoke report needs an https:// base URL`);
  }
  if (isExternal) {
    validateExternalSmokeUrl(isProtected ? "external_protected_url" : "external_readonly_url", baseUrl);
  }
  const tokenArg = passThroughOptionArg(extraSmokeArgs, "--token=");
  if (!isProtected && tokenArg) {
    throw new Error("--token is only accepted for protected smoke reports");
  }
  if (isProtected) {
    const demoToken = tokenArg ? inlineTokenValue(extraSmokeArgs) : parseDemoTokenValue(env.PUBLIC_DEMO_TOKEN || "", "PUBLIC_DEMO_TOKEN");
    if (!demoToken) {
      throw new Error("--require-token needs --token or PUBLIC_DEMO_TOKEN");
    }
  }

  return {
    mode,
    baseUrl,
    expectedMode,
    outputRoot,
    requiresUrl: isExternal,
    requiresHttps: isExternal,
    requiresToken: isProtected,
    extraSmokeArgs,
  };
}

export function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
}

export function reportDirectoryFor(outputRoot, mode, date = new Date()) {
  return path.join(outputRoot, `${timestampSlug(date)}-${mode}`);
}

export function smokeArgsFor(config, reportJsonPath) {
  return [
    "scripts/external-demo-smoke.mjs",
    config.baseUrl,
    ...(config.requiresUrl ? ["--require-url"] : []),
    ...(config.requiresHttps ? ["--require-https"] : []),
    ...(config.requiresToken ? ["--require-token"] : []),
    `--expect-mode=${config.expectedMode}`,
    `--min-samples=${MIN_SAMPLES}`,
    ...config.extraSmokeArgs,
    `--report-json=${reportJsonPath}`,
  ];
}

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

function redactSmokeMessageArg(arg) {
  return arg
    .replace(/https?:\/\/[^\s"'<>]+/gi, (url) => redactUrlForEvidence(url))
    .replace(/access_token=[^\s"'<>]+/gi, "access_token=<redacted>")
    .replace(/token=[^\s"'<>]+/gi, "token=<redacted>")
    .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer <redacted>");
}

export function qaSummaryPathFor(outputRoot) {
  return path.join(outputRoot, "qa-summary.json");
}

function isEarlySampleErrorProbe(config) {
  return (config?.extraSmokeArgs || []).some((arg) =>
    SAMPLE_DETAIL_ERROR_OPTIONS.some((prefix) => arg.startsWith(prefix)) ||
    SAMPLE_LIST_ERROR_OPTIONS.some((prefix) => arg.startsWith(prefix))
  );
}

function requiredFullSmokeCheckLabelsFor(config) {
  if (isEarlySampleErrorProbe(config)) return [];
  return [
    ...COMMON_REQUIRED_FULL_SMOKE_CHECK_LABELS,
    ...(config?.expectedMode === "readonly" ? READONLY_REQUIRED_FULL_SMOKE_CHECK_LABELS : []),
  ];
}

export function requiredSmokeCheckResults(config, smokeReport) {
  const checks = Array.isArray(smokeReport?.checks) ? smokeReport.checks : [];
  return requiredFullSmokeCheckLabelsFor(config).map((label) => {
    const check = checks.find((item) => item?.label === label);
    if (!check) return { label, status: "missing" };
    return { label, status: check.status === "pass" ? "pass" : "fail" };
  });
}

function summarizeRequiredSmokeChecks(requiredChecks) {
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    missing: 0,
  };
  for (const check of requiredChecks) {
    summary.total += 1;
    if (check?.status === "pass") {
      summary.passed += 1;
    } else if (check?.status === "fail") {
      summary.failed += 1;
    } else {
      summary.missing += 1;
    }
  }
  return summary;
}

function requiredSmokeCheckStatus(requiredChecks) {
  if (!requiredChecks.length) return "skipped";
  return requiredChecks.every((check) => check?.status === "pass") ? "passed" : "failed";
}

function requiredSmokeCheckFailureMessages(requiredChecks) {
  return requiredChecks
    .filter((check) => check.status !== "pass")
    .map((check) =>
      check.status === "missing"
        ? `missing required smoke check: ${check.label}`
        : `required smoke check failed: ${check.label}`
    );
}

export function validateRequiredSmokeChecks(config, smokeReport) {
  return requiredSmokeCheckFailureMessages(requiredSmokeCheckResults(config, smokeReport));
}

function artifactJsonPath(value) {
  return value.split(path.sep).join("/");
}

function artifactRelativePathsFor(reportDir, reportJsonPath, metadataPath) {
  const outputRoot = path.dirname(reportDir);
  return {
    qaSummary: "qa-summary.json",
    smokeReport: artifactJsonPath(path.relative(outputRoot, reportJsonPath)),
    smokeRun: artifactJsonPath(path.relative(outputRoot, metadataPath)),
  };
}

function fileSizeBytes(filePath) {
  try {
    const size = fs.statSync(filePath).size;
    return Number.isSafeInteger(size) && size > 0 ? size : 0;
  } catch {
    return 0;
  }
}

function emptyArtifactFileSizes() {
  return {
    smokeReportBytes: 0,
    smokeRunBytes: 0,
  };
}

export function artifactFileSizesFor(reportJsonPath, metadataPath) {
  return {
    smokeReportBytes: fileSizeBytes(reportJsonPath),
    smokeRunBytes: fileSizeBytes(metadataPath),
  };
}

function runDurationMs(startedAt, finishedAt) {
  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished)) return 0;
  return Math.max(0, finished - started);
}

function gitOutput(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function gitContextFor(cwd = process.cwd()) {
  try {
    const branch = gitOutput(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    const shortSha = gitOutput(["rev-parse", "--short", "HEAD"], cwd);
    const fullSha = gitOutput(["rev-parse", "HEAD"], cwd);
    const status = gitOutput(["status", "--porcelain"], cwd);
    return {
      branch,
      shortSha,
      fullSha,
      dirty: status.length > 0,
    };
  } catch {
    return {
      branch: "",
      shortSha: "",
      fullSha: "",
      dirty: false,
    };
  }
}

function emptyCiContext() {
  return {
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
  };
}

function ciText(value) {
  if (typeof value !== "string" || !value) return "";
  return redactSmokeMessageArg(value).replace(/[\u0000-\u001f\u007f]/g, "");
}

function githubRunUrlFor(serverUrl, repository, runId) {
  if (!/^https?:\/\//.test(serverUrl) || !repository || !runId) return "";
  return `${serverUrl.replace(/\/$/, "")}/${repository}/actions/runs/${runId}`;
}

export function ciContextFor(env = process.env) {
  if (env?.GITHUB_ACTIONS !== "true") return emptyCiContext();
  const serverUrl = redactUrlForEvidence(env.GITHUB_SERVER_URL || "https://github.com");
  const repository = ciText(env.GITHUB_REPOSITORY);
  const runId = ciText(env.GITHUB_RUN_ID);
  return {
    provider: "github-actions",
    repository,
    workflow: ciText(env.GITHUB_WORKFLOW),
    job: ciText(env.GITHUB_JOB),
    runId,
    runAttempt: ciText(env.GITHUB_RUN_ATTEMPT),
    refName: ciText(env.GITHUB_REF_NAME),
    sha: ciText(env.GITHUB_SHA),
    serverUrl,
    runUrl: githubRunUrlFor(serverUrl, repository, runId),
  };
}

function emptyRuntimeContext() {
  return {
    nodeVersion: "",
    platform: "",
    arch: "",
  };
}

export function runtimeContextFor(runtimeProcess = process) {
  const nodeVersion = typeof runtimeProcess?.nodeVersion === "string"
    ? runtimeProcess.nodeVersion
    : runtimeProcess?.version;
  return {
    nodeVersion: ciText(nodeVersion),
    platform: ciText(runtimeProcess?.platform),
    arch: ciText(runtimeProcess?.arch),
  };
}

export function buildQaSummary({
  config,
  reportDir,
  reportJsonPath,
  metadataPath,
  startedAt,
  finishedAt,
  exitCode,
  gitContext = null,
  ciContext = null,
  runtimeContext = null,
  artifactFileSizes = null,
  smokeReport = null,
}) {
  const requiredChecks = requiredSmokeCheckResults(config, smokeReport);
  return {
    schemaVersion: 1,
    generatedAt: finishedAt,
    latestRun: {
      mode: config.mode,
      baseUrl: redactUrlForEvidence(config.baseUrl),
      expectedMode: config.expectedMode,
      actualMode: smokeReport?.actualMode || "",
      status: exitCode ? "failed" : (smokeReport?.status || "passed"),
      exitCode,
      startedAt,
      finishedAt,
      durationMs: runDurationMs(startedAt, finishedAt),
      git: gitContext || {
        branch: "",
        shortSha: "",
        fullSha: "",
        dirty: false,
      },
      ci: ciContext || emptyCiContext(),
      runtime: runtimeContext || emptyRuntimeContext(),
      reportDir,
      reportJsonPath,
      smokeRunJsonPath: metadataPath,
      artifactRelativePaths: artifactRelativePathsFor(reportDir, reportJsonPath, metadataPath),
      artifactFileSizes: artifactFileSizes || emptyArtifactFileSizes(),
      smokeSummary: smokeReport?.summary || null,
      checkCount: Array.isArray(smokeReport?.checks) ? smokeReport.checks.length : 0,
      requiredChecks,
      requiredCheckStatus: requiredSmokeCheckStatus(requiredChecks),
      requiredCheckSummary: summarizeRequiredSmokeChecks(requiredChecks),
      requiredCheckFailures: requiredSmokeCheckFailureMessages(requiredChecks),
    },
  };
}

function writeRunMetadata(metadataPath, payload) {
  fs.writeFileSync(metadataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export async function runSmokeReport(argv = process.argv, env = process.env) {
  const startedAt = new Date().toISOString();
  const config = parseRunnerArgs(argv, env);
  const reportDir = reportDirectoryFor(config.outputRoot, config.mode, new Date(startedAt));
  const reportJsonPath = path.join(reportDir, "smoke-report.json");
  const metadataPath = path.join(reportDir, "smoke-run.json");
  const qaSummaryPath = qaSummaryPathFor(config.outputRoot);
  const smokeArgs = smokeArgsFor(config, reportJsonPath);

  fs.mkdirSync(reportDir, { recursive: true });

  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, smokeArgs, { stdio: "inherit", env });
    child.on("error", (error) => {
      console.error(`FAIL smoke report runner failed to start smoke: ${error.message || error}`);
      resolve(1);
    });
    child.on("close", (status) => resolve(status ?? 1));
  });

  const finishedAt = new Date().toISOString();
  const smokeReport = readJsonIfExists(reportJsonPath);
  const requiredCheckFailures = exitCode === 0
    ? validateRequiredSmokeChecks(config, smokeReport)
    : [];
  const finalExitCode = requiredCheckFailures.length ? 1 : exitCode;
  for (const message of requiredCheckFailures) {
    console.error(`FAIL ${message}`);
  }

  writeRunMetadata(metadataPath, {
    schemaVersion: 1,
    mode: config.mode,
    baseUrl: redactUrlForEvidence(config.baseUrl),
    reportJsonPath,
    startedAt,
    finishedAt,
    exitCode: finalExitCode,
    command: [process.execPath, ...redactSmokeArgs(smokeArgs)],
  });
  writeRunMetadata(qaSummaryPath, buildQaSummary({
    config,
    reportDir,
    reportJsonPath,
    metadataPath,
    startedAt,
    finishedAt,
    exitCode: finalExitCode,
    gitContext: gitContextFor(process.cwd()),
    ciContext: ciContextFor(env),
    runtimeContext: runtimeContextFor(process),
    artifactFileSizes: artifactFileSizesFor(reportJsonPath, metadataPath),
    smokeReport,
  }));

  console.log(`Smoke report directory: ${reportDir}`);
  return finalExitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const exitCode = await runSmokeReport(process.argv, process.env);
    process.exit(exitCode);
  } catch (error) {
    console.error(`FAIL ${error.message || error}`);
    process.exit(1);
  }
}
