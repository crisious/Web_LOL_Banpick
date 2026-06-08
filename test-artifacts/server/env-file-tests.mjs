// Local .env loader regression tests.
//
// Public demo config must reach the exact mode/token validators unchanged, so
// the loader must not trim value whitespace before server startup.

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

function loadEnvFromString(raw, initialEnv = {}) {
  const fakeFs = {
    existsSync: () => true,
    readFileSync: () => raw,
  };
  const fakeProcess = { env: { ...initialEnv } };
  return new Function(
    "fs",
    "process",
    `${extractFunctionSource(serverSrc, "loadEnvFile")}\nloadEnvFile(".env");\nreturn process.env;`,
  )(fakeFs, fakeProcess);
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

const rawPublicDemoEnv = loadEnvFromString([
  "PUBLIC_DEMO_MODE= readonly",
  "PUBLIC_DEMO_TOKEN=demo-secret ",
  "PUBLIC_DEMO_CLEAN=readonly",
  "",
].join("\n"));

check("loadEnvFile preserves PUBLIC_DEMO_MODE leading value whitespace",
  rawPublicDemoEnv.PUBLIC_DEMO_MODE,
  " readonly");
check("loadEnvFile preserves PUBLIC_DEMO_TOKEN trailing value whitespace",
  rawPublicDemoEnv.PUBLIC_DEMO_TOKEN,
  "demo-secret ");
check("loadEnvFile keeps clean values unchanged",
  rawPublicDemoEnv.PUBLIC_DEMO_CLEAN,
  "readonly");

const quotedEnv = loadEnvFromString([
  "PUBLIC_DEMO_TOKEN=\"secret value\"",
  "PUBLIC_DEMO_MODE='readonly'",
].join("\n"));

check("loadEnvFile unwraps double-quoted values exactly",
  quotedEnv.PUBLIC_DEMO_TOKEN,
  "secret value");
check("loadEnvFile unwraps single-quoted values exactly",
  quotedEnv.PUBLIC_DEMO_MODE,
  "readonly");

const existingEnv = loadEnvFromString("PUBLIC_DEMO_MODE=readonly\n", { PUBLIC_DEMO_MODE: "protected" });
check("loadEnvFile does not overwrite existing env values",
  existingEnv.PUBLIC_DEMO_MODE,
  "protected");

const missingFileFakeFs = {
  existsSync: () => false,
  readFileSync: () => {
    throw new Error("should not read missing .env");
  },
};
const missingFileProcess = { env: {} };
let missingFileError = null;
try {
  new Function(
    "fs",
    "process",
    `${extractFunctionSource(serverSrc, "loadEnvFile")}\nloadEnvFile(".env");\nreturn process.env;`,
  )(missingFileFakeFs, missingFileProcess);
} catch (error) {
  missingFileError = error;
}

checkTrue("loadEnvFile ignores missing files",
  !missingFileError,
  missingFileError?.message);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
