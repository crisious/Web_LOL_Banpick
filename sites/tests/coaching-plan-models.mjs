import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFocusModel,
  findFocusMomentId,
} from "../app/coaching-plan.js";

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
