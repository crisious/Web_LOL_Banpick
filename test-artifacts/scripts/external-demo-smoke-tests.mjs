// external-demo-smoke CLI option parsing tests.

import { spawn, spawnSync } from "node:child_process";
import fs from "fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const smokePath = fileURLToPath(new URL("../../scripts/external-demo-smoke.mjs", import.meta.url));
const smokeSrc = fs.readFileSync(smokePath, "utf8");
const { validateExternalSmokeUrl } = await import(new URL("../../scripts/validate-external-smoke-url.mjs", import.meta.url));
const preflightDeps = { validateExternalUrl: validateExternalSmokeUrl };

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  const bodyStart = source.indexOf("{", source.indexOf(")", startIdx));
  if (bodyStart < 0) throw new Error(`function ${name} body not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const parseSmokeArgsSrc = extractFunctionSource(smokeSrc, "parseSmokeArgs");
const { parseSmokeArgs } = new Function(`${parseSmokeArgsSrc}\nreturn { parseSmokeArgs };`)();

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

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function completeSampleDetail() {
  return {
    normalized: { matchInfo: { champion: "Nautilus", result: "LOSS" } },
    analysis: {
      matchSummary: { headline: "Complete report" },
      coachSummary: { overallSummary: "Review the objective setup." },
      strengths: [{ title: "Vision setup" }],
      weaknesses: [{ title: "Late rotation" }],
      actionChecklist: [{ text: "Ward before objective spawn." }],
      keyMoments: [{ title: "First fight" }, { title: "Dragon setup" }],
    },
  };
}

function readJsonFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

check("parseSmokeArgs reads base URL, token, and expected mode",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "https://demo.example", "--token=abc", "--expect-mode=readonly", "--min-samples=19", "--timeout-ms=5000"], {}),
  { baseUrl: "https://demo.example", demoToken: "abc", expectedMode: "readonly", minSamples: 19, requestTimeoutMs: 5000 });

check("parseSmokeArgs falls back to env token and default base URL",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expect-mode=protected"], { PUBLIC_DEMO_TOKEN: "env-token" }),
  { baseUrl: "http://127.0.0.1:8123", demoToken: "env-token", expectedMode: "protected", minSamples: 1, requestTimeoutMs: 10000 });

check("parseSmokeArgs omits expected mode when not provided",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "http://127.0.0.1:9000"], {}),
  { baseUrl: "http://127.0.0.1:9000", demoToken: "", expectedMode: "", minSamples: 1, requestTimeoutMs: 10000 });

check("parseSmokeArgs reads expected sample detail error probe",
  parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "https://demo.example",
    "--expect-mode=readonly",
    "--expect-sample-detail-error-id=sample-kr-1",
    "--expect-sample-detail-error-status=500",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-detail-error-message=Sample manifest entry path must not contain traversal segments: normalizedPath.",
  ], {}),
  {
    baseUrl: "https://demo.example",
    demoToken: "",
    expectedMode: "readonly",
    minSamples: 1,
    requestTimeoutMs: 10000,
    expectedSampleDetailError: {
      id: "sample-kr-1",
      status: 500,
      code: "SAMPLE_MANIFEST_INVALID",
      message: "Sample manifest entry path must not contain traversal segments: normalizedPath.",
    },
  });

check("parseSmokeArgs reads expected sample list error probe",
  parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "https://demo.example",
    "--expect-mode=readonly",
    "--expect-sample-list-error-status=500",
    "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-list-error-message=Sample manifest entry missing required field: label.",
  ], {}),
  {
    baseUrl: "https://demo.example",
    demoToken: "",
    expectedMode: "readonly",
    minSamples: 1,
    requestTimeoutMs: 10000,
    expectedSampleListError: {
      status: 500,
      code: "SAMPLE_MANIFEST_INVALID",
      message: "Sample manifest entry missing required field: label.",
    },
  });

check("parseSmokeArgs reads report JSON path",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "https://demo.example", "--expect-mode=readonly", "--report-json=test-artifacts/tmp/smoke-report.json"], {}),
  { baseUrl: "https://demo.example", demoToken: "", expectedMode: "readonly", minSamples: 1, requestTimeoutMs: 10000, reportJsonPath: "test-artifacts/tmp/smoke-report.json" });

checkThrows("parseSmokeArgs rejects invalid base URL",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "not-a-url"], {}),
  "base URL must be an http(s) URL");

checkThrows("parseSmokeArgs rejects non-http base URL",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "ftp://demo.example"], {}),
  "base URL must be an http(s) URL");

checkThrows("parseSmokeArgs rejects multiple positional base URLs",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "https://demo-one.example", "https://demo-two.example"], {}),
  "base URL must be the only positional argument");

checkThrows("parseSmokeArgs rejects invalid expected mode",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expect-mode=dev"], {}),
  "--expect-mode must be one of: full, protected, readonly");

checkThrows("parseSmokeArgs rejects empty report JSON path",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--report-json="], {}),
  "--report-json needs a file path");

checkThrows("parseSmokeArgs requires an explicit URL when requested",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-url", "--expect-mode=readonly"], {}),
  "--require-url needs an explicit base URL argument");

check("parseSmokeArgs accepts an explicit URL when required",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-url", "https://demo.example", "--expect-mode=readonly"], {}),
  { baseUrl: "https://demo.example", demoToken: "", expectedMode: "readonly", minSamples: 1, requestTimeoutMs: 10000 });

checkThrows("parseSmokeArgs requires https when requested",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-https", "http://demo.example", "--expect-mode=readonly"], {}),
  "--require-https needs an https:// base URL");

check("parseSmokeArgs accepts https when required",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-https", "https://demo.example", "--expect-mode=readonly"], {}),
  { baseUrl: "https://demo.example", demoToken: "", expectedMode: "readonly", minSamples: 1, requestTimeoutMs: 10000 });

checkThrows("parseSmokeArgs rejects required external private URL via preflight",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-url", "--require-https", "https://10.0.0.5", "--expect-mode=readonly"], {}, preflightDeps),
  "external_readonly_url must not point to a local or private network target");

checkThrows("parseSmokeArgs rejects required external URL query via preflight",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-url", "--require-https", "https://demo.example.com?token=secret", "--expect-mode=protected"], {}, preflightDeps),
  "external_protected_url must not include username/password, query string, or fragment");

checkThrows("parseSmokeArgs requires token when requested",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-token", "https://demo.example", "--expect-mode=protected"], {}),
  "--require-token needs --token or PUBLIC_DEMO_TOKEN");

check("parseSmokeArgs accepts env token when token is required",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-token", "https://demo.example", "--expect-mode=protected"], { PUBLIC_DEMO_TOKEN: "env-token" }),
  { baseUrl: "https://demo.example", demoToken: "env-token", expectedMode: "protected", minSamples: 1, requestTimeoutMs: 10000 });

checkThrows("parseSmokeArgs rejects invalid minimum sample count",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--min-samples=0"], {}),
  "--min-samples must be a positive integer");

checkThrows("parseSmokeArgs rejects invalid request timeout",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--timeout-ms=0"], {}),
  "--timeout-ms must be a positive integer");

checkThrows("parseSmokeArgs requires sample detail error code with id",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-detail-error-id=sample-kr-1",
  ], {}),
  "--expect-sample-detail-error-code is required when --expect-sample-detail-error-id is set");

checkThrows("parseSmokeArgs rejects invalid sample detail error status",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-detail-error-id=sample-kr-1",
    "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-detail-error-status=ok",
  ], {}),
  "--expect-sample-detail-error-status must be a positive integer");

checkThrows("parseSmokeArgs requires sample list error code when list error options are set",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-list-error-status=500",
  ], {}),
  "--expect-sample-list-error-code is required when sample list error options are set");

checkThrows("parseSmokeArgs rejects invalid sample list error status",
  () => parseSmokeArgs([
    "node",
    "scripts/external-demo-smoke.mjs",
    "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
    "--expect-sample-list-error-status=ok",
  ], {}),
  "--expect-sample-list-error-status must be a positive integer");

const missingRequiredUrl = spawnSync(process.execPath, [smokePath, "--require-url", "--expect-mode=readonly"], {
  encoding: "utf8",
});

check("CLI exits non-zero when --require-url has no URL",
  missingRequiredUrl.status,
  1);

check("CLI prints concise missing URL failure without stack trace",
  missingRequiredUrl.stderr.trim(),
  "FAIL --require-url needs an explicit base URL argument");

const nonHttpsRequiredUrl = spawnSync(process.execPath, [
  smokePath,
  "--require-url",
  "--require-https",
  "--expect-mode=readonly",
  "http://127.0.0.1:8123",
], {
  encoding: "utf8",
});

check("CLI exits non-zero when --require-https gets http URL",
  nonHttpsRequiredUrl.status,
  1);

check("CLI prints concise non-https URL failure without stack trace",
  nonHttpsRequiredUrl.stderr.trim(),
  "FAIL --require-https needs an https:// base URL");

const privateRequiredExternalUrl = spawnSync(process.execPath, [
  smokePath,
  "--require-url",
  "--require-https",
  "--expect-mode=readonly",
  "https://10.0.0.5",
], {
  encoding: "utf8",
});

check("CLI exits non-zero when required external URL is private",
  privateRequiredExternalUrl.status,
  1);

check("CLI prints concise private external URL failure without stack trace",
  privateRequiredExternalUrl.stderr.trim(),
  "FAIL external_readonly_url must not point to a local or private network target");

const invalidBaseUrl = spawnSync(process.execPath, [
  smokePath,
  "not-a-url",
  "--expect-mode=readonly",
], {
  encoding: "utf8",
});

check("CLI exits non-zero when base URL is invalid",
  invalidBaseUrl.status,
  1);

check("CLI prints concise invalid base URL failure without stack trace",
  invalidBaseUrl.stderr.trim(),
  "FAIL base URL must be an http(s) URL");

const missingRequiredToken = spawnSync(process.execPath, [
  smokePath,
  "--require-token",
  "--expect-mode=protected",
  "https://demo.example",
], {
  encoding: "utf8",
});

check("CLI exits non-zero when --require-token has no token",
  missingRequiredToken.status,
  1);

check("CLI prints concise missing token failure without stack trace",
  missingRequiredToken.stderr.trim(),
  "FAIL --require-token needs --token or PUBLIC_DEMO_TOKEN");

const invalidHealthRequests = [];
const invalidHealthServer = http.createServer((req, res) => {
  invalidHealthRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end("<!doctype html><title>Not JSON</title>");
  }
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  res.writeHead(403, { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" });
  return res.end("Forbidden");
});

await new Promise((resolve) => invalidHealthServer.listen(0, "127.0.0.1", resolve));
const invalidHealthUrl = `http://127.0.0.1:${invalidHealthServer.address().port}`;
const invalidHealth = await runNode([
  smokePath,
  invalidHealthUrl,
  "--min-samples=1",
]);
await new Promise((resolve) => invalidHealthServer.close(resolve));

check("CLI exits non-zero when /healthz is not JSON",
  invalidHealth.status,
  1);

check("CLI stops before live/write probes when /healthz is not JSON",
  invalidHealthRequests.some((request) => request.method === "POST" &&
    ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(request.url)),
  false);

const unknownModeRequests = [];
const unknownModeServer = http.createServer((req, res) => {
  unknownModeRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, publicDemoMode: "preview" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  res.writeHead(403, { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" });
  return res.end("Forbidden");
});

await new Promise((resolve) => unknownModeServer.listen(0, "127.0.0.1", resolve));
const unknownModeUrl = `http://127.0.0.1:${unknownModeServer.address().port}`;
const unknownMode = await runNode([
  smokePath,
  unknownModeUrl,
  "--min-samples=1",
]);
await new Promise((resolve) => unknownModeServer.close(resolve));

check("CLI exits non-zero when publicDemoMode is unknown",
  unknownMode.status,
  1);

check("CLI stops before live/write probes when publicDemoMode is unknown",
  unknownModeRequests.some((request) => request.method === "POST" &&
    ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(request.url)),
  false);

const invalidModeValidityRequests = [];
const invalidModeValidityServer = http.createServer((req, res) => {
  invalidModeValidityRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") {
    return sendJson(200, { ok: true, publicDemoMode: "readonly", publicDemoModeValid: false });
  }
  if (req.url === "/api/samples") {
    return sendJson(500, {
      ok: false,
      code: "SAMPLE_MANIFEST_INVALID",
      error: "Sample manifest entry missing required field: label.",
    });
  }
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => invalidModeValidityServer.listen(0, "127.0.0.1", resolve));
const invalidModeValidityUrl = `http://127.0.0.1:${invalidModeValidityServer.address().port}`;
const invalidModeValidity = await runNode([
  smokePath,
  invalidModeValidityUrl,
  "--expect-mode=readonly",
  "--expect-sample-list-error-status=500",
  "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
  "--expect-sample-list-error-message=Sample manifest entry missing required field: label.",
]);
await new Promise((resolve) => invalidModeValidityServer.close(resolve));

check("CLI exits non-zero when healthz marks publicDemoMode invalid",
  invalidModeValidity.status,
  1);

check("CLI reports invalid public demo mode validity",
  invalidModeValidity.stderr.includes("FAIL public demo mode config is valid"),
  true);

check("CLI stops after healthz when publicDemoModeValid is false",
  invalidModeValidityRequests.map((request) => request.url),
  ["/healthz"]);

const unsafeSampleGenerationHealthRequests = [];
const unsafeSampleGenerationHealthServer = http.createServer((req, res) => {
  unsafeSampleGenerationHealthRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") {
    return sendJson(200, {
      ok: true,
      publicDemoMode: "readonly",
      sampleGeneration: {
        activeCount: 1,
        oldestAgeMs: 1200,
        lockKey: "KR:KR_8242613150",
      },
    });
  }
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => unsafeSampleGenerationHealthServer.listen(0, "127.0.0.1", resolve));
const unsafeSampleGenerationHealthUrl = `http://127.0.0.1:${unsafeSampleGenerationHealthServer.address().port}`;
const unsafeSampleGenerationHealth = await runNode([
  smokePath,
  unsafeSampleGenerationHealthUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => unsafeSampleGenerationHealthServer.close(resolve));

check("CLI exits non-zero when healthz sampleGeneration exposes identifiers",
  unsafeSampleGenerationHealth.status,
  1);

check("CLI reports unsafe sampleGeneration health shape",
  unsafeSampleGenerationHealth.stderr.includes("FAIL healthz sampleGeneration exposes only aggregate fields"),
  true);

check("CLI stops after healthz when sampleGeneration health is unsafe",
  unsafeSampleGenerationHealthRequests.map((request) => request.url),
  ["/healthz"]);

const inactiveSampleGenerationAgeRequests = [];
const inactiveSampleGenerationAgeServer = http.createServer((req, res) => {
  inactiveSampleGenerationAgeRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") {
    return sendJson(200, {
      ok: true,
      publicDemoMode: "readonly",
      sampleGeneration: {
        activeCount: 0,
        oldestAgeMs: 1200,
      },
    });
  }
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => inactiveSampleGenerationAgeServer.listen(0, "127.0.0.1", resolve));
const inactiveSampleGenerationAgeUrl = `http://127.0.0.1:${inactiveSampleGenerationAgeServer.address().port}`;
const inactiveSampleGenerationAge = await runNode([
  smokePath,
  inactiveSampleGenerationAgeUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => inactiveSampleGenerationAgeServer.close(resolve));

check("CLI exits non-zero when inactive sampleGeneration has age",
  inactiveSampleGenerationAge.status,
  1);

check("CLI reports inactive sampleGeneration age mismatch",
  inactiveSampleGenerationAge.stderr.includes("FAIL healthz sampleGeneration oldestAgeMs is zero when inactive"),
  true);

check("CLI stops after healthz when inactive sampleGeneration age is inconsistent",
  inactiveSampleGenerationAgeRequests.map((request) => request.url),
  ["/healthz"]);

const fractionalSampleGenerationAgeRequests = [];
const fractionalSampleGenerationAgeServer = http.createServer((req, res) => {
  fractionalSampleGenerationAgeRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") {
    return sendJson(200, {
      ok: true,
      publicDemoMode: "readonly",
      sampleGeneration: {
        activeCount: 1,
        oldestAgeMs: 1200.5,
      },
    });
  }
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => fractionalSampleGenerationAgeServer.listen(0, "127.0.0.1", resolve));
const fractionalSampleGenerationAgeUrl = `http://127.0.0.1:${fractionalSampleGenerationAgeServer.address().port}`;
const fractionalSampleGenerationAge = await runNode([
  smokePath,
  fractionalSampleGenerationAgeUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => fractionalSampleGenerationAgeServer.close(resolve));

check("CLI exits non-zero when sampleGeneration oldestAgeMs is fractional",
  fractionalSampleGenerationAge.status,
  1);

check("CLI reports fractional sampleGeneration age mismatch",
  fractionalSampleGenerationAge.stderr.includes("FAIL healthz sampleGeneration oldestAgeMs is a non-negative integer"),
  true);

check("CLI stops after healthz when sampleGeneration age is fractional",
  fractionalSampleGenerationAgeRequests.map((request) => request.url),
  ["/healthz"]);

const modeMismatchRequests = [];
const modeMismatchServer = http.createServer((req, res) => {
  modeMismatchRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, publicDemoMode: "full" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  res.writeHead(403, { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" });
  return res.end("Forbidden");
});

await new Promise((resolve) => modeMismatchServer.listen(0, "127.0.0.1", resolve));
const modeMismatchUrl = `http://127.0.0.1:${modeMismatchServer.address().port}`;
const modeMismatch = await runNode([
  smokePath,
  modeMismatchUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => modeMismatchServer.close(resolve));

check("CLI exits non-zero when actual mode differs from --expect-mode",
  modeMismatch.status,
  1);

check("CLI stops before live/write probes when mode differs from --expect-mode",
  modeMismatchRequests.some((request) => request.method === "POST" &&
    ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(request.url)),
  false);

const sampleDetailErrorRequests = [];
const sampleDetailErrorServer = http.createServer((req, res) => {
  sampleDetailErrorRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/api/samples/sample-bad") {
    return sendJson(500, {
      ok: false,
      code: "SAMPLE_MANIFEST_INVALID",
      error: "Sample manifest entry path must not contain traversal segments: normalizedPath.",
    });
  }
  return sendJson(404, { ok: false, error: "not found" });
});

await new Promise((resolve) => sampleDetailErrorServer.listen(0, "127.0.0.1", resolve));
const sampleDetailErrorUrl = `http://127.0.0.1:${sampleDetailErrorServer.address().port}`;
const sampleDetailError = await runNode([
  smokePath,
  sampleDetailErrorUrl,
  "--expect-mode=readonly",
  "--expect-sample-detail-error-id=sample-bad",
  "--expect-sample-detail-error-status=500",
  "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
  "--expect-sample-detail-error-message=Sample manifest entry path must not contain traversal segments: normalizedPath.",
]);
await new Promise((resolve) => sampleDetailErrorServer.close(resolve));

check("CLI succeeds for expected sample detail structured error",
  sampleDetailError.status,
  0);

check("CLI reports expected sample detail error status",
  sampleDetailError.stdout.includes("PASS sample detail error sample-bad returns 500"),
  true);

check("CLI stops after targeted sample detail error probe",
  sampleDetailErrorRequests,
  [
    { method: "GET", url: "/healthz" },
    { method: "GET", url: "/api/samples/sample-bad" },
  ]);

const wrongSampleDetailErrorCodeServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/api/samples/sample-bad") {
    return sendJson(500, {
      ok: false,
      code: "WRONG_MANIFEST_CODE",
      error: "Sample manifest entry path must not contain traversal segments: normalizedPath.",
    });
  }
  return sendJson(404, { ok: false, error: "not found" });
});

await new Promise((resolve) => wrongSampleDetailErrorCodeServer.listen(0, "127.0.0.1", resolve));
const wrongSampleDetailErrorCodeUrl = `http://127.0.0.1:${wrongSampleDetailErrorCodeServer.address().port}`;
const wrongSampleDetailErrorCode = await runNode([
  smokePath,
  wrongSampleDetailErrorCodeUrl,
  "--expect-mode=readonly",
  "--expect-sample-detail-error-id=sample-bad",
  "--expect-sample-detail-error-status=500",
  "--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID",
  "--expect-sample-detail-error-message=Sample manifest entry path must not contain traversal segments: normalizedPath.",
]);
await new Promise((resolve) => wrongSampleDetailErrorCodeServer.close(resolve));

check("CLI exits non-zero when sample detail error code differs",
  wrongSampleDetailErrorCode.status,
  1);

check("CLI reports unexpected sample detail error code",
  wrongSampleDetailErrorCode.stderr.includes("FAIL sample detail error sample-bad returns SAMPLE_MANIFEST_INVALID"),
  true);

const sampleListErrorRequests = [];
const sampleListErrorServer = http.createServer((req, res) => {
  sampleListErrorRequests.push({ method: req.method, url: req.url });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/api/samples") {
    return sendJson(500, {
      ok: false,
      code: "SAMPLE_MANIFEST_INVALID",
      error: "Sample manifest entry missing required field: label.",
    });
  }
  return sendJson(404, { ok: false, error: "not found" });
});

await new Promise((resolve) => sampleListErrorServer.listen(0, "127.0.0.1", resolve));
const sampleListErrorUrl = `http://127.0.0.1:${sampleListErrorServer.address().port}`;
const sampleListError = await runNode([
  smokePath,
  sampleListErrorUrl,
  "--expect-mode=readonly",
  "--expect-sample-list-error-status=500",
  "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
  "--expect-sample-list-error-message=Sample manifest entry missing required field: label.",
]);
await new Promise((resolve) => sampleListErrorServer.close(resolve));

check("CLI succeeds for expected sample list structured error",
  sampleListError.status,
  0);

check("CLI reports expected sample list error status",
  sampleListError.stdout.includes("PASS sample list error returns 500"),
  true);

check("CLI stops after targeted sample list error probe",
  sampleListErrorRequests,
  [
    { method: "GET", url: "/healthz" },
    { method: "GET", url: "/api/samples" },
  ]);

const wrongSampleListErrorCodeServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/api/samples") {
    return sendJson(500, {
      ok: false,
      code: "WRONG_MANIFEST_CODE",
      error: "Sample manifest entry missing required field: label.",
    });
  }
  return sendJson(404, { ok: false, error: "not found" });
});

await new Promise((resolve) => wrongSampleListErrorCodeServer.listen(0, "127.0.0.1", resolve));
const wrongSampleListErrorCodeUrl = `http://127.0.0.1:${wrongSampleListErrorCodeServer.address().port}`;
const wrongSampleListErrorCode = await runNode([
  smokePath,
  wrongSampleListErrorCodeUrl,
  "--expect-mode=readonly",
  "--expect-sample-list-error-status=500",
  "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
  "--expect-sample-list-error-message=Sample manifest entry missing required field: label.",
]);
await new Promise((resolve) => wrongSampleListErrorCodeServer.close(resolve));

check("CLI exits non-zero when sample list error code differs",
  wrongSampleListErrorCode.status,
  1);

check("CLI reports unexpected sample list error code",
  wrongSampleListErrorCode.stderr.includes("FAIL sample list error returns SAMPLE_MANIFEST_INVALID"),
  true);

const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), "lol-smoke-report-"));
const passedReportPath = path.join(reportDir, "passed", "smoke.json");
const failedReportPath = path.join(reportDir, "failed", "smoke.json");

const sampleListReportServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/api/samples") {
    return sendJson(500, {
      ok: false,
      code: "SAMPLE_MANIFEST_INVALID",
      error: "Sample manifest entry missing required field: label.",
    });
  }
  return sendJson(404, { ok: false, error: "not found" });
});

await new Promise((resolve) => sampleListReportServer.listen(0, "127.0.0.1", resolve));
const sampleListReportUrl = `http://127.0.0.1:${sampleListReportServer.address().port}`;
const sampleListReportInputUrl = `${sampleListReportUrl}/?access_token=report-secret#report-secret-fragment`;
const sampleListReport = await runNode([
  smokePath,
  sampleListReportInputUrl,
  "--expect-mode=readonly",
  "--token=secret-smoke-token",
  "--expect-sample-list-error-status=500",
  "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
  "--expect-sample-list-error-message=Sample manifest entry missing required field: label.",
  `--report-json=${passedReportPath}`,
]);
await new Promise((resolve) => sampleListReportServer.close(resolve));

const passedReport = readJsonFileIfExists(passedReportPath);

check("CLI succeeds when writing passed smoke report JSON",
  sampleListReport.status,
  0);

check("CLI writes passed smoke report JSON",
  passedReport?.status,
  "passed");

check("passed smoke report records summary counts",
  passedReport?.summary?.failed === 0 && passedReport?.summary?.passed > 0,
  true);

