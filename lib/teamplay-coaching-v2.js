const {
  LIMITATION_CODES,
  canonicalJson,
  createCoverageEnvelope,
  makeFactId,
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
const SITUATION_FACT_TYPES = new Set([
  "ENCOUNTER_CLASSIFICATION",
  "ALLY_DEATH_COUNT",
  "ENEMY_DEATH_COUNT",
  "FIRST_TAKEDOWN_TEAM",
  "OBJECTIVE_CAPTURE_TEAM",
  "OBJECTIVE_CAPTURE_COUNTS",
]);
const DECISION_FACT_TYPES = new Set([
  "PLAYER_CONFIRMED_KILL",
  "PLAYER_CONFIRMED_ASSIST",
  "PLAYER_CONFIRMED_DEATH",
  "PLAYER_FIRST_RECORDED_INVOLVEMENT",
  "PLAYER_OBJECTIVE_KILLER",
  "PLAYER_OBJECTIVE_ASSIST",
]);
const POSITIONING_FACT_TYPES = new Set([
  "PLAYER_DISTANCE_LE_2500",
  "PLAYER_DISTANCE_2500_5000",
  "PLAYER_DISTANCE_GT_5000",
  "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT",
]);
const OUTCOME_FACT_TYPES = new Set([
  "STRUCTURE_CONVERSION",
  "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE",
]);
const TEAM_APPENDIX_FACT_TYPES = new Set([
  "ALLY_DEATH_COUNT",
  "ENEMY_DEATH_COUNT",
  "FIRST_TAKEDOWN_TEAM",
  "OBJECTIVE_CAPTURE_TEAM",
  "OBJECTIVE_CAPTURE_COUNTS",
  "STRUCTURE_CONVERSION",
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
    exactKeys(ref, ["id", "kind", "participantId", "timestamp"]) &&
    (ref.kind === "TIMELINE_EVENT" || ref.kind === "PARTICIPANT_FRAME") &&
    typeof ref.id === "string" && ref.id.length > 0 &&
    validNonNegativeInteger(ref.timestamp) &&
    (ref.kind === "PARTICIPANT_FRAME"
      ? validParticipantId(ref.participantId)
      : ref.participantId === null),
  );
}

const PRIVATE_IDENTIFIER_KEYS = new Set([
  "accountid",
  "gamename",
  "puuid",
  "riotid",
  "riotidgamename",
  "riotidtagline",
  "summonerid",
  "tagline",
]);

function hasUnsafePublicShape(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (!Array.isArray(value)) {
    if (Object.keys(value).some((key) =>
      PRIVATE_IDENTIFIER_KEYS.has(key.toLowerCase()))) return true;
    const resemblesSourceRef = ["id", "kind", "timestamp"]
      .every((key) => Object.hasOwn(value, key));
    if (resemblesSourceRef && !validSourceRef(value)) return true;
  }
  return Object.values(value).some((entry) =>
    hasUnsafePublicShape(entry, seen));
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
    !hasUnsafePublicShape(row) &&
    CONFIDENCES.has(row.confidence) &&
    validLimitations(row.limitationCodes) &&
    Array.isArray(row.sourceRefs) && row.sourceRefs.length > 0 &&
    row.sourceRefs.every(validSourceRef);
}

function validNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validParticipantId(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}

function validTeam(value, allowSplit = false) {
  return value === "ALLY" || value === "ENEMY" || value === "UNKNOWN" ||
    (allowSplit && value === "SPLIT");
}

function validOptionalText(value) {
  return value === null || (typeof value === "string" && value.length > 0);
}

function confidenceForFrameAge(frameAgeMs) {
  if (frameAgeMs <= 5000) return "HIGH";
  if (frameAgeMs <= 15000) return "MEDIUM";
  return "LOW";
}

function validPositionFrameAge(fact, value) {
  const frameAgeMs = fact.timestamp - value.frameTimestamp;
  return validNonNegativeInteger(value.frameAgeSeconds) &&
    value.frameAgeSeconds <= 30 &&
    Number.isFinite(value.frameTimestamp) &&
    value.frameTimestamp <= fact.timestamp &&
    frameAgeMs <= 30000 &&
    value.frameAgeSeconds === Math.round(
      frameAgeMs / 1000,
    ) &&
    fact.confidence === confidenceForFrameAge(frameAgeMs);
}

function distanceMatchesFactType(type, distance) {
  if (!Number.isInteger(distance) || distance < 0) return false;
  if (type === "PLAYER_DISTANCE_LE_2500") return distance <= 2500;
  if (type === "PLAYER_DISTANCE_2500_5000") {
    return distance > 2500 && distance <= 5000;
  }
  return type === "PLAYER_DISTANCE_GT_5000" && distance > 5000;
}

function validFactValue(fact) {
  const value = fact?.value;
  switch (fact?.type) {
    case "ENCOUNTER_CLASSIFICATION":
      return exactKeys(value, ["encounterId", "type"]) &&
        typeof value.encounterId === "string" && value.encounterId.length > 0 &&
        ["PICK", "SKIRMISH", "TEAMFIGHT_CANDIDATE"].includes(value.type);
    case "ALLY_DEATH_COUNT":
    case "ENEMY_DEATH_COUNT":
      return exactKeys(value, ["count"]) && validNonNegativeInteger(value.count);
    case "FIRST_TAKEDOWN_TEAM":
      return exactKeys(value, ["team"]) && validTeam(value.team, false);
    case "OBJECTIVE_CAPTURE_TEAM":
      return exactKeys(value, ["team"]) && validTeam(value.team, true);
    case "OBJECTIVE_CAPTURE_COUNTS":
      return exactKeys(value, ["ally", "enemy", "unknown"]) &&
        validNonNegativeInteger(value.ally) &&
        validNonNegativeInteger(value.enemy) &&
        validNonNegativeInteger(value.unknown);
    case "PLAYER_CONFIRMED_KILL":
    case "PLAYER_CONFIRMED_ASSIST":
    case "PLAYER_CONFIRMED_DEATH":
      return exactKeys(value, ["eventTimestamp", "participantId", "phase"]) &&
        validParticipantId(value.participantId) &&
        ["OPENING", "EXCHANGE", "LATE_SEQUENCE"].includes(value.phase) &&
        value.eventTimestamp === fact.timestamp;
    case "PLAYER_FIRST_RECORDED_INVOLVEMENT":
      return exactKeys(value, ["basis", "eventTimestamp", "participantId"]) &&
        validParticipantId(value.participantId) &&
        ["KILLER", "VICTIM", "ASSIST"].includes(value.basis) &&
        value.eventTimestamp === fact.timestamp;
    case "PLAYER_OBJECTIVE_KILLER":
    case "PLAYER_OBJECTIVE_ASSIST":
      return exactKeys(value, ["eventTimestamp", "participantId", "stage"]) &&
        validParticipantId(value.participantId) && value.stage === "CONTEST" &&
        value.eventTimestamp === fact.timestamp;
    case "PLAYER_DISTANCE_LE_2500":
    case "PLAYER_DISTANCE_2500_5000":
    case "PLAYER_DISTANCE_GT_5000":
      return exactKeys(value, ["distance", "frameAgeSeconds", "frameTimestamp", "stage"]) &&
        distanceMatchesFactType(fact.type, value.distance) &&
        validPositionFrameAge(fact, value) &&
        ["SETUP", "CONTEST", "ENCOUNTER"].includes(value.stage);
    case "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT":
      return exactKeys(value, ["frameAgeSeconds", "frameTimestamp", "radius"]) &&
        validPositionFrameAge(fact, value) &&
        value.radius === 2500;
    case "STRUCTURE_CONVERSION":
      return exactKeys(value, ["buildingType", "laneType", "takerTeam", "towerType"]) &&
        validTeam(value.takerTeam, false) &&
        typeof value.buildingType === "string" && value.buildingType.length > 0 &&
        validOptionalText(value.laneType) && validOptionalText(value.towerType);
    case "PRE_ENCOUNTER_GOLD_DIFFERENCE":
      return exactKeys(value, [
        "allyGold",
        "enemyGold",
        "frameAgeSeconds",
        "snapshotTimestamp",
        "value",
      ]) &&
        validNonNegativeInteger(value.allyGold) &&
        validNonNegativeInteger(value.enemyGold) &&
        validNonNegativeInteger(value.frameAgeSeconds) &&
        value.frameAgeSeconds <= 60 &&
        value.snapshotTimestamp === fact.timestamp &&
        value.value === value.allyGold - value.enemyGold &&
        fact.confidence === (value.frameAgeSeconds <= 30 ? "MEDIUM" : "LOW");
    case "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE":
      return exactKeys(value, ["eventTimestamp", "secondsAfterCapture"]) &&
        value.eventTimestamp === fact.timestamp &&
        validNonNegativeInteger(value.secondsAfterCapture) &&
        value.secondsAfterCapture < 120;
    default:
      return false;
  }
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

function validFact(fact, reviewId) {
  return Boolean(
    exactKeys(fact, [
      "confidence",
      "factId",
      "limitationCodes",
      "sourceRefs",
      "timestamp",
      "type",
      "value",
    ]) && typeof fact.factId === "string" && fact.factId.length > 0 &&
    FACT_TYPES.has(fact.type) && Number.isFinite(fact.timestamp) &&
    CONFIDENCES.has(fact.confidence) &&
    Array.isArray(fact.sourceRefs) && fact.sourceRefs.length > 0 &&
    fact.sourceRefs.every(validSourceRef) &&
    new Set(fact.sourceRefs.map((ref) => ref.id)).size === fact.sourceRefs.length &&
    validLimitations(fact.limitationCodes) && validFactValue(fact) &&
    validFactSourceShape(fact) &&
    fact.factId === makeFactId(reviewId, fact),
  );
}

function validFactSourceShape(fact) {
  const refs = fact.sourceRefs || [];
  if (POSITIONING_FACT_TYPES.has(fact.type) &&
      fact.type !== "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT") {
    const frames = refs.filter((ref) => ref.kind === "PARTICIPANT_FRAME");
    const events = refs.filter((ref) => ref.kind === "TIMELINE_EVENT");
    return refs.length === 2 && frames.length === 1 && events.length === 1 &&
      frames[0].timestamp === fact.value.frameTimestamp &&
      events[0].timestamp === fact.timestamp;
  }
  if (fact.type === "NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT") {
    return refs.length === 5 &&
      refs.every((ref) =>
        ref.kind === "PARTICIPANT_FRAME" &&
        ref.timestamp === fact.value.frameTimestamp) &&
      new Set(refs.map((ref) => ref.participantId)).size === 5;
  }
  if (fact.type === "PRE_ENCOUNTER_GOLD_DIFFERENCE") {
    return refs.length === 10 &&
      refs.every((ref) => ref.kind === "PARTICIPANT_FRAME") &&
      new Set(refs.map((ref) => ref.participantId)).size === 10 &&
      refs.every((ref) => ref.timestamp === fact.timestamp);
  }
  if (fact.type === "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE") {
    return refs.length === 1 && refs[0].kind === "TIMELINE_EVENT" &&
      refs[0].timestamp === fact.timestamp;
  }
  return true;
}

function sameCanonicalValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function sanitizePublicParticipants(value) {
  if (!Array.isArray(value)) {
    return { rows: [], invalid: true, fatal: false };
  }
  let invalid = false;
  const validRows = value.filter((row) => {
    const valid = exactKeys(row, ["champion", "participantId", "role"]) &&
      validParticipantId(row.participantId) &&
      typeof row.champion === "string" && row.champion.length > 0 &&
      row.champion.length <= 64 &&
      typeof row.role === "string" && row.role.length > 0 &&
      row.role.length <= 64;
    if (!valid) invalid = true;
    return valid;
  });
  const counts = new Map();
  validRows.forEach((row) => {
    counts.set(row.participantId, (counts.get(row.participantId) || 0) + 1);
  });
  if (validRows.length > 5 || [...counts.values()].some((count) => count > 1)) {
    return { rows: [], invalid: true, fatal: true };
  }
  const rows = validRows
    .map((row) => ({
      participantId: row.participantId,
      champion: row.champion,
      role: row.role,
    }))
    .sort((left, right) => left.participantId - right.participantId);
  if (!sameCanonicalValue(value, rows)) invalid = true;
  return { rows, invalid, fatal: false };
}

function validAppendixGoldFact(fact, review) {
  if (!validFact(fact, review.reviewId) ||
      fact.type !== "PRE_ENCOUNTER_GOLD_DIFFERENCE" ||
      !validFactSourceShape(fact) ||
      !Number.isFinite(review.startTimestamp) ||
      fact.timestamp > review.startTimestamp ||
      !fact.sourceRefs.every((ref) => ref.timestamp <= review.startTimestamp)) {
    return false;
  }
  return fact.value.frameAgeSeconds === Math.round(
    (review.startTimestamp - fact.timestamp) / 1000,
  );
}

function appendixFactRows(review, type, category = "situationFacts") {
  return (review[category] || []).filter((fact) => fact.type === type);
}

function validReviewFactCardinality(review) {
  const deathCounts = [
    "ALLY_DEATH_COUNT",
    "ENEMY_DEATH_COUNT",
    "FIRST_TAKEDOWN_TEAM",
  ].map((type) => appendixFactRows(review, type).length);
  const captureCounts = [
    "OBJECTIVE_CAPTURE_TEAM",
    "OBJECTIVE_CAPTURE_COUNTS",
  ].map((type) => appendixFactRows(review, type).length);
  return deathCounts.every((count) => count <= 1) &&
    (deathCounts.reduce((sum, count) => sum + count, 0) === 0 ||
      deathCounts.every((count) => count === 1)) &&
    captureCounts.every((count) => count <= 1) &&
    captureCounts.reduce((sum, count) => sum + count, 0) ===
      (review.objectiveEngagementId === null ? 0 : 2);
}

function regenerateTeamAppendix(
  row,
  review,
  preserveAppendixParticipants = false,
) {
  const expectedKeys = [
    "allyDeaths",
    "allyDirectParticipants",
    "captureTeam",
    "enemyDeaths",
    "enemyDirectParticipants",
    "factIds",
    "firstTakedownTeam",
    "limitationCodes",
    "preEncounterGoldDifference",
    "reviewId",
    "structureConversions",
    "teamAppendixId",
  ];
  if (!row || typeof row !== "object" || Array.isArray(row) ||
      row.reviewId !== review.reviewId ||
      row.teamAppendixId !== review.teamAppendixId) {
    return { data: null, invalid: true };
  }
  let invalid = !exactKeys(row, expectedKeys);
  const ally = sanitizePublicParticipants(row.allyDirectParticipants);
  const enemy = sanitizePublicParticipants(row.enemyDirectParticipants);
  invalid = invalid || ally.invalid || enemy.invalid;
  if (ally.fatal || enemy.fatal) return { data: null, invalid: true };
  const allyIds = new Set(ally.rows.map((entry) => entry.participantId));
  if (enemy.rows.some((entry) => allyIds.has(entry.participantId))) {
    return { data: null, invalid: true };
  }
  if (!preserveAppendixParticipants &&
      (ally.rows.length > 0 || enemy.rows.length > 0)) {
    invalid = true;
  }

  const singularTypes = [
    "ALLY_DEATH_COUNT",
    "ENEMY_DEATH_COUNT",
    "FIRST_TAKEDOWN_TEAM",
    "OBJECTIVE_CAPTURE_TEAM",
    "OBJECTIVE_CAPTURE_COUNTS",
  ];
  const singular = new Map();
  for (const type of singularTypes) {
    const rows = appendixFactRows(review, type);
    if (rows.length > 1) return { data: null, invalid: true };
    singular.set(type, rows[0] || null);
  }
  const deathFactCount = [
    singular.get("ALLY_DEATH_COUNT"),
    singular.get("ENEMY_DEATH_COUNT"),
    singular.get("FIRST_TAKEDOWN_TEAM"),
  ].filter(Boolean).length;
  if (deathFactCount !== 0 && deathFactCount !== 3) {
    return { data: null, invalid: true };
  }
  const captureFactCount = [
    singular.get("OBJECTIVE_CAPTURE_TEAM"),
    singular.get("OBJECTIVE_CAPTURE_COUNTS"),
  ].filter(Boolean).length;
  if (captureFactCount !== (review.objectiveEngagementId === null ? 0 : 2)) {
    return { data: null, invalid: true };
  }

  let gold = null;
  if (row.preEncounterGoldDifference !== null) {
    if (validAppendixGoldFact(row.preEncounterGoldDifference, review)) {
      gold = structuredClone(row.preEncounterGoldDifference);
    } else {
      invalid = true;
    }
  }

  const structureFacts = (review.outcomeFacts || [])
    .filter((fact) => fact.type === "STRUCTURE_CONVERSION")
    .sort(factSort);
  const structureConversions = structureFacts.map((fact) => ({
    timestamp: fact.timestamp,
    takerRelation: fact.value.takerTeam,
    buildingType: fact.value.buildingType,
    towerType: fact.value.towerType,
    laneType: fact.value.laneType,
    factId: fact.factId,
  }));
  const teamFacts = [
    ...(review.situationFacts || []),
    ...(review.outcomeFacts || []),
  ].filter((fact) => TEAM_APPENDIX_FACT_TYPES.has(fact.type));
  const limitationCodes = validLimitations(row.limitationCodes)
    ? sortedUnique(row.limitationCodes)
    : [];
  if (!sameCanonicalValue(row.limitationCodes, limitationCodes)) invalid = true;
  const data = {
    teamAppendixId: review.teamAppendixId,
    reviewId: review.reviewId,
    allyDirectParticipants: preserveAppendixParticipants ? ally.rows : [],
    enemyDirectParticipants: preserveAppendixParticipants ? enemy.rows : [],
    firstTakedownTeam: singular.get("FIRST_TAKEDOWN_TEAM")?.value.team || "UNKNOWN",
    allyDeaths: singular.get("ALLY_DEATH_COUNT")?.value.count || 0,
    enemyDeaths: singular.get("ENEMY_DEATH_COUNT")?.value.count || 0,
    preEncounterGoldDifference: gold,
    captureTeam: singular.get("OBJECTIVE_CAPTURE_TEAM")?.value.team ?? null,
    structureConversions,
    factIds: sortedUnique([
      ...teamFacts.map((fact) => fact.factId),
      ...(gold ? [gold.factId] : []),
    ]),
    limitationCodes,
  };
  for (const key of expectedKeys) {
    if (!sameCanonicalValue(row[key], data[key])) invalid = true;
  }
  return { data, invalid };
}

function fallbackTeamAppendix(review) {
  return regenerateTeamAppendix({
    teamAppendixId: review.teamAppendixId,
    reviewId: review.reviewId,
    allyDirectParticipants: [],
    enemyDirectParticipants: [],
    firstTakedownTeam: "UNKNOWN",
    allyDeaths: 0,
    enemyDeaths: 0,
    preEncounterGoldDifference: null,
    captureTeam: null,
    structureConversions: [],
    factIds: [],
    limitationCodes: validLimitations(review.limitationCodes)
      ? sortedUnique(review.limitationCodes)
      : [],
  }, review).data;
}

function validCaptureCounts(value) {
  return exactKeys(value, ["ally", "enemy", "unknown"]) &&
    validNonNegativeInteger(value.ally) &&
    validNonNegativeInteger(value.enemy) &&
    validNonNegativeInteger(value.unknown);
}

function validPublicParticipantRows(rows, maxLength) {
  return Array.isArray(rows) && rows.length <= maxLength &&
    rows.every((row) =>
      exactKeys(row, ["champion", "participantId", "role"]) &&
      validParticipantId(row.participantId) &&
      typeof row.champion === "string" && row.champion.length > 0 &&
      row.champion.length <= 64 &&
      typeof row.role === "string" && row.role.length > 0 &&
      row.role.length <= 64) &&
    new Set(rows.map((row) => row.participantId)).size === rows.length;
}

function validEncounterParticipants(value) {
  if (!exactKeys(value, ["ally", "enemy", "unknown"]) ||
      !validPublicParticipantRows(value.ally, 5) ||
      !validPublicParticipantRows(value.enemy, 5) ||
      !validPublicParticipantRows(value.unknown, 10)) return false;
  const ids = [...value.ally, ...value.enemy, ...value.unknown]
    .map((row) => row.participantId);
  return new Set(ids).size === ids.length;
}

function validEncounterDomain(row) {
  return validEvidenceDomain(row, "id") &&
    ["PICK", "SKIRMISH", "TEAMFIGHT_CANDIDATE"].includes(row.type) &&
    validNonNegativeInteger(row.allyDeaths) &&
    validNonNegativeInteger(row.enemyDeaths) &&
    validTeam(row.firstTakedownTeam, false) &&
    validEncounterParticipants(row.participants) &&
    Array.isArray(row.linkedObjectiveEngagementIds);
}

function validStructureConversionDomain(row) {
  return Boolean(
    row && Number.isFinite(row.timestamp) &&
    validSourceRef(row.sourceRef) && row.sourceRef.timestamp === row.timestamp &&
    validTeam(row.takerRelation, false) &&
    typeof row.buildingType === "string" && row.buildingType.length > 0 &&
    validOptionalText(row.towerType) && validOptionalText(row.laneType),
  );
}

function validObjectiveDomain(row) {
  return validEvidenceDomain(row, "id") &&
    typeof row.objectiveType === "string" && row.objectiveType.length > 0 &&
    Number.isFinite(row.captureEndTimestamp) &&
    validTeam(row.captureTeam, true) &&
    validCaptureCounts(row.captureCounts) &&
    Array.isArray(row.linkedEncounterIds) &&
    Array.isArray(row.structureConversions) &&
    row.structureConversions.every(validStructureConversionDomain);
}

function validSceneDomain(row) {
  return validTimedDomain(row, "sceneId") &&
    !hasUnsafePublicShape(row) &&
    Array.isArray(row.sourceRefs) && row.sourceRefs.every(validSourceRef) &&
    validNonNegativeInteger(row.allyDeaths) &&
    validNonNegativeInteger(row.enemyDeaths) &&
    validTeam(row.firstTakedownTeam, false) &&
    Array.isArray(row.encounterIds);
}

function sourceRefIds(value) {
  return (Array.isArray(value) ? value : []).map((ref) => ref.id).sort();
}

function validReviewDomainConsistency(
  review,
  sceneById,
  encounterById,
  objectiveById,
) {
  const scene = sceneById.get(review.sceneId);
  if (!scene) return false;
  const classifications = appendixFactRows(review, "ENCOUNTER_CLASSIFICATION");
  if (classifications.length !== review.encounterIds.length) return false;
  for (const encounterId of review.encounterIds) {
    const encounter = encounterById.get(encounterId);
    const facts = classifications.filter((fact) =>
      fact.value.encounterId === encounterId);
    if (!encounter || facts.length !== 1 ||
        facts[0].value.type !== encounter.type ||
        facts[0].timestamp !== encounter.startTimestamp ||
        !sameCanonicalValue(
          sourceRefIds(facts[0].sourceRefs),
          sourceRefIds(encounter.sourceRefs),
        )) return false;
  }

  const allyDeaths = appendixFactRows(review, "ALLY_DEATH_COUNT")[0] || null;
  const enemyDeaths = appendixFactRows(review, "ENEMY_DEATH_COUNT")[0] || null;
  const firstTakedown = appendixFactRows(review, "FIRST_TAKEDOWN_TEAM")[0] || null;
  if (allyDeaths && allyDeaths.value.count !== scene.allyDeaths) return false;
  if (enemyDeaths && enemyDeaths.value.count !== scene.enemyDeaths) return false;
  if (firstTakedown && firstTakedown.value.team !== scene.firstTakedownTeam) {
    return false;
  }
  if (!allyDeaths && (scene.allyDeaths !== 0 || scene.enemyDeaths !== 0)) return false;

  const captureTeam = appendixFactRows(review, "OBJECTIVE_CAPTURE_TEAM")[0] || null;
  const captureCounts = appendixFactRows(review, "OBJECTIVE_CAPTURE_COUNTS")[0] || null;
  const structureFacts = appendixFactRows(review, "STRUCTURE_CONVERSION", "outcomeFacts")
    .sort(factSort);
  const postCaptureDeaths = appendixFactRows(
    review,
    "PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE",
    "outcomeFacts",
  );
  if (postCaptureDeaths.length > 1) return false;
  if (review.objectiveEngagementId === null) {
    return !captureTeam && !captureCounts && structureFacts.length === 0 &&
      postCaptureDeaths.length === 0;
  }
  const objective = objectiveById.get(review.objectiveEngagementId);
  if (!objective || !captureTeam || !captureCounts ||
      captureTeam.value.team !== objective.captureTeam ||
      !sameCanonicalValue(captureCounts.value, objective.captureCounts) ||
      captureTeam.timestamp !== objective.captureEndTimestamp ||
      captureCounts.timestamp !== objective.captureEndTimestamp ||
      !sameCanonicalValue(
        sourceRefIds(captureTeam.sourceRefs),
        sourceRefIds(objective.sourceRefs),
      ) ||
      !sameCanonicalValue(
        sourceRefIds(captureCounts.sourceRefs),
        sourceRefIds(objective.sourceRefs),
      ) || structureFacts.length !== objective.structureConversions.length) {
    return false;
  }
  if (postCaptureDeaths.length === 1) {
    const postDeath = postCaptureDeaths[0];
    const elapsedMs = postDeath.timestamp - objective.captureEndTimestamp;
    if (elapsedMs < 0 || elapsedMs >= 120000 ||
        postDeath.value.secondsAfterCapture !== Math.floor(elapsedMs / 1000)) {
      return false;
    }
  }
  const expectedStructures = objective.structureConversions
    .map((row) => ({
      timestamp: row.timestamp,
      takerTeam: row.takerRelation,
      buildingType: row.buildingType,
      towerType: row.towerType,
      laneType: row.laneType,
      sourceRefId: row.sourceRef.id,
    }))
    .sort((left, right) =>
      left.timestamp - right.timestamp ||
      left.sourceRefId.localeCompare(right.sourceRefId));
  const actualStructures = structureFacts.map((fact) => ({
    timestamp: fact.timestamp,
    takerTeam: fact.value.takerTeam,
    buildingType: fact.value.buildingType,
    towerType: fact.value.towerType,
    laneType: fact.value.laneType,
    sourceRefId: fact.sourceRefs[0]?.id || "",
  })).sort((left, right) =>
    left.timestamp - right.timestamp ||
    left.sourceRefId.localeCompare(right.sourceRefId));
  return sameCanonicalValue(actualStructures, expectedStructures);
}

function sanitizeTeamplayAnalysisV2(value, options = {}) {
  if (!validateTeamplayRoot(value)) return { rootValid: false, data: null };
  const data = structuredClone(value);
  const preserveAppendixParticipants =
    options.preserveAppendixParticipants === true;
  let invalidItem = hasUnsafePublicShape(data);

  let encounters = removeDuplicateIds(
    data.encounters,
    "id",
    (row) => validEncounterDomain(row),
  );
  let objectives = removeDuplicateIds(
    data.objectiveEngagements,
    "id",
    (row) => validObjectiveDomain(row),
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
  const encounterById = new Map(encounters.map((row) => [row.id, row]));
  const objectiveById = new Map(objectives.map((row) => [row.id, row]));
  const scenes = removeDuplicateIds(
    data.scenes,
    "sceneId",
    (scene) => validSceneDomain(scene) &&
      scene.encounterIds.every((id) => encounterIds.has(id)) &&
      (scene.objectiveEngagementId === null || objectiveIds.has(scene.objectiveEngagementId)),
  );
  if (scenes.length !== data.scenes.length) invalidItem = true;
  const sceneIds = new Set(scenes.map((scene) => scene.sceneId));
  const sceneById = new Map(scenes.map((scene) => [scene.sceneId, scene]));

  const reviewAppendixIdCounts = new Map();
  data.personalReviews.forEach((review) => {
    if (typeof review?.teamAppendixId === "string") {
      reviewAppendixIdCounts.set(
        review.teamAppendixId,
        (reviewAppendixIdCounts.get(review.teamAppendixId) || 0) + 1,
      );
    }
  });

  let reviews = removeDuplicateIds(
    data.personalReviews,
    "reviewId",
    (review) => {
      const factGroups = [
        [review?.situationFacts, SITUATION_FACT_TYPES],
        [review?.decisionFacts, DECISION_FACT_TYPES],
        [review?.positioningFacts, POSITIONING_FACT_TYPES],
        [review?.outcomeFacts, OUTCOME_FACT_TYPES],
      ];
      if (!validEvidenceDomain(review, "reviewId") ||
          !sceneIds.has(review.sceneId) ||
          typeof review.teamAppendixId !== "string" ||
          review.teamAppendixId.length === 0 ||
          reviewAppendixIdCounts.get(review.teamAppendixId) !== 1 ||
          !Array.isArray(review.encounterIds) ||
          !review.encounterIds.every((id) => encounterIds.has(id)) ||
          !(review.objectiveEngagementId === null ||
            objectiveIds.has(review.objectiveEngagementId)) ||
          !factGroups.every(([facts]) => Array.isArray(facts)) ||
          !validReviewFactCardinality(review) ||
          !factGroups.every(([facts, allowedTypes]) => facts.every((fact) =>
            allowedTypes.has(fact?.type) && validFact(fact, review.reviewId))) ||
          !Array.isArray(review.evidenceIds)) return false;
      const facts = factGroups.flatMap(([rows]) => rows);
      const factIds = new Set(facts.map((fact) => fact.factId));
      return facts.length === factIds.size &&
        review.evidenceIds.length === factIds.size &&
        new Set(review.evidenceIds).size === review.evidenceIds.length &&
        review.evidenceIds.every((id) => factIds.has(id)) &&
        validReviewDomainConsistency(
          review,
          sceneById,
          encounterById,
          objectiveById,
        );
    },
  );
  if (reviews.length !== data.personalReviews.length) invalidItem = true;
  const storedSelections = reviews.flatMap((review) => {
    const coaching = review.narrative?.coaching;
    if (!coaching || coaching.selectionSource !== "AI_SELECTED") return [];
    return [{
      reviewId: review.reviewId,
      recommendationCode: coaching.recommendationCode,
      evidenceIds: coaching.evidenceIds,
    }];
  });
  reviews = reviews.map((review) => ({ ...review, narrative: null }));
  const reviewById = new Map(reviews.map((review) => [review.reviewId, review]));
  const appendixIdCounts = new Map();
  const appendixReviewCounts = new Map();
  data.teamAppendix.forEach((row) => {
    if (typeof row?.teamAppendixId === "string") {
      appendixIdCounts.set(
        row.teamAppendixId,
        (appendixIdCounts.get(row.teamAppendixId) || 0) + 1,
      );
    }
    if (typeof row?.reviewId === "string") {
      appendixReviewCounts.set(
        row.reviewId,
        (appendixReviewCounts.get(row.reviewId) || 0) + 1,
      );
    }
  });
  const appendices = [];
  reviews.forEach((review) => {
    const candidates = data.teamAppendix.filter((row) =>
      row?.reviewId === review.reviewId);
    const row = candidates.length === 1 ? candidates[0] : null;
    const hasUniqueLink = Boolean(
      row && appendixReviewCounts.get(review.reviewId) === 1 &&
      appendixIdCounts.get(row.teamAppendixId) === 1 &&
      row.teamAppendixId === review.teamAppendixId,
    );
    if (!hasUniqueLink) {
      invalidItem = true;
      const fallback = fallbackTeamAppendix(review);
      if (fallback) appendices.push(fallback);
      return;
    }
    const regenerated = regenerateTeamAppendix(
      row,
      review,
      preserveAppendixParticipants,
    );
    if (regenerated.invalid) invalidItem = true;
    if (regenerated.data) {
      appendices.push(regenerated.data);
    } else {
      const fallback = fallbackTeamAppendix(review);
      if (fallback) appendices.push(fallback);
    }
  });
  if (data.teamAppendix.some((row) => !reviewById.has(row?.reviewId))) {
    invalidItem = true;
  }

  const limitationCodes = [...new Set([
    ...data.coverage.limitationCodes,
    ...(invalidItem ? ["INVALID_V2_ITEM"] : []),
  ])].sort();
  const sanitizedData = {
    schemaVersion: data.schemaVersion,
    coverage: {
      level: data.coverage.level,
      source: data.coverage.source,
      usablePositionSceneRatio: data.coverage.usablePositionSceneRatio,
      limitationCodes,
    },
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
  };
  return {
    rootValid: true,
    data: applyRecommendationSelections(
      sanitizedData,
      storedSelections.length > 0 ? { reviews: storedSelections } : null,
    ),
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
