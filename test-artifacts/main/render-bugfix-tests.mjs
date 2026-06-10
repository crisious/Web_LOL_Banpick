// Regression tests for live-render bug fixes (Batch D).
//
// Covers: dual-timeline phase bands never render negative width for short
// games; selectSample discards superseded async loads; load-more footer is
// re-rendered after the pending flag clears; recent-stats/champion-history
// send the user-entered Riot key and discard stale-account responses.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  // Skip the parameter list first so destructured params (e.g. `({ x } = {})`)
  // don't trip the body brace counter.
  let parenDepth = 0;
  let i = source.indexOf("(", startIdx);
  for (; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    else if (source[i] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { i += 1; break; }
    }
  }
  const bodyStart = source.indexOf("{", i);
  let depth = 0;
  for (let j = bodyStart; j < source.length; j += 1) {
    if (source[j] === "{") depth += 1;
    else if (source[j] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, j + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

let pass = 0;
let fail = 0;
function checkTrue(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${condition || !detail ? "" : `  — ${detail}`}`);
  condition ? pass++ : fail++;
}

// ── buildDualTimelineData: real phase-band generation ─────────────────────
const buildDualTimelineDataSrc = extractFunctionSource(mainSrc, "buildDualTimelineData");
const { buildDualTimelineData } = new Function(
  `${buildDualTimelineDataSrc}
return { buildDualTimelineData };`,
)();

function phasesFor(durationSeconds) {
  const data = buildDualTimelineData({
    normalized: {
      matchInfo: { durationSeconds },
      timelineEvents: [],
      objectiveTimeline: [],
    },
  });
  return data.phases;
}

const shortPhases = phasesFor(720); // 12 min ARAM
checkTrue("short game (<15m) yields only EARLY band", shortPhases.length === 1 && shortPhases[0].phase === "EARLY");
checkTrue(
  "short game EARLY band spans full duration",
  shortPhases[0].startMs === 0 && shortPhases[0].endMs === 720000,
);

const midPhases = phasesFor(1500); // 25 min
checkTrue("mid-length game (15-30m) yields EARLY + MID", midPhases.map((p) => p.phase).join(",") === "EARLY,MID");

const longPhases = phasesFor(2100); // 35 min
checkTrue("long game (>30m) yields EARLY + MID + LATE", longPhases.map((p) => p.phase).join(",") === "EARLY,MID,LATE");

for (const seconds of [300, 720, 899, 900, 901, 1500, 1800, 2100, 3600]) {
  const phases = phasesFor(seconds);
  const allNonNegative = phases.every((p) => p.endMs - p.startMs >= 0);
  checkTrue(`no negative-width band at ${seconds}s`, allNonNegative, JSON.stringify(phases));
}

// ── selectSample: superseded load is discarded via a load token ───────────
const selectSampleSrc = extractFunctionSource(mainSrc, "selectSample");
checkTrue("selectSample captures a monotonic load token", selectSampleSrc.includes("state.sampleLoadSeq = (state.sampleLoadSeq || 0) + 1"));
checkTrue(
  "selectSample discards superseded loads after each await",
  (selectSampleSrc.match(/if \(loadToken !== state\.sampleLoadSeq\) return;/g) || []).length >= 3,
);

// ── loadMoreRecentMatches: footer re-rendered after flag clears ───────────
const loadMoreSrc = extractFunctionSource(mainSrc, "loadMoreRecentMatches");
const finallyIdx = loadMoreSrc.indexOf("state.isLoadMorePending = false;");
checkTrue(
  "loadMore re-renders footer after clearing pending flag",
  finallyIdx >= 0 && loadMoreSrc.indexOf("renderMatchListFooter();", finallyIdx) > finallyIdx,
);

// ── recent-stats / champion-history: user key + stale-account guard ───────
const fetchRecentStatsSrc = extractFunctionSource(mainSrc, "fetchRecentStats");
checkTrue("fetchRecentStats sends the user-entered key", fetchRecentStatsSrc.includes("riotApiKey: getUserApiKey() || undefined"));
checkTrue(
  "fetchRecentStats discards stale-account responses",
  fetchRecentStatsSrc.includes("if (currentAccountKey() !== accountKey) return;"),
);
checkTrue(
  "fetchRecentStats clears breakdown lists on zero-match account",
  fetchRecentStatsSrc.includes('renderRecentStatsEmpty("최근 경기 없음");') &&
    /renderRecentStatsEmpty\("최근 경기 없음"\);[\s\S]{0,200}renderChampionBreakdown\(\)/.test(fetchRecentStatsSrc),
);

const startChampionHistoryFetchSrc = extractFunctionSource(mainSrc, "startChampionHistoryFetch");
checkTrue(
  "startChampionHistoryFetch sends the user-entered key",
  startChampionHistoryFetchSrc.includes("riotApiKey: getUserApiKey() || undefined"),
);

// no handler should still read the never-populated state.account.riotApiKey
checkTrue(
  "no live fetch reads the unpopulated state.account.riotApiKey",
  !mainSrc.includes("state.account.riotApiKey"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
