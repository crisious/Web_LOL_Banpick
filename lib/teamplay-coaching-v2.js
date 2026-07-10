const {
  LIMITATION_CODES,
  createCoverageEnvelope,
  validateTeamplayRoot,
} = require("./teamplay-contract-v2");

const FACT_TYPES = new Set([
  "ENCOUNTER_CLASSIFICATION",
  "ALLY_DEATH_COUNT",
  "ENEMY_DEATH_COUNT",
  "FIRST_TAKEDOWN_TEAM",
  "PLAYER_CONFIRMED_KILL",
  "PLAYER_CONFIRMED_ASSIST",
  "PLAYER_CONFIRMED_DEATH",
  "PLAYER_FIRST_RECORDED_INVOLVEMENT",
  "PLAYER_DISTANCE_LE_2500",
  "PLAYER_DISTANCE_2500_5000",
  "PLAYER_DISTANCE_GT_5000",
  "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT",
  "OBJECTIVE_CAPTURE_TEAM",
  "OBJECTIVE_CAPTURE_COUNTS",
  "PLAYER_OBJECTIVE_KILLER",
  "PLAYER_OBJECTIVE_ASSIST",
  "STRUCTURE_CONVERSION",
  "PRE_ENCOUNTER_GOLD_DIFFERENCE",
  "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE",
]);
const CONFIDENCES = new Set(["HIGH", "MEDIUM", "LOW"]);
const CONFIDENCE_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 };

const RECOMMENDATIONS = {
  GROUP_BEFORE_OBJECTIVE: {
    priority: 2,
    requiredFactTypes: ["NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT"],
    allowedFactTypes: [
      "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT",
      "OBJECTIVE_CAPTURE_TEAM",
    ],
    requiresObjective: true,
    minConfidence: "MEDIUM",
    betterChoice: "오브젝트 진입 전에 가까운 아군과 같은 경로를 선택하세요.",
    nextGameRule: "오브젝트 20초 전에는 2,500 이내 생존 아군이 있는지 확인하세요.",
  },
  DECIDE_JOIN_OR_TRADE_EARLY: {
    priority: 3,
    requiredFactTypes: ["PLAYER_DISTANCE_GT_5000"],
    allowedFactTypes: ["PLAYER_DISTANCE_GT_5000", "OBJECTIVE_CAPTURE_TEAM"],
    requiresObjective: true,
    minConfidence: "MEDIUM",
    betterChoice: "오브젝트 생성 전에 합류 또는 반대편 교환 계획을 먼저 확정하세요.",
    nextGameRule: "오브젝트 30초 전 5,000보다 멀면 합류와 교환 중 하나를 결정하세요.",
  },
  REVIEW_OPENING_DEATH: {
    priority: 4,
    requiredFactTypes: ["PLAYER_CONFIRMED_DEATH"],
    allowedFactTypes: ["PLAYER_CONFIRMED_DEATH"],
    requiresObjective: false,
    phase: "OPENING",
    betterChoice: "첫 교환 전에 가까운 아군과 사용할 이탈 경로를 확인하세요.",
    nextGameRule: "첫 행동 전에 생존 경로 하나를 정하세요.",
  },
  RESET_AFTER_CAPTURE: {
    priority: 1,
    requiredFactTypes: [
      "OBJECTIVE_CAPTURE_TEAM",
      "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE",
    ],
    allowedFactTypes: [
      "OBJECTIVE_CAPTURE_TEAM",
      "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE",
    ],
    requiresObjective: true,
    captureTeam: "ALLY",
    betterChoice: "획득 직후 추격보다 생존과 리셋을 먼저 검토하세요.",
    nextGameRule: "오브젝트 획득 후 체력과 생존 인원을 확인한 뒤 다음 행동을 선택하세요.",
  },
};

