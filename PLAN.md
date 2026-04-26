# 작업 계획 — 디자인 비평 후속 (Phase 20+)

**기준 문서**: `improved-full.html` 비평 (2026-04-26)
**범위**: 9개 finding을 4개 실행 페이즈로 그룹핑, 우선순위·노력·영향도로 분류

---

## 분류 매트릭스

| # | Finding | 영향도 | 노력 | 우선순위 | 페이즈 |
|---|---|---|---|---|---|
| 1 | 히어로 ↔ 점수 링 시각 경합 | 🔴 High | M | P1 | 21 |
| 2 | trend-callout amber 톤 중복 | 🟡 Med | S | P1 | 21 |
| 3 | 빌드 오더 데스크톱 가로 스크롤 | 🟢 Low | S | P2 | 22 |
| 4 | 사이드바 fetcher 발견성 (`details` 접힘) | 🟡 Med | S | P2 | 22 |
| 5 | 메트릭 카드 위계 명시화 (`.metric--primary` 직접 부여) | 🟢 Low | XS | P2 | 22 |
| 6 | SVG 차트 a11y (title/desc/table fallback) | 🟡 Med | M | P3 | 23 |
| 7 | Score ring 색상 변형 예시 (목업) | 🟢 Low | S | P3 | 23 |
| 8 | Strengths/Weaknesses 아이콘 통일성 (main.js ::before) | 🟢 Low | XS | P3 | 23 |
| 9 | insight-item 중첩 박스 무게감 / 본문 폰트 16px 검토 | 🟡 Med | M | P4 | 24 |

**노력 단위**: XS=10분 / S=30분 / M=1시간 / L=반나절

---

## Phase 21 — 시각 경합 해소 (High-impact 2건 묶음)

### 21a. 히어로와 점수 링 무게 분리

**문제**: 두 개의 강한 시각 요소(amber-mint 듀얼 그라디언트 히어로 + conic-gradient 점수 링)가 같은 시선 무게를 가져 사용자가 어디부터 봐야 할지 0.5초 망설임.

**옵션 A (권장)**: 점수 링을 narrow 변형으로 만들어 메트릭 카드 4개와 같은 행에 5번째 카드로 배치. 링은 64×64로 축소하고 텍스트는 카드 라벨 옆에.

**옵션 B**: 점수 링 크기 유지하되 panel 배경을 약화해 히어로의 amber 그라디언트가 "유일한 특별 영역"이 되도록.

**대상 파일**: `improved-full.html` (목업), 검증 후 `styles.css`

**수용 기준**:
- 히어로 → 메트릭 → (필요시) 점수 → 인사이트 순으로 시선 흐름이 명확
- axe 5/5 PASS 유지
- 점수 링의 정보성(78점)을 잃지 않음

### 21b. trend-callout amber → info 톤 차별화

**문제**: 최근 추세 탭 상단의 callout이 히어로와 동일한 amber 그라디언트를 써서 "또 다른 특별 영역"이 됨. 히어로의 "현재 경기 결과" 시그널이 약화됨.

**해결**: trend-callout 배경을 `linear-gradient(135deg, var(--tint-info), transparent 60%)` + `border-color: var(--info-border)` (`--info` = 푸른 톤)으로 변경. 추세 = 시간 기반 정보라는 의미와 일치.

**대상 파일**: `improved-full.html` 또는 `styles.css` (`.trend-callout` 규칙)

**수용 기준**:
- trend-callout이 히어로와 시각적으로 구분됨
- info 톤 색 대비 본문 배경 기준 ≥ 4.5:1 (이미 9.36:1로 확인됨)

---

## Phase 22 — 사용성 마찰점 정리 (3건 묶음)

### 22a. 빌드 오더 데스크톱 가로 스크롤 제거

**문제**: 6개 빌드 아이템(80px × 6 + gap = ~580px)이 데스크톱에선 한 줄에 들어가는데도 `overflow-x: auto`로 스크롤바가 노출됨.

**해결**: `.build-timeline { flex-wrap: nowrap; overflow-x: visible; }` + 모바일 (<720px) 미디어 쿼리에서만 `overflow-x: auto; flex-wrap: nowrap;` 유지.

**대상**: `_design-mockups/improved-full.html` 인라인 스타일 + 향후 프로덕션 css가 추가되면 동일 적용.

### 22b. 사이드바 fetcher details 발견성

**문제**: "Riot ID로 다시 불러오기"가 `<details>` 안에 접혀 있어 첫 사용자가 발견 어려움.

**해결**: 두 가지 옵션을 평가:
- **A**: 첫 방문 시(localStorage 기반) `<details open>`로 시작
- **B**: summary 옆에 마이크로카피 "(클릭해 펼치기)" 또는 `▾` 아이콘을 항상 보이게 (이미 `::after`로 화살표 있음 — 사이즈/대비 강화 수준)

**권장**: B — 변경 범위가 작고 기존 사용자에게도 도움. `summary::after`의 화살표를 더 명확하게 만들고 hover 시 배경 색 추가.

**대상 파일**: `styles.css` (`details.fetcher > summary::after` 규칙)

### 22c. 메트릭 카드 첫 카드 강조의 명시화

**문제**: 현재는 `.detail-metrics .metric:first-child`로 자동 강조되지만, main.js 렌더 순서가 바뀌면 의도치 않은 카드가 강조될 위험.

