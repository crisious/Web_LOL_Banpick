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

// ─── Task 3: .tf-phase-row 스코프 토큰 ───────────────────────────────────
const tfRow = ruleBody(".tf-phase-row");
checkTrue(".tf-phase-row rule block found", tfRow !== null);

const TF_TOKENS = [
  ["--tf-line", "var(--surface-4)"],
  ["--tf-win", "#6ee7b7"],
  ["--tf-loss", "#f47272"],
  ["--tf-fill-alpha", "17%"],
  ["--tf-win-fill", "color-mix(in srgb, var(--tf-win) var(--tf-fill-alpha), transparent)"],
  ["--tf-loss-fill", "color-mix(in srgb, var(--tf-loss) var(--tf-fill-alpha), transparent)"],
];
for (const [name, value] of TF_TOKENS) {
  checkTrue(`${name} defined in .tf-phase-row`, hasDeclaration(tfRow, name, value));
}

// 미정의 토큰 참조가 사라졌는지 — 이게 이 태스크가 고치는 버그다.
checkTrue("--border-subtle reference removed", !stripped.includes("--border-subtle"),
  "정의되지 않은 토큰을 폴백과 함께 참조하고 있다");
checkTrue("--text-muted reference removed from styles.css", !stripped.includes("--text-muted"),
  "정의되지 않은 토큰을 폴백과 함께 참조하고 있다");

// 치환된 리터럴이 사라졌는지.
for (const lit of ["rgba(244, 114, 114, 0.18)", "rgba(110, 231, 183, 0.16)"]) {
  checkTrue(`literal retired: ${lit}`, !stripped.includes(lit));
}

// 사용처 참조 확인.
checkTrue(".tf-phase-row border-top uses --tf-line",
  hasDeclaration(tfRow, "border-top", "1px solid var(--tf-line)"));
// .tf-tag / .tf-kd 는 글자색을 선언하지 않는다. 두 요소 모두 .moment-copy 안의 span 이라
// `… .moment-copy span …` 규칙(구체성 0,2,0)이 `.tf-tag`(0,1,0)를 이겨 --muted 가 적용된다.
// 색 선언을 되살리면 화면에 나타나지도 않으면서 있는 것처럼 보이는 죽은 코드가 된다.
// `background-color` 같은 속성에 걸리지 않도록 앞 경계를 둔다.
const declaresColor = (sel) => /(?<![-\w])color\s*:/.test(ruleBody(sel) || "");
checkTrue(".tf-tag declares no color", !declaresColor(".tf-tag"),
  "구체성에 져서 적용되지 않는 색 선언이 되살아났다");
checkTrue(".tf-kd declares no color", !declaresColor(".tf-kd"),
  "구체성에 져서 적용되지 않는 색 선언이 되살아났다");
checkTrue("--tf-muted token is gone", !stripped.includes("--tf-muted"),
  "효과 없는 토큰이 되살아났다");

// WIN/LOSS 변형은 [data-outcome] 이 붙어 0,3,0 이므로 계속 적용되어야 한다.
checkTrue("loss tag still declares its color",
  hasDeclaration(ruleBody('.tf-phase-row[data-outcome="TRADE_LOST"] .tf-tag'), "color", "var(--tf-loss)"));
checkTrue("win tag still declares its color",
  hasDeclaration(ruleBody('.tf-phase-row[data-outcome="TRADE_WON"] .tf-tag'), "color", "var(--tf-win)"));

// 부정 결과 태그: 배경은 --tf-loss-fill, 글자색은 --tf-loss.
const lossTagBody = ruleBody('.tf-phase-row[data-outcome="TRADE_LOST"] .tf-tag');
checkTrue("loss tag background uses --tf-loss-fill", hasDeclaration(lossTagBody, "background", "var(--tf-loss-fill)"));
checkTrue("loss tag color uses --tf-loss", hasDeclaration(lossTagBody, "color", "var(--tf-loss)"));