const DECISION_TEMPLATE_BY_FACT = {
  PLAYER_CONFIRMED_KILL: ["PLAYER_RECORDED_KILL", "대상 플레이어의 킬이 기록됐습니다."],
  PLAYER_CONFIRMED_ASSIST: ["PLAYER_RECORDED_ASSIST", "대상 플레이어의 어시스트가 기록됐습니다."],
  PLAYER_CONFIRMED_DEATH: ["PLAYER_RECORDED_DEATH", "대상 플레이어의 사망이 기록됐습니다."],
  PLAYER_FIRST_RECORDED_INVOLVEMENT: [
    "PLAYER_FIRST_RECORDED_INVOLVEMENT",
    "대상 플레이어의 첫 기록 시점을 확인했습니다.",
  ],
};

const POSITION_TEMPLATE_BY_FACT = {
  PLAYER_DISTANCE_LE_2500: [
    "POSITION_DISTANCE_LE_2500",
    "사용 가능한 과거 프레임에서 교전 중심과의 거리는 2,500 이하였습니다.",
  ],
  PLAYER_DISTANCE_2500_5000: [
    "POSITION_DISTANCE_2500_5000",
    "사용 가능한 과거 프레임에서 교전 중심과의 거리는 2,500 초과 5,000 이하였습니다.",
  ],
  PLAYER_DISTANCE_GT_5000: [
    "POSITION_DISTANCE_GT_5000",
    "사용 가능한 과거 프레임에서 교전 중심과의 거리는 5,000 초과였습니다.",
  ],
  NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT: [
    "NO_NEARBY_LIVING_ALLY_AT_SNAPSHOT",
    "완전한 과거 스냅샷에서 2,500 이내 생존 아군이 기록되지 않았습니다.",
  ],
};

const DECISION_TYPE_ORDER = [
  "PLAYER_CONFIRMED_DEATH",
  "PLAYER_CONFIRMED_KILL",
  "PLAYER_CONFIRMED_ASSIST",
  "PLAYER_FIRST_RECORDED_INVOLVEMENT",
];
const POSITION_TYPE_ORDER = [
  "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT",
  "PLAYER_DISTANCE_GT_5000",
  "PLAYER_DISTANCE_2500_5000",
  "PLAYER_DISTANCE_LE_2500",
];

function teamLabel(value) {
  if (value === "ALLY") return "아군";
  if (value === "ENEMY") return "상대";
  if (value === "SPLIT") return "분할 획득";
  return "팀 미상";
}

function encounterLabel(value) {
  if (value === "PICK") return "PICK";
  if (value === "SKIRMISH") return "소규모 교전";
  if (value === "TEAMFIGHT_CANDIDATE") return "한타 후보";
  return "교전 유형 미상";
}

function structureLabel(value) {
  if (value === "TOWER_BUILDING") return "포탑";
  if (value === "INHIBITOR_BUILDING") return "억제기";
  return "구조물";
}

