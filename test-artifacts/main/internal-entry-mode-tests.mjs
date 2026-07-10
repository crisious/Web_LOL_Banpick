// Internal landing entry regression tests.
//
// Local/full mode should open an internal stored-sample view when no saved
// account exists, while external demo modes should keep the login entry flow.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  const parenStart = source.indexOf("(", startIdx);
  if (parenStart < 0) throw new Error(`function ${name} signature not found`);
  let parenDepth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") parenDepth += 1;
    else if (ch === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        parenEnd = i;
        break;
      }
    }
  }
  if (parenEnd < 0) throw new Error(`function ${name} signature not closed`);
  const bodyStart = source.indexOf("{", parenEnd);
  if (bodyStart < 0) throw new Error(`function ${name} body not found`);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const bootstrapEntryModeSrc = extractFunctionSource(mainSrc, "bootstrapEntryMode");
const hasMatchListContextSrc = extractFunctionSource(mainSrc, "hasMatchListContext");

const buildFunctions = new Function(
  "state",
  `${hasMatchListContextSrc}\n${bootstrapEntryModeSrc}\nreturn { bootstrapEntryMode, hasMatchListContext };`,
);

const { bootstrapEntryMode, hasMatchListContext } = buildFunctions({
  recentMatches: [],
});

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  }
  ok ? pass++ : fail++;
}

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

check(
  "saved account keeps saved-account entry",
  bootstrapEntryMode({ hasSavedAccount: true, hasStoredSample: true, serverMode: "full" }),
  "saved-account",
);
check(
  "full mode with stored sample uses internal sample entry",
  bootstrapEntryMode({ hasSavedAccount: false, hasStoredSample: true, serverMode: "full" }),
  "internal-sample",
);
check(
  "readonly mode keeps logged-out entry",
  bootstrapEntryMode({ hasSavedAccount: false, hasStoredSample: true, serverMode: "readonly" }),
  "logged-out",
);
check(
  "protected mode keeps logged-out entry",
  bootstrapEntryMode({ hasSavedAccount: false, hasStoredSample: true, serverMode: "protected" }),
  "logged-out",
);
check(
  "full mode without stored sample keeps logged-out entry",
  bootstrapEntryMode({ hasSavedAccount: false, hasStoredSample: false, serverMode: "full" }),
  "logged-out",
);

check("hasMatchListContext false for empty recent matches", hasMatchListContext(), false);

checkTrue("init awaits health before deciding entry", mainSrc.includes("await loadServerStatus();"));
checkTrue("init can open internal landing sample", mainSrc.includes("await openInternalLandingSample();"));
checkTrue("back button hides without match list context", mainSrc.includes("dom.backToListBtn.hidden = !hasList;"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
