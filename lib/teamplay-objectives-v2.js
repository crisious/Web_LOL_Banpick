const {
  stableId,
  relationForTeam,
  lowerConfidence,
} = require("./teamplay-contract-v2");
const {
  resolveCompleteTeamSnapshotAtOrBefore,
} = require("./teamplay-source-v2");
const {
  distanceBetween,
  medoidPosition,
} = require("./teamplay-encounters-v2");

function objectiveCaptureRelation(event, source) {
  const participantTeamId = source.participantById.get(event.killerId)?.teamId;
  const fallbackTeamId = event.killerTeamId === 100 || event.killerTeamId === 200
    ? event.killerTeamId
    : null;
  return relationForTeam(participantTeamId || fallbackTeamId, source.targetTeamId);
}

function groupObjectiveAnchors(source) {
  const out = [];
  for (const event of source.objectiveEvents) {
    const relation = objectiveCaptureRelation(event, source);
    if (event.monsterType !== "VOID_GRUB") {
      out.push({
        objectiveType: event.monsterType || "UNKNOWN_NEUTRAL_OBJECTIVE",
        events: [event],
        relations: [relation],
      });
      continue;
    }
    const last = out[out.length - 1];
    const canJoin = last &&
      last.objectiveType === "VOID_GRUB_CAMP" &&
      event.timestamp - last.events[last.events.length - 1].timestamp <= 20000 &&
      event.timestamp - last.events[0].timestamp <= 60000;
    if (canJoin) {
      last.events.push(event);
      last.relations.push(relation);
    } else {
      out.push({
        objectiveType: "VOID_GRUB_CAMP",
        events: [event],
        relations: [relation],
      });
    }
  }
  return out;
}

function captureSummary(anchor) {
  const captureCounts = { ally: 0, enemy: 0, unknown: 0 };
  anchor.relations.forEach((relation) => {
    const key = relation === "ALLY" ? "ally" : relation === "ENEMY" ? "enemy" : "unknown";
    captureCounts[key] += 1;
  });
  const knownSides = ["ally", "enemy"].filter((side) => captureCounts[side] > 0);
  const captureTeam = knownSides.length > 1
    ? "SPLIT"
    : knownSides[0] === "ally" ? "ALLY" : knownSides[0] === "enemy" ? "ENEMY" : "UNKNOWN";
  return { captureCounts, captureTeam };
}

function emptyWindow(startMs, endMsExclusive, deathCounts) {
  return {
    startMs,
    endMsExclusive,
    sourceRefs: [],
    linkedEncounterIds: [],
    teamSnapshots: {
      start: { ally: null, enemy: null },
      end: { ally: null, enemy: null },
    },
    deathCounts,
    limitationCodes: [],
  };
}

function objectiveInvolvement(anchor, source) {
  const records = [];
  anchor.events.forEach((event) => {
    if (event.killerId === source.targetParticipantId) {
      records.push({
        timestamp: event.timestamp,
        basis: "OBJECTIVE_KILLER",
        stage: "CONTEST",
        sourceRefs: [event.sourceRef],
        distance: null,
        frameAgeSeconds: null,
      });
    }
    if (event.assistingParticipantIds.includes(source.targetParticipantId)) {
      records.push({
        timestamp: event.timestamp,
        basis: "OBJECTIVE_ASSIST",
        stage: "CONTEST",
        sourceRefs: [event.sourceRef],
        distance: null,
        frameAgeSeconds: null,
      });
    }
  });
  records.sort((left, right) =>
    left.timestamp - right.timestamp ||
    left.basis.localeCompare(right.basis) ||
    left.sourceRefs[0].id.localeCompare(right.sourceRefs[0].id));
  return records.length > 0
    ? { level: "CONFIRMED", records }
    : { level: "NOT_INVOLVED", records: [] };
}

