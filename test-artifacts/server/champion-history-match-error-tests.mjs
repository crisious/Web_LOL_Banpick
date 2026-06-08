// Champion history partial match-error regression tests.
//
// /api/champion-history keeps streaming progress when individual match detail
// requests fail. The match-error progress event must not expose raw upstream
// URLs, local paths, parser details, DNS text, or token-like strings.

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

let championHistoryMatchErrorMessage = null;
let loadError = null;
try {
  const src = extractFunctionSource(serverSrc, "championHistoryMatchErrorMessage");
  championHistoryMatchErrorMessage = new Function(`${src}\nreturn championHistoryMatchErrorMessage;`)();
} catch (error) {
  loadError = error;
}

checkTrue("championHistoryMatchErrorMessage helper exists",
  typeof championHistoryMatchErrorMessage === "function");

const SAFE_MATCH_ERROR = "일부 경기 정보를 불러오지 못했습니다.";

if (championHistoryMatchErrorMessage) {
  const cases = [
    ["dns/token", new Error("getaddrinfo ENOTFOUND kr.api.riotgames.com?api_key=RGAPI-secret")],
    ["local path", new Error("ENOENT: no such file or directory, open '/runtime/samples/secret.json'")],
    ["parser", new Error("Unexpected token < in JSON at position 0")],
    ["null", null],
    ["undefined", undefined],
  ];

  for (const [label, input] of cases) {
    const message = championHistoryMatchErrorMessage(input);
    check(`${label}: safe match error`, message, SAFE_MATCH_ERROR);
    checkNoRawDetails(label, String(message));
  }
} else if (loadError) {
  console.log(`  load error: ${loadError.message}`);
}

checkTrue("match-error progress uses safe helper",
  serverSrc.includes("message: championHistoryMatchErrorMessage()"));

checkTrue("match-error progress no longer sends raw error.message",
  !serverSrc.includes('phase: "match-error", matchId: id, message: error.message'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
