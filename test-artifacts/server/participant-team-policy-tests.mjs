// server.js participant team policy regression tests

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

const participantTeamSrc = extractFunctionSource(serverSrc, "participantTeam");
const { participantTeam } = new Function(
  [
    participantTeamSrc,
    "return { participantTeam };",
  ].join("\n"),
)();

let pass = 0;
let fail = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

check("participantTeam maps participant 1 to blue team", participantTeam(1), 100);
check("participantTeam maps participant 5 to blue team", participantTeam(5), 100);
check("participantTeam maps participant 6 to red team", participantTeam(6), 200);
check("participantTeam maps participant 10 to red team", participantTeam(10), 200);
check("participantTeam rejects zero", participantTeam(0), null);
check("participantTeam rejects out-of-range id", participantTeam(11), null);
check("participantTeam rejects string blue id", participantTeam("2"), null);
check("participantTeam rejects string red id", participantTeam("7"), null);
check("participantTeam rejects fractional id", participantTeam(2.5), null);
check("participantTeam rejects Infinity", participantTeam(Infinity), null);
check("participantTeam rejects NaN", participantTeam(NaN), null);
check("participantTeam rejects null", participantTeam(null), null);
checkTrue(
  "participantTeam guards integer participant ids before range comparisons",
  participantTeamSrc.includes("if (!Number.isInteger(participantId))") &&
    participantTeamSrc.includes("return null;"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
