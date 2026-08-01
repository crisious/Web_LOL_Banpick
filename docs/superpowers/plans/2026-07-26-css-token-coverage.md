# CSS 토큰 커버리지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `styles.css`의 반복 raw 값과 알파 파생 관계를 토큰으로 승격하고, 미정의 토큰 참조 버그와 `design-audit.js`의 컴포넌트 스코프 토큰 오집계를 함께 해소한다.

**Architecture:** 두 개의 컴포넌트 스코프 토큰 레이어(`.evidence-lab`, `.tf-phase-row`)에 알파 파생 토큰을 `color-mix()`로 정의하고, 알파 자체를 단일 노브 커스텀 프로퍼티로 뽑는다. 반복값은 스코프에 맞는 블록에 토큰으로 올린다. 감사 도구는 모든 커스텀 프로퍼티 선언 범위를 감사 대상에서 제외하도록 고친다.

**Tech Stack:** 의존성 0. 순수 CSS 커스텀 프로퍼티 + `color-mix()`. 테스트는 Node 내장 모듈만 쓰는 소스 추출식 `*-tests.mjs` (`test-artifacts/run-tests.mjs`가 글롭으로 자동 발견).

## Global Constraints

- **의존성 추가 금지.** 이 프로젝트는 `dependencies`/`devDependencies`가 모두 비어 있다. 빌드 단계도 없다.
- **픽셀 동일 유지.** 기존 토큰에 정확히 일치하거나 계산상 동일한 값만 쓴다. 값이 다르면 스냅하지 말고 원래 값을 담은 새 토큰을 만든다.
- **승인된 예외 2건만 시각 변화 허용.** 배지 테두리 알파 34%/40%/42% → **38%** (3곳), `.tf-tag` 배경 알파 16%/18% → **17%** (2곳). 그 외 28곳은 픽셀 동일이어야 한다.
- **`index.html` 구조와 `main.js` 속성 셀렉터 보존.** CSS만 수정한다. 단 Task 1은 `scripts/design-audit.js`를 수정한다.
- **`--evidence-*`는 `.evidence-lab` 스코프다.** `.tf-*` 규칙에서 쓰면 값이 무효화된다. index.html에서 `.evidence-lab` 섹션은 237행에서 닫히고 `#teamfight-phases`는 296행에서 시작하는 형제다.
- **`test-artifacts/design-audit/`과 `test-artifacts/tmp/`는 gitignore 대상이다** (.gitignore:11, :16). 테스트 파일을 여기에 두면 커밋되지 않아 CI에서 사라진다. 픽스처는 런타임에 생성한다.
- **테스트 파일 규약.** 파일명은 `*-tests.mjs`, 마지막 줄에 `` `${pass} passed, ${fail} failed` `` 를 출력하고 실패 시 exit 1. 이 형식을 어기면 러너가 fail로 집계한다.
- **줄 번호에 의존하는 테스트 금지.** Task 2가 `.evidence-lab`에 10줄을 추가하므로 이후 모든 줄 번호가 이동한다. 셀렉터 블록 단위로 검증한다.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `scripts/design-audit.js` | 토큰 커버리지 감사 | 수정 (2곳: L205 부근, L740) |
| `test-artifacts/scripts/design-audit-scoped-token-tests.mjs` | 감사 도구의 스코프 토큰 처리 검증 | 신규 |
| `styles.css` | 스타일 전체 | 수정 (토큰 블록 3곳 + 치환 33곳) |
| `test-artifacts/design-verify/token-coverage-tests.mjs` | 치환 33곳 회귀 고정 | 신규 |

Task 1이 감사 도구를 먼저 고치는 이유: Task 2~4가 컴포넌트 스코프 토큰 정의를 **추가**하므로, 도구를 고치지 않으면 새 정의가 raw 값으로 집계되어 커버리지가 오히려 나빠 보인다. 측정 도구를 먼저 정확하게 만들어야 이후 작업의 효과를 읽을 수 있다.

---

### Task 1: `design-audit.js` 컴포넌트 스코프 토큰 오집계 수정

**Files:**
- Modify: `scripts/design-audit.js:205-225` (`parseCustomPropertyDeclarations`에 `endIndex` 추가)
- Modify: `scripts/design-audit.js:740` (`auditSource` blank 범위 확장)
- Test: `test-artifacts/scripts/design-audit-scoped-token-tests.mjs` (신규)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `parseCustomPropertyDeclarations()`가 반환하는 각 객체에 `endIndex: number` 필드가 추가된다 (선언 문자열 `--name: value;`의 끝 오프셋, exclusive). 이후 태스크는 이 함수를 건드리지 않는다.

**배경:** 현재 `auditSource`는 `:root` 블록만 제외한다. 따라서 `.evidence-lab`이 정의하는 `--evidence-bg: #06101d;` 같은 11줄이 raw 색상으로 집계된다. 오프셋 정합성은 확인됨 — `sanitizedSource`는 `stripComments(cssSource)`이고 `stripComments`는 주석의 비개행 문자를 공백으로 바꿔 길이를 보존하므로, `cssSource`에서 파싱한 `declaredInCss`의 인덱스를 `sanitizedSource`에 그대로 적용할 수 있다.

- [ ] **Step 1: 실패하는 테스트 작성**

`test-artifacts/scripts/design-audit-scoped-token-tests.mjs` 를 신규 생성:

