// Accessibility regression tests (Batch I).
//
// - Dual-timeline segments are keyboard operable (role/tabindex/aria-label +
//   Enter/Space activation) and have a visible focus style.
// - Build item icons are decorative (alt="") and the arrow separator is hidden
//   from assistive tech.
// - Status/error regions announce updates via aria-live.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const cssSrc = fs.readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

function extractConstObjectSource(source, name) {
  const m = source.match(new RegExp(`const ${name} = \\{[\\s\\S]*?\\};`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[0];
}
function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0, started = false;
  for (let i = startIdx; i < source.length; i += 1) {
    if (source[i] === "{") { depth += 1; started = true; }
    else if (source[i] === "}") { depth -= 1; if (started && depth === 0) return source.slice(startIdx, i + 1); }
  }
  throw new Error(`function ${name} not closed`);
}

let pass = 0, fail = 0;
function checkTrue(label, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || !detail ? "" : `  — ${detail}`}`);
  cond ? pass++ : fail++;
}

// ── msToClock pure function ───────────────────────────────────────────────
const msToClock = new Function(`${extractFunctionSource(mainSrc, "msToClock")}\nreturn msToClock;`)();
checkTrue("msToClock(0) == 0:00", msToClock(0) === "0:00");
checkTrue("msToClock(65000) == 1:05", msToClock(65000) === "1:05");
checkTrue("msToClock(900000) == 15:00", msToClock(900000) === "15:00");
checkTrue("msToClock handles non-number", msToClock(undefined) === "0:00");

// ── renderBuildTimeline a11y markup ───────────────────────────────────────
const { dom, renderBuildTimeline } = new Function(
  `${extractConstObjectSource(mainSrc, "HTML_ESCAPE")}
${extractFunctionSource(mainSrc, "escapeHtml")}
${extractFunctionSource(mainSrc, "escapeAttr")}
const championCdnVersion = "26.10.1";
${extractFunctionSource(mainSrc, "itemCdnVersion")}
const dom = { buildTimeline: { innerHTML: "" } };
${extractFunctionSource(mainSrc, "renderBuildTimeline")}
return { dom, renderBuildTimeline };`,
)();

renderBuildTimeline({
  normalized: {
    matchInfo: { gameVersion: "26.10.5" },
    itemTimeline: [
      { itemId: 3153, timeLabel: "8:49" },
      { itemId: 3078, timeLabel: "12:30" },
    ],
  },
});
const buildHtml = dom.buildTimeline.innerHTML;
checkTrue("build icon is decorative (alt=\"\")", buildHtml.includes('alt=""'));
checkTrue("build icon does not use numeric id as alt text", !/alt="item \d/.test(buildHtml));
checkTrue("build arrow is hidden from AT", buildHtml.includes('<span class="build-arrow" aria-hidden="true">'));

// ── dual-timeline keyboard a11y (source pins) ─────────────────────────────
checkTrue(
  "dual-timeline segment is a focusable button role with a label",
  /class="dual-tl-segment"[\s\S]{0,160}role="button" tabindex="0" aria-label="\$\{escapeAttr\(segLabel\)\}"/.test(mainSrc),
);
checkTrue("dual-timeline has a keydown handler for Enter/Space", /function handleDualTimelineKeydown\(event\)/.test(mainSrc) &&
  /event\.key !== "Enter" && event\.key !== " "/.test(mainSrc));
checkTrue("dual-timeline binds keydown", /addEventListener\("keydown", handleDualTimelineKeydown\)/.test(mainSrc));
checkTrue("dual-timeline activation toggles aria-pressed", /setAttribute\("aria-pressed", "true"\)/.test(mainSrc));
checkTrue("dual-timeline has a focus-visible style", /\.dual-tl-segment:focus-visible\s*\{/.test(cssSrc));

// ── aria-live on status regions (index.html) ──────────────────────────────
checkTrue("login status announces updates",
  /data-login-status[^>]*aria-live="polite"/.test(indexSrc));
checkTrue("comparison status announces updates",
  /data-comparison-status[^>]*aria-live="polite"/.test(indexSrc));
checkTrue("recent aggregate status announces updates",
  /data-recent-aggregate-status[^>]*aria-live="polite"/.test(indexSrc));

// ── focus ring no longer killed for keyboard users (CSS) ──────────────────
checkTrue("login focus outline:none scoped to :not(:focus-visible)",
  /\.login-form input\[type="text"\]:focus:not\(:focus-visible\)/.test(cssSrc));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
