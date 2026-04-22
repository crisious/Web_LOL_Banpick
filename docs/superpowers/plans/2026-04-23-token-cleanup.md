# Token Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `styles.css`의 컬러 알파 하드코딩을 의미 기반 토큰으로 흡수하고, Georgia serif / 중복 760px / `--wr` fallback 같은 잔여 정리를 마무리해 design-audit 컬러 커버리지를 80.5% → 90%+ 로 올린다.

**Architecture:** CSS 토큰 추가 → 치환 → 정리 → 문서화의 4단계 순차 커밋. `styles.css` `:root` 블록에 신규 알파 스케일 토큰 8개를 추가하고, 발견된 raw rgba 리터럴을 문자열 단위로 치환한다. `main.js` / `index.html` / 셀렉터 이름은 일체 건드리지 않는다.

**Tech Stack:** CSS Custom Properties, Node.js (design-audit CLI), PowerShell (qa-smoke), headless Chrome (스크린샷 비교).

**Spec:** [docs/superpowers/specs/2026-04-23-token-cleanup-design.md](../specs/2026-04-23-token-cleanup-design.md)

---

## File Structure

**변경 파일 (3)**

- **Modify** `styles.css` — `:root` 토큰 추가, raw rgba 치환, Georgia 제거, 760px 병합, `--wr` fallback
- **Modify** `design-tokens.md` — §1 컬러 / §2 타이포 / §5 breakpoint / §10 open issue 업데이트
- **Modify** `README.md` (옵션) — "최근 UI 정리" 한 줄 추가

**생성 파일 (1, baseline 아티팩트)**

- **Create** `test-artifacts/design-audit/baseline-pre-cleanup.md` — 변경 전 audit 스냅샷. 완료 후 diff 리포트로 남김

**참조만 (변경 없음)**

- `scripts/design-audit.js` — 검증 CLI
- `scripts/qa-smoke.ps1` — 시각 회귀 자동화
- `main.js:2440` — `--wr` 주입 지점 (fallback 동작 확인용)
- `index.html` — 제목 내용 확인용 (Georgia 영향)

---

## Task 0: Baseline Capture

**Files:**

- Create: `test-artifacts/design-audit/baseline-pre-cleanup.md`

- [ ] **Step 0.1: 변경 전 audit 리포트를 아티팩트로 저장**

```bash
mkdir -p test-artifacts/design-audit
node scripts/design-audit.js --scope all --format markdown --top 20 --output test-artifacts/design-audit/baseline-pre-cleanup.md
```

Expected: `test-artifacts/design-audit/baseline-pre-cleanup.md` 생성. 파일 안에 `Token coverage: 80.5%` (Colors), `Token coverage: 96.7%` (Radius), `Token coverage: 94.5%` (Spacing), `Token coverage: 97.7%` (Font Size), `max-width: 760px` x2, `--wr` custom property 경고 포함되어야 함.

- [ ] **Step 0.2: 베이스라인 스크린샷 확보 (옵션이지만 권장)**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/qa-smoke.ps1
```

Windows 환경에서 실행. macOS/Linux 환경인 경우 이 스텝은 skip하고 변경 후 직접 브라우저로 수동 확인한다. 결과물 경로는 `test-artifacts/qa-automation/<timestamp>/home-*.png`.

- [ ] **Step 0.3: baseline 커밋하지 않음 — `.gitignore`에 design-audit 아티팩트 추가**

`test-artifacts/qa-automation/`는 이미 `.gitignore` 에 있지만 `test-artifacts/design-audit/` 는 아직 없음. 한 줄 추가:

```
file: .gitignore
old: test-artifacts/qa-automation/
new: test-artifacts/qa-automation/
test-artifacts/design-audit/
```

`git status`로 baseline-pre-cleanup.md가 untracked로 보이지 않는지 확인. 별도 커밋 없음 (.gitignore 변경은 Task 9의 Commit 4 또는 별도 커밋에 포함 가능 — 플랜 끝에서 정리).

---

## Task 1: Add Alpha Scale Tokens (Commit 1)

**Files:**

- Modify: `styles.css` (`:root` 블록, 현재 L1~L46 범위)

**목표:** `:root`에 새 알파 토큰 8개를 선언한다. 아직 아무 셀렉터에서도 사용하지 않음 (토큰만 정의, 참조 치환은 Task 2~4).

- [ ] **Step 1.1: `:root` 블록의 정확한 삽입 위치 확인**

```bash
grep -n "\-\-shadow-hover" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: `--shadow-hover` 선언 라인 번호 출력. 이 선언 **바로 다음 줄**에 새 토큰 블록을 삽입한다. (design-tokens.md §1 테이블의 마지막 기존 토큰이 `--shadow-hover`이므로 그 직후가 시각적/논리적으로 합당한 자리.)