check("passed smoke report records observed mode",
  passedReport?.actualMode,
  "readonly");

check("passed smoke report records checked labels",
  Array.isArray(passedReport?.checks) && passedReport.checks.some((item) => item.status === "pass" && item.label === "sample list error returns SAMPLE_MANIFEST_INVALID"),
  true);

check("passed smoke report excludes demo token",
  JSON.stringify(passedReport).includes("secret-smoke-token"),
  false);

check("passed smoke report redacts base URL query and fragment",
  JSON.stringify(passedReport).includes("report-secret"),
  false);

const failingSampleListReportServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/api/samples") {
    return sendJson(500, {
      ok: false,
      code: "WRONG_MANIFEST_CODE",
      error: "Sample manifest entry missing required field: label.",
    });
  }
  return sendJson(404, { ok: false, error: "not found" });
});

await new Promise((resolve) => failingSampleListReportServer.listen(0, "127.0.0.1", resolve));
const failingSampleListReportUrl = `http://127.0.0.1:${failingSampleListReportServer.address().port}`;
const failingSampleListReport = await runNode([
  smokePath,
  failingSampleListReportUrl,
  "--expect-mode=readonly",
  "--expect-sample-list-error-status=500",
  "--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID",
  "--expect-sample-list-error-message=Sample manifest entry missing required field: label.",
  `--report-json=${failedReportPath}`,
]);
await new Promise((resolve) => failingSampleListReportServer.close(resolve));

