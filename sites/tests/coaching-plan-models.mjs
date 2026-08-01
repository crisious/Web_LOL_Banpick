import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildFocusModel,
  buildPhaseModels,
  buildSkillProfile,
  findFocusMomentId,
} from "../app/coaching-plan.js";

const testsRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsRoot, "..", "..");

function repoPath(publicPath) {
  assert.equal(typeof publicPath, "string");
  assert.ok(publicPath.startsWith("/data/samples/"));
  const relativePath = publicPath.slice(1);
  assert.equal(path.posix.normalize(relativePath), relativePath);
  const resolved = path.resolve(repoRoot, relativePath);
  assert.ok(resolved.startsWith(`${repoRoot}${path.sep}`));
  return resolved;
}

test("buildFocusModel selects the first weakness and its linked action", () => {
  const model = buildFocusModel({
    weaknesses: [{
      id: "wk_1",
      title: "초반 생존",
      description: "시야 없이 전진했습니다.",
      relatedEventIds: ["evt_1", "", "evt_1", "evt_2", null],
    }],
    actionChecklist: [
      { id: "act_other", text: "다른 행동", linkedWeaknessId: "wk_2" },
      { id: "act_1", text: "강 입구 시야 확인", linkedWeaknessId: "wk_1" },
    ],
  });

  assert.deepEqual(model, {
    weaknessId: "wk_1",
    title: "초반 생존",
    description: "시야 없이 전진했습니다.",
    actionId: "act_1",
    actionText: "강 입구 시야 확인",
    relatedEventIds: ["evt_1", "evt_2"],
    evidenceCount: 2,
  });
});

test("buildFocusModel falls back to the first action and legacy action copy", () => {
  const model = buildFocusModel({
    weaknesses: [{ id: "wk_1", title: "포지셔닝", relatedEventIds: [] }],
    actionChecklist: [{
      id: "act_1",
      title: "후방 유지",
      detail: "탱커 뒤 두 번째 줄에 선다.",
    }],
  });
  assert.equal(model.actionText, "후방 유지 — 탱커 뒤 두 번째 줄에 선다.");
  assert.equal(model.evidenceCount, 0);
});

test("buildFocusModel returns null only when focus content is entirely absent", () => {
  assert.equal(buildFocusModel({ weaknesses: [], actionChecklist: [] }), null);
});

test("findFocusMomentId returns the first intersecting moment and safe fallback", () => {
  const focus = { relatedEventIds: ["evt_2", "evt_3"] };
  const moments = [
    { id: "km_1", relatedEventIds: ["evt_1"] },
    { id: "km_2", relatedEventIds: ["evt_2"] },
    { id: "km_3", relatedEventIds: ["evt_3"] },
  ];
  assert.equal(findFocusMomentId(focus, moments), "km_2");
  assert.equal(findFocusMomentId({ relatedEventIds: ["evt_x"] }, moments), "");
  assert.equal(findFocusMomentId(null, moments), "");
});

test("buildPhaseModels joins phase facts with EARLY MID LATE summaries", () => {
  const models = buildPhaseModels(
    {
      phaseContext: {
        early: {
          startMs: 0, endMs: 900000, kills: 1, deaths: 2,
          assists: 3, notableEventCount: 4,
        },
        mid: {
          startMs: 900001, endMs: 1800000, kills: 2, deaths: 1,
          assists: 5, notableEventCount: 6,
        },
        late: {
          startMs: 1800001, endMs: 2100000, kills: 1, deaths: 0,
          assists: 2, notableEventCount: 3,
        },
      },
    },
    {
      phaseSummaries: [
        { phase: "EARLY", summary: "초반 요약" },
        { phase: "중반", summary: "중반 요약" },
        { phase: "late", summary: "후반 요약" },
      ],
    },
  );

  assert.deepEqual(models.map((model) => model.key), ["early", "mid", "late"]);
  assert.deepEqual(models.map((model) => model.label), ["초반", "중반", "후반"]);
  assert.deepEqual(models[0], {
    key: "early",
    phase: "EARLY",
    label: "초반",
    timeRange: "00:00–15:00",
    kills: 1,
    deaths: 2,
    assists: 3,
    notableEventCount: 4,
    summary: "초반 요약",
    hasContext: true,
  });
  assert.equal(models[1].summary, "중반 요약");
  assert.equal(models[2].summary, "후반 요약");
});

test("buildPhaseModels preserves facts when AI summaries are absent", () => {
  const models = buildPhaseModels(
    { phaseContext: { early: { startMs: 0, endMs: 600000, kills: 0 } } },
    { phaseSummaries: [] },
  );
  assert.equal(models[0].hasContext, true);
  assert.equal(models[0].summary, "이 구간의 AI 요약이 없습니다.");
  assert.equal(models[1].hasContext, false);
  assert.equal(models[1].summary, "");
});

test("buildPhaseModels rejects malformed and negative phase facts", () => {
  const invalidValues = [
    true,
    false,
    "   ",
    "7",
    [],
    [7],
    {},
    NaN,
    Infinity,
    -1,
  ];

  for (const invalidValue of invalidValues) {
    const [model] = buildPhaseModels({
      phaseContext: {
        early: {
          startMs: 0,
          endMs: 1000,
          kills: invalidValue,
          deaths: invalidValue,
          assists: invalidValue,
          notableEventCount: invalidValue,
        },
      },
    }, {});

    assert.equal(model.kills, null);
    assert.equal(model.deaths, null);
    assert.equal(model.assists, null);
    assert.equal(model.notableEventCount, null);
  }
});

