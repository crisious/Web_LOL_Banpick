// Evidence-first coaching dashboard semantic, responsive, and typography
// contracts. Source-level checks mirror the existing zero-dependency a11y and
// CSS regression tests in this directory.

import fs from "node:fs";

const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const cssSrc = fs.readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
const adminCssSrc = fs.readFileSync(new URL("../../admin.css", import.meta.url), "utf8");

let pass = 0;
let fail = 0;

function checkTrue(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${condition || !detail ? "" : `  — ${detail}`}`);
  condition ? pass++ : fail++;
}

function tagWithAttribute(source, attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`<[^>]+\\b${escaped}(?:=[^\\s>]+|="[^"]*")?[^>]*>`, "i"))?.[0] || "";
}

function blocksAfterMarker(source, marker) {
  const blocks = [];
  let cursor = 0;
  while (cursor < source.length) {
    const markerIndex = source.indexOf(marker, cursor);
    if (markerIndex < 0) break;
    const open = source.indexOf("{", markerIndex + marker.length);
    if (open < 0) break;
    let depth = 0;
    let close = -1;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close < 0) break;
    blocks.push(source.slice(open + 1, close));
    cursor = close + 1;
  }
  return blocks.join("\n");
}

function ruleHas(source, selector, declarationPattern) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rulePattern = new RegExp(
    `${escapedSelector}[^{}]*\\{[^}]*${declarationPattern.source}[^}]*\\}`,
    "i",
  );
  return rulePattern.test(source);
}

function simpleCssRules(source) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1],
    declarations: match[2],
  }));
}

// ── Semantic dashboard hosts ─────────────────────────────────────────────
const dashboardSection = indexSrc.match(/<section\b[^>]*data-evidence-dashboard[^>]*>/i)?.[0] || "";
checkTrue("index defines the evidence dashboard section", Boolean(dashboardSection));
checkTrue("evidence dashboard is labelled by a heading", /aria-labelledby="evidence-lab-title"/.test(dashboardSection));
checkTrue(
  "evidence dashboard exposes its labelled heading",
  indexSrc.includes('id="evidence-lab-title"') || mainSrc.includes('id="evidence-lab-title"'),
);

for (const host of [
  "data-evidence-dashboard-header",
  "data-evidence-dashboard-metrics",
  "data-evidence-moments",
  "data-evidence-detail",
  "data-evidence-protocol",
]) {
  checkTrue(`index defines ${host} host`, indexSrc.includes(host));
}

const detailHost = tagWithAttribute(indexSrc, "data-evidence-detail");
checkTrue("selected detail announces updates politely", /aria-live="polite"/.test(detailHost));
checkTrue("selected detail announcement is atomic", /aria-atomic="true"/.test(detailHost));
checkTrue(
  "page exposes the evidence dashboard social preview",
  /<meta\s+property="og:image"\s+content="\/og\.png"\s*\/>/.test(indexSrc) &&
    /<meta\s+name="twitter:card"\s+content="summary_large_image"\s*\/>/.test(indexSrc),
);

// ── Native controls and labelled fact/interpretation regions ─────────────
const momentButtonTemplate = mainSrc.match(
  /<button\b[\s\S]{0,500}?data-evidence-moment-id[\s\S]{0,500}?<\/button>/,
)?.[0] || "";
checkTrue("moment selector renders a native button", /<button\b/.test(momentButtonTemplate));
checkTrue("moment selector pins type=button", /type="button"/.test(momentButtonTemplate));
checkTrue("moment selector exposes a stable moment ID", /data-evidence-moment-id=/.test(momentButtonTemplate));
checkTrue("moment selector exposes pressed state", /aria-pressed=/.test(momentButtonTemplate));

const observedSectionTag = mainSrc.match(/<section\b[^>]*data-evidence-observed[^>]*>/i)?.[0] || "";
const interpretationSectionTag = mainSrc.match(
  /<section\b[^>]*data-evidence-interpretation[^>]*>/i,
)?.[0] || "";
checkTrue("observed facts render in a semantic section", Boolean(observedSectionTag));
checkTrue("observed facts section is labelled", /aria-labelledby=/.test(observedSectionTag));
checkTrue("AI interpretation renders in a semantic section", Boolean(interpretationSectionTag));
checkTrue("AI interpretation section is labelled", /aria-labelledby=/.test(interpretationSectionTag));
checkTrue("observed facts use the visible Korean label", mainSrc.includes("관찰된 사실"));
checkTrue("AI interpretation uses the visible Korean label", mainSrc.includes("AI 해석"));

