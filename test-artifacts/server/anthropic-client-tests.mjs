import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseSseChunk, createMessage } = require("../../lib/anthropic-client.js");

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === "function") throw new Error("use asyncTest for async");
    pass += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

const asyncTests = [];
function asyncTest(name, fn) { asyncTests.push([name, fn]); }

// SSE 본문을 흘려주는 가짜 fetch. 실제 네트워크를 쓰지 않는다.
function fakeFetch({ status = 200, sseLines = [], headers = {}, jsonBody = null }) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    json: async () => jsonBody ?? {},
    body: {
      async *[Symbol.asyncIterator]() {
        const enc = new TextEncoder();
        for (const line of sseLines) yield enc.encode(line);
      },
    },
  });
}

const SSE_OK = [
  'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\n\n',
  'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}\n\n',
];

asyncTest("createMessage accumulates text_delta into text", async () => {
  const out = await createMessage({
    apiKey: "test-key",
    body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
    fetchImpl: fakeFetch({ sseLines: SSE_OK }),
  });
  assert.equal(out.text, "Hello");
  assert.equal(out.stopReason, "end_turn");
});

asyncTest("createMessage surfaces refusal as stopReason", async () => {
  const out = await createMessage({
    apiKey: "k",
    body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
    fetchImpl: fakeFetch({
      sseLines: [
        'data: {"type":"message_delta","delta":{"stop_reason":"refusal"}}\n\n',
      ],
    }),
  });
  assert.equal(out.stopReason, "refusal");
  assert.equal(out.text, "");
});

asyncTest("createMessage retries on 429 and honors retry-after", async () => {
  let calls = 0;
  const impl = async () => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false, status: 429,
        headers: { get: (k) => (k.toLowerCase() === "retry-after" ? "0" : null) },
        json: async () => ({}),
      };
    }
    return fakeFetch({ sseLines: SSE_OK })();
  };
  const out = await createMessage({
    apiKey: "k",
    body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
    fetchImpl: impl,
  });
  assert.equal(calls, 2);
  assert.equal(out.text, "Hello");
});

asyncTest("createMessage does not retry on 400", async () => {
  let calls = 0;
  const impl = async () => {
    calls += 1;
    return {
      ok: false, status: 400,
      headers: { get: () => null },
      json: async () => ({ error: { message: "bad request" } }),
    };
  };
  await assert.rejects(
    () => createMessage({
      apiKey: "k",
      body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
      fetchImpl: impl,
    }),
    /400/,
  );
  assert.equal(calls, 1);
});

asyncTest("createMessage throws when apiKey is missing", async () => {
  await assert.rejects(
    () => createMessage({ body: { model: "claude-opus-5", max_tokens: 1, messages: [] } }),
    /ANTHROPIC_API_KEY/,
  );
});

asyncTest("createMessage aborts when the timeout elapses", async () => {
  // fetch가 signal.abort를 존중하는지 검증한다. 실제 네트워크는 쓰지 않는다.
  //
  // held 타이머가 필요한 이유: AbortSignal.timeout()의 내부 타이머는 unref'd라
  // 이벤트 루프를 살려두지 않는다(의도된 설계 — 대기 중인 타임아웃이 프로세스
  // 종료를 막으면 안 되므로). 실제 fetch는 소켓 핸들을 잡아 루프를 살려두지만
  // 이 가짜 fetch는 아무 핸들도 만들지 않으므로, ref된 핸들이 0개가 되어
  // 타임아웃이 발동하기 전에 루프가 고갈되고 Node가 exit 13으로 죽는다.
  // 가짜도 실제 소켓처럼 루프를 잡아야 실제 동작을 재현한다.
  const impl = (url, init) =>
    new Promise((resolve, reject) => {
      const held = setTimeout(() => {}, 60000);
      init.signal.addEventListener("abort", () => {
        clearTimeout(held);
        reject(init.signal.reason);
      }, { once: true });
      // 응답을 영원히 주지 않는다 → 타임아웃만이 이 프라미스를 끝낼 수 있다.
    });
  await assert.rejects(
    () => createMessage({
      apiKey: "k",
      body: { model: "claude-opus-5", max_tokens: 1, messages: [] },
      timeoutMs: 30,
      fetchImpl: impl,
    }),
  );
});

asyncTest("createMessage aborts when an external signal fires", async () => {
  const controller = new AbortController();
  const impl = (url, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
      setTimeout(() => controller.abort(new Error("caller aborted")), 10);
    });
  await assert.rejects(
    () => createMessage({
      apiKey: "k",
      body: { model: "claude-opus-5", max_tokens: 1, messages: [] },
      timeoutMs: 60000,
      signal: controller.signal,
      fetchImpl: impl,
    }),
  );
});

test("parseSseChunk extracts complete events and keeps the remainder", () => {
  const buf = 'event: a\ndata: {"x":1}\n\nevent: b\ndata: {"y":2}\n\ndata: partial';
  const { events, rest } = parseSseChunk(buf);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { x: 1 });
  assert.deepEqual(events[1], { y: 2 });
  assert.equal(rest, "data: partial");
});

test("parseSseChunk returns no events when nothing is complete", () => {
  const { events, rest } = parseSseChunk('data: {"x"');
  assert.equal(events.length, 0);
  assert.equal(rest, 'data: {"x"');
});

test("parseSseChunk skips unparsable data lines", () => {
  const { events } = parseSseChunk("data: not-json\n\n");
  assert.equal(events.length, 0);
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
