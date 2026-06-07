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

  check("QA workflow accepts optional external readonly URL input",
    /external_readonly_url:/.test(workflow) &&
      /type:\s*string/.test(workflow) &&
      /required:\s*false/.test(workflow),
    workflow);

  check("QA workflow accepts optional external protected URL input",
    /external_protected_url:/.test(workflow) &&
      /type:\s*string/.test(workflow) &&
      /required:\s*false/.test(workflow),
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

  check("QA workflow detects optional protected smoke token",
    /id:\s*protected-smoke-token/.test(workflow) &&
      /PUBLIC_DEMO_TOKEN:\s*\$\{\{\s*secrets\.PUBLIC_DEMO_TOKEN\s*\}\}/.test(workflow) &&
      /available=true/.test(workflow) &&
      /available=false/.test(workflow),
    workflow);

  check("QA workflow gates protected smoke on token availability",
    /if:\s*\$\{\{\s*steps\.protected-smoke-token\.outputs\.available\s*==\s*'true'\s*\}\}/.test(workflow),
    workflow);

  check("QA workflow runs protected smoke report when token is available",
    /run:\s*npm run smoke:report:protected/.test(workflow),
    workflow);

  check("QA workflow runs external readonly smoke only for manual URL input",
    /if:\s*\$\{\{\s*github\.event_name\s*==\s*'workflow_dispatch'\s*&&\s*inputs\.external_readonly_url\s*!=\s*''\s*\}\}/.test(workflow) &&
      /EXTERNAL_READONLY_URL:\s*\$\{\{\s*inputs\.external_readonly_url\s*\}\}/.test(workflow) &&
      /run:\s*npm run smoke:report:external:readonly -- "\$EXTERNAL_READONLY_URL"/.test(workflow),
    workflow);

  check("QA workflow runs external protected smoke only for manual URL input and token",
    /if:\s*\$\{\{\s*github\.event_name\s*==\s*'workflow_dispatch'\s*&&\s*inputs\.external_protected_url\s*!=\s*''\s*&&\s*steps\.protected-smoke-token\.outputs\.available\s*==\s*'true'\s*\}\}/.test(workflow) &&
      /EXTERNAL_PROTECTED_URL:\s*\$\{\{\s*inputs\.external_protected_url\s*\}\}/.test(workflow) &&
      /run:\s*npm run smoke:report:external:protected -- "\$EXTERNAL_PROTECTED_URL"/.test(workflow),
    workflow);

  check("QA workflow fails external protected smoke when token is missing",
    /if:\s*\$\{\{\s*github\.event_name\s*==\s*'workflow_dispatch'\s*&&\s*inputs\.external_protected_url\s*!=\s*''\s*&&\s*steps\.protected-smoke-token\.outputs\.available\s*!=\s*'true'\s*\}\}/.test(workflow) &&
      /external_protected_url requires repository secret PUBLIC_DEMO_TOKEN/.test(workflow) &&
      /exit 1/.test(workflow),
    workflow);

  check("QA workflow avoids direct shell interpolation of external URL inputs",
    !/run:.*\$\{\{\s*inputs\.external_(readonly|protected)_url\s*\}\}/.test(workflow),
    workflow);

  check("QA workflow does not pass the demo token in command arguments",
    !/--token=.*PUBLIC_DEMO_TOKEN/.test(workflow),
    workflow);

  check("QA workflow uploads QA automation artifacts",
    /uses:\s*actions\/upload-artifact@v7/.test(workflow) &&
      /path:\s*test-artifacts\/qa-automation\//.test(workflow),
    workflow);

  check("QA workflow uploads artifacts even after failure",
    /if:\s*always\(\)/.test(workflow),
    workflow);

  const secretRefs = workflow.match(/secrets\.[A-Z0-9_]+/g) || [];
  check("QA workflow only references the optional public demo token secret",
    secretRefs.every((ref) => ref === "secrets.PUBLIC_DEMO_TOKEN"),
    secretRefs.join(", "));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
