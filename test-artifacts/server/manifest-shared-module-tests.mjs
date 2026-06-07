// Shared sample manifest validation module tests.
//
// These tests keep the manifest schema contract importable without starting
// the HTTP server, so runtime validation and stored fixture tests can share
// one set of constants and helper behavior.

import { createRequire } from "module";

const require = createRequire(import.meta.url);
let manifestModule = null;
let loadError = null;

try {
  manifestModule = require("../../lib/sample-manifest.js");
} catch (error) {
  loadError = error;
}

let pass = 0;
let fail = 0;

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

checkTrue("sample manifest module loads", Boolean(manifestModule), loadError?.message || "");

if (manifestModule) {
  const {
    SAMPLE_MANIFEST_SCHEMA_VERSION,
    REQUIRED_MANIFEST_ENTRY_FIELDS,
    MANIFEST_ENTRY_PATH_FIELDS,
    MANIFEST_ENTRY_RAW_PATH_PATTERN,
    validateManifestEntryPaths,
    validateManifest,
  } = manifestModule;

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

  check("schema version export", SAMPLE_MANIFEST_SCHEMA_VERSION, 1);
  check("required entry fields export", REQUIRED_MANIFEST_ENTRY_FIELDS, [
    "id",
    "matchId",
    "label",
    "champion",
    "publicAlias",
    "collectedDate",
    "theme",
    "normalizedPath",
    "analysisPath",
    "notesPath",
  ]);
  check("path fields export", MANIFEST_ENTRY_PATH_FIELDS, ["normalizedPath", "analysisPath", "notesPath"]);
  checkTrue("raw path pattern export", MANIFEST_ENTRY_RAW_PATH_PATTERN instanceof RegExp);
  check("valid entry paths return null", validateManifestEntryPaths(validSample), null);
  check("escaped entry path error",
    validateManifestEntryPaths({ ...validSample, analysisPath: "/data/samples/other-sample/analysis-result.json" }),
    "Sample manifest entry path must stay under /data/samples/sample-kr-1/: analysisPath.");
  check("raw entry path error",
    validateManifestEntryPaths({ ...validSample, notesPath: "/data/samples/sample-kr-1/manifest.json" }),
    "Sample manifest entry path must not expose raw/internal files: notesPath.");
  check("legacy manifest normalizes through shared module",
    validateManifest({ samples: [validSample] }),
    { schemaVersion: 1, samples: [validSample] });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
