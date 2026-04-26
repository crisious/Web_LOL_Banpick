# Champions Tab — Play Champion Analysis Page Design Spec

- **작성일**: 2026-04-27
- **레퍼런스**: op.gg KR 챔피언 탭 (`https://op.gg/ko/lol/summoners/kr/<gameName>-<tagLine>/champions`)
- **예상 기간**: 4~5일 (6-8 커밋)
- **영향 범위**: `index.html`, `main.js` (large), `server.js` (신규 엔드포인트 + SSE), `styles.css`, `README.md`
- **비영향**: `admin.*`, `draft-state.js`, `data/**`, AI 프롬프트

---

## 1. 배경 · 목표

기존 `panel--champion-breakdown`(iter.9)은 최근 20경기 기반 top-5 + footer 1줄로 가벼운 스냅샷을 제공한다. 하지만 op.gg 챔피언 탭이 보여주는 "내가 어떤 챔피언으로 얼마나 잘하는지"의 시즌 단위 그림은 20경기로는 표현이 부족하다 — 챔피언당 1~3경기에 그쳐 통계적 의미가 약하다.

본 이터레이션은 **솔랭/자랭의 가용한 모든 매치 히스토리**를 끝까지 페이지네이션으로 가져와 챔피언별 풀 누적 통계를 보여주는 신규 탭 `tab-champions`를 추가한다. 비싼 작업이라 사용자 명시적 트리거 + 진행률 표시 + localStorage 캐시 + 취소가 필수다.

핵심 결정:

- 풀 히스토리 (브레인스토밍 Q1-C) + 솔랭/자랭만 (Q3-A) + 5번째 탭 (Q2-B)
- 신규 서버 엔드포인트 1개 (`POST /api/champion-history`) — SSE 스트림으로 진행률 보고
- 24시간 localStorage 캐시 (Riot 개발 키 수명과 동기)
- 행 클릭 드릴다운, 큐 필터 토글, 챔피언별 AI 코멘트는 본 MVP 외 (후속)

---

## 2. 범위 · 비범위

### In scope

1. **신규 서버 엔드포인트** — `POST /api/champion-history`, SSE(`text/event-stream`) 응답으로 `progress`/`partial`/`done`/`error` 이벤트 스트리밍
2. **풀 히스토리 사위프 로직** — 솔랭(420) + 자랭(440) `match-v5/ids` 큐별 페이지네이션 (`count=100`, `start` 증가)을 `hasMore=false`까지 반복, 각 매치 detail 페치 후 `summarizeMatch` 적용
3. **Riot API 페이서** — 100req/2min 한도를 자동 준수하는 토큰 버킷 (간단한 sleep 기반)
4. **큐 필터링** — `info.queueId === 420 || 440`만 채택 (이중 안전장치)
5. **챔피언 누적 집계** — 순수 함수 `aggregateChampionHistory(matches)` → `{ totalGames, wrPct, mostPlayed, bestWr, byChampion[] }`
6. **5번째 탭 마크업** — `<button data-tab="tab-champions">챔피언</button>` + `<section id="tab-champions">` 추가
7. **요약 카드 1줄** — 총 경기 / 평균 승률 / 가장 많이 쓴 챔피언 / 가장 잘하는 챔피언 (3경기 이상)
8. **챔피언 표 컴포넌트** — 정렬 가능 (`<th aria-sort>`), 기본 게임수 desc
9. **컬럼 7개** — 챔피언 / 게임수 / 승률 / KDA / CS/min / 데미지/min / 킬관여
10. **진행 상태 UI** — 프로그레스 바 + "100/280 경기" 카운터 + 취소 버튼
11. **localStorage 캐시** — `champion-history:<puuid>` 키, 24시간 TTL, "다시 분석" 버튼으로 강제 무효화
12. **AbortController 취소** — 페치 중간 취소 시 부분 결과 폐기
13. **빈/에러 상태** — 랭크 0판, 부분 실패, rate limit, 네트워크 단절 모두 분기

### Out of scope

