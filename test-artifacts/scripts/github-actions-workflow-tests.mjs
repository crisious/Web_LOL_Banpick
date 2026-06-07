// GitHub Actions QA workflow contract tests.

import fs from "fs";

const workflowPath = new URL("../../.github/workflows/qa.yml", import.meta.url);

let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  const ok = Boolean(condition);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok && detail) console.log(`  ${detail}`);
  ok ? pass++ : fail++;
}

const exists = fs.existsSync(workflowPath);
check("QA workflow exists",
  exists,
  ".github/workflows/qa.yml is missing");

if (exists) {
  const workflow = fs.readFileSync(workflowPath, "utf8");

  check("QA workflow is named",
    /name:\s*QA/.test(workflow),
    workflow);

  check("QA workflow runs on main pushes",
    /push:\s*\n\s+branches:\s*\[\s*"main"\s*\]/.test(workflow),
    workflow);

  check("QA workflow runs on pull requests",
    /pull_request:/.test(workflow),
    workflow);

  check("QA workflow can run manually",
    /workflow_dispatch:/.test(workflow),
    workflow);

  check("QA workflow uses read-only permissions",
    /permissions:\s*\n\s+contents:\s*read/.test(workflow),
    workflow);

  check("QA workflow does not force old JavaScript action runtime",
    !/FORCE_JAVASCRIPT_ACTIONS_TO_NODE24/.test(workflow),
    workflow);

  check("QA workflow uses Node 24-native checkout action",
    /uses:\s*actions\/checkout@v6/.test(workflow),
    workflow);

  check("QA workflow uses Node 24-native setup-node action",
    /uses:\s*actions\/setup-node@v6/.test(workflow),
    workflow);

  check("QA workflow pins Node 20",
    /node-version:\s*"20"/.test(workflow),
    workflow);

  check("QA workflow runs npm test",
    /run:\s*npm test/.test(workflow),
    workflow);

  check("QA workflow runs read-only smoke report",
    /run:\s*npm run smoke:report:readonly/.test(workflow),
    workflow);

  check("QA workflow uploads QA automation artifacts",
    /uses:\s*actions\/upload-artifact@v7/.test(workflow) &&
      /path:\s*test-artifacts\/qa-automation\//.test(workflow),
    workflow);

  check("QA workflow uploads artifacts even after failure",
    /if:\s*always\(\)/.test(workflow),
    workflow);

  check("QA workflow does not require a demo token secret",
    !/PUBLIC_DEMO_TOKEN|secrets\./.test(workflow),
    workflow);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
