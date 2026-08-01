import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseAgentJson } = require("../../lib/agent-json.js");
const {
  unwrapClaudeStdout,
  unwrapCodexStdout,
  parseExtraCliPathConfig,
} = require("../../lib/agent-cli.js");
const { selectBackend } = require("../../lib/agent-adapter.js");

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

test("parseAgentJson parses plain JSON", () => {
  assert.deepEqual(parseAgentJson('{"a":1}'), { a: 1 });
});

test("parseAgentJson strips ```json fences", () => {
  assert.deepEqual(parseAgentJson('```json\n{"a":1}\n```'), { a: 1 });
});

test("parseAgentJson strips bare ``` fences", () => {
  assert.deepEqual(parseAgentJson('```\n{"a":1}\n```'), { a: 1 });
});

test("parseAgentJson trims surrounding whitespace", () => {
  assert.deepEqual(parseAgentJson('  \n{"a":1}\n  '), { a: 1 });
});

test("parseAgentJson throws on non-JSON", () => {
  assert.throws(() => parseAgentJson("not json"));
});

test("unwrapClaudeStdout unwraps the result field", () => {
  assert.equal(unwrapClaudeStdout('{"result":"  hello  ","x":1}'), "hello");
});

test("unwrapClaudeStdout falls back to raw on non-JSON", () => {
  assert.equal(unwrapClaudeStdout("  plain text  "), "plain text");
});

test("unwrapCodexStdout extracts the last agent_message", () => {
  const jsonl = [
    '{"type":"thread.started","thread_id":"t"}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"first"}}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"second"}}',
    '{"type":"turn.completed"}',
  ].join("\n");
  assert.equal(unwrapCodexStdout(jsonl), "second");
});

test("unwrapCodexStdout ignores unparsable lines", () => {
  const jsonl = 'garbage\n{"type":"item.completed","item":{"type":"agent_message","text":"ok"}}';
  assert.equal(unwrapCodexStdout(jsonl), "ok");
});

test("unwrapCodexStdout falls back to raw when no agent_message", () => {
  assert.equal(unwrapCodexStdout("  nothing here  "), "nothing here");
});

test("parseExtraCliPathConfig splits on the platform delimiter", () => {
  const { delimiter } = require("node:path");
  assert.deepEqual(parseExtraCliPathConfig(`/a${delimiter}/b`), ["/a", "/b"]);
});

// server.js에서 옮겨온 엄격한 동작을 그대로 유지한다. 빈/공백 세그먼트를
// 조용히 버리면 POSIX에서 CWD가 PATH에 섞여 들어간다 —
// 전용 회귀 테스트는 extra-cli-path-config-tests.mjs에 있다.
test("parseExtraCliPathConfig returns [] only for genuinely empty input", () => {
  assert.deepEqual(parseExtraCliPathConfig(""), []);
  assert.deepEqual(parseExtraCliPathConfig(undefined), []);
  assert.deepEqual(parseExtraCliPathConfig(null), []);
});

test("parseExtraCliPathConfig rejects blank and empty segments", () => {
  const { delimiter } = require("node:path");
  assert.throws(() => parseExtraCliPathConfig("   "), /EXTRA_CLI_PATH must be empty/);
  assert.throws(
    () => parseExtraCliPathConfig(`/a${delimiter}${delimiter}/b`),
    /EXTRA_CLI_PATH must be empty/,
  );
});

test("selectBackend accepts cli and api", () => {
  assert.equal(selectBackend("cli"), "cli");
  assert.equal(selectBackend("api"), "api");
  assert.equal(selectBackend("  API  "), "api");
});

test("selectBackend defaults to cli for unset or invalid values", () => {
  assert.equal(selectBackend(undefined), "cli");
  assert.equal(selectBackend(""), "cli");
  assert.equal(selectBackend("sdk"), "cli");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
