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

// server.js의 buildAnalysis는 selectBackend를 호출하지 않고 같은 판정을 인라인한다.
// 23개 소스 추출 테스트가 new Function으로 buildAnalysis를 실행하므로 새 자유
// 변수를 넣을 수 없기 때문이다. 두 표현이 갈라지면 AGENT_BACKEND=api인데도
// Codex 레그가 살아나 매번 실패하는 요청을 날리게 되므로 여기서 고정한다.
test("server.js inline api check agrees with selectBackend", () => {
  const inlineIsApi = (raw) => String(raw ?? "").trim().toLowerCase() === "api";
  for (const raw of [
    undefined, null, "", "   ", "api", "API", "  api  ", "cli", "CLI",
    "sdk", "apix", "ap i", "\tapi\n",
  ]) {
    assert.equal(
      inlineIsApi(raw),
      selectBackend(raw) === "api",
      `disagreement for ${JSON.stringify(raw)}`,
    );
  }
});

// 인라인 판정이 server.js에 실제로 그 형태로 남아 있는지 확인한다.
// 위 테스트는 두 표현의 의미만 비교하므로, 문자열이 바뀌면 조용히 무의미해진다.
test("server.js still computes codexDisabled from AGENT_BACKEND", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");
  assert.match(
    src,
    /String\(process\.env\.AGENT_BACKEND \?\? ""\)\.trim\(\)\.toLowerCase\(\) === "api"/,
    "server.js no longer contains the inline AGENT_BACKEND check this test pins",
  );
});

// api 백엔드에서 다른 모델이 대신 응답했다면 meta로 올라와야 한다. 그러지 않으면
// 운영자가 Opus 5 출력이라고 믿은 채 품질 차이를 해석하게 된다.
const asyncTests = [];
function asyncTest(name, fn) { asyncTests.push([name, fn]); }

asyncTest("analyzeWithAgent carries fallback switches into meta on the api backend", async () => {
  const saved = process.env.AGENT_BACKEND;
  process.env.AGENT_BACKEND = "api";
  const { analyzeWithApi } = require("../../lib/agent-api.js");
  const original = analyzeWithApi;
  try {
    const api = require("../../lib/agent-api.js");
    api.analyzeWithApi = async () => ({
      text: "{}",
      fallbackSwitches: [{ from: "claude-opus-5", to: "claude-opus-4-8" }],
    });
    const { analyzeWithAgent } = require("../../lib/agent-adapter.js");
    const out = await analyzeWithAgent({ agent: "claude", prompt: "p" });
    assert.equal(out.meta.backend, "api");
    assert.deepEqual(out.meta.fallbackSwitches, [{ from: "claude-opus-5", to: "claude-opus-4-8" }]);
  } finally {
    require("../../lib/agent-api.js").analyzeWithApi = original;
    if (saved === undefined) delete process.env.AGENT_BACKEND;
    else process.env.AGENT_BACKEND = saved;
  }
});

asyncTest("analyzeWithAgent reports an empty switch list on the cli backend", async () => {
  const saved = process.env.AGENT_BACKEND;
  delete process.env.AGENT_BACKEND;
  const cli = require("../../lib/agent-cli.js");
  const original = cli.analyzeWithCli;
  try {
    cli.analyzeWithCli = async () => ({ text: "{}" });
    const { analyzeWithAgent } = require("../../lib/agent-adapter.js");
    const out = await analyzeWithAgent({ agent: "claude", prompt: "p" });
    assert.equal(out.meta.backend, "cli");
    assert.deepEqual(out.meta.fallbackSwitches, []);
  } finally {
    cli.analyzeWithCli = original;
    if (saved === undefined) delete process.env.AGENT_BACKEND;
    else process.env.AGENT_BACKEND = saved;
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
