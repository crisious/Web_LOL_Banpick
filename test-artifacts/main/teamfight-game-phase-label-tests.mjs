// Teamfight card game-phase label regression tests.
//
// Teamfight phase rows already localize fight-section phases such as ENGAGE.
// The card header should also localize the top-level gamePhase value instead of
// displaying raw schema tokens such as MID.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractConstSource(source, name) {
  const pattern = new RegExp(`const ${name} = \\{[\\s\\S]*?\\};`);
  const match = source.match(pattern);
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

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

const htmlEscapeSrc = extractConstSource(mainSrc, "HTML_ESCAPE");
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const gamePhaseLabelSrc = extractFunctionSource(mainSrc, "gamePhaseLabel");
const teamfightPhaseLabelSrc = extractFunctionSource(mainSrc, "teamfightPhaseLabel");
const teamfightOutcomeLabelSrc = extractFunctionSource(mainSrc, "teamfightOutcomeLabel");
const renderTeamfightPhasesSrc = extractFunctionSource(mainSrc, "renderTeamfightPhases");

const { renderTeamfightPhases, dom } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${gamePhaseLabelSrc}
${teamfightPhaseLabelSrc}
${teamfightOutcomeLabelSrc}
const dom = { teamfightPhases: { innerHTML: "" } };
${renderTeamfightPhasesSrc}
return { renderTeamfightPhases, dom };`,
)();

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

renderTeamfightPhases({
  analysis: {
    teamfightPhaseAnalysis: [
      {
        teamfightId: "tf_mid",
        gamePhase: "MID",
        startLabel: "18:10",
        endLabel: "18:56",
        takeaway: "중반 교전 판단이 좋았습니다.",
        phases: [
          {
            phase: "ENGAGE",
            outcomeTag: "INITIATED_KILL",
            playerKills: 1,
            playerDeaths: 0,
            coaching: "먼저 열 때 시야를 확인했습니다.",
          },
        ],
      },
      {
        teamfightId: "tf_unknown",
        gamePhase: "LANING<script>",
        startLabel: "<unsafe>",
        endLabel: "21:00",
        takeaway: "알 수 없는 구간도 안전하게 표시됩니다.",
        phases: [
          {
            phase: "TRADE",
            outcomeTag: "TRADE_EVEN",
            playerKills: 0,
            playerDeaths: 0,
            coaching: "무리하지 않고 교환했습니다.",
          },
        ],
      },
    ],
  },
});

checkTrue("renderTeamfightPhases renders Korean MID game phase", dom.teamfightPhases.innerHTML.includes("<strong>중반</strong>"));
checkTrue("renderTeamfightPhases renders unknown game phase fallback", dom.teamfightPhases.innerHTML.includes("<strong>구간</strong>"));
checkTrue("renderTeamfightPhases keeps fight-section phase label", dom.teamfightPhases.innerHTML.includes("<strong>진입</strong>"));
checkTrue("renderTeamfightPhases escapes unsafe time label", dom.teamfightPhases.innerHTML.includes("&lt;unsafe&gt;~21:00"));
checkTrue("renderTeamfightPhases does not leak raw MID game phase", !dom.teamfightPhases.innerHTML.includes("<strong>MID</strong>"));
checkTrue("renderTeamfightPhases does not leak unsafe raw game phase", !dom.teamfightPhases.innerHTML.includes("LANING"));
checkTrue("renderTeamfightPhases uses gamePhaseLabel for top-level game phase", renderTeamfightPhasesSrc.includes("gamePhaseLabel(tf.gamePhase)"));
checkTrue("renderTeamfightPhases no longer writes raw top-level game phase", !renderTeamfightPhasesSrc.includes("escapeHtml(tf.gamePhase || \"\")"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
