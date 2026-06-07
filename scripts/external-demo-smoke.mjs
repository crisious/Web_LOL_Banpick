#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { redactUrlForEvidence } from "../lib/qa-evidence-redaction.mjs";
import { validateExternalSmokeUrl } from "./validate-external-smoke-url.mjs";

function parseSmokeArgs(argv, env = {}, deps = {}) {
  const validExpectedModes = ["full", "protected", "readonly"];
  const args = argv.slice(2);
  const explicitBaseUrl = args.find((arg) => !arg.startsWith("--"));
  const requireUrl = args.includes("--require-url");
  const requireHttps = args.includes("--require-https");
  const requireToken = args.includes("--require-token");
  if (requireUrl && !explicitBaseUrl) {
    throw new Error("--require-url needs an explicit base URL argument");
  }
  const baseUrl = explicitBaseUrl || "http://127.0.0.1:8123";
  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error("base URL must be an http(s) URL");
  }
  if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
    throw new Error("base URL must be an http(s) URL");
  }
  if (requireHttps && parsedBaseUrl.protocol !== "https:") {
    throw new Error("--require-https needs an https:// base URL");
  }
  if (requireUrl && requireHttps) {
    const modeForLabel = args.find((arg) => arg.startsWith("--expect-mode="))?.slice("--expect-mode=".length).trim().toLowerCase();
    deps.validateExternalUrl?.(modeForLabel === "protected" ? "external_protected_url" : "external_readonly_url", baseUrl);
  }
  const tokenArg = args.find((arg) => arg.startsWith("--token="));
  const demoToken = (tokenArg ? tokenArg.slice("--token=".length) : env.PUBLIC_DEMO_TOKEN || "").trim();
  if (requireToken && !demoToken) {
    throw new Error("--require-token needs --token or PUBLIC_DEMO_TOKEN");
  }
  const modeArg = args.find((arg) => arg.startsWith("--expect-mode="));
  const expectedMode = modeArg ? modeArg.slice("--expect-mode=".length).trim().toLowerCase() : "";
  const minSamplesArg = args.find((arg) => arg.startsWith("--min-samples="));
  const minSamples = minSamplesArg ? Number(minSamplesArg.slice("--min-samples=".length)) : 1;
  const timeoutArg = args.find((arg) => arg.startsWith("--timeout-ms="));
  const requestTimeoutMs = timeoutArg ? Number(timeoutArg.slice("--timeout-ms=".length)) : 10000;
  const sampleDetailErrorIdArg = args.find((arg) => arg.startsWith("--expect-sample-detail-error-id="));
  const sampleDetailErrorCodeArg = args.find((arg) => arg.startsWith("--expect-sample-detail-error-code="));
  const sampleDetailErrorStatusArg = args.find((arg) => arg.startsWith("--expect-sample-detail-error-status="));
  const sampleDetailErrorMessageArg = args.find((arg) => arg.startsWith("--expect-sample-detail-error-message="));
  const sampleListErrorCodeArg = args.find((arg) => arg.startsWith("--expect-sample-list-error-code="));
  const sampleListErrorStatusArg = args.find((arg) => arg.startsWith("--expect-sample-list-error-status="));
  const sampleListErrorMessageArg = args.find((arg) => arg.startsWith("--expect-sample-list-error-message="));
  const reportJsonArg = args.find((arg) => arg.startsWith("--report-json="));
  const reportJsonPath = reportJsonArg ? reportJsonArg.slice("--report-json=".length).trim() : "";
  const hasSampleDetailErrorArg = Boolean(
    sampleDetailErrorIdArg ||
      sampleDetailErrorCodeArg ||
      sampleDetailErrorStatusArg ||
      sampleDetailErrorMessageArg
  );
  const hasSampleListErrorArg = Boolean(
    sampleListErrorCodeArg ||
      sampleListErrorStatusArg ||
      sampleListErrorMessageArg
  );
  const expectedSampleDetailError = hasSampleDetailErrorArg
    ? {
        id: sampleDetailErrorIdArg ? sampleDetailErrorIdArg.slice("--expect-sample-detail-error-id=".length).trim() : "",
        status: sampleDetailErrorStatusArg ? Number(sampleDetailErrorStatusArg.slice("--expect-sample-detail-error-status=".length)) : 500,
        code: sampleDetailErrorCodeArg ? sampleDetailErrorCodeArg.slice("--expect-sample-detail-error-code=".length).trim() : "",
        message: sampleDetailErrorMessageArg ? sampleDetailErrorMessageArg.slice("--expect-sample-detail-error-message=".length) : "",
      }
    : null;
  const expectedSampleListError = hasSampleListErrorArg
    ? {
        status: sampleListErrorStatusArg ? Number(sampleListErrorStatusArg.slice("--expect-sample-list-error-status=".length)) : 500,
        code: sampleListErrorCodeArg ? sampleListErrorCodeArg.slice("--expect-sample-list-error-code=".length).trim() : "",
        message: sampleListErrorMessageArg ? sampleListErrorMessageArg.slice("--expect-sample-list-error-message=".length) : "",
      }
    : null;

  if (expectedMode && !validExpectedModes.includes(expectedMode)) {
    throw new Error("--expect-mode must be one of: " + validExpectedModes.join(", "));
  }
  if (!Number.isInteger(minSamples) || minSamples < 1) {
    throw new Error("--min-samples must be a positive integer");
  }
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1) {
    throw new Error("--timeout-ms must be a positive integer");
  }
  if (reportJsonArg && !reportJsonPath) {
    throw new Error("--report-json needs a file path");
  }
  if (expectedSampleDetailError) {
    if (!expectedSampleDetailError.id) {
      throw new Error("--expect-sample-detail-error-id is required when sample detail error options are set");
    }
    if (!expectedSampleDetailError.code) {
      throw new Error("--expect-sample-detail-error-code is required when --expect-sample-detail-error-id is set");
    }
    if (!Number.isInteger(expectedSampleDetailError.status) || expectedSampleDetailError.status < 1) {
      throw new Error("--expect-sample-detail-error-status must be a positive integer");
    }
  }
  if (expectedSampleListError) {
    if (!expectedSampleListError.code) {
      throw new Error("--expect-sample-list-error-code is required when sample list error options are set");
    }
    if (!Number.isInteger(expectedSampleListError.status) || expectedSampleListError.status < 1) {
      throw new Error("--expect-sample-list-error-status must be a positive integer");
    }
  }

  return {
    baseUrl,
    demoToken,
    expectedMode,
    minSamples,
    requestTimeoutMs,
    ...(expectedSampleDetailError ? { expectedSampleDetailError } : {}),
    ...(expectedSampleListError ? { expectedSampleListError } : {}),
    ...(reportJsonPath ? { reportJsonPath } : {}),
  };
}

