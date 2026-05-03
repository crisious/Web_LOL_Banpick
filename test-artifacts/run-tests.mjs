#!/usr/bin/env node
// Track Q — 모든 test-artifacts/**/*-tests.mjs 일괄 실행 + 합계 출력
//
// 새 테스트 파일을 추가할 때 이 파일은 수정 불필요. test-artifacts/ 안에서
// `*-tests.mjs` 글롭으로 자동 발견.
//
// 사용:
//   npm test
//   node test-artifacts/run-tests.mjs

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

function findTestFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...findTestFiles(full));
    } else if (entry.endsWith("-tests.mjs") && entry !== "run-tests.mjs") {
      out.push(full);
    }
  }
  return out;
}

const testFiles = findTestFiles(here).sort();
if (testFiles.length === 0) {
  console.log("No *-tests.mjs found under test-artifacts/.");
  process.exit(0);
}

let totalPass = 0;
let totalFail = 0;
const failedFiles = [];

for (const file of testFiles) {
  const rel = path.relative(process.cwd(), file);
  console.log(`\n──── ${rel} ────`);
  const result = spawnSync(process.execPath, [file], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  // 각 테스트 파일은 마지막 줄에 "N passed, N failed" 또는 "N pass / N fail" 출력
  const m = stdout.match(/(\d+)\s+(?:passed|pass)\s*[,/]\s*(\d+)\s+(?:failed|fail)/i);
  if (m) {
    totalPass += Number(m[1]);
    totalFail += Number(m[2]);
  } else {
    // 카운트 파싱 실패 = 형식 미준수 — fail로 간주
    totalFail += 1;
    failedFiles.push(`${rel} (no count line)`);
  }
  if (result.status !== 0) {
    failedFiles.push(rel);
  }
}

console.log(`\n──── 합계 ────`);
console.log(`${totalPass} passed, ${totalFail} failed across ${testFiles.length} test file(s)`);
if (failedFiles.length > 0) {
  console.log(`Failed files:\n  - ${failedFiles.join("\n  - ")}`);
  process.exit(1);
}
process.exit(0);
