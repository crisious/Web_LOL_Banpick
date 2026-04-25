# Web_LOL_Banpick · 디자인/접근성 통합 패치

**날짜**: 2026-04-26
**범위**: 프로덕션 코드 6개 파일 + 신규 디자인 목업 3개 (`_design-mockups/`로 정리)
**검증**: axe-core WCAG 2.1 AA 5/5 PASS · 0 violations
**총 페이즈**: 18 (1~9 패치 / 10 문서화 / 11 데이터 연결 / 12 정리 / 13~18 폴리싱·확장)

---

## 한 줄 요약

`index.html` / `admin.html` 두 페이지가 토큰·폰트·접근성·터치 타겟·디자인 언어를 공유하지 않던 문제를 해소하고, 9개 페이즈에 걸쳐 통합 디자인 시스템을 정착시켰습니다. 외부 axe-core 자동 감사로 6건의 실제 a11y 결함을 발견·수정하여 5개 검증 대상 페이지 모두 위반 0건을 달성했습니다.

---

## Phase 1 — 통합 토큰 + 탭 ARIA 기초

**파일**: `styles.css`, `index.html`, `main.js`

`styles.css :root`에 a11y 토큰을 추가했습니다. `--touch-min: 44px`(WCAG 2.5.5 최소 터치 타겟), `--focus-ring: #ffd166`(본문 배경 대비 13:1). 글로벌 `:where(button, a, input, select, textarea, summary, [role="tab"], [role="button"], [tabindex]):focus-visible` 규칙으로 키보드 사용자 전용 포커스 링을 깔았고, `.tab-btn`·`.winloss-pill`에 `min-height: var(--touch-min)`을 적용했습니다.

`index.html`은 4개 탭 모두에 `aria-controls`/`tabindex` 로빙을 채우고 패널에 `aria-labelledby`/`tabindex="0"`을 추가했습니다. 로그인·재조회 두 폼의 `<label><span>gameName</span><input></label>` 암묵 라벨링을 명시적 `<label for>` + `<input id>` 매칭으로 바꾸면서 "gameName/tagLine"을 "게임명/태그라인"으로 한국어화하고 필수 표시(`<span class="sr-only">필수</span>`)를 추가했습니다. "Collected" → "수집일".

`main.js`의 `switchTab()`은 tabindex 로빙 로직(활성=0, 나머지=-1)을 추가하고 `initTabSystem()`에 ←/→/Home/End 키보드 핸들러를 더해 WAI-ARIA Tabs Pattern을 완성했습니다.

## Phase 2 — 4개 탭 풀페이지 목업 (`improved-full.html`)

신규 파일 1개 (635 라인). 개요/상세 분석/타임라인/최근 추세 4개 탭을 모두 채운 self-contained HTML 목업. Phase 1의 토큰을 시각적으로 검증하는 레퍼런스 역할로, 상세 분석은 4개 페이즈 카드(A/B/C 등급) + 행동 루틴 체크리스트 + 핵심 장면 카드, 타임라인은 SVG KDA 그래프 + 빌드 오더 가로 스크롤 + 오브젝트 테이블, 최근 추세는 콜아웃 + 트렌드 태그 + 챔피언/포지션별 표를 모두 동일 토큰 시스템으로 그렸습니다.

## Phase 3 — admin 리디자인 목업 (`improved-admin.html`)

신규 파일 1개 (479 라인). 기존 admin.css의 별도 팔레트(`--blue`/`--gold`/`--red`)와 Trebuchet+Georgia 혼합 폰트를 버리고 index.html 토큰을 그대로 채택했습니다. 5개 섹션(LIVE 송출 제어 / 방송 기본 정보 / 페이즈 편집 / 블루팀 / 레드팀)을 동일한 panel 컴포넌트로 통일하고, 팀 패널은 진영 컬러를 보더와 그라디언트 틴트로만 차별화해 정보 위계를 유지했습니다.

## Phase 4 — admin 인플레이스 패치

**파일**: `admin.css`, `admin.html`, `admin.js`