function fixedFactText(fact) {
  const value = fact.value || {};
  switch (fact.type) {
    case "ENCOUNTER_CLASSIFICATION":
      return `킬 로그 기준 ${encounterLabel(value.type)}입니다.`;
    case "ALLY_DEATH_COUNT":
      return `아군 사망 ${Number(value.count) || 0}명이 기록됐습니다.`;
    case "ENEMY_DEATH_COUNT":
      return `상대 사망 ${Number(value.count) || 0}명이 기록됐습니다.`;
    case "FIRST_TAKEDOWN_TEAM":
      return `첫 사망 기록의 획득 팀은 ${teamLabel(value.team)}입니다.`;
    case "PLAYER_CONFIRMED_KILL":
    case "PLAYER_CONFIRMED_ASSIST":
    case "PLAYER_CONFIRMED_DEATH":
    case "PLAYER_FIRST_RECORDED_INVOLVEMENT":
      return DECISION_TEMPLATE_BY_FACT[fact.type][1];
    case "PLAYER_DISTANCE_LE_2500":
    case "PLAYER_DISTANCE_2500_5000":
    case "PLAYER_DISTANCE_GT_5000":
    case "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT": {
      const text = POSITION_TEMPLATE_BY_FACT[fact.type][1];
      return fact.confidence === "LOW"
        ? `낮은 신뢰도의 과거 프레임에서 ${text}`
        : text;
    }
    case "OBJECTIVE_CAPTURE_TEAM":
      return `획득 팀은 ${teamLabel(value.team)}입니다.`;
    case "OBJECTIVE_CAPTURE_COUNTS":
      return `획득 수는 아군 ${Number(value.ally) || 0}, 상대 ${Number(value.enemy) || 0}, 미상 ${Number(value.unknown) || 0}입니다.`;
    case "PLAYER_OBJECTIVE_KILLER":
      return "대상 플레이어가 오브젝트 처치에 기록됐습니다.";
    case "PLAYER_OBJECTIVE_ASSIST":
      return "대상 플레이어가 오브젝트 어시스트에 기록됐습니다.";
    case "STRUCTURE_CONVERSION":
      return `${teamLabel(value.takerTeam)}의 ${structureLabel(value.buildingType)} 전환이 기록됐습니다.`;
    case "PRE_ENCOUNTER_GOLD_DIFFERENCE": {
      const amount = Number(value.value) || 0;
      const signed = amount > 0 ? `+${amount}` : String(amount);
      return `교전 전 완전한 스냅샷의 아군-상대 골드 차이는 ${signed}입니다.`;
    }
    case "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE":
      return `획득 후 ${Number(value.secondsAfterCapture) || 0}초에 대상 플레이어 사망이 기록됐습니다.`;
    default:
      return null;
  }
}

function factSort(left, right) {
  return left.timestamp - right.timestamp ||
    left.type.localeCompare(right.type) ||
    left.factId.localeCompare(right.factId);
}

function statementForFact(fact) {
  const text = fixedFactText(fact);
  if (!text) return null;
  return {
    factId: fact.factId,
    claimCode: fact.type,
    text,
    evidenceIds: [fact.factId],
    source: "SERVER_FACT_TEMPLATE",
  };
}

function firstMappedFact(facts, mapping, typeOrder) {
  return [...facts]
    .filter((fact) => mapping[fact.type])
    .sort((left, right) =>
      left.timestamp - right.timestamp ||
      typeOrder.indexOf(left.type) - typeOrder.indexOf(right.type) ||
      left.factId.localeCompare(right.factId))[0] || null;
}

function buildFactNarrative(review) {
  const categories = [
    review.situationFacts || [],
    review.decisionFacts || [],
    review.positioningFacts || [],
    review.outcomeFacts || [],
  ];
  const factStatements = categories.flatMap((facts) =>
    [...facts].sort(factSort).map(statementForFact).filter(Boolean));
  const decisionFact = review.effectiveInvolvementLevel === "CONFIRMED"
    ? firstMappedFact(
        (review.decisionFacts || []).filter((fact) => fact.confidence !== "LOW"),
        DECISION_TEMPLATE_BY_FACT,
        DECISION_TYPE_ORDER,
      )
    : null;
  const positionFact = firstMappedFact(
    review.positioningFacts || [],
    POSITION_TEMPLATE_BY_FACT,
    POSITION_TYPE_ORDER,
  );
  const decisionAssessment = decisionFact
    ? {
        claimCode: DECISION_TEMPLATE_BY_FACT[decisionFact.type][0],
        text: DECISION_TEMPLATE_BY_FACT[decisionFact.type][1],
        evidenceIds: [decisionFact.factId],
        source: "SERVER_FACT_TEMPLATE",
      }
    : null;
  let positioningObservation = null;
  if (positionFact) {
    let text = fixedFactText(positionFact);
    if (review.effectiveInvolvementLevel === "APPROXIMATE") {
      text = `근접 추정: ${text}`;
    }
    positioningObservation = {
      claimCode: POSITION_TEMPLATE_BY_FACT[positionFact.type][0],
      text,
      evidenceIds: [positionFact.factId],
      source: "SERVER_FACT_TEMPLATE",
    };
  }
  return {
    factStatements,
    decisionAssessment,
    positioningObservation,
    coaching: null,
  };
}

