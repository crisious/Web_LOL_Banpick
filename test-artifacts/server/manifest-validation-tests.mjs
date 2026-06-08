// Phase 4 — runtime sample manifest validation tests.
//
// Stored sample integrity tests catch committed fixture mistakes. Runtime
// validation catches operator-provided SAMPLES_DIR manifests that are valid
// JSON but not safe for the API to consume.

import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const manifestModule = require("../../lib/sample-manifest.js");
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

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

function makeHelpers(readJson, writeJson, events) {
  return new Function(
    "readJson",
    "writeJson",
    "events",
    "validateManifest",
    [
      "const manifestPath = '/samples/manifest.json';",
      extractAsyncFunctionSource(serverSrc, "loadManifest"),
      extractAsyncFunctionSource(serverSrc, "saveManifest"),
      "return { loadManifest, saveManifest };",
    ].join("\n"),
  )(readJson, writeJson, events, manifestModule.validateManifest);
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
  helpers = makeHelpers(async () => ({ samples: [] }), async () => {}, []);
  checkTrue("manifest validation helpers exist", true);
} catch (error) {
  checkTrue("manifest validation helpers exist", false, error.message);
}

if (helpers) {
  const { validateManifest } = manifestModule;
  const validSample = {
    id: "sample-kr-1",
    matchId: "KR_1",
    label: "sample-kr-1 · MID WIN",
    champion: "Ahri",
    publicAlias: "Tester#KR1",
    collectedDate: "2026-06-07",
    theme: "Runtime manifest validation fixture",
    normalizedPath: "/data/samples/sample-kr-1/normalized-match.json",
    analysisPath: "/data/samples/sample-kr-1/analysis-result.json",
    notesPath: "/data/samples/sample-kr-1/sample-kr-1-notes.md",
  };
  const validManifest = {
    schemaVersion: 1,
    samples: [validSample],
  };
  const legacyManifest = {
    samples: [validSample],
  };
  const sampleWithId = (id) => ({
    ...validSample,
    id,
    normalizedPath: `/data/samples/${id}/normalized-match.json`,
    analysisPath: `/data/samples/${id}/analysis-result.json`,
    notesPath: `/data/samples/${id}/${id}-notes.md`,
  });

  check("valid manifest passes through",
    validateManifest(validManifest),
    validManifest);
  check("legacy manifest defaults to schemaVersion 1",
    validateManifest(legacyManifest),
    { schemaVersion: 1, samples: [validSample] });

  for (const [label, manifest, expectedMessage] of [
    ["manifest array is rejected", [], "Sample manifest must be a JSON object."],
    ["manifest without samples is rejected", {}, "Sample manifest must include a samples array."],
    ["manifest with null entry is rejected", { samples: [null] }, "Sample manifest contains an invalid sample entry."],
    ["manifest with missing metadata field is rejected", { samples: [{ ...validSample, label: "" }] }, "Sample manifest entry missing required field: label."],
    ["manifest with missing notes path is rejected", { samples: [{ ...validSample, notesPath: "" }] }, "Sample manifest entry missing required field: notesPath."],
    ["manifest uppercase sample id is rejected", { samples: [sampleWithId("Sample-KR-1")] }, "Sample manifest entry id must be a lowercase generated sample id."],
    ["manifest slash sample id is rejected", { samples: [sampleWithId("sample-kr/1")] }, "Sample manifest entry id must be a lowercase generated sample id."],
    ["manifest encoded slash sample id is rejected", { samples: [sampleWithId("sample%2Fsecret")] }, "Sample manifest entry id must be a lowercase generated sample id."],
    ["manifest whitespace sample id is rejected", { samples: [sampleWithId("sample-kr-1 ")] }, "Sample manifest entry id must be a lowercase generated sample id."],
    ["manifest trailing hyphen sample id is rejected", { samples: [sampleWithId("sample-kr-1-")] }, "Sample manifest entry id must be a lowercase generated sample id."],
    ["manifest duplicate sample id is rejected", {
      samples: [
        validSample,
        {
          ...validSample,
          matchId: "KR_2",
          label: "sample-kr-1 duplicate",
        },
      ],
    }, "Sample manifest entry id must be unique: sample-kr-1."],
    ["manifest path outside sample directory is rejected", { samples: [{ ...validSample, normalizedPath: "/data/samples/other-sample/normalized-match.json" }] }, "Sample manifest entry path must stay under /data/samples/sample-kr-1/: normalizedPath."],
    ["manifest path without public prefix is rejected", { samples: [{ ...validSample, analysisPath: "data/samples/sample-kr-1/analysis-result.json" }] }, "Sample manifest entry path must stay under /data/samples/sample-kr-1/: analysisPath."],
    ["manifest raw path exposure is rejected", { samples: [{ ...validSample, analysisPath: "/data/samples/sample-kr-1/raw-match.json" }] }, "Sample manifest entry path must not expose raw/internal files: analysisPath."],
    ["manifest manifest-file exposure is rejected", { samples: [{ ...validSample, notesPath: "/data/samples/sample-kr-1/manifest.json" }] }, "Sample manifest entry path must not expose raw/internal files: notesPath."],
    ["manifest with unsupported schemaVersion is rejected", { schemaVersion: 2, samples: [] }, "Unsupported sample manifest schemaVersion: 2."],
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
    }, async () => {}, events);
    check("loadManifest reads configured manifest path",
      await loadValidManifest(),
      validManifest);
    check("loadManifest validates data after readJson",
      events,
      [{ op: "readJson", filePath: "/samples/manifest.json" }]);
  }

  {
    const { loadManifest: loadInvalidManifest } = makeHelpers(async () => ({ samples: [null] }), async () => {}, []);
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

  {
    const events = [];
    const { saveManifest } = makeHelpers(async () => validManifest, async (filePath, data) => {
      events.push({ op: "writeJson", filePath, data });
    }, events);
    await saveManifest(validManifest);
    check("saveManifest writes valid manifest",
      events,
      [{ op: "writeJson", filePath: "/samples/manifest.json", data: validManifest }]);
  }

  {
    const events = [];
    const { saveManifest } = makeHelpers(async () => validManifest, async (filePath, data) => {
      events.push({ op: "writeJson", filePath, data });
    }, events);
    await saveManifest(legacyManifest);
    check("saveManifest writes legacy manifest as versioned v1",
      events,
      [{ op: "writeJson", filePath: "/samples/manifest.json", data: { schemaVersion: 1, samples: [validSample] } }]);
  }

  {
    const events = [];
    const { saveManifest } = makeHelpers(async () => validManifest, async (filePath, data) => {
      events.push({ op: "writeJson", filePath, data });
    }, events);
    let caught = null;
    try {
      await saveManifest({ samples: [{ id: "sample-kr-1" }] });
    } catch (error) {
      caught = error;
    }
    check("saveManifest rejects invalid manifest before write",
      caught?.payload?.code,
      "SAMPLE_MANIFEST_INVALID");
    check("saveManifest does not write invalid manifest",
      events,
      []);
  }
}

checkTrue("server declares sample manifest schema version",
  /SAMPLE_MANIFEST_SCHEMA_VERSION/.test(fs.readFileSync(new URL("../../lib/sample-manifest.js", import.meta.url), "utf8")));
checkTrue("server imports shared sample manifest validator",
  /require\("\.\/lib\/sample-manifest"\)/.test(serverSrc) &&
    /validateManifest/.test(serverSrc));
checkTrue("top-level request catch reuses structured error status",
  /sendJson\(res,\s*error\?\.statusCode\s*\|\|\s*500/.test(serverSrc));
checkTrue("top-level request catch reuses structured error payload",
  /error\?\.payload\s*\|\|\s*internalServerErrorPayload\(error\)/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
