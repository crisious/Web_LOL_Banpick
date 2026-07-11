# LOLGG AI 코칭 플랜 기능 보강 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 설계에 따라 제목의 시각적 압력을 낮추고, `NEXT GAME FOCUS`, 6축 `SKILL PROFILE`, 3구간 `PHASE COACH`를 기존 읽기 전용 Evidence Lab에 추가한 뒤 브라우저 플레이 테스트와 비공개 Sites 재배포까지 완료한다.

**Architecture:** 기존 `/api/samples`와 `/api/samples/:id` 계약은 유지한다. DOM과 무관한 선택·정규화 로직은 새 ESM 모듈 `sites/app/coaching-plan.js`에 두어 Node 테스트와 브라우저에서 함께 사용하고, `sites/app/app.js`는 상태·DOM 렌더링·상호작용만 담당한다. 스테이징 번들은 새 모듈을 명시적으로 포함하며, 원본 샘플·Worker·인증·호스팅 메타데이터는 변경하지 않는다.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node.js `node:test`, Vite 8, Cloudflare Worker adapter, OpenAI Sites private hosting, in-app Browser QA.

## Global Constraints

- 현재 작업 폴더의 수정된 `data/samples/manifest.json`, 미추적 샘플 디렉터리, `test-artifacts/tmp/`는 사용자 작업이다. 읽거나 정리하거나 커밋하지 않는다.
- 구현은 현재 `HEAD`에서 만든 별도 worktree와 `codex/coaching-plan-enhancement` 브랜치에서 수행한다.
- 새 네트워크 요청, API 엔드포인트, 패키지 의존성, 데이터 스키마, 로그인, 장기 추이, 티어 비교, VOD 기능을 추가하지 않는다.
- 사용자 제공 문자열은 기존 `escapeHtml()` 또는 `textContent` 경계를 통과시킨다. 수치만 검증 후 inline CSS custom property에 사용한다.
- loading, empty, error 전환 때 새 패널 셋 모두 초기화해 이전 경기 데이터가 남지 않게 한다.
- 브라우저 스크린샷과 배포 아카이브는 `/tmp`에만 만들며 저장소에 넣지 않는다.
- 각 기능은 RED 테스트를 확인한 뒤 최소 구현으로 GREEN을 만들고, 해당 범위 테스트를 통과한 뒤 커밋한다.
- `sites/worker/index.js`, `sites/vite.config.js`, `sites/.openai/hosting.json`, 샘플 JSON은 변경하지 않는다.

## File Map

| Path | Responsibility |
| --- | --- |
| `sites/app/coaching-plan.js` | DOM 없는 코칭 데이터 선택·정규화. Node 테스트와 브라우저가 함께 import한다. |
| `sites/app/app.js` | API 로드, 화면 상태, 새 세 영역 렌더링, 포커스→근거 상호작용. |
| `sites/app/index.html` | hero 다음 focus, metric 안 profile, evidence 전 phase의 시맨틱 호스트. |
| `sites/app/styles.css` | 승인된 제목 위계와 focus/profile/phase 반응형 표현. |
| `sites/tests/coaching-plan-models.mjs` | 순수 모델, 결측치, 전체 커밋 샘플 호환성. |
| `sites/tests/standalone-ui.mjs` | DOM hook, 이스케이프, 상태 초기화, 접근성, 반응형 정적 계약. |
| `sites/tests/read-only-smoke.mjs` | 새 ESM을 포함한 5개 UI 자산의 읽기 전용 스테이징. |
| `sites/scripts/stage-assets.mjs` | 검증된 UI 자산과 커밋 샘플만 배포 staging에 복사. |
| `sites/package.json` | 새 모델 테스트를 Sites 테스트 명령에 포함. |

---

### Task 0: 사용자 작업을 보존하는 격리 환경과 기준선 확정

**Files:**

- Read: `/Users/a1234/Documents/Web_LOL_Banpick/.git`
- Create worktree: `/Users/a1234/Documents/Web_LOL_Banpick-coaching-plan`
- No source edits

**Interfaces:**

- Consumes: current clean commit `HEAD`; original worktree dirty paths reported by `git status --short`.
- Produces: clean worktree `/Users/a1234/Documents/Web_LOL_Banpick-coaching-plan` on branch `codex/coaching-plan-enhancement`, rooted at that exact `HEAD`.

- [ ] **Step 1: superpowers:using-git-worktrees를 불러오고 사용자 변경을 기록한다**

실행 시작 시 먼저 `superpowers:using-git-worktrees`를 사용한다. 그 스킬의 안전성 점검을 통과한 뒤 `/Users/a1234/Documents/Web_LOL_Banpick`에서 실행한다.

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

Expected: `data/samples/manifest.json`과 사용자 샘플/임시 산출물만 dirty 상태로 보이고, `HEAD`에는 이 계획과 승인된 설계가 포함된다.

- [ ] **Step 2: 현재 HEAD에서 전용 브랜치와 worktree를 만든다**

```bash
git worktree add /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan -b codex/coaching-plan-enhancement HEAD
```

Expected: 새 worktree가 생성되고 기존 폴더의 dirty 파일은 새 worktree에 나타나지 않는다.

- [ ] **Step 3: 격리 상태와 기존 기준선 테스트를 확인한다**

Run from `/Users/a1234/Documents/Web_LOL_Banpick-coaching-plan`:

```bash
git status --short
npm --prefix sites test
npm test
node scripts/design-audit.js --file sites/app/styles.css --context index.html,app.js --scope all --format markdown
```

Expected: `git status --short`가 비어 있고 Sites 테스트와 전체 회귀 테스트가 통과한다. 디자인 감사 결과는 구현 전 기준선으로 기록한다. 기존 실패가 있으면 구현을 시작하지 말고 실패 명령과 첫 오류를 보고한다.

---

### Task 1: 제목 강조 축소 계약을 테스트로 고정

**Files:**

- Modify: `sites/tests/standalone-ui.mjs`
- Modify: `sites/app/styles.css`

**Interfaces:**

- Consumes: existing selectors `.hero`, `.hero h1`, `.coach-summary`, `.hero__stamp`, and helper `mediaBlocks(css, 720)`.
- Produces: the approved fixed CSS contract: hero `390px`, title `clamp(1.9rem, 3.8vw, 3.45rem)` at weight `700`, mobile title `clamp(1.8rem, 8.5vw, 2.8rem)`.

- [ ] **Step 1: 축소된 히어로/제목 값을 요구하는 실패 테스트를 작성한다**

`sites/tests/standalone-ui.mjs`의 반응형 테스트 앞에 다음 계약을 추가한다.

```js
test("analysis headline uses the approved restrained hierarchy", () => {
  assert.match(
    css,
    /\.hero\s*\{[^}]*min-height\s*:\s*390px;[^}]*padding\s*:\s*64px 0 60px;/s,
  );
  assert.match(
    css,
    /\.hero h1\s*\{[^}]*max-width\s*:\s*760px;[^}]*font-size\s*:\s*clamp\(1\.9rem,\s*3\.8vw,\s*3\.45rem\);[^}]*font-weight\s*:\s*700;[^}]*line-height\s*:\s*1\.16;[^}]*letter-spacing\s*:\s*-0\.035em;/s,
  );
  assert.match(css, /\.coach-summary\s*\{[^}]*margin\s*:\s*24px 0 0;/s);
  assert.match(css, /\.hero__stamp\s*\{[^}]*width\s*:\s*90px;/s);

  const at720 = mediaBlocks(css, 720);
  assert.match(
    at720,
    /\.hero h1\s*\{[^}]*font-size\s*:\s*clamp\(1\.8rem,\s*8\.5vw,\s*2\.8rem\);/s,
  );
});
```

- [ ] **Step 2: 테스트가 기존 강한 제목 때문에 실패하는지 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test --test-name-pattern="restrained hierarchy" tests/standalone-ui.mjs
```

Expected: 기존 `510px`, `5.5rem`, `820` 값 때문에 1개 테스트가 FAIL한다.

- [ ] **Step 3: 승인된 CSS 값을 적용한다**

`sites/app/styles.css`에서 다음 값을 정확히 반영한다.

```css
.hero {
  position: relative;
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 120px;
  gap: 30px;
  align-items: start;
  min-height: 390px;
  padding: 64px 0 60px;
  border-bottom: 1px solid var(--line);
}

