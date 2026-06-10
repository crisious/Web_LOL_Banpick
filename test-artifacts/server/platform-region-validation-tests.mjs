// Platform region SSRF regression tests.
//
// /api/recent-matches, /api/champion-history, /api/generate-sample take a
// client-supplied `platformRegion` and use it to build Riot host names. An
// unvalidated value lets an attacker steer requests (and the X-Riot-Token
// header) at an arbitrary host. These tests pin the whitelist helpers and
// confirm the raw-interpolation sink is gone.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

let pass = 0;
let fail = 0;
function check(label, cond, detail = "") {
  if (cond) {
    pass += 1;
    console.log(`PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label}${detail ? `  — ${detail}` : ""}`);
  }
}

function extractFunctionSource(source, name) {
  let startIdx = source.indexOf(`function ${name}(`);
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

// Build an isolated module from the extracted pure helpers.
const helperSource = [
  serverSrc.slice(serverSrc.indexOf("const PLATFORM_CLUSTERS"), serverSrc.indexOf("function isValidPlatformRegion")),
  extractFunctionSource(serverSrc, "isValidPlatformRegion"),
  extractFunctionSource(serverSrc, "regionalCluster"),
  extractFunctionSource(serverSrc, "platformHostFor"),
  "return { isValidPlatformRegion, regionalCluster, platformHostFor, PLATFORM_CLUSTERS };",
].join("\n");

const helpers = new Function(helperSource)();
const { isValidPlatformRegion, regionalCluster, platformHostFor } = helpers;

// --- whitelist membership ---
for (const region of ["KR", "JP1", "NA1", "BR1", "LA1", "LA2", "EUW1", "EUN1", "TR1", "RU"]) {
  check(`accepts supported region ${region}`, isValidPlatformRegion(region) === true);
}
check("accepts lower-case supported region", isValidPlatformRegion("kr") === true);

// --- rejects injection / unknown values ---
for (const bad of [
  "evil.com/",
  "evil.com",
  "KR/../",
  "KR?x=1",
  "KR#frag",
  "KR.api.riotgames.com.attacker.test",
  "",
  "   ",
  "ZZ9",
  null,
  undefined,
  "169.254.169.254",
]) {
  check(`rejects unsupported/injection region ${JSON.stringify(bad)}`, isValidPlatformRegion(bad) === false);
}

// --- platformHostFor returns a host only for whitelisted regions ---
check("platformHostFor builds host for KR", platformHostFor("KR") === "kr.api.riotgames.com");
check("platformHostFor builds host for NA1", platformHostFor("NA1") === "na1.api.riotgames.com");
check("platformHostFor returns null for injection", platformHostFor("evil.com/") === null);
check("platformHostFor returns null for unknown", platformHostFor("ZZ9") === null);
check("platformHostFor never yields a non-riotgames host",
  ["KR", "JP1", "NA1", "BR1", "LA1", "LA2", "EUW1", "EUN1", "TR1", "RU"].every(
    (r) => platformHostFor(r).endsWith(".api.riotgames.com"),
  ));

// --- regionalCluster only ever returns known clusters ---
const allowedClusters = new Set(["asia", "americas", "europe"]);
check("regionalCluster maps known regions to known clusters",
  ["KR", "JP1", "NA1", "BR1", "LA1", "LA2", "EUW1", "EUN1", "TR1", "RU"].every(
    (r) => allowedClusters.has(regionalCluster(r)),
  ));
check("regionalCluster falls back to a safe constant cluster, never user input",
  allowedClusters.has(regionalCluster("evil.com/")));

// --- the raw-interpolation sink must be gone from source ---
check("server no longer builds platformHost from raw region interpolation",
  !/`\$\{platformRegion\.toLowerCase\(\)\}\.api\.riotgames\.com`/.test(serverSrc),
  "found raw `${platformRegion.toLowerCase()}.api.riotgames.com` template");
check("each region-taking handler validates via isValidPlatformRegion",
  (serverSrc.match(/if \(!isValidPlatformRegion\(platformRegion\)\)/g) || []).length >= 3,
  "expected >=3 isValidPlatformRegion guards");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