function reviewFacts(review) {
  return [
    ...(review.situationFacts || []),
    ...(review.decisionFacts || []),
    ...(review.positioningFacts || []),
    ...(review.outcomeFacts || []),
  ];
}

function hasMinimumConfidence(fact, minimum) {
  return CONFIDENCE_RANK[fact.confidence] >= CONFIDENCE_RANK[minimum];
}

function factEligibleForCode(fact, code, config) {
  if (!config.allowedFactTypes.includes(fact.type)) return false;
  if (config.minConfidence && !hasMinimumConfidence(fact, config.minConfidence)) return false;
  if (code === "DECIDE_JOIN_OR_TRADE_EARLY") {
    return fact.type !== "PLAYER_DISTANCE_GT_5000" ||
      fact.value?.stage === "SETUP" || fact.value?.stage === "CONTEST";
  }
  if (code === "REVIEW_OPENING_DEATH") {
    return fact.type !== "PLAYER_CONFIRMED_DEATH" || fact.value?.phase === "OPENING";
  }
  if (code === "RESET_AFTER_CAPTURE") {
    return fact.type !== "OBJECTIVE_CAPTURE_TEAM" || fact.value?.team === "ALLY";
  }
  return true;
}

function recommendationEvidence(review, code, config) {
  const eligibleFacts = reviewFacts(review)
    .filter((fact) => factEligibleForCode(fact, code, config))
    .sort(factSort);
  const required = [];
  for (const type of config.requiredFactTypes) {
    const fact = eligibleFacts.find((row) => row.type === type);
    if (!fact) return null;
    required.push(fact);
  }
  if (required.length === 0 || required.length > 6) return null;
  const chosen = [...required];
  eligibleFacts.forEach((fact) => {
    if (chosen.length >= 6 || chosen.some((row) => row.factId === fact.factId)) return;
    chosen.push(fact);
  });
  return chosen.map((fact) => fact.factId);
}

function eligibleRecommendations(review) {
  return Object.entries(RECOMMENDATIONS)
    .filter(([, config]) => !config.requiresObjective || review.objectiveEngagementId)
    .map(([recommendationCode, config]) => ({
      recommendationCode,
      priority: config.priority,
      evidenceIds: recommendationEvidence(review, recommendationCode, config),
    }))
    .filter((row) => row.evidenceIds)
    .sort((left, right) =>
      left.priority - right.priority ||
      left.recommendationCode.localeCompare(right.recommendationCode))
    .map(({ recommendationCode, evidenceIds }) => ({
      recommendationCode,
      evidenceIds,
    }));
}

function buildRecommendationCandidatePayload(model) {
  return {
    reviews: (model?.personalReviews || []).map((review) => ({
      reviewId: review.reviewId,
      eligibleRecommendations: eligibleRecommendations(review, model),
    })).filter((row) => row.eligibleRecommendations.length > 0),
  };
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index]);
}

