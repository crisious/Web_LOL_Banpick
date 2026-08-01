"use strict";

const path = require("node:path");
const { spawn } = require("node:child_process");
const { parseAgentJson } = require("./agent-json.js");

// EXTRA_CLI_PATH를 delimiter로 분해. server.js에서 동작 그대로 이동.
//
// 빈/공백/제어문자 세그먼트를 조용히 버리지 않고 throw하는 것이 핵심이다.
// POSIX에서 빈 PATH 세그먼트(`/a::/b`, 선행/후행 구분자)는 현재 작업 디렉터리를
// 의미하므로, CWD에 심어둔 가짜 `claude`/`codex` 실행 파일이 잡힐 수 있다.
// AI CLI subprocess를 spawn하기 전에 실패해야 한다.
function parseExtraCliPathConfig(rawPath, delimiter = path.delimiter) {
  const value = rawPath === undefined || rawPath === null ? "" : String(rawPath);
  if (value === "") {
    return [];
  }
  const segments = value.split(delimiter);
  if (
    segments.some((segment) =>
      segment === "" ||
      segment.trim() !== segment ||
      /[\u0000-\u001F\u007F]/u.test(segment)
    )
  ) {
    throw new Error("EXTRA_CLI_PATH must be empty or a delimiter-separated list of non-empty paths without leading/trailing whitespace or control characters.");
  }
  return segments;
}

// subprocess에서 CLI를 찾을 수 있도록 PATH 보강 (node 프로세스는 shell PATH 미상속 가능)
// path.delimiter로 cross-platform 안전 (unix `:`, win32 `;`)
const AUGMENTED_PATH = [
  process.env.PATH,
  // unix-only 표준 위치
  process.platform !== "win32" && "/opt/homebrew/bin",
  process.platform !== "win32" && "/usr/local/bin",
  // 사용자 home의 .local/bin — claude/codex CLI는 보통 여기로 설치됨
  process.env.HOME && `${process.env.HOME}/.local/bin`,
  process.env.USERPROFILE && `${process.env.USERPROFILE}\\.local\\bin`,
  // codex CLI sandbox 변종 (win32) — Windows 설치 시 기본 위치
  process.env.USERPROFILE && `${process.env.USERPROFILE}\\.codex\\.sandbox-bin`,
  // 옵션: .env의 EXTRA_CLI_PATH로 추가 경로 지정 가능 (path.delimiter 구분)
  ...parseExtraCliPathConfig(process.env.EXTRA_CLI_PATH),
].filter(Boolean).join(path.delimiter);

function runCli(args, stdinText, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    const env = { ...process.env, PATH: AUGMENTED_PATH };
    const proc = spawn(args[0], args.slice(1), { stdio: ["pipe", "pipe", "pipe"], env });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (c) => { stdout += c; });
    proc.stderr.on("data", (c) => { stderr += c; });
    proc.stdin.on("error", () => {}); // EPIPE 억제

    const timer = setTimeout(() => {
      proc.kill();
      settle(reject, new Error(`timeout: ${args[0]}`));
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        // Phase 30: 일부 CLI(특히 codex)는 stderr는 비워두고 stdout JSONL에
        // turn.failed 형태로 에러를 출력. 빈 stderr면 stdout tail도 포함.
        const tail = stderr.trim() || stdout.trim().slice(-300);
        settle(reject, new Error(`${args[0]} exited ${code}: ${tail.slice(0, 300)}`));
        return;
      }
      settle(resolve, stdout);
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      const msg = err.code === "ENOENT" ? `${args[0]} CLI not found in PATH` : err.message;
      settle(reject, new Error(msg));
    });

    proc.stdin.write(stdinText, "utf8");
    proc.stdin.end();
  });
}

// claude --print --output-format json → { result: "...", ... }
function unwrapClaudeStdout(raw) {
  try {
    const wrapper = JSON.parse(raw);
    return String(wrapper.result ?? raw).trim();
  } catch {
    return String(raw).trim();
  }
}

// codex --json → JSONL. item.completed / agent_message 에서 text 추출 (실측 포맷 기준).
// JSONL에서 추출 실패 시 raw 전체 시도.
function unwrapCodexStdout(raw) {
  let text = "";
  for (const line of String(raw).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const evt = JSON.parse(trimmed);
      if (evt.type === "item.completed" && evt.item?.type === "agent_message") {
        text = evt.item.text ?? "";
      }
    } catch { /* 파싱 불가 줄 무시 */ }
  }
  if (!text) text = raw;
  return String(text).trim();
}

const CLI_ARGV = {
  claude: ["claude", "--print", "--output-format", "json"],
  // codex exec - : stdin으로 프롬프트 전달 / --json: JSONL 이벤트 스트림
  // --ephemeral : 세션 저장 없음 / -s read-only : 파일시스템 조작 차단
  // --color never: ANSI 코드 제거
  codex: ["codex", "exec", "-", "--json", "--ephemeral", "-s", "read-only", "--color", "never"],
};

async function analyzeWithCli({ agent, prompt, timeoutMs }) {
  const argv = CLI_ARGV[agent];
  if (!argv) throw new Error(`unknown agent: ${agent}`);
  const raw = await runCli(argv, prompt, timeoutMs);
  const text = agent === "claude" ? unwrapClaudeStdout(raw) : unwrapCodexStdout(raw);
  return { text };
}

module.exports = {
  analyzeWithCli,
  runCli,
  parseExtraCliPathConfig,
  unwrapClaudeStdout,
  unwrapCodexStdout,
  AUGMENTED_PATH,
  parseAgentJson,
};
