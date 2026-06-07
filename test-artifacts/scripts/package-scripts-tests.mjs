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

check("start:protected script exists",
  typeof scripts["start:protected"] === "string",
  "missing package script start:protected");

check("start:protected starts server in protected mode",
  /PUBLIC_DEMO_MODE=protected/.test(scripts["start:protected"] || "") && /node server\.js/.test(scripts["start:protected"] || ""),
  scripts["start:protected"] || "(missing)");

check("smoke:readonly script exists",
  typeof scripts["smoke:readonly"] === "string",
  "missing package script smoke:readonly");

check("smoke:readonly pins local URL and expected mode",
  /scripts\/external-demo-smoke\.mjs/.test(scripts["smoke:readonly"] || "") &&
    /http:\/\/127\.0\.0\.1:8123/.test(scripts["smoke:readonly"] || "") &&
    /--expect-mode=readonly/.test(scripts["smoke:readonly"] || "") &&
    /--min-samples=19/.test(scripts["smoke:readonly"] || ""),
  scripts["smoke:readonly"] || "(missing)");

check("smoke:protected script exists",
  typeof scripts["smoke:protected"] === "string",
  "missing package script smoke:protected");

check("smoke:protected pins local URL, token requirement, and protected mode",
  /scripts\/external-demo-smoke\.mjs/.test(scripts["smoke:protected"] || "") &&
    /http:\/\/127\.0\.0\.1:8123/.test(scripts["smoke:protected"] || "") &&
    /--require-token/.test(scripts["smoke:protected"] || "") &&
    /--expect-mode=protected/.test(scripts["smoke:protected"] || "") &&
    /--min-samples=19/.test(scripts["smoke:protected"] || ""),
  scripts["smoke:protected"] || "(missing)");

check("smoke:external:readonly script exists",
  typeof scripts["smoke:external:readonly"] === "string",
  "missing package script smoke:external:readonly");

check("smoke:external:readonly requires explicit external URL and readonly mode",
  /scripts\/external-demo-smoke\.mjs/.test(scripts["smoke:external:readonly"] || "") &&
    /--require-url/.test(scripts["smoke:external:readonly"] || "") &&
    /--require-https/.test(scripts["smoke:external:readonly"] || "") &&
    /--expect-mode=readonly/.test(scripts["smoke:external:readonly"] || "") &&
    /--min-samples=19/.test(scripts["smoke:external:readonly"] || ""),
  scripts["smoke:external:readonly"] || "(missing)");

check("smoke:external:protected script exists",
  typeof scripts["smoke:external:protected"] === "string",
  "missing package script smoke:external:protected");

check("smoke:external:protected requires explicit external URL, token, and protected mode",
  /scripts\/external-demo-smoke\.mjs/.test(scripts["smoke:external:protected"] || "") &&
    /--require-url/.test(scripts["smoke:external:protected"] || "") &&
    /--require-https/.test(scripts["smoke:external:protected"] || "") &&
    /--require-token/.test(scripts["smoke:external:protected"] || "") &&
    /--expect-mode=protected/.test(scripts["smoke:external:protected"] || "") &&
    /--min-samples=19/.test(scripts["smoke:external:protected"] || ""),
  scripts["smoke:external:protected"] || "(missing)");

check("smoke:manifest:list-error script exists",
  typeof scripts["smoke:manifest:list-error"] === "string",
  "missing package script smoke:manifest:list-error");

check("smoke:manifest:list-error targets local readonly sample list manifest error",
  /scripts\/external-demo-smoke\.mjs/.test(scripts["smoke:manifest:list-error"] || "") &&
    /http:\/\/127\.0\.0\.1:8123/.test(scripts["smoke:manifest:list-error"] || "") &&
    /--expect-mode=readonly/.test(scripts["smoke:manifest:list-error"] || "") &&
    /--expect-sample-list-error-status=500/.test(scripts["smoke:manifest:list-error"] || "") &&
    /--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID/.test(scripts["smoke:manifest:list-error"] || "") &&
    /Sample manifest entry missing required field: label\./.test(scripts["smoke:manifest:list-error"] || ""),
  scripts["smoke:manifest:list-error"] || "(missing)");

check("smoke:manifest:detail-error script exists",
  typeof scripts["smoke:manifest:detail-error"] === "string",
  "missing package script smoke:manifest:detail-error");

check("smoke:manifest:detail-error targets local readonly sample detail manifest error",
  /scripts\/external-demo-smoke\.mjs/.test(scripts["smoke:manifest:detail-error"] || "") &&
    /http:\/\/127\.0\.0\.1:8123/.test(scripts["smoke:manifest:detail-error"] || "") &&
    /--expect-mode=readonly/.test(scripts["smoke:manifest:detail-error"] || "") &&
    /--expect-sample-detail-error-id=sample-kr-1/.test(scripts["smoke:manifest:detail-error"] || "") &&
    /--expect-sample-detail-error-status=500/.test(scripts["smoke:manifest:detail-error"] || "") &&
    /--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID/.test(scripts["smoke:manifest:detail-error"] || "") &&
    /Sample manifest entry path must not contain traversal segments: normalizedPath\./.test(scripts["smoke:manifest:detail-error"] || ""),
  scripts["smoke:manifest:detail-error"] || "(missing)");

check("smoke:external:manifest:list-error script exists",
  typeof scripts["smoke:external:manifest:list-error"] === "string",
  "missing package script smoke:external:manifest:list-error");

check("smoke:external:manifest:list-error requires external https readonly sample list manifest error",
  /scripts\/external-demo-smoke\.mjs/.test(scripts["smoke:external:manifest:list-error"] || "") &&
    /--require-url/.test(scripts["smoke:external:manifest:list-error"] || "") &&
    /--require-https/.test(scripts["smoke:external:manifest:list-error"] || "") &&
    /--expect-mode=readonly/.test(scripts["smoke:external:manifest:list-error"] || "") &&
    /--expect-sample-list-error-status=500/.test(scripts["smoke:external:manifest:list-error"] || "") &&
    /--expect-sample-list-error-code=SAMPLE_MANIFEST_INVALID/.test(scripts["smoke:external:manifest:list-error"] || "") &&
    /Sample manifest entry missing required field: label\./.test(scripts["smoke:external:manifest:list-error"] || ""),
  scripts["smoke:external:manifest:list-error"] || "(missing)");

check("smoke:external:manifest:detail-error script exists",
  typeof scripts["smoke:external:manifest:detail-error"] === "string",
  "missing package script smoke:external:manifest:detail-error");

check("smoke:external:manifest:detail-error requires external https readonly sample detail manifest error",
  /scripts\/external-demo-smoke\.mjs/.test(scripts["smoke:external:manifest:detail-error"] || "") &&
    /--require-url/.test(scripts["smoke:external:manifest:detail-error"] || "") &&
    /--require-https/.test(scripts["smoke:external:manifest:detail-error"] || "") &&
    /--expect-mode=readonly/.test(scripts["smoke:external:manifest:detail-error"] || "") &&
    /--expect-sample-detail-error-id=sample-kr-1/.test(scripts["smoke:external:manifest:detail-error"] || "") &&
    /--expect-sample-detail-error-status=500/.test(scripts["smoke:external:manifest:detail-error"] || "") &&
    /--expect-sample-detail-error-code=SAMPLE_MANIFEST_INVALID/.test(scripts["smoke:external:manifest:detail-error"] || "") &&
    /Sample manifest entry path must not contain traversal segments: normalizedPath\./.test(scripts["smoke:external:manifest:detail-error"] || ""),
  scripts["smoke:external:manifest:detail-error"] || "(missing)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
