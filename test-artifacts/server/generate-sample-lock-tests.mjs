// Phase 4 — generate-sample duplicate work lock regression tests.
//
// Writable external demos must not start two expensive Riot/API/AI sample
// generation jobs for the same match at the same time. These tests keep the
// lock helper behavior and the handler wiring visible without touching Riot.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let helpers = null;
try {
  helpers = new Function(
    [
      "const sampleGenerationLocks = new Map();",
      extractFunctionSource(serverSrc, "sampleGenerationLockKey"),
      extractFunctionSource(serverSrc, "sampleGenerationInProgressPayload"),
      extractFunctionSource(serverSrc, "sampleGenerationHealth"),
      extractFunctionSource(serverSrc, "withSampleGenerationLock"),
      "return { sampleGenerationLocks, sampleGenerationLockKey, sampleGenerationInProgressPayload, sampleGenerationHealth, withSampleGenerationLock };",
    ].join("\n"),
  )();
  checkTrue("sample generation lock helpers exist", true);
} catch (error) {
  checkTrue("sample generation lock helpers exist", false, error.message);
}

if (helpers) {
  const {
    sampleGenerationLockKey,
    sampleGenerationLocks,
    sampleGenerationInProgressPayload,
    sampleGenerationHealth,
    withSampleGenerationLock,
  } = helpers;

  check("sampleGenerationLockKey normalizes region and match",
    sampleGenerationLockKey({ platformRegion: " kr ", matchId: " kr_8242613150 " }),
    "KR:KR_8242613150");

  const payload = sampleGenerationInProgressPayload("KR_8242613150");
  check("in-progress payload ok=false", payload.ok, false);
  check("in-progress payload code", payload.code, "SAMPLE_GENERATION_IN_PROGRESS");
  check("in-progress payload includes matchId", payload.matchId, "KR_8242613150");
  checkTrue("in-progress payload is user-facing",
    typeof payload.error === "string" && payload.error.includes("샘플"));

  const blocker = deferred();
  const first = withSampleGenerationLock("KR:KR_8242613150", () => blocker.promise.then(() => "first done"));
  let secondError = null;
  try {
    await withSampleGenerationLock("KR:KR_8242613150", () => "second started");
  } catch (error) {
    secondError = error;
  }
  check("duplicate lock rejects with status 409", secondError?.statusCode, 409);
  check("duplicate lock rejects with stable code", secondError?.payload?.code, "SAMPLE_GENERATION_IN_PROGRESS");
  check("duplicate lock does not run second job", secondError?.payload?.matchId, "KR_8242613150");

  blocker.resolve();
  check("first locked job still resolves", await first, "first done");
  check("lock releases after success",
    await withSampleGenerationLock("KR:KR_8242613150", () => "after success"),
    "after success");

  const failure = withSampleGenerationLock("KR:KR_9999999999", () => Promise.reject(new Error("boom")));
  try {
    await failure;
  } catch {}
  check("lock releases after failure",
    await withSampleGenerationLock("KR:KR_9999999999", () => "after failure"),
    "after failure");

  sampleGenerationLocks.set("KR:KR_8242613150", 1000);
  sampleGenerationLocks.set("NA1:NA1_1111111111", 2500);
  check("sample generation health reports active count",
    sampleGenerationHealth(4000).activeCount,
    2);
  check("sample generation health reports oldest age",
    sampleGenerationHealth(4000).oldestAgeMs,
    3000);
  sampleGenerationLocks.set("KR:KR_FRACTIONAL", 1000.25);
  check("sample generation health floors fractional age to integer milliseconds",
    sampleGenerationHealth(4000.75).oldestAgeMs,
    3000);
  sampleGenerationLocks.delete("KR:KR_FRACTIONAL");
  check("sample generation health does not expose lock keys",
    Object.keys(sampleGenerationHealth(4000)).sort(),
    ["activeCount", "oldestAgeMs"]);
  sampleGenerationLocks.clear();
  check("sample generation health reports zero active work",
    sampleGenerationHealth(4000),
    { activeCount: 0, oldestAgeMs: 0 });
}

const handleGenerateSampleSrc = extractFunctionSource(serverSrc, "handleGenerateSample");
checkTrue("handleGenerateSample derives lock key from platformRegion and matchId",
  /const lockKey = sampleGenerationLockKey\(\{ platformRegion, matchId \}\);/.test(handleGenerateSampleSrc));
checkTrue("handleGenerateSample wraps generation work in the lock",
  /withSampleGenerationLock\(lockKey,\s*\(\)\s*=>/.test(handleGenerateSampleSrc));
checkTrue("handleGenerateSample maps duplicate generation to HTTP 409",
  /SAMPLE_GENERATION_IN_PROGRESS/.test(handleGenerateSampleSrc) && /sendJson\(res,\s*409/.test(handleGenerateSampleSrc));
checkTrue("healthz includes sample generation aggregate status",
  /sampleGeneration:\s*sampleGenerationHealth\(\)/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
