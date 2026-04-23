# Multi-match Cumulative Analysis View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `tab-trends`에 최근 20경기 quantitative 누적 분석 3개 패널(recent-aggregate · champion-breakdown · role-breakdown)을 추가한다. 저장 샘플 AI qualitative 패널은 그대로 유지.

**Architecture:** 프론트 전용. 기존 `/api/recent-matches` 엔드포인트(서버 변경 없음)를 재사용해 20경기를 가져와, 순수 함수 `aggregateRecentStats(matches)`로 집계 후 3개 패널에 렌더. tab-trends 첫 진입 시 lazy fetch, 세션 캐시, 새로고침 버튼. iter.8의 skeleton 패턴 재사용.

**Tech Stack:** Vanilla HTML + CSS Custom Properties (iter.7/8 토큰 시스템 재사용) + Vanilla JS fetch + 기존 서버 엔드포인트.

**Spec:** [docs/superpowers/specs/2026-04-24-multi-match-view-design.md](../specs/2026-04-24-multi-match-view-design.md)

---

## Known API Response Shape (verified)

`POST /api/recent-matches` body:
```json
{"gameName": "...", "tagLine": "...", "platformRegion": "KR", "start": 0, "matchCount": 20}
```

Response (`matches` array items):
```json
{
  "matchId": "KR_12345",
  "queueId": 420,
  "queueLabel": "솔로/듀오",
  "durationSeconds": 1800,
  "durationLabel": "30:00",
  "gameVersion": "16.7.760.9485",
  "champion": "Nami",
  "role": "SUPPORT",
  "result": "WIN",
  "kills": 3,
  "deaths": 1,
  "assists": 10,
  "csPerMin": 5.2,
  "visionScore": 55,
  "goldEarned": 8500,
  "damageToChampions": 4200,
  "timestamp": 1700000000000,
  "items": [...],
  "summonerSpells": [...],
  "sampleFitScore": 7
}
```

**Role normalization values** (from `normalizeRole` in server.js:153): `TOP / JUNGLE / MID / ADC / SUPPORT`. Always one of these 5 (or `""` for unknown).

**Rate limit**: IP-based 10-second throttle on the endpoint.

---

## File Structure

**변경 파일 (5)**

- **Modify** `index.html` — tab-trends 안에 3개 신규 `<section class="panel">` 추가. 기존 panel 순서 조정
- **Modify** `styles.css` — `.panel--recent-aggregate`, `.panel--champion-breakdown`, `.panel--role-breakdown`, `.breakdown-list`, `.breakdown-row`, `.wr-bar`, `.refresh-btn` 스타일
- **Modify** `main.js` — `aggregateRecentStats` 순수 함수 + 4개 renderer + fetchRecentStats + state + lazy load hook in switchTab
- **Modify** `design-tokens.md` — iter.9 컴포넌트 섹션 + §10 closeout item
- **Modify** `README.md` — iter.9 요약

**생성 파일 (gitignored, 보조 아티팩트)**

- `test-artifacts/design-audit/iter9-baseline.md`
- `test-artifacts/multi-match-view/` (as gitignored directory; add to .gitignore if missing)

**비변경**

- `server.js` (엔드포인트 재사용)
- `admin.*`, `data/**`, 기타

---

## Task 0: Baseline Capture

**Files:**

- Create (gitignored): `test-artifacts/design-audit/iter9-baseline.md`

- [ ] **Step 0.1: Capture baseline audit**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
mkdir -p test-artifacts/design-audit
node scripts/design-audit.js --scope all --format markdown --top 20 --output test-artifacts/design-audit/iter9-baseline.md
```

Expected: file created. Confirm it contains `Token coverage: 88.5%` (Colors — from iter.8 result).

- [ ] **Step 0.2: Confirm .gitignore covers artifacts**

```bash
grep -qE "^test-artifacts/design-audit/$" /Users/a1234/Documents/Web_LOL_Banpick/.gitignore && echo "OK" || echo "missing — add test-artifacts/design-audit/ to .gitignore"
```

Expected: `OK` (added in iter.7). If missing, add it.

- [ ] **Step 0.3: Verify git status clean or only known data/samples noise**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git status --short
```

Expected: empty or only untracked/modified `data/samples/*` noise (unrelated environment changes).

**No commit** in this task.

---

## Task 1: aggregateRecentStats Pure Function (Commit 1)

**Files:**

- Modify: `main.js` — add `aggregateRecentStats(matches)` function near other pure-data helpers

**Goal:** Pure function that takes the matches array from `/api/recent-matches` and produces `{overall, byChampion, byRole}` aggregates. Testable via console.

- [ ] **Step 1.1: Find insertion location in main.js**

The function is pure-data utility. Put it near other helpers like `sampleMatchSummary` (around L904) or near `buildTrendSnapshot` (which you can locate with grep).

```bash
grep -n "^function sampleMatchSummary\|^function buildTrendSnapshot\|^function buildCompactHeadline" /Users/a1234/Documents/Web_LOL_Banpick/main.js | head -5
```

