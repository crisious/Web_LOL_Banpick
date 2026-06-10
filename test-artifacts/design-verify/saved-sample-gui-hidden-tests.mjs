// Saved-sample GUI hidden regression tests (2026-06-10).
//
// The detail page must not display the saved-sample browsing GUIs. They are
// hidden via CSS (display:none) while markup/selectors/JS are preserved
// (design invariant). This guards against accidental re-exposure: the hide
// block must exist, cover all three targets, set display:none, and sit after
// the base rules so source order wins.

import fs from "fs";

const css = fs.readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

let pass = 0, fail = 0;
function checkTrue(label, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || !detail ? "" : `  — ${detail}`}`);
  cond ? pass++ : fail++;
}

const HIDE_TARGETS = [".panel--samples", ".panel--reports", ".login-demo-actions"];
const MARKER = "저장 샘플 GUI 숨김";

// 1. The hide block exists, anchored by its comment marker.
const markerIdx = css.indexOf(MARKER);
checkTrue("hide block comment marker exists", markerIdx >= 0);

// The rule block immediately follows the marker comment: selectors then { ... }.
const ruleStart = markerIdx >= 0 ? css.indexOf("*/", markerIdx) : -1;
const braceOpen = ruleStart >= 0 ? css.indexOf("{", ruleStart) : -1;
const braceClose = braceOpen >= 0 ? css.indexOf("}", braceOpen) : -1;
const selectorList = ruleStart >= 0 && braceOpen >= 0 ? css.slice(ruleStart + 2, braceOpen) : "";
const declarations = braceOpen >= 0 && braceClose >= 0 ? css.slice(braceOpen + 1, braceClose) : "";

checkTrue("hide rule block found after marker", braceOpen >= 0 && braceClose > braceOpen);

// 2. All three targets are in the hide rule's selector list.
for (const sel of HIDE_TARGETS) {
  checkTrue(`hide block targets ${sel}`, selectorList.includes(sel));
}

// 3. The declaration is display:none.
checkTrue("hide block declares display:none", /display:\s*none\s*;?/.test(declarations));

// 4. Source-order: the hide block sits AFTER each target's base rule so it wins
//    (all three have equal specificity; later rule wins).
for (const sel of HIDE_TARGETS) {
  const baseIdx = css.indexOf(`${sel} {`);
  checkTrue(`hide block is after base rule for ${sel}`, baseIdx >= 0 && baseIdx < markerIdx,
    `base=${baseIdx} marker=${markerIdx}`);
}

// 5. No !important needed — pin that the hide stays a plain declaration (smell guard).
checkTrue("hide block avoids !important", !/!important/.test(declarations));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
