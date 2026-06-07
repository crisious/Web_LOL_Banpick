// external-demo-smoke CLI option parsing tests.

import fs from "fs";

const smokeSrc = fs.readFileSync(new URL("../../scripts/external-demo-smoke.mjs", import.meta.url), "utf8");

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

check("parseSmokeArgs reads base URL, token, and expected mode",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "https://demo.example", "--token=abc", "--expect-mode=readonly"], {}),
  { baseUrl: "https://demo.example", demoToken: "abc", expectedMode: "readonly" });

check("parseSmokeArgs falls back to env token and default base URL",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expect-mode=protected"], { PUBLIC_DEMO_TOKEN: "env-token" }),
  { baseUrl: "http://127.0.0.1:8123", demoToken: "env-token", expectedMode: "protected" });

check("parseSmokeArgs omits expected mode when not provided",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "http://127.0.0.1:9000"], {}),
  { baseUrl: "http://127.0.0.1:9000", demoToken: "", expectedMode: "" });

checkThrows("parseSmokeArgs rejects invalid expected mode",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--expect-mode=dev"], {}),
  "--expect-mode must be one of: full, protected, readonly");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
