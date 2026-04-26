# Champions Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5번째 탭 `tab-champions`를 추가해서 현재 시즌(S16) 솔랭+자랭 풀 히스토리를 페치하고 챔피언별 누적 통계(7컬럼 정렬 가능 표 + 요약 카드 + 진행률 + 취소)를 보여준다.

**Architecture:** 신규 서버 SSE 엔드포인트 `POST /api/champion-history`(1.2초 페이서로 Riot 100req/2min 한도 준수) + 클라이언트 `fetch+ReadableStream` SSE 파서 + localStorage 24h 캐시. 기존 탭/패널/CSS 토큰 시스템 그대로 재사용, `index.html` 구조와 `main.js` 셀렉터 보존.

**Tech Stack:** Node.js std-lib only (`http`, `https`), Vanilla JS (no framework), CSS Custom Properties (기존 토큰), Server-Sent Events.

**Spec:** [../specs/2026-04-27-champions-tab-design.md](../specs/2026-04-27-champions-tab-design.md)

---

## File Structure

**변경 파일 (5)**

- **Modify** `server.js` — `SEASON_START_EPOCH` 상수, `pacedFetch`/`writeSseEvent` 헬퍼, `summarizeMatch`에 `killParticipation` 노출, `handleChampionHistory` 함수, 라우트 + rate limit
- **Modify** `index.html` — 탭바에 `tab-champions-btn` 추가, 새 `<section id="tab-champions">` 패널 마크업 (header / progress / summary / table / empty 5블록)
- **Modify** `main.js` — DOM 핸들 5종, `aggregateChampionHistory` 순수 함수, `fetchChampionHistory` SSE 클라이언트, 캐시 헬퍼 2종, 렌더 함수 3종, `switchTab` 분기
- **Modify** `styles.css` — `.champion-table`, `.champion-history-progress`, `.champion-history-summary`, `.champion-history-empty` 컴포넌트 (기존 토큰만 사용)
- **Modify** `README.md` — "주요 기능" + "주요 파일" 트리 + "최근 UI 정리"에 한 줄 추가

**생성 파일 (1)**

- **Create** `test-artifacts/champions-tab/aggregate-tests.mjs` — `aggregateChampionHistory` 순수 함수 단위 테스트 (Node 단독 실행)

**참조만 (변경 없음)**

- `draft-state.js`, `admin.*`, `scripts/*`, `data/**`, AI 프롬프트, design-tokens.md (신규 토큰 0)

---

## Phase 1 — 서버 엔드포인트

### Task 1.1: 시즌 상수 + ID 사위프 + SSE 헬퍼

**Files:**

- Modify: [`server.js`](../../../server.js) — 새 상수 + 헬퍼 함수 3개 추가 (rate limit 블록 직후, ~line 25)

- [ ] **Step 1: 시즌 상수 추가**

`server.js`의 `port` 라인 직후(line ~12)에 추가:

```javascript
// Champions tab: Riot match-v5/ids?startTime 필터용 시즌 시작 epoch.
// S16 split 1 시작 시각 (Riot 패치노트 기준). 시즌 갱신 시 1회 업데이트.
const SEASON_START_EPOCH = Date.UTC(2026, 0, 9) / 1000;
```

- [ ] **Step 2: sleep 헬퍼 추가**

`requestJson` 함수 바로 위 (line ~1668)에 추가:

```javascript
// Riot 한도 100req/2min → 1.2초 간격 sleep. handleChampionHistory의 매치 페치 루프에서 사용.
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
```

- [ ] **Step 3: SSE writer 헬퍼 추가**

`pacedFetch` 직후에 추가:

