// Insight event chip label regression tests.
//
// Insight cards reuse timeline event references as compact chips. Those chips
// should display the same safe Korean event labels as the evidence list instead
// of leaking raw schema eventType values.

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
const gamePhaseLabelSrc = extractFunctionSource(mainSrc, "gamePhaseLabel");
const evidenceMapSrc = extractFunctionSource(mainSrc, "evidenceMap");
const renderInsightCardsSrc = extractFunctionSource(mainSrc, "renderInsightCards");
const renderInsightImpactChipSrc = extractFunctionSource(mainSrc, "renderInsightImpactChip");
const compactEventTypeLabelSrc = extractFunctionSource(mainSrc, "compactEventTypeLabel");

const { compactEventTypeLabel, renderInsightCards, host } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${gamePhaseLabelSrc}
${evidenceMapSrc}
${renderInsightCardsSrc}
${renderInsightImpactChipSrc}
${compactEventTypeLabelSrc}
const host = { innerHTML: "" };
return { compactEventTypeLabel, renderInsightCards, host };`,
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

check("compactEventTypeLabel champion kill", compactEventTypeLabel("CHAMPION_KILL"), "킬 관여");
check("compactEventTypeLabel player death", compactEventTypeLabel("PLAYER_DEATH"), "데스");
check("compactEventTypeLabel objective setup win", compactEventTypeLabel("OBJECTIVE_SETUP_WIN"), "오브젝트 준비 성공");
check("compactEventTypeLabel unknown fallback", compactEventTypeLabel("VOIDGRUB<script>"), "이벤트");
check("compactEventTypeLabel blank fallback", compactEventTypeLabel("   "), "이벤트");

renderInsightCards(
  host,
  [
    {
      title: "교전 합류",
      description: "핵심 교전에 빠르게 합류했습니다.",
      evidence: "드래곤 전투 전후 움직임이 좋았습니다.",
      impact: "중반 교전 영향력이 큽니다.",
      relatedEventIds: ["evt_known", "evt_unknown"],
    },
  ],
  "strength",
  {
    normalized: {
      timelineEvents: [
        {
          eventId: "evt_known",
          timestampLabel: "12:34",
          eventType: "CHAMPION_KILL",
          summary: "킬 관여",
          phase: "MID",
        },
        {
          eventId: "evt_unknown",
          timestampLabel: "<unsafe>",
          eventType: "VOIDGRUB<script>",
          summary: "<img src=x onerror=alert(1)>",
          phase: "LATE",
        },
      ],
    },
  },
);

checkTrue("renderInsightCards renders known event chip label", host.innerHTML.includes("12:34 · 킬 관여"));
checkTrue("renderInsightCards renders unknown event chip fallback", host.innerHTML.includes("&lt;unsafe&gt; · 이벤트"));
checkTrue("renderInsightCards escapes unsafe timestamps", host.innerHTML.includes("&lt;unsafe&gt;"));
checkTrue("renderInsightCards does not interpolate unsafe event markup", !host.innerHTML.includes("<script>"));
checkTrue("renderInsightCards does not leak known raw event type", !host.innerHTML.includes("CHAMPION_KILL"));
checkTrue("renderInsightCards does not leak unknown raw event type", !host.innerHTML.includes("VOIDGRUB"));
checkTrue("renderInsightCards uses compact event label helper", renderInsightCardsSrc.includes("compactEventTypeLabel(entry.eventType)"));
checkTrue("renderInsightCards no longer writes raw chip eventType", !renderInsightCardsSrc.includes("escapeHtml(entry.eventType)"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