const failedReport = readJsonFileIfExists(failedReportPath);

check("CLI exits non-zero when writing failed smoke report JSON",
  failingSampleListReport.status,
  1);

check("CLI writes failed smoke report JSON",
  failedReport?.status,
  "failed");

check("failed smoke report records exit code",
  failedReport?.exitCode,
  1);

check("failed smoke report records failing check",
  Array.isArray(failedReport?.checks) && failedReport.checks.some((item) => item.status === "fail" && item.label === "sample list error returns SAMPLE_MANIFEST_INVALID"),
  true);

const closedPort = await new Promise((resolve) => {
  const server = http.createServer();
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

const unreachableDemo = await runNode([
  smokePath,
  `http://127.0.0.1:${closedPort}`,
  "--expect-mode=readonly",
]);

check("CLI exits non-zero when the demo URL is unreachable",
  unreachableDemo.status,
  1);

check("CLI reports unreachable demo URL without stack trace",
  unreachableDemo.stderr.includes("FAIL request /healthz failed") && !unreachableDemo.stderr.includes("TypeError: fetch failed"),
  true);

check("CLI stops after the first network request failure",
  (unreachableDemo.stderr.match(/FAIL request /g) || []).length,
  1);

const slowHealthServer = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    setTimeout(() => {
      if (!res.destroyed) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, readonly: true, publicDemoMode: "readonly" }));
      }
    }, 500);
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<title>LoL Replay Coach</title>");
});

