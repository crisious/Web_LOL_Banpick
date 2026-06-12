// Protected demo token UI regression tests.
//
// External protected demos need a browser-entered token for live/write APIs.
// The token must be session-scoped and sent only to same-origin protected API
// endpoints, never static assets or sample reads.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  let startIdx = source.indexOf(`function ${name}(`);
  const asyncIdx = source.indexOf(`async function ${name}(`);
  if (asyncIdx >= 0 && (startIdx < 0 || asyncIdx + 6 === startIdx)) {
    startIdx = asyncIdx;
  }
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let parenDepth = 0;
  let i = source.indexOf("(", startIdx);
  for (; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    else if (source[i] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        i += 1;
        break;
      }
    }
  }
  const bodyStart = source.indexOf("{", i);
  let depth = 0;
  for (let j = bodyStart; j < source.length; j += 1) {
    const ch = source[j];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, j + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const fetchJsonSrc = extractFunctionSource(mainSrc, "fetchJson");
const serverModeUiSrc = extractFunctionSource(mainSrc, "serverModeUi");
const currentServerModeUiSrc = extractFunctionSource(mainSrc, "currentServerModeUi");
const isLiveControlLockedSrc = extractFunctionSource(mainSrc, "isLiveControlLocked");
const liveControlLockedMessageSrc = extractFunctionSource(mainSrc, "liveControlLockedMessage");

let pass = 0;
let fail = 0;

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

checkTrue("main declares DEMO_TOKEN_STORAGE_KEY",
  mainSrc.includes("const DEMO_TOKEN_STORAGE_KEY = \"lol-coach-demo-token\";"));
checkTrue("main state includes demoToken",
  mainSrc.includes("demoToken: loadDemoToken()"));
checkTrue("main defines loadDemoToken",
  mainSrc.includes("function loadDemoToken()"));
checkTrue("main defines saveDemoToken",
  mainSrc.includes("function saveDemoToken(token)"));
checkTrue("main stores demo token in sessionStorage",
  mainSrc.includes("sessionStorage.setItem(DEMO_TOKEN_STORAGE_KEY"));
checkTrue("main does not store demo token in localStorage",
  !mainSrc.includes("localStorage.setItem(DEMO_TOKEN_STORAGE_KEY"));
checkTrue("main defines isProtectedApiPath",
  mainSrc.includes("function isProtectedApiPath(path)"));
checkTrue("protected API list includes recent matches",
  mainSrc.includes("\"/api/recent-matches\""));
checkTrue("protected API list includes champion history",
  mainSrc.includes("\"/api/champion-history\""));
checkTrue("protected API list includes generate sample",
  mainSrc.includes("\"/api/generate-sample\""));
checkTrue("protected API list includes demo auth",
  mainSrc.includes("\"/api/demo-auth\""));
checkTrue("fetchJson adds x-demo-token",
  fetchJsonSrc.includes("\"x-demo-token\""));
checkTrue("fetchJson adds token only for protected API paths",
  fetchJsonSrc.includes("isProtectedApiPath(path)"));
checkTrue("fetchJson preserves caller headers",
  fetchJsonSrc.includes("new Headers(fetchOptions.headers || {})"));
checkTrue("serverModeUi protected mode can lock without token",
  serverModeUiSrc.includes("demoTokenConfigured"));
checkTrue("currentServerModeUi evaluates current server state",
  currentServerModeUiSrc.includes("serverModeUi(state.serverStatus, state.serverStatusError)"));
checkTrue("isLiveControlLocked checks current mode state",
  isLiveControlLockedSrc.includes("currentServerModeUi().lockLiveControls"));
checkTrue("liveControlLockedMessage uses current mode state",
  liveControlLockedMessageSrc.includes("currentServerModeUi().liveControlMessage"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
