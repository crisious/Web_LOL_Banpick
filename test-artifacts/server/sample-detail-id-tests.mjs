// Sample detail id route guard regression tests.
//
// /api/samples/:id should reject malformed ids before manifest lookup while
// preserving existing valid and not-found behavior for well-formed ids.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  let startIdx = source.indexOf(`function ${name}(`);
  const asyncStartIdx = source.indexOf(`async function ${name}(`);
  if (asyncStartIdx >= 0 && (startIdx < 0 || asyncStartIdx < startIdx)) {
    startIdx = asyncStartIdx;
  }
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const maybeSampleDetailIdSource = serverSrc.includes("function sampleDetailIdFromPathname(")
  ? extractFunctionSource(serverSrc, "sampleDetailIdFromPathname")
  : "";
const maybeInvalidSampleIdPayloadSource = serverSrc.includes("function invalidSampleIdPayload(")
  ? extractFunctionSource(serverSrc, "invalidSampleIdPayload")
  : "";

const events = [];
const harness = new Function("events", [
  "const SAMPLE_DETAIL_PATH_PREFIX = '/api/samples/';",
  "const SAMPLE_DETAIL_ID_PATTERN = /^sample-[a-z0-9]+(?:-[a-z0-9]+)*$/;",
  "function sendJson(res, status, body) { res.sent = { status, body }; }",
  "function publicDemoModeHealth() { return {}; }",
  "function sampleGenerationHealth() { return {}; }",
  "async function loadManifest() { events.push({ op: 'loadManifest' }); return { samples: [] }; }",
  "function inferMatchIdFromSampleEntry(sample) { return sample.matchId || null; }",
  "async function loadSampleBundle(sampleId) { events.push({ op: 'loadSampleBundle', sampleId }); return sampleId === 'sample-complete' ? { ok: true, sampleId } : null; }",
  "function requireLiveApiAccess() { events.push({ op: 'requireLiveApiAccess' }); return false; }",
  "async function handleRecentMatches() { events.push({ op: 'handleRecentMatches' }); }",
  "async function handleChampionHistory() { events.push({ op: 'handleChampionHistory' }); }",
  "async function handleGenerateSample() { events.push({ op: 'handleGenerateSample' }); }",
  maybeSampleDetailIdSource,
  maybeInvalidSampleIdPayloadSource,
  extractFunctionSource(serverSrc, "handleApi"),
  "return { handleApi };",
].join("\n"))(events);

function makeRes() {
  return { sent: null };
}

async function requestPath(pathname) {
  events.length = 0;
  const res = makeRes();
  const handled = await harness.handleApi({ method: "GET" }, res, { pathname });
  return { handled, res, events: [...events] };
}

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkTrue(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition && detail) console.log(`  ${detail}`);
  condition ? pass++ : fail++;
}

const validDetail = await requestPath("/api/samples/sample-complete");
check("valid sample detail is handled",
  validDetail.handled,
  true);
check("valid sample detail status",
  validDetail.res.sent?.status,
  200);
check("valid sample detail loads requested id",
  validDetail.events,
  [{ op: "loadSampleBundle", sampleId: "sample-complete" }]);

const missingDetail = await requestPath("/api/samples/sample-missing");
check("well-formed missing sample detail status",
  missingDetail.res.sent?.status,
  404);
check("well-formed missing sample still loads manifest path",
  missingDetail.events,
  [{ op: "loadSampleBundle", sampleId: "sample-missing" }]);

for (const [label, pathname] of [
  ["empty id", "/api/samples/"],
  ["uppercase id", "/api/samples/Sample-KR-1"],
  ["encoded slash id", "/api/samples/sample%2Fsecret"],
  ["space encoded id", "/api/samples/sample%20id"],
  ["extra path segment", "/api/samples/sample-complete/analysis"],
]) {
  const out = await requestPath(pathname);
  check(`${label} status`,
    out.res.sent?.status,
    400);
  check(`${label} code`,
    out.res.sent?.body?.code,
    "INVALID_SAMPLE_ID");
  check(`${label} does not load sample bundle`,
    out.events,
    []);
}

checkTrue("server declares sample detail id helper",
  /function sampleDetailIdFromPathname\(pathname\)/.test(serverSrc));
checkTrue("sample detail branch validates id before loadSampleBundle",
  /const sampleId = sampleDetailIdFromPathname\(url\.pathname\);[\s\S]*if \(!sampleId\)[\s\S]*sendJson\(res,\s*400,\s*invalidSampleIdPayload\(\)\);[\s\S]*loadSampleBundle\(sampleId\)/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
