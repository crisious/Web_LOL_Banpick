// Stored sample bundle required-file error regression tests.
//
// Operator-provided SAMPLES_DIR manifests can point at missing or malformed
// required report JSON files. The public detail API should return a stable
// diagnostic without leaking local filesystem paths.

import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { validateManifest } = require("../../lib/sample-manifest.js");
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

const validSample = {
  id: "sample-kr-1",
  matchId: "KR_1",
  label: "sample-kr-1 · MID WIN",
  champion: "Ahri",
  publicAlias: "Tester#KR1",
  collectedDate: "2026-06-08",
  theme: "Required bundle read fixture",
  normalizedPath: "/data/samples/sample-kr-1/normalized-match.json",
  analysisPath: "/data/samples/sample-kr-1/analysis-result.json",
  notesPath: "/data/samples/sample-kr-1/sample-kr-1-notes.md",
};
const manifest = { schemaVersion: 1, samples: [validSample] };
const validNormalized = {
  matchInfo: { champion: "Ahri", result: "WIN" },
  playerContext: {},
  playerStats: {},
  timelineEvents: [],
  playtimeScore: { overall: 70 },
  objectiveTimeline: [],
  kdaTimeline: [],
  wardTimeline: [],
  itemTimeline: [],
  challengeStats: {},
};
const validAnalysis = {
  matchSummary: { headline: "Stable sample" },
  coachSummary: { overallSummary: "Keep the report available." },
};

function storagePath(publicPath) {
  return `/runtime/samples/${String(publicPath || "").replace(/^\/data\/samples\//, "")}`;
}

function makeHarness(readJson) {
  return new Function(
    "readJson",
    "validateManifest",
    "sampleEntryStoragePath",
    "sampleStoragePath",
    "buildPlaytimeScore",
    "buildObjectiveTimeline",
    "buildKdaTimeline",
    "buildWardTimeline",
    "buildItemTimeline",
    "hydrateStoredTeamplayV2",
    [
      "const manifestPath = '/runtime/samples/manifest.json';",
      extractAsyncFunctionSource(serverSrc, "loadManifest"),
      extractAsyncFunctionSource(serverSrc, "loadSampleBundle"),
      "return { loadSampleBundle };",
    ].join("\n"),
  )(
    readJson,
    validateManifest,
    storagePath,
    (sampleId, ...segments) => `/runtime/samples/${sampleId}/${segments.join("/")}`,
    () => ({ overall: 0 }),
    () => [],
    () => [],
    () => [],
    () => [],
    ({ normalized, analysis }) => ({ normalized, analysis }),
  );
}

function readJsonFor(mode) {
  return async (filePath) => {
    if (filePath === "/runtime/samples/manifest.json") return manifest;
    if (filePath === storagePath(validSample.normalizedPath)) {
      if (mode === "missing-normalized") {
        throw new Error("ENOENT: no such file or directory, open '/runtime/samples/sample-kr-1/normalized-match.json'");
      }
      return validNormalized;
    }
    if (filePath === storagePath(validSample.analysisPath)) {
      if (mode === "invalid-analysis") {
        throw new Error("Unexpected token < in JSON at position 0 while reading /runtime/samples/sample-kr-1/analysis-result.json");
      }
      return validAnalysis;
    }
    throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
  };
}

async function captureLoad(mode) {
  const { loadSampleBundle } = makeHarness(readJsonFor(mode));
  try {
    return { bundle: await loadSampleBundle("sample-kr-1"), error: null };
  } catch (error) {
    return { bundle: null, error };
  }
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

const validLoad = await captureLoad("ok");
check("valid bundle returns sample id", validLoad.bundle?.sampleId, "sample-kr-1");
check("valid bundle returns analysis", validLoad.bundle?.analysis, validAnalysis);

for (const [label, mode] of [
  ["missing normalized file", "missing-normalized"],
  ["invalid analysis JSON", "invalid-analysis"],
]) {
  const { error } = await captureLoad(mode);
  const fallbackPayload = error?.payload || { ok: false, error: error?.message };
  const payloadText = JSON.stringify(fallbackPayload);
  check(`${label}: status`, error?.statusCode, 500);
  check(`${label}: code`, error?.payload?.code, "SAMPLE_BUNDLE_UNAVAILABLE");
  check(`${label}: sample id`, error?.payload?.sampleId, "sample-kr-1");
  check(`${label}: safe message`, error?.payload?.error, "저장 샘플 리포트 파일을 읽을 수 없습니다.");
  checkTrue(`${label}: payload does not expose runtime path`,
    !payloadText.includes("/runtime/samples") && !payloadText.includes("ENOENT") && !payloadText.includes("Unexpected token"),
    payloadText);
}

checkTrue("loadSampleBundle declares stable sample bundle error",
  /SAMPLE_BUNDLE_UNAVAILABLE/.test(serverSrc) && /저장 샘플 리포트 파일을 읽을 수 없습니다\./.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
