// Public sample list privacy regression tests.
//
// /api/samples is used by read-only external demos. It should provide enough
// sample metadata to render the library and fetch details by sample id, without
// adding an explicit Riot matchId field to each list entry.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  let startIdx = source.indexOf(`function ${name}(`);
  const asyncStartIdx = source.indexOf(`async function ${name}(`);
  if (asyncStartIdx >= 0 && (startIdx < 0 || asyncStartIdx < startIdx)) {
    startIdx = asyncStartIdx;
  }
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

const maybePublicSampleListEntrySource = serverSrc.includes("function publicSampleListEntry(")
  ? extractFunctionSource(serverSrc, "publicSampleListEntry")
  : "function publicSampleListEntry(sample) { return sample; }";

const manifestFixture = {
  schemaVersion: 1,
  samples: [{
    id: "sample-kr-8242613150",
    matchId: "KR_8242613150",
    label: "sample-kr-8242613150 · MID LOSS",
    champion: "Ahri",
    publicAlias: "Demo Player#KR1",
    collectedDate: "2026-06-08",
    theme: "Mid-game side lane collapse",
    normalizedPath: "/data/samples/sample-kr-8242613150/normalized-match.json",
    analysisPath: "/data/samples/sample-kr-8242613150/analysis-result.json",
    notesPath: "/data/samples/sample-kr-8242613150/sample-kr-8242613150-notes.md",
  }],
};

const harness = new Function("manifestFixture", [
  "function sendJson(res, status, body) { res.sent = { status, body }; }",
  "function publicDemoModeHealth() { return {}; }",
  "function sampleGenerationHealth() { return {}; }",
  "async function loadManifest() { return manifestFixture; }",
  extractFunctionSource(serverSrc, "inferMatchIdFromSampleEntry"),
  maybePublicSampleListEntrySource,
  extractFunctionSource(serverSrc, "handleApi"),
  "return { handleApi };",
].join("\n"))(manifestFixture);

function makeRes() {
  return { sent: null };
}

async function requestSamples() {
  const res = makeRes();
  const handled = await harness.handleApi({ method: "GET" }, res, { pathname: "/api/samples" });
  return { handled, res };
}

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkTrue(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition && detail) console.log(`  ${detail}`);
  condition ? pass++ : fail++;
}

const out = await requestSamples();
const sample = out.res.sent?.body?.samples?.[0];

check("sample list request is handled", out.handled, true);
check("sample list status", out.res.sent?.status, 200);
check("sample list keeps schemaVersion", out.res.sent?.body?.schemaVersion, 1);
check("sample list keeps sample id", sample?.id, "sample-kr-8242613150");
check("sample list keeps display metadata", {
  label: sample?.label,
  champion: sample?.champion,
  theme: sample?.theme,
}, {
  label: "sample-kr-8242613150 · MID LOSS",
  champion: "Ahri",
  theme: "Mid-game side lane collapse",
});
check("sample list does not expose explicit matchId",
  Object.prototype.hasOwnProperty.call(sample || {}, "matchId"),
  false);
// publicAlias는 이름과 달리 실제 Riot ID(Name#TAG)를 담는다. sites/ 공개 번들과 같은
// 정책으로 server.js 응답에서도 제외한다.
check("sample list does not expose publicAlias",
  Object.prototype.hasOwnProperty.call(sample || {}, "publicAlias"),
  false);
check("sample list body carries no Riot ID",
  JSON.stringify(out.res.sent?.body ?? {}).match(/"[^"]{3,32}#[A-Za-z0-9]{2,5}"/g),
  null);

checkTrue("server declares public sample list projection helper",
  /function publicSampleListEntry\(sample\)/.test(serverSrc));

checkTrue("sample list endpoint uses public sample list projection helper",
  /samples:\s*manifest\.samples\.map\(publicSampleListEntry\)/.test(serverSrc));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