- [ ] **Step 1.2: 기존 토큰 블록 끝에 알파 스케일 토큰 8개 추가**

`styles.css`의 `--shadow-hover: ...;` 선언 바로 다음 줄에 아래 블록을 삽입한다.

```css
  /* State color alpha scale — iteration 7 (token cleanup) */
  --mint-bg-weak: rgba(89, 209, 178, 0.06);
  --mint-bg-soft: rgba(89, 209, 178, 0.1);
  --mint-bg-medium: rgba(89, 209, 178, 0.28);
  --rose-bg-soft: rgba(255, 134, 120, 0.1);
  --rose-bg-medium: rgba(255, 134, 120, 0.28);
  --amber-bg-soft: rgba(240, 179, 91, 0.08);
  --amber-bg-deep: rgba(240, 179, 91, 0.18);
  --amber-bg-strong: rgba(240, 179, 91, 0.3);
```

들여쓰기는 기존 `:root` 블록과 같은 2-space. alpha 표기는 `0.1` / `0.3` (3자리 없이). 이유: design-audit과 기존 `--mint-soft: rgba(..., 0.14)` 스타일 일치.

- [ ] **Step 1.3: audit 재실행 — raw count 변화 없음 확인**

```bash
node scripts/design-audit.js --scope colors --format text --top 4
```

Expected: `Raw values: 91` 그대로. **토큰만 추가했지 참조 치환은 안 했으므로 raw count는 불변이어야 한다.** `Token coverage: 80.5%`도 그대로.

만약 숫자가 달라졌다면 선언 중에 오타나 중복이 있는 것 — `grep -c "\-\-mint-bg-\|\-\-rose-bg-\|\-\-amber-bg-" styles.css`로 선언 수가 8인지 확인.

- [ ] **Step 1.4: 시각 변화 없음 확인 (옵션)**

브라우저로 `http://127.0.0.1:8123` (서버 실행 중이어야 함) 로드해 렌더 변화 없는지 한 번 훑는다. 토큰만 추가했으므로 변화 없어야 정상.

- [ ] **Step 1.5: Commit 1**

```bash
git add styles.css
git commit -m "$(cat <<'EOF'
feat(tokens): add alpha scale tokens for mint/rose/amber

Introduce --{state}-bg-{weak|soft|medium} (mint/rose) and
--amber-bg-{soft|deep|strong} to prep for raw rgba absorption.
Tokens only; no references changed yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Replace Mint Raw Alpha References (part of Commit 2)

**Files:**

- Modify: `styles.css` — 12±개 라인 (mint 0.06/0.08/0.1/0.12/0.28)

**목표:** mint 계열 raw rgba를 모두 토큰 참조로 치환. audit의 mint raw count → 0.

**사전 확인**:

```bash
grep -n "rgba(89, 209, 178, 0\.0[68])\|rgba(89, 209, 178, 0\.1)\|rgba(89, 209, 178, 0\.12)\|rgba(89, 209, 178, 0\.28)" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 아래 라인들이 출력되어야 한다 (순서 가능).

- `0.06` × 3 (L1806, L1999, L2901)
- `0.08` × 3 (L737, L1565, L2906)
- `0.1` × 3 (L1237, L1369, L1450)
- `0.12` × 3 (L646, L3299, L3320)
- `0.28` × 3 (L736, L1368, L1449)

다른 라인이 나오면 파일 수정 사이 라인 번호가 이동했으니 아래 스텝의 **Edit tool old_string 매칭은 라인 번호가 아닌 라인 내용** 기준으로 수행한다.

- [ ] **Step 2.1: mint 0.06 → `--mint-bg-weak` 치환 (3곳)**

3곳 모두 동일한 리터럴 `rgba(89, 209, 178, 0.06)`이므로 replace_all 가능.

```
file: styles.css
old: rgba(89, 209, 178, 0.06)
new: var(--mint-bg-weak)
replace_all: true
```

- [ ] **Step 2.2: mint 0.08 → `--mint-bg-soft` 치환 (3곳)**

0.08 → 0.10 **consolidation** (spec §3.1). 따라서 0.08을 직접 `--mint-bg-soft`(0.10 값)로 치환하면 결과적으로 2pp 진해진다. 허용됨 (spec §3.1에 문서화).

```
file: styles.css
old: rgba(89, 209, 178, 0.08)
new: var(--mint-bg-soft)
replace_all: true
```

- [ ] **Step 2.3: mint 0.1 → `--mint-bg-soft` 치환 (3곳)**

```
file: styles.css
old: rgba(89, 209, 178, 0.1)
new: var(--mint-bg-soft)
replace_all: true
```

- [ ] **Step 2.4: mint 0.12 → `--mint-bg-soft` 치환 (3곳, spec §3.1 edge case)**