.hero h1 {
  max-width: 760px;
  margin: 0;
  font-size: clamp(1.9rem, 3.8vw, 3.45rem);
  font-weight: 700;
  line-height: 1.16;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.coach-summary {
  max-width: 760px;
  margin: 24px 0 0;
  padding-left: 20px;
  border-left: 2px solid var(--lime);
  color: var(--muted-strong);
  font-size: clamp(1rem, 1.5vw, 1.18rem);
  line-height: 1.85;
}

.hero__stamp {
  display: grid;
  place-items: center;
  width: 90px;
  aspect-ratio: 1;
  margin-top: 7px;
  border: 1px solid var(--line);
  border-radius: 50%;
  color: rgba(154, 166, 177, 0.56);
  transform: rotate(8deg);
}
```

`@media (max-width: 720px)` 안의 제목 값은 다음으로 교체한다.

```css
.hero h1 {
  font-size: clamp(1.8rem, 8.5vw, 2.8rem);
}
```

- [ ] **Step 4: 제목 계약과 전체 Sites 테스트를 통과시킨다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan
npm --prefix sites test
git diff --check
```

Expected: 모든 기존 Sites 테스트와 새 제목 계약이 PASS한다.

- [ ] **Step 5: 제목 조정만 커밋한다**

```bash
git add sites/app/styles.css sites/tests/standalone-ui.mjs
git commit -m "style: soften Sites analysis headline"
```

---

### Task 2: 순수 코칭 모델 모듈과 NEXT GAME FOCUS 구현

**Files:**

- Create: `sites/app/coaching-plan.js`
- Create: `sites/tests/coaching-plan-models.mjs`
- Modify: `sites/package.json`
- Modify: `sites/scripts/stage-assets.mjs`
- Modify: `sites/tests/read-only-smoke.mjs`
- Modify: `sites/tests/standalone-ui.mjs`
- Modify: `sites/app/index.html`
- Modify: `sites/app/app.js`
- Modify: `sites/app/styles.css`

**Interfaces:**

- Consumes: `analysis.weaknesses: Array<{id?, title?, description?, relatedEventIds?}>`, `analysis.actionChecklist: Array<{id?, text?, title?, description?, detail?, linkedWeaknessId?}>`, and normalized moment objects from `getMoments(analysis)`.
- Produces: `buildFocusModel(analysis): FocusModel | null`, where `FocusModel = {weaknessId: string, title: string, description: string, actionId: string, actionText: string, relatedEventIds: string[], evidenceCount: number}`; `findFocusMomentId(focus, moments): string`; DOM hooks `data-coaching-focus`, `data-focus-content`, `data-focus-evidence`; staged asset `coaching-plan.js`.

- [ ] **Step 1: 포커스 선택과 장면 연결의 실패 테스트를 먼저 작성한다**

`sites/tests/coaching-plan-models.mjs`를 만들고 다음 테스트를 넣는다.

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFocusModel,
  findFocusMomentId,
} from "../app/coaching-plan.js";

test("buildFocusModel selects the first weakness and its linked action", () => {
  const model = buildFocusModel({
    weaknesses: [{
      id: "wk_1",
      title: "초반 생존",
      description: "시야 없이 전진했습니다.",
      relatedEventIds: ["evt_1", "", "evt_1", "evt_2", null],
    }],
    actionChecklist: [
      { id: "act_other", text: "다른 행동", linkedWeaknessId: "wk_2" },
      { id: "act_1", text: "강 입구 시야 확인", linkedWeaknessId: "wk_1" },
    ],
  });

  assert.deepEqual(model, {
    weaknessId: "wk_1",
    title: "초반 생존",
    description: "시야 없이 전진했습니다.",
    actionId: "act_1",
    actionText: "강 입구 시야 확인",
    relatedEventIds: ["evt_1", "evt_2"],
    evidenceCount: 2,
  });
});

test("buildFocusModel falls back to the first action and legacy action copy", () => {
  const model = buildFocusModel({
    weaknesses: [{ id: "wk_1", title: "포지셔닝", relatedEventIds: [] }],
    actionChecklist: [{
      id: "act_1",
      title: "후방 유지",
      detail: "탱커 뒤 두 번째 줄에 선다.",
    }],
  });
  assert.equal(model.actionText, "후방 유지 — 탱커 뒤 두 번째 줄에 선다.");
  assert.equal(model.evidenceCount, 0);
});

test("buildFocusModel returns null only when focus content is entirely absent", () => {
  assert.equal(buildFocusModel({ weaknesses: [], actionChecklist: [] }), null);
});

test("findFocusMomentId returns the first intersecting moment and safe fallback", () => {
  const focus = { relatedEventIds: ["evt_2", "evt_3"] };
  const moments = [
    { id: "km_1", relatedEventIds: ["evt_1"] },
    { id: "km_2", relatedEventIds: ["evt_2"] },
    { id: "km_3", relatedEventIds: ["evt_3"] },
  ];
  assert.equal(findFocusMomentId(focus, moments), "km_2");
  assert.equal(findFocusMomentId({ relatedEventIds: ["evt_x"] }, moments), "");
  assert.equal(findFocusMomentId(null, moments), "");
});
```

`sites/package.json`의 테스트 명령도 새 파일을 포함하도록 바꾼다.

```json
"test": "node --test tests/coaching-plan-models.mjs tests/read-only-smoke.mjs tests/standalone-ui.mjs"
```

- [ ] **Step 2: 새 모듈이 없어서 RED가 되는지 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan
npm --prefix sites test
```

Expected: `ERR_MODULE_NOT_FOUND`로 실패한다.

- [ ] **Step 3: 포커스 순수 모델을 최소 구현한다**

`sites/app/coaching-plan.js`를 다음 구현으로 시작한다.

```js
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nonEmptyString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueEventIds(value) {
  return [...new Set(asArray(value).map(nonEmptyString).filter(Boolean))];
}

function actionCopy(action) {
  if (!action || typeof action !== "object") return "";
  return nonEmptyString(action.text)
    || [nonEmptyString(action.title), nonEmptyString(action.description || action.detail)]
      .filter(Boolean)
      .join(" — ");
}

export function buildFocusModel(analysis) {
  const weakness = asArray(analysis?.weaknesses)[0];
  const actions = asArray(analysis?.actionChecklist);
  const weaknessId = nonEmptyString(weakness?.id);
  const action = actions.find(
    (entry) => weaknessId && nonEmptyString(entry?.linkedWeaknessId) === weaknessId,
  ) || actions[0];
  const title = nonEmptyString(weakness?.title);
  const description = nonEmptyString(weakness?.description);
  const actionText = actionCopy(action);
  if (![title, description, actionText].some(Boolean)) return null;

  const relatedEventIds = uniqueEventIds(weakness?.relatedEventIds);
  return {
    weaknessId,
    title,
    description,
    actionId: nonEmptyString(action?.id),
    actionText,
    relatedEventIds,
    evidenceCount: relatedEventIds.length,
  };
}

export function findFocusMomentId(focus, moments) {
  const targetIds = new Set(uniqueEventIds(focus?.relatedEventIds));
  if (targetIds.size === 0) return "";
  const match = asArray(moments).find((moment) =>
    uniqueEventIds(moment?.relatedEventIds).some((eventId) => targetIds.has(eventId)));
  return nonEmptyString(match?.id);
}
```

- [ ] **Step 4: 포커스 모델 테스트를 GREEN으로 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test tests/coaching-plan-models.mjs
```

Expected: 포커스 모델 4개 테스트가 PASS한다.

- [ ] **Step 5: 5개 자산 스테이징을 요구하는 실패 테스트를 작성한다**

`sites/tests/read-only-smoke.mjs`의 목록을 테스트 기대값부터 다음처럼 바꾼다.

```js
const requiredUiAssets = [
  { source: "index.html", staged: "index.html" },
  { source: "styles.css", staged: "styles.css" },
  { source: "app.js", staged: "app.js" },
  { source: "coaching-plan.js", staged: "coaching-plan.js" },
  { source: "og.png", staged: "og.png" },
];
```

`sites/tests/standalone-ui.mjs`의 자산 read와 존재 테스트를 다음 계약으로 바꾼다.

```js
const [html, css, appJs, coachingPlanJs, ogImage] = await Promise.all([
  readOptional("index.html"),
  readOptional("styles.css"),
  readOptional("app.js"),
  readOptional("coaching-plan.js"),
  readOptional("og.png", null),
]);

