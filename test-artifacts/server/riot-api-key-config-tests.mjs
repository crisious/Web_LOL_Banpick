// Riot API key config regression tests.
//
// Server-side Riot API keys and direct request overrides should be exact secret
// strings. Whitespace or control characters must not be silently normalized.

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

const resolveApiKeySource = extractFunctionSource(serverSrc, "resolveApiKey");
const parseRiotApiKeyConfigSource = serverSrc.includes("function parseRiotApiKeyConfig(")
  ? extractFunctionSource(serverSrc, "parseRiotApiKeyConfig")
  : "";

function makeResolveApiKey(env = {}) {
  return new Function(
    "process",
    `${parseRiotApiKeyConfigSource}\n${resolveApiKeySource}\nreturn resolveApiKey;`,
  )({ env });
}

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

const userKey = "RGAPI-user-key-abcdefghijklmnopqrstuvwxyz";
const envKey = "RGAPI-env-key-abcdefghijklmnopqrstuvwxyz";

check("exact request body Riot key wins over env",
  makeResolveApiKey({ RIOT_API_KEY: envKey })(userKey),
  userKey);
check("missing request body Riot key falls back to env",
  makeResolveApiKey({ RIOT_API_KEY: envKey })(undefined),
  envKey);
check("empty request body Riot key falls back to env",
  makeResolveApiKey({ RIOT_API_KEY: envKey })(""),
  envKey);
check("invalid request body Riot key falls back to env",
  makeResolveApiKey({ RIOT_API_KEY: envKey })("not-a-key"),
  envKey);
check("trailing whitespace request body Riot key is not trimmed",
  makeResolveApiKey({})(`${userKey} `),
  null);
check("internal whitespace request body Riot key is rejected",
  makeResolveApiKey({})(`${userKey.slice(0, 12)} ${userKey.slice(12)}`),
  null);
check("trailing whitespace env Riot key is rejected",
  makeResolveApiKey({ RIOT_API_KEY: `${envKey} ` })(undefined),
  null);
check("internal whitespace env Riot key is rejected",
  makeResolveApiKey({ RIOT_API_KEY: `${envKey.slice(0, 10)} ${envKey.slice(10)}` })(undefined),
  null);
check("whitespace-only env Riot key is rejected",
  makeResolveApiKey({ RIOT_API_KEY: "   " })(undefined),
  null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
