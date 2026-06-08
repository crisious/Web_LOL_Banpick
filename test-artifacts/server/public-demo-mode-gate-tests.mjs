// Phase 2 — public demo mode live API gate regression tests.
//
// Protected/read-only demos depend on requireLiveApiAccess() being fail-closed.
// A misspelled PUBLIC_DEMO_MODE must not silently behave like full mode.

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

const parsePublicDemoTokenConfigSource = serverSrc.includes("function parsePublicDemoTokenConfig(")
  ? extractFunctionSource(serverSrc, "parsePublicDemoTokenConfig")
  : [
      "function parsePublicDemoTokenConfig(rawToken) {",
      "  return { value: String(rawToken || '').trim(), valid: true };",
      "}",
    ].join("\n");

function makeGate({ publicDemoMode, publicDemoToken }) {
  return new Function(
    "publicDemoMode",
    "rawPublicDemoToken",
    [
      "function sendJson(res, status, body) { res.status = status; res.body = body; }",
      "const validPublicDemoModes = new Set(['full', 'readonly', 'protected']);",
      parsePublicDemoTokenConfigSource,
      "const publicDemoTokenConfig = parsePublicDemoTokenConfig(rawPublicDemoToken);",
      "const publicDemoToken = publicDemoTokenConfig.value;",
      "const publicDemoTokenValid = publicDemoTokenConfig.valid;",
      extractFunctionSource(serverSrc, "firstHeaderValue"),
      extractFunctionSource(serverSrc, "isReadOnlyDemoMode"),
      extractFunctionSource(serverSrc, "isProtectedDemoMode"),
      extractFunctionSource(serverSrc, "isInvalidDemoMode"),
      extractFunctionSource(serverSrc, "publicDemoModeHealth"),
      extractFunctionSource(serverSrc, "tokenFromRequest"),
      extractFunctionSource(serverSrc, "sendDemoModeBlocked"),
      extractFunctionSource(serverSrc, "sendDemoModeInvalid"),
      extractFunctionSource(serverSrc, "requireLiveApiAccess"),
      "return { requireLiveApiAccess, tokenFromRequest, isInvalidDemoMode, publicDemoModeHealth };",
    ].join("\n"),
  )(publicDemoMode, publicDemoToken);
}