spec §3.1에서 `L646 champion-hero-banner gradient, L3299, L3320`의 0.12를 `--mint-bg-soft`(0.10)에 흡수하기로 결정. 2pp 차이.

```
file: styles.css
old: rgba(89, 209, 178, 0.12)
new: var(--mint-bg-soft)
replace_all: true
```

- [ ] **Step 2.5: mint 0.28 → `--mint-bg-medium` 치환 (3곳)**

```
file: styles.css
old: rgba(89, 209, 178, 0.28)
new: var(--mint-bg-medium)
replace_all: true
```

- [ ] **Step 2.6: mint raw 잔여 확인**

```bash
grep -n "rgba(89, 209, 178" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 아래 라인만 남아야 함 (토큰 선언 및 edge case):

- `--mint-bg-weak/soft/medium` 토큰 선언 (Task 1에서 추가)
- `--mint-soft: rgba(89, 209, 178, 0.14)` (기존, spec out-of-scope)
- `--tint-mint: rgba(89, 209, 178, 0.14)` (기존, spec out-of-scope)
- `--mint-border: rgba(89, 209, 178, 0.34)` (기존)
- `rgba(89, 209, 178, 0.03)` L2906 (gradient 속 페이드아웃, spec §9 후속 이슈 - 보류)
- `rgba(89, 209, 178, 0.24)` L3298 candidate-head WIN (spec §9 #ff9c8f 세트와 연관된 별개 이슈 - 보류)

총 6~7줄 내외 남음. 0.06/0.08/0.10/0.12/0.28 리터럴은 0개여야 한다.

- [ ] **Step 2.7: 시각 스팟 체크**

변경 영향이 큰 셀렉터 4개를 브라우저에서 빠르게 확인:

- `.report-badge--result[data-result='WIN']` — 경기 리스트 카드의 승리 배지 배경(`--mint-bg-soft`)이 기존 0.08 대비 살짝 진한지 육안 확인
- `.detail-progress__step[data-step-state="done"]` — 상세 로딩 진행 스텝의 완료 상태 배경
- `.trend-panel--positive` — 추세 패널의 긍정 그라디언트
- `.kda-evt--kill` — 근거 이벤트 로그의 kill 배경 (`--mint-bg-weak`)

눈에 띌 만한 변화가 있으면 screenshot을 남겨 Task 12 최종 리뷰 때 비교.

---

## Task 3: Replace Rose Raw Alpha References (part of Commit 2)

**Files:**

- Modify: `styles.css` — 9개 라인 (rose 0.08/0.1/0.28)

**목표:** rose 계열 raw rgba를 모두 토큰 참조로 치환.

**사전 확인**:

```bash
grep -n "rgba(255, 134, 120, 0\.08)\|rgba(255, 134, 120, 0\.1)\|rgba(255, 134, 120, 0\.28)" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: `0.08` × 3, `0.1` × 3, `0.28` × 3, 총 9 라인.

- [ ] **Step 3.1: rose 0.08 → `--rose-bg-soft` 치환 (3곳, 0.08→0.10 consolidation)**

```
file: styles.css
old: rgba(255, 134, 120, 0.08)
new: var(--rose-bg-soft)
replace_all: true
```

- [ ] **Step 3.2: rose 0.1 → `--rose-bg-soft` 치환 (3곳)**

```
file: styles.css
old: rgba(255, 134, 120, 0.1)
new: var(--rose-bg-soft)
replace_all: true
```

- [ ] **Step 3.3: rose 0.28 → `--rose-bg-medium` 치환 (3곳)**

```
file: styles.css
old: rgba(255, 134, 120, 0.28)
new: var(--rose-bg-medium)
replace_all: true
```

- [ ] **Step 3.4: rose raw 잔여 확인**

```bash
grep -n "rgba(255, 134, 120" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 남아 있어야 할 것들:

- `--rose: #ff8678` → 해당 없음 (hex)
- `--rose-soft: rgba(255, 134, 120, 0.14)` (기존)
- `--tint-rose: rgba(255, 134, 120, 0.12)` (기존) — **0.12가 token 선언에만 있음**
- `--rose-border: rgba(255, 134, 120, 0.34)` (기존)
- `--rose-bg-soft/medium` 신규 토큰 선언 (Task 1)
- `rgba(255, 134, 120, 0.03)` L2911 (gradient 페이드아웃, spec §9 보류)

0.08/0.1/0.28 리터럴은 0개여야 함.

**주의**: L3304의 `rgba(255, 156, 143, ...)` 는 **rose가 아닌 orphan `#ff9c8f` 변형** — 본 이터레이션에서 건드리지 않음 (spec §9).

- [ ] **Step 3.5: 시각 스팟 체크**

- `.report-badge--result[data-result='LOSS']`
- `.insight-card[data-kind='weakness']`
- `.trend-panel--negative`
- `.rank-badge--unavailable` (L2773)

