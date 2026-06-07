// Phase 4 — atomic JSON write regression tests.
//
// Manifest and generated sample bundles use writeJson. A partial direct write
// can corrupt the externally served sample list after a crash or interrupted
// process, so writes must go through a sibling temp file and atomic rename.

import fs from "fs";
import path from "path";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
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

function makeWriteJson(fakeFsp) {
  return new Function(
    "fsp",
    "path",
    "process",
    `${extractFunctionSource(serverSrc, "writeJson")}\nreturn writeJson;`,
  )(fakeFsp, path, { pid: 4242 });
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

{
  const calls = [];
  const fakeFsp = {
    async writeFile(filePath, body, encoding) {
      calls.push({ op: "writeFile", filePath, body, encoding });
    },
    async rename(from, to) {
      calls.push({ op: "rename", from, to });
    },
    async unlink(filePath) {
      calls.push({ op: "unlink", filePath });
    },
  };
  const writeJson = makeWriteJson(fakeFsp);
  const target = "/tmp/lol-ai-coach/data/samples/manifest.json";

  await writeJson(target, { samples: [{ id: "sample-1" }] });

  const writeCall = calls.find((call) => call.op === "writeFile");
  const renameCall = calls.find((call) => call.op === "rename");

  check("writeJson preserves pretty JSON with trailing newline",
    writeCall?.body,
    `${JSON.stringify({ samples: [{ id: "sample-1" }] }, null, 2)}\n`);
  checkTrue("writeJson writes to temp file instead of target",
    writeCall?.filePath && writeCall.filePath !== target,
    `filePath=${writeCall?.filePath}`);
  checkTrue("writeJson temp file is a sibling of target",
    path.dirname(writeCall?.filePath || "") === path.dirname(target),
    `filePath=${writeCall?.filePath}`);
  checkTrue("writeJson temp filename is hidden and process-scoped",
    /^\.manifest\.json\.4242\..+\.tmp$/.test(path.basename(writeCall?.filePath || "")),
    `basename=${path.basename(writeCall?.filePath || "")}`);
  check("writeJson renames temp file onto target",
    renameCall && { from: renameCall.from, to: renameCall.to },
    { from: writeCall?.filePath, to: target });
  check("writeJson writes before rename",
    calls.map((call) => call.op),
    ["writeFile", "rename"]);
}

{
  const calls = [];
  const fakeFsp = {
    async writeFile(filePath, body, encoding) {
      calls.push({ op: "writeFile", filePath, body, encoding });
    },
    async rename(from, to) {
      calls.push({ op: "rename", from, to });
      throw new Error("rename failed");
    },
    async unlink(filePath) {
      calls.push({ op: "unlink", filePath });
    },
  };
  const writeJson = makeWriteJson(fakeFsp);
  let caught = null;
  try {
    await writeJson("/tmp/lol-ai-coach/data/samples/manifest.json", { samples: [] });
  } catch (error) {
    caught = error;
  }

  const writeCall = calls.find((call) => call.op === "writeFile");
  const unlinkCall = calls.find((call) => call.op === "unlink");
  check("writeJson propagates rename failures", caught?.message, "rename failed");
  check("writeJson removes temp file after rename failure", unlinkCall?.filePath, writeCall?.filePath);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
