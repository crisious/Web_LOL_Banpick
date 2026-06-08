# EXTRA_CLI_PATH Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `EXTRA_CLI_PATH` accept only explicit PATH entries so accidental empty segments cannot add the current directory to AI CLI subprocess lookup.

**Architecture:** Add a small `parseExtraCliPathConfig()` helper in `server.js` and spread its returned path segments into `AUGMENTED_PATH`. Cover the parser with extracted-function tests that prove missing/empty config is ignored, delimiter-separated explicit paths are preserved, and empty/whitespace/control-character segments fail before `runCli()` spawns Claude or Codex.

**Tech Stack:** Node.js vanilla HTTP server, Node built-in `path.delimiter`, zero-dependency `.mjs` tests, README and `.env.example` operational docs.

---

### Task 1: Add Failing EXTRA_CLI_PATH Parser Tests

**Files:**
- Create: `test-artifacts/server/extra-cli-path-config-tests.mjs`
- Read: `server.js`

- [x] **Step 1: Write the failing test**

Create `test-artifacts/server/extra-cli-path-config-tests.mjs` with this content:

```js
// EXTRA_CLI_PATH config regression tests.
//
// Extra CLI lookup paths should be explicit path segments only. Empty PATH
// segments can make the current working directory part of PATH on POSIX shells,
// so accidental leading/trailing/double delimiters must fail before spawning AI
// CLI subprocesses.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const parseExtraCliPathConfigSource = serverSrc.includes("function parseExtraCliPathConfig(")
  ? extractFunctionSource(serverSrc, "parseExtraCliPathConfig")
  : [
      "function parseExtraCliPathConfig(rawPath, delimiter = ':') {",
      "  return rawPath ? String(rawPath).split(delimiter) : [];",
      "}",
    ].join("\n");

const { parseExtraCliPathConfig } = new Function(
  `${parseExtraCliPathConfigSource}\nreturn { parseExtraCliPathConfig };`,
)();

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkThrows(label, fn, expectedMessage) {
  let error = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  const ok = error?.message === expectedMessage;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`  expected throw ${JSON.stringify(expectedMessage)}\n  got            ${JSON.stringify(error?.message || null)}`);
  }
  ok ? pass++ : fail++;
}

const extraCliPathError = "EXTRA_CLI_PATH must be empty or a delimiter-separated list of non-empty paths without leading/trailing whitespace or control characters.";

check("missing EXTRA_CLI_PATH adds no entries",
  parseExtraCliPathConfig(undefined, ":"),
  []);
check("empty EXTRA_CLI_PATH adds no entries",
  parseExtraCliPathConfig("", ":"),
  []);
check("single EXTRA_CLI_PATH entry is preserved",
  parseExtraCliPathConfig("/opt/cli/bin", ":"),
  ["/opt/cli/bin"]);
check("multiple EXTRA_CLI_PATH entries are preserved",
  parseExtraCliPathConfig("/opt/cli/bin:/srv/tools/bin", ":"),
  ["/opt/cli/bin", "/srv/tools/bin"]);
check("internal path spaces are preserved",
  parseExtraCliPathConfig("/Applications/Claude Code/bin:/Users/me/Tools Folder/bin", ":"),
  ["/Applications/Claude Code/bin", "/Users/me/Tools Folder/bin"]);
check("custom delimiter is supported",
  parseExtraCliPathConfig("C:\\Tools\\codex\\bin;D:\\Claude\\bin", ";"),
  ["C:\\Tools\\codex\\bin", "D:\\Claude\\bin"]);

for (const [label, rawPath, delimiter] of [
  ["leading delimiter is rejected", ":/opt/cli/bin", ":"],
  ["trailing delimiter is rejected", "/opt/cli/bin:", ":"],
  ["double delimiter is rejected", "/opt/cli/bin::/srv/tools/bin", ":"],
  ["leading whitespace segment is rejected", " /opt/cli/bin", ":"],
  ["trailing whitespace segment is rejected", "/opt/cli/bin ", ":"],
  ["tab segment is rejected", "/opt/cli\tbin", ":"],
  ["newline segment is rejected", "/opt/cli\nbin", ":"],
  ["windows leading delimiter is rejected", ";C:\\Tools\\codex\\bin", ";"],
  ["windows double delimiter is rejected", "C:\\Tools\\codex\\bin;;D:\\Claude\\bin", ";"],
]) {
  checkThrows(label, () => parseExtraCliPathConfig(rawPath, delimiter), extraCliPathError);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node test-artifacts/server/extra-cli-path-config-tests.mjs
```

Expected result before implementation: `6 passed, 9 failed`, where the failed cases are the leading/trailing/double delimiter and whitespace/control-character segment checks.

Observed RED result: `6 passed, 9 failed`.

### Task 2: Implement EXTRA_CLI_PATH Parser

**Files:**
- Modify: `server.js`
- Test: `test-artifacts/server/extra-cli-path-config-tests.mjs`

- [x] **Step 1: Add parser helper**

Add this helper near the other server config parsers in `server.js`:

```js
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
```

- [x] **Step 2: Route `AUGMENTED_PATH` through the parser**

Replace the raw `process.env.EXTRA_CLI_PATH` entry in `AUGMENTED_PATH` with the parsed entries:

```js
  // 옵션: .env의 EXTRA_CLI_PATH로 추가 경로 지정 가능 (path.delimiter 구분)
  ...parseExtraCliPathConfig(process.env.EXTRA_CLI_PATH),
].filter(Boolean).join(path.delimiter);
```

