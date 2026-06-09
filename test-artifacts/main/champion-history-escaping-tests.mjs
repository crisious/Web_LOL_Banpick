// Champion history escaping regression tests.
//
// Champion history can render live Riot-derived champion names through
// innerHTML. Display text and avatar attributes must be escaped at the render
// boundary.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractConstObjectSource(source, name) {
  const pattern = new RegExp(`const ${name} = \\{[\\s\\S]*?\\};`);
  const match = source.match(pattern);
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

function extractConstArraySource(source, name) {
  const startIdx = source.indexOf(`const ${name} = [`);
  if (startIdx < 0) throw new Error(`const ${name} not found`);
  const endIdx = source.indexOf("];", startIdx);
  if (endIdx < 0) throw new Error(`const ${name} not closed`);
  return source.slice(startIdx, endIdx + 2);
}

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

const htmlEscapeSrc = extractConstObjectSource(mainSrc, "HTML_ESCAPE");
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const championDisplayNameSrc = extractFunctionSource(mainSrc, "championDisplayName");
const championMonogramSrc = extractFunctionSource(mainSrc, "championMonogram");
const championAvatarMarkupSrc = extractFunctionSource(mainSrc, "championAvatarMarkup");
const columnsSrc = extractConstArraySource(mainSrc, "CHAMPION_TABLE_COLUMNS");
const renderChampionSummarySrc = extractFunctionSource(mainSrc, "renderChampionSummary");
const renderChampionTableSrc = extractFunctionSource(mainSrc, "renderChampionTable");

const {
  championAvatarMarkup,
  dom,
  renderChampionSummary,
  renderChampionTable,
  tbody,
  thead,
} = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${championDisplayNameSrc}
${championMonogramSrc}
function championAvatarArtValue() { return ""; }
function championAvatarPosition() { return "center top"; }
function queueChampionVersionLoad() {}
${championAvatarMarkupSrc}
${columnsSrc}
const state = { championHistorySort: { key: "count", dir: "desc" } };
const sortButtons = [];
const thead = {
  innerHTML: "",
  querySelectorAll(selector) {
    return selector === "[data-sort-key]" ? sortButtons : [];
  },
};
const tbody = { innerHTML: "" };
const dom = {
  championHistorySummary: { hidden: true, innerHTML: "" },
  championHistoryTable: {
    querySelector(selector) {
      if (selector === "thead") return thead;
      if (selector === "tbody") return tbody;
      return null;
    },
  },
};
${renderChampionSummarySrc}
${renderChampionTableSrc}
return { championAvatarMarkup, dom, renderChampionSummary, renderChampionTable, tbody, thead };`,
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

const unsafeChampion = 'Ahri"><img src=x onerror=alert(1)>';
const unsafeBestChampion = "Lux<script>alert(1)</script>";

const avatarHtml = championAvatarMarkup(unsafeChampion, "small");
checkTrue("champion avatar title is escaped", avatarHtml.includes('title="Ahri&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'));
checkTrue("champion avatar data name is escaped", avatarHtml.includes('data-champion-name="Ahri&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'));
checkTrue("champion avatar does not render raw img payload", !avatarHtml.includes("<img"));
checkTrue("champion avatar does not break title attribute", !avatarHtml.includes('title="Ahri"><img'));

renderChampionSummary({
  totalGames: 5,
  wins: 3,
  losses: 2,
  wrPct: 60,
  mostPlayed: { champion: unsafeChampion, count: 4 },
  bestWr: { champion: unsafeBestChampion, wrPct: 75, count: 4 },
});

check("champion summary is visible", dom.championHistorySummary.hidden, false);
checkTrue(
  "champion summary escapes most played champion",
  dom.championHistorySummary.innerHTML.includes("Ahri&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"),
);
checkTrue(
  "champion summary escapes best champion",
  dom.championHistorySummary.innerHTML.includes("Lux&lt;script&gt;alert(1)&lt;/script&gt;"),
);
checkTrue("champion summary does not render raw img payload", !dom.championHistorySummary.innerHTML.includes("<img"));
checkTrue("champion summary does not render raw script payload", !dom.championHistorySummary.innerHTML.includes("<script"));

renderChampionTable([
  {
    champion: unsafeChampion,
    count: 4,
    wrPct: 62.5,
    avgKda: 3.25,
    avgCsPerMin: 7.3,
    avgDamagePerMin: 812,
    avgKp: 57,
  },
  {
    champion: unsafeBestChampion,
    count: 2,
    wrPct: 100,
    avgKda: 9.5,
    avgCsPerMin: 8.1,
    avgDamagePerMin: 920,
    avgKp: 64,
  },
], "champion", "asc");

const tableHtml = `${thead.innerHTML}\n${tbody.innerHTML}`;
checkTrue(
  "champion table escapes champion text",
  tbody.innerHTML.includes("Ahri&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"),
);
checkTrue(
  "champion table escapes script champion text",
  tbody.innerHTML.includes("Lux&lt;script&gt;alert(1)&lt;/script&gt;"),
);
checkTrue("champion table does not render raw img payload", !tableHtml.includes("<img"));
checkTrue("champion table does not render raw script payload", !tableHtml.includes("<script"));
checkTrue("champion table still renders numeric cells", tbody.innerHTML.includes("62.5%") && tbody.innerHTML.includes("3.25"));

checkTrue("renderChampionSummary escapes labels", renderChampionSummarySrc.includes("escapeHtml(c.label)"));
checkTrue("renderChampionSummary escapes values", renderChampionSummarySrc.includes("escapeHtml(c.value)"));
checkTrue("renderChampionSummary escapes notes", renderChampionSummarySrc.includes("escapeHtml(c.note)"));
checkTrue("renderChampionTable escapes champion display name", renderChampionTableSrc.includes("escapeHtml(championDisplayName(c.champion))"));
checkTrue("championAvatarMarkup escapes display attribute", championAvatarMarkupSrc.includes("escapeAttr(display)"));
checkTrue("championAvatarMarkup escapes champion name attribute", championAvatarMarkupSrc.includes("escapeAttr(name || \"\")"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