await new Promise((resolve) => slowHealthServer.listen(0, "127.0.0.1", resolve));
const slowHealthUrl = `http://127.0.0.1:${slowHealthServer.address().port}`;
const timedOutHealth = await runNode([
  smokePath,
  slowHealthUrl,
  "--expect-mode=readonly",
  "--timeout-ms=50",
]);
slowHealthServer.closeAllConnections?.();
await new Promise((resolve) => slowHealthServer.close(resolve));

check("CLI exits non-zero when a request exceeds --timeout-ms",
  timedOutHealth.status,
  1);

check("CLI reports timed out request without stack trace",
  timedOutHealth.stderr.includes("FAIL request /healthz failed") && !timedOutHealth.stderr.includes("TimeoutError"),
  true);

const missingAssetServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => missingAssetServer.listen(0, "127.0.0.1", resolve));
const missingAssetUrl = `http://127.0.0.1:${missingAssetServer.address().port}`;
const missingAssets = await runNode([
  smokePath,
  missingAssetUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => missingAssetServer.close(resolve));

check("CLI exits non-zero when client assets are not served",
  missingAssets.status,
  1);

check("CLI reports missing client asset",
  missingAssets.stderr.includes("FAIL GET /styles.css?v=20260419 returns 200") ||
    missingAssets.stderr.includes("FAIL GET /main.js?v=20260419 returns 200"),
  true);

const missingCacheBustedAssetServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css" || req.url === "/main.js") {
    res.writeHead(200, { "Content-Type": req.url.endsWith(".css") ? "text/css" : "text/javascript" });
    return res.end("/* bare asset only */");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => missingCacheBustedAssetServer.listen(0, "127.0.0.1", resolve));
