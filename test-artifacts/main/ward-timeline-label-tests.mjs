// Ward timeline label regression tests.
//
// Ward timeline chips are user-facing, so raw ward/action enum values and
// unsafe supplemental sample text should not be interpolated directly.

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
const wardTypeLabelSrc = optionalFunctionSource(mainSrc, "wardTypeLabel", "function wardTypeLabel(type) { return type; }");
const wardActionLabelSrc = optionalFunctionSource(mainSrc, "wardActionLabel", "function wardActionLabel(action) { return action === \"PLACED\" ? \"설치\" : \"제거\"; }");
const wardActionClassSrc = optionalFunctionSource(mainSrc, "wardActionClass", "function wardActionClass(action) { return action === \"PLACED\" ? \"placed\" : \"killed\"; }");
const renderWardTimelineSrc = extractFunctionSource(mainSrc, "renderWardTimeline");

const { wardTypeLabel, wardActionLabel, wardActionClass, renderWardTimeline, dom } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${wardTypeLabelSrc}
${wardActionLabelSrc}
${wardActionClassSrc}
const dom = {
  wardSummary: { innerHTML: "" },
  wardEvents: { innerHTML: "" },
};
${renderWardTimelineSrc}
return { wardTypeLabel, wardActionLabel, wardActionClass, renderWardTimeline, dom };`,
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

check("wardTypeLabel YELLOW_TRINKET", wardTypeLabel("YELLOW_TRINKET"), "노랑 와드");
check("wardTypeLabel CONTROL_WARD", wardTypeLabel("CONTROL_WARD"), "컨트롤 와드");
check("wardTypeLabel BLUE_TRINKET", wardTypeLabel("BLUE_TRINKET"), "파랑 와드");
check("wardTypeLabel unknown fallback", wardTypeLabel("STEALTH_WARD"), "와드");
check("wardTypeLabel blank fallback", wardTypeLabel("   "), "와드");
check("wardTypeLabel null fallback", wardTypeLabel(null), "와드");
check("wardActionLabel PLACED", wardActionLabel("PLACED"), "설치");
check("wardActionLabel KILLED", wardActionLabel("KILLED"), "제거");
check("wardActionLabel unknown fallback", wardActionLabel("DENIED"), "와드 활동");
check("wardActionClass PLACED", wardActionClass("PLACED"), "placed");
check("wardActionClass KILLED", wardActionClass("KILLED"), "killed");
check("wardActionClass unknown fallback", wardActionClass("DENIED"), "unknown");

renderWardTimeline({
  normalized: {
    wardTimeline: {
      summary: {
        totalPlaced: 2,
        totalKilled: 1,
        controlWardsPlaced: 1,
        wardsPerMinute: 1.4,
        byPhase: { EARLY: 2, MID: 1, LATE: 0 },
      },
      events: [
        { action: "PLACED", timeLabel: "02:00", wardType: "YELLOW_TRINKET" },
        { action: "KILLED", timeLabel: "04:30", wardType: "CONTROL_WARD" },
        { action: "DENIED", timeLabel: "<unsafe>", wardType: "STEALTH_WARD<script>" },
      ],
    },
  },
});

checkTrue("renderWardTimeline renders placed Korean label", dom.wardEvents.innerHTML.includes("02:00 설치 노랑 와드"));
checkTrue("renderWardTimeline renders killed Korean label", dom.wardEvents.innerHTML.includes("04:30 제거 컨트롤 와드"));
checkTrue("renderWardTimeline renders unknown safe fallback", dom.wardEvents.innerHTML.includes("&lt;unsafe&gt; 와드 활동 와드"));
checkTrue("renderWardTimeline does not leak raw known ward enum", !dom.wardEvents.innerHTML.includes("YELLOW_TRINKET"));
checkTrue("renderWardTimeline does not leak raw unknown ward enum", !dom.wardEvents.innerHTML.includes("STEALTH_WARD"));
checkTrue("renderWardTimeline does not leak raw unknown action enum", !dom.wardEvents.innerHTML.includes("DENIED"));
checkTrue("renderWardTimeline escapes unsafe time labels", !dom.wardEvents.innerHTML.includes("<unsafe>"));
checkTrue("renderWardTimeline uses wardTypeLabel helper", renderWardTimelineSrc.includes("wardTypeLabel(e.wardType)"));
checkTrue("renderWardTimeline uses wardActionLabel helper", renderWardTimelineSrc.includes("wardActionLabel(e.action)"));
checkTrue("renderWardTimeline uses wardActionClass helper", renderWardTimelineSrc.includes("wardActionClass(e.action)"));
checkTrue("renderWardTimeline no longer defines inline wardLabel map", !renderWardTimelineSrc.includes("const wardLabel ="));
checkTrue("renderWardTimeline no longer falls back to raw wardType", !renderWardTimelineSrc.includes("|| e.wardType"));
checkTrue("unknown ward action chip has neutral style", stylesSrc.includes(".ward-event-chip--unknown"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
