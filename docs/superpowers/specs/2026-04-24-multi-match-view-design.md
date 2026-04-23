# Multi-match Cumulative Analysis View — Design Spec

- **Sub-project**: C (of A → B → C 분해)
- **작성일**: 2026-04-24
- **예상 기간**: 5~6일 (6-8 커밋)
- **영향 범위**: `index.html`, `styles.css`, `main.js` (large), `design-tokens.md`, `README.md`
- **비영향**: `server.js` (새 API 없음), `admin.*`, `data/**`, AI 프롬프트

---

## 1. 배경 · 목표

Sub-project A(iter.7)에서 토큰 시스템, B(iter.8)에서 레이아웃을 정리했다. 본 C(iter.9)는 **다중 경기 누적 분석 뷰**를 기존 `tab-trends`에 통합해서 기능적 확장을 더한다.

현재 `tab-trends`는 **저장 샘플만** 사용하는 AI qualitative 요약이다. 저장 샘플은 26+건이지만 대부분 SUPPORT 역할에 편중돼 있고, 실제 플레이 흐름(최근 N경기) 대비 대표성이 떨어질 수 있다.

본 이터레이션은 **저장 샘플 AI(기존) + Riot API 최근 20경기 quantitative(신규)** 하이브리드를 한 탭에 묶어, 사용자가 `자신의 최근 플레이 전반`을 한 눈에 볼 수 있게 한다.

핵심 지표:

- 기존 `panel--trends` (qualitative AI) 상단 유지
- 신규 `panel--recent-aggregate`(최근 20경기 요약) + `panel--champion-breakdown` + `panel--role-breakdown` 중간 삽입
- 기존 `panel--reports` + `panel--evidence` 하단 유지
- tab-trends 첫 진입 시 자동 fetch + 캐시 + 새로고침 버튼
- 서버 변경 없음 — 기존 `/api/recent-matches` 재사용

---

## 2. 범위 · 비범위

### In scope

1. **프론트 집계 로직** — 순수 함수 `aggregateRecentStats(matches)` → `{overall, byChampion, byRole}`
2. **`panel--recent-aggregate`** — 최근 20경기 요약 panel (총 경기, 승/패, 승률 바, 평균 KDA, 평균 CS/분, 평균 게임 시간)
3. **`panel--champion-breakdown`** — 챔피언별 (경기 수 desc, 상위 5종 + "기타 (N)", 승률 바 + 평균 KDA)
4. **`panel--role-breakdown`** — 포지션별 (TOP/JUNGLE/MID/ADC/SUPPORT 최대 5 row, 승률 바 + 평균 KDA)
5. **`data-refresh-stats` 새로고침 버튼** — `state.recentStats = null` 후 재fetch
6. **Lazy fetch** — tab-trends 진입 시 `state.recentStats` 없으면 자동 fetch, 있으면 캐시 사용
7. **skeleton placeholder** — 로딩 중 기존 `.tab-page__skeleton` / `.skeleton--block` 패턴 재사용 (iter.8 유틸)
8. **에러/빈 상태 처리** — rate-limit / fetch fail / empty matches

### Out of scope

- **새 서버 엔드포인트** — 기존 `/api/recent-matches`로 충분
- **신규 AI 크로스-매치 프롬프트** (브레인스토밍 D 옵션) — 비용·시간 부담 큼
- **큐타입·시간대·최근 vs 이전 비교** (B3/B4/B5) — 후속 이터레이션
- **SVG/Canvas 차트** — 프로그레스 바로 충분, 추후 검토
- **계정별 독립 캐시** — 단일 활성 계정 기준, 계정 전환 시 캐시 invalidate
- **50경기 이상 페이징** — 20경기 단일 call만

---

## 3. 데이터 플로우

