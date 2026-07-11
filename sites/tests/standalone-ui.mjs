import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testsRoot = path.dirname(fileURLToPath(import.meta.url));
const sitesRoot = path.resolve(testsRoot, "..");
const appRoot = path.join(sitesRoot, "app");

async function readOptional(relativePath, encoding = "utf8") {
  try {
    return await readFile(path.join(appRoot, relativePath), encoding);
  } catch (error) {
    if (error?.code === "ENOENT") return encoding ? "" : null;
    throw error;
  }
}

async function isFile(relativePath) {
  try {
    return (await stat(path.join(appRoot, relativePath))).isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function tagWithAttribute(source, attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`<[^>]+\\b${escaped}(?:=[^\\s>]+|="[^"]*")?[^>]*>`, "i"))?.[0] || "";
}

function mediaBlocks(source, width) {
  const marker = `@media (max-width: ${width}px)`;
  const blocks = [];
  let cursor = 0;
  while (cursor < source.length) {
    const markerIndex = source.indexOf(marker, cursor);
    if (markerIndex < 0) break;
    const open = source.indexOf("{", markerIndex + marker.length);
    if (open < 0) break;
    let depth = 0;
    let close = -1;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close < 0) break;
    blocks.push(source.slice(open + 1, close));
    cursor = close + 1;
  }
  return blocks.join("\n");
}

const [html, css, appJs, coachingPlanJs, ogImage] = await Promise.all([
  readOptional("index.html"),
  readOptional("styles.css"),
  readOptional("app.js"),
  readOptional("coaching-plan.js"),
  readOptional("og.png", null),
]);

test("standalone Sites UI provides its own five production assets", async (t) => {
  for (const relativePath of [
    "index.html",
    "styles.css",
    "app.js",
    "coaching-plan.js",
    "og.png",
  ]) {
    await t.test(relativePath, async () => {
      assert.ok(
        await isFile(relativePath),
        `Missing standalone UI asset: sites/app/${relativePath}`,
      );
    });
  }
  assert.match(coachingPlanJs, /export function buildFocusModel/);
  assert.deepEqual(
    [...(ogImage?.subarray(0, 8) || [])],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "sites/app/og.png must be a PNG",
  );
});

test("page exposes the standalone evidence-coach brand and header", () => {
  assert.match(html, /<header\b[^>]*data-site-header[^>]*>/i);
  assert.match(html, /LOLGG\s+AI\s+COACH/i);
  assert.match(html, /<main\b[^>]*id="main-content"[^>]*>/i);
  assert.match(html, /<a\b[^>]*href="#main-content"[^>]*>/i);
});

test("summary and headline metrics are rendered only from staged sample data", () => {
  assert.match(html, /data-coach-summary/);
  assert.match(html, /data-evidence-metrics/);
  assert.match(appJs, /analysis\??\.coachSummary/);
  assert.match(appJs, /normalized\??\.playerStats/);
  assert.match(appJs, /normalized\??\.playtimeScore/);

  const visibleContract = `${html}\n${appJs}`;
  for (const label of ["KDA", "시야 점수", "킬 관여"]) {
    assert.ok(visibleContract.includes(label), `Missing metric label: ${label}`);
  }
  assert.doesNotMatch(appJs, /\b84\b|62%|근거\s*7건/);
});

