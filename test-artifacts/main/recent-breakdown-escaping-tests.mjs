// Recent breakdown escaping regression tests.
//
// Recent aggregate champion/role breakdown rows are assembled with innerHTML.
// Riot-derived strings must be escaped at row attributes and visible labels.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractConstObjectSource(source, name) {
  const pattern = new RegExp(`const ${name} = \\{[\\s\\S]*?\\};`);
  const match = source.match(pattern);
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

function extractConstValueSource(source, name) {
  const pattern = new RegExp(`const ${name} = [^;]+;`);
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
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const roleLabelSrc = extractFunctionSource(mainSrc, "roleLabel");
const championDisplayNameSrc = extractFunctionSource(mainSrc, "championDisplayName");
const championMonogramSrc = extractFunctionSource(mainSrc, "championMonogram");
const championAvatarMarkupSrc = extractFunctionSource(mainSrc, "championAvatarMarkup");
const topNSrc = extractConstValueSource(mainSrc, "CHAMPION_BREAKDOWN_TOP_N");
const roleInitialSrc = extractConstObjectSource(mainSrc, "ROLE_INITIAL");
const renderChampionBreakdownSrc = extractFunctionSource(mainSrc, "renderChampionBreakdown");
const renderRoleBreakdownSrc = extractFunctionSource(mainSrc, "renderRoleBreakdown");

const {
  dom,
  renderChampionBreakdown,
  renderRoleBreakdown,
  state,
} = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${roleLabelSrc}
${championDisplayNameSrc}
${championMonogramSrc}
function championAvatarArtValue() { return ""; }
function championAvatarPosition() { return "center top"; }
function queueChampionVersionLoad() {}
${championAvatarMarkupSrc}
${topNSrc}
${roleInitialSrc}
const dom = {
  championBreakdownList: { innerHTML: "" },
  championBreakdownFooter: { hidden: false, textContent: "" },
  roleBreakdownList: { innerHTML: "" },
};
const state = { recentStats: null };
${renderChampionBreakdownSrc}
${renderRoleBreakdownSrc}
return { dom, renderChampionBreakdown, renderRoleBreakdown, state };`,
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
const unsafeRole = '"><svg onload=alert(1)>';

state.recentStats = {
  byChampion: [
    {
      champion: unsafeChampion,
      count: 4,
      wrPct: 62.5,
      avgKda: 3.25,
      avgCsPerMin: 7.3,
    },
    {
      champion: "Lux",
      count: 1,
      wrPct: 100,
      avgKda: 9.5,
      avgCsPerMin: 8.1,
    },
    {
      champion: "Zed",
      count: 1,
      wrPct: 0,
      avgKda: 1,
      avgCsPerMin: 6.2,
    },
    {
      champion: "Ashe",
      count: 1,
      wrPct: 0,
      avgKda: 1,
      avgCsPerMin: 6.2,
    },
    {
      champion: "Jinx",
      count: 1,
      wrPct: 0,
      avgKda: 1,
      avgCsPerMin: 6.2,
    },
    {
      champion: "Braum",
      count: 1,
      wrPct: 0,
      avgKda: 1,
      avgCsPerMin: 6.2,
    },
  ],
  byRole: [],
};

renderChampionBreakdown();

checkTrue(
  "champion breakdown data attribute is escaped",
  dom.championBreakdownList.innerHTML.includes('data-champion="Ahri&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'),
);
checkTrue(
  "champion breakdown visible label is escaped",
  dom.championBreakdownList.innerHTML.includes("Ahri&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"),
);
checkTrue(
  "champion breakdown does not render raw img payload",
  !dom.championBreakdownList.innerHTML.includes("<img"),
);
checkTrue(
  "champion breakdown does not break data attribute",
  !dom.championBreakdownList.innerHTML.includes('data-champion="Ahri"><img'),
);
checkTrue(
  "champion breakdown keeps numeric cells",
  dom.championBreakdownList.innerHTML.includes("4경기") &&
    dom.championBreakdownList.innerHTML.includes("62.5%") &&
    dom.championBreakdownList.innerHTML.includes("KDA 3.25") &&
    dom.championBreakdownList.innerHTML.includes("CS 7.3"),
);
check("champion breakdown footer still renders rest count", dom.championBreakdownFooter.textContent, "기타 (1챔피언, 1경기)");
check("champion breakdown footer is visible with rest", dom.championBreakdownFooter.hidden, false);

state.recentStats = {
  byChampion: [],
  byRole: [
    {
      role: unsafeRole,
      count: 3,
      wrPct: 66.7,
      avgKda: 4.2,
    },
  ],
};

renderRoleBreakdown();

checkTrue(
  "role breakdown data attribute is escaped",
  dom.roleBreakdownList.innerHTML.includes('data-role="&quot;&gt;&lt;svg onload=alert(1)&gt;"'),
);
checkTrue(
  "role breakdown icon fallback is escaped",
  dom.roleBreakdownList.innerHTML.includes("&quot;&gt;&lt;"),
);
checkTrue("role breakdown label uses safe fallback", dom.roleBreakdownList.innerHTML.includes("역할 미상"));
checkTrue("role breakdown does not render raw svg payload", !dom.roleBreakdownList.innerHTML.includes("<svg"));
checkTrue(
  "role breakdown does not break data attribute",
  !dom.roleBreakdownList.innerHTML.includes('data-role=""><svg'),
);
checkTrue(
  "role breakdown keeps numeric cells",
  dom.roleBreakdownList.innerHTML.includes("3경기") &&
    dom.roleBreakdownList.innerHTML.includes("66.7%") &&
    dom.roleBreakdownList.innerHTML.includes("KDA 4.20"),
);

checkTrue("renderChampionBreakdown escapes row attribute", renderChampionBreakdownSrc.includes("escapeAttr(c.champion)"));
checkTrue(
  "renderChampionBreakdown escapes champion display name",
  renderChampionBreakdownSrc.includes("escapeHtml(championDisplayName(c.champion))"),
);
checkTrue("renderRoleBreakdown escapes row attribute", renderRoleBreakdownSrc.includes("escapeAttr(r.role)"));
checkTrue(
  "renderRoleBreakdown escapes role icon fallback",
  renderRoleBreakdownSrc.includes("escapeHtml(ROLE_INITIAL[r.role] || r.role.slice(0, 3))"),
);
checkTrue(
  "renderRoleBreakdown escapes role label",
  renderRoleBreakdownSrc.includes("escapeHtml(roleLabel(r.role))"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
