# Layout & IA Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이드바를 슬림화하고, Overview 상단을 compact detail-header로 압축하고, 10게임 리스트를 OP.GG row format으로 바꾸고, 탭 전환 skeleton을 추가해 정보 밀도와 시각 계층을 한 단계 올린다.

**Architecture:** 기존 `index.html` DOM 구조를 단계적으로 교체. `main.js`의 `data-*` 셀렉터는 최대한 보존하면서 renderHero/renderCandidates/switchTab 세 함수만 교체·확장. `styles.css`는 신규 컴포넌트(.identity-card, .match-row, .detail-header, .detail-metrics) 스타일을 추가하고 죽는 `.section-nav` 등은 삭제.

**Tech Stack:** Vanilla HTML + CSS Custom Properties (iter.7에서 정리된 88% 커버리지 토큰 시스템) + Vanilla JS. 테스트는 design-audit CLI + 수동 플로우 스팟 체크.

**Spec:** [docs/superpowers/specs/2026-04-24-layout-redesign-design.md](../specs/2026-04-24-layout-redesign-design.md)

---

## File Structure

**변경 파일 (5)**

- **Modify** `index.html` — topbar 삭제, sidebar 재구성, detail-header 도입, match-list 컨테이너 변경, eyebrow 15+곳 정리
- **Modify** `styles.css` — 4개 신규 컴포넌트 스타일, `.section-nav`/`.candidate-card--button` 제거, 기타 정리
- **Modify** `main.js` — renderHero → renderIdentityCard + renderDetailHeader, renderCandidates → renderMatchRows, switchTab에 skeleton 로직 추가, dom selector 갱신
- **Modify** `design-tokens.md` — 신규 컴포넌트 패턴, 760px row wrap 동작 기록
- **Modify** `README.md` — iter.8 한 줄 요약

**생성 파일 (2, baseline)**

- **Create** `test-artifacts/design-audit/iter8-baseline.md` — 변경 전 audit 스냅샷 (gitignored)
- **Create** `test-artifacts/layout-redesign/pre-attributes.txt` — 변경 전 `grep data-` 스냅샷 (gitignored, add pattern if needed)

**비변경**

- `admin.html`, `admin.css`, `admin.js`, `draft-state.js`, `server.js`, `data/**`, 기타 문서

---

## Task 0: Baseline Capture

**Files:**

- Create: `test-artifacts/design-audit/iter8-baseline.md`
- Create: `test-artifacts/layout-redesign/pre-attributes.txt`
- Modify: `.gitignore` (add `test-artifacts/layout-redesign/` if not already covered)

- [ ] **Step 0.1: design-audit baseline capture**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
mkdir -p test-artifacts/design-audit test-artifacts/layout-redesign
node scripts/design-audit.js --scope all --format markdown --top 20 --output test-artifacts/design-audit/iter8-baseline.md
```

Expected: file created with Colors coverage around 88.0%, Breakpoints `max-width: 760px` x1, `--wr` no warning.

- [ ] **Step 0.2: data-* attribute baseline snapshot**

```bash
grep -rn 'data-[a-z-]\+' /Users/a1234/Documents/Web_LOL_Banpick/index.html /Users/a1234/Documents/Web_LOL_Banpick/main.js > /Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/layout-redesign/pre-attributes.txt
wc -l /Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/layout-redesign/pre-attributes.txt
```

Expected: non-zero line count (~300+ lines containing `data-` attributes across the 2 files).

- [ ] **Step 0.3: add test-artifacts/layout-redesign/ to .gitignore if absent**

```bash
grep -q "test-artifacts/layout-redesign/" /Users/a1234/Documents/Web_LOL_Banpick/.gitignore || echo "test-artifacts/layout-redesign/" >> /Users/a1234/Documents/Web_LOL_Banpick/.gitignore
cat /Users/a1234/Documents/Web_LOL_Banpick/.gitignore
```

Expected: `.gitignore` includes both `test-artifacts/design-audit/` and `test-artifacts/layout-redesign/`.

- [ ] **Step 0.4: verify git status clean except for .gitignore**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git status --short
```

Expected: only `M .gitignore` (if the layout-redesign line was added). No baselines tracked.

- [ ] **Step 0.5: no commit yet**

`.gitignore` change will be bundled with Task 7 (docs commit) or a trailing chore commit. Leave uncommitted.

---

## Task 1: Add New Component Base Styles (Commit 1)

**Files:**

- Modify: `styles.css` — append new component styles (at the end of the relevant layout section, before the responsive media queries; typical insertion point: around the existing `.candidate-card` styles block at L199 area, or as a new section before `@media (max-width: 1180px)`)

**Goal:** Add CSS for `.identity-card`, `.match-row`, `.detail-header`, `.detail-metrics`. Do NOT modify HTML or JS — these new classes are unused in this commit.

- [ ] **Step 1.1: Find insertion location in styles.css**

```bash
grep -n "^@media (max-width: 1180px)" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: one line, around L2970-2985. Insert new styles **just above** this line (so they're still in the default desktop rules block).

- [ ] **Step 1.2: Insert the 4 new component blocks**

Add this block right before the first `@media (max-width: 1180px) {` line. Use proper indentation (no indentation — top-level selectors).

```css
/* ── iteration 8: layout redesign components ──────────────────────── */

.identity-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
}

.identity-card__avatar {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--surface-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: var(--text);
  overflow: hidden;
}

.identity-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.identity-card__body strong {
  font-size: var(--fs-md);
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-card__body .meta-label {
  font-size: var(--fs-xs);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-5);
  background: linear-gradient(90deg, var(--tint-amber), var(--panel) 42%), var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow);
  margin-bottom: var(--space-4);
}

.detail-header__main {
  flex: 1;
  min-width: 0;
}

.detail-header__title {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-2xl);
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.01em;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.detail-header__title .dot {
  color: var(--muted);
  font-weight: 400;
}

.detail-header__headline {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-md);
  color: var(--text);
  line-height: 1.4;
}

.detail-header__summary {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-header__result {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
  flex-shrink: 0;
}

.detail-header__duration {
  font-size: var(--fs-sm);
  color: var(--muted);
}

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.detail-metrics .metric {
  padding: var(--space-3) var(--space-4);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.detail-metrics .metric strong {
  font-size: var(--fs-lg);
  color: var(--text);
}

.match-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  color: var(--text);
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
  text-align: left;
  position: relative;
  overflow: hidden;
}

.match-row::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--line);
  transition: background 180ms ease;
}

.match-row[data-result="WIN"]::before { background: var(--mint); }
.match-row[data-result="LOSS"]::before { background: var(--rose); }

.match-row:hover,
.match-row[aria-pressed="true"] {
  transform: translateY(-1px);
  border-color: var(--info-border);
  background: var(--info-soft);
  box-shadow: var(--shadow-hover);
}

.match-row__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--surface-3);
  flex-shrink: 0;
}

.match-row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.match-row__title {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
  font-size: var(--fs-md);
}

.match-row__champion {
  font-weight: 700;
  color: var(--text);
}

.match-row__role,
.match-row__queue,
.match-row__patch {
  font-size: var(--fs-sm);
  color: var(--muted);
}

.match-row__stats {
  display: flex;
  gap: var(--space-3);
  font-size: var(--fs-sm);
  color: var(--muted);
  flex-wrap: wrap;
}

.match-row__kda {
  color: var(--text);
  font-weight: 600;
}

.match-row__result {
  flex-shrink: 0;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: var(--fs-sm);
  letter-spacing: 0.08em;
}

.match-row__result[data-result="WIN"] {
  background: var(--mint-bg-medium);
  color: var(--mint);
}

.match-row__result[data-result="LOSS"] {
  background: var(--rose-bg-medium);
  color: var(--rose);
}

.match-list-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Skeleton variant for tab transition — extends existing .skeleton system */
.tab-page[data-rendering="true"] .tab-page__real-content {
  display: none;
}

.tab-page__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.tab-page[data-rendering="true"] .tab-page__skeleton {
  display: flex;
}