const missingCacheBustedAssetUrl = `http://127.0.0.1:${missingCacheBustedAssetServer.address().port}`;
const missingCacheBustedAssets = await runNode([
  smokePath,
  missingCacheBustedAssetUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => missingCacheBustedAssetServer.close(resolve));

check("CLI exits non-zero when cache-busted client assets are not served",
  missingCacheBustedAssets.status,
  1);

check("CLI reports missing cache-busted client asset",
  missingCacheBustedAssets.stderr.includes("FAIL GET /styles.css?v=20260419 returns 200") ||
    missingCacheBustedAssets.stderr.includes("FAIL GET /main.js?v=20260419 returns 200"),
  true);

const crossOriginAssetRequests = [];
const crossOriginAssetServer = http.createServer((req, res) => {
  crossOriginAssetRequests.push({ url: req.url, authorization: req.headers.authorization || "" });
  if (req.headers.authorization) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    return res.end("unexpected authorization header");
  }
  res.writeHead(200, {
    "Content-Type": req.url?.includes("styles.css") ? "text/css" : "text/javascript",
    "X-Content-Type-Options": "nosniff",
  });
  return res.end("/* public cross-origin asset */");
});

await new Promise((resolve) => crossOriginAssetServer.listen(0, "127.0.0.1", resolve));
const crossOriginAssetUrl = `http://127.0.0.1:${crossOriginAssetServer.address().port}`;
const crossOriginAppServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, protected: true, publicDemoMode: "protected" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="${crossOriginAssetUrl}/styles.css?v=20260419">
      <script src="${crossOriginAssetUrl}/main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => crossOriginAppServer.listen(0, "127.0.0.1", resolve));
const crossOriginAppUrl = `http://127.0.0.1:${crossOriginAppServer.address().port}`;
const crossOriginAssets = await runNode([
  smokePath,
  crossOriginAppUrl,
  "--token=protected-token",
  "--expect-mode=protected",
  "--min-samples=1",
]);
await new Promise((resolve) => crossOriginAppServer.close(resolve));
await new Promise((resolve) => crossOriginAssetServer.close(resolve));

check("CLI succeeds when protected smoke loads cross-origin client assets",
  crossOriginAssets.status,
  0);

check("CLI omits Authorization on cross-origin client asset requests",
  crossOriginAssetRequests.map((request) => request.authorization),
  ["", ""]);

const sameOriginTokenRequests = [];
const sameOriginTokenServer = http.createServer((req, res) => {
  const authorization = req.headers.authorization || "";
  sameOriginTokenRequests.push({ url: req.url, method: req.method, authorization });
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, protected: true, publicDemoMode: "protected" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return authorization === "Bearer protected-token"
      ? sendJson(200, { ok: true })
      : sendJson(401, { ok: false, code: "PUBLIC_DEMO_UNAUTHORIZED" });
  }
  res.writeHead(403, { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" });
  return res.end("Forbidden");
});

await new Promise((resolve) => sameOriginTokenServer.listen(0, "127.0.0.1", resolve));
const sameOriginTokenUrl = `http://127.0.0.1:${sameOriginTokenServer.address().port}`;
const sameOriginTokenSmoke = await runNode([
  smokePath,
  sameOriginTokenUrl,
  "--token=protected-token",
  "--expect-mode=protected",
  "--min-samples=1",
]);
await new Promise((resolve) => sameOriginTokenServer.close(resolve));

const sameOriginLiveUrls = new Set(["/api/recent-matches", "/api/champion-history", "/api/generate-sample"]);
const sameOriginTokenSummary = sameOriginTokenRequests.map((request) => ({
  url: request.url,
  authorization: request.authorization,
}));

check("CLI succeeds when protected live probes receive the demo token",
  sameOriginTokenSmoke.status,
  0);

check("CLI only sends Authorization to same-origin live/write API probes",
  sameOriginTokenSummary.every((request) => sameOriginLiveUrls.has(request.url)
    ? request.authorization === "Bearer protected-token"
    : request.authorization === ""),
  true);

const rejectedProtectedTokenServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, protected: true, publicDemoMode: "protected" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(401, { ok: false, code: "PUBLIC_DEMO_UNAUTHORIZED" });
  }
  res.writeHead(403, { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" });
  return res.end("Forbidden");
});

