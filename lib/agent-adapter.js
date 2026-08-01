"use strict";

const { analyzeWithCli } = require("./agent-cli.js");

const VALID_BACKENDS = new Set(["cli", "api"]);

// AGENT_BACKEND=cli|api. 미설정/오타는 cli로 떨어뜨려 기존 동작을 보존한다.
function selectBackend(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  return VALID_BACKENDS.has(value) ? value : "cli";
}

async function analyzeWithAgent({ agent, prompt, timeoutMs = 300000, signal } = {}) {
  const backend = selectBackend(process.env.AGENT_BACKEND);
  const startedAt = Date.now();

  let result;
  if (backend === "api") {
    const { analyzeWithApi } = require("./agent-api.js");
    result = await analyzeWithApi({ agent, prompt, timeoutMs, signal });
  } else {
    // cli 백엔드는 signal을 무시한다 — runCli에 signal 지원이 없고,
    // 이 추출은 동작 불변 리팩터이므로 여기서 추가하지 않는다.
    result = await analyzeWithCli({ agent, prompt, timeoutMs, signal });
  }

  return {
    text: result.text,
    meta: { backend, agent, durationMs: Date.now() - startedAt },
  };
}

module.exports = { analyzeWithAgent, selectBackend };
