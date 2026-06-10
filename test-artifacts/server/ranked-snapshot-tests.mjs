// server.js ranked snapshot helper regression tests
//
// Covers rankedQueueLabel, buildRankedSnapshot, and selectRankedEntry.
// buildRankedSnapshot calls rankedQueueLabel, so all three helpers are
// extracted from server.js and injected together.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const startIdx = source.indexOf(`function ${name}(`);
  if (startIdx < 0) throw new Error(`function ${name} not found`);
  let depth = 0;
  let bodyStarted = false;
  for (let i = startIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (ch === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const { rankedQueueLabel, buildRankedSnapshot, selectRankedEntry } = new Function(
  [
    extractFunctionSource(serverSrc, "rankedQueueLabel"),
    extractFunctionSource(serverSrc, "buildRankedSnapshot"),
    extractFunctionSource(serverSrc, "selectRankedEntry"),
    "return { rankedQueueLabel, buildRankedSnapshot, selectRankedEntry };",
  ].join("\n"),
)();

let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

function checkTrue(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  condition ? pass++ : fail++;
}

// --- rankedQueueLabel ---------------------------------------------------

check("rankedQueueLabel maps solo queue", rankedQueueLabel("RANKED_SOLO_5x5"), "솔로랭크");
check("rankedQueueLabel maps flex queue", rankedQueueLabel("RANKED_FLEX_SR"), "자유랭크");
check("rankedQueueLabel passes through unmapped queue type", rankedQueueLabel("RANKED_TFT_DOUBLE_UP"), "RANKED_TFT_DOUBLE_UP");
check("rankedQueueLabel falls back to 랭크 for empty string", rankedQueueLabel(""), "랭크");
check("rankedQueueLabel falls back to 랭크 for null", rankedQueueLabel(null), "랭크");
check("rankedQueueLabel falls back to 랭크 for undefined", rankedQueueLabel(undefined), "랭크");

// --- buildRankedSnapshot ------------------------------------------------

check("buildRankedSnapshot returns null for null entry", buildRankedSnapshot(null), null);
check("buildRankedSnapshot returns null for undefined entry", buildRankedSnapshot(undefined), null);

check("buildRankedSnapshot zero wins and losses yields 0 winRate", buildRankedSnapshot({
  queueType: "RANKED_SOLO_5x5",
  tier: "IRON",
  rank: "IV",
  leaguePoints: 0,
  wins: 0,
  losses: 0,
}), {
  queueType: "RANKED_SOLO_5x5",
  queueLabel: "솔로랭크",
  tier: "IRON",
  rank: "IV",
  lp: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
});

check("buildRankedSnapshot rounds 65% win rate (13/20)", buildRankedSnapshot({
  queueType: "RANKED_SOLO_5x5",
  tier: "GOLD",
  rank: "II",
  leaguePoints: 42,
  wins: 13,
  losses: 7,
}), {
  queueType: "RANKED_SOLO_5x5",
  queueLabel: "솔로랭크",
  tier: "GOLD",
  rank: "II",
  lp: 42,
  wins: 13,
  losses: 7,
  winRate: 65,
});

check("buildRankedSnapshot rounds 66.66% up to 67 (2/3)", buildRankedSnapshot({
  queueType: "RANKED_FLEX_SR",
  tier: "PLATINUM",
  rank: "I",
  leaguePoints: 10,
  wins: 2,
  losses: 1,
}), {
  queueType: "RANKED_FLEX_SR",
  queueLabel: "자유랭크",
  tier: "PLATINUM",
  rank: "I",
  lp: 10,
  wins: 2,
  losses: 1,
  winRate: 67,
});

check("buildRankedSnapshot coerces string numerics via Number", buildRankedSnapshot({
  queueType: "RANKED_SOLO_5x5",
  tier: "DIAMOND",
  rank: "III",
  leaguePoints: "120",
  wins: "8",
  losses: "2",
}), {
  queueType: "RANKED_SOLO_5x5",
  queueLabel: "솔로랭크",
  tier: "DIAMOND",
  rank: "III",
  lp: 120,
  wins: 8,
  losses: 2,
  winRate: 80,
});

check("buildRankedSnapshot defaults missing fields", buildRankedSnapshot({}), {
  queueType: "",
  queueLabel: "랭크",
  tier: "",
  rank: "",
  lp: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
});

// --- selectRankedEntry --------------------------------------------------

const soloEntry = { queueType: "RANKED_SOLO_5x5" };
const flexEntry = { queueType: "RANKED_FLEX_SR" };
const otherEntry = { queueType: "CHERRY" };

check("selectRankedEntry prefers solo when both exist",
  selectRankedEntry([flexEntry, soloEntry]), soloEntry);
check("selectRankedEntry returns flex when only flex exists",
  selectRankedEntry([otherEntry, flexEntry]), flexEntry);
check("selectRankedEntry returns null when neither queue present",
  selectRankedEntry([otherEntry]), null);
check("selectRankedEntry returns null for empty array",
  selectRankedEntry([]), null);
check("selectRankedEntry returns null for null", selectRankedEntry(null), null);
check("selectRankedEntry returns null for non-array object",
  selectRankedEntry({ queueType: "RANKED_SOLO_5x5" }), null);

// --- source guards ------------------------------------------------------

checkTrue("server defines rankedQueueLabel",
  serverSrc.includes("function rankedQueueLabel(queueType)"));
checkTrue("server defines buildRankedSnapshot",
  serverSrc.includes("function buildRankedSnapshot(entry)"));
checkTrue("server defines selectRankedEntry",
  serverSrc.includes("function selectRankedEntry(entries)"));
checkTrue("buildRankedSnapshot uses rankedQueueLabel for queueLabel",
  extractFunctionSource(serverSrc, "buildRankedSnapshot").includes("rankedQueueLabel(entry.queueType)"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