`admin.css :root`에 `--accent`/`--mint`/`--rose`/`--info`를 기존 `--gold`/`--green`/`--red`/`--blue`의 alias로 추가해 두 스타일시트가 동일한 의미적 토큰 이름을 공유하도록 했고, 누락돼 있던 spacing/radius 스케일과 `--touch-min`/`--focus-ring`을 채워 `styles.css`와 1:1로 맞췄습니다. 폰트는 Trebuchet+Georgia 조합을 버리고 Pretendard로 통일(`font-family: inherit`로 헤딩까지 일괄), 기존 always-visible `:focus`를 글로벌 `:focus-visible`로 교체, `.btn`(42px)·`.live-badge`/`.turn-chip`(38px)을 모두 44px로 올렸습니다.

`admin.html`에 Pretendard CDN 링크, skip-link, `<header role="banner">`, `<main id="admin-main">`을 추가하고 5개 동적 카드(`data-admin-live`/`series`/`phase`/`team-editor` 2개)에 `aria-labelledby` + `<h2 class="sr-only">` 제목을 박았습니다.

`admin.js`의 `selectField`/`inputField` 헬퍼에 `fieldId(name)` 함수를 추가해 동적 input에 안정적인 id를 발급하고, `<label class="field"><span>...</span><input></label>` 암묵 래핑을 `<div class="field"><label for><span>...</span></label><input id></div>` 명시적 매칭으로 바꿨습니다. 라이브 뱃지에 `role="status"` + `aria-live="polite"` + 한국어 `aria-label`을 추가해 LIVE↔PAUSED 전환이 음성 안내되도록 했습니다.

## Phase 5 — 비주얼 컴포넌트 이식

**파일**: `styles.css`, `main.js`

`.detail-metrics .metric` — 패딩·라디우스를 키워 카드감을 강조하고, 값(`<strong>`)을 `var(--fs-2xl)` + `font-variant-numeric: tabular-nums`로 큰 숫자 + 정렬 잠금. 첫 카드(`:first-child`)는 amber tint + accent 컬러 자동 강조. `.metric--primary`/`.metric__delta--up/--down` 클래스 미리 정의(추후 평균 대비 ▲/▼ 인디케이터 즉시 사용 가능).

`.detail-header` — 단일 amber 그라디언트를 amber(135도) + mint(330도) 듀얼 그라디언트로 교체. `flex-wrap: wrap` 추가로 모바일에서 결과 핀이 자연스럽게 줄바꿈. `.detail-header__title .role-tag` 칩 스타일 추가(현재 `.dot` 분리자 대안).

`.score-overall` — 단순 텍스트를 160×160 conic-gradient 링으로 변환. `--score`(0-100%) + `--score-color` CSS custom prop 주입 방식. `::before`로 inset 10px 도넛 구멍. main.js는 `score.overall * 10` 변환 + `role="img" aria-label="종합 점수 N / 10"` 추가.

## Phase 6 — 탭바 + 인사이트 카드

**파일**: `styles.css`

`.tab-bar` — 4개 탭이 각각 보더+배경을 가진 독립 박스로 흩어져 있던 것을 하나의 둥근 알약 컨테이너로 통합. `backdrop-filter: blur(20px)`로 sticky 시 본문 위에 자연스럽게 떠 있고, `overflow-x: auto`로 모바일 가로 스크롤 대응. 활성 탭은 `var(--accent)` 단일 톤(글씨 9.80:1 대비). 거추장스러웠던 `::after` 그라디언트 그림자 제거.

`.panel--strengths` / `.panel--weaknesses` — 그라디언트 각도 180도→135도(좌상단에서 색이 흘러내림), 보더를 각각 `--mint-border`/`--rose-border`로 채색해 카드 정체성 강화. `h3::before`로 `✓`(mint) / `!`(rose) 아이콘 자동 prefix.

## Phase 7 — 로딩 상태 미니멀 압축

**파일**: `styles.css`

`.detail-progress` 6열 step 카드 그리드(각 카드 min-height 74px)를 `display: flex` + `flex-wrap: wrap` 칩 스트립(min-height 32px)으로 압축. 컨테이너 패딩 18px → `var(--space-4) var(--space-5)`, 헤딩 clamp(1.25rem, 2vw, 1.7rem) → `var(--fs-md)`(1.05rem) 톤다운, 진행률 바 8px → 6px, dot 12px → 8px. 마크업 변경 없이 CSS만 손봐 main.js 회귀 0. 모바일 360px 기준 시야 점유 ~166px → ~110px (30~40% 절약).