```text
[사용자가 tab-trends 클릭]
  ↓
[state.recentStats가 있고 같은 계정인가?]
  ├ yes → render*() 즉시 호출 (skeleton 없이 캐시 표시)
  └ no  → showTabSkeleton(target) + fetchRecentStats()
             ↓
          [POST /api/recent-matches {gameName, tagLine, platformRegion, start: 0, matchCount: 20}]
             ↓
          [응답 {matches: [...], hasMore}]
             ↓
          [aggregateRecentStats(matches) → {overall, byChampion, byRole}]
             ↓
          [state.recentStats = aggregates, state.recentStatsAccount = accountKey]
             ↓
          [renderRecentAggregate(), renderChampionBreakdown(), renderRoleBreakdown()]
             ↓
          [hideTabSkeleton()]
```

**캐시 키**: `state.recentStatsAccount = ${gameName}#${tagLine}@${platformRegion}`. 계정 변경 시 `state.recentStats = null`.

**새로고침**: `data-refresh-stats` 클릭 → `state.recentStats = null` → fetchRecentStats().

**Rate-limit**: `/api/recent-matches`는 IP 기반 10초 제한. 재조회 버튼을 쉴 틈 없이 누르면 응답 `429` 또는 서버 에러 — UI에서 "잠시 후 다시 시도" 메시지. 버튼은 fetch 중 disabled.

---

## 4. 컴포넌트 설계

### 4.1 `panel--recent-aggregate`

**DOM**:

```html
<section class="panel panel--recent-aggregate" data-recent-aggregate>
  <div class="panel--recent-aggregate__head">
    <h3>최근 20경기</h3>
    <button type="button" class="refresh-btn" data-refresh-stats aria-label="최근 20경기 다시 불러오기">↻ 새로고침</button>
  </div>
  <div class="recent-aggregate__body">
    <div class="recent-aggregate__record">
      <strong data-overall-wl>14W 6L</strong>
      <span data-overall-wr-text>승률 70%</span>
    </div>
    <div class="wr-bar" data-overall-wr-bar><span class="wr-bar__fill" data-wr-fill></span></div>
    <div class="recent-aggregate__stats">
      <div class="metric"><span class="meta-label">평균 KDA</span><strong data-overall-kda></strong></div>
      <div class="metric"><span class="meta-label">CS/분</span><strong data-overall-cs></strong></div>
      <div class="metric"><span class="meta-label">평균 게임 시간</span><strong data-overall-duration></strong></div>
    </div>
    <p class="muted" data-recent-aggregate-status hidden></p>
  </div>
</section>
```

**Status line** (`data-recent-aggregate-status`): 로딩 / 에러 / 빈 상태 메시지용. 평상시 `hidden`.

**WR bar**: flex container with `--wr-fill-pct: 70%` CSS variable. `.wr-bar__fill` width = var. Mint background (WIN), rose rest (LOSS).

### 4.2 `panel--champion-breakdown`

**DOM**:

```html
<section class="panel panel--champion-breakdown" data-champion-breakdown>
  <h3>챔피언별</h3>
  <ul class="breakdown-list" data-champion-breakdown-list></ul>
  <p class="breakdown-footer muted" data-champion-breakdown-footer hidden></p>
</section>
```

**Row 템플릿** (main.js에서 동적 생성):

```html
<li class="breakdown-row" data-champion="Nami">
  <span class="breakdown-row__icon">${championAvatarMarkup("Nami", "small")}</span>
  <span class="breakdown-row__label">Nami</span>
  <span class="breakdown-row__count">5경기</span>
  <span class="wr-bar breakdown-row__wr">
    <span class="wr-bar__fill" style="--wr-fill-pct: 60%"></span>
  </span>
  <span class="breakdown-row__wr-text">60%</span>
  <span class="breakdown-row__kda">KDA 3.5</span>
  <span class="breakdown-row__cs">CS 8.2</span>
</li>
```

**정렬**: 경기 수 desc, 동률 시 승률 desc. 상위 **5종** 표시. 그 외는 footer "기타 (N챔피언)"로 접기 (footer는 count ≥ 5일 때만 표시).

### 4.3 `panel--role-breakdown`

**DOM**: 동일 구조이지만 챔피언 아이콘 대신 포지션 이니셜 badge.

