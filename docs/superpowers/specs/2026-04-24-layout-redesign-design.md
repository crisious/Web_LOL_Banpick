# Layout & Information Architecture Redesign — Design Spec

- **Sub-project**: B (of A → B → C 분해)
- **작성일**: 2026-04-24
- **예상 기간**: 2~3일 (6-8 커밋)
- **영향 범위**: `index.html`, `styles.css`, `main.js` (소폭), `design-tokens.md`, `README.md`
- **비영향**: `admin.*`, `server.js`, `data/**`, API 스펙, AI 에이전트 흐름

---

## 1. 배경 · 목표

Sub-project A(iteration 7)에서 토큰 시스템을 88% 커버리지까지 정리했다. 본 sub-project B는 **정보 밀도와 시각 계층**을 OP.GG / Mobalytics 수준으로 한 단계 더 조이는 레이아웃 리디자인이다.

현재 구조의 식별된 문제 (8개):

1. 좌측 사이드바 `.section-nav`와 우측 메인 `.tab-bar`가 동일한 4개 탭(개요/분석/타임라인/추세) 중복
2. Hero Panel이 4개 meta 카드(Sample/Player/Match/Collected) + hero-lede + hero-pills로 사이드바 상단을 과점
3. 사이드바에 Player Hub / Nav / Sample Library / Riot API Intake 4단 스택 → 세로 길이 과다
4. Quick View가 7개 아이템(Champion/Role/Result/Queue/Duration/Patch/Mastery)을 그리드로 나열 → 밀도 낮음
5. Overview 상단에 Headline + overall summary + game flow summary 삼중 텍스트 레이어
6. 모든 섹션 외곽에 장식 `.eyebrow` 라벨 (Replay Coach Dashboard / Player Hub / Overview Tabs / Headline / Quick View / Phase Review ...) → cluttered
7. 대시보드 topbar("전적 사이트 문법으로 다시 짠..." + 긴 helper 문구)가 로그인 후에도 유지되어 노이즈
8. 10게임 리스트 `.candidate-card--button`이 카드 형식이라 1뷰포트에 표시 개수 적음 + 탭 전환 시 blank flash

본 이터레이션의 핵심 지표:

- 사이드바 세로 길이 desktop 기준 **30%+ 감소**
- Overview 상단 첫 화면에서 `stat-ribbon`까지 보임 (현재 스크롤 필요)
- 10게임 리스트 1뷰포트에 **10개 모두 표시** (1080p 기준)
- 탭 전환 시 blank flash 제거 (skeleton 노출)

**레이아웃 직전 이터레이션과의 경계**: 토큰 시스템은 A에서 완료. 본 B는 **컴포넌트 배치와 밀도**에 집중하고 토큰은 재사용만 한다. 신규 컴포넌트는 기존 `--tint-*`, `--shadow-hover`, `--mint/rose-bg-*`, `--amber-border` 등을 활용한다.

---

## 2. 범위 · 비범위

### In scope

1. **중복 내비게이션 제거** — 사이드바 `.section-nav` 및 `.panel--nav` 삭제. 메인 `.tab-bar` 유지
2. **Hero Panel 슬림화** — 4 meta 카드 → **2 meta(Player / Collected)**. hero-lede + hero-pills 삭제. `.identity-card` 네이밍으로 전환
3. **사이드바 재구성** — Identity Card + Sample Switcher + `<details>`로 접힌 Riot API Intake (3단 스택)
4. **Overview 상단 압축** — `.panel--headline` + `.panel--snapshot` 병합해 **1-line 챔프·역할 헤드라인 + 1줄 요약 + result pill** 블록으로
5. **Quick View 재배치** — 7 → **3개 핵심(Queue / CS/분 / Patch)**. Champion/Role/Result는 헤드라인에 통합. Duration은 result pill에 합침. Mastery 항목은 유지
6. **장식 eyebrow 정리** — 섹션 외곽 `.eyebrow` 전면 삭제. 하위 카드 내부 `.meta-label` 은 유지
7. **Topbar 제거(대시보드 진입 후)** — `.topbar` 섹션 DOM 삭제. 해당 문구 중 필요한 부분은 로그인 카드로 이관 검토
8. **10게임 리스트 OP.GG row format** — `.candidate-card--button` → `.match-row` 컴포넌트. 한 줄 per match. 탭 전환 시 `.skeleton--card` placeholder 노출

### Out of scope

