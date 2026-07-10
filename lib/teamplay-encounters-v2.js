const { stableId, relationForTeam } = require("./teamplay-contract-v2");
const {
  eventParticipantIds,
  latestParticipantFrameAtOrBefore,
} = require("./teamplay-source-v2");

function distanceBetween(left, right) {
  if (!left || !right) return null;
  return Math.round(Math.hypot(left.x - right.x, left.y - right.y));
}

function medoidPosition(events) {
  const positioned = events.filter((event) => event.position);
  if (positioned.length === 0) return null;
  return positioned
    .map((event) => ({
      event,
      sum: positioned.reduce(
        (total, other) => total + distanceBetween(event.position, other.position),
        0,
      ),
    }))
    .sort((left, right) =>
      left.sum - right.sum ||
      left.event.timestamp - right.event.timestamp ||
      left.event.sourceRef.id.localeCompare(right.event.sourceRef.id))[0]
    .event.position;
}

function sharesDirectParticipant(left, right) {
  const leftIds = new Set(eventParticipantIds(left));
  return eventParticipantIds(right).some((id) => leftIds.has(id));
}

function canJoin(cluster, event) {
  const first = cluster[0];
  const last = cluster[cluster.length - 1];
  const gap = event.timestamp - last.timestamp;
  if (gap > 25000 || event.timestamp - first.timestamp > 45000) return false;
  if (!last.position || !event.position) {
    return gap <= 15000 && sharesDirectParticipant(last, event);
  }
  const lastDistance = distanceBetween(last.position, event.position);
  const adjacentLimit = gap <= 15000 ? 5000 : 3000;
  if (lastDistance > adjacentLimit) return false;
  const positionedCount = cluster.filter((row) => row.position).length;
  if (positionedCount >= 2 &&
      distanceBetween(medoidPosition(cluster), event.position) > 4000) {
    return false;
  }
  return true;
}

function phaseRows(events) {
  const start = events[0].timestamp;
  let lateStart = Infinity;
  for (let index = 1; index < events.length; index += 1) {
    if (events[index].timestamp - events[index - 1].timestamp > 10000) {
      lateStart = events[index].timestamp;
      break;
    }
  }
  return events.map((event) => ({
    phase: event.timestamp < start + 2000
      ? "OPENING"
      : event.timestamp >= lateStart ? "LATE_SEQUENCE" : "EXCHANGE",
    timestamp: event.timestamp,
    sourceRef: event.sourceRef,
    killerId: event.killerId,
    victimId: event.victimId,
    assistingParticipantIds: event.assistingParticipantIds,
  }));
}

function classifyEncounter(events, source) {
  const known = new Map();
  const unknown = new Set();
  events.flatMap(eventParticipantIds).forEach((participantId) => {
    const teamId = source.participantById.get(participantId)?.teamId;
    const relation = relationForTeam(teamId, source.targetTeamId);
    if (relation === "UNKNOWN") unknown.add(participantId);
    else known.set(participantId, relation);
  });
  const ally = [...known.values()].filter((value) => value === "ALLY").length;
  const enemy = [...known.values()].filter((value) => value === "ENEMY").length;
  const deathCount = events.length;
  const type = deathCount === 1
    ? "PICK"
    : deathCount >= 3 && ally >= 2 && enemy >= 2 && known.size >= 6
      ? "TEAMFIGHT_CANDIDATE"
      : "SKIRMISH";
  return {
    type,
    classificationBasis: {
      deathCount,
      knownAllyDirect: ally,
      knownEnemyDirect: enemy,
      knownUniqueDirect: known.size,
      unknownUniqueDirect: unknown.size,
    },
  };
}

function participantRows(events, source) {
  const rows = { ally: [], enemy: [], unknown: [] };
  const participantIds = [...new Set(events.flatMap(eventParticipantIds))]
    .sort((a, b) => a - b);
  participantIds.forEach((participantId) => {
    const participant = source.participantById.get(participantId);
    const relation = relationForTeam(participant?.teamId, source.targetTeamId);
    const key = relation === "ALLY" ? "ally" : relation === "ENEMY" ? "enemy" : "unknown";
    rows[key].push({
      participantId,
      champion: participant?.champion || "Unknown",
      role: participant?.role || "UNKNOWN",
    });
  });
  return rows;
}

function recordSort(left, right) {
  return left.timestamp - right.timestamp ||
    left.basis.localeCompare(right.basis) ||
    (left.sourceRefs[0]?.id || "").localeCompare(right.sourceRefs[0]?.id || "");
}

