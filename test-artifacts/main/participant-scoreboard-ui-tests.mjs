// main.js participant scoreboard rendering regression tests.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

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

function extractConstSource(source, name) {
  const startIdx = source.indexOf(`const ${name} = `);
  if (startIdx < 0) throw new Error(`const ${name} not found`);
  const assignIdx = source.indexOf("=", startIdx);
  let depth = 0;
  let bodyStarted = false;
  for (let i = assignIdx + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (ch === "}") {
      depth -= 1;
    } else if (ch === ";" && (!bodyStarted || depth === 0)) {
      return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`const ${name} not closed`);
}

const htmlEscapeSrc = extractConstSource(mainSrc, "HTML_ESCAPE");
const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const scoreToneSrc = extractFunctionSource(mainSrc, "participantScoreTone");
const relationLabelSrc = extractFunctionSource(mainSrc, "participantRelationLabel");
const renderParticipantRowSrc = extractFunctionSource(mainSrc, "renderParticipantScoreRow");

const { participantScoreTone, renderParticipantScoreRow } = new Function(
  `${htmlEscapeSrc}\n${escapeHtmlSrc}\n${escapeAttrSrc}\n${scoreToneSrc}\n${relationLabelSrc}\n${renderParticipantRowSrc}\nreturn { participantScoreTone, renderParticipantScoreRow };`,
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

checkTrue("index has participant scoreboard container",
  indexSrc.includes("data-participant-scoreboard"));
checkTrue("main tracks participant scoreboard DOM",
  mainSrc.includes("participantScoreboard: document.querySelector(\"[data-participant-scoreboard]\")"));
checkTrue("main defines participant scoreboard renderer",
  mainSrc.includes("function renderParticipantScoreboard(sample)"));
checkTrue("renderSample calls participant scoreboard renderer",
  mainSrc.includes("renderParticipantScoreboard(sample)"));

check("participantScoreTone mvp", participantScoreTone(8), "mvp");
check("participantScoreTone good", participantScoreTone(6), "good");
check("participantScoreTone avg", participantScoreTone(4), "avg");
check("participantScoreTone poor", participantScoreTone(3.9), "poor");

const row = renderParticipantScoreRow({
  relation: "ENEMY",
  role: "MID",
  champion: "<img src=x onerror=alert(1)>",
  label: "상대 MID <script>alert(1)</script>",
  rankOverall: 1,
  rankTeam: 1,
  stats: {
    kills: 9,
    deaths: 3,
    assists: 6,
    csPerMinute: 7.36,
    damageToChampions: 31000,
    visionScore: 25,
  },
  score: {
    overall: 8.1,
    label: "캐리",
    categories: { combat: 9, income: 8, vision: 4, survival: 8 },
  },
  coaching: "상대 핵심 위협 <b>주의</b>",
});

checkTrue("row escapes champion markup", !row.includes("<img"));
checkTrue("row escapes script markup", !row.includes("<script"));
checkTrue("row escapes coaching html", !row.includes("<b>"));
checkTrue("row renders score", row.includes("8.1"));
checkTrue("row renders KDA", row.includes("9 / 3 / 6"));
checkTrue("row renders tone class", row.includes("participant-score-row--mvp"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