function createObjective(anchor, source) {
  const captureStartTimestamp = anchor.events[0].timestamp;
  const captureEndTimestamp = anchor.events[anchor.events.length - 1].timestamp;
  const setupWindow = emptyWindow(
    captureStartTimestamp - 90000,
    captureStartTimestamp - 20000,
    { ally: 0, enemy: 0 },
  );
  const contestWindow = emptyWindow(
    captureStartTimestamp - 20000,
    captureEndTimestamp + 20000,
    { ally: 0, enemy: 0 },
  );
  const conversionWindow = emptyWindow(
    captureEndTimestamp,
    captureEndTimestamp + 120000,
    null,
  );
  const sourceRefs = anchor.events.map((event) => event.sourceRef)
    .sort((left, right) => left.id.localeCompare(right.id));
  const centerPosition = medoidPosition(anchor.events);
  const { captureCounts, captureTeam } = captureSummary(anchor);
  const allUnknown = anchor.relations.every((relation) => relation === "UNKNOWN");
  const anyUnknown = anchor.relations.some((relation) => relation === "UNKNOWN");
  const anyMissingPosition = anchor.events.some((event) => !event.position);
  const confidence = allUnknown && !centerPosition
    ? "LOW"
    : anyUnknown || anyMissingPosition ? "MEDIUM" : "HIGH";
  const limitationCodes = new Set();
  if (captureCounts.unknown > 0) limitationCodes.add("UNKNOWN_TEAM");
  const startTimestamp = setupWindow.startMs;
  const endTimestamp = conversionWindow.endMsExclusive;
  return {
    id: stableId("obj", {
      schemaVersion: source.schemaVersion,
      matchId: source.matchId,
      objectiveType: anchor.objectiveType,
      startTimestamp,
      sourceRefIds: sourceRefs.map((ref) => ref.id),
    }),
    objectiveType: anchor.objectiveType,
    captureStartTimestamp,
    captureEndTimestamp,
    captureCounts,
    captureTeam,
    setupWindow,
    contestWindow,
    conversionWindow,
    linkedEncounterIds: [],
    structureConversions: [],
    playerInvolvement: objectiveInvolvement(anchor, source),
    linkedEncounterInvolvements: [],
    centerPosition,
    sourceRefs,
    startTimestamp,
    endTimestamp,
    confidence,
    limitationCodes: [...limitationCodes],
    _anchorSourceRefIds: new Set(sourceRefs.map((ref) => ref.id)),
  };
}

function distanceToCaptureInterval(timestamp, start, end) {
  if (timestamp < start) return start - timestamp;
  if (timestamp > end) return timestamp - end;
  return 0;
}

function chooseObjectiveAtTimestamp(timestamp, objectives) {
  return objectives
    .filter((objective) =>
      timestamp >= objective.setupWindow.startMs &&
      timestamp < objective.contestWindow.endMsExclusive)
    .map((objective) => ({
      objective,
      timeDistance: distanceToCaptureInterval(
        timestamp,
        objective.captureStartTimestamp,
        objective.captureEndTimestamp,
      ),
    }))
    .sort((left, right) =>
      left.timeDistance - right.timeDistance ||
      left.objective.captureStartTimestamp - right.objective.captureStartTimestamp ||
      left.objective.id.localeCompare(right.objective.id))[0]?.objective || null;
}

function chooseObjectiveForEncounter(encounter, objectives) {
  const centerTime = Math.round((encounter.startTimestamp + encounter.endTimestamp) / 2);
  return chooseObjectiveAtTimestamp(centerTime, objectives);
}

function stageWindow(objective, timestamp) {
  return timestamp < objective.setupWindow.endMsExclusive
    ? objective.setupWindow
    : objective.contestWindow;
}

function addSourceRef(window, sourceRef) {
  if (!window.sourceRefs.some((ref) => ref.id === sourceRef.id)) {
    window.sourceRefs.push(sourceRef);
    window.sourceRefs.sort((left, right) =>
      left.timestamp - right.timestamp || left.id.localeCompare(right.id));
  }
}

function addLimitation(target, code) {
  if (code && !target.limitationCodes.includes(code)) {
    target.limitationCodes.push(code);
    target.limitationCodes.sort();
  }
}

function victimRelation(event, source) {
  const teamId = source.participantById.get(event.victimId)?.teamId;
  return relationForTeam(teamId, source.targetTeamId);
}

function assignKillEvents(source, objectives) {
  source.killEvents.forEach((event) => {
    const objective = chooseObjectiveAtTimestamp(event.timestamp, objectives);
    if (!objective) return;
    const window = stageWindow(objective, event.timestamp);
    addSourceRef(window, event.sourceRef);
    const relation = victimRelation(event, source);
    if (relation === "ALLY") window.deathCounts.ally += 1;
    else if (relation === "ENEMY") window.deathCounts.enemy += 1;
    else {
      addLimitation(window, "UNKNOWN_TEAM");
      addLimitation(objective, "UNKNOWN_TEAM");
    }
  });
}

function assignEncounters(objectives, encounters) {
  encounters.forEach((encounter) => {
    const objective = chooseObjectiveForEncounter(encounter, objectives);
    if (!objective) return;
    let spatialLinkConfidence = "HIGH";
    if (encounter.centerPosition && objective.centerPosition) {
      if (distanceBetween(encounter.centerPosition, objective.centerPosition) > 5000) return;
    } else {
      spatialLinkConfidence = "MEDIUM";
      addLimitation(objective, "MISSING_SPATIAL_LINK");
    }
    const centerTime = Math.round((encounter.startTimestamp + encounter.endTimestamp) / 2);
    const window = stageWindow(objective, centerTime);
    if (!window.linkedEncounterIds.includes(encounter.id)) {
      window.linkedEncounterIds.push(encounter.id);
      window.linkedEncounterIds.sort();
    }
    encounter.sourceRefs.forEach((sourceRef) => addSourceRef(window, sourceRef));
    objective.linkedEncounterInvolvements.push({
      encounterId: encounter.id,
      encounterPlayerInvolvement: encounter.playerInvolvement,
      associationConfidence: lowerConfidence(
        encounter.confidence,
        lowerConfidence(objective.confidence, spatialLinkConfidence),
      ),
    });
    encounter.linkedObjectiveEngagementIds.push(objective.id);
    encounter.linkedObjectiveEngagementIds.sort();
  });
}

