#!/usr/bin/env node

const baseUrl = process.argv[2] || "http://127.0.0.1:8123";
const tokenArg = process.argv.find((arg) => arg.startsWith("--token="));
const demoToken = tokenArg ? tokenArg.slice("--token=".length) : process.env.PUBLIC_DEMO_TOKEN || "";

function url(path) {
  return new URL(path, baseUrl).toString();
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (demoToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${demoToken}`;
  }
  const response = await fetch(url(path), { ...options, headers });
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

function expect(condition, label, detail) {
  if (condition) pass(label);
  else fail(label, detail);
}

const health = await request("/healthz");
expect(health.response.status === 200, "GET /healthz returns 200", `status=${health.response.status}`);
expect(health.body?.ok === true, "healthz ok=true");

const home = await request("/");
expect(home.response.status === 200, "GET / returns 200", `status=${home.response.status}`);
expect(home.text.includes("LoL Replay Coach"), "home contains app title");

const samples = await request("/api/samples");
expect(samples.response.status === 200, "GET /api/samples returns 200", `status=${samples.response.status}`);
expect(Array.isArray(samples.body?.samples), "/api/samples returns samples array");
expect((samples.body?.samples?.length || 0) > 0, "/api/samples has at least one sample");

const firstSample = samples.body?.samples?.[0];
if (firstSample?.id) {
  const detail = await request(`/api/samples/${encodeURIComponent(firstSample.id)}`);
  expect(detail.response.status === 200, "GET /api/samples/:id returns 200", `status=${detail.response.status}`);
  expect(detail.body?.normalized && detail.body?.analysis, "sample detail includes normalized + analysis");
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
