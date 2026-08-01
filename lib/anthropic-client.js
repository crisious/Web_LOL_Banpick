"use strict";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// SSE 버퍼에서 완성된 이벤트만 뽑고 미완성 꼬리를 남긴다.
// 반환: { events: object[], rest: string }
function parseSseChunk(buffer) {
  const events = [];
  const parts = String(buffer).split("\n\n");
  const rest = parts.pop() ?? "";

  for (const part of parts) {
    for (const line of part.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        events.push(JSON.parse(payload));
      } catch { /* 파싱 불가 이벤트 무시 */ }
    }
  }

  return { events, rest };
}

const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// retry-after(초) 우선, 없으면 지수 백오프.
function retryDelayMs(response, attempt) {
  const header = response.headers?.get?.("retry-after");
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return 500 * 2 ** attempt;
}

async function readStream(response) {
  let buffer = "";
  let text = "";
  let stopReason = null;
  let usage = {};
  const decoder = new TextDecoder();

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const { events, rest } = parseSseChunk(buffer);
    buffer = rest;

    for (const evt of events) {
      if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
        // thinking_delta는 의도적으로 무시한다 — Opus 5는 thinking이 기본 on이고
        // display 기본값이 "omitted"라 내용도 비어 있다.
        text += evt.delta.text ?? "";
      } else if (evt.type === "message_delta") {
        if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
        if (evt.usage) usage = { ...usage, ...evt.usage };
      } else if (evt.type === "message_start" && evt.message?.usage) {
        usage = { ...usage, ...evt.message.usage };
      }
    }
  }

  return { text, stopReason, usage };
}

async function createMessage({
  apiKey = process.env.ANTHROPIC_API_KEY,
  body,
  timeoutMs = 300000,
  signal,
  fetchImpl,
} = {}) {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== "function") throw new Error("global fetch is unavailable (Node >= 20 required)");

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

    const response = await doFetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      // 스트리밍 필수: max_tokens가 커서 비스트리밍이면 HTTP 타임아웃에 걸린다.
      body: JSON.stringify({ ...body, stream: true }),
      signal: combined,
    });

    if (response.ok) return readStream(response);

    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message ?? "";
    } catch { /* 본문 파싱 실패 무시 */ }

    lastError = new Error(`anthropic ${response.status}: ${detail}`.trim());

    if (!RETRYABLE.has(response.status) || attempt === MAX_RETRIES) throw lastError;
    await sleep(retryDelayMs(response, attempt));
  }

  throw lastError;
}

module.exports = { createMessage, parseSseChunk, API_URL, API_VERSION };