// 긍정 결과 태그.
const winTagBody = ruleBody('.tf-phase-row[data-outcome="TRADE_WON"] .tf-tag');
checkTrue("win tag background uses --tf-win-fill", hasDeclaration(winTagBody, "background", "var(--tf-win-fill)"));
checkTrue("win tag color uses --tf-win", hasDeclaration(winTagBody, "color", "var(--tf-win)"));

// ─── Task 4: 반복값 토큰 ─────────────────────────────────────────────────
const REPEATED_TOKENS = [
  [".evidence-lab", "--evidence-radius", "18px"],
  [".evidence-lab", "--evidence-radius-sm", "12px"],
  [".evidence-lab", "--evidence-surface-sunken", "#091827"],
  [".evidence-lab", "--evidence-gap", "18px"],
  [":root", "--space-2", "2px"],
];
for (const [selector, name, value] of REPEATED_TOKENS) {
  checkTrue(`${name}: ${value} defined in ${selector}`, hasDeclaration(ruleBody(selector), name, value));
}

// 사용 횟수 확인. --evidence-* 는 그 컴포넌트 전용이라 총 횟수를 고정할 수 있다.
const USAGE_COUNTS = [
  ["var(--evidence-radius)", 3],
  ["var(--evidence-radius-sm)", 2],
  ["var(--evidence-surface-sunken)", 2],
  ["var(--evidence-gap)", 3],
];
for (const [ref, expected] of USAGE_COUNTS) {
  const actual = stripped.split(ref).length - 1;
  checkTrue(`${ref} used ${expected} times`, actual === expected, `실제 ${actual}회`);
}

// 전역 토큰은 총 횟수를 고정하면 다른 속성을 토큰화할 때마다 깨진다.
// 원래 의도는 "gap: 2px 5곳이 치환됐다" 이므로 gap 선언으로 한정해 센다.
// (2px 토큰의 이름은 값 기반 재편으로 --space-0 -> --space-2 로 바뀌었다.)
const gapSpace2 = (stripped.match(/(?<![-\w])(?:row-|column-)?gap:\s*var\(--space-2\)/g) || []).length;
checkTrue("gap: var(--space-2) used 5 times", gapSpace2 === 5, `실제 ${gapSpace2}회`);

// #091827 리터럴이 토큰 정의 1곳에만 남아야 한다.
checkTrue("#091827 appears only in its token definition",
  stripped.split("#091827").length - 1 === 1,
  `${stripped.split("#091827").length - 1}회 등장`);

// 리터럴 잔존 검사. 18px/12px/2px 는 padding 등 감사 대상 밖 속성에도 쓰이므로
// border-radius / gap 형태로만 한정한다.
//
// `gap:` 앞에 `(?<![-\w])` 경계를 두는 이유: 토큰 정의 `--evidence-gap: 18px;` 가
// 부분문자열로 `gap: 18px;` 를 포함하므로, 경계가 없으면 정의를 잔존 리터럴로 오판한다.
// 정의는 남아야 하고 사용처만 사라져야 한다.
checkTrue("no raw `gap: 2px` remains", !/(?<![-\w])gap:\s*2px\s*;/.test(stripped));
checkTrue("no raw `border-radius: 18px` remains", !/(?<![-\w])border-radius:\s*18px\s*;/.test(stripped));
checkTrue("no raw `border-radius: 12px` remains", !/(?<![-\w])border-radius:\s*12px\s*;/.test(stripped));
checkTrue("no raw `gap: 18px` remains", !/(?<![-\w])gap:\s*18px\s*;/.test(stripped));

// ─── 후속 B: evidence 계조 래더 ───────────────────────────────────────────
// hex 근접성으로는 드리프트처럼 보였지만 명암비로 보면 단조 증가하는 분리된
// 단계였다(텍스트 7.03 / 11.15 / 12.63 / 17.68, 테두리 1.40 / 1.99 / 2.62).
const GRADATION_TOKENS = [
  ["--evidence-text-2", "#c6d4df"],
  ["--evidence-text-3", "#b8c8d5"],
  ["--evidence-line-strong", "#2a506a"],
  ["--evidence-line-hover", "#2a6385"],
];
for (const [name, value] of GRADATION_TOKENS) {
  checkTrue(`${name}: ${value} defined in .evidence-lab`, hasDeclaration(evidenceLab, name, value));
}