```javascript
function writeSseHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
}

function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

- [ ] **Step 4: ID 사위프 헬퍼 추가**

`writeSseEvent` 직후에 추가:

```javascript
async function getCurrentSeasonRankedMatchIds(cluster, headers, puuid, queueId, onProgress) {
  const ids = [];
  let start = 0;
  const count = 100;
  while (true) {
    const url = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=${queueId}&startTime=${SEASON_START_EPOCH}&start=${start}&count=${count}`;
    const batch = await requestJson(url, headers);
    if (!Array.isArray(batch) || batch.length === 0) break;
    ids.push(...batch);
    if (typeof onProgress === "function") onProgress({ queueId, fetched: ids.length });
    if (batch.length < count) break;
    start += count;
    await sleep(1200);
  }
  return ids;
}
```

- [ ] **Step 5: Syntax check**

```bash
node --check server.js
```

Expected: no output (success).

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "feat(server): add season constant, paced fetch, SSE writer, ranked id sweep"
```

---

### Task 1.2: handleChampionHistory + 라우트

**Files:**

- Modify: [`server.js`](../../../server.js) — `summarizeMatch`에 `killParticipation` 추가, `handleChampionHistory` 함수 신규, 라우트 등록

- [ ] **Step 1: summarizeMatch에 killParticipation 노출**

`server.js` line ~1843 (현 `summarizeMatch` body) — `summary` 객체에 다음 두 줄 추가:

```javascript
  const teamTotalKills = match.info.participants
    .filter((p) => p.teamId === participant.teamId)
    .reduce((sum, p) => sum + (p.kills || 0), 0);

  const summary = {
    matchId: match.metadata.matchId,
    queueId: match.info.queueId,
    queueLabel: queueLabel(match.info.queueId),
    durationSeconds: dur,
    durationLabel: durationLabel(dur),
    gameVersion: match.info.gameVersion,
    champion: participant.championName,
    role,
    result: participant.win ? "WIN" : "LOSS",
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    csPerMin: +(cs / (dur / 60)).toFixed(1),
    visionScore: participant.visionScore || 0,
    goldEarned: participant.goldEarned || 0,
    damageToChampions: participant.totalDamageDealtToChampions || 0,
    killParticipation: +(((participant.kills + participant.assists) / Math.max(1, teamTotalKills))).toFixed(2),
    timestamp: match.info.gameCreation,
    items: [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5, participant.item6],
    summonerSpells: [participant.summoner1Id, participant.summoner2Id],
  };
```

(기존 `summary` 객체 통째로 교체 — `teamTotalKills` 계산과 `killParticipation` 한 줄만 추가됨)

- [ ] **Step 2: handleChampionHistory 함수 추가**

`server.js`의 `handleRecentMatches` 직후(line ~2000 부근, 함수 끝나는 자리)에 추가:

```javascript
async function handleChampionHistory(req, res) {
  const ip = req.socket.remoteAddress || "unknown";
  if (!rateLimit(`championHistory:${ip}`, 60000)) {
    sendJson(res, 429, { ok: false, error: "60초 후 다시 시도해주세요." });
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || "invalid body" });
    return;
  }

  const apiKey = resolveApiKey(body.riotApiKey);
  if (!apiKey) {
    sendJson(res, 500, { ok: false, error: "Riot API Key가 없습니다." });
    return;
  }

  const gameName = String(body.gameName || "").trim();
  const tagLine = String(body.tagLine || "").trim();
  const platformRegion = String(body.platformRegion || "KR").trim().toUpperCase();
  if (!gameName || !tagLine) {
    sendJson(res, 400, { ok: false, error: "gameName and tagLine are required." });
    return;
  }
  const riotIdError = validateRiotId(gameName, tagLine);
  if (riotIdError) {
    sendJson(res, 400, { ok: false, error: riotIdError });
    return;
  }

  const cluster = regionalCluster(platformRegion);
  const headers = {
    "X-Riot-Token": apiKey,
    "User-Agent": "codex-local-sample-server",
    Accept: "application/json",
  };

  writeSseHeaders(res);
  let aborted = false;
  req.on("close", () => { aborted = true; });

  try {
    const account = await requestJson(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      headers,
    );
    if (aborted) { res.end(); return; }
    writeSseEvent(res, "progress", { phase: "account", puuid: account.puuid });

    const queueIds = [420, 440];
    const allIds = [];
    for (const queueId of queueIds) {
      if (aborted) { res.end(); return; }
      const ids = await getCurrentSeasonRankedMatchIds(cluster, headers, account.puuid, queueId, (info) => {
        writeSseEvent(res, "progress", { phase: "ids", queueId, fetched: info.fetched });
      });
      allIds.push(...ids);
    }
    const uniqueIds = Array.from(new Set(allIds));
    writeSseEvent(res, "progress", { phase: "ids-done", total: uniqueIds.length });

    const matches = [];
    for (let i = 0; i < uniqueIds.length; i += 1) {
      if (aborted) { res.end(); return; }
      const id = uniqueIds[i];
      try {
        const match = await requestJson(
          `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(id)}`,
          headers,
        );
        const summary = summarizeMatch(match, account.puuid);
        if (summary && (summary.queueId === 420 || summary.queueId === 440)) {
          matches.push(summary);
        }
      } catch (error) {
        // 개별 매치 실패는 부분 누락으로 처리, 전체 중단하지 않음
        writeSseEvent(res, "progress", { phase: "match-error", matchId: id, message: error.message });
      }
      writeSseEvent(res, "progress", { phase: "details", current: i + 1, total: uniqueIds.length });
      if (i < uniqueIds.length - 1) await sleep(1200);
    }

    writeSseEvent(res, "done", {
      matches,
      totalGames: matches.length,
      fetchedAt: new Date().toISOString(),
    });
    res.end();
  } catch (error) {
    writeSseEvent(res, "error", { error: error.message || String(error) });
    res.end();
  }
}
```

- [ ] **Step 3: 라우트 등록**

`server.js`의 라우팅 블록 — `handleRecentMatches` 라우트 직후 (line ~2155)에 추가:

```javascript
  if (req.method === "POST" && url.pathname === "/api/champion-history") {
    handleChampionHistory(req, res);
    return;
  }
```

- [ ] **Step 4: Syntax check**

```bash
node --check server.js
```

Expected: no output.

- [ ] **Step 5: Smoke test (서버만 띄우고 SSE 헤더 확인 — 실제 페치 X)**

```bash
PORT=8201 node server.js > /tmp/srv-ch.log 2>&1 &
SRV=$!
sleep 1
curl -sN -X POST http://127.0.0.1:8201/api/champion-history \
  -H "Content-Type: application/json" \
  -d '{"gameName":"","tagLine":"","platformRegion":"KR"}' | head -3
kill $SRV 2>/dev/null
```

Expected: `{"ok":false,"error":"gameName and tagLine are required."}` (validation works).

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "feat(server): add /api/champion-history SSE endpoint + killParticipation"
```

---

## Phase 2 — 클라이언트 SSE 클라이언트 + 캐시

### Task 2.1: fetchChampionHistory + 캐시 헬퍼

**Files:**

- Modify: [`main.js`](../../../main.js) — 새 상수 + 함수 3개 추가 (`aggregateRecentStats` 함수 직전 ~line 925)

- [ ] **Step 1: 캐시 키 + TTL 상수**

`main.js`의 `compactPatchLabel` 함수 직전(line ~370)에 추가:

```javascript
const CHAMPION_HISTORY_CACHE_PREFIX = "lol-coach-champion-history";
const CHAMPION_HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
```

- [ ] **Step 2: 캐시 헬퍼 추가 (같은 위치)**

```javascript
function loadChampionHistoryFromCache(puuid) {
  if (!puuid) return null;
  try {
    const raw = localStorage.getItem(`${CHAMPION_HISTORY_CACHE_PREFIX}:${puuid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.fetchedAt) return null;
    const age = Date.now() - new Date(parsed.fetchedAt).getTime();
    if (!Number.isFinite(age) || age > CHAMPION_HISTORY_CACHE_TTL_MS) {
      return { ...parsed, expired: true };
    }
    return { ...parsed, expired: false };
  } catch {
    return null;
  }
}

