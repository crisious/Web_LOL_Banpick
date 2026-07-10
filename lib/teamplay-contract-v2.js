const { createHash } = require("node:crypto");

const TEAMPLAY_SCHEMA_VERSION = "2.0";
const CONFIDENCE_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const COVERAGE_LEVELS = new Set([
  "FULL",
  "PARTIAL",
  "EVENT_ONLY",
  "PLAYER_ONLY",
  "UNAVAILABLE",
]);
const COVERAGE_SOURCES = new Set(["RAW_TIMELINE", "LEGACY_ADAPTER", "NONE"]);
const RENDERABLE_LEVELS = new Set(["FULL", "PARTIAL", "EVENT_ONLY"]);
const LIMITATION_CODES = new Set([
  "PARTIAL_POSITION_FRAMES",
  "NO_POSITION_FRAMES",
  "MISSING_SPATIAL_LINK",
  "INCOMPLETE_ALLY_FRAME_COVERAGE",
  "UNKNOWN_TEAM",
  "INCOMPLETE_TEAM_SNAPSHOT",
  "STALE_TEAM_SNAPSHOT",
  "INVALID_V2_ITEM",
  "INVALID_AI_SELECTION",
]);

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalValue(value[key]);
      return out;
    }, {});
  }
  return value === undefined ? null : value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function stableId(prefix, parts) {
  const digest = createHash("sha256")
    .update(canonicalJson(parts))
    .digest("hex")
    .slice(0, 20);
  return `${prefix}_${digest}`;
}

function makeTimelineEventRef(matchId, frameIndex, eventIndex, timestamp) {
  return {
    kind: "TIMELINE_EVENT",
    id: `${String(matchId)}:${frameIndex}:${eventIndex}`,
    timestamp: Math.round(Number(timestamp) || 0),
    participantId: null,
  };
}

function makeParticipantFrameRef(matchId, frameIndex, participantId, timestamp) {
  return {
    kind: "PARTICIPANT_FRAME",
    id: `${String(matchId)}:${frameIndex}:${participantId}`,
    timestamp: Math.round(Number(timestamp) || 0),
    participantId,
  };
}

function makeFactId(reviewId, fact) {
  return stableId("fact", {
    schemaVersion: TEAMPLAY_SCHEMA_VERSION,
    reviewId,
    type: fact.type,
    timestamp: Math.round(Number(fact.timestamp) || 0),
    sourceRefIds: (fact.sourceRefs || []).map((ref) => ref.id).sort(),
    value: fact.value,
  });
}

function relationForTeam(teamId, targetTeamId) {
  if (teamId !== 100 && teamId !== 200) return "UNKNOWN";
  if (targetTeamId !== 100 && targetTeamId !== 200) return "UNKNOWN";
  return teamId === targetTeamId ? "ALLY" : "ENEMY";
}

function lowerConfidence(left, right) {
  const a = Object.hasOwn(CONFIDENCE_ORDER, left) ? left : "LOW";
  const b = Object.hasOwn(CONFIDENCE_ORDER, right) ? right : "LOW";
  return CONFIDENCE_ORDER[a] <= CONFIDENCE_ORDER[b] ? a : b;
}

function createCoverageEnvelope({
  level,
  source,
  usablePositionSceneRatio = 0,
  limitationCodes = [],
}) {
  if (!COVERAGE_LEVELS.has(level) || !COVERAGE_SOURCES.has(source)) {
    throw new TypeError("invalid teamplay coverage envelope");
  }
  return {
    level,
    source,
    usablePositionSceneRatio: Math.max(
      0,
      Math.min(1, Number(usablePositionSceneRatio) || 0),
    ),
    limitationCodes: [...new Set(limitationCodes)]
      .filter((code) => LIMITATION_CODES.has(code))
      .sort(),
  };
}

function validateTeamplayRoot(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.schemaVersion === TEAMPLAY_SCHEMA_VERSION &&
    value.coverage &&
    COVERAGE_LEVELS.has(value.coverage.level) &&
    COVERAGE_SOURCES.has(value.coverage.source) &&
    Number.isFinite(value.coverage.usablePositionSceneRatio) &&
    value.coverage.usablePositionSceneRatio >= 0 &&
    value.coverage.usablePositionSceneRatio <= 1 &&
    Array.isArray(value.coverage.limitationCodes) &&
    value.coverage.limitationCodes.every((code) => LIMITATION_CODES.has(code)) &&
    Array.isArray(value.encounters) &&
    Array.isArray(value.objectiveEngagements) &&
    Array.isArray(value.scenes) &&
    Array.isArray(value.personalReviews) &&
    Array.isArray(value.teamAppendix)
  );
}

function isRenderableV2(value) {
  return validateTeamplayRoot(value) &&
    value.coverage.source === "RAW_TIMELINE" &&
    RENDERABLE_LEVELS.has(value.coverage.level);
}

module.exports = {
  TEAMPLAY_SCHEMA_VERSION,
  LIMITATION_CODES,
  COVERAGE_LEVELS,
  COVERAGE_SOURCES,
  canonicalJson,
  stableId,
  makeTimelineEventRef,
  makeParticipantFrameRef,
  makeFactId,
  relationForTeam,
  lowerConfidence,
  createCoverageEnvelope,
  validateTeamplayRoot,
  isRenderableV2,
};