await new Promise((resolve) => rejectedProtectedTokenServer.listen(0, "127.0.0.1", resolve));
const rejectedProtectedTokenUrl = `http://127.0.0.1:${rejectedProtectedTokenServer.address().port}`;
const rejectedProtectedToken = await runNode([
  smokePath,
  rejectedProtectedTokenUrl,
  "--token=protected-token",
  "--expect-mode=protected",
  "--min-samples=1",
]);
await new Promise((resolve) => rejectedProtectedTokenServer.close(resolve));

check("CLI exits non-zero when protected token is still auth-blocked",
  rejectedProtectedToken.status,
  1);

check("CLI reports protected token auth block",
  rejectedProtectedToken.stderr.includes("FAIL protected mode with token passes /api/recent-matches auth gate"),
  true);

const wrongProtectedCodeServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, protected: true, publicDemoMode: "protected" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { ok: false, code: "WRONG_PROTECTED_CODE" });
  }
  res.writeHead(403, { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" });
  return res.end("Forbidden");
});

await new Promise((resolve) => wrongProtectedCodeServer.listen(0, "127.0.0.1", resolve));
const wrongProtectedCodeUrl = `http://127.0.0.1:${wrongProtectedCodeServer.address().port}`;
const wrongProtectedCode = await runNode([
  smokePath,
  wrongProtectedCodeUrl,
  "--expect-mode=protected",
  "--min-samples=1",
]);
await new Promise((resolve) => wrongProtectedCodeServer.close(resolve));

check("CLI exits non-zero when protected no-token APIs return an unexpected auth code",
  wrongProtectedCode.status,
  1);

check("CLI reports unexpected protected no-token auth code",
  wrongProtectedCode.stderr.includes("FAIL /api/recent-matches protected block returns public demo auth code"),
  true);

const htmlAssetServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419" || req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end("<!doctype html><title>Fallback</title>");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => htmlAssetServer.listen(0, "127.0.0.1", resolve));
const htmlAssetUrl = `http://127.0.0.1:${htmlAssetServer.address().port}`;
const htmlAssets = await runNode([
  smokePath,
  htmlAssetUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => htmlAssetServer.close(resolve));

check("CLI exits non-zero when client assets return HTML content type",
  htmlAssets.status,
  1);

check("CLI reports client asset content type mismatch",
  htmlAssets.stderr.includes("FAIL /styles.css?v=20260419 content-type is CSS") ||
    htmlAssets.stderr.includes("FAIL /main.js?v=20260419 content-type is JavaScript"),
  true);

const missingNosniffAssetServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => missingNosniffAssetServer.listen(0, "127.0.0.1", resolve));
const missingNosniffAssetUrl = `http://127.0.0.1:${missingNosniffAssetServer.address().port}`;
const missingNosniffAssets = await runNode([
  smokePath,
  missingNosniffAssetUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => missingNosniffAssetServer.close(resolve));

check("CLI exits non-zero when client assets omit nosniff",
  missingNosniffAssets.status,
  1);

check("CLI reports missing client asset nosniff",
  missingNosniffAssets.stderr.includes("FAIL /styles.css?v=20260419 has X-Content-Type-Options nosniff") ||
    missingNosniffAssets.stderr.includes("FAIL /main.js?v=20260419 has X-Content-Type-Options nosniff"),
  true);

const missingHomeNosniffServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => missingHomeNosniffServer.listen(0, "127.0.0.1", resolve));
const missingHomeNosniffUrl = `http://127.0.0.1:${missingHomeNosniffServer.address().port}`;
const missingHomeNosniff = await runNode([
  smokePath,
  missingHomeNosniffUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => missingHomeNosniffServer.close(resolve));

check("CLI exits non-zero when home omits nosniff",
  missingHomeNosniff.status,
  1);

check("CLI reports missing home nosniff",
  missingHomeNosniff.stderr.includes("FAIL GET / has X-Content-Type-Options nosniff"),
  true);

const missingJsonNosniffServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => missingJsonNosniffServer.listen(0, "127.0.0.1", resolve));
const missingJsonNosniffUrl = `http://127.0.0.1:${missingJsonNosniffServer.address().port}`;
const missingJsonNosniff = await runNode([
  smokePath,
  missingJsonNosniffUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => missingJsonNosniffServer.close(resolve));

check("CLI exits non-zero when API JSON responses omit nosniff",
  missingJsonNosniff.status,
  1);

check("CLI reports missing API JSON nosniff",
  missingJsonNosniff.stderr.includes("FAIL GET /healthz has X-Content-Type-Options nosniff"),
  true);

const missingBlockedPathNosniffServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  res.writeHead(403, { "Content-Type": "text/plain" });
  return res.end("Forbidden");
});

