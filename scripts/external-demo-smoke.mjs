#!/usr/bin/env node

function parseSmokeArgs(argv, env = {}) {
  const validExpectedModes = ["full", "protected", "readonly"];
  const args = argv.slice(2);
  const explicitBaseUrl = args.find((arg) => !arg.startsWith("--"));
  const requireUrl = args.includes("--require-url");
  const requireHttps = args.includes("--require-https");
  if (requireUrl && !explicitBaseUrl) {
    throw new Error("--require-url needs an explicit base URL argument");
  }
  const baseUrl = explicitBaseUrl || "http://127.0.0.1:8123";
  if (requireHttps) {
    try {
      if (new URL(baseUrl).protocol !== "https:") throw new Error("not https");
    } catch {
      throw new Error("--require-https needs an https:// base URL");
    }
  }
  const tokenArg = args.find((arg) => arg.startsWith("--token="));
  const modeArg = args.find((arg) => arg.startsWith("--expect-mode="));
  const expectedMode = modeArg ? modeArg.slice("--expect-mode=".length).trim().toLowerCase() : "";
  const minSamplesArg = args.find((arg) => arg.startsWith("--min-samples="));
  const minSamples = minSamplesArg ? Number(minSamplesArg.slice("--min-samples=".length)) : 1;
  const timeoutArg = args.find((arg) => arg.startsWith("--timeout-ms="));
  const requestTimeoutMs = timeoutArg ? Number(timeoutArg.slice("--timeout-ms=".length)) : 10000;

  if (expectedMode && !validExpectedModes.includes(expectedMode)) {
    throw new Error("--expect-mode must be one of: " + validExpectedModes.join(", "));
  }
  if (!Number.isInteger(minSamples) || minSamples < 1) {
    throw new Error("--min-samples must be a positive integer");
  }
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1) {
    throw new Error("--timeout-ms must be a positive integer");
  }

  return {
    baseUrl,
    demoToken: tokenArg ? tokenArg.slice("--token=".length) : env.PUBLIC_DEMO_TOKEN || "",
    expectedMode,
    minSamples,
    requestTimeoutMs,
  };
}

let parsedArgs;
try {
  parsedArgs = parseSmokeArgs(process.argv, process.env);
} catch (error) {
  console.error(`FAIL ${error.message || error}`);
  process.exit(1);
}

const { baseUrl, demoToken, expectedMode, minSamples, requestTimeoutMs } = parsedArgs;

function url(path) {
  return new URL(path, baseUrl).toString();
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (demoToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${demoToken}`;
  }
  let response;
  try {
    response = await fetch(url(path), { ...options, headers, signal: AbortSignal.timeout(requestTimeoutMs) });
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
  console.log(`PASS ${label}`);
}

function fail(label, detail) {
  console.error(`FAIL ${label}`);
  if (detail) console.error(`  ${detail}`);
  process.exitCode = 1;
}

function fatal(label, detail) {
  fail(label, detail);
  process.exit(process.exitCode || 1);
}

function expect(condition, label, detail) {
  if (condition) pass(label);
  else fail(label, detail);
}

function demoModeFromHealth(body) {
  if (typeof body?.publicDemoMode === "string" && body.publicDemoMode.trim()) {
    return body.publicDemoMode.trim().toLowerCase();
  }
  if (body?.readonly) return "readonly";
  if (body?.protected) return "protected";
  return "full";
}

const health = await request("/healthz");
expect(health.response.status === 200, "GET /healthz returns 200", `status=${health.response.status}`);
expect(health.body?.ok === true, "healthz ok=true");
const actualMode = demoModeFromHealth(health.body);
if (expectedMode) {
  expect(actualMode === expectedMode, `public demo mode is ${expectedMode}`, `actual=${actualMode}`);
}

const home = await request("/");
expect(home.response.status === 200, "GET / returns 200", `status=${home.response.status}`);
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

const stylesheet = await request("/styles.css");
expect(stylesheet.response.status === 200, "GET /styles.css returns 200", `status=${stylesheet.response.status}`);
const appScript = await request("/main.js");
expect(appScript.response.status === 200, "GET /main.js returns 200", `status=${appScript.response.status}`);

const samples = await request("/api/samples");
expect(samples.response.status === 200, "GET /api/samples returns 200", `status=${samples.response.status}`);
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
];

for (const path of blockedStaticPaths) {
  const out = await request(path);
  expect(out.response.status === 403 || out.response.status === 404, `${path} is not publicly served`, `status=${out.response.status}`);
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
  });

  if (health.body?.readonly) {
    expect(liveProbe.response.status === 403, `readonly mode blocks ${probe.label}`, `status=${liveProbe.response.status}`);
    expect(liveProbe.body?.code === "PUBLIC_DEMO_READONLY", `${probe.label} readonly block returns PUBLIC_DEMO_READONLY`);
  } else if (health.body?.protected && !demoToken) {
    expect(
      liveProbe.response.status === 401 || liveProbe.response.status === 403,
      `protected mode without token blocks ${probe.label}`,
      `status=${liveProbe.response.status}`,
    );
  } else {
    expect(liveProbe.response.status !== 404, `${probe.label} route exists`);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`External demo smoke passed for ${baseUrl}`);