**해결**: main.js의 메트릭 렌더 부분에서 KDA·CS 같은 핵심 카드에 `class="metric metric--primary"`를 명시 부여. CSS는 이미 둘 다 지원(`.metric--primary, .metric:first-child`).

**대상 파일**: `main.js` (`renderSnapshot` 또는 stat-ribbon 관련 렌더 함수)

---

## Phase 23 — 접근성 + 일관성 폴리싱 (3건 묶음)

### 23a. SVG KDA 차트 a11y 개선

**문제**: `<svg role="img" aria-label="KDA 변화 그래프">`만 있고 데이터 테이블 fallback 없음. 스크린리더 사용자는 트렌드를 알 수 없음.

**해결**: 두 단계 접근:
- **단계 1**: SVG 안에 `<title>KDA 변화 그래프</title>` + `<desc>0분부터 28분까지 KDA가 0에서 8로 점진 상승, 9분 첫 킬과 16분 더블킬에서 가속</desc>` 추가
- **단계 2** (선택): 시각적으로 숨긴 `<table class="sr-only">`로 시간별 KDA 데이터 제공

**대상 파일**: `_design-mockups/improved-full.html` (목업) + 프로덕션에 SVG 차트 코드가 들어가면 동일 패턴 적용.

### 23b. Score ring 색상 변형 예시 (목업 보강)

**문제**: 현재 목업의 score-overall 링은 항상 mint(78점)로만 표시됨. 실제 main.js는 `barColor()`로 점수에 따라 색이 변하지만, 디자이너가 다른 점수대 시각 검증 불가.

**해결**: `_design-mockups/improved-full.html`에 점수 변형 섹션 추가 — 60점(amber), 45점(rose) 변형 예시를 그림자 박스로 보여주기. 또는 별도 `score-states.html` 파일.

### 23c. Strengths/Weaknesses 아이콘 통일성

**문제**: 목업(`improved-full.html`)에서는 인사이트 헤딩에 `<span aria-hidden="true">✓</span>`를 inline으로 넣고, 프로덕션 `styles.css`에서는 `.panel--strengths .section-heading h3::before { content: "✓ " }`로 자동 prefix. 두 방식 결과는 같지만 일관성 없음.

**해결**: 목업도 ::before 방식으로 통일하거나, 프로덕션 main.js에서 inline 방식을 선택. 권장: ::before 자동 prefix 유지(마크업 깔끔).

**대상**: `_design-mockups/improved-full.html`의 `<h3 id="strengths-title"><span>✓</span>` → `<h3 id="strengths-title">` 로 단순화 (CSS의 ::before가 처리).

---

## Phase 24 — 본문 타이포 / 시각 무게 미세 조정 (1건)

### 24. insight-item 중첩 박스 + 본문 폰트 사이즈 검토

**문제**:
- insight-panel (var(--space-5) padding) > insight-item (var(--space-3) padding + 보더) 중첩이 무겁게 느껴짐
- 본문 `--fs-base: 0.95rem`(15.2px @ 16px root) → 16px(`1rem`)로 올릴지 검토. 한국어는 영문보다 약간 큰 글자가 가독성 좋음.

**해결 (실험적)**:
- 옵션 A: insight-item 보더 제거, 배경만으로 분리(panel 안에서 더 가벼움)
- 옵션 B: `--fs-base`를 1rem으로 올리고 다른 fs 토큰들은 비례 유지 (파급 효과 큼 — 별도 페이즈 권장)

**권장**: 옵션 A만 먼저 진행. 옵션 B는 별도 검증(전체 사이트 시각 변화) 필요해 후속 페이즈로.

**대상 파일**: `styles.css` (`.insight-item` 규칙)

---

## 실행 순서 권장

```
Phase 21 (High-impact)  ──┐
                          ├── 시각 임팩트 → 즉시 개선 체감
Phase 22 (Friction)    ──┘

Phase 23 (Polish a11y) ──┐
                          ├── 후속 마무리, 회귀 위험 낮음
Phase 24 (Typo)        ──┘
```

**총 예상 노력**: P1 1.5h, P2 1h, P3 1.5h, P4 30분 → 합 ~4.5h

---

## 명시적 SKIP / DEFER 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 메트릭 카드 hover/click → 추세 deep-link | DEFER | 인터랙션 폴리싱 — 디자인 비평 범위 밖, 별도 UX 작업 |
| 본문 폰트 16px 전환 | DEFER (Phase 24 옵션 B) | 전체 사이트 영향 큼, A/B 시각 검토 필요 |
| 인사이트 본문에 우선순위(P1/P2/P3) 데이터 필드 | SKIP | 데이터 부재 — 추정 기반은 Phase 16 "근거 N건"으로 충분 |
| admin 미사용 토큰(`--gold`/`--green`) 정리 | DEFER | 리스크 대비 가치 낮음 — alias 시스템이 이미 작동 중 |

---

## 다음 액션

이 계획을 검토 후 결정:
- **A**: P1만 먼저 (가장 임팩트 큰 Phase 21 — 시각 경합 해소 + trend 톤 차별화) → 실행
- **B**: P1 + P2 묶어서 (사용성 마찰점까지 한 번에) → 실행
- **C**: 4개 페이즈 순차 자동 실행 → 시작
- **D**: 계획 자체 수정 (특정 항목 우선순위 조정 / 추가 / 제외)
