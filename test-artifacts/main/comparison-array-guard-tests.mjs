// Comparison array guard regression tests.
//
// AI comparison buckets can be absent or malformed. Rendering should treat
// malformed buckets as empty arrays instead of breaking the whole sample view.

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
const comparisonRatePercentSrc = extractFunctionSource(mainSrc, "comparisonRatePercent");
const comparisonItemsSrc = optionalFunctionSource(
  mainSrc,
  "comparisonItems",
  "function comparisonItems(value) { return value; }",
);
const renderComparisonSrc = extractFunctionSource(mainSrc, "renderComparison");

const { comparisonItems, renderComparison, dom } = new Function(
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
return { comparisonItems, renderComparison, dom };`,
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

function checkNoThrow(label, fn) {
  try {
    fn();
    console.log(`PASS  ${label}`);
    pass += 1;
  } catch (error) {
    console.log(`FAIL  ${label}`);
    console.log(`  threw ${error.name}: ${error.message}`);
    fail += 1;
  }
}

check("comparisonItems keeps arrays", comparisonItems([{ topic: "ok" }]).length, 1);
check("comparisonItems guards null", comparisonItems(null), []);
check("comparisonItems guards objects", comparisonItems({ topic: "not array" }), []);
check("comparisonItems guards missing values", comparisonItems(undefined), []);
check(
  "comparisonItems filters malformed array entries",
  comparisonItems([null, "bad", 7, [], { topic: "ok" }]),
  [{ topic: "ok" }],
);

checkNoThrow("renderComparison tolerates malformed comparison buckets", () => {
  renderComparison({
    comparison: {
      comparison: {
        agreementRate: 42,
        agreements: null,
        claudeOnly: { topic: "not an array" },
      },
    },
  });
});

check("malformed comparison status clears when comparison exists", dom.comparisonStatus.textContent, "");
checkTrue("malformed comparison keeps rate label", dom.comparisonOverview.innerHTML.includes("<strong>42%</strong>"));
checkTrue("malformed comparison renders zero agreements", dom.comparisonOverview.innerHTML.includes("동의 0건"));
checkTrue("malformed comparison renders zero Claude-only count", dom.comparisonOverview.innerHTML.includes("Claude 0건"));
checkTrue("malformed comparison renders zero Codex-only count", dom.comparisonOverview.innerHTML.includes("Codex 0건"));
checkTrue("malformed comparison renders agreement empty copy", dom.comparisonGrid.innerHTML.includes("동의 항목 없음"));
checkTrue("malformed comparison renders source empty copy", dom.comparisonGrid.innerHTML.includes("없음"));
check("malformed comparison renders no cards", (dom.comparisonGrid.innerHTML.match(/comparison-card/g) || []).length, 0);

renderComparison({
  comparison: {
    comparison: {
      agreementRate: 67,
      agreements: [
        {
          category: "strength",
          topic: "공통 강점",
          claudeNote: "Claude note",
          codexNote: "Codex note",
        },
      ],
      claudeOnly: [
        {
          category: "weakness",
          topic: "Claude만",
          note: "Claude-only note",
        },
      ],
      codexOnly: [
        {
          category: "strength",
          topic: "Codex만",
          note: "Codex-only note",
        },
      ],
    },
  },
});

checkTrue("valid comparison renders agreement count", dom.comparisonOverview.innerHTML.includes("동의 1건"));
checkTrue("valid comparison renders Claude-only count", dom.comparisonOverview.innerHTML.includes("Claude 1건"));
checkTrue("valid comparison renders Codex-only count", dom.comparisonOverview.innerHTML.includes("Codex 1건"));
check("valid comparison renders three cards", (dom.comparisonGrid.innerHTML.match(/comparison-card/g) || []).length, 3);

checkNoThrow("renderComparison skips malformed comparison items", () => {
  renderComparison({
    comparison: {
      comparison: {
        agreementRate: 88,
        agreements: [
          null,
          "bad",
          {
            category: "strength",
            topic: "공통",
            claudeNote: "C",
            codexNote: "D",
          },
        ],
        claudeOnly: [
          7,
          {
            category: "weakness",
            topic: "Claude",
            note: "only",
          },
        ],
        codexOnly: [
          [],
          {
            category: "strength",
            topic: "Codex",
            note: "only",
          },
        ],
      },
    },
  });
});

checkTrue("mixed item comparison renders agreement count", dom.comparisonOverview.innerHTML.includes("동의 1건"));
checkTrue("mixed item comparison renders Claude-only count", dom.comparisonOverview.innerHTML.includes("Claude 1건"));
checkTrue("mixed item comparison renders Codex-only count", dom.comparisonOverview.innerHTML.includes("Codex 1건"));
check("mixed item comparison renders only valid cards", (dom.comparisonGrid.innerHTML.match(/comparison-card/g) || []).length, 3);
checkTrue("mixed item comparison does not leak undefined text", !dom.comparisonGrid.innerHTML.includes("undefined"));
checkTrue("mixed item comparison does not leak null text", !dom.comparisonGrid.innerHTML.includes("null"));

checkTrue("renderComparison derives agreement local array", renderComparisonSrc.includes("const agreements = comparisonItems(comp.agreements)"));
checkTrue("renderComparison derives Claude-only local array", renderComparisonSrc.includes("const claudeOnly = comparisonItems(comp.claudeOnly)"));
checkTrue("renderComparison derives Codex-only local array", renderComparisonSrc.includes("const codexOnly = comparisonItems(comp.codexOnly)"));
checkTrue("renderComparison no longer counts raw agreement bucket", !renderComparisonSrc.includes("comp.agreements.length"));
checkTrue("renderComparison no longer maps raw agreement bucket", !renderComparisonSrc.includes("comp.agreements.map"));
checkTrue("renderComparison no longer maps raw Claude-only bucket", !renderComparisonSrc.includes("comp.claudeOnly.map"));
checkTrue("renderComparison no longer maps raw Codex-only bucket", !renderComparisonSrc.includes("comp.codexOnly.map"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
