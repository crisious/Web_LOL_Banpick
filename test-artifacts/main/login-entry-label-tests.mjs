// Login entry visible label regression tests.
//
// The first viewport should be Korean-first except for the stable product name.
// Keep the H1 app name as the brand signal, but localize the browser title and
// the small login eyebrow label.

import fs from "fs";

const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const qaSmokeSrc = fs.readFileSync(new URL("../../scripts/qa-smoke.ps1", import.meta.url), "utf8");

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

checkTrue("browser title is localized", indexSrc.includes("<title>LoL 리플레이 코치 리포트</title>"));
checkTrue("login eyebrow is localized", indexSrc.includes('<span class="login-eyebrow">리플레이 리뷰</span>'));
checkTrue("login H1 keeps product name", indexSrc.includes('<h1 class="login-title" id="login-title">LoL Replay Coach</h1>'));

checkTrue("raw browser title removed", !indexSrc.includes("<title>LoL Replay Coach Report</title>"));
checkTrue("raw login eyebrow removed", !indexSrc.includes(">Replay Review<"));

checkTrue("PowerShell smoke expects localized browser title", qaSmokeSrc.includes("<title>LoL 리플레이 코치 리포트</title>"));
checkTrue("PowerShell smoke no longer expects raw browser title", !qaSmokeSrc.includes("<title>LoL Replay Coach Report</title>"));
checkTrue("PowerShell smoke still checks product name", qaSmokeSrc.includes("LoL Replay Coach"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
