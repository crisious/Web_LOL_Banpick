"use strict";

const { createMessage } = require("./anthropic-client.js");
const { ANALYSIS_OUTPUT_SCHEMA } = require("./analysis-json-schema.js");

const MODEL = "claude-opus-5";
// thinking + 응답 텍스트를 합쳐 제한하는 값이다. Opus 5는 thinking이 기본 on이므로
// 여유를 둔다. 스트리밍이므로 HTTP 타임아웃 걱정 없이 크게 잡을 수 있다.
const MAX_TOKENS = 64000;

// AGENT_DISABLE_API_FALLBACK=1이면 서버사이드 refusal fallback을 끈다.
// AGENT_DISABLE_CODEX와 같은 정확 일치 규칙 — 오타나 " 1"은 켜진 상태로 둔다.
//
// 끄고 싶을 만한 이유: fallback 모델은 자기 요율로 별도 과금되고, 다른 모델이
// 조용히 대신 응답하는 것 자체를 원치 않을 수 있다. 베타 미가용은 이 스위치가
// 아니라 anthropic-client의 자동 강등이 처리한다.
function parseDisableApiFallbackConfig(rawFlag) {
  return String(rawFlag || "") === "1";
}

function buildRequestBody({ prompt, structured = true }) {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: "high" },
    messages: [{ role: "user", content: prompt }],
  };
  if (structured) {
    body.output_config.format = { type: "json_schema", schema: ANALYSIS_OUTPUT_SCHEMA };
  }
  return body;
}

async function analyzeWithApi({ agent, prompt, timeoutMs = 300000, signal, createMessageImpl, structured } = {}) {
  // 스펙 결정: API 백엔드에서 Codex 레그는 비활성이다.
  // Codex는 OpenAI CLI이며 Messages API에 대응물이 없다.
  if (agent !== "claude") {
    throw new Error(`agent "${agent}" is not available on the api backend — codex is not available`);
  }

  const call = createMessageImpl ?? createMessage;
  const { text, stopReason, fallbackSwitches } = await call({
    body: buildRequestBody({ prompt, structured }),
    timeoutMs,
    signal,
    fallbacks: parseDisableApiFallbackConfig(process.env.AGENT_DISABLE_API_FALLBACK)
      ? null
      : "default",
  });

  // stop_reason은 content를 읽기 전에 분기한다.
  // fallbacks를 켰다면 여기까지 온 refusal은 체인 전체가 거절했다는 뜻이다.
  if (stopReason === "refusal") {
    throw new Error("anthropic declined the request (stop_reason: refusal)");
  }
  if (stopReason === "max_tokens") {
    throw new Error("response truncated (stop_reason: max_tokens) — falling back");
  }

  return { text, fallbackSwitches: fallbackSwitches ?? [] };
}

module.exports = {
  analyzeWithApi,
  buildRequestBody,
  parseDisableApiFallbackConfig,
  MODEL,
  MAX_TOKENS,
};
