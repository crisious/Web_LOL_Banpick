// Boot entry-mode regression tests.
//
// 저장된 계정이 없으면 어떤 서버 모드에서도 로그인 화면으로 진입해야 한다.
// 과거 full 모드에서 저장 샘플이 있으면 상세 화면으로 직행했는데, 그 화면에는
// 로그인 오버레이도 "다른 계정" 버튼도 없어 Riot 계정을 바꿀 수단이 사라졌다.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  const parenStart = source.indexOf("(", startIdx);
  if (parenStart < 0) throw new Error(`function ${name} signature not found`);
  let parenDepth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") parenDepth += 1;
    else if (ch === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        parenEnd = i;
        break;
      }
    }
  }
  if (parenEnd < 0) throw new Error(`function ${name} signature not closed`);
  const bodyStart = source.indexOf("{", parenEnd);
  if (bodyStart < 0) throw new Error(`function ${name} body not found`);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const bootstrapEntryModeSrc = extractFunctionSource(mainSrc, "bootstrapEntryMode");
const hasMatchListContextSrc = extractFunctionSource(mainSrc, "hasMatchListContext");

const buildFunctions = new Function(
  "state",
  `${hasMatchListContextSrc}\n${bootstrapEntryModeSrc}\nreturn { bootstrapEntryMode, hasMatchListContext };`,
);

const { bootstrapEntryMode, hasMatchListContext } = buildFunctions({
  recentMatches: [],
});

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  }
  ok ? pass++ : fail++;
}

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

check(
  "saved account keeps saved-account entry",
  bootstrapEntryMode({ hasSavedAccount: true, hasStoredSample: true, serverMode: "full" }),
  "saved-account",
);
check(
  "full mode with stored sample still starts logged out so the account can be entered",
  bootstrapEntryMode({ hasSavedAccount: false, hasStoredSample: true, serverMode: "full" }),
  "logged-out",
);
check(
  "readonly mode keeps logged-out entry",
  bootstrapEntryMode({ hasSavedAccount: false, hasStoredSample: true, serverMode: "readonly" }),
  "logged-out",
);
check(
  "protected mode keeps logged-out entry",
  bootstrapEntryMode({ hasSavedAccount: false, hasStoredSample: true, serverMode: "protected" }),
  "logged-out",
);
check(
  "full mode without stored sample keeps logged-out entry",
  bootstrapEntryMode({ hasSavedAccount: false, hasStoredSample: false, serverMode: "full" }),
  "logged-out",
);

check("hasMatchListContext false for empty recent matches", hasMatchListContext(), false);

checkTrue("init awaits health before deciding entry", mainSrc.includes("await loadServerStatus();"));
checkTrue(
  "internal landing sample entry is fully removed",
  !mainSrc.includes("openInternalLandingSample") && !mainSrc.includes("internal-sample"),
);
checkTrue(
  "logged-out entry renders the login overlay",
  mainSrc.includes('setView("LOGGED_OUT")'),
);
checkTrue("back button hides without match list context", mainSrc.includes("dom.backToListBtn.hidden = !hasList;"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
