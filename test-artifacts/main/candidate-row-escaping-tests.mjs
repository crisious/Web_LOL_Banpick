// Candidate row escaping regression tests.
//
// Live recent-match candidates are assembled with innerHTML. Match identifiers
// and display strings must be escaped at attributes and visible text sinks.

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
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const resultLabelSrc = extractFunctionSource(mainSrc, "resultLabel");
const roleLabelSrc = extractFunctionSource(mainSrc, "roleLabel");
const compactQueueLabelSrc = extractFunctionSource(mainSrc, "compactQueueLabel");
const compactPatchLabelSrc = extractFunctionSource(mainSrc, "compactPatchLabel");
const matchPatchLabelSrc = extractFunctionSource(mainSrc, "matchPatchLabel");
const championDisplayNameSrc = extractFunctionSource(mainSrc, "championDisplayName");
const championMonogramSrc = extractFunctionSource(mainSrc, "championMonogram");
const championAvatarMarkupSrc = extractFunctionSource(mainSrc, "championAvatarMarkup");
const buildCandidateCardSummarySrc = extractFunctionSource(mainSrc, "buildCandidateCardSummary");
const renderCandidatesSrc = extractFunctionSource(mainSrc, "renderCandidates");

const { dom, renderCandidates } = new Function(
  `${htmlEscapeSrc}
${escapeHtmlSrc}
${escapeAttrSrc}
${resultLabelSrc}
${roleLabelSrc}
${compactQueueLabelSrc}
${compactPatchLabelSrc}
${matchPatchLabelSrc}
${championDisplayNameSrc}
${championMonogramSrc}
function championAvatarArtValue() { return ""; }
function championAvatarPosition() { return "center top"; }
function queueChampionVersionLoad() {}
${championAvatarMarkupSrc}
${buildCandidateCardSummarySrc}
const dom = { candidateList: { innerHTML: "" } };
${renderCandidatesSrc}
return { dom, renderCandidates };`,
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

const unsafeMatchId = 'KR_1"><img src=x onerror=alert(1)>';
const unsafeResult = 'WIN"><svg onload=alert(1)>';
const unsafeChampion = 'Ahri"><img src=x onerror=alert(1)>';

renderCandidates([
  {
    matchId: unsafeMatchId,
    result: unsafeResult,
    champion: unsafeChampion,
    role: "SUPPORT",
    queueType: "CUSTOM<script>alert(1)</script>",
    queueLabel: "RANKED_SOLO<script>alert(1)</script>",
    gameVersion: "16.<svg onload=alert(1)>",
    kills: '5<b>',
    deaths: '1<script>alert(1)</script>',
    assists: "8",
    durationLabel: "30:00<img src=x onerror=alert(2)>",
    sampleFitScore: "99<script>alert(1)</script>",
  },
]);

const html = dom.candidateList.innerHTML;

checkTrue(
  "candidate row match id attribute is escaped",
  html.includes('data-generate-match="KR_1&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'),
);
checkTrue(
  "candidate row result attribute is escaped",
  html.includes('data-result="WIN&quot;&gt;&lt;svg onload=alert(1)&gt;"'),
);
checkTrue(
  "candidate result pill attribute is escaped",
  html.includes('<span class="match-row__result" data-result="WIN&quot;&gt;&lt;svg onload=alert(1)&gt;">'),
);
checkTrue(
  "candidate champion label is escaped",
  html.includes("Ahri&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"),
);
checkTrue("candidate role label remains localized", html.includes("서포터"));
checkTrue(
  "candidate queue type is escaped",
  html.includes("CUSTOM&lt;script&gt;alert(1)&lt;/script&gt;"),
);
checkTrue(
  "candidate patch label is escaped",
  html.includes("패치 26.&lt;svg onload=alert(1)&gt;"),
);
checkTrue(
  "candidate kda text is escaped",
  html.includes("5&lt;b&gt;/1&lt;script&gt;alert(1)&lt;/script&gt;/8"),
);
checkTrue(
  "candidate duration is escaped",
  html.includes("30:00&lt;img src=x onerror=alert(2)&gt;"),
);
checkTrue(
  "candidate summary is escaped",
  html.includes("RANKED_SOLO&lt;script&gt;alert(1)&lt;/script&gt; · 적합도 99&lt;script&gt;alert(1)&lt;/script&gt;"),
);
checkTrue("candidate result text uses safe fallback", html.includes(">결과 미상</span>"));

checkTrue("candidate row does not render raw img payload", !html.includes("<img"));
checkTrue("candidate row does not render raw svg payload", !html.includes("<svg"));
checkTrue("candidate row does not render raw script payload", !html.includes("<script"));
checkTrue("candidate row does not render raw b payload", !html.includes("<b>"));
checkTrue("candidate row does not break match id attribute", !html.includes('data-generate-match="KR_1"><img'));

checkTrue("renderCandidates escapes match id attribute", renderCandidatesSrc.includes("escapeAttr(match.matchId)"));
checkTrue("renderCandidates escapes row result attribute", renderCandidatesSrc.includes("escapeAttr(match.result)"));
checkTrue(
  "renderCandidates escapes champion display name",
  renderCandidatesSrc.includes("escapeHtml(championDisplayName(match.champion))"),
);
checkTrue(
  "renderCandidates escapes queue label",
  renderCandidatesSrc.includes("escapeHtml(compactQueueLabel(match.queueType) || \"\")"),
);
checkTrue(
  "renderCandidates escapes patch label",
  renderCandidatesSrc.includes("escapeHtml(matchPatchLabel(match.gameVersion) || \"\")"),
);
checkTrue(
  "renderCandidates escapes kda text",
  renderCandidatesSrc.includes("escapeHtml(`${match.kills}/${match.deaths}/${match.assists}`)"),
);
checkTrue(
  "renderCandidates escapes duration label",
  renderCandidatesSrc.includes("escapeHtml(match.durationLabel || \"\")"),
);
checkTrue(
  "renderCandidates escapes card summary",
  renderCandidatesSrc.includes("escapeHtml(buildCandidateCardSummary(match))"),
);
checkTrue(
  "renderCandidates escapes result text",
  renderCandidatesSrc.includes("escapeHtml(resultLabel(match.result))"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
