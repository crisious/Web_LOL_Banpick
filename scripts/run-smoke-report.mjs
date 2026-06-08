#!/usr/bin/env node

import { spawn } from "node:child_process";
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
  const value = Number(arg.slice(prefix.length));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(message);
  }
}

function inlineTokenValue(extraSmokeArgs) {
  const tokenArg = passThroughOptionArg(extraSmokeArgs, "--token=");
  return tokenArg ? tokenArg.slice("--token=".length).trim() : "";
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
  assertPositiveIntegerOption(extraSmokeArgs, "--expect-sample-detail-error-status=", "--expect-sample-detail-error-status must be a positive integer");
  assertPositiveIntegerOption(extraSmokeArgs, "--expect-sample-list-error-status=", "--expect-sample-list-error-status must be a positive integer");

  const hasSampleDetailErrorArg = SAMPLE_DETAIL_ERROR_OPTIONS.some((prefix) => extraSmokeArgs.some((arg) => arg.startsWith(prefix)));
  if (hasSampleDetailErrorArg) {
    const id = passThroughOptionArg(extraSmokeArgs, "--expect-sample-detail-error-id=")?.slice("--expect-sample-detail-error-id=".length).trim() || "";
    const code = passThroughOptionArg(extraSmokeArgs, "--expect-sample-detail-error-code=")?.slice("--expect-sample-detail-error-code=".length).trim() || "";
    if (!id) throw new Error("--expect-sample-detail-error-id is required when sample detail error options are set");
    if (!code) throw new Error("--expect-sample-detail-error-code is required when --expect-sample-detail-error-id is set");
  }

  const hasSampleListErrorArg = SAMPLE_LIST_ERROR_OPTIONS.some((prefix) => extraSmokeArgs.some((arg) => arg.startsWith(prefix)));
  if (hasSampleListErrorArg) {
    const code = passThroughOptionArg(extraSmokeArgs, "--expect-sample-list-error-code=")?.slice("--expect-sample-list-error-code=".length).trim() || "";
    if (!code) throw new Error("--expect-sample-list-error-code is required when sample list error options are set");
  }
}

export function parseRunnerArgs(argv, env = {}) {
  const args = argv.slice(2);
  const modeArg = singleOptionArg(args, "--mode=");
  const outputRootArg = singleOptionArg(args, "--output-root=");
  const mode = modeArg ? modeArg.slice("--mode=".length).trim() : "readonly";
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
    const demoToken = tokenArg ? inlineTokenValue(extraSmokeArgs) : (env.PUBLIC_DEMO_TOKEN || "").trim();
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
    return arg;
  });
}

export function qaSummaryPathFor(outputRoot) {
  return path.join(outputRoot, "qa-summary.json");
}

export function buildQaSummary({
  config,
  reportDir,
  reportJsonPath,
  metadataPath,
  startedAt,
  finishedAt,
  exitCode,
  smokeReport = null,
}) {
  return {
    schemaVersion: 1,
    generatedAt: finishedAt,
    latestRun: {
      mode: config.mode,
      baseUrl: redactUrlForEvidence(config.baseUrl),
      expectedMode: config.expectedMode,
      actualMode: smokeReport?.actualMode || "",
      status: smokeReport?.status || (exitCode ? "failed" : "passed"),
      exitCode,
      startedAt,
      finishedAt,
      reportDir,
      reportJsonPath,
      smokeRunJsonPath: metadataPath,
      smokeSummary: smokeReport?.summary || null,
      checkCount: Array.isArray(smokeReport?.checks) ? smokeReport.checks.length : 0,
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
  writeRunMetadata(metadataPath, {
    schemaVersion: 1,
    mode: config.mode,
    baseUrl: redactUrlForEvidence(config.baseUrl),
    reportJsonPath,
    startedAt,
    finishedAt,
    exitCode,
    command: [process.execPath, ...redactSmokeArgs(smokeArgs)],
  });
  writeRunMetadata(qaSummaryPath, buildQaSummary({
    config,
    reportDir,
    reportJsonPath,
    metadataPath,
    startedAt,
    finishedAt,
    exitCode,
    smokeReport: readJsonIfExists(reportJsonPath),
  }));

  console.log(`Smoke report directory: ${reportDir}`);
  return exitCode;
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
