// CSS 토큰 커버리지 회귀 테스트 (2026-07-26).
//
// docs/superpowers/specs/2026-07-26-css-token-coverage-design.md 의 치환을 고정한다.
// 줄 번호는 토큰 블록 추가로 이동하므로 셀렉터 블록 단위로 검증한다.

import fs from "fs";

const css = fs.readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

let pass = 0, fail = 0;
function checkTrue(label, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || !detail ? "" : `  — ${detail}`}`);
  cond ? pass++ : fail++;
}

// 주석을 공백으로 치환(길이 보존)해 셀렉터 탐색이 주석 안 문자열에 걸리지 않게 한다.
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

// `selector {` 로 시작하는 규칙 블록의 본문을 중괄호 균형으로 잘라 반환한다.
//
// ruleBody는 indexOf 기반이라 같은 needle이 여러 번 나오면 "첫 번째"를 반환한다.
// 이 파일이 쓰는 모든 셀렉터에 대해 첫 매치가 의도한 기본 규칙인지 확인했다:
//   .evidence-lab {        3회 — 첫 매치 L4915 (토큰 정의 블록) OK
//   .evidence-lab__mode {  2회 — 첫 매치 L5000 (기본 규칙, 두 번째는 미디어쿼리) OK
//   .tf-tag {              3회 — 첫 매치 L4883 (기본 규칙, 나머지는 `… .tf-tag {` 부분일치) OK
// 새 셀렉터를 추가할 때는 `grep -cF '<selector> {' styles.css` 로 같은 확인을 할 것.
function ruleBody(selector) {
  const needle = `${selector} {`;
  const at = stripped.indexOf(needle);
  if (at < 0) return null;
  const open = at + needle.length - 1;
  let depth = 0;
  for (let i = open; i < stripped.length; i += 1) {
    if (stripped[i] === "{") depth += 1;
    else if (stripped[i] === "}") {
      depth -= 1;
      if (depth === 0) return stripped.slice(open + 1, i);
    }
  }
  return null;
}

const norm = (s) => String(s).replace(/\s+/g, " ").trim();

// 블록 본문에서 `name: value;` 를 찾아 공백 정규화 후 기대값과 비교한다.
function hasDeclaration(body, name, expectedValue) {
  const m = (body || "").match(new RegExp(`${name}\\s*:([^;]+);`));
  return m ? norm(m[1]) === norm(expectedValue) : false;
}

// ─── Task 2: .evidence-lab 알파 파생 레이어 ──────────────────────────────
const evidenceLab = ruleBody(".evidence-lab");
checkTrue(".evidence-lab rule block found", evidenceLab !== null);

const EVIDENCE_ALPHA_TOKENS = [
  ["--evidence-border-alpha", "38%"],
  ["--evidence-border-cyan", "color-mix(in srgb, var(--evidence-cyan) var(--evidence-border-alpha), transparent)"],
  ["--evidence-border-green", "color-mix(in srgb, var(--evidence-green) var(--evidence-border-alpha), transparent)"],
  ["--evidence-border-red", "color-mix(in srgb, var(--evidence-red) var(--evidence-border-alpha), transparent)"],
  ["--evidence-ring-cyan", "color-mix(in srgb, var(--evidence-cyan) 24%, transparent)"],
  ["--evidence-fill-alpha", "8%"],
  ["--evidence-fill-cyan", "color-mix(in srgb, var(--evidence-cyan) var(--evidence-fill-alpha), transparent)"],
  ["--evidence-fill-green", "color-mix(in srgb, var(--evidence-green) var(--evidence-fill-alpha), transparent)"],
  ["--evidence-fill-green-soft", "color-mix(in srgb, var(--evidence-green) 14%, transparent)"],
  ["--evidence-grid-blue", "color-mix(in srgb, var(--evidence-blue) 3.5%, transparent)"],
];
for (const [name, value] of EVIDENCE_ALPHA_TOKENS) {
  checkTrue(`${name} defined in .evidence-lab`, hasDeclaration(evidenceLab, name, value));
}

// 치환된 리터럴은 파일 전체에서 사라져야 한다.
const EVIDENCE_RETIRED_LITERALS = [
  "rgba(79, 140, 255, 0.035)",
  "rgba(54, 214, 231, 0.42)",
  "rgba(54, 214, 231, 0.08)",
  "rgba(54, 214, 231, 0.24)",
  "rgba(85, 214, 154, 0.38)",
  "rgba(85, 214, 154, 0.34)",
  "rgba(85, 214, 154, 0.08)",
  "rgba(85, 214, 154, 0.14)",
  "rgba(255, 115, 128, 0.4)",
];
for (const lit of EVIDENCE_RETIRED_LITERALS) {
  checkTrue(`literal retired: ${lit}`, !stripped.includes(lit), "치환되지 않은 리터럴이 남아 있다");
}

// 개별 사용처가 올바른 토큰을 참조하는지 확인한다.
checkTrue(
  ".evidence-lab__mode border uses --evidence-border-cyan",
  hasDeclaration(ruleBody(".evidence-lab__mode"), "border", "1px solid var(--evidence-border-cyan)"),
);
checkTrue(
  ".evidence-lab__mode background uses --evidence-fill-cyan",
  hasDeclaration(ruleBody(".evidence-lab__mode"), "background", "var(--evidence-fill-cyan)"),
);
checkTrue(
  "WIN badge border-color uses --evidence-border-green",
  hasDeclaration(ruleBody('.evidence-hero__context span[data-result="WIN"]'), "border-color", "var(--evidence-border-green)"),
);
checkTrue(
  "LOSS badge border-color uses --evidence-border-red",
  hasDeclaration(ruleBody('.evidence-hero__context span[data-result="LOSS"]'), "border-color", "var(--evidence-border-red)"),
);
checkTrue(
  "quality badge border uses --evidence-border-green",
  hasDeclaration(ruleBody(".evidence-hero__quality span"), "border", "1px solid var(--evidence-border-green)"),
);
checkTrue(
  "quality badge background uses --evidence-fill-green",
  hasDeclaration(ruleBody(".evidence-hero__quality span"), "background", "var(--evidence-fill-green)"),
);
checkTrue(
  "grid overlay uses --evidence-grid-blue twice",
  (ruleBody(".evidence-lab::before") || "").split("var(--evidence-grid-blue)").length - 1 === 2,
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
