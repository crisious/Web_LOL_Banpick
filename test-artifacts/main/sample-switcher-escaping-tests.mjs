// Stored sample switcher escaping regression tests.
//
// Stored sample manifest values are assembled with innerHTML. Sample ids,
// aliases, champion names, metadata, and summary strings must be escaped at
// attributes and visible text sinks.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractConstObjectSource(source, name) {
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
const championAliasesSrc = extractConstObjectSource(mainSrc, "CHAMPION_ART_ALIASES");
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const resultLabelSrc = extractFunctionSource(mainSrc, "resultLabel");
const reportStateLabelSrc = extractFunctionSource(mainSrc, "reportStateLabel");
const roleLabelSrc = extractFunctionSource(mainSrc, "roleLabel");
const championDisplayNameSrc = extractFunctionSource(mainSrc, "championDisplayName");
const normalizeChampionTokenSrc = extractFunctionSource(mainSrc, "normalizeChampionToken");
const championAssetKeySrc = extractFunctionSource(mainSrc, "championAssetKey");
const championArtUrlSrc = extractFunctionSource(mainSrc, "championArtUrl");
const championSquareUrlSrc = extractFunctionSource(mainSrc, "championSquareUrl");
const championAvatarArtValueSrc = extractFunctionSource(mainSrc, "championAvatarArtValue");
const championAvatarPositionSrc = extractFunctionSource(mainSrc, "championAvatarPosition");
const championMonogramSrc = extractFunctionSource(mainSrc, "championMonogram");
const championAvatarMarkupSrc = extractFunctionSource(mainSrc, "championAvatarMarkup");
const parseReportMetaSrc = extractFunctionSource(mainSrc, "parseReportMeta");
const sampleReportLabelSrc = extractFunctionSource(mainSrc, "sampleReportLabel");
const compactInsightLabelSrc = extractFunctionSource(mainSrc, "compactInsightLabel");
const buildManifestCardSummarySrc = extractFunctionSource(mainSrc, "buildManifestCardSummary");
const visibleReportSamplesSrc = extractFunctionSource(mainSrc, "visibleReportSamples");
const renderSampleSwitcherSrc = extractFunctionSource(mainSrc, "renderSampleSwitcher");

