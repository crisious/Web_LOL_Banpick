// 정적 자산 서빙 HTTP 회귀 테스트 — 실제로 server.js를 부팅해 요청한다.
//
// 다른 server 테스트들은 server.js 소스에서 함수를 추출해 new Function으로 평가한다.
// 그 방식은 함수 단위 동작은 잡지만 "배선"은 잡지 못한다. 예를 들어 index.html이
// /og.png를 og:image로 선언했는데 publicStaticPaths에 빠져 403이 나는 버그는
// 추출식 테스트를 전부 통과한다. 이 파일은 그 계층을 메운다.
//
// 검증 대상: 브라우저가 실제로 받는 응답 코드.

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 8321;
const HOST = "127.0.0.1";

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function request(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: HOST, port: PORT, path: urlPath, method: "GET" },
      (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers }));
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
      const res = await request("/healthz");
      if (res.status === 200) return;
    } catch {
      // 아직 listen 전 — 재시도
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not become ready");
}

const child = spawn(process.execPath, ["server.js"], {
  cwd: repoRoot,
  env: { ...process.env, PORT: String(PORT), HOST, PUBLIC_DEMO_MODE: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
child.stdout.on("data", (c) => { serverLog += c; });
child.stderr.on("data", (c) => { serverLog += c; });

try {
  await waitForReady(child);

  // index.html이 og:image / twitter:image로 선언하는 자산은 서빙되어야 한다.
  // 안 그러면 카카오톡·디스코드·트위터 링크 미리보기가 통째로 깨진다.
  const og = await request("/og.png");
  check("GET /og.png serves the declared og:image", og.status, 200);
  check("GET /og.png is typed as an image", og.headers["content-type"], "image/png");

  // 허용된 자산은 계속 서빙되어야 한다.
  for (const allowed of ["/", "/index.html", "/main.js", "/styles.css", "/admin.html", "/draft-state.js"]) {
    check(`GET ${allowed} is served`, (await request(allowed)).status, 200);
  }

  // 정적 서빙은 allowlist(기본 거부)다. 아래는 allowlist에 없으므로 전부 거부되어야 한다.
  // publicStaticPaths를 넓힐 때 이 목록이 회귀를 잡는다.
  for (const denied of [
    "/.env",
    "/package.json",
    "/PLAN.md",
    "/README.md",
    "/server.js",
    "/data/samples/manifest.json",
    "/scripts/design-audit.js",
    "/test-artifacts/run-tests.mjs",
    "/_design-mockups/improved-full.html",
    "/../package.json",
    "/%2e%2e/package.json",
  ]) {
    check(`GET ${denied} is refused`, (await request(denied)).status, 403);
  }
} catch (error) {
  console.log(`FAIL  harness error: ${error.message}`);
  if (serverLog.trim()) console.log(serverLog.trim());
  fail += 1;
} finally {
  child.kill();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
