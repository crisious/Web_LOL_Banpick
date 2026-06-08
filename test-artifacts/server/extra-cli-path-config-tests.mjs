// EXTRA_CLI_PATH config regression tests.
//
// Extra CLI lookup paths should be explicit path segments only. Empty PATH
// segments can make the current working directory part of PATH on POSIX shells,
// so accidental leading/trailing/double delimiters must fail before spawning AI
// CLI subprocesses.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const parseExtraCliPathConfigSource = serverSrc.includes("function parseExtraCliPathConfig(")
  ? extractFunctionSource(serverSrc, "parseExtraCliPathConfig")
  : [
      "function parseExtraCliPathConfig(rawPath, delimiter = ':') {",
      "  return rawPath ? String(rawPath).split(delimiter) : [];",
      "}",
    ].join("\n");

const { parseExtraCliPathConfig } = new Function(
  `${parseExtraCliPathConfigSource}\nreturn { parseExtraCliPathConfig };`,
)();

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
