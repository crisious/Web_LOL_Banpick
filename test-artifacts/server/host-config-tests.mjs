// HOST config regression tests.
//
// Server startup should accept explicit host bind targets only when the value
// contains no whitespace or control characters. Accidental whitespace should
// fail before server.listen() receives an ambiguous host string.

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

const parseHostConfigSource = serverSrc.includes("function parseHostConfig(")
  ? extractFunctionSource(serverSrc, "parseHostConfig")
  : [
      "function parseHostConfig(rawHost, defaultHost = '127.0.0.1') {",
      "  return rawHost || defaultHost;",
      "}",
    ].join("\n");

const { parseHostConfig } = new Function(
  `${parseHostConfigSource}\nreturn { parseHostConfig };`,
)();

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkThrows(label, fn, expectedMessage) {
  let error = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  const ok = error?.message === expectedMessage;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`  expected throw ${JSON.stringify(expectedMessage)}\n  got            ${JSON.stringify(error?.message || null)}`);
  }
  ok ? pass++ : fail++;
}

const hostError = "HOST must be empty or a hostname/IP literal without whitespace or control characters.";

check("missing HOST uses default",
  parseHostConfig(undefined, "127.0.0.1"),
  "127.0.0.1");
check("empty HOST uses default",
  parseHostConfig("", "127.0.0.1"),
  "127.0.0.1");
check("localhost HOST is preserved",
  parseHostConfig("localhost"),
  "localhost");
check("IPv4 wildcard HOST is preserved",
  parseHostConfig("0.0.0.0"),
  "0.0.0.0");
check("IPv6 loopback HOST is preserved",
  parseHostConfig("::1"),
  "::1");
check("DNS hostname HOST is preserved",
  parseHostConfig("demo.example.com"),
  "demo.example.com");

for (const [label, rawHost] of [
  ["leading whitespace HOST is rejected", " 0.0.0.0"],
  ["trailing whitespace HOST is rejected", "0.0.0.0 "],
  ["internal space HOST is rejected", "local host"],
  ["tab HOST is rejected", "local\thost"],
  ["newline HOST is rejected", "host\nname"],
]) {
  checkThrows(label, () => parseHostConfig(rawHost), hostError);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
