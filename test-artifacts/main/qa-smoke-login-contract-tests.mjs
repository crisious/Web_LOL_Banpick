// PowerShell smoke first-screen contract regression tests.
//
// qa-smoke.ps1 should verify the current read-only login surface. It should not
// keep stale layout-era headings that no longer exist in index.html.

import fs from "fs";

const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const qaSmokeSrc = fs.readFileSync(new URL("../../scripts/qa-smoke.ps1", import.meta.url), "utf8");

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

checkTrue("index no longer has stale dashboard heading", !indexSrc.includes("Replay Coach Dashboard"));
checkTrue("PowerShell smoke no longer expects stale dashboard heading", !qaSmokeSrc.includes("Replay Coach Dashboard"));
checkTrue("PowerShell smoke checks localized login eyebrow", qaSmokeSrc.includes("리플레이 리뷰"));
checkTrue("PowerShell smoke checks stored sample entry CTA", qaSmokeSrc.includes("저장 샘플 열기"));
checkTrue("PowerShell smoke still checks localized title", qaSmokeSrc.includes("<title>LoL 리플레이 코치 리포트</title>"));
checkTrue("PowerShell smoke still checks product name", qaSmokeSrc.includes("LoL Replay Coach"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
