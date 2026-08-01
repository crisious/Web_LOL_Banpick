import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  checklistWeaknesses,
  emptyTimelineNormalized,
  eventRichNormalized,
  shortMatchNormalized,
} from "../fixtures/rule-based-fallback-fixtures.mjs";

const require = createRequire(import.meta.url);
const {
  buildActionChecklist,
  buildKeyMoments,
} = require("../../lib/rule-based-fallback.js");

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

test("buildKeyMoments caps event-rich matches at seven and orders selected events by timestamp", () => {
  const moments = buildKeyMoments(eventRichNormalized);

  assert.equal(moments.length, 7);
  assert.deepEqual(
    moments.map((item) => item.eventId),
    [
      "evt_kill",
      "evt_death",
      "evt_objective_fail",
      "evt_dragon",
      "evt_unknown",
      "evt_baron",
      "evt_tower",
    ],
  );
});

test("buildKeyMoments maps event fields, labels, phases, and impacts", () => {
  assert.deepEqual(buildKeyMoments(eventRichNormalized), [
    {
      eventId: "evt_kill",
      timestamp: "7:00",
      phase: "EARLY",
      label: "직접 킬 확보",
      reason: "라인에서 직접 킬을 만들었다.",
      impact: "교전 흐름을 유리하게 만드는 장면이었다.",
      importance: 9,
      relatedEventIds: ["evt_kill"],
    },
    {
      eventId: "evt_death",
      timestamp: "12:00",
      phase: "EARLY",
      label: "중요 데스",
      reason: "강가에서 끊겼다.",
      impact: "이기는 흐름을 다소 늦췄다.",
      importance: 6,
      relatedEventIds: ["evt_death"],
    },
    {
      eventId: "evt_objective_fail",
      timestamp: "14:00",
      phase: "EARLY",
      label: "오브젝트 손실",
      reason: "전령 주도권을 내줬다.",
      impact: "교전 흐름을 유리하게 만드는 장면이었다.",
      importance: 4,
      relatedEventIds: ["evt_objective_fail"],
    },
    {
      eventId: "evt_dragon",
      timestamp: "16:00",
      phase: "MID",
      label: "드래곤 타이밍",
      reason: "드래곤 교전을 이겼다.",
      impact: "오브젝트 주도권에 직접 영향을 줬다.",
      importance: 8,
      relatedEventIds: ["evt_dragon"],
    },
    {
      eventId: "evt_unknown",
      timestamp: "26:00",
      phase: "MID",
      label: "핵심 장면",
      reason: "중요한 운영 전환이 있었다.",
      impact: "교전 흐름을 유리하게 만드는 장면이었다.",
      importance: 5,
      relatedEventIds: ["evt_unknown"],
    },
    {
      eventId: "evt_baron",
      timestamp: "29:00",
      phase: "MID",
      label: "바론 구도",
      reason: "바론을 확보했다.",
      impact: "오브젝트 주도권에 직접 영향을 줬다.",
      importance: 10,
      relatedEventIds: ["evt_baron"],
    },
    {
      eventId: "evt_tower",
      timestamp: "31:00",
      phase: "LATE",
      label: "구조물 압박",
      reason: "억제기 포탑을 철거했다.",
      impact: "승리 조건을 구조물로 전환했다.",
      importance: 7,
      relatedEventIds: ["evt_tower"],
    },
  ]);
});

test("buildKeyMoments pads a sparse short match to four cards", () => {
  assert.deepEqual(buildKeyMoments(shortMatchNormalized), [
    {
      eventId: "evt_short_death",
      timestamp: "4:00",
      phase: "EARLY",
      label: "중요 데스",
      reason: "짧은 경기 초반에 데스가 발생했다.",
      impact: "팀 운영이 크게 흔들렸다.",
      importance: 7,
      relatedEventIds: ["evt_short_death"],
    },
    {
      eventId: "fallback_key_moment_02",
      timestamp: "FULL",
      phase: "MID",
      label: "중반 자원 전환 점검",
      reason: "총 CS 42, 분당 CS 3.5 기준으로 자원 전환을 확인한다.",
      impact: "이벤트가 적어도 성장 흐름을 복기할 수 있게 한다.",
      importance: 1,
      relatedEventIds: ["stat_cs"],
    },
    {
      eventId: "fallback_key_moment_03",
      timestamp: "FULL",
      phase: "LATE",
      label: "시야와 합류 점검",
      reason: "비전 점수 4, 킬 관여율 25% 기준으로 합류 품질을 확인한다.",
      impact: "근거 이벤트가 부족한 경기에서도 시야와 합류 축을 유지한다.",
      importance: 1,
      relatedEventIds: ["stat_vision"],
    },
    {
      eventId: "fallback_key_moment_04",
      timestamp: "FULL",
      phase: "LATE",
      label: "다음 경기 루틴",
      reason: "타임라인 근거가 적을 때는 라인 정리, 시야 확보, 오브젝트 전 리콜 타이밍을 기본 루틴으로 점검한다.",
      impact: "리포트가 최소 코칭 카드 수를 유지하면서 다음 행동으로 연결된다.",
      importance: 1,
      relatedEventIds: ["stat_vision"],
    },
  ]);
});

