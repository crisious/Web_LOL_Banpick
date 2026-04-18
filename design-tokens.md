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

**미토큰화 색상** (남은 하드코딩)
- `#11161a` / `#1c1711` — 버튼 글자색 (액센트 배경 위). 고대비 텍스트 전용 → `--on-accent` 후보
- `rgba(255, 255, 255, 0.025)` — 바디 그리드 오버레이 (단일 사용)
- `rgba(120, 186, 255, 0.36)` / `rgba(120, 186, 255, 0.1)` — LOADING_DETAIL fetch-status 전용 (단일 사용. 토큰화 보류)

## 2. 타이포

**기본**
- 패밀리 (본문): `"Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif`
- 패밀리 (제목): `Georgia, "Times New Roman", serif` — hero/panel h1~h3, 탭/insight/moment 제목, detail-progress 헤드
- 베이스: `16px` / line-height 본문 `1.6`

**사이즈 스케일** (rem 기준, 빈도순 재구성)

| 용도 | 값 |
|---|---|
| 마이크로 라벨 (eyebrow/meta-label/event-chip) | `0.58rem` ~ `0.74rem` |
| 바디 small | `0.82rem` |
| 바디 | `0.92rem` |
| 값 강조 (stat 숫자) | `1.15rem` ~ `1.3rem` |
| 섹션 제목 | `clamp(1.2rem, 1.6vw, 1.55rem)` |
| topbar 제목 | `clamp(1.2rem, 2vw, 1.75rem)` |
| 헤드라인 (detail) | `clamp(1.7rem, 2.6vw, 2.4rem)` |
| 챔피언 배너 이름 | `1.6rem` |
| 대형 지표 (e.g. 승률) | `3.2rem` |

**letter-spacing**
- 마이크로 라벨: `0.18em` ~ `0.22em` + `text-transform: uppercase`
- 헤드라인: `-0.005em` ~ `-0.01em`

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

**gap 스케일** (빈도순)
- `8px` / `10px` / `12px` — 인라인 요소
- `14px` / `16px` — 카드 내부 그룹
- `18px` / `22px` — 패널 간, 섹션 간

## 4. 보더 반경

고정된 radius 스케일:

| 값 | 용도 |
|---|---|
| `4~6px` | 작은 배지, 결과 라벨 (`__result`) |
| `8px` | 진행바, 인라인 칩 |
| `10~12px` | 기본 인터랙티브 요소, 챔피언 배너 |
| `16~18px` | tab-btn, 중간 카드 |
| `20~22px` | meta/stat/sample 카드 (**카드 표준**) |
| `28px` | hero-panel, panel (**최상위 패널 표준**) |
| `999px` | pill, winloss-pill, 원형 버튼 |
| `50%` | 원형 아이콘/아바타 |

## 5. 반응형 브레이크포인트

3개만 존재 ([styles.css:2897, 2946, 3302](styles.css)):

- `@media (max-width: 1180px)` — 메인 워크스페이스 2열 → 1열
- `@media (max-width: 760px)` — 모바일 (두 곳에서 선언됨 — 통합 후보)

**현재 gap이 비는 구간**: 480px 미만 (좁은 모바일) 최적화 명시 없음.

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

**panel 컬러 틴트** (panel 변형별 상단 그라디언트 0.08~0.1 alpha)
- `.panel--headline` → amber
- `.panel--snapshot` / `.panel--samples` / `.panel--strengths` → mint
- `.panel--nav` → info blue
- `.panel--fetcher` / `.panel--weaknesses` → rose

## 7. 탭 컴포넌트 (4탭 기준)

현재 상세 화면은 4탭 구조 (Overview / Progress / Mastery / AI Comparison).

```
.tab-bar     → flex, gap 8px, sticky top 0, z-index 20
              배경: linear-gradient(to bottom, var(--bg) 60%, transparent)
.tab-btn     → 10px 22px / radius 18px / border var(--line)
              0.92rem / 600 weight / color var(--muted)
.tab-btn:hover → 정보 블루 hover
.tab-btn--active → 액센트 보더 + amber-soft 배경 + accent 텍스트
```

## 8. 배경 장식 (바디 레벨)

- radial-gradient 민트 (top-left, 0.18 alpha, 28%)
- radial-gradient 앰버 (top-right, 0.18 alpha, 30%)
- linear-gradient 145deg `--bg` → `--bg-alt`
- `body::before` — 36px 그리드 오버레이, 중앙 페이드 마스크
- `body::after` — 24px 인셋 얇은 보더 (프레이밍)

## 9. 접근성 · 유틸

- `.skip-link` — 포커스 시 드러나는 스킵 링크 (`pill + accent`)
- `.sr-only` — 시각적으로만 숨김
- 모든 상호작용 요소가 `transition` 지정되어 있음
- `aria-*` 처리는 [main.js](main.js)에서 동적으로 관리됨 (디자인 변경 시 `[data-view]` / `[data-result]` 속성 셀렉터 주의)

## 10. 알려진 문제 · 개선 후보

claude.ai에 "이 항목 개선해줘"로 던지면 좋은 후보:

1. **radius 스케일 과다** — 6, 8, 10, 12, 14, 16, 18, 20, 22, 28, 999 중 실질적으로 분기점은 `8 / 16 / 22 / 28 / 999` 5개면 충분. 토큰화 필요.
2. **알파 배경이 하드코딩** — `rgba(255,255,255,0.03 / 0.04 / 0.06 / 0.08)`이 수십 곳. `--surface-1/2/3` 변수화 후보.
3. **정보 블루(`#78baff` 계열)가 미토큰화** — hover/panel--nav에서 반복 사용.
4. **font-size 스케일 혼재** — `0.58, 0.6, 0.64, 0.68, 0.7, 0.72, 0.74, 0.76, 0.78, 0.8, 0.82, 0.84, 0.85, 0.88, 0.9, 0.92, 0.95`까지 촘촘. 7단계 스케일 정리 필요 (e.g. `xs/sm/base/md/lg/xl/display`).
5. **gap 스케일 통일** — `8, 10, 12, 14, 16, 18, 22`가 혼재. `--space-1 ~ --space-6`으로 정리 시 레이아웃 일관성 향상.
6. **브레이크포인트 부족** — `1180 / 760` 2개. 480px 미만 대응이 약함.
7. **Georgia serif 제목** — 정체성이지만, 영문/한글 혼용 시 행간 불균일. 한글 제목만 sans 유지하는 옵션 검토 가능.
8. **panel 틴트 그라디언트가 거의 안 보임** — 0.08~0.1 alpha로 매우 은은. 또는 의도적 — claude.ai에 스크린샷으로 판단 맡기기.

## 11. claude.ai 사용 팁

- 이 문서 + [index.html](index.html) + [styles.css](styles.css) + 스크린샷을 Project에 올리면, 제안이 구체 변수/셀렉터 수준에서 나옵니다.
- "토큰 추가는 OK, 변수명 변경은 신중히" — [main.js](main.js)에서 `[data-view]`, `[data-result]`, `[data-score-category]` 등 속성 셀렉터로 상태를 스위칭하므로, 셀렉터 변경은 JS 영향 확인이 필요합니다.
- 제안받은 diff를 Claude Code에 "이 변경을 [styles.css](styles.css) L xxx에 적용해줘"로 던지면 적용 + 영향 검토 수행합니다.