- **`main.js` 상태 머신 로직** 변경 (뷰 전환, 샘플 로딩, AI 에이전트 호출, recent-matches API 호출 타이밍)
- 신규 화면, 신규 API (→ Sub-project C 다중 경기 누적 분석 뷰)
- 탭 전환 **prefetch / 사전 렌더**(skeleton은 포함, prefetch는 아님 — 브레인스토밍에서 B3 거절)
- `admin.*` 파일군
- 토큰 추가·이름 변경 (A에서 완료)
- Riot API 호출 스펙, AI 프롬프트, 샘플 데이터 스키마

---

## 3. 컴포넌트 설계

### 3.1 사이드바 — 3단 스택

**새 DOM 구조 (개념도)**:

```html
<aside class="sidebar-stack" aria-label="플레이어 허브">
  <article class="identity-card" data-identity-card>
    <div class="identity-card__avatar" data-snapshot-champion-icon></div>
    <div class="identity-card__body">
      <strong data-hero-player>매운맛 비스킷#KR1</strong>
      <p class="meta-label">Collected <span data-hero-date></span></p>
    </div>
  </article>

  <article class="panel panel--samples" aria-labelledby="sample-library-title">
    <h3 id="sample-library-title">저장된 샘플</h3>
    <div class="sample-switcher" data-sample-switcher></div>
  </article>

  <details class="panel panel--fetcher" data-fetcher-details>
    <summary>Riot API 재조회</summary>
    <form class="fetch-form" data-recent-form>...</form>
    <div class="fetch-status" data-fetch-status aria-live="polite"></div>
  </details>
</aside>
```

**변경 요약**:

- `hero-panel` → `.identity-card` (새 컴포넌트). meta-card 4개 → avatar + player + collected 1줄 블록
- `panel--nav` 전체 삭제 (`.section-nav` / `.section-link` 포함)
- `panel--samples` — 골격 유지, 내부 `section-heading` 축소
- `panel--fetcher` — `<article>` → `<details>` 변경, 기본 접힘 상태

**JS 영향**:

- `data-hero-player`, `data-hero-date`, `data-snapshot-champion-icon`, `data-sample-switcher`, `data-recent-form`, `data-fetch-status` — **보존**
- `data-sample-id`, `data-hero-match` — 삭제 (Identity Card에서 제거)
- `data-theme-copy`, `data-hero-pills` — 삭제 (hero-lede, hero-pills 제거)
- `data-tab-target` (section-link) — 삭제 (nav 전체 삭제)

**main.js 영향**: 삭제된 셀렉터를 참조하던 렌더 함수에서 해당 라인 제거. 약 15-25줄 소규모 정리.

### 3.2 상세 상단 — Compact Detail Header

**새 DOM 구조**:

```html
<section class="detail-header" data-detail-header>
  <div class="detail-header__main">
    <h2 class="detail-header__title">
      <span data-snapshot-champion>Nami</span>
      <span class="dot">·</span>
      <span data-snapshot-role>SUPPORT</span>
    </h2>
    <p class="detail-header__headline" data-headline>초반 시야 선점으로 교전 주도권 확보</p>
    <p class="detail-header__summary" data-quick-summary></p>
  </div>
  <div class="detail-header__result">
    <span class="winloss-pill" data-result-pill></span>
    <span class="detail-header__duration" data-snapshot-duration>30:45</span>
  </div>
</section>

<section class="detail-metrics" data-detail-metrics>
  <div class="metric"><span class="meta-label">QUEUE</span><strong data-snapshot-queue>솔랭</strong></div>
  <div class="metric"><span class="meta-label">CS/분</span><strong data-snapshot-cs-per-min>8.2</strong></div>
  <div class="metric"><span class="meta-label">PATCH</span><strong data-snapshot-patch>16.7</strong></div>
  <div class="metric metric--mastery" data-snapshot-mastery hidden>
    <span class="meta-label">MASTERY</span><strong data-snapshot-mastery-text></strong>
  </div>
</section>
```

**변경 요약**:

- `.panel--headline` + `.panel--snapshot` 두 패널 → 단일 `.detail-header` + `.detail-metrics` (두 섹션이지만 시각적으로 connected)
- Overview 삼중 텍스트(`data-headline` + `data-overall-summary` + `data-game-flow-summary`) → 단일 `data-quick-summary` (main.js에서 세 값을 우선순위로 병합해 1-2줄로)
- Quick View 7항목 → 3항목 (+1 hidden mastery)
- winloss-pill + duration 우측 묶음

**JS 영향**:

