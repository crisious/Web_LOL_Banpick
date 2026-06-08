// Request body parser regression tests.
//
// Live API endpoints should return stable 400/413 JSON errors for malformed or
// oversized request bodies rather than exposing parser exceptions as 500s.

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

function extractConstLine(source, name) {
  const match = source.match(new RegExp(`const ${name} = [^;]+;`));
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

const harness = new Function([
  extractConstLine(serverSrc, "MAX_BODY_BYTES"),
  extractFunctionSource(serverSrc, "parseBody"),
  extractFunctionSource(serverSrc, "riotErrorPayload"),
  "return { MAX_BODY_BYTES, parseBody, riotErrorPayload };",
].join("\n"))();

function reqFromChunks(chunks) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield Buffer.from(chunk);
      }
    },
  };
}

async function captureParseError(chunks) {
  try {
    await harness.parseBody(reqFromChunks(chunks));
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

check("valid JSON body parses",
  await harness.parseBody(reqFromChunks(["{\"gameName\":\"Lux\"}"])),
  { gameName: "Lux" });

check("empty body parses as object",
  await harness.parseBody(reqFromChunks([])),
  {});

const invalidJsonError = await captureParseError(["{\"gameName\":"]);
check("invalid JSON parse error status",
  invalidJsonError?.statusCode,
  400);
check("invalid JSON parse error code",
  invalidJsonError?.code,
  "INVALID_JSON_BODY");
check("invalid JSON payload maps to stable response",
  harness.riotErrorPayload(invalidJsonError),
  {
    status: 400,
    body: {
      ok: false,
      code: "INVALID_JSON_BODY",
      error: "요청 본문이 올바른 JSON 형식이 아닙니다.",
    },
  });
checkTrue("invalid JSON response does not expose SyntaxError",
  !JSON.stringify(harness.riotErrorPayload(invalidJsonError)).includes("SyntaxError"));

const oversizedError = await captureParseError(["x".repeat(harness.MAX_BODY_BYTES + 1)]);
check("oversized body error status",
  oversizedError?.statusCode,
  413);
check("oversized body error code",
  oversizedError?.code,
  "REQUEST_BODY_TOO_LARGE");
check("oversized body maps to stable response",
  harness.riotErrorPayload(oversizedError),
  {
    status: 413,
    body: {
      ok: false,
      code: "REQUEST_BODY_TOO_LARGE",
      error: "요청 본문이 너무 큽니다.",
    },
  });

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