- **행 클릭 드릴다운** (챔피언별 매치 목록 모달) — 후속
- **챔피언별 AI 코칭 코멘트** (Claude/Codex 호출) — 후속, 비용 검토 필요
- **큐 토글 UI** (전체/솔/자/일반/ARAM) — 후속, 본 MVP는 솔+자 고정
- **시즌 셀렉터** — 후속
- **포지션 분포 컬럼**, **골드/min**, **시야/min**, **솔로킬**, **아이템 빌드 분포** — 후속
- **계정별 독립 캐시 다중 보존** — 단일 활성 계정만, 계정 전환 시 invalidate
- **서버측 영구 캐시** — localStorage만, 서버는 매번 풀 페치
- **SSE 외 진행률 전송 방식 (WebSocket / 폴링)** — SSE 한 가지로 통일
- **모바일 표 가로 스크롤 외의 대안 (카드 뷰 등)** — 후속

---

## 3. 데이터 흐름

```text
[클라이언트]                        [서버]                        [Riot API]
사용자 [분석 시작] 클릭
  │
  ├─→ POST /api/champion-history ──→ rate limit 체크
  │   { gameName, tagLine, region }   │
  │                                   ├─→ account-v1 by-riot-id ──→ puuid
  │                                   │
  │                                   ├─→ ids?queue=420&start=0&count=100 ──→ 매치 ID 100개
  │  ◀── event: progress              │  (큐별 hasMore=false까지 반복)
  │      { phase: "ids", queueId: 420, count: 100 }
  │                                   │
  │                                   ├─→ ids?queue=440&start=0&count=100 ──→ 매치 ID
  │                                   │
  │                                   ├─→ 각 matchId마다 match-v5/<id>
  │  ◀── event: progress              │  (Riot 100req/2min 한도 자동 페이싱)
  │      { phase: "details", current: 50, total: 280 }
  │                                   │
  │                                   ├─→ summarizeMatch() 적용
  │                                   │
  │  ◀── event: done                  │
  │      { matches: [...summaries], totalGames, fetchedAt }
  │
  ├─→ aggregateChampionHistory(matches)
  ├─→ localStorage[`champion-history:${puuid}`] = { ...stats, fetchedAt }
  └─→ renderChampionTable(stats)
```

**SSE 이벤트 타입** (MVP는 3종, partial 없음):

```text
event: progress      // 페치 진행률
data: { phase: "ids" | "details", current?, total?, queueId? }

event: done          // 정상 완료
data: { matches: [...summaries], totalGames, fetchedAt }

event: error         // 페치 실패 (부분 결과 포함 가능)
data: { error: "...", partial?: [...matches] }
```

**클라이언트 수신 방식**: `fetch(POST) + ReadableStream` + 라인 단위 SSE 파서. 표준 `EventSource`는 GET 전용이라 사용 불가. AbortController로 취소.

---

## 4. UI 구성 (`tab-champions` 패널)

