// 샘플 API 신원 노출 HTTP 회귀 테스트 — 실제로 server.js를 부팅해 응답 본문을 훑는다.
//
// 배경: manifest의 publicAlias 필드는 이름과 달리 실제 Riot ID(`Name#TAG`)를 담는다.
// sites/ 공개 번들에서는 stage-assets.mjs와 worker가 이 필드를 제거했지만,
// server.js의 read-only 데모 모드도 외부 노출 경로다(external-access-deployment-plan.md,
// npm run smoke:external:readonly). 두 경로 모두에서 막혀야 한다.
//
// 검증 방식: 키 이름만 보지 않고 응답 문자열 전체를 Riot ID 패턴으로 스캔한다.
// 필드 이름이 안전해 보인다고 믿으면 안 된다는 게 이 버그의 교훈이다.

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 8322;
const HOST = "127.0.0.1";
// Riot ID는 `표시이름#태그` 형태다. JSON 문자열 값 안에 이 모양이 있으면 신원 노출로 본다.
const RIOT_ID_PATTERN = /"[^"]{3,32}#[A-Za-z0-9]{2,5}"/g;

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function request(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: HOST, port: PORT, path: urlPath, method: "GET" },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { body += c; });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function waitForReady(child, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      if ((await request("/healthz")).status === 200) return;
    } catch {
      // 아직 listen 전 — 재시도
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not become ready");
}

// 외부 공개용 모드로 띄운다 — 유출이 실제로 문제가 되는 모드다.
const child = spawn(process.execPath, ["server.js"], {
  cwd: repoRoot,
  env: { ...process.env, PORT: String(PORT), HOST, PUBLIC_DEMO_MODE: "readonly" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
child.stdout.on("data", (c) => { serverLog += c; });
child.stderr.on("data", (c) => { serverLog += c; });

try {
  await waitForReady(child);

  const list = await request("/api/samples");
  check("sample list responds", list.status, 200);
  const samples = JSON.parse(list.body).samples || [];
  check("sample list is non-empty", samples.length > 0, true);
  check(
    "sample list drops publicAlias",
    samples.filter((entry) => "publicAlias" in entry).length,
    0,
  );
  check("sample list carries no Riot ID", list.body.match(RIOT_ID_PATTERN), null);

  const detail = await request(`/api/samples/${samples[0].id}`);
  check("sample detail responds", detail.status, 200);
  check("sample detail drops publicAlias", "publicAlias" in JSON.parse(detail.body), false);
  check("sample detail carries no Riot ID", detail.body.match(RIOT_ID_PATTERN), null);
} catch (error) {
  console.log(`FAIL  harness error: ${error.message}`);
  if (serverLog.trim()) console.log(serverLog.trim());
  fail += 1;
} finally {
  child.kill();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