---

## Task 4: Replace Amber Raw Alpha References (part of Commit 2)

**Files:**

- Modify: `styles.css` — 8개 라인 (amber 0.08/0.18/0.3)

**목표:** amber 계열 raw rgba를 모두 토큰 참조로 치환. amber는 consolidation 없이 exact match.

**사전 확인**:

```bash
grep -n "rgba(240, 179, 91, 0\.08)\|rgba(240, 179, 91, 0\.18)\|rgba(240, 179, 91, 0\.3)" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: `0.08` × 4, `0.18` × 2, `0.3` × 2, 총 8 라인.

- [ ] **Step 4.1: amber 0.08 → `--amber-bg-soft` 치환 (4곳)**

```
file: styles.css
old: rgba(240, 179, 91, 0.08)
new: var(--amber-bg-soft)
replace_all: true
```

- [ ] **Step 4.2: amber 0.18 → `--amber-bg-deep` 치환 (2곳)**

```
file: styles.css
old: rgba(240, 179, 91, 0.18)
new: var(--amber-bg-deep)
replace_all: true
```

- [ ] **Step 4.3: amber 0.3 → `--amber-bg-strong` 치환 (2곳)**

```
file: styles.css
old: rgba(240, 179, 91, 0.3)
new: var(--amber-bg-strong)
replace_all: true
```

- [ ] **Step 4.4: amber raw 잔여 확인**

```bash
grep -n "rgba(240, 179, 91" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 남아야 할 것들:

- `--amber-soft: rgba(240, 179, 91, 0.16)` (기존)
- `--tint-amber: rgba(240, 179, 91, 0.14)` (기존)
- `--amber-border: rgba(240, 179, 91, 0.34)` (기존)
- `--amber-bg-soft/deep/strong` 신규 선언 (Task 1)
- `rgba(240, 179, 91, 0.32)` L3319 (champion-avatar radial, spec §9 보류)

0.08/0.18/0.3 리터럴은 0개여야 함.

- [ ] **Step 4.5: 시각 스팟 체크**

- body 배경 radial-gradient (L69)
- `.panel--trends` 상단 그라디언트 (L1160)
- `.dual-tl-segment--active` (L1021)
- `.rank-badge--gold` border (L2766)
- `.sample-chip` (L2550)

---

## Task 5: Verify Audit Improvement + Commit 2

**Files:**

- (verify only, no edits)

- [ ] **Step 5.1: audit 재실행 — 컬러 커버리지 향상 확인**

```bash
node scripts/design-audit.js --scope colors --format text --top 12
```

Expected:

- `Token references: ≥ 405` (기존 375 + 약 30 신규 참조)
- `Raw values: ≤ 65` (기존 91 - 약 30 absorbed)
- `Token coverage: ≥ 86.0%` (목표 90%+는 edge case까지 흡수해야 달성, 85~88%는 허용)

달성 못 했으면 Task 2~4의 grep 결과를 다시 보고 누락된 리터럴이 있는지 확인.

- [ ] **Step 5.2: 전 범위 audit — 회귀 없음 확인**

```bash
node scripts/design-audit.js --scope all --format text --top 4
```

Expected:

- Radius coverage: 96.7% (불변)
- Spacing coverage: 94.5% (불변)
- Font Size coverage: 97.7% (불변)
- Custom Properties: `--wr` 경고 여전히 존재 (Task 7에서 처리 예정)

- [ ] **Step 5.3: Commit 2**

```bash
git add styles.css
git commit -m "$(cat <<'EOF'
refactor(styles): replace raw alpha with state-color tokens

Absorb mint/rose/amber raw rgba literals into the new alpha
scale tokens added in the previous commit. Consolidates 0.08
into 0.10 for mint/rose (2pp consolidation, see spec §3.1).
Leaves #ff9c8f variants, 0.03 fade-outs, and 0.24/0.32 edge
cases for the follow-up iteration per spec §9.

Colors coverage target: 80.5% -> 86%+.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Drop Georgia font-family (part of Commit 3)

**Files:**

- Modify: `styles.css` — 6 라인 제거 (L153, L239, L664, L1178, L1337, L1432)

**목표:** Georgia `font-family` 선언 6곳 모두 삭제. Pretendard 상속.

- [ ] **Step 6.1: Georgia 선언 위치 재확인**

```bash
grep -n "font-family: Georgia" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 6개 라인 출력. 각 라인의 전체 내용이 `  font-family: Georgia, "Times New Roman", serif;` (2-space 들여쓰기).

- [ ] **Step 6.2: Georgia 선언 6곳 모두 삭제**

```
file: styles.css
old:   font-family: Georgia, "Times New Roman", serif;
new: (빈 줄 1개 또는 제거)
replace_all: true
```

