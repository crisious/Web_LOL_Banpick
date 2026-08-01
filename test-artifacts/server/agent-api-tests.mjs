import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { analyzeWithApi, buildRequestBody } = require("../../lib/agent-api.js");

let pass = 0;
let fail = 0;
const asyncTests = [];
function asyncTest(name, fn) { asyncTests.push([name, fn]); }

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

test("buildRequestBody targets claude-opus-5 with streaming-safe max_tokens", () => {
  const body = buildRequestBody({ prompt: "hi" });
  assert.equal(body.model, "claude-opus-5");
  assert.equal(body.max_tokens, 64000);
  assert.equal(body.output_config.effort, "high");
  assert.deepEqual(body.messages, [{ role: "user", content: "hi" }]);
});

asyncTest("analyzeWithApi returns the accumulated text", async () => {
  const out = await analyzeWithApi({
    agent: "claude",
    prompt: "p",
    createMessageImpl: async () => ({ text: '{"a":1}', stopReason: "end_turn", usage: {} }),
  });
  assert.equal(out.text, '{"a":1}');
});

asyncTest("analyzeWithApi rejects the codex agent", async () => {
  await assert.rejects(
    () => analyzeWithApi({ agent: "codex", prompt: "p", createMessageImpl: async () => ({}) }),
    /codex is not available/,
  );
});

asyncTest("analyzeWithApi throws on refusal", async () => {
  await assert.rejects(
    () => analyzeWithApi({
      agent: "claude", prompt: "p",
      createMessageImpl: async () => ({ text: "", stopReason: "refusal", usage: {} }),
    }),
    /refusal/,
  );
});

asyncTest("analyzeWithApi throws on max_tokens truncation", async () => {
  await assert.rejects(
    () => analyzeWithApi({
      agent: "claude", prompt: "p",
      createMessageImpl: async () => ({ text: "partial", stopReason: "max_tokens", usage: {} }),
    }),
    /max_tokens/,
  );
});

for (const [name, fn] of asyncTests) {
  try {
    await fn();
    pass += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