await new Promise((resolve) => missingBlockedPathNosniffServer.listen(0, "127.0.0.1", resolve));
const missingBlockedPathNosniffUrl = `http://127.0.0.1:${missingBlockedPathNosniffServer.address().port}`;
const missingBlockedPathNosniff = await runNode([
  smokePath,
  missingBlockedPathNosniffUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => missingBlockedPathNosniffServer.close(resolve));

check("CLI exits non-zero when blocked static paths omit nosniff",
  missingBlockedPathNosniff.status,
  1);

check("CLI reports missing blocked static path nosniff",
  missingBlockedPathNosniff.stderr.includes("FAIL /.env has X-Content-Type-Options nosniff"),
  true);

const encodedStaticLeakServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  if (["/%2eenv", "/..%2Fserver.js", "/data%2Fsamples%2Fmanifest.json"].includes(req.url)) {
    res.writeHead(200, { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" });
    return res.end("encoded sensitive file");
  }
  res.writeHead(403, { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" });
  return res.end("Forbidden");
});

await new Promise((resolve) => encodedStaticLeakServer.listen(0, "127.0.0.1", resolve));
const encodedStaticLeakUrl = `http://127.0.0.1:${encodedStaticLeakServer.address().port}`;
const encodedStaticLeak = await runNode([
  smokePath,
  encodedStaticLeakUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => encodedStaticLeakServer.close(resolve));

check("CLI exits non-zero when encoded sensitive static paths are publicly served",
  encodedStaticLeak.status,
  1);

check("CLI reports encoded sensitive static path exposure",
  encodedStaticLeak.stderr.includes("FAIL /%2eenv is not publicly served"),
  true);

const readonlyModeOnlyServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" });
    return res.end(`
      <title>LoL Replay Coach</title>
      <link rel="stylesheet" href="./styles.css?v=20260419">
      <button data-login-sample-button>저장 샘플 열기</button>
      <div data-sample-switcher>저장된 샘플</div>
      <script src="./main.js?v=20260419"></script>
    `);
  }
  if (req.url === "/styles.css?v=20260419") {
    res.writeHead(200, { "Content-Type": "text/css", "X-Content-Type-Options": "nosniff" });
    return res.end("body { color: black; }");
  }
  if (req.url === "/main.js?v=20260419") {
    res.writeHead(200, { "Content-Type": "application/javascript", "X-Content-Type-Options": "nosniff" });
    return res.end("console.log('ok');");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(200, { ok: true });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => readonlyModeOnlyServer.listen(0, "127.0.0.1", resolve));
const readonlyModeOnlyUrl = `http://127.0.0.1:${readonlyModeOnlyServer.address().port}`;
const readonlyModeOnly = await runNode([
  smokePath,
  readonlyModeOnlyUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => readonlyModeOnlyServer.close(resolve));

check("CLI exits non-zero when publicDemoMode readonly live APIs are writable",
  readonlyModeOnly.status,
  1);

check("CLI treats publicDemoMode readonly as read-only for live API probes",
  readonlyModeOnly.stderr.includes("FAIL readonly mode blocks /api/recent-matches"),
  true);

const oneSampleServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end("<title>LoL Replay Coach</title>");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-one" }] });
  if (req.url === "/api/samples/sample-one") return sendJson(200, { normalized: { match: {} }, analysis: { coachSummary: {} } });
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => oneSampleServer.listen(0, "127.0.0.1", resolve));
const oneSampleUrl = `http://127.0.0.1:${oneSampleServer.address().port}`;
const insufficientSamples = await runNode([
  smokePath,
  oneSampleUrl,
  "--expect-mode=readonly",
  "--min-samples=2",
]);
const incompleteDetail = await runNode([
  smokePath,
  oneSampleUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => oneSampleServer.close(resolve));

check("CLI exits non-zero when sample count is below --min-samples",
  insufficientSamples.status,
  1);

check("CLI reports actual sample count when below --min-samples",
  insufficientSamples.stderr.includes("FAIL /api/samples has at least 2 samples"),
  true);

const missingHomeUiServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end("<title>LoL Replay Coach</title>");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-complete" }] });
  if (req.url === "/api/samples/sample-complete") return sendJson(200, completeSampleDetail());
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => missingHomeUiServer.listen(0, "127.0.0.1", resolve));
const missingHomeUiUrl = `http://127.0.0.1:${missingHomeUiServer.address().port}`;
const missingReadonlyHomeUi = await runNode([
  smokePath,
  missingHomeUiUrl,
  "--expect-mode=readonly",
  "--min-samples=1",
]);
await new Promise((resolve) => missingHomeUiServer.close(resolve));

check("CLI exits non-zero when readonly home misses sample entry UI",
  missingReadonlyHomeUi.status,
  1);

check("CLI reports missing readonly home sample entry UI",
  missingReadonlyHomeUi.stderr.includes("FAIL readonly home exposes stored sample entry UI"),
  true);

check("CLI exits non-zero when sample detail misses report essentials",
  incompleteDetail.status,
  1);

check("CLI reports missing sample detail report essentials",
  incompleteDetail.stderr.includes("FAIL sample detail sample-one includes report essentials"),
  true);

const mixedDetailServer = http.createServer((req, res) => {
  const sendJson = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/healthz") return sendJson(200, { ok: true, readonly: true, publicDemoMode: "readonly" });
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end("<title>LoL Replay Coach</title>");
  }
  if (req.url === "/api/samples") return sendJson(200, { samples: [{ id: "sample-good" }, { id: "sample-bad" }] });
  if (req.url === "/api/samples/sample-good") return sendJson(200, completeSampleDetail());
  if (req.url === "/api/samples/sample-bad") return sendJson(200, { normalized: { matchInfo: {} }, analysis: { coachSummary: {} } });
  if (req.method === "POST" && ["/api/recent-matches", "/api/champion-history", "/api/generate-sample"].includes(req.url)) {
    return sendJson(403, { code: "PUBLIC_DEMO_READONLY" });
  }
  return sendJson(404, { error: "not found" });
});

await new Promise((resolve) => mixedDetailServer.listen(0, "127.0.0.1", resolve));
const mixedDetailUrl = `http://127.0.0.1:${mixedDetailServer.address().port}`;
const incompleteSecondDetail = await runNode([
  smokePath,
  mixedDetailUrl,
  "--expect-mode=readonly",
  "--min-samples=2",
]);
await new Promise((resolve) => mixedDetailServer.close(resolve));

check("CLI exits non-zero when any checked sample detail misses report essentials",
  incompleteSecondDetail.status,
  1);

check("CLI reports missing report essentials for a later checked sample",
  incompleteSecondDetail.stderr.includes("FAIL sample detail sample-bad includes report essentials"),
  true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
