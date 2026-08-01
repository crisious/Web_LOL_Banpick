# 분석 엔진 어댑터화 + 초대 기반 외부 배포 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `server.js`가 로컬 CLI subprocess에 직접 묶여 있는 분석 엔진을 어댑터 뒤로 분리하고, Anthropic Messages API 구현체를 추가해 CLI가 없는 호스트에서도 라이브 분석이 돌아가게 한다.

**Architecture:** `runCli` + 두 호출 지점을 `analyzeWithAgent()` 단일 인터페이스로 좁힌다. 구현체는 `agent-cli.js`(기존 동작 이동)와 `agent-api.js`(신규)이며 `AGENT_BACKEND` 환경변수로 선택한다. HTTP 계층은 Node 20 내장 `fetch`로 직접 구현해 **루트 의존성 0을 유지**한다.

**Tech Stack:** Node.js ≥ 20 (내장 `fetch`/`AbortController`), CommonJS (`lib/`), ESM 테스트 (`test-artifacts/**/*-tests.mjs`), Anthropic Messages API (`claude-opus-5`).

**설계 문서:** `docs/superpowers/specs/2026-08-01-agent-adapter-external-deploy-design.md`

## Global Constraints

- **루트 의존성 0을 유지한다.** `package.json`의 `dependencies`/`devDependencies`는 `null`로 유지하고 `node_modules`를 만들지 않는다. npm 패키지를 추가하지 않는다.
- **Node 엔진은 `>=20`이다.** 내장 `fetch`, `AbortController`, `AbortSignal.timeout`을 쓸 수 있다.
- **회귀 기준선: `npm test` → 3401 passed / 0 failed / 158 test files.** 매 태스크 종료 시 실패 0이어야 하고 통과 수는 줄어들면 안 된다. 실제 실행 출력을 인용한다.
- **`lib/` 모듈은 CommonJS다** (`module.exports` / `require`). 테스트는 ESM `.mjs`이며 `createRequire(import.meta.url)`로 `lib/`를 불러온다.
- **테스트 파일은 `test-artifacts/**/*-tests.mjs` 글롭으로 자동 발견된다.** 파일명이 `-tests.mjs`로 끝나야 러너가 수집한다.
- **`new Function`으로 소스를 재구성하는 테스트를 작성하지 않는다.** 이 레포의 알려진 함정이며 배선 버그를 놓친다. 반드시 실제 모듈을 `require`한다.
- **`index.html` 구조와 `main.js`의 속성 셀렉터를 보존한다.** 이 작업은 서버 사이드이므로 원칙적으로 둘 다 건드릴 일이 없다.
- **`git push`와 `main` 머지를 하지 않는다.** 커밋은 로컬에만 남기고 착지 여부는 사용자가 결정한다.
- **실제 Anthropic API를 테스트에서 호출하지 않는다.** 비용과 비결정성 때문이다. HTTP 계층은 주입으로 대역화한다.
- **모델 ID는 `claude-opus-5`를 정확히 쓴다.** 날짜 접미사를 붙이지 않는다.

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `lib/agent-adapter.js` | `analyzeWithAgent()` 정의 + `AGENT_BACKEND` 기반 구현체 선택. `server.js`의 유일한 진입점 | 신규 (Task 1) |
| `lib/agent-cli.js` | `runCli` + `AUGMENTED_PATH` + claude/codex argv + 응답 언랩. **동작 불변 이동** | 신규 (Task 1) |
| `lib/agent-json.js` | 모델 텍스트 → JSON 파싱 (코드펜스 제거 포함). CLI/API 양쪽이 공유 | 신규 (Task 1) |
| `lib/anthropic-client.js` | Messages API HTTP 계층 — 요청, SSE 누적, 재시도, 타임아웃 | 신규 (Task 2) |
| `lib/agent-api.js` | 프롬프트 → Messages API 요청 조립, 응답 → 텍스트 | 신규 (Task 3) |
| `server.js` | CLI 관련 코드 제거, 어댑터 호출로 교체 | 수정 (Task 1, 3, 4) |

**인터페이스 요약** (태스크 간 계약):

```js
// lib/agent-adapter.js
analyzeWithAgent({ agent, prompt, timeoutMs, signal }) => Promise<{ text, meta }>
//   agent    : "claude" | "codex"
//   prompt   : string (프롬프트 + 페이로드가 합쳐진 최종 입력)
//   timeoutMs: number (기본 300000)
//   signal   : AbortSignal | undefined — **api 백엔드에서만 유효하다.**
//              cli 백엔드는 기존 runCli의 timeoutMs 경로만 쓰며 signal을 무시한다
//              (runCli에 signal 지원이 없고, Task 1은 동작 불변 리팩터이므로 추가하지 않는다).
//   returns  : { text: string, meta: { backend, agent, durationMs } }

// lib/agent-json.js
parseAgentJson(text) => object        // 코드펜스 제거 후 JSON.parse. 실패 시 throw

// lib/anthropic-client.js
createMessage({ apiKey, body, timeoutMs, signal, fetchImpl }) => Promise<{ text, stopReason, usage }>
```