Choose a location just after `buildTrendSnapshot` (it's thematically similar — also accumulates). Read a few lines around it to confirm the surrounding style.

- [ ] **Step 1.2: Insert the function**

Add this function after `buildTrendSnapshot` (or another suitable location — it's self-contained):

```javascript
function aggregateRecentStats(matches) {
  const safe = Array.isArray(matches) ? matches : [];
  const overall = {
    count: safe.length,
    wins: 0,
    losses: 0,
    wrPct: 0,
    avgKda: 0,
    avgCsPerMin: 0,
    avgDurationSec: 0,
  };

  const championMap = new Map();
  const roleMap = new Map();

  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let csPerMinSum = 0;
  let durationSum = 0;

  for (const m of safe) {
    if (m.result === "WIN") overall.wins += 1;
    else if (m.result === "LOSS") overall.losses += 1;
    totalKills += m.kills || 0;
    totalDeaths += m.deaths || 0;
    totalAssists += m.assists || 0;
    csPerMinSum += Number(m.csPerMin) || 0;
    durationSum += Number(m.durationSeconds) || 0;

    const championKey = m.champion || "Unknown";
    if (!championMap.has(championKey)) {
      championMap.set(championKey, { champion: championKey, count: 0, wins: 0, kills: 0, deaths: 0, assists: 0, csPerMinSum: 0 });
    }
    const c = championMap.get(championKey);
    c.count += 1;
    if (m.result === "WIN") c.wins += 1;
    c.kills += m.kills || 0;
    c.deaths += m.deaths || 0;
    c.assists += m.assists || 0;
    c.csPerMinSum += Number(m.csPerMin) || 0;

    const roleKey = m.role || "UNKNOWN";
    if (!roleMap.has(roleKey)) {
      roleMap.set(roleKey, { role: roleKey, count: 0, wins: 0, kills: 0, deaths: 0, assists: 0 });
    }
    const r = roleMap.get(roleKey);
    r.count += 1;
    if (m.result === "WIN") r.wins += 1;
    r.kills += m.kills || 0;
    r.deaths += m.deaths || 0;
    r.assists += m.assists || 0;
  }

  const decided = overall.wins + overall.losses;
  overall.wrPct = decided > 0 ? Math.round((overall.wins / decided) * 100) : 0;
  overall.avgKda = computeKdaRatio(totalKills, totalDeaths, totalAssists);
  overall.avgCsPerMin = safe.length > 0 ? +(csPerMinSum / safe.length).toFixed(1) : 0;
  overall.avgDurationSec = safe.length > 0 ? Math.round(durationSum / safe.length) : 0;

  const byChampion = Array.from(championMap.values())
    .map((c) => ({
      champion: c.champion,
      count: c.count,
      wins: c.wins,
      wrPct: c.count > 0 ? Math.round((c.wins / c.count) * 100) : 0,
      avgKda: computeKdaRatio(c.kills, c.deaths, c.assists),
      avgCsPerMin: c.count > 0 ? +(c.csPerMinSum / c.count).toFixed(1) : 0,
    }))
    .sort((a, b) => b.count - a.count || b.wrPct - a.wrPct);

  const roleOrder = { TOP: 1, JUNGLE: 2, MID: 3, ADC: 4, SUPPORT: 5, UNKNOWN: 99 };
  const byRole = Array.from(roleMap.values())
    .map((r) => ({
      role: r.role,
      count: r.count,
      wins: r.wins,
      wrPct: r.count > 0 ? Math.round((r.wins / r.count) * 100) : 0,
      avgKda: computeKdaRatio(r.kills, r.deaths, r.assists),
    }))
    .sort((a, b) => b.count - a.count || (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99));

  return { overall, byChampion, byRole };
}

function computeKdaRatio(kills, deaths, assists) {
  if (deaths === 0) return +((kills + assists) || 0).toFixed(2);
  return +(((kills + assists) / deaths)).toFixed(2);
}
```

Note: `computeKdaRatio` is a new helper. If one already exists (search first), reuse it:

```bash
grep -n "function computeKdaRatio\|function kdaRatio\|kda.*ratio\|kdaValue" /Users/a1234/Documents/Web_LOL_Banpick/main.js | head
```

If a similar helper exists (e.g., already named `kdaRatio`), use that name instead and skip adding `computeKdaRatio`.

- [ ] **Step 1.3: Syntax check**

```bash
node --check /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: silent.

- [ ] **Step 1.4: Manual console test**

Start server and test via browser devtools console:

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node server.js &
SERVER_PID=$!
sleep 2
# Open http://127.0.0.1:8123 in browser, then in devtools console run:
```

```javascript
aggregateRecentStats([
  { matchId: "1", champion: "Nami", role: "SUPPORT", result: "WIN", kills: 3, deaths: 1, assists: 10, csPerMin: 5.2, durationSeconds: 1800 },
  { matchId: "2", champion: "Nami", role: "SUPPORT", result: "LOSS", kills: 2, deaths: 5, assists: 8, csPerMin: 4.8, durationSeconds: 1500 },
  { matchId: "3", champion: "Braum", role: "SUPPORT", result: "WIN", kills: 1, deaths: 2, assists: 12, csPerMin: 3.5, durationSeconds: 2000 },
]);
```

Expected output structure:

```javascript
{
  overall: {
    count: 3,
    wins: 2,
    losses: 1,
    wrPct: 67,  // 2 wins / (2 wins + 1 loss) = 67%
    avgKda: 4.5,  // (3+10+2+8+1+12)=36 kills+assists total, (1+5+2)=8 deaths total, 36/8 = 4.5
    avgCsPerMin: 4.5,  // (5.2+4.8+3.5)/3 = 4.5
    avgDurationSec: 1767,  // (1800+1500+2000)/3 = 1766.67 → 1767
  },
  byChampion: [
    { champion: "Nami", count: 2, wins: 1, wrPct: 50, avgKda: 3.83, avgCsPerMin: 5.0 },  // (3+10+2+8)/(1+5) = 23/6 = 3.83
    { champion: "Braum", count: 1, wins: 1, wrPct: 100, avgKda: 6.5, avgCsPerMin: 3.5 },  // (1+12)/2 = 6.5
  ],
  byRole: [
    { role: "SUPPORT", count: 3, wins: 2, wrPct: 67, avgKda: 4.5 },
  ],
}
```

(avgKda numbers: my first calculation was right. 36/8 = 4.5.)

Verify the output matches expected structure and numeric values. If the shape differs, fix the function before committing.

Kill the server:

```bash
kill $SERVER_PID 2>/dev/null
wait 2>/dev/null
```

- [ ] **Step 1.5: Commit 1**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add main.js
git commit -m "$(cat <<'EOF'
feat(js): add aggregateRecentStats pure function

Produces {overall, byChampion, byRole} aggregates from the
/api/recent-matches response. Pure, no DOM, no side effects.
Used by the upcoming recent-aggregate / champion-breakdown /
role-breakdown renderers.

Champion list sorted by count desc then winrate desc.
Role list sorted by count desc then canonical TOP/JUNGLE/MID/
ADC/SUPPORT order.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 1.6: Verify**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD | head -3
grep -n "^function aggregateRecentStats" /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: 2 commits on branch (spec + Task 1), aggregateRecentStats defined at a concrete line.

---

## Task 2: Component Base Styles (Commit 2)

**Files:**

- Modify: `styles.css` — add new component styles. Insertion point: alongside iter.8 components (before `@media (max-width: 1180px)`)

**Goal:** Declare CSS for `.wr-bar`, `.breakdown-row`, `.refresh-btn`, and 3 new panels. Classes become active in Tasks 3-5.

- [ ] **Step 2.1: Find insertion location**

```bash
grep -n "^/\* ── iteration 8" /Users/a1234/Documents/Web_LOL_Banpick/styles.css | head -1
```

Locate the iter.8 section. Insert new styles immediately after the iter.8 components block (before `@media (max-width: 1180px)`).

- [ ] **Step 2.2: Insert the new styles**

Add this block:

```css
/* ── iteration 9: multi-match view components ────────────────────── */

.panel--recent-aggregate {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.panel--recent-aggregate__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.panel--recent-aggregate__head h3 {
  margin: 0;
  font-size: var(--fs-xl);
  color: var(--text);
}

.refresh-btn {
  border: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-3);
  font-size: var(--fs-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background 180ms ease, border-color 180ms ease;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--info-soft);
  border-color: var(--info-border);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.recent-aggregate__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.recent-aggregate__record {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.recent-aggregate__record strong {
  font-size: var(--fs-2xl);
  font-weight: 800;
  color: var(--text);
}

.recent-aggregate__record span {
  font-size: var(--fs-md);
  color: var(--muted);
}

.recent-aggregate__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-3);
}

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

.panel--recent-aggregate .wr-bar {
  max-width: 100%;
  height: 10px;
}

.breakdown-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.breakdown-row {
  display: grid;
  grid-template-columns: 32px 1fr auto 120px auto auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  color: var(--text);
}

.breakdown-row__icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--surface-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text);
}

.breakdown-row__icon--role {
  background: var(--amber-bg-deep);
  color: var(--accent);
  letter-spacing: 0.04em;
}

.breakdown-row__label {
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breakdown-row__count {
  font-size: var(--fs-xs);
  color: var(--muted);
  white-space: nowrap;
}

.breakdown-row__wr-text {
  font-weight: 700;
  color: var(--text);
}

.breakdown-row__kda,
.breakdown-row__cs {
  font-size: var(--fs-xs);
  color: var(--muted);
  white-space: nowrap;
}

.breakdown-footer {
  margin: var(--space-2) 0 0;
  font-size: var(--fs-xs);
}

.panel--recent-aggregate__status {
  font-size: var(--fs-sm);
  color: var(--muted);
}
```

- [ ] **Step 2.3: Add responsive rules inside the merged 760px block**

Find the iter.8 mobile rules (inside `@media (max-width: 760px)`) and append these after them:

```css
  /* iteration 9: multi-match view responsive */
  .breakdown-row {
    grid-template-columns: 32px 1fr auto;
    grid-template-areas:
      "icon label count"
      "wr wr wr"
      "stats stats stats";
    gap: var(--space-2);
  }

  .breakdown-row__icon { grid-area: icon; }
  .breakdown-row__label { grid-area: label; }
  .breakdown-row__count { grid-area: count; }
  .breakdown-row__wr,
  .breakdown-row__wr-text { grid-area: wr; align-self: center; }
  .breakdown-row__kda,
  .breakdown-row__cs { grid-area: stats; }

  .breakdown-row__wr {
    max-width: 100%;
  }

  .recent-aggregate__record {
    flex-wrap: wrap;
  }
```

- [ ] **Step 2.4: Audit check**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node scripts/design-audit.js --scope colors --format text --top 2
```

Expected: coverage ≥ 88.5% (new styles use only existing tokens).

- [ ] **Step 2.5: Commit 2**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add styles.css
git commit -m "$(cat <<'EOF'
feat(styles): add base styles for .wr-bar, .breakdown-row, panel--recent-aggregate

Introduce the 3 new panel styles + shared .wr-bar (winrate bar
with --wr-fill-pct CSS variable) + .breakdown-row (6-column grid
with icon / label / count / wr-bar / wr-text / stats) + .refresh-btn.
Uses only existing tokens (--mint, --rose-bg-soft, --amber-bg-deep,
--info-*, --surface-*, --space-*, --radius-*, --fs-*).

Responsive rules append to the iter.7 merged 760px block using
grid-template-areas to stack row content into 3 lines.

Styles only; not wired to any DOM until Tasks 3-5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2.6: Verify**

```bash
git log --oneline origin/main..HEAD | head -3
grep -c "^\.wr-bar\|^\.breakdown-row\|^\.refresh-btn\|^\.panel--recent-aggregate" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 3 commits, style selector count ≥ 4.

---

## Task 3: panel--recent-aggregate + Lazy Fetch (Commit 3)

**Files:**

- Modify: `index.html` — add `<section class="panel panel--recent-aggregate">` to tab-trends
- Modify: `main.js` — add state fields, dom selectors, fetchRecentStats, renderRecentAggregate, hook into switchTab

**Goal:** Wire the 20-match fetch + overall aggregate display. Champion/role breakdowns handled in Tasks 4-5.

- [ ] **Step 3.1: Update index.html — add section to tab-trends**

Find the tab-trends section:

```bash
grep -n "id=\"tab-trends\"\|panel--trends\|panel--reports" /Users/a1234/Documents/Web_LOL_Banpick/index.html | head
```

Locate the position after `<section class="panel panel--trends" ...>...</section>` and before `<section class="panel panel--reports" ...>`. Insert:

```html
          <section class="panel panel--recent-aggregate" data-recent-aggregate aria-labelledby="recent-aggregate-title">
            <div class="panel--recent-aggregate__head">
              <h3 id="recent-aggregate-title">최근 20경기</h3>
              <button type="button" class="refresh-btn" data-refresh-stats aria-label="최근 20경기 다시 불러오기">↻ 새로고침</button>
            </div>
            <div class="recent-aggregate__body">
              <div class="recent-aggregate__record">
                <strong data-overall-wl>—</strong>
                <span data-overall-wr-text>승률 —</span>
              </div>
              <div class="wr-bar" data-overall-wr-bar>
                <span class="wr-bar__fill" data-wr-fill style="--wr-fill-pct: 0%"></span>
              </div>
              <div class="recent-aggregate__stats">
                <div class="metric">
                  <span class="meta-label">평균 KDA</span>
                  <strong data-overall-kda>—</strong>
                </div>
                <div class="metric">
                  <span class="meta-label">CS/분</span>
                  <strong data-overall-cs>—</strong>
                </div>
                <div class="metric">
                  <span class="meta-label">평균 게임 시간</span>
                  <strong data-overall-duration>—</strong>
                </div>
              </div>
              <p class="panel--recent-aggregate__status muted" data-recent-aggregate-status hidden></p>
            </div>
          </section>
```

- [ ] **Step 3.2: Update main.js dom selectors**

In the `const dom = { ... }` object, add these entries (near other trend-related selectors):

```javascript
  recentAggregate: document.querySelector("[data-recent-aggregate]"),
  refreshStats: document.querySelector("[data-refresh-stats]"),
  overallWl: document.querySelector("[data-overall-wl]"),
  overallWrText: document.querySelector("[data-overall-wr-text]"),
  overallWrBar: document.querySelector("[data-overall-wr-bar]"),
  wrFill: document.querySelector("[data-wr-fill]"),
  overallKda: document.querySelector("[data-overall-kda]"),
  overallCs: document.querySelector("[data-overall-cs]"),
  overallDuration: document.querySelector("[data-overall-duration]"),
  recentAggregateStatus: document.querySelector("[data-recent-aggregate-status]"),
```

Use Edit with surrounding context so insertion is precise.

- [ ] **Step 3.3: Update state object**

Find the `state` object initialization:

```bash
grep -n "^const state\|^let state\|^state = {" /Users/a1234/Documents/Web_LOL_Banpick/main.js | head
```

Add these fields inside the initial state (or if state is built incrementally, add them with defaults):

```javascript
  recentStats: null,
  recentStatsAccount: null,
  recentStatsLoading: false,
  recentStatsError: null,
```

If state doesn't have an object-literal form, add them at the bottom with plain assignments:

```javascript
state.recentStats = null;
state.recentStatsAccount = null;
state.recentStatsLoading = false;
state.recentStatsError = null;
```

- [ ] **Step 3.4: Add fetchRecentStats function**

Insert near other async API functions (find with `grep -n "^async function fetch" main.js`). Add:

```javascript
function currentAccountKey() {
  if (!state.account) return null;
  return `${state.account.gameName}#${state.account.tagLine}@${state.account.platformRegion}`;
}

async function fetchRecentStats({ force = false } = {}) {
  if (!state.account) {
    renderRecentStatsEmpty("계정을 먼저 설정하세요");
    return;
  }
  if (state.recentStatsLoading) return;
  const accountKey = currentAccountKey();
  if (!force && state.recentStats && state.recentStatsAccount === accountKey) {
    return;
  }

  state.recentStatsLoading = true;
  state.recentStatsError = null;
  toggleRefreshButton(true);
  showRecentAggregateStatus("최근 20경기 불러오는 중…");

  try {
    const res = await fetch("/api/recent-matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameName: state.account.gameName,
        tagLine: state.account.tagLine,
        platformRegion: state.account.platformRegion,
        riotApiKey: state.account.riotApiKey || undefined,
        start: 0,
        matchCount: 20,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data?.error || `요청 실패 (HTTP ${res.status})`);
    }

    const matches = Array.isArray(data.matches) ? data.matches : [];
    if (matches.length === 0) {
      state.recentStats = { overall: { count: 0, wins: 0, losses: 0, wrPct: 0, avgKda: 0, avgCsPerMin: 0, avgDurationSec: 0 }, byChampion: [], byRole: [] };
      state.recentStatsAccount = accountKey;
      renderRecentStatsEmpty("최근 경기 없음");
      return;
    }

    state.recentStats = aggregateRecentStats(matches);
    state.recentStatsAccount = accountKey;
    state.recentStatsError = null;
    hideRecentAggregateStatus();

    renderRecentAggregate();
    if (typeof renderChampionBreakdown === "function") renderChampionBreakdown();
    if (typeof renderRoleBreakdown === "function") renderRoleBreakdown();
  } catch (error) {
    state.recentStatsError = error.message || String(error);
    renderRecentStatsError(state.recentStatsError);
  } finally {
    state.recentStatsLoading = false;
    toggleRefreshButton(false);
  }
}

