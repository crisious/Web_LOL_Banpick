const http = require("http");
const https = require("https");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URL } = require("url");
const { spawn } = require("child_process");

const root = __dirname;
loadEnvFile(path.join(root, ".env"));
const port = Number(process.env.PORT || 8123);
// Champions tab: Riot match-v5/ids?startTime 필터용 시즌 시작 epoch.
// S16 split 1 시작 시각 (Riot 패치노트 기준). 시즌 갱신 시 1회 업데이트.
const SEASON_START_EPOCH = Date.UTC(2026, 0, 9) / 1000;
const manifestPath = path.join(root, "data", "samples", "manifest.json");

// ─── Simple in-memory rate limiter ───────────────────────────────────────────
const rateBuckets = new Map();
function rateLimit(key, windowMs) {
  const now = Date.now();
  const last = rateBuckets.get(key) || 0;
  if (now - last < windowMs) return false;
  rateBuckets.set(key, now);
  return true;
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key]) {
      continue;
    }

    let value = rawValue.trim();
    const hasDoubleQuotes = value.startsWith("\"") && value.endsWith("\"");
    const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
    if (hasDoubleQuotes || hasSingleQuotes) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJson(filePath) {
  const raw = await fsp.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
  await fsp.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function durationLabel(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function timestampLabel(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function queueLabel(queueId) {
  const labels = {
    420: "RANKED_SOLO",
    430: "NORMAL_BLIND",
    440: "RANKED_FLEX",
    450: "ARAM",
  };
  return labels[queueId] || `QUEUE_${queueId}`;
}

function rankedQueueLabel(queueType) {
  const labels = {
    RANKED_SOLO_5x5: "솔로랭크",
    RANKED_FLEX_SR: "자유랭크",
  };
  return labels[queueType] || queueType || "랭크";
}

function buildRankedSnapshot(entry) {
  if (!entry) return null;
  const wins = Number(entry.wins || 0);
  const losses = Number(entry.losses || 0);
  return {
    queueType: entry.queueType || "",
    queueLabel: rankedQueueLabel(entry.queueType),
    tier: entry.tier || "",
    rank: entry.rank || "",
    lp: Number(entry.leaguePoints || 0),
    wins,
    losses,
    winRate: Math.round((wins / Math.max(1, wins + losses)) * 100),
  };
}

function selectRankedEntry(entries) {
  if (!Array.isArray(entries)) return null;
  return (
    entries.find((entry) => entry.queueType === "RANKED_SOLO_5x5") ||
    entries.find((entry) => entry.queueType === "RANKED_FLEX_SR") ||
    null
  );
}

function normalizeRole(role) {
  const map = {
    TOP: "TOP",
    JUNGLE: "JUNGLE",
    MIDDLE: "MID",
    MID: "MID",
    BOTTOM: "ADC",
    ADC: "ADC",
    UTILITY: "SUPPORT",
    SUPPORT: "SUPPORT",
  };
  return map[role] || role || "UNKNOWN";
}

function regionalCluster(platformRegion) {
  const map = {
    KR: "asia",
    JP1: "asia",
    NA1: "americas",
    BR1: "americas",
    LA1: "americas",
    LA2: "americas",
    EUW1: "europe",
    EUN1: "europe",
    TR1: "europe",
    RU: "europe",
  };
  return map[String(platformRegion || "").toUpperCase()] || "asia";
}

function participantTeam(participantId) {
  if (participantId >= 1 && participantId <= 5) {
    return 100;
  }
  if (participantId >= 6 && participantId <= 10) {
    return 200;
  }
  return null;
}

function phaseFor(timestampMs) {
  if (timestampMs <= 900000) {
    return "EARLY";
  }
  if (timestampMs <= 1800000) {
    return "MID";
  }
  return "LATE";
}

function laneHintForEvent(event) {
  if (event.monsterType === "DRAGON") {
    return "DRAGON_RIVER";
  }
  if (event.monsterType === "BARON_NASHOR") {
    return "BARON_RIVER";
  }
  if (event.monsterType === "RIFTHERALD" || event.monsterType === "HORDE") {
    return "TOP_RIVER";
  }
  if (event.laneType === "MID_LANE") {
    return "MID_LANE";
  }
  if (event.laneType === "TOP_LANE") {
    return "TOP_LANE";
  }
  if (event.laneType === "BOT_LANE") {
    return "BOT_LANE";
  }
  return "RIVER";
}

function importanceForEvent(eventType, phase, event) {
  if (eventType === "BARON_FIGHT") {
    return 5;
  }
  if (eventType === "DRAGON_FIGHT") {
    return phase === "EARLY" ? 4 : 5;
  }
  if (eventType === "OBJECTIVE_SETUP_WIN" || eventType === "OBJECTIVE_SETUP_FAIL") {
    return event.monsterType === "RIFTHERALD" || event.monsterType === "HORDE" ? 4 : 5;
  }
  if (eventType === "PLAYER_DEATH") {
    return phase === "EARLY" ? 4 : 5;
  }
  if (eventType === "TOWER_TAKE") {
    if (event.buildingType === "INHIBITOR_BUILDING" || event.towerType === "NEXUS_TURRET") {
      return 5;
    }
    return phase === "EARLY" ? 3 : 4;
  }
  if (eventType === "CHAMPION_KILL") {
    return phase === "LATE" ? 4 : 4;
  }
  return phase === "EARLY" ? 3 : 4;
}

function summaryForEvent(eventType, phase, event, playerWonObjective) {
  if (eventType === "PLAYER_DEATH") {
    if (phase === "EARLY") {
      return "초반 교전에서 먼저 끊기며 템포가 흔들렸다.";
    }
    if (phase === "MID") {
      return "중반 핵심 구도에서 데스를 내주며 운영 안정감이 흔들렸다.";
    }
    return "후반 결정적인 구도에서 생존하지 못했다.";
  }

  if (eventType === "CHAMPION_KILL") {
    return "교전에서 직접 킬을 만들며 흐름을 당겨 왔다.";
  }

  if (eventType === "TEAMFIGHT_FOLLOWUP" || eventType === "SKIRMISH_WIN") {
    return "교전 후속 합류로 킬 관여를 만들었다.";
  }

  if (eventType === "DRAGON_FIGHT") {
    return "드래곤 타이밍에 합류해 오브젝트 템포를 챙겼다.";
  }

  if (eventType === "BARON_FIGHT") {
    return playerWonObjective
      ? "바론 확보에 관여하며 경기 흐름을 다시 붙잡았다."
      : "바론 구도에 관여했지만 상대에게 바론을 내줬다.";
  }

  if (eventType === "OBJECTIVE_SETUP_WIN") {
    return "정글 오브젝트를 챙기며 구조물 압박 재료를 마련했다.";
  }

  if (eventType === "OBJECTIVE_SETUP_FAIL") {
    return "중요 오브젝트나 구조물을 상대에게 내주며 흐름이 흔들렸다.";
  }

  if (eventType === "TOWER_TAKE") {
    return "구조물 압박에 관여하며 승리 조건을 구조물로 전환했다.";
  }

  return "핵심 장면에 관여했다.";
}

function buildEventType(rawEvent, targetParticipantId, targetTeamId, playerWonObjective) {
  if (rawEvent.type === "CHAMPION_KILL") {
    if (rawEvent.victimId === targetParticipantId) {
      return "PLAYER_DEATH";
    }
    if (rawEvent.killerId === targetParticipantId) {
      return "CHAMPION_KILL";
    }
    return rawEvent.assistingParticipantIds.length > 1 ? "TEAMFIGHT_FOLLOWUP" : "SKIRMISH_WIN";
  }

  if (rawEvent.type === "ELITE_MONSTER_KILL") {
    if (rawEvent.monsterType === "DRAGON") {
      return playerWonObjective ? "DRAGON_FIGHT" : "OBJECTIVE_SETUP_FAIL";
    }
    if (rawEvent.monsterType === "BARON_NASHOR") {
      return "BARON_FIGHT";
    }
    return playerWonObjective ? "OBJECTIVE_SETUP_WIN" : "OBJECTIVE_SETUP_FAIL";
  }

  if (rawEvent.type === "BUILDING_KILL") {
    return rawEvent.teamId === targetTeamId ? "OBJECTIVE_SETUP_FAIL" : "TOWER_TAKE";
  }

  return "SKIRMISH_WIN";
}

function shouldKeepEvent(rawEvent, targetParticipantId, targetTeamId) {
  const playerInvolved =
    rawEvent.killerId === targetParticipantId ||
    rawEvent.victimId === targetParticipantId ||
    rawEvent.assistingParticipantIds.includes(targetParticipantId);

  if (rawEvent.type === "CHAMPION_KILL") {
    return playerInvolved;
  }

  if (rawEvent.type === "ELITE_MONSTER_KILL") {
    return true;
  }

  if (rawEvent.type === "BUILDING_KILL") {
    return playerInvolved || rawEvent.teamId !== targetTeamId;
  }

  return false;
}

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = [
      event.timestampMs,
      event.eventType,
      event.rawRef.frameIndex,
      event.rawRef.eventIndex,
    ].join(":");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractTimelineEvents(matchDetail, timeline, targetParticipantId, targetTeamId) {
  const events = [];
  let eventIndex = 1;
  let lastHordeTimestamp = -Infinity;

  timeline.info.frames.forEach((frame, frameIndex) => {
    frame.events.forEach((event, innerIndex) => {
      const rawEvent = {
        type: event.type,
        timestamp: event.timestamp || 0,
        killerId: event.killerId || null,
        victimId: event.victimId || null,
        assistingParticipantIds: event.assistingParticipantIds || [],
        monsterType: event.monsterType || null,
        monsterSubType: event.monsterSubType || null,
        buildingType: event.buildingType || null,
        laneType: event.laneType || null,
        towerType: event.towerType || null,
        teamId: event.teamId || null,
      };

      if (
        rawEvent.type !== "CHAMPION_KILL" &&
        rawEvent.type !== "ELITE_MONSTER_KILL" &&
        rawEvent.type !== "BUILDING_KILL"
      ) {
        return;
      }

      if (!shouldKeepEvent(rawEvent, targetParticipantId, targetTeamId)) {
        return;
      }

      if (
        rawEvent.type === "ELITE_MONSTER_KILL" &&
        rawEvent.monsterType === "HORDE" &&
        rawEvent.timestamp - lastHordeTimestamp < 20000
      ) {
        return;
      }

      if (rawEvent.type === "ELITE_MONSTER_KILL" && rawEvent.monsterType === "HORDE") {
        lastHordeTimestamp = rawEvent.timestamp;
      }

      const objectiveTeam = participantTeam(rawEvent.killerId);
      const playerWonObjective = objectiveTeam === targetTeamId;
      const phase = phaseFor(rawEvent.timestamp);
      const eventType = buildEventType(rawEvent, targetParticipantId, targetTeamId, playerWonObjective);

      events.push({
        eventId: `evt_${String(eventIndex).padStart(3, "0")}`,
        timestampMs: rawEvent.timestamp,
        timestampLabel: timestampLabel(rawEvent.timestamp),
        phase,
        eventType,
        importance: importanceForEvent(eventType, phase, rawEvent),
        isPlayerInvolved:
          rawEvent.killerId === targetParticipantId ||
          rawEvent.victimId === targetParticipantId ||
          rawEvent.assistingParticipantIds.includes(targetParticipantId),
        laneHint: laneHintForEvent(rawEvent),
        summary: summaryForEvent(eventType, phase, rawEvent, playerWonObjective),
        rawRef: {
          frameIndex,
          eventIndex: innerIndex,
        },
      });

      eventIndex += 1;
    });
  });

  return dedupeEvents(events);
}

function buildPhaseContext(events) {
  const phases = {
    EARLY: { startMs: 0, endMs: 900000, kills: 0, deaths: 0, assists: 0, notableEventCount: 0 },
    MID: {
      startMs: 900001,
      endMs: 1800000,
      kills: 0,
      deaths: 0,
      assists: 0,
      notableEventCount: 0,
    },
    LATE: {
      startMs: 1800001,
      endMs: events.length ? events[events.length - 1].timestampMs : 1800001,
      kills: 0,
      deaths: 0,
      assists: 0,
      notableEventCount: 0,
    },
  };

  events.forEach((event) => {
    const bucket = phases[event.phase];
    if (!bucket) {
      return;
    }
    if (event.eventType === "CHAMPION_KILL") {
      bucket.kills += 1;
    } else if (event.eventType === "PLAYER_DEATH") {
      bucket.deaths += 1;
    } else if (event.eventType === "TEAMFIGHT_FOLLOWUP" || event.eventType === "SKIRMISH_WIN") {
      bucket.assists += 1;
    }
    if (event.importance >= 4) {
      bucket.notableEventCount += 1;
    }
  });

  return {
    early: phases.EARLY,
    mid: phases.MID,
    late: phases.LATE,
  };
}

function buildDerivedSignals(normalized) {
  const events = normalized.timelineEvents;
  const objectiveWins = events.filter((event) =>
    ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN", "TOWER_TAKE"].includes(event.eventType),
  );
  const objectiveFails = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");
  const playerDeaths = events.filter((event) => event.eventType === "PLAYER_DEATH");
  const earlyDeaths = playerDeaths.filter((event) => event.phase === "EARLY");
  const lateTowers = events.filter(
    (event) => event.phase === "LATE" && event.eventType === "TOWER_TAKE",
  );
  const postObjectiveDeaths = playerDeaths.filter((deathEvent) =>
    objectiveWins.some(
      (objectiveEvent) =>
        objectiveEvent.timestampMs < deathEvent.timestampMs &&
        deathEvent.timestampMs - objectiveEvent.timestampMs <= 120000,
    ),
  );

  const candidateThemes = [];
  if (earlyDeaths.length >= 2) {
    candidateThemes.push("weak_early_stability");
  }
  if (objectiveWins.length >= 3) {
    candidateThemes.push("strong_objective_tempo");
  }
  if (postObjectiveDeaths.length >= 1) {
    candidateThemes.push("poor_post_objective_survivability");
  }
  if (
    normalized.matchInfo.position !== "SUPPORT" &&
    normalized.playerStats.csPerMinute <
      { TOP: 6, MID: 6, ADC: 6.5, JUNGLE: 4.5, SUPPORT: 0 }[normalized.matchInfo.position]
  ) {
    candidateThemes.push("low_resource_conversion");
  }
  if (lateTowers.length >= 1 && normalized.matchInfo.result === "WIN") {
    candidateThemes.push("late_structure_closeout");
  }

  return {
    hasEarlyLeadMoments: objectiveWins.some((event) => event.phase === "EARLY"),
    hasMidGameThrowRisk:
      postObjectiveDeaths.length >= 1 ||
      playerDeaths.filter((event) => event.phase === "MID").length >= 2,
    hasObjectiveControlIssues: objectiveFails.length >= 2,
    hasStrongRoamingPattern: false,
    hasPositioningRisk: playerDeaths.length >= 4,
    candidateThemes,
  };
}

function buildNormalized(account, matchDetail, timeline, options) {
  const participant = matchDetail.info.participants.find((entry) => entry.puuid === account.puuid);
  if (!participant) {
    throw new Error("Target participant not found in match.");
  }

  const role = normalizeRole(participant.teamPosition || participant.individualPosition);
  const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
  const teamTotalKills = matchDetail.info.participants
    .filter((entry) => entry.teamId === participant.teamId)
    .reduce((sum, entry) => sum + (entry.kills || 0), 0);

  const timelineEvents = extractTimelineEvents(matchDetail, timeline, participant.participantId, participant.teamId);
  const phaseContext = buildPhaseContext(timelineEvents);

  const normalized = {
    schemaVersion: "1.0",
    sourceMeta: {
      sourceType: "riot_match_v5",
      fetchedAt: new Date().toISOString(),
      platformRegion: String(options.platformRegion || "KR").toUpperCase(),
      regionalCluster: String(options.cluster || "asia").toUpperCase(),
      rawMatchId: matchDetail.metadata.matchId,
    },
    playerContext: {
      puuid: account.puuid,
      riotId: options.publicAlias,
      isAnonymous: true,
      participantId: participant.participantId,
    },
    matchInfo: {
      matchId: matchDetail.metadata.matchId,
      queueId: matchDetail.info.queueId,
      queueLabel: queueLabel(matchDetail.info.queueId),
      mapId: matchDetail.info.mapId,
      mapLabel: matchDetail.info.mapId === 11 ? "SUMMONERS_RIFT" : `MAP_${matchDetail.info.mapId}`,
      gameVersion: matchDetail.info.gameVersion,
      gameCreation: new Date(matchDetail.info.gameCreation).toISOString(),
      durationSeconds: matchDetail.info.gameDuration,
      durationLabel: durationLabel(matchDetail.info.gameDuration),
      result: participant.win ? "WIN" : "LOSS",
      champion: participant.championName,
      position: role,
      teamId: participant.teamId,
    },
    playerStats: {
      kills: participant.kills || 0,
      deaths: participant.deaths || 0,
      assists: participant.assists || 0,
      kda: Number(((participant.kills + participant.assists) / Math.max(1, participant.deaths)).toFixed(2)),
      cs,
      csPerMinute: Number((cs / (matchDetail.info.gameDuration / 60)).toFixed(2)),
      goldEarned: participant.goldEarned || 0,
      damageToChampions: participant.totalDamageDealtToChampions || 0,
      visionScore: participant.visionScore || 0,
      killParticipation: Number(
        (((participant.kills + participant.assists) / Math.max(1, teamTotalKills))).toFixed(2),
      ),
      champLevel: participant.champLevel || 0,
      summonerSpells: [participant.summoner1Id || 0, participant.summoner2Id || 0],
      items: [
        participant.item0 || 0,
        participant.item1 || 0,
        participant.item2 || 0,
        participant.item3 || 0,
        participant.item4 || 0,
        participant.item5 || 0,
        participant.item6 || 0,
      ],
    },
    challengeStats: (() => {
      const c = participant.challenges || {};
      return {
        damagePerMinute: c.damagePerMinute || 0,
        goldPerMinute: c.goldPerMinute || 0,
        visionScorePerMinute: c.visionScorePerMinute || 0,
        killParticipation: c.killParticipation || 0,
        teamDamagePercentage: c.teamDamagePercentage || 0,
        soloKills: c.soloKills || 0,
        laneMinionsFirst10Minutes: c.laneMinionsFirst10Minutes || 0,
        maxCsAdvantageOnLaneOpponent: c.maxCsAdvantageOnLaneOpponent || 0,
        maxLevelLeadLaneOpponent: c.maxLevelLeadLaneOpponent || 0,
        turretPlatesTaken: c.turretPlatesTaken || 0,
        earlyLaningPhaseGoldExpAdvantage: c.earlyLaningPhaseGoldExpAdvantage || 0,
        controlWardsPlaced: c.controlWardsPlaced || 0,
        skillshotsDodged: c.skillshotsDodged || 0,
        outnumberedKills: c.outnumberedKills || 0,
      };
    })(),
    teamContext: {
      teamTotalKills,
      teamGoldEstimate: 0,
      teamDragons:
        matchDetail.info.teams.find((team) => team.teamId === participant.teamId)?.objectives?.dragon
          ?.kills || 0,
      teamBarons:
        matchDetail.info.teams.find((team) => team.teamId === participant.teamId)?.objectives?.baron
          ?.kills || 0,
      teamTowers:
        matchDetail.info.teams.find((team) => team.teamId === participant.teamId)?.objectives?.tower
          ?.kills || 0,
      enemyDragons:
        matchDetail.info.teams.find((team) => team.teamId !== participant.teamId)?.objectives?.dragon
          ?.kills || 0,
      enemyBarons:
        matchDetail.info.teams.find((team) => team.teamId !== participant.teamId)?.objectives?.baron
          ?.kills || 0,
      enemyTowers:
        matchDetail.info.teams.find((team) => team.teamId !== participant.teamId)?.objectives?.tower
          ?.kills || 0,
    },
    phaseContext,
    timelineEvents,
    derivedSignals: {
      hasEarlyLeadMoments: false,
      hasMidGameThrowRisk: false,
      hasObjectiveControlIssues: false,
      hasStrongRoamingPattern: false,
      hasPositioningRisk: false,
      candidateThemes: [],
    },
  };

  normalized.derivedSignals = buildDerivedSignals(normalized);
  normalized.playtimeScore = buildPlaytimeScore(normalized);

  // participantId → teamId 매핑 (오브젝트 타임라인용)
  const participantTeamMap = new Map();
  matchDetail.info.participants.forEach((p) => participantTeamMap.set(p.participantId, p.teamId));
  normalized.objectiveTimeline = buildObjectiveTimeline(timeline, participant.teamId, participantTeamMap);
  normalized.kdaTimeline = buildKdaTimeline(normalized);
  normalized.wardTimeline = buildWardTimeline(timeline, participant.participantId);
  normalized.itemTimeline = buildItemTimeline(timeline, participant.participantId);

  return normalized;
}

function bestObjectiveSummary(normalized) {
  const wins = normalized.timelineEvents.filter((event) =>
    ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType),
  );
  if (wins.length >= 4) {
    return "주요 오브젝트 타이밍을 꾸준히 챙겼음";
  }
  if (wins.length >= 2) {
    return "오브젝트 타이밍에 자주 합류했음";
  }
  return null;
}

function bestFightSummary(normalized) {
  const combat = normalized.timelineEvents.filter((event) =>
    ["CHAMPION_KILL", "TEAMFIGHT_FOLLOWUP", "SKIRMISH_WIN"].includes(event.eventType),
  );
  if (combat.length >= 3 || normalized.playerStats.killParticipation >= 0.35) {
    return "교전 후속 합류 기여가 좋았음";
  }
  return null;
}

function lowFarmThreshold(position) {
  return {
    TOP: 6,
    MID: 6,
    ADC: 6.5,
    JUNGLE: 4.5,
    SUPPORT: 0,
  }[position] || 0;
}

function buildStrengths(normalized) {
  const strengths = [];
  const events = normalized.timelineEvents;
  const objectiveTitle = bestObjectiveSummary(normalized);

  if (objectiveTitle) {
    const linked = events
      .filter((event) => ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType))
      .slice(0, 4);
    strengths.push({
      id: "str_01",
      title: objectiveTitle,
      description:
        "초중후반 오브젝트 타이밍에 빠지지 않고 관여해 팀이 경기 구조를 잃지 않도록 만들었다.",
      evidence: linked
        .map((event) => `${event.timestampLabel} ${event.eventType}`)
        .join(", "),
      impact:
        normalized.matchInfo.result === "WIN"
          ? "팀이 유리한 운영 구조를 유지하는 데 큰 도움이 됐다."
          : "불리한 경기에서도 역전 기회를 여러 번 만들 수 있었다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }

  if (bestFightSummary(normalized)) {
    const linked = events
      .filter((event) => ["CHAMPION_KILL", "TEAMFIGHT_FOLLOWUP", "SKIRMISH_WIN"].includes(event.eventType))
      .slice(0, 3);
    strengths.push({
      id: "str_02",
      title: bestFightSummary(normalized),
      description:
        "개인 킬 수보다도 팀 교전이 열렸을 때 늦지 않게 붙어 한타 흐름을 이어 주는 장면이 많았다.",
      evidence: linked
        .map((event) => `${event.timestampLabel} ${event.summary}`)
        .join(" "),
      impact: "한타가 길어졌을 때 팀이 추가 킬을 만드는 흐름을 도와줬다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }

  if (normalized.playerStats.visionScore >= (normalized.matchInfo.position === "JUNGLE" ? 35 : 25)) {
    strengths.push({
      id: "str_03",
      title: "시야 투자량이 높은 편이었음",
      description:
        "해당 포지션 기준으로 시야 점수가 높은 편이라, 단순히 싸움만 한 경기는 아니었다.",
      evidence: `비전 점수 ${normalized.playerStats.visionScore} 기록`,
      impact: "오브젝트 준비와 팀 합류 타이밍을 맞추는 기반이 됐다.",
      relatedEventIds: ["stat_vision"],
    });
  }

  if (
    strengths.length < 3 &&
    normalized.matchInfo.result === "WIN" &&
    events.some((event) => event.eventType === "TOWER_TAKE")
  ) {
    const linked = events.filter((event) => event.eventType === "TOWER_TAKE").slice(-2);
    strengths.push({
      id: `str_0${strengths.length + 1}`,
      title: "구조물 압박으로 승리 조건을 연결했음",
      description: "교전에서 끝나지 않고 구조물 파괴로 승리 조건을 실제 결과로 전환했다.",
      evidence: linked.map((event) => `${event.timestampLabel} ${event.laneHint}`).join(", "),
      impact: "길어질 수 있는 경기를 실제 승리로 마무리했다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }

  while (strengths.length < 3) {
    strengths.push({
      id: `str_0${strengths.length + 1}`,
      title: "주요 구도에 계속 합류했음",
      description: "라인이나 정글을 비우는 타이밍에도 핵심 구도에 늦지 않게 관여한 장면이 있었다.",
      evidence: "중요 이벤트 구간에 반복적으로 등장했다.",
      impact: "팀이 완전히 무너지지 않도록 시간을 벌었다.",
      relatedEventIds: events.slice(0, 2).map((event) => event.eventId),
    });
  }

  return strengths.slice(0, 3);
}

function buildWeaknesses(normalized) {
  const weaknesses = [];
  const events = normalized.timelineEvents;
  const deaths = events.filter((event) => event.eventType === "PLAYER_DEATH");
  const earlyDeaths = deaths.filter((event) => event.phase === "EARLY");
  const objectiveWins = events.filter((event) =>
    ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType),
  );
  const postObjectiveDeaths = deaths.filter((deathEvent) =>
    objectiveWins.some(
      (objectiveEvent) =>
        objectiveEvent.timestampMs < deathEvent.timestampMs &&
        deathEvent.timestampMs - objectiveEvent.timestampMs <= 120000,
    ),
  );

  if (earlyDeaths.length >= 2) {
    weaknesses.push({
      id: "weak_01",
      title: "초반 안정감이 낮았음",
      description: "초반 데스로 성장 구간을 어렵게 시작하면서 이후 운영이 더 까다로워졌다.",
      evidence: earlyDeaths.map((event) => `${event.timestampLabel} ${event.summary}`).join(" "),
      impact: "초반 스노우볼을 만들거나 안정적인 성장 곡선을 그리기 어려웠다.",
      improvementHint:
        "초반 10분은 오브젝트 이후나 라인 푸시 이후에 한 템포 먼저 빠지는 기준을 만들어 손해 없는 출발을 우선하는 것이 좋다.",
      relatedEventIds: earlyDeaths.map((event) => event.eventId),
    });
  }

  if (normalized.playerStats.csPerMinute < lowFarmThreshold(normalized.matchInfo.position)) {
    weaknesses.push({
      id: `weak_0${weaknesses.length + 1}`,
      title: "자원 전환 속도가 느렸음",
      description: "포지션 기준으로 분당 CS가 낮아 골드 전환 속도가 더 느린 편이었다.",
      evidence: `총 CS ${normalized.playerStats.cs}, 분당 CS ${normalized.playerStats.csPerMinute}`,
      impact: "오브젝트 관여를 해도 개인 성장 속도가 늦어 후반 영향력이 줄어들 수 있다.",
      improvementHint:
        "교전이 비는 구간에는 가장 가까운 웨이브나 캠프를 더 확실하게 챙겨 자원 손실을 줄이는 연습이 필요하다.",
      relatedEventIds: ["stat_cs"],
    });
  }

  if (postObjectiveDeaths.length >= 1 || normalized.playerStats.deaths >= (normalized.matchInfo.result === "WIN" ? 5 : 4)) {
    const linked = postObjectiveDeaths.length ? postObjectiveDeaths : deaths.slice(0, 2);
    weaknesses.push({
      id: `weak_0${weaknesses.length + 1}`,
      title: "오브젝트 이후 생존과 전환이 아쉬웠음",
      description:
        "큰 오브젝트를 챙긴 뒤나 한타 직후에 데스를 내주며 만든 이득을 더 길게 굴리지 못한 장면이 있었다.",
      evidence: linked.map((event) => `${event.timestampLabel} ${event.summary}`).join(" "),
      impact:
        normalized.matchInfo.result === "WIN"
          ? "이기는 경기를 더 길게 끌고 가는 원인이 됐다."
          : "오브젝트로 만든 반격 흐름이 다시 끊겼다.",
      improvementHint:
        "오브젝트를 챙긴 뒤에는 추가 교전을 오래 보기보다 먼저 리셋, 시야 재정비, 라인 정리를 우선하는 루틴이 필요하다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }

  if (weaknesses.length < 3) {
    const objectiveFails = events.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL");
    const linked = objectiveFails.length ? objectiveFails.slice(0, 2) : deaths.slice(0, 2);
    weaknesses.push({
      id: `weak_0${weaknesses.length + 1}`,
      title: "중요 구도 판단을 더 빠르게 정리할 필요가 있음",
      description: "contest와 이탈 중 하나를 더 빠르게 정하면 손실을 줄일 수 있는 장면이 있었다.",
      evidence:
        linked.length > 0
          ? linked.map((event) => `${event.timestampLabel} ${event.summary}`).join(" ")
          : "중요 구도에서 판단이 길어진 장면이 있었다.",
      impact: "작은 지연이 데스나 오브젝트 손실로 이어질 수 있다.",
      improvementHint: "시야가 밀리거나 숫자가 안 맞으면 contest 기준을 짧게 정하고 빠르게 후퇴하는 콜을 만드는 편이 좋다.",
      relatedEventIds: linked.map((event) => event.eventId),
    });
  }

  return weaknesses.slice(0, 3);
}

function buildActionChecklist(normalized, weaknesses) {
  return weaknesses.slice(0, 4).map((item, index) => ({
    id: `act_0${index + 1}`,
    priority: index + 1,
    action:
      index === 0
        ? "초반 주요 구도 직후에는 한 템포 먼저 빠지는 기준 만들기"
        : index === 1
          ? "교전이 비는 구간에는 웨이브나 캠프를 더 확실하게 챙겨 자원 손실 줄이기"
          : index === 2
            ? "드래곤·바론 직후에는 추가 추격보다 리셋과 라인 정리를 먼저 선택하기"
            : "시야가 밀릴 때는 contest와 이탈 중 하나를 더 빠르게 결정하기",
    reason: item.improvementHint,
  }));
}

function buildPhaseSummaries(normalized) {
  const eventsByPhase = {
    EARLY: normalized.timelineEvents.filter((event) => event.phase === "EARLY"),
    MID: normalized.timelineEvents.filter((event) => event.phase === "MID"),
    LATE: normalized.timelineEvents.filter((event) => event.phase === "LATE"),
  };

  return ["EARLY", "MID", "LATE"].map((phaseKey) => {
    const phaseEvents = eventsByPhase[phaseKey];
    const bucket =
      phaseKey === "EARLY"
        ? normalized.phaseContext.early
        : phaseKey === "MID"
          ? normalized.phaseContext.mid
          : normalized.phaseContext.late;

    const objectiveWins = phaseEvents.filter((event) =>
      ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN", "TOWER_TAKE"].includes(event.eventType),
    ).length;
    const objectiveFails = phaseEvents.filter((event) => event.eventType === "OBJECTIVE_SETUP_FAIL").length;
    const rating =
      bucket.deaths > bucket.kills + bucket.assists
        ? "BAD"
        : objectiveWins > objectiveFails
          ? "GOOD"
          : "NEUTRAL";

    const summary =
      phaseKey === "EARLY"
        ? bucket.deaths >= 2
          ? "초반에는 먼저 끊기며 안정감이 떨어졌지만, 오브젝트 타이밍 합류는 계속 시도했다."
          : "초반 오브젝트와 첫 교전 템포를 무난하게 챙겼다."
        : phaseKey === "MID"
          ? objectiveWins >= 2
            ? "중반에는 오브젝트나 한타 후속 합류가 살아 있어 경기 핵심 구도를 주도했다."
            : "중반에는 좋은 장면과 아쉬운 장면이 함께 나오며 흐름이 요동쳤다."
          : normalized.matchInfo.result === "WIN"
            ? "후반에는 구조물 마무리와 중요한 교전 정리가 승리로 연결됐다."
            : "후반에는 교전 영향력은 있었지만 마지막 수비 구도를 지키지 못했다.";

    const focus =
      phaseKey === "EARLY"
        ? "초반엔 오브젝트 직후 체력과 라인 상태를 먼저 정리해 손해 없는 출발을 만드는 것이 중요하다."
        : phaseKey === "MID"
          ? "중반엔 오브젝트를 챙긴 뒤 바로 다음 라인과 시야 정리까지 연결하는 루틴을 고정하면 좋다."
          : "후반에는 킬 자체보다 살아남아 구조물을 어떻게 밀지 빠르게 정리하는 판단이 중요하다.";

    return {
      phase: phaseKey,
      rating,
      summary,
      focus,
    };
  });
}

// ─── Playtime Score ──────────────────────────────────────────────────────

function clamp10(v) { return Math.min(10, Math.max(0, +v.toFixed(1))); }

function calcCombatScore(stats, challenges, minutes) {
  const dpm = challenges.damagePerMinute || (stats.damageToChampions / minutes);
  const kdaPart = Math.min(stats.kda, 6) / 6 * 5;
  const kpPart = Math.min(challenges.killParticipation || stats.killParticipation, 0.6) / 0.6 * 2;
  const dpmPart = Math.min(dpm / 800, 1) * 2;
  const soloPart = Math.min((challenges.soloKills || 0), 3) * 0.33;
  return clamp10(kdaPart + kpPart + dpmPart + soloPart);
}

function calcIncomeScore(stats, challenges, position, minutes) {
  const csThreshold = { TOP: 6.5, MID: 7, ADC: 7.5, JUNGLE: 5, SUPPORT: 1.5 }[position] || 6;
  const gpm = challenges.goldPerMinute || (stats.goldEarned / minutes);
  const csPart = Math.min(stats.csPerMinute / csThreshold, 1.2) * 4;
  const goldPart = Math.min(gpm / 450, 1.2) * 4;
  const platePart = Math.min((challenges.turretPlatesTaken || 0), 5) * 0.4;
  return clamp10(csPart + goldPart + platePart);
}

function calcVisionScore(stats, challenges, minutes) {
  const vsPerMin = challenges.visionScorePerMinute || (stats.visionScore / minutes);
  const cwPart = Math.min((challenges.controlWardsPlaced || 0), 8) * 0.25;
  return clamp10(Math.min(vsPerMin / 1.5, 1.2) * 8 + cwPart);
}

function calcSurvivalScore(stats, minutes) {
  const deathsPerMin = stats.deaths / minutes;
  if (deathsPerMin <= 0.1) return 10;
  if (deathsPerMin <= 0.2) return 8;
  if (deathsPerMin <= 0.3) return 6;
  if (deathsPerMin <= 0.4) return 4;
  return clamp10(2 - (deathsPerMin - 0.4) * 5);
}

function calcObjectiveScore(events) {
  const wins = events.filter((e) => ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(e.eventType)).length;
  const fails = events.filter((e) => e.eventType === "OBJECTIVE_SETUP_FAIL").length;
  const total = wins + fails;
  if (total === 0) return 5;
  const ratio = wins / total;
  return clamp10(ratio * 8 + Math.min(wins, 5) * 0.4);
}

function calcStructureScore(team, events) {
  const towerTakes = events.filter((e) => e.eventType === "TOWER_TAKE").length;
  const towerDiff = (team.teamTowers || 0) - (team.enemyTowers || 0);
  const towerPart = Math.min(towerTakes, 4) * 1.5;
  const diffPart = Math.min(Math.max(towerDiff + 3, 0), 6) / 6 * 4;
  return clamp10(towerPart + diffPart);
}

function buildPlaytimeScore(normalized) {
  const stats = normalized.playerStats;
  const challenges = normalized.challengeStats || {};
  const info = normalized.matchInfo;
  const team = normalized.teamContext;
  const events = normalized.timelineEvents;
  const minutes = info.durationSeconds / 60;

  const combat = calcCombatScore(stats, challenges, minutes);
  const income = calcIncomeScore(stats, challenges, info.position, minutes);
  const vision = calcVisionScore(stats, challenges, minutes);
  const survival = calcSurvivalScore(stats, minutes);
  const objective = calcObjectiveScore(events);
  const structure = calcStructureScore(team, events);

  const overall = +(combat * 0.25 + income * 0.20 + vision * 0.10 + survival * 0.20 + objective * 0.15 + structure * 0.10).toFixed(1);

  return {
    overall,
    categories: { combat, income, vision, survival, objective, structure },
    label: overall >= 8 ? "MVP급" : overall >= 6 ? "양호" : overall >= 4 ? "보통" : "개선 필요",
  };
}

// ─── Objective Timeline ──────────────────────────────────────────────────

function buildStructureLabel(event) {
  const tower = { OUTER_TURRET: "외곽 타워", INNER_TURRET: "내부 타워", BASE_TURRET: "억제기 타워", NEXUS_TURRET: "넥서스 타워" };
  const lane = { TOP_LANE: "탑", MID_LANE: "미드", BOT_LANE: "봇" };
  if (event.buildingType === "INHIBITOR_BUILDING") return `${lane[event.laneType] || ""} 억제기`;
  return `${lane[event.laneType] || ""} ${tower[event.towerType] || "구조물"}`;
}

function buildObjectiveLabel(event) {
  const labels = { DRAGON: "드래곤", BARON_NASHOR: "바론", RIFTHERALD: "전령", HORDE: "공허 유충" };
  const sub = event.monsterSubType ? ` (${event.monsterSubType.replace(/_/g, " ").toLowerCase()})` : "";
  return `${labels[event.monsterType] || event.monsterType}${sub}`;
}

function buildObjectiveTimeline(timeline, targetTeamId, participantTeamMap) {
  const events = [];
  timeline.info.frames.forEach((frame) => {
    frame.events.forEach((event) => {
      if (event.type === "BUILDING_KILL") {
        events.push({
          time: event.timestamp,
          timeLabel: timestampLabel(event.timestamp),
          phase: phaseFor(event.timestamp),
          type: "STRUCTURE",
          subtype: event.towerType || event.buildingType,
          lane: event.laneType || "",
          team: event.teamId === targetTeamId ? "ENEMY" : "ALLY",
          label: buildStructureLabel(event),
        });
      }
      if (event.type === "ELITE_MONSTER_KILL") {
        const killerTeam = participantTeamMap.get(event.killerId);
        events.push({
          time: event.timestamp,
          timeLabel: timestampLabel(event.timestamp),
          phase: phaseFor(event.timestamp),
          type: "OBJECTIVE",
          subtype: event.monsterType,
          lane: "",
          team: killerTeam === targetTeamId ? "ALLY" : "ENEMY",
          label: buildObjectiveLabel(event),
        });
      }
    });
  });
  return events.sort((a, b) => a.time - b.time);
}

// ─── Ward Timeline ────────────────────────────────────────────────────────

function buildWardTimeline(timeline, targetParticipantId) {
  const events = [];
  timeline.info.frames.forEach((frame) => {
    frame.events.forEach((event) => {
      if (event.type === "WARD_PLACED" && event.creatorId === targetParticipantId) {
        events.push({
          time: event.timestamp,
          timeLabel: timestampLabel(event.timestamp),
          phase: phaseFor(event.timestamp),
          action: "PLACED",
          wardType: event.wardType || "UNKNOWN",
        });
      }
      if (event.type === "WARD_KILL" && event.killerId === targetParticipantId) {
        events.push({
          time: event.timestamp,
          timeLabel: timestampLabel(event.timestamp),
          phase: phaseFor(event.timestamp),
          action: "KILLED",
          wardType: event.wardType || "UNKNOWN",
        });
      }
    });
  });

  const placed = events.filter((e) => e.action === "PLACED");
  const killed = events.filter((e) => e.action === "KILLED");
  const controlWards = placed.filter((e) => e.wardType === "CONTROL_WARD").length;
  const minutes = (timeline.info.frames.length - 1) || 1;

  return {
    events: events.sort((a, b) => a.time - b.time),
    summary: {
      totalPlaced: placed.length,
      totalKilled: killed.length,
      controlWardsPlaced: controlWards,
      wardsPerMinute: +(placed.length / minutes).toFixed(2),
      byPhase: {
        EARLY: placed.filter((e) => e.phase === "EARLY").length,
        MID: placed.filter((e) => e.phase === "MID").length,
        LATE: placed.filter((e) => e.phase === "LATE").length,
      },
    },
  };
}

// ─── Item Build Timeline ──────────────────────────────────────────────────

function buildItemTimeline(timeline, targetParticipantId) {
  const events = [];
  timeline.info.frames.forEach((frame) => {
    frame.events.forEach((event) => {
      if (event.type === "ITEM_PURCHASED" && event.participantId === targetParticipantId) {
        events.push({
          time: event.timestamp,
          timeLabel: timestampLabel(event.timestamp),
          phase: phaseFor(event.timestamp),
          itemId: event.itemId,
        });
      }
    });
  });
  return events.sort((a, b) => a.time - b.time);
}

// ─── KDA Timeline ─────────────────────────────────────────────────────────

function buildKdaTimeline(normalized) {
  const events = normalized.timelineEvents || [];
  let kills = 0;
  let deaths = 0;
  let assists = 0;

  const points = [{ time: 0, timeLabel: "0:00", phase: "EARLY", kills, deaths, assists, kda: 0, event: "게임 시작" }];

  for (const evt of events) {
    if (!evt.isPlayerInvolved) continue;

    let changed = false;
    if (evt.eventType === "PLAYER_DEATH") {
      deaths++;
      changed = true;
    } else if (evt.eventType === "CHAMPION_KILL") {
      kills++;
      changed = true;
    } else if (evt.eventType === "TEAMFIGHT_FOLLOWUP" || evt.eventType === "SKIRMISH_WIN") {
      assists++;
      changed = true;
    }

    if (changed) {
      const kda = +((kills + assists) / Math.max(1, deaths)).toFixed(2);
      points.push({
        time: evt.timestampMs,
        timeLabel: evt.timestampLabel,
        phase: evt.phase,
        kills,
        deaths,
        assists,
        kda,
        event: evt.summary || evt.eventType,
        eventType: evt.eventType,
      });
    }
  }

  return points;
}

function labelForMoment(event) {
  const map = {
    PLAYER_DEATH: "중요 데스",
    CHAMPION_KILL: "직접 킬 확보",
    TEAMFIGHT_FOLLOWUP: "후속 합류 성공",
    SKIRMISH_WIN: "소규모 교전 우세",
    DRAGON_FIGHT: "드래곤 타이밍",
    BARON_FIGHT: "바론 구도",
    OBJECTIVE_SETUP_WIN: "정글 오브젝트 확보",
    OBJECTIVE_SETUP_FAIL: "오브젝트 손실",
    TOWER_TAKE: "구조물 압박",
  };
  return map[event.eventType] || "핵심 장면";
}

function impactForMoment(event, result) {
  if (event.eventType === "PLAYER_DEATH") {
    return result === "WIN" ? "이기는 흐름을 다소 늦췄다." : "팀 운영이 크게 흔들렸다.";
  }
  if (event.eventType === "DRAGON_FIGHT" || event.eventType === "BARON_FIGHT") {
    return "오브젝트 주도권에 직접 영향을 줬다.";
  }
  if (event.eventType === "TOWER_TAKE") {
    return "승리 조건을 구조물로 전환했다.";
  }
  return "교전 흐름을 유리하게 만드는 장면이었다.";
}

function buildKeyMoments(normalized) {
  return normalized.timelineEvents
    .slice()
    .sort((a, b) => {
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      return a.timestampMs - b.timestampMs;
    })
    .slice(0, 7)
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .map((event) => ({
      eventId: event.eventId,
      timestamp: event.timestampLabel,
      phase: event.phase,
      label: labelForMoment(event),
      reason: event.summary,
      impact: impactForMoment(event, normalized.matchInfo.result),
      importance: event.importance,
    }));
}

function buildEvidenceIndex(normalized) {
  const evidence = normalized.timelineEvents
    .filter((event) => event.importance >= 4)
    .slice(0, 10)
    .map((event) => ({
      eventId: event.eventId,
      timestamp: event.timestampLabel,
      eventType: event.eventType,
      summary: event.summary,
      statNote: `${event.phase} · 중요도 ${event.importance}`,
    }));

  evidence.push({
    eventId: "stat_cs",
    timestamp: "FULL",
    eventType: "STAT_SUMMARY",
    summary: `${normalized.matchInfo.position} 포지션 기준 총 CS ${normalized.playerStats.cs}, 분당 ${normalized.playerStats.csPerMinute}`,
    statNote: "자원 전환 속도 참고",
  });

  evidence.push({
    eventId: "stat_vision",
    timestamp: "FULL",
    eventType: "STAT_SUMMARY",
    summary: `비전 점수 ${normalized.playerStats.visionScore}, 킬 관여율 ${Math.round(
      normalized.playerStats.killParticipation * 100,
    )}%`,
    statNote: "시야와 한타 기여 참고",
  });

  return evidence;
}

function buildCoachSummary(normalized) {
  const isWin = normalized.matchInfo.result === "WIN";
  const objectiveEvents = normalized.timelineEvents.filter((event) =>
    ["DRAGON_FIGHT", "BARON_FIGHT", "OBJECTIVE_SETUP_WIN"].includes(event.eventType),
  );
  const deaths = normalized.timelineEvents.filter((event) => event.eventType === "PLAYER_DEATH");
  const postObjectiveDeaths = deaths.filter((deathEvent) =>
    objectiveEvents.some(
      (objectiveEvent) =>
        objectiveEvent.timestampMs < deathEvent.timestampMs &&
        deathEvent.timestampMs - objectiveEvent.timestampMs <= 120000,
    ),
  );

  const overallSummary = isWin
    ? "초반 흔들린 장면이 있었지만, 오브젝트 템포와 후속 한타 기여를 계속 만들어 결국 승리 구조를 유지한 경기였다."
    : "초반 손해와 반복된 데스로 성장 템포는 느렸지만, 오브젝트 타이밍에 계속 합류하며 끝까지 역전 기회를 만들었던 경기였다.";

  const gameFlowSummary =
    objectiveEvents.length >= 3
      ? "드래곤과 바론, 혹은 정글 오브젝트 관여가 꾸준히 나왔고, 경기의 핵심 흐름은 오브젝트 이후 전환을 얼마나 안정적으로 했는지에서 갈렸다."
      : "교전과 구조물 구도가 반복되며 경기 흐름이 요동쳤고, 중요한 순간의 데스와 후속 합류가 승패에 큰 영향을 줬다.";

  const winLossReason =
    postObjectiveDeaths.length >= 1
      ? "큰 오브젝트를 챙긴 뒤의 생존과 전환이 승패 차이를 만들었다."
      : isWin
        ? "오브젝트 템포와 구조물 압박 연결이 승리의 핵심이었다."
        : "초반 안정감과 중후반 운영 연결이 아쉬웠다.";

  return {
    overallSummary,
    gameFlowSummary,
    winLossReason,
  };
}

function buildHeadline(normalized, strengths, weaknesses) {
  const isWin = normalized.matchInfo.result === "WIN";
  if (isWin) {
    return "오브젝트 템포는 좋았지만 중간 데스가 섞인 거친 승리 경기";
  }
  if (weaknesses[0]?.title && strengths[0]?.title) {
    return `${strengths[0].title.replace("했음", "")} 좋았지만, ${weaknesses[0].title.replace("했음", "")} 경기`;
  }
  return "핵심 오브젝트 합류와 생존 관리가 승패를 가른 경기";
}

// ─── Rule-based fallback ────────────────────────────────────────────────────

function buildRuleBasedAnalysis(normalized, sampleId) {
  const strengths = buildStrengths(normalized);
  const weaknesses = buildWeaknesses(normalized);
  const coachSummary = buildCoachSummary(normalized);
  const keyMoments = buildKeyMoments(normalized);
  const evidenceIndex = buildEvidenceIndex(normalized);

  return {
    schemaVersion: "1.0",
    analysisMeta: {
      analysisId: `analysis_${sampleId}_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      sourceType: "match_timeline",
      language: "ko",
      confidence: 0.78,
    },
    matchSummary: {
      matchId: normalized.matchInfo.matchId,
      queueType: normalized.matchInfo.queueLabel,
      gameVersion: normalized.matchInfo.gameVersion,
      durationSeconds: normalized.matchInfo.durationSeconds,
      result: normalized.matchInfo.result,
      champion: normalized.matchInfo.champion,
      role: normalized.matchInfo.position,
      headline: buildHeadline(normalized, strengths, weaknesses),
    },
    coachSummary,
    phaseSummaries: buildPhaseSummaries(normalized),
    strengths,
    weaknesses,
    actionChecklist: buildActionChecklist(normalized, weaknesses),
    keyMoments,
    evidenceIndex,
  };
}

// ─── LLM payload builder ─────────────────────────────────────────────────────

function buildLlmPayload(normalized) {
  const filteredEvents = normalized.timelineEvents
    .filter((e) => e.importance >= 3)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 15)
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .map(({ eventId, timestampLabel, phase, eventType, importance, summary, isPlayerInvolved }) => ({
      eventId, timestampLabel, phase, eventType, importance, summary, isPlayerInvolved,
    }));

  const { early, mid, late } = normalized.phaseContext;
  return {
    taskMeta: { language: "ko", analysisMode: "coaching", strengthCount: 3, weaknessCount: 3, checklistCountMin: 3, checklistCountMax: 5 },
    matchContext: {
      playerContext: { riotId: normalized.playerContext.riotId, participantId: normalized.playerContext.participantId },
      matchInfo: normalized.matchInfo,
      playerStats: normalized.playerStats,
      teamContext: normalized.teamContext,
    },
    phaseContext: {
      early: { kills: early.kills, deaths: early.deaths, assists: early.assists, notableEventCount: early.notableEventCount },
      mid:   { kills: mid.kills,   deaths: mid.deaths,   assists: mid.assists,   notableEventCount: mid.notableEventCount   },
      late:  { kills: late.kills,  deaths: late.deaths,  assists: late.assists,  notableEventCount: late.notableEventCount  },
    },
    timelineEvents: filteredEvents,
    derivedSignals: normalized.derivedSignals,
    outputContract: {
      schemaVersion: "1.0",
      requiredTopLevelFields: ["analysisMeta", "matchSummary", "coachSummary", "phaseSummaries", "strengths", "weaknesses", "actionChecklist", "keyMoments", "evidenceIndex"],
      requiredArrayCounts: { strengths: 3, weaknesses: 3, actionChecklistMin: 3, actionChecklistMax: 5, keyMomentsMin: 4 },
      rules: ["JSON only", "No markdown", "Use Korean", "Prefer evidence-backed claims", "Do not invent unsupported facts"],
    },
  };
}

// ─── CLI subprocess helper ────────────────────────────────────────────────────

// subprocess에서 CLI를 찾을 수 있도록 PATH 보강 (node 프로세스는 shell PATH 미상속 가능)
const AUGMENTED_PATH = [
  process.env.PATH,
  "/opt/homebrew/bin",
  "/usr/local/bin",
  `${process.env.HOME}/.local/bin`,
].filter(Boolean).join(":");

function runCli(args, stdinText, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    const env = { ...process.env, PATH: AUGMENTED_PATH };
    const proc = spawn(args[0], args.slice(1), { stdio: ["pipe", "pipe", "pipe"], env });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (c) => { stdout += c; });
    proc.stderr.on("data", (c) => { stderr += c; });
    proc.stdin.on("error", () => {}); // EPIPE 억제

    const timer = setTimeout(() => {
      proc.kill();
      settle(reject, new Error(`timeout: ${args[0]}`));
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        settle(reject, new Error(`${args[0]} exited ${code}: ${stderr.slice(0, 300)}`));
        return;
      }
      settle(resolve, stdout);
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      const msg = err.code === "ENOENT" ? `${args[0]} CLI not found in PATH` : err.message;
      settle(reject, new Error(msg));
    });

    proc.stdin.write(stdinText, "utf8");
    proc.stdin.end();
  });
}

// ─── Claude: 코칭 분석 에이전트 ──────────────────────────────────────────────

const CLAUDE_COACHING_PROMPT = `당신은 League of Legends 경기 복기 코치다.
입력 경기 데이터를 바탕으로 플레이어가 잘한 점과 개선점을 균형 있게 분석한다.
모든 인사이트는 이벤트와 지표에 근거해야 한다. 플레이어를 비난하지 말고 코칭형 문장을 사용한다.
출력은 반드시 JSON만. 코드블록 마커 없음.

주어진 경기 데이터를 분석해 생성하라: 경기 한줄 요약, 전체 흐름 요약, 구간별 요약(EARLY/MID/LATE),
장점 3개, 단점 3개, 다음 게임 체크리스트 3~5개, 핵심 장면 4개 이상, 근거 이벤트 인덱스.
모든 장점/단점에 relatedEventIds 포함. analysisMeta.sourceType = "claude_ai".

분석할 경기 데이터:`;

async function callClaudeAgent(payload, timeoutMs = 300000) {
  const stdinText = `${CLAUDE_COACHING_PROMPT}\n\n${JSON.stringify(payload, null, 2)}`;
  const raw = await runCli(["claude", "--print", "--output-format", "json"], stdinText, timeoutMs);

  // --output-format json → { result: "...", ... }
  let text;
  try {
    const wrapper = JSON.parse(raw);
    text = (wrapper.result ?? raw).trim();
  } catch {
    text = raw.trim();
  }

  if (text.startsWith("```")) text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

// ─── Codex: 레드팀 비판 에이전트 ─────────────────────────────────────────────

const CODEX_REDTEAM_PROMPT = `당신은 League of Legends 경기 분석 레드팀 에이전트다.
일반 코칭 분석이 놓치기 쉬운 구조적 문제와 숨겨진 패턴을 찾아내는 것이 목적이다.
아래 관점으로 집중 검토하라:
- 표면적으로 좋아 보이지만 실제로 비효율적인 플레이
- 통계에 드러나지 않는 반복 패턴과 판단 오류
- 상위 티어에서 더 크게 노출될 구조적 약점
- 승리 요인으로 여겨지는 플레이 중 운이나 상대 실수에 의존한 부분

같은 JSON 출력 스키마를 사용하되, 더 비판적이고 구체적인 시각으로 작성하라.
출력은 JSON만. 코드블록 마커 없음.

주어진 경기 데이터를 분석해 생성하라: 경기 한줄 요약, 전체 흐름 요약, 구간별 요약(EARLY/MID/LATE),
장점 3개, 단점 3개, 다음 게임 체크리스트 3~5개, 핵심 장면 4개 이상, 근거 이벤트 인덱스.
모든 장점/단점에 relatedEventIds 포함. analysisMeta.sourceType = "codex_redteam".

분석할 경기 데이터:`;

async function callCodexAgent(payload, timeoutMs = 300000) {
  const stdinText = `${CODEX_REDTEAM_PROMPT}\n\n${JSON.stringify(payload, null, 2)}`;

  // codex exec - : stdin으로 프롬프트 전달
  // --json       : JSONL 이벤트 스트림 출력
  // --ephemeral  : 세션 저장 없음
  // -s read-only : 파일시스템 조작 차단
  // --color never: ANSI 코드 제거
  const raw = await runCli(
    ["codex", "exec", "-", "--json", "--ephemeral", "-s", "read-only", "--color", "never"],
    stdinText,
    timeoutMs,
  );

  // JSONL 파싱: item.type === "agent_message" 에서 text 추출 (실측 포맷 기준)
  let text = "";
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const evt = JSON.parse(trimmed);
      if (evt.type === "item.completed" && evt.item?.type === "agent_message") {
        text = evt.item.text ?? "";
      }
    } catch { /* 파싱 불가 줄 무시 */ }
  }

  // JSONL에서 추출 실패 시 raw 전체 시도
  if (!text) text = raw;
  text = text.trim();
  if (text.startsWith("```")) text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

// ─── Output schema validator ──────────────────────────────────────────────────

function validateAnalysisOutput(json) {
  if (typeof json?.schemaVersion !== "string") throw new Error("missing schemaVersion");
  if (!json?.matchSummary?.headline) throw new Error("missing matchSummary.headline");
  if (!json?.coachSummary?.overallSummary) throw new Error("missing coachSummary.overallSummary");
  if (!Array.isArray(json?.strengths) || json.strengths.length < 1) throw new Error("strengths empty");
  if (!Array.isArray(json?.weaknesses) || json.weaknesses.length < 1) throw new Error("weaknesses empty");
  if (!Array.isArray(json?.actionChecklist) || json.actionChecklist.length < 1) throw new Error("actionChecklist empty");
  if (!Array.isArray(json?.keyMoments) || json.keyMoments.length < 2) throw new Error("keyMoments < 2");
}

// ─── Red-team comparison builder ─────────────────────────────────────────────

function buildComparison(claudeResult, codexResult, sampleId) {
  function keywords(text) {
    return (text ?? "").replace(/[^가-힣a-z0-9\s]/gi, " ").toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  }
  function overlaps(titleA, titleB) {
    const ka = new Set(keywords(titleA));
    return keywords(titleB).some((w) => ka.has(w));
  }

  const agreements = [];
  const claudeOnly = [];
  const codexOnly = [];

  const claudeStrengths = claudeResult?.strengths ?? [];
  const codexStrengths  = codexResult?.strengths  ?? [];
  const claudeWeaknesses = claudeResult?.weaknesses ?? [];
  const codexWeaknesses  = codexResult?.weaknesses  ?? [];

  for (const cs of claudeStrengths) {
    const match = codexStrengths.find((ds) => overlaps(cs.title, ds.title));
    if (match) agreements.push({ category: "strength", topic: cs.title, claudeNote: cs.description, codexNote: match.description });
    else claudeOnly.push({ category: "strength", topic: cs.title, note: cs.description });
  }
  for (const ds of codexStrengths) {
    if (!claudeStrengths.find((cs) => overlaps(ds.title, cs.title))) {
      codexOnly.push({ category: "strength", topic: ds.title, note: ds.description });
    }
  }
  for (const cw of claudeWeaknesses) {
    const match = codexWeaknesses.find((dw) => overlaps(cw.title, dw.title));
    if (match) agreements.push({ category: "weakness", topic: cw.title, claudeNote: cw.description, codexNote: match.description });
    else claudeOnly.push({ category: "weakness", topic: cw.title, note: cw.description });
  }
  for (const dw of codexWeaknesses) {
    if (!claudeWeaknesses.find((cw) => overlaps(dw.title, cw.title))) {
      codexOnly.push({ category: "weakness", topic: dw.title, note: dw.description });
    }
  }

  const total = claudeStrengths.length + claudeWeaknesses.length;
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    sampleId,
    primaryAgent: claudeResult ? "claude" : "codex",
    redTeamAgent: "codex",
    claudeAnalysis: claudeResult ?? null,
    codexAnalysis: codexResult ?? null,
    comparison: {
      agreements,
      claudeOnly,
      codexOnly,
      agreementRate: total > 0 ? Math.round((agreements.length / total) * 100) : 0,
    },
  };
}

// ─── Main analysis orchestrator ───────────────────────────────────────────────

async function buildAnalysis(normalized, sampleId) {
  const payload = buildLlmPayload(normalized);

  const [claudeSettled, codexSettled] = await Promise.allSettled([
    callClaudeAgent(payload),
    callCodexAgent(payload),
  ]);

  const claudeOk = claudeSettled.status === "fulfilled";
  const codexOk  = codexSettled.status === "fulfilled";

  if (!claudeOk) console.error(`[AI] Claude failed for ${sampleId}:`, claudeSettled.reason?.message);
  if (!codexOk)  console.error(`[AI] Codex failed for ${sampleId}:`,  codexSettled.reason?.message);

  const claudeResult = claudeOk ? claudeSettled.value : null;
  const codexResult  = codexOk  ? codexSettled.value  : null;

  let primary = claudeResult ?? codexResult;

  if (!primary) {
    console.error(`[AI] Both agents failed for ${sampleId}, using rule-based fallback`);
    return buildRuleBasedAnalysis(normalized, sampleId);
  }

  // 모델이 생략하기 쉬운 필드 서버측 보완 (AI 콘텐츠는 최대한 유지)
  if (!primary.schemaVersion) primary.schemaVersion = "1.0";
  if (!primary.analysisMeta) primary.analysisMeta = {};
  if (!primary.analysisMeta.language) primary.analysisMeta.language = "ko";

  // matchSummary: AI가 string으로 반환하는 경우 → 객체로 정규화
  if (typeof primary.matchSummary === "string") {
    primary.matchSummary = { headline: primary.matchSummary };
  }
  if (!primary.matchSummary) primary.matchSummary = {};
  if (!primary.matchSummary.headline) {
    const fb = buildRuleBasedAnalysis(normalized, sampleId);
    primary.matchSummary.headline = fb.matchSummary.headline;
  }
  // coachSummary: AI가 string으로 반환하는 경우 → 객체로 정규화
  if (typeof primary.coachSummary === "string") {
    primary.coachSummary = { overallSummary: primary.coachSummary };
  }
  if (!primary.coachSummary) primary.coachSummary = {};
  if (!primary.coachSummary.overallSummary) {
    const fb = buildCoachSummary(normalized);
    primary.coachSummary.overallSummary = fb.overallSummary;
  }
  // phaseSummaries: AI가 배열 대신 객체로 반환하는 경우 → 배열로 정규화
  if (primary.phaseSummaries && !Array.isArray(primary.phaseSummaries)) {
    const ps = primary.phaseSummaries;
    primary.phaseSummaries = ["early", "mid", "late"]
      .filter((k) => ps[k])
      .map((k) => {
        const v = ps[k];
        return typeof v === "string" ? { phase: k.toUpperCase(), summary: v } : { phase: k.toUpperCase(), ...v };
      });
  }
  if (!Array.isArray(primary.keyMoments) || primary.keyMoments.length < 2) {
    primary.keyMoments = buildKeyMoments(normalized);
  }
  if (!Array.isArray(primary.actionChecklist) || primary.actionChecklist.length < 1) {
    primary.actionChecklist = buildActionChecklist(normalized, primary.weaknesses ?? []);
  }

  try {
    validateAnalysisOutput(primary);
  } catch (err) {
    console.error(`[AI] Schema validation failed for ${sampleId}:`, err.message, "— using rule-based fallback");
    return buildRuleBasedAnalysis(normalized, sampleId);
  }

  // analysisMeta 서버측 강제 정규화
  primary.analysisMeta.analysisId  = `ai_${sampleId}_${Date.now()}`;
  primary.analysisMeta.generatedAt = new Date().toISOString();

  // 비교 결과를 임시 필드로 전달 (handleGenerateSample에서 분리 저장)
  primary.__comparison = buildComparison(claudeResult, codexResult, sampleId);

  console.log(`[AI] Analysis complete for ${sampleId} — primary: ${primary.analysisMeta.sourceType}`);
  return primary;
}

// Riot 한도 100req/2min → 1.2초 간격 sleep. handleChampionHistory의 매치 페치 루프에서 사용.
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

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

function requestJson(urlString, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Riot API ${res.statusCode}: ${body}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

async function loadManifest() {
  return readJson(manifestPath);
}

async function saveManifest(manifest) {
  await writeJson(manifestPath, manifest);
}

async function loadSampleBundle(sampleId) {
  const manifest = await loadManifest();
  const entry = manifest.samples.find((sample) => sample.id === sampleId);
  if (!entry) {
    return null;
  }

  const normalized = await readJson(path.join(root, entry.normalizedPath.replace(/^\//, "")));
  const analysis = await readJson(path.join(root, entry.analysisPath.replace(/^\//, "")));

  // 누락된 필드 서버측 보강 (기존 샘플 호환)
  if (!normalized.playtimeScore && normalized.playerStats && normalized.timelineEvents) {
    normalized.playtimeScore = buildPlaytimeScore(normalized);
  }
  if (!normalized.objectiveTimeline) {
    // raw-timeline.json이 있으면 objectiveTimeline 생성
    const tlPath = path.join(root, "data", "samples", sampleId, "raw-timeline.json");
    const matchPath = path.join(root, "data", "samples", sampleId, "raw-match.json");
    try {
      const timeline = await readJson(tlPath);
      const matchDetail = await readJson(matchPath);
      const participant = matchDetail.info.participants.find((p) => p.puuid === normalized.playerContext?.puuid);
      if (participant && timeline) {
        const ptMap = new Map();
        matchDetail.info.participants.forEach((p) => ptMap.set(p.participantId, p.teamId));
        normalized.objectiveTimeline = buildObjectiveTimeline(timeline, participant.teamId, ptMap);
      }
    } catch {}
  }
  if (!normalized.kdaTimeline && normalized.timelineEvents) {
    normalized.kdaTimeline = buildKdaTimeline(normalized);
  }
  if (!normalized.wardTimeline || !normalized.itemTimeline) {
    const tlPath2 = path.join(root, "data", "samples", sampleId, "raw-timeline.json");
    const matchPath2 = path.join(root, "data", "samples", sampleId, "raw-match.json");
    try {
      const tl2 = await readJson(tlPath2);
      const md2 = await readJson(matchPath2);
      const pt2 = md2.info.participants.find((p) => p.puuid === normalized.playerContext?.puuid);
      if (pt2 && tl2) {
        if (!normalized.wardTimeline) normalized.wardTimeline = buildWardTimeline(tl2, pt2.participantId);
        if (!normalized.itemTimeline) normalized.itemTimeline = buildItemTimeline(tl2, pt2.participantId);
      }
    } catch {}
  }
  if (!normalized.challengeStats) {
    const matchPath3 = path.join(root, "data", "samples", sampleId, "raw-match.json");
    try {
      const md3 = await readJson(matchPath3);
      const pt3 = md3.info.participants.find((p) => p.puuid === normalized.playerContext?.puuid);
      if (pt3?.challenges) {
        const c = pt3.challenges;
        normalized.challengeStats = {
          damagePerMinute: c.damagePerMinute || 0, goldPerMinute: c.goldPerMinute || 0,
          visionScorePerMinute: c.visionScorePerMinute || 0, killParticipation: c.killParticipation || 0,
          teamDamagePercentage: c.teamDamagePercentage || 0, soloKills: c.soloKills || 0,
          laneMinionsFirst10Minutes: c.laneMinionsFirst10Minutes || 0,
          maxCsAdvantageOnLaneOpponent: c.maxCsAdvantageOnLaneOpponent || 0,
          maxLevelLeadLaneOpponent: c.maxLevelLeadLaneOpponent || 0,
          turretPlatesTaken: c.turretPlatesTaken || 0,
          earlyLaningPhaseGoldExpAdvantage: c.earlyLaningPhaseGoldExpAdvantage || 0,
          controlWardsPlaced: c.controlWardsPlaced || 0, skillshotsDodged: c.skillshotsDodged || 0,
          outnumberedKills: c.outnumberedKills || 0,
        };
      }
    } catch {}
  }

  let comparison = null;
  const compPath = path.join(root, "data", "samples", sampleId, "comparison-result.json");
  try { comparison = await readJson(compPath); } catch {}

  return {
    sampleId: entry.id,
    publicAlias: entry.publicAlias,
    collectedDate: entry.collectedDate,
    theme: entry.theme,
    normalized,
    analysis,
    comparison,
  };
}

function resolveApiKey(userKey) {
  if (typeof userKey === "string" && userKey.startsWith("RGAPI-") && userKey.length > 20) {
    return userKey.trim();
  }
  return process.env.RIOT_API_KEY || null;
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function validateRiotId(gameName, tagLine) {
  if (!gameName || gameName.length < 3 || gameName.length > 16) return "gameName은 3~16자여야 합니다.";
  if (!tagLine || tagLine.length < 2 || tagLine.length > 5) return "tagLine은 2~5자여야 합니다.";
  if (!/^[a-zA-Z0-9가-힣\s_.]+$/.test(gameName)) return "gameName에 허용되지 않는 문자가 있습니다.";
  if (!/^[a-zA-Z0-9]+$/.test(tagLine)) return "tagLine은 영문/숫자만 허용됩니다.";
  return null;
}

function sampleFitScore(match) {
  let score = 0;
  if ([420, 430, 440].includes(match.queueId)) score += 4;
  if (match.durationSeconds >= 1500 && match.durationSeconds <= 2100) score += 4;
  else if (match.durationSeconds >= 1300 && match.durationSeconds <= 2400) score += 2;
  if (match.role !== "UNKNOWN") score += 3;
  if (match.result === "LOSS") score += 2;
  else score += 1;
  if (["MID", "JUNGLE", "ADC", "SUPPORT", "TOP"].includes(match.role)) score += 2;
  return score;
}

function summarizeMatch(match, puuid) {
  const participant = match.info.participants.find((entry) => entry.puuid === puuid);
  if (!participant) {
    return null;
  }

  const role = normalizeRole(participant.teamPosition || participant.individualPosition);
  const dur = match.info.gameDuration || 1;
  const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);

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
    timestamp: match.info.gameCreation,
    items: [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5, participant.item6],
    summonerSpells: [participant.summoner1Id, participant.summoner2Id],
  };

  return {
    ...summary,
    sampleFitScore: sampleFitScore(summary),
  };
}

async function handleRecentMatches(req, res) {
  const ip = req.socket.remoteAddress || "unknown";
  if (!rateLimit(`recent:${ip}`, 10000)) {
    sendJson(res, 429, { ok: false, error: "요청이 너무 빠릅니다. 10초 후 다시 시도하세요." });
    return;
  }

  try {
    const body = await parseBody(req);
    const apiKey = resolveApiKey(body.riotApiKey);
    if (!apiKey) {
      sendJson(res, 500, { ok: false, error: "Riot API Key가 없습니다. 로그인 화면에서 키를 입력하거나 서버 .env를 확인하세요." });
      return;
    }

    const gameName = String(body.gameName || "").trim();
    const tagLine = String(body.tagLine || "").trim();
    const platformRegion = String(body.platformRegion || "KR").trim().toUpperCase();
    const matchCount = Math.min(Math.max(Number(body.matchCount || 10), 1), 20);
    const start = Math.max(0, Number(body.start || 0));

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

    const account = await requestJson(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      headers,
    );

    // summoner + league + matchIds + mastery 병렬 호출
    // league-v4/by-puuid: Riot이 summoner-v4 id 응답 제거 이후의 신규 엔드포인트
    const platformHost = `${platformRegion.toLowerCase()}.api.riotgames.com`;
    let rankedLookupError = null;
    const [matchIds, summonerData, leagueEntries, masteryData] = await Promise.all([
      requestJson(
        `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(account.puuid)}/ids?start=${start}&count=${matchCount}`,
        headers,
      ),
      requestJson(
        `https://${platformHost}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(account.puuid)}`,
        headers,
      ).catch(() => null),
      requestJson(
        `https://${platformHost}/lol/league/v4/entries/by-puuid/${encodeURIComponent(account.puuid)}`,
        headers,
      ).catch((error) => {
        rankedLookupError = error;
        return null;
      }),
      requestJson(
        `https://${platformHost}/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(account.puuid)}/top?count=20`,
        headers,
      ).catch(() => null),
    ]);

    let ranked = null;
    let rankedStatus = "unranked";
    let rankedError = null;
    if (Array.isArray(leagueEntries)) {
      const rankedEntry = selectRankedEntry(leagueEntries);
      if (rankedEntry) {
        ranked = buildRankedSnapshot(rankedEntry);
        rankedStatus = "ok";
      }
    } else if (rankedLookupError) {
      rankedStatus = "error";
      rankedError = rankedLookupError?.message || "ranked lookup failed";
    }


    const details = await Promise.all(
      matchIds.map((matchId) =>
        requestJson(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`, headers),
      ),
    );

    const matches = details
      .map((detail) => summarizeMatch(detail, account.puuid))
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp);

    sendJson(res, 200, {
      ok: true,
      riotId: `${account.gameName}#${account.tagLine}`,
      publicAlias: body.publicAlias || `${account.gameName}#${account.tagLine}`,
      puuid: account.puuid,
      platformRegion,
      matchCount,
      start,
      hasMore: Array.isArray(matchIds) && matchIds.length >= matchCount,
      summonerLevel: summonerData?.summonerLevel || null,
      profileIconId: summonerData?.profileIconId || null,
      ranked,
      rankedStatus,
      rankedError,
      championMastery: masteryData || [],
      matches,
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message,
    });
  }
}

async function upsertManifestEntry(entry) {
  const manifest = await loadManifest();
  const nextSamples = manifest.samples.filter((sample) => sample.id !== entry.id);
  nextSamples.unshift(entry);
  manifest.samples = nextSamples;
  await saveManifest(manifest);
  return manifest;
}

function inferMatchIdFromSampleEntry(entry) {
  if (!entry) return null;
  if (entry.matchId) return entry.matchId;

  const sources = [entry.id, entry.label, entry.normalizedPath, entry.analysisPath, entry.notesPath];
  for (const source of sources) {
    if (typeof source !== "string") continue;
    const match = source.match(/([a-z0-9]+)[-_](\d{8,})/i);
    if (match) {
      return `${match[1].toUpperCase()}_${match[2]}`;
    }
  }

  return null;
}

async function handleGenerateSample(req, res) {
  const ip = req.socket.remoteAddress || "unknown";
  if (!rateLimit(`generate:${ip}`, 60000)) {
    sendJson(res, 429, { ok: false, error: "샘플 생성은 1분에 1회만 가능합니다." });
    return;
  }

  try {
    const body = await parseBody(req);
    const apiKey = resolveApiKey(body.riotApiKey);
    if (!apiKey) {
      sendJson(res, 500, { ok: false, error: "Riot API Key가 없습니다. 로그인 화면에서 키를 입력하거나 서버 .env를 확인하세요." });
      return;
    }

    const gameName = String(body.gameName || "").trim();
    const tagLine = String(body.tagLine || "").trim();
    const platformRegion = String(body.platformRegion || "KR").trim().toUpperCase();
    const matchId = String(body.matchId || "").trim();

    if (!gameName || !tagLine || !matchId) {
      sendJson(res, 400, { ok: false, error: "gameName, tagLine, and matchId are required." });
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

    const account = await requestJson(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      headers,
    );
    const matchDetail = await requestJson(
      `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
      headers,
    );
    const timeline = await requestJson(
      `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`,
      headers,
    );

    const sampleId = `sample-${matchId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const sampleDir = path.join(root, "data", "samples", sampleId);
    await fsp.mkdir(sampleDir, { recursive: true });

    const publicAlias =
      body.publicAlias || (account.gameName && account.tagLine ? `${account.gameName}#${account.tagLine}` : `PlayerAlias#${tagLine}`);
    const normalized = buildNormalized(account, matchDetail, timeline, {
      platformRegion,
      cluster,
      publicAlias,
    });
    const analysis = await buildAnalysis(normalized, sampleId);

    // __comparison은 임시 전달 필드 — 저장 전 분리
    const comparison = analysis.__comparison ?? null;
    delete analysis.__comparison;

    await Promise.all([
      writeJson(path.join(sampleDir, "raw-account.json"), account),
      writeJson(path.join(sampleDir, "raw-match.json"), matchDetail),
      writeJson(path.join(sampleDir, "raw-timeline.json"), timeline),
      writeJson(path.join(sampleDir, "normalized-match.json"), normalized),
      writeJson(path.join(sampleDir, "analysis-result.json"), analysis),
      comparison
        ? writeJson(path.join(sampleDir, "comparison-result.json"), comparison)
        : Promise.resolve(),
      fsp.writeFile(
        path.join(sampleDir, `${sampleId}-notes.md`),
        `# ${sampleId} notes\n\n- Match ID: \`${matchId}\`\n- Riot ID source: \`${gameName}#${tagLine}\`\n- Public alias: \`${publicAlias}\`\n- Theme: ${analysis.matchSummary.headline}\n`,
        "utf8",
      ),
    ]);

    const entry = {
      id: sampleId,
      matchId,
      label: `${sampleId} · ${normalized.matchInfo.position} ${normalized.matchInfo.result}`,
      champion: normalized.matchInfo.champion,
      publicAlias,
      collectedDate: new Date().toISOString().slice(0, 10),
      theme: analysis.matchSummary?.headline || analysis.coachSummary?.gameFlowSummary || "",
      normalizedPath: `/data/samples/${sampleId}/normalized-match.json`,
      analysisPath: `/data/samples/${sampleId}/analysis-result.json`,
      notesPath: `/data/samples/${sampleId}/${sampleId}-notes.md`,
    };

    await upsertManifestEntry(entry);

    sendJson(res, 200, {
      ok: true,
      sampleId,
      publicAlias,
      collectedDate: entry.collectedDate,
      theme: entry.theme,
      normalized,
      analysis,
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message,
    });
  }
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/samples") {
    const manifest = await loadManifest();
    sendJson(res, 200, {
      ...manifest,
      samples: manifest.samples.map((sample) => ({
        ...sample,
        matchId: inferMatchIdFromSampleEntry(sample),
      })),
    });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/samples/")) {
    const sampleId = url.pathname.split("/").pop();
    const bundle = await loadSampleBundle(sampleId);
    if (!bundle) {
      sendJson(res, 404, { ok: false, error: "Sample not found." });
      return true;
    }
    sendJson(res, 200, bundle);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/recent-matches") {
    await handleRecentMatches(req, res);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/generate-sample") {
    await handleGenerateSample(req, res);
    return true;
  }

  return false;
}

function staticFilePath(urlPath) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(root, requested));
  if (!filePath.startsWith(root)) {
    return null;
  }
  return filePath;
}

async function handleStatic(req, res, url) {
  const filePath = staticFilePath(url.pathname);
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const ext = path.extname(finalPath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const stream = fs.createReadStream(finalPath);
    res.writeHead(200, { "Content-Type": contentType });
    stream.pipe(res);
  } catch (error) {
    sendText(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    const handled = await handleApi(req, res, url);
    if (handled) {
      return;
    }
    await handleStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message,
    });
  }
});

server.listen(port, () => {
  console.log(`Server listening on http://127.0.0.1:${port}`);
});
