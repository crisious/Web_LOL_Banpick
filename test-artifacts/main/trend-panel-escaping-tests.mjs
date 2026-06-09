// Trend panel escaping regression tests.
//
// The trend panel renders manifest-derived stats and repeated tags with
// innerHTML. Those dynamic values must be escaped before interpolation.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const renderTrendPanelSrc = extractFunctionSource(mainSrc, "renderTrendPanel");

const { renderTrendPanel, dom } = new Function(
  `const HTML_ESCAPE = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "\`": "&#96;",
};
${escapeHtmlSrc}
const state = { manifest: [{ id: "sample-unsafe" }] };
const dom = {
  trendHeadline: { textContent: "" },
  trendSummary: { textContent: "" },
  trendStats: { innerHTML: "" },
  trendTags: { innerHTML: "" },
  trendStrengths: { innerHTML: "" },
  trendWeaknesses: { innerHTML: "" },
};
function buildTrendSnapshot() {
  return {
    headline: "<headline>",
    summary: "<summary>",
    stats: [
      {
        label: "<img src=x onerror=alert(1)>",
        value: "<script>alert(1)</script>",
        note: "Note <b>bold</b> & check",
      },
    ],
    tags: ["Tag <svg onload=alert(1)>", "Safe & sound"],
    positiveTags: ["좋음 <img src=x>"],
    negativeTags: ["실패 <script>alert(1)</script>"],
  };
}
${renderTrendPanelSrc}
return { renderTrendPanel, dom };`,
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

renderTrendPanel();

const renderedHtml = [
  dom.trendStats.innerHTML,
  dom.trendTags.innerHTML,
  dom.trendStrengths.innerHTML,
  dom.trendWeaknesses.innerHTML,
].join("\n");

check("trend headline remains textContent sink", dom.trendHeadline.textContent, "<headline>");
check("trend summary remains textContent sink", dom.trendSummary.textContent, "<summary>");
checkTrue("trend stat label is escaped", dom.trendStats.innerHTML.includes("&lt;img src=x onerror=alert(1)&gt;"));
checkTrue("trend stat value is escaped", dom.trendStats.innerHTML.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
checkTrue("trend stat note is escaped", dom.trendStats.innerHTML.includes("Note &lt;b&gt;bold&lt;/b&gt; &amp; check"));
checkTrue("trend recurring tag is escaped", dom.trendTags.innerHTML.includes("Tag &lt;svg onload=alert(1)&gt;"));
checkTrue("trend recurring tag escapes ampersand", dom.trendTags.innerHTML.includes("Safe &amp; sound"));
checkTrue("trend positive tag is escaped", dom.trendStrengths.innerHTML.includes("좋음 &lt;img src=x&gt;"));
checkTrue("trend negative tag is escaped", dom.trendWeaknesses.innerHTML.includes("실패 &lt;script&gt;alert(1)&lt;/script&gt;"));
checkTrue("trend panel does not render raw img payload", !renderedHtml.includes("<img"));
checkTrue("trend panel does not render raw script payload", !renderedHtml.includes("<script"));
checkTrue("trend panel does not render raw svg payload", !renderedHtml.includes("<svg"));
checkTrue("trend panel does not render raw b payload", !renderedHtml.includes("<b>"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
