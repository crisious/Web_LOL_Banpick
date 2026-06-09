// Phase card label regression tests.
//
// The analysis tab is user-facing, so phase cards should display Korean labels
// instead of raw schema enum values such as EARLY/MID/LATE.

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
const ratingLabelSrc = extractFunctionSource(mainSrc, "ratingLabel");
const gamePhaseLabelSrc = extractFunctionSource(mainSrc, "gamePhaseLabel");
const phaseFocusTextSrc = extractFunctionSource(mainSrc, "phaseFocusText");
const renderPhaseCardSrc = extractFunctionSource(mainSrc, "renderPhaseCard");

const { gamePhaseLabel, renderPhaseCard } = new Function(
  `${htmlEscapeSrc}\n${escapeHtmlSrc}\n${escapeAttrSrc}\n${ratingLabelSrc}\n${gamePhaseLabelSrc}\n${phaseFocusTextSrc}\n${renderPhaseCardSrc}\nreturn { gamePhaseLabel, renderPhaseCard };`,
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

check("EARLY phase label", gamePhaseLabel("EARLY"), "초반");
check("MID phase label", gamePhaseLabel("MID"), "중반");
check("LATE phase label", gamePhaseLabel("LATE"), "후반");
check("unknown phase uses safe fallback", gamePhaseLabel("LANING"), "구간");
check("blank phase uses safe fallback", gamePhaseLabel("   "), "구간");
check("null phase uses safe fallback", gamePhaseLabel(null), "구간");

const earlyHtml = renderPhaseCard({
  phase: "EARLY",
  rating: "OK",
  summary: "초반 흐름은 안정적이었다.",
});
checkTrue("phase card renders Korean EARLY label", earlyHtml.includes('<span class="phase-tag">초반</span>'));
checkTrue("phase card does not render raw EARLY tag", !earlyHtml.includes('<span class="phase-tag">EARLY</span>'));

const unknownHtml = renderPhaseCard({
  phase: "LANING",
  rating: "OK",
  summary: "알 수 없는 구간 데이터입니다.",
});
checkTrue("unknown phase card renders fallback label", unknownHtml.includes('<span class="phase-tag">구간</span>'));
checkTrue("unknown phase card does not leak raw phase", !unknownHtml.includes("LANING"));

checkTrue(
  "renderPhaseCard uses gamePhaseLabel helper",
  renderPhaseCardSrc.includes("gamePhaseLabel(phase?.phase)"),
);
checkTrue(
  "renderPhaseCard no longer interpolates raw phase tag",
  !renderPhaseCardSrc.includes("${escapeHtml(phase?.phase || \"\")}"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
