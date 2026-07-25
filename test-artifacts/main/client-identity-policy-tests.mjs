// 클라이언트 신원 노출 정책 테스트.
//
// 이건 동작 테스트가 아니라 금지 규칙(린트 성격)이다. 서버가 publicAlias를 더 이상
// 내려보내지 않으므로(server.js publicSampleListEntry / loadSampleBundle),
// 클라이언트에 남은 참조는 전부 undefined로 평가되어 "undefined"를 그리거나
// 하드코딩된 가짜 Riot ID 플레이스홀더를 노출한다.
//
// 검증 대상: 브라우저로 나가는 스크립트에 Riot ID 모양 리터럴과 죽은 publicAlias
// 참조가 남아 있지 않을 것.

import fs from "fs";

// 주석은 정책 대상이 아니다 — 왜 필드를 뺐는지 설명하는 주석은 남아야 한다.
// 검사 대상은 실제로 값을 읽는 코드다.
function stripLineComments(source) {
  return source.replace(/^\s*\/\/.*$/gm, "");
}

const targets = ["main.js", "admin.js", "draft-state.js"].map((name) => ({
  name,
  src: stripLineComments(fs.readFileSync(new URL(`../../${name}`, import.meta.url), "utf8")),
}));

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

// 문자열 리터럴 안에 `이름#태그` 형태가 박혀 있으면 가짜든 진짜든 신원 표기다.
const RIOT_ID_LITERAL = /"[^"\n]{3,32}#[A-Za-z0-9]{2,5}"|'[^'\n]{3,32}#[A-Za-z0-9]{2,5}'/g;

for (const { name, src } of targets) {
  check(`${name} has no hardcoded Riot ID literal`, src.match(RIOT_ID_LITERAL), null);
  check(`${name} does not read publicAlias`, src.includes("publicAlias"), false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