- [x] **Step 3: Run focused GREEN verification**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/extra-cli-path-config-tests.mjs &&
node test-artifacts/server/extra-cli-path-config-tests.mjs
```

Expected result after implementation: syntax checks exit `0`; focused tests report `15 passed, 0 failed`.

Observed GREEN result: syntax checks exited `0`; focused tests reported `15 passed, 0 failed`.

### Task 3: Document Operator Contract

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [x] **Step 1: Update `.env.example` comment**

Change the `EXTRA_CLI_PATH` comment to state that each entry must be explicit and that empty segments are rejected:

```text
# Phase 25 fix: 추가 CLI 설치 경로 (path.delimiter로 구분). 보통 .local/bin과
# .codex/.sandbox-bin은 자동 추가되므로 불필요. claude/codex가 비표준 위치에
# 있을 때만 설정. 각 segment는 non-empty exact filesystem path여야 하며,
# leading/trailing whitespace, control character, leading/trailing/double delimiter는
# 현재 디렉터리 PATH 주입 위험 때문에 서버 시작 전에 실패합니다.
# EXTRA_CLI_PATH=C:\Tools\codex\bin
```

- [x] **Step 2: Update README environment notes**

Add this sentence near the existing `AGENT_DISABLE_CODEX` note in `README.md`:

```md
- `EXTRA_CLI_PATH`는 Claude/Codex CLI가 비표준 위치에 있을 때만 쓰는 추가 PATH segment 목록입니다. Missing/empty 값은 무시되며, non-empty 값은 `path.delimiter`로 나뉜 각 segment가 비어 있지 않고 leading/trailing whitespace 또는 control character가 없어야 합니다. Leading/trailing/double delimiter로 생기는 빈 segment는 현재 디렉터리 PATH 주입 위험 때문에 서버 시작 전에 실패합니다.
```

### Task 4: Full QA, Commit, Push, and Remote Artifact Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-extra-cli-path-guard.md`
- Read: GitHub Actions QA artifact
- Update: `/Users/a1234/Documents/Obsidian Cloud/게임 기획/LOL AI Coach - 프로젝트 개선 계획.md`

- [x] **Step 1: Scan plan for placeholder red flags**

Run:

```bash
rg -n "$(printf 'TB%s|TO%s|implement %s|fill in %s|appropr%s|Similar %s' D DO later details iate to)" docs/superpowers/plans/2026-06-08-extra-cli-path-guard.md; placeholder_scan=$?; echo "placeholder_scan_exit=$placeholder_scan"; test "$placeholder_scan" -eq 1
```

Expected: `placeholder_scan_exit=1`.

Observed result: `placeholder_scan_exit=1`.

- [x] **Step 2: Run full local QA**

Run:

```bash
node --check server.js &&
node --check test-artifacts/server/extra-cli-path-config-tests.mjs &&
node test-artifacts/server/extra-cli-path-config-tests.mjs &&
npm test &&
git diff --check
```

Expected: focused tests `15 passed, 0 failed`; `npm test` includes the new file and reports `998 passed, 0 failed across 32 test file(s)`; diff check exits `0`.

Observed result: focused tests `15 passed, 0 failed`; `npm test` reported `998 passed, 0 failed across 32 test file(s)`; `git diff --check` exited `0`.

- [ ] **Step 3: Commit and push main**

Run:

```bash
git fetch origin &&
git rev-list --left-right --count main...origin/main &&
git add server.js README.md .env.example test-artifacts/server/extra-cli-path-config-tests.mjs docs/superpowers/plans/2026-06-08-extra-cli-path-guard.md &&
git diff --cached --check &&
git commit -m "ci: reject unsafe extra cli path config" &&
git push origin main
```

Expected: before commit `main...origin/main` reports `0 0`; commit succeeds; push updates `origin/main`.

- [ ] **Step 4: Verify GitHub Actions artifact**

Run:

```bash
gh run list --repo crisious/Web_LOL_Banpick --workflow QA --branch main --limit 5
gh run watch <run_id> --repo crisious/Web_LOL_Banpick --exit-status
gh run download <run_id> --repo crisious/Web_LOL_Banpick --dir test-artifacts/tmp/gh-run-<run_id>
rg -n "Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|EXTERNAL_READONLY_URL=[^[:space:]]|EXTERNAL_PROTECTED_URL=[^[:space:]]|access_token=|token=secret|asset-secret|script-secret|user:pass@|RIOT_API_KEY|RGAPI-|KR_[0-9]{8,}|NA1_[0-9]{8,}|lockKey" test-artifacts/tmp/gh-run-<run_id>; scan_status=$?; echo "sensitive_scan_exit=$scan_status"; test "$scan_status" -eq 1
```

Expected: GitHub QA conclusion `success`; read-only smoke artifact reports `155 passed, 0 failed`; sensitive artifact scan exits with `sensitive_scan_exit=1`.

## Self-Review

- Spec coverage: The plan covers the current risk: raw `EXTRA_CLI_PATH` entering `AUGMENTED_PATH` and allowing empty PATH segments. Tests cover missing, empty, single entry, multiple entries, internal path spaces, custom delimiter, leading/trailing/double delimiter, surrounding whitespace, and control characters.
- Placeholder scan target: The plan avoids unfinished markers and gives exact file paths, code, commands, and expected outputs.
- Type consistency: `parseExtraCliPathConfig(rawPath, delimiter = path.delimiter)` returns `string[]`; `AUGMENTED_PATH` spreads that array into the existing `string[]` before `.filter(Boolean).join(path.delimiter)`.
