// Stored sample metadata label regression tests.
//
// Stored sample labels contain schema-friendly tokens such as SUPPORT LOSS.
// User-facing cards should render Korean labels while keeping raw tokens only in
// data attributes where styling needs them.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

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

const resultLabelSrc = extractFunctionSource(mainSrc, "resultLabel");
const roleLabelSrc = extractFunctionSource(mainSrc, "roleLabel");
const parseReportMetaSrc = extractFunctionSource(mainSrc, "parseReportMeta");
const sampleReportLabelSrc = extractFunctionSource(mainSrc, "sampleReportLabel");
const candidateIdentityMetaMarkupSrc = extractFunctionSource(mainSrc, "candidateIdentityMetaMarkup");
const renderSampleSwitcherSrc = extractFunctionSource(mainSrc, "renderSampleSwitcher");
const renderHeroSrc = extractFunctionSource(mainSrc, "renderHero");
const renderCandidatesSrc = extractFunctionSource(mainSrc, "renderCandidates");
const buildTrendSnapshotSrc = extractFunctionSource(mainSrc, "buildTrendSnapshot");

const { resultLabel, roleLabel, sampleReportLabel } = new Function(
  `${resultLabelSrc}\n${roleLabelSrc}\n${parseReportMetaSrc}\n${sampleReportLabelSrc}\nreturn { resultLabel, roleLabel, sampleReportLabel };`,
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

check("roleLabel TOP", roleLabel("TOP"), "탑");
check("roleLabel JUNGLE", roleLabel("JUNGLE"), "정글");
check("roleLabel MID", roleLabel("MID"), "미드");
check("roleLabel ADC", roleLabel("ADC"), "원딜");
check("roleLabel SUPPORT", roleLabel("SUPPORT"), "서포터");
check("roleLabel unknown fallback", roleLabel("UTILITY"), "역할 미상");
check("roleLabel blank fallback", roleLabel("   "), "역할 미상");
check("roleLabel null fallback", roleLabel(null), "역할 미상");

check("resultLabel WIN", resultLabel("WIN"), "승리");
check("resultLabel LOSS", resultLabel("LOSS"), "패배");
check("resultLabel unknown fallback", resultLabel("REMAKE"), "결과 미상");
check("resultLabel blank fallback", resultLabel(""), "결과 미상");

const sample = {
  id: "sample-kr-8242613150",
  label: "sample-kr-8242613150 · SUPPORT LOSS",
};
check("sampleReportLabel localizes stored sample metadata",
  sampleReportLabel(sample),
  "sample-kr-8242613150 · 서포터 패배");
checkTrue("sampleReportLabel does not leak SUPPORT", !sampleReportLabel(sample).includes("SUPPORT"));
checkTrue("sampleReportLabel does not leak LOSS", !sampleReportLabel(sample).includes("LOSS"));

const unknownSample = {
  id: "sample-unknown",
  label: "sample-unknown · UTILITY REMAKE",
};
check("sampleReportLabel uses safe unknown fallbacks",
  sampleReportLabel(unknownSample),
  "sample-unknown · 역할 미상 결과 미상");

checkTrue(
  "candidateIdentityMetaMarkup localizes role tag",
  candidateIdentityMetaMarkupSrc.includes("roleLabel(role)"),
);
checkTrue(
  "renderSampleSwitcher uses sampleReportLabel for sample chip text",
  renderSampleSwitcherSrc.includes("sampleReportLabel(sample)"),
);
checkTrue(
  "renderSampleSwitcher localizes report role badge",
  renderSampleSwitcherSrc.includes("roleLabel(meta.role)"),
);
checkTrue(
  "renderHero localizes snapshot role",
  renderHeroSrc.includes("roleLabel(match.role)"),
);
checkTrue(
  "renderCandidates localizes match row role",
  renderCandidatesSrc.includes("roleLabel(match.role)"),
);
checkTrue(
  "buildTrendSnapshot localizes dominant role headline",
  buildTrendSnapshotSrc.includes("roleLabel(dominantRole)"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