> **설계 문서와의 차이 1건**: 스펙의 인터페이스는 `analyzeWithAgent({ prompt, timeoutMs, signal })`이었으나, CLI 구현체가 claude와 codex 두 에이전트를 모두 담당하므로 `agent` 파라미터를 추가했다. 스펙의 "api 모드에서 Codex 레그 비활성" 규칙은 그대로다 — `agent: "codex"` + `AGENT_BACKEND=api`면 즉시 reject한다.

---

### Task 1: 어댑터 추출 (동작 불변 리팩터)

`runCli`와 두 호출 지점을 `lib/`로 옮기고 `server.js`가 어댑터만 알게 만든다. **동작은 한 줄도 바뀌지 않는다.**

**Files:**
- Create: `lib/agent-json.js`
- Create: `lib/agent-cli.js`
- Create: `lib/agent-adapter.js`
- Modify: `server.js` (`AUGMENTED_PATH` ~2267-2280, `runCli` 2281-2320, `callClaudeAgent` 2393-2408, `callCodexAgent` ~2430-2470)
- Test: `test-artifacts/server/agent-adapter-tests.mjs`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `parseAgentJson(text)`, `analyzeWithAgent({agent, prompt, timeoutMs, signal})`, `runCli(args, stdinText, timeoutMs)`

- [ ] **Step 1: `lib/agent-json.js` 실패 테스트 작성**

`test-artifacts/server/agent-adapter-tests.mjs` 생성:

```js
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseAgentJson } = require("../../lib/agent-json.js");

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

test("parseAgentJson parses plain JSON", () => {
  assert.deepEqual(parseAgentJson('{"a":1}'), { a: 1 });
});

test("parseAgentJson strips ```json fences", () => {
  assert.deepEqual(parseAgentJson('```json\n{"a":1}\n```'), { a: 1 });
});

test("parseAgentJson strips bare ``` fences", () => {
  assert.deepEqual(parseAgentJson('```\n{"a":1}\n```'), { a: 1 });
});

test("parseAgentJson trims surrounding whitespace", () => {
  assert.deepEqual(parseAgentJson('  \n{"a":1}\n  '), { a: 1 });
});

