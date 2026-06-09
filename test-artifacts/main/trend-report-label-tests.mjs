// Trend/report visible label regression tests.
//
// Trend and saved report surfaces are Korean-first UI. Internal state can keep
// English identifiers, but visible labels should not show report dashboard
// scaffolding such as Trend Summary, Reports, CURRENT, or ARCHIVE.

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
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const reportStateLabelSrc = extractFunctionSource(mainSrc, "reportStateLabel");
const buildTrendSnapshotSrc = extractFunctionSource(mainSrc, "buildTrendSnapshot");
const renderSampleSwitcherSrc = extractFunctionSource(mainSrc, "renderSampleSwitcher");

const { reportStateLabel } = new Function(`${reportStateLabelSrc}\nreturn { reportStateLabel };`)();

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

check("reportStateLabel current", reportStateLabel(true), "현재");
check("reportStateLabel archive", reportStateLabel(false), "보관");

checkTrue("trend stat label 리포트 exists", buildTrendSnapshotSrc.includes('label: "리포트"'));
checkTrue("trend stat label 전적 exists", buildTrendSnapshotSrc.includes('label: "전적"'));
checkTrue("trend stat label 주 역할 exists", buildTrendSnapshotSrc.includes('label: "주 역할"'));
checkTrue("trend stat label 현재 샘플 exists", buildTrendSnapshotSrc.includes('label: "현재 샘플"'));
checkTrue("trend stat label Reports removed", !buildTrendSnapshotSrc.includes('label: "Reports"'));
checkTrue("trend stat label Record removed", !buildTrendSnapshotSrc.includes('label: "Record"'));
checkTrue("trend stat label Main Role removed", !buildTrendSnapshotSrc.includes('label: "Main Role"'));
checkTrue("trend stat label Current removed", !buildTrendSnapshotSrc.includes('label: "Current"'));

checkTrue("renderSampleSwitcher uses reportStateLabel", renderSampleSwitcherSrc.includes("reportStateLabel(sample.id === state.currentSampleId)"));
checkTrue("renderSampleSwitcher visible CURRENT removed", !renderSampleSwitcherSrc.includes("? \"CURRENT\" : \"ARCHIVE\""));

checkTrue("static Trend Summary localized", indexSrc.includes('<span class="meta-label">누적 요약</span>'));
checkTrue("static Repeated Strengths localized", indexSrc.includes('<span class="meta-label">반복 강점</span>'));
checkTrue("static Repeated Weaknesses localized", indexSrc.includes('<span class="meta-label">반복 약점</span>'));
checkTrue("static Trend Summary removed", !indexSrc.includes(">Trend Summary<"));
checkTrue("static Repeated Strengths removed", !indexSrc.includes(">Repeated Strengths<"));
checkTrue("static Repeated Weaknesses removed", !indexSrc.includes(">Repeated Weaknesses<"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
