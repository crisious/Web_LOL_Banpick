// KDA timeline label regression tests.
//
// KDA event rows are user-facing, so raw event enum values and unsafe sample
// strings should not be interpolated directly.

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
const kdaEventTypeLabelSrc = optionalFunctionSource(mainSrc, "kdaEventTypeLabel", "function kdaEventTypeLabel(eventType) { return eventType; }");
const kdaEventTypeClassSrc = optionalFunctionSource(mainSrc, "kdaEventTypeClass", "function kdaEventTypeClass(eventType) { return eventType === \"PLAYER_DEATH\" ? \"death\" : \"kill\"; }");
const renderKdaTimelineSrc = extractFunctionSource(mainSrc, "renderKdaTimeline");

const { kdaEventTypeLabel, kdaEventTypeClass, renderKdaTimeline, dom } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${kdaEventTypeLabelSrc}
${kdaEventTypeClassSrc}
const dom = {
  kdaChart: { innerHTML: "" },
  kdaEvents: { innerHTML: "" },
};
${renderKdaTimelineSrc}
return { kdaEventTypeLabel, kdaEventTypeClass, renderKdaTimeline, dom };`,
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

check("kdaEventTypeLabel death", kdaEventTypeLabel("PLAYER_DEATH"), "데스");
check("kdaEventTypeLabel kill", kdaEventTypeLabel("CHAMPION_KILL"), "킬");
check("kdaEventTypeLabel followup", kdaEventTypeLabel("TEAMFIGHT_FOLLOWUP"), "어시스트");
check("kdaEventTypeLabel skirmish", kdaEventTypeLabel("SKIRMISH_WIN"), "어시스트");
check("kdaEventTypeLabel unknown fallback", kdaEventTypeLabel("OBJECTIVE_SETUP_WIN"), "KDA 변화");
check("kdaEventTypeLabel blank fallback", kdaEventTypeLabel("   "), "KDA 변화");
check("kdaEventTypeClass death", kdaEventTypeClass("PLAYER_DEATH"), "death");
check("kdaEventTypeClass kill", kdaEventTypeClass("CHAMPION_KILL"), "kill");
check("kdaEventTypeClass followup", kdaEventTypeClass("TEAMFIGHT_FOLLOWUP"), "assist");
check("kdaEventTypeClass unknown fallback", kdaEventTypeClass("OBJECTIVE_SETUP_WIN"), "neutral");

renderKdaTimeline({
  normalized: {
    kdaTimeline: [
      { timeLabel: "0:00", eventType: "GAME_START", kills: 0, deaths: 0, assists: 0, kda: 0, event: "게임 시작" },
      { timeLabel: "02:00", eventType: "CHAMPION_KILL", kills: 1, deaths: 0, assists: 0, kda: 1, event: "직접 킬" },
      { timeLabel: "04:30", eventType: "TEAMFIGHT_FOLLOWUP", kills: 1, deaths: 0, assists: 1, kda: 2, event: "후속 합류" },
      { timeLabel: "<unsafe>", eventType: "OBJECTIVE_SETUP_WIN", kills: 1, deaths: 0, assists: 2, kda: "<bad>", event: "<img src=x onerror=alert(1)>" },
    ],
  },
});

checkTrue("renderKdaTimeline renders kill Korean label", dom.kdaEvents.innerHTML.includes('<span class="kda-evt-type">킬</span>'));
checkTrue("renderKdaTimeline renders assist Korean label", dom.kdaEvents.innerHTML.includes('<span class="kda-evt-type">어시스트</span>'));
checkTrue("renderKdaTimeline renders unknown safe fallback", dom.kdaEvents.innerHTML.includes('<span class="kda-evt-type">KDA 변화</span>'));
checkTrue("renderKdaTimeline does not leak raw unknown event enum", !dom.kdaEvents.innerHTML.includes("OBJECTIVE_SETUP_WIN"));
checkTrue("renderKdaTimeline does not leak raw followup enum", !dom.kdaEvents.innerHTML.includes("TEAMFIGHT_FOLLOWUP"));
checkTrue("renderKdaTimeline escapes unsafe time labels", dom.kdaEvents.innerHTML.includes("&lt;unsafe&gt;"));
checkTrue("renderKdaTimeline escapes unsafe descriptions", dom.kdaEvents.innerHTML.includes("&lt;img src=x onerror=alert(1)&gt;"));
checkTrue("renderKdaTimeline does not interpolate unsafe descriptions", !dom.kdaEvents.innerHTML.includes("<img src=x"));
checkTrue("renderKdaTimeline uses kdaEventTypeLabel helper", renderKdaTimelineSrc.includes("kdaEventTypeLabel(p.eventType)"));
checkTrue("renderKdaTimeline uses kdaEventTypeClass helper", renderKdaTimelineSrc.includes("kdaEventTypeClass(p.eventType)"));
checkTrue("renderKdaTimeline no longer defines inline eventTypeLabel map", !renderKdaTimelineSrc.includes("const eventTypeLabel ="));
checkTrue("renderKdaTimeline no longer falls back to raw eventType", !renderKdaTimelineSrc.includes("|| p.eventType"));
checkTrue("neutral KDA event has style", stylesSrc.includes(".kda-evt--neutral"));
checkTrue("assist KDA event has style", stylesSrc.includes(".kda-evt--assist"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