function validateRecommendationSelections(envelope, model) {
  const reviews = model?.personalReviews || [];
  const reviewById = new Map(reviews.map((review) => [review.reviewId, review]));
  if (!envelope || !Array.isArray(envelope.reviews) || envelope.reviews.length > 5) {
    return {
      validSelections: [],
      invalidReviewIds: reviews.map((review) => review.reviewId).sort(),
    };
  }
  const counts = new Map();
  envelope.reviews.forEach((row) => {
    if (typeof row?.reviewId === "string") {
      counts.set(row.reviewId, (counts.get(row.reviewId) || 0) + 1);
    }
  });
  const validSelections = [];
  const invalidReviewIds = new Set();
  envelope.reviews.forEach((row) => {
    const review = reviewById.get(row?.reviewId);
    if (!review || counts.get(row.reviewId) !== 1 ||
        !exactKeys(row, ["reviewId", "recommendationCode", "evidenceIds"]) ||
        typeof row.recommendationCode !== "string" ||
        !Array.isArray(row.evidenceIds) ||
        row.evidenceIds.length < 1 || row.evidenceIds.length > 6 ||
        new Set(row.evidenceIds).size !== row.evidenceIds.length ||
        !row.evidenceIds.every((id) => typeof id === "string")) {
      if (typeof row?.reviewId === "string") invalidReviewIds.add(row.reviewId);
      return;
    }
    const candidate = eligibleRecommendations(review, model)
      .find((entry) => entry.recommendationCode === row.recommendationCode);
    const candidateIds = new Set(candidate?.evidenceIds || []);
    if (!candidate || !row.evidenceIds.every((id) => candidateIds.has(id))) {
      invalidReviewIds.add(row.reviewId);
      return;
    }
    const factsById = new Map(reviewFacts(review).map((fact) => [fact.factId, fact]));
    const selectedTypes = new Set(row.evidenceIds.map((id) => factsById.get(id)?.type));
    const config = RECOMMENDATIONS[row.recommendationCode];
    if (!config.requiredFactTypes.every((type) => selectedTypes.has(type))) {
      invalidReviewIds.add(row.reviewId);
      return;
    }
    validSelections.push({
      reviewId: row.reviewId,
      recommendationCode: row.recommendationCode,
      evidenceIds: [...row.evidenceIds],
    });
  });
  for (const [reviewId, count] of counts) {
    if (count > 1) invalidReviewIds.add(reviewId);
  }
  return {
    validSelections: validSelections
      .filter((row) => !invalidReviewIds.has(row.reviewId))
      .sort((left, right) => left.reviewId.localeCompare(right.reviewId)),
    invalidReviewIds: [...invalidReviewIds].sort(),
  };
}

function coachingFromSelection(selection, selectionSource) {
  const config = RECOMMENDATIONS[selection.recommendationCode];
  return {
    recommendationCode: selection.recommendationCode,
    betterChoice: config.betterChoice,
    nextGameRule: config.nextGameRule,
    evidenceIds: [...selection.evidenceIds],
    selectionSource,
  };
}

function applyRecommendationSelections(model, envelope) {
  const output = structuredClone(model);
  const envelopeMissing = envelope === null || envelope === undefined;
  const validation = envelopeMissing
    ? { validSelections: [], invalidReviewIds: [] }
    : validateRecommendationSelections(envelope, output);
  const validByReview = new Map(
    validation.validSelections.map((selection) => [selection.reviewId, selection]),
  );
  const invalidIds = new Set(validation.invalidReviewIds);
  output.personalReviews = (output.personalReviews || []).map((review) => {
    const narrative = buildFactNarrative(review);
    const selected = validByReview.get(review.reviewId);
    if (selected) {
      narrative.coaching = coachingFromSelection(selected, "AI_SELECTED");
    } else {
      const fallback = eligibleRecommendations(review, output)[0] || null;
      narrative.coaching = fallback
        ? coachingFromSelection(fallback, "RULE_FALLBACK")
        : null;
    }
    return { ...review, narrative };
  });
  if (invalidIds.size > 0) {
    output.coverage.limitationCodes = [...new Set([
      ...(output.coverage.limitationCodes || []),
      "INVALID_AI_SELECTION",
    ])].sort();
  }
  return output;
}

function createLegacyTeamplayEnvelope() {
  return {
    schemaVersion: "2.0",
    coverage: createCoverageEnvelope({
      level: "PLAYER_ONLY",
      source: "LEGACY_ADAPTER",
    }),
    encounters: [],
    objectiveEngagements: [],
    scenes: [],
    personalReviews: [],
    teamAppendix: [],
  };
}

function createUnavailableTeamplayEnvelope() {
  return {
    schemaVersion: "2.0",
    coverage: createCoverageEnvelope({ level: "UNAVAILABLE", source: "NONE" }),
    encounters: [],
    objectiveEngagements: [],
    scenes: [],
    personalReviews: [],
    teamAppendix: [],
  };
}