```javascript
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
  checkTrue(
    "scoped token definition #445566 is not counted as raw",
    !rawColorValues.includes("#445566") || rawColorValues.filter((v) => v === "#445566").length === 0,
    `rawGroups=${JSON.stringify(rawColorValues)}`,
  );
  checkTrue(
    "scoped token definition #778899 is not counted as raw",
    !rawColorValues.includes("#778899"),
    `rawGroups=${JSON.stringify(rawColorValues)}`,
  );

  // 2. 같은 블록의 일반 선언은 계속 감사된다. background: #445566 는 raw로 남아야 한다.
  //    (정의는 제외, 사용은 집계 — 이 둘을 구분하는 것이 이 수정의 핵심이다.)
  const backgroundGroup = report.colors.rawGroups.find((g) => g.value === "#445566");
  checkTrue(
    "the widget's background usage is still audited",
    backgroundGroup !== undefined && backgroundGroup.count === 1,
    `expected exactly 1 usage, got ${backgroundGroup ? backgroundGroup.count : "none"}`,
  );

  // 3. box-shadow 안의 raw 색도 계속 잡힌다.
  checkTrue(
    "box-shadow raw color is still audited",
    rawColorValues.includes("rgba(1, 2, 3, 0.4)"),
    `rawGroups=${JSON.stringify(rawColorValues)}`,
  );

  // 4. 컴포넌트의 border-radius / gap 은 계속 감사된다.
  checkTrue("border-radius 16px matched to --radius-md", report.radius.tokenReferences === 0
    && report.radius.rawGroups.some((g) => g.value === "16px" && g.matchingTokens.includes("--radius-md")));
  checkTrue("gap 7px is audited as raw", report.spacing.rawGroups.some((g) => g.value === "7px"));

  // 5. :root 토큰 정의는 이전과 같이 제외된다 (회귀 방지).
  checkTrue("root token definition #112233 is not counted as raw", !rawColorValues.includes("#112233"));
}

fs.rmSync(fixture, { force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `node test-artifacts/scripts/design-audit-scoped-token-tests.mjs`

Expected: FAIL. `scoped token definition #778899 is not counted as raw`와 `the widget's background usage is still audited`가 실패한다. 현재 도구는 정의와 사용을 구분하지 못해 `#445566`을 count 2로 집계하고 `#778899`도 raw로 올린다.

- [ ] **Step 3: `parseCustomPropertyDeclarations`에 `endIndex` 추가**

`scripts/design-audit.js`의 `result.push({...})` 블록(L215-221)을 다음으로 교체:

```javascript
    result.push({
      name,
      value,
      normalizedValue: normalizeValue(value),
      index,
      endIndex: index + match[0].length,
      line: lineNumberAt(lineStarts, index),
    });
```

- [ ] **Step 4: `auditSource`의 blank 범위 확장**

`scripts/design-audit.js:740` 한 줄을 다음으로 교체:

```javascript
  // :root 블록 전체와, 그 밖의 블록에서 정의된 커스텀 프로퍼티 "선언 범위"를 감사 대상에서 제외한다.
  // 블록 전체가 아니라 선언 범위만 제외하는 것이 중요하다 — .evidence-lab 의 gap/padding/box-shadow
  // 같은 일반 선언은 계속 감사되어야 한다.
  const auditSource = blankRanges(sanitizedSource, [
    { start: rootBlock.start, end: rootBlock.end },
    ...declaredInCss.map((entry) => ({ start: entry.index, end: entry.endIndex })),
  ]);
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `node test-artifacts/scripts/design-audit-scoped-token-tests.mjs`

Expected: PASS, `9 passed, 0 failed`.

- [ ] **Step 6: 전체 테스트 및 실제 감사 확인**

Run: `npm test`
Expected: 이전 합계(3124) + 9 = `3133 passed, 0 failed`.

Run: `node scripts/design-audit.js --top 999`
Expected: colors `rawTotal`이 57 → 46으로 감소(`.evidence-lab` 정의 11건 소멸). `#06101d`, `#0b1d2f`, `#10253a`, `#193852`, `#f1f7fb`, `#88a0b4`, `#36d6e7`, `#4f8cff`, `#55d69a`, `#f0bb59`, `#ff7380`이 raw 목록에서 사라져야 한다. 실제 커버리지 수치를 기록해 둔다 — 이후 태스크의 기준선이다.

- [ ] **Step 7: 커밋**

```bash
git add scripts/design-audit.js test-artifacts/scripts/design-audit-scoped-token-tests.mjs
git commit -m "fix(design-audit): stop counting scoped token definitions as raw values

:root 밖의 블록에서 정의된 커스텀 프로퍼티도 토큰 정의로 인식한다.
.evidence-lab이 자체 팔레트 11개를 정의하는데 이들이 raw 색상으로
오집계되어 colors 커버리지가 실제보다 낮게 나오고 있었다.

블록 전체가 아니라 선언 범위만 제외하므로 같은 블록의 일반 선언
(gap, padding, box-shadow 등)은 계속 감사된다."
```

---

### Task 2: `.evidence-lab` 알파 파생 레이어

**Files:**
- Modify: `styles.css` — `.evidence-lab` 블록에 토큰 10개 추가, 치환 11곳
- Test: `test-artifacts/design-verify/token-coverage-tests.mjs` (신규)

