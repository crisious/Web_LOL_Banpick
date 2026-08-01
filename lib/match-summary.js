function durationLabel(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
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
  if (!match || !match.info || !Array.isArray(match.info.participants)) {
    return null;
  }
  const participant = match.info.participants.find((entry) => entry.puuid === puuid);
  if (!participant) {
    return null;
  }

  const role = normalizeRole(participant.teamPosition || participant.individualPosition);
  const dur = match.info.gameDuration || 1;
  const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
  const kills = participant.kills || 0;
  const deaths = participant.deaths || 0;
  const assists = participant.assists || 0;

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
    kills,
    deaths,
    assists,
    csPerMin: +(cs / (dur / 60)).toFixed(1),
    visionScore: participant.visionScore || 0,
    goldEarned: participant.goldEarned || 0,
    damageToChampions: participant.totalDamageDealtToChampions || 0,
    killParticipation: Math.min(1, +((kills + assists) / Math.max(1, teamTotalKills)).toFixed(2)),
    timestamp: match.info.gameCreation,
    items: [
      participant.item0 || 0,
      participant.item1 || 0,
      participant.item2 || 0,
      participant.item3 || 0,
      participant.item4 || 0,
      participant.item5 || 0,
      participant.item6 || 0,
    ],
    summonerSpells: [participant.summoner1Id || 0, participant.summoner2Id || 0],
  };

  return {
    ...summary,
    sampleFitScore: sampleFitScore(summary),
  };
}

module.exports = {
  durationLabel,
  normalizeRole,
  queueLabel,
  sampleFitScore,
  summarizeMatch,
};