function toggleRefreshButton(loading) {
  if (!dom.refreshStats) return;
  dom.refreshStats.disabled = Boolean(loading);
  dom.refreshStats.textContent = loading ? "불러오는 중…" : "↻ 새로고침";
}

function showRecentAggregateStatus(message) {
  if (!dom.recentAggregateStatus) return;
  dom.recentAggregateStatus.textContent = message;
  dom.recentAggregateStatus.hidden = false;
}

function hideRecentAggregateStatus() {
  if (!dom.recentAggregateStatus) return;
  dom.recentAggregateStatus.textContent = "";
  dom.recentAggregateStatus.hidden = true;
}

function renderRecentStatsError(message) {
  showRecentAggregateStatus(message || "불러오기 실패. 잠시 후 다시 시도하세요.");
  // Leave existing aggregates in place if any (user can retry)
}

function renderRecentStatsEmpty(message) {
  if (dom.overallWl) dom.overallWl.textContent = "—";
  if (dom.overallWrText) dom.overallWrText.textContent = "승률 —";
  if (dom.overallKda) dom.overallKda.textContent = "—";
  if (dom.overallCs) dom.overallCs.textContent = "—";
  if (dom.overallDuration) dom.overallDuration.textContent = "—";
  if (dom.wrFill) dom.wrFill.style.setProperty("--wr-fill-pct", "0%");
  showRecentAggregateStatus(message || "최근 경기 없음");
}
```

Note: `renderChampionBreakdown` and `renderRoleBreakdown` are defined in Tasks 4-5. The `typeof === "function"` guard lets Task 3 commit on its own without runtime errors before the later tasks land.

- [ ] **Step 3.5: Add renderRecentAggregate function**

Insert near `renderTrendPanel` (around L813):

```javascript
function renderRecentAggregate() {
  if (!state.recentStats || !dom.recentAggregate) return;
  const { overall } = state.recentStats;

  if (dom.overallWl) {
    dom.overallWl.textContent = overall.count === 0 ? "—" : `${overall.wins}W ${overall.losses}L`;
  }
  if (dom.overallWrText) {
    dom.overallWrText.textContent = overall.count === 0 ? "승률 —" : `승률 ${overall.wrPct}%`;
  }
  if (dom.wrFill) {
    dom.wrFill.style.setProperty("--wr-fill-pct", `${overall.wrPct}%`);
  }
  if (dom.overallKda) {
    dom.overallKda.textContent = overall.count === 0 ? "—" : overall.avgKda.toFixed(2);
  }
  if (dom.overallCs) {
    dom.overallCs.textContent = overall.count === 0 ? "—" : overall.avgCsPerMin.toFixed(1);
  }
  if (dom.overallDuration) {
    dom.overallDuration.textContent = overall.count === 0 ? "—" : formatDurationSeconds(overall.avgDurationSec);
  }

  hideRecentAggregateStatus();
}