**Interfaces:**
- Consumes: Task 1의 감사 도구 수정 (새로 추가하는 토큰 정의가 raw로 집계되지 않아야 커버리지를 읽을 수 있다)
- Produces: `.evidence-lab` 스코프에 다음 토큰이 생긴다. Task 4가 같은 블록에 토큰을 더 추가하므로 이름 충돌을 피할 것.
  `--evidence-border-alpha`, `--evidence-border-cyan`, `--evidence-border-green`, `--evidence-border-red`, `--evidence-ring-cyan`, `--evidence-fill-alpha`, `--evidence-fill-cyan`, `--evidence-fill-green`, `--evidence-fill-green-soft`, `--evidence-grid-blue`
- Produces: `test-artifacts/design-verify/token-coverage-tests.mjs`에 `ruleBody(selector)` 헬퍼와 `hasDeclaration(body, name, value)` 헬퍼가 정의된다. Task 3, 4가 같은 파일에 검증을 덧붙인다.

- [ ] **Step 1: 실패하는 테스트 작성**

`test-artifacts/design-verify/token-coverage-tests.mjs` 를 신규 생성:

```javascript
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

// ruleBody는 indexOf 기반이라 같은 needle이 여러 번 나오면 "첫 번째"를 반환한다.
// 이 계획이 쓰는 모든 셀렉터에 대해 첫 매치가 의도한 기본 규칙인지 확인했다:
//   .evidence-lab {        3회 — 첫 매치 L4915 (토큰 정의 블록) ✓
//   .evidence-lab__mode {  2회 — 첫 매치 L5000 (기본 규칙, 두 번째는 미디어쿼리) ✓
//   .tf-tag {              3회 — 첫 매치 L4883 (기본 규칙, 나머지는 `… .tf-tag {` 부분일치) ✓
// 새 셀렉터를 추가할 때는 `grep -cF '<selector> {' styles.css`로 같은 확인을 할 것.
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
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `node test-artifacts/design-verify/token-coverage-tests.mjs`

Expected: FAIL. 토큰 10개 전부 미정의, 리터럴 9종 잔존, 사용처 참조 7건 실패.

- [ ] **Step 3: 토큰 레이어 추가**

`styles.css`의 `.evidence-lab` 블록에서 `--evidence-red: #ff7380;` 다음 줄에 삽입:

```css

  /* 알파 파생 레이어 — 베이스 색에서 계산으로 유도하므로 베이스 변경이 자동 전파된다.
     color-mix(in srgb, C p%, transparent)는 프리멀티플라이드 알파 규칙상 C를 알파 p로
     적용한 것과 픽셀 동일하다 (Chrome 150에서 4가지 배경 합성 후 바이트 비교로 검증). */
  --evidence-border-alpha: 38%;
  --evidence-border-cyan: color-mix(in srgb, var(--evidence-cyan) var(--evidence-border-alpha), transparent);
  --evidence-border-green: color-mix(in srgb, var(--evidence-green) var(--evidence-border-alpha), transparent);
  --evidence-border-red: color-mix(in srgb, var(--evidence-red) var(--evidence-border-alpha), transparent);
  --evidence-ring-cyan: color-mix(in srgb, var(--evidence-cyan) 24%, transparent);
  --evidence-fill-alpha: 8%;
  --evidence-fill-cyan: color-mix(in srgb, var(--evidence-cyan) var(--evidence-fill-alpha), transparent);
  --evidence-fill-green: color-mix(in srgb, var(--evidence-green) var(--evidence-fill-alpha), transparent);
  --evidence-fill-green-soft: color-mix(in srgb, var(--evidence-green) 14%, transparent);
  --evidence-grid-blue: color-mix(in srgb, var(--evidence-blue) 3.5%, transparent);
```

- [ ] **Step 4: 치환 11곳 적용**

각 줄에서 왼쪽 값을 오른쪽으로 바꾼다. 줄 번호는 Step 3 삽입으로 이동했으므로 **값으로 찾아서** 바꿀 것.

| 셀렉터 | 속성 | 현재 값 | 교체 |
|---|---|---|---|
| `.evidence-lab::before` | `background-image` 1번째 | `rgba(79, 140, 255, 0.035)` | `var(--evidence-grid-blue)` |
| `.evidence-lab::before` | `background-image` 2번째 | `rgba(79, 140, 255, 0.035)` | `var(--evidence-grid-blue)` |
| `.evidence-lab__mode` | `border` | `rgba(54, 214, 231, 0.42)` | `var(--evidence-border-cyan)` |
| `.evidence-lab__mode` | `background` | `rgba(54, 214, 231, 0.08)` | `var(--evidence-fill-cyan)` |
| `.evidence-hero__context span[data-result="WIN"]` | `border-color` | `rgba(85, 214, 154, 0.38)` | `var(--evidence-border-green)` |
| `.evidence-hero__context span[data-result="LOSS"]` | `border-color` | `rgba(255, 115, 128, 0.4)` | `var(--evidence-border-red)` |
| `.evidence-hero__quality span` | `border` | `rgba(85, 214, 154, 0.34)` | `var(--evidence-border-green)` |
| `.evidence-hero__quality span` | `background` | `rgba(85, 214, 154, 0.08)` | `var(--evidence-fill-green)` |
| `.evidence-score__ring` (밑줄 2개, L5099) | `box-shadow` inset | `rgba(54, 214, 231, 0.24)` | `var(--evidence-ring-cyan)` |
| `.evidence-moment[aria-pressed="true"]` | `box-shadow` inset | `rgba(54, 214, 231, 0.24)` | `var(--evidence-ring-cyan)` |
| `.evidence-protocol__item input:checked + span` | `background` | `rgba(85, 214, 154, 0.14)` | `var(--evidence-fill-green-soft)` |

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `node test-artifacts/design-verify/token-coverage-tests.mjs`
Expected: PASS, `27 passed, 0 failed`.

Run: `npm test`
Expected: `3160 passed, 0 failed`.

- [ ] **Step 6: 브라우저 픽셀 검증**

`color-mix()`의 계산 결과를 원래 리터럴과 바이트 비교한다. 이 태스크는 승인된 예외 3곳(테두리 42%/40%/34% → 38%)을 포함하므로, **8곳은 동일, 3곳은 예상된 차이**여야 한다.

스크래치패드에 검증 페이지를 만든다:

```html
<!doctype html>
<meta charset="utf-8">
<style>
  .evidence-lab { --evidence-cyan:#36d6e7; --evidence-blue:#4f8cff; --evidence-green:#55d69a; --evidence-red:#ff7380;
    --evidence-border-alpha:38%; --evidence-fill-alpha:8%; }
</style>
<div class="evidence-lab" id="host"></div>
<pre id="out"></pre>
<script>
  const CASES = [
    ['grid-blue',   'color-mix(in srgb, var(--evidence-blue) 3.5%, transparent)', 'rgba(79, 140, 255, 0.035)', true],
    ['fill-cyan',   'color-mix(in srgb, var(--evidence-cyan) var(--evidence-fill-alpha), transparent)', 'rgba(54, 214, 231, 0.08)', true],
    ['ring-cyan',   'color-mix(in srgb, var(--evidence-cyan) 24%, transparent)', 'rgba(54, 214, 231, 0.24)', true],
    ['fill-green',  'color-mix(in srgb, var(--evidence-green) var(--evidence-fill-alpha), transparent)', 'rgba(85, 214, 154, 0.08)', true],
    ['fill-grn-sf', 'color-mix(in srgb, var(--evidence-green) 14%, transparent)', 'rgba(85, 214, 154, 0.14)', true],
    ['border-green(WIN, 동일)', 'color-mix(in srgb, var(--evidence-green) var(--evidence-border-alpha), transparent)', 'rgba(85, 214, 154, 0.38)', true],
    ['border-cyan(예외 42→38)', 'color-mix(in srgb, var(--evidence-cyan) var(--evidence-border-alpha), transparent)', 'rgba(54, 214, 231, 0.42)', false],
    ['border-red(예외 40→38)', 'color-mix(in srgb, var(--evidence-red) var(--evidence-border-alpha), transparent)', 'rgba(255, 115, 128, 0.4)', false],
    ['border-green(예외 34→38)', 'color-mix(in srgb, var(--evidence-green) var(--evidence-border-alpha), transparent)', 'rgba(85, 214, 154, 0.34)', false],
  ];
  const BACKDROPS = ['#06101d', '#0b1d2f', '#ffffff', '#808080'];
  const probe = document.createElement('span');
  document.getElementById('host').appendChild(probe);
  const resolve = (v) => { probe.style.color = ''; probe.style.color = v; return probe.style.color ? getComputedStyle(probe).color : null; };
  const cv = document.createElement('canvas'); cv.width = cv.height = 8;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const paint = (c, bd) => { cx.clearRect(0,0,8,8); cx.fillStyle = bd; cx.fillRect(0,0,8,8); cx.fillStyle = c; cx.fillRect(0,0,8,8);
    return Array.from(cx.getImageData(2,2,1,1).data); };
  const rows = []; let ok = true;
  for (const [label, mix, literal, shouldMatch] of CASES) {
    const a = resolve(mix), b = resolve(literal);
    if (!a || !b) { ok = false; rows.push(`FAIL  ${label}  unsupported`); continue; }
    const same = BACKDROPS.every((bd) => paint(a, bd).join() === paint(b, bd).join());
    const good = same === shouldMatch;
    if (!good) ok = false;
    rows.push(`${good ? 'OK  ' : 'BAD '} ${label.padEnd(26)} same=${same} expected=${shouldMatch}`);
  }
  rows.push('', ok ? 'RESULT: PASS — 동일 8곳 일치, 예외 3곳만 차이' : 'RESULT: FAIL');
  document.getElementById('out').textContent = rows.join('\n');
</script>
```

`file:` 프로토콜은 브라우저 자동화에서 차단되므로 HTTP로 서브한다:

```bash
cd <scratchpad> && node -e "const h=require('http'),f=require('fs');h.createServer((q,s)=>{let b;try{b=f.readFileSync('.'+q.url.split('?')[0])}catch(e){s.writeHead(404);s.end();return}s.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});s.end(b)}).listen(8793,'127.0.0.1')" &
```

브라우저로 `http://127.0.0.1:8793/verify.html`을 열고 `#out` 텍스트를 읽는다.
Expected: `RESULT: PASS — 동일 8곳 일치, 예외 3곳만 차이`. 끝나면 서버를 종료한다.

주의: `getComputedStyle().color`는 `color-mix()` 결과를 `color(srgb …)`로, hex/rgba는 `rgba()`로 직렬화한다. 문자열 비교로는 같은 색도 다르게 보이므로 **반드시 캔버스 합성 후 바이트 비교**할 것.

- [ ] **Step 7: 커밋**

```bash
git add styles.css test-artifacts/design-verify/token-coverage-tests.mjs
git commit -m "refactor(css): derive .evidence-lab alpha variants from base tokens

cyan/green/blue/red의 알파 변형 11곳을 color-mix() 파생 토큰으로 바꾼다.
알파 자체를 --evidence-border-alpha / --evidence-fill-alpha 노브로 뽑아
베이스 색 변경이 모든 변형에 자동 전파된다.

배지 테두리 알파는 같은 역할에 34/38/40/42% 4종으로 드리프트해 있었다.
38%로 통합한다(승인된 예외) — 1px 테두리 3곳에서 최대 0.08 알파 변화.
나머지 8곳은 브라우저 캔버스 바이트 비교로 픽셀 동일을 확인했다."
```

---

### Task 3: `.tf-phase-row` 스코프 토큰 및 미정의 토큰 버그 수정

**Files:**
- Modify: `styles.css` — `.tf-phase-row` 블록에 토큰 7개 추가, 치환 7곳
- Modify: `test-artifacts/design-verify/token-coverage-tests.mjs` — 검증 추가

**Interfaces:**
- Consumes: Task 2가 만든 `ruleBody()`, `hasDeclaration()`, `norm()` 헬퍼와 `checkTrue()`
- Produces: `.tf-phase-row` 스코프에 `--tf-line`, `--tf-muted`, `--tf-win`, `--tf-loss`, `--tf-fill-alpha`, `--tf-win-fill`, `--tf-loss-fill`

**배경:** `--border-subtle`과 `--text-muted`는 `styles.css` 어디에도 정의돼 있지 않고 `var()` 폴백만으로 동작한다. `.tf-*`는 `.evidence-lab`의 형제라 `--evidence-*`를 쓸 수 없으므로 `.evidence-lab`과 같은 패턴으로 자체 스코프 블록을 만든다. `.tf-phase-row`가 `.tf-tag`·`.tf-kd`의 조상이므로 스코프 루트로 적합하다 (main.js:2829-2833에서 그렇게 렌더한다).

- [ ] **Step 1: 실패하는 테스트 작성**

`test-artifacts/design-verify/token-coverage-tests.mjs`의 마지막 `console.log` 두 줄 **앞에** 삽입:

```javascript
// ─── Task 3: .tf-phase-row 스코프 토큰 ───────────────────────────────────
const tfRow = ruleBody(".tf-phase-row");
checkTrue(".tf-phase-row rule block found", tfRow !== null);

const TF_TOKENS = [
  ["--tf-line", "var(--surface-4)"],
  ["--tf-muted", "#a9b3c1"],
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
checkTrue(".tf-tag color uses --tf-muted",
  hasDeclaration(ruleBody(".tf-tag"), "color", "var(--tf-muted)"));
checkTrue(".tf-kd color uses --tf-muted",
  hasDeclaration(ruleBody(".tf-kd"), "color", "var(--tf-muted)"));

// 부정 결과 태그: 배경은 --tf-loss-fill, 글자색은 --tf-loss.
const lossTagBody = ruleBody('.tf-phase-row[data-outcome="TRADE_LOST"] .tf-tag');
checkTrue("loss tag background uses --tf-loss-fill", hasDeclaration(lossTagBody, "background", "var(--tf-loss-fill)"));
checkTrue("loss tag color uses --tf-loss", hasDeclaration(lossTagBody, "color", "var(--tf-loss)"));

// 긍정 결과 태그.
const winTagBody = ruleBody('.tf-phase-row[data-outcome="TRADE_WON"] .tf-tag');
checkTrue("win tag background uses --tf-win-fill", hasDeclaration(winTagBody, "background", "var(--tf-win-fill)"));
checkTrue("win tag color uses --tf-win", hasDeclaration(winTagBody, "color", "var(--tf-win)"));
```

**주의:** `ruleBody`는 `selector {` 를 그대로 찾는다. 부정/긍정 태그 규칙은 셀렉터가 4개/3개 나열된 마지막 항목이 `.tf-phase-row[data-outcome="TRADE_LOST"] .tf-tag {` 와 `.tf-phase-row[data-outcome="TRADE_WON"] .tf-tag {` 이므로 위 문자열로 찾을 수 있다. Step 4에서 셀렉터 목록의 순서를 바꾸지 말 것.

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `node test-artifacts/design-verify/token-coverage-tests.mjs`
Expected: FAIL. 토큰 7개 미정의, `--border-subtle`/`--text-muted` 잔존, 리터럴 2종 잔존, 사용처 7건 실패.

- [ ] **Step 3: `.tf-phase-row` 블록 교체**

`styles.css`의 `.tf-phase-row { … }` 블록 전체를 다음으로 교체:

```css
.tf-phase-row {
  /* .tf-*는 .evidence-lab의 형제라서 --evidence-*를 쓸 수 없다(index.html: evidence-lab은
     237행에서 닫히고 #teamfight-phases는 296행에서 시작). .evidence-lab과 같은 패턴으로
     자체 스코프 토큰을 둔다. --tf-line/--tf-muted는 정의 없이 참조되던
     --border-subtle/--text-muted 폴백값을 그대로 승격한 것이다. */
  --tf-line: var(--surface-4);
  --tf-muted: #a9b3c1;
  --tf-win: #6ee7b7;
  --tf-loss: #f47272;
  --tf-fill-alpha: 17%;
  --tf-win-fill: color-mix(in srgb, var(--tf-win) var(--tf-fill-alpha), transparent);
  --tf-loss-fill: color-mix(in srgb, var(--tf-loss) var(--tf-fill-alpha), transparent);
  padding: 0.5rem 0;
  border-top: 1px solid var(--tf-line);
}
```

- [ ] **Step 4: 치환 6곳 적용**

| 셀렉터 | 속성 | 현재 값 | 교체 |
|---|---|---|---|
| `.tf-tag` | `color` | `var(--text-muted, #a9b3c1)` | `var(--tf-muted)` |
| `.tf-kd` | `color` | `var(--text-muted, #a9b3c1)` | `var(--tf-muted)` |
| `…[data-outcome="TRADE_LOST"] .tf-tag` | `background` | `rgba(244, 114, 114, 0.18)` | `var(--tf-loss-fill)` |
| `…[data-outcome="TRADE_LOST"] .tf-tag` | `color` | `#f47272` | `var(--tf-loss)` |
| `…[data-outcome="TRADE_WON"] .tf-tag` | `background` | `rgba(110, 231, 183, 0.16)` | `var(--tf-win-fill)` |
| `…[data-outcome="TRADE_WON"] .tf-tag` | `color` | `#6ee7b7` | `var(--tf-win)` |

(`border-top`은 Step 3의 블록 교체에서 이미 처리됐다 — 합계 7곳.)

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `node test-artifacts/design-verify/token-coverage-tests.mjs`
Expected: PASS, `45 passed, 0 failed`.

Run: `npm test`
Expected: `3178 passed, 0 failed`.

- [ ] **Step 6: 브라우저 픽셀 검증**

Task 2 Step 6의 하네스에서 `CASES`를 다음으로 바꿔 재실행한다. `.tf-tag` 배경 2곳은 승인된 예외(16%/18% → 17%)이므로 **둘 다 차이가 나야** 한다.

```javascript
  const CASES = [
    ['tf-loss-fill(예외 18→17)', 'color-mix(in srgb, #f47272 17%, transparent)', 'rgba(244, 114, 114, 0.18)', false],
    ['tf-win-fill(예외 16→17)',  'color-mix(in srgb, #6ee7b7 17%, transparent)', 'rgba(110, 231, 183, 0.16)', false],
    ['tf-line(동일)',            'rgba(255, 255, 255, 0.08)',                    'rgba(255, 255, 255, 0.08)', true],
  ];
```

Expected: 3곳 모두 `OK`, `RESULT: PASS`.

추가 확인 — `--tf-line: var(--surface-4)`가 실제로 해석되는지는 `:root`의 `--surface-4: rgba(255, 255, 255, 0.08)`가 상속되기 때문에 성립한다. 브라우저에서 `.tf-phase-row`의 `border-top-color`가 `rgba(255, 255, 255, 0.08)`로 계산되는지 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add styles.css test-artifacts/design-verify/token-coverage-tests.mjs
git commit -m "fix(css): define .tf-* scoped tokens, drop undefined token references

--border-subtle과 --text-muted는 styles.css 어디에도 정의돼 있지 않고
var() 폴백만으로 동작하고 있었다. 토큰 이름이 존재하지 않는 체계를
약속하는 상태였다.

.tf-*는 .evidence-lab의 형제라 --evidence-*를 쓸 수 없으므로
.evidence-lab과 같은 패턴으로 .tf-phase-row에 스코프 토큰을 둔다.
폴백값을 그대로 승격했으므로 렌더링은 동일하다.

win/loss 태그 배경 알파 16%/18%는 17%로 통합한다(승인된 예외)."
```

---

### Task 4: 반복값 토큰

**Files:**
- Modify: `styles.css` — `.evidence-lab`에 토큰 4개, `:root`에 토큰 1개 추가, 치환 15곳
- Modify: `test-artifacts/design-verify/token-coverage-tests.mjs` — 검증 추가

**Interfaces:**
- Consumes: Task 2의 헬퍼들, Task 2가 `.evidence-lab`에 추가한 토큰 블록 (그 아래에 이어 붙인다)
- Produces: 없음 (마지막 CSS 태스크)

- [ ] **Step 1: 실패하는 테스트 작성**

`token-coverage-tests.mjs`의 마지막 `console.log` 두 줄 **앞에** 삽입:

```javascript
// ─── Task 4: 반복값 토큰 ─────────────────────────────────────────────────
const REPEATED_TOKENS = [
  [".evidence-lab", "--evidence-radius", "18px"],
  [".evidence-lab", "--evidence-radius-sm", "12px"],
  [".evidence-lab", "--evidence-surface-sunken", "#091827"],
  [".evidence-lab", "--evidence-gap", "18px"],
  [":root", "--space-0", "2px"],
];
for (const [selector, name, value] of REPEATED_TOKENS) {
  checkTrue(`${name}: ${value} defined in ${selector}`, hasDeclaration(ruleBody(selector), name, value));
}

// 사용 횟수 확인. 토큰 정의 1회 + 사용 N회 = N+1 회 등장.
const USAGE_COUNTS = [
  ["var(--evidence-radius)", 3],
  ["var(--evidence-radius-sm)", 2],
  ["var(--evidence-surface-sunken)", 2],
  ["var(--evidence-gap)", 3],
  ["var(--space-0)", 5],
];
for (const [ref, expected] of USAGE_COUNTS) {
  const actual = stripped.split(ref).length - 1;
  checkTrue(`${ref} used ${expected} times`, actual === expected, `실제 ${actual}회`);
}

// #091827 리터럴이 토큰 정의 1곳에만 남아야 한다.
checkTrue("#091827 appears only in its token definition",
  stripped.split("#091827").length - 1 === 1,
  `${stripped.split("#091827").length - 1}회 등장`);

// 2px gap 리터럴이 모두 사라졌는지 — gap: 2px 형태로 검사한다.
checkTrue("no raw `gap: 2px` remains", !/gap:\s*2px\s*;/.test(stripped));
// 18px / 12px 는 padding 등 다른 속성에도 쓰이므로 border-radius/gap 형태만 검사한다.
checkTrue("no raw `border-radius: 18px` remains", !/border-radius:\s*18px\s*;/.test(stripped));
checkTrue("no raw `border-radius: 12px` remains", !/border-radius:\s*12px\s*;/.test(stripped));
checkTrue("no raw `gap: 18px` remains", !/gap:\s*18px\s*;/.test(stripped));
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `node test-artifacts/design-verify/token-coverage-tests.mjs`
Expected: FAIL. 토큰 5개 미정의, 사용 횟수 5건 0회, 리터럴 5건 잔존.

- [ ] **Step 3: `:root`에 `--space-0` 추가**

`styles.css`의 `--space-1: 4px;` **앞** 줄에 삽입:

```css
  --space-0: 2px;
```

- [ ] **Step 4: `.evidence-lab`에 토큰 4개 추가**

Task 2가 추가한 `--evidence-grid-blue` 선언 다음 줄에 삽입:

```css
  --evidence-radius: 18px;
  --evidence-radius-sm: 12px;
  --evidence-surface-sunken: #091827;
  --evidence-gap: 18px;
```

- [ ] **Step 5: 치환 15곳 적용**

`--evidence-radius` → `border-radius: 18px;` 3곳:
`.evidence-hero`, `[data-evidence-moments], [data-evidence-detail], .evidence-protocol`, `@media (max-width: 760px)`의 `.evidence-lab`.
**주의:** 같은 미디어쿼리 블록의 `padding: 18px`는 감사 대상이 아니고 역할도 다르다. 건드리지 말 것.

`--evidence-radius-sm` → `border-radius: 12px;` 2곳: `.evidence-reasoning__panel`(≈L5299), `.evidence-protocol__item`(≈L5394).

`--evidence-surface-sunken` → `background: #091827;` 2곳: 위 두 셀렉터와 같은 블록.

`--evidence-gap` → `gap: 18px;` 3곳: `.evidence-lab-grid`, `.evidence-lab__review, .evidence-protocol`, `.evidence-moment-section__heading, .evidence-protocol__heading`.

`--space-0` → `gap: 2px;` 5곳: `.winrate-detail`, `.profile-avg-kda`, `.msc-kda-block`, `.sample-chip__copy`, `@media`의 `.tab-bar`.

- [ ] **Step 6: 테스트 실행해 통과 확인**

Run: `node test-artifacts/design-verify/token-coverage-tests.mjs`
Expected: PASS, `59 passed, 0 failed`.

Run: `npm test`
Expected: `3192 passed, 0 failed`.

- [ ] **Step 7: 커밋**

```bash
git add styles.css test-artifacts/design-verify/token-coverage-tests.mjs
git commit -m "refactor(css): promote repeated raw values to tokens

2회 이상 반복되는 값 15곳을 토큰으로 올린다. 값은 전부 그대로 옮겼으므로
픽셀 변화가 없다.

--space-0(2px)은 기존 --space-1(4px) 아래 스텝이다. 5곳 모두
flex-direction: column 스택의 라벨/값 간격이라 역할이 일치한다.

radius 18px와 gap 18px가 같은 값인 것은 우연이므로 별개 토큰으로 둔다."
```

---

### Task 5: 최종 검증 및 스펙 동기화

**Files:**
- Modify: `docs/superpowers/specs/2026-07-26-css-token-coverage-design.md` — 실측 결과 반영
- Modify: `.gitignore` — `.playwright-mcp/` 추가

**Interfaces:**
- Consumes: Task 1~4의 모든 변경
- Produces: 없음 (최종 태스크)

- [ ] **Step 1: 감사 실측 및 스펙의 예상치 대조**

Run: `node scripts/design-audit.js --top 999`

스펙의 "기대 결과" 표(colors ~97%, radius ~96%, spacing ~93%, fontSize 변화 없음)와 실측을 비교한다. 예상치는 추정이었으므로 차이가 있으면 **스펙을 실측으로 고친다** (반대로 하지 말 것).

`--top 999`로 정확 일치(`-> --token`) 제안이 새로 드러났는지 확인한다. 기본값 8 때문에 가려져 있던 항목이 나올 수 있다. 나오면 Task 4와 같은 성격의 무위험 치환이므로 별도 커밋으로 처리하되, **먼저 사용자에게 보고**한다.

- [ ] **Step 2: 문법 검증**

Run:
```bash
node -e "
const s=require('fs').readFileSync('styles.css','utf8');
let t=s.replace(/\/\*[\s\S]*?\*\//g,(m)=>m.replace(/[^\n]/g,' '));
let d=0; for(const c of t){ if(c==='{')d++; else if(c==='}')d--; if(d<0) throw new Error('unmatched }'); }
if(d!==0) throw new Error(d+' unclosed block(s)');
console.log('brace balance OK,', s.split('\n').length, 'lines');
"
```
Expected: `brace balance OK, <N> lines`.

**주의:** 줄 단위로 `prop:` 뒤 세미콜론 누락을 검사하면 `background`/`grid-template-areas`처럼 값이 여러 줄에 걸치는 정상 선언이 오탐으로 잡힌다. 중괄호 균형과 주석 종료만 신뢰할 수 있는 신호다.

- [ ] **Step 3: 미정의 커스텀 프로퍼티 참조 확인**

Run: `node scripts/design-audit.js --scope customProps`
Expected: `No missing custom property references without fallback.`

이 태스크에서 폴백을 제거했으므로, 만약 미정의 참조가 남아 있다면 여기서 잡힌다. Task 3에서 `--border-subtle`/`--text-muted` 폴백을 없앴는데 새 토큰 정의를 빠뜨렸다면 이 검사가 실패한다.

- [ ] **Step 4: `.gitignore`에 `.playwright-mcp/` 추가**

브라우저 검증 시 Playwright MCP가 `.playwright-mcp/`에 스냅샷·콘솔 로그를 쓴다. 산출물이므로 추적하지 않는다. `.gitignore`의 `test-artifacts/tmp/` 다음 줄에 추가:

```
.playwright-mcp/
```

- [ ] **Step 5: 전체 테스트**

Run: `npm test`
Expected: `3192 passed, 0 failed across 145 test file(s)`.

- [ ] **Step 6: 커밋**

```bash
git add docs/superpowers/specs/2026-07-26-css-token-coverage-design.md .gitignore
git commit -m "docs: sync token coverage spec with measured results

스펙의 커버리지 예상치를 감사 실측값으로 교체한다.
브라우저 검증 산출물 디렉터리(.playwright-mcp/)를 gitignore에 추가한다."
```

---

## Self-Review

**1. Spec coverage**

| 스펙 섹션 | 구현 태스크 |
|---|---|
| §1 `.evidence-lab` 알파 파생 레이어 (11곳) | Task 2 |
| §2 `.tf-phase-row` 스코프 토큰 (7곳) | Task 3 |
| §3 반복값 토큰 (15곳) | Task 4 |
| §4 `design-audit.js` 오집계 수정 | Task 1 |
| 검증 1 (픽셀 회귀 하네스) | Task 2 Step 6, Task 3 Step 6 |
| 검증 2 (감사 재실행) | Task 1 Step 6, Task 5 Step 1 |
| 검증 3 (`npm test`) | 각 태스크 Step 5~6 |
| 검증 4 (문법) | Task 5 Step 2 |
| 검증 5 (`color-mix` 지원) | Task 2 Step 6 (하네스가 `resolve()`에서 미지원 시 FAIL 처리) |
| 원칙: 승인된 예외 2건 | Task 2 Step 6 (3곳), Task 3 Step 6 (2곳) — 예외가 **차이나야** 통과하도록 `shouldMatch: false`로 고정 |
| 후속 관찰 | 구현 대상 아님. 스펙에 기록 유지 |

치환 합계 검증: 11 (Task 2) + 7 (Task 3) + 15 (Task 4) = **33곳** — 스펙과 일치.
신규 토큰 합계: 10 (Task 2) + 7 (Task 3) + 5 (Task 4) = **22개** — 스펙과 일치.

**2. Placeholder scan** — TBD/TODO 없음. 모든 코드 스텝에 실제 코드 블록이 있고, 모든 테스트 스텝에 실제 단정문이 있다.

**3. Type consistency**

- `parseCustomPropertyDeclarations`가 추가하는 필드명은 Task 1 Step 3에서 `endIndex`, Step 4에서 `entry.endIndex` — 일치.
- 헬퍼 이름은 Task 2에서 정의(`ruleBody`, `hasDeclaration`, `norm`, `checkTrue`)하고 Task 3, 4에서 같은 이름으로 사용 — 일치.
- 토큰 이름이 스펙·테스트·CSS 삽입 코드에서 모두 동일한지 대조했다. 특히 `--evidence-fill-green-soft`(하이픈 3개)와 `--evidence-radius-sm`을 확인.
- Task 2 Step 5의 기대 테스트 수 27 = 1(블록 발견) + 10(토큰) + 9(리터럴) + 7(사용처). Task 3은 +18 = 1 + 7 + 2(미정의 참조) + 2(리터럴) + 6(사용처) → 45. Task 4는 +14 = 5(토큰) + 5(사용 횟수) + 1(#091827) + 4(리터럴 형태) → 59. 누계 일관.

**4. 발견해 보정한 사항**

- Task 1을 맨 앞에 둔 이유를 File Structure에 명시했다. 순서를 바꾸면 Task 2~4가 추가하는 토큰 정의가 raw로 집계되어 커버리지가 나빠 보인다.
- 모든 테스트를 셀렉터 블록 기준으로 작성했다. Task 2가 `.evidence-lab`에 10줄을 추가하므로 줄 번호 기반 단정문은 Task 3에서 전부 깨진다.
- `test-artifacts/design-audit/`이 gitignore 대상이라 Task 1의 테스트를 `test-artifacts/scripts/`에 두었다.
- Task 4의 리터럴 잔존 검사를 `border-radius:`/`gap:` 형태로 한정했다. `18px`·`12px`·`2px`는 `padding` 등 감사 대상 밖 속성에도 쓰이므로 단순 문자열 검사로는 오탐이 난다.
- Task 2 Step 4의 링 셀렉터를 `.evidence-score-ring` → `.evidence-score__ring`(밑줄 2개, L5099)로 정정했다. 처음에 추측으로 적었던 이름이 실제와 달랐다.
- `ruleBody`가 `indexOf` 기반이라 다중 매치 시 첫 항목을 반환한다. 이 계획이 쓰는 모든 셀렉터에 대해 첫 매치가 의도한 규칙인지 `grep -cF`로 대조하고 결과를 테스트 코드 주석에 남겼다. `.tf-tag {`는 `… .tf-tag {` 형태에도 부분일치하지만 기본 규칙(L4883)이 먼저 나와 우연히 안전하다 — 셀렉터 순서를 바꾸면 깨진다.
