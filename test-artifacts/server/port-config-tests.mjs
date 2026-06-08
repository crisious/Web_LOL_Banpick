// PORT config regression tests.
//
// Server startup should accept only exact decimal port values. JavaScript
// Number(...) normalization must not hide whitespace or alternate numeric forms.

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

const parsePortConfigSource = serverSrc.includes("function parsePortConfig(")
  ? extractFunctionSource(serverSrc, "parsePortConfig")
  : [
      "function parsePortConfig(rawPort, defaultPort = 8123) {",
      "  return Number(rawPort || defaultPort);",
      "}",
    ].join("\n");

const { parsePortConfig } = new Function(
  `${parsePortConfigSource}\nreturn { parsePortConfig };`,
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

const portError = "PORT must be an exact decimal integer between 0 and 65535.";

check("missing PORT uses default",
  parsePortConfig(undefined, 9000),
  9000);
check("empty PORT uses default",
  parsePortConfig("", 9000),
  9000);
check("decimal PORT parses",
  parsePortConfig("8123"),
  8123);
check("PORT 0 parses",
  parsePortConfig("0"),
  0);
check("PORT 65535 parses",
  parsePortConfig("65535"),
  65535);

for (const [label, rawPort] of [
  ["leading whitespace PORT is rejected", " 8123"],
  ["trailing whitespace PORT is rejected", "8123 "],
  ["leading zero PORT is rejected", "08"],
  ["float PORT is rejected", "8.5"],
  ["exponential PORT is rejected", "8e3"],
  ["hex PORT is rejected", "0x1fbb"],
  ["negative PORT is rejected", "-1"],
  ["out-of-range PORT is rejected", "65536"],
  ["non-numeric PORT is rejected", "abc"],
]) {
  checkThrows(label, () => parsePortConfig(rawPort), portError);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