let parsedArgs;
try {
  parsedArgs = parseSmokeArgs(process.argv, process.env, { validateExternalUrl: validateExternalSmokeUrl });
} catch (error) {
  console.error(`FAIL ${error.message || error}`);
  process.exit(1);
}

const { baseUrl, demoToken, expectedMode, minSamples, requestTimeoutMs, expectedSampleDetailError, expectedSampleListError, reportJsonPath } = parsedArgs;
const evidenceBaseUrl = redactUrlForEvidence(baseUrl);
const baseOrigin = new URL(baseUrl).origin;
const startedAt = new Date().toISOString();
const reportChecks = [];
let observedMode = "";
let reportWritten = false;

function url(path) {
  return new URL(path, baseUrl).toString();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function referencedAssetPath(html, filename) {
  const pattern = new RegExp(`(?:href|src)\\s*=\\s*["']([^"']*${escapeRegex(filename)}[^"']*)["']`, "i");
  const match = html.match(pattern);
  if (!match) return `/${filename}`;
  const assetUrl = new URL(match[1], baseUrl);
  return assetUrl.origin === new URL(baseUrl).origin
    ? `${assetUrl.pathname}${assetUrl.search}`
    : assetUrl.toString();
}

function contentType(response) {
  return response.headers?.get?.("content-type")?.toLowerCase() || "";
}

function headerValue(response, name) {
  return response.headers?.get?.(name)?.toLowerCase() || "";
}

function expectJsonResponse(out, label) {
  expect(contentType(out.response).includes("application/json"), `${label} content-type is JSON`, `content-type=${contentType(out.response) || "(missing)"}`);
  expect(headerValue(out.response, "x-content-type-options") === "nosniff", `${label} has X-Content-Type-Options nosniff`, `x-content-type-options=${headerValue(out.response, "x-content-type-options") || "(missing)"}`);
}

function expectStructuredErrorResponse(out, label, expected) {
  expect(
    out.response.status === expected.status,
    `${label} returns ${expected.status}`,
    `status=${out.response.status}`,
  );
  expectJsonResponse(out, label);
  expect(out.body?.ok === false, `${label} has ok=false`);
  expect(
    out.body?.code === expected.code,
    `${label} returns ${expected.code}`,
    `code=${out.body?.code || "(missing)"}`,
  );
  if (expected.message) {
    expect(
      out.body?.error === expected.message,
      `${label} returns expected message`,
      `error=${out.body?.error || "(missing)"}`,
    );
  }
}

async function request(path, options = {}) {
  const { useDemoToken = false, ...fetchOptions } = options;
  const headers = { ...(fetchOptions.headers || {}) };
  const requestOrigin = new URL(path, baseUrl).origin;
  if (useDemoToken && demoToken && requestOrigin === baseOrigin && !headers.Authorization) {
    headers.Authorization = `Bearer ${demoToken}`;
  }
  let response;
  try {
    response = await fetch(url(path), { ...fetchOptions, headers, signal: AbortSignal.timeout(requestTimeoutMs) });
  } catch (error) {
    const detail = error?.name === "TimeoutError" || error?.name === "AbortError"
      ? `timeout after ${requestTimeoutMs}ms`
      : error?.message || String(error);
    fatal(`request ${path} failed`, detail);
    return {
      response: { status: 0 },
      body: null,
      text: "",
    };
  }
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body, text };
}

