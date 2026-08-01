"use strict";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
// 스칼라 fallbacks:"default" 전용 베타. 배열 형식은 -2026-06-01을 쓰며 서로
// 엇갈리면 400이다. 날짜가 최신처럼 보인다고 임의로 바꾸지 말 것.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

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
  const fallbackSwitches = [];
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
      } else if (evt.type === "content_block_start" && evt.content_block?.type === "fallback") {
        // 서버가 거절된 요청을 다른 모델로 넘긴 지점. 전용 SSE 이벤트 타입이
        // 있는 게 아니라 평범한 content_block_start로 온다. 스트리밍에서는
        // usage.iterations를 못 보므로 이 블록이 유일한 "누가 응답했나" 신호다.
        // 이미 받은 텍스트는 무효화되지 않는다 — 중간 전환이면 fallback 모델이
        // 그 부분 텍스트를 이어서 쓰므로 계속 누적하는 것이 맞다.
        fallbackSwitches.push({
          from: evt.content_block.from?.model ?? null,
          to: evt.content_block.to?.model ?? null,
        });
      }
    }
  }

  return { text, stopReason, usage, fallbackSwitches };
}

// 400 본문이 fallback 옵트인 자체를 문제 삼는지 판정한다. 계정에 베타가 없거나
// 파라미터가 아직 안 열린 경우가 여기 해당한다.
function rejectsFallbackOptIn(detail) {
  return /fallback/i.test(String(detail));
}

async function createMessage({
  apiKey = process.env.ANTHROPIC_API_KEY,
  body,
  timeoutMs = 300000,
  signal,
  fetchImpl,
  // 안전 분류기가 요청을 거절하면(HTTP 200 + stop_reason:"refusal") 서버가
  // 알아서 다른 모델로 다시 돌린다. "default"는 거절 카테고리에 따라 대상을
  // 고르므로 모델 목록을 직접 관리할 필요가 없다. null이면 옵트인하지 않는다.
  fallbacks = "default",
} = {}) {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== "function") throw new Error("global fetch is unavailable (Node >= 20 required)");

  let lastError = null;
  let attempt = 0;
  let fallbacksActive = Boolean(fallbacks);
  let downgraded = false;

  while (true) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

    const headers = {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
    };
    // 스트리밍 필수: max_tokens가 커서 비스트리밍이면 HTTP 타임아웃에 걸린다.
    const payload = { ...body, stream: true };
    if (fallbacksActive) {
      // 헤더와 body 필드는 짝이다. 스칼라 "default"는 -2026-07-01을 쓰고,
      // 배열 형식은 -2026-06-01을 쓴다. 엇갈리면 400이므로 함께 붙인다.
      headers["anthropic-beta"] = FALLBACK_BETA;
      payload.fallbacks = fallbacks;
    }

    const response = await doFetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: combined,
    });

    if (response.ok) return readStream(response);

    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message ?? "";
    } catch { /* 본문 파싱 실패 무시 */ }

    lastError = new Error(`anthropic ${response.status}: ${detail}`.trim());

    // 베타가 없는 계정에서 옵트인 때문에 400이 나면 분석 전체가 죽는다.
    // 옵트인을 떼고 한 번만 다시 시도한다. 서버 장애가 아니므로 재시도
    // 예산은 쓰지 않는다.
    if (response.status === 400 && fallbacksActive && !downgraded && rejectsFallbackOptIn(detail)) {
      fallbacksActive = false;
      downgraded = true;
      continue;
    }

    if (!RETRYABLE.has(response.status) || attempt >= MAX_RETRIES) throw lastError;
    await sleep(retryDelayMs(response, attempt));
    attempt += 1;
  }
}

module.exports = { createMessage, parseSseChunk, API_URL, API_VERSION, FALLBACK_BETA };
