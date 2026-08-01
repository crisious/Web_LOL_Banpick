# Evidence Coaching Dashboard and Sites Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the selected evidence-first AI coaching dashboard to the existing LoL Replay Coach and publish a private, source-backed, read-only Sites build.

**Architecture:** Keep `index.html`, `main.js`, and `styles.css` as the single UI source. Add pure dashboard model/render helpers around the existing normalized and analysis contracts, then add a small `sites/` Cloudflare Worker adapter that stages a privacy-scrubbed static copy without changing the Node server.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node.js zero-dependency tests, Vite 8, Cloudflare Vite plugin, Wrangler, Sites private deployment.

## Global Constraints

- Use only source-backed values from normalized and analysis JSON.
- Use Pretendard-based sans-serif typography everywhere; use tabular numerals instead of a separate numeric font.
- Preserve existing login, Riot lookup, sample switching, tabs, and Node server behavior.
- Render observed facts separately from AI interpretation and escape both at the display boundary.
- Do not stage raw Riot data, PUUID, Riot ID, matchId, environment files, or local paths in the Sites artifact.
- Keep the Sites deployment read-only and private.

---

### Task 1: Add failing dashboard behavior and contract tests

**Files:**
- Create: `test-artifacts/main/evidence-coaching-dashboard-tests.mjs`
- Create: `test-artifacts/main/evidence-coaching-dashboard-contract-tests.mjs`

**Interfaces:**
- Consumes: `normalized.playerStats`, `normalized.playtimeScore`, `normalized.timelineEvents`, `analysis.keyMoments`, `analysis.actionChecklist`, `analysis.evidenceIndex`.
- Produces: executable requirements for `buildEvidenceDashboardMetrics`, `buildEvidenceMomentModels`, `renderEvidenceMomentDetail`, and the semantic HTML/CSS contract.

- [ ] **Step 1: Write the fixture-driven failing behavior test**

```js
const metrics = buildEvidenceDashboardMetrics(sample);
check("source-backed metrics", metrics, {
  score: 83,
  kda: "2 / 2 / 16",
  vision: 72,
  killParticipation: "49%",
});
```

- [ ] **Step 2: Write the failing semantic contract test**

```js
checkTrue("detail announces selection", /data-evidence-detail[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(indexSrc));
checkTrue("font stack is unified", !/ui-monospace|SFMono|font-family:\s*monospace/.test(cssSrc));
```

- [ ] **Step 3: Verify RED**

Run:

```bash
node test-artifacts/main/evidence-coaching-dashboard-tests.mjs
node test-artifacts/main/evidence-coaching-dashboard-contract-tests.mjs
```

Expected: both commands fail because the dashboard helpers and markup do not exist.

### Task 2: Implement the evidence-first dashboard

**Files:**
- Modify: `index.html`
- Modify: `main.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: existing `escapeHtml`, `escapeAttr`, `sampleMatchSummary`, and sample data contracts.
- Produces: `buildEvidenceDashboardMetrics(sample)`, `buildEvidenceMomentModels(sample)`, `renderEvidenceMomentDetail(moment)`, `activateEvidenceMoment(button)`, and `renderEvidenceDashboard(sample)`.

- [ ] **Step 1: Add semantic dashboard hosts**

```html
<section class="evidence-lab" data-evidence-dashboard aria-labelledby="evidence-lab-title">
  <div data-evidence-dashboard-header></div>
  <div data-evidence-dashboard-metrics></div>
  <div data-evidence-moments></div>
  <div data-evidence-detail aria-live="polite" aria-atomic="true"></div>
  <div data-evidence-protocol></div>
</section>
```

- [ ] **Step 2: Implement source-backed model helpers**

```js
function buildEvidenceDashboardMetrics(sample) {
  const stats = sample?.normalized?.playerStats || {};
  const score = Number(sample?.normalized?.playtimeScore?.overall);
  return {
    score: Number.isFinite(score) ? Math.round(score * 10) : null,
    kda: `${stats.kills ?? 0} / ${stats.deaths ?? 0} / ${stats.assists ?? 0}`,
    vision: Number.isFinite(stats.visionScore) ? stats.visionScore : null,
    killParticipation: formatPercent(stats.killParticipation ?? 0),
  };
}
```

- [ ] **Step 3: Render four source-backed moments and the selected detail**

Use `km_1`, `km_2`, the first danger moment, and the final danger moment when available. Default to the first danger moment. Observed facts come only from linked normalized timeline events; interpretation comes from the moment description.

- [ ] **Step 4: Add selection and checklist interactions**

Bind one delegated click handler to the dashboard. Update `aria-pressed`, selected styling, and the live detail region. Use native checkboxes for protocol items.

- [ ] **Step 5: Style the selected design and unify typography**

Use `#06101D` page background, `#0B1D2F`/`#10253A` surfaces, `#36D6E7` active cyan, `#4F8CFF` fact blue, `#55D69A` positive mint, `#FF7380` danger coral, and `#F0BB59` action amber. Add 1180px, 760px, and 480px reflow rules.