function validSourceRef(ref) {
  return Boolean(
    ref &&
    (ref.kind === "TIMELINE_EVENT" || ref.kind === "PARTICIPANT_FRAME") &&
    typeof ref.id === "string" && ref.id.length > 0 &&
    Number.isFinite(ref.timestamp) &&
    (ref.kind !== "PARTICIPANT_FRAME" || Number.isInteger(ref.participantId)),
  );
}

function validLimitations(value) {
  return Array.isArray(value) && value.every((code) => LIMITATION_CODES.has(code));
}

function validTimedDomain(row, idKey) {
  return Boolean(
    row && typeof row[idKey] === "string" && row[idKey].length > 0 &&
    Number.isFinite(row.startTimestamp) && Number.isFinite(row.endTimestamp) &&
    row.endTimestamp >= row.startTimestamp,
  );
}

function validEvidenceDomain(row, idKey) {
  return validTimedDomain(row, idKey) &&
    CONFIDENCES.has(row.confidence) &&
    validLimitations(row.limitationCodes) &&
    Array.isArray(row.sourceRefs) && row.sourceRefs.length > 0 &&
    row.sourceRefs.every(validSourceRef);
}

function removeDuplicateIds(rows, idKey, validator) {
  const counts = new Map();
  rows.forEach((row) => {
    const id = row?.[idKey];
    if (typeof id === "string") counts.set(id, (counts.get(id) || 0) + 1);
  });
  return rows.filter((row) =>
    counts.get(row?.[idKey]) === 1 && validator(row));
}

function validFact(fact) {
  return Boolean(
    fact && typeof fact.factId === "string" && fact.factId.length > 0 &&
    FACT_TYPES.has(fact.type) && Number.isFinite(fact.timestamp) &&
    CONFIDENCES.has(fact.confidence) &&
    Array.isArray(fact.sourceRefs) && fact.sourceRefs.length > 0 &&
    fact.sourceRefs.every(validSourceRef) &&
    validLimitations(fact.limitationCodes),
  );
}

function sanitizeCoaching(review) {
  const coaching = review.narrative?.coaching;
  if (!coaching) return { review, invalid: false };
  const config = RECOMMENDATIONS[coaching.recommendationCode];
  const factIds = new Set(reviewFacts(review).map((fact) => fact.factId));
  const valid = config &&
    (coaching.selectionSource === "AI_SELECTED" || coaching.selectionSource === "RULE_FALLBACK") &&
    coaching.betterChoice === config.betterChoice &&
    coaching.nextGameRule === config.nextGameRule &&
    Array.isArray(coaching.evidenceIds) && coaching.evidenceIds.length >= 1 &&
    coaching.evidenceIds.length <= 6 &&
    new Set(coaching.evidenceIds).size === coaching.evidenceIds.length &&
    coaching.evidenceIds.every((id) => factIds.has(id));
  if (valid) return { review, invalid: false };
  return {
    review: {
      ...review,
      narrative: { ...review.narrative, coaching: null },
    },
    invalid: true,
  };
}

