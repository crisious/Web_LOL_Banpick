// innerHTML escaping regression tests for live, server-fed render sinks.
//
// renderHero (champion banner), renderMatchList (recent match cards), and
// renderBuildTimeline (item build strip) interpolate Riot/manifest-derived
// strings into innerHTML. They must escape display text (escapeHtml) and
// attribute values (escapeAttr), mirroring renderCandidates. renderBuildTimeline
// is rendered for real; the other two are pinned at source level (heavy DOM deps).

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

let pass = 0;
let fail = 0;
function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

// ── renderBuildTimeline: real render ──────────────────────────────────────
const htmlEscapeSrc = extractConstObjectSource(mainSrc, "HTML_ESCAPE");
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const itemCdnVersionSrc = extractFunctionSource(mainSrc, "itemCdnVersion");
const renderBuildTimelineSrc = extractFunctionSource(mainSrc, "renderBuildTimeline");

const { dom, renderBuildTimeline } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
const championCdnVersion = "26.10.1";
${itemCdnVersionSrc}
const dom = { buildTimeline: { innerHTML: "" } };
${renderBuildTimelineSrc}
return { dom, renderBuildTimeline };`,
)();

// gameVersion payload sits in the 2nd dot-segment so itemCdnVersion keeps it;
// both items stay below the major-item threshold so the unfiltered fallback path renders them.
renderBuildTimeline({
  normalized: {
    matchInfo: { gameVersion: '26.10"><svg onload=alert(9)>.5' },
    itemTimeline: [
      { itemId: '3001"><img src=x onerror=alert(1)>', timeLabel: '8:49"><img src=x onerror=alert(2)>' },
      { itemId: 1055, timeLabel: "12:30" },
    ],
  },
});

const buildHtml = dom.buildTimeline.innerHTML;
checkTrue("build timeline does not render raw img payload", !buildHtml.includes("<img src=x"));
checkTrue("build timeline does not render raw svg payload", !buildHtml.includes("<svg"));
checkTrue(
  "build timeline coerces non-numeric itemId to 0 in src",
  buildHtml.includes("/img/item/0.png") && buildHtml.includes("/img/item/1055.png"),
);
checkTrue(
  "build timeline escapes time label",
  buildHtml.includes("8:49&quot;&gt;&lt;img src=x onerror=alert(2)&gt;"),
);
checkTrue(
  "build timeline escapes cdn version in src",
  buildHtml.includes("cdn/26.10&quot;&gt;&lt;svg onload=alert(9)&gt;.1/img"),
);
checkTrue("build timeline keeps safe numeric build still renders time", buildHtml.includes("12:30"));

// ── renderHero: source-level escape pins ──────────────────────────────────
const renderHeroSrc = extractFunctionSource(mainSrc, "renderHero");
checkTrue(
  "renderHero escapes champion banner name",
  renderHeroSrc.includes("${escapeHtml(championName)}"),
);
checkTrue(
  "renderHero escapes banner result attribute",
  renderHeroSrc.includes('data-result="${escapeAttr(match.result || "")}"'),
);

// ── renderMatchList: source-level escape pins ─────────────────────────────
const renderMatchListSrc = extractFunctionSource(mainSrc, "renderMatchList");
checkTrue(
  "renderMatchList escapes match detail attribute",
  renderMatchListSrc.includes("data-match-detail=\"${escapeAttr(m.matchId)}\""),
);
checkTrue(
  "renderMatchList escapes result attribute",
  renderMatchListSrc.includes("data-result=\"${escapeAttr(m.result)}\""),
);
checkTrue(
  "renderMatchList escapes champion display name",
  renderMatchListSrc.includes("${escapeHtml(championDisplayName(m.champion))}"),
);
checkTrue(
  "renderMatchList escapes duration label",
  renderMatchListSrc.includes('${escapeHtml(m.durationLabel || "")}'),
);
checkTrue(
  "renderMatchList escapes queue label",
  renderMatchListSrc.includes('${escapeHtml(compactQueueLabel(m.queueLabel) || "")}'),
);
checkTrue(
  "renderMatchList escapes patch label",
  renderMatchListSrc.includes('${escapeHtml(patchLabel || "")}'),
);
checkTrue(
  "renderMatchList escapes mastery level",
  renderMatchListSrc.includes("M${escapeHtml(masteryInfo.championLevel)}"),
);

// ── profile header source-level pins ──────────────────────────────────────
checkTrue(
  "renderMatchList escapes profile icon src",
  renderMatchListSrc.includes('src="${escapeAttr(iconUrl)}"'),
);
checkTrue(
  "renderMatchList escapes summoner level",
  renderMatchListSrc.includes("Lv. ${escapeHtml(acct.summonerLevel)}"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