## Phase 8 — axe-core 자동 감사 + 6건 결함 수정

**파일**: `index.html`, `improved-admin.html`

`jsdom@24` + `axe-core@4.10`으로 5개 HTML 파일 일괄 감사. 1차에서 6건 위반 발견:

| 파일 | 위반 | 수정 |
| --- | --- | --- |
| index.html | `empty-heading` (`<h4 data-trend-headline></h4>`) | `aria-live="polite"` + 기본 텍스트 "샘플을 불러오는 중…" |
| index.html | `heading-order` (`<h3 id="sample-library-title">` skip h2) | `<h3>` → `<h2>` 승격 |
| index.html | `region` (login overlay landmark 미포함) | `role="region"` + `aria-labelledby="login-title"` |
| improved-admin.html | `aria-required-children` (4건, role="list" 자식 없음) | `role="list"` + `role="listitem"` 모두 제거 (시맨틱 의미 없는 시각 그리드) |
| improved-admin.html | `label` (40건, 슬롯 input 라벨 미연결) | 컨텍스트 prefix `aria-label="TOP 탑 / 선수"` 자동 부여 |
| improved-admin.html | `region` (admin-hero landmark 미포함) | `role="region"` + `aria-labelledby="admin-hero-title"` |

**최종**: 5/5 PASS, **총 위반 0건**.

```
✓ PASS  index.html (PROD)        passes=39
✓ PASS  admin.html (PROD)        passes=26
✓ PASS  improved-mockup.html     passes=38
✓ PASS  improved-full.html       passes=38
✓ PASS  improved-admin.html      passes=34
```

## Phase 11 — 메트릭 카드 delta 데이터 연결

**파일**: `main.js`

Phase 5에서 `.metric__delta--up`/`--down` CSS hook을 정의해 두기만 했던 것을 실제 데이터에 연결. `renderMetricDelta(valueEl, current, reference, opts)` 범용 헬퍼를 추가해 어떤 메트릭에든 평균 대비 ▲/▼ 인디케이터를 한 줄로 붙일 수 있도록 했습니다. 첫 적용 대상은 CS/분(현재 경기 `playerStats.csPerMinute` vs `state.recentStats.overall.avgCsPerMin`).

견고성: recentStats가 미로드된 정상 상황에선 silent return, 비교값이 0이거나 차이가 1%/0.05 미만이면 노이즈 컷, 재렌더 시 기존 delta 노드 제거로 중복 방지, 스크린리더용 `aria-label="최근 평균 대비 증가 0.9"` 별도 부여.

데이터 흐름 비대칭(개요 탭이 먼저, 추세 탭에서 평균 fetch) 대응: `fetchRecentStats` 성공 콜백에 `refreshMetricDeltas()` 후크 추가해 사용자가 추세 탭 갔다 개요로 돌아오면 delta가 자동으로 표시.

## Phase 12 — 산출물 정리

**작업**:
- 3개 디자인 목업(`improved-mockup.html`, `improved-full.html`, `improved-admin.html`)을 `_design-mockups/` 폴더로 이동. `_` 접두는 정적 호스팅·빌드 도구가 자동 제외하기 쉽도록 한 컨벤션.
- `_design-mockups/README.md` 작성: 각 목업의 용도/언제 보면 좋은지/프로덕션 코드와의 관계 표 + 열어 보는 방법.
- 본 CHANGELOG에 Phase 11/12 추가.

## Phase 13 — 디테일 헤더 포지션 칩화

**파일**: `index.html`

`<h2 class="detail-header__title">`의 `<span data-snapshot-champion></span><span class="dot">·</span><span data-snapshot-role></span>` 패턴을 챔피언명 + `.role-tag` 알약 칩 패턴으로 바꿈. Phase 5에서 깔아둔 `.detail-header__title .role-tag` CSS hook(padding 4px 12px, surface-2 배경, pill radius)이 즉시 적용. axe `empty-heading` 회귀가 한 번 발생(span이 비어 있어 heading 자체가 비어 보임) → 두 span에 `—` placeholder를 넣어 (1) JS 로드 전에도 의미 있는 빈 상태 표시, (2) heading 비어있지 않게 하는 두 효과를 동시에 달성. main.js의 `textContent` 할당이 placeholder를 자연스럽게 덮어씀.

