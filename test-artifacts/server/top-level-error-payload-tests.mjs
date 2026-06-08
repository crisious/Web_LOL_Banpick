// Top-level request handler generic error payload regression tests.
//
// Structured server errors should keep their explicit payloads. Unstructured
// exceptions should not expose raw error.message text to public JSON responses.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let bodyStartIdx = -1;
  let parenDepth = 0;
  let seenParams = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") { parenDepth += 1; seenParams = true; }
    else if (ch === ")") parenDepth -= 1;
    else if (ch === "{" && seenParams && parenDepth === 0) {
      bodyStartIdx = i;
      break;
    }
  }
  if (bodyStartIdx < 0) throw new Error(`function ${name} body not found`);
  let depth = 0;
  for (let i = bodyStartIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

let helper = null;
let loadError = null;
try {
  helper = new Function([
    extractFunctionSource(serverSrc, "internalServerErrorPayload"),
    "return { internalServerErrorPayload };",
  ].join("\n"))();
} catch (error) {
  loadError = error;
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

checkTrue("internal server error helper exists", Boolean(helper), loadError?.message || "");

if (helper) {
  const payload = helper.internalServerErrorPayload(new Error("ENOENT: no such file or directory, open '/runtime/samples/secret.json'"));
  check("generic internal error payload shape", payload, {
    ok: false,
    code: "INTERNAL_SERVER_ERROR",
    error: "서버 처리 중 오류가 발생했습니다.",
  });
  const payloadText = JSON.stringify(payload);
  checkTrue("generic internal error payload hides raw message",
    !payloadText.includes("ENOENT") && !payloadText.includes("/runtime/samples") && !payloadText.includes("secret.json"),
    payloadText);
}

checkTrue("top-level catch preserves structured payloads",
  /sendJson\(res,\s*error\?\.statusCode\s*\|\|\s*500,\s*error\?\.payload\s*\|\|\s*internalServerErrorPayload\(error\)\)/.test(serverSrc));
checkTrue("top-level catch no longer serializes raw error message",
  !/error:\s*error\.message/.test(serverSrc.slice(serverSrc.indexOf("const server = http.createServer"))));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
