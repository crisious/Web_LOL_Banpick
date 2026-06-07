// Phase 4 — cross-process manifest file lock regression tests.
//
// In-process queues protect one Node process. When multiple processes share a
// SAMPLES_DIR, the manifest read-modify-write section also needs a filesystem
// lock so one process cannot overwrite another process' manifest update.

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

function makeHelpers(fakeFsp, events) {
  return new Function(
    "fsp",
    "events",
    [
      "const manifestFileLockPath = '/samples/.manifest.lock';",
      "const MANIFEST_FILE_LOCK_TIMEOUT_MS = 30;",
      "const MANIFEST_FILE_LOCK_RETRY_MS = 5;",
      "let now = 1000;",
      "const Date = { now: () => now };",
      "const sleep = async (ms) => { events.push({ op: 'sleep', ms }); now += ms; };",
      extractAsyncFunctionSource(serverSrc, "acquireManifestFileLock"),
      extractAsyncFunctionSource(serverSrc, "releaseManifestFileLock"),
      extractAsyncFunctionSource(serverSrc, "withManifestFileLock"),
      "return { acquireManifestFileLock, releaseManifestFileLock, withManifestFileLock };",
    ].join("\n"),
  )(fakeFsp, events);
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
  helpers = makeHelpers({
    async mkdir() {},
    async rmdir() {},
  }, []);
  checkTrue("manifest file lock helpers exist", true);
} catch (error) {
  checkTrue("manifest file lock helpers exist", false, error.message);
}

if (helpers) {
  {
    const events = [];
    const fakeFsp = {
      async mkdir(filePath) { events.push({ op: "mkdir", filePath }); },
      async rmdir(filePath) { events.push({ op: "rmdir", filePath }); },
    };
    const { withManifestFileLock } = makeHelpers(fakeFsp, events);
    const result = await withManifestFileLock(async () => {
      events.push({ op: "work" });
      return "done";
    });

    check("withManifestFileLock returns work result", result, "done");
    check("withManifestFileLock creates and removes lock around work",
      events,
      [
        { op: "mkdir", filePath: "/samples/.manifest.lock" },
        { op: "work" },
        { op: "rmdir", filePath: "/samples/.manifest.lock" },
      ]);
  }

  {
    const events = [];
    const fakeFsp = {
      async mkdir(filePath) { events.push({ op: "mkdir", filePath }); },
      async rmdir(filePath) { events.push({ op: "rmdir", filePath }); },
    };
    const { withManifestFileLock } = makeHelpers(fakeFsp, events);
    let caught = null;
    try {
      await withManifestFileLock(async () => {
        events.push({ op: "work" });
        throw new Error("work failed");
      });
    } catch (error) {
      caught = error;
    }

    check("withManifestFileLock propagates work errors", caught?.message, "work failed");
    check("withManifestFileLock releases lock after work error",
      events.map((event) => event.op),
      ["mkdir", "work", "rmdir"]);
  }

  {
    const events = [];
    let mkdirCount = 0;
    const fakeFsp = {
      async mkdir(filePath) {
        mkdirCount += 1;
        events.push({ op: "mkdir", filePath, attempt: mkdirCount });
        if (mkdirCount === 1) {
          const error = new Error("exists");
          error.code = "EEXIST";
          throw error;
        }
      },
      async rmdir(filePath) { events.push({ op: "rmdir", filePath }); },
    };
    const { withManifestFileLock } = makeHelpers(fakeFsp, events);

    check("withManifestFileLock retries after existing lock",
      await withManifestFileLock(async () => "after wait"),
      "after wait");
    check("withManifestFileLock sleeps before retry",
      events.map((event) => event.op),
      ["mkdir", "sleep", "mkdir", "rmdir"]);
  }

  {
    const events = [];
    const fakeFsp = {
      async mkdir() {
        const error = new Error("permission denied");
        error.code = "EACCES";
        throw error;
      },
      async rmdir(filePath) { events.push({ op: "rmdir", filePath }); },
    };
    const { acquireManifestFileLock } = makeHelpers(fakeFsp, events);
    let caught = null;
    try {
      await acquireManifestFileLock();
    } catch (error) {
      caught = error;
    }
    check("acquireManifestFileLock propagates non-EEXIST mkdir errors",
      caught?.code,
      "EACCES");
    check("acquireManifestFileLock does not release an unacquired lock",
      events,
      []);
  }
}

const upsertSrc = extractAsyncFunctionSource(serverSrc, "upsertManifestEntry");
checkTrue("upsertManifestEntry wraps manifest mutation in file lock inside queue",
  /return withManifestMutationLock\(\(\) => withManifestFileLock\(async \(\) =>/.test(upsertSrc));
checkTrue("manifest file lock path lives under samplesDir",
  /const manifestFileLockPath = path\.join\(samplesDir,\s*"\.manifest\.lock"\);/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
