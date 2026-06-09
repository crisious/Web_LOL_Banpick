// Timeline phase label regression tests.
//
// Timeline UI should use the shared gamePhaseLabel() display helper. Raw schema
// enums such as EARLY/MID/LATE remain useful for logic, but should not be shown
// in objective timeline divider text.

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
const objectiveTypeLabelSrc = extractFunctionSource(mainSrc, "objectiveTypeLabel");
const objectiveTypeIconSrc = extractFunctionSource(mainSrc, "objectiveTypeIcon");
const objectiveLaneLabelSrc = extractFunctionSource(mainSrc, "objectiveLaneLabel");
const objectiveTeamLabelSrc = extractFunctionSource(mainSrc, "objectiveTeamLabel");
const objectiveTeamClassSrc = extractFunctionSource(mainSrc, "objectiveTeamClass");
const objectiveTeamKeySrc = extractFunctionSource(mainSrc, "objectiveTeamKey");
const renderDualTimelineSrc = extractFunctionSource(mainSrc, "renderDualTimeline");
const renderDualTimelineDetailSrc = extractFunctionSource(mainSrc, "renderDualTimelineDetail");
const renderObjectiveTimelineSrc = extractFunctionSource(mainSrc, "renderObjectiveTimeline");

const { renderObjectiveTimeline, dom } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${gamePhaseLabelSrc}
${objectiveTypeLabelSrc}
${objectiveTypeIconSrc}
${objectiveLaneLabelSrc}
${objectiveTeamLabelSrc}
${objectiveTeamClassSrc}
${objectiveTeamKeySrc}
const dom = {
  objectiveSummary: { innerHTML: "" },
  objectiveTable: { innerHTML: "" },
};
${renderObjectiveTimelineSrc}
return { renderObjectiveTimeline, dom };`,
)();

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

renderObjectiveTimeline({
  normalized: {
    objectiveTimeline: [
      { type: "OBJECTIVE", team: "ALLY", phase: "EARLY", timeLabel: "05:00", label: "첫 드래곤", lane: "MID_LANE" },
      { type: "STRUCTURE", team: "ENEMY", phase: "MID", timeLabel: "18:00", label: "미드 1차", lane: "MID_LANE" },
    ],
  },
});

checkTrue("objective timeline renders Korean early divider", dom.objectiveTable.innerHTML.includes("초반"));
checkTrue("objective timeline renders Korean mid divider", dom.objectiveTable.innerHTML.includes("중반"));
checkTrue("objective timeline no longer shows raw EARLY divider token", !dom.objectiveTable.innerHTML.includes("(EARLY)"));
checkTrue("objective timeline no longer shows raw MID divider token", !dom.objectiveTable.innerHTML.includes("(MID)"));
checkTrue("renderObjectiveTimeline uses gamePhaseLabel for event phases", renderObjectiveTimelineSrc.includes("gamePhaseLabel(e.phase)"));
checkTrue("renderObjectiveTimeline no longer defines inline phaseLabel map", !renderObjectiveTimelineSrc.includes("const phaseLabel ="));
checkTrue("renderObjectiveTimeline no longer prints raw phase enum in divider", !renderObjectiveTimelineSrc.includes("(${e.phase})"));
checkTrue("renderDualTimeline uses gamePhaseLabel for phase bands", renderDualTimelineSrc.includes("gamePhaseLabel(p.phase)"));
checkTrue("renderDualTimelineDetail uses gamePhaseLabel for phase summary notes", renderDualTimelineDetailSrc.includes("gamePhaseLabel(ps.phase)"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