test("next-game focus links one coaching action to its evidence", () => {
  assert.match(html, /<section\b[^>]*data-coaching-focus[^>]*aria-labelledby="focus-title"/i);
  assert.match(html, /data-focus-content/);
  assert.ok(
    html.indexOf("data-coaching-focus") < html.indexOf("data-evidence-metrics"),
    "focus must appear before the metric strip",
  );
  assert.match(html, /id="evidence-title"[^>]*tabindex="-1"/i);
  assert.match(appJs, /from ["']\.\/coaching-plan\.js["']/);
  assert.match(appJs, /buildFocusModel/);
  assert.match(appJs, /findFocusMomentId/);
  assert.match(appJs, /data-focus-evidence/);
  assert.match(appJs, /selectMoment\(momentId\)/);
  assert.match(appJs, /momentId\s*!==\s*state\.activeMomentId/);
  assert.match(appJs, /이미 선택된 근거 장면으로 이동했습니다\./);
  assert.match(appJs, /evidenceTitle\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
  assert.match(appJs, /evidenceTitle\.scrollIntoView/);
  assert.match(appJs, /matchMedia\(["']\(prefers-reduced-motion: reduce\)["']\)/);

  const at1024 = mediaBlocks(css, 1024);
  assert.match(at1024, /\.focus-section\s*\{[^}]*grid-template-columns\s*:\s*1fr;/s);
  assert.match(at1024, /\.focus-card\s*\{[^}]*grid-template-columns\s*:\s*1fr;/s);
});

test("skill profile exposes six accessible internal coaching meters", () => {
  assert.match(html, /<section\b[^>]*class="skill-profile"[^>]*aria-labelledby="skill-profile-title"/i);
  assert.match(html, /data-skill-profile/);
  assert.match(appJs, /buildSkillProfile/);
  assert.match(appJs, /role="meter"/);
  assert.match(appJs, /aria-valuemin="0"/);
  assert.match(appJs, /aria-valuemax="10"/);
  assert.match(appJs, /aria-valuenow=/);
  assert.match(appJs, /측정 없음/);
  assert.ok(
    `${html}\n${appJs}`.includes("티어 평균이나 백분위가 아닌"),
    "profile must identify the numbers as internal coaching scores",
  );

  const at1024 = mediaBlocks(css, 1024);
  assert.match(at1024, /\.skill-profile\s*\{[^}]*grid-template-columns\s*:\s*1fr;/s);
  const at480 = mediaBlocks(css, 480);
  assert.match(
    at480,
    /\.skill-row\s*\{[^}]*grid-template-columns\s*:\s*64px minmax\(0,\s*1fr\) 40px;/s,
  );
});

test("sample and evidence-moment selection use native controls", () => {
  const sampleSelect = tagWithAttribute(html, "data-sample-select");
  assert.match(sampleSelect, /^<select\b/i);
  const selectId = sampleSelect.match(/\bid="([^"]+)"/)?.[1] || "";
  assert.ok(selectId, "native sample select must have an id");
  assert.match(html, new RegExp(`<label\\b[^>]*for="${selectId}"`, "i"));

  assert.match(appJs, /(?:<button\b|createElement\(["']button["']\))/);
  assert.match(appJs, /type(?:=|\s*=\s*)["']button["']/);
  assert.match(appJs, /data-evidence-moment/);
  assert.match(appJs, /aria-pressed/);
  assert.match(appJs, /(?:EVIDENCE_MOMENT_LIMIT\s*=\s*4|slice\(0\s*,\s*4\))/);
  assert.match(css, /(?:\.evidence-moment|\[data-evidence-moment[^\]]*\]):focus-visible\s*\{/);
});

test("selected detail separates observed facts from AI interpretation", () => {
  const detail = tagWithAttribute(html, "data-evidence-detail");
  const observed = tagWithAttribute(html, "data-observed-facts");
  const interpretation = tagWithAttribute(html, "data-ai-interpretation");

  assert.match(detail, /aria-live="polite"/);
  assert.match(detail, /aria-atomic="true"/);
  assert.match(observed, /^<section\b/i);
  assert.match(observed, /aria-labelledby=/);
  assert.match(interpretation, /^<section\b/i);
  assert.match(interpretation, /aria-labelledby=/);
  assert.ok(html.includes("관찰된 사실"));
  assert.ok(html.includes("AI 해석"));
  assert.match(appJs, /relatedEventIds/);
  assert.match(appJs, /timelineEvents/);
  assert.match(appJs, /\.description/);

  const detailRenderer = appJs.slice(
    appJs.indexOf("function renderMomentDetail"),
    appJs.indexOf("function renderProtocols"),
  );
  assert.match(detailRenderer, /event\.eventType/);
  assert.match(detailRenderer, /event\.laneHint/);
  assert.doesNotMatch(
    detailRenderer,
    /event\.summary/,
    "observed facts must not relabel a derived event summary as raw fact",
  );
});

test("protocol and loading lifecycle expose accessible native states", () => {
  assert.match(appJs, /<input\b[^>]*type=["']checkbox["'][^>]*data-protocol-check/i);

  const status = tagWithAttribute(html, "data-app-status");
  assert.match(status, /role="status"/);
  assert.match(status, /aria-live="polite"/);
  for (const state of ["loading", "error", "empty"]) {
    assert.match(appJs, new RegExp(`["']${state}["']`), `Missing ${state} UI state`);
  }
});

test("committed sample schema variants are normalized at the rendering boundary", () => {
  assert.match(appJs, /moment\.id\s*\|\|\s*moment\.eventId/);
  assert.match(appJs, /moment\.description\s*\|\|\s*moment\.detail/);
  assert.match(appJs, /action\.description/);
  assert.match(appJs, /action\.detail/);
  assert.match(appJs, /playtimeScore\?\.overall/);
  assert.match(appJs, /Object\.entries\(rawEvidenceIndex\)/);
  assert.match(appJs, /entry\.shortNote\s*\|\|/);
});

test("non-ready states clear every dependent analysis panel", () => {
  assert.match(appJs, /function resetDependentPanels\(/);
  assert.match(appJs, /function renderError\([^)]*\)\s*\{\s*resetDependentPanels\(\)/s);
  const loadSampleSource = appJs.slice(
    appJs.indexOf("async function loadSample"),
    appJs.indexOf("async function start"),
  );
  assert.match(loadSampleSource, /resetDependentPanels\(["']loading["']\)/);
  assert.ok(
    loadSampleSource.indexOf('resetDependentPanels("loading")')
      < loadSampleSource.indexOf('setAppState("loading"'),
    "loading placeholders must replace the prior sample before announcing the new request",
  );
});

test("standalone typography is Pretendard-only with tabular numerals", () => {
  assert.match(html, /pretendard/i);
  const familyValues = [...css.matchAll(/font-family\s*:\s*([^;]+);/gi)].map((match) => match[1].trim());
  assert.ok(familyValues.length > 0, "standalone CSS must declare its font family");
  for (const value of familyValues) {
    assert.ok(
      value === "inherit" || value.includes("Pretendard"),
      `Unexpected standalone font family: ${value}`,
    );
    assert.doesNotMatch(
      value,
      /\bui-monospace\b|\bSFMono(?:-Regular)?\b|(?:^|[\s,])monospace(?:[\s,]|$)|(?:^|[\s,])serif(?:[\s,]|$)|\bGeorgia\b|Times New Roman/i,
    );
  }
  assert.match(css, /font-variant-numeric\s*:\s*tabular-nums/);
});

test("analysis headline uses the approved restrained hierarchy", () => {
  assert.match(
    css,
    /\.hero\s*\{[^}]*min-height\s*:\s*390px;[^}]*padding\s*:\s*64px 0 60px;/s,
  );
  assert.match(
    css,
    /\.hero h1\s*\{[^}]*max-width\s*:\s*760px;[^}]*font-size\s*:\s*clamp\(1\.9rem,\s*3\.8vw,\s*3\.45rem\);[^}]*font-weight\s*:\s*700;[^}]*line-height\s*:\s*1\.16;[^}]*letter-spacing\s*:\s*-0\.035em;/s,
  );
  assert.match(css, /\.coach-summary\s*\{[^}]*margin\s*:\s*24px 0 0;/s);
  assert.match(css, /\.hero__stamp\s*\{[^}]*width\s*:\s*90px;/s);

  const at720 = mediaBlocks(css, 720);
  assert.match(
    at720,
    /\.hero h1\s*\{[^}]*font-size\s*:\s*clamp\(1\.8rem,\s*8\.5vw,\s*2\.8rem\);/s,
  );
});

test("standalone layout defines 1024, 720, and 480 responsive reflows", () => {
  const at1024 = mediaBlocks(css, 1024);
  const at720 = mediaBlocks(css, 720);
  const at480 = mediaBlocks(css, 480);

  assert.match(
    at1024,
    /(?:\.evidence-layout|\.lab-grid)[^{}]*\{[^}]*grid-template-columns\s*:\s*1fr/i,
  );
  assert.match(at720, /\.metrics[^{}]*\{[^}]*grid-template-columns\s*:\s*1fr/i);
  assert.match(at720, /\.reasoning[^{}]*\{[^}]*grid-template-columns\s*:\s*1fr/i);
  assert.match(
    at720,
    /\.moment-grid[^{}]*\{[^}]*grid-template-columns\s*:\s*repeat\(2\s*,\s*(?:minmax\(0\s*,\s*)?1fr\)?\)/i,
  );
  assert.match(at480, /\.moment-grid[^{}]*\{[^}]*grid-template-columns\s*:\s*1fr/i);
});
