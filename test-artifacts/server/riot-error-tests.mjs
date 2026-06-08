// Track V — server.js의 riotErrorPayload 회귀 테스트
//
// 검증 대상: Phase 25 Track B 핵심 헬퍼. requestJson이 throw한 에러를
// 사용자 친화적 응답 페이로드로 normalize. 깨지면 Riot 키 만료 배너가
// 더 이상 트리거되지 않음.
//
// 검증 항목:
//   1) riotStatus === 401 → code: "RIOT_KEY_EXPIRED", status 401, hint 포함
//   2) riotStatus === 403 → 동일 (401과 같은 분기)
//   3) riotStatus === 429 → code: "RIOT_RATE_LIMITED", status 429
//   4) riotStatus === 500 (or other) → code: "RIOT_API_ERROR", raw detail 숨김
//   5) 필드 없는 일반 Error → code: "RIOT_API_ERROR", raw detail 숨김
//   6) null / undefined → code: "RIOT_API_ERROR", 안정 메시지 fallback

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

function tryExtractFunctionSource(source, name) {
  try {
    return extractFunctionSource(source, name);
  } catch (error) {
    if (error?.message === `function ${name} not found`) return "";
    throw error;
  }
}

const src = [
  tryExtractFunctionSource(serverSrc, "genericRiotApiErrorPayload"),
  extractFunctionSource(serverSrc, "riotErrorPayload"),
].filter(Boolean).join("\n");
const riotErrorPayload = new Function(`${src}\nreturn riotErrorPayload;`)();

let pass = 0, fail = 0;

const GENERIC_RIOT_API_ERROR = {
  ok: false,
  code: "RIOT_API_ERROR",
  error: "Riot API 요청을 처리하는 중 오류가 발생했습니다.",
};

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

function makeRiotError(status, message = "Riot API error") {
  const err = new Error(`Riot API ${status}: ${message}`);
  err.riotStatus = status;
  err.riotBody = message;
  return err;
}

// ─── 케이스 1: 401 → RIOT_KEY_EXPIRED ───────────────────────────────────────

{
  const out = riotErrorPayload(makeRiotError(401, "Unauthorized"));
  check("401: status", out.status, 401);
  check("401: body.code", out.body.code, "RIOT_KEY_EXPIRED");
  check("401: body.ok=false", out.body.ok, false);
  checkTrue("401: body.error 한국어",
    typeof out.body.error === "string" && out.body.error.includes("Riot"));
  checkTrue("401: body.hint 포함",
    typeof out.body.hint === "string" && out.body.hint.includes("developer.riotgames.com"));
}

// ─── 케이스 2: 403 → RIOT_KEY_EXPIRED (401과 같은 분기) ────────────────────

{
  const out = riotErrorPayload(makeRiotError(403, "Forbidden"));
  check("403: status mapped to 401", out.status, 401);
  check("403: body.code = RIOT_KEY_EXPIRED", out.body.code, "RIOT_KEY_EXPIRED");
}

// ─── 케이스 3: 429 → RIOT_RATE_LIMITED ──────────────────────────────────────

{
  const out = riotErrorPayload(makeRiotError(429, "Rate limit exceeded"));
  check("429: status", out.status, 429);
  check("429: body.code", out.body.code, "RIOT_RATE_LIMITED");
  checkTrue("429: body.error 한국어",
    typeof out.body.error === "string" && out.body.error.includes("Riot"));
  checkTrue("429: no hint field (단순 retry)",
    !("hint" in out.body));
}

// ─── 케이스 4: 500 → 안전한 generic 500 ────────────────────────────────────

{
  const err = makeRiotError(500, "ENOENT: no such file or directory, open '/runtime/samples/secret.json'");
  const out = riotErrorPayload(err);
  check("500: status", out.status, 500);
  check("500: body", out.body, GENERIC_RIOT_API_ERROR);
  checkNoRawDetails("500", JSON.stringify(out.body));
}

// ─── 케이스 5: 404 → 안전한 generic 500 ────────────────────────────────────

{
  const err = makeRiotError(404, "Unexpected token < in JSON at position 0");
  const out = riotErrorPayload(err);
  check("404: maps to status 500 (no special handling)", out.status, 500);
  check("404: body", out.body, GENERIC_RIOT_API_ERROR);
  checkNoRawDetails("404", JSON.stringify(out.body));
}

// ─── 케이스 6: 일반 Error (riotStatus 없음) ─────────────────────────────────

{
  const err = new Error("getaddrinfo ENOTFOUND kr.api.riotgames.com?api_key=RGAPI-secret");
  const out = riotErrorPayload(err);
  check("plain Error: status", out.status, 500);
  check("plain Error: body", out.body, GENERIC_RIOT_API_ERROR);
  checkNoRawDetails("plain Error", JSON.stringify(out.body));
}

// ─── 케이스 7: null / undefined ─────────────────────────────────────────────

{
  const out = riotErrorPayload(null);
  check("null: status", out.status, 500);
  check("null: body", out.body, GENERIC_RIOT_API_ERROR);
  checkNoRawDetails("null", JSON.stringify(out.body));
}
{
  const out = riotErrorPayload(undefined);
  check("undefined: status", out.status, 500);
  check("undefined: body", out.body, GENERIC_RIOT_API_ERROR);
  checkNoRawDetails("undefined", JSON.stringify(out.body));
}

// ─── 케이스 8: riotStatus가 string인 경우 (방어적) ─────────────────────────

{
  const err = new Error("weird status");
  err.riotStatus = "401"; // string, not number
  const out = riotErrorPayload(err);
  // 함수는 typeof === "number" 체크하므로 string은 미매핑 → 500 fallback
  check("string riotStatus: maps to 500 (type guard)",
    out.status, 500);
  check("string riotStatus: body", out.body, GENERIC_RIOT_API_ERROR);
  checkNoRawDetails("string riotStatus", JSON.stringify(out.body));
}

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
