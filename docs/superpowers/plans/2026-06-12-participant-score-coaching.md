# Participant Score Coaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한 게임 리플레이 분석에서 타깃 플레이어를 기준으로 아군과 상대 팀 전원의 인게임 플레이 스코어, 순위, 짧은 코칭 문구를 생성하고 리포트 UI에 표시한다.

**Architecture:** 서버 정규화 단계에서 Riot match participant 10명을 익명 공개 라벨로 변환하고, 기존 `calcCombatScore`, `calcIncomeScore`, `calcVisionScore`, `calcSurvivalScore` 산식을 참가자별로 재사용해 `normalized.participantScoreboard`를 만든다. 클라이언트는 개요 탭의 플레이 타임 스코어 아래에 팀별 카드 테이블을 추가해 타깃 플레이어, 아군, 상대 핵심 위협을 한 화면에서 비교한다. 기존 샘플은 `loadSampleBundle()`에서 `raw-match.json`이 있을 때 서버가 보강한다.

**Implementation Note:** source-extraction 테스트가 함수 시그니처의 구조분해/기본 객체 중괄호를 본문으로 오해할 수 있어 실제 구현은 `participantStatsFromRaw(participant, teamTotalKills, durationSeconds)`, `buildParticipantPlayScore(input)`, `buildParticipantScoreboard(matchDetail, options)` 형태를 사용한다.

**Tech Stack:** Node.js HTTP server, Riot Match-V5 JSON, vanilla JavaScript, HTML/CSS, existing source-extraction regression tests in `test-artifacts`.

---

## Current-State Notes

- `server.js` already builds target-player-only `normalized.playtimeScore` in `buildNormalized()` through `buildPlaytimeScore(normalized)`.
- `buildPlaytimeScore()` depends on `playerStats`, `challengeStats`, `matchInfo.position`, `teamContext`, and `timelineEvents`.
- Raw match files contain every participant's KDA, CS, gold, damage, vision, team, champion, role, and challenge stats, so the new feature does not require another Riot API call.
- `main.js` currently renders only target-player `sample.normalized.playtimeScore` into `[data-score-panel]`.
- `index.html` has an overview score section at `#score`; the new comparison panel should live in that section so the user sees individual score and team context together.
- Privacy invariant: never expose `puuid`, `summonerName`, `riotIdGameName`, `riotIdTagline`, or raw `matchId` in the public participant scoreboard. Use champion, role, side, and slot labels only.

## File Structure

- Modify: `server.js`
  - Add participant scoreboard helpers near existing score helpers.
  - Attach `normalized.participantScoreboard` in `buildNormalized()`.
  - Backfill `normalized.participantScoreboard` in `loadSampleBundle()` when `raw-match.json` exists.
- Modify: `main.js`
  - Add DOM reference for `[data-participant-scoreboard]`.
  - Add label/grade helpers and `renderParticipantScoreboard(sample)`.
  - Call the renderer from the existing detail render path.
- Modify: `index.html`
  - Add a participant scoreboard container below `[data-score-panel]` and `[data-laning-stats]`.
- Modify: `styles.css`
  - Add compact table/card styles under the existing score-panel styles.
- Create: `test-artifacts/server/participant-scoreboard-tests.mjs`
  - Cover participant score generation, privacy, ranking, ally/enemy grouping, coaching text, and legacy backfill source shape.
- Create: `test-artifacts/main/participant-scoreboard-ui-tests.mjs`
  - Cover DOM contract, renderer fallback, escaping, ally/enemy/player labels, and score class behavior.
- Modify: `README.md`
  - Document that stored analysis now includes anonymized participant scoreboard coaching.
- Modify: `replay-coach-qa-checklist.md`
  - Add manual QA checks for participant scoreboard visibility and privacy.

---

### Task 1: Server RED Test For Participant Scoreboard

**Files:**
- Create: `test-artifacts/server/participant-scoreboard-tests.mjs`

- [x] **Step 1: Create the failing server regression test**

Create `test-artifacts/server/participant-scoreboard-tests.mjs` with:

```js
// server.js participant scoreboard coaching regression tests.

import fs from "fs";

const serverSrc = fs.readFileSync(new URL("../../server.js", import.meta.url), "utf8");

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

function extractConstSource(source, name) {
  const match = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!match) throw new Error(`const ${name} not found`);
  return match[0];
}

const harnessSrc = [
  extractConstSource(serverSrc, "CS_FULL_SCORE_TARGETS"),
  extractFunctionSource(serverSrc, "clamp10"),
  extractFunctionSource(serverSrc, "normalizeRole"),
  extractFunctionSource(serverSrc, "durationLabel"),
  extractFunctionSource(serverSrc, "calcCombatScore"),
  extractFunctionSource(serverSrc, "calcIncomeScore"),
  extractFunctionSource(serverSrc, "calcVisionScore"),
  extractFunctionSource(serverSrc, "calcSurvivalScore"),
  extractFunctionSource(serverSrc, "participantPublicLabel"),
  extractFunctionSource(serverSrc, "participantStatsFromRaw"),
  extractFunctionSource(serverSrc, "participantScoreLabel"),
  extractFunctionSource(serverSrc, "participantCoachingText"),
  extractFunctionSource(serverSrc, "buildParticipantPlayScore"),
  extractFunctionSource(serverSrc, "buildParticipantScoreboard"),
  "return { participantPublicLabel, participantStatsFromRaw, participantScoreLabel, participantCoachingText, buildParticipantPlayScore, buildParticipantScoreboard };",
].join("\n");

const {
  participantPublicLabel,
  participantStatsFromRaw,
  participantScoreLabel,
  participantCoachingText,
  buildParticipantPlayScore,
  buildParticipantScoreboard,
} = new Function(harnessSrc)();

let pass = 0;
let fail = 0;

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

function participant({
  participantId,
  teamId,
  championName,
  teamPosition,
  kills = 0,
  deaths = 0,
  assists = 0,
  totalMinionsKilled = 0,
  neutralMinionsKilled = 0,
  goldEarned = 0,
  totalDamageDealtToChampions = 0,
  visionScore = 0,
  win = true,
  challenges = {},
}) {
  return {
    participantId,
    teamId,
    championName,
    teamPosition,
    individualPosition: teamPosition,
    kills,
    deaths,
    assists,
    totalMinionsKilled,
    neutralMinionsKilled,
    goldEarned,
    totalDamageDealtToChampions,
    visionScore,
    win,
    puuid: `secret-puuid-${participantId}`,
    summonerName: `secret-summoner-${participantId}`,
    riotIdGameName: `secret-game-${participantId}`,
    riotIdTagline: "KR1",
    challenges,
  };
}

const matchDetail = {
  metadata: { matchId: "KR_1234567890" },
  info: {
    gameDuration: 1800,
    participants: [
      participant({
        participantId: 1,
        teamId: 100,
        championName: "Ahri",
        teamPosition: "MIDDLE",
        kills: 8,
        deaths: 2,
        assists: 7,
        totalMinionsKilled: 230,
        goldEarned: 14500,
        totalDamageDealtToChampions: 26000,
        visionScore: 28,
        challenges: { damagePerMinute: 866, goldPerMinute: 483, visionScorePerMinute: 0.93, killParticipation: 0.68, soloKills: 2 },
      }),
      participant({ participantId: 2, teamId: 100, championName: "LeeSin", teamPosition: "JUNGLE", kills: 4, deaths: 5, assists: 12, neutralMinionsKilled: 144, goldEarned: 11800, totalDamageDealtToChampions: 15000, visionScore: 35, challenges: { killParticipation: 0.72, controlWardsPlaced: 4 } }),
      participant({ participantId: 3, teamId: 100, championName: "Jinx", teamPosition: "BOTTOM", kills: 11, deaths: 4, assists: 5, totalMinionsKilled: 260, goldEarned: 16800, totalDamageDealtToChampions: 32000, visionScore: 18, challenges: { damagePerMinute: 1066, goldPerMinute: 560, killParticipation: 0.73 } }),
      participant({ participantId: 4, teamId: 100, championName: "Nautilus", teamPosition: "UTILITY", kills: 1, deaths: 7, assists: 18, totalMinionsKilled: 38, goldEarned: 8200, totalDamageDealtToChampions: 7000, visionScore: 62, challenges: { killParticipation: 0.86, visionScorePerMinute: 2.06, controlWardsPlaced: 7 } }),
      participant({ participantId: 5, teamId: 100, championName: "Gwen", teamPosition: "TOP", kills: 2, deaths: 6, assists: 3, totalMinionsKilled: 180, goldEarned: 9800, totalDamageDealtToChampions: 11000, visionScore: 14, challenges: { killParticipation: 0.23 } }),
      participant({ participantId: 6, teamId: 200, championName: "Syndra", teamPosition: "MIDDLE", kills: 9, deaths: 3, assists: 6, totalMinionsKilled: 221, goldEarned: 15000, totalDamageDealtToChampions: 31000, visionScore: 25, win: false, challenges: { damagePerMinute: 1033, goldPerMinute: 500, killParticipation: 0.75 } }),
      participant({ participantId: 7, teamId: 200, championName: "Viego", teamPosition: "JUNGLE", kills: 5, deaths: 5, assists: 9, neutralMinionsKilled: 135, goldEarned: 11900, totalDamageDealtToChampions: 17000, visionScore: 31, win: false, challenges: { killParticipation: 0.70 } }),
      participant({ participantId: 8, teamId: 200, championName: "Caitlyn", teamPosition: "BOTTOM", kills: 6, deaths: 6, assists: 4, totalMinionsKilled: 245, goldEarned: 13200, totalDamageDealtToChampions: 24000, visionScore: 16, win: false, challenges: { killParticipation: 0.50 } }),
      participant({ participantId: 9, teamId: 200, championName: "Leona", teamPosition: "UTILITY", kills: 0, deaths: 9, assists: 11, totalMinionsKilled: 35, goldEarned: 7000, totalDamageDealtToChampions: 6000, visionScore: 50, win: false, challenges: { killParticipation: 0.55, visionScorePerMinute: 1.66 } }),
      participant({ participantId: 10, teamId: 200, championName: "Ornn", teamPosition: "TOP", kills: 1, deaths: 5, assists: 8, totalMinionsKilled: 190, goldEarned: 10100, totalDamageDealtToChampions: 13000, visionScore: 20, win: false, challenges: { killParticipation: 0.45 } }),
    ],
  },
};

check("participantPublicLabel player", participantPublicLabel({ relation: "PLAYER", role: "MID", champion: "Ahri" }), "내 MID Ahri");
check("participantPublicLabel ally", participantPublicLabel({ relation: "ALLY", role: "JUNGLE", champion: "LeeSin" }), "아군 JUNGLE LeeSin");
check("participantPublicLabel enemy", participantPublicLabel({ relation: "ENEMY", role: "MID", champion: "Syndra" }), "상대 MID Syndra");

const stats = participantStatsFromRaw(matchDetail.info.participants[0], 22);
check("participantStatsFromRaw computes cs", stats.cs, 230);
check("participantStatsFromRaw computes csPerMinute", stats.csPerMinute, 7.67);
check("participantStatsFromRaw computes kda", stats.kda, 7.5);
check("participantStatsFromRaw keeps damage", stats.damageToChampions, 26000);

check("participantScoreLabel elite", participantScoreLabel(8.2), "캐리");
check("participantScoreLabel good", participantScoreLabel(6.2), "양호");
check("participantScoreLabel average", participantScoreLabel(4.4), "보통");
check("participantScoreLabel poor", participantScoreLabel(3.9), "주의");

const score = buildParticipantPlayScore({
  stats,
  challenges: matchDetail.info.participants[0].challenges,
  role: "MID",
  durationSeconds: 1800,
});
checkTrue("buildParticipantPlayScore has overall", Number.isFinite(score.overall));
checkTrue("buildParticipantPlayScore has four categories",
  Object.keys(score.categories).join(",") === "combat,income,vision,survival");
checkTrue("participantCoachingText returns Korean coaching",
  participantCoachingText({ relation: "ENEMY", score, stats, role: "MID" }).includes("상대"));

const scoreboard = buildParticipantScoreboard(matchDetail, { targetPuuid: "secret-puuid-1" });
check("scoreboard schemaVersion", scoreboard.schemaVersion, 1);
check("scoreboard participant count", scoreboard.participants.length, 10);
check("scoreboard ally count", scoreboard.teams.ally.length, 5);
check("scoreboard enemy count", scoreboard.teams.enemy.length, 5);
check("scoreboard target participant id", scoreboard.targetParticipantId, 1);
check("scoreboard player relation", scoreboard.participants.find((p) => p.participantId === 1).relation, "PLAYER");
check("scoreboard top rank starts at 1", scoreboard.participants[0].rankOverall, 1);
checkTrue("scoreboard includes lane matchup",
  scoreboard.laneMatchups.some((m) => m.role === "MID" && m.playerParticipantId === 1 && m.enemyParticipantId === 6));
checkTrue("scoreboard hides puuid",
  !JSON.stringify(scoreboard).includes("secret-puuid"));
checkTrue("scoreboard hides summoner name",
  !JSON.stringify(scoreboard).includes("secret-summoner"));
checkTrue("scoreboard hides riot id",
  !JSON.stringify(scoreboard).includes("secret-game"));
checkTrue("server attaches participantScoreboard in buildNormalized",
  serverSrc.includes("normalized.participantScoreboard = buildParticipantScoreboard(matchDetail"));
checkTrue("loadSampleBundle backfills participantScoreboard",
  serverSrc.includes("!normalized.participantScoreboard") &&
  serverSrc.includes("buildParticipantScoreboard(matchDetail"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [x] **Step 2: Run the RED server test**

Run:

```bash
node --check test-artifacts/server/participant-scoreboard-tests.mjs
node test-artifacts/server/participant-scoreboard-tests.mjs
```

Expected:

- Syntax check exits `0`.
- Runtime exits `1` because `participantPublicLabel`, `participantStatsFromRaw`, `buildParticipantPlayScore`, `buildParticipantScoreboard`, and the backfill source-shape checks do not exist yet.

---

### Task 2: Implement Server Participant Scoreboard

**Files:**
- Modify: `server.js`

- [x] **Step 1: Add participant score helpers near `buildPlaytimeScore()`**

Add this block after `buildPlaytimeScore(normalized)`:

```js
function participantPublicLabel(participant) {
  const relation = participant?.relation === "PLAYER" ? "내" : participant?.relation === "ALLY" ? "아군" : "상대";
  return `${relation} ${participant?.role || "UNKNOWN"} ${participant?.champion || "Unknown"}`.trim();
}

