// external-demo-smoke CLI option parsing tests.

import { spawn, spawnSync } from "node:child_process";
import fs from "fs";
import http from "node:http";
import { fileURLToPath } from "node:url";

const smokePath = fileURLToPath(new URL("../../scripts/external-demo-smoke.mjs", import.meta.url));
const smokeSrc = fs.readFileSync(smokePath, "utf8");

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

check("parseSmokeArgs reads base URL, token, and expected mode",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "https://demo.example", "--token=abc", "--expect-mode=readonly", "--min-samples=19"], {}),
  { baseUrl: "https://demo.example", demoToken: "abc", expectedMode: "readonly", minSamples: 19 });

check("parseSmokeArgs falls back to env token and default base URL",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expect-mode=protected"], { PUBLIC_DEMO_TOKEN: "env-token" }),
  { baseUrl: "http://127.0.0.1:8123", demoToken: "env-token", expectedMode: "protected", minSamples: 1 });

check("parseSmokeArgs omits expected mode when not provided",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "http://127.0.0.1:9000"], {}),
  { baseUrl: "http://127.0.0.1:9000", demoToken: "", expectedMode: "", minSamples: 1 });

checkThrows("parseSmokeArgs rejects invalid expected mode",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expect-mode=dev"], {}),
  "--expect-mode must be one of: full, protected, readonly");

checkThrows("parseSmokeArgs requires an explicit URL when requested",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-url", "--expect-mode=readonly"], {}),
  "--require-url needs an explicit base URL argument");

check("parseSmokeArgs accepts an explicit URL when required",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-url", "https://demo.example", "--expect-mode=readonly"], {}),
  { baseUrl: "https://demo.example", demoToken: "", expectedMode: "readonly", minSamples: 1 });

checkThrows("parseSmokeArgs requires https when requested",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-https", "http://demo.example", "--expect-mode=readonly"], {}),
  "--require-https needs an https:// base URL");

check("parseSmokeArgs accepts https when required",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-https", "https://demo.example", "--expect-mode=readonly"], {}),
  { baseUrl: "https://demo.example", demoToken: "", expectedMode: "readonly", minSamples: 1 });

checkThrows("parseSmokeArgs rejects invalid minimum sample count",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--min-samples=0"], {}),
  "--min-samples must be a positive integer");

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