- `data-headline`, `data-snapshot-champion/role/queue/duration/patch/mastery*`, `data-result-pill` — **보존**
- **신규**: `data-quick-summary`, `data-snapshot-cs-per-min` (기존 stat-ribbon에서 분리해 가져옴)
- **삭제**: `data-overall-summary`, `data-game-flow-summary`, `data-snapshot-result`, `data-snapshot-confidence`, `data-theme-copy`

**main.js 영향**: 상세 렌더 함수에서 `overall_summary`/`game_flow_summary` 읽던 부분을 `quick_summary = headline || overall_summary.split(".")[0] || game_flow_summary.slice(0, 80)` 같은 fallback 체인으로 변경. result/confidence 표시 부분은 winloss-pill에 흡수. 약 30-50줄 수정.

### 3.3 섹션 외곽 eyebrow 일괄 제거

**대상**: `.panel--headline`, `.panel--snapshot`, `.panel--nav`, `.panel--samples`, `.panel--fetcher`, `.panel--phases`, `.insight-grid`, `.section-block` (Score / Comparison / Execution / Timeline 섹션들), `.panel--trends`, `.panel--reports`, `.panel--evidence` 등 약 15곳

**유지**: 하위 카드 내부의 `.meta-label` (예: `.snapshot-item span.meta-label`, `.identity-card span.meta-label`)은 소형 라벨이므로 유지. 이것은 정보 밀도를 구성하는 요소지 장식이 아님.

**구현**: `index.html`에서 `<p class="eyebrow">...` + 인접 `.section-heading` 구조 정리. `styles.css`의 `.eyebrow` 규칙은 남겨두되 사용처만 감소.

### 3.4 Topbar 제거

**변경 전**: 대시보드 진입 후에도 `<header class="topbar">` 가 `.app-shell` 상단에 보임.

**변경 후**: `<header class="topbar">` DOM 완전 삭제. 대신 로그인 카드(`.login-card`)의 subtitle에 해당 문구 일부 흡수 (선택):

```html
<h1 class="login-title">LoL Replay Coach</h1>
<p class="login-subtitle">전적 사이트 문법으로 짠 복기 리포트. Riot ID로 최근 10게임을 불러옵니다.</p>
```

### 3.5 10게임 리스트 — OP.GG Row Format

**현재 구조**: `.match-list-view` > `.match-list-grid` > 반복되는 `.candidate-card--button` (카드)

**새 구조**: `.match-list-view` > `.match-list-rows` > 반복되는 `.match-row`

**`.match-row` 내부**:

```html
<button class="match-row" data-match-row data-match-id="KR_xxx" data-result="WIN"
        role="option" aria-selected="false" aria-pressed="false">
  <span class="match-row__icon" aria-hidden="true"></span>
  <div class="match-row__main">
    <div class="match-row__title">
      <strong class="match-row__champion">Nami</strong>
      <span class="match-row__role">SUPPORT</span>
      <span class="match-row__queue">솔랭</span>
      <span class="match-row__patch">16.7</span>
    </div>
    <div class="match-row__stats">
      <span class="match-row__kda">5/2/12</span>
      <span class="match-row__duration">30:45</span>
      <span class="match-row__cs">CS 8.2/분</span>
    </div>
  </div>
  <span class="match-row__result" data-result="WIN">WIN</span>
</button>
```

**반응형**: 760px 이하에서 `.match-row__stats`가 두 번째 줄로 wrap. result는 항상 오른쪽 고정.

**JS 영향**:

- 현재 `.candidate-card--button` 렌더 함수를 `.match-row` 렌더 함수로 교체 (동일 함수, HTML 템플릿만 변경)
- 클릭 핸들러, aria-pressed/selected, sampleFitScore 표시(현재 있음) 동작 보존
- 약 40-60줄 템플릿 문자열 교체

### 3.6 탭 skeleton placeholder

**동작**:

1. 사용자가 `.tab-btn` 클릭 시 `main.js`의 `switchTab(targetId)` 함수가 이미 존재
2. 해당 함수 내에 추가: 대상 `.tab-page`의 `dataset.renderedOnce` 값이 없으면, 콘텐츠 비워두고 `.skeleton--card` ×3 개를 삽입
3. 실제 렌더 함수 호출 완료 시 skeleton 제거 + `dataset.renderedOnce = "true"`
4. 두 번째 이후 진입은 즉시 표시 (이미 렌더 완료)
5. `prefers-reduced-motion` 이면 skeleton에 shimmer 애니메이션 비활성 (기존 CSS 규칙이 자동 처리)

