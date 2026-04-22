# Token Cleanup Final Iteration — Design Spec

- **Sub-project**: A (of A → B → C 분해)
- **작성일**: 2026-04-23
- **예상 기간**: ~1일 (단일 구현 세션)
- **영향 범위**: `styles.css`, `design-tokens.md`, (옵션) `README.md`
- **비영향**: `index.html`, `main.js`, `admin.*`, `server.js`, 샘플/API

---

## 1. 배경 · 목표

`styles.css` (73KB)는 iteration 6까지 토큰화가 상당히 진척된 상태다. design-audit 스크립트 기준 현 커버리지:

| 스코프 | 토큰 참조 | Raw | 커버리지 |
| --- | --- | --- | --- |
| Colors | 375 | **91** | 80.5% |
| Radius | 87 | 3 | 96.7% |
| Spacing | 86 | 5 | 94.5% |
| Font-size | 128 | 3 | 97.7% |

본 이터레이션은 **컬러 커버리지를 80.5% → 90%+** 로 올리고, `design-tokens.md §10`에 남은 오픈 이슈 3개(#12 Georgia / #13 중복 760px / #14 배지 알파)를 닫는 **마무리 pass** 다. audit 출력의 top 12 raw literal(mint/rose/amber × 6개 알파 단계) 흡수가 1차 타겟이며, 잔여 raw는 구현 시 `--scope colors` 리포트로 재평가 후 추가 흡수 여부 판단.

레이아웃·구조 변경은 본 sub-project의 스코프가 **아니며**, B(레이아웃 재정비)에서 다룬다.

---

## 2. 범위 · 비범위

### In scope

1. **컬러 알파 토큰화** — 상태색(mint/rose/amber) 알파 스케일을 의미 기반 5단계로 정리
2. **Georgia serif 제거** — 제목 6곳의 `font-family` 선언 제거, Pretendard 단일화
3. **중복 `@media (max-width: 760px)` 병합** — L3021 메인 블록에 L3377 Dual-track timeline 규칙 이관
4. **`--wr` fallback 추가** — `.winrate-ring` 2곳
5. **body base font-size 예외 문서화** — L73/L3022/L3488의 `14px/15px/16px`는 rem 앵커로 유지, design-tokens.md §2에 예외 섹션 추가
6. **design-tokens.md 업데이트** — §1 컬러 테이블, §2 typography, §5 breakpoint, §10 open issue 상태

### Out of scope

- `[data-view]`, `[data-result]`, `[data-score-category]` 등 **main.js 의존 셀렉터 이름 변경**
- 신규 컴포넌트, 레이아웃 조정, 정보 구조 재배치 (→ B)
- 신규 화면, 신규 API (→ C)
- `admin.*` 파일군 — 현 작업 흐름과 분리되어 있음
- 브라우저 지원 매트릭스 변경, 폰트 교체 (Pretendard 유지)

---

## 3. 토큰 설계

### 3.1 알파 스케일 — 상태색 3종

**설계 원칙**: 의미 기반 5단계 (`weak → soft → tint → medium → border`). 기존 `--tint-{state}`(0.14) / `--{state}-border`(0.34)는 유지. 신규는 `weak`(0.06) / `soft`(0.10) / `medium`(0.28) 3단계.

**네이밍 주의**: 기존 `--mint-soft` 토큰이 이미 0.14로 선언돼 있어 네이밍 충돌 위험. 신규 토큰은 **의도를 명확히 하는 다른 네이밍**을 채택한다. 구현 시 두 안 중 택일:

- **안 1 (preferred)**: 새 네임 `--{state}-bg-weak / -bg-soft / -bg-medium`
- **안 2**: 기존 `--{state}-soft` 를 `--{state}-tint-alt`로 개명 후 신규를 `-soft`로 재사용

안 1을 권장 — 기존 참조를 건드리지 않고 선후 독립적. 아래 테이블은 안 1 기준.

| 신규 토큰 | 값 | 흡수한 raw | 용도 |
| --- | --- | --- | --- |
| `--mint-bg-weak` | `rgba(89, 209, 178, 0.06)` | 0.06 (3곳) | `.obj-row--ally`, `.kda-evt--kill` 배경 |
| `--mint-bg-soft` | `rgba(89, 209, 178, 0.10)` | 0.08 (3곳) + 0.10 (3곳) | `.detail-progress__step[done]`, `.trend-panel--positive`, WIN 배지 배경 |
| `--mint-bg-medium` | `rgba(89, 209, 178, 0.28)` | 0.28 (3곳) | WIN 계열 강조 border |
| `--rose-bg-soft` | `rgba(255, 134, 120, 0.10)` | 0.08 (3곳) + 0.10 (3곳) | `.insight-card[weakness]`, `.trend-panel--negative`, LOSS 배지 배경 |
| `--rose-bg-medium` | `rgba(255, 134, 120, 0.28)` | 0.28 (3곳) | LOSS 계열 강조 border |
| `--amber-bg-soft` | `rgba(240, 179, 91, 0.08)` | 0.08 (4곳) | `.panel--trends` 상단 그라디언트, `.dual-tl-segment--active` |
| `--amber-bg-deep` | `rgba(240, 179, 91, 0.18)` | 0.18 (2곳) | body radial-gradient, `.sample-chip` 배경 |
| `--amber-bg-strong` | `rgba(240, 179, 91, 0.30)` | 0.30 (2곳) | `.rank-badge--gold` border |

**흡수 결정 이유 (0.08 → 0.10)**:
- 0.08과 0.10은 alpha 2pp 차이로 시각 거의 동일
- 같은 상태 계열 카드군(WIN/LOSS 페어링)에서 번갈아 쓰이는 패턴이 혼재 → 하나로 통일하면 시각 계층이 오히려 명확
- iteration 3의 font-size consolidation과 같은 패턴 (여러 근접 값 → 중앙값)

**rose-bg-weak 부재**: audit 상 rose 0.06 사용처 없음 → 토큰 추가하지 않음 (YAGNI)

**`rgba(240, 179, 91, 0.32)` / `rgba(89, 209, 178, 0.24)` / `rgba(255, 134, 120, 0.10)` / `rgba(89, 209, 178, 0.12)` 등 edge 케이스**: 구현 시 실제 라인을 열어보고 추가로 근접 토큰에 흡수할지 판단. 예상 라인:
- L646 `rgba(89, 209, 178, 0.12)` (champion-hero-banner gradient) — `--mint-bg-soft` 흡수 후보
- L3299–3302 `rgba(255, 156, 143, 0.24) / 0.12` (candidate-head LOSS — `#ff9c8f` rose 변형) — **별개 이슈** (rose 색상 자체가 `--rose`와 다름, 통일 후보). spec에 documented exception으로 남기고 본 이터레이션은 수정 보류

### 3.2 Georgia 제거

**영향 라인**: `styles.css` L153, L239, L664, L1178, L1337, L1432 — 총 6곳

**대응**: 해당 `font-family: Georgia, "Times New Roman", serif;` 선언을 **단순 삭제**. 상속된 body font-family(Pretendard Variable)가 자동 적용됨.

**계층 유지 수단**: 기존 `font-size`, `font-weight`(600~800), `letter-spacing`(-0.005em~-0.01em), `line-height`(1.15~1.2)가 이미 선언되어 있음 → 계층 명확성에 Georgia 제거 영향 없음.

**영향 셀렉터 (컨텍스트 메모)**:
- L153 — `.hero-copy h1, .hero-copy h2` (topbar 제목)
- L239 — `.candidate-card h4` (최근 경기 카드)
- L664 — `.champion-hero-banner h1` (챔피언 배너)
- L1178 — 상세 화면 섹션 제목
- L1337 — insight 카드 제목
- L1432 — moment 카드 제목

### 3.3 중복 `@media (max-width: 760px)` 병합

**현재**:
- L3021–3372 — 메인 모바일 블록 (body font-size 15px, app-shell, panel 조정 등)
- L3377–? — `Dual-track timeline responsive` 블록 (`.tab-bar`, `.tab-btn` 모바일 규칙)

**병합 방식**: L3377 블록의 **body**를 L3021 블록 맨 끝으로 이관. 기존 `Dual-track timeline responsive` comment는 해당 규칙 묶음 위 섹션 구분자로 유지. 결과적으로 `@media (max-width: 760px) { ... }` 블록이 하나로 통합됨.

**리스크**: 같은 selector가 양쪽 블록 모두에 존재하는 경우 병합 후 우선순위가 바뀜. 실제 `grep` 후 중복 selector 없는지 1차 확인 후 병합. 발견 시 후위 선언을 기준으로 수동 조정.

### 3.4 `--wr` fallback

**영향 라인**: L2390–2392

```css
/* 변경 전 */
background: conic-gradient(
  var(--mint) calc(var(--wr) * 1%),
  var(--rose) calc(var(--wr) * 1%)
);

/* 변경 후 */
background: conic-gradient(
  var(--mint) calc(var(--wr, 0) * 1%),
  var(--rose) calc(var(--wr, 0) * 1%)
);
```

**이유**: `--wr`는 `main.js:2440`에서 인라인 `style="--wr: ${winRate}"` 로 주입되는 런타임 변수. 대부분의 경우 주입되지만, 로딩 중/에러 상태에서 누락되면 `calc(NaN)` → conic-gradient 무효화. fallback `0`이 있으면 전체 mint → 전체 rose로 자연스럽게 degrade.

**main.js 변경 불필요** — CSS의 fallback만 추가.

### 3.5 body base font-size 예외 문서화

**유지 대상**:
- L73 `body { font-size: 16px; }` — rem 스케일의 root 앵커
- L3022 `@media (max-width: 760px) body { font-size: 15px; }` — tablet scaling
- L3488 `@media (max-width: 480px) body { font-size: 14px; }` — narrow mobile scaling

**문서화 액션**: `design-tokens.md §2`(타이포) 하단에 "responsive body base (미토큰화 예외)" 섹션 추가:

> body element font-size는 전체 rem 단위의 앵커 역할을 하므로 토큰 스케일에서 분리. 데스크톱 16px → 태블릿(≤760px) 15px → 좁은 모바일(≤480px) 14px 으로 단계적 축소.

이 문서화가 있으면 향후 design-audit 실행 시 3곳의 raw font-size는 "알려진 예외"로 넘길 수 있다.

---

## 4. 변경 파일 목록

### `styles.css`

- `:root` 블록에 **신규 토큰 8±개** 추가 (§3.1)
- raw alpha 치환 — 약 **50~60 라인** 영향 예상
- Georgia `font-family` 선언 **6곳 제거** (§3.2)
- L3377 media query 블록을 L3021 블록 끝으로 **이관** (§3.3)
- `.winrate-ring` conic-gradient에 **fallback `0`** 추가 (§3.4)

### `design-tokens.md`

- **§1 컬러** — 신규 토큰 8개 추가 row, "미토큰화 색상" 섹션 업데이트
- **§2 타이포** — 제목 폰트 패밀리 기술을 "Pretendard 단일화"로 수정, "responsive body base 예외" 섹션 추가
- **§5 반응형 브레이크포인트** — 760px 블록이 단일임을 명시
- **§10 알려진 문제** — #12 / #13 / #14 완료 처리 (취소선 + 완료 이터레이션 라벨)
- **§11 claude.ai 사용 팁** — 필요 시 현재 토큰 셋 스냅샷 반영

### `README.md` (옵션)

- "최근 UI 정리" 블릿에 "알파 토큰 스케일 정리 + Georgia 제거 + 760px 병합" 한 줄 추가

### 변경하지 않는 파일

- `index.html`, `main.js` — 셀렉터·DOM 구조 불변
- `admin.html`, `admin.css`, `admin.js`, `draft-state.js`
- `server.js`, `data/**`, 기타 문서

---

## 5. 구현 순서 (커밋 분리 제안)

병합/리뷰 용이성을 위해 **4 커밋**으로 분리:

1. **feat(tokens): add alpha scale tokens for mint/rose/amber**
   - `:root` 신규 토큰 8±개 추가
   - 아직 다른 곳에서 사용 안 함 (토큰만 정의)
2. **refactor(styles): replace raw alpha with tokens**
   - 50~60 라인 치환
   - audit coverage 80.5% → 90%+ 검증
3. **refactor(styles): drop Georgia, merge duplicate 760px, add --wr fallback**
   - 작은 정리 3건 묶음 커밋
4. **docs: update design-tokens.md for iteration 7 closeout**
   - 문서 업데이트
   - `README.md` 옵션 업데이트 포함 가능

각 커밋 후 design-audit + qa-smoke를 돌려 회귀 방지.

---

## 6. 검증 전략

### 6.1 자동 (blocking)

```bash
node scripts/design-audit.js --scope all --format markdown
```

**기대 결과**:

- Colors token coverage ≥ **90.0%** (stretch 95%+)
- Radius / Spacing / Font-size coverage **회귀 없음** (각각 96.7 / 94.5 / 97.7 유지)
- `@media (max-width: 760px)` **count = 1**
- Custom Properties에 `--wr` **경고 없음** (fallback 있음으로 인정됨)

### 6.2 시각 회귀 QA (blocking)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/qa-smoke.ps1
```

- 최신 `test-artifacts/qa-automation/<ts>/home-*.png` (데스크톱/태블릿/모바일)를 **이전 베이스라인과 비교**
- 허용 범위: 0.06 → 0.10 consolidation 영향으로 일부 상태 배경이 **5% 이내 색상 변화** 수용
- Georgia 제거로 제목의 **시각 변화가 눈에 띄는지** 수동 체크 (한글 제목은 변화 없음 예상, 영문 혼합 구간만 확인)

### 6.3 수동 스팟 체크

- `.hero-copy h1` 영문 아이디 또는 팀명 렌더
- `.tab-btn--active` (액티브 탭)
- `.insight-card[weakness]` (약점 카드) 배경
- `.report-badge[data-result]` WIN/LOSS 배지 border + background
- `.trend-panel--positive/negative`
- `.rank-badge--gold` border
- `.winrate-ring` 로딩 상태 (`--wr` 주입 전) 페일세이프 동작

### 6.4 git diff 리뷰

- 커밋별 diff가 논리 단위로 쪼개져 있어야 함
- `styles.css` diff에서 **값 변경**과 **토큰 교체**가 섞이지 않아야 함

---

## 7. 리스크 · 완화

| 리스크 | 완화 |
| --- | --- |
| 0.08 → 0.10 consolidation 후 일부 배지 배경이 살짝 진해짐 | 시각 QA로 수용/재조정. 허용 불가 시 해당 셀렉터에만 새 토큰(`--mint-bg-soft-a` 0.08) 별도 추가 |
| Georgia 제거로 영문 혼합 제목이 평범해짐 | 시각 QA로 확인. 거부감 있으면 후속 sub-project 또는 별도 이터레이션에서 lang 분기 고려 |
| 760px 병합 시 동일 selector 선언 충돌 | 병합 전 `grep -n '^[\.#]'` 로 양쪽 블록의 selector 목록 추출 후 겹침 확인. 발견 시 후위 선언 우선으로 정리 |
| raw alpha 치환 과정에서 의도치 않은 셀렉터 누락 | 각 신규 토큰 추가 후 `grep 'rgba(89, 209, 178' styles.css` 로 남은 mint raw 카운트 검증 |
| `--wr` fallback 값이 0이라 로딩 상태에서 전부 rose로 보임 | 의도된 fallback 동작. 로딩 중 `--wr` 주입 전 0% 상태는 CSS 레벨에서 허용 |

---

## 8. 성공 기준 (DoD)

- [ ] design-audit `--scope colors` 커버리지 ≥ 90% (stretch 95%+)
- [ ] design-audit `--scope breakpoints` 760px 선언 count = 1
- [ ] design-audit custom-props `--wr` 경고 0
- [ ] Georgia 선언 `grep Georgia styles.css` 결과 0
- [ ] qa-smoke 스크린샷 세트 캡처 완료, 수동 비교 리뷰 통과
- [ ] design-tokens.md §10 open issue #12/#13/#14 취소선 처리
- [ ] 4개 커밋으로 분리 푸시 (또는 PR), 각 커밋 단위 리뷰 가능

---

## 9. 후속 이터레이션에 남기는 이슈 (scope creep 방지)

본 sub-project에서는 처리하지 않음:

- **`#ff9c8f` orphan rose 변형** (L3299–3302 candidate-head LOSS) — 기본 `--rose`(#ff8678)와 RGB 자체가 다름. 디자인 의도 확인 후 통일/분리 판단 필요 → B에서 다룸
- **`--mint-soft`(0.14) vs `--tint-mint`(0.14) 중복** — 기능 같고 값 같음. 통합하려면 참조 grep + 영향 확인 필요 → 별도 이터레이션
- **rank-badge hex 하드코딩** (L2764–2767 `#cd7f32`, `#c0c0c0`, `#2cc5b8`) — 티어 전용 색. 토큰화 가능하나 디자인 의도 확인 필요 → B에서 다룸
- **report-badge 배경 alpha 잔여** 중 edge 케이스 (0.12, 0.24, 0.32 등) — 본 스코프 밖 소수 잔여는 `documented exception`으로 남김

---

## 10. 참고

- [design-tokens.md](../../../design-tokens.md) — 현 토큰 시스템 스냅샷
- [scripts/design-audit.js](../../../scripts/design-audit.js) — 감사 도구
- [scripts/qa-smoke.ps1](../../../scripts/qa-smoke.ps1) — 시각 회귀 자동화
- [.claude/agents/design-auditor.md](../../../.claude/agents/design-auditor.md) — `/design-audit` 에이전트 정의
