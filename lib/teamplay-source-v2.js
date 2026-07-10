const {
  makeTimelineEventRef,
  makeParticipantFrameRef,
  relationForTeam,
} = require("./teamplay-contract-v2");

const SUPPORTED_EVENT_TYPES = new Set([
  "CHAMPION_KILL",
  "ELITE_MONSTER_KILL",
  "BUILDING_KILL",
]);

function validParticipantId(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null;
}

function normalizedPosition(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return { x: Math.round(value.x), y: Math.round(value.y) };
}

function validParticipantFrame(value) {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
    validParticipantId(value.participantId) !== null &&
    Number.isFinite(value.currentHealth) && value.currentHealth >= 0 &&
    Number.isFinite(value.totalGold) && value.totalGold >= 0 &&
    Number.isFinite(value.xp) && value.xp >= 0 &&
    Number.isFinite(value.level) && value.level >= 0,
  );
}

function supportedTimelineEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !SUPPORTED_EVENT_TYPES.has(value.type) ||
      !Number.isFinite(value.timestamp) || value.timestamp < 0) return false;
  if (value.type === "CHAMPION_KILL") {
    return validParticipantId(value.victimId) !== null;
  }
  if (value.type === "ELITE_MONSTER_KILL") {
    return typeof value.monsterType === "string" && value.monsterType.length > 0;
  }
  return typeof value.buildingType === "string" && value.buildingType.length > 0;
}

function validTimelineTimestamp(value) {
  return Number.isFinite(value) && value >= 0;
}

function usableTimelineFrame(frame) {
  if (!frame || typeof frame !== "object" || Array.isArray(frame) ||
      !validTimelineTimestamp(frame.timestamp)) return false;
  const hasParticipantFrame = frame.participantFrames &&
    typeof frame.participantFrames === "object" &&
    !Array.isArray(frame.participantFrames) &&
    Object.values(frame.participantFrames).some(validParticipantFrame);
  const hasSupportedEvent = Array.isArray(frame.events) &&
    frame.events.some(supportedTimelineEvent);
  return Boolean(hasParticipantFrame || hasSupportedEvent);
}

function eventParticipantIds(event) {
  return [...new Set([
    event.killerId,
    event.victimId,
    ...(event.assistingParticipantIds || []),
  ].filter((id) => Number.isInteger(id)))].sort((a, b) => a - b);
}

function extractTeamplaySource(matchDetail, timeline, targetParticipantId) {
  const matchId = String(matchDetail?.metadata?.matchId || "UNKNOWN_MATCH");
  const participants = Array.isArray(matchDetail?.info?.participants)
    ? matchDetail.info.participants.map((participant) => ({
        participantId: validParticipantId(participant.participantId),
        teamId: participant.teamId,
        champion: participant.championName || "Unknown",
        role: participant.teamPosition || participant.individualPosition || "UNKNOWN",
      })).filter((participant) => participant.participantId !== null)
    : [];
  const participantById = new Map(
    participants.map((participant) => [participant.participantId, participant]),
  );
  const targetTeamId = participantById.get(targetParticipantId)?.teamId ?? null;
  const snapshots = [];
  const killEvents = [];
  const objectiveEvents = [];
  const structureEvents = [];
  const frameEntries = (Array.isArray(timeline?.info?.frames)
    ? timeline.info.frames
    : []).map((frame, frameIndex) => ({ frame, frameIndex }))
    .filter(({ frame }) => usableTimelineFrame(frame));
  const hasRawTimeline = frameEntries.length > 0;

  frameEntries.forEach(({ frame, frameIndex }) => {
    const timestamp = Math.round(frame.timestamp);
    const frameParticipants = new Map();
    const rawParticipantFrames = frame.participantFrames &&
      typeof frame.participantFrames === "object" &&
      !Array.isArray(frame.participantFrames)
      ? frame.participantFrames
      : {};
    Object.values(rawParticipantFrames).forEach((rawFrame) => {
      if (!validParticipantFrame(rawFrame)) return;
      const participantId = validParticipantId(rawFrame.participantId);
      frameParticipants.set(participantId, {
        participantId,
        timestamp,
        currentHealth: rawFrame.currentHealth,
        totalGold: rawFrame.totalGold,
        xp: rawFrame.xp,
        level: rawFrame.level,
        position: normalizedPosition(rawFrame.position),
        sourceRef: makeParticipantFrameRef(
          matchId,
          frameIndex,
          participantId,
          timestamp,
        ),
      });
    });
    snapshots.push({ frameIndex, timestamp, participants: frameParticipants });

    (Array.isArray(frame.events) ? frame.events : [])
      .map((rawEvent, eventIndex) => ({ rawEvent, eventIndex }))
      .filter(({ rawEvent }) => supportedTimelineEvent(rawEvent))
      .forEach(({ rawEvent, eventIndex }) => {
      const eventTimestamp = Math.round(Number(rawEvent.timestamp) || timestamp);
      const sourceRef = makeTimelineEventRef(
        matchId,
        frameIndex,
        eventIndex,
        eventTimestamp,
      );
      const killerId = validParticipantId(rawEvent.killerId);
      const victimId = validParticipantId(rawEvent.victimId);
      const assistingParticipantIds = [...new Set(
        (Array.isArray(rawEvent.assistingParticipantIds)
          ? rawEvent.assistingParticipantIds
          : [])
          .map(validParticipantId)
          .filter((id) => id !== null),
      )].sort((a, b) => a - b);
      const common = {
        timestamp: eventTimestamp,
        sourceRef,
        killerId,
        victimId,
        assistingParticipantIds,
        position: normalizedPosition(rawEvent.position),
      };
      if (rawEvent.type === "CHAMPION_KILL") {
        killEvents.push(common);
      } else if (rawEvent.type === "ELITE_MONSTER_KILL") {
        objectiveEvents.push({
          ...common,
          killerTeamId: rawEvent.killerTeamId,
          monsterType: rawEvent.monsterType === "HORDE"
            ? "VOID_GRUB"
            : rawEvent.monsterType,
          monsterSubType: rawEvent.monsterSubType || null,
        });
      } else if (rawEvent.type === "BUILDING_KILL") {
        const killerTeamId = participantById.get(killerId)?.teamId ?? null;
        const destroyedTeamId = rawEvent.teamId === 100 || rawEvent.teamId === 200
          ? rawEvent.teamId
          : null;
        const takerTeamId = killerTeamId || (
          destroyedTeamId === 100 ? 200 : destroyedTeamId === 200 ? 100 : null
        );
        structureEvents.push({
          ...common,
          destroyedTeamId,
          takerTeamId,
          takerRelation: relationForTeam(takerTeamId, targetTeamId),
          buildingType: rawEvent.buildingType || null,
          towerType: rawEvent.towerType || null,
          laneType: rawEvent.laneType || null,
        });
      }
      });
  });

  const byTimeAndRef = (left, right) => left.timestamp - right.timestamp ||
    left.sourceRef.id.localeCompare(right.sourceRef.id);

  return {
    schemaVersion: "2.0",
    matchId,
    targetParticipantId,
    targetTeamId,
    hasRawTimeline,
    participants,
    participantById,
    snapshots: snapshots.sort((a, b) => a.timestamp - b.timestamp),
    killEvents: killEvents.sort(byTimeAndRef),
    objectiveEvents: objectiveEvents.sort(byTimeAndRef),
    structureEvents: structureEvents.sort(byTimeAndRef),
  };
}