// 리터럴은 토큰 정의 1곳에만 남아야 한다.
for (const [, value] of GRADATION_TOKENS) {
  const count = stripped.split(value).length - 1;
  checkTrue(`${value} appears only in its token definition`, count === 1, `${count}회 등장`);
}

// 사용처가 올바른 토큰을 참조하는지.
checkTrue("hero lede uses --evidence-text-3",
  hasDeclaration(ruleBody(".evidence-hero h3 + p"), "color", "var(--evidence-text-3)"));
checkTrue("reasoning panel body uses --evidence-text-2",
  hasDeclaration(ruleBody(".evidence-empty-fact"), "color", "var(--evidence-text-2)"));
checkTrue("protocol item border uses --evidence-line-strong",
  hasDeclaration(ruleBody(".evidence-protocol__item > span"), "border", "1px solid var(--evidence-line-strong)"));
checkTrue("moment hover border uses --evidence-line-hover",
  hasDeclaration(ruleBody(".evidence-moment:hover"), "border-color", "var(--evidence-line-hover)"));

// ─── padding / margin 기계적 치환 ─────────────────────────────────────────
// 기존 --space-* 토큰 값과 정확히 일치하는 padding/margin 값 67건을 치환했다.
// 치환 대상 값이 해당 속성에 다시 등장하면 회귀다.
//
// 검사는 속성명을 포함해서 한다. `18px` 처럼 토큰이 없어 의도적으로 리터럴로
// 남긴 값이나, 다른 속성(border-radius 등)의 같은 값을 잡지 않기 위해서다.
const SPACE_TOKEN_VALUES = ["2px", "4px", "6px", "8px", "10px", "12px", "14px", "16px", "18px", "20px", "22px", "24px"];
const BOX_PROPS = "(?:padding|margin)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?";
for (const value of SPACE_TOKEN_VALUES) {
  const re = new RegExp(`\\b${BOX_PROPS}\\s*:\\s*${value.replace(".", "\\.")}\\s*;`);
  checkTrue(`no raw padding/margin of ${value} remains`, !re.test(stripped),
    "--space-* 토큰과 값이 같은데 리터럴로 남아 있다");
}

// shorthand 는 축 순서가 의미를 가진다. 역순 케이스가 보존됐는지 고정한다.
// 12px 10px 와 10px 12px 가 각각 남아 있어야 한다.
checkTrue("shorthand axis order is preserved (12px 10px stays 12 then 10)",
  stripped.includes("var(--space-12) var(--space-10)")
    && stripped.includes("var(--space-10) var(--space-12)"),
  "축 순서가 뒤바뀌었거나 한쪽이 사라졌다");

// ─── 값 기반 래더 ─────────────────────────────────────────────────────────
// 이름의 숫자가 px 값과 일치해야 한다. 어긋나면 이름이 거짓말을 하게 되고,
// 값 사이에 새 값을 넣을 수 있다는 재편의 이점이 사라진다.
const LADDER = ["2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22", "24"];
const rootBody = ruleBody(":root");
for (const n of LADDER) {
  checkTrue(`--space-${n} is ${n}px`, hasDeclaration(rootBody, `--space-${n}`, `${n}px`));
}
// 서수 시절 이름이 남아 있으면 미정의 참조가 된다.
checkTrue("no ordinal --space-0 remains", !/(?<![\w-])--space-0\b/.test(stripped));
checkTrue("no ordinal --space-1 remains", !/(?<![\w-])--space-1\b/.test(stripped));
checkTrue("no ordinal --space-3 remains", !/(?<![\w-])--space-3\b/.test(stripped));
checkTrue("no ordinal --space-5 remains", !/(?<![\w-])--space-5\b/.test(stripped));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
