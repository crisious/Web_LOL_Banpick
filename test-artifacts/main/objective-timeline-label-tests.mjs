// Objective timeline label regression tests.
//
// Objective rows are user-facing, so raw team/lane/type enum values and unsafe
// sample text should not be interpolated directly.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const stylesSrc = fs.readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

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

function optionalFunctionSource(source, name, fallback) {
  return source.includes(`function ${name}(`) ? extractFunctionSource(source, name) : fallback;
}

const htmlEscapeSrc = extractConstSource(mainSrc, "HTML_ESCAPE");
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const gamePhaseLabelSrc = extractFunctionSource(mainSrc, "gamePhaseLabel");
const objectiveTypeLabelSrc = optionalFunctionSource(mainSrc, "objectiveTypeLabel", "function objectiveTypeLabel(type) { return type === \"STRUCTURE\" ? \"구조물\" : \"오브젝트\"; }");
const objectiveTypeIconSrc = optionalFunctionSource(mainSrc, "objectiveTypeIcon", "function objectiveTypeIcon(type) { return type === \"STRUCTURE\" ? \"🏛\" : \"🐉\"; }");
const objectiveLaneLabelSrc = optionalFunctionSource(mainSrc, "objectiveLaneLabel", "function objectiveLaneLabel(lane) { const labels = { TOP_LANE: \"탑\", MID_LANE: \"미드\", BOT_LANE: \"봇\" }; return labels[lane] || lane || \"—\"; }");
const objectiveTeamLabelSrc = optionalFunctionSource(mainSrc, "objectiveTeamLabel", "function objectiveTeamLabel(team) { return team === \"ALLY\" ? \"아군\" : \"적\"; }");
const objectiveTeamClassSrc = optionalFunctionSource(mainSrc, "objectiveTeamClass", "function objectiveTeamClass(team) { return team === \"ALLY\" ? \"ally\" : \"enemy\"; }");
const objectiveTeamKeySrc = optionalFunctionSource(mainSrc, "objectiveTeamKey", "function objectiveTeamKey(team) { return team || \"\"; }");
const renderObjectiveTimelineSrc = extractFunctionSource(mainSrc, "renderObjectiveTimeline");

