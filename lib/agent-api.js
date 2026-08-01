"use strict";

const { createMessage } = require("./anthropic-client.js");

const MODEL = "claude-opus-5";
// thinking + 응답 텍스트를 합쳐 제한하는 값이다. Opus 5는 thinking이 기본 on이므로
// 여유를 둔다. 스트리밍이므로 HTTP 타임아웃 걱정 없이 크게 잡을 수 있다.
const MAX_TOKENS = 64000;

function buildRequestBody({ prompt }) {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: "high" },
    messages: [{ role: "user", content: prompt }],
  };
}

async function analyzeWithApi({ agent, prompt, timeoutMs = 300000, signal, createMessageImpl } = {}) {
  // 스펙 결정: API 백엔드에서 Codex 레그는 비활성이다.
  // Codex는 OpenAI CLI이며 Messages API에 대응물이 없다.
  if (agent !== "claude") {
    throw new Error(`agent "${agent}" is not available on the api backend — codex is not available`);
  }

  const call = createMessageImpl ?? createMessage;
  const { text, stopReason } = await call({
    body: buildRequestBody({ prompt }),
    timeoutMs,
    signal,
  });

  // stop_reason은 content를 읽기 전에 분기한다.
  if (stopReason === "refusal") {
    throw new Error("anthropic declined the request (stop_reason: refusal)");
  }
  if (stopReason === "max_tokens") {
    throw new Error("response truncated (stop_reason: max_tokens) — falling back");
  }

  return { text };
}

module.exports = { analyzeWithApi, buildRequestBody, MODEL, MAX_TOKENS };
