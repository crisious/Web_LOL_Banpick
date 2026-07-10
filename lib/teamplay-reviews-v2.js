const {
  makeFactId,
  stableId,
  lowerConfidence,
  relationForTeam,
  createCoverageEnvelope,
} = require("./teamplay-contract-v2");
const {
  eventParticipantIds,
  latestParticipantFrameAtOrBefore,
  resolveCompleteTeamSnapshotAtOrBefore,
} = require("./teamplay-source-v2");
const { distanceBetween } = require("./teamplay-encounters-v2");

const INVOLVEMENT_RANK = { NOT_INVOLVED: 0, APPROXIMATE: 1, CONFIRMED: 2 };
const ENCOUNTER_RANK = { PICK: 0, SKIRMISH: 1, TEAMFIGHT_CANDIDATE: 2 };

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function uniqueSourceRefs(sourceRefs) {
  const byId = new Map();
  sourceRefs.filter(Boolean).forEach((ref) => byId.set(ref.id, ref));
  return [...byId.values()].sort((left, right) =>
    left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

function effectiveLevel(involvements) {
  return involvements.reduce((best, entry) => {
    const level = entry.playerInvolvement?.level || "NOT_INVOLVED";
    return INVOLVEMENT_RANK[level] > INVOLVEMENT_RANK[best] ? level : best;
  }, "NOT_INVOLVED");
}

function lowestConfidence(values) {
  return values.filter(Boolean).reduce(
    (current, value) => lowerConfidence(current, value),
    "HIGH",
  );
}

function scoreScene(scene, context) {
  const base = scene.primaryType === "OBJECTIVE"
    ? 30
    : context.encounterType === "TEAMFIGHT_CANDIDATE" ? 30
      : context.encounterType === "SKIRMISH" ? 20 : 10;
  const involvement = scene.effectiveInvolvementLevel === "CONFIRMED"
    ? 30
    : scene.effectiveInvolvementLevel === "APPROXIMATE" ? 10 : 0;
  const first = scene.playerFirstRecordedInvolvement ? 15 : 0;
  const combined = scene.objectiveEngagementId && scene.encounterIds.length > 0 ? 15 : 0;
  const deathSwing = Math.min(
    15,
    Math.abs((scene.allyDeaths || 0) - (scene.enemyDeaths || 0)) * 5,
  );
  const conversion = scene.structureConversionCount > 0 ? 10 : 0;
  return base + involvement + first + combined + deathSwing + conversion;
}

function killEventMap(source) {
  return new Map(source.killEvents.map((event) => [event.sourceRef.id, event]));
}

function sceneKillEvents(scene, encounters, objective, source) {
  const ids = new Set();
  const encounterById = new Map(encounters.map((row) => [row.id, row]));
  scene.encounterIds.forEach((id) => {
    (encounterById.get(id)?.sourceRefs || []).forEach((ref) => ids.add(ref.id));
  });
  if (objective) {
    (objective.contestWindow?.sourceRefs || []).forEach((ref) => ids.add(ref.id));
  }
  const byRef = killEventMap(source);
  return [...ids].map((id) => byRef.get(id)).filter(Boolean)
    .sort((left, right) =>
      left.timestamp - right.timestamp || left.sourceRef.id.localeCompare(right.sourceRef.id));
}

function firstRecordedInvolvement(events, targetParticipantId) {
  const first = events[0];
  if (!first || !eventParticipantIds(first).includes(targetParticipantId)) return null;
  const basis = first.killerId === targetParticipantId
    ? "KILLER"
    : first.victimId === targetParticipantId ? "VICTIM" : "ASSIST";
  return { event: first, basis };
}

function encounterTypeFor(encounters) {
  return encounters.reduce((best, encounter) =>
    ENCOUNTER_RANK[encounter.type] > ENCOUNTER_RANK[best]
      ? encounter.type
      : best,
  "PICK");
}

function sortInvolvements(involvements) {
  const domainRank = { OBJECTIVE: 0, ENCOUNTER: 1 };
  return involvements.map((entry) => ({
    ...entry,
    playerInvolvement: {
      level: entry.playerInvolvement?.level || "NOT_INVOLVED",
      records: [...(entry.playerInvolvement?.records || [])].sort((left, right) =>
        (left.timestamp ?? left.sourceRefs?.[0]?.timestamp ?? 0) -
          (right.timestamp ?? right.sourceRefs?.[0]?.timestamp ?? 0) ||
        String(left.basis).localeCompare(String(right.basis)) ||
        String(left.sourceRefs?.[0]?.id || "").localeCompare(
          String(right.sourceRefs?.[0]?.id || ""),
        )),
    },
  })).sort((left, right) =>
    (domainRank[left.domainType] ?? 9) - (domainRank[right.domainType] ?? 9) ||
    left.domainId.localeCompare(right.domainId));
}

function enrichScene(scene, source, encounters, objective) {
  const linkedEncounters = encounters.filter((row) => scene.encounterIds.includes(row.id));
  const killEvents = sceneKillEvents(scene, encounters, objective, source);
  const first = firstRecordedInvolvement(killEvents, source.targetParticipantId);
  const allyDeaths = objective?.contestWindow?.deathCounts?.ally ??
    linkedEncounters.reduce((sum, row) => sum + (row.allyDeaths || 0), 0);
  const enemyDeaths = objective?.contestWindow?.deathCounts?.enemy ??
    linkedEncounters.reduce((sum, row) => sum + (row.enemyDeaths || 0), 0);
  const firstTakedownTeam = killEvents.length > 0
    ? linkedEncounters.find((encounter) =>
        encounter.sourceRefs.some((ref) => ref.id === killEvents[0].sourceRef.id))
        ?.firstTakedownTeam || "UNKNOWN"
    : "UNKNOWN";
  const confidence = lowestConfidence([
    objective?.confidence,
    ...linkedEncounters.map((row) => row.confidence),
    ...scene.involvements.map((row) => row.associationConfidence),
  ]);
  const limitationCodes = uniqueSorted([
    ...(objective?.limitationCodes || []),
    ...linkedEncounters.flatMap((row) => row.limitationCodes || []),
  ]);
  const enriched = {
    ...scene,
    involvements: sortInvolvements(scene.involvements),
    sourceRefs: uniqueSourceRefs([
      ...(objective?.sourceRefs || []),
      ...linkedEncounters.flatMap((row) => row.sourceRefs || []),
    ]),
    confidence,
    limitationCodes,
    allyDeaths,
    enemyDeaths,
    firstTakedownTeam,
    playerFirstRecordedInvolvement: Boolean(first),
    firstRecordedInvolvementBasis: first?.basis || null,
    firstRecordedInvolvementEventRef: first?.event.sourceRef || null,
    structureConversionCount: objective?.structureConversions?.length || 0,
  };
  enriched.effectiveInvolvementLevel = effectiveLevel(enriched.involvements);
  enriched.importanceScore = scoreScene(enriched, {
    encounterType: encounterTypeFor(linkedEncounters),
  });
  return enriched;
}

function buildScenes(source, encounters, objectives) {
  const encounterById = new Map(encounters.map((row) => [row.id, row]));
  const linkedIds = new Set();
  const scenes = objectives.map((objective) => {
    const linked = (objective.contestWindow?.linkedEncounterIds || [])
      .map((id) => encounterById.get(id))
      .filter(Boolean);
    linked.forEach((encounter) => linkedIds.add(encounter.id));
    const involvements = [
      {
        domainType: "OBJECTIVE",
        domainId: objective.id,
        playerInvolvement: objective.playerInvolvement,
        associationConfidence: objective.confidence,
      },
      ...linked.map((encounter) => ({
        domainType: "ENCOUNTER",
        domainId: encounter.id,
        playerInvolvement: encounter.playerInvolvement,
        associationConfidence: (objective.linkedEncounterInvolvements || [])
          .find((row) => row.encounterId === encounter.id)
          ?.associationConfidence || "LOW",
      })),
    ];
    const startTimestamp = Math.min(
      objective.setupWindow.startMs,
      ...linked.map((row) => row.startTimestamp),
    );
    const endTimestamp = Math.max(
      objective.conversionWindow.endMsExclusive,
      ...linked.map((row) => row.endTimestamp),
    );
    const scene = {
      sceneId: stableId("scene", {
        schemaVersion: source.schemaVersion,
        matchId: source.matchId,
        primaryType: "OBJECTIVE",
        startTimestamp,
        sourceRefIds: (objective.sourceRefs || []).map((ref) => ref.id).sort(),
      }),
      primaryType: "OBJECTIVE",
      objectiveEngagementId: objective.id,
      encounterIds: linked.map((row) => row.id).sort(),
      startTimestamp,
      endTimestamp,
      involvements,
      effectiveInvolvementLevel: effectiveLevel(involvements),
    };
    return enrichScene(scene, source, encounters, objective);
  });

  encounters.filter((encounter) => !linkedIds.has(encounter.id)).forEach((encounter) => {
    const involvements = [{
      domainType: "ENCOUNTER",
      domainId: encounter.id,
      playerInvolvement: encounter.playerInvolvement,
      associationConfidence: encounter.confidence,
    }];
    const scene = {
      sceneId: stableId("scene", {
        schemaVersion: source.schemaVersion,
        matchId: source.matchId,
        primaryType: "ENCOUNTER",
        startTimestamp: encounter.startTimestamp,
        sourceRefIds: encounter.sourceRefs.map((ref) => ref.id).sort(),
      }),
      primaryType: "ENCOUNTER",
      objectiveEngagementId: null,
      encounterIds: [encounter.id],
      startTimestamp: encounter.startTimestamp,
      endTimestamp: encounter.endTimestamp,
      involvements,
      effectiveInvolvementLevel: effectiveLevel(involvements),
    };
    scenes.push(enrichScene(scene, source, encounters, null));
  });
  return scenes.sort((left, right) =>
    left.startTimestamp - right.startTimestamp || left.sceneId.localeCompare(right.sceneId));
}

function finalizeFact(reviewId, fact) {
  const normalized = {
    type: fact.type,
    timestamp: Math.round(fact.timestamp),
    value: fact.value,
    confidence: fact.confidence,
    sourceRefs: uniqueSourceRefs(fact.sourceRefs),
    limitationCodes: uniqueSorted(fact.limitationCodes || []),
  };
  return { factId: makeFactId(reviewId, normalized), ...normalized };
}

function encounterFacts(reviewId, scene, encounters, source, objective) {
  const linked = encounters.filter((row) => scene.encounterIds.includes(row.id));
  const facts = linked.map((encounter) => finalizeFact(reviewId, {
    type: "ENCOUNTER_CLASSIFICATION",
    timestamp: encounter.startTimestamp,
    value: { encounterId: encounter.id, type: encounter.type },
    confidence: encounter.confidence,
    sourceRefs: encounter.sourceRefs,
    limitationCodes: encounter.limitationCodes,
  }));
  const kills = sceneKillEvents(scene, encounters, objective, source);
  if (kills.length > 0) {
    const refs = kills.map((event) => event.sourceRef);
    facts.push(finalizeFact(reviewId, {
      type: "ALLY_DEATH_COUNT",
      timestamp: kills[0].timestamp,
      value: { count: scene.allyDeaths },
      confidence: scene.confidence,
      sourceRefs: refs,
      limitationCodes: scene.limitationCodes,
    }));
    facts.push(finalizeFact(reviewId, {
      type: "ENEMY_DEATH_COUNT",
      timestamp: kills[0].timestamp,
      value: { count: scene.enemyDeaths },
      confidence: scene.confidence,
      sourceRefs: refs,
      limitationCodes: scene.limitationCodes,
    }));
    facts.push(finalizeFact(reviewId, {
      type: "FIRST_TAKEDOWN_TEAM",
      timestamp: kills[0].timestamp,
      value: { team: scene.firstTakedownTeam },
      confidence: scene.confidence,
      sourceRefs: [kills[0].sourceRef],
      limitationCodes: scene.firstTakedownTeam === "UNKNOWN" ? ["UNKNOWN_TEAM"] : [],
    }));
  }
  return facts;
}

function objectiveFacts(reviewId, objective) {
  if (!objective) return [];
  return [
    finalizeFact(reviewId, {
      type: "OBJECTIVE_CAPTURE_TEAM",
      timestamp: objective.captureEndTimestamp,
      value: { team: objective.captureTeam },
      confidence: objective.confidence,
      sourceRefs: objective.sourceRefs,
      limitationCodes: objective.captureTeam === "UNKNOWN" ? ["UNKNOWN_TEAM"] : [],
    }),
    finalizeFact(reviewId, {
      type: "OBJECTIVE_CAPTURE_COUNTS",
      timestamp: objective.captureEndTimestamp,
      value: { ...objective.captureCounts },
      confidence: objective.confidence,
      sourceRefs: objective.sourceRefs,
      limitationCodes: objective.limitationCodes,
    }),
  ];
}

function recordTimestamp(record) {
  return record.timestamp ?? record.sourceRefs?.find((ref) => ref.kind === "TIMELINE_EVENT")
    ?.timestamp ?? 0;
}

function decisionFacts(reviewId, scene, encounters, objective, source) {
  const encounterById = new Map(encounters.map((row) => [row.id, row]));
  const facts = [];
  scene.involvements.forEach((involvement) => {
    (involvement.playerInvolvement?.records || []).forEach((record) => {
      if (record.basis === "POSITION_PROXIMITY") return;
      const timestamp = recordTimestamp(record);
      if (involvement.domainType === "OBJECTIVE") {
        const type = record.basis === "OBJECTIVE_KILLER"
          ? "PLAYER_OBJECTIVE_KILLER"
          : record.basis === "OBJECTIVE_ASSIST" ? "PLAYER_OBJECTIVE_ASSIST" : null;
        if (!type) return;
        facts.push(finalizeFact(reviewId, {
          type,
          timestamp,
          value: {
            participantId: source.targetParticipantId,
            stage: record.stage || "CONTEST",
            eventTimestamp: timestamp,
          },
          confidence: involvement.associationConfidence,
          sourceRefs: record.sourceRefs,
          limitationCodes: [],
        }));
        return;
      }
      const type = record.basis === "KILLER"
        ? "PLAYER_CONFIRMED_KILL"
        : record.basis === "ASSIST"
          ? "PLAYER_CONFIRMED_ASSIST"
          : record.basis === "VICTIM" ? "PLAYER_CONFIRMED_DEATH" : null;
      if (!type) return;
      const encounter = encounterById.get(involvement.domainId);
      const eventRef = record.sourceRefs.find((ref) => ref.kind === "TIMELINE_EVENT");
      const phase = encounter?.phaseEvents?.find((row) => row.sourceRef.id === eventRef?.id)
        ?.phase || "EXCHANGE";
      facts.push(finalizeFact(reviewId, {
        type,
        timestamp,
        value: {
          participantId: source.targetParticipantId,
          phase,
          eventTimestamp: timestamp,
        },
        confidence: involvement.associationConfidence,
        sourceRefs: record.sourceRefs,
        limitationCodes: [],
      }));
    });
  });
  if (scene.playerFirstRecordedInvolvement && scene.firstRecordedInvolvementEventRef) {
    facts.push(finalizeFact(reviewId, {
      type: "PLAYER_FIRST_RECORDED_INVOLVEMENT",
      timestamp: scene.firstRecordedInvolvementEventRef.timestamp,
      value: {
        participantId: source.targetParticipantId,
        basis: scene.firstRecordedInvolvementBasis,
        eventTimestamp: scene.firstRecordedInvolvementEventRef.timestamp,
      },
      confidence: scene.confidence,
      sourceRefs: [scene.firstRecordedInvolvementEventRef],
      limitationCodes: [],
    }));
  }
  return facts.sort((left, right) =>
    left.timestamp - right.timestamp || left.type.localeCompare(right.type) ||
    left.factId.localeCompare(right.factId));
}

function sourceEventByRef(source, sourceRefId) {
  return [...source.killEvents, ...source.objectiveEvents, ...source.structureEvents]
    .find((event) => event.sourceRef.id === sourceRefId) || null;
}

function positioningAnchor(scene, encounters, objectives, source) {
  const encounterById = new Map(encounters.map((row) => [row.id, row]));
  const objectiveById = new Map(objectives.map((row) => [row.id, row]));
  const rows = [];
  scene.involvements.forEach((involvement) => {
    (involvement.playerInvolvement?.records || []).forEach((record) => {
      const eventRef = record.sourceRefs.find((ref) => ref.kind === "TIMELINE_EVENT");
      if (!eventRef) return;
      const domain = involvement.domainType === "OBJECTIVE"
        ? objectiveById.get(involvement.domainId)
        : encounterById.get(involvement.domainId);
      const event = sourceEventByRef(source, eventRef.id);
      rows.push({
        timestamp: eventRef.timestamp,
        domainType: involvement.domainType,
        domainId: involvement.domainId,
        basis: record.basis,
        stage: record.stage,
        eventRef,
        position: event?.position || domain?.centerPosition || null,
      });
    });
  });
  return rows.sort((left, right) =>
    left.timestamp - right.timestamp ||
    left.domainType.localeCompare(right.domainType) ||
    left.domainId.localeCompare(right.domainId) ||
    left.basis.localeCompare(right.basis) ||
    left.eventRef.id.localeCompare(right.eventRef.id))[0] || null;
}

function frameConfidence(frameAgeMs) {
  if (frameAgeMs <= 5000) return "HIGH";
  if (frameAgeMs <= 15000) return "MEDIUM";
  return "LOW";
}

function distanceFactType(distance) {
  if (distance <= 2500) return "PLAYER_DISTANCE_LE_2500";
  if (distance <= 5000) return "PLAYER_DISTANCE_2500_5000";
  return "PLAYER_DISTANCE_GT_5000";
}

function nearbyAllyFact(reviewId, source, targetFrame, anchorTimestamp, confidence) {
  const snapshot = source.snapshots.find((row) => row.timestamp === targetFrame.timestamp);
  const allyIds = source.participants
    .filter((participant) =>
      relationForTeam(participant.teamId, source.targetTeamId) === "ALLY")
    .map((participant) => participant.participantId);
  const rows = allyIds.map((id) => snapshot?.participants.get(id)).filter(Boolean);
  if (allyIds.length !== 5 || rows.length !== 5 || !targetFrame.position) {
    return { fact: null, limitationCode: "INCOMPLETE_ALLY_FRAME_COVERAGE" };
  }
  const otherAllies = rows.filter((row) => row.participantId !== source.targetParticipantId);
  const incompleteLivingPosition = otherAllies.some((row) =>
    row.currentHealth > 0 && !row.position);
  if (otherAllies.length !== 4 || incompleteLivingPosition) {
    return { fact: null, limitationCode: "INCOMPLETE_ALLY_FRAME_COVERAGE" };
  }
  const hasNearbyLivingAlly = otherAllies.some((row) =>
    row.currentHealth > 0 && distanceBetween(targetFrame.position, row.position) <= 2500);
  if (hasNearbyLivingAlly) return { fact: null, limitationCode: null };
  return {
    fact: finalizeFact(reviewId, {
      type: "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT",
      timestamp: anchorTimestamp,
      value: {
        frameTimestamp: targetFrame.timestamp,
        frameAgeSeconds: Math.round((anchorTimestamp - targetFrame.timestamp) / 1000),
        radius: 2500,
      },
      confidence,
      sourceRefs: rows.map((row) => row.sourceRef),
      limitationCodes: [],
    }),
    limitationCode: null,
  };
}

function positioningFacts(reviewId, scene, encounters, objectives, source) {
  const anchor = positioningAnchor(scene, encounters, objectives, source);
  if (!anchor?.position) return { facts: [], limitationCodes: [] };
  const frame = latestParticipantFrameAtOrBefore(
    source,
    source.targetParticipantId,
    anchor.timestamp,
    30000,
  );
  if (!frame?.position) return { facts: [], limitationCodes: [] };
  const frameAgeMs = anchor.timestamp - frame.timestamp;
  const frameAgeSeconds = Math.round(frameAgeMs / 1000);
  const confidence = frameConfidence(frameAgeMs);
  const distance = distanceBetween(frame.position, anchor.position);
  const facts = [finalizeFact(reviewId, {
    type: distanceFactType(distance),
    timestamp: anchor.timestamp,
    value: {
      distance,
      frameTimestamp: frame.timestamp,
      frameAgeSeconds,
      stage: anchor.stage || "ENCOUNTER",
    },
    confidence,
    sourceRefs: [frame.sourceRef, anchor.eventRef],
    limitationCodes: [],
  })];
  const nearby = nearbyAllyFact(reviewId, source, frame, anchor.timestamp, confidence);
  if (nearby.fact) facts.push(nearby.fact);
  return {
    facts,
    limitationCodes: nearby.limitationCode ? [nearby.limitationCode] : [],
  };
}

function outcomeFacts(reviewId, objective, source) {
  if (!objective) return [];
  const facts = (objective.structureConversions || []).map((structure) =>
    finalizeFact(reviewId, {
      type: "STRUCTURE_CONVERSION",
      timestamp: structure.timestamp,
      value: {
        takerTeam: structure.takerRelation,
        buildingType: structure.buildingType,
        towerType: structure.towerType,
        laneType: structure.laneType,
      },
      confidence: structure.takerRelation === "UNKNOWN" ? "LOW" : "HIGH",
      sourceRefs: [structure.sourceRef],
      limitationCodes: structure.takerRelation === "UNKNOWN" ? ["UNKNOWN_TEAM"] : [],
    }));
  const death = source.killEvents.find((event) =>
    event.victimId === source.targetParticipantId &&
    event.timestamp >= objective.captureEndTimestamp &&
    event.timestamp < objective.captureEndTimestamp + 120000);
  if (death) {
    facts.push(finalizeFact(reviewId, {
      type: "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE",
      timestamp: death.timestamp,
      value: {
        eventTimestamp: death.timestamp,
        secondsAfterCapture: Math.floor(
          (death.timestamp - objective.captureEndTimestamp) / 1000,
        ),
      },
      confidence: "HIGH",
      sourceRefs: [death.sourceRef],
      limitationCodes: [],
    }));
  }
  return facts.sort((left, right) =>
    left.timestamp - right.timestamp || left.type.localeCompare(right.type));
}

function buildPersonalReviewCandidates(source, scenes, encounters, objectives) {
  const objectiveById = new Map(objectives.map((row) => [row.id, row]));
  return scenes
    .filter((scene) => scene.effectiveInvolvementLevel !== "NOT_INVOLVED")
    .map((scene) => {
      const objective = objectiveById.get(scene.objectiveEngagementId) || null;
      const domainSourceRefIds = scene.sourceRefs.map((ref) => ref.id).sort();
      const reviewId = stableId("review", {
        schemaVersion: source.schemaVersion,
        matchId: source.matchId,
        sceneId: scene.sceneId,
        startTimestamp: scene.startTimestamp,
        sourceRefIds: domainSourceRefIds,
      });
      const teamAppendixId = stableId("appendix", {
        schemaVersion: source.schemaVersion,
        matchId: source.matchId,
        reviewId,
        sourceRefIds: domainSourceRefIds,
      });
      const situationFacts = [
        ...encounterFacts(reviewId, scene, encounters, source, objective),
        ...objectiveFacts(reviewId, objective),
      ];
      const decisions = decisionFacts(reviewId, scene, encounters, objective, source);
      const positioning = positioningFacts(reviewId, scene, encounters, objectives, source);
      const outcomes = outcomeFacts(reviewId, objective, source);
      const allFacts = [...situationFacts, ...decisions, ...positioning.facts, ...outcomes];
      const limitationCodes = uniqueSorted([
        ...scene.limitationCodes,
        ...positioning.limitationCodes,
        ...allFacts.flatMap((fact) => fact.limitationCodes),
      ]);
      return {
        reviewId,
        sceneId: scene.sceneId,
        encounterIds: [...scene.encounterIds],
        objectiveEngagementId: scene.objectiveEngagementId,
        sourceRefs: uniqueSourceRefs([
          ...scene.sourceRefs,
          ...allFacts.flatMap((fact) => fact.sourceRefs),
        ]),
        startTimestamp: scene.startTimestamp,
        endTimestamp: scene.endTimestamp,
        confidence: lowestConfidence([
          scene.confidence,
          ...allFacts.map((fact) => fact.confidence),
        ]),
        limitationCodes,
        importanceScore: scene.importanceScore,
        involvements: scene.involvements,
        effectiveInvolvementLevel: scene.effectiveInvolvementLevel,
        situationFacts,
        decisionFacts: decisions,
        positioningFacts: positioning.facts,
        outcomeFacts: outcomes,
        evidenceIds: allFacts.map((fact) => fact.factId),
        narrative: null,
        teamAppendixId,
      };
    });
}

function selectTopPersonalReviews(candidates, limit = 5) {
  return [...candidates].sort((left, right) =>
    right.importanceScore - left.importanceScore ||
    left.startTimestamp - right.startTimestamp ||
    left.reviewId.localeCompare(right.reviewId))
    .slice(0, limit);
}

function preEncounterGoldDifference(source, reviewId, scene) {
  const allyResult = resolveCompleteTeamSnapshotAtOrBefore(
    source,
    "ALLY",
    scene.startTimestamp,
    60000,
  );
  const enemyResult = resolveCompleteTeamSnapshotAtOrBefore(
    source,
    "ENEMY",
    scene.startTimestamp,
    60000,
  );
  if (!allyResult.snapshot || !enemyResult.snapshot) {
    return {
      fact: null,
      limitationCodes: uniqueSorted([
        allyResult.limitationCode,
        enemyResult.limitationCode,
      ].filter(Boolean)),
    };
  }
  const ally = allyResult.snapshot;
  const enemy = enemyResult.snapshot;
  if (ally.snapshotTimestamp !== enemy.snapshotTimestamp) {
    return {
      fact: null,
      limitationCodes: ["INCOMPLETE_TEAM_SNAPSHOT"],
    };
  }
  const timestamp = Math.min(ally.snapshotTimestamp, enemy.snapshotTimestamp);
  return {
    fact: finalizeFact(reviewId, {
      type: "PRE_ENCOUNTER_GOLD_DIFFERENCE",
      timestamp,
      value: {
        value: ally.totalGold - enemy.totalGold,
        allyGold: ally.totalGold,
        enemyGold: enemy.totalGold,
        snapshotTimestamp: timestamp,
        frameAgeSeconds: Math.max(ally.frameAgeSeconds, enemy.frameAgeSeconds),
      },
      confidence: Math.max(ally.frameAgeSeconds, enemy.frameAgeSeconds) <= 30
        ? "MEDIUM"
        : "LOW",
      sourceRefs: [...ally.participantFrames, ...enemy.participantFrames]
        .map((row) => row.sourceRef),
      limitationCodes: [],
    }),
    limitationCodes: [],
  };
}

function publicParticipant(participantId, source) {
  const participant = source.participantById.get(participantId);
  return {
    participantId,
    champion: participant?.champion || "Unknown",
    role: participant?.role || "UNKNOWN",
  };
}

function buildTeamAppendix(source, review, scene) {
  const eventRefs = scene.sourceRefs.filter((ref) => ref.kind === "TIMELINE_EVENT");
  const events = eventRefs.map((ref) => sourceEventByRef(source, ref.id)).filter(Boolean);
  const ids = [...new Set(events.flatMap(eventParticipantIds))].sort((a, b) => a - b);
  const allyDirectParticipants = ids.filter((id) =>
    relationForTeam(source.participantById.get(id)?.teamId, source.targetTeamId) === "ALLY")
    .map((id) => publicParticipant(id, source));
  const enemyDirectParticipants = ids.filter((id) =>
    relationForTeam(source.participantById.get(id)?.teamId, source.targetTeamId) === "ENEMY")
    .map((id) => publicParticipant(id, source));
  const hasUnknownParticipant = ids.some((id) =>
    relationForTeam(source.participantById.get(id)?.teamId, source.targetTeamId) === "UNKNOWN");
  const gold = preEncounterGoldDifference(source, review.reviewId, scene);
  const teamFactTypes = new Set([
    "ALLY_DEATH_COUNT",
    "ENEMY_DEATH_COUNT",
    "FIRST_TAKEDOWN_TEAM",
    "OBJECTIVE_CAPTURE_TEAM",
    "OBJECTIVE_CAPTURE_COUNTS",
    "STRUCTURE_CONVERSION",
  ]);
  const reviewFacts = [
    ...review.situationFacts,
    ...review.outcomeFacts,
  ].filter((fact) => teamFactTypes.has(fact.type));
  const objectiveCapture = review.situationFacts.find((fact) =>
    fact.type === "OBJECTIVE_CAPTURE_TEAM");
  const structureConversions = review.outcomeFacts
    .filter((fact) => fact.type === "STRUCTURE_CONVERSION")
    .map((fact) => ({
      timestamp: fact.timestamp,
      takerRelation: fact.value.takerTeam,
      buildingType: fact.value.buildingType,
      towerType: fact.value.towerType,
      laneType: fact.value.laneType,
      factId: fact.factId,
    }));
  return {
    teamAppendixId: review.teamAppendixId,
    reviewId: review.reviewId,
    allyDirectParticipants,
    enemyDirectParticipants,
    firstTakedownTeam: scene.firstTakedownTeam,
    allyDeaths: scene.allyDeaths,
    enemyDeaths: scene.enemyDeaths,
    preEncounterGoldDifference: gold.fact,
    captureTeam: objectiveCapture?.value?.team ?? null,
    structureConversions,
    factIds: uniqueSorted([
      ...reviewFacts.map((fact) => fact.factId),
      ...(gold.fact ? [gold.fact.factId] : []),
    ]),
    limitationCodes: uniqueSorted([
      ...scene.limitationCodes,
      ...gold.limitationCodes,
      ...(hasUnknownParticipant ? ["UNKNOWN_TEAM"] : []),
    ]),
  };
}

function buildCoverage(source, reviewCandidates, domains = []) {
  if (!source.hasRawTimeline) {
    return createCoverageEnvelope({ level: "UNAVAILABLE", source: "NONE" });
  }
  const total = reviewCandidates.length;
  const positioned = reviewCandidates
    .filter((review) => review.positioningFacts.length > 0).length;
  const ratio = total === 0 ? 0 : positioned / total;
  const inheritedLimitations = uniqueSorted([
    ...reviewCandidates.flatMap((review) => review.limitationCodes || []),
    ...domains.flatMap((row) => row.limitationCodes || []),
  ]);
  if (total === 0 || positioned === total) {
    return createCoverageEnvelope({
      level: "FULL",
      source: "RAW_TIMELINE",
      usablePositionSceneRatio: ratio,
      limitationCodes: inheritedLimitations,
    });
  }
  if (positioned === 0) {
    return createCoverageEnvelope({
      level: "EVENT_ONLY",
      source: "RAW_TIMELINE",
      usablePositionSceneRatio: 0,
      limitationCodes: [...inheritedLimitations, "NO_POSITION_FRAMES"],
    });
  }
  return createCoverageEnvelope({
    level: "PARTIAL",
    source: "RAW_TIMELINE",
    usablePositionSceneRatio: ratio,
    limitationCodes: [...inheritedLimitations, "PARTIAL_POSITION_FRAMES"],
  });
}

module.exports = {
  buildScenes,
  scoreScene,
  buildPersonalReviewCandidates,
  selectTopPersonalReviews,
  buildTeamAppendix,
  buildCoverage,
};