**주의**: Edit tool의 replace_all로 `font-family: Georgia, "Times New Roman", serif;` 줄 전체를 제거. old_string이 들여쓰기를 포함하고 new_string이 비면 결과적으로 라인 전체가 제거된다. 한 번 해본 뒤 `grep -c "Georgia" styles.css` 로 0 확인.

- [ ] **Step 6.3: Georgia 0개 확인**

```bash
grep -c "Georgia" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: `0`

- [ ] **Step 6.4: 시각 스팟 체크**

다음 셀렉터가 렌더되는 화면에서 제목이 여전히 hierarchy를 유지하는지 (Pretendard weight + size로 충분한지) 확인:

- `.hero-copy h1, .hero-copy h2` — 플레이어 허브 상단
- `.candidate-card h4` — 최근 경기 카드 제목 (챔피언명)
- `.champion-hero-banner h1` — 챔피언 배너
- 상세 섹션 제목 (L1178 context)
- `.insight-card` 제목 (L1337)
- `.moment-list` 제목 (L1432)

한글은 변화 없음 예상. 영문 혼합(선수명, 챔프명 로컬라이즈 미적용 구간)은 폰트 톤이 약간 변함.

---

## Task 7: Merge Duplicate 760px Media Query (part of Commit 3)

**Files:**

- Modify: `styles.css` — L3377 블록을 L3021 블록 내부로 이관

**목표:** `@media (max-width: 760px)` 블록 2개를 하나로 통합. `design-tokens.md §5`의 "두 번 선언된 @media (max-width: 760px) — 통합 후보" 해소.

- [ ] **Step 7.1: 양쪽 블록 경계 확인**

```bash
grep -n "@media (max-width: 760px)" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 2개 라인 (위치는 이전 Task들의 변경에 따라 약간 이동했을 수 있음).

- [ ] **Step 7.2: 두 번째 블록의 범위 확인**

첫 번째 라인 이후부터 두 번째 라인까지 Read tool로 읽어 두 번째 블록의 `}` 종료 위치를 파악.

```
Read styles.css (두 번째 @media 라인부터 100~150 줄)
```

두 번째 블록은 `/* ── Dual-track timeline responsive ──... */` 주석 바로 뒤에 시작해서 `.tab-bar`, `.tab-btn`, 기타 모바일 규칙을 포함하고 `}` 한 줄로 끝난다. 끝 `}` 라인 번호를 기록.

- [ ] **Step 7.3: 양쪽 블록에 중복 selector 있는지 확인**

첫 번째 블록에서 선언된 셀렉터 목록과 두 번째 블록의 셀렉터를 비교:

```bash
awk '/@media \(max-width: 760px\)/{c++; print "--- BLOCK " c " ---"} c{print}' /Users/a1234/Documents/Web_LOL_Banpick/styles.css | grep -E "^[.#]" | sort | uniq -c | sort -rn | head -20
```

Expected: 모든 셀렉터가 count 1. count 2 이상이 나오면 양쪽에 같은 셀렉터가 존재 → 병합 후 우선순위 수동 조정 필요. 현재로서는 dual-track 블록이 tab-bar/tab-btn 전용이므로 충돌 없을 것으로 예상.

- [ ] **Step 7.4: 두 번째 블록을 첫 번째 블록 내부 끝으로 이관**

작업 순서:

1. Read로 두 번째 `@media (max-width: 760px) { ... }` 블록 전체 복사 (내부 규칙만, `@media` 줄과 외부 `}` 는 제외)
2. Read로 `/* ── Dual-track timeline responsive ──... */` 주석 라인 함께 복사 (선택)
3. Edit로 첫 번째 블록의 마지막 `}` **바로 앞**에 다음을 삽입:

```css

  /* ── Dual-track timeline responsive ───────────────────────────────────── */
  [복사한 내부 규칙들, 들여쓰기 2-space 유지]
```

4. 두 번째 블록(comment + `@media (max-width: 760px) { ... }` 전체) 삭제

직접 스와프이 어려우면 2단계로: 임시로 내용 저장 → 첫 블록에 붙여넣기 → 두 번째 블록 삭제.

- [ ] **Step 7.5: 760px 1개 확인**

```bash
grep -c "@media (max-width: 760px)" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: `1`

- [ ] **Step 7.6: 병합 후 audit 확인**

```bash
node scripts/design-audit.js --scope breakpoints --format text
```

Expected: `max-width: 760px` x**1** (기존 x2).

- [ ] **Step 7.7: 시각 스팟 체크**

브라우저 창을 760px 이하로 줄여 탭바(`.tab-bar`, `.tab-btn`)가 정상으로 wrap / gap을 유지하는지, 나머지 모바일 규칙(앱 쉘 패딩, 폰트 크기 등)도 정상 작동하는지 확인. 병합 전/후가 동일해야 한다.

---

## Task 8: Add `--wr` Fallback (part of Commit 3)

**Files:**

- Modify: `styles.css` — `.winrate-ring` conic-gradient (L2390~2392, 라인은 이전 변경으로 이동했을 수 있음)

- [ ] **Step 8.1: 현재 선언 위치 찾기**

```bash
grep -n "calc(var(--wr)" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 2개 라인 (`.winrate-ring` conic-gradient 내부의 mint / rose stop).

