import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  analyzeWithApi,
  buildRequestBody,
  parseDisableApiFallbackConfig,
} = require("../../lib/agent-api.js");

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

// AGENT_DISABLE_CODEX와 같은 정확 일치 규칙 — "1"만 끈다.
test("parseDisableApiFallbackConfig only accepts an exact 1", () => {
  assert.equal(parseDisableApiFallbackConfig("1"), true);
  assert.equal(parseDisableApiFallbackConfig(undefined), false);
  assert.equal(parseDisableApiFallbackConfig(""), false);
  assert.equal(parseDisableApiFallbackConfig("0"), false);
  assert.equal(parseDisableApiFallbackConfig("true"), false);
  assert.equal(parseDisableApiFallbackConfig(" 1"), false);
});

asyncTest("analyzeWithApi opts into fallbacks by default", async () => {
  let seen;
  const saved = process.env.AGENT_DISABLE_API_FALLBACK;
  delete process.env.AGENT_DISABLE_API_FALLBACK;
  try {
    await analyzeWithApi({
      agent: "claude", prompt: "p",
      createMessageImpl: async (args) => { seen = args; return { text: "{}", stopReason: "end_turn" }; },
    });
  } finally {
    if (saved === undefined) delete process.env.AGENT_DISABLE_API_FALLBACK;
    else process.env.AGENT_DISABLE_API_FALLBACK = saved;
  }
  assert.equal(seen.fallbacks, "default");
});

asyncTest("analyzeWithApi disables fallbacks when AGENT_DISABLE_API_FALLBACK=1", async () => {
  let seen;
  const saved = process.env.AGENT_DISABLE_API_FALLBACK;
  process.env.AGENT_DISABLE_API_FALLBACK = "1";
  try {
    await analyzeWithApi({
      agent: "claude", prompt: "p",
      createMessageImpl: async (args) => { seen = args; return { text: "{}", stopReason: "end_turn" }; },
    });
  } finally {
    if (saved === undefined) delete process.env.AGENT_DISABLE_API_FALLBACK;
    else process.env.AGENT_DISABLE_API_FALLBACK = saved;
  }
  assert.equal(seen.fallbacks, null);
});

// 다른 모델이 대신 응답했다는 사실은 호출자에게 올라가야 한다.
asyncTest("analyzeWithApi surfaces fallback switch points", async () => {
  const out = await analyzeWithApi({
    agent: "claude", prompt: "p",
    createMessageImpl: async () => ({
      text: "{}", stopReason: "end_turn",
      fallbackSwitches: [{ from: "claude-opus-5", to: "claude-opus-4-8" }],
    }),
  });
  assert.deepEqual(out.fallbackSwitches, [{ from: "claude-opus-5", to: "claude-opus-4-8" }]);
});

asyncTest("analyzeWithApi reports an empty switch list when none occurred", async () => {
  const out = await analyzeWithApi({
    agent: "claude", prompt: "p",
    createMessageImpl: async () => ({ text: "{}", stopReason: "end_turn" }),
  });
  assert.deepEqual(out.fallbackSwitches, []);
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
