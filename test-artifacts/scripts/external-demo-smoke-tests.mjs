// external-demo-smoke CLI option parsing tests.

import { spawnSync } from "node:child_process";
import fs from "fs";
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

checkThrows("parseSmokeArgs requires an explicit URL when requested",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-url", "--expect-mode=readonly"], {}),
  "--require-url needs an explicit base URL argument");

check("parseSmokeArgs accepts an explicit URL when required",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-url", "https://demo.example", "--expect-mode=readonly"], {}),
  { baseUrl: "https://demo.example", demoToken: "", expectedMode: "readonly" });

checkThrows("parseSmokeArgs requires https when requested",
  () => parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-https", "http://demo.example", "--expect-mode=readonly"], {}),
  "--require-https needs an https:// base URL");

check("parseSmokeArgs accepts https when required",
  parseSmokeArgs(["node", "scripts/external-demo-smoke.mjs", "--require-https", "https://demo.example", "--expect-mode=readonly"], {}),
  { baseUrl: "https://demo.example", demoToken: "", expectedMode: "readonly" });

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
