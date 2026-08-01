"use strict";

// 모델 응답 텍스트에서 코드펜스를 제거하고 JSON으로 파싱한다.
// server.js의 callClaudeAgent / callCodexAgent가 각자 갖고 있던 로직을 통합.
function parseAgentJson(text) {
  let body = String(text ?? "").trim();
  if (body.startsWith("```")) {
    body = body.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return JSON.parse(body);
}

module.exports = { parseAgentJson };
