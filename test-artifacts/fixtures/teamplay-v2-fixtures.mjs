export function makeMatchFixture(targetParticipantId = 1) {
  const participants = Array.from({ length: 10 }, (_, index) => {
    const participantId = index + 1;
    return {
      participantId,
      puuid: `puuid-${participantId}`,
      teamId: participantId <= 5 ? 100 : 200,
      championName: `Champion${participantId}`,
      teamPosition: ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"][index % 5],
    };
  });
  return {
    metadata: { matchId: "KR_TEAMPLAY_FIXTURE" },
    info: { mapId: 11, gameDuration: 1800, participants },
    targetParticipantId,
  };
}

export function championKill(
  timestamp,
  killerId,
  victimId,
  assistingParticipantIds = [],
  position = null,
) {
  return {
    type: "CHAMPION_KILL",
    timestamp,
    killerId,
    victimId,
    assistingParticipantIds,
    position,
  };
}

export function eliteKill(
  timestamp,
  killerId,
  killerTeamId,
  monsterType,
  position = null,
  assistingParticipantIds = [],
) {
  return {
    type: "ELITE_MONSTER_KILL",
    timestamp,
    killerId,
    killerTeamId,
    monsterType,
    position,
    assistingParticipantIds,
  };
}

export function buildingKill(timestamp, killerId, destroyedTeamId, position = null) {
  return {
    type: "BUILDING_KILL",
    timestamp,
    killerId,
    teamId: destroyedTeamId,
    buildingType: "TOWER_BUILDING",
    towerType: "OUTER_TURRET",
    laneType: "MID_LANE",
    position,
  };
}

export function makeFrame(timestamp, events = [], positions = {}) {
  const participantFrames = {};
  for (let participantId = 1; participantId <= 10; participantId += 1) {
    const position = positions[participantId] || {
      x: participantId * 100,
      y: participantId * 100,
    };
    participantFrames[String(participantId)] = {
      participantId,
      currentHealth: 1000,
      totalGold: 5000 + participantId * 100,
      xp: 6000 + participantId * 100,
      level: 10,
      position,
    };
  }
  return { timestamp, participantFrames, events };
}

export function makeTimelineFixture(frames) {
  return { info: { frames } };
}
