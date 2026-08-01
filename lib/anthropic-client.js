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

module.exports = { parseSseChunk, API_URL, API_VERSION };
