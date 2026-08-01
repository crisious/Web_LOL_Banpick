import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseAgentJson } = require("../../lib/agent-json.js");

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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
