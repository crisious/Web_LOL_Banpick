// Combat situation chip label regression tests.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

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

const combatSituationLabelSrc = extractFunctionSource(mainSrc, "combatSituationLabel");
const renderCombatAnalysisSrc = extractFunctionSource(mainSrc, "renderCombatAnalysis");
const { combatSituationLabel } = new Function(
  `${combatSituationLabelSrc}\nreturn { combatSituationLabel };`,
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

check("PLAYER_DOMINANT label", combatSituationLabel("PLAYER_DOMINANT"), "우세");
check("PLAYER_DOWN label", combatSituationLabel("PLAYER_DOWN"), "열세");
check("TRADED label", combatSituationLabel("TRADED"), "교환");
check("unknown situation uses safe fallback", combatSituationLabel("UNKNOWN"), "교전");
check("blank situation uses safe fallback", combatSituationLabel("   "), "교전");
check("null situation uses safe fallback", combatSituationLabel(null), "교전");
checkTrue(
  "renderCombatAnalysis uses shared combatSituationLabel helper",
  renderCombatAnalysisSrc.includes("combatSituationLabel(item.situation)"),
);
checkTrue(
  "renderCombatAnalysis no longer defines inline situationLabel helper",
  !renderCombatAnalysisSrc.includes("const situationLabel ="),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
