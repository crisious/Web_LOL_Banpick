// AGENT_DISABLE_CODEX config regression tests.
//
// Codex should be disabled only by the exact opt-out value "1"; whitespace or
// alternate spellings must not silently switch analysis into Claude-only mode.

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

const parseAgentDisableCodexConfigSource = serverSrc.includes("function parseAgentDisableCodexConfig(")
  ? extractFunctionSource(serverSrc, "parseAgentDisableCodexConfig")
  : [
      "function parseAgentDisableCodexConfig(rawFlag) {",
      "  return String(rawFlag || '').trim() === '1';",
      "}",
    ].join("\n");

const { parseAgentDisableCodexConfig } = new Function(
  `${parseAgentDisableCodexConfigSource}\nreturn { parseAgentDisableCodexConfig };`,
)();

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

check("AGENT_DISABLE_CODEX exact 1 disables Codex",
  parseAgentDisableCodexConfig("1"),
  true);
check("missing AGENT_DISABLE_CODEX keeps Codex enabled",
  parseAgentDisableCodexConfig(undefined),
  false);
check("empty AGENT_DISABLE_CODEX keeps Codex enabled",
  parseAgentDisableCodexConfig(""),
  false);
check("AGENT_DISABLE_CODEX 0 keeps Codex enabled",
  parseAgentDisableCodexConfig("0"),
  false);
check("AGENT_DISABLE_CODEX true keeps Codex enabled",
  parseAgentDisableCodexConfig("true"),
  false);
check("AGENT_DISABLE_CODEX yes keeps Codex enabled",
  parseAgentDisableCodexConfig("yes"),
  false);
check("AGENT_DISABLE_CODEX leading whitespace does not disable Codex",
  parseAgentDisableCodexConfig(" 1"),
  false);
check("AGENT_DISABLE_CODEX trailing whitespace does not disable Codex",
  parseAgentDisableCodexConfig("1 "),
  false);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
