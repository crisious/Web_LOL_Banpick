import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  championKill,
  eliteKill,
  makeFrame,
  makeMatchFixture,
  makeTimelineFixture,
} from "../fixtures/teamplay-v2-fixtures.mjs";

const require = createRequire(import.meta.url);
const { buildTeamplayAnalysisV2 } = require("../../lib/teamplay-analysis-v2.js");
const { applyRecommendationSelections } = require("../../lib/teamplay-coaching-v2.js");

const mainSource = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function not found: ${name}`);
  let depth = 0;
  let opened = false;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") { depth += 1; opened = true; }
    if (source[index] === "}") {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`function not closed: ${name}`);
}

function extractConstSource(source, name) {
  const match = source.match(new RegExp(`const ${name} = [^;]*;`));
  if (!match) throw new Error(`const not found: ${name}`);
  return match[0];
}

const helperSources = [
  extractConstSource(mainSource, "TEAMPLAY_RENDER_LEVELS"),
  extractConstSource(mainSource, "TEAMPLAY_COVERAGE_LEVELS"),
  extractConstSource(mainSource, "TEAMPLAY_COVERAGE_SOURCES"),
  extractConstSource(mainSource, "TEAMPLAY_LIMITATIONS"),
  extractFunctionSource(mainSource, "escapeHtml"),
  extractFunctionSource(mainSource, "escapeAttr"),
  extractFunctionSource(mainSource, "msToClock"),
  extractFunctionSource(mainSource, "sanitizeClientTeamplayV2"),
  extractFunctionSource(mainSource, "hasLegacyTeamplayUi"),
  extractFunctionSource(mainSource, "selectTeamplayRenderModel"),
  extractFunctionSource(mainSource, "teamplayDomToken"),
  extractFunctionSource(mainSource, "renderTeamplayReviewCard"),
  extractFunctionSource(mainSource, "renderTeamplayReviewCollection"),
].join("\n");

const {
  sanitizeClientTeamplayV2,
  selectTeamplayRenderModel,
  teamplayDomToken,
  renderTeamplayReviewCard,
  renderTeamplayReviewCollection,
} = new Function("HTML_ESCAPE", `
  ${helperSources}
  return {
    sanitizeClientTeamplayV2,
    selectTeamplayRenderModel,
    teamplayDomToken,
    renderTeamplayReviewCard,
    renderTeamplayReviewCollection,
  };