const { championArtUrl, championAvatarMarkup, dom, renderSampleSwitcher, state } = new Function(
  `${htmlEscapeSrc}
${championAliasesSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${resultLabelSrc}
${reportStateLabelSrc}
${roleLabelSrc}
${championDisplayNameSrc}
let championCdnVersion = "";
let championAssetMap = null;
${normalizeChampionTokenSrc}
${championAssetKeySrc}
${championArtUrlSrc}
${championSquareUrlSrc}
${championAvatarArtValueSrc}
${championAvatarPositionSrc}
${championMonogramSrc}
function queueChampionVersionLoad() {}
${championAvatarMarkupSrc}
${parseReportMetaSrc}
${sampleReportLabelSrc}
${compactInsightLabelSrc}
${buildManifestCardSummarySrc}
const REPORT_STRIP_LIMIT = 6;
const state = { manifest: [], currentSampleId: "" };
const dom = {
  sampleSwitcher: { innerHTML: "" },
  reportStrip: { innerHTML: "" },
};
${visibleReportSamplesSrc}
function renderTrendPanel() {}
${renderSampleSwitcherSrc}
return { championArtUrl, championAvatarMarkup, dom, renderSampleSwitcher, state };`,
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

const unsafeId = 'sample-1"><img src=x onerror=alert(1)>';
const unsafeChampion = 'Ahri"><img src=x onerror=alert(1)>';
const unsafeAlias = "Tester<script>alert(1)</script>";
const unsafeTheme = "macro<script>alert(1)</script> plan";
const unsafeResult = 'WIN"><svg onload=alert(1)>';

check(
  "champion art URL keeps ordinary champion key",
  championArtUrl("Ahri"),
  "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Ahri_0.jpg",
);
checkTrue(
  "champion art URL encodes unsafe champion token",
  championArtUrl(unsafeChampion).includes("Ahri%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E_0.jpg"),
);

const avatarHtml = championAvatarMarkup(unsafeChampion, "small");
checkTrue("champion avatar inline style does not contain raw img payload", !avatarHtml.includes("<img"));
checkTrue("champion avatar inline style does not break the style attribute", !avatarHtml.includes('style="--champion-art:url(\'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Ahri"><img'));

state.currentSampleId = unsafeId;
state.manifest = [
  {
    id: unsafeId,
    label: `${unsafeId} · SUPPORT ${unsafeResult}`,
    champion: unsafeChampion,
    publicAlias: unsafeAlias,
    theme: unsafeTheme,
  },
  {
    id: "sample-safe",
    label: "sample-safe · MID LOSS",
    champion: "Lux",
    publicAlias: "Safe alias",
    theme: "오브젝트 템포 좋음",
  },
];

renderSampleSwitcher();

const html = `${dom.sampleSwitcher.innerHTML}\n${dom.reportStrip.innerHTML}`;

checkTrue(
  "sample chip id attribute is escaped",
  dom.sampleSwitcher.innerHTML.includes('data-sample-button="sample-1&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'),
);
checkTrue(
  "report card id attribute is escaped",
  dom.reportStrip.innerHTML.includes('data-sample-button="sample-1&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'),
);
checkTrue(
  "report card result attribute is escaped",
  dom.reportStrip.innerHTML.includes('data-result="WIN&quot;&gt;&lt;svg"'),
);
checkTrue(
  "sample chip champion text is escaped",
  dom.sampleSwitcher.innerHTML.includes("Ahri&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"),
);
checkTrue(
  "report card champion text is escaped",
  dom.reportStrip.innerHTML.includes("Ahri&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"),
);
checkTrue(
  "sample chip alias is escaped",
  dom.sampleSwitcher.innerHTML.includes("Tester&lt;script&gt;alert(1)&lt;/script&gt;"),
);
checkTrue(
  "report card alias is escaped",
  dom.reportStrip.innerHTML.includes("Tester&lt;script&gt;alert(1)&lt;/script&gt;"),
);
checkTrue(
  "report card id label is escaped",
  dom.reportStrip.innerHTML.includes("sample-1&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"),
);
checkTrue("sample report label remains localized", html.includes("서포터 결과 미상"));
checkTrue("report role badge remains localized", dom.reportStrip.innerHTML.includes(">서포터</span>"));
checkTrue("report result text uses safe fallback", dom.reportStrip.innerHTML.includes(">결과 미상</span>"));
checkTrue(
  "manifest summary is escaped",
  dom.reportStrip.innerHTML.includes("macro&lt;script&gt;alert(1)&lt;/script&gt; plan"),
);

checkTrue("sample switcher does not render raw img payload", !html.includes("<img"));
checkTrue("sample switcher does not render raw svg payload", !html.includes("<svg"));
checkTrue("sample switcher does not render raw script payload", !html.includes("<script"));
checkTrue("sample switcher does not render raw b payload", !html.includes("<b>"));
checkTrue("sample switcher does not break sample id attribute", !html.includes('data-sample-button="sample-1"><img'));

checkTrue("championArtUrl encodes asset key", championArtUrlSrc.includes("encodeURIComponent"));
checkTrue("championSquareUrl encodes asset key", championSquareUrlSrc.includes("encodeURIComponent"));
checkTrue("renderSampleSwitcher escapes sample chip id", renderSampleSwitcherSrc.includes("escapeAttr(sample.id)"));
checkTrue(
  "renderSampleSwitcher escapes sample chip champion",
  renderSampleSwitcherSrc.includes("escapeHtml(championDisplayName(sample.champion))"),
);
checkTrue(
  "renderSampleSwitcher escapes sample public alias",
  renderSampleSwitcherSrc.includes("escapeHtml(sample.publicAlias || \"\")"),
);
checkTrue(
  "renderSampleSwitcher escapes report card id label",
  renderSampleSwitcherSrc.includes("escapeHtml(sample.id)"),
);
checkTrue(
  "renderSampleSwitcher escapes report result attribute",
  renderSampleSwitcherSrc.includes("escapeAttr(meta.result)"),
);
checkTrue(
  "renderSampleSwitcher escapes report result text",
  renderSampleSwitcherSrc.includes("escapeHtml(resultText)"),
);
checkTrue(
  "renderSampleSwitcher escapes manifest summary",
  renderSampleSwitcherSrc.includes("escapeHtml(buildManifestCardSummary(sample))"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