```html
<section class="panel panel--role-breakdown" data-role-breakdown>
  <h3>포지션별</h3>
  <ul class="breakdown-list" data-role-breakdown-list></ul>
</section>
```

**Row 템플릿**:

```html
<li class="breakdown-row" data-role="SUPPORT">
  <span class="breakdown-row__icon breakdown-row__icon--role">SUP</span>
  <span class="breakdown-row__label">SUPPORT</span>
  <span class="breakdown-row__count">15경기</span>
  <span class="wr-bar breakdown-row__wr"><span class="wr-bar__fill" style="--wr-fill-pct: 73%"></span></span>
  <span class="breakdown-row__wr-text">73%</span>
  <span class="breakdown-row__kda">KDA 3.2</span>
</li>
```

포지션 이니셜: TOP → "TOP", JUNGLE → "JG", MID → "MID", ADC → "ADC", SUPPORT → "SUP". `--amber-bg-deep` 배경.

### 4.4 WR bar 컴포넌트

**CSS**:

```css
.wr-bar {
  position: relative;
  width: 100%;
  max-width: 120px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--rose-bg-soft);
  overflow: hidden;
}

.wr-bar__fill {
  display: block;
  height: 100%;
  width: var(--wr-fill-pct, 0%);
  background: var(--mint);
  transition: width 300ms ease;
}
```

인라인 `style="--wr-fill-pct: 60%"`. 기본 fallback 0%. 모바일에서 `max-width: 100%`로 넓어짐.

### 4.5 tab-trends 최종 순서

```
tab-trends
├─ panel--trends               (기존, saved samples AI)
├─ panel--recent-aggregate     (신규)
├─ panel--champion-breakdown   (신규)
├─ panel--role-breakdown       (신규)
├─ panel--reports              (기존)
└─ panel--evidence             (기존)
```

---

## 5. JS 셀렉터 · 상태 · 함수

### 5.1 신규 `data-*` 속성

- `data-recent-aggregate`, `data-champion-breakdown`, `data-role-breakdown` — 3개 panel 컨테이너
- `data-refresh-stats` — 새로고침 버튼
- `data-overall-wl`, `data-overall-wr-text`, `data-overall-wr-bar`, `data-wr-fill` — 요약 값
- `data-overall-kda`, `data-overall-cs`, `data-overall-duration` — 메트릭 값
- `data-recent-aggregate-status` — 로딩/에러/빈 상태
- `data-champion-breakdown-list`, `data-champion-breakdown-footer` — 챔피언 리스트 컨테이너
- `data-role-breakdown-list` — 포지션 리스트 컨테이너

### 5.2 state 추가

```js
state = {
  // ...existing
  recentStats: null,         // { overall, byChampion, byRole } 또는 null
  recentStatsAccount: null,  // "gameName#tagLine@platform" 캐시 키
  recentStatsLoading: false,
  recentStatsError: null,    // string 또는 null
};
```

### 5.3 신규 함수 (모두 main.js)

| 함수 | 시그니처 | 역할 |
|---|---|---|
| `aggregateRecentStats(matches)` | `Array<Match> → { overall, byChampion, byRole }` | 순수 함수. 테스트 쉬움 |
| `fetchRecentStats()` | `async () → void` | 기존 `fetchRecentMatches` 비슷하게, `/api/recent-matches` 호출 후 집계 |
| `renderRecentAggregate()` | `() → void` | `state.recentStats.overall` 기준 DOM 업데이트 |
| `renderChampionBreakdown()` | `() → void` | top-5 + "기타 (N)" |
| `renderRoleBreakdown()` | `() → void` | 5 roles |
| `renderRecentStatsError(msg)` | `(string) → void` | status line 표시 |
| `renderRecentStatsEmpty()` | `() → void` | 빈 상태 메시지 |

### 5.4 기존 함수 수정

- `switchTab(tabId)` — tabId === "tab-trends" 분기에서 `maybeFetchRecentStats()` 호출 추가
- `initTabSystem()` — 새로고침 버튼 이벤트 바인딩

### 5.5 CS/분 계산

