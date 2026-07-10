const { extractTeamplaySource } = require("./teamplay-source-v2");
const { buildEncounters } = require("./teamplay-encounters-v2");
const { buildObjectiveEngagements } = require("./teamplay-objectives-v2");
const {
  buildScenes,
  buildPersonalReviewCandidates,
  selectTopPersonalReviews,
  buildTeamAppendix,
  buildCoverage,
} = require("./teamplay-reviews-v2");

function buildTeamplayAnalysisV2(matchDetail, timeline, targetParticipantId) {
  const source = extractTeamplaySource(matchDetail, timeline, targetParticipantId);
  const baseEncounters = buildEncounters(source);
  const linked = buildObjectiveEngagements(source, baseEncounters);
  const scenes = buildScenes(source, linked.encounters, linked.objectiveEngagements);
  const reviewCandidates = buildPersonalReviewCandidates(
    source,
    scenes,
    linked.encounters,
    linked.objectiveEngagements,
  );
  const personalReviews = selectTopPersonalReviews(reviewCandidates, 5);
  const sceneById = new Map(scenes.map((scene) => [scene.sceneId, scene]));
  const teamAppendix = personalReviews.map((review) =>
    buildTeamAppendix(source, review, sceneById.get(review.sceneId)));
  return {
    schemaVersion: "2.0",
    coverage: buildCoverage(source, reviewCandidates, [
      ...linked.encounters,
      ...linked.objectiveEngagements,
      ...scenes,
      ...teamAppendix,
    ]),
    encounters: linked.encounters,
    objectiveEngagements: linked.objectiveEngagements,
    scenes,
    personalReviews,
    teamAppendix,
  };
}

module.exports = { buildTeamplayAnalysisV2 };
