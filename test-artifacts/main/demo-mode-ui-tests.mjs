// Read-only external demo UI contract tests.
//
// The server already blocks live Riot endpoints in PUBLIC_DEMO_MODE=readonly.
// These tests keep the client aligned so the rendered UI does not invite a
// live lookup that will inevitably fail.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const serverModeUiSrc = extractFunctionSource(mainSrc, "serverModeUi");
const { serverModeUi } = new Function(`${serverModeUiSrc}\nreturn { serverModeUi };`)();
const nonRetryablePublicDemoMessageSrc = extractFunctionSource(mainSrc, "isNonRetryablePublicDemoMessage");
const formatRetryMessageSrc = extractFunctionSource(mainSrc, "formatRetryMessage");
const { formatRetryMessage } = new Function(`${nonRetryablePublicDemoMessageSrc}\n${formatRetryMessageSrc}\nreturn { formatRetryMessage };`)();

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

check("readonly mode marks live controls as locked",
  serverModeUi({ readonly: true }).lockLiveControls,
  true);

check("readonly mode tells user to use stored samples",
  serverModeUi({ readonly: true }).liveControlMessage,
  "외부 데모 모드에서는 Riot ID 조회가 잠겨 있습니다. 저장 샘플을 열어 분석 리포트를 확인하세요.");

check("full mode keeps live controls available",
  serverModeUi({ readonly: false, protected: false }).lockLiveControls,
  false);

check("protected mode keeps live controls available for token-gated use",
  serverModeUi({ readonly: false, protected: true }).lockLiveControls,
  false);

check("readonly demo block message is not presented as retryable",
  formatRetryMessage(new Error("외부 데모 모드에서는 라이브 Riot API/샘플 생성 기능이 비활성화되어 있습니다.")),
  "외부 데모 모드에서는 라이브 Riot API/샘플 생성 기능이 비활성화되어 있습니다.");

check("generic lookup errors still include retry hint",
  formatRetryMessage(new Error("네트워크 연결이 불안정합니다.")),
  "네트워크 연결이 불안정합니다. 잠시 후 다시 시도하세요.");

check("blank error messages fall back to unknown error copy",
  formatRetryMessage({ message: "   " }),
  "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도하세요.");

check("already actionable retry messages are not duplicated",
  formatRetryMessage(new Error("샘플 생성이 이미 진행 중입니다. 잠시 후 다시 시도하세요.")),
  "샘플 생성이 이미 진행 중입니다. 잠시 후 다시 시도하세요.");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
