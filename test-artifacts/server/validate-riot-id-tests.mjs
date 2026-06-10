// validateRiotId 입력 검증 회귀 테스트.
//
// server.js의 validateRiotId(gameName, tagLine)는 Riot ID 입력을 검증한다.
// 유효하면 null, 그렇지 않으면 한국어 에러 문자열을 반환한다.
//   - gameName: 3~16자, [a-zA-Z0-9가-힣\s_.] 만 허용
//   - tagLine : 2~5자,  [a-zA-Z0-9] 만 허용
// 길이 검사가 문자셋 검사보다 먼저 수행된다.

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

const harness = new Function([
  extractFunctionSource(serverSrc, "validateRiotId"),
  "return { validateRiotId };",
].join("\n"))();

const validateRiotId = harness.validateRiotId;

const LENGTH_GAME = "gameName은 3~16자여야 합니다.";
const LENGTH_TAG = "tagLine은 2~5자여야 합니다.";
const CHARSET_GAME = "gameName에 허용되지 않는 문자가 있습니다.";
const CHARSET_TAG = "tagLine은 영문/숫자만 허용됩니다.";

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

// 1) 경계 길이 통과 (유효 문자 구성)
check("gameName 3자 경계 통과", validateRiotId("abc", "KR"), null);
check("gameName 16자 경계 통과", validateRiotId("abcdefghijklmnop", "KR"), null);
check("tagLine 2자 경계 통과", validateRiotId("Player", "KR"), null);
check("tagLine 5자 경계 통과", validateRiotId("Player", "KR123"), null);

// 2) 길이 위반
check("gameName 2자 길이 에러", validateRiotId("ab", "KR"), LENGTH_GAME);
check("gameName 17자 길이 에러", validateRiotId("abcdefghijklmnopq", "KR"), LENGTH_GAME);
check("gameName 빈 문자열 길이 에러", validateRiotId("", "KR"), LENGTH_GAME);
check("gameName undefined(falsy) 길이 에러", validateRiotId(undefined, "KR"), LENGTH_GAME);
check("gameName null(falsy) 길이 에러", validateRiotId(null, "KR"), LENGTH_GAME);

check("tagLine 1자 길이 에러", validateRiotId("Player", "K"), LENGTH_TAG);
check("tagLine 6자 길이 에러", validateRiotId("Player", "KR1234"), LENGTH_TAG);
check("tagLine 빈 문자열 길이 에러", validateRiotId("Player", ""), LENGTH_TAG);
check("tagLine undefined(falsy) 길이 에러", validateRiotId("Player", undefined), LENGTH_TAG);
check("tagLine null(falsy) 길이 에러", validateRiotId("Player", null), LENGTH_TAG);

// 3) gameName 문자셋
check("gameName 한글 허용", validateRiotId("매운맛", "KR"), null);
check("gameName 영문/숫자 허용", validateRiotId("Player123", "KR"), null);
check("gameName 공백 허용", validateRiotId("ab cd", "KR"), null);
check("gameName 언더스코어 허용", validateRiotId("a_b_c", "KR"), null);
check("gameName 마침표 허용", validateRiotId("a.b.c", "KR"), null);
check("gameName 느낌표 거부", validateRiotId("abc!", "KR"), CHARSET_GAME);
check("gameName @기호 거부", validateRiotId("a@b", "KR"), CHARSET_GAME);

// 4) tagLine 문자셋 (길이 2~5 범위 내에서 검사)
check("tagLine 영문/숫자 허용", validateRiotId("Player", "ab12"), null);
check("tagLine 한글 거부", validateRiotId("Player", "한글"), CHARSET_TAG);
check("tagLine 공백 거부", validateRiotId("Player", "a b"), CHARSET_TAG);
check("tagLine 마침표 거부", validateRiotId("Player", "a.b"), CHARSET_TAG);
check("tagLine 언더스코어 거부", validateRiotId("Player", "a_b"), CHARSET_TAG);
check("tagLine 느낌표 거부", validateRiotId("Player", "kr!"), CHARSET_TAG);

// 5) 검사 순서: 길이 검사가 문자셋 검사보다 먼저
//    gameName이 17자(길이 위반)이면서 동시에 불량 문자(!)를 포함해도
//    문자셋 에러가 아니라 길이 에러가 먼저 반환되어야 한다.
check("gameName 길이 검사가 문자셋 검사보다 우선",
  validateRiotId("abcdefghijklmnop!", "KR"), LENGTH_GAME);
//    tagLine도 동일하게 길이 검사가 우선이어야 한다.
check("tagLine 길이 검사가 문자셋 검사보다 우선",
  validateRiotId("Player", "abcde!"), LENGTH_TAG);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