function saveChampionHistoryToCache(puuid, payload) {
  if (!puuid || !payload) return;
  try {
    localStorage.setItem(`${CHAMPION_HISTORY_CACHE_PREFIX}:${puuid}`, JSON.stringify(payload));
  } catch {
    // localStorage quota / private mode — 캐시 실패는 무시 (다음 페치는 정상 동작)
  }
}
```

- [ ] **Step 3: SSE 라인 파서 + fetchChampionHistory**

같은 위치에 추가:

```javascript
async function fetchChampionHistory({ gameName, tagLine, platformRegion, riotApiKey, signal, onProgress }) {
  const response = await fetch("/api/champion-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameName, tagLine, platformRegion, riotApiKey }),
    signal,
  });

  if (!response.ok) {
    let errorBody = "";
    try { errorBody = (await response.json()).error || ""; } catch {}
    throw new Error(errorBody || `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const lines = block.split("\n");
      let event = "";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (!event) continue;
      let payload = null;
      try { payload = data ? JSON.parse(data) : null; } catch { payload = { error: "invalid json" }; }
      if (event === "progress" && typeof onProgress === "function") onProgress(payload);
      else if (event === "done") result = payload;
      else if (event === "error") throw new Error(payload?.error || "fetch failed");
    }
  }

  if (!result) throw new Error("스트림이 done 이벤트 없이 종료됨");
  return result;
}
```

- [ ] **Step 4: Syntax check**

```bash
node --check main.js
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "feat(js): add fetchChampionHistory SSE client + 24h localStorage cache"
```

---

## Phase 3 — 5번째 탭 골격 + 빈 상태

### Task 3.1: index.html / main.js / styles.css 골격

**Files:**

- Modify: [`index.html`](../../../index.html) — 탭 버튼 + 패널 마크업
- Modify: [`main.js`](../../../main.js) — DOM 핸들, `initChampionsTab`, `switchTab` 분기
- Modify: [`styles.css`](../../../styles.css) — 패널/빈 상태 base

- [ ] **Step 1: 탭 버튼 추가**

[`index.html`](../../../index.html) 의 `<div class="tab-bar">` 블록(line ~111-116)에 4번째 버튼 직후 추가:

```html
            <button id="tab-champions-btn" class="tab-btn" data-tab="tab-champions" role="tab" aria-selected="false" aria-controls="tab-champions" tabindex="-1">챔피언</button>
```

- [ ] **Step 2: 패널 섹션 추가**

`tab-trends` 탭 페이지 마무리 닫는 `</div>` 직후에 새 섹션 삽입 (정확한 줄은 `tab-trends` 패널이 끝나는 곳):

```html
          <!-- TAB: 챔피언 -->
          <div class="tab-page" id="tab-champions" role="tabpanel" aria-labelledby="tab-champions-btn" tabindex="0" hidden>
            <section class="panel panel--champions" data-champion-history aria-labelledby="champion-history-title">
              <header class="panel--champions__head">
                <h2 id="champion-history-title">챔피언별 시즌 분석</h2>
                <p class="panel--champions__meta muted" data-champion-history-meta>현재 시즌 솔랭/자랭 (1~3분 소요)</p>
                <button type="button" class="btn btn--secondary" data-champion-history-action>분석 시작</button>
              </header>
              <div class="champion-history-progress" data-champion-history-progress hidden>
                <div class="champion-history-progress__row">
                  <span data-champion-history-progress-label>대기 중…</span>
                  <button type="button" class="btn btn--ghost" data-champion-history-cancel>취소</button>
                </div>
                <progress class="champion-history-progress__bar" data-champion-history-progress-bar value="0" max="100"></progress>
              </div>
              <div class="champion-history-summary" data-champion-history-summary hidden></div>
              <div class="champion-history-empty" data-champion-history-empty>
                <p>아직 분석을 실행하지 않았습니다. 위의 [분석 시작]을 눌러주세요.</p>
              </div>
              <div class="champion-history-table-wrap" data-champion-history-table-wrap hidden>
                <table class="champion-table" data-champion-history-table>
                  <thead></thead>
                  <tbody></tbody>
                </table>
              </div>
            </section>
          </div>
```

- [ ] **Step 3: DOM 핸들 추가**

[`main.js`](../../../main.js) 의 `dom = {...}` 객체(line ~10) 끝에 추가 (예: `championBreakdown` 라인 근처):

```javascript
  championHistoryPanel: document.querySelector("[data-champion-history]"),
  championHistoryMeta: document.querySelector("[data-champion-history-meta]"),
  championHistoryAction: document.querySelector("[data-champion-history-action]"),
  championHistoryProgress: document.querySelector("[data-champion-history-progress]"),
  championHistoryProgressLabel: document.querySelector("[data-champion-history-progress-label]"),
  championHistoryProgressBar: document.querySelector("[data-champion-history-progress-bar]"),
  championHistoryCancel: document.querySelector("[data-champion-history-cancel]"),
  championHistorySummary: document.querySelector("[data-champion-history-summary]"),
  championHistoryEmpty: document.querySelector("[data-champion-history-empty]"),
  championHistoryTableWrap: document.querySelector("[data-champion-history-table-wrap]"),
  championHistoryTable: document.querySelector("[data-champion-history-table]"),
```

- [ ] **Step 4: state + initChampionsTab 함수**

`main.js`의 `state = { ... }` 블록에 추가 (state 선언부 근처):

```javascript
state.championHistory = null;     // { matches, totalGames, fetchedAt, expired, matchErrors }
state.championHistoryAccount = null;  // currentAccountKey() snapshot — invalidate시 비교
state.championHistoryLoading = false;
state.championHistoryAbort = null;
state.championHistorySort = { key: "count", dir: "desc" };
```

`main.js` 끝부분의 init 함수 근처(예: `initTabSystem` 직후)에 새 함수:

```javascript
function initChampionsTab() {
  if (!dom.championHistoryAction) return;
  dom.championHistoryAction.addEventListener("click", () => startChampionHistoryFetch(false));
  dom.championHistoryCancel?.addEventListener("click", () => {
    state.championHistoryAbort?.abort();
  });
}

function onChampionsTabEnter() {
  // 탭 진입 시 캐시 우선, 없으면 빈 상태 유지 (자동 페치 X)
  if (state.championHistory) {
    renderChampionHistory();
    return;
  }
  const puuid = state.account?.puuid;
  if (!puuid) {
    setChampionHistoryEmpty("먼저 Riot ID로 로그인해주세요.");
    return;
  }
  const cached = loadChampionHistoryFromCache(puuid);
  if (cached) {
    state.championHistory = cached;
    renderChampionHistory();
  } else {
    setChampionHistoryEmpty("아직 분석을 실행하지 않았습니다. 위의 [분석 시작]을 눌러주세요.");
  }
}

function setChampionHistoryEmpty(message) {
  if (dom.championHistoryEmpty) {
    dom.championHistoryEmpty.querySelector("p").textContent = message;
    dom.championHistoryEmpty.hidden = false;
  }
  if (dom.championHistorySummary) dom.championHistorySummary.hidden = true;
  if (dom.championHistoryTableWrap) dom.championHistoryTableWrap.hidden = true;
}

async function startChampionHistoryFetch(force) {
  // Phase 8에서 채움 - Phase 3에서는 placeholder
  console.log("startChampionHistoryFetch", { force });
}

function renderChampionHistory() {
  // Phase 6/7에서 채움
  if (dom.championHistoryEmpty) dom.championHistoryEmpty.hidden = true;
}
```

- [ ] **Step 5: switchTab 분기 추가**

`switchTab` 함수(line ~3320) — 탭별 진입 핸들러를 부르는 분기에:

```javascript
  if (tabId === "tab-champions") onChampionsTabEnter();
```

(다른 `if (tabId === ...)` 분기 옆에 동일 패턴으로 추가. 정확한 위치는 `switchTab` 본체 끝부분 = focus 이동 직전.)

- [ ] **Step 6: initChampionsTab 호출 등록**

`main.js`의 `initTabSystem()` 호출하는 부트스트랩 블록(파일 하단 `init();` 또는 동등한 진입점)에 한 줄 추가:

```javascript
initChampionsTab();
```

(기존 `initTabSystem()` 호출 바로 아래.)

- [ ] **Step 7: CSS base 추가**

[`styles.css`](../../../styles.css) — 파일 하단의 적절한 섹션(예: `.panel--champion-breakdown` 근처)에 추가:

```css
.panel--champions { display: flex; flex-direction: column; gap: var(--space-4); }
.panel--champions__head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
.panel--champions__head h2 { margin: 0; font-size: var(--fs-xl); }
.panel--champions__meta { margin: 0; flex: 1; }

.champion-history-empty {
  padding: var(--space-5);
  text-align: center;
  color: var(--text-muted);
  background: var(--surface-1);
  border-radius: var(--radius-md);
}
```

- [ ] **Step 8: Manual smoke**

```bash
PORT=8202 node server.js > /tmp/srv-tab.log 2>&1 &
SRV=$!
sleep 1
curl -sS -o /dev/null -w "GET / -> %{http_code}\n" http://127.0.0.1:8202/
kill $SRV 2>/dev/null
node --check main.js && node --check server.js && echo "syntax OK"
```

브라우저로 `http://127.0.0.1:8202` 열어 5번째 탭 [챔피언] 클릭 → 빈 상태 + [분석 시작] 버튼 보임 확인.

- [ ] **Step 9: Commit**

```bash
git add index.html main.js styles.css
git commit -m "feat(html,js,styles): add 5th tab champions + empty state skeleton"
```

---

## Phase 4 — 진행 상태 UI

### Task 4.1: progress 바 + 카운터

**Files:**

- Modify: [`main.js`](../../../main.js) — `startChampionHistoryFetch` 채움, `onProgress` 콜백 → DOM
- Modify: [`styles.css`](../../../styles.css) — `.champion-history-progress` 스타일

- [ ] **Step 1: startChampionHistoryFetch 본체 작성**

`main.js`에서 Phase 3의 placeholder를 다음으로 교체:

```javascript
async function startChampionHistoryFetch(force) {
  if (state.championHistoryLoading) return;
  if (!state.account) {
    setChampionHistoryEmpty("먼저 Riot ID로 로그인해주세요.");
    return;
  }

  const puuid = state.account.puuid;
  if (!force) {
    const cached = loadChampionHistoryFromCache(puuid);
    if (cached && !cached.expired) {
      state.championHistory = cached;
      renderChampionHistory();
      return;
    }
  }

  state.championHistoryLoading = true;
  state.championHistoryAbort = new AbortController();
  showChampionHistoryProgress("계정 조회 중…", 0, 0);
  if (dom.championHistoryAction) dom.championHistoryAction.disabled = true;
  if (dom.championHistoryEmpty) dom.championHistoryEmpty.hidden = true;

  try {
    const result = await fetchChampionHistory({
      gameName: state.account.gameName,
      tagLine: state.account.tagLine,
      platformRegion: state.account.platformRegion,
      riotApiKey: state.account.riotApiKey || undefined,
      signal: state.championHistoryAbort.signal,
      onProgress: (info) => updateChampionHistoryProgress(info),
    });

    state.championHistory = { ...result, expired: false };
    saveChampionHistoryToCache(puuid, state.championHistory);
    renderChampionHistory();
  } catch (error) {
    if (error.name === "AbortError") {
      setChampionHistoryEmpty("분석이 취소되었습니다.");
    } else {
      setChampionHistoryEmpty(`분석 실패: ${error.message}`);
    }
  } finally {
    state.championHistoryLoading = false;
    state.championHistoryAbort = null;
    hideChampionHistoryProgress();
    if (dom.championHistoryAction) dom.championHistoryAction.disabled = false;
  }
}
```

- [ ] **Step 2: 진행 UI 헬퍼 추가**

`startChampionHistoryFetch` 직후에:

```javascript
function showChampionHistoryProgress(label, current, total) {
  if (!dom.championHistoryProgress) return;
  dom.championHistoryProgress.hidden = false;
  if (dom.championHistoryProgressLabel) {
    dom.championHistoryProgressLabel.textContent = total > 0
      ? `${label} (${current}/${total})`
      : label;
  }
  if (dom.championHistoryProgressBar) {
    if (total > 0) {
      dom.championHistoryProgressBar.value = current;
      dom.championHistoryProgressBar.max = total;
    } else {
      dom.championHistoryProgressBar.removeAttribute("value");
    }
  }
}

function hideChampionHistoryProgress() {
  if (dom.championHistoryProgress) dom.championHistoryProgress.hidden = true;
}

function updateChampionHistoryProgress(info) {
  if (!info || !info.phase) return;
  if (info.phase === "account") {
    showChampionHistoryProgress("매치 ID 조회 중…", 0, 0);
  } else if (info.phase === "ids") {
    showChampionHistoryProgress(`매치 ID 수집 중 (큐 ${info.queueId})`, info.fetched, 0);
  } else if (info.phase === "ids-done") {
    showChampionHistoryProgress("매치 상세 분석 중", 0, info.total);
  } else if (info.phase === "details") {
    showChampionHistoryProgress("매치 상세 분석 중", info.current, info.total);
  } else if (info.phase === "match-error") {
    // 부분 실패는 침묵 — 마지막에 매치 누락 N건으로 표기
  }
}
```

- [ ] **Step 3: progress CSS**

[`styles.css`](../../../styles.css) `.champion-history-empty` 직후에 추가:

```css
.champion-history-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--surface-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-2);
}
.champion-history-progress__row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
.champion-history-progress__bar { width: 100%; height: 8px; }
.champion-history-progress__bar::-webkit-progress-bar { background: var(--surface-2); border-radius: var(--radius-pill); }
.champion-history-progress__bar::-webkit-progress-value { background: var(--accent); border-radius: var(--radius-pill); }
.champion-history-progress__bar::-moz-progress-bar { background: var(--accent); border-radius: var(--radius-pill); }
```

- [ ] **Step 4: Manual smoke (브라우저)**

서버 켜고 [분석 시작] 클릭 → 진행 바와 카운터가 갱신되는지 확인. 단 실제 페치는 1~3분 걸림. 짧게 보려면 [취소] 클릭.

- [ ] **Step 5: Syntax check**

```bash
node --check main.js && echo "OK"
```

- [ ] **Step 6: Commit**

```bash
git add main.js styles.css
git commit -m "feat(js,styles): wire SSE progress events to UI + cancel via AbortController"
```

---

## Phase 5 — aggregateChampionHistory 순수 함수 + 단위 테스트

### Task 5.1: 집계 함수 + Node 테스트

**Files:**

- Modify: [`main.js`](../../../main.js) — `aggregateChampionHistory` 함수 추가
- Create: `test-artifacts/champions-tab/aggregate-tests.mjs`

- [ ] **Step 1: aggregateChampionHistory 추가**

[`main.js`](../../../main.js) 의 `aggregateRecentStats` 함수 직후 (~line 1080)에 추가:

```javascript
function aggregateChampionHistory(matches) {
  const safe = Array.isArray(matches) ? matches : [];
  const championMap = new Map();
  let totalWins = 0;
  let totalLosses = 0;

  for (const m of safe) {
    if (m.result === "WIN") totalWins += 1;
    else if (m.result === "LOSS") totalLosses += 1;

    const key = m.champion || "Unknown";
    if (!championMap.has(key)) {
      championMap.set(key, {
        champion: key,
        count: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        csPerMinSum: 0,
        dmgPerMinSum: 0,
        dmgPerMinCount: 0,
        kpSum: 0,
      });
    }
    const c = championMap.get(key);
    c.count += 1;
    if (m.result === "WIN") c.wins += 1;
    c.kills += m.kills || 0;
    c.deaths += m.deaths || 0;
    c.assists += m.assists || 0;
    c.csPerMinSum += Number(m.csPerMin) || 0;
    const durSec = Number(m.durationSeconds) || 0;
    const dmg = Number(m.damageToChampions) || 0;
    if (durSec > 0 && dmg > 0) {
      c.dmgPerMinSum += dmg / (durSec / 60);
      c.dmgPerMinCount += 1;
    }
    c.kpSum += Number(m.killParticipation) || 0;
  }

  const totalGames = safe.length;
  const decided = totalWins + totalLosses;
  const wrPct = decided > 0 ? Math.round((totalWins / decided) * 100) : 0;

  const byChampion = Array.from(championMap.values()).map((c) => ({
    champion: c.champion,
    count: c.count,
    wins: c.wins,
    wrPct: c.count > 0 ? +(c.wins / c.count * 100).toFixed(1) : 0,
    avgKda: computeKdaRatio(c.kills, c.deaths, c.assists),
    avgCsPerMin: c.count > 0 ? +(c.csPerMinSum / c.count).toFixed(1) : 0,
    avgDamagePerMin: c.dmgPerMinCount > 0 ? Math.round(c.dmgPerMinSum / c.dmgPerMinCount) : 0,
    avgKp: c.count > 0 ? Math.round(c.kpSum / c.count * 100) : 0,
  }));

  // 모스트 / 베스트 (3경기 이상만 베스트 후보)
  const mostPlayed = byChampion.slice().sort((a, b) => b.count - a.count)[0] || null;
  const bestWr = byChampion.filter((c) => c.count >= 3).sort((a, b) => b.wrPct - a.wrPct || b.count - a.count)[0] || null;

  return {
    totalGames,
    wins: totalWins,
    losses: totalLosses,
    wrPct,
    mostPlayed,
    bestWr,
    byChampion,
  };
}
```

- [ ] **Step 2: 단위 테스트 파일 생성**

```bash
mkdir -p test-artifacts/champions-tab
```

`test-artifacts/champions-tab/aggregate-tests.mjs` 작성:

```javascript
import fs from "fs";

const main = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

// nested-brace-safe 함수 본체 추출 — `function name(`부터 시작해 균형 잡힌 } 에서 종료
function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") { depth += 1; bodyStarted = true; }
    else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

// computeKdaRatio는 aggregateChampionHistory 내부에서 호출되므로 같은 스코프에 함께 평가
const computeSrc = extractFunctionSource(main, "computeKdaRatio");
const aggSrc = extractFunctionSource(main, "aggregateChampionHistory");
// eslint-disable-next-line no-new-func
const aggregateChampionHistory = new Function(
  `${computeSrc}\n${aggSrc}\nreturn aggregateChampionHistory;`,
)();

let pass = 0, fail = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

// 케이스 1: 빈 배열
const r1 = aggregateChampionHistory([]);
check("empty: totalGames=0", r1.totalGames, 0);
check("empty: byChampion=[]", r1.byChampion, []);
check("empty: mostPlayed=null", r1.mostPlayed, null);
check("empty: bestWr=null", r1.bestWr, null);

// 케이스 2: 1게임 win
const m1 = { champion: "Ahri", result: "WIN", kills: 5, deaths: 2, assists: 7, csPerMin: 8.1, durationSeconds: 1800, damageToChampions: 22000, killParticipation: 0.6 };
const r2 = aggregateChampionHistory([m1]);
check("1win: totalGames=1", r2.totalGames, 1);
check("1win: wrPct=100", r2.wrPct, 100);
check("1win: byChampion[0].wrPct=100", r2.byChampion[0].wrPct, 100);
check("1win: avgKp=60", r2.byChampion[0].avgKp, 60);

// 케이스 3: 4 win, 1 loss 동일 챔피언
const matches3 = Array.from({ length: 5 }, (_, i) => ({
  champion: "Yasuo", result: i < 4 ? "WIN" : "LOSS", kills: 6, deaths: 3, assists: 4,
  csPerMin: 7.8, durationSeconds: 1800, damageToChampions: 25000, killParticipation: 0.55,
}));
const r3 = aggregateChampionHistory(matches3);
check("5g: count=5", r3.byChampion[0].count, 5);
check("5g: wrPct=80", r3.byChampion[0].wrPct, 80);

// 케이스 4: 베스트 후보는 3경기 이상만
const mixed = [
  ...Array.from({ length: 2 }, () => ({ champion: "Lux", result: "WIN", kills: 5, deaths: 1, assists: 8, csPerMin: 6.5, durationSeconds: 1700, damageToChampions: 20000, killParticipation: 0.6 })),
  ...Array.from({ length: 5 }, (_, i) => ({ champion: "Ahri", result: i < 3 ? "WIN" : "LOSS", kills: 4, deaths: 3, assists: 6, csPerMin: 8.0, durationSeconds: 1800, damageToChampions: 22000, killParticipation: 0.55 })),
];
const r4 = aggregateChampionHistory(mixed);
check("bestWr filter ≥3: Lux 100%(2g) is excluded, Ahri 60%(5g) wins", r4.bestWr.champion, "Ahri");

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 3: 테스트 실행**

```bash
node test-artifacts/champions-tab/aggregate-tests.mjs
```

Expected: 모든 케이스 PASS, `0 fail`.

- [ ] **Step 4: Syntax check**

```bash
node --check main.js && echo "OK"
```

- [ ] **Step 5: Commit**

```bash
git add main.js test-artifacts/champions-tab/aggregate-tests.mjs
git commit -m "feat(js): add aggregateChampionHistory pure function + unit tests"
```

---

## Phase 6 — 정렬 가능 표

### Task 6.1: renderChampionTable + 정렬 토글

**Files:**

- Modify: [`main.js`](../../../main.js) — `renderChampionHistory` / `renderChampionTable` 채움
- Modify: [`styles.css`](../../../styles.css) — `.champion-table`

- [ ] **Step 1: renderChampionHistory 채움**

Phase 3의 placeholder 교체:

```javascript
function renderChampionHistory() {
  if (!state.championHistory) return;
  if (dom.championHistoryEmpty) dom.championHistoryEmpty.hidden = true;
  if (dom.championHistoryTableWrap) dom.championHistoryTableWrap.hidden = false;

  const stats = aggregateChampionHistory(state.championHistory.matches);
  renderChampionSummary(stats);
  renderChampionTable(stats.byChampion, state.championHistorySort.key, state.championHistorySort.dir);
  updateChampionHistoryMeta(state.championHistory);
}

function updateChampionHistoryMeta(history) {
  if (!dom.championHistoryMeta) return;
  const fetched = new Date(history.fetchedAt);
  const ageMin = Math.round((Date.now() - fetched.getTime()) / 60000);
  const ageLabel = ageMin < 1 ? "방금 전" : ageMin < 60 ? `${ageMin}분 전` : `${Math.round(ageMin / 60)}시간 전`;
  const expired = history.expired ? " · 만료됨" : "";
  dom.championHistoryMeta.textContent = `${history.totalGames}경기 · 마지막 갱신 ${ageLabel}${expired}`;
  if (dom.championHistoryAction) {
    dom.championHistoryAction.textContent = "다시 분석";
  }
}
```

- [ ] **Step 2: renderChampionSummary placeholder**

Phase 7에서 채움 — 지금은 빈 div:

```javascript
function renderChampionSummary(stats) {
  if (!dom.championHistorySummary) return;
  dom.championHistorySummary.hidden = stats.totalGames === 0;
  dom.championHistorySummary.innerHTML = ""; // Phase 7
}
```

- [ ] **Step 3: renderChampionTable**

```javascript
const CHAMPION_TABLE_COLUMNS = [
  { key: "champion",         label: "챔피언",       sortType: "string", thAlign: "left" },
  { key: "count",            label: "게임수",       sortType: "number" },
  { key: "wrPct",            label: "승률",         sortType: "number" },
  { key: "avgKda",           label: "KDA",          sortType: "number" },
  { key: "avgCsPerMin",      label: "CS/분",        sortType: "number" },
  { key: "avgDamagePerMin",  label: "데미지/분",    sortType: "number" },
  { key: "avgKp",            label: "킬관여",       sortType: "number" },
];

function renderChampionTable(byChampion, sortKey, sortDir) {
  if (!dom.championHistoryTable) return;
  const rows = byChampion.slice().sort((a, b) => {
    const col = CHAMPION_TABLE_COLUMNS.find((c) => c.key === sortKey);
    const av = a[sortKey];
    const bv = b[sortKey];
    if (!col || col.sortType === "number") {
      return sortDir === "desc" ? bv - av : av - bv;
    }
    return sortDir === "desc"
      ? String(bv).localeCompare(String(av))
      : String(av).localeCompare(String(bv));
  });

  const thead = dom.championHistoryTable.querySelector("thead");
  const tbody = dom.championHistoryTable.querySelector("tbody");

  thead.innerHTML = `
    <tr>
      ${CHAMPION_TABLE_COLUMNS.map((col) => {
        const ariaSort = col.key === sortKey ? (sortDir === "desc" ? "descending" : "ascending") : "none";
        const arrow = col.key === sortKey ? (sortDir === "desc" ? " ▼" : " ▲") : "";
        return `<th scope="col" aria-sort="${ariaSort}">
          <button type="button" class="champion-table__sort-btn" data-sort-key="${col.key}">${col.label}${arrow}</button>
        </th>`;
      }).join("")}
    </tr>
  `;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${CHAMPION_TABLE_COLUMNS.length}" class="muted">표시할 데이터가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((c) => `
      <tr>
        <td class="champion-table__champion">
          ${championAvatarMarkup(c.champion, "small")}
          <span>${championDisplayName(c.champion)}</span>
        </td>
        <td>${c.count}</td>
        <td class="${c.wrPct >= 60 ? "wr-strong" : c.wrPct < 50 ? "wr-weak" : ""}">${c.wrPct.toFixed(1)}%</td>
        <td>${c.avgKda.toFixed(2)}</td>
        <td>${c.avgCsPerMin.toFixed(1)}</td>
        <td>${c.avgDamagePerMin}</td>
        <td>${c.avgKp}%</td>
      </tr>
    `)
    .join("");

  thead.querySelectorAll("[data-sort-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.sortKey;
      if (state.championHistorySort.key === key) {
        state.championHistorySort.dir = state.championHistorySort.dir === "desc" ? "asc" : "desc";
      } else {
        state.championHistorySort.key = key;
        state.championHistorySort.dir = key === "champion" ? "asc" : "desc";
      }
      renderChampionTable(byChampion, state.championHistorySort.key, state.championHistorySort.dir);
    });
  });
}
```

- [ ] **Step 4: 표 CSS 추가**

[`styles.css`](../../../styles.css) `.champion-history-progress` 블록 직후에:

```css
.champion-history-table-wrap { overflow-x: auto; }
.champion-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.champion-table th,
.champion-table td {
  padding: var(--space-2) var(--space-3);
  text-align: right;
  border-bottom: 1px solid var(--surface-2);
}
.champion-table th:first-child,
.champion-table td:first-child { text-align: left; }
.champion-table th {
  font-size: var(--fs-sm);
  color: var(--text-muted);
  background: var(--surface-1);
  position: sticky;
  top: 0;
}
.champion-table__sort-btn {
  background: none; border: none; color: inherit; padding: 0; cursor: pointer; font: inherit;
}
.champion-table__sort-btn:hover { color: var(--text); }
.champion-table tbody tr:hover { background: var(--surface-1); }
.champion-table__champion { display: flex; align-items: center; gap: var(--space-2); }
.champion-table .wr-strong { color: var(--accent); font-weight: 600; }
.champion-table .wr-weak   { color: var(--rose); }
```

- [ ] **Step 5: Manual smoke**

서버 켜고 캐시에 임시로 가짜 데이터 주입(브라우저 콘솔):

```javascript
const fake = {
  matches: Array.from({ length: 30 }, (_, i) => ({
    champion: ["Ahri", "Lux", "Yasuo", "Ezreal", "Jinx"][i % 5],
    result: i % 3 === 0 ? "LOSS" : "WIN",
    kills: 5, deaths: 3, assists: 7, csPerMin: 8 + (i % 5) * 0.2,
    durationSeconds: 1800, damageToChampions: 22000, killParticipation: 0.55,
  })),
  totalGames: 30, fetchedAt: new Date().toISOString(),
};
state.championHistory = { ...fake, expired: false };
renderChampionHistory();
```

표가 7컬럼으로 렌더 + 헤더 클릭 시 정렬 토글 확인.

- [ ] **Step 6: Commit**

```bash
git add main.js styles.css
git commit -m "feat(js,styles): add sortable champion-table with 7 columns"
```

---

## Phase 7 — 요약 카드

### Task 7.1: 4분할 그리드 카드

**Files:**

- Modify: [`main.js`](../../../main.js) — `renderChampionSummary` 채움
- Modify: [`styles.css`](../../../styles.css) — `.champion-history-summary`

- [ ] **Step 1: renderChampionSummary 채움**

`main.js`에서 Phase 6의 placeholder 교체:

```javascript
function renderChampionSummary(stats) {
  if (!dom.championHistorySummary) return;
  if (stats.totalGames === 0) {
    dom.championHistorySummary.hidden = true;
    return;
  }
  dom.championHistorySummary.hidden = false;
  const cards = [
    { label: "총 경기", value: stats.totalGames, note: `${stats.wins}승 ${stats.losses}패` },
    { label: "평균 승률", value: `${stats.wrPct}%`, note: stats.wrPct >= 50 ? "양호" : "개선 여지" },
    {
      label: "가장 많이 쓴",
      value: stats.mostPlayed ? championDisplayName(stats.mostPlayed.champion) : "—",
      note: stats.mostPlayed ? `${stats.mostPlayed.count}경기` : "",
    },
    {
      label: "가장 잘하는 (3+ 게임)",
      value: stats.bestWr ? championDisplayName(stats.bestWr.champion) : "—",
      note: stats.bestWr ? `${stats.bestWr.wrPct.toFixed(1)}% (${stats.bestWr.count}경기)` : "표본 부족",
    },
  ];
  dom.championHistorySummary.innerHTML = cards
    .map((c) => `
      <article class="champion-history-summary__card">
        <span class="champion-history-summary__label">${c.label}</span>
        <strong class="champion-history-summary__value">${c.value}</strong>
        <span class="champion-history-summary__note">${c.note}</span>
      </article>
    `)
    .join("");
}
```

- [ ] **Step 2: 요약 카드 CSS 추가**

[`styles.css`](../../../styles.css) `.champion-history-empty` 직전에 추가:

```css
.champion-history-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
}
.champion-history-summary__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--surface-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-2);
}
.champion-history-summary__label { font-size: var(--fs-sm); color: var(--text-muted); }
.champion-history-summary__value { font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; }
.champion-history-summary__note  { font-size: var(--fs-xs); color: var(--text-subtle); }
```

- [ ] **Step 3: Manual smoke**

브라우저 콘솔에서 Phase 6의 fake 데이터 주입 → 4개 카드(총 경기 / 평균 승률 / 가장 많이 쓴 / 가장 잘하는) 노출 확인.

- [ ] **Step 4: Commit**

```bash
git add main.js styles.css
git commit -m "feat(js,styles): add champion-history summary cards (4 cells)"
```

---

## Phase 8 — 에러 / 취소 / 빈 상태 / 캐시 만료 분기

### Task 8.1: 분기 로직 정리 + recentStats 패턴 따라 invalidate

**Files:**

- Modify: [`main.js`](../../../main.js) — 만료 표시, 부분 누락 표시, 계정 전환 invalidate

- [ ] **Step 1: 캐시 만료 시 자동 페치 X — 안내만**

`onChampionsTabEnter` 함수의 `cached` 분기 보강 (Phase 3에서 작성한 함수 교체):

```javascript
function onChampionsTabEnter() {
  if (state.championHistoryLoading) return; // 페치 중에는 그대로
  const puuid = state.account?.puuid;
  if (!puuid) {
    setChampionHistoryEmpty("먼저 Riot ID로 로그인해주세요.");
    return;
  }
  if (!state.championHistory) {
    const cached = loadChampionHistoryFromCache(puuid);
    if (cached) state.championHistory = cached;
  }
  if (state.championHistory) {
    renderChampionHistory();
    if (state.championHistory.expired && dom.championHistoryAction) {
      dom.championHistoryAction.textContent = "다시 분석 (만료됨)";
    }
  } else {
    setChampionHistoryEmpty("아직 분석을 실행하지 않았습니다. 위의 [분석 시작]을 눌러주세요.");
  }
}
```

- [ ] **Step 2: 계정 전환 시 invalidate (recentStats 패턴 따름)**

`main.js`의 `invalidateRecentStatsIfAccountChanged` 함수 직후 (line ~1112)에 챔피언 버전 추가:

```javascript
function invalidateChampionHistoryIfAccountChanged() {
  if (!state.championHistory) return;
  if (state.championHistoryAccount !== currentAccountKey()) {
    state.championHistory = null;
    state.championHistoryAccount = null;
    state.championHistorySort = { key: "count", dir: "desc" };
  }
}
```

다음 두 곳에서 함수를 호출 — 기존 `invalidateRecentStatsIfAccountChanged()` 콜 사이트와 동일하게 (line ~2853, ~3275):

```javascript
    invalidateRecentStatsIfAccountChanged();
    invalidateChampionHistoryIfAccountChanged();
```

`startChampionHistoryFetch`에서 캐시 hit / 페치 성공 시점에 `state.championHistoryAccount = currentAccountKey()`를 추가해 일관성 유지:

```javascript
    state.championHistory = { ...result, expired: false, matchErrors };
    state.championHistoryAccount = currentAccountKey();
    saveChampionHistoryToCache(puuid, state.championHistory);
```

그리고 캐시에서 복원하는 `onChampionsTabEnter`에서도:

```javascript
    if (cached) {
      state.championHistory = cached;
      state.championHistoryAccount = currentAccountKey();
    }
```

(localStorage 자체는 puuid별로 분리돼 있어서 다른 계정 로그인 시 자동으로 다른 키를 보지만, 메모리 상태가 이전 계정 데이터를 들고 있으면 안 되므로 명시적 invalidate.)

- [ ] **Step 3: 부분 매치 누락 카운터 표시**

`startChampionHistoryFetch`의 `onProgress` 콜백을 보강해 매치 에러 카운트:

```javascript
let matchErrors = 0;
const onProgress = (info) => {
  if (info.phase === "match-error") matchErrors += 1;
  updateChampionHistoryProgress(info);
};
```

`fetchChampionHistory({ ... onProgress })` 호출 시 위 콜백 사용. 성공 후:

```javascript
    state.championHistory = { ...result, expired: false, matchErrors };
    saveChampionHistoryToCache(puuid, state.championHistory);
    renderChampionHistory();
```

`updateChampionHistoryMeta`에 누락 표시 추가:

```javascript
function updateChampionHistoryMeta(history) {
  if (!dom.championHistoryMeta) return;
  const fetched = new Date(history.fetchedAt);
  const ageMin = Math.round((Date.now() - fetched.getTime()) / 60000);
  const ageLabel = ageMin < 1 ? "방금 전" : ageMin < 60 ? `${ageMin}분 전` : `${Math.round(ageMin / 60)}시간 전`;
  const expired = history.expired ? " · 만료됨" : "";
  const errors = history.matchErrors > 0 ? ` · 누락 ${history.matchErrors}건` : "";
  dom.championHistoryMeta.textContent = `${history.totalGames}경기 · 마지막 갱신 ${ageLabel}${expired}${errors}`;
  if (dom.championHistoryAction) dom.championHistoryAction.textContent = "다시 분석";
}
```

- [ ] **Step 4: Manual smoke**

서버를 잠깐 죽이고 [분석 시작] 클릭 → "분석 실패: ..." 표시 확인. 그 후 서버 다시 켜고 [분석 시작] → 정상.

- [ ] **Step 5: Syntax check**

```bash
node --check main.js && echo "OK"
```

- [ ] **Step 6: Commit**

```bash
git add main.js
git commit -m "feat(js): add cache expiry, account invalidate, partial-error counter"
```

---

## Phase 9 — a11y 검증 + 문서

### Task 9.1: a11y 검증 + README + CHANGELOG

**Files:**

- Modify: [`README.md`](../../../README.md)
- Modify: [`CHANGELOG.md`](../../../CHANGELOG.md) — iter.10 섹션 또는 신규 iter.11 항목

- [ ] **Step 1: a11y 수동 점검 체크리스트**

브라우저로 다음을 모두 확인 (체크박스로 표시):

- [ ] 5번째 탭이 ←/→ 화살표키로 이동 가능
- [ ] Home 키로 첫 탭, End 키로 마지막 탭 이동
- [ ] 탭 활성화 시 `tabindex="0"` 로빙 정상
- [ ] [분석 시작] 버튼 Tab 포커스 시 `--focus-ring` 표시
- [ ] 진행 바가 `<progress>`로 스크린리더에 진행률 안내
- [ ] 표 헤더 클릭 시 `aria-sort` 갱신 확인 (DevTools)
- [ ] [취소] 버튼 `aria-label`과 텍스트 모두 명확

문제 있으면 해당 부분 수정 후 재검증.

- [ ] **Step 2: README "주요 기능"에 챔피언 탭 한 줄 추가**

[`README.md`](../../../README.md) 의 기존 "최근 10게임 요약을 즉시 표시 ..." 라인 아래에 추가:

```markdown
- 챔피언 탭: 현재 시즌(S16) 솔랭/자랭 풀 히스토리 분석 → 챔피언별 7컬럼 정렬 가능 표 + 진행률/취소/24시간 캐시
```

- [ ] **Step 3: README "주요 파일" 트리 업데이트**

`docs/superpowers/specs/`와 `plans/` 라인 추가 (아직 없으면).

- [ ] **Step 4: README "최근 UI 정리"에 한 줄 추가**

iter.10 섹션 아래에:

```markdown
- iter.11 (2026-04-27 ~): 챔피언 탭 추가 — `POST /api/champion-history` SSE + `fetch+ReadableStream` SSE 클라이언트 + localStorage 24h 캐시 + AbortController 취소. 7컬럼 정렬 가능 표 + 4분할 요약 카드. [docs/superpowers/specs/2026-04-27-champions-tab-design.md](docs/superpowers/specs/2026-04-27-champions-tab-design.md)
```

- [ ] **Step 5: CHANGELOG 신규 섹션 추가**

[`CHANGELOG.md`](../../../CHANGELOG.md) 상단에 새 섹션:

```markdown
## iter.11 — 챔피언 탭

**날짜**: 2026-04-27
**범위**: server.js (+SSE 엔드포인트), main.js (+SSE 클라이언트, +집계 함수, +렌더), index.html (+5번째 탭), styles.css (+champion-table)
**스펙**: docs/superpowers/specs/2026-04-27-champions-tab-design.md

현재 시즌(S16) 솔랭/자랭 풀 히스토리를 한 번에 분석하는 5번째 탭 `tab-champions`를 추가했다. SSE 진행률 + AbortController 취소 + localStorage 24h 캐시. 챔피언별 7컬럼(챔피언/게임수/승률/KDA/CS·분/데미지·분/킬관여) 정렬 가능 표 + 4분할 요약 카드. 디자인 불변식 모두 준수: index.html 구조 보존 + main.js 셀렉터 보존 + 신규 CSS 토큰 0.
```

- [ ] **Step 6: Final smoke + 5/5 axe (선택)**

브라우저로 한 번 더 5개 탭 모두 순회하면서 회귀 없는지 확인. axe DevTools 켜서 위반 0건 유지 확인.

- [ ] **Step 7: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: update README + CHANGELOG for iter.11 champions tab"
```

---

## 회귀 안전 체크포인트

각 Phase 끝에 다음을 수동/스크립트로 검증:

```bash
node --check server.js && node --check main.js && echo "syntax OK"
```

서버 띄우고 기존 4개 탭(개요/분석/타임라인/추세) 모두 진입해서 회귀 없는지 확인. 5번째 탭은 캐시 hit이 아니면 빈 상태만 노출되므로 다른 탭 영향 0이어야 한다.

## 실행 후 정리

- 9개 phase 모두 완료 후 `git push origin main`
- 실제 사용자(매운맛 비스킷#KR1)로 [분석 시작] 1회 풀 페치 — 1~3분 대기, 결과 표 검증
- 캐시 hit 동작 검증: 같은 계정 다시 탭 진입 → 즉시 표시
- README의 `SEASON_START_EPOCH` 업데이트 절차 메모 (S17 시작 시점)
