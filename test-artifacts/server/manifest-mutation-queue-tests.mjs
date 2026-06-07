// Phase 4 — manifest mutation queue regression tests.
//
// Atomic writes prevent partial JSON files, but concurrent read-modify-write
// operations can still lose manifest entries if two sample jobs save in
// parallel. The manifest upsert path must serialize mutations in-process.

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

function extractAsyncFunctionSource(source, name) {
  const startIdx = source.indexOf(`async function ${name}(`);
  if (startIdx < 0) throw new Error(`async function ${name} not found`);
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
  throw new Error(`async function ${name} not closed`);
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
  helpers = new Function(
    [
      "let manifestMutationQueue = Promise.resolve();",
      extractFunctionSource(serverSrc, "withManifestMutationLock"),
      "return { withManifestMutationLock };",
    ].join("\n"),
  )();
  checkTrue("manifest mutation lock helper exists", true);
} catch (error) {
  checkTrue("manifest mutation lock helper exists", false, error.message);
}

if (helpers) {
  const { withManifestMutationLock } = helpers;

  const blocker = deferred();
  const events = [];
  const first = withManifestMutationLock(async () => {
    events.push("first:start");
    await blocker.promise;
    events.push("first:end");
    return "first";
  });
  const second = withManifestMutationLock(async () => {
    events.push("second:start");
    return "second";
  });

  await Promise.resolve();
  await Promise.resolve();
  check("second mutation waits while first is pending", events, ["first:start"]);
  blocker.resolve();
  check("manifest mutations resolve in call order",
    await Promise.all([first, second]),
    ["first", "second"]);
  check("manifest mutation events are serialized",
    events,
    ["first:start", "first:end", "second:start"]);

  let failed = null;
  try {
    await withManifestMutationLock(async () => {
      throw new Error("mutation failed");
    });
  } catch (error) {
    failed = error;
  }
  check("manifest mutation errors still propagate", failed?.message, "mutation failed");
  check("manifest queue continues after a failure",
    await withManifestMutationLock(async () => "after failure"),
    "after failure");
}

const upsertSrc = extractAsyncFunctionSource(serverSrc, "upsertManifestEntry");
checkTrue("upsertManifestEntry runs inside manifest mutation lock",
  /return withManifestMutationLock\(async \(\) =>/.test(upsertSrc));
checkTrue("upsertManifestEntry still removes existing entry before unshift",
  /manifest\.samples\.filter\(\(sample\) => sample\.id !== entry\.id\)/.test(upsertSrc) &&
    /nextSamples\.unshift\(entry\)/.test(upsertSrc));
checkTrue("upsertManifestEntry saves and returns the mutated manifest inside lock",
  /await saveManifest\(manifest\)/.test(upsertSrc) && /return manifest/.test(upsertSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