function formatDurationSeconds(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "—";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
```

Check if `formatDurationSeconds` or similar already exists:

```bash
grep -n "function.*[Dd]uration" /Users/a1234/Documents/Web_LOL_Banpick/main.js | head -10
```

If a helper like `formatDuration`, `durationLabel` already exists with the same m:ss format, reuse it (use the existing name, don't add a duplicate).

- [ ] **Step 3.6: Hook into switchTab**

Find `function switchTab` (around L2777 after iter.8 changes). After the `tab-bar / tab-page / activeTab` updates and after the skeleton block, add:

```javascript
  if (tabId === "tab-trends") {
    maybeFetchRecentStats();
  }
```

And add the helper function (near other switchTab helpers):

```javascript
function maybeFetchRecentStats() {
  if (!state.account) return;
  const accountKey = currentAccountKey();
  if (state.recentStats && state.recentStatsAccount === accountKey) {
    renderRecentAggregate();
    if (typeof renderChampionBreakdown === "function") renderChampionBreakdown();
    if (typeof renderRoleBreakdown === "function") renderRoleBreakdown();
    return;
  }
  fetchRecentStats();
}
```

- [ ] **Step 3.7: Add refresh button click handler**

Find `initTabSystem` (around L2808 after iter.8). Append:

```javascript
  if (dom.refreshStats) {
    dom.refreshStats.addEventListener("click", () => {
      fetchRecentStats({ force: true });
    });
  }
```

- [ ] **Step 3.8: Syntax check + server smoke test**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node --check main.js
```

Expected: silent.

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node server.js > /tmp/server.log 2>&1 &
SERVER_PID=$!
sleep 2
curl -sS --max-time 5 http://127.0.0.1:8123/ | grep -c "panel--recent-aggregate"
curl -sS --max-time 5 http://127.0.0.1:8123/ | grep -c "data-refresh-stats"
kill $SERVER_PID 2>/dev/null
wait 2>/dev/null
```

Expected: both counts ≥ 1.

- [ ] **Step 3.9: Commit 3**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add index.html main.js
git commit -m "$(cat <<'EOF'
feat(html,js): add panel--recent-aggregate with lazy fetch on tab-trends enter

- index.html: new .panel--recent-aggregate inside tab-trends
  between panel--trends and panel--reports. Shows W-L record,
  winrate bar, and 3 metric tiles (avg KDA, CS/분, 평균 게임 시간).
  Includes a refresh button and a status line for loading/empty
  states.
- main.js: new state fields (recentStats, recentStatsAccount,
  recentStatsLoading, recentStatsError). fetchRecentStats calls
  POST /api/recent-matches with matchCount=20. Cache keyed on
  current account. switchTab hooks into maybeFetchRecentStats
  on tab-trends enter. Refresh button is disabled during load.
  Champion/role breakdown renderers are called via typeof guard
  so this commit is independently runnable.

Closes spec §4.1 and §5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3.10: Verify**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD | head -4
grep -c "panel--recent-aggregate\|data-refresh-stats" /Users/a1234/Documents/Web_LOL_Banpick/index.html
grep -c "fetchRecentStats\|renderRecentAggregate\|maybeFetchRecentStats" /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: 4 commits, index.html counts ≥ 2, main.js function refs ≥ 5.

---

## Task 4: panel--champion-breakdown (Commit 4)

**Files:**

- Modify: `index.html` — add section below panel--recent-aggregate
- Modify: `main.js` — add dom selectors + renderChampionBreakdown

**Goal:** Show top-5 champions by match count with winrate bar + KDA + CS/min. Collapse the rest into a "기타 (N챔피언)" footer.

- [ ] **Step 4.1: Update index.html**

Find the newly-added `<section class="panel panel--recent-aggregate">` (from Task 3). Immediately after its closing `</section>`, insert:

```html
          <section class="panel panel--champion-breakdown" data-champion-breakdown aria-labelledby="champion-breakdown-title">
            <h3 id="champion-breakdown-title">챔피언별</h3>
            <ul class="breakdown-list" data-champion-breakdown-list></ul>
            <p class="breakdown-footer muted" data-champion-breakdown-footer hidden></p>
          </section>
```

- [ ] **Step 4.2: Add dom selectors**

Add to the `dom` object (near the others from Task 3):

```javascript
  championBreakdown: document.querySelector("[data-champion-breakdown]"),
  championBreakdownList: document.querySelector("[data-champion-breakdown-list]"),
  championBreakdownFooter: document.querySelector("[data-champion-breakdown-footer]"),
```

- [ ] **Step 4.3: Add renderChampionBreakdown function**

Insert near `renderRecentAggregate` (from Task 3):

```javascript
const CHAMPION_BREAKDOWN_TOP_N = 5;

function renderChampionBreakdown() {
  if (!state.recentStats || !dom.championBreakdownList) return;
  const { byChampion } = state.recentStats;

  if (byChampion.length === 0) {
    dom.championBreakdownList.innerHTML = '<li class="muted">최근 경기 없음</li>';
    if (dom.championBreakdownFooter) dom.championBreakdownFooter.hidden = true;
    return;
  }

  const top = byChampion.slice(0, CHAMPION_BREAKDOWN_TOP_N);
  const rest = byChampion.slice(CHAMPION_BREAKDOWN_TOP_N);

  dom.championBreakdownList.innerHTML = top
    .map(
      (c) => `
        <li class="breakdown-row" data-champion="${c.champion}">
          <span class="breakdown-row__icon">${championAvatarMarkup(c.champion, "small")}</span>
          <span class="breakdown-row__label">${championDisplayName(c.champion)}</span>
          <span class="breakdown-row__count">${c.count}경기</span>
          <span class="wr-bar breakdown-row__wr"><span class="wr-bar__fill" style="--wr-fill-pct: ${c.wrPct}%"></span></span>
          <span class="breakdown-row__wr-text">${c.wrPct}%</span>
          <span class="breakdown-row__kda">KDA ${c.avgKda.toFixed(2)}</span>
        </li>
      `,
    )
    .join("");

  if (dom.championBreakdownFooter) {
    if (rest.length > 0) {
      dom.championBreakdownFooter.textContent = `기타 (${rest.length}챔피언, ${rest.reduce((s, c) => s + c.count, 0)}경기)`;
      dom.championBreakdownFooter.hidden = false;
    } else {
      dom.championBreakdownFooter.hidden = true;
    }
  }
}
```

Verify `championAvatarMarkup` supports `"small"` size:

```bash
grep -nA 2 "function championAvatarMarkup" /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: signature `championAvatarMarkup(name, size = "medium")` — accepts any string. The CSS class becomes `champion-avatar--small`. If no `.champion-avatar--small` rule exists, the avatar still renders (just inherits default sizing). Acceptable.

- [ ] **Step 4.4: Syntax check + smoke**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node --check main.js
node server.js > /tmp/server.log 2>&1 &
SERVER_PID=$!
sleep 2
curl -sS --max-time 5 http://127.0.0.1:8123/ | grep -c "panel--champion-breakdown"
kill $SERVER_PID 2>/dev/null
wait 2>/dev/null
```

Expected: syntax silent, count ≥ 1.

- [ ] **Step 4.5: Commit 4**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add index.html main.js
git commit -m "$(cat <<'EOF'
feat(html,js): add panel--champion-breakdown with top-5 + rest footer

- index.html: new .panel--champion-breakdown below recent-aggregate
  with a breakdown-list and a muted footer for the rest.
- main.js: renderChampionBreakdown uses top-5 (CHAMPION_BREAKDOWN_TOP_N
  constant) by count desc, then winrate desc, via the existing
  aggregateRecentStats output. Each row shows champion avatar (small),
  name, match count, wrbar + wrtext, and avg KDA. Footer
  summarizes remaining champions.

Closes spec §4.2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4.6: Verify**

```bash
git log --oneline origin/main..HEAD | head -5
grep -c "panel--champion-breakdown\|data-champion-breakdown" /Users/a1234/Documents/Web_LOL_Banpick/index.html
grep -c "renderChampionBreakdown\|CHAMPION_BREAKDOWN_TOP_N" /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: 5 commits, index.html ≥ 2, main.js ≥ 2.

---

## Task 5: panel--role-breakdown (Commit 5)

**Files:**

- Modify: `index.html` — add section below panel--champion-breakdown
- Modify: `main.js` — add dom selectors + renderRoleBreakdown

**Goal:** Show per-role breakdown with 5 rows (TOP/JUNGLE/MID/ADC/SUPPORT) sorted by count desc, role initial badges.

- [ ] **Step 5.1: Update index.html**

After the `<section class="panel panel--champion-breakdown">` closing tag, insert:

```html
          <section class="panel panel--role-breakdown" data-role-breakdown aria-labelledby="role-breakdown-title">
            <h3 id="role-breakdown-title">포지션별</h3>
            <ul class="breakdown-list" data-role-breakdown-list></ul>
          </section>
```

- [ ] **Step 5.2: Add dom selectors**

```javascript
  roleBreakdown: document.querySelector("[data-role-breakdown]"),
  roleBreakdownList: document.querySelector("[data-role-breakdown-list]"),
```

- [ ] **Step 5.3: Add renderRoleBreakdown function**

Near `renderChampionBreakdown`:

```javascript
const ROLE_INITIAL = {
  TOP: "TOP",
  JUNGLE: "JG",
  MID: "MID",
  ADC: "ADC",
  SUPPORT: "SUP",
  UNKNOWN: "?",
};

function renderRoleBreakdown() {
  if (!state.recentStats || !dom.roleBreakdownList) return;
  const { byRole } = state.recentStats;

  if (byRole.length === 0) {
    dom.roleBreakdownList.innerHTML = '<li class="muted">최근 경기 없음</li>';
    return;
  }

  dom.roleBreakdownList.innerHTML = byRole
    .map(
      (r) => `
        <li class="breakdown-row" data-role="${r.role}">
          <span class="breakdown-row__icon breakdown-row__icon--role">${ROLE_INITIAL[r.role] || r.role.slice(0, 3)}</span>
          <span class="breakdown-row__label">${r.role}</span>
          <span class="breakdown-row__count">${r.count}경기</span>
          <span class="wr-bar breakdown-row__wr"><span class="wr-bar__fill" style="--wr-fill-pct: ${r.wrPct}%"></span></span>
          <span class="breakdown-row__wr-text">${r.wrPct}%</span>
          <span class="breakdown-row__kda">KDA ${r.avgKda.toFixed(2)}</span>
        </li>
      `,
    )
    .join("");
}
```

Note: role `UNKNOWN` is the catch-all from `aggregateRecentStats` for empty `role` fields.

- [ ] **Step 5.4: Syntax check + smoke**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node --check main.js
node server.js > /tmp/server.log 2>&1 &
SERVER_PID=$!
sleep 2
curl -sS --max-time 5 http://127.0.0.1:8123/ | grep -c "panel--role-breakdown"
kill $SERVER_PID 2>/dev/null
wait 2>/dev/null
```

Expected: syntax silent, count ≥ 1.

- [ ] **Step 5.5: Commit 5**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add index.html main.js
git commit -m "$(cat <<'EOF'
feat(html,js): add panel--role-breakdown

- index.html: new .panel--role-breakdown below champion-breakdown
  with breakdown-list container.
- main.js: renderRoleBreakdown maps each role (TOP/JUNGLE/MID/
  ADC/SUPPORT/UNKNOWN) to an initial badge (TOP/JG/MID/ADC/SUP/?)
  and reuses the shared .breakdown-row grid. Sorted by count desc
  via aggregateRecentStats output.

Closes spec §4.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5.6: Verify**

```bash
git log --oneline origin/main..HEAD | head -6
grep -c "panel--role-breakdown\|data-role-breakdown" /Users/a1234/Documents/Web_LOL_Banpick/index.html
grep -c "renderRoleBreakdown\|ROLE_INITIAL" /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: 6 commits, index.html ≥ 2, main.js ≥ 2.

---

## Task 6: Refresh Button + Account-Switch Cache Invalidation (Commit 6)

**Files:**

- Modify: `main.js` — ensure account switch invalidates `state.recentStats`; polish error messages

**Goal:** Tie up loose ends. The refresh button itself is already wired (Task 3), but ensure that switching accounts (logout → login different account, or re-fetch form with different Riot ID) clears the cache so the next tab-trends enter re-fetches.

- [ ] **Step 6.1: Find account-update code paths**

Identify the places where `state.account` is set or replaced:

```bash
grep -nE "state\.account\s*=|state\.account\s*=\{" /Users/a1234/Documents/Web_LOL_Banpick/main.js | head
```

Common paths:
- `handleLogin` or similar form submit handler
- `restoreAccountFromStorage` or similar localStorage load

For each assignment that replaces the entire account object (not just mutating a subfield), add an invalidation check:

```javascript
function invalidateRecentStatsIfAccountChanged() {
  if (!state.recentStats) return;
  if (state.recentStatsAccount !== currentAccountKey()) {
    state.recentStats = null;
    state.recentStatsAccount = null;
    state.recentStatsError = null;
    renderRecentStatsEmpty("");
  }
}
```

Add a call to `invalidateRecentStatsIfAccountChanged()` at the end of every code path that sets `state.account`.

In practice, the simplest approach is to add the call inside:

- The login form submit handler (after `state.account = { gameName, tagLine, platformRegion, riotApiKey }` is set)
- The `restoreAccountFromStorage` function (at the end)

```bash
grep -n "^function handleLogin\|^function logIn\|^function restoreAccount\|localStorage.*account" /Users/a1234/Documents/Web_LOL_Banpick/main.js | head
```

Identify the specific function names; then Edit to add `invalidateRecentStatsIfAccountChanged();` as the last statement of each.

- [ ] **Step 6.2: Improve error messages**

Find `renderRecentStatsError` (from Task 3). Enhance with friendlier messaging for common cases:

```javascript
function renderRecentStatsError(message) {
  const normalizedMessage = typeof message === "string" ? message : "";
  let displayMessage = normalizedMessage || "불러오기 실패";
  if (normalizedMessage.includes("rate") || normalizedMessage.includes("10초") || normalizedMessage.includes("Too Many")) {
    displayMessage = "너무 빠르게 재조회했습니다. 10초 뒤 다시 시도하세요.";
  } else if (normalizedMessage.includes("RIOT_API_KEY") || normalizedMessage.includes("401") || normalizedMessage.includes("Forbidden") || normalizedMessage.includes("403")) {
    displayMessage = "Riot API 키가 만료되었거나 유효하지 않습니다. .env를 갱신하세요.";
  } else if (normalizedMessage.includes("network") || normalizedMessage.includes("Failed to fetch")) {
    displayMessage = "네트워크 오류. 서버 상태를 확인하세요.";
  }
  showRecentAggregateStatus(displayMessage);
}
```

Replace the old `renderRecentStatsError` with this version (use Edit).

- [ ] **Step 6.3: Syntax check**

```bash
node --check /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: silent.

- [ ] **Step 6.4: Commit 6**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add main.js
git commit -m "$(cat <<'EOF'
feat(js): invalidate recentStats on account change + friendlier errors

- Add invalidateRecentStatsIfAccountChanged() guard called after
  every state.account assignment path (login form submit,
  localStorage restore). Ensures subsequent tab-trends enter
  refetches for the new account.
- renderRecentStatsError now maps common failure patterns
  (rate-limit, invalid key, network) to friendlier Korean
  messages.

Closes spec §3 (cache invalidation) and §7.2 step 5/6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6.5: Verify**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD | head -7
grep -c "invalidateRecentStatsIfAccountChanged" /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: 7 commits, invalidate helper count ≥ 2 (definition + at least 1 call).

---

## Task 7: Docs Update (Commit 7)

**Files:**

- Modify: `design-tokens.md` — add iter.9 component section + §10 closeout item
- Modify: `README.md` — prepend iter.9 summary bullet

- [ ] **Step 7.1: Update design-tokens.md — add iter.9 section**

Find the iter.8 section inserted previously. Insert a new section below it:

```bash
grep -n "iteration 8 신규 컴포넌트\|## iteration" /Users/a1234/Documents/Web_LOL_Banpick/design-tokens.md
```

Add:

```markdown
## iteration 9 신규 컴포넌트

**`.wr-bar`** — 승률 수평 바.

- 높이 8px, rose-bg-soft 배경 위에 mint `.wr-bar__fill` width로 승률 표현
- `style="--wr-fill-pct: 70%"` 인라인 변수로 제어
- `.panel--recent-aggregate .wr-bar`는 10px 높이 + max-width 100%

**`.panel--recent-aggregate`** — 최근 20경기 요약.

- head: h3 + refresh-btn 좌우 정렬
- body: 승패 record + wr-bar + metric grid (KDA / CS/분 / 평균 게임 시간)
- status line: 로딩/에러/빈 상태 메시지 (기본 hidden)

**`.breakdown-row`** — 6-column grid.

- 데스크톱: icon / label / count / wr-bar / wr-text / kda+cs
- 모바일 ≤760px: grid-template-areas로 3줄 stack
- champion-breakdown과 role-breakdown이 공유

**`.refresh-btn`** — 경량 utility 버튼.

- surface-2 배경 + line 보더. hover 시 info-soft + info-border
- disabled 시 opacity 0.6 + not-allowed 커서
```

- [ ] **Step 7.2: Update §10 open issues**

Append item #20 at the end of §10:

```markdown
20. ~~**다중 경기 누적 분석 뷰 — 최근 N경기 챔피언·포지션 브레이크다운**~~ — **완료** (iteration 9). tab-trends에 panel--recent-aggregate + panel--champion-breakdown + panel--role-breakdown 3개 신규 패널 추가. 기존 /api/recent-matches 재사용, 서버 변경 없음. aggregateRecentStats 순수 함수로 집계. 탭 진입 시 lazy fetch + 세션 캐시 + 새로고침 버튼. 계정 전환 시 자동 invalidate.
```

- [ ] **Step 7.3: Update README.md**

```bash
grep -n "최근 UI 정리" /Users/a1234/Documents/Web_LOL_Banpick/README.md
```

Replace the bullet to prepend iter.9:

**Old** (from iter.8):

```markdown
- **최근 UI 정리** (iter.8): 사이드바 슬림화(identity-card + sample-switcher + collapsed intake), Overview compact detail-header + 3-tile metrics, 10게임 OP.GG row format, 탭 전환 skeleton placeholder. iter.7: 상태색 알파 토큰 9종, Georgia 제거, 760px 통합, `--wr` fallback. 그 이전: `--tint-*`, `--shadow-hover`, match-summary-card 엣지 바, skeleton/shimmer, 좁은 모바일 대응, reduced-motion 대응
```

**New**:

```markdown
- **최근 UI 정리** (iter.9): tab-trends에 최근 20경기 누적 분석 3개 패널(recent-aggregate / champion-breakdown / role-breakdown) 추가, 세션 캐시 + 새로고침 버튼. iter.8: 사이드바 슬림화, Overview compact detail-header, 10게임 OP.GG row format, 탭 전환 skeleton. iter.7: 상태색 알파 토큰 9종, Georgia 제거, 760px 통합, `--wr` fallback. 그 이전: `--tint-*`, `--shadow-hover`, skeleton/shimmer, 좁은 모바일 대응, reduced-motion 대응
```

- [ ] **Step 7.4: Commit 7**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add design-tokens.md README.md
git commit -m "$(cat <<'EOF'
docs: update design-tokens.md + README for iteration 9

- design-tokens.md: new section for wr-bar, panel--recent-aggregate,
  breakdown-row, refresh-btn patterns. §10 adds closeout entry
  #20 for the multi-match cumulative view.
- README.md: prepend iter.9 bullet to "최근 UI 정리".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7.5: Verify**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD | head -8
git status --short
```

Expected: 8 commits, clean working tree.

---

## Task 8: Final Verification

**Files:**

- Create (gitignored): `test-artifacts/design-audit/iter9-post.md`

- [ ] **Step 8.1: Post audit**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node scripts/design-audit.js --scope all --format markdown --top 20 --output test-artifacts/design-audit/iter9-post.md
```

- [ ] **Step 8.2: Audit diff**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
diff -u test-artifacts/design-audit/iter9-baseline.md test-artifacts/design-audit/iter9-post.md | head -60
```

Expected:

- Colors coverage: ≥ 88.5% (baseline)
- Radius / Spacing / FontSize: no regression
- `@media (max-width: 760px)` count: 1

- [ ] **Step 8.3: Data-* attribute count delta**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
grep -rn 'data-[a-z-]\+' /Users/a1234/Documents/Web_LOL_Banpick/index.html /Users/a1234/Documents/Web_LOL_Banpick/main.js | wc -l
```

Compare with the baseline at start of this branch. Expected: net increase around +10 (~13 new data-* added: data-recent-aggregate, data-refresh-stats, data-overall-*, data-recent-aggregate-status, data-champion-breakdown*, data-role-breakdown*, data-wr-fill). No unexpected removals.

- [ ] **Step 8.4: Server smoke test**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node server.js > /tmp/server.log 2>&1 &
SERVER_PID=$!
sleep 2

echo "GET /:"
curl -sS --max-time 5 http://127.0.0.1:8123/ | head -5
echo "---"
echo "GET /api/samples:"
curl -sS --max-time 5 http://127.0.0.1:8123/api/samples | head -c 200
echo
echo "---"
echo "Key elements:"
curl -sS --max-time 5 http://127.0.0.1:8123/ > /tmp/served.html
for class in panel--recent-aggregate panel--champion-breakdown panel--role-breakdown refresh-btn wr-bar breakdown-list; do
  printf "%-32s: " "$class"
  grep -c "$class" /tmp/served.html
done

kill $SERVER_PID 2>/dev/null
wait 2>/dev/null
```

Expected: each class count ≥ 1.

- [ ] **Step 8.5: Manual flow (macOS browser)**

Open http://127.0.0.1:8123 and run:

1. Login with test account (매운맛 비스킷 / KR1 / KR)
2. Click 추세 tab (tab-trends) → should see skeleton → 20-match fetch completes → 3 new panels render
   - Verify: W-L record, wr-bar, KDA/CS/duration values
   - Verify: top-5 champions with sorted count
   - Verify: role breakdown with 1-5 roles
3. Click 새로고침 button → button shows "불러오는 중…" + disabled → re-fetch → new data
4. Re-click 추세 tab (leave and come back) → instant display, no skeleton
5. Logout → re-login with a different-case account name → click 추세 → should re-fetch (account key change)
6. Check mobile viewport (DevTools ≤760px) → breakdown rows stack into 3 lines; wr-bar is full-width
7. Verify existing panel--trends AI qualitative still renders at top; panel--reports + panel--evidence still at bottom

If anything misbehaves, note which task owns the bug, go fix, add a `fix:` commit, then re-verify.

- [ ] **Step 8.6: Rate-limit scenario**

Click 새로고침 twice in quick succession (within 10 seconds). Expected: second click either fails with the friendly message or the button is still disabled (because `state.recentStatsLoading = true`). No console errors.

- [ ] **Step 8.7: Empty state scenario**

Low-noise: if any test account has 0 recent matches (hard to produce in practice), the empty state should show "최근 경기 없음". If you cannot reproduce naturally, manually test by setting `state.recentStats = { overall: { count: 0, wins: 0, losses: 0, wrPct: 0, avgKda: 0, avgCsPerMin: 0, avgDurationSec: 0 }, byChampion: [], byRole: [] }` in devtools and calling `renderRecentAggregate(); renderChampionBreakdown(); renderRoleBreakdown();` — verify text reads "—" / "최근 경기 없음".

## Task 9: Close Out

- [ ] **Step 9.1: Summary commit list**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD
```

Expected: 8-9 commits (spec + Task 1 through Task 7 + any fix).

- [ ] **Step 9.2: Hand-off to user**

Present to the user:

- Commit count
- design-audit coverage numbers (before/after)
- Data-* attribute delta
- Manual flow results
- Any deferred issues

Wait for user instruction on push/merge. Do not push or merge without explicit approval.

---

## Rollback Strategy

Each commit is an independent logical unit. Per-task revert:

- Task 1 (pure function): `git revert <sha>` — function becomes undefined; Tasks 3-5 renderers would crash only when called, which happens on tab-trends enter. If this Task is reverted, Task 3's `maybeFetchRecentStats` will still try to call `aggregateRecentStats` and error — so this revert requires also removing the fetch hook.
- Task 2 (styles): safe to revert independently; new classes simply lose styling.
- Task 3 (recent-aggregate panel): revert leaves champion/role panels rendering but the top panel gone. Would produce visually awkward layout; revert if needed with Task 4-5 together.
- Tasks 4/5/6/7: each can be reverted independently.

Full revert: `git reset --hard origin/main` (destructive — requires user confirmation).

---

## Known Deferred Work

- **큐타입·시간대 분석** (brainstorming B3/B4/B5): `byQueue` breakdown, recent vs earlier comparison. Needs additional rows in `aggregateRecentStats` and a 4th panel.
- **AI 크로스-매치 프롬프트** (brainstorming D): `/api/aggregate-ai` endpoint feeding the 20 matches to Claude/Codex for a meta-analysis. Requires server change and prompt design.
- **SVG/Canvas 차트**: KDA over time line chart. Would replace or augment the breakdown-row grid.
- **50경기+ 페이징**: multi-call with `hasMore` pagination. Rate-limit has 10-second throttle per IP — need queue/backoff on client.
- **챔피언 클릭 → 해당 저장 샘플 이동**: bridge quantitative and qualitative sides. Requires matching the champion name with existing manifest entries.
- **계정별 독립 캐시**: multi-account fast switching. Current impl invalidates on switch; a Map keyed by accountKey would cache all.
- **빈 champion data edge case**: currently `champion = "Unknown"` bucket exists but rarely surfaces. Confirm display is acceptable when present.
