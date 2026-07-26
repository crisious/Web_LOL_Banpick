// design-audit.js 컴포넌트 스코프 토큰 처리 테스트 (2026-07-26).
//
// 감사 도구는 :root 외의 블록에서 정의된 커스텀 프로퍼티도 "토큰 정의"로 보고
// raw 값 집계에서 제외해야 한다. 단 같은 블록의 일반 선언은 계속 감사해야 한다.
//
// 픽스처는 test-artifacts/tmp/ (gitignore 대상)에 런타임 생성한다.

import fs from "fs";
import path from "path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const tmpDir = path.join(repoRoot, "test-artifacts/tmp");
const fixture = path.join(tmpDir, "scoped-token-fixture.css");

let pass = 0, fail = 0;
function checkTrue(label, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || !detail ? "" : `  — ${detail}`}`);
  cond ? pass++ : fail++;
}

// :root 토큰 + 컴포넌트 스코프 토큰 + 컴포넌트의 일반 선언(감사 대상)을 모두 담는다.
const FIXTURE_CSS = `:root {
  --radius-md: 16px;
  --space-2: 8px;
  --brand: #112233;
}

.widget {
  --widget-bg: #445566;
  --widget-line: #778899;
  border-radius: 16px;
  gap: 7px;
  background: #445566;
  box-shadow: 0 1px 2px rgba(1, 2, 3, 0.4);
}

/* BEM 변형 클래스 + 의사 클래스. \`--active:hover\` 를 커스텀 프로퍼티 선언으로
   오인하면 안 된다 — 오인하면 그 "선언 범위"가 감사에서 제외되어 뒤따르는
   background 선언의 토큰 참조가 사라진다. */
.widget--active:hover {
  background: var(--brand);
}

/* :root 밖의 진짜 커스텀 프로퍼티 선언. 이건 정의이므로 제외되어야 한다. */
.widget--themed {
  --widget-accent: var(--brand);
  color: var(--widget-accent);
}

/* 컴포넌트 스코프 치수 토큰. 이름 접두가 --radius- / --space- 가 아니지만
   실제로 선언된 토큰이므로 "토큰화됨"으로 크레딧되어야 한다. */
.widget--scoped {
  --widget-radius: 9px;
  --widget-gap: 3px;
  border-radius: var(--widget-radius);
  gap: var(--widget-gap);
}

/* 선언되지 않은 토큰을 폴백과 함께 참조. 실제 토큰이 아니므로 크레딧되면 안 된다. */
.widget--fallback {
  gap: var(--not-declared, 6px);
}

/* color-mix() 로 파생한 색상 토큰. looksLikeColor 가 현대 색상 함수를 인식해야
   이 토큰이 색상으로 분류되고, 그 참조가 색상 토큰 참조로 크레딧된다. */
.widget--derived {
  --widget-tint: color-mix(in srgb, var(--brand) 50%, transparent);
  border-color: var(--widget-tint);
}

/* padding / margin 은 spacing(gap)과 별개 카테고리로 감사된다.
   0 과 auto 는 키워드로 취급해 raw 로 세지 않는다. */