## Phase 14 — delta 시스템 일반화 + stat-ribbon 확장

**파일**: `main.js`, `styles.css`

Phase 11의 DOM 기반 `renderMetricDelta`는 stat-ribbon의 innerHTML 일괄 렌더에 어색해서, 핵심 로직(타입 가드 + 노이즈 컷 + 부호/포맷)을 `_computeDeltaParts(current, reference, opts)` private 헬퍼로 분리하고 두 가지 진입점을 깔았습니다:
- `renderMetricDelta(valueEl, ...)` — DOM용. 부모 셀렉터를 `.metric, .stat-card`로 확장
- `metricDeltaHtml(current, reference, opts)` — 템플릿용 HTML 문자열 반환

CSS `.detail-metrics .metric__delta` 한정 규칙을 일반 `.metric__delta` 규칙으로 끌어올리고 `display: inline-block` + `tabular-nums`를 더해 어떤 카드 컨텍스트에서도 잘 정렬되도록 했습니다. stat-ribbon의 KDA·CS 카드에 `metricDeltaHtml(...)` 호출 추가, `refreshMetricDeltas`도 `renderStats(sample)` 재호출까지 확장.

## Phase 18 — Vision delta 정규화 (Phase 17과 일관성)

**파일**: `main.js`

Phase 17과 동일 패턴으로 Vision도 분당 시야 점수(`visionScore / (durationSeconds / 60)`)로 비교. `aggregateRecentStats`에 `avgVisionScorePerMin` 필드 + `visPerMinSum`/`visPerMinCount` 누적, stat-ribbon Vision 카드도 IIFE로 감싸서 현재 경기 분당 시야 계산 + note에 "분당 0.7" 표시. 이제 stat-ribbon의 시간 의존성 있는 두 카드(Damage·Vision)가 모두 정규화된 비교를 사용합니다.

## Phase 17 — Damage delta 정확도 개선 (분당 데미지로 정규화)

**파일**: `main.js`

Phase 15에서 남긴 TODO 처리. 절대값 기준 Damage 비교는 게임 시간 편차(짧은 25분 게임 vs 긴 45분 게임)에 따른 노이즈가 컸어요. 이제 매치별 `damageToChampions / (durationSeconds / 60)`로 분당 데미지를 계산해 평균 비교에 사용합니다.

`aggregateRecentStats`에 `dmgPerMinSum`/`dmgPerMinCount` 누적 변수와 `overall.avgDamagePerMin` 필드 추가. duration이 0인 매치는 분모 안전장치로 카운트 자체에서 제외. stat-ribbon Damage 카드는 IIFE로 감싸서 현재 경기 분당 데미지를 미리 계산한 뒤 비교에 사용 + note에도 "분당 NNN" 표시. 기존 절대값 표시는 `value` 슬롯에 그대로 유지(사용자가 익숙한 형태 보존).

## Phase 16 — 인사이트 카드 임팩트 칩

**파일**: `main.js`, `styles.css`

`.insight-card`의 헤더에 `relatedEventIds` 개수 기반 "근거 N건" 칩을 추가. 5개 이상이면 high(진한 톤), 3-4개면 medium(중간), 1-2개면 low(회색)로 표시. 색은 `data-kind="strength"` / `"weakness"` 속성에 따라 각각 mint / rose 톤으로 분기. priority 같은 별도 필드를 추정하지 않고 정직하게 "근거 N건"이라고 표시해 사용자가 본 데이터로 검증할 수 있도록 했습니다. CSS는 `.insight-card__chips` 그룹 컨테이너로 카테고리 뱃지(잘한 점/개선 포인트) + 임팩트 칩 두 개를 세로로 정렬, 각 임팩트 레벨에 `aria-label="근거 이벤트 N건"` 추가.

## Phase 15 — Damage·Vision까지 delta 확장

**파일**: `main.js`

서버 `summarizeMatch`가 이미 매치별 `damageToChampions`/`visionScore`를 반환하고 있어서, `aggregateRecentStats`에 `avgDamage`(정수) + `avgVisionScore`(소수 1자리) 두 평균을 추가하고 stat-ribbon의 Damage·Vision 카드에 delta를 활성화. 이제 KDA·CS·Damage·Vision 4개 stat-card가 모두 평균 대비 ▲/▼를 표시. (Gold·KP는 평균 데이터가 없어 미적용.)