function conversionOwner(timestamp, objectives, excludedObjective = null) {
  return objectives
    .filter((objective) =>
      objective !== excludedObjective &&
      timestamp >= objective.captureEndTimestamp &&
      timestamp < objective.conversionWindow.endMsExclusive)
    .sort((left, right) =>
      right.captureEndTimestamp - left.captureEndTimestamp ||
      left.id.localeCompare(right.id))[0] || null;
}

function structureMatchesCapture(objective, structure) {
  if (objective.captureTeam === "ALLY") return structure.takerRelation === "ALLY";
  if (objective.captureTeam === "ENEMY") return structure.takerRelation === "ENEMY";
  if (objective.captureTeam === "SPLIT") {
    return structure.takerRelation === "ALLY" || structure.takerRelation === "ENEMY";
  }
  return false;
}

function assignStructures(source, objectives) {
  source.structureEvents.forEach((structure) => {
    const objective = conversionOwner(structure.timestamp, objectives);
    if (!objective || !structureMatchesCapture(objective, structure)) return;
    objective.structureConversions.push({ ...structure });
    objective.structureConversions.sort((left, right) =>
      left.timestamp - right.timestamp || left.sourceRef.id.localeCompare(right.sourceRef.id));
    addSourceRef(objective.conversionWindow, structure.sourceRef);
  });
}

function assignLaterObjectiveMacros(source, objectives) {
  source.objectiveEvents.forEach((event) => {
    const ownObjective = objectives.find((objective) =>
      objective._anchorSourceRefIds.has(event.sourceRef.id));
    const owner = conversionOwner(event.timestamp, objectives, ownObjective);
    if (owner) addSourceRef(owner.conversionWindow, event.sourceRef);
  });
}

function publicSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    snapshotTimestamp: snapshot.snapshotTimestamp,
    frameAgeSeconds: snapshot.frameAgeSeconds,
    totalGold: snapshot.totalGold,
    totalXp: snapshot.totalXp,
    livingParticipantIds: [...snapshot.livingParticipantIds],
    positionedParticipantIds: [...snapshot.positionedParticipantIds],
  };
}

function populateWindowSnapshots(source, objective, window) {
  for (const [boundary, timestamp] of [
    ["start", window.startMs],
    ["end", window.endMsExclusive],
  ]) {
    for (const relation of ["ALLY", "ENEMY"]) {
      const result = resolveCompleteTeamSnapshotAtOrBefore(
        source,
        relation,
        timestamp,
        60000,
      );
      window.teamSnapshots[boundary][relation.toLowerCase()] = publicSnapshot(result.snapshot);
      if (!result.snapshot) {
        addLimitation(window, result.limitationCode);
        addLimitation(objective, result.limitationCode);
      }
    }
  }
}

function finalizeObjectives(source, objectives) {
  objectives.forEach((objective) => {
    objective.linkedEncounterInvolvements.sort((left, right) =>
      left.encounterId.localeCompare(right.encounterId));
    objective.linkedEncounterIds = [...new Set([
      ...objective.setupWindow.linkedEncounterIds,
      ...objective.contestWindow.linkedEncounterIds,
    ])].sort();
    populateWindowSnapshots(source, objective, objective.setupWindow);
    populateWindowSnapshots(source, objective, objective.contestWindow);
    populateWindowSnapshots(source, objective, objective.conversionWindow);
    delete objective._anchorSourceRefIds;
  });
}

function buildObjectiveEngagements(source, encounters) {
  const objectives = groupObjectiveAnchors(source)
    .map((anchor) => createObjective(anchor, source));
  const updatedEncounters = encounters.map((encounter) => ({
    ...encounter,
    linkedObjectiveEngagementIds: [...(encounter.linkedObjectiveEngagementIds || [])],
  }));
  assignKillEvents(source, objectives);
  assignEncounters(objectives, updatedEncounters);
  assignStructures(source, objectives);
  assignLaterObjectiveMacros(source, objectives);
  finalizeObjectives(source, objectives);
  return { objectiveEngagements: objectives, encounters: updatedEncounters };
}

module.exports = {
  groupObjectiveAnchors,
  buildObjectiveEngagements,
};
