// EXTRA_CLI_PATH config regression tests.
//
// Extra CLI lookup paths should be explicit path segments only. Empty PATH
// segments can make the current working directory part of PATH on POSIX shells,
// so accidental leading/trailing/double delimiters must fail before spawning AI
// CLI subprocesses.

// 2026-08: parseExtraCliPathConfig가 server.js에서 lib/agent-cli.js로 이동했다.
// 이전에는 server.js 소스를 문자열로 읽어 new Function으로 재구성했는데, 함수가
// 사라지면 관대한 스텁으로 조용히 폴백해 아래 throw 검증 9건이 전부 무의미해졌다.
// 실제 모듈을 require해 그 배선 함정을 없앤다.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseExtraCliPathConfig } = require("../../lib/agent-cli.js");

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkThrows(label, fn, expectedMessage) {
  let error = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  const ok = error?.message === expectedMessage;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`  expected throw ${JSON.stringify(expectedMessage)}\n  got            ${JSON.stringify(error?.message || null)}`);
  }
  ok ? pass++ : fail++;
}

const extraCliPathError = "EXTRA_CLI_PATH must be empty or a delimiter-separated list of non-empty paths without leading/trailing whitespace or control characters.";

check("missing EXTRA_CLI_PATH adds no entries",
  parseExtraCliPathConfig(undefined, ":"),
  []);
check("empty EXTRA_CLI_PATH adds no entries",
  parseExtraCliPathConfig("", ":"),
  []);
check("single EXTRA_CLI_PATH entry is preserved",
  parseExtraCliPathConfig("/opt/cli/bin", ":"),
  ["/opt/cli/bin"]);
check("multiple EXTRA_CLI_PATH entries are preserved",
  parseExtraCliPathConfig("/opt/cli/bin:/srv/tools/bin", ":"),
  ["/opt/cli/bin", "/srv/tools/bin"]);
check("internal path spaces are preserved",
  parseExtraCliPathConfig("/Applications/Claude Code/bin:/Users/me/Tools Folder/bin", ":"),
  ["/Applications/Claude Code/bin", "/Users/me/Tools Folder/bin"]);
check("custom delimiter is supported",
  parseExtraCliPathConfig("C:\\Tools\\codex\\bin;D:\\Claude\\bin", ";"),
  ["C:\\Tools\\codex\\bin", "D:\\Claude\\bin"]);

for (const [label, rawPath, delimiter] of [
  ["leading delimiter is rejected", ":/opt/cli/bin", ":"],
  ["trailing delimiter is rejected", "/opt/cli/bin:", ":"],
  ["double delimiter is rejected", "/opt/cli/bin::/srv/tools/bin", ":"],
  ["leading whitespace segment is rejected", " /opt/cli/bin", ":"],
  ["trailing whitespace segment is rejected", "/opt/cli/bin ", ":"],
  ["tab segment is rejected", "/opt/cli\tbin", ":"],
  ["newline segment is rejected", "/opt/cli\nbin", ":"],
  ["windows leading delimiter is rejected", ";C:\\Tools\\codex\\bin", ";"],
  ["windows double delimiter is rejected", "C:\\Tools\\codex\\bin;;D:\\Claude\\bin", ";"],
]) {
  checkThrows(label, () => parseExtraCliPathConfig(rawPath, delimiter), extraCliPathError);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
