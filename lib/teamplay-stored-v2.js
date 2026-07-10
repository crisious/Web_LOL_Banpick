const { buildTeamplayAnalysisV2 } = require("./teamplay-analysis-v2");
const {
  applyRecommendationSelections,
  createLegacyTeamplayEnvelope,
  createUnavailableTeamplayEnvelope,
  sanitizeTeamplayAnalysisV2,
} = require("./teamplay-coaching-v2");

function hasLegacyTeamplayAnalysis(analysis) {
  return Array.isArray(analysis?.combatAnalysis) ||
    Array.isArray(analysis?.teamfightPhaseAnalysis);
}

function storedAiSelectionEnvelope(model) {
  const reviews = (Array.isArray(model?.personalReviews)
    ? model.personalReviews
    : []).flatMap((review) => {
    const coaching = review?.narrative?.coaching;
    if (!coaching || coaching.selectionSource !== "AI_SELECTED") return [];
    return [{
      reviewId: review.reviewId,
      recommendationCode: coaching.recommendationCode,
      evidenceIds: coaching.evidenceIds,
    }];
  });
  return reviews.length > 0 ? { reviews } : null;
}

function hydrateStoredTeamplayV2({ normalized, analysis, matchDetail, timeline }) {
  const normalizedOut = { ...(normalized || {}) };
  const analysisOut = { ...(analysis || {}) };
  const analysisExisting = sanitizeTeamplayAnalysisV2(
    analysisOut.teamplayAnalysisV2,
    { preserveAppendixParticipants: false },
  );
  const normalizedExisting = sanitizeTeamplayAnalysisV2(
    normalizedOut.teamplayAnalysisV2,
    { preserveAppendixParticipants: false },
  );
  const analysisRaw = analysisExisting.rootValid &&
    analysisExisting.data.coverage.source === "RAW_TIMELINE";
  const normalizedRaw = normalizedExisting.rootValid &&
    normalizedExisting.data.coverage.source === "RAW_TIMELINE";

  if (matchDetail && timeline) {
    const participants = Array.isArray(matchDetail?.info?.participants)
      ? matchDetail.info.participants
      : [];
    const target = participants.find((row) =>
      row.participantId === normalizedOut.playerContext?.participantId) ||
      participants.find((row) =>
        row.puuid === normalizedOut.playerContext?.puuid);
    if (target) {
      const facts = buildTeamplayAnalysisV2(
        matchDetail,
        timeline,
        target.participantId,
      );
      if (facts.coverage.source === "RAW_TIMELINE") {
        normalizedOut.teamplayAnalysisV2 = facts;
        analysisOut.teamplayAnalysisV2 = applyRecommendationSelections(
          facts,
          storedAiSelectionEnvelope(analysisOut.teamplayAnalysisV2),
        );
        return { normalized: normalizedOut, analysis: analysisOut };
      }
    }
  }

  if (analysisRaw && normalizedRaw) {
    analysisOut.teamplayAnalysisV2 = analysisExisting.data;
    normalizedOut.teamplayAnalysisV2 = normalizedExisting.data;
    return { normalized: normalizedOut, analysis: analysisOut };
  }

  if (normalizedRaw) {
    normalizedOut.teamplayAnalysisV2 = normalizedExisting.data;
    analysisOut.teamplayAnalysisV2 = analysisRaw
      ? analysisExisting.data
      : applyRecommendationSelections(normalizedExisting.data, null);
    return { normalized: normalizedOut, analysis: analysisOut };
  }

  if (analysisRaw) {
    analysisOut.teamplayAnalysisV2 = analysisExisting.data;
    return { normalized: normalizedOut, analysis: analysisOut };
  }

  const existingEnvelope = analysisExisting.rootValid
    ? analysisExisting.data
    : normalizedExisting.rootValid
      ? normalizedExisting.data
      : null;
  if (existingEnvelope) {
    analysisOut.teamplayAnalysisV2 = existingEnvelope;
    return { normalized: normalizedOut, analysis: analysisOut };
  }

  analysisOut.teamplayAnalysisV2 = hasLegacyTeamplayAnalysis(analysisOut)
    ? createLegacyTeamplayEnvelope()
    : createUnavailableTeamplayEnvelope();
  return { normalized: normalizedOut, analysis: analysisOut };
}

module.exports = { hydrateStoredTeamplayV2 };
