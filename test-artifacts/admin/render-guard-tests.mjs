// admin.js re-render guard pins (Batch H).
//
// renderAll/renderLivePanel/renderPhasePanel replace innerHTML wholesale, which
// destroys a focused form control's value and focus. Another tab's running
// timer fires a storage event every second (subscribe → renderAll), and a local
// auto-rollover fires renderPhasePanel. Both must be deferred while editing.

import fs from "fs";

const adminSrc = fs.readFileSync(new URL("../../admin.js", import.meta.url), "utf8");

let pass = 0, fail = 0;
function checkTrue(label, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || !detail ? "" : `  — ${detail}`}`);
  cond ? pass++ : fail++;
}

checkTrue(
  "defines isEditingAdminFormControl guard",
  /function isEditingAdminFormControl\(\)/.test(adminSrc) &&
    /tag === "INPUT" \|\| tag === "TEXTAREA" \|\| tag === "SELECT"/.test(adminSrc),
);

// subscribe callback bails out before renderAll while editing
checkTrue(
  "subscribe defers renderAll while editing",
  /subscribe\(\(nextStore\) => \{[\s\S]*?if \(isEditingAdminFormControl\(\)\) return;[\s\S]*?renderAll\(\);/.test(adminSrc),
);

// animate guards renderLivePanel/renderPhasePanel while editing
checkTrue(
  "animate guards live/phase render while editing",
  /if \(!isEditingAdminFormControl\(\)\) \{[\s\S]*?renderLivePanel\(\);[\s\S]*?renderPhasePanel\(\);/.test(adminSrc),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