```text
┌─ tab-champions ────────────────────────────────────────────────┐
│ ┌─ 헤더 ─────────────────────────────────────────────────────┐ │
│ │ 솔랭/자랭 280경기 · 마지막 갱신 12분 전        [다시 분석] │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ ┌─ 진행 상태 (페치 중에만) ─────────────────────────────────┐ │
│ │ ▓▓▓▓▓▓▓▓▓░░░░░░ 100/280 경기 분석 중...        [취소]    │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ ┌─ 요약 카드 ────────────────────────────────────────────────┐ │
│ │  총 280경기   |   평균 승률 53.6%   |   가장 많이 쓴 Ahri 47판   |   가장 잘하는 Yasuo 71%(14판)  │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ ┌─ 챔피언 표 ────────────────────────────────────────────────┐ │
│ │ 챔피언   ▼게임수   승률      KDA       CS/min   데미지/min   킬관여 │ │
│ │ Ahri      47       63.8%    3.42      8.1      742          57%    │ │
│ │ Yasuo     14       71.4%    4.05      7.8      812          61%    │ │
│ │ Lux       12       50.0%    2.81      7.2      680          54%    │ │
│ │ ...                                                                  │ │
│ └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**상태 분기**:

| 상태 | UI |
| --- | --- |
| 미진입 | 빈 패널 + "솔랭/자랭 풀 히스토리를 분석합니다 (5~10분 소요)" + [분석 시작] 버튼 |
| 페치 중 | 헤더 + 진행 상태 + 빈 표 |
| 캐시 hit | 헤더(갱신 시각 표시) + 요약 카드 + 표 |
| 캐시 miss + 자동 페치 안 함 | "마지막 갱신: 25시간 전 (만료) — [다시 분석]" |
| 빈 결과 (랭크 0판) | "최근 솔랭/자랭 기록이 없습니다" 안내 |
| 부분 실패 | 부분 결과 표 + "Riot API 응답 N건 실패 — [재시도]" 배너 |
| 네트워크 에러 | "분석 실패: <메시지> — [재시도]" |
| Rate limit (60초) | "60초 후 다시 시도해주세요" 카운트다운 |

---

## 5. 표 컬럼 정의

| # | 컬럼 | 정렬 키 | 표시 형식 | 색 처리 |
| --- | --- |---| --- | --- |
| 1 | 챔피언 | `champion` (사전순) | 아바타 32px + 한글명 | — |
| 2 | 게임수 | `count` | 정수, **기본 정렬 desc** | — |
| 3 | 승률 | `wrPct` | `XX.X%` + 소형 막대 | 50% 미만 rose, 60%+ accent, 그 사이 mint |
| 4 | KDA | `avgKda` | `(K+A)/D` 평균, tabular-nums | 3.0+ accent, 1.0 미만 rose |
| 5 | CS/min | `avgCsPerMin` | 1자리 소수 | — |
| 6 | 데미지/min | `avgDamagePerMin` | 정수 | — |
| 7 | 킬관여 | `avgKp` | `XX%` | — |

- `<th>` 클릭 → 정렬 토글, `aria-sort` 갱신
- 모든 평균은 단순산술평균 (게임 시간으로 가중하지 않음 — Phase 17 패턴 따름)
- 표시 색은 기존 토큰(`--accent`/`--mint`/`--rose`) 재사용, 신규 토큰 도입 0

---

## 6. 서버 변경

### 6.1 신규 엔드포인트

`POST /api/champion-history`

**Request body**:
```json
{ "gameName": "...", "tagLine": "...", "region": "kr" }
```

**Response**: `Content-Type: text/event-stream`

```
event: progress
data: {"phase":"ids","queueId":420,"count":100}

event: progress
data: {"phase":"details","current":50,"total":280}