> ⚠️ Damage 절대값은 게임 시간에 비례해서 비교가 다소 노이즈 있음(짧은 게임 vs 긴 게임). 향후 `damagePerMin` 기반 비교로 개선 가능 — 현재 값에 주석 남김.

---

## Phase 9 — 모바일 폴리싱 + 회귀 수정

**파일**: `styles.css`

작업 중 두 가지 회귀 위험 발견·수정:

1. line 4090의 레거시 `:focus-visible { outline: 2px solid var(--accent); }`가 specificity 0,1,0으로 Phase 1의 `:where(...):focus-visible { outline: 3px solid var(--focus-ring); }`(specificity 0,0,1)을 덮어쓰고 있었음 → 레거시 제거. 통합 토큰 `--focus-ring`이 단일 진실원.
2. 760px 미디어 쿼리의 `.tab-bar { flex-wrap: wrap; padding: 4px 0 12px; }`가 Phase 6 pill-container를 깨뜨림 + `.tab-btn { padding: 8px 14px }`이 44px 터치 타겟 위협 → flex-wrap 제거(가로 스크롤 사용), 패딩 정리, min-height 베이스 규칙 유지.

신규 720px 폴리싱 추가: `.detail-header` 패딩 압축 + result row-wrap, `.detail-metrics minmax(140px, 1fr)`로 360px 폭 2열 보장 + `var(--fs-xl)` 톤다운, 점수 링 132×132로 축소.

axe-core 재감사: 5/5 PASS 유지.

---

## 산출물 요약

### 패치된 프로덕션 파일 (6개)

git diff stat 최종 (Phase 1~18 누적):

```
 admin.css   |  +70 / -??   통합 토큰 alias, Pretendard, focus-visible, 터치 타겟, sr-only/skip-link
 admin.html  |  +34 / -??   Pretendard 로딩, skip-link, banner/main, aria-labelledby × 5
 admin.js    |  +37 / -??   fieldId 헬퍼, label for/id 매칭, live-badge ARIA
 index.html  |  +80 / -??   탭 ARIA, 폼 라벨 for/id, 한국어화, region landmark, role-tag 칩
 main.js     | +242 / -??   tabindex 로빙, 키보드 핸들러, 점수 링, delta 시스템(11/14/15/17/18), 인사이트 칩
 styles.css  | +408 / -??   토큰 + focus-visible + 메트릭/헤더/점수링/탭바/인사이트/로딩 비주얼 + 모바일
                            (총 41개 Phase 마커)
 ─────────────────────────
 7 files changed, +772 / -159
```

`styles.css`에 41개, `admin.css`에 7개, `main.js`에 26개의 `Phase N:` 주석 마커가 박혀 있어 git blame과 함께 추적 가능합니다.

### 신규 디자인 목업 (3개) — `_design-mockups/`

- `_design-mockups/improved-mockup.html` (1095 라인) — 개요 탭 단일 페이지 레퍼런스
- `_design-mockups/improved-full.html` (635 라인) — 4개 탭 전체 풀페이지
- `_design-mockups/improved-admin.html` (479 라인) — admin 페이지 통합 디자인 적용
- `_design-mockups/README.md` — 각 목업의 용도/관계 안내

### 검증 자료

- axe-core 자동 감사 스크립트: `/tmp/a11y-audit/audit.mjs`
- 색 대비 수치 (모든 토큰 본문 배경 기준):
  - `--text` 17.7:1 / `--text-muted` 11.0:1 / `--text-subtle` 7.0:1
  - `--accent` 10.3:1 / `--mint` 10.2:1 / `--rose` 8.2:1 / `--info` 9.4:1
  - `--focus-ring` 13.3:1 (포커스 표시 충분히 강함)
  - 활성 탭(`--on-accent` on `--accent`) 9.8:1
- 모든 값이 WCAG AA 4.5:1을 여유 통과

---

## 회귀 위험 / 알려진 한계

### 회귀 위험 낮음
- 기존 마크업 계약 유지: `data-*` 속성, 클래스명, 데이터 셰이프 모두 그대로
- main.js 변경은 추가만 있고 기존 동작 변경 없음(switchTab은 옵션 인자 추가, 기본 동작 호환)
- admin.js의 `<label class="field">` → `<div class="field"><label for>` 변경은 CSS 셀렉터 `.field`/`.field span`/`.field input`이 모두 그대로 매치

