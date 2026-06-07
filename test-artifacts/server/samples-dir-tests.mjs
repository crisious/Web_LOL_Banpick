// Phase 4 — SAMPLES_DIR storage path regression tests.
//
// Public manifest entries intentionally keep /data/samples/... paths, but the
// server must be able to store and read the underlying files from an operator
// supplied SAMPLES_DIR outside the app checkout.

import fs from "fs";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);
const {
  sampleManifestPublicPathToStorageRelativePath,
} = require("../../lib/sample-manifest.js");
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
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
  if (bodyStartIdx < 0) throw new Error(`function ${name} body not found`);
  let depth = 0;
  for (let i = bodyStartIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

function extractAsyncFunctionSource(source, name) {
  const startIdx = source.indexOf(`async function ${name}(`);
  if (startIdx < 0) throw new Error(`async function ${name} not found`);
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
  if (bodyStartIdx < 0) throw new Error(`async function ${name} body not found`);
  let depth = 0;
  for (let i = bodyStartIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`async function ${name} not closed`);
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

function checkThrows(label, fn, expectedMessage) {
  let caught = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  check(label, caught?.message, expectedMessage);
}

let helpers = null;
try {
  helpers = new Function(
    "path",
    "sampleManifestPublicPathToStorageRelativePath",
    [
      "const root = '/app/lol-ai-coach';",
      "const samplesDir = '/mnt/lol-ai-coach-samples';",
      extractFunctionSource(serverSrc, "resolveSamplesDir"),
      extractFunctionSource(serverSrc, "sampleStoragePath"),
      extractFunctionSource(serverSrc, "sampleEntryStoragePath"),
      "return { resolveSamplesDir, sampleStoragePath, sampleEntryStoragePath };",
    ].join("\n"),
  )(path, sampleManifestPublicPathToStorageRelativePath);
  checkTrue("SAMPLES_DIR path helpers exist", true);
} catch (error) {
  checkTrue("SAMPLES_DIR path helpers exist", false, error.message);
}

if (helpers) {
  const { resolveSamplesDir, sampleStoragePath, sampleEntryStoragePath } = helpers;
  check("resolveSamplesDir defaults to app data/samples",
    resolveSamplesDir("", "/app/lol-ai-coach"),
    "/app/lol-ai-coach/data/samples");
  check("resolveSamplesDir trims and resolves relative paths from app root",
    resolveSamplesDir("  runtime/samples  ", "/app/lol-ai-coach"),
    "/app/lol-ai-coach/runtime/samples");
  check("resolveSamplesDir keeps absolute paths",
    resolveSamplesDir("/var/lib/lol-ai-coach/samples", "/app/lol-ai-coach"),
    "/var/lib/lol-ai-coach/samples");
  check("sampleStoragePath joins under configured samplesDir",
    sampleStoragePath("sample-kr-1", "raw-match.json"),
    "/mnt/lol-ai-coach-samples/sample-kr-1/raw-match.json");
  check("sampleEntryStoragePath maps public data paths to samplesDir",
    sampleEntryStoragePath("/data/samples/sample-kr-1/normalized-match.json"),
    "/mnt/lol-ai-coach-samples/sample-kr-1/normalized-match.json");
  checkThrows("sampleEntryStoragePath rejects sample paths without public slash",
    () => sampleEntryStoragePath("data/samples/sample-kr-1/analysis-result.json"),
    "Invalid sample manifest public path: data/samples/sample-kr-1/analysis-result.json");
  checkThrows("sampleEntryStoragePath rejects traversal in sample public paths",
    () => sampleEntryStoragePath("/data/samples/sample-kr-1/../other/analysis-result.json"),
    "Invalid sample manifest public path: /data/samples/sample-kr-1/../other/analysis-result.json");
  check("sampleEntryStoragePath preserves legacy non-sample app-relative paths",
    sampleEntryStoragePath("/legacy/fixture.json"),
    "/app/lol-ai-coach/legacy/fixture.json");
}

checkTrue("manifestPath is derived from samplesDir",
  /const samplesDir = resolveSamplesDir\(process\.env\.SAMPLES_DIR, root\);/.test(serverSrc) &&
    /const manifestPath = path\.join\(samplesDir,\s*"manifest\.json"\);/.test(serverSrc));

const loadSampleBundleSrc = extractAsyncFunctionSource(serverSrc, "loadSampleBundle");
checkTrue("loadSampleBundle reads manifest public paths through sampleEntryStoragePath",
  /readJson\(sampleEntryStoragePath\(entry\.normalizedPath\)\)/.test(loadSampleBundleSrc) &&
    /readJson\(sampleEntryStoragePath\(entry\.analysisPath\)\)/.test(loadSampleBundleSrc));
const sampleEntryStoragePathSrc = extractFunctionSource(serverSrc, "sampleEntryStoragePath");
checkTrue("sampleEntryStoragePath uses shared public path helper",
  /sampleManifestPublicPathToStorageRelativePath\(publicPath\)/.test(sampleEntryStoragePathSrc));
checkTrue("loadSampleBundle reads supplemental sample files through sampleStoragePath",
  /sampleStoragePath\(sampleId,\s*"raw-timeline\.json"\)/.test(loadSampleBundleSrc) &&
    /sampleStoragePath\(sampleId,\s*"raw-match\.json"\)/.test(loadSampleBundleSrc) &&
    /sampleStoragePath\(sampleId,\s*"comparison-result\.json"\)/.test(loadSampleBundleSrc));

const runGenerateSampleJobSrc = extractAsyncFunctionSource(serverSrc, "runGenerateSampleJob");
checkTrue("runGenerateSampleJob writes sample files under sampleStoragePath",
  /const sampleDir = sampleStoragePath\(sampleId\);/.test(runGenerateSampleJobSrc));
checkTrue("runGenerateSampleJob keeps public manifest paths stable",
  /normalizedPath: `\/data\/samples\/\$\{sampleId\}\/normalized-match\.json`/.test(runGenerateSampleJobSrc) &&
    /analysisPath: `\/data\/samples\/\$\{sampleId\}\/analysis-result\.json`/.test(runGenerateSampleJobSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