.tab-page:not([data-rendering="true"]) .tab-page__skeleton {
  display: none;
}
```

- [ ] **Step 1.3: Add responsive rules for match-row wrap at ≤760px**

Inside the existing `@media (max-width: 760px)` block, add these rules. Find the block with `grep -n "@media (max-width: 760px)" /Users/a1234/Documents/Web_LOL_Banpick/styles.css` (expected 1 line after iter.7's merge). Insert near the end of the block, just before the closing `}`:

```css
  /* iteration 8: match-row + detail-header responsive */
  .match-row {
    flex-wrap: wrap;
    row-gap: var(--space-2);
  }

  .match-row__result {
    order: 10; /* keep result to the right, but allow wrap above */
  }

  .match-row__stats {
    flex-basis: 100%;
  }

  .detail-header {
    flex-direction: column;
    gap: var(--space-3);
  }

  .detail-header__result {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
```

- [ ] **Step 1.4: Run design-audit to confirm no regression**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node scripts/design-audit.js --scope colors --format text --top 2
```

Expected: `Token coverage: 88.0%` or higher (new styles use only existing tokens, no new raw literals).

Also check custom-prop scope:

```bash
node scripts/design-audit.js --scope customProps --format text
```

Expected: still no missing custom property references.

- [ ] **Step 1.5: Commit 1**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add styles.css
git commit -m "$(cat <<'EOF'
feat(styles): add base styles for .identity-card, .match-row, .detail-header

Introduce 4 new component styles for the iteration 8 layout
redesign. Uses only existing tokens (--mint/rose/amber-bg-*,
--surface-*, --tint-*, --space-*, --radius-*, --shadow*).
Responsive wrap rules for match-row + detail-header added to
the merged 760px block from iter.7.

Styles only; no HTML or JS changes yet — these classes are
unused until Tasks 2-5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 1.6: Verify commit**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD
```

Expected: 2 commits (spec commit from earlier + Commit 1 just made).

---

## Task 2: Replace candidate-card with match-row in 10-Match List (Commit 2)

**Files:**

- Modify: `index.html` — `.match-list-grid` → `.match-list-rows`
- Modify: `main.js` — replace `renderCandidates` function body (around L2108-2139) with match-row template
- Modify: `styles.css` — remove `.candidate-card--button` rule (and its ::before mini bar) if safe. Keep `.candidate-card` base rules for any other non-button usage. Actually **do NOT delete `.candidate-card` related rules yet** — verify no other usage first.

**Goal:** Convert the 10-match recent list to one-line OP.GG-style rows. Click behavior and aria states preserved.

- [ ] **Step 2.1: Update `index.html` match-list container class**

Find the `<div class="match-list-grid" data-match-list-grid></div>` line (around L54 in the current file):

```bash
grep -n "match-list-grid" /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: 1 line. Use Edit to change:

- old: `<div class="match-list-grid" data-match-list-grid></div>`
- new: `<div class="match-list-rows" data-match-list-grid></div>`

The `data-match-list-grid` attribute is preserved (JS still queries by it). Only the class name changes.

- [ ] **Step 2.2: Update `main.js` renderCandidates function**

Find the function at L2108:

```bash
grep -n "function renderCandidates" /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: 1 line, around L2108. Read the function body (L2108-2139) to understand context.

Replace the entire function body with the new template. Use Edit with the full current body as old_string and this new body as new_string:

**Old** (starts at `function renderCandidates(matches) {` and ends at the closing `}` before `function inferMatchIdFromSampleEntry`):

```javascript
function renderCandidates(matches) {
  dom.candidateList.innerHTML = matches
    .map(
      (match) => `
        <button class="candidate-card candidate-card--button" type="button" data-generate-match="${match.matchId}">
          <div class="candidate-head">
            <div class="champion-inline">
              ${championAvatarMarkup(match.champion, "medium")}
              <div class="candidate-head__copy">
                <span class="meta-label">${match.matchId}</span>
                <h4>${championDisplayName(match.champion)}</h4>
                ${candidateIdentityMetaMarkup(match)}
              </div>
            </div>
            <span class="candidate-fit">fit ${match.sampleFitScore}</span>
          </div>
          <div class="candidate-meta candidate-meta--primary">
            <span>${match.role}</span>
            <span class="candidate-result" data-result="${match.result}">${resultLabel(match.result)}</span>
            <span>${match.durationLabel}</span>
            <span>${matchPatchLabel(match.gameVersion)}</span>
            <span>${match.kills}/${match.deaths}/${match.assists}</span>
          </div>
          <div class="candidate-meta candidate-meta--secondary">
            <span>${buildCandidateCardSummary(match)}</span>
          </div>
          <p>${match.champion} ${match.role} 기준으로 바로 샘플 생성 가능한 경기입니다.</p>
        </button>
      `,
    )
    .join("");
}
```

**New**:

```javascript
function renderCandidates(matches) {
  dom.candidateList.innerHTML = matches
    .map(
      (match) => `
        <button class="match-row" type="button" data-generate-match="${match.matchId}" data-result="${match.result}" aria-pressed="false">
          <span class="match-row__icon">${championAvatarMarkup(match.champion, "medium")}</span>
          <div class="match-row__main">
            <div class="match-row__title">
              <strong class="match-row__champion">${championDisplayName(match.champion)}</strong>
              <span class="match-row__role">${match.role || ""}</span>
              <span class="match-row__queue">${compactQueueLabel(match.queueType) || ""}</span>
              <span class="match-row__patch">${matchPatchLabel(match.gameVersion) || ""}</span>
            </div>
            <div class="match-row__stats">
              <span class="match-row__kda">${match.kills}/${match.deaths}/${match.assists}</span>
              <span class="match-row__duration">${match.durationLabel || ""}</span>
              <span class="match-row__cs">${buildCandidateCardSummary(match)}</span>
            </div>
          </div>
          <span class="match-row__result" data-result="${match.result}">${resultLabel(match.result)}</span>
        </button>
      `,
    )
    .join("");
}
```

Note: we drop `candidate-card--button`, `candidate-head`, `candidate-meta--primary/secondary`, `candidate-fit` (sampleFitScore), `candidateIdentityMetaMarkup(match)`, and the trailing `<p>` copy. These were supplementary; the new row is denser.

- [ ] **Step 2.3: Verify championAvatarMarkup signature compatibility**

The new template uses a third argument `championAvatarMarkup(match.champion, "medium", "match-row__icon")` to add an extra class. Check the current signature:

```bash
grep -n "function championAvatarMarkup" /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Read the function to check if it accepts a third parameter for class names. If it does not, use the 2-arg call `championAvatarMarkup(match.champion, "medium")` and wrap the output in a `<span class="match-row__icon">...</span>` tag:

```javascript
<span class="match-row__icon" aria-hidden="true">${championAvatarMarkup(match.champion, "medium")}</span>
```

Use whichever form works without changing `championAvatarMarkup` itself (out of scope for this task).

- [ ] **Step 2.4: Manually verify rendering**

Start the server and open the app:

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node server.js &
SERVER_PID=$!
sleep 2
# Open http://127.0.0.1:8123 manually in a browser, or curl for HTML
curl -sS --max-time 5 http://127.0.0.1:8123/ | grep -c "match-list-rows"
kill $SERVER_PID 2>/dev/null
```

Expected: `1` (the new class is present in the served HTML).

- [ ] **Step 2.5: Clean up unused .candidate-card--button rules in styles.css**

Check whether the class is still referenced:

```bash
grep -c "candidate-card--button" /Users/a1234/Documents/Web_LOL_Banpick/main.js /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: `main.js: 0, index.html: 0`.

Then remove the CSS rule. Find all `.candidate-card--button` selectors:

```bash
grep -n "candidate-card--button" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 2-3 lines in `styles.css`. For each, delete the full rule block (selector + body). Leave `.candidate-card` (base) rules intact since other selectors may extend it.

Re-run:

```bash
grep -c "candidate-card--button" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: `0`.

- [ ] **Step 2.6: Commit 2**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add index.html main.js styles.css
git commit -m "$(cat <<'EOF'
refactor(html,js,styles): replace candidate-card with match-row in 10-match list

- index.html: .match-list-grid → .match-list-rows
- main.js: renderCandidates now emits .match-row template
  (champion icon, champion name, role/queue/patch, KDA/duration/cs,
  result pill). Click handler, data-generate-match, and aria-pressed
  preserved.
- styles.css: drop unused .candidate-card--button rules; .candidate-card
  base rules kept for other usages.

Closes spec §3.5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2.7: Verify**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD | head -3
grep -c "match-row" /Users/a1234/Documents/Web_LOL_Banpick/main.js
grep -c "candidate-card--button" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Expected: 3 commits, `match-row` count ≥ 8 in main.js (template + styles + class names), `candidate-card--button` count 0 in styles.css.

---

## Task 3: Compact Detail Header (Commit 3)

**Files:**

- Modify: `index.html` — replace `.panel--headline` + `.panel--snapshot` two panels with `.detail-header` + `.detail-metrics` in tab-overview (around L181-232 in the current file)
- Modify: `main.js` — split renderHero into renderIdentityCard (sidebar portion) + renderDetailHeader (tab-overview portion). Also update `dom` selector refs.
- Modify: `styles.css` — if any dead `.panel--headline` / `.panel--snapshot` rules remain, clean them up (but only after confirming DOM usage is 0)

**Goal:** Compact the overview top area. Preserve champion-hero-banner (which is dynamically injected inside tab-overview by renderHero). The new detail-header sits between the champion-hero-banner and the stat-ribbon.

- [ ] **Step 3.1: Update index.html — replace panel--headline + panel--snapshot**

Find the region in `index.html`:

```bash
grep -n "panel--headline\|panel--snapshot" /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: 2 lines indicating the two panels around L181 and L189.

Read lines ~179-232 to see the current content. Replace the entire `<section class="summary-grid"...>...</section>` block with:

**Old:**

```html
          <section class="summary-grid" id="overview" aria-labelledby="overview-title">
            <h2 class="sr-only" id="overview-title">경기 개요</h2>
          <article class="panel panel--headline">
            <p class="eyebrow">Headline</p>
            <h2 data-headline></h2>
            <p class="summary-copy" data-overall-summary></p>
            <p class="summary-detail" data-game-flow-summary></p>
            <div class="winloss-pill" data-result-pill></div>
          </article>

          <article class="panel panel--snapshot" aria-labelledby="snapshot-title">
            <div class="section-heading section-heading--compact">
              <div>
                <p class="eyebrow">Quick View</p>
                <h3 id="snapshot-title">상단 요약 바</h3>
              </div>
              <p class="section-copy">전적 사이트처럼 경기 핵심 정보를 먼저 압축해서 보여줍니다.</p>
            </div>
            <div class="snapshot-grid">
              <div class="snapshot-item">
                <span class="meta-label">Champion</span>
                <div class="champion-inline champion-inline--snapshot">
                  <span class="champion-avatar champion-avatar--large" data-snapshot-champion-icon aria-hidden="true"></span>
                  <strong data-snapshot-champion></strong>
                </div>
              </div>
              <div class="snapshot-item">
                <span class="meta-label">Role</span>
                <strong data-snapshot-role></strong>
              </div>
              <div class="snapshot-item">
                <span class="meta-label">Result</span>
                <strong data-snapshot-result></strong>
              </div>
              <div class="snapshot-item">
                <span class="meta-label">Queue</span>
                <strong data-snapshot-queue></strong>
              </div>
              <div class="snapshot-item">
                <span class="meta-label">Duration</span>
                <strong data-snapshot-duration></strong>
              </div>
              <div class="snapshot-item">
                <span class="meta-label">Patch</span>
                <strong data-snapshot-patch></strong>
              </div>
              <div class="snapshot-item snapshot-item--mastery" data-snapshot-mastery hidden>
                <span class="meta-label">Mastery</span>
                <strong data-snapshot-mastery-text></strong>
              </div>
            </div>
            <p class="snapshot-footnote">분석 신뢰도 <strong data-snapshot-confidence></strong></p>
          </article>
          </section>
```

**New:**

```html
          <section class="summary-grid" id="overview" aria-labelledby="overview-title">
            <h2 class="sr-only" id="overview-title">경기 개요</h2>
            <article class="detail-header" data-detail-header>
              <div class="detail-header__main">
                <h2 class="detail-header__title">
                  <span data-snapshot-champion></span>
                  <span class="dot">·</span>
                  <span data-snapshot-role></span>
                </h2>
                <p class="detail-header__headline" data-headline></p>
                <p class="detail-header__summary" data-quick-summary></p>
              </div>
              <div class="detail-header__result">
                <span class="winloss-pill" data-result-pill></span>
                <span class="detail-header__duration" data-snapshot-duration></span>
              </div>
            </article>

            <div class="detail-metrics" data-detail-metrics>
              <div class="metric">
                <span class="meta-label">Queue</span>
                <strong data-snapshot-queue></strong>
              </div>
              <div class="metric">
                <span class="meta-label">CS/분</span>
                <strong data-snapshot-cs-per-min></strong>
              </div>
              <div class="metric">
                <span class="meta-label">Patch</span>
                <strong data-snapshot-patch></strong>
              </div>
              <div class="metric metric--mastery" data-snapshot-mastery hidden>
                <span class="meta-label">Mastery</span>
                <strong data-snapshot-mastery-text></strong>
              </div>
            </div>
          </section>
```

**Key changes**:

- Delete `data-overall-summary`, `data-game-flow-summary`, `data-snapshot-result`, `data-snapshot-confidence`
- Add `data-detail-header`, `data-quick-summary`, `data-detail-metrics`, `data-snapshot-cs-per-min`
- `data-snapshot-champion-icon` is removed from this section (still exists in champion-hero-banner which renderHero injects dynamically)
- Preserve: `data-headline`, `data-snapshot-champion`, `data-snapshot-role`, `data-snapshot-queue`, `data-snapshot-duration`, `data-snapshot-patch`, `data-snapshot-mastery`, `data-snapshot-mastery-text`, `data-result-pill`

- [ ] **Step 3.2: Update main.js dom selectors**

Find the dom object in main.js:

```bash
grep -n "^const dom\|^  sampleId\|overallSummary\|gameFlowSummary\|snapshotResult\|snapshotConfidence\|snapshotChampionIcon\|quickSummary\|detailHeader" /Users/a1234/Documents/Web_LOL_Banpick/main.js | head -30
```

In the `const dom = { ... }` object (around L40-90), make these edits (use Edit per line):

**Remove lines** (delete entire line):

- `overallSummary: document.querySelector("[data-overall-summary]"),`
- `gameFlowSummary: document.querySelector("[data-game-flow-summary]"),`
- `snapshotResult: document.querySelector("[data-snapshot-result]"),`
- `snapshotConfidence: document.querySelector("[data-snapshot-confidence]"),`

**Keep but note they may be null** (if `snapshotChampionIcon` was referring to the one inside the deleted panel — it's still used elsewhere, verify):

```bash
grep -n "data-snapshot-champion-icon" /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: should be 0 after Step 3.1 (deleted from snapshot-grid). The `dom.snapshotChampionIcon = document.querySelector(...)` will return null. renderHero currently uses it (L1080). We'll update renderHero in Step 3.4.

**Add after `snapshotPatch`**:

```javascript
  detailHeader: document.querySelector("[data-detail-header]"),
  quickSummary: document.querySelector("[data-quick-summary]"),
  snapshotCsPerMin: document.querySelector("[data-snapshot-cs-per-min]"),
```

- [ ] **Step 3.3: Update `renderHero` in main.js — remove references to deleted selectors, add new ones**

Read the current `renderHero` function starting at L1061 (about 80 lines). The critical edits:

**Remove** these lines (they reference deleted selectors):

- `dom.overallSummary.textContent = coachSummary.overallSummary || match.headline || sample.theme || "";`
- `dom.gameFlowSummary.textContent = coachSummary.gameFlowSummary || coachSummary.winLossReason || "";`
- `if (dom.snapshotResult) dom.snapshotResult.textContent = resultText;`
- `dom.snapshotConfidence.textContent = ...;` (1 or 2 lines)

**Add** after the existing `dom.headline.textContent = ...` line:

```javascript
  if (dom.quickSummary) {
    const primary = coachSummary.overallSummary?.split(/[.!?]\s/)[0]?.trim();
    const fallback = coachSummary.gameFlowSummary?.slice(0, 120)?.trim();
    dom.quickSummary.textContent = primary || fallback || sample.theme || "";
  }
```

**Add** after the existing `dom.snapshotPatch.textContent = ...` line:

```javascript
  if (dom.snapshotCsPerMin) {
    const cs = sample.normalized?.playerStats?.csPerMinute;
    dom.snapshotCsPerMin.textContent = typeof cs === "number" ? cs.toFixed(2) : "—";
  }
```

Verified path: `playerStats.csPerMinute` is already used at main.js:1157 inside `renderStats` (note is `분당 ${(ps.csPerMinute ?? 0).toFixed(2)}`). Use `.toFixed(2)` for consistency with that display convention.

**Handle `snapshotChampionIcon` null case**: Wrap the existing `if (dom.snapshotChampionIcon) { ... }` block — it already has that guard (L1080), so it becomes a no-op when the selector returns null. Safe. The champion-hero-banner (dynamically injected) still handles the champion art visualization.

- [ ] **Step 3.4: Clean up dead CSS rules (optional, safe)**

```bash
grep -c "panel--headline\|panel--snapshot\|snapshot-grid\|snapshot-item\|snapshot-footnote\|section-heading--compact\|summary-copy\|summary-detail" /Users/a1234/Documents/Web_LOL_Banpick/index.html /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: all 0 in both files (after Step 3.1 and 3.3).

If all 0, these CSS classes are dead. Find their rule blocks:

```bash
grep -n "^\.panel--headline\|^\.panel--snapshot\|^\.snapshot-grid\|^\.snapshot-item\|^\.snapshot-footnote\|^\.summary-copy\|^\.summary-detail\|^\.section-heading--compact" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

For each match, delete the whole rule block (selector + body + closing `}`). If a rule block groups multiple selectors (e.g., `.panel--headline, .panel--snapshot, .other {`), only remove the dead ones, keep the rest. **Be conservative** — if unsure, leave the rule (dead CSS is not harmful, just bloat). Optional cleanup; can be deferred to a later iteration.

- [ ] **Step 3.5: Test in browser**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node server.js &
SERVER_PID=$!
sleep 2
curl -sS --max-time 5 http://127.0.0.1:8123/ | grep -c "detail-header"
kill $SERVER_PID 2>/dev/null
```

Expected: at least `1` (the `.detail-header` class is in the served HTML).

Manual browser check recommended: load http://127.0.0.1:8123, log in or use saved account, click a saved sample, confirm the Overview tab shows the new detail-header with champion + role title, headline, summary, result pill + duration, and 3 metric tiles (Queue / CS/분 / Patch).

- [ ] **Step 3.6: Commit 3**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add index.html main.js styles.css
git commit -m "$(cat <<'EOF'
refactor(html,js,styles): merge headline+snapshot into compact detail-header

- index.html: replace .panel--headline and .panel--snapshot
  with .detail-header (title + headline + 1-line summary + result
  pill + duration) and .detail-metrics (Queue / CS/분 / Patch
  + hidden Mastery).
- main.js: remove dom selectors for overallSummary, gameFlowSummary,
  snapshotResult, snapshotConfidence; add detailHeader, quickSummary,
  snapshotCsPerMin. renderHero now writes a single quick-summary
  derived from coachSummary.overallSummary first sentence, falling
  back to gameFlowSummary slice.
- styles.css: remove now-dead .panel--headline/.panel--snapshot
  and related rules (best effort cleanup).

Closes spec §3.2 and parts of §3.3 (eyebrow in this region).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3.7: Verify**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD | head -4
grep -c "detail-header" /Users/a1234/Documents/Web_LOL_Banpick/index.html
grep -c "panel--headline\|panel--snapshot" /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: 4 commits, `detail-header` count ≥ 3 in index.html, `panel--headline|panel--snapshot` count 0 in index.html.

---

## Task 4: Slim Sidebar (Commit 4)

**Files:**

- Modify: `index.html` — replace `.hero-panel` with `.identity-card`, delete `.panel--nav`, wrap `.panel--fetcher` in `<details>`
- Modify: `main.js` — remove dom selectors for sectionNav, sampleId, heroMatch, themeCopy, heroPills; update renderHero (rename to renderIdentityCard or inline); remove sectionNav logic in switchTab / initTabSystem
- Modify: `styles.css` — add `.panel--fetcher[open]` / `<details>` styling if needed, clean up `.hero-panel` / `.section-nav` / `.section-link` dead rules

**Goal:** Sidebar becomes 3-stack: Identity Card + Sample Switcher + collapsed Intake. Dashboard space increases.

- [ ] **Step 4.1: Update index.html sidebar**

Find the `<aside class="sidebar-stack" ...>` block in index.html:

```bash
grep -n "sidebar-stack" /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: 1 line, around L67.

Read L67-150 to see the whole sidebar content. Replace the entire aside block:

**Old** (the whole `<aside class="sidebar-stack" aria-label="플레이어 허브">...</aside>` block):

```html
        <aside class="sidebar-stack" aria-label="플레이어 허브">
          <section class="hero-panel" aria-labelledby="player-hub-title">
            <div class="hero-copy">
              <p class="eyebrow">Player Hub</p>
              <h2 id="player-hub-title">검색과 식별 정보를 먼저 고정하는 전적 사이트형 사이드 레일</h2>
              <p class="hero-lede" data-theme-copy></p>
            </div>

            <div class="hero-meta">
              <article class="meta-card">
                <span class="meta-label">Sample</span>
                <strong data-sample-id></strong>
              </article>
              <article class="meta-card">
                <span class="meta-label">Player</span>
                <strong data-hero-player></strong>
              </article>
              <article class="meta-card">
                <span class="meta-label">Match</span>
                <strong data-hero-match></strong>
              </article>
              <article class="meta-card">
                <span class="meta-label">Collected</span>
                <strong data-hero-date></strong>
              </article>
            </div>
            <div class="hero-pills" data-hero-pills></div>
          </section>

          <nav class="panel panel--nav" aria-label="분석 섹션 바로가기">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Overview Tabs</p>
                <h3>리포트 빠른 이동</h3>
              </div>
            </div>
            <div class="section-nav" data-section-nav role="tablist">
              <button class="section-link tab-link" data-tab-target="tab-overview" role="tab" aria-selected="true">개요</button>
              <button class="section-link tab-link" data-tab-target="tab-analysis" role="tab">분석</button>
              <button class="section-link tab-link" data-tab-target="tab-timeline" role="tab">타임라인</button>
              <button class="section-link tab-link" data-tab-target="tab-trends" role="tab">추세</button>
            </div>
          </nav>

          <article class="panel panel--samples" aria-labelledby="sample-library-title">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Sample Library</p>
                <h3 id="sample-library-title">저장된 분석 샘플 전환</h3>
              </div>
              <p class="section-copy">프로필 카드처럼 샘플을 바꿔 보면서 역할, 승패, 분석 문체를 비교할 수 있습니다.</p>
            </div>
            <div class="sample-switcher" data-sample-switcher></div>
          </article>

          <article class="panel panel--fetcher" aria-labelledby="recent-match-title">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Riot API Intake</p>
                <h3 id="recent-match-title">최근 경기 후보 불러오기</h3>
              </div>
              <p class="section-copy">전적 사이트의 검색 바처럼 Riot ID를 넣고 최근 경기 후보를 조회합니다.</p>
            </div>

            <form class="fetch-form" data-recent-form aria-labelledby="recent-match-title">
              <label>
                <span>gameName</span>
                <input name="gameName" type="text" value="매운맛 비스킷" required minlength="3" maxlength="16" pattern="[a-zA-Z0-9가-힣\s_.]+" />
              </label>
              <label>
                <span>tagLine</span>
                <input name="tagLine" type="text" value="KR1" required minlength="2" maxlength="5" pattern="[a-zA-Z0-9]+" />
              </label>
              <label>
                <span>platform</span>
                <input name="platformRegion" type="text" value="KR" required />
              </label>
              <button type="submit">최근 경기 불러오기</button>
            </form>

            <div class="fetch-status" data-fetch-status aria-live="polite">sample-001 실데이터는 이미 저장되어 있습니다. 필요하면 최근 경기 후보를 다시 불러와 다른 샘플도 고를 수 있습니다.</div>
            <div class="candidate-list" data-candidate-list aria-live="polite"></div>
          </article>
        </aside>
```

**New:**

```html
        <aside class="sidebar-stack" aria-label="플레이어 허브">
          <article class="identity-card" data-identity-card aria-labelledby="identity-title">
            <span class="identity-card__avatar" data-snapshot-champion-icon aria-hidden="true"></span>
            <div class="identity-card__body">
              <strong id="identity-title" data-hero-player></strong>
              <span class="meta-label">Collected <span data-hero-date></span></span>
            </div>
          </article>

          <article class="panel panel--samples" aria-labelledby="sample-library-title">
            <h3 id="sample-library-title">저장된 샘플</h3>
            <div class="sample-switcher" data-sample-switcher></div>
          </article>

          <details class="panel panel--fetcher" data-fetcher-details>
            <summary>Riot ID로 최근 경기 재조회</summary>
            <form class="fetch-form" data-recent-form aria-label="Riot ID 재조회 폼">
              <label>
                <span>gameName</span>
                <input name="gameName" type="text" value="매운맛 비스킷" required minlength="3" maxlength="16" pattern="[a-zA-Z0-9가-힣\s_.]+" />
              </label>
              <label>
                <span>tagLine</span>
                <input name="tagLine" type="text" value="KR1" required minlength="2" maxlength="5" pattern="[a-zA-Z0-9]+" />
              </label>
              <label>
                <span>platform</span>
                <input name="platformRegion" type="text" value="KR" required />
              </label>
              <button type="submit">최근 경기 불러오기</button>
            </form>
            <div class="fetch-status" data-fetch-status aria-live="polite">sample-001 실데이터는 이미 저장되어 있습니다.</div>
            <div class="candidate-list" data-candidate-list aria-live="polite"></div>
          </details>
        </aside>
```

**Key changes**:

- `<section class="hero-panel">` → `<article class="identity-card">` with avatar + player + collected
- Deleted: data-sample-id, data-hero-match, data-theme-copy, data-hero-pills (and the .hero-copy / .hero-meta / .hero-pills wrappers)
- Deleted: the entire `<nav class="panel panel--nav">` block (data-section-nav, data-tab-target × 4)
- `<article class="panel panel--samples">` simplified: remove section-heading eyebrow/copy, just keep h3 + sample-switcher
- `<article class="panel panel--fetcher">` → `<details class="panel panel--fetcher">` with summary. Remove section-heading eyebrow/copy inside. Form + status + candidate-list are inside the `<details>` body.

- [ ] **Step 4.2: Update main.js dom selectors**

In the `const dom = { ... }` object, remove these lines:

- `sampleId: document.querySelector("[data-sample-id]"),`
- `heroMatch: document.querySelector("[data-hero-match]"),`
- `themeCopy: document.querySelector("[data-theme-copy]"),`
- `heroPills: document.querySelector("[data-hero-pills]"),`
- `sectionNav: document.querySelector("[data-section-nav]"),`

Keep: `heroPlayer`, `heroDate`, `snapshotChampionIcon` (this is now on identity-card), `sampleSwitcher`, `recentForm`, `fetchStatus`, `candidateList`.

- [ ] **Step 4.3: Update renderHero to remove deleted-selector writes**

In `renderHero(sample)` around L1061-1139, remove these lines:

- `dom.sampleId.textContent = sample.sampleId;`
- `dom.heroMatch.textContent = match.matchId;`
- `dom.themeCopy.textContent = sample.theme;`
- The entire `if (dom.heroPills) { ... }` block at the end of renderHero (about 12 lines)

Keep:
- `dom.heroPlayer.textContent = sample.publicAlias;`
- `dom.heroDate.textContent = sample.collectedDate;`
- The `dom.snapshotChampionIcon` block (it now targets the identity-card avatar instead of the snapshot-grid — same selector, same class, works unchanged)
- `dom.headline.textContent = ...`
- All other snapshot-related writes (retained in Task 3)

- [ ] **Step 4.4: Update switchTab and initTabSystem to remove sectionNav**

Find `switchTab` at L2801. Remove this block inside it:

```javascript
  // Update sidebar nav
  if (dom.sectionNav) {
    dom.sectionNav.querySelectorAll(".tab-link").forEach((link) => {
      const isActive = link.dataset.tabTarget === tabId;
      link.classList.toggle("tab-link--active", isActive);
      link.setAttribute("aria-selected", isActive);
    });
  }
```

Find `initTabSystem` at L2830. Remove this block:

```javascript
  // Sidebar nav click handler
  if (dom.sectionNav) {
    dom.sectionNav.addEventListener("click", (e) => {
      const link = e.target.closest(".tab-link");
      if (link && link.dataset.tabTarget) switchTab(link.dataset.tabTarget);
    });
  }
```

- [ ] **Step 4.5: Add sidebar styles for identity-card + details panel**

Find the `styles.css` location after `.match-row` rules (added in Task 1). Before the `@media (max-width: 1180px)` block, add:

```css
/* iteration 8: sidebar slim components */
.panel--fetcher {
  padding: var(--space-4);
}

.panel--fetcher > summary {
  cursor: pointer;
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--text);
  padding: var(--space-2) 0;
  list-style: none;
}

.panel--fetcher > summary::-webkit-details-marker {
  display: none;
}

.panel--fetcher > summary::before {
  content: "▸ ";
  display: inline-block;
  color: var(--muted);
  transition: transform 180ms ease;
}

.panel--fetcher[open] > summary::before {
  transform: rotate(90deg);
}

.panel--fetcher[open] > summary {
  margin-bottom: var(--space-3);
}
```

Also check existing `.hero-panel`, `.hero-copy`, `.hero-meta`, `.hero-pills`, `.panel--nav`, `.section-nav`, `.section-link` styles — confirm they are now unused:

```bash
grep -c "hero-panel\|hero-copy\|hero-meta\|hero-pills\|panel--nav\|section-nav\|section-link\|tab-link" /Users/a1234/Documents/Web_LOL_Banpick/index.html /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: 0 in index.html, 0 in main.js (after Steps 4.1-4.4).

Finding the dead CSS rule blocks is extensive — defer full cleanup to Task 7 (docs iteration closes) or Task 9 (final sweep). In this commit, at minimum remove `.section-nav` and `.section-link` rules (they are clearly specific to the deleted nav panel):

```bash
grep -n "^\.section-nav\|^\.section-link\|^\.tab-link" /Users/a1234/Documents/Web_LOL_Banpick/styles.css
```

Delete the rule blocks for these selectors. Keep `.hero-*` / `.panel--nav` rules as dead code for now — safer.

- [ ] **Step 4.6: Manual browser check**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node server.js &
SERVER_PID=$!
sleep 2
curl -sS --max-time 5 http://127.0.0.1:8123/ | grep -cE "identity-card|panel--fetcher\" |details"
kill $SERVER_PID 2>/dev/null
```

Expected: ≥ 2 (identity-card class + details element).

Manually: sidebar should show 3 blocks (identity-card / panel--samples / collapsed details). Clicking the details summary should expand. Sample switcher click should still update the detail view.

- [ ] **Step 4.7: Commit 4**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add index.html main.js styles.css
git commit -m "$(cat <<'EOF'
refactor(html,js,styles): slim sidebar — identity-card, no nav, <details> intake

- index.html: hero-panel (4 meta cards + lede + pills) becomes
  .identity-card (avatar + player + collected). panel--nav
  deleted entirely (tab-bar in main is the sole navigation).
  panel--fetcher converted to <details> with a summary, so the
  intake form is collapsed by default.
- main.js: drop dom selectors for sampleId, heroMatch, themeCopy,
  heroPills, sectionNav. renderHero no longer writes to these.
  switchTab and initTabSystem remove sectionNav-specific branches.
- styles.css: add .panel--fetcher summary styling (chevron,
  open-state rotation). Delete dead .section-nav/.section-link/
  .tab-link CSS rules (hero-* rules deferred to Task 9 cleanup).

Closes spec §3.1 and §2 item 1 (duplicate nav removal).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4.8: Verify**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD | head -5
grep -c "identity-card\|panel--fetcher" /Users/a1234/Documents/Web_LOL_Banpick/index.html
grep -c "hero-panel\|section-nav\|panel--nav" /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: 5 commits, `identity-card|panel--fetcher` count ≥ 2 in index.html, old sidebar classes count 0 in index.html.

---

## Task 5: Hide Topbar + Strip Section-Level Eyebrows (Commit 5)

**Files:**

- Modify: `index.html` — delete `<header class="topbar">...</header>` block; remove `<p class="eyebrow">...</p>` lines inside top-level `<section>` and outer `<article>` elements (keep inside `.meta-card`, `.snapshot-item`, or `.identity-card` etc.)
- Modify: `main.js` — no changes expected (no `data-topbar` or eyebrow references)
- Modify: `styles.css` — `.topbar` rules can stay (dead) or be deleted; defer

**Goal:** Remove decorative topbar and repeated section-level eyebrow labels.

- [ ] **Step 5.1: Delete the `.topbar` block**

Find it:

```bash
grep -n '<header class="topbar"' /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: 1 line, around L58.

Read L58-64 to see full block. Use Edit:

**Old:**

```html
      <header class="topbar">
        <div>
          <p class="eyebrow">Replay Coach Dashboard</p>
          <h1 class="topbar-title">전적 사이트 문법으로 다시 짠 LoL 복기 리포트</h1>
        </div>
        <p class="topbar-copy">왼쪽에서 플레이어와 샘플을 고르고, 오른쪽에서 경기 요약부터 개선 루틴까지 한 번에 탐색합니다.</p>
      </header>
```

**New:** (empty — entire block removed)

- [ ] **Step 5.2: Remove section-level eyebrows**

Find remaining `<p class="eyebrow">` lines in index.html:

```bash
grep -n 'class="eyebrow"' /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: multiple matches. For each match, evaluate the context:

- **If** the eyebrow is inside a `.section-heading` or directly inside a `<section>` / top-level `<article>` **→ REMOVE** the eyebrow line (and its surrounding `<div>` wrapper if it only contained the eyebrow + h3).
- **If** the eyebrow is inside a `.meta-card`, `.snapshot-item`, `.identity-card`, `.metric`, `.trend-callout` (card internals) **→ KEEP**.

The sections to clean (remove eyebrow):

- `section-block[id="score"]` — "Playtime Score" eyebrow
- `panel--phases` — "Phase Review"
- `panel--strengths` — "Strengths"
- `panel--weaknesses` — "Weaknesses"
- `section-block[id="comparison"]` — "AI Comparison"
- `panel--checklist` — "Next Game Checklist"
- `panel--moments` — "Key Moments"
- `section-block[id="dual-timeline"]` — "Battle Flow"
- `section-block[id="kda-timeline"]` — "KDA Flow"
- `section-block[id="vision"]` — "Vision Control"
- `section-block[id="build"]` — "Build Order"
- `section-block[id="objectives"]` — "Objective Timeline"
- `panel--trends` — "Player Trend"
- `panel--reports` — "Saved Reports"
- `panel--evidence` — "Evidence Ledger"

For each `.section-heading` block like:

```html
            <div class="section-heading">
              <div>
                <p class="eyebrow">Phase Review</p>
                <h3 id="phases-title">초반부터 후반까지 흐름 요약</h3>
              </div>
              <p class="section-copy">구간별 평점과 다음 게임에서 집중할 포인트를 한 번에 확인합니다.</p>
            </div>
```

Replace with the simpler form (h3 only, drop the inner `<div>` wrapper and `section-copy`):

```html
            <h3 id="phases-title">초반부터 후반까지 흐름 요약</h3>
```

Alternatively keep `.section-copy` where the copy genuinely adds value (e.g., the Saved Reports panel). For most panels, `section-copy` repeats what the h3 already says; remove.

Conservative approach: For this task, remove **only eyebrow and its wrapper div**, but keep section-copy if present. This reduces risk of over-editing:

```html
            <div class="section-heading">
              <h3 id="phases-title">초반부터 후반까지 흐름 요약</h3>
              <p class="section-copy">구간별 평점과 다음 게임에서 집중할 포인트를 한 번에 확인합니다.</p>
            </div>
```

Perform each edit in isolation — don't use replace_all (each eyebrow text is different). Use context-anchored Edit per section.

- [ ] **Step 5.3: Verify eyebrow cleanup**

```bash
grep -c 'class="eyebrow"' /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: either 0, or a small number (e.g., ≤3) if some eyebrows inside `.meta-card` / identity-card / metric were missed. The `data-hero-player` strong in identity-card may have a nested `.meta-label` which is NOT `.eyebrow` — verify by reading the file.

Target: ≤3 eyebrows remaining (in cases where eyebrow is genuinely inside a card, which should be rare given our Task 4 sidebar simplification).

- [ ] **Step 5.4: Manual browser check**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node server.js &
SERVER_PID=$!
sleep 2
curl -sS --max-time 5 http://127.0.0.1:8123/ | grep -c "topbar"
kill $SERVER_PID 2>/dev/null
```

Expected: `0` or `1` (topbar DOM removed; CSS rule name may still be referenced in styles.css but not in HTML).

Manually: load the page, log in, go to detail. Overview/분석/타임라인/추세 tabs should no longer show "Replay Coach Dashboard" / "Phase Review" / "AI Comparison" / etc. eyebrow labels. The h3 titles alone carry the section identity.

- [ ] **Step 5.5: Commit 5**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add index.html
git commit -m "$(cat <<'EOF'
refactor(html): hide dashboard topbar, strip section-level eyebrows

- Delete the <header class="topbar"> block from .app-shell;
  the login screen intro suffices for branding.
- Remove decorative <p class="eyebrow"> labels from ~15 section
  headings across Overview/Analysis/Timeline/Trends tabs and
  remaining sidebar panels. Card-internal .meta-label markers
  are retained since they carry information density.

Closes spec §3.3 and §3.4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5.6: Verify**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD | head -6
grep -c '<header class="topbar"' /Users/a1234/Documents/Web_LOL_Banpick/index.html
grep -c 'class="eyebrow"' /Users/a1234/Documents/Web_LOL_Banpick/index.html
```

Expected: 6 commits, 0 topbar in HTML, ≤3 eyebrows in HTML.

---

## Task 6: Tab Skeleton Placeholder (Commit 6)

**Files:**

- Modify: `main.js` — enhance `switchTab(tabId)` to insert `.skeleton--card` placeholders on first visit per tab, replace with real content after render
- Modify: `styles.css` — (optional) add `.tab-skeleton` helper styles if needed (base `.skeleton` exists from iter.6)

**Goal:** Eliminate blank flash when switching to a never-rendered tab.

- [ ] **Step 6.1: Verify existing skeleton utility**

```bash
grep -n "^\.skeleton" /Users/a1234/Documents/Web_LOL_Banpick/styles.css | head -10
```

Expected: existing `.skeleton`, `.skeleton--line`, `.skeleton--block`, `.skeleton--card` rules from iter.6. These are reusable.

- [ ] **Step 6.2: Update `switchTab` in main.js**

Find `switchTab` at L2801 (line may have shifted due to earlier tasks):

```bash
grep -n "^function switchTab" /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Replace the function body with this enhanced version. **Important**: preserve the tab-bar classList and tab-page classList updates from the current implementation.

**Old** (simplified to current state after Task 4):

```javascript
function switchTab(tabId) {
  const dashboard = document.getElementById("main-content");
  if (!dashboard) return;

  // Update tab-bar buttons
  dashboard.querySelectorAll(".tab-btn").forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle("tab-btn--active", isActive);
    btn.setAttribute("aria-selected", isActive);
  });

  // Update tab pages
  dashboard.querySelectorAll(".tab-page").forEach((page) => {
    page.classList.toggle("tab-page--active", page.id === tabId);
  });

  dashboard.dataset.activeTab = tabId;
  localStorage.setItem("lol-coach-active-tab", tabId);
}
```

**New:**

```javascript
function switchTab(tabId) {
  const dashboard = document.getElementById("main-content");
  if (!dashboard) return;

  // Update tab-bar buttons
  dashboard.querySelectorAll(".tab-btn").forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle("tab-btn--active", isActive);
    btn.setAttribute("aria-selected", isActive);
  });

  // Update tab pages
  dashboard.querySelectorAll(".tab-page").forEach((page) => {
    page.classList.toggle("tab-page--active", page.id === tabId);
  });

  const target = document.getElementById(tabId);
  if (target && !target.dataset.renderedOnce && tabId !== "tab-overview") {
    showTabSkeleton(target);
    // Minimum skeleton visibility (200ms) avoids visual flicker when
    // the subsequent render is synchronous and near-instant.
    setTimeout(() => {
      hideTabSkeleton(target);
      target.dataset.renderedOnce = "true";
    }, 200);
  }

  dashboard.dataset.activeTab = tabId;
  localStorage.setItem("lol-coach-active-tab", tabId);
}

function showTabSkeleton(tabPage) {
  if (tabPage.querySelector(".tab-page__skeleton")) return;
  const skel = document.createElement("div");
  skel.className = "tab-page__skeleton";
  skel.setAttribute("aria-hidden", "true");
  skel.innerHTML = `
    <div class="skeleton skeleton--block" style="height: 120px"></div>
    <div class="skeleton skeleton--block" style="height: 80px"></div>
    <div class="skeleton skeleton--block" style="height: 140px"></div>
  `;
  tabPage.prepend(skel);
  tabPage.dataset.rendering = "true";
}

function hideTabSkeleton(tabPage) {
  const skel = tabPage.querySelector(".tab-page__skeleton");
  if (skel) skel.remove();
  delete tabPage.dataset.rendering;
}
```

- [ ] **Step 6.3: Verify no JS errors in runtime**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node -c main.js || echo "syntax error"
```

Expected: no syntax error. `node -c` validates JS syntax without executing. If it reports "main.js:1:... Cannot use import statement outside a module" or similar, ignore — that's because main.js is browser-targeted. Check only for actual parse errors.

Actually `node -c` may fail on browser JS. Better: use a simple syntax check with `node --check`:

```bash
node --check /Users/a1234/Documents/Web_LOL_Banpick/main.js || echo "SYNTAX ERROR"
```

Expected: no `SYNTAX ERROR`. If it prints something, there's a syntax issue — review the edit.

- [ ] **Step 6.4: Manual browser check**

Load http://127.0.0.1:8123, log in, click through tabs:

- First click on 분석 (tab-analysis): should show skeleton placeholder ~200ms, then actual content
- First click on 타임라인 (tab-timeline): same
- First click on 추세 (tab-trends): same
- Re-click any tab: no skeleton, instant display
- Initial load on 개요 (tab-overview): no skeleton

Also test `prefers-reduced-motion: reduce` by enabling the OS-level reduced motion setting or devtools toggle. The shimmer animation should stop.

- [ ] **Step 6.5: Commit 6**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add main.js styles.css
git commit -m "$(cat <<'EOF'
feat(js): add tab skeleton placeholder during first transition

switchTab now inserts 3 .skeleton--block placeholders when a tab
(other than tab-overview) is visited for the first time, and
removes them after a 200ms minimum visibility window. The minimum
ensures no visual flicker when downstream render is synchronous.
data-rendered-once is sticky per tab-page so subsequent visits
are instant.

Honors prefers-reduced-motion via the existing .skeleton rule
(shimmer animation disabled automatically).

Closes spec §3.6 and progress.md "다음 추천 작업 #4".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6.6: Verify**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD | head -7
grep -c "showTabSkeleton\|hideTabSkeleton" /Users/a1234/Documents/Web_LOL_Banpick/main.js
```

Expected: 7 commits, skeleton helper function count ≥ 2.

---

## Task 7: Docs Update (Commit 7)

**Files:**

- Modify: `design-tokens.md` — add §1.x for iter.8 components (identity-card/match-row/detail-header), update §5 for 760px match-row wrap, §10 closeout
- Modify: `README.md` — append iter.8 summary bullet

- [ ] **Step 7.1: Update design-tokens.md — add component patterns**

Read the current design-tokens.md to find a suitable insertion location. After §7 (Tab component) and before §8 or similar. Use `grep -n "^## " /Users/a1234/Documents/Web_LOL_Banpick/design-tokens.md` to find section headers.

Add a new section (or append to the existing section on components):

```markdown
## 8. iteration 8 신규 컴포넌트

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

**탭 skeleton** — `.tab-page__skeleton` 컨테이너에 `.skeleton--block` 3개. `data-rendering="true"` 속성으로 실제 콘텐츠 숨김. 첫 진입 시 200ms 최소 노출, 재진입은 `data-rendered-once` 캐시로 즉시.
```

- [ ] **Step 7.2: Update design-tokens.md §5 breakpoints**

Find §5 (반응형 브레이크포인트). Append a note about iter.8 additions inside the 760px entry:

Locate the `@media (max-width: 760px)` bullet. Update it to mention:

```markdown
- `@media (max-width: 760px)` — 모바일 (iter.7에서 단일 블록으로 통합. iter.8에서 match-row flex-wrap + detail-header flex-column 규칙 추가. 내부에 Dual-track timeline 전용 섹션 보존)
```

- [ ] **Step 7.3: Update design-tokens.md §10 — close iteration**

Add a new closed item at the end of §10 (after #18):

```markdown
19. ~~**Layout / IA — 사이드바 비대, topbar 노이즈, Overview 삼중 텍스트, 10게임 카드 밀도, 탭 blank flash**~~ — **완료** (iteration 8). 사이드바 3단 슬림화(identity-card + sample-switcher + details intake), topbar 제거, detail-header + detail-metrics 병합, 10게임 OP.GG row format, 첫 진입 탭 skeleton placeholder. JS `data-*` 셀렉터 대부분 보존 (삭제: sampleId, heroMatch, themeCopy, heroPills, sectionNav, overallSummary, gameFlowSummary, snapshotResult, snapshotConfidence).
```

- [ ] **Step 7.4: Update README.md**

Find the "최근 UI 정리" bullet. Append iter.8 summary:

```bash
grep -n "최근 UI 정리" /Users/a1234/Documents/Web_LOL_Banpick/README.md
```

Replace the existing bullet with:

```markdown
- **최근 UI 정리** (iter.8): 사이드바 슬림화(identity-card + sample-switcher + collapsed intake), Overview compact detail-header + 3-tile metrics, 10게임 OP.GG row format, 탭 전환 skeleton placeholder. iter.7: 상태색 알파 토큰 9종, Georgia 제거, 760px 통합, `--wr` fallback. 그 이전: `--tint-*`, `--shadow-hover`, match-summary-card 엣지 바, skeleton/shimmer, 좁은 모바일 대응, reduced-motion 대응.
```

- [ ] **Step 7.5: Commit 7**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git add design-tokens.md README.md .gitignore
git commit -m "$(cat <<'EOF'
docs: update design-tokens.md + README for iteration 8

- design-tokens.md: new §8 for identity-card / match-row /
  detail-header / detail-metrics / tab skeleton patterns.
  §5 notes iter.8 additions inside the merged 760px block.
  §10 adds closeout entry #19.
- README.md: prepend iter.8 bullet to "최근 UI 정리".
- .gitignore: add test-artifacts/layout-redesign/ for the Task 0
  attribute snapshot artifact (local-only, not tracked).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7.6: Verify**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD | head -8
git status --short
```

Expected: 8 commits, clean working tree.

---

## Task 8: Final Verification

**Files:**

- Create (gitignored): `test-artifacts/design-audit/iter8-post.md`
- Create (gitignored): `test-artifacts/layout-redesign/post-attributes.txt`
- No source file changes

- [ ] **Step 8.1: Post-change audit**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node scripts/design-audit.js --scope all --format markdown --top 20 --output test-artifacts/design-audit/iter8-post.md
```

- [ ] **Step 8.2: Diff vs baseline**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
diff -u test-artifacts/design-audit/iter8-baseline.md test-artifacts/design-audit/iter8-post.md | head -80
```

Expected changes (acceptance):

- Colors coverage: **no regression** (88.0% or higher). Task 1 added styles that use only existing tokens; Tasks 2-6 replaced HTML but did not introduce raw rgba.
- Radius/Spacing/Font Size: no regression.
- `@media (max-width: 760px)` count: still 1 (no new duplicate media query).
- Custom Properties: no new missing references.
- Token reference count may rise (more tokens used in expanded components) — acceptable.

- [ ] **Step 8.3: data-* attribute diff**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
grep -rn 'data-[a-z-]\+' /Users/a1234/Documents/Web_LOL_Banpick/index.html /Users/a1234/Documents/Web_LOL_Banpick/main.js > /Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/layout-redesign/post-attributes.txt
wc -l /Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/layout-redesign/pre-attributes.txt /Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/layout-redesign/post-attributes.txt
```

Compute the difference. Expected: **post count ≤ pre count + 5** (a few additions like `data-detail-header`, `data-quick-summary`, `data-snapshot-cs-per-min`, `data-identity-card`, `data-fetcher-details` offset the removals like `data-sample-id`, `data-hero-match`, `data-theme-copy`, `data-hero-pills`, `data-section-nav`, `data-tab-target` × 4, `data-overall-summary`, `data-game-flow-summary`, `data-snapshot-result`, `data-snapshot-confidence`, `data-snapshot-champion-icon` (possibly removed from snapshot-grid but re-added on identity-card)).

Net: roughly −15 + 5 = −10 to −15 attributes. The spec target was "감소폭 5 이내" which really meant "don't delete accidentally beyond expected scope" — given the expected intentional removals, a ~15-line diff is correct.

Refine the acceptance rule: the **removed** attributes should match the list in §3 of the spec (exactly those enumerated). Any unexpected removal is a bug.

- [ ] **Step 8.4: Server smoke test**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
node server.js &
SERVER_PID=$!
sleep 2
echo "GET /:"
curl -sS --max-time 5 http://127.0.0.1:8123/ | head -5
echo "GET /api/samples:"
curl -sS --max-time 5 http://127.0.0.1:8123/api/samples | head -c 200
echo
kill $SERVER_PID 2>/dev/null
wait 2>/dev/null
```

Expected:

- `GET /` returns HTML starting with `<!DOCTYPE html>`
- `GET /api/samples` returns JSON with sample entries
- No server startup errors

- [ ] **Step 8.5: Manual flow check (macOS browser)**

Open http://127.0.0.1:8123 in a browser and run the 8-step flow from spec §5.2:

1. Login → 10게임 리스트 렌더 → 10개 row 모두 표시 (1080p)
2. Row click → 상세 진입, blank flash 없음
3. 분석 tab click → skeleton 3장 → 실제 콘텐츠. 재진입 시 skeleton 없음
4. 타임라인 → 추세 → 개요 왕복 → 첫 진입마다 skeleton, 이후 즉시
5. Sample Switcher click → 샘플 전환, aria-pressed 갱신, detail 리렌더
6. `<details>` Intake 열기 → 재조회 → candidate 갱신
7. 뒤로 버튼 → 10게임 리스트 복귀, 이전 선택 유지
8. 모바일 폭 (≤760px, ≤480px): 사이드바 상단 배너 변환, match-row wrap, 탭 2줄 wrap

If any step fails, note the failure and loop back to the relevant Task with a fix commit.

- [ ] **Step 8.6: Accessibility smoke**

In browser devtools, verify:

- Skip link (Tab key on page load) focuses "본문 분석 영역으로 건너뛰기" link
- `aria-live="polite"` on detail-progress and fetch-status regions still present
- `aria-pressed` on sample-switcher and match-row buttons updates correctly
- `:focus-visible` ring (amber 2px outline) appears on tab navigation

- [ ] **Step 8.7: Write verification summary**

```bash
cat > /Users/a1234/Documents/Web_LOL_Banpick/test-artifacts/layout-redesign/iter8-verification.md <<'EOF'
# Iteration 8 Verification Summary

## Coverage (from design-audit --scope all)
- Colors: 88.0% → [paste actual from iter8-post.md]
- Radius: 96.7% → [paste]
- Spacing: 94.5% → [paste]
- Font Size: 97.7% → [paste]
- Breakpoints: `max-width: 760px` x1 (unchanged)

## Attribute diff
- Pre count: [wc -l pre-attributes.txt]
- Post count: [wc -l post-attributes.txt]
- Net change: [post - pre]
- Expected: −10 to −15

## Manual flow (8 steps)
- [ ] 10-match list
- [ ] detail entry
- [ ] tab skeleton first
- [ ] tab skeleton subsequent (no)
- [ ] sample switcher
- [ ] details intake
- [ ] back button
- [ ] mobile responsive

## Accessibility
- [ ] skip link
- [ ] aria-live
- [ ] aria-pressed
- [ ] focus-visible

## Commits (8 expected)
[paste git log --oneline origin/main..HEAD]
EOF
```

Fill in the bracketed values. This file is gitignored; it's a local checklist.

---

## Task 9: Close Out

- [ ] **Step 9.1: Git state summary**

```bash
cd /Users/a1234/Documents/Web_LOL_Banpick
git log --oneline origin/main..HEAD
git status
git show --stat HEAD
git show --stat HEAD~1
git show --stat HEAD~2
git show --stat HEAD~3
git show --stat HEAD~4
git show --stat HEAD~5
git show --stat HEAD~6
git show --stat HEAD~7
```

Expected: 8 commits (spec + 6 refactor/feat + 1 docs), all clean.

- [ ] **Step 9.2: Branch summary and handoff**

The branch is feature-named `feat/layout-redesign-iter8` if created in a worktree, or directly on `main` if approved. Present the branch summary to the user:

- Commit count
- Files changed total
- Coverage metrics (before/after)
- Any deferred cleanup (hero-panel CSS rules, etc.)

- [ ] **Step 9.3: User review hand-off**

Push to remote or merge per user instruction. Do not push/merge without explicit approval.

---

## Rollback Strategy

Each commit is an independent logical unit:

- `git revert <sha>` works per commit
- Task 1 (styles) can revert without affecting HTML/JS (new classes become unused)
- Task 2 (match-row) can revert independently — candidate-card was the previous state
- Task 3 (detail-header) — revert to restore panel--headline/snapshot
- Task 4 (sidebar slim) — revert to restore 4-stack
- Task 5 (topbar/eyebrows) — pure HTML revert
- Task 6 (skeleton) — revert switchTab to prior state
- Task 7 (docs) — isolated

Full revert: `git reset --hard origin/main` (requires user confirmation — destructive).

---

## Known Deferred Work

- Dead CSS cleanup: `.hero-panel`, `.hero-copy`, `.hero-meta`, `.hero-pills`, `.panel--nav` rules in `styles.css`. Safe to leave (no DOM references), can be removed in a follow-up minor pass.
- Dead CSS cleanup: `.panel--headline`, `.panel--snapshot`, `.snapshot-grid`, `.snapshot-item`, `.snapshot-footnote`, `.summary-copy`, `.summary-detail`. Same.
- Dead CSS cleanup: `.topbar`, `.topbar-title`, `.topbar-copy`. Same.
- `.candidate-card` base rules stay in case other selectors use them; audit later.
- Long-form eyebrow text that moved to `.meta-label` inside cards (Player Hub → identity-card) may need small font-size adjustments if text overflows on narrow sidebar. Visual QA-driven follow-up.
