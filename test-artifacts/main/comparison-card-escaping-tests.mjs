// Comparison card escaping regression tests.
//
// AI comparison output is assembled with innerHTML. Card topics and notes must
// be escaped before interpolation, and agreement rates must be normalized before
// being used in visible text or inline width styles.

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

function optionalFunctionSource(source, name, fallbackSource) {
  try {
    return extractFunctionSource(source, name);
  } catch {
    return fallbackSource;
  }
}

const htmlEscapeSrc = extractConstSource(mainSrc, "HTML_ESCAPE");
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const comparisonRatePercentSrc = optionalFunctionSource(
  mainSrc,
  "comparisonRatePercent",
  "function comparisonRatePercent(value) { return value ?? 0; }",
);
const comparisonItemsSrc = optionalFunctionSource(
  mainSrc,
  "comparisonItems",
  "function comparisonItems(value) { return Array.isArray(value) ? value : []; }",
);
const renderComparisonSrc = extractFunctionSource(mainSrc, "renderComparison");

const { comparisonRatePercent, renderComparison, dom } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${comparisonRatePercentSrc}
${comparisonItemsSrc}
const dom = {
  comparisonStatus: { textContent: "" },
  comparisonOverview: { innerHTML: "" },
  comparisonGrid: { innerHTML: "" },
};
${renderComparisonSrc}
return { comparisonRatePercent, renderComparison, dom };`,
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

check("comparisonRatePercent clamps high values", comparisonRatePercent(135.5), 100);
check("comparisonRatePercent clamps low values", comparisonRatePercent(-5), 0);
check("comparisonRatePercent accepts numeric strings", comparisonRatePercent("75"), 75);
check("comparisonRatePercent rejects invalid values", comparisonRatePercent("bad"), 0);

renderComparison({
  comparison: {
    comparison: {
      agreementRate: 135.5,
      agreements: [
        {
          category: "strength",
          topic: "<img src=x onerror=alert(1)>",
          claudeNote: "<script>alert(1)</script>",
          codexNote: "Codex <b>note</b>",
        },
      ],
      claudeOnly: [
        {
          category: "weakness",
          topic: "Claude <topic>",
          note: "<svg onload=alert(1)>",
        },
      ],
      codexOnly: [
        {
          category: "strength",
          topic: "Codex <topic>",
          note: "Unsafe & raw",
        },
      ],
    },
  },
});

check("comparison status clears when data exists", dom.comparisonStatus.textContent, "");
checkTrue("agreement rate label is clamped", dom.comparisonOverview.innerHTML.includes("<strong>100%</strong>"));
checkTrue("agreement rate fill is clamped", dom.comparisonOverview.innerHTML.includes('style="width: 100%"'));
checkTrue("raw high agreement rate is not rendered", !dom.comparisonOverview.innerHTML.includes("135.5%"));

checkTrue("agreement topic is escaped", dom.comparisonGrid.innerHTML.includes("&lt;img src=x onerror=alert(1)&gt;"));
checkTrue("Claude agreement note is escaped", dom.comparisonGrid.innerHTML.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
checkTrue("Codex agreement note is escaped", dom.comparisonGrid.innerHTML.includes("Codex &lt;b&gt;note&lt;/b&gt;"));
checkTrue("Claude-only topic is escaped", dom.comparisonGrid.innerHTML.includes("Claude &lt;topic&gt;"));
checkTrue("Claude-only note is escaped", dom.comparisonGrid.innerHTML.includes("&lt;svg onload=alert(1)&gt;"));
checkTrue("Codex-only note escapes ampersand", dom.comparisonGrid.innerHTML.includes("Unsafe &amp; raw"));

checkTrue("grid does not contain raw img payload", !dom.comparisonGrid.innerHTML.includes("<img"));
checkTrue("grid does not contain raw script payload", !dom.comparisonGrid.innerHTML.includes("<script"));
checkTrue("grid does not contain raw svg payload", !dom.comparisonGrid.innerHTML.includes("<svg"));
checkTrue("grid does not contain raw b payload", !dom.comparisonGrid.innerHTML.includes("<b>"));

checkTrue("renderComparison uses comparisonRatePercent", renderComparisonSrc.includes("comparisonRatePercent(comp.agreementRate)"));
checkTrue("renderComparison escapes agreement topics", renderComparisonSrc.includes("escapeHtml(a.topic"));
checkTrue("renderComparison escapes Claude agreement notes", renderComparisonSrc.includes("escapeHtml(a.claudeNote"));
checkTrue("renderComparison escapes Codex agreement notes", renderComparisonSrc.includes("escapeHtml(a.codexNote"));
checkTrue("renderComparison escapes single-source topics", renderComparisonSrc.includes("escapeHtml(c.topic"));
checkTrue("renderComparison escapes single-source notes", renderComparisonSrc.includes("escapeHtml(c.note"));
checkTrue("renderComparison no longer writes raw agreement topics", !renderComparisonSrc.includes("${a.topic}"));
checkTrue("renderComparison no longer writes raw Claude agreement notes", !renderComparisonSrc.includes("${a.claudeNote}"));
checkTrue("renderComparison no longer writes raw Codex agreement notes", !renderComparisonSrc.includes("${a.codexNote}"));
checkTrue("renderComparison no longer writes raw single-source topics", !renderComparisonSrc.includes("${c.topic}"));
checkTrue("renderComparison no longer writes raw single-source notes", !renderComparisonSrc.includes("${c.note}"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