function participantScoreLabel(overall) {
  if (overall >= 8) return "캐리";
  if (overall >= 6) return "양호";
  if (overall >= 4) return "보통";
  return "주의";
}

function participantStatsFromRaw(participant, teamTotalKills) {
  const kills = participant.kills || 0;
  const deaths = participant.deaths || 0;
  const assists = participant.assists || 0;
  const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
  const durationMinutes = Math.max(1, (participant.__durationSeconds || 0) / 60);
  return {
    kills,
    deaths,
    assists,
    kda: Number(((kills + assists) / Math.max(1, deaths)).toFixed(2)),
    cs,
    csPerMinute: Number((cs / durationMinutes).toFixed(2)),
    goldEarned: participant.goldEarned || 0,
    damageToChampions: participant.totalDamageDealtToChampions || 0,
    visionScore: participant.visionScore || 0,
    killParticipation: Number(((kills + assists) / Math.max(1, teamTotalKills)).toFixed(2)),
  };
}

function buildParticipantPlayScore({ stats, challenges, role, durationSeconds }) {
  const minutes = Math.max(1, durationSeconds / 60);
  const combat = calcCombatScore(stats, challenges || {}, minutes);
  const income = calcIncomeScore(stats, challenges || {}, role, minutes);
  const vision = calcVisionScore(stats, challenges || {}, minutes);
  const survival = calcSurvivalScore(stats, minutes);
  const overall = +(combat * 0.35 + income * 0.25 + vision * 0.15 + survival * 0.25).toFixed(1);
  return {
    overall,
    categories: { combat, income, vision, survival },
    label: participantScoreLabel(overall),
  };
}

