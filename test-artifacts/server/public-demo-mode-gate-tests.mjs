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

const parsePublicDemoModeConfigSource = serverSrc.includes("function parsePublicDemoModeConfig(")
  ? extractFunctionSource(serverSrc, "parsePublicDemoModeConfig")
  : [
      "function parsePublicDemoModeConfig(rawMode) {",
      "  return { value: String(rawMode || 'full').trim().toLowerCase(), valid: true };",
      "}",
    ].join("\n");

function makeGate({ publicDemoMode, publicDemoToken }) {
  return new Function(
    "rawPublicDemoMode",
    "rawPublicDemoToken",
    [
      "function sendJson(res, status, body) { res.status = status; res.body = body; }",
      "const validPublicDemoModes = new Set(['full', 'readonly', 'protected']);",
      parsePublicDemoModeConfigSource,
      "const publicDemoModeConfig = parsePublicDemoModeConfig(rawPublicDemoMode);",
      "const publicDemoMode = publicDemoModeConfig.value;",
      "const publicDemoModeValid = publicDemoModeConfig.valid;",
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
  const missingModeGate = makeGate({ publicDemoMode: undefined, publicDemoToken: "" });
  const emptyModeGate = makeGate({ publicDemoMode: "", publicDemoToken: "" });
  check("missing public demo mode defaults to full",
    missingModeGate.publicDemoModeHealth().publicDemoMode,
    "full");
  check("missing public demo mode is valid",
    missingModeGate.publicDemoModeHealth().publicDemoModeValid,
    true);
  check("empty public demo mode defaults to full",
    emptyModeGate.publicDemoModeHealth().publicDemoMode,
    "full");
  check("empty public demo mode is valid",
    emptyModeGate.publicDemoModeHealth().publicDemoModeValid,
    true);
}

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
  const whitespaceModeGate = makeGate({ publicDemoMode: " readonly", publicDemoToken: "" });
  const whitespaceModeRes = makeResponseRecorder();
  check("whitespace demo mode health preserves raw configured mode",
    whitespaceModeGate.publicDemoModeHealth().publicDemoMode,
    " readonly");
  check("whitespace demo mode health marks mode invalid",
    whitespaceModeGate.publicDemoModeHealth().publicDemoModeValid,
    false);
  check("whitespace demo mode keeps readonly false",
    whitespaceModeGate.publicDemoModeHealth().readonly,
    false);
  check("whitespace demo mode blocks live API access",
    whitespaceModeGate.requireLiveApiAccess({ headers: {} }, whitespaceModeRes),
    false);
  check("whitespace demo mode returns stable code",
    whitespaceModeRes.body?.code,
    "PUBLIC_DEMO_MODE_INVALID");
}

if (invalidModeGate) {
  const uppercaseModeGate = makeGate({ publicDemoMode: "READONLY", publicDemoToken: "" });
  const uppercaseModeRes = makeResponseRecorder();
  check("uppercase demo mode health preserves raw configured mode",
    uppercaseModeGate.publicDemoModeHealth().publicDemoMode,
    "READONLY");
  check("uppercase demo mode health marks mode invalid",
    uppercaseModeGate.publicDemoModeHealth().publicDemoModeValid,
    false);
  check("uppercase demo mode keeps readonly false",
    uppercaseModeGate.publicDemoModeHealth().readonly,
    false);
  check("uppercase demo mode blocks live API access",
    uppercaseModeGate.requireLiveApiAccess({ headers: {} }, uppercaseModeRes),
    false);
  check("uppercase demo mode returns stable code",
    uppercaseModeRes.body?.code,
    "PUBLIC_DEMO_MODE_INVALID");
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

  const doubleSpaceBearerRes = makeResponseRecorder();
  check("protected mode rejects bearer token with double-space separator",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "Bearer  demo-secret" } }, doubleSpaceBearerRes),
    false);
  check("protected mode double-space bearer returns unauthorized code",
    doubleSpaceBearerRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const tabBearerRes = makeResponseRecorder();
  check("protected mode rejects bearer token with tab separator",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "Bearer\tdemo-secret" } }, tabBearerRes),
    false);
  check("protected mode tab bearer returns unauthorized code",
    tabBearerRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const lowercaseBearerRes = makeResponseRecorder();
  check("protected mode rejects lowercase bearer scheme",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "bearer demo-secret" } }, lowercaseBearerRes),
    false);
  check("protected mode lowercase bearer returns unauthorized code",
    lowercaseBearerRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const lowercaseBearerWithHeaderTokenRes = makeResponseRecorder();
  check("protected mode rejects lowercase bearer even when x-demo-token matches",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "bearer demo-secret", "x-demo-token": "demo-secret" } }, lowercaseBearerWithHeaderTokenRes),
    false);
  check("protected mode lowercase bearer with x-demo-token returns unauthorized code",
    lowercaseBearerWithHeaderTokenRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const basicAuthWithHeaderTokenRes = makeResponseRecorder();
  check("protected mode rejects non-bearer Authorization even when x-demo-token matches",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "Basic demo-secret", "x-demo-token": "demo-secret" } }, basicAuthWithHeaderTokenRes),
    false);
  check("protected mode non-bearer Authorization with x-demo-token returns unauthorized code",
    basicAuthWithHeaderTokenRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

  const whitespaceAuthWithHeaderTokenRes = makeResponseRecorder();
  check("protected mode rejects whitespace Authorization even when x-demo-token matches",
    protectedGate.requireLiveApiAccess({ headers: { authorization: "   ", "x-demo-token": "demo-secret" } }, whitespaceAuthWithHeaderTokenRes),
    false);
  check("protected mode whitespace Authorization with x-demo-token returns unauthorized code",
    whitespaceAuthWithHeaderTokenRes.body?.code,
    "PUBLIC_DEMO_UNAUTHORIZED");

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