const { objectiveTypeLabel, objectiveTypeIcon, objectiveLaneLabel, objectiveTeamLabel, objectiveTeamClass, objectiveTeamKey, renderObjectiveTimeline, dom } = new Function(
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
return { objectiveTypeLabel, objectiveTypeIcon, objectiveLaneLabel, objectiveTeamLabel, objectiveTeamClass, objectiveTeamKey, renderObjectiveTimeline, dom };`,
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

check("objectiveTypeLabel objective", objectiveTypeLabel("OBJECTIVE"), "오브젝트");
check("objectiveTypeLabel structure", objectiveTypeLabel("STRUCTURE"), "구조물");
check("objectiveTypeLabel unknown fallback", objectiveTypeLabel("VOIDGRUB<script>"), "이벤트");
check("objectiveTypeIcon objective", objectiveTypeIcon("OBJECTIVE"), "🐉");
check("objectiveTypeIcon structure", objectiveTypeIcon("STRUCTURE"), "🏛");
check("objectiveTypeIcon unknown fallback", objectiveTypeIcon("VOIDGRUB<script>"), "•");
check("objectiveLaneLabel mid", objectiveLaneLabel("MID_LANE"), "미드");
check("objectiveLaneLabel unknown fallback", objectiveLaneLabel("JUNGLE<script>"), "위치 미상");
check("objectiveLaneLabel blank fallback", objectiveLaneLabel("   "), "위치 미상");
check("objectiveTeamLabel ally", objectiveTeamLabel("ALLY"), "아군");
check("objectiveTeamLabel enemy", objectiveTeamLabel("ENEMY"), "적");
check("objectiveTeamLabel unknown fallback", objectiveTeamLabel("RIVER<script>"), "팀 미상");
check("objectiveTeamClass ally", objectiveTeamClass("ALLY"), "ally");
check("objectiveTeamClass enemy", objectiveTeamClass("ENEMY"), "enemy");
check("objectiveTeamClass unknown fallback", objectiveTeamClass("RIVER<script>"), "unknown");
check("objectiveTeamKey ally", objectiveTeamKey("ALLY"), "ALLY");
check("objectiveTeamKey enemy", objectiveTeamKey("ENEMY"), "ENEMY");
check("objectiveTeamKey unknown fallback", objectiveTeamKey("RIVER<script>"), "UNKNOWN");

renderObjectiveTimeline({
  normalized: {
    objectiveTimeline: [
      { type: "OBJECTIVE", team: "ALLY", phase: "EARLY", timeLabel: "05:00", label: "첫 드래곤", lane: "MID_LANE" },
      { type: "VOIDGRUB<script>", team: "RIVER<script>", phase: "MID", timeLabel: "<unsafe>", label: "<img src=x onerror=alert(1)>", lane: "JUNGLE<script>" },
    ],
  },
});

checkTrue("renderObjectiveTimeline renders objective Korean labels", dom.objectiveTable.innerHTML.includes("🐉 오브젝트"));
checkTrue("renderObjectiveTimeline renders known lane label", dom.objectiveTable.innerHTML.includes("<td>미드</td>"));
checkTrue("renderObjectiveTimeline renders known team label", dom.objectiveTable.innerHTML.includes('data-team="ALLY">아군</td>'));
checkTrue("renderObjectiveTimeline renders unknown type fallback", dom.objectiveTable.innerHTML.includes("• 이벤트"));
checkTrue("renderObjectiveTimeline renders unknown lane fallback", dom.objectiveTable.innerHTML.includes("<td>위치 미상</td>"));
checkTrue("renderObjectiveTimeline renders unknown team fallback", dom.objectiveTable.innerHTML.includes('data-team="UNKNOWN">팀 미상</td>'));
checkTrue("renderObjectiveTimeline uses unknown team row class", dom.objectiveTable.innerHTML.includes('class="obj-row--unknown"'));
checkTrue("renderObjectiveTimeline escapes unsafe time labels", dom.objectiveTable.innerHTML.includes("&lt;unsafe&gt;"));
checkTrue("renderObjectiveTimeline escapes unsafe detail labels", dom.objectiveTable.innerHTML.includes("&lt;img src=x onerror=alert(1)&gt;"));
checkTrue("renderObjectiveTimeline does not interpolate unsafe detail labels", !dom.objectiveTable.innerHTML.includes("<img src=x"));
checkTrue("renderObjectiveTimeline does not leak raw unknown type", !dom.objectiveTable.innerHTML.includes("VOIDGRUB"));
checkTrue("renderObjectiveTimeline does not leak raw unknown lane", !dom.objectiveTable.innerHTML.includes("JUNGLE"));
checkTrue("renderObjectiveTimeline does not leak raw unknown team", !dom.objectiveTable.innerHTML.includes("RIVER"));
checkTrue("renderObjectiveTimeline uses objectiveTypeLabel helper", renderObjectiveTimelineSrc.includes("objectiveTypeLabel(e.type)"));
checkTrue("renderObjectiveTimeline uses objectiveLaneLabel helper", renderObjectiveTimelineSrc.includes("objectiveLaneLabel(e.lane)"));
checkTrue("renderObjectiveTimeline uses objectiveTeamLabel helper", renderObjectiveTimelineSrc.includes("objectiveTeamLabel(e.team)"));
checkTrue("renderObjectiveTimeline uses objectiveTeamClass helper", renderObjectiveTimelineSrc.includes("objectiveTeamClass(e.team)"));
checkTrue("renderObjectiveTimeline uses objectiveTeamKey helper", renderObjectiveTimelineSrc.includes("objectiveTeamKey(e.team)"));
checkTrue("renderObjectiveTimeline no longer defines inline laneLabel map", !renderObjectiveTimelineSrc.includes("const laneLabel ="));
checkTrue("renderObjectiveTimeline no longer writes raw data-team", !renderObjectiveTimelineSrc.includes('data-team="${e.team}"'));
checkTrue("unknown objective row has neutral style", stylesSrc.includes(".obj-row--unknown"));
checkTrue("unknown objective team cell has neutral style", stylesSrc.includes('.obj-team-cell[data-team="UNKNOWN"]'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
