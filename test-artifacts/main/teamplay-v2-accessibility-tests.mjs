import assert from "node:assert/strict";
import fs from "node:fs";

const mainSource = fs.readFileSync(new URL("../../main.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const stylesSource = fs.readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function not found: ${name}`);
  let bodyStart = -1;
  let parenDepth = 0;
  let sawParams = false;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "(") { parenDepth += 1; sawParams = true; }
    if (source[index] === ")") parenDepth -= 1;
    if (source[index] === "{" && sawParams && parenDepth === 0) {
      bodyStart = index;
      break;
    }
  }
  if (bodyStart < 0) throw new Error(`function body not found: ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`function not closed: ${name}`);
}

const sources = [
  extractFunctionSource(mainSource, "escapeHtml"),
  extractFunctionSource(mainSource, "escapeAttr"),
  extractFunctionSource(mainSource, "msToClock"),
  extractFunctionSource(mainSource, "teamplayDomToken"),
  extractFunctionSource(mainSource, "renderTeamplayReviewCard"),
  extractFunctionSource(mainSource, "teamplayTeamLabel"),
  extractFunctionSource(mainSource, "renderTeamplayFlowScene"),
  extractFunctionSource(mainSource, "focusTeamplayScene"),
  extractFunctionSource(mainSource, "setTeamplayBusy"),
  extractFunctionSource(mainSource, "toggleTeamplayDisclosure"),
].join("\n");

const {
  renderTeamplayReviewCard,
  renderTeamplayFlowScene,
  focusTeamplayScene,
  setTeamplayBusy,
  toggleTeamplayDisclosure,
} = new Function("HTML_ESCAPE", `
  const dom = { teamplayFlowStatus: null };
  ${sources}
  return {
    renderTeamplayReviewCard,
    renderTeamplayFlowScene,
    focusTeamplayScene,
    setTeamplayBusy,
    toggleTeamplayDisclosure,
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

function makeFlowModel(captureTeam, captureCounts, allyDeaths, enemyDeaths) {
  const objective = {
    id: "obj_flow",
    startTimestamp: 510000,
    endTimestamp: 740000,
    sourceRefs: [{
      kind: "TIMELINE_EVENT",
      id: "event_obj_flow",
      timestamp: 600000,
      participantId: null,
    }],
    confidence: "HIGH",
    limitationCodes: [],
    objectiveType: "VOID_GRUB_CAMP",
    captureStartTimestamp: 600000,
    captureEndTimestamp: 620000,
    captureTeam,
    captureCounts,
    setupWindow: {
      startMs: 510000,
      endMsExclusive: 580000,
      deathCounts: { ally: 0, enemy: 0 },
      linkedEncounterIds: [],
      sourceRefs: [],
    },
    contestWindow: {
      startMs: 580000,
      endMsExclusive: 640000,
      deathCounts: { ally: allyDeaths, enemy: enemyDeaths },
      linkedEncounterIds: [],
      sourceRefs: [],
    },
    conversionWindow: {
      startMs: 620000,
      endMsExclusive: 740000,
      sourceRefs: [],
    },
    linkedEncounterIds: [],
    structureConversions: [],
  };
  const scene = {
    sceneId: "scene_flow",
    primaryType: "OBJECTIVE",
    objectiveEngagementId: objective.id,
    encounterIds: [],
    startTimestamp: 510000,
    endTimestamp: 740000,
  };
  return {
    schemaVersion: "2.0",
    coverage: {
      level: "FULL",
      source: "RAW_TIMELINE",
      usablePositionSceneRatio: 1,
      limitationCodes: [],
    },
    encounters: [],
    objectiveEngagements: [objective],
    scenes: [scene],
    personalReviews: [],
    teamAppendix: [],
  };
}

function splitObjectiveModel() {
  return makeFlowModel(
    "SPLIT",
    { ally: 2, enemy: 1, unknown: 0 },
    1,
    1,
  );
}

function splitObjectiveScene() {
  return splitObjectiveModel().scenes[0];
}

function enemyCaptureAllyKillLeadModel() {
  return makeFlowModel(
    "ENEMY",
    { ally: 0, enemy: 1, unknown: 0 },
    1,
    3,
  );
}

function enemyCaptureAllyKillLeadScene() {
  return enemyCaptureAllyKillLeadModel().scenes[0];
}

function accessibleReview() {
  return {
    reviewId: "review_accessible",
    sceneId: "scene_flow",
    startTimestamp: 600000,
    endTimestamp: 620000,
    importanceScore: 80,
    effectiveInvolvementLevel: "CONFIRMED",
    situationFacts: [],
    decisionFacts: [],
    positioningFacts: [],
    outcomeFacts: [],
    evidenceIds: ["fact_accessible"],
    narrative: {
      decisionAssessment: null,
      positioningObservation: null,
      coaching: null,
    },
  };
}

function accessibleAppendix() {
  return {
    teamAppendixId: "appendix_accessible",
    reviewId: "review_accessible",
    allyDirectParticipants: [],
    enemyDirectParticipants: [],
    allyDeaths: 0,
    enemyDeaths: 0,
    captureTeam: "SPLIT",
    structureConversions: [],
  };
}

function renderAccessibleReviewAndFlow() {
  return renderTeamplayReviewCard(
    accessibleReview(),
    accessibleAppendix(),
    0,
  ) + renderTeamplayFlowScene(splitObjectiveScene(), splitObjectiveModel());
}

test("flow presents factual sequence without setup failure language", () => {
  const html = renderTeamplayFlowScene(
    splitObjectiveScene(),
    splitObjectiveModel(),
  );
  for (const text of ["준비", "교전 사실", "획득 팀", "후속 전환", "분할 획득"]) {
    assert.ok(html.includes(text), text);
  }
  for (const forbidden of ["준비 실패", "승리", "패배", "과진입", "추격 성공"]) {
    assert.ok(!html.includes(forbidden), forbidden);
  }
});

test("enemy capture and ally kill advantage remain independent", () => {
  const html = renderTeamplayFlowScene(
    enemyCaptureAllyKillLeadScene(),
    enemyCaptureAllyKillLeadModel(),
  );
  assert.ok(html.includes("상대 획득"));
  assert.ok(html.includes("아군 사망 1"));
  assert.ok(html.includes("상대 사망 3"));
});

test("unknown capture never becomes enemy", () => {
  const model = makeFlowModel(
    "UNKNOWN",
    { ally: 0, enemy: 0, unknown: 1 },
    0,
    0,
  );
  const html = renderTeamplayFlowScene(model.scenes[0], model);
  assert.ok(html.includes("팀 미상"));
  assert.ok(!html.includes("상대 획득"));
});

test("all disclosures use native buttons and unique targets", () => {
  const html = renderAccessibleReviewAndFlow();
  const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.equal(new Set(controls).size, controls.length);
  assert.ok(!html.includes('role="button"'));
  assert.ok(html.includes('aria-expanded="false"'));
});

test("flow navigation changes tab then focuses scene heading", () => {
  const calls = [];
  focusTeamplayScene("scene_1", {
    switchTab: (id) => calls.push(["tab", id]),
    requestFrame: (fn) => fn(),
    target: {
      scrollIntoView: (options) => calls.push(["scroll", options.behavior]),
      focus: () => calls.push(["focus"]),
    },
    reducedMotion: true,
  });
  assert.deepEqual(calls, [
    ["tab", "tab-timeline"],
    ["scroll", "auto"],
    ["focus"],
  ]);
});

test("missing scene leaves position and announces status", () => {
  const status = { textContent: "" };
  focusTeamplayScene("missing", {
    switchTab: () => {},
    requestFrame: (fn) => fn(),
    target: null,
    status,
    reducedMotion: false,
  });
  assert.equal(status.textContent, "근거 장면을 찾지 못했습니다.");
});

test("busy state is exposed on analysis and flow regions", () => {
  const attrs = [];
  const oldDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => ({
      setAttribute: (name, value) => attrs.push([id, name, value]),
    }),
  };
  try {
    setTeamplayBusy(true);
  } finally {
    globalThis.document = oldDocument;
  }
  assert.deepEqual(attrs, [
    ["teamplay-analysis", "aria-busy", "true"],
    ["teamplay-flow", "aria-busy", "true"],
  ]);
});

test("disclosure toggle keeps aria and hidden state synchronized", () => {
  const target = { hidden: true };
  const attrs = new Map([
    ["aria-controls", "panel_1"],
    ["aria-expanded", "false"],
  ]);
  let focused = false;
  const button = {
    getAttribute: (name) => attrs.get(name),
    setAttribute: (name, value) => attrs.set(name, value),
    focus: () => { focused = true; },
  };
  const oldDocument = globalThis.document;
  globalThis.document = { getElementById: () => target };
  try {
    toggleTeamplayDisclosure(button);
    assert.equal(attrs.get("aria-expanded"), "true");
    assert.equal(target.hidden, false);
    toggleTeamplayDisclosure(button);
  } finally {
    globalThis.document = oldDocument;
  }
  assert.equal(attrs.get("aria-expanded"), "false");
  assert.equal(target.hidden, true);
  assert.equal(focused, true);
});

test("flow scene target and heading share one DOM token", () => {
  const html = renderTeamplayFlowScene(
    { ...splitObjectiveScene(), sceneId: "<scene&1>" },
    splitObjectiveModel(),
  );
  assert.ok(!html.includes("<scene&1>"));
  assert.ok(html.includes('tabindex="-1"'));
  assert.ok(html.includes("teamplay-scene-tp_"));
});

test("DOM has one mutual-exclusion teamplay flow slot", () => {
  assert.ok(indexSource.includes('id="teamplay-flow"'));
  assert.ok(indexSource.includes("data-teamplay-flow-v2"));
  assert.ok(indexSource.includes("data-teamplay-flow-legacy"));
  assert.equal((indexSource.match(/data-dual-timeline/g) || []).length, 1);
});

test("objective table exposes caption and column scopes", () => {
  const objectiveSource = extractFunctionSource(mainSource, "renderObjectiveTimeline");
  assert.ok(objectiveSource.includes("<caption>"));
  assert.equal((objectiveSource.match(/scope="col"/g) || []).length, 6);
});

test("dashboard can shrink below the tab bar intrinsic width", () => {
  const dashboardRule = stylesSource.match(/\.dashboard\s*\{([^}]*)\}/s)?.[1] || "";
  assert.match(dashboardRule, /min-width:\s*0\s*;/);
  assert.match(dashboardRule, /width:\s*100%\s*;/);
  assert.match(dashboardRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
  const activeTabRule = stylesSource.match(/\.tab-page--active\s*\{([^}]*)\}/s)?.[1] || "";
  assert.match(activeTabRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