### 알려진 한계
- 색 대비 검증은 axe-core가 jsdom 환경에서 색을 계산하지 못해 수동 수치 계산으로 대체. 브라우저 axe DevTools로 한 번 더 검증 권장
- 모바일 < 720px 폴리싱은 정적 분석 기반. 실제 360px 디바이스에서 한 번 시각 확인 권장
- 키보드 네비게이션은 단위 테스트 없음. 수동으로 Tab → ←/→ → Home/End → Enter 시퀀스 확인 권장

---

## 롤아웃 가이드

1. **Diff 검토**: `git diff styles.css index.html main.js admin.css admin.html admin.js`로 6개 파일 검토. 모든 변경에 `Phase N:` 주석이 박혀 있어 컨텍스트 파악 용이
2. **목업은 옵션**: `improved-*.html` 3개는 디자인 레퍼런스. 프로덕션 빌드에서 제외하려면 `_design-mockups/`로 이동하거나 `.gitignore`에 추가
3. **첫 배포 후 확인 사항**:
   - 모바일 Chrome/Safari에서 탭바 가로 스크롤 동작
   - 점수 링이 conic-gradient 폴백 없이 렌더 (Safari 12.1+, Chrome 69+ 필요 — 충분히 보편적)
   - VoiceOver/NVDA로 폼 라벨 + 탭 네비게이션 음성 안내
4. **다음 세션에서 추가 가능**:
   - main.js 메트릭 카드에 평균 대비 delta(`▲ +2.4`) 데이터 연결
   - `.insight-card` 본문에 우선순위/영향도 인디케이터
   - admin.html / admin.css의 일부 미사용 토큰(`--gold`, `--green` 등) 정리

---

## 부록: 페이즈별 작업 목록

| # | 작업 | 결과 |
| --- | --- | --- |
| 0 | 초기 감사 (UX/a11y/카피/디자인 시스템) | 7개 사이트 결함 식별 |
| 1 | 통합 토큰 + 탭 ARIA + 폼 라벨 | 19/19 검증 통과 |
| 2 | 4개 탭 풀페이지 목업 | improved-full.html |
| 3 | admin 리디자인 목업 | improved-admin.html |
| 4 | admin 인플레이스 패치 (CSS/HTML/JS) | 27/27 검증 통과 |
| 5 | 메트릭/헤더/점수링 비주얼 이식 | 23/23 검증 통과 |
| 6 | 탭바 pill-container + 인사이트 카드 듀얼 그라디언트 | 18/18 검증 통과 |
| 7 | 로딩 상태 미니멀 압축 | 22/22 검증 통과 |
| 8 | axe-core 자동 감사 + 6건 수정 | 5/5 PASS, 위반 0 |
| 9 | 모바일 폴리싱 + 회귀 2건 수정 | 15/15 통과, axe 회귀 없음 |
| 10 | CHANGELOG.md 작성 | 본 문서 |
| 11 | 메트릭 카드 delta 데이터 연결 (CS/분 평균 대비 ▲▼) | renderMetricDelta 헬퍼 + axe 회귀 없음 |
| 12 | 산출물 정리 (`_design-mockups/` 폴더 + README) | 폴더 구조 정돈 |
| 13 | 디테일 헤더 포지션 칩화 + 빈 헤딩 회귀 1건 수정 | 5/5 PASS 회복 |
| 14 | delta 시스템 일반화 (`_computeDeltaParts`) + stat-ribbon KDA·CS 적용 | 4개 stat-card 평균 대비 표시 가능 |
| 15 | Damage·Vision 평균 추가 → stat-ribbon delta 4개 카드로 확장 | KDA·CS·Damage·Vision 모두 ▲▼ |
| 16 | 인사이트 카드에 임팩트 칩 ("근거 N건" + 색상 강도) | data-kind 분기로 mint/rose 듀얼 톤 |
| 17 | Damage delta 정규화 (절대값 → 분당 데미지) | 게임 시간 편차 노이즈 제거, note에 "분당 NNN" 표시 |
| 18 | Vision delta 정규화 (Phase 17과 일관성) | 시간 의존 메트릭 모두 분당 비교로 통일 |
