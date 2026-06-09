// Teamfight phase/outcome chip label regression tests.

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

const teamfightPhaseLabelSrc = extractFunctionSource(mainSrc, "teamfightPhaseLabel");
const teamfightOutcomeLabelSrc = extractFunctionSource(mainSrc, "teamfightOutcomeLabel");
const renderTeamfightPhasesSrc = extractFunctionSource(mainSrc, "renderTeamfightPhases");
const { teamfightPhaseLabel, teamfightOutcomeLabel } = new Function(
  `${teamfightPhaseLabelSrc}\n${teamfightOutcomeLabelSrc}\nreturn { teamfightPhaseLabel, teamfightOutcomeLabel };`,
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

check("ENGAGE phase label", teamfightPhaseLabel("ENGAGE"), "진입");
check("TRADE phase label", teamfightPhaseLabel("TRADE"), "딜교환");
check("CLEANUP phase label", teamfightPhaseLabel("CLEANUP"), "정리");
check("unknown phase uses safe fallback", teamfightPhaseLabel("LANING"), "한타");
check("blank phase uses safe fallback", teamfightPhaseLabel("   "), "한타");
check("null phase uses safe fallback", teamfightPhaseLabel(null), "한타");
check("INITIATED_KILL outcome label", teamfightOutcomeLabel("INITIATED_KILL"), "선제 이니시");
check("CAUGHT_OUT outcome label", teamfightOutcomeLabel("CAUGHT_OUT"), "먼저 잘림");
check("TRADE_WON outcome label", teamfightOutcomeLabel("TRADE_WON"), "딜교환 우위");
check("TRADE_LOST outcome label", teamfightOutcomeLabel("TRADE_LOST"), "딜교환 손해");
check("TRADE_EVEN outcome label", teamfightOutcomeLabel("TRADE_EVEN"), "딜교환 비등");
check("CLOSED_OUT outcome label", teamfightOutcomeLabel("CLOSED_OUT"), "마무리 성공");
check("OVERCHASE_DEATH outcome label", teamfightOutcomeLabel("OVERCHASE_DEATH"), "추격사");
check("DIED_IN_FIGHT outcome label", teamfightOutcomeLabel("DIED_IN_FIGHT"), "교전 중 사망");
check("unknown outcome uses safe fallback", teamfightOutcomeLabel("UNKNOWN_OUTCOME"), "판단");
check("blank outcome uses safe fallback", teamfightOutcomeLabel("   "), "판단");
check("null outcome uses safe fallback", teamfightOutcomeLabel(null), "판단");
checkTrue(
  "renderTeamfightPhases uses shared teamfightPhaseLabel helper",
  renderTeamfightPhasesSrc.includes("teamfightPhaseLabel(p.phase)"),
);
checkTrue(
  "renderTeamfightPhases uses shared teamfightOutcomeLabel helper",
  renderTeamfightPhasesSrc.includes("teamfightOutcomeLabel(p.outcomeTag)"),
);
checkTrue(
  "renderTeamfightPhases no longer defines inline phaseLabel helper",
  !renderTeamfightPhasesSrc.includes("const phaseLabel ="),
);
checkTrue(
  "renderTeamfightPhases no longer defines inline tagLabel helper",
  !renderTeamfightPhasesSrc.includes("const tagLabel ="),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