test("standalone Sites UI provides its own five production assets", async (t) => {
  for (const relativePath of [
    "index.html",
    "styles.css",
    "app.js",
    "coaching-plan.js",
    "og.png",
  ]) {
    await t.test(relativePath, async () => {
      assert.ok(
        await isFile(relativePath),
        `Missing standalone UI asset: sites/app/${relativePath}`,
      );
    });
  }
  assert.match(coachingPlanJs, /export function buildFocusModel/);
  assert.deepEqual(
    [...(ogImage?.subarray(0, 8) || [])],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
});
```

- [ ] **Step 6: staging 구현 전 RED를 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test tests/read-only-smoke.mjs tests/standalone-ui.mjs
```

Expected: `coaching-plan.js`가 staged bundle에 없다는 read-only assertion이 FAIL한다.

- [ ] **Step 7: stage-assets.mjs에 새 모듈을 추가한다**

`sites/scripts/stage-assets.mjs`의 자산 목록을 다음과 일치시킨다.

```js
const uiAssets = [
  "index.html",
  "styles.css",
  "app.js",
  "coaching-plan.js",
  "og.png",
];
```

- [ ] **Step 8: 5개 자산 계약을 GREEN으로 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan
npm --prefix sites test
```

Expected: 포커스 모델과 5개 UI 자산의 byte-for-byte staging 테스트가 PASS한다.

- [ ] **Step 9: 포커스 섹션과 접근성 상호작용을 요구하는 정적 테스트를 작성한다**

```js
test("next-game focus links one coaching action to its evidence", () => {
  assert.match(html, /<section\b[^>]*data-coaching-focus[^>]*aria-labelledby="focus-title"/i);
  assert.match(html, /data-focus-content/);
  assert.ok(
    html.indexOf("data-coaching-focus") < html.indexOf("data-evidence-metrics"),
    "focus must appear before the metric strip",
  );
  assert.match(html, /id="evidence-title"[^>]*tabindex="-1"/i);
  assert.match(appJs, /from ["']\.\/coaching-plan\.js["']/);
  assert.match(appJs, /buildFocusModel/);
  assert.match(appJs, /findFocusMomentId/);
  assert.match(appJs, /data-focus-evidence/);
  assert.match(appJs, /selectMoment\(momentId\)/);
  assert.match(appJs, /momentId\s*!==\s*state\.activeMomentId/);
  assert.match(appJs, /이미 선택된 근거 장면으로 이동했습니다\./);
  assert.match(appJs, /evidenceTitle\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
  assert.match(appJs, /evidenceTitle\.scrollIntoView/);
  assert.match(appJs, /matchMedia\(["']\(prefers-reduced-motion: reduce\)["']\)/);

  const at1024 = mediaBlocks(css, 1024);
  assert.match(at1024, /\.focus-section\s*\{[^}]*grid-template-columns\s*:\s*1fr;/s);
  assert.match(at1024, /\.focus-card\s*\{[^}]*grid-template-columns\s*:\s*1fr;/s);
});
```

- [ ] **Step 10: 포커스 UI 구현 전 RED를 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test --test-name-pattern="next-game focus" tests/standalone-ui.mjs
```

Expected: 포커스 마크업과 렌더러가 없어 FAIL한다.

- [ ] **Step 11: 포커스 마크업을 히어로 바로 뒤에 추가한다**

`sites/app/index.html`에서 히어로와 metric section 사이에 다음 구조를 넣고 기존 `evidence-title`에 `tabindex="-1"`를 추가한다.

```html
<section class="focus-section" data-coaching-focus aria-labelledby="focus-title">
  <div class="focus-section__intro">
    <p class="eyebrow">NEXT GAME FOCUS</p>
    <h2 id="focus-title">한 가지만 먼저 바꿉니다.</h2>
    <p>핵심 약점과 바로 실행할 행동을 연결했습니다.</p>
  </div>
  <div class="focus-card" data-focus-content>
    <p class="empty-copy">다음 게임 포커스를 불러오는 중입니다.</p>
  </div>
</section>
```

- [ ] **Step 12: app.js에서 포커스를 렌더하고 근거 장면으로 이동시킨다**

파일 첫 줄에 다음 import를 추가한다.

```js
import {
  buildFocusModel,
  findFocusMomentId,
} from "./coaching-plan.js";
```

`elements`에 `focusContent`와 `evidenceTitle`을 등록하고 아래 렌더/상호작용을 추가한다.

```js
const elements = {
  sampleSelect: document.querySelector("[data-sample-select]"),
  statusMessage: document.querySelector("[data-status-message]"),
  matchMeta: document.querySelector("[data-match-meta]"),
  headline: document.querySelector("[data-analysis-headline]"),
  coachSummary: document.querySelector("[data-coach-summary]"),
  metrics: document.querySelector("[data-evidence-metrics]"),
  focusContent: document.querySelector("[data-focus-content]"),
  evidenceTitle: document.querySelector("#evidence-title"),
  moments: document.querySelector("[data-evidence-moments]"),
  observedList: document.querySelector("[data-observed-list]"),
  interpretation: document.querySelector("[data-interpretation-copy]"),
  protocolList: document.querySelector("[data-action-checklist]"),
  protocolProgress: document.querySelector("[data-protocol-progress]"),
  evidenceTrace: document.querySelector("[data-evidence-trace]"),
  traceCount: document.querySelector("[data-trace-count]"),
};

function renderFocus(model) {
  if (!model) {
    elements.focusContent.innerHTML =
      '<p class="empty-copy">이 경기에는 우선 적용할 코칭 포커스가 없습니다.</p>';
    return;
  }

  elements.focusContent.innerHTML = `
    <div class="focus-card__copy">
      <span>핵심 약점 · 연결 근거 ${model.evidenceCount}건</span>
      <h3>${escapeHtml(model.title || "핵심 약점")}</h3>
      <p>${escapeHtml(model.description || "이 약점의 상세 설명이 없습니다.")}</p>
    </div>
    <div class="focus-card__action">
      <span>다음 경기 대표 행동</span>
      <strong>${escapeHtml(model.actionText || "연결된 실행 행동이 없습니다.")}</strong>
      <button type="button" data-focus-evidence>근거 장면 보기</button>
    </div>`;

  elements.focusContent
    .querySelector("[data-focus-evidence]")
    .addEventListener("click", () => moveFocusToEvidence(model));
}

function moveFocusToEvidence(model) {
  const moments = getMoments(state.detail?.analysis);
  const momentId = findFocusMomentId(model, moments);
  if (momentId && momentId !== state.activeMomentId) {
    selectMoment(momentId);
  } else if (momentId) {
    setAppState("ready", "이미 선택된 근거 장면으로 이동했습니다.");
  } else {
    setAppState("ready", "관련 장면이 없어 근거 영역으로 이동했습니다.");
  }
  const reducedMotion = window
    .matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  elements.evidenceTitle.focus({ preventScroll: true });
  elements.evidenceTitle.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "start",
  });
}
```

`renderDetail()`과 `resetDependentPanels()`의 기존 본문에 다음 줄을 넣는다.

```js
function renderDetail(detail) {
  state.detail = detail;
  state.activeMomentId = "";
  renderMatchOverview(detail);
  renderMoments(detail);
  renderFocus(buildFocusModel(detail?.analysis));
  renderProtocols(detail?.analysis);
  renderTrace(detail?.analysis, detail?.normalized);
}

function resetDependentPanels(mode = "empty") {
  const isLoading = mode === "loading";
  const placeholder = isLoading ? "불러오는 중" : "데이터 없음";
  state.detail = null;
  state.activeMomentId = "";
  state.checkedProtocols = new Set();
  elements.matchMeta.innerHTML = `<span>${placeholder}</span>`;
  elements.headline.textContent = isLoading
    ? "새 경기의 분석 근거를 연결하고 있습니다."
    : "분석할 수 있는 경기 데이터가 없습니다.";
  elements.coachSummary.textContent = isLoading
    ? "잠시만 기다리면 코칭 요약이 표시됩니다."
    : "표시할 코칭 요약이 없습니다.";
  elements.metrics.innerHTML = ["KDA", "시야 점수", "킬 관여"]
    .map((label) => `<article class="metric"><span>${label}</span><strong>—</strong><small>${placeholder}</small></article>`)
    .join("");
  elements.focusContent.innerHTML = `<p class="empty-copy">${isLoading
    ? "다음 게임 포커스를 불러오는 중입니다."
    : "표시할 코칭 포커스가 없습니다."}</p>`;
  elements.moments.innerHTML = `<p class="empty-copy">${isLoading ? "핵심 장면을 불러오는 중입니다." : "표시할 핵심 장면이 없습니다."}</p>`;
  elements.observedList.innerHTML = `<li>${isLoading ? "타임라인 근거를 불러오는 중입니다." : "연결된 타임라인 근거가 없습니다."}</li>`;
  elements.interpretation.textContent = isLoading
    ? "AI 해석을 불러오는 중입니다."
    : "표시할 AI 해석이 없습니다.";
  elements.protocolList.innerHTML = `<p class="empty-copy">${isLoading ? "실행 루틴을 불러오는 중입니다." : "표시할 실행 루틴이 없습니다."}</p>`;
  updateProtocolProgress(0);
  elements.evidenceTrace.innerHTML = `<li><span>—</span><p>${isLoading ? "근거 인덱스를 불러오는 중입니다." : "표시할 근거 인덱스가 없습니다."}</p></li>`;
  elements.traceCount.textContent = isLoading ? "LOADING" : "0 EVIDENCE POINTS";
}
```

- [ ] **Step 13: 포커스의 데스크톱/모바일 스타일을 추가한다**

`sites/app/styles.css`에 다음 구조를 추가한다.

```css
.focus-section {
  display: grid;
  grid-template-columns: minmax(220px, 0.55fr) minmax(0, 1.45fr);
  gap: 48px;
  padding: 64px 0;
  border-bottom: 1px solid var(--line);
}

.focus-section__intro h2 {
  margin: 0;
  font-size: clamp(1.55rem, 2.6vw, 2.3rem);
  line-height: 1.25;
  letter-spacing: -0.035em;
}

.focus-section__intro > p:last-child {
  margin: 18px 0 0;
  color: var(--muted);
}

.focus-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.82fr);
  min-width: 0;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: rgba(10, 14, 19, 0.86);
  box-shadow: var(--shadow);
}

.focus-card__copy,
.focus-card__action {
  min-width: 0;
  padding: 30px;
  overflow-wrap: anywhere;
}

.focus-card__action {
  border-left: 1px solid var(--line);
  background: linear-gradient(145deg, var(--lime-soft), transparent 70%);
}

.focus-card__copy > span,
.focus-card__action > span {
  color: var(--lime);
  font-size: 0.66rem;
  font-weight: 850;
  letter-spacing: 0.1em;
}

.focus-card h3 {
  margin: 14px 0 12px;
  font-size: 1.35rem;
}

.focus-card p,
.focus-card__action strong {
  color: var(--muted-strong);
  line-height: 1.7;
}

.focus-card__action strong {
  display: block;
  margin: 14px 0 24px;
}

.focus-card__action button {
  padding: 11px 15px;
  border: 1px solid rgba(200, 255, 85, 0.42);
  border-radius: 999px;
  color: #11170a;
  background: var(--lime);
  font: inherit;
  font-size: 0.76rem;
  font-weight: 850;
  cursor: pointer;
}

.focus-card__action button:focus-visible {
  outline: 2px solid var(--lime);
  outline-offset: 4px;
}
```

`@media (max-width: 1024px)`에 다음을 넣는다.

```css
.focus-section,
.focus-card {
  grid-template-columns: 1fr;
}

.focus-card__action {
  border-top: 1px solid var(--line);
  border-left: 0;
}
```

- [ ] **Step 14: 포커스 단위·스테이징·정적 계약을 모두 통과시킨다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan
npm --prefix sites test
npm --prefix sites run build
git diff --check
```

Expected: 모델 4개 테스트, 5개 자산 스테이징, 포커스 DOM/상호작용 계약, 프로덕션 빌드가 모두 PASS한다.

- [ ] **Step 15: 포커스 기능을 커밋한다**

```bash
git add sites/app/coaching-plan.js sites/app/index.html sites/app/app.js sites/app/styles.css sites/package.json sites/scripts/stage-assets.mjs sites/tests/coaching-plan-models.mjs sites/tests/read-only-smoke.mjs sites/tests/standalone-ui.mjs
git commit -m "feat: add next-game coaching focus"
```

---

### Task 3: 6축 SKILL PROFILE 구현

**Files:**

- Modify: `sites/app/coaching-plan.js`
- Modify: `sites/tests/coaching-plan-models.mjs`
- Modify: `sites/tests/standalone-ui.mjs`
- Modify: `sites/app/index.html`
- Modify: `sites/app/app.js`
- Modify: `sites/app/styles.css`

**Interfaces:**

- Consumes: private helpers `nonEmptyString(value): string` and `normalizedScore(value): number | null`; `normalized.playtimeScore.overall`, `label`, and six category fields.
- Produces: `buildSkillProfile(normalized): SkillProfile`, where `SkillProfile = {overall: number | null, label: string, categories: Array<{key: string, label: string, value: number | null, displayValue: string}>}`; DOM hook `data-skill-profile`; accessible `role="meter"` rows for non-null values.

- [ ] **Step 1: 순서·범위 제한·결측치를 요구하는 모델 테스트를 작성한다**

모델 import를 다음으로 교체하고 테스트를 넣는다.

```js
import {
  buildFocusModel,
  buildSkillProfile,
  findFocusMomentId,
} from "../app/coaching-plan.js";

test("buildSkillProfile returns six ordered, clamped coaching scores", () => {
  const model = buildSkillProfile({
    playtimeScore: {
      overall: 11.24,
      label: "우수",
      categories: {
        combat: -2,
        income: 4.94,
        vision: 10,
        survival: null,
        objective: "7.2",
      },
    },
  });

  assert.equal(model.overall, 10);
  assert.equal(model.label, "우수");
  assert.deepEqual(
    model.categories.map(({ key, label, value, displayValue }) => ({
      key, label, value, displayValue,
    })),
    [
      { key: "combat", label: "전투", value: 0, displayValue: "0.0" },
      { key: "income", label: "수급", value: 4.9, displayValue: "4.9" },
      { key: "vision", label: "시야", value: 10, displayValue: "10.0" },
      { key: "survival", label: "생존", value: null, displayValue: "측정 없음" },
      { key: "objective", label: "오브젝트", value: 7.2, displayValue: "7.2" },
      { key: "structure", label: "구조물", value: null, displayValue: "측정 없음" },
    ],
  );
});

test("buildSkillProfile keeps an explicit all-missing profile", () => {
  const model = buildSkillProfile({});
  assert.equal(model.overall, null);
  assert.equal(model.categories.length, 6);
  assert.ok(model.categories.every((category) => category.value === null));
});
```

- [ ] **Step 2: 새 export가 없어 RED가 되는지 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test tests/coaching-plan-models.mjs
```

Expected: `buildSkillProfile` export 오류로 FAIL한다.

- [ ] **Step 3: 점수 정규화를 순수 모듈에 구현한다**

`sites/app/coaching-plan.js`에 다음 상수와 함수를 추가한다.

```js
const SKILL_CATEGORIES = [
  ["combat", "전투"],
  ["income", "수급"],
  ["vision", "시야"],
  ["survival", "생존"],
  ["objective", "오브젝트"],
  ["structure", "구조물"],
];

function normalizedScore(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(Math.min(10, Math.max(0, number)) * 10) / 10;
}

export function buildSkillProfile(normalized) {
  const score = normalized?.playtimeScore;
  const categories = score?.categories;
  return {
    overall: normalizedScore(score?.overall),
    label: nonEmptyString(score?.label),
    categories: SKILL_CATEGORIES.map(([key, label]) => {
      const value = normalizedScore(categories?.[key]);
      return {
        key,
        label,
        value,
        displayValue: value == null ? "측정 없음" : value.toFixed(1),
      };
    }),
  };
}
```

- [ ] **Step 4: 역량 모델 테스트를 GREEN으로 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test tests/coaching-plan-models.mjs
```

Expected: 포커스 테스트와 새 역량 모델 2개 테스트가 모두 PASS한다.

- [ ] **Step 5: 접근 가능한 meter와 내부 점수 고지를 요구하는 정적 테스트를 작성한다**

```js
test("skill profile exposes six accessible internal coaching meters", () => {
  assert.match(html, /<section\b[^>]*class="skill-profile"[^>]*aria-labelledby="skill-profile-title"/i);
  assert.match(html, /data-skill-profile/);
  assert.match(appJs, /buildSkillProfile/);
  assert.match(appJs, /role="meter"/);
  assert.match(appJs, /aria-valuemin="0"/);
  assert.match(appJs, /aria-valuemax="10"/);
  assert.match(appJs, /aria-valuenow=/);
  assert.match(appJs, /측정 없음/);
  assert.ok(
    `${html}\n${appJs}`.includes("티어 평균이나 백분위가 아닌"),
    "profile must identify the numbers as internal coaching scores",
  );

  const at1024 = mediaBlocks(css, 1024);
  assert.match(at1024, /\.skill-profile\s*\{[^}]*grid-template-columns\s*:\s*1fr;/s);
  const at480 = mediaBlocks(css, 480);
  assert.match(
    at480,
    /\.skill-row\s*\{[^}]*grid-template-columns\s*:\s*64px minmax\(0,\s*1fr\) 40px;/s,
  );
});
```

- [ ] **Step 6: 프로필 UI 구현 전 RED를 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test --test-name-pattern="skill profile" tests/standalone-ui.mjs
```

Expected: 프로필 호스트와 renderer가 없어 FAIL한다.

- [ ] **Step 7: metric section 안에 프로필 호스트를 추가한다**

기존 `data-evidence-metrics` 바로 뒤에 다음 구조를 넣는다.

```html
<section class="skill-profile" aria-labelledby="skill-profile-title">
  <div class="skill-profile__intro">
    <p class="eyebrow">SKILL PROFILE</p>
    <h3 id="skill-profile-title">여섯 역량으로 경기 해체</h3>
    <p>티어 평균이나 백분위가 아닌, 선택 경기의 내부 코칭 점수입니다.</p>
  </div>
  <div class="skill-profile__content" data-skill-profile>
    <p class="empty-copy">역량 점수를 불러오는 중입니다.</p>
  </div>
</section>
```

- [ ] **Step 8: app.js에 profile 렌더와 상태 초기화를 구현한다**

기존 module import를 다음으로 교체하고 `elements` object에 정확한 property를 삽입한다.

```js
import {
  buildFocusModel,
  buildSkillProfile,
  findFocusMomentId,
} from "./coaching-plan.js";
```

`elements` object에 다음 property를 삽입한다.

```js
skillProfile: document.querySelector("[data-skill-profile]"),
```

`renderMatchOverview()` 뒤에 다음 renderer를 추가한다.

```js
function renderSkillProfile(model) {
  const overallCopy = model.overall == null
    ? "종합 측정 없음"
    : `종합 ${model.overall.toFixed(1)} / 10${model.label ? ` · ${model.label}` : ""}`;

  elements.skillProfile.innerHTML = `
    <p class="skill-profile__overall">${escapeHtml(overallCopy)}</p>
    <div class="skill-profile__rows">
      ${model.categories.map((category) => {
        if (category.value == null) {
          return `
            <div class="skill-row skill-row--missing">
              <span>${escapeHtml(category.label)}</span>
              <strong>측정 없음</strong>
            </div>`;
        }
        return `
          <div class="skill-row">
            <span>${escapeHtml(category.label)}</span>
            <div class="skill-meter"
              role="meter"
              aria-label="${escapeHtml(category.label)}"
              aria-valuemin="0"
              aria-valuemax="10"
              aria-valuenow="${category.value.toFixed(1)}">
              <span style="--skill-value: ${category.value * 10}%"></span>
            </div>
            <strong>${category.displayValue}</strong>
          </div>`;
      }).join("")}
    </div>`;
}
```

`renderDetail()`의 `renderFocus` 다음과 `resetDependentPanels()`의 focus reset 다음에 각각 아래 줄을 삽입한다.

```js
renderSkillProfile(buildSkillProfile(detail?.normalized));

elements.skillProfile.innerHTML = `<p class="empty-copy">${isLoading
  ? "역량 점수를 불러오는 중입니다."
  : "표시할 역량 점수가 없습니다."}</p>`;
```

- [ ] **Step 9: 프로필 스타일과 1024px 재배치를 구현한다**

다음 CSS를 추가한다.

```css
.skill-profile {
  display: grid;
  grid-template-columns: minmax(220px, 0.62fr) minmax(0, 1.38fr);
  gap: 48px;
  margin-top: 42px;
  padding-top: 42px;
  border-top: 1px solid var(--line);
}

.skill-profile__intro h3 {
  margin: 0;
  font-size: 1.35rem;
}

.skill-profile__intro > p:last-child {
  margin: 16px 0 0;
  color: var(--muted);
}

.skill-profile__overall {
  margin: 0 0 20px;
  color: var(--muted-strong);
  font-weight: 750;
}

.skill-profile__rows {
  display: grid;
  gap: 15px;
}

.skill-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 48px;
  gap: 14px;
  align-items: center;
  min-width: 0;
}

.skill-row > span,
.skill-row > strong {
  font-size: 0.78rem;
}

.skill-row > strong {
  text-align: right;
}

.skill-meter {
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.skill-meter > span {
  display: block;
  width: var(--skill-value);
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--blue), var(--lime));
}

.skill-row--missing {
  grid-template-columns: 110px 1fr;
  color: var(--muted);
}

@media (max-width: 1024px) {
  .skill-profile {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .skill-row {
    grid-template-columns: 64px minmax(0, 1fr) 40px;
    gap: 9px;
  }

  .skill-row--missing {
    grid-template-columns: 64px 1fr;
  }
}
```

- [ ] **Step 10: 모델·ARIA·반응형 계약을 통과시킨다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan
npm --prefix sites test
npm --prefix sites run build
git diff --check
```

Expected: 범위 제한, 한 자리 표시, 6개 고정 순서, 결측치, meter ARIA, 1024px 재배치가 모두 PASS한다.

- [ ] **Step 11: 역량 프로필을 커밋한다**

```bash
git add sites/app/coaching-plan.js sites/app/index.html sites/app/app.js sites/app/styles.css sites/tests/coaching-plan-models.mjs sites/tests/standalone-ui.mjs
git commit -m "feat: add source-backed skill profile"
```

---

### Task 4: 초반·중반·후반 PHASE COACH 구현

**Files:**

- Modify: `sites/app/coaching-plan.js`
- Modify: `sites/tests/coaching-plan-models.mjs`
- Modify: `sites/tests/standalone-ui.mjs`
- Modify: `sites/app/index.html`
- Modify: `sites/app/app.js`
- Modify: `sites/app/styles.css`

**Interfaces:**

- Consumes: `normalized.phaseContext.early|mid|late`, `analysis.phaseSummaries[]`, and private helpers `asArray`, `nonEmptyString`, `finiteNumberOrNull`.
- Produces: `buildPhaseModels(normalized, analysis): PhaseModel[]`, exactly three items of `PhaseModel = {key: "early"|"mid"|"late", phase: "EARLY"|"MID"|"LATE", label: string, timeRange: string, kills: number|null, deaths: number|null, assists: number|null, notableEventCount: number|null, summary: string, hasContext: boolean}`; DOM hooks `data-phase-coach` and `data-phase-cards`.

- [ ] **Step 1: 구간 결합과 요약 fallback의 실패 테스트를 작성한다**

모델 import를 다음으로 교체하고 테스트를 넣는다.

```js
import {
  buildFocusModel,
  buildPhaseModels,
  buildSkillProfile,
  findFocusMomentId,
} from "../app/coaching-plan.js";

test("buildPhaseModels joins phase facts with EARLY MID LATE summaries", () => {
  const models = buildPhaseModels(
    {
      phaseContext: {
        early: {
          startMs: 0, endMs: 900000, kills: 1, deaths: 2,
          assists: 3, notableEventCount: 4,
        },
        mid: {
          startMs: 900001, endMs: 1800000, kills: 2, deaths: 1,
          assists: 5, notableEventCount: 6,
        },
        late: {
          startMs: 1800001, endMs: 2100000, kills: 1, deaths: 0,
          assists: 2, notableEventCount: 3,
        },
      },
    },
    {
      phaseSummaries: [
        { phase: "EARLY", summary: "초반 요약" },
        { phase: "중반", summary: "중반 요약" },
        { phase: "late", summary: "후반 요약" },
      ],
    },
  );

  assert.deepEqual(models.map((model) => model.key), ["early", "mid", "late"]);
  assert.deepEqual(models.map((model) => model.label), ["초반", "중반", "후반"]);
  assert.deepEqual(models[0], {
    key: "early",
    phase: "EARLY",
    label: "초반",
    timeRange: "00:00–15:00",
    kills: 1,
    deaths: 2,
    assists: 3,
    notableEventCount: 4,
    summary: "초반 요약",
    hasContext: true,
  });
  assert.equal(models[1].summary, "중반 요약");
  assert.equal(models[2].summary, "후반 요약");
});

test("buildPhaseModels preserves facts when AI summaries are absent", () => {
  const models = buildPhaseModels(
    { phaseContext: { early: { startMs: 0, endMs: 600000, kills: 0 } } },
    { phaseSummaries: [] },
  );
  assert.equal(models[0].hasContext, true);
  assert.equal(models[0].summary, "이 구간의 AI 요약이 없습니다.");
  assert.equal(models[1].hasContext, false);
  assert.equal(models[1].summary, "");
});
```

같은 RED 단계에서 파일 상단에 다음 import/경계를 추가한다.

```js
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsRoot, "..", "..");

function repoPath(publicPath) {
  assert.equal(typeof publicPath, "string");
  assert.ok(publicPath.startsWith("/data/samples/"));
  const relativePath = publicPath.slice(1);
  assert.equal(path.posix.normalize(relativePath), relativePath);
  const resolved = path.resolve(repoRoot, relativePath);
  assert.ok(resolved.startsWith(`${repoRoot}${path.sep}`));
  return resolved;
}
```

그리고 모든 커밋 샘플 계약을 함께 추가한다.

```js
test("all committed samples produce focus, six skills, and three phases", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(repoRoot, "data", "samples", "manifest.json"), "utf8"),
  );
  const noSummarySamples = new Set([
    "sample-kr-8186180726",
    "sample-kr-8186417086",
  ]);

  for (const sample of manifest.samples) {
    const [normalized, analysis] = await Promise.all([
      readFile(repoPath(sample.normalizedPath), "utf8").then(JSON.parse),
      readFile(repoPath(sample.analysisPath), "utf8").then(JSON.parse),
    ]);
    const focus = buildFocusModel(analysis);
    const profile = buildSkillProfile(normalized);
    const phases = buildPhaseModels(normalized, analysis);

    assert.ok(focus, `${sample.id}: missing focus`);
    assert.equal(profile.categories.length, 6, `${sample.id}: skill count`);
    assert.equal(phases.length, 3, `${sample.id}: phase count`);

    if (noSummarySamples.has(sample.id)) {
      for (const phase of phases.filter((model) => model.hasContext)) {
        assert.equal(phase.summary, "이 구간의 AI 요약이 없습니다.");
      }
    }
  }
});
```

- [ ] **Step 2: phase export가 없어 RED가 되는지 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test tests/coaching-plan-models.mjs
```

Expected: `buildPhaseModels` export 오류로 FAIL한다.

- [ ] **Step 3: 3구간 모델을 순수 모듈에 구현한다**

`sites/app/coaching-plan.js`에 다음 규칙을 추가한다.

```js
const PHASES = [
  { key: "early", phase: "EARLY", label: "초반" },
  { key: "mid", phase: "MID", label: "중반" },
  { key: "late", phase: "LATE", label: "후반" },
];

function finiteNumberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatClock(ms) {
  const value = finiteNumberOrNull(ms);
  if (value == null) return "";
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizedPhaseName(value) {
  const name = nonEmptyString(value);
  const aliases = {
    early: "EARLY", EARLY: "EARLY", 초반: "EARLY",
    mid: "MID", MID: "MID", 중반: "MID",
    late: "LATE", LATE: "LATE", 후반: "LATE",
  };
  return aliases[name] || aliases[name.toUpperCase()] || "";
}

export function buildPhaseModels(normalized, analysis) {
  const summaries = asArray(analysis?.phaseSummaries);
  return PHASES.map(({ key, phase, label }) => {
    const context = normalized?.phaseContext?.[key];
    const hasContext = Boolean(
      context
      && typeof context === "object"
      && Object.keys(context).length > 0,
    );
    const start = formatClock(context?.startMs);
    const end = formatClock(context?.endMs);
    const summary = summaries.find(
      (entry) => normalizedPhaseName(entry?.phase) === phase,
    );
    return {
      key,
      phase,
      label,
      timeRange: hasContext
        ? (start && end ? `${start}–${end}` : start || end || "시간 정보 없음")
        : "",
      kills: hasContext ? finiteNumberOrNull(context?.kills) : null,
      deaths: hasContext ? finiteNumberOrNull(context?.deaths) : null,
      assists: hasContext ? finiteNumberOrNull(context?.assists) : null,
      notableEventCount: hasContext
        ? finiteNumberOrNull(context?.notableEventCount)
        : null,
      summary: hasContext
        ? nonEmptyString(summary?.summary) || "이 구간의 AI 요약이 없습니다."
        : "",
      hasContext,
    };
  });
}
```

- [ ] **Step 4: phase 모델과 전체 샘플 계약을 GREEN으로 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test tests/coaching-plan-models.mjs
```

Expected: phase 단위 테스트, 두 무요약 샘플 fallback, 모든 커밋 샘플의 6개 역량/3개 구간 계약이 PASS한다.

- [ ] **Step 5: 3개 카드, 사실/AI 분리, 모바일 1열 계약을 작성한다**

`sites/tests/standalone-ui.mjs`에 다음 테스트를 추가한다.

```js
test("phase coach keeps phase facts separate from AI summaries", () => {
  assert.match(html, /<section\b[^>]*data-phase-coach[^>]*aria-labelledby="phase-title"/i);
  assert.match(html, /data-phase-cards/);
  assert.ok(
    html.indexOf("data-phase-coach") < html.indexOf("data-evidence-moments"),
    "phase coach must appear before evidence moments",
  );
  assert.match(appJs, /buildPhaseModels/);
  assert.match(appJs, /PHASE FACTS/);
  assert.match(appJs, /AI 구간 요약/);
  assert.match(appJs, /이 구간의 AI 요약이 없습니다\./);

  const at720 = mediaBlocks(css, 720);
  assert.match(
    at720,
    /\.phase-grid\s*\{[^}]*grid-template-columns\s*:\s*1fr;/s,
  );
});
```

같은 파일에 이스케이프와 상태 초기화 계약을 추가한다.

```js
test("coaching plan renderers preserve the HTML escaping boundary", () => {
  assert.match(appJs, /escapeHtml\(model\.title/);
  assert.match(appJs, /escapeHtml\(model\.description/);
  assert.match(appJs, /escapeHtml\(model\.actionText/);
  assert.match(appJs, /escapeHtml\(overallCopy\)/);
  assert.match(appJs, /escapeHtml\(category\.label\)/);
  assert.match(appJs, /escapeHtml\(model\.summary\)/);
  assert.doesNotMatch(coachingPlanJs, /innerHTML|document\.|window\./);
});

test("non-ready states clear every coaching plan panel", () => {
  const resetSource = appJs.slice(
    appJs.indexOf("function resetDependentPanels"),
    appJs.indexOf("function renderError"),
  );
  for (const property of ["focusContent", "skillProfile", "phaseCards"]) {
    assert.match(
      resetSource,
      new RegExp(`elements\\.${property}`),
      `reset must clear ${property}`,
    );
  }
  for (const copy of [
    "다음 게임 포커스를 불러오는 중입니다.",
    "표시할 코칭 포커스가 없습니다.",
    "역량 점수를 불러오는 중입니다.",
    "표시할 역량 점수가 없습니다.",
    "구간 코칭을 불러오는 중입니다.",
    "표시할 구간 코칭이 없습니다.",
  ]) {
    assert.ok(resetSource.includes(copy), `missing reset copy: ${copy}`);
  }
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*scroll-behavior\s*:\s*auto\s*!important/,
  );
});
```

- [ ] **Step 6: phase UI 구현 전 RED를 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test \
  --test-name-pattern="phase coach|coaching plan renderers preserve|non-ready states clear every coaching plan panel" \
  tests/standalone-ui.mjs
```

Expected: phase 호스트/renderer, 새 패널 reset, 이스케이프 경계가 아직 없어 세 계약이 FAIL한다.

- [ ] **Step 7: metric section과 evidence section 사이에 phase host를 추가한다**

```html
<section class="phase-section" data-phase-coach aria-labelledby="phase-title">
  <div class="section-heading">
    <div>
      <p class="eyebrow">PHASE COACH</p>
      <h2 id="phase-title">구간별 사실과 코칭 해석</h2>
    </div>
    <p>초반·중반·후반의 기록을 같은 기준으로 비교합니다.</p>
  </div>
  <div class="phase-grid" data-phase-cards>
    <p class="empty-copy">구간 코칭을 불러오는 중입니다.</p>
  </div>
</section>
```

- [ ] **Step 8: app.js에 phase 렌더와 초기화를 구현한다**

기존 module import를 다음으로 교체한다.

```js
import {
  buildFocusModel,
  buildPhaseModels,
  buildSkillProfile,
  findFocusMomentId,
} from "./coaching-plan.js";
```

`elements` object에 다음 property를 삽입한다.

```js
phaseCards: document.querySelector("[data-phase-cards]"),
```

`renderSkillProfile()` 뒤에 다음 renderer를 추가한다.

```js
function displayFact(value) {
  return Number.isFinite(value) ? String(value) : "—";
}

function renderPhaseCoach(models) {
  elements.phaseCards.innerHTML = models.map((model) => {
    if (!model.hasContext) {
      return `
        <article class="phase-card phase-card--empty">
          <div class="phase-card__head">
            <span>${escapeHtml(model.phase)}</span>
            <h3>${escapeHtml(model.label)}</h3>
          </div>
          <p class="empty-copy">이 구간의 경기 기록이 없습니다.</p>
        </article>`;
    }
    return `
      <article class="phase-card">
        <div class="phase-card__head">
          <span>${escapeHtml(model.phase)} · ${escapeHtml(model.timeRange)}</span>
          <h3>${escapeHtml(model.label)}</h3>
        </div>
        <div class="phase-card__facts" aria-label="${escapeHtml(model.label)} 구간 사실">
          <span>PHASE FACTS</span>
          <dl>
            <div><dt>K / D / A</dt><dd>${displayFact(model.kills)} / ${displayFact(model.deaths)} / ${displayFact(model.assists)}</dd></div>
            <div><dt>중요 사건</dt><dd>${displayFact(model.notableEventCount)}건</dd></div>
          </dl>
        </div>
        <div class="phase-card__summary">
          <span>AI 구간 요약</span>
          <p>${escapeHtml(model.summary)}</p>
        </div>
      </article>`;
  }).join("");
}
```

`renderDetail()`의 skill profile 호출 다음과 `resetDependentPanels()`의 skill reset 다음에 각각 아래 줄을 삽입한다.

```js
renderPhaseCoach(buildPhaseModels(detail?.normalized, detail?.analysis));

elements.phaseCards.innerHTML = `<p class="empty-copy">${isLoading
  ? "구간 코칭을 불러오는 중입니다."
  : "표시할 구간 코칭이 없습니다."}</p>`;
```

- [ ] **Step 9: phase card 스타일과 720px 단일 열을 구현한다**

다음 CSS를 추가한다.

```css
.phase-section {
  padding: 88px 0;
  border-top: 1px solid var(--line);
}

.phase-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.phase-card {
  min-width: 0;
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow-wrap: anywhere;
  background: rgba(255, 255, 255, 0.025);
}

.phase-card__head > span,
.phase-card__facts > span,
.phase-card__summary > span {
  font-size: 0.62rem;
  font-weight: 850;
  letter-spacing: 0.1em;
}

.phase-card__head > span {
  color: var(--muted);
}

.phase-card__head h3 {
  margin: 8px 0 24px;
  font-size: 1.4rem;
}

.phase-card__facts {
  padding: 18px;
  border-radius: 12px;
  background: var(--blue-soft);
}

.phase-card__facts > span {
  color: var(--blue);
}

.phase-card__facts dl {
  display: grid;
  gap: 12px;
  margin: 15px 0 0;
}

.phase-card__facts dl > div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.phase-card__facts dt,
.phase-card__facts dd {
  margin: 0;
  font-size: 0.76rem;
}

.phase-card__summary {
  padding-top: 22px;
}

.phase-card__summary > span {
  color: var(--lime);
}

.phase-card__summary p {
  margin: 12px 0 0;
  color: var(--muted-strong);
  line-height: 1.7;
}

@media (max-width: 720px) {
  .phase-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 10: phase 모델·DOM·전체 샘플 계약을 통과시킨다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan
npm --prefix sites test
npm --prefix sites run build
git diff --check
```

Expected: 3구간 순서, K/D/A, 사건 수, 영문·한글 단계 매핑, AI 요약 fallback, 모든 커밋 샘플 호환성, 720px 1열이 PASS한다.

- [ ] **Step 11: 구간 코치를 커밋한다**

```bash
git add sites/app/coaching-plan.js sites/app/index.html sites/app/app.js sites/app/styles.css sites/tests/coaching-plan-models.mjs sites/tests/standalone-ui.mjs
git commit -m "feat: add phase coach"
```

---

### Task 5: 통합 회귀와 브라우저 플레이 테스트

**Files:**

- Verify: `sites/app/index.html`
- Verify: `sites/app/styles.css`
- Verify: `sites/app/app.js`
- Verify: `sites/app/coaching-plan.js`
- Verify: `sites/tests/*.mjs`
- Temporary screenshots: `/tmp/lolgg-coaching-*.png`

**Interfaces:**

- Consumes: all Task 1–4 commits, local Vite URL `http://127.0.0.1:4173`, native select/button/checkbox controls, and in-app Browser APIs documented by `browser:control-in-app-browser`.
- Produces: fresh automated test/build evidence; four viewport screenshots in `/tmp`; interaction, focus, overflow, reduced-motion-code-path, and console-health results.

- [ ] **Step 1: 자동 검증을 위험도 순서로 실행한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan
npm --prefix sites test
npm --prefix sites run build
npm test
node scripts/design-audit.js --file sites/app/styles.css --context index.html,app.js,coaching-plan.js --scope all --format markdown
git diff --check
git status --short
```

Expected: Sites 모델/정적/읽기 전용 테스트, Vite build, 저장소 전체 테스트가 모두 PASS한다. 디자인 감사에는 새 font-family나 임의 점수·레이아웃 토큰 드리프트가 없어야 한다.

- [ ] **Step 2: 브라우저 QA용 로컬 서버를 한 번만 시작한다**

Run in a retained terminal from the worktree:

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
npm run stage
npx vite --host 127.0.0.1 --port 4173
```

Expected: 출력된 Local URL이 `http://127.0.0.1:4173`이고 `/healthz`와 첫 샘플 로드가 성공한다. 포트 스캔이나 두 번째 서버 기동은 하지 않는다.

- [ ] **Step 3: browser:control-in-app-browser로 핵심 사용자 흐름을 플레이 테스트한다**

먼저 `browser:control-in-app-browser`를 사용한다. Node browser session에서 아래 bootstrap을 한 번 실행하고, 즉시 `nodeRepl.write(await browser.documentation());`의 전체 출력을 읽는다.

```js
if (globalThis.agent?.browsers == null) {
  const { setupBrowserRuntime } = await import(
    "/Users/a1234/.codex/plugins/cache/openai-bundled/browser/26.707.31428/scripts/browser-client.mjs"
  );
  await setupBrowserRuntime({ globals: globalThis });
}
globalThis.browser = await agent.browsers.get("iab");
nodeRepl.write(await browser.documentation());
```

문서화된 in-app Browser와 `tab.playwright` API만 사용해 `http://127.0.0.1:4173`을 열고 다음 순서로 실제 UI를 조작한다.

1. 1280×900에서 첫 샘플을 열고 제목이 축소된 히어로 안에 들어오는지 확인.
2. 포커스와 무관한 근거 장면을 먼저 선택한 뒤 `NEXT GAME FOCUS`의 `근거 장면 보기`를 클릭.
3. 연결된 장면 버튼의 `aria-pressed="true"`와 `document.activeElement.id === "evidence-title"` 확인.
4. 같은 포커스 버튼을 다시 키보드 Tab/Enter로 실행하고 상태 영역의 `이미 선택된 근거 장면으로 이동했습니다.` 안내 확인.
5. 샘플 select를 다른 경기로 변경해 포커스, 6개 점수, 3개 phase 카드가 모두 새 데이터로 교체되는지 확인.
6. `sample-kr-8186180726`와 `sample-kr-8186417086`에서 phase 사실은 남고 `이 구간의 AI 요약이 없습니다.`가 표시되는지 확인.
7. 근거 장면 2개를 차례로 선택해 관찰된 사실과 AI 해석이 함께 갱신되는지 확인.
8. 루틴 체크박스를 체크/해제해 READY 수치와 line-through 상태가 갱신되는지 확인.

- [ ] **Step 4: 네 viewport와 접근성/오버플로를 검증한다**

각 `1280×900`, `768×900`, `390×844`, `320×700`에서 다음을 확인하고 `/tmp/lolgg-coaching-{width}.png`로 캡처한다.

- 제목·포커스·역량명·phase 요약이 잘리거나 겹치지 않는다.
- 1024px 이하 포커스/프로필, 720px 이하 metric/phase, 480px 이하 장면 카드가 단일 열 계약대로 재배치된다.
- `document.documentElement.scrollWidth <= document.documentElement.clientWidth`가 true다.
- 버튼, select, 체크박스에 가시적인 focus-visible이 있다.
- 색상 외에도 수치·텍스트로 상태를 알 수 있다.
- 브라우저 콘솔 error, unhandled rejection, 프레임워크 오류 overlay가 없다.

- [ ] **Step 5: reduced motion과 비정상 상태는 자동 계약으로 재확인한다**

지원 여부가 브라우저 문서에 고정되지 않은 네트워크 interception이나 media emulation은 요구하지 않는다. 대신 Task 4에서 작성한 reset·이스케이프·reduced-motion CSS 계약을 이름으로 다시 실행한다.

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites
node --test \
  --test-name-pattern="non-ready states clear every coaching plan panel|coaching plan renderers preserve|next-game focus" \
  tests/standalone-ui.mjs
```

Expected: loading/empty/error reset 문구, 모든 동적 코칭 문자열의 `escapeHtml` 경계, `prefers-reduced-motion` CSS와 focus 이동의 `matchMedia` 분기가 PASS한다.

- [ ] **Step 6: 플레이 테스트 완료 게이트를 확인한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan
git status --short
ls -1 /tmp/lolgg-coaching-1280.png /tmp/lolgg-coaching-768.png /tmp/lolgg-coaching-390.png /tmp/lolgg-coaching-320.png
```

Expected: worktree가 clean이고 네 스크린샷이 모두 존재하며 Step 3–5의 assertion과 console 점검이 전부 통과했다. 하나라도 실패하면 이 Task를 완료 처리하지 않고 `superpowers:systematic-debugging`으로 원인을 재현한 뒤 해당 기능 Task의 RED→GREEN→commit 순서를 다시 수행한다.

---

### Task 6: 독립 리뷰와 완료 전 검증

**Files:**

- Review: `docs/superpowers/specs/2026-07-11-coaching-plan-enhancement-design.md`
- Review: all changed `sites/` files

**Interfaces:**

- Consumes: implementation branch diff from its starting commit through current `HEAD`, approved design spec, and Task 5 evidence.
- Produces: independently reviewed clean `HEAD` with all accepted findings covered by a failing regression test and a passing full verification run.

- [ ] **Step 1: superpowers:requesting-code-review로 독립 리뷰를 요청한다**

리뷰 범위는 구현 브랜치의 시작 커밋부터 현재 `HEAD`까지로 제한하고 다음을 명시한다.

- 승인 명세의 데이터 선택·fallback 규칙 준수
- 사실과 AI 해석의 분리
- HTML 이스케이프와 inline style 수치 안전성
- loading/empty/error stale state 방지
- 키보드 포커스와 reduced motion
- 읽기 전용 스테이징에 새 모듈만 추가됐는지
- 기존 Worker/API/hosting metadata 불변

- [ ] **Step 2: 리뷰 지적을 검증하고 필요한 것만 반영한다**

`superpowers:receiving-code-review` 절차에 따라 지적을 재현한다. 실제 결함이면 RED 테스트→수정→전체 검증 순서로 반영하고 `fix: address coaching plan review`로 커밋한다. 재현되지 않으면 근거를 남기고 코드를 바꾸지 않는다.

- [ ] **Step 3: superpowers:verification-before-completion으로 최종 명령을 새로 실행한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan
npm --prefix sites test
npm --prefix sites run build
npm test
node scripts/design-audit.js --file sites/app/styles.css --context index.html,app.js,coaching-plan.js --scope all --format markdown
git diff --check
git status --short
```

Expected: 모든 명령이 현재 `HEAD` 기준 PASS하고 worktree가 clean이다. 이전 실행 결과를 재사용하지 않는다.

---

### Task 7: 정확한 커밋을 기존 비공개 Sites URL에 게시

**Files:**

- Read: `sites/.openai/hosting.json`
- Build output: `sites/dist/`
- Temporary archive: `/tmp/lolgg-coaching-plan-sites.tgz`
- No hosting metadata edits

**Interfaces:**

- Consumes: clean pushed `HEAD`, existing project ID `appgprj_6a51165092208191aa07ca87ea0c2f29`, `sites/dist/`, and a short-lived Sites source credential.
- Produces: saved Sites version whose `result.id` becomes `version_id`; private deployment whose `result.id` becomes `deployment_id`; succeeded production URL `https://lolgg-ai-coach.crisious.chatgpt.site`.

- [ ] **Step 1: 검증한 브랜치 HEAD를 사용자 Git 원격에 push한다**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan
git status --short
git push -u origin codex/coaching-plan-enhancement
git rev-parse HEAD
```

Expected: clean한 정확한 `HEAD`가 push되고 마지막 명령의 SHA를 Sites `commit_sha`로 사용한다.

- [ ] **Step 2: Sites source repository에 같은 HEAD를 push한다**

Sites `create_source_repository_write_credential`을 기존 `project_id`인 `appgprj_6a51165092208191aa07ca87ea0c2f29`로 한 번 호출한다. 반환된 exact `remote_url`, `branch`, `auth_mode`, short-lived token을 이 단계의 단일 push 명령에만 사용한다. token을 remote URL, Git config, 파일, 로그에 저장하지 않는다.

반환된 인증 모드에 맞는 HTTP authorization header를 Git의 per-command config로만 전달한다. Git remote에는 응답의 `remote_url`, refspec에는 응답의 `branch`를 사용해 로컬 `HEAD`를 push한다. 이후 `git rev-parse HEAD`로 같은 SHA를 다시 확인한다.

Expected: Sites가 연결한 source repository의 기본 branch head가 직전 GitHub push와 같은 SHA다. credential이 만료됐을 때만 새 credential을 한 번 다시 발급한다.

- [ ] **Step 3: 검증한 source state에서 Sites archive를 만든다**

```bash
/Users/a1234/.codex/plugins/cache/openai-bundled/sites/0.1.27/scripts/package-site.sh \
  /Users/a1234/Documents/Web_LOL_Banpick-coaching-plan/sites \
  /tmp/lolgg-coaching-plan-sites.tgz
tar -tzf /tmp/lolgg-coaching-plan-sites.tgz | rg 'dist/server/index.js|dist/.openai/hosting.json'
```

Expected: 두 필수 파일이 정확히 포함되고 archive는 저장소 밖에 있다.

- [ ] **Step 4: 기존 project_id로 새 버전을 저장한다**

Sites `save_site_version`을 다음 값으로 호출한다.

- `project_id`: `appgprj_6a51165092208191aa07ca87ea0c2f29`
- `commit_sha`: 직전 `git rev-parse HEAD`의 정확한 출력
- `archive`: `/tmp/lolgg-coaching-plan-sites.tgz`

Expected: 응답의 `result.id`가 새 saved-version ID다. 이 exact 값을 이후 호출의 `version_id`로 보관하고 `result.version_number`를 사용자용 버전 번호로 기록한다. 저장만 하고 아직 배포되지 않은 상태다.

- [ ] **Step 5: owner-only 확인을 강제하는 private deployment를 실행한다**

같은 `project_id`와 Step 4의 exact `version_id`로 Sites `deploy_private_site_version`을 호출한다. 배포 응답의 `result.id`를 exact `deployment_id`로 보관한다. 상태가 pending/building/publishing이면 `get_deployment_status`에 다음 세 값을 모두 전달해 60초 미만 간격으로 이어서 확인한다.

- `project_id`: `appgprj_6a51165092208191aa07ca87ea0c2f29`
- `version_id`: Step 4의 `result.id`
- `deployment_id`: private deployment 응답의 `result.id`

Expected: `status: "succeeded"`와 기존 안정 URL `https://lolgg-ai-coach.crisious.chatgpt.site`가 반환된다. private 도구가 owner-only가 아님을 이유로 거부하면 일반 배포로 우회하지 말고 사용자 승인을 요청한다.

- [ ] **Step 6: 배포 URL에서 최종 smoke play test를 수행한다**

성공 응답의 exact deployed URL로 `open_in_codex`를 `threadId` 없이 한 번 호출한다. 이어서 그 in-app Browser 탭에서 다음을 확인한다.

- 소유자 세션에서 접근 가능하고 공개 전환되지 않았다.
- title 축소, focus 버튼, 6개 meter, 3개 phase 카드가 보인다.
- 샘플 변경과 근거 이동이 작동한다.
- console error와 가로 overflow가 없다.

- [ ] **Step 7: 임시 파일과 로컬 서버만 정리하고 결과를 전달한다**

```bash
rm -f /tmp/lolgg-coaching-plan-sites.tgz /tmp/lolgg-coaching-*.png
```

retained Vite 서버를 종료한다. 사용자의 원래 dirty 작업 폴더와 구현 worktree/브랜치는 유지한다. 최종 전달에는 기존 비공개 URL, 추가된 세 기능, 자동 테스트·브라우저 플레이 테스트 결과만 간결하게 포함한다.

---

## Plan Self-Review Checklist

- [ ] 모든 placeholder 문구가 없는지 `rg -n "T[B]D|T[O]DO|F[I]XME|P[L]ACEHOLDER|implement l[a]ter|add appr[o]priate|similar t[o]" docs/superpowers/plans/2026-07-11-coaching-plan-enhancement.md`로 확인한다.
- [ ] `buildFocusModel`, `findFocusMomentId`, `buildSkillProfile`, `buildPhaseModels`의 필드 이름이 테스트·렌더러·설계 문서에서 동일한지 확인한다.
- [ ] 5개 배포 자산 목록이 `stage-assets.mjs`, `read-only-smoke.mjs`, `standalone-ui.mjs`에서 동일한지 확인한다.
- [ ] 새 섹션 순서가 hero → focus → metrics/profile → phase → evidence → protocols → trace인지 확인한다.
- [ ] 배포 단계가 build → clean commit → GitHub push → Sites source push → package → save version → private deploy → poll 순서인지 확인한다.
- [ ] 원래 dirty 샘플과 `sites/worker/index.js`, `sites/vite.config.js`, `sites/.openai/hosting.json`을 변경하지 않는지 확인한다.
