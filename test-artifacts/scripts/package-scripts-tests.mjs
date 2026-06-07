// package.json operational script contract tests.
//
// These keep the external demo runbook tied to short, repeatable npm commands.

import fs from "fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const scripts = pkg.scripts || {};

let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  const ok = Boolean(condition);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok && detail) console.log(`  ${detail}`);
  ok ? pass++ : fail++;
}

check("start:readonly script exists",
  typeof scripts["start:readonly"] === "string",
  "missing package script start:readonly");

check("start:readonly starts server in readonly mode",
  /PUBLIC_DEMO_MODE=readonly/.test(scripts["start:readonly"] || "") && /node server\.js/.test(scripts["start:readonly"] || ""),
  scripts["start:readonly"] || "(missing)");

check("smoke:readonly script exists",
  typeof scripts["smoke:readonly"] === "string",
  "missing package script smoke:readonly");

check("smoke:readonly pins local URL and expected mode",
  /scripts\/external-demo-smoke\.mjs/.test(scripts["smoke:readonly"] || "") &&
    /http:\/\/127\.0\.0\.1:8123/.test(scripts["smoke:readonly"] || "") &&
    /--expect-mode=readonly/.test(scripts["smoke:readonly"] || ""),
  scripts["smoke:readonly"] || "(missing)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