test("buildKeyMoments returns four stat-backed fallback cards for an empty timeline", () => {
  assert.deepEqual(buildKeyMoments(emptyTimelineNormalized), [
    {
      eventId: "fallback_key_moment_01",
      timestamp: "FULL",
      phase: "EARLY",
      label: "초반 흐름 점검",
      reason: "핵심 이벤트가 부족해 초반 안정성과 첫 전환 루틴을 기본 점검 항목으로 보완했다.",
      impact: "짧은 경기에서도 초반 판단 기준을 남긴다.",
      importance: 1,
      relatedEventIds: ["stat_cs"],
    },
    {
      eventId: "fallback_key_moment_02",
      timestamp: "FULL",
      phase: "MID",
      label: "중반 자원 전환 점검",
      reason: "총 CS 12, 분당 CS 2.4 기준으로 자원 전환을 확인한다.",
      impact: "이벤트가 적어도 성장 흐름을 복기할 수 있게 한다.",
      importance: 1,
      relatedEventIds: ["stat_cs"],
    },
    {
      eventId: "fallback_key_moment_03",
      timestamp: "FULL",
      phase: "LATE",
      label: "시야와 합류 점검",
      reason: "비전 점수 3, 킬 관여율 13% 기준으로 합류 품질을 확인한다.",
      impact: "근거 이벤트가 부족한 경기에서도 시야와 합류 축을 유지한다.",
      importance: 1,
      relatedEventIds: ["stat_vision"],
    },
    {
      eventId: "fallback_key_moment_04",
      timestamp: "FULL",
      phase: "LATE",
      label: "다음 경기 루틴",
      reason: "타임라인 근거가 적을 때는 라인 정리, 시야 확보, 오브젝트 전 리콜 타이밍을 기본 루틴으로 점검한다.",
      impact: "리포트가 최소 코칭 카드 수를 유지하면서 다음 행동으로 연결된다.",
      importance: 1,
      relatedEventIds: ["stat_vision"],
    },
  ]);
});

test("buildKeyMoments always exposes the required output fields", () => {
  const outputs = [
    ...buildKeyMoments(eventRichNormalized),
    ...buildKeyMoments(shortMatchNormalized),
    ...buildKeyMoments(emptyTimelineNormalized),
  ];

  for (const item of outputs) {
    assert.deepEqual(Object.keys(item).sort(), [
      "eventId",
      "impact",
      "importance",
      "label",
      "phase",
      "reason",
      "relatedEventIds",
      "timestamp",
    ]);
  }
});

test("buildActionChecklist caps weaknesses at five and preserves input order as priority", () => {
  assert.deepEqual(buildActionChecklist({}, checklistWeaknesses), [
    {
      id: "act_01",
      priority: 1,
      action: "초반 주요 구도 직후에는 한 템포 먼저 빠지는 기준 만들기",
      reason: "첫 번째 개선 루틴",
    },
    {
      id: "act_02",
      priority: 2,
      action: "교전이 비는 구간에는 웨이브나 캠프를 더 확실하게 챙겨 자원 손실 줄이기",
      reason: "두 번째 개선 루틴",
    },
    {
      id: "act_03",
      priority: 3,
      action: "드래곤·바론 직후에는 추가 추격보다 리셋과 라인 정리를 먼저 선택하기",
      reason: "세 번째 개선 루틴",
    },
    {
      id: "act_04",
      priority: 4,
      action: "시야가 밀릴 때는 contest와 이탈 중 하나를 더 빠르게 결정하기",
      reason: "네 번째 개선 루틴",
    },
    {
      id: "act_05",
      priority: 5,
      action: "시야가 밀릴 때는 contest와 이탈 중 하나를 더 빠르게 결정하기",
      reason: "다섯 번째 개선 루틴",
    },
  ]);
});

const paddedChecklist = [
  {
    id: "act_01",
    priority: 1,
    action: "초반 주요 구도 직후에는 한 템포 먼저 빠지는 기준 만들기",
    reason: "체크리스트 최소 항목을 채우기 위한 기본 개선 루틴",
  },
  {
    id: "act_02",
    priority: 2,
    action: "교전이 비는 구간에는 웨이브나 캠프를 더 확실하게 챙겨 자원 손실 줄이기",
    reason: "체크리스트 최소 항목을 채우기 위한 기본 개선 루틴",
  },
  {
    id: "act_03",
    priority: 3,
    action: "드래곤·바론 직후에는 추가 추격보다 리셋과 라인 정리를 먼저 선택하기",
    reason: "체크리스트 최소 항목을 채우기 위한 기본 개선 루틴",
  },
];

test("buildActionChecklist pads an empty weakness array to three actions", () => {
  assert.deepEqual(buildActionChecklist({}, []), paddedChecklist);
});

test("buildActionChecklist treats a non-array weakness payload as empty", () => {
  assert.deepEqual(
    buildActionChecklist({}, { improvementHint: "배열이 아닌 입력" }),
    paddedChecklist,
  );
});

test("buildActionChecklist always exposes the required output fields", () => {
  const outputs = [
    ...buildActionChecklist({}, checklistWeaknesses),
    ...buildActionChecklist({}, []),
    ...buildActionChecklist({}, null),
  ];

  for (const item of outputs) {
    assert.deepEqual(Object.keys(item).sort(), ["action", "id", "priority", "reason"]);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