function latestParticipantFrameAtOrBefore(source, participantId, timestamp, maxAgeMs) {
  for (let index = source.snapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = source.snapshots[index];
    if (snapshot.timestamp > timestamp) continue;
    if (timestamp - snapshot.timestamp > maxAgeMs) return null;
    const row = snapshot.participants.get(participantId);
    if (row) return row;
  }
  return null;
}

function resolveCompleteTeamSnapshotAtOrBefore(
  source,
  relation,
  timestamp,
  maxAgeMs = 60000,
) {
  const ids = source.participants
    .filter((participant) =>
      relationForTeam(participant.teamId, source.targetTeamId) === relation)
    .map((participant) => participant.participantId);
  let sawSnapshotAtOrBefore = false;
  let sawIncompleteInRange = false;
  for (let index = source.snapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = source.snapshots[index];
    if (snapshot.timestamp > timestamp) continue;
    sawSnapshotAtOrBefore = true;
    if (timestamp - snapshot.timestamp > maxAgeMs) break;
    const rows = ids.map((id) => snapshot.participants.get(id)).filter(Boolean);
    if (rows.length !== 5) {
      sawIncompleteInRange = true;
      continue;
    }
    return {
      snapshot: {
        snapshotTimestamp: snapshot.timestamp,
        frameAgeSeconds: Math.round((timestamp - snapshot.timestamp) / 1000),
        totalGold: rows.reduce((sum, row) => sum + row.totalGold, 0),
        totalXp: rows.reduce((sum, row) => sum + row.xp, 0),
        livingParticipantIds: rows
          .filter((row) => row.currentHealth > 0)
          .map((row) => row.participantId),
        positionedParticipantIds: rows
          .filter((row) => row.position)
          .map((row) => row.participantId),
        participantFrames: rows.map((row) => ({
          participantId: row.participantId,
          currentHealth: row.currentHealth,
          position: row.position,
          sourceRef: row.sourceRef,
        })),
      },
      limitationCode: null,
    };
  }
  return {
    snapshot: null,
    limitationCode: sawIncompleteInRange || !sawSnapshotAtOrBefore
      ? "INCOMPLETE_TEAM_SNAPSHOT"
      : "STALE_TEAM_SNAPSHOT",
  };
}

function completeTeamSnapshotAtOrBefore(source, relation, timestamp, maxAgeMs = 60000) {
  return resolveCompleteTeamSnapshotAtOrBefore(
    source,
    relation,
    timestamp,
    maxAgeMs,
  ).snapshot;
}

module.exports = {
  extractTeamplaySource,
  eventParticipantIds,
  latestParticipantFrameAtOrBefore,
  resolveCompleteTeamSnapshotAtOrBefore,
  completeTeamSnapshotAtOrBefore,
};