function directInvolvementRecords(events, targetParticipantId) {
  const records = [];
  events.forEach((event) => {
    const bases = [];
    if (event.killerId === targetParticipantId) bases.push("KILLER");
    if (event.victimId === targetParticipantId) bases.push("VICTIM");
    if (event.assistingParticipantIds.includes(targetParticipantId)) bases.push("ASSIST");
    bases.forEach((basis) => {
      records.push({
        timestamp: event.timestamp,
        basis,
        stage: "ENCOUNTER",
        sourceRefs: [event.sourceRef],
        distance: null,
        frameAgeSeconds: null,
      });
    });
  });
  return records.sort(recordSort);
}

function approximateInvolvementRecords(events, source, centerPosition) {
  const records = [];
  events.forEach((event) => {
    const targetFrame = latestParticipantFrameAtOrBefore(
      source,
      source.targetParticipantId,
      event.timestamp,
      15000,
    );
    const targetPosition = targetFrame?.position;
    const eventPosition = event.position || centerPosition;
    if (!targetFrame || targetFrame.currentHealth <= 0 || !targetPosition || !eventPosition) return;
    const distance = distanceBetween(targetPosition, eventPosition);
    if (distance > 4000) return;
    records.push({
      timestamp: event.timestamp,
      basis: "POSITION_PROXIMITY",
      stage: "ENCOUNTER",
      sourceRefs: [targetFrame.sourceRef, event.sourceRef]
        .sort((left, right) => left.id.localeCompare(right.id)),
      distance,
      frameAgeSeconds: Math.round((event.timestamp - targetFrame.timestamp) / 1000),
    });
  });
  return records.sort(recordSort);
}

function playerInvolvement(events, source, centerPosition) {
  const direct = directInvolvementRecords(events, source.targetParticipantId);
  if (direct.length > 0) return { level: "CONFIRMED", records: direct };
  const approximate = approximateInvolvementRecords(events, source, centerPosition);
  if (approximate.length > 0) return { level: "APPROXIMATE", records: approximate };
  return { level: "NOT_INVOLVED", records: [] };
}

function victimRelation(event, source) {
  const teamId = source.participantById.get(event.victimId)?.teamId;
  return relationForTeam(teamId, source.targetTeamId);
}

function firstTakedownTeam(events, source) {
  const relation = victimRelation(events[0], source);
  if (relation === "ALLY") return "ENEMY";
  if (relation === "ENEMY") return "ALLY";
  return "UNKNOWN";
}

function buildEncounter(events, source) {
  const classification = classifyEncounter(events, source);
  const centerPosition = medoidPosition(events);
  const limitations = new Set();
  if (events.some((event) => !event.position)) limitations.add("MISSING_SPATIAL_LINK");
  if (classification.classificationBasis.unknownUniqueDirect > 0 ||
      events.some((event) => victimRelation(event, source) === "UNKNOWN")) {
    limitations.add("UNKNOWN_TEAM");
  }
  const allyDeaths = events.filter((event) => victimRelation(event, source) === "ALLY").length;
  const enemyDeaths = events.filter((event) => victimRelation(event, source) === "ENEMY").length;
  const sourceRefs = events.map((event) => event.sourceRef)
    .sort((left, right) => left.id.localeCompare(right.id));
  const startTimestamp = events[0].timestamp;
  const endTimestamp = events[events.length - 1].timestamp;
  const id = stableId("enc", {
    schemaVersion: source.schemaVersion,
    matchId: source.matchId,
    type: classification.type,
    startTimestamp,
    sourceRefIds: sourceRefs.map((ref) => ref.id),
  });
  return {
    id,
    type: classification.type,
    classificationBasis: classification.classificationBasis,
    phaseEvents: phaseRows(events),
    participants: participantRows(events, source),
    allyDeaths,
    enemyDeaths,
    firstTakedownTeam: firstTakedownTeam(events, source),
    centerPosition,
    playerInvolvement: playerInvolvement(events, source, centerPosition),
    linkedObjectiveEngagementIds: [],
    sourceRefs,
    startTimestamp,
    endTimestamp,
    confidence: limitations.has("MISSING_SPATIAL_LINK") ? "MEDIUM" : "HIGH",
    limitationCodes: [...limitations].sort(),
  };
}

function buildEncounters(source) {
  const events = [...source.killEvents].sort((left, right) =>
    left.timestamp - right.timestamp || left.sourceRef.id.localeCompare(right.sourceRef.id));
  const clusters = [];
  events.forEach((event) => {
    const current = clusters[clusters.length - 1];
    if (!current || !canJoin(current, event)) clusters.push([event]);
    else current.push(event);
  });
  return clusters.map((cluster) => buildEncounter(cluster, source));
}

module.exports = {
  distanceBetween,
  medoidPosition,
  buildEncounters,
};
