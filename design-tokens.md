# LoL Replay Coach — Design Tokens

[styles.css](styles.css)에서 추출한 현재 디자인 시스템 스냅샷입니다. claude.ai Project에서 디자인 제안을 받을 때 "이 토큰 안에서 개선" 또는 "이 토큰을 이런 방향으로 재정의"로 제약을 명확히 하기 위한 참고 문서입니다.

## 1. 컬러 (CSS 변수)

`:root`에 선언된 토큰 ([styles.css:1-17](styles.css#L1-L17))

| 변수 | 값 | 용도 |
|---|---|---|
| `--bg` | `#071018` | 최하단 배경 |
| `--bg-alt` | `#0e1d27` | 그라디언트 보조 배경 |
| `--panel` | `rgba(11, 24, 33, 0.88)` | 카드/패널 기본 배경 |
| `--panel-strong` | `rgba(16, 32, 44, 0.96)` | 강조 패널 (hero, detail-progress) |
| `--line` | `rgba(162, 196, 210, 0.2)` | 기본 보더 |
| `--line-strong` | `rgba(207, 226, 234, 0.36)` | 강조 보더 (pill, 진행바 컨테이너) |
| `--text` | `#eff8f7` | 본문 텍스트 |
| `--muted` | `#97afba` | 메타/설명 텍스트 |
| `--accent` | `#f0b35b` | 포인트 (앰버/골드) |
| `--mint` | `#59d1b2` | 승/긍정 |
| `--mint-soft` | `rgba(89, 209, 178, 0.14)` | 승 배경 |
| `--rose` | `#ff8678` | 패/경고 |
| `--rose-soft` | `rgba(255, 134, 120, 0.14)` | 패 배경 |
| `--amber-soft` | `rgba(240, 179, 91, 0.16)` | 탭 활성/포인트 배경 |
| `--shadow` | `0 30px 70px rgba(0, 0, 0, 0.3)` | 카드 기본 섀도 |
| `--surface-1` | `rgba(255, 255, 255, 0.03)` | 카드 내부 레이어 (가장 옅음) |
| `--surface-2` | `rgba(255, 255, 255, 0.04)` | 카드 내부 레이어 (기본) |
| `--surface-3` | `rgba(255, 255, 255, 0.06)` | 카드 내부 레이어 (강조) |
| `--surface-4` | `rgba(255, 255, 255, 0.08)` | 카드 내부 레이어 (가장 진함) / 구분선 |
| `--info` | `#78baff` | 정보 블루 (hover 상태의 대표 색) |
| `--info-soft` | `rgba(120, 186, 255, 0.08)` | 정보 블루 배경 |
| `--info-muted` | `rgba(120, 186, 255, 0.16)` | 정보 블루 중간 톤 (보더) |
| `--info-border` | `rgba(120, 186, 255, 0.38)` | 정보 블루 보더 hover |
| `--on-accent` | `#11161a` | 액센트 배경 위 텍스트 (고대비) |
| `--tint-amber` | `rgba(240, 179, 91, 0.14)` | panel--headline / hero-panel 상단 틴트 |
| `--tint-mint` | `rgba(89, 209, 178, 0.14)` | panel--snapshot/samples/strengths 틴트 |
| `--tint-rose` | `rgba(255, 134, 120, 0.12)` | panel--fetcher/weaknesses 틴트 |
| `--tint-info` | `rgba(120, 186, 255, 0.12)` | panel--nav 틴트 |
| `--mint-border` | `rgba(89, 209, 178, 0.34)` | 승/긍정 상태 보더 (winloss-pill, match-card 엣지) |
| `--rose-border` | `rgba(255, 134, 120, 0.34)` | 패/경고 상태 보더 (winloss-pill, match-card 엣지) |
| `--amber-border` | `rgba(240, 179, 91, 0.34)` | 액센트 보더 (match-list-more-btn) |
| `--shadow-hover` | `0 16px 32px rgba(0, 0, 0, 0.28)` | 카드 호버 깊이감 |
| `--mint-bg-trace` | `rgba(89, 209, 178, 0.03)` | gradient 페이드아웃 (comparison-card claude 하단 stop) |
| `--amber-bg-trace` | `rgba(240, 179, 91, 0.03)` | dual-tl-phase--mid 배경 (trace tier 패밀리 완성 — iteration 12) |
| `--rose-bg-trace` | `rgba(255, 134, 120, 0.03)` | gradient 페이드아웃 (comparison-card codex 하단 stop) |
| `--mint-bg-weak` | `rgba(89, 209, 178, 0.06)` | 옅은 mint 배경 (ally row, kill event) |
| `--mint-bg-soft` | `rgba(89, 209, 178, 0.1)` | WIN 배지 / 진행 스텝 done / 긍정 추세 배경 (0.08→0.10 consolidation) |
| `--mint-bg-medium` | `rgba(89, 209, 178, 0.28)` | WIN 계열 강조 border |
| `--rose-bg-weak` | `rgba(255, 134, 120, 0.06)` | 옅은 rose 배경 (enemy row, death event) |
| `--rose-bg-soft` | `rgba(255, 134, 120, 0.1)` | LOSS 배지 / 약점 카드 / 부정 추세 배경 (0.08→0.10 consolidation) |
| `--rose-bg-medium` | `rgba(255, 134, 120, 0.28)` | LOSS 계열 강조 border |
| `--amber-bg-soft` | `rgba(240, 179, 91, 0.08)` | 추세 패널 상단 / 액티브 세그먼트 배경 |
| `--amber-bg-deep` | `rgba(240, 179, 91, 0.18)` | body radial-gradient / sample-chip 배경 |
| `--amber-bg-strong` | `rgba(240, 179, 91, 0.3)` | rank-badge gold border |
| `--rank-iron` | `#8b7355` | 아이언 티어 텍스트 색 |
| `--rank-bronze` | `#cd7f32` | 브론즈 티어 텍스트 색 |
| `--rank-silver` | `#c0c0c0` | 실버 티어 텍스트 색 |
| `--rank-platinum` | `#2cc5b8` | 플래티넘 티어 텍스트 색 |
| `--rank-emerald` | `#50c878` | 에메랄드 티어 텍스트 색 |
| `--rank-diamond` | `#b9f2ff` | 다이아몬드 티어 텍스트 색 |
| `--rank-master` | `#9d4dbb` | 마스터 티어 텍스트 색 |
| `--rank-grandmaster` | `#ef4444` | 그랜드마스터 티어 텍스트 색 |

**미토큰화 색상** (남은 하드코딩, 모두 2회 이하 사용 — 후속 이터레이션 후보, 이슈 #18)

- `rgba(255, 255, 255, 0.025)` / `rgba(255, 255, 255, 0.035)` — 바디 그리드 오버레이 (단일 사용)
- `rgba(89, 209, 178, 0.24)` / `rgba(89, 209, 178, 0.25)` / `rgba(89, 209, 178, 0.18)` — 기타 mint 단독 사용 alpha
- `rgba(255, 134, 120, 0.25)` / `rgba(255, 134, 120, 0.42)` — 기타 rose 단독 사용 alpha
- `rgba(255, 156, 143, 0.24)` / `rgba(255, 156, 143, 0.12)` — **#ff9c8f orphan rose 변형** (candidate-head LOSS). 기본 `--rose`와 다른 RGB — 통일 여부는 후속 이터레이션에서 결정

수용된 단독 사용 (대체 불가 — 토큰화 안 함):

- `rgba(240, 179, 91, 0.25)` — `.dual-tl-event[data-importance="5"]` box-shadow spot-glow. 0.30으로 끌어올리면 +20% 강도 변화, 단독 강조 의도와 다름
- `rgba(240, 179, 91, 0.4)` — `.checklist-priority` border. 핵심 UI 보더, 0.34(`--amber-border`)로 끌어내리면 -15% 가시성 저하

## 2. 타이포

**기본**
- 패밀리 (본문): `"Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif`
- 패밀리 (제목): body에서 `Pretendard Variable` 상속 — 제목 계층은 `font-weight` 600~800 + size + letter-spacing로 구성 (iteration 7에서 Georgia 제거)
- 베이스: `16px` / line-height 본문 `1.6`

**사이즈 스케일** (토큰화 완료 — 10-tier)

| 토큰 | 값 | 흡수한 원본 값 | 용도 |
|---|---|---|---|
| `--fs-xs` | `0.7rem` | 0.58 / 0.6 / 0.64 / 0.66 / 0.68 / 0.7 / 0.72 | 마이크로 라벨 (eyebrow, meta-label, event-chip) |
| `--fs-sm` | `0.78rem` | 0.74 / 0.75 / 0.76 / 0.78 | 칩/작은 메타 |
| `--fs-base` | `0.85rem` | 0.8 / 0.82 / 0.84 / 0.85 | 바디 small (카드 내부 본문) |
| `--fs-md` | `0.92rem` | 0.88 / 0.9 / 0.92 / 0.95 / 0.98 | 바디 (탭/버튼/기본 본문) |
| `--fs-lg` | `1.1rem` | 1 / 1.05 / 1.08 / 1.1 / 1.15 | 값 강조 (작은 stat 숫자) |
| `--fs-xl` | `1.25rem` | 1.2 / 1.25 / 1.3 / 1.35 | 섹션 제목 |
| `--fs-2xl` | `1.4rem` | 1.4 | topbar 제목 |
| `--fs-3xl` | `1.6rem` | 1.6 | 챔피언 배너 이름 |
| `--fs-display` | `1.8rem` | 1.8 | 헤드라인 (detail h2) |
| `--fs-hero` | `3.2rem` | 3.2 | 대형 지표 (e.g. 승률) |

**미토큰화 (clamp 기반 반응형)**
- 섹션 제목: `clamp(1.2rem, 1.6vw, 1.55rem)` — 뷰포트 스케일링 전용
- topbar 제목: `clamp(1.2rem, 2vw, 1.75rem)`
- 헤드라인 (detail hero): `clamp(1.7rem, 2.6vw, 2.4rem)`

**토큰화 시 시각 변화 (consolidation)**
- `0.58~0.72rem` (마이크로 라벨 7종) → `0.7rem` 통일: 가장 작은 글자는 살짝 커지고, `0.72rem` 쓰던 곳은 동일
- `0.8~0.85rem` (바디 small 4종) → `0.85rem` 통일: 살짝 커짐 (가독성 ↑)
- `0.88~0.98rem` (바디 5종) → `0.92rem` 통일: 중앙값 수렴
- `1~1.15rem` (강조 값 5종) → `1.1rem` 통일: 작은 숫자 강조 살짝 커짐
- `1.2~1.35rem` (섹션 제목 4종) → `1.25rem` 통일

**letter-spacing**
- 마이크로 라벨: `0.18em` ~ `0.22em` + `text-transform: uppercase`
- 헤드라인: `-0.005em` ~ `-0.01em`

**Responsive body base (미토큰화 예외)**

body element font-size는 전체 rem 단위의 앵커 역할을 하므로 토큰 스케일에서 분리.

- 데스크톱 `16px` (body 기본)
- 태블릿 `≤760px` → `15px`
- 좁은 모바일 `≤480px` → `14px`

단계적 축소 설계. design-audit `--scope fontSize` 에서 이 3개 라인은 "알려진 예외"로 간주한다.

## 3. 간격 · 레이아웃

**컨테이너**
- 앱 쉘 폭: `min(1380px, calc(100vw - 28px))`
- 쉘 패딩: `28px 0 44px`
- 워크스페이스 그리드: `minmax(320px, 380px) minmax(0, 1fr)` / gap `22px`
- 사이드바 sticky top: `18px`

**카드 패딩**
- `.panel` / `.hero-panel`: `24px`
- `.meta-card` / `.stat-card` / `.sample-chip` / `.candidate-card`: `18px`
- `.detail-progress`: `18px`

**gap 스케일** (토큰화 완료 — 6-tier)

| 토큰 | 값 | 빈도 | 용도 |
|---|---|---|---|
| `--space-1` | `4px` | 4곳 | 타이트 인라인 |
| `--space-2` | `8px` | 19곳 | 인라인 요소 기본 |
| `--space-3` | `10px` | 13곳 | 인라인 요소 여유 |
| `--space-4` | `12px` | 11곳 | 카드 내부 그룹 |
| `--space-5` | `16px` | 14곳 | 카드 간 기본 |
| `--space-6` | `22px` | 8곳 | 패널/섹션 간 |

**Outlier (consolidation 완료 — iteration 4)**
- `1px`(1) / `2px`(4) — 극한 타이트 영역 전용, 토큰화 보류
- ~~`6px` → `--space-2`~~ · ~~`14px`/`18px` → `--space-5`~~ · ~~`20px`/`24px` → `--space-6`~~ 모두 흡수

## 4. 보더 반경

**토큰화 완료** (6-tier canonical scale):

| 토큰 | 값 | 용도 |
|---|---|---|
| `--radius-xs` | `4px` | 얇은 진행바, 마이크로 칩, 이벤트 스트라이프 |
| `--radius-sm` | `8px` | 중소 카드, 버튼 표면, 칩 |
| `--radius-md` | `16px` | 중간 카드, 탭 버튼 |
| `--radius-lg` | `22px` | meta/stat/sample 카드 (**카드 표준**) |
| `--radius-xl` | `28px` | hero-panel, panel (**최상위 패널 표준**) |
| `--radius-pill` | `999px` | pill, winloss-pill, 원형 버튼 |
| `--radius-circle` | `50%` | 원형 아이콘/아바타 |

**Outlier 흡수 내역 (iteration 4)**
- `3px` / `4px` / `5px` / `6px` → `--radius-xs`(4px)
- `10px` / `12px` → `--radius-sm`(8px)
- `14px` / `18px` → `--radius-md`(16px)
- `20px` → `--radius-lg`(22px)

**보존 대상 (비대칭 쇼트핸드, 타임라인 엣지 전용)**
- `5px 0 0 5px` / `0 5px 5px 0` — dual-tl 이벤트 좌/우 플래그
- `10px 0 0 10px` — 레거시 타임라인 엣지

## 5. 반응형 브레이크포인트

4개 존재:

- `@media (max-width: 1180px)` — 메인 워크스페이스 2열 → 1열
- `@media (max-width: 760px)` — 모바일 (iter.7에서 단일 블록으로 통합. iter.8에서 match-row flex-wrap + detail-header flex-column 규칙 추가. 내부에 Dual-track timeline 전용 섹션 보존)
- `@media (max-width: 480px)` — 좁은 모바일: shell/panel 패딩·radius 축소, profile icon 48px 축소
- `@media (prefers-reduced-motion: reduce)` — 모션 최소화 (애니메이션/transition 0.01ms, hover lift 차단)

## 6. 상호작용 · 모션

**표준 트랜지션**
- `transform 180ms ease, border-color 180ms ease, background 180ms ease`
- hover 시 `translateY(-2px)` + 보더 틴트 + 배경 틴트 (`rgba(120, 186, 255, 0.08)` 정보 틴트가 기본값)

**상태 색상 매핑**
| 상태 | 보더 | 배경 |
|---|---|---|
| hover (정보) | `rgba(120, 186, 255, 0.38)` | `rgba(120, 186, 255, 0.08)` |
| active (액센트) | `var(--accent)` | `var(--amber-soft)` |
| 성공/승 | `rgba(89, 209, 178, 0.34)` | `var(--mint-soft)` |
| 실패/패 | `rgba(255, 134, 120, 0.34)` | `var(--rose-soft)` |

**panel 컬러 틴트** (iteration 5 — 토큰화 + 가시성 상향, alpha 0.12~0.14, stop 38%)
- `.panel--headline` → `--tint-amber`
- `.panel--snapshot` / `.panel--samples` / `.panel--strengths` → `--tint-mint`
- `.panel--nav` → `--tint-info`
- `.panel--fetcher` / `.panel--weaknesses` → `--tint-rose`
- `.hero-panel` → 135° amber + 330° mint 이중 그라디언트 (둘 다 `--tint-*`)

**카드 호버 (iteration 5 — 깊이감 통일)**
- `.candidate-card--button:hover` / `.report-card:hover` / `.sample-chip:hover` 모두 `box-shadow: var(--shadow-hover)` 추가
- transition에 `box-shadow 180ms ease` 포함

## 7. 탭 컴포넌트 (4탭 기준)

현재 상세 화면은 4탭 구조 (Overview / Progress / Mastery / AI Comparison).

```
.tab-bar          → flex, gap 8px, sticky top 0, z-index 20
                    배경: linear-gradient(to bottom, var(--bg) 60%, transparent)
.tab-bar::after   → sticky 하단 12px fade shadow (iteration 6 추가) — 스크롤 시 탭바와
                    콘텐츠 경계를 시각화, black 0.28 → transparent 그라디언트
.tab-btn          → padding var(--space-3) 22px / radius var(--radius-md) / border var(--line)
                    var(--fs-md) / 600 weight / color var(--muted)
.tab-btn:hover    → 정보 블루 hover
.tab-btn--active  → 액센트 보더 + amber-soft 배경 + accent 텍스트
```

**Match summary card 계층** (iteration 6)

```
.match-summary-card         → 좌측 3px ::before 엣지 바 (기본 var(--line))
.match-summary-card[data-result="WIN"]::before  → var(--mint)
.match-summary-card[data-result="LOSS"]::before → var(--rose)
.match-summary-card[WIN/LOSS] 배경 → linear-gradient(90deg, var(--tint-mint|rose), var(--panel) 42%)
.match-summary-card:hover   → translateY(-1px) + var(--shadow-hover) + accent 보더
```

## iteration 8 신규 컴포넌트

**`.identity-card`** — 사이드바 최상단 아이덴티티 블록. 아바타 + 플레이어명 + 수집일.

- 배경 `var(--panel)`, 보더 `var(--line)`, radius `--radius-lg`
- 아바타는 `--radius-md` 48px, `.identity-card__body` 는 `--space-1` gap
- 기존 `.hero-panel` 대체 (hero-lede, hero-pills, 4 meta 카드 모두 제거)

**`.match-row`** — 10게임 리스트의 OP.GG row format.

- flex row, 좌측 결과색 엣지 바 3px (`.match-row::before`, `[data-result]` 로 WIN/LOSS 색)
- `.match-row__main` 은 title (champion/role/queue/patch) + stats (KDA/duration/cs) 2줄
- `.match-row__result` 는 우측 고정, `--mint/rose-bg-medium` 배경
- hover / aria-pressed 시 `translateY(-1px)` + `--shadow-hover` + 정보 블루 보더
- ≤760px에서 flex-wrap 허용, stats는 전체 폭으로 내림 (result는 order: 10)

**`.detail-header` + `.detail-metrics`** — Overview 상단 압축 블록.

- detail-header: 좌측 title + headline + 1줄 summary (line-clamp 2), 우측 result pill + duration
- detail-metrics: `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))` 로 3-4개 metric 타일
- `--tint-amber` 상단 그라디언트 (iter.5 tint 시스템 재사용)
- 기존 `.panel--headline` + `.panel--snapshot` 두 패널을 대체, `.snapshot-grid` 7항목을 3개 핵심으로 축소

**탭 skeleton** — `.tab-page__skeleton` 컨테이너에 `.skeleton--block` 3개. `data-rendering="true"` 속성으로 상태 표시. 첫 진입 시 200ms 최소 노출, 재진입은 `data-rendered-once` 캐시로 즉시.

## iteration 9 신규 컴포넌트

**`.wr-bar`** — 승률 수평 바.

- 높이 8px, `--rose-bg-soft` 배경 위에 mint `.wr-bar__fill` width로 승률 표현
- `style="--wr-fill-pct: 70%"` 인라인 변수로 제어
- `.panel--recent-aggregate .wr-bar`는 10px 높이 + max-width 100%

**`.panel--recent-aggregate`** — 최근 20경기 요약.

- head: h3 + refresh-btn 좌우 정렬
- body: 승패 record + wr-bar + metric grid (KDA / CS/분 / 평균 게임 시간)
- status line: 로딩/에러/빈 상태 메시지 (기본 hidden)

**`.breakdown-row`** — 6-column grid.

- 데스크톱: icon / label / count / wr-bar / wr-text / kda+cs
- 모바일 ≤760px: `grid-template-areas`로 3줄 stack
- champion-breakdown과 role-breakdown이 공유

**`.refresh-btn`** — 경량 utility 버튼.

- `--surface-2` 배경 + `--line` 보더. hover 시 `--info-soft` + `--info-border`
- disabled 시 opacity 0.6 + not-allowed 커서

## 8. 배경 장식 (바디 레벨)

- radial-gradient 민트 (top-left, 0.18 alpha, 28%)
- radial-gradient 앰버 (top-right, 0.18 alpha, 30%)
- linear-gradient 145deg `--bg` → `--bg-alt`
- `body::before` — 36px 그리드 오버레이, 중앙 페이드 마스크
- `body::after` — 24px 인셋 얇은 보더 (프레이밍)

## 9. 접근성 · 유틸

- `.skip-link` — 포커스 시 드러나는 스킵 링크 (`pill + accent`)
- `.sr-only` — 시각적으로만 숨김
- **전역 `:focus-visible`** — `2px solid var(--accent)` + `2px` offset (iteration 4 추가)
- **`prefers-reduced-motion`** — 모션 억제 블록 (iteration 4 추가, §5 참조). 신규 `shimmer` / `spin` 애니메이션도 자동 억제 (`*` 전역 규칙으로 커버)
- **스켈레톤 유틸** (iteration 6 추가): `.skeleton` + `.skeleton--line/--block/--card` + `@keyframes shimmer` (1.4s infinite). 로딩 플레이스홀더 재사용 가능
- **로딩 인디케이터** (iteration 6): `[data-view="LOADING_DETAIL"] .fetch-status::before` 회전 스피너 (info 색, 0.8s linear)
- 모든 상호작용 요소가 `transition` 지정되어 있음
- `aria-*` 처리는 [main.js](main.js)에서 동적으로 관리됨 (디자인 변경 시 `[data-view]` / `[data-result]` 속성 셀렉터 주의)

## 10. 알려진 문제 · 개선 후보

claude.ai에 "이 항목 개선해줘"로 던지면 좋은 후보:

1. ~~**radius 스케일 과다**~~ — **완료** (iteration 4). 6-tier (`--radius-xs ~ --radius-xl`)로 토큰화. 비대칭 쇼트핸드 3개만 보존.
2. ~~**알파 배경 하드코딩**~~ — **완료** (이전 이터레이션). `--surface-1~4` 토큰화.
3. ~~**정보 블루(`#78baff`) 미토큰화**~~ — **완료** (이전 이터레이션). `--info`, `--info-soft/muted/border` 토큰화.
4. ~~**font-size 스케일 혼재**~~ — **완료** (iteration 3). 10-tier (`--fs-xs ~ --fs-hero`)로 통합. clamp 기반 반응형 3종만 미토큰.
5. ~~**gap 스케일 통일**~~ — **완료** (iteration 4). `--space-1 ~ --space-6`으로 정리, 6/14/18/20/24px outlier 모두 흡수.
6. ~~**브레이크포인트 부족**~~ — **완료** (iteration 4). 480px 추가.
7. ~~**on-accent 미토큰화**~~ — **완료** (iteration 4). `--on-accent: #11161a`로 통합.
8. ~~**`:focus-visible` / `prefers-reduced-motion` 부재**~~ — **완료** (iteration 4). 전역 포커스 링 + 모션 억제 블록 추가.
9. ~~**panel 틴트 그라디언트가 거의 안 보임**~~ — **완료** (iteration 5). `--tint-*` 4종 토큰화, alpha 0.08→0.12~0.14 상향, stop 34%→38% 확장.
10. ~~**상태 보더 하드코딩**~~ — **완료** (iteration 5). `--mint-border` / `--rose-border` 토큰화 (winloss-pill).
11. ~~**카드 호버 깊이감 부재**~~ — **완료** (iteration 5). `--shadow-hover` 토큰, 카드 3종에 적용.
12. ~~**Georgia serif 제목**~~ — **완료** (iteration 7). 6곳 `font-family: Georgia` 선언 제거, Pretendard 단일화. 계층은 weight/size/letter-spacing로 유지.
13. ~~**두 번 선언된 `@media (max-width: 760px)`**~~ — **완료** (iteration 7). Dual-track timeline 전용 블록을 메인 모바일 블록 내부로 병합. 선택자 충돌 없음.
14. ~~**report-badge / rank-badge 배경 alpha 잔여 하드코딩**~~ — **완료** (iteration 7). `--{state}-bg-{weak|soft|medium}` / `--amber-bg-{soft|deep|strong}` 9개 신규 토큰으로 흡수. 컬러 커버리지 80.5% → 87.8%. 0.08↔0.10 consolidation 적용. #ff9c8f 변형, 0.03/0.04/0.24/0.25/0.32/0.34/0.38/0.4 alpha edge case는 #18로 이관.
15. ~~**match-summary-card 계층 약함**~~ — **완료** (iteration 6). 좌측 3px 결과색 엣지 바 + `--tint-mint/rose` 배경 + hover 시 `--shadow-hover` + 1px lift 추가.
16. ~~**탭바 sticky 시 경계 불명확**~~ — **완료** (iteration 6). `.tab-bar::after` 12px fade shadow로 스크롤 경계 시각화.
17. ~~**로딩 상태가 opacity 0.72뿐**~~ — **완료** (iteration 6). `.skeleton` 유틸 클래스 패밀리 추가 + `@keyframes shimmer/spin`, LOADING_DETAIL `.fetch-status::before` 회전 스피너.
18. **잔여 edge-case alpha (iteration 7에서 이월)** — ~~#ff9c8f orphan rose 변형(candidate-head LOSS, RGB 다름 → 통일 판단 필요)~~ 보류(designer 판단), ~~gradient 페이드아웃 0.03 (comparison-card) — **완료** (iteration 11). `--mint-bg-trace` / `--rose-bg-trace` 신규 토큰화.~~, ~~rank-badge hex 8종(#8b7355 iron / #cd7f32 bronze / #c0c0c0 silver / #2cc5b8 platinum / #50c878 emerald / #b9f2ff diamond / #9d4dbb master / #ef4444 grandmaster) — **완료** (iteration 10). `--rank-iron/bronze/silver/platinum/emerald/diamond/master/grandmaster` 8토큰으로 토큰화. challenger `#f0b35b` → `var(--accent)` 수렴.~~, ~~amber 0.10 (running step) — **완료** (iteration 11). `--amber-bg-soft`(0.08)로 consolidation.~~, ~~info 0.36/0.10 (LOADING_DETAIL fetch-status) — **완료** (iteration 11). `--info-border`(0.38) / `--info-soft`(0.08)로 consolidation.~~, ~~single-use amber alpha (0.15/0.32/0.38 + dual-tl-phase 0.04 트리오) — **완료** (iteration 12). 기존 토큰 consolidation + `--amber-bg-trace` 신규 1토큰으로 trace 패밀리 완성.~~ 잔여 보류 항목: #ff9c8f orphan rose (RGB 다름, 별도 판단), comparison-card border 0.25 mint/rose (0.25→0.28 consolidation 별도 평가), 수용된 단독 amber 2종 (0.25 box-shadow / 0.40 border — 토큰화 안 함, §1 참조).
19. ~~**Layout / IA — 사이드바 비대, topbar 노이즈, Overview 삼중 텍스트, 10게임 카드 밀도, 탭 blank flash**~~ — **완료** (iteration 8). 사이드바 3단 슬림화(identity-card + sample-switcher + details intake), topbar 제거, detail-header + detail-metrics 병합, 10게임 OP.GG row format, 첫 진입 탭 skeleton placeholder. JS `data-*` 셀렉터 대부분 보존 (삭제: sampleId, heroMatch, themeCopy, heroPills, sectionNav, overallSummary, gameFlowSummary, snapshotResult, snapshotConfidence).
20. ~~**다중 경기 누적 분석 뷰 — 최근 N경기 챔피언·포지션 브레이크다운**~~ — **완료** (iteration 9). tab-trends에 panel--recent-aggregate + panel--champion-breakdown + panel--role-breakdown 3개 신규 패널 추가. 기존 /api/recent-matches 재사용, 서버 변경 없음. aggregateRecentStats 순수 함수로 집계. 탭 진입 시 lazy fetch + 세션 캐시 + 새로고침 버튼. 계정 전환 시 자동 invalidate.

## 11. claude.ai 사용 팁

- 이 문서 + [index.html](index.html) + [styles.css](styles.css) + 스크린샷을 Project에 올리면, 제안이 구체 변수/셀렉터 수준에서 나옵니다.
- "토큰 추가는 OK, 변수명 변경은 신중히" — [main.js](main.js)에서 `[data-view]`, `[data-result]`, `[data-score-category]` 등 속성 셀렉터로 상태를 스위칭하므로, 셀렉터 변경은 JS 영향 확인이 필요합니다.
- 제안받은 diff를 Claude Code에 "이 변경을 [styles.css](styles.css) L xxx에 적용해줘"로 던지면 적용 + 영향 검토 수행합니다.
