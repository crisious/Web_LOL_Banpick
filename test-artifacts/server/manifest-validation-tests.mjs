// Phase 4 — runtime sample manifest validation tests.
//
// Stored sample integrity tests catch committed fixture mistakes. Runtime
// validation catches operator-provided SAMPLES_DIR manifests that are valid
// JSON but not safe for the API to consume.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  return extractSourceFromStart(source, startIdx, `function ${name}`);
}

function extractAsyncFunctionSource(source, name) {
  const startIdx = source.indexOf(`async function ${name}(`);
  if (startIdx < 0) throw new Error(`async function ${name} not found`);
  return extractSourceFromStart(source, startIdx, `async function ${name}`);
}

function extractSourceFromStart(source, startIdx, label) {
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
  if (bodyStartIdx < 0) throw new Error(`${label} body not found`);

  let depth = 0;
  for (let i = bodyStartIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`${label} not closed`);
}

function makeHelpers(readJson, events) {
  return new Function(
    "readJson",
    "events",
    [
      "const manifestPath = '/samples/manifest.json';",
      extractFunctionSource(serverSrc, "manifestValidationError"),
      extractFunctionSource(serverSrc, "validateManifest"),
      extractAsyncFunctionSource(serverSrc, "loadManifest"),
      "return { manifestValidationError, validateManifest, loadManifest };",
    ].join("\n"),
  )(readJson, events);
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

let helpers = null;
try {
  helpers = makeHelpers(async () => ({ samples: [] }), []);
  checkTrue("manifest validation helpers exist", true);
} catch (error) {
  checkTrue("manifest validation helpers exist", false, error.message);
}

if (helpers) {
  const { validateManifest, loadManifest } = helpers;
  const validManifest = {
    samples: [{
      id: "sample-kr-1",
      normalizedPath: "/data/samples/sample-kr-1/normalized-match.json",
      analysisPath: "/data/samples/sample-kr-1/analysis-result.json",
    }],
  };

  check("valid manifest passes through",
    validateManifest(validManifest),
    validManifest);

  for (const [label, manifest, expectedMessage] of [
    ["manifest array is rejected", [], "Sample manifest must be a JSON object."],
    ["manifest without samples is rejected", {}, "Sample manifest must include a samples array."],
    ["manifest with invalid entry is rejected", { samples: [{ id: "sample-kr-1" }] }, "Sample manifest contains an invalid sample entry."],
  ]) {
    let caught = null;
    try {
      validateManifest(manifest);
    } catch (error) {
      caught = error;
    }
    check(`${label}: status`, caught?.statusCode, 500);
    check(`${label}: code`, caught?.payload?.code, "SAMPLE_MANIFEST_INVALID");
    check(`${label}: message`, caught?.payload?.error, expectedMessage);
  }

  {
    const events = [];
    const { loadManifest: loadValidManifest } = makeHelpers(async (filePath) => {
      events.push({ op: "readJson", filePath });
      return validManifest;
    }, events);
    check("loadManifest reads configured manifest path",
      await loadValidManifest(),
      validManifest);
    check("loadManifest validates data after readJson",
      events,
      [{ op: "readJson", filePath: "/samples/manifest.json" }]);
  }

  {
    const { loadManifest: loadInvalidManifest } = makeHelpers(async () => ({ samples: [null] }), []);
    let caught = null;
    try {
      await loadInvalidManifest();
    } catch (error) {
      caught = error;
    }
    check("loadManifest propagates validation code",
      caught?.payload?.code,
      "SAMPLE_MANIFEST_INVALID");
  }
}

checkTrue("top-level request catch reuses structured error status",
  /sendJson\(res,\s*error\?\.statusCode\s*\|\|\s*500/.test(serverSrc));
checkTrue("top-level request catch reuses structured error payload",
  /error\?\.payload\s*\|\|\s*\{[\s\S]*ok: false/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