test("buildPhaseModels hides invalid and reversed time intervals", () => {
  const invalidEndpoints = [
    undefined,
    null,
    true,
    false,
    "",
    "   ",
    "1000",
    [],
    [1000],
    {},
    NaN,
    Infinity,
    -1,
  ];

  for (const invalidEndpoint of invalidEndpoints) {
    const invalidStart = buildPhaseModels({
      phaseContext: { early: { startMs: invalidEndpoint, endMs: 1000 } },
    }, {})[0];
    const invalidEnd = buildPhaseModels({
      phaseContext: { early: { startMs: 0, endMs: invalidEndpoint } },
    }, {})[0];

    assert.equal(invalidStart.timeRange, "시간 정보 없음");
    assert.equal(invalidEnd.timeRange, "시간 정보 없음");
  }

  const reversed = buildPhaseModels(
    {
      phaseContext: {
        early: {
          startMs: 2000,
          endMs: 1000,
          kills: 1,
          deaths: 2,
          assists: 3,
          notableEventCount: 4,
        },
      },
    },
    { phaseSummaries: [{ phase: "EARLY", summary: "초반 요약" }] },
  )[0];

  assert.equal(reversed.timeRange, "시간 정보 없음");
  assert.deepEqual(
    {
      kills: reversed.kills,
      deaths: reversed.deaths,
      assists: reversed.assists,
      notableEventCount: reversed.notableEventCount,
      summary: reversed.summary,
      hasContext: reversed.hasContext,
    },
    {
      kills: 1,
      deaths: 2,
      assists: 3,
      notableEventCount: 4,
      summary: "초반 요약",
      hasContext: true,
    },
  );
});

test("buildSkillProfile returns six ordered, clamped coaching scores", () => {
  const model = buildSkillProfile({
    playtimeScore: {
      overall: 11.24,
      label: "우수",
      categories: {
        combat: -2,
        income: 4.94,
        vision: 10,
        survival: null,
        objective: "7.2",
      },
    },
  });

  assert.equal(model.overall, 10);
  assert.equal(model.label, "우수");
  assert.deepEqual(
    model.categories.map(({ key, label, value, displayValue }) => ({
      key, label, value, displayValue,
    })),
    [
      { key: "combat", label: "전투", value: 0, displayValue: "0.0" },
      { key: "income", label: "수급", value: 4.9, displayValue: "4.9" },
      { key: "vision", label: "시야", value: 10, displayValue: "10.0" },
      { key: "survival", label: "생존", value: null, displayValue: "측정 없음" },
      { key: "objective", label: "오브젝트", value: 7.2, displayValue: "7.2" },
      { key: "structure", label: "구조물", value: null, displayValue: "측정 없음" },
    ],
  );
});

test("buildSkillProfile keeps an explicit all-missing profile", () => {
  const model = buildSkillProfile({});
  assert.equal(model.overall, null);
  assert.equal(model.categories.length, 6);
  assert.ok(model.categories.every((category) => category.value === null));
});

test("buildSkillProfile rejects invalid coaching score types as missing", () => {
  for (const invalidValue of [true, false, "   ", [], [7], {}, NaN, Infinity]) {
    const model = buildSkillProfile({
      playtimeScore: {
        overall: invalidValue,
        categories: { combat: invalidValue },
      },
    });

    assert.equal(model.overall, null);
    assert.equal(model.categories[0].value, null);
    assert.equal(model.categories[0].displayValue, "측정 없음");
  }
});

test("all committed samples produce focus, six skills, and three phases", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(repoRoot, "data", "samples", "manifest.json"), "utf8"),
  );
  const noSummarySamples = new Set([
    "sample-kr-8186180726",
    "sample-kr-8186417086",
  ]);
  const reversedPhaseModels = [];

  for (const sample of manifest.samples) {
    const [normalized, analysis] = await Promise.all([
      readFile(repoPath(sample.normalizedPath), "utf8").then(JSON.parse),
      readFile(repoPath(sample.analysisPath), "utf8").then(JSON.parse),
    ]);
    const focus = buildFocusModel(analysis);
    const profile = buildSkillProfile(normalized);
    const phases = buildPhaseModels(normalized, analysis);

    assert.ok(focus, `${sample.id}: missing focus`);
    assert.equal(profile.categories.length, 6, `${sample.id}: skill count`);
    assert.equal(phases.length, 3, `${sample.id}: phase count`);

    for (const phase of phases) {
      const context = normalized.phaseContext?.[phase.key];
      const startMs = context?.startMs;
      const endMs = context?.endMs;
      if (
        typeof startMs === "number"
        && Number.isFinite(startMs)
        && typeof endMs === "number"
        && Number.isFinite(endMs)
        && endMs < startMs
      ) {
        reversedPhaseModels.push({
          sampleId: sample.id,
          phase: phase.key,
          timeRange: phase.timeRange,
        });
      }
    }

    if (noSummarySamples.has(sample.id)) {
      for (const phase of phases.filter((model) => model.hasContext)) {
        assert.equal(phase.summary, "이 구간의 AI 요약이 없습니다.");
      }
    }
  }

  assert.ok(reversedPhaseModels.length > 0, "expected committed reversed intervals");
  assert.deepEqual(
    reversedPhaseModels.map((entry) => entry.timeRange),
    reversedPhaseModels.map(() => "시간 정보 없음"),
  );
  assert.ok(
    reversedPhaseModels.every(
      (entry) => !/^\d{2,}:\d{2}–\d{2,}:\d{2}$/.test(entry.timeRange),
    ),
    "reversed contexts must not emit a descending clock range",
  );
});