- [ ] **Step 6: Verify GREEN and regressions**

```bash
node test-artifacts/main/evidence-coaching-dashboard-tests.mjs
node test-artifacts/main/evidence-coaching-dashboard-contract-tests.mjs
node test-artifacts/main/key-moment-phase-label-tests.mjs
node test-artifacts/main/accessibility-tests.mjs
npm test
```

Expected: all commands exit 0.

### Task 3: Add the read-only Sites adapter with TDD

**Files:**
- Create: `sites/package.json`
- Create: `sites/vite.config.ts`
- Create: `sites/worker/index.ts`
- Create: `sites/scripts/stage-assets.mjs`
- Create: `sites/tests/read-only-smoke.mjs`
- Create: `sites/.gitignore`
- Create: `sites/.openai/hosting.json`

**Interfaces:**
- Consumes: root UI files and the public sample manifest.
- Produces: `sites/dist/server/index.js`, privacy-scrubbed static assets, `/healthz`, `/api/samples`, and `/api/samples/:id`.

- [ ] **Step 1: Write the failing read-only staging test**

```js
assert.equal(bundle.normalized.playerContext?.puuid, undefined);
assert.equal(bundle.normalized.playerContext?.riotId, undefined);
assert.equal(bundle.normalized.matchInfo?.matchId, undefined);
assert.equal(bundle.normalized.sourceMeta?.rawMatchId, undefined);
```

- [ ] **Step 2: Verify RED**

```bash
cd sites
node --test tests/read-only-smoke.mjs
```

Expected: failure because staging and Worker files do not exist.

- [ ] **Step 3: Implement explicit asset staging and privacy scrubbing**

Copy only `index.html`, `styles.css`, `main.js`, the manifest, normalized analysis, analysis result, and optional comparison result. Rewrite paths to `/data/samples/...` and remove identifiers before writing `.staging-public`.

- [ ] **Step 4: Implement the Worker and Vite build**

```ts
export default {
  async fetch(request: Request, env: { ASSETS: Fetcher }) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true, publicDemoMode: "readonly" });
    return env.ASSETS.fetch(request);
  },
};
```

- [ ] **Step 5: Install, build, and verify GREEN**

```bash
cd sites
npm install --ignore-scripts --no-audit --no-fund
npm run build
test -f dist/server/index.js
node --test tests/read-only-smoke.mjs
```

Expected: build and tests exit 0; staged artifact contains no forbidden identifiers or raw files.

### Task 4: Validate, commit, package, and publish privately

**Files:**
- Create: `public/og.png` only if the generated social preview passes text inspection.
- Modify: Sites metadata only when the social preview passes.

**Interfaces:**
- Consumes: successful root tests, successful Sites build, Sites project metadata.
- Produces: committed source, packaged archive, saved Sites version, private deployed URL.

- [ ] **Step 1: Run full verification**

```bash
npm test
(cd sites && npm run build && node --test tests/read-only-smoke.mjs)
git diff --check
```

- [ ] **Step 2: Stage only intentional files and commit**

```bash
git add index.html main.js styles.css docs/design-assets/evidence-coaching-dashboard-reference.png docs/superpowers/specs/2026-07-11-evidence-coaching-dashboard-design.md docs/superpowers/plans/2026-07-11-evidence-coaching-dashboard-sites.md test-artifacts/main/evidence-coaching-dashboard-tests.mjs test-artifacts/main/evidence-coaching-dashboard-contract-tests.mjs sites/
git diff --cached --check
git commit -m "feat: add evidence-first coaching dashboard"
```

- [ ] **Step 3: Create or reuse the Sites project, persist `project_id`, and commit metadata**

- [ ] **Step 4: Package the exact validated `sites/` build, save one version, deploy it privately, and poll until success**

- [ ] **Step 5: Return the deployed URL and keep unrelated sample changes untouched**
