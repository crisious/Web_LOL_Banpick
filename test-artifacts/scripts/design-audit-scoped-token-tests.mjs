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
    report.radius.tokenReferences === 0
      && report.radius.rawGroups.some((g) => g.value === "16px" && g.matchingTokens.includes("--radius-md")),
    `radius=${JSON.stringify(report.radius.rawGroups)}`,
  );
  checkTrue(
    "gap 7px is audited as raw",
    report.spacing.rawGroups.some((g) => g.value === "7px"),
    `spacing=${JSON.stringify(report.spacing.rawGroups)}`,
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
    report.colors.tokenReferences === 1,
    `tokenReferences=${report.colors.tokenReferences} (expected 1: var(--brand) in .widget--active:hover)`,
  );
}

fs.rmSync(fixture, { force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