- [ ] **Step 8.2: fallback `0` 추가**

```
file: styles.css
old: calc(var(--wr) * 1%)
new: calc(var(--wr, 0) * 1%)
replace_all: true
```

- [ ] **Step 8.3: 치환 확인**

```bash
grep -n "calc(var(--wr" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 2개 라인 모두 `calc(var(--wr, 0) * 1%)` 로 변경됨. `--wr)` 없는 참조는 없어야 함.

- [ ] **Step 8.4: audit custom-props 경고 해소 확인**

```bash
node scripts/design-audit.js --scope customProps --format text
```

Expected: `--wr` 관련 줄이 사라지거나 (fallback 있음으로 인정) 또는 해당 섹션이 비어 있음. audit 로직은 `parseVarCall`에서 `fallback`이 비어 있지 않으면 그룹핑에서 제외 (design-audit.js L503 주변 확인).

- [ ] **Step 8.5: 런타임 페일세이프 동작 수동 확인**

개발자 도구 Elements 패널에서 `.winrate-ring` 요소를 선택해 `style="--wr: ..."` 인라인 스타일을 임시로 제거해 본다. Fallback `0` 적용 시 ring은 `rose` 단색 원이 되어야 한다 (conic-gradient의 mint stop이 0%라 즉시 rose로 전환).

**중요**: 이 체크는 영구 변경 아님. DevTools에서만 수정 후 원래대로 되돌림.

- [ ] **Step 8.6: Commit 3 (Georgia + 760px + --wr 묶음)**

```bash
git add styles.css
git commit -m "$(cat <<'EOF'
refactor(styles): drop Georgia, merge 760px, add --wr fallback

- Remove Georgia font-family from 6 title selectors; Pretendard
  inherits and provides hierarchy via weight/size/letter-spacing.
- Merge the standalone dual-track timeline @media (max-width:
  760px) block into the main mobile block so the breakpoint is
  declared once.
- Add fallback 0 to --wr in .winrate-ring so the conic-gradient
  degrades gracefully when the runtime-injected value is absent.

Closes design-tokens.md §10 open issues #12, #13.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Update design-tokens.md (Commit 4 — docs)

**Files:**

- Modify: `design-tokens.md` (현재 15KB)

**목표:** spec §3.5, §10의 문서 업데이트를 모두 반영.

- [ ] **Step 9.1: §1 컬러 테이블에 신규 토큰 8개 row 추가**

현재 `--shadow-hover` 행 바로 아래에 다음 8줄을 추가 (Markdown table row):

```markdown
| `--mint-bg-weak` | `rgba(89, 209, 178, 0.06)` | 옅은 mint 배경 (ally row, kill event) |
| `--mint-bg-soft` | `rgba(89, 209, 178, 0.1)` | WIN 배지 / 진행 스텝 done / 긍정 추세 배경 |
| `--mint-bg-medium` | `rgba(89, 209, 178, 0.28)` | WIN 계열 강조 border |
| `--rose-bg-soft` | `rgba(255, 134, 120, 0.1)` | LOSS 배지 / 약점 카드 / 부정 추세 배경 |
| `--rose-bg-medium` | `rgba(255, 134, 120, 0.28)` | LOSS 계열 강조 border |
| `--amber-bg-soft` | `rgba(240, 179, 91, 0.08)` | 추세 패널 상단 / 액티브 세그먼트 배경 |
| `--amber-bg-deep` | `rgba(240, 179, 91, 0.18)` | body radial-gradient / sample-chip 배경 |
| `--amber-bg-strong` | `rgba(240, 179, 91, 0.3)` | rank-badge gold border |
```

- [ ] **Step 9.2: §1 "미토큰화 색상" 섹션 업데이트**

현재 목록에서 이터레이션 7에서 흡수된 항목 제거. 남은 항목만 유지하고, 새로 인식된 edge case 추가. 최종 내용:

