// Ranked lookup partial-failure regression tests.
//
// /api/recent-matches can succeed even when league-v4 ranked lookup fails.
// The optional rankedError field must not expose upstream URLs, local paths,
// parser details, or token-like strings in that otherwise successful response.

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

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

function checkNoRawDetails(label, payloadText) {
  const blocked = [
    "ENOENT",
    "/runtime/samples",
    "secret.json",
    "kr.api.riotgames.com",
    "RGAPI-secret",
    "api_key",
    "getaddrinfo",
    "Unexpected token",
  ];
  for (const token of blocked) {
    checkTrue(`${label}: does not expose ${token}`,
      !payloadText.includes(token));
  }
}

let rankedLookupErrorMessage = null;
let loadError = null;
try {
  const src = extractFunctionSource(serverSrc, "rankedLookupErrorMessage");
  rankedLookupErrorMessage = new Function(`${src}\nreturn rankedLookupErrorMessage;`)();
} catch (error) {
  loadError = error;
}

checkTrue("rankedLookupErrorMessage helper exists",
  typeof rankedLookupErrorMessage === "function");

const SAFE_RANKED_ERROR = "랭크 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.";

if (rankedLookupErrorMessage) {
  const cases = [
    ["dns/token", new Error("getaddrinfo ENOTFOUND kr.api.riotgames.com?api_key=RGAPI-secret")],
    ["local path", new Error("ENOENT: no such file or directory, open '/runtime/samples/secret.json'")],
    ["parser", new Error("Unexpected token < in JSON at position 0")],
    ["null", null],
    ["undefined", undefined],
  ];

  for (const [label, input] of cases) {
    const message = rankedLookupErrorMessage(input);
    check(`${label}: safe ranked error`, message, SAFE_RANKED_ERROR);
    checkNoRawDetails(label, String(message));
  }
} else if (loadError) {
  console.log(`  load error: ${loadError.message}`);
}

checkTrue("recent matches uses rankedLookupErrorMessage for rankedError",
  serverSrc.includes("rankedError = rankedLookupErrorMessage();"));

checkTrue("recent matches no longer passes raw ranked error messages",
  !serverSrc.includes("rankedError = rankedLookupError?.message"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