`/api/recent-matches` 응답에 CS/분이 직접 없을 수 있음. 다음 우선순위로 추출:

1. `match.csPerMinute` (존재하면)
2. `match.cs / (match.durationSec / 60)` — cs와 durationSec 둘 다 있을 때
3. `—` fallback

구현 시 첫 fetch에서 응답 필드 실측해 로직 확정. spec에서는 세 단계 fallback chain으로 고정.

---

## 6. 변경 파일

| 파일 | 변경 규모 |
|---|---|
| `index.html` | Medium — tab-trends에 3개 신규 section 추가. 기존 panel 순서 재배치 |
| `styles.css` | Medium — `.panel--recent-aggregate`, `.panel--champion-breakdown`, `.panel--role-breakdown`, `.breakdown-list`, `.breakdown-row`, `.wr-bar`, `.refresh-btn` 스타일. 모바일 wrap 규칙 |
| `main.js` | **Large** — 약 200-280줄 추가 (`aggregateRecentStats`, 4개 renderer, fetchRecentStats, state 초기화, lazy load, error handling) |
| `design-tokens.md` | iter.9 컴포넌트 섹션 + §10 item #20 closeout |
| `README.md` | iter.9 요약 한 줄 |

**비변경**: `server.js`, `admin.*`, `data/**`, API 스펙

---

## 7. 검증 전략

### 7.1 자동

- `node scripts/design-audit.js --scope all` — 토큰 커버리지 ≥ 88.5% 유지 (iter.8 결과)
- `node --check main.js` — 구문 에러 없음

### 7.2 수동 스팟

1. 로그인 → tab-overview 기본 → **tab-trends 클릭** → skeleton → 20경기 fetch → 3개 신규 panel 렌더
2. 새로고침 버튼 → state 클리어 → 재fetch. 연속 클릭 시 disabled 확인
3. 기존 panel--trends / reports / evidence 동작 영향 없음
4. 샘플 전환 → tab-trends의 저장 샘플 AI 섹션은 갱신, recent-aggregate는 같은 계정이면 캐시 유지
5. 계정 전환(재로그인) → state.recentStatsAccount 변경 → 다음 tab-trends 진입 시 재fetch
6. Rate-limit 에러 시나리오 (10초 내 2회 클릭) → status line에 친절한 메시지
7. 최근 경기 없는 계정 → "최근 경기 없음" empty state
8. 모바일 ≤760px → breakdown row 2줄 wrap, WR bar max-width 100%

### 7.3 단위 검증

`aggregateRecentStats` 순수 함수 — 수동 테스트:

```js
// 콘솔에서 실행
const sample = [
  { matchId: "1", champion: "Nami", role: "SUPPORT", result: "WIN", kills: 3, deaths: 1, assists: 10, durationLabel: "30:00", durationSec: 1800, cs: 150, queueType: "솔랭", gameVersion: "16.7" },
  { matchId: "2", champion: "Nami", role: "SUPPORT", result: "LOSS", kills: 2, deaths: 5, assists: 8, durationLabel: "25:00", durationSec: 1500, cs: 120, queueType: "솔랭", gameVersion: "16.7" },
];
aggregateRecentStats(sample);
// 기대 출력:
// {
//   overall: { count: 2, wins: 1, losses: 1, wrPct: 50, avgKda: 2.17, avgCsPerMin: 5.0, avgDurationSec: 1650 },
//   byChampion: [{ champion: "Nami", count: 2, wins: 1, wrPct: 50, avgKda: 2.17, avgCsPerMin: 5.0 }],
//   byRole: [{ role: "SUPPORT", count: 2, wins: 1, wrPct: 50, avgKda: 2.17 }],
// }
```

### 7.4 git diff 리뷰

- 각 커밋이 논리 단위로 분리 (집계 로직 / CSS / 3개 panel 각각 / refresh / docs)
- `grep -rn "data-" index.html main.js` 이전 대비 순증 기대치: +10 이내

---

## 8. 리스크 · 완화