function lowestParticipantScoreCategory(categories) {
  return Object.entries(categories || {}).sort((a, b) => a[1] - b[1])[0]?.[0] || "combat";
}

function strongestParticipantScoreCategory(categories) {
  return Object.entries(categories || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "combat";
}

function participantCategoryLabel(category) {
  const labels = {
    combat: "교전",
    income: "성장",
    vision: "시야",
    survival: "생존",
  };
  return labels[category] || "교전";
}

function participantCoachingText({ relation, score, stats, role }) {
  const weak = participantCategoryLabel(lowestParticipantScoreCategory(score.categories));
  const strong = participantCategoryLabel(strongestParticipantScoreCategory(score.categories));
  if (relation === "PLAYER") {
    return `내 ${role} 플레이는 ${strong} 강점이 보이며, 다음 판에서는 ${weak} 지표를 먼저 보완하세요.`;
  }
  if (relation === "ALLY") {
    return `아군 ${role}은 ${strong} 기여가 뚜렷합니다. 합류 타이밍을 맞추되 ${weak} 약점 구간에서는 무리한 교전을 피하세요.`;
  }
  if (score.overall >= 7) {
    return `상대 ${role}은 ${strong} 지표가 높은 핵심 위협입니다. 시야를 먼저 잡고 고립 전투를 피하세요.`;
  }
  return `상대 ${role}은 ${weak} 지표가 흔들립니다. 라인 주도권이나 오브젝트 전환으로 압박할 수 있습니다.`;
}

function buildParticipantScoreboard(matchDetail, { targetPuuid }) {
  const participants = Array.isArray(matchDetail?.info?.participants) ? matchDetail.info.participants : [];
  const target = participants.find((participant) => participant.puuid === targetPuuid);
  if (!target) {
    return { schemaVersion: 1, targetParticipantId: null, teams: { ally: [], enemy: [] }, participants: [], laneMatchups: [] };
  }

  const durationSeconds = Math.max(1, matchDetail.info.gameDuration || 0);
  const teamKillTotals = new Map();
  for (const participant of participants) {
    teamKillTotals.set(participant.teamId, (teamKillTotals.get(participant.teamId) || 0) + (participant.kills || 0));
  }

  const scored = participants.map((participant) => {
    const role = normalizeRole(participant.teamPosition || participant.individualPosition);
    const relation = participant.puuid === targetPuuid ? "PLAYER" : participant.teamId === target.teamId ? "ALLY" : "ENEMY";
    const participantForStats = { ...participant, __durationSeconds: durationSeconds };
    const stats = participantStatsFromRaw(participantForStats, teamKillTotals.get(participant.teamId) || 0);
    const score = buildParticipantPlayScore({
      stats,
      challenges: participant.challenges || {},
      role,
      durationSeconds,
    });
    return {
      participantId: participant.participantId,
      relation,
      teamId: participant.teamId,
      role,
      champion: participant.championName || "Unknown",
      label: participantPublicLabel({ relation, role, champion: participant.championName || "Unknown" }),
      result: participant.win ? "WIN" : "LOSS",
      stats,
      score,
      coaching: participantCoachingText({ relation, score, stats, role }),
    };
  });

  scored.sort((a, b) => b.score.overall - a.score.overall || a.participantId - b.participantId);
  scored.forEach((participant, index) => { participant.rankOverall = index + 1; });

  for (const teamId of new Set(scored.map((participant) => participant.teamId))) {
    scored
      .filter((participant) => participant.teamId === teamId)
      .sort((a, b) => b.score.overall - a.score.overall || a.participantId - b.participantId)
      .forEach((participant, index) => { participant.rankTeam = index + 1; });
  }

  const laneMatchups = scored
    .filter((participant) => participant.relation === "PLAYER" || participant.relation === "ALLY")
    .map((ally) => {
      const enemy = scored.find((participant) => participant.relation === "ENEMY" && participant.role === ally.role);
      if (!enemy) return null;
      return {
        role: ally.role,
        playerParticipantId: ally.participantId,
        enemyParticipantId: enemy.participantId,
        scoreDelta: +(ally.score.overall - enemy.score.overall).toFixed(1),
        csPerMinuteDelta: +(ally.stats.csPerMinute - enemy.stats.csPerMinute).toFixed(2),
        goldDelta: ally.stats.goldEarned - enemy.stats.goldEarned,
      };
    })
    .filter(Boolean);

  return {
    schemaVersion: 1,
    targetParticipantId: target.participantId,
    teams: {
      ally: scored.filter((participant) => participant.relation === "PLAYER" || participant.relation === "ALLY"),
      enemy: scored.filter((participant) => participant.relation === "ENEMY"),
    },
    participants: scored,
    laneMatchups,
  };
}
```

- [x] **Step 2: Attach scoreboard during normalization**

In `buildNormalized(account, matchDetail, timeline, options)`, after `normalized.playtimeScore = buildPlaytimeScore(normalized);`, add:

```js
  normalized.participantScoreboard = buildParticipantScoreboard(matchDetail, {
    targetPuuid: account.puuid,
  });
```

- [x] **Step 3: Backfill legacy samples in `loadSampleBundle()`**

After the existing `playtimeScore` backfill block, add:

```js
  if (!normalized.participantScoreboard) {
    const matchPath = sampleStoragePath(sampleId, "raw-match.json");
    try {
      const matchDetail = await readJson(matchPath);
      normalized.participantScoreboard = buildParticipantScoreboard(matchDetail, {
        targetPuuid: normalized.playerContext?.puuid,
      });
    } catch {}
  }
```

- [x] **Step 4: Run the server test GREEN**

Run:

```bash
node --check server.js
node --check test-artifacts/server/participant-scoreboard-tests.mjs
node test-artifacts/server/participant-scoreboard-tests.mjs
node test-artifacts/server/playtime-score-tests.mjs
node test-artifacts/server/sample-bundle-error-tests.mjs
```

Expected:

- All commands exit `0`.
- `participant-scoreboard-tests.mjs` reports every check passed.
- Existing playtime score and sample bundle tests stay green.

- [ ] **Step 5: Commit server slice**

```bash
git add server.js test-artifacts/server/participant-scoreboard-tests.mjs
git commit -m "feat: add participant score coaching data"
```

---

### Task 3: Main UI RED Test For Participant Scoreboard

**Files:**
- Create: `test-artifacts/main/participant-scoreboard-ui-tests.mjs`

- [x] **Step 1: Create the failing UI contract test**

Create `test-artifacts/main/participant-scoreboard-ui-tests.mjs` with:

```js
// main.js participant scoreboard rendering regression tests.

import fs from "fs";

const mainSrc = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const indexSrc = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

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

const escapeHtmlSrc = extractFunctionSource(mainSrc, "escapeHtml");
const escapeAttrSrc = extractFunctionSource(mainSrc, "escapeAttr");
const scoreToneSrc = extractFunctionSource(mainSrc, "participantScoreTone");
const renderParticipantRowSrc = extractFunctionSource(mainSrc, "renderParticipantScoreRow");

const { participantScoreTone, renderParticipantScoreRow } = new Function(
  `${escapeHtmlSrc}\n${escapeAttrSrc}\n${scoreToneSrc}\n${renderParticipantRowSrc}\nreturn { participantScoreTone, renderParticipantScoreRow };`,
)();

let pass = 0;
let fail = 0;

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

checkTrue("index has participant scoreboard container",
  indexSrc.includes("data-participant-scoreboard"));
checkTrue("main tracks participant scoreboard DOM",
  mainSrc.includes("participantScoreboard: document.querySelector(\"[data-participant-scoreboard]\")"));
checkTrue("main defines participant scoreboard renderer",
  mainSrc.includes("function renderParticipantScoreboard(sample)"));
checkTrue("renderSample calls participant scoreboard renderer",
  mainSrc.includes("renderParticipantScoreboard(sample)"));

check("participantScoreTone mvp", participantScoreTone(8), "mvp");
check("participantScoreTone good", participantScoreTone(6), "good");
check("participantScoreTone avg", participantScoreTone(4), "avg");
check("participantScoreTone poor", participantScoreTone(3.9), "poor");

const row = renderParticipantScoreRow({
  relation: "ENEMY",
  role: "MID",
  champion: "<img src=x onerror=alert(1)>",
  label: "상대 MID <script>alert(1)</script>",
  rankOverall: 1,
  rankTeam: 1,
  stats: { kills: 9, deaths: 3, assists: 6, csPerMinute: 7.36, damageToChampions: 31000, visionScore: 25 },
  score: { overall: 8.1, label: "캐리", categories: { combat: 9, income: 8, vision: 4, survival: 8 } },
  coaching: "상대 핵심 위협 <b>주의</b>",
});

checkTrue("row escapes champion markup", !row.includes("<img"));
checkTrue("row escapes script markup", !row.includes("<script"));
checkTrue("row escapes coaching html", !row.includes("<b>"));
checkTrue("row renders score", row.includes("8.1"));
checkTrue("row renders KDA", row.includes("9 / 3 / 6"));
checkTrue("row renders tone class", row.includes("participant-score-row--mvp"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [x] **Step 2: Run the RED UI test**

Run:

```bash
node --check test-artifacts/main/participant-scoreboard-ui-tests.mjs
node test-artifacts/main/participant-scoreboard-ui-tests.mjs
```

Expected:

- Syntax check exits `0`.
- Runtime exits `1` because the container, DOM binding, tone helper, row renderer, and detail render call do not exist yet.

---

### Task 4: Implement Participant Scoreboard UI

**Files:**
- Modify: `index.html`
- Modify: `main.js`
- Modify: `styles.css`

- [x] **Step 1: Add the container in `index.html`**

Inside the `#score` section, immediately after `<div class="laning-stats" data-laning-stats></div>`, add:

```html
            <div class="participant-scoreboard" data-participant-scoreboard></div>
```

- [x] **Step 2: Add DOM binding in `main.js`**

In the top `dom` object, after `scorePanel: document.querySelector("[data-score-panel]"),`, add:

```js
  participantScoreboard: document.querySelector("[data-participant-scoreboard]"),
```

- [x] **Step 3: Add renderer helpers after `renderPlaytimeScore(sample)`**

Add:

```js
function participantScoreTone(score) {
  if (score >= 8) return "mvp";
  if (score >= 6) return "good";
  if (score >= 4) return "avg";
  return "poor";
}

function participantRelationLabel(relation) {
  if (relation === "PLAYER") return "나";
  if (relation === "ALLY") return "아군";
  if (relation === "ENEMY") return "상대";
  return "참가자";
}

function renderParticipantScoreRow(participant) {
  const stats = participant.stats || {};
  const score = participant.score || {};
  const tone = participantScoreTone(Number(score.overall) || 0);
  const relation = participantRelationLabel(participant.relation);
  return `
    <article class="participant-score-row participant-score-row--${escapeAttr(tone)}" data-relation="${escapeAttr(participant.relation || "UNKNOWN")}">
      <div class="participant-score-row__main">
        <span class="participant-score-row__rank">#${Number(participant.rankOverall) || "-"}</span>
        <div>
          <strong>${escapeHtml(participant.label || `${relation} ${participant.role || ""} ${participant.champion || ""}`)}</strong>
          <p>${escapeHtml(relation)} · ${escapeHtml(participant.role || "UNKNOWN")} · 팀내 #${Number(participant.rankTeam) || "-"}</p>
        </div>
      </div>
      <div class="participant-score-row__score">
        <strong>${Number(score.overall || 0).toFixed(1)}</strong>
        <span>${escapeHtml(score.label || "")}</span>
      </div>
      <dl class="participant-score-row__stats">
        <div><dt>KDA</dt><dd>${Number(stats.kills) || 0} / ${Number(stats.deaths) || 0} / ${Number(stats.assists) || 0}</dd></div>
        <div><dt>CS/분</dt><dd>${Number(stats.csPerMinute || 0).toFixed(2)}</dd></div>
        <div><dt>딜</dt><dd>${Number(stats.damageToChampions || 0).toLocaleString("ko-KR")}</dd></div>
        <div><dt>시야</dt><dd>${Number(stats.visionScore || 0)}</dd></div>
      </dl>
      <p class="participant-score-row__coach">${escapeHtml(participant.coaching || "")}</p>
    </article>
  `;
}

function renderParticipantScoreTeam(title, participants) {
  if (!Array.isArray(participants) || participants.length === 0) return "";
  return `
    <section class="participant-score-team">
      <h3>${escapeHtml(title)}</h3>
      <div class="participant-score-list">
        ${participants.map(renderParticipantScoreRow).join("")}
      </div>
    </section>
  `;
}

function renderParticipantScoreboard(sample) {
  if (!dom.participantScoreboard) return;
  const scoreboard = sample.normalized?.participantScoreboard;
  if (!scoreboard || !Array.isArray(scoreboard.participants) || scoreboard.participants.length === 0) {
    dom.participantScoreboard.innerHTML = '<p class="muted">참가자별 스코어 데이터가 없습니다.</p>';
    return;
  }
  dom.participantScoreboard.innerHTML = `
    <div class="section-heading section-heading--compact">
      <h3>팀원·상대 플레이 스코어</h3>
      <p class="section-copy">이번 한 경기에서 10명의 전투, 성장, 시야, 생존 지표를 비교합니다.</p>
    </div>
    <div class="participant-scoreboard__grid">
      ${renderParticipantScoreTeam("우리 팀", scoreboard.teams?.ally || [])}
      ${renderParticipantScoreTeam("상대 팀", scoreboard.teams?.enemy || [])}
    </div>
  `;
}
```

- [x] **Step 4: Call the renderer from the detail render path**

Find the existing function that calls `renderPlaytimeScore(sample)` and add this call immediately after it:

```js
  renderParticipantScoreboard(sample);
```

- [x] **Step 5: Add styles near existing `.score-panel` styles**

Add:

```css
.participant-scoreboard {
  margin-top: var(--space-5);
}

.participant-scoreboard__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.participant-score-team h3 {
  margin: 0 0 var(--space-3);
  font-size: var(--fs-sm);
}

.participant-score-list {
  display: grid;
  gap: var(--space-3);
}

.participant-score-row {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  background: var(--surface-1);
}

.participant-score-row--mvp { border-color: var(--accent); }
.participant-score-row--good { border-color: var(--mint-soft); }
.participant-score-row--poor { border-color: var(--rose-soft); }

.participant-score-row__main,
.participant-score-row__score,
.participant-score-row__stats {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.participant-score-row__main {
  justify-content: space-between;
}

.participant-score-row__rank {
  min-width: 2.25rem;
  font-weight: 700;
  color: var(--muted);
}

.participant-score-row__score strong {
  font-size: var(--fs-lg);
}

.participant-score-row__stats {
  flex-wrap: wrap;
  margin: var(--space-3) 0 0;
}

.participant-score-row__stats div {
  min-width: 5rem;
}

.participant-score-row__stats dt {
  color: var(--muted);
  font-size: var(--fs-xs);
}

.participant-score-row__stats dd {
  margin: 0;
  font-weight: 700;
}

.participant-score-row__coach {
  margin: var(--space-3) 0 0;
  color: var(--text);
}

@media (max-width: 760px) {
  .participant-scoreboard__grid {
    grid-template-columns: 1fr;
  }
}
```

- [x] **Step 6: Run the UI test GREEN**

Run:

```bash
node --check main.js
node --check test-artifacts/main/participant-scoreboard-ui-tests.mjs
node test-artifacts/main/participant-scoreboard-ui-tests.mjs
node test-artifacts/main/demo-mode-ui-tests.mjs
```

Expected:

- All commands exit `0`.
- UI test reports every participant scoreboard check passed.
- Demo mode UI tests stay green.

- [ ] **Step 7: Commit UI slice**

```bash
git add index.html main.js styles.css test-artifacts/main/participant-scoreboard-ui-tests.mjs
git commit -m "feat: render participant score coaching"
```

---

### Task 5: Docs, QA, And Smoke Verification

**Files:**
- Modify: `README.md`
- Modify: `replay-coach-qa-checklist.md`

- [x] **Step 1: Update README feature summary**

In `README.md`, add this bullet near the replay analysis feature list:

```md
- 참가자별 플레이 스코어 코칭: 한 경기의 아군/상대 10명을 익명 공개 라벨로 정리하고 전투, 성장, 시야, 생존 점수와 짧은 코칭 문구를 표시합니다.
```

- [x] **Step 2: Update manual QA checklist**

In `replay-coach-qa-checklist.md`, add:

```md
## 참가자별 플레이 스코어 코칭

- [ ] 상세 개요 탭에서 `팀원·상대 플레이 스코어` 섹션이 보인다.
- [ ] 우리 팀 5명과 상대 팀 5명이 분리되어 보인다.
- [ ] 각 참가자는 챔피언, 역할, 전체 순위, 팀내 순위, 점수, KDA, CS/분, 딜, 시야, 코칭 문구를 표시한다.
- [ ] 타깃 플레이어는 `나` 또는 `내` 라벨로 구분된다.
- [ ] 참가자 섹션에 `puuid`, `summonerName`, Riot ID, raw matchId가 노출되지 않는다.
- [ ] 모바일 폭 760px 이하에서 우리 팀과 상대 팀이 한 컬럼으로 접힌다.
```

- [x] **Step 3: Run focused and full QA**

Run:

```bash
node test-artifacts/server/participant-scoreboard-tests.mjs
node test-artifacts/main/participant-scoreboard-ui-tests.mjs
npm test
git diff --check
```

Expected:

- Focused server and UI tests exit `0`.
- `npm test` exits `0` with zero failures.
- `git diff --check` exits `0`.

- [x] **Step 4: Run read-only smoke report**

Run:

```bash
SMOKE_REPORT_OUTPUT_ROOT=test-artifacts/tmp/participant-scoreboard-local npm run smoke:report:readonly
```

Expected:

- Command exits `0`.
- `test-artifacts/tmp/participant-scoreboard-local/qa-summary.json` has `latestRun.qaVerdict.status` equal to `"passed"`.

- [x] **Step 5: Run sensitive-output scan**

Run:

```bash
rg -n --hidden -S "RGAPI|api_key|RIOT_API_KEY|Authorization|Bearer|PUBLIC_DEMO_TOKEN: [^[:space:]]|x-demo-token: [^[:space:]]|access_token|token=|puuid|summonerName|riotIdGameName|riotIdTagline|kr\\.api\\.riotgames\\.com|americas\\.api\\.riotgames\\.com|/lol/|live Riot|sample generation" test-artifacts/tmp/participant-scoreboard-local
```

Expected:

- `rg` exits `1` with no matches.

- [ ] **Step 6: Commit docs and QA evidence**

```bash
git add README.md replay-coach-qa-checklist.md docs/superpowers/plans/2026-06-12-participant-score-coaching.md
git commit -m "docs: plan participant score coaching"
```

---

## Acceptance Criteria

- New generated samples include `normalized.participantScoreboard`.
- Stored legacy samples with `raw-match.json` receive participant scoreboard data at `/api/samples/:id` load time.
- Scoreboard contains exactly 10 participants when Riot match data has 10 participants.
- `teams.ally` contains the target player plus four allies, and `teams.enemy` contains five opponents.
- Participant rows expose only safe public fields: relation, role, champion, result, score, stats, rank, and coaching.
- Participant rows do not expose `puuid`, `summonerName`, Riot ID fields, API keys, or raw request details.
- UI renders an empty state when `participantScoreboard` is missing.
- UI escapes champion labels and coaching text before writing `innerHTML`.
- Mobile layout remains one column under 760px.
- Focused tests, full `npm test`, `git diff --check`, read-only smoke report, and sensitive-output scan pass.

## Self-Review Notes

- Spec coverage: The plan covers server data creation, legacy backfill, UI rendering, styling, docs, QA, and privacy checks for ally/enemy participant score coaching.
- Placeholder scan target: `rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in[ ]details|appropr[i]ate|Similar t[o]" docs/superpowers/plans/2026-06-12-participant-score-coaching.md`
- Type consistency: The feature uses `normalized.participantScoreboard`, `buildParticipantScoreboard(matchDetail, { targetPuuid })`, `participantScoreboard.teams.ally`, `participantScoreboard.teams.enemy`, `renderParticipantScoreboard(sample)`, and `[data-participant-scoreboard]` consistently across tasks.