.widget--box {
  padding: 11px;
  padding-left: var(--space-2);
  margin: 0;
  margin-top: 13px;
  margin-right: auto;
}
`;

fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(fixture, FIXTURE_CSS);

const run = spawnSync(
  process.execPath,
  [path.join(repoRoot, "scripts/design-audit.js"), "--file", fixture, "--format", "json", "--top", "999"],
  { encoding: "utf8" },
);

checkTrue("audit exits 0", run.status === 0, `status=${run.status} stderr=${(run.stderr || "").trim()}`);

let report = null;
try {
  report = JSON.parse(run.stdout);
} catch (error) {
  checkTrue("audit emits valid JSON", false, error.message);
}

if (report) {
  const rawColorValues = report.colors.rawGroups.map((g) => g.value);

  // 1. 컴포넌트 스코프 토큰 정의값은 raw 색상으로 집계되지 않는다.
  //    #778899는 정의에만 등장하므로 raw 목록에서 완전히 빠져야 한다.
  checkTrue(
    "scoped token definition #778899 is not counted as raw",
    !rawColorValues.includes("#778899"),
    `rawGroups=${JSON.stringify(rawColorValues)}`,
  );

  // 2. 같은 블록의 일반 선언은 계속 감사된다. background: #445566 는 raw로 남아야 한다.
  //    정의(--widget-bg)는 제외, 사용(background)은 집계 — 이 둘을 구분하는 것이 이 수정의 핵심이다.
  const backgroundGroup = report.colors.rawGroups.find((g) => g.value === "#445566");
  checkTrue(
    "the widget's background usage is still audited exactly once",
    backgroundGroup !== undefined && backgroundGroup.count === 1,
    `expected count 1, got ${backgroundGroup ? backgroundGroup.count : "none"}`,
  );

  // 3. box-shadow 안의 raw 색도 계속 잡힌다.
  checkTrue(
    "box-shadow raw color is still audited",
    rawColorValues.includes("rgba(1, 2, 3, 0.4)"),
    `rawGroups=${JSON.stringify(rawColorValues)}`,
  );

  // 4. 컴포넌트의 border-radius / gap 은 계속 감사된다.
  checkTrue(
    "border-radius 16px is audited and matched to --radius-md",
    report.radius.rawGroups.some((g) => g.value === "16px" && g.matchingTokens.includes("--radius-md")),
    `radius=${JSON.stringify(report.radius.rawGroups)}`,
  );
  checkTrue(
    "gap 7px is audited as raw",
    report.spacing.rawGroups.some((g) => g.value === "7px"),
    `spacing=${JSON.stringify(report.spacing.rawGroups)}`,
  );

  // 4b. 컴포넌트 스코프 치수 토큰 참조는 이름 접두가 달라도 크레딧된다.
  //     `--widget-radius` / `--widget-gap` 은 --radius- / --space- 접두가 아니지만
  //     실제 선언된 토큰이므로 "토큰화됨"으로 세어야 한다.
  checkTrue(
    "scoped radius token reference is credited",
    report.radius.tokenReferences === 1
      && !report.radius.rawGroups.some((g) => g.value.includes("var(--widget-radius)")),
    `refs=${report.radius.tokenReferences} raw=${JSON.stringify(report.radius.rawGroups.map((g) => g.value))}`,
  );
  checkTrue(
    "scoped gap token reference is credited",
    report.spacing.tokenReferences === 1
      && !report.spacing.rawGroups.some((g) => g.value.includes("var(--widget-gap)")),
    `refs=${report.spacing.tokenReferences} raw=${JSON.stringify(report.spacing.rawGroups.map((g) => g.value))}`,
  );

  // 4c. 선언되지 않은 토큰 참조는 크레딧되지 않는다 — 실제 토큰이 아니다.
  checkTrue(
    "undeclared token reference is not credited",
    report.spacing.rawGroups.some((g) => g.value.includes("var(--not-declared")),
    `spacing raw=${JSON.stringify(report.spacing.rawGroups.map((g) => g.value))}`,
  );

  // 5. :root 토큰 정의는 이전과 같이 제외된다 (회귀 방지).
  checkTrue(
    "root token definition #112233 is not counted as raw",
    !rawColorValues.includes("#112233"),
    `rawGroups=${JSON.stringify(rawColorValues)}`,
  );

  // 6. 컴포넌트 스코프 토큰도 customProps 검사에서 "정의됨"으로 인식된다 (기존 동작 회귀 방지).
  checkTrue(
    "no missing custom property references reported",
    Array.isArray(report.customProps) && report.customProps.length === 0,
    `customProps=${JSON.stringify(report.customProps)}`,
  );

  // 7. BEM 변형 클래스(`.widget--active:hover`)를 커스텀 프로퍼티 선언으로 오인하지 않는다.
  //    오인하면 그 범위가 blank 되어 뒤따르는 `background: var(--brand)` 의 토큰 참조가 사라진다.
  //
  //    기대 참조 수는 1이다. analyzeColors 의 tokenNames 는 rootTokens 에서만 만들어지므로
  //    (buildReport: buildTokenIndex(rootTokens)) `:root` 에 있는 --brand 만 세어지고,
  //    컴포넌트 스코프 토큰인 --widget-accent 참조는 크레딧되지 않는다.
  //    --widget-accent: var(--brand) 는 "정의"이므로 제외되는 것이 맞다.
  checkTrue(
    "BEM modifier class is not mistaken for a custom property declaration",
    report.colors.rawGroups.every((g) => !g.value.includes("hover")),
    `rawGroups=${JSON.stringify(report.colors.rawGroups.map((g) => g.value))}`,
  );

  // 8. 색상 참조 크레딧이 :root 를 넘어 확장된다.
  //    기대 3건:
  //      .widget--active:hover  background: var(--brand)         :root 색상 토큰
  //      .widget--themed        color: var(--widget-accent)      별칭(--brand) 1단 해석
  //      .widget--derived       border-color: var(--widget-tint) color-mix() 파생
  //    각 토큰의 "정의" 안에 있는 var(--brand) 는 blank 되므로 세어지지 않는다.
  checkTrue(
    "color references are credited beyond :root tokens",
    report.colors.tokenReferences === 3,
    `tokenReferences=${report.colors.tokenReferences} (expected 3: --brand, --widget-accent alias, --widget-tint color-mix)`,
  );

  // 9. 치수 토큰은 색상으로 잘못 분류되지 않는다.
  //    --widget-radius: 9px / --widget-gap: 3px / --radius-md: 16px 는 색상이 아니다.
  checkTrue(
    "dimension tokens are not misclassified as colors",
    report.colors.tokenReferences === 3,
    `색상 참조가 3을 넘으면 치수 토큰 참조까지 세고 있다는 뜻 (실제 ${report.colors.tokenReferences})`,
  );

  // 10. padding / margin 이 spacing(gap)과 별개 카테고리로 감사된다.
  //     spacing 은 gap 계열만 재는 지표라 과거 기록과 비교 가능해야 하므로
  //     padding/margin 을 여기에 섞지 않는다.
  checkTrue(
    "padding is a separate category",
    report.padding !== undefined && report.padding.tokenReferences === 1 && report.padding.rawTotal === 1,
    `padding=${JSON.stringify(report.padding)}`,
  );
  checkTrue(
    "padding raw value is 11px and it suggests no single token",
    report.padding?.rawGroups.some((g) => g.value === "11px"),
    `padding raw=${JSON.stringify(report.padding?.rawGroups)}`,
  );
  checkTrue(
    "margin is a separate category",
    report.margin !== undefined && report.margin.tokenReferences === 0 && report.margin.rawTotal === 1,
    `margin=${JSON.stringify(report.margin)}`,
  );
  checkTrue(
    "margin 0 and auto are treated as keywords, not raw values",
    report.margin?.rawGroups.every((g) => g.value !== "0" && g.value !== "auto"),
    `margin raw=${JSON.stringify(report.margin?.rawGroups)}`,
  );
  // spacing 은 gap 계열만 재야 한다. padding 의 11px 나 margin 의 13px 이 섞이면
  // 과거 기록과 비교가 깨진다.
  checkTrue(
    "spacing stays gap-only (padding/margin not folded in)",
    report.spacing.rawGroups.some((g) => g.value === "7px")
      && report.spacing.rawGroups.every((g) => g.value !== "11px" && g.value !== "13px"),
    `spacing raw=${JSON.stringify(report.spacing.rawGroups.map((g) => g.value))}`,
  );
}

// ─── 잘림 표시 ────────────────────────────────────────────────────────────
// --top 기본값이 8이고 잘림 표시가 없어서 한 번 실행한 결과를 전수로 오해하기 쉽다.
// 잘렸으면 몇 건이 숨었는지 알려야 한다.
{
  fs.writeFileSync(fixture, FIXTURE_CSS);
  const truncated = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts/design-audit.js"), "--file", fixture, "--scope", "colors", "--top", "1"],
    { encoding: "utf8" },
  );
  const out = truncated.stdout || "";
  checkTrue("truncated run exits 0", truncated.status === 0, (truncated.stderr || "").trim());
  checkTrue(
    "truncated group list reports how many were hidden",
    /\b1 more\b/.test(out),
    `출력에 "1 more" 표기가 없다:\n${out}`,
  );

  // 잘리지 않았을 때는 표기가 없어야 한다 (노이즈 방지).
  const full = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts/design-audit.js"), "--file", fixture, "--scope", "colors", "--top", "999"],
    { encoding: "utf8" },
  );
  checkTrue(
    "untruncated run has no hidden-count note",
    !/\bmore\b/.test(full.stdout || ""),
    `잘리지 않았는데 표기가 있다:\n${full.stdout}`,
  );
}

fs.rmSync(fixture, { force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