**대상 탭**: 무거운 렌더가 있는 `tab-analysis`, `tab-timeline`, `tab-trends`. `tab-overview`는 첫 진입이라 skeleton 불필요.

**main.js 영향**: `switchTab` 함수에 ~20줄 추가.

---

## 4. 변경 파일

### `index.html`

- `.topbar` 삭제
- `.sidebar-stack` 재구성 (Hero → Identity Card, nav 삭제, Sample Switcher 유지, Intake를 `<details>`로)
- 상세 상단 `.panel--headline` + `.panel--snapshot` → `.detail-header` + `.detail-metrics`
- 섹션 외곽 `.eyebrow` 15+곳 삭제
- `.match-list-grid` → `.match-list-rows` (JS 렌더 내에서는 `.match-row` 사용이므로 호스트 컨테이너만 변경)

### `styles.css`

- 신규 컴포넌트: `.identity-card`, `.match-row`, `.detail-header`, `.detail-metrics`, `.panel--fetcher[open]` 관련
- 삭제: `.section-nav`, `.section-link`, `.candidate-card--button` (mobile-candidate 잔여 규칙은 남김)
- 수정: `.topbar` 제거, `.hero-panel` → `.identity-card` 대응 규칙, `.tab-page` 전환 시 skeleton 표시 규칙
- 섹션 외곽 `.section-heading` 단순화 (h3만 남기기)
- **토큰 재사용만, 신규 토큰 추가 없음**

### `main.js`

- **소규모 변경** (~100-150줄):
  - `renderIdentityCard()` 신규 (기존 `renderHero()` 대체, 더 간결)
  - `renderDetailHeader()` 신규 (기존 `renderHeadline()` + `renderSnapshot()` 통합)
  - `renderMatchRow()` 신규 (기존 `renderCandidateCard()` 대체)
  - `switchTab()`에 skeleton 토글 로직 추가
  - 삭제 `data-*`를 참조하던 라인 제거 (약 15-25줄)
  - fallback 체인: `quick_summary = headline || overall_summary?.split(".")[0] || game_flow_summary?.slice(0, 80)`

### `design-tokens.md`

- §3 컴포넌트 라이브러리(있다면) / 새로운 패턴 요약 섹션에 `.identity-card` · `.match-row` · `.detail-header` 추가. 토큰 재사용 패턴 명시.
- §5 반응형 — 760px 이하 match-row wrap 동작 기록

### `README.md`

- "최근 UI 정리" 블릿에 iter.8 한 줄: "사이드바 슬림화 · 10게임 row format · Overview 압축 · 탭 skeleton"

### 변경하지 않는 파일

- `admin.html`, `admin.css`, `admin.js`, `draft-state.js`
- `server.js`, `data/**`, 기타 문서

---

## 5. 검증 전략

### 5.1 자동

```bash
node scripts/design-audit.js --scope all --format text --top 4
```

- Colors coverage **≥ 88%** (A의 결과 유지, 하락 시 이유 확인)
- Radius / Spacing / Font Size 회귀 없음
- `.section-nav` 관련 미사용 CSS 경고 없음

### 5.2 수동 스팟 체크 (데스크톱 + 모바일)

각 1회씩 실행, 모두 정상 동작해야 함:

1. 로그인 → 10게임 리스트 렌더 → 10개 row 모두 1뷰포트 내 표시
2. 10게임 row 클릭 → 상세 진입 (detail-progress → tab-overview) → blank flash 없음
3. tab-analysis 클릭 → skeleton 3장 → 실제 콘텐츠 → 두 번째 진입은 skeleton 없음
4. tab-timeline → tab-trends → tab-overview 왕복 → 첫 진입 각각 skeleton, 이후 즉시
5. 사이드바 Sample Switcher 클릭 → 샘플 전환 → aria-pressed 갱신, 새 샘플로 상세 리렌더
6. `<details>` Intake 열기 → Riot ID 재조회 → candidate 목록 갱신
7. 뒤로 버튼 → 10게임 리스트 복귀 → 이전 선택 상태 유지
8. 모바일 폭(≤760px): 사이드바가 상단 배너로 변환, match-row 2줄 wrap, 탭 2줄 wrap

### 5.3 접근성

- Skip link 동작
- `aria-live`, `aria-pressed`, `aria-selected` 모두 유지
- `:focus-visible` 링 모든 버튼·row에 표시
- `prefers-reduced-motion` 존중 (skeleton shimmer 비활성화)

