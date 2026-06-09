// Key moment phase label regression tests.
//
// Key moment phase values are schema enum tokens such as EARLY/MID/LATE.
// User-facing cards and evidence metadata should render Korean labels while
// keeping keyMomentPhase() useful for deriving normalized phase tokens.

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

const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const gamePhaseLabelSrc = extractFunctionSource(mainSrc, "gamePhaseLabel");
const keyMomentPhaseSrc = extractFunctionSource(mainSrc, "keyMomentPhase");
const evidenceMapSrc = extractFunctionSource(mainSrc, "evidenceMap");
const renderKeyMomentsSrc = extractFunctionSource(mainSrc, "renderKeyMoments");
const renderEvidenceSrc = extractFunctionSource(mainSrc, "renderEvidence");

const { gamePhaseLabel, keyMomentPhase, evidenceMap, renderKeyMoments, dom } = new Function(
  `${escapeHtmlSrc}
${gamePhaseLabelSrc}
${keyMomentPhaseSrc}
${evidenceMapSrc}
const dom = { keyMoments: { innerHTML: "" } };
${renderKeyMomentsSrc}
return { gamePhaseLabel, keyMomentPhase, evidenceMap, renderKeyMoments, dom };`,
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

check("keyMomentPhase keeps explicit enum for logic", keyMomentPhase({ phase: "EARLY" }), "EARLY");
check("keyMomentPhase derives MID enum from timestamp", keyMomentPhase({ timestampLabel: "22:08" }), "MID");
check("gamePhaseLabel EARLY", gamePhaseLabel("EARLY"), "초반");
check("gamePhaseLabel MID", gamePhaseLabel("MID"), "중반");
check("gamePhaseLabel LATE", gamePhaseLabel("LATE"), "후반");

renderKeyMoments({
  analysis: {
    keyMoments: [
      { timestamp: "4:46", phase: "EARLY", label: "초반 첫 데스", reason: "템포 손실", impact: "라인 주도권 상실" },
      { timestampLabel: "22:08", title: "바론 주도권 상실", description: "결정적 분기점", impact: "오브젝트 손실" },
    ],
  },
});

checkTrue("renderKeyMoments renders Korean EARLY label", dom.keyMoments.innerHTML.includes("<strong>초반</strong>"));
checkTrue("renderKeyMoments renders Korean derived MID label", dom.keyMoments.innerHTML.includes("<strong>중반</strong>"));
checkTrue("renderKeyMoments does not leak raw EARLY", !dom.keyMoments.innerHTML.includes("<strong>EARLY</strong>"));
checkTrue("renderKeyMoments does not leak raw MID", !dom.keyMoments.innerHTML.includes("<strong>MID</strong>"));
checkTrue(
  "renderKeyMoments uses gamePhaseLabel at display boundary",
  renderKeyMomentsSrc.includes("gamePhaseLabel(keyMomentPhase(moment))"),
);

const timelineMap = evidenceMap({
  normalized: {
    timelineEvents: [
      { eventId: "evt_early", timestampLabel: "4:46", eventType: "PLAYER_DEATH", summary: "초반 데스", phase: "EARLY" },
    ],
  },
});
check("evidenceMap localizes timeline phase statNote", timelineMap.get("evt_early").statNote, "초반 구간");
checkTrue(
  "renderEvidence localizes rule-based evidence phase statNote",
  renderEvidenceSrc.includes("gamePhaseLabel(entry.phase)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
