// Client/server fetch resilience regression tests (Batch G).
//
// fetchJson must: read the body as text and parse safely (non-JSON error
// bodies must not mask the HTTP status with a SyntaxError), inject an
// AbortController timeout unless the caller opts out (timeoutMs:0 or own
// signal), and map AbortError to a friendly timeout message. safeJsonParse
// must never throw. Server requestJson must arm a socket timeout, and
// recent-matches must tolerate partial match-detail failures.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  let startIdx = source.indexOf(`function ${name}(`);
  const asyncIdx = source.indexOf(`async function ${name}(`);
  if (asyncIdx >= 0 && (startIdx < 0 || asyncIdx + 6 === startIdx)) startIdx = asyncIdx;
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let parenDepth = 0;
  let i = source.indexOf("(", startIdx);
  for (; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    else if (source[i] === ")") { parenDepth -= 1; if (parenDepth === 0) { i += 1; break; } }
  }
  const bodyStart = source.indexOf("{", i);
  let depth = 0;
  for (let j = bodyStart; j < source.length; j += 1) {
    if (source[j] === "{") depth += 1;
    else if (source[j] === "}") { depth -= 1; if (depth === 0) return source.slice(startIdx, j + 1); }
  }
  throw new Error(`function ${name} not closed`);
}

let pass = 0, fail = 0;
function checkTrue(label, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || !detail ? "" : `  — ${detail}`}`);
  cond ? pass++ : fail++;
}
async function expectThrow(label, fn, matcher) {
  try {
    await fn();
    checkTrue(label, false, "did not throw");
  } catch (e) {
    checkTrue(label, matcher(e), `threw: ${e && e.message}`);
  }
}

// ── fetchJson functional tests with a mock fetch ──────────────────────────
const fetchJsonSrc = extractFunctionSource(mainSrc, "fetchJson");
function makeFetchJson(mockFetch) {
  return new Function(
    "fetch", "AbortController", "setTimeout", "clearTimeout",
    `const DEFAULT_FETCH_TIMEOUT_MS = 30000;
${fetchJsonSrc}
return fetchJson;`,
  )(mockFetch, globalThis.AbortController, globalThis.setTimeout, globalThis.clearTimeout);
}

const okFetchJson = makeFetchJson(async () => ({ ok: true, status: 200, text: async () => '{"a":1}' }));
checkTrue("fetchJson returns parsed JSON on 200", JSON.stringify(await okFetchJson("/x")) === '{"a":1}');

const htmlErrFetchJson = makeFetchJson(async () => ({ ok: false, status: 502, text: async () => "<html>bad gateway</html>" }));
await expectThrow(
  "fetchJson on non-JSON 502 surfaces HTTP status, not SyntaxError",
  () => htmlErrFetchJson("/x"),
  (e) => /HTTP 502/.test(e.message) && !/Unexpected token|JSON/.test(e.message),
);

const codeFetchJson = makeFetchJson(async () => ({ ok: true, status: 200, text: async () => '{"ok":false,"code":"RIOT_KEY_EXPIRED","error":"키 만료"}' }));
await expectThrow(
  "fetchJson surfaces ok:false + code on 200",
  () => codeFetchJson("/x"),
  (e) => e.code === "RIOT_KEY_EXPIRED",
);

const abortFetchJson = makeFetchJson(async () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; });
await expectThrow(
  "fetchJson maps AbortError to friendly timeout message",
  () => abortFetchJson("/x"),
  (e) => /시간이 초과/.test(e.message),
);

let injectedSignal = null;
const signalProbe = makeFetchJson(async (_p, opts) => { injectedSignal = opts && opts.signal; return { ok: true, status: 200, text: async () => "{}" }; });
await signalProbe("/x");
checkTrue("fetchJson injects an abort signal by default", injectedSignal != null);
injectedSignal = null;
await signalProbe("/x", { timeoutMs: 0 });
checkTrue("fetchJson with timeoutMs:0 injects no signal", injectedSignal == null);

// ── safeJsonParse ─────────────────────────────────────────────────────────
const safeJsonParse = new Function(`${extractFunctionSource(mainSrc, "safeJsonParse")}\nreturn safeJsonParse;`)();
checkTrue("safeJsonParse parses valid JSON", JSON.stringify(safeJsonParse('{"x":1}', null)) === '{"x":1}');
checkTrue("safeJsonParse returns fallback on corrupt JSON", safeJsonParse("{not json", "FB") === "FB");
checkTrue("safeJsonParse returns fallback on null", safeJsonParse(null, "FB") === "FB");

// ── summarizeMatch null/malformed guard ───────────────────────────────────
const summarizeMatch = new Function(
  `function normalizeRole() { return "SUPPORT"; }
${extractFunctionSource(serverSrc, "summarizeMatch")}
return summarizeMatch;`,
)();
checkTrue("summarizeMatch returns null for null detail", summarizeMatch(null, "p") === null);
checkTrue("summarizeMatch returns null for missing info", summarizeMatch({}, "p") === null);
checkTrue("summarizeMatch returns null for non-array participants", summarizeMatch({ info: { participants: null } }, "p") === null);

// ── source pins for server/client timeouts and partial tolerance ──────────
checkTrue("requestJson arms a socket timeout", /req\.setTimeout\(\s*RIOT_REQUEST_TIMEOUT_MS/.test(serverSrc));
checkTrue("recent-matches tolerates partial match-detail failure",
  serverSrc.includes(".catch(() => null)") &&
    /matchIds\.map\([\s\S]{0,200}\.catch\(\(\) => null\)/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