test("parseAgentJson throws on non-JSON", () => {
  assert.throws(() => parseAgentJson("not json"));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
```

- [ ] **Step 2: 실패 확인**

Run: `node test-artifacts/server/agent-adapter-tests.mjs`
Expected: FAIL — `Cannot find module '../../lib/agent-json.js'`

- [ ] **Step 3: `lib/agent-json.js` 구현**

```js
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
```

- [ ] **Step 4: 통과 확인**

Run: `node test-artifacts/server/agent-adapter-tests.mjs`
Expected: PASS — `5 passed, 0 failed`

- [ ] **Step 5: 커밋**

```bash
git add lib/agent-json.js test-artifacts/server/agent-adapter-tests.mjs
git commit -m "refactor: extract agent JSON parsing to lib/agent-json.js"
```

- [ ] **Step 6: `lib/agent-cli.js` 생성 — `server.js`에서 순수 이동**

`server.js:2267-2280`의 `AUGMENTED_PATH`, `2281-2320`의 `runCli`, `parseExtraCliPathConfig` 호출부를 옮긴다. **로직을 바꾸지 않는다.**

```js
"use strict";

const path = require("node:path");
const { spawn } = require("node:child_process");
const { parseAgentJson } = require("./agent-json.js");

// .env의 EXTRA_CLI_PATH를 path.delimiter로 분해. server.js에서 이동.
function parseExtraCliPathConfig(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw.split(path.delimiter).map((p) => p.trim()).filter(Boolean);
}

// subprocess에서 CLI를 찾을 수 있도록 PATH 보강
// (node 프로세스는 shell PATH 미상속 가능). server.js에서 이동.
const AUGMENTED_PATH = [
  process.env.PATH,
  process.platform !== "win32" && "/opt/homebrew/bin",
  process.platform !== "win32" && "/usr/local/bin",
  process.env.HOME && `${process.env.HOME}/.local/bin`,
  process.env.USERPROFILE && `${process.env.USERPROFILE}\\.local\\bin`,
  process.env.USERPROFILE && `${process.env.USERPROFILE}\\.codex\\.sandbox-bin`,
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

// codex --json → JSONL. item.completed / agent_message 에서 text 추출.
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
  // -s read-only : 파일시스템 조작 차단 / --ephemeral : 세션 저장 없음
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
```

- [ ] **Step 7: 언랩 함수 테스트 추가**

`test-artifacts/server/agent-adapter-tests.mjs`의 `require` 줄 아래에 추가:

```js
const {
  unwrapClaudeStdout,
  unwrapCodexStdout,
  parseExtraCliPathConfig,
} = require("../../lib/agent-cli.js");
```

그리고 `console.log(`\n${pass}` 줄 **위에** 추가:

```js
test("unwrapClaudeStdout unwraps the result field", () => {
  assert.equal(unwrapClaudeStdout('{"result":"  hello  ","x":1}'), "hello");
});

test("unwrapClaudeStdout falls back to raw on non-JSON", () => {
  assert.equal(unwrapClaudeStdout("  plain text  "), "plain text");
});

test("unwrapCodexStdout extracts the last agent_message", () => {
  const jsonl = [
    '{"type":"thread.started","thread_id":"t"}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"first"}}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"second"}}',
    '{"type":"turn.completed"}',
  ].join("\n");
  assert.equal(unwrapCodexStdout(jsonl), "second");
});

test("unwrapCodexStdout ignores unparsable lines", () => {
  const jsonl = 'garbage\n{"type":"item.completed","item":{"type":"agent_message","text":"ok"}}';
  assert.equal(unwrapCodexStdout(jsonl), "ok");
});

test("unwrapCodexStdout falls back to raw when no agent_message", () => {
  assert.equal(unwrapCodexStdout("  nothing here  "), "nothing here");
});

test("parseExtraCliPathConfig splits on the platform delimiter", () => {
  const { delimiter } = require("node:path");
  assert.deepEqual(parseExtraCliPathConfig(`/a${delimiter}/b`), ["/a", "/b"]);
});

test("parseExtraCliPathConfig returns [] for blank input", () => {
  assert.deepEqual(parseExtraCliPathConfig("   "), []);
  assert.deepEqual(parseExtraCliPathConfig(undefined), []);
});
```

- [ ] **Step 8: 통과 확인**

Run: `node test-artifacts/server/agent-adapter-tests.mjs`
Expected: PASS — `12 passed, 0 failed`

- [ ] **Step 9: `lib/agent-adapter.js` 구현**

```js
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
    // Task 3에서 배선. 그 전까지 api 백엔드는 명시적으로 실패한다.
    const { analyzeWithApi } = require("./agent-api.js");
    result = await analyzeWithApi({ agent, prompt, timeoutMs, signal });
  } else {
    result = await analyzeWithCli({ agent, prompt, timeoutMs, signal });
  }

  return {
    text: result.text,
    meta: { backend, agent, durationMs: Date.now() - startedAt },
  };
}

module.exports = { analyzeWithAgent, selectBackend };
```

- [ ] **Step 10: `selectBackend` 테스트 추가**

`test-artifacts/server/agent-adapter-tests.mjs`의 require 블록에 추가:

```js
const { selectBackend } = require("../../lib/agent-adapter.js");
```

그리고 합계 출력 위에 추가:

```js
test("selectBackend accepts cli and api", () => {
  assert.equal(selectBackend("cli"), "cli");
  assert.equal(selectBackend("api"), "api");
  assert.equal(selectBackend("  API  "), "api");
});

test("selectBackend defaults to cli for unset or invalid values", () => {
  assert.equal(selectBackend(undefined), "cli");
  assert.equal(selectBackend(""), "cli");
  assert.equal(selectBackend("sdk"), "cli");
});
```

- [ ] **Step 11: 통과 확인**

Run: `node test-artifacts/server/agent-adapter-tests.mjs`
Expected: PASS — `14 passed, 0 failed`

- [ ] **Step 12: `server.js` 배선 교체**

`server.js`에서 다음을 **삭제**한다:
- `AUGMENTED_PATH` 상수 블록 (~2267-2280)
- `parseExtraCliPathConfig` 함수 정의
- `runCli` 함수 (2281-2320)
- `callClaudeAgent` 안의 `runCli(...)` 호출과 언랩/펜스 제거 로직
- `callCodexAgent` 안의 `runCli(...)` 호출과 JSONL 파싱/펜스 제거 로직

`server.js` 상단 require 블록(21행 부근, `hydrateStoredTeamplayV2` 다음 줄)에 **한 줄만** 추가한다:

```js
const { analyzeWithAgent } = require("./lib/agent-adapter");
```

`callClaudeAgent` / `callCodexAgent`를 다음으로 교체한다 (프롬프트 상수는 `server.js`에 그대로 둔다):

```js
async function callClaudeAgent(payload, timeoutMs = 300000) {
  const prompt = `${CLAUDE_COACHING_PROMPT}\n\n${JSON.stringify(payload, null, 2)}`;
  const { text } = await analyzeWithAgent({ agent: "claude", prompt, timeoutMs });
  return parseAgentJson(text);
}

async function callCodexAgent(payload, timeoutMs = 300000) {
  const prompt = `${CODEX_REDTEAM_PROMPT}\n\n${JSON.stringify(payload, null, 2)}`;
  const { text } = await analyzeWithAgent({ agent: "codex", prompt, timeoutMs });
  return parseAgentJson(text);
}
```

`parseAgentJson`도 require에 추가한다:

```js
const { parseAgentJson } = require("./lib/agent-json");
```

만약 `spawn`이 `server.js`의 다른 곳에서 쓰이지 않으면 `const { spawn } = require("child_process");`(7행)도 삭제한다. **`grep -n "spawn(" server.js`로 먼저 확인한다.**

- [ ] **Step 13: 전체 회귀 확인**

Run: `npm test`
Expected: PASS — `3401 passed, 0 failed` 이상. **통과 수가 줄면 이동이 동작을 바꾼 것이므로 멈추고 원인을 찾는다.**

> 신규 테스트 14건이 추가되므로 합계는 3415 내외가 된다. 정확한 수는 실제 출력을 인용한다.

- [ ] **Step 14: 커밋**

```bash
git add lib/agent-cli.js lib/agent-adapter.js server.js test-artifacts/server/agent-adapter-tests.mjs
git commit -m "refactor: route CLI agent calls through lib/agent-adapter"
```

---

### Task 2: Anthropic HTTP 계층

Messages API를 호출하는 최소 HTTP 계층. **의존성 0** — Node 20 내장 `fetch`만 쓴다.

**Files:**
- Create: `lib/anthropic-client.js`
- Test: `test-artifacts/server/anthropic-client-tests.mjs`

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces: `createMessage({ apiKey, body, timeoutMs, signal, fetchImpl })` → `{ text, stopReason, usage }`, `parseSseChunk(buffer)` → `{ events, rest }`

`fetchImpl`은 테스트 주입점이다. 미지정 시 전역 `fetch`를 쓴다. **실제 API는 절대 호출하지 않는다.**

- [ ] **Step 1: SSE 파서 실패 테스트 작성**

`test-artifacts/server/anthropic-client-tests.mjs` 생성:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node test-artifacts/server/anthropic-client-tests.mjs`
Expected: FAIL — `Cannot find module '../../lib/anthropic-client.js'`

- [ ] **Step 3: SSE 파서 구현**

`lib/anthropic-client.js` 생성:

```js
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
```

- [ ] **Step 4: 통과 확인**

Run: `node test-artifacts/server/anthropic-client-tests.mjs`
Expected: PASS — `3 passed, 0 failed`

- [ ] **Step 5: 커밋**

```bash
git add lib/anthropic-client.js test-artifacts/server/anthropic-client-tests.mjs
git commit -m "feat: add SSE chunk parser for the Anthropic streaming client"
```

- [ ] **Step 6: `createMessage` 실패 테스트 작성**

`test-artifacts/server/anthropic-client-tests.mjs`의 `asyncTest` 정의 아래에 추가:

```js
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
  const impl = (url, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
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
```

파일 **맨 끝**에 async 러너를 추가한다:

```js
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
```

- [ ] **Step 7: 실패 확인**

Run: `node test-artifacts/server/anthropic-client-tests.mjs`
Expected: FAIL — `createMessage is not a function`

- [ ] **Step 8: `createMessage` 구현**

`lib/anthropic-client.js`의 `module.exports` **위에** 추가:

```js
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
```

`module.exports`를 갱신한다:

```js
module.exports = { createMessage, parseSseChunk, API_URL, API_VERSION };
```

- [ ] **Step 9: 통과 확인**

Run: `node test-artifacts/server/anthropic-client-tests.mjs`
Expected: PASS — `10 passed, 0 failed` (동기 3건 + 비동기 7건)

- [ ] **Step 10: 전체 회귀 확인**

Run: `npm test`
Expected: 실패 0, 통과 수는 Task 1 종료 시점 대비 +10

- [ ] **Step 11: 커밋**

```bash
git add lib/anthropic-client.js test-artifacts/server/anthropic-client-tests.mjs
git commit -m "feat: add zero-dependency Anthropic Messages API client"
```

---

### Task 3: API 백엔드 배선

`AGENT_BACKEND=api`로 실제 분석이 돌아가게 만든다. **여기까지가 배포를 가능하게 하는 최소 범위다.**

**Files:**
- Create: `lib/agent-api.js`
- Test: `test-artifacts/server/agent-api-tests.mjs`

**Interfaces:**
- Consumes: `createMessage()` (Task 2), `analyzeWithAgent()` / `selectBackend()` (Task 1)
- Produces: `analyzeWithApi({ agent, prompt, timeoutMs, signal, createMessageImpl })` → `{ text }`

- [ ] **Step 1: 실패 테스트 작성**

`test-artifacts/server/agent-api-tests.mjs` 생성:

```js
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { analyzeWithApi, buildRequestBody } = require("../../lib/agent-api.js");

let pass = 0;
let fail = 0;
const asyncTests = [];
function asyncTest(name, fn) { asyncTests.push([name, fn]); }

function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

test("buildRequestBody targets claude-opus-5 with streaming-safe max_tokens", () => {
  const body = buildRequestBody({ prompt: "hi" });
  assert.equal(body.model, "claude-opus-5");
  assert.equal(body.max_tokens, 64000);
  assert.equal(body.output_config.effort, "high");
  assert.deepEqual(body.messages, [{ role: "user", content: "hi" }]);
});

asyncTest("analyzeWithApi returns the accumulated text", async () => {
  const out = await analyzeWithApi({
    agent: "claude",
    prompt: "p",
    createMessageImpl: async () => ({ text: '{"a":1}', stopReason: "end_turn", usage: {} }),
  });
  assert.equal(out.text, '{"a":1}');
});

asyncTest("analyzeWithApi rejects the codex agent", async () => {
  await assert.rejects(
    () => analyzeWithApi({ agent: "codex", prompt: "p", createMessageImpl: async () => ({}) }),
    /codex is not available/,
  );
});

asyncTest("analyzeWithApi throws on refusal", async () => {
  await assert.rejects(
    () => analyzeWithApi({
      agent: "claude", prompt: "p",
      createMessageImpl: async () => ({ text: "", stopReason: "refusal", usage: {} }),
    }),
    /refusal/,
  );
});

asyncTest("analyzeWithApi throws on max_tokens truncation", async () => {
  await assert.rejects(
    () => analyzeWithApi({
      agent: "claude", prompt: "p",
      createMessageImpl: async () => ({ text: "partial", stopReason: "max_tokens", usage: {} }),
    }),
    /max_tokens/,
  );
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
```

- [ ] **Step 2: 실패 확인**

Run: `node test-artifacts/server/agent-api-tests.mjs`
Expected: FAIL — `Cannot find module '../../lib/agent-api.js'`

- [ ] **Step 3: 구현**

`lib/agent-api.js` 생성:

```js
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
```

- [ ] **Step 4: 통과 확인**

Run: `node test-artifacts/server/agent-api-tests.mjs`
Expected: PASS — `5 passed, 0 failed`

- [ ] **Step 5: API 모드에서 Codex 자동 비활성 배선**

`server.js`의 `codexDisabled` 계산(2835행 부근)을 교체한다. **새 분기를 만들지 않고 기존 경로를 재사용한다.**

```js
const { selectBackend } = require("./lib/agent-adapter");
```

를 require 블록에 추가하고, 계산부를 다음으로 바꾼다:

```js
  // Phase 30: AGENT_DISABLE_CODEX=1 환경변수로 Codex 비활성 (.env 또는 export).
  // 2026-08: AGENT_BACKEND=api 에서도 Codex 레그는 비활성이다 — Codex는 OpenAI CLI이며
  // Anthropic Messages API에 대응물이 없다. 기존 single-agent 경로를 그대로 재사용한다.
  const codexDisabled =
    parseAgentDisableCodexConfig(process.env.AGENT_DISABLE_CODEX) ||
    selectBackend(process.env.AGENT_BACKEND) === "api";
  if (codexDisabled) {
    console.log(`[AI] Codex disabled (AGENT_DISABLE_CODEX or AGENT_BACKEND=api) — Claude only for ${sampleId}`);
  }
```

- [ ] **Step 6: 전체 회귀 확인**

Run: `npm test`
Expected: 실패 0, 통과 수는 Task 2 종료 시점 대비 +5

- [ ] **Step 7: 커밋**

```bash
git add lib/agent-api.js server.js test-artifacts/server/agent-api-tests.mjs
git commit -m "feat: wire the AGENT_BACKEND=api path with codex leg disabled"
```

- [ ] **Step 8: 라이브 검증 (수동, 1회)**

> 이 스텝만 실제 API를 호출한다. 테스트 스위트에는 포함하지 않는다.

```bash
export ANTHROPIC_API_KEY=...        # 실제 키
export AGENT_BACKEND=api
node server.js
# 브라우저에서 Riot ID 입력 → 분석 실행
```

확인할 것: 분석 JSON이 생성되는가, `analysisMeta.schemaViolations`가 기록되는가, 콘솔에 `Codex disabled ... AGENT_BACKEND=api`가 찍히는가. **결과 수치를 다음 태스크의 비교 기준선으로 기록한다.**

---

### Task 4: 구조화 출력 + 효과 실측

`output_config.format`으로 스키마를 강제하고 **전후 `schemaViolations` 분포를 실측한다.** Task 3까지로 배포는 이미 성립하므로, 이 태스크는 독립적으로 착지 가능하다.

**Files:**
- Create: `lib/analysis-json-schema.js`
- Modify: `lib/agent-api.js` (`buildRequestBody`)
- Test: `test-artifacts/server/analysis-json-schema-tests.mjs`

**Interfaces:**
- Consumes: `buildRequestBody({ prompt })` (Task 3)
- Produces: `ANALYSIS_OUTPUT_SCHEMA` (JSON Schema 객체), `buildRequestBody({ prompt, structured })`

- [ ] **Step 1: 스키마 제약 준수 테스트 작성**

`test-artifacts/server/analysis-json-schema-tests.mjs` 생성:

```js
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ANALYSIS_OUTPUT_SCHEMA } = require("../../lib/analysis-json-schema.js");

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

// 구조화 출력이 지원하지 않는 키워드를 스키마 어디에도 쓰지 않았는지 재귀 확인.
const UNSUPPORTED = ["minimum", "maximum", "multipleOf", "minLength", "maxLength", "minItems", "maxItems", "$ref", "$defs"];

function walk(node, visit, path = "$") {
  if (node === null || typeof node !== "object") return;
  visit(node, path);
  for (const [k, v] of Object.entries(node)) walk(v, visit, `${path}.${k}`);
}

test("schema uses no unsupported JSON Schema keywords", () => {
  const found = [];
  walk(ANALYSIS_OUTPUT_SCHEMA, (node, path) => {
    for (const kw of UNSUPPORTED) {
      if (Object.prototype.hasOwnProperty.call(node, kw)) found.push(`${path}.${kw}`);
    }
  });
  assert.deepEqual(found, [], `unsupported keywords: ${found.join(", ")}`);
});

test("every object sets additionalProperties false", () => {
  const bad = [];
  walk(ANALYSIS_OUTPUT_SCHEMA, (node, path) => {
    if (node.type === "object" && node.additionalProperties !== false) bad.push(path);
  });
  assert.deepEqual(bad, [], `objects missing additionalProperties:false: ${bad.join(", ")}`);
});

test("top level requires the 13 documented fields", () => {
  assert.equal(ANALYSIS_OUTPUT_SCHEMA.type, "object");
  for (const field of [
    "schemaVersion", "analysisMeta", "matchSummary", "coachSummary",
    "phaseSummaries", "strengths", "weaknesses", "actionChecklist",
    "keyMoments", "evidenceIndex", "combatAnalysis",
    "teamfightPhaseAnalysis", "teamplayAnalysisV2",
  ]) {
    assert.ok(field in ANALYSIS_OUTPUT_SCHEMA.properties, `missing property: ${field}`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
```

- [ ] **Step 2: 실패 확인**

Run: `node test-artifacts/server/analysis-json-schema-tests.mjs`
Expected: FAIL — `Cannot find module '../../lib/analysis-json-schema.js'`

- [ ] **Step 3: 스키마 작성**

`analysis-json-schema.md`의 §3 최상위 스키마와 §4 필드 정의를 근거로 `lib/analysis-json-schema.js`를 작성한다.

**작성 규칙 (Step 1의 테스트가 강제한다):**
- 모든 `object`에 `additionalProperties: false`
- `minItems`/`maxItems`/`minLength`/`maximum` 등 **미지원 키워드 금지** — 배열 최소 길이는 `validateAnalysisOutput`이 계속 담당한다
- `$ref`/`$defs` 금지 (재귀 미지원). 반복 구조는 인라인으로 펼친다

최상위 골격:

```js
"use strict";

// analysis-json-schema.md §3, §4 기준.
// 구조화 출력 제약: 재귀 불가, 수치/길이 제약 불가, 모든 object는 additionalProperties:false.
// 배열 최소 길이(phaseSummaries 등)는 여기서 강제할 수 없으므로
// server.js의 validateAnalysisOutput이 계속 담당한다.
const ANALYSIS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "analysisMeta", "matchSummary", "coachSummary"],
  properties: {
    schemaVersion: { type: "string" },
    analysisMeta: {
      type: "object",
      additionalProperties: false,
      required: ["sourceType", "language"],
      properties: {
        analysisId: { type: "string" },
        generatedAt: { type: "string" },
        sourceType: { type: "string" },
        language: { type: "string" },
        confidence: { type: "number" },
      },
    },
    matchSummary: {
      type: "object",
      additionalProperties: false,
      required: ["headline"],
      properties: {
        matchId: { type: "string" },
        queueType: { type: "string" },
        gameVersion: { type: "string" },
        durationSeconds: { type: "number" },
        result: { type: "string" },
        champion: { type: "string" },
        headline: { type: "string" },
      },
    },
    // 배열 필드 패턴 — 항목 object에도 additionalProperties:false를 붙이고
    // minItems는 절대 쓰지 않는다 (개수 검사는 validateAnalysisOutput 담당).
    phaseSummaries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phase", "summary"],
        properties: {
          phase: { type: "string" },
          summary: { type: "string" },
        },
      },
    },
    // 남은 필드: coachSummary, strengths, weaknesses, actionChecklist,
    // keyMoments, evidenceIndex, combatAnalysis, teamfightPhaseAnalysis,
    // teamplayAnalysisV2
  },
};

module.exports = { ANALYSIS_OUTPUT_SCHEMA };
```

**남은 9개 필드를 채우는 방법 — 추측하지 않는다:**

1. 필드별 정의는 저장소 안의 `analysis-json-schema.md` **§4**에 이미 있다. 각 필드의 §4 하위 절(`## 4.x`)을 읽고 거기 나열된 하위 필드와 타입을 그대로 옮긴다.
2. 실제 데이터로 교차 확인한다 — `data/samples/` 아래 저장된 분석 JSON을 열어 필드 형태를 대조한다. 문서와 실데이터가 다르면 **실데이터를 따르고 그 차이를 보고한다.**
3. 위 두 패턴(`matchSummary` = object, `phaseSummaries` = array of object)이 나머지 전부의 형태다. 새로운 구조는 없다.
4. Step 1의 테스트가 세 가지를 기계적으로 강제한다 — 미지원 키워드 0개, 모든 object에 `additionalProperties:false`, 최상위 13필드 존재. **테스트가 통과하면 형식은 맞는 것이다.**

> 스키마 본문을 이 계획서에 전부 복사하지 않은 이유: 리프가 약 75개라 300줄 규모이고, 원본이 같은 저장소의 `analysis-json-schema.md`에 있어 복사본을 두면 드리프트가 발생한다. 대신 형식 제약을 테스트로 못박았다.

> **주의**: `analysisMeta.schemaViolations` / `schemaViolationCount`는 **서버가 사후에 기록하는 필드**다(`server.js:3163`). 모델에게 생성시키지 않는다 — 스키마의 `properties`에서 제외한다.

- [ ] **Step 4: 통과 확인**

Run: `node test-artifacts/server/analysis-json-schema-tests.mjs`
Expected: PASS — `3 passed, 0 failed`

- [ ] **Step 5: `buildRequestBody`에 구조화 출력 연결**

`lib/agent-api.js` 수정:

```js
const { ANALYSIS_OUTPUT_SCHEMA } = require("./analysis-json-schema.js");

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
```

`analyzeWithApi`에 `structured` 옵션을 통과시킨다:

```js
async function analyzeWithApi({ agent, prompt, timeoutMs = 300000, signal, createMessageImpl, structured } = {}) {
  ...
  const { text, stopReason } = await call({
    body: buildRequestBody({ prompt, structured }),
    timeoutMs,
    signal,
  });
```

- [ ] **Step 6: 배선 테스트 추가**

`test-artifacts/server/agent-api-tests.mjs`의 합계 출력 **위에** 추가:

```js
test("buildRequestBody attaches the json_schema format by default", () => {
  const body = buildRequestBody({ prompt: "hi" });
  assert.equal(body.output_config.format.type, "json_schema");
  assert.equal(body.output_config.format.schema.type, "object");
});

test("buildRequestBody omits the format when structured is false", () => {
  const body = buildRequestBody({ prompt: "hi", structured: false });
  assert.equal(body.output_config.format, undefined);
});
```

Task 3 Step 1의 첫 테스트(`buildRequestBody targets claude-opus-5 …`)는 `output_config.effort`만 보므로 그대로 통과한다.

- [ ] **Step 7: 전체 회귀 확인**

Run: `npm test`
Expected: 실패 0, 통과 수는 Task 3 종료 시점 대비 +5

- [ ] **Step 8: 커밋**

```bash
git add lib/analysis-json-schema.js lib/agent-api.js test-artifacts/server/analysis-json-schema-tests.mjs test-artifacts/server/agent-api-tests.mjs
git commit -m "feat: constrain API analysis output with a json_schema"
```

- [ ] **Step 9: 효과 실측 (수동)**

Task 3 Step 8에서 기록한 기준선과 비교한다.

```bash
export ANTHROPIC_API_KEY=...
export AGENT_BACKEND=api
node server.js
# 동일한 샘플 3건을 structured 없이 / 있이 각각 생성
```

`analysisMeta.schemaViolations` 배열을 두 조건에서 비교하고, **줄어든 위반 종류와 남은 위반 종류를 `PLAN.md`에 기록한다.** 표본이 결론을 내기에 적으면 그렇게 적는다 — 억지 결론을 만들지 않는다.

---

### Task 5: 초대 기반 배포 설정

코드 변경보다 설정·운영이다.

**Files:**
- Modify: `docs/external-demo-runbook.md`
- Modify: `PLAN.md`

**Interfaces:**
- Consumes: Task 3까지의 `AGENT_BACKEND=api` 경로
- Produces: 없음 (문서)

- [ ] **Step 1: 배포 전 점검 실행**

```bash
npm test
npm run smoke:protected     # protected 모드 스모크
```

Expected: 둘 다 통과. 실패 시 배포하지 않는다.

- [ ] **Step 2: `sites/` 무변경 확인**

```bash
git diff --name-only main..HEAD | grep '^sites/' || echo "sites/ 무변경 — dist 재빌드 불필요"
```

Expected: `sites/ 무변경 — dist 재빌드 불필요`. **`sites/`가 바뀌었다면 dist를 재빌드해야 하므로 멈추고 확인한다.**

- [ ] **Step 3: 런북에 API 백엔드 절차 추가**

`docs/external-demo-runbook.md`에 섹션을 추가한다:

````markdown
## 상시 배포 (AGENT_BACKEND=api)

CLI 없이 라이브 분석을 돌리는 구성. Node ≥ 20이 도는 호스트면 어디든 가능하다.

```bash
export ANTHROPIC_API_KEY=...        # Anthropic API 키
export RIOT_API_KEY=...             # Riot 개발 키 (24시간 만료)
export AGENT_BACKEND=api            # CLI 대신 Messages API 사용
export PUBLIC_DEMO_MODE=protected   # 초대 토큰 필요
export PUBLIC_DEMO_TOKEN=...        # 초대받은 사람에게만 공유
export PORT=8123
node server.js
```

주의:
- `AGENT_BACKEND=api`에서는 **Codex 레그가 비활성**이다. 단일 에이전트로 동작하며 이중 교차검증 효과는 없다.
- Riot 개발 키는 **24시간마다 만료**된다. 만료 시 UI가 안내하지만 자동 갱신은 없다.
- `sites/` Cloudflare 배포는 read-only 데모로 별개다. 이 구성과 혼동하지 않는다.
````

- [ ] **Step 4: `PLAN.md` 갱신**

Tier B/후속 항목에 이번 작업 결과를 기록한다 — 무엇이 가능해졌고 무엇이 남았는지. 최소한 다음을 적는다:
- `AGENT_BACKEND=api`로 CLI 없는 호스트에서 라이브 분석 가능
- Codex 대체 어댑터는 미구현 (Tier B에 유지)
- 구조화 출력의 `schemaViolations` 실측 결과 (Task 4 Step 9)
- Riot RSO OAuth는 여전히 Tier C DEFER

- [ ] **Step 5: 커밋**

```bash
git add docs/external-demo-runbook.md PLAN.md
git commit -m "docs: record the api-backend deployment procedure and results"
```

---

## 완료 기준

- [ ] `npm test` 실패 0, 통과 수가 3401 미만이 아님
- [ ] `AGENT_BACKEND` 미설정 시 기존 CLI 동작이 완전히 동일함
- [ ] `AGENT_BACKEND=api`로 실제 분석 1건 이상 성공
- [ ] `sites/` 무변경 (dist 재빌드 불필요)
- [ ] `git push` / `main` 머지 없음 — 착지는 사용자 결정
