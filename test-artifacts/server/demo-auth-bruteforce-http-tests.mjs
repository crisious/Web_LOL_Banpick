// 보호 모드 토큰 브루트포스 방어 HTTP 회귀 테스트.
//
// 배경: /api/demo-auth는 토큰이 맞는지만 알려주는 순수 판별 엔드포인트다.
// 레이트리밋이 없으면 무제한 속도로 토큰을 대입해볼 수 있는 오라클이 된다
// (다른 라이브 엔드포인트에는 rateLimit이 걸려 있지만 여기에는 없었다).
//
// 검증 대상: 실패가 누적되면 429로 막히는가.

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 8323;
const HOST = "127.0.0.1";
const TOKEN = "correct-horse-battery-staple";

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function request(urlPath, { method = "GET", token } = {}) {
  return new Promise((resolve, reject) => {
    const headers = token === undefined ? {} : { authorization: `Bearer ${token}` };
    const req = http.request({ host: HOST, port: PORT, path: urlPath, method, headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { body += c; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
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

const child = spawn(process.execPath, ["server.js"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST,
    PUBLIC_DEMO_MODE: "protected",
    PUBLIC_DEMO_TOKEN: TOKEN,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
child.stdout.on("data", (c) => { serverLog += c; });
child.stderr.on("data", (c) => { serverLog += c; });

try {
  await waitForReady(child);

  check(
    "correct token is accepted",
    (await request("/api/demo-auth", { method: "POST", token: TOKEN })).status,
    200,
  );
  check(
    "wrong token is rejected",
    (await request("/api/demo-auth", { method: "POST", token: "nope" })).status,
    401,
  );

  // 연속 실패는 결국 막혀야 한다. 막히지 않으면 무제한 대입이 가능하다는 뜻이다.
  const statuses = [];
  for (let i = 0; i < 12; i += 1) {
    statuses.push((await request("/api/demo-auth", { method: "POST", token: `guess-${i}` })).status);
  }
  check("repeated wrong tokens get throttled", statuses.includes(429), true);
} catch (error) {
  console.log(`FAIL  harness error: ${error.message}`);
  if (serverLog.trim()) console.log(serverLog.trim());
  fail += 1;
} finally {
  child.kill();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