### 5.4 git diff 리뷰

6-8 커밋으로 분리:

1. `feat(styles): add .match-row + .identity-card + .detail-header base styles`
2. `refactor(html,js): replace candidate-card with match-row in 10-match list`
3. `refactor(html,js,styles): merge headline+snapshot into compact detail-header`
4. `refactor(html,styles): slim sidebar (remove nav, hero→identity-card, intake as details)`
5. `refactor(html,styles): hide dashboard topbar, strip section-level eyebrows`
6. `feat(js): add tab skeleton placeholder during transition`
7. `docs: update design-tokens.md + README for iteration 8`
8. (옵션) `fix` 커밋 for 최종 리뷰 이슈

---

## 6. 리스크 · 완화

| 리스크 | 완화 |
|---|---|
| `main.js`의 데이터 바인딩 재배치가 예상보다 커짐 | 작업 전 `grep -rn "data-" index.html main.js` 스냅샷 저장. 작업 후 diff로 누락 셀렉터 확인. 누락 발견 시 바로 수정 커밋 |
| Topbar 제거로 대시보드 정체성 약해짐 | Identity Card 또는 `.tab-bar` 좌측 끝에 작은 "LoL Replay Coach" 라벨 보강 가능. 시각 QA에서 거부감 있으면 별도 이터레이션 |
| 삼중 텍스트 → 1줄 병합 시 AI 분석 결과가 잘림 | `line-clamp: 2` fallback, 긴 문장은 단순 절단. 헤드라인 클릭으로 전체 보기는 Sub-project C 이후에 |
| OP.GG row format이 모바일에서 한 줄에 안 들어감 | ≤760px 에서 2줄 wrap 허용. result pill은 항상 우측 고정 (flex-shrink: 0) |
| 탭 skeleton이 너무 빠르면 오히려 깜빡임 | skeleton 최소 200ms 표시 보장 (setTimeout으로). 실제 렌더가 더 빨라도 최소 노출 |
| `<details>` Intake 접혀있어 첫 사용자가 못 찾음 | `<summary>` 라벨을 "Riot ID로 최근 경기 재조회 (클릭해서 열기)" 로 명시. 첫 로그인 후 1회 열어두는 localStorage 플래그 고려 가능 (본 이터레이션 밖) |

---

## 7. 성공 기준 (DoD)

- [ ] 사이드바 세로 길이 desktop 기준 **30%+ 감소** (측정: 브라우저 DevTools로 `aside.sidebar-stack` 높이 before/after)
- [ ] Overview 상단 첫 화면에서 `stat-ribbon`까지 보임 (1080p 뷰포트, 스크롤 없이)
- [ ] 10게임 리스트 1뷰포트에 **10개 row 모두 표시** (1080p)
- [ ] 탭 전환 시 blank flash 없음 (skeleton 노출)
- [ ] 두 번째 탭 진입은 skeleton 없이 즉시
- [ ] design-audit 커버리지 유지 (colors 88%+, 기타 회귀 없음)
- [ ] `grep -rn "data-" index.html main.js | wc -l` 감소폭 5 이내 (셀렉터 대거 보존)
- [ ] 수동 플로우 8단계 전부 통과
- [ ] 접근성 4개 체크(skip/aria-live/focus-visible/reduced-motion) 통과
- [ ] 6-8 커밋으로 분리 푸시

---

## 8. 후속 이터레이션으로 이관

본 sub-project B 스코프 밖:

- **다중 경기 누적 분석 뷰** — Sub-project C
- 탭 **prefetch / 사전 렌더** — skeleton만으로 부족할 경우 추후
- 헤드라인 클릭 시 **전체 요약 모달** — Sub-project C에 포함 가능
- **로그인 후 자동 첫 Sample 로드 UX** — 현재는 sample-001이 기본이지만 최신 샘플로 바뀌도록 검토
- iteration 7 §18 edge case (rose orphan, 0.03 fade 등) 마무리 — 별도 이터레이션

---

## 9. 참고

- [Sub-project A spec](./2026-04-23-token-cleanup-design.md) — 토큰 시스템 스냅샷
- [Sub-project A plan](../plans/2026-04-23-token-cleanup.md) — 구현 방식 참고
- [design-tokens.md](../../../design-tokens.md) — 현재 토큰 테이블
- [progress.md](../../../progress.md) — "다음 추천 작업 #4 (탭 전환 로딩 최적화)" 해결
