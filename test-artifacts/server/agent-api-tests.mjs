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

test("buildRequestBody attaches the json_schema format by default", () => {
  const body = buildRequestBody({ prompt: "hi" });
  assert.equal(body.output_config.format.type, "json_schema");
  assert.equal(body.output_config.format.schema.type, "object");
});

test("buildRequestBody omits the format when structured is false", () => {
  const body = buildRequestBody({ prompt: "hi", structured: false });
  assert.equal(body.output_config.format, undefined);
});

// 구조화 출력을 켜도 프롬프트가 요구하는 필드가 스키마에서 막히면 안 된다.
// additionalProperties:false가 teamplayRecommendationSelections를 금지하면
// teamplay v2 코칭 선택 경로가 통째로 죽는다.
test("the attached schema permits every key the prompt asks for", () => {
  const { schema } = buildRequestBody({ prompt: "hi" }).output_config.format;
  for (const field of [
    "schemaVersion", "analysisMeta", "matchSummary", "coachSummary",
    "phaseSummaries", "strengths", "weaknesses", "actionChecklist",
    "keyMoments", "evidenceIndex", "combatAnalysis",
    "teamfightPhaseAnalysis", "teamplayRecommendationSelections",
  ]) {
    assert.ok(field in schema.properties, `prompt asks for ${field} but the schema forbids it`);
  }
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