```markdown
**미토큰화 색상** (남은 하드코딩, 모두 2회 이하 사용 — 후속 이터레이션 후보)
- `rgba(255, 255, 255, 0.025)` / `rgba(255, 255, 255, 0.035)` — 바디 그리드 오버레이 (단일 사용)
- `rgba(120, 186, 255, 0.36)` / `rgba(120, 186, 255, 0.1)` — LOADING_DETAIL fetch-status 전용 (단일 사용. 토큰화 보류)
- `rgba(89, 209, 178, 0.03)` / `rgba(255, 134, 120, 0.03)` — 카드 배경 gradient 페이드아웃 (L2906, L2911)
- `rgba(89, 209, 178, 0.24)` — candidate-head WIN border (L3298)
- `rgba(255, 156, 143, 0.24)` / `rgba(255, 156, 143, 0.12)` — **#ff9c8f orphan rose 변형** (L3299–3304). 기본 `--rose`와 다른 RGB — 통일 여부는 후속 이터레이션에서 결정
- `rgba(240, 179, 91, 0.32)` — champion-avatar radial (L3319)
```

- [ ] **Step 9.3: §2 타이포 섹션 수정**

"패밀리 (제목)" 줄 수정:

```markdown
**변경 전**:
- 패밀리 (제목): `Georgia, "Times New Roman", serif` — hero/panel h1~h3, 탭/insight/moment 제목, detail-progress 헤드

**변경 후**:
- 패밀리 (제목): `Pretendard Variable`(본문 상속) — 제목 계층은 `font-weight` 600~800 + size + letter-spacing로 구성 (iteration 7에서 Georgia 제거)
```

§2의 `**기본**` 하위 불릿 2개 중 중복된 줄이 있으면 정리. 상단 블록과 하단 블록에 같은 "패밀리 (본문)" 줄이 2번 선언되어 있으면 하나로 합침.

- [ ] **Step 9.4: §2 "responsive body base 예외" 섹션 추가**

§2 맨 아래에 추가:

```markdown
**Responsive body base (미토큰화 예외)**

body element font-size는 전체 rem 단위의 앵커 역할을 하므로 토큰 스케일에서 분리.

- 데스크톱 `16px` (L73)
- 태블릿 `≤760px` → `15px` (L3022 부근)
- 좁은 모바일 `≤480px` → `14px` (L3488 부근)

단계적 축소 설계. design-audit `--scope fontSize` 에서 이 3개 라인은 "알려진 예외" 로 간주한다.
```

- [ ] **Step 9.5: §5 브레이크포인트 섹션 수정**

"4개 존재" 및 "두 번 선언된 @media (max-width: 760px)" 관련 부분 수정. 변경 후:

```markdown
4개 존재:

- `@media (max-width: 1180px)` — 메인 워크스페이스 2열 → 1열
- `@media (max-width: 760px)` — 모바일 (iteration 7에서 단일 블록으로 통합. 내부에 Dual-track timeline 전용 규칙 섹션 보존)
- `@media (max-width: 480px)` — 좁은 모바일: shell/panel 패딩·radius 축소, profile icon 48px 축소
- `@media (prefers-reduced-motion: reduce)` — 모션 최소화 (애니메이션/transition 0.01ms, hover lift 차단)
```

- [ ] **Step 9.6: §10 open issue #12, #13, #14 완료 처리**

변경 후:

```markdown
12. ~~**Georgia serif 제목**~~ — **완료** (iteration 7). 6곳 `font-family: Georgia` 선언 제거, Pretendard 단일화. 계층은 weight/size/letter-spacing로 유지.
13. ~~**두 번 선언된 `@media (max-width: 760px)`**~~ — **완료** (iteration 7). Dual-track timeline 전용 블록을 메인 모바일 블록 내부로 병합.
14. ~~**report-badge / rank-badge 배경 alpha 잔여 하드코딩**~~ — **완료** (iteration 7). `--{state}-bg-{weak|soft|medium}` / `--amber-bg-{soft|deep|strong}` 8개 신규 토큰으로 흡수. 0.08↔0.10 consolidation 적용. #ff9c8f 변형과 0.03/0.24/0.32 edge case는 #18로 이관.
```

§10 끝에 후속 이슈 row 하나 추가:

```markdown
18. **#ff9c8f orphan rose 변형 + gradient 페이드아웃(0.03) + 기타 0.24/0.32 edge case** — iteration 7에서 메인 스케일 밖으로 분리. candidate-head LOSS의 lighter rose 색상 자체가 `--rose`와 RGB 다름 → 통일/분리 판단 후 토큰화.
```

- [ ] **Step 9.7: §11 claude.ai 사용 팁 (선택)**

본 이터레이션에서 직접 영향 없음. 스킵 가능.

- [ ] **Step 9.8: Commit 4**

