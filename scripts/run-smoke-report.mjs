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

export function parseRunnerArgs(argv, env = {}) {
  const args = argv.slice(2);
  const modeArg = args.find((arg) => arg.startsWith("--mode="));
  const outputRootArg = args.find((arg) => arg.startsWith("--output-root="));
  const mode = modeArg ? modeArg.slice("--mode=".length).trim() : "readonly";
  if (!VALID_MODES.includes(mode)) {
    throw new Error("--mode must be one of: " + VALID_MODES.join(", "));
  }

  const outputRoot = outputRootArg
    ? outputRootArg.slice("--output-root=".length).trim()
    : (env.SMOKE_REPORT_OUTPUT_ROOT || DEFAULT_OUTPUT_ROOT).trim();
  if (!outputRoot) {
    throw new Error("--output-root needs a directory path");
  }

  const knownOptionArgs = new Set([modeArg, outputRootArg].filter(Boolean));
  const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
  const extraSmokeArgs = args.filter((arg) => arg.startsWith("--") && !knownOptionArgs.has(arg));
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