event: done
data: {"matches":[...],"totalGames":280,"fetchedAt":"2026-04-27T..."}
```

**Rate limit**: `championHistory:<ip>`, 60초 1회 (recent-matches와 별도 버킷)

**구현 단계**:
1. `account-v1` puuid 조회 (기존 헬퍼 재사용)
2. 큐별로 `ids?queue=420&start=0&count=100` → `start` 증가하며 응답 길이 < count까지 반복 (`getAllRankedMatchIds`)
3. 매치 ID 중복 제거(자랭+솔랭 중복은 없을 것이지만 안전)
4. `match-v5/<id>` 각각 페치 — Riot 100req/2min 한도 페이서 적용
5. `summarizeMatch` 적용 후 SSE `done` 이벤트로 일괄 전송 (큰 단일 응답이지만 압축 + 클라이언트는 1회 파싱이라 OK)

**페이서 (간단)**:
```javascript
// 100req / 120sec → 1.2sec 간격
async function pacedFetch(urls, fn) {
  const results = [];
  for (const url of urls) {
    results.push(await fn(url));
    await sleep(1200);
  }
  return results;
}
```
- 추후 토큰 버킷으로 고도화 가능. MVP는 sleep 1.2초로 충분.

### 6.2 `summarizeMatch` 변경

기존 반환 객체에 `killParticipation` 1필드 추가. (이미 player stats엔 계산되어 있으므로 노출만)

### 6.3 영향 없음

- `/api/recent-matches`, `/api/samples`, `/api/generate-sample` 모두 무변경

---

## 7. 클라이언트 변경

### 7.1 index.html

- 탭바 5번째 버튼 추가: `<button id="tab-champions-btn" data-tab="tab-champions" role="tab" ...>챔피언</button>`
- 새 패널 섹션: `<section id="tab-champions" class="tab-page" role="tabpanel" aria-labelledby="tab-champions-btn" tabindex="0" hidden>...</section>`
- 패널 내부:
  - `<header data-champion-history-header>`
  - `<div data-champion-history-progress hidden>` (프로그레스 바 + 카운터 + 취소)
  - `<div data-champion-history-summary>` (요약 카드)
  - `<table data-champion-history-table>` (정렬 가능)
  - `<div data-champion-history-empty>` (빈 상태)

### 7.2 main.js

신규 함수:
- `aggregateChampionHistory(matches) → stats` — 순수 함수
- `fetchChampionHistory({ gameName, tagLine, region, signal, onProgress }) → Promise<matches>` — SSE 클라이언트
- `renderChampionHistory(stats)` — 요약 카드 + 표
- `renderChampionTable(byChampion, sortKey, sortDir)` — 정렬 가능 표
- `loadChampionHistoryFromCache(puuid) → stats | null`
- `saveChampionHistoryToCache(puuid, stats)`
- `initChampionsTab()` — 탭 진입 핸들러, 캐시 우선

탭 진입 정책: **자동 페치 안 함**. 캐시 hit이면 표 렌더, miss면 [분석 시작] 버튼만 노출.

`switchTab` 핸들러에 `tab-champions` 분기 추가.

### 7.3 styles.css

신규 컴포넌트:
- `.champion-table` — 7열 표, 헤더 sticky, hover row tint
- `.champion-table__sort-btn` — 정렬 헤더 버튼 (정렬 표시 화살표)
- `.champion-history-progress` — 프로그레스 바 (`<progress>` 또는 `<div>`)
- `.champion-history-summary` — 4분할 그리드 카드

기존 토큰만 사용. 신규 CSS var 0개. 모바일 (≤480px)에선 표 가로 스크롤 (`overflow-x: auto`) — Phase 6의 `.tab-bar` 패턴과 동일.

### 7.4 design-tokens.md

신규 토큰 추가 없음 → 변경 없음. 단, `.champion-table`을 컴포넌트 목록에 한 줄 추가.

---

## 8. 디자인 불변식 준수

- **§1 DOM 구조 보존**: 기존 4개 탭과 패널 구조는 그대로. 신규 5번째 탭 + 신규 패널만 추가.
- **§2 main.js 셀렉터 보존**: 기존 `data-*` 어떤 것도 변경하지 않음. 신규 `data-champion-history-*` 속성만 도입.
- **CSS 토큰 시스템**: 모든 색·간격·라디우스는 기존 토큰만 사용. 하드코딩 literal 0건 유지.

---

## 9. 에러 핸들링 매트릭스

| 시나리오 | 서버 처리 | 클라이언트 표시 |
| --- | --- | --- |
| Riot account-v1 404 | `event: error` 즉시 종료 | "계정을 찾을 수 없습니다" |
| Riot 429 (rate limit) | sleep 후 재시도 1회, 그래도 실패 시 `event: error` | "Riot API 사용량 초과 — 잠시 후 재시도" |
| Riot 5xx | sleep 후 재시도 1회, 그래도 실패 시 부분 결과 + `event: error { partial }` | 부분 표 + "N건 누락 — [재시도]" |
| 솔랭/자랭 0판 | `event: done { matches: [], totalGames: 0 }` | "솔랭/자랭 기록 없음" 빈 상태 |
| 사용자 취소 (AbortController) | 서버는 클라이언트 disconnect 감지 후 fetch loop 중단 | 페치 UI 닫고 빈 상태 또는 직전 캐시 표시 |
| Network drop | EventSource `error` 이벤트 | "연결 끊김 — [재시도]" |
| 캐시 만료 (24h+) | — | "마지막 갱신 25시간 전 (만료) — [다시 분석]" |
| 캐시 미스 | — | "[분석 시작]" 버튼만 노출 |

---

## 10. 테스트 항목

### 10.1 단위 (수동)

- `aggregateChampionHistory([])` → `{ totalGames: 0, byChampion: [] }`
- `aggregateChampionHistory([1게임 win])` → 챔피언 1행, 승률 100%
- `aggregateChampionHistory([4 win, 1 loss, 같은 챔피언])` → 80%
- `aggregateChampionHistory([100 mixed])` → 정렬·평균 정상

### 10.2 통합

- 캐시 hit 경로: 캐시 채워둔 상태에서 탭 진입 → 즉시 표 렌더, 페치 0건
- 페치 시작 → 진행률 단계별 업데이트 → 완료 시 캐시 저장
- 취소: 100경기 페치 중간 [취소] → 부분 결과 폐기, 패널 비움
- 다시 분석: 캐시 무효화 후 재페치
- 큐 0판 케이스: ARAM만 플레이한 계정 → 빈 상태
- 부분 실패: 250/280 성공, 30건 5xx → 부분 표 + 배너

### 10.3 a11y

- 5번째 탭 ←/→/Home/End 키보드 이동 정상
- 표 헤더 정렬 버튼 → `aria-sort` 갱신, 스크린 리더 안내
- 진행률 바 `<progress>` 또는 `role="progressbar" aria-valuenow`
- 취소 버튼 `aria-label="분석 취소"`
- axe-core 회귀 0

### 10.4 성능

- 280경기 캐시 페이로드 크기 측정 (목표 < 200KB compressed)
- 표 렌더 시간 (목표 < 100ms for 50 rows)
- 페치 총 시간 측정 (참고: 280경기 = 약 5.6분)

---

## 11. 롤아웃 단계

1. **Phase 1: 서버 엔드포인트 + 페이서** — `/api/champion-history` SSE 구현 + 단위 페치 테스트
2. **Phase 2: 클라이언트 SSE 클라이언트 + 캐시** — `fetchChampionHistory` + localStorage
3. **Phase 3: 5번째 탭 + 빈 상태 + [분석 시작] 버튼** — 진입 흐름만, 표는 비워두기
4. **Phase 4: 진행 상태 UI** — 프로그레스 바 + 카운터 + 취소
5. **Phase 5: `aggregateChampionHistory` 함수 + 단위 테스트**
6. **Phase 6: 표 컴포넌트 + 정렬** — `.champion-table` 스타일 + 컬럼 7개
7. **Phase 7: 요약 카드** — 4분할 그리드
8. **Phase 8: 에러/부분 실패/취소 분기**
9. **Phase 9: a11y 검증 + axe 재실행 + README/CHANGELOG 업데이트**

각 Phase는 독립 커밋. 도중 어느 Phase까지 머지해도 회귀 없도록(=새 탭 진입 안 하면 영향 0).

---

## 12. 알려진 위험 / 가정

- **Riot 100req/2min 한도**: 1.2초 간격 sleep으로 단순 준수. 풀 페치 5~10분 동안 사용자가 다른 액션을 해도 서버 작업은 계속 진행 (SSE 끊기지 않음)
- **24시간 만료 dev key**: 풀 페치 도중 만료되면 부분 결과 + 에러. 사용자에게 .env 갱신 안내
- **localStorage 5MB 한도**: 280경기 매치 요약은 압축 시 작지만, 1000경기+면 한도 접근 가능. 우선 raw JSON으로 저장, 향후 필요 시 압축
- **SSE EventSource는 POST 미지원** — `fetch + ReadableStream`으로 구현 (EventSource는 GET만)
- **모바일 표 가로 스크롤** — 7열 좁아 스크롤 거의 필수. 추후 카드 뷰 전환 검토 (out of scope)
- **챔피언 한글 이름**: 기존 `championDisplayName` 매핑이 모든 챔피언 커버하지 않으면 영문 fallback. 누락 챔피언은 후속

---

## 13. 향후 후속 후보

- 행 클릭 → 매치 모달 드릴다운 (해당 챔피언으로 플레이한 모든 경기)
- 챔피언별 AI 코칭 코멘트 (Claude/Codex, 게임수 ≥ 5인 챔피언만)
- 큐 토글 (전체/솔/자/일반/ARAM)
- 시즌 셀렉터
- 비교 모드 (이번달 vs 지난달)
- 챔피언 마스터리 점수 / 레벨 통합
- 상대 라이너 통계 (어떤 챔피언 상대로 강한지)
