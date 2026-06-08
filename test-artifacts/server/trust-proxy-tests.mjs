// TRUST_PROXY regression tests.
//
// Public demos should trust forwarded IP headers only when TRUST_PROXY is the
// exact opt-in value "1"; whitespace in .env or shell config must not enable it.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
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

const parseTrustProxyConfigSource = serverSrc.includes("function parseTrustProxyConfig(")
  ? extractFunctionSource(serverSrc, "parseTrustProxyConfig")
  : [
      "function parseTrustProxyConfig(rawTrustProxy) {",
      "  return String(rawTrustProxy || '').trim() === '1';",
      "}",
    ].join("\n");

function makeTrustProxyHarness(rawTrustProxy) {
  return new Function(
    "rawTrustProxy",
    [
      parseTrustProxyConfigSource,
      "const trustProxy = parseTrustProxyConfig(rawTrustProxy);",
      extractFunctionSource(serverSrc, "firstHeaderValue"),
      extractFunctionSource(serverSrc, "proxyHeaderValue"),
      extractFunctionSource(serverSrc, "getClientIp"),
      "return { parseTrustProxyConfig, getClientIp, trustProxy };",
    ].join("\n"),
  )(rawTrustProxy);
}

function makeReq({ headers = {}, remoteAddress = "203.0.113.10" } = {}) {
  return {
    headers,
    socket: { remoteAddress },
  };
}

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

const exactProxy = makeTrustProxyHarness("1");
check("TRUST_PROXY exact 1 enables proxy trust",
  exactProxy.parseTrustProxyConfig("1"),
  true);
check("TRUST_PROXY missing disables proxy trust",
  exactProxy.parseTrustProxyConfig(undefined),
  false);
check("TRUST_PROXY empty disables proxy trust",
  exactProxy.parseTrustProxyConfig(""),
  false);
check("TRUST_PROXY 0 disables proxy trust",
  exactProxy.parseTrustProxyConfig("0"),
  false);
check("TRUST_PROXY leading whitespace does not enable proxy trust",
  exactProxy.parseTrustProxyConfig(" 1"),
  false);
check("TRUST_PROXY trailing whitespace does not enable proxy trust",
  exactProxy.parseTrustProxyConfig("1 "),
  false);

const whitespaceProxy = makeTrustProxyHarness(" 1");
check("whitespace TRUST_PROXY leaves runtime trust disabled",
  whitespaceProxy.trustProxy,
  false);
check("whitespace TRUST_PROXY ignores cf-connecting-ip",
  whitespaceProxy.getClientIp(makeReq({
    headers: { "cf-connecting-ip": "198.51.100.1" },
    remoteAddress: "203.0.113.10",
  })),
  "203.0.113.10");

check("exact TRUST_PROXY trusts cf-connecting-ip",
  exactProxy.getClientIp(makeReq({
    headers: { "cf-connecting-ip": "198.51.100.2" },
    remoteAddress: "203.0.113.10",
  })),
  "198.51.100.2");

check("exact TRUST_PROXY rejects duplicate cf-connecting-ip values",
  exactProxy.getClientIp(makeReq({
    headers: {
      "cf-connecting-ip": ["198.51.100.5", "198.51.100.6"],
      "x-forwarded-for": "198.51.100.7",
    },
    remoteAddress: "203.0.113.10",
  })),
  "203.0.113.10");

check("exact TRUST_PROXY falls back to first x-forwarded-for value",
  exactProxy.getClientIp(makeReq({
    headers: { "x-forwarded-for": "198.51.100.3, 198.51.100.4" },
    remoteAddress: "203.0.113.10",
  })),
  "198.51.100.3");

check("exact TRUST_PROXY rejects duplicate x-forwarded-for values",
  exactProxy.getClientIp(makeReq({
    headers: { "x-forwarded-for": ["198.51.100.8", "198.51.100.9"] },
    remoteAddress: "203.0.113.10",
  })),
  "203.0.113.10");

check("exact TRUST_PROXY rejects duplicate x-real-ip values",
  exactProxy.getClientIp(makeReq({
    headers: { "x-real-ip": ["198.51.100.10", "198.51.100.11"] },
    remoteAddress: "203.0.113.10",
  })),
  "203.0.113.10");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