```bash
git add design-tokens.md
git commit -m "$(cat <<'EOF'
docs: update design-tokens.md for iteration 7 closeout

- Add 8 new alpha scale tokens to §1 color table
- Update §2 typography: Pretendard-only, responsive body base
  exception documented
- Simplify §5 breakpoint count to 4 (760px is now one block)
- Close out §10 open issues #12 / #13 / #14
- Log follow-up issue #18 for orphan rose variant and alpha
  edge cases held out of iteration 7

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: README Update (optional, part of Commit 4 or follow-up)

**Files:**

- Modify: `README.md`

- [ ] **Step 10.1: "디자인 시스템 > 최근 UI 정리" 라인 한 줄 추가**

현재 블릿:

```markdown
- **최근 UI 정리**: `--tint-*`, `--shadow-hover`, 결과별 match-summary-card 엣지 바, skeleton/shimmer, 좁은 모바일 대응, reduced-motion 대응
```

변경 후:

```markdown
- **최근 UI 정리** (iter.7): 상태색 알파 토큰 8종(`--mint/rose-bg-*`, `--amber-bg-*`), Georgia 제거, 760px 통합, `--wr` fallback. 그 이전은 `--tint-*`, `--shadow-hover`, match-summary-card 엣지 바, skeleton/shimmer, 좁은 모바일 대응, reduced-motion 대응
```

- [ ] **Step 10.2: Commit (또는 Task 9의 Commit 4에 amend하지 말고 별도 커밋)**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): note iteration 7 token cleanup summary

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

새 커밋으로 분리. amend 금지 (spec §5 원칙).

---

## Task 11: Final Verification

**Files:**

- Create: `test-artifacts/design-audit/post-cleanup.md`

- [ ] **Step 11.1: 변경 후 full audit**

```bash
node scripts/design-audit.js --scope all --format markdown --top 20 --output test-artifacts/design-audit/post-cleanup.md
```

- [ ] **Step 11.2: baseline 대비 diff**

```bash
diff -u test-artifacts/design-audit/baseline-pre-cleanup.md test-artifacts/design-audit/post-cleanup.md | head -80
```

Expected (요약):

- Colors: `Token coverage: 80.5%` → `≥86%` (목표 90%+, 실측 확인)
- Colors raw: `91` → `≤65`
- Radius: 불변
- Spacing: 불변
- Font Size: 불변
- Breakpoints: `max-width: 760px` `x2` → `x1`
- Custom Properties: `--wr` 경고 제거

- [ ] **Step 11.3: QA smoke (Windows 환경만)**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/qa-smoke.ps1
```

`test-artifacts/qa-automation/<latest>/home-*.png` 데스크톱/태블릿/모바일 3종 생성. 직전 세션과 육안 비교.

허용 범위:

- 0.08 → 0.10 consolidation으로 인한 상태 배경의 **≤5% 색상 차이**
- Georgia 제거로 인한 제목 폰트 변화 (한글은 변화 없음, 영문 혼합만 톤 변화)

눈에 띄게 나쁜 regression이 있으면 해당 셀렉터만 토큰 값 재조정 후 추가 커밋.

- [ ] **Step 11.4: Georgia 완전 제거 확인**

```bash
grep -rn "Georgia" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 출력 없음 (exit code 1).

- [ ] **Step 11.5: 서버 기동 + 기본 렌더 확인**

```bash
node server.js &
sleep 2
curl -sSf http://127.0.0.1:8123/ | head -5
```

Expected: `<!DOCTYPE html>` 로 시작하는 HTML 응답. 서버 기동 정상.

끝나면 `kill %1` 로 서버 종료.

---

## Task 12: Close Out

- [ ] **Step 12.1: 커밋 히스토리 확인**

```bash
git log --oneline origin/main..HEAD
```

Expected (4~5 커밋, 순서대로):

1. `feat(tokens): add alpha scale tokens for mint/rose/amber`
2. `refactor(styles): replace raw alpha with state-color tokens`
3. `refactor(styles): drop Georgia, merge 760px, add --wr fallback`
4. `docs: update design-tokens.md for iteration 7 closeout`
5. (optional) `docs(readme): note iteration 7 token cleanup summary`

- [ ] **Step 12.2: git status clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 12.3: 사용자 리뷰 요청**

터미널에 변경 요약을 출력:

- 커밋 수
- audit before/after 요약
- 변경된 셀렉터 수
- 남은 known issue (`#18 #ff9c8f orphan 등`)

사용자의 OK 또는 수정 요청을 대기한다. push 또는 PR 생성은 사용자 지시 이후에만.

---

## Rollback Strategy

각 커밋이 논리 단위로 분리되어 있으므로:

- Task 2~4에서 시각 regression이 발견되면 `git revert <Commit 2 hash>` 로 되돌린 뒤, 문제가 된 셀렉터만 예외 토큰(e.g. `--mint-bg-soft-exact-08`) 별도 추가해 재치환
- Georgia 제거가 영문 제목에서 거부감 있으면 `git revert <Commit 3 hash>` 후, Task 6만 제외하고 다시 커밋 (760px 병합 + `--wr` fallback만 유지)

전체 rollback: `git reset --hard origin/main` — 사용자 확인 필요.