`)({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
});

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
    pass += 1;
  } catch (error) {
    console.log(`FAIL  ${name}\n  ${error.message}`);
    fail += 1;
  }
}

function baseClientModel(level = "FULL", source = "RAW_TIMELINE") {
  return {
    schemaVersion: "2.0",
    coverage: {
      level,
      source,
      usablePositionSceneRatio: 1,
      limitationCodes: [],
    },
    encounters: [],
    objectiveEngagements: [],
    scenes: [{
      sceneId: "scene_1",
      objectiveEngagementId: null,
      encounterIds: [],
      startTimestamp: 600000,
      endTimestamp: 610000,
    }],
    personalReviews: [],
    teamAppendix: [],
  };
}

function sampleWithCoverage(level, source) {
  return {
    analysis: { teamplayAnalysisV2: baseClientModel(level, source) },
    normalized: {},
  };
}

function sampleWithLegacy(level) {
  const source = level === "PLAYER_ONLY" ? "LEGACY_ADAPTER" : "NONE";
  return {
    analysis: {
      teamplayAnalysisV2: baseClientModel(level, source),
      combatAnalysis: [],
      teamfightPhaseAnalysis: [],
    },
    normalized: {},
  };
}

function sampleWithoutLegacy() {
  return {
    analysis: {
      teamplayAnalysisV2: baseClientModel("UNAVAILABLE", "NONE"),
    },
    normalized: {},
  };
}

function sampleWithOneBrokenReview() {
  const model = baseClientModel();
  model.personalReviews = [{
    reviewId: "review_broken",
    sceneId: "missing_scene",
    startTimestamp: 700000,
    endTimestamp: 600000,
  }];
  return { analysis: { teamplayAnalysisV2: model }, normalized: {} };
}

function reviewWithMarkup(index = 0) {
  return {
    reviewId: `review_${index}`,
    sceneId: `scene_${index}`,
    startTimestamp: 600000 + index,
    endTimestamp: 610000 + index,
    importanceScore: 80,
    effectiveInvolvementLevel: "APPROXIMATE",
    situationFacts: [],
    decisionFacts: [],
    positioningFacts: [{
      factId: `fact_${index}`,
      type: "PLAYER_DISTANCE_2500_5000",
      timestamp: 600000 + index,
      value: { distance: 3200, frameAgeSeconds: 10 },
      confidence: "MEDIUM",
      sourceRefs: [{
        kind: "TIMELINE_EVENT",
        id: `<event_${index}>`,
        timestamp: 600000 + index,
        participantId: null,
      }],
    }],
    outcomeFacts: [],
    evidenceIds: [`fact_${index}`],
    narrative: {
      factStatements: [],
      decisionAssessment: null,
      positioningObservation: {
        claimCode: "POSITION_DISTANCE_2500_5000",
        text: "<script>alert(1)</script>",
        evidenceIds: [`fact_${index}`],
        source: "SERVER_FACT_TEMPLATE",
      },
      coaching: null,
    },
  };
}

function appendixWithMarkup(index = 0) {
  return {
    teamAppendixId: `appendix_${index}`,
    reviewId: `review_${index}`,
    allyDirectParticipants: ["<img src=x>"],
    enemyDirectParticipants: [],
    allyDeaths: 1,
    enemyDeaths: 0,
    captureTeam: "UNKNOWN",
    structureConversions: [],
  };
}

function renderFiveReviewModel() {
  const reviews = Array.from({ length: 5 }, (_, index) =>
    reviewWithMarkup(index));
  return renderTeamplayReviewCollection(
    reviews,
    new Map(reviews.map((review, index) => [
      review.reviewId,
      appendixWithMarkup(index),
    ])),
  );
}

test("raw full partial and event-only models select V2", () => {
  for (const level of ["FULL", "PARTIAL", "EVENT_ONLY"]) {
    assert.equal(
      selectTeamplayRenderModel(sampleWithCoverage(level, "RAW_TIMELINE")).mode,
      "V2",
    );
  }
});

test("player-only and unavailable with legacy select LEGACY", () => {
  assert.equal(selectTeamplayRenderModel(sampleWithLegacy("PLAYER_ONLY")).mode, "LEGACY");
  assert.equal(selectTeamplayRenderModel(sampleWithLegacy("UNAVAILABLE")).mode, "LEGACY");
});

test("unavailable without legacy selects EMPTY", () => {
  assert.equal(selectTeamplayRenderModel(sampleWithoutLegacy()).mode, "EMPTY");
});

test("malformed item is removed without discarding valid root", () => {
  const selected = selectTeamplayRenderModel(sampleWithOneBrokenReview());
  assert.equal(selected.mode, "V2");
  assert.equal(selected.data.personalReviews.length, 0);
  assert.ok(selected.data.coverage.limitationCodes.includes("INVALID_V2_ITEM"));
});

test("review card escapes content and starts disclosures closed", () => {
  const html = renderTeamplayReviewCard(
    reviewWithMarkup(),
    appendixWithMarkup(),
    0,
  );
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img src=x>"));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(html.includes("hidden"));
  assert.ok(html.includes("근접 추정"));
});

test("expanded evidence includes the matching server fact result", () => {
  const review = reviewWithMarkup();
  review.narrative.factStatements = [{
    factId: "fact_0",
    claimCode: "PLAYER_DISTANCE_2500_5000",
    text: "교전 중심과의 실제 거리는 3,200입니다.",
    evidenceIds: ["fact_0"],
    source: "SERVER_FACT_TEMPLATE",
  }];
  const html = renderTeamplayReviewCard(review, appendixWithMarkup(), 0);
  const start = html.indexOf('id="teamplay-evidence-');
  const end = html.indexOf("</div>", start);
  const evidenceHtml = html.slice(start, end);
  assert.ok(evidenceHtml.includes("교전 중심과의 실제 거리는 3,200입니다."));
});

test("encounter-only appendix distinguishes no objective from unknown capture", () => {
  const appendix = { ...appendixWithMarkup(), captureTeam: null };
  const html = renderTeamplayReviewCard(reviewWithMarkup(), appendix, 0);
  assert.ok(html.includes("연결된 오브젝트 없음"));
  assert.ok(!html.includes("오브젝트 획득</th><td colspan=\"2\">팀 미상"));
});

test("missing position and coaching render explicit normal states", () => {
  const review = reviewWithMarkup();
  review.positioningFacts = [];
  review.narrative.positioningObservation = null;
  const html = renderTeamplayReviewCard(review, appendixWithMarkup(), 0);
  assert.ok(html.includes("위치 근거 부족"));
  assert.ok(html.includes("코칭을 생성할 근거가 없습니다."));
});

test("missing appendix emits no broken disclosure reference", () => {
  const html = renderTeamplayReviewCard(reviewWithMarkup(), undefined, 0);
  assert.ok(!html.includes("teamplay-appendix-"));
  assert.ok(!html.includes("팀 상황 근거"));
});

test("only first three review cards are initially visible", () => {
  const html = renderFiveReviewModel();
  assert.equal((html.match(/data-teamplay-review-visible/g) || []).length, 3);
  assert.equal((html.match(/data-teamplay-review-extra/g) || []).length, 2);
});

test("review collection handles 0 1 2 3 and 5 deterministically", () => {
  for (const count of [0, 1, 2, 3, 5]) {
    const reviews = Array.from({ length: count }, (_, index) =>
      reviewWithMarkup(index));
    const html = renderTeamplayReviewCollection(reviews, new Map());
    assert.equal(
      (html.match(/data-teamplay-review-visible/g) || []).length,
      Math.min(3, count),
    );
    assert.equal(
      (html.match(/data-teamplay-review-extra/g) || []).length,
      Math.max(0, count - 3),
    );
    assert.equal(
      (html.match(/id="teamplay-extra-reviews"/g) || []).length,
      1,
    );
  }
});

test("DOM has one mutual-exclusion analysis slot", () => {
  assert.ok(indexSource.includes('id="teamplay-analysis"'));
  assert.ok(indexSource.includes("data-teamplay-v2"));
  assert.ok(indexSource.includes("data-teamplay-legacy"));
  assert.equal((indexSource.match(/data-combat-analysis/g) || []).length, 1);
  assert.equal((indexSource.match(/data-teamfight-phases/g) || []).length, 1);
});

test("DOM tokens are deterministic and collision resistant", () => {
  assert.equal(teamplayDomToken("scene_1"), "tp_7363656e655f31");
  assert.notEqual(teamplayDomToken("a-b"), teamplayDomToken("a_b"));
});

test("client sanitizer rejects an invalid root", () => {
  assert.equal(sanitizeClientTeamplayV2({ schemaVersion: "2.0" }).rootValid, false);
});

test("real server teamplay model survives client sanitation", () => {
  const facts = buildTeamplayAnalysisV2(
    makeMatchFixture(),
    makeTimelineFixture([makeFrame(600000, [
      championKill(605000, 2, 6, [1], { x: 5000, y: 5000 }),
      eliteKill(610000, 2, 100, "DRAGON", { x: 5000, y: 5000 }, [1]),
    ])]),
    1,
  );
  const model = applyRecommendationSelections(facts, null);
  const selected = selectTeamplayRenderModel({
    analysis: { teamplayAnalysisV2: model },
    normalized: {},
  });
  assert.equal(selected.mode, "V2");
  assert.equal(selected.data.personalReviews.length, 1);
  assert.ok(renderTeamplayReviewCard(
    selected.data.personalReviews[0],
    selected.data.teamAppendix[0],
    0,
  ).includes("개인 리뷰의 팀 상황 근거"));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