function pass(label) {
  recordCheck("pass", label);
  console.log(`PASS ${label}`);
}

function fail(label, detail) {
  recordCheck("fail", label, detail);
  console.error(`FAIL ${label}`);
  if (detail) console.error(`  ${detail}`);
  process.exitCode = 1;
}

function fatal(label, detail) {
  fail(label, detail);
  writeReport(process.exitCode || 1);
  process.exit(process.exitCode || 1);
}

function recordCheck(status, label, detail = "") {
  reportChecks.push(detail ? { status, label, detail } : { status, label });
}

function writeReport(exitCode) {
  if (!reportJsonPath || reportWritten) return;
  reportWritten = true;
  const passed = reportChecks.filter((item) => item.status === "pass").length;
  const failed = reportChecks.filter((item) => item.status === "fail").length;
  const reportPath = path.resolve(reportJsonPath);
  const payload = {
    schemaVersion: 1,
    baseUrl: evidenceBaseUrl,
    expectedMode,
    actualMode: observedMode,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: exitCode ? "failed" : "passed",
    exitCode,
    summary: { passed, failed },
    checks: reportChecks,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function expect(condition, label, detail) {
  if (condition) pass(label);
  else fail(label, detail);
}

function expectFatal(condition, label, detail) {
  if (condition) pass(label);
  else fatal(label, detail);
}

function demoModeFromHealth(body) {
  if (typeof body?.publicDemoMode === "string" && body.publicDemoMode.trim()) {
    return body.publicDemoMode.trim().toLowerCase();
  }
  if (body?.readonly) return "readonly";
  if (body?.protected) return "protected";
  return "full";
}

function validateSampleGenerationHealth(body) {
  if (!Object.prototype.hasOwnProperty.call(body || {}, "sampleGeneration")) return;

  const sampleGeneration = body.sampleGeneration;
  const keys = Object.keys(sampleGeneration || {});
  const allowedKeys = ["activeCount", "oldestAgeMs"];
  const hasOnlyAllowedKeys = keys.every((key) => allowedKeys.includes(key));

  expectFatal(
    sampleGeneration && typeof sampleGeneration === "object" && !Array.isArray(sampleGeneration),
    "healthz sampleGeneration is an object",
    `type=${Array.isArray(sampleGeneration) ? "array" : typeof sampleGeneration}`,
  );
  expectFatal(
    hasOnlyAllowedKeys && allowedKeys.every((key) => keys.includes(key)),
    "healthz sampleGeneration exposes only aggregate fields",
    `keys=${keys.length ? keys.join(",") : "(none)"}`,
  );
  expectFatal(
    Number.isInteger(sampleGeneration.activeCount) && sampleGeneration.activeCount >= 0,
    "healthz sampleGeneration activeCount is a non-negative integer",
    `activeCount=${sampleGeneration.activeCount}`,
  );
  expectFatal(
    Number.isFinite(sampleGeneration.oldestAgeMs) && sampleGeneration.oldestAgeMs >= 0,
    "healthz sampleGeneration oldestAgeMs is non-negative",
    `oldestAgeMs=${sampleGeneration.oldestAgeMs}`,
  );
}

const health = await request("/healthz");
expectFatal(health.response.status === 200, "GET /healthz returns 200", `status=${health.response.status}`);
expectFatal(contentType(health.response).includes("application/json"), "GET /healthz content-type is JSON", `content-type=${contentType(health.response) || "(missing)"}`);
expect(headerValue(health.response, "x-content-type-options") === "nosniff", "GET /healthz has X-Content-Type-Options nosniff", `x-content-type-options=${headerValue(health.response, "x-content-type-options") || "(missing)"}`);
expectFatal(health.body?.ok === true, "healthz ok=true");
validateSampleGenerationHealth(health.body);
if (health.body?.publicDemoModeValid === false) {
  fatal("public demo mode config is valid", `publicDemoMode=${health.body?.publicDemoMode || "(missing)"}`);
}
const actualMode = demoModeFromHealth(health.body);
observedMode = actualMode;
expectFatal(["full", "protected", "readonly"].includes(actualMode), "public demo mode is known", `actual=${actualMode}`);
if (expectedMode) {
  if (actualMode === expectedMode) {
    pass(`public demo mode is ${expectedMode}`);
  } else {
    fatal(`public demo mode is ${expectedMode}`, `actual=${actualMode}`);
  }
}

if (expectedSampleListError) {
  const samplesOut = await request("/api/samples");
  expectStructuredErrorResponse(samplesOut, "sample list error", expectedSampleListError);
  if (process.exitCode) {
    writeReport(process.exitCode);
    process.exit(process.exitCode);
  }
  console.log(`External demo sample list error smoke passed for ${evidenceBaseUrl}`);
  writeReport(0);
  process.exit(0);
}

if (expectedSampleDetailError) {
  const detailPath = `/api/samples/${encodeURIComponent(expectedSampleDetailError.id)}`;
  const detail = await request(detailPath);
  expectStructuredErrorResponse(
    detail,
    `sample detail error ${expectedSampleDetailError.id}`,
    expectedSampleDetailError,
  );
  if (process.exitCode) {
    writeReport(process.exitCode);
    process.exit(process.exitCode);
  }
  console.log(`External demo sample detail error smoke passed for ${evidenceBaseUrl}`);
  writeReport(0);
  process.exit(0);
}

const home = await request("/");
expect(home.response.status === 200, "GET / returns 200", `status=${home.response.status}`);
expect(headerValue(home.response, "x-content-type-options") === "nosniff", "GET / has X-Content-Type-Options nosniff", `x-content-type-options=${headerValue(home.response, "x-content-type-options") || "(missing)"}`);
expect(home.text.includes("LoL Replay Coach"), "home contains app title");
expect(home.text.includes("styles.css"), "home references styles.css");
expect(home.text.includes("main.js"), "home references main.js");
if (actualMode === "readonly") {
  expect(
    home.text.includes("data-login-sample-button") &&
      home.text.includes("data-sample-switcher") &&
      home.text.includes("저장된 샘플"),
    "readonly home exposes stored sample entry UI",
  );
}

const stylesheetPath = referencedAssetPath(home.text, "styles.css");
const stylesheet = await request(stylesheetPath);
expect(stylesheet.response.status === 200, `GET ${stylesheetPath} returns 200`, `status=${stylesheet.response.status}`);
expect(contentType(stylesheet.response).includes("text/css"), `${stylesheetPath} content-type is CSS`, `content-type=${contentType(stylesheet.response) || "(missing)"}`);
expect(headerValue(stylesheet.response, "x-content-type-options") === "nosniff", `${stylesheetPath} has X-Content-Type-Options nosniff`, `x-content-type-options=${headerValue(stylesheet.response, "x-content-type-options") || "(missing)"}`);
const appScriptPath = referencedAssetPath(home.text, "main.js");
const appScript = await request(appScriptPath);
expect(appScript.response.status === 200, `GET ${appScriptPath} returns 200`, `status=${appScript.response.status}`);
expect(contentType(appScript.response).includes("javascript"), `${appScriptPath} content-type is JavaScript`, `content-type=${contentType(appScript.response) || "(missing)"}`);
expect(headerValue(appScript.response, "x-content-type-options") === "nosniff", `${appScriptPath} has X-Content-Type-Options nosniff`, `x-content-type-options=${headerValue(appScript.response, "x-content-type-options") || "(missing)"}`);

const samples = await request("/api/samples");
expect(samples.response.status === 200, "GET /api/samples returns 200", `status=${samples.response.status}`);
expectJsonResponse(samples, "GET /api/samples");
expect(Array.isArray(samples.body?.samples), "/api/samples returns samples array");
expect((samples.body?.samples?.length || 0) >= minSamples, `/api/samples has at least ${minSamples} samples`, `count=${samples.body?.samples?.length || 0}`);

function hasReportEssentials(analysis) {
  return Boolean(
    analysis?.matchSummary?.headline &&
      analysis?.coachSummary?.overallSummary &&
      Array.isArray(analysis?.strengths) && analysis.strengths.length > 0 &&
      Array.isArray(analysis?.weaknesses) && analysis.weaknesses.length > 0 &&
      Array.isArray(analysis?.actionChecklist) && analysis.actionChecklist.length > 0 &&
      Array.isArray(analysis?.keyMoments) && analysis.keyMoments.length >= 2
  );
}

const samplesToCheck = (samples.body?.samples || []).slice(0, minSamples);
for (const sample of samplesToCheck) {
  if (!sample?.id) continue;
  const detail = await request(`/api/samples/${encodeURIComponent(sample.id)}`);
  expect(detail.response.status === 200, `GET /api/samples/:id returns 200 for ${sample.id}`, `status=${detail.response.status}`);
  expectJsonResponse(detail, `sample detail ${sample.id}`);
  expect(detail.body?.normalized && detail.body?.analysis, `sample detail ${sample.id} includes normalized + analysis`);
  const analysis = detail.body?.analysis || {};
  expect(hasReportEssentials(analysis), `sample detail ${sample.id} includes report essentials`);
}

const blockedStaticPaths = [
  "/.env",
  "/server.js",
  "/package.json",
  "/data/samples/manifest.json",
  "/test-artifacts/run-tests.mjs",
  "/external-access-deployment-plan.md",
  "/%2eenv",
  "/..%2Fserver.js",
  "/%2e%2e%2Fserver.js",
  "/data%2Fsamples%2Fmanifest.json",
];

for (const path of blockedStaticPaths) {
  const out = await request(path);
  expect(out.response.status === 403 || out.response.status === 404, `${path} is not publicly served`, `status=${out.response.status}`);
  expect(headerValue(out.response, "x-content-type-options") === "nosniff", `${path} has X-Content-Type-Options nosniff`, `x-content-type-options=${headerValue(out.response, "x-content-type-options") || "(missing)"}`);
}

const liveApiProbes = [
  { path: "/api/recent-matches", label: "/api/recent-matches" },
  { path: "/api/champion-history", label: "/api/champion-history" },
  { path: "/api/generate-sample", label: "/api/generate-sample" },
];

for (const probe of liveApiProbes) {
  const liveProbe = await request(probe.path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    useDemoToken: true,
  });
  expectJsonResponse(liveProbe, probe.label);

  if (actualMode === "readonly") {
    expect(liveProbe.response.status === 403, `readonly mode blocks ${probe.label}`, `status=${liveProbe.response.status}`);
    expect(liveProbe.body?.code === "PUBLIC_DEMO_READONLY", `${probe.label} readonly block returns PUBLIC_DEMO_READONLY`);
  } else if (actualMode === "protected" && !demoToken) {
    expect(
      liveProbe.response.status === 401 || liveProbe.response.status === 403,
      `protected mode without token blocks ${probe.label}`,
      `status=${liveProbe.response.status}`,
    );
    expect(
      ["PUBLIC_DEMO_UNAUTHORIZED", "PUBLIC_DEMO_TOKEN_REQUIRED"].includes(liveProbe.body?.code),
      `${probe.label} protected block returns public demo auth code`,
      `code=${liveProbe.body?.code || "(missing)"}`,
    );
  } else if (actualMode === "protected" && demoToken) {
    expect(
      liveProbe.response.status !== 401 && liveProbe.response.status !== 403,
      `protected mode with token passes ${probe.label} auth gate`,
      `status=${liveProbe.response.status} code=${liveProbe.body?.code || "(missing)"}`,
    );
  } else {
    expect(liveProbe.response.status !== 404, `${probe.label} route exists`);
  }
}

if (process.exitCode) {
  writeReport(process.exitCode);
  process.exit(process.exitCode);
}

console.log(`External demo smoke passed for ${evidenceBaseUrl}`);
writeReport(0);
