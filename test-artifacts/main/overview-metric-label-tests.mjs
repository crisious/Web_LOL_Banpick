// Overview metric visible label regression tests.
//
// The detail overview metric strip is Korean-first UI. Queue, patch, and
// mastery are domain concepts, but the visible labels should not remain as
// English scaffolding.

import fs from "fs";

const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

checkTrue("overview queue label localized", indexSrc.includes('<span class="meta-label">큐</span>'));
checkTrue("overview patch label localized", indexSrc.includes('<span class="meta-label">패치</span>'));
checkTrue("overview mastery label localized", indexSrc.includes('<span class="meta-label">숙련도</span>'));
checkTrue("overview cs per minute label remains Korean", indexSrc.includes('<span class="meta-label">CS/분</span>'));

checkTrue("overview raw Queue label removed", !indexSrc.includes(">Queue<"));
checkTrue("overview raw Patch label removed", !indexSrc.includes(">Patch<"));
checkTrue("overview raw Mastery label removed", !indexSrc.includes(">Mastery<"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