const protocolCheckboxTemplate = mainSrc.match(
  /<input\b[\s\S]{0,300}?data-evidence-protocol-check[\s\S]{0,300}?>/,
)?.[0] || "";
checkTrue("next-game protocol uses a native checkbox", /type="checkbox"/.test(protocolCheckboxTemplate));
checkTrue(
  "moment selection has a visible keyboard focus style",
  /(?:\.evidence-moment|\[data-evidence-moment-id\]):focus-visible\s*\{/.test(cssSrc),
);

// ── Responsive hooks at the repository's established breakpoints ────────
const desktopReflow = blocksAfterMarker(cssSrc, "@media (max-width: 1180px)");
const mobileReflow = blocksAfterMarker(cssSrc, "@media (max-width: 760px)");
const narrowReflow = blocksAfterMarker(cssSrc, "@media (max-width: 480px)");

checkTrue(
  "1180px stacks the evidence lab grid",
  ruleHas(desktopReflow, ".evidence-lab-grid", /grid-template-columns\s*:\s*1fr/),
);
checkTrue(
  "760px stacks evidence metrics",
  ruleHas(mobileReflow, ".evidence-metrics", /grid-template-columns\s*:\s*1fr/),
);
checkTrue(
  "760px shows evidence moments in two columns",
  ruleHas(mobileReflow, ".evidence-moment-grid", /grid-template-columns\s*:\s*repeat\(2\s*,\s*(?:minmax\(0\s*,\s*)?1fr\)?\)/),
);
checkTrue(
  "760px stacks observed facts and AI interpretation",
  ruleHas(mobileReflow, ".evidence-reasoning", /grid-template-columns\s*:\s*1fr/),
);
checkTrue(
  "480px shows evidence moments in one column",
  ruleHas(narrowReflow, ".evidence-moment-grid", /grid-template-columns\s*:\s*1fr/),
);

// ── Pretendard-only typography with tabular numeric alignment ────────────
checkTrue(
  "main UI declares the Pretendard family",
  /font-family\s*:[^;]*"Pretendard Variable"[^;]*"Pretendard"[^;]*sans-serif/.test(cssSrc),
);
checkTrue(
  "admin UI declares the Pretendard family",
  /font-family\s*:[^;]*"Pretendard Variable"[^;]*"Pretendard"[^;]*sans-serif/.test(adminCssSrc),
);

const productionCss = `${cssSrc}\n${adminCssSrc}`;
const fontFamilyValues = [...productionCss.matchAll(/font-family\s*:\s*([^;]+);/gi)].map((match) => match[1].trim());
const disallowedFontFamilies = fontFamilyValues.filter((value) =>
  /\bui-monospace\b|\bSFMono(?:-Regular)?\b|(?:^|[\s,])monospace(?:[\s,]|$)|(?:^|[\s,])serif(?:[\s,]|$)|\bGeorgia\b|Times New Roman/i.test(value),
);
checkTrue(
  "production CSS removes separate monospace and serif families",
  disallowedFontFamilies.length === 0,
  disallowedFontFamilies.join(" | "),
);

const unexpectedFontFamilies = fontFamilyValues.filter((value) =>
  value !== "inherit" && !value.includes("Pretendard"),
);
checkTrue(
  "every explicit production font family is Pretendard or inherit",
  unexpectedFontFamilies.length === 0,
  unexpectedFontFamilies.join(" | "),
);

const controlInheritanceRule = simpleCssRules(cssSrc).some(({ selector, declarations }) =>
  ["button", "input", "select", "textarea"].every((control) => selector.includes(control)) &&
  /font(?:-family)?\s*:\s*inherit/.test(declarations),
);
checkTrue("buttons and form controls inherit the unified family", controlInheritanceRule);

for (const numericSelector of [
  ".evidence-score__value",
  ".evidence-metric__value",
  ".evidence-moment time",
]) {
  checkTrue(
    `${numericSelector} uses tabular numerals without another font`,
    ruleHas(cssSrc, numericSelector, /font-variant-numeric\s*:\s*tabular-nums/),
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
