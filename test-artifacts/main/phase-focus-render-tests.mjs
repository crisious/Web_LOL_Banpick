// Phase summary card render regression tests.
//
// Stored sample phase summaries currently contain `phase` and `summary`, but no
// optional `focus` field. The UI must not surface JavaScript placeholder text
// such as "undefined" or "null" in that case.

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
const phaseFocusTextSrc = extractFunctionSource(mainSrc, "phaseFocusText");
const renderPhaseCardSrc = extractFunctionSource(mainSrc, "renderPhaseCard");
const renderPhasesSrc = extractFunctionSource(mainSrc, "renderPhases");

const { phaseFocusText, renderPhaseCard } = new Function(
  `${htmlEscapeSrc}\n${escapeHtmlSrc}\n${escapeAttrSrc}\n${ratingLabelSrc}\n${phaseFocusTextSrc}\n${renderPhaseCardSrc}\nreturn { phaseFocusText, renderPhaseCard };`,
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

check("phaseFocusText trims focus text", phaseFocusText({ focus: "  주요 이벤트 3건  " }), "주요 이벤트 3건");
check("phaseFocusText blank focus is empty", phaseFocusText({ focus: "   " }), "");
check("phaseFocusText missing focus is empty", phaseFocusText({ summary: "초반 요약" }), "");
check("phaseFocusText null phase is empty", phaseFocusText(null), "");

const noFocusHtml = renderPhaseCard({
  phase: "EARLY",
  rating: "OK",
  summary: "초반 흐름은 안정적이었다.",
});
checkTrue("card without focus keeps summary", noFocusHtml.includes("초반 흐름은 안정적이었다."));
checkTrue("card without focus omits phase-focus paragraph", !noFocusHtml.includes("phase-focus"));
checkTrue("card without focus does not leak undefined", !noFocusHtml.includes("undefined"));
checkTrue("card without focus does not leak null", !noFocusHtml.includes("null"));

const focusHtml = renderPhaseCard({
  phase: "MID",
  rating: "GOOD",
  summary: "중반 교전 합류가 좋았다.",
  focus: "  주요 이벤트 5건  ",
});
checkTrue("card with focus renders trimmed focus", focusHtml.includes('<p class="phase-focus">주요 이벤트 5건</p>'));
checkTrue("card with focus keeps rating label", focusHtml.includes("좋음"));

const unsafeHtml = renderPhaseCard({
  phase: "LATE<script>",
  rating: 'BAD" data-x="1',
  summary: "후반 <위험> & 확인",
  focus: "다음 <체크>",
});
checkTrue("card escapes phase text", unsafeHtml.includes("LATE&lt;script&gt;"));
checkTrue("card escapes summary text", unsafeHtml.includes("후반 &lt;위험&gt; &amp; 확인"));
checkTrue("card escapes focus text", unsafeHtml.includes("다음 &lt;체크&gt;"));
checkTrue("card escapes rating attribute", unsafeHtml.includes('data-rating="BAD&quot; data-x=&quot;1"'));

checkTrue("renderPhases delegates card rendering", renderPhasesSrc.includes(".map(renderPhaseCard)"));
checkTrue("renderPhases no longer interpolates raw phase.focus", !renderPhasesSrc.includes("${phase.focus}"));
checkTrue("renderPhases no longer keeps inline phase-card markup", !renderPhasesSrc.includes('<article class="phase-card"'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