function sanitizeTeamplayAnalysisV2(value) {
  if (!validateTeamplayRoot(value)) return { rootValid: false, data: null };
  const data = structuredClone(value);
  let invalidItem = false;
  let invalidAi = false;

  let encounters = removeDuplicateIds(
    data.encounters,
    "id",
    (row) => validEvidenceDomain(row, "id") &&
      Array.isArray(row.linkedObjectiveEngagementIds),
  );
  let objectives = removeDuplicateIds(
    data.objectiveEngagements,
    "id",
    (row) => validEvidenceDomain(row, "id") && Array.isArray(row.linkedEncounterIds),
  );
  if (encounters.length !== data.encounters.length ||
      objectives.length !== data.objectiveEngagements.length) invalidItem = true;

  let changed = true;
  while (changed) {
    const encounterIds = new Set(encounters.map((row) => row.id));
    const objectiveIds = new Set(objectives.map((row) => row.id));
    const nextEncounters = encounters.filter((row) =>
      row.linkedObjectiveEngagementIds.every((id) => objectiveIds.has(id)));
    const nextObjectives = objectives.filter((row) =>
      row.linkedEncounterIds.every((id) => encounterIds.has(id)));
    changed = nextEncounters.length !== encounters.length ||
      nextObjectives.length !== objectives.length;
    if (changed) invalidItem = true;
    encounters = nextEncounters;
    objectives = nextObjectives;
  }

  const encounterIds = new Set(encounters.map((row) => row.id));
  const objectiveIds = new Set(objectives.map((row) => row.id));
  const scenes = removeDuplicateIds(
    data.scenes,
    "sceneId",
    (scene) => validTimedDomain(scene, "sceneId") &&
      Array.isArray(scene.encounterIds) &&
      scene.encounterIds.every((id) => encounterIds.has(id)) &&
      (scene.objectiveEngagementId === null || objectiveIds.has(scene.objectiveEngagementId)),
  );
  if (scenes.length !== data.scenes.length) invalidItem = true;
  const sceneIds = new Set(scenes.map((scene) => scene.sceneId));

  let reviews = removeDuplicateIds(
    data.personalReviews,
    "reviewId",
    (review) => {
      const factArrays = [
        review?.situationFacts,
        review?.decisionFacts,
        review?.positioningFacts,
        review?.outcomeFacts,
      ];
      if (!validEvidenceDomain(review, "reviewId") ||
          !sceneIds.has(review.sceneId) ||
          !Array.isArray(review.encounterIds) ||
          !review.encounterIds.every((id) => encounterIds.has(id)) ||
          !(review.objectiveEngagementId === null ||
            objectiveIds.has(review.objectiveEngagementId)) ||
          !factArrays.every(Array.isArray) ||
          !factArrays.flat().every(validFact) ||
          !Array.isArray(review.evidenceIds)) return false;
      const factIds = new Set(factArrays.flat().map((fact) => fact.factId));
      return review.evidenceIds.every((id) => factIds.has(id));
    },
  );
  if (reviews.length !== data.personalReviews.length) invalidItem = true;
  reviews = reviews.map((review) => {
    const sanitized = sanitizeCoaching(review);
    if (sanitized.invalid) invalidAi = true;
    return sanitized.review;
  });
  const reviewIds = new Set(reviews.map((review) => review.reviewId));

  const appendices = removeDuplicateIds(
    data.teamAppendix,
    "teamAppendixId",
    (row) => Boolean(row && reviewIds.has(row.reviewId)),
  );
  if (appendices.length !== data.teamAppendix.length) invalidItem = true;

  const limitationCodes = [...new Set([
    ...data.coverage.limitationCodes,
    ...(invalidItem ? ["INVALID_V2_ITEM"] : []),
    ...(invalidAi ? ["INVALID_AI_SELECTION"] : []),
  ])].sort();
  return {
    rootValid: true,
    data: {
      ...data,
      coverage: { ...data.coverage, limitationCodes },
      encounters: encounters.sort((left, right) =>
        left.startTimestamp - right.startTimestamp || left.id.localeCompare(right.id)),
      objectiveEngagements: objectives.sort((left, right) =>
        left.startTimestamp - right.startTimestamp || left.id.localeCompare(right.id)),
      scenes: scenes.sort((left, right) =>
        left.startTimestamp - right.startTimestamp ||
        left.sceneId.localeCompare(right.sceneId)),
      personalReviews: reviews.sort((left, right) =>
        right.importanceScore - left.importanceScore ||
        left.startTimestamp - right.startTimestamp ||
        left.reviewId.localeCompare(right.reviewId)),
      teamAppendix: appendices.sort((left, right) =>
        left.reviewId.localeCompare(right.reviewId)),
    },
  };
}

module.exports = {
  buildFactNarrative,
  eligibleRecommendations,
  buildRecommendationCandidatePayload,
  validateRecommendationSelections,
  applyRecommendationSelections,
  createLegacyTeamplayEnvelope,
  createUnavailableTeamplayEnvelope,
  sanitizeTeamplayAnalysisV2,
};
