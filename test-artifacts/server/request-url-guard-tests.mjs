// Request URL guard regression tests.
//
// The top-level HTTP handler should parse request URLs inside its guarded block
// and map malformed request targets or Host headers to a stable 400 JSON error.

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

const requestUrlFromSource = serverSrc.includes("function requestUrlFrom(")
  ? extractFunctionSource(serverSrc, "requestUrlFrom")
  : [
      "function requestUrlFrom(req) {",
      "  return new URL(req.url, `http://${req.headers.host}`);",
      "}",
    ].join("\n");

const invalidRequestTargetErrorSource = serverSrc.includes("function invalidRequestTargetError(")
  ? extractFunctionSource(serverSrc, "invalidRequestTargetError")
  : "";

const harness = new Function([
  extractFunctionSource(serverSrc, "firstHeaderValue"),
  invalidRequestTargetErrorSource,
  requestUrlFromSource,
  "return { requestUrlFrom };",
].join("\n"))();

function makeReq({ url = "/healthz", host = "localhost:8123" } = {}) {
  return {
    url,
    headers: { host },
  };
}

function captureUrlError(req) {
  try {
    harness.requestUrlFrom(req);
    return null;
  } catch (error) {
    return error;
  }
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

const validUrl = harness.requestUrlFrom(makeReq({ url: "/healthz?ready=1", host: "127.0.0.1:8123" }));
check("valid request URL pathname",
  validUrl.pathname,
  "/healthz");
check("valid request URL search",
  validUrl.search,
  "?ready=1");

const invalidTargetError = captureUrlError(makeReq({ url: "http://[::1", host: "localhost:8123" }));
check("invalid request target status",
  invalidTargetError?.statusCode,
  400);
check("invalid request target code",
  invalidTargetError?.payload?.code,
  "INVALID_REQUEST_TARGET");
check("invalid request target body",
  invalidTargetError?.payload,
  {
    ok: false,
    code: "INVALID_REQUEST_TARGET",
    error: "요청 URL이 올바르지 않습니다.",
  });

const invalidHostError = captureUrlError(makeReq({ url: "/healthz", host: "bad host" }));
check("invalid Host header status",
  invalidHostError?.statusCode,
  400);
check("invalid Host header code",
  invalidHostError?.payload?.code,
  "INVALID_REQUEST_TARGET");

const absoluteTargetError = captureUrlError(makeReq({
  url: "http://example.com/healthz",
  host: "localhost:8123",
}));
check("absolute-form request target status",
  absoluteTargetError?.statusCode,
  400);
check("absolute-form request target code",
  absoluteTargetError?.payload?.code,
  "INVALID_REQUEST_TARGET");

const protocolRelativeTargetError = captureUrlError(makeReq({
  url: "//example.com/healthz",
  host: "localhost:8123",
}));
check("protocol-relative request target status",
  protocolRelativeTargetError?.statusCode,
  400);
check("protocol-relative request target code",
  protocolRelativeTargetError?.payload?.code,
  "INVALID_REQUEST_TARGET");

checkTrue("server parses request URL inside top-level try",
  /try\s*\{[\s\S]*const url = requestUrlFrom\(req\);[\s\S]*handleApi\(req,\s*res,\s*url\)/.test(serverSrc));

checkTrue("server no longer parses request URL before top-level try",
  !/createServer\(async\s*\(req,\s*res\)\s*=>\s*\{\s*const url = new URL/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