| 리스크 | 완화 |
|---|---|
| Riot 개발 키 24h 만료 | 에러 status 노출. 저장 샘플 섹션은 영향 없음. 사용자가 `.env` 갱신하면 다음 탭 진입 시 재fetch |
| CS/분 필드 부재 | 3단계 fallback chain (§5.5). 구현 시 실측 확인 |
| 최근 경기 < 3경기 | empty state. 챔피언·포지션 breakdown도 해당 숫자로 표시 (1-2경기라도 의미 있게) |
| 20경기 fetch 시간 > 5초 | `/api/recent-matches`는 match-v5 N회 호출이라 느릴 수 있음. skeleton으로 UX 커버, 실제 성능은 서버 최적화 범위 밖 |
| 챔피언 40+개 플레이한 계정 | top-5 + "기타 (35챔피언)" — 스크롤이 길어지지 않음 |
| 탭 skeleton 200ms 최소 보장이 긴 API 응답과 충돌 | `hideTabSkeleton`은 state.recentStats 설정 후 호출. 최소 200ms는 이미 충족 |
| 프론트 집계가 `main.js`를 크게 늘림 | 순수 함수로 분리 (aggregateRecentStats) → 추후 별도 파일 분리 가능. 본 이터레이션에서는 main.js 내부 유지 |

---

## 9. 구현 순서 (커밋 분리, 6-8 커밋)

1. `feat(js): add aggregateRecentStats pure function` — 순수 집계 로직만, 렌더 없음. 콘솔 단위 테스트
2. `feat(styles): add .wr-bar, .breakdown-row, .refresh-btn base styles`
3. `feat(html,js): add panel--recent-aggregate with lazy fetch on tab-trends enter`
4. `feat(html,js): add panel--champion-breakdown with top-5 + "기타" footer`
5. `feat(html,js): add panel--role-breakdown`
6. `feat(js): add refresh button handler + error/empty state rendering`
7. `docs: update design-tokens.md + README for iteration 9`
8. (옵션) `fix` from final review

---

## 10. 성공 기준 (DoD)

- [ ] `aggregateRecentStats` 순수 함수 단위 검증 통과
- [ ] tab-trends 첫 진입 → skeleton → 3개 panel 렌더
- [ ] 재진입 → skeleton 없이 즉시 (iter.8 renderedOnce 메커니즘 상호작용)
- [ ] 새로고침 버튼 → 재fetch + 버튼 disabled
- [ ] 계정 전환 시 캐시 invalidate
- [ ] empty / rate-limit / fetch error 모두 친절한 메시지
- [ ] 모바일 ≤760px wrap 동작
- [ ] design-audit coverage ≥ 88.5%
- [ ] `grep -rn "data-" index.html main.js` 순증 ≤ 15
- [ ] 기존 panel--trends/reports/evidence 동작 무회귀
- [ ] 6~8 커밋 분리

---

## 11. 후속 이터레이션으로 이관

본 sub-project C 스코프 밖:

- **큐타입·시간대·최근 vs 이전 비교** (브레인스토밍 B3/B4/B5)
- **AI 크로스-매치 프롬프트** (브레인스토밍 D) — 새 서버 엔드포인트 + 프롬프트 설계
- **SVG/Canvas 차트** (브레인스토밍 C2/C3)
- **50경기 이상 페이징**
- **챔피언 클릭 시 해당 저장 샘플로 점프** (qualitative ↔ quantitative 연결)
- **계정별 독립 캐시** (여러 계정 빠른 전환 시나리오)

---

## 12. 참고

- [Sub-project A spec/plan](./2026-04-23-token-cleanup-design.md) · [plan](../plans/2026-04-23-token-cleanup.md)
- [Sub-project B spec/plan](./2026-04-24-layout-redesign-design.md) · [plan](../plans/2026-04-24-layout-redesign.md)
- [design-tokens.md](../../../design-tokens.md)
- [progress.md](../../../progress.md) "다음 추천 작업 #1" 해결
- `server.js` L2155 — 기존 `/api/recent-matches` 핸들러 (no change)
- `main.js` `renderTrendPanel` L813 — 기존 저장 샘플 트렌드 (no change)
