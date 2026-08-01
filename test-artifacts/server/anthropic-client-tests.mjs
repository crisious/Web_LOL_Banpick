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

// ─── 서버사이드 refusal fallback ────────────────────────────────────────────
//
// Opus 5의 안전 분류기는 요청을 거절할 수 있고(HTTP 200 + stop_reason:"refusal"),
// 양성 요청도 오탐될 수 있다. fallbacks 옵트인은 거절된 요청을 서버측에서 다른
// 모델로 다시 돌린다. 베타 헤더와 body 필드는 짝이라 한쪽만 보내면 400이다.

// init을 붙잡아 요청 모양을 검증하는 fetch.
function capturingFetch({ sseLines = SSE_OK, onCall } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const canned = onCall?.(calls.length);
    if (canned) return canned;
    return fakeFetch({ sseLines })();
  };
  impl.calls = calls;
  return impl;
}

function rejects400(message) {
  return {
    ok: false, status: 400,
    headers: { get: () => null },
    json: async () => ({ error: { message } }),
  };
}

asyncTest("createMessage opts into server-side fallbacks by default", async () => {
  const impl = capturingFetch();
  await createMessage({
    apiKey: "k",
    body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
    fetchImpl: impl,
  });
  assert.equal(impl.calls.length, 1);
  assert.equal(impl.calls[0].init.headers["anthropic-beta"], "server-side-fallback-2026-07-01");
  assert.equal(impl.calls[0].body.fallbacks, "default");
});

asyncTest("createMessage omits the fallback opt-in when disabled", async () => {
  const impl = capturingFetch();
  await createMessage({
    apiKey: "k",
    body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
    fallbacks: null,
    fetchImpl: impl,
  });
  assert.equal(impl.calls[0].init.headers["anthropic-beta"], undefined);
  assert.equal("fallbacks" in impl.calls[0].body, false);
});

asyncTest("createMessage reports fallback switch points from the stream", async () => {
  const out = await createMessage({
    apiKey: "k",
    body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
    fetchImpl: fakeFetch({
      sseLines: [
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"fallback","from":{"model":"claude-opus-5"},"to":{"model":"claude-opus-4-8"}}}\n\n',
        ...SSE_OK,
      ],
    }),
  });
  assert.deepEqual(out.fallbackSwitches, [{ from: "claude-opus-5", to: "claude-opus-4-8" }]);
  assert.equal(out.text, "Hello");
});

asyncTest("createMessage reports no switch when the primary model served", async () => {
  const out = await createMessage({
    apiKey: "k",
    body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
    fetchImpl: fakeFetch({ sseLines: SSE_OK }),
  });
  assert.deepEqual(out.fallbackSwitches, []);
});

// 이 레포는 실제 API를 테스트에서 부르지 않으므로 베타 가용 여부를 알 수 없다.
// 계정에 베타가 없으면 400이 나고 api 백엔드가 통째로 죽으므로, 옵트인을 떼고
// 한 번 다시 시도해 스스로 낫는다.
asyncTest("createMessage drops the opt-in and retries when the beta is rejected", async () => {
  const impl = capturingFetch({
    onCall: (n) => (n === 1 ? rejects400("fallbacks: unsupported beta parameter") : null),
  });
  const out = await createMessage({
    apiKey: "k",
    body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
    fetchImpl: impl,
  });
  assert.equal(impl.calls.length, 2);
  assert.equal(impl.calls[1].init.headers["anthropic-beta"], undefined);
  assert.equal("fallbacks" in impl.calls[1].body, false);
  assert.equal(out.text, "Hello");
});

asyncTest("createMessage downgrades at most once", async () => {
  const impl = capturingFetch({ onCall: () => rejects400("fallbacks are not enabled") });
  await assert.rejects(
    () => createMessage({
      apiKey: "k",
      body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
      fetchImpl: impl,
    }),
    /400/,
  );
  assert.equal(impl.calls.length, 2);
});

asyncTest("createMessage does not downgrade on an unrelated 400", async () => {
  const impl = capturingFetch({ onCall: () => rejects400("messages: must not be empty") });
  await assert.rejects(
    () => createMessage({
      apiKey: "k",
      body: { model: "claude-opus-5", max_tokens: 100, messages: [] },
      fetchImpl: impl,
    }),
    /400/,
  );
  assert.equal(impl.calls.length, 1);
});

// 강등은 재시도 예산을 쓰지 않아야 한다 — 베타 미가용은 서버 장애가 아니다.
asyncTest("the fallback downgrade does not consume a 5xx retry", async () => {
  let n = 0;
  const impl = async () => {
    n += 1;
    if (n === 1) return rejects400("fallbacks: unknown field");
    if (n <= 3) {
      return {
        ok: false, status: 503,
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
  // 1 강등 + 503 두 번 + 성공 = 4회. 강등이 예산을 먹었다면 3회째에 throw했을 것.
  assert.equal(n, 4);
  assert.equal(out.text, "Hello");
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