function makeResponseRecorder() {
  return { status: null, body: null };
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

let invalidModeGate = null;
let gateFactoryError = null;
try {
  invalidModeGate = makeGate({ publicDemoMode: "readnoly", publicDemoToken: "" });
} catch (error) {
  gateFactoryError = error;
}

checkTrue("invalid demo mode helper exists", !gateFactoryError, gateFactoryError?.message);

if (invalidModeGate) {
  const invalidModeRes = makeResponseRecorder();
  check("unknown demo mode health preserves raw configured mode",
    invalidModeGate.publicDemoModeHealth().publicDemoMode,
    "readnoly");
  check("unknown demo mode health marks mode invalid",
    invalidModeGate.publicDemoModeHealth().publicDemoModeValid,
    false);
  check("unknown demo mode health keeps readonly false",
    invalidModeGate.publicDemoModeHealth().readonly,
    false);
  check("unknown demo mode health keeps protected false",
    invalidModeGate.publicDemoModeHealth().protected,
    false);
  check("unknown demo mode is detected",
    invalidModeGate.isInvalidDemoMode(),
    true);
  check("unknown demo mode blocks live API access",
    invalidModeGate.requireLiveApiAccess({ headers: {} }, invalidModeRes),
    false);
  check("unknown demo mode returns 403",
    invalidModeRes.status,
    403);
  check("unknown demo mode returns stable code",
    invalidModeRes.body?.code,
    "PUBLIC_DEMO_MODE_INVALID");
  checkTrue("unknown demo mode response explains live API block",
    typeof invalidModeRes.body?.error === "string" && invalidModeRes.body.error.includes("live API"));
}

if (invalidModeGate) {
  const readonlyGate = makeGate({ publicDemoMode: "readonly", publicDemoToken: "" });
  const res = makeResponseRecorder();
  check("readonly mode health marks mode valid",
    readonlyGate.publicDemoModeHealth().publicDemoModeValid,
    true);
  check("readonly mode health marks readonly true",
    readonlyGate.publicDemoModeHealth().readonly,
    true);
  check("readonly mode blocks live API access",
    readonlyGate.requireLiveApiAccess({ headers: {} }, res),
    false);
  check("readonly mode keeps existing block code",
    res.body?.code,
    "PUBLIC_DEMO_READONLY");
}

if (invalidModeGate) {
  const protectedGate = makeGate({ publicDemoMode: "protected", publicDemoToken: "demo-secret" });
  const missingTokenRes = makeResponseRecorder();
  check("protected mode health marks mode valid",
    protectedGate.publicDemoModeHealth().publicDemoModeValid,
    true);
  check("protected mode health marks protected true",
    protectedGate.publicDemoModeHealth().protected,
    true);
  check("protected mode health marks token config valid",
    protectedGate.publicDemoModeHealth().publicDemoTokenValid,
    true);
  check("protected mode without request token blocks live API access",
    protectedGate.requireLiveApiAccess({ headers: {} }, missingTokenRes),
    false);
  check("protected mode without request token returns auth code",
    missingTokenRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const authorizedRes = makeResponseRecorder();
  check("protected mode with matching bearer token allows live API access",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "Bearer demo-secret" } }, authorizedRes),
    true);
  check("protected mode success does not write an error response",
    authorizedRes.body,
    null);

  const trailingBearerRes = makeResponseRecorder();
  check("protected mode rejects bearer token with trailing whitespace",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "Bearer demo-secret " } }, trailingBearerRes),
    false);
  check("protected mode trailing bearer returns unauthorized code",
    trailingBearerRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const trailingHeaderRes = makeResponseRecorder();
  check("protected mode rejects x-demo-token with trailing whitespace",
    protectedGate.requireLiveApiAccess({ headers: { "x-demo-token": "demo-secret " } }, trailingHeaderRes),
    false);
  check("protected mode trailing x-demo-token returns unauthorized code",
    trailingHeaderRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");
}

if (invalidModeGate) {
  const invalidTokenGate = makeGate({ publicDemoMode: "protected", publicDemoToken: " demo-secret" });
  const invalidTokenRes = makeResponseRecorder();
  check("protected mode health marks whitespace token config invalid",
    invalidTokenGate.publicDemoModeHealth().publicDemoTokenValid,
    false);
  check("protected mode blocks live API when token config is invalid",
    invalidTokenGate.requireLiveApiAccess({ headers: { authorization: "Bearer demo-secret" } }, invalidTokenRes),
    false);
  check("protected mode invalid token config returns 403",
    invalidTokenRes.status,
    403);
  check("protected mode invalid token config returns stable code",
    invalidTokenRes.body?.code,
    "PUBLIC_DEMO_TOKEN_INVALID");
}

if (invalidModeGate) {
  const whitespaceOnlyTokenGate = makeGate({ publicDemoMode: "protected", publicDemoToken: "   " });
  const whitespaceOnlyTokenRes = makeResponseRecorder();
  check("protected mode whitespace-only token config remains valid but missing",
    whitespaceOnlyTokenGate.publicDemoModeHealth().publicDemoTokenValid,
    true);
  check("protected mode whitespace-only token blocks live API",
    whitespaceOnlyTokenGate.requireLiveApiAccess({ headers: { authorization: "Bearer demo-secret" } }, whitespaceOnlyTokenRes),
    false);
  check("protected mode whitespace-only token keeps missing-token code",
    whitespaceOnlyTokenRes.body?.code,
    "PUBLIC_DEMO_TOKEN_REQUIRED");
}

if (invalidModeGate) {
  const fullGate = makeGate({ publicDemoMode: "full", publicDemoToken: "" });
  const res = makeResponseRecorder();
  check("full mode health marks mode valid",
    fullGate.publicDemoModeHealth().publicDemoModeValid,
    true);
  check("full mode health keeps readonly false",
    fullGate.publicDemoModeHealth().readonly,
    false);
  check("full mode health keeps protected false",
    fullGate.publicDemoModeHealth().protected,
    false);
  check("full mode allows live API access",
    fullGate.requireLiveApiAccess({ headers: {} }, res),
    true);
  check("full mode success does not write an error response",
    res.body,
    null);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
