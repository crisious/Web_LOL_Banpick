export const eventRichNormalized = {
  matchInfo: { result: "WIN" },
  playerStats: {
    cs: 214,
    csPerMinute: 7.1,
    visionScore: 28,
    killParticipation: 0.62,
  },
  timelineEvents: [
    {
      eventId: "evt_baron",
      timestampMs: 1740000,
      eventType: "BARON_FIGHT",
      summary: "바론을 확보했다.",
      importance: 10,
    },
    {
      eventId: "evt_low_early",
      timestampMs: 300000,
      eventType: "SKIRMISH_WIN",
      summary: "낮은 중요도의 초반 교전이었다.",
      importance: 1,
    },
    {
      eventId: "evt_dragon",
      timestampMs: 960000,
      eventType: "DRAGON_FIGHT",
      summary: "드래곤 교전을 이겼다.",
      importance: 8,
    },
    {
      eventId: "evt_death",
      timestampMs: 720000,
      eventType: "PLAYER_DEATH",
      summary: "강가에서 끊겼다.",
      importance: 6,
    },
    {
      eventId: "evt_tower",
      timestampMs: 1860000,
      eventType: "TOWER_TAKE",
      summary: "억제기 포탑을 철거했다.",
      importance: 7,
    },
    {
      eventId: "evt_kill",
      timestampMs: 420000,
      eventType: "CHAMPION_KILL",
      summary: "라인에서 직접 킬을 만들었다.",
      importance: 9,
    },
    {
      eventId: "evt_unknown",
      timestampMs: 1560000,
      eventType: "CUSTOM_SWING",
      summary: "중요한 운영 전환이 있었다.",
      importance: 5,
    },
    {
      eventId: "evt_followup",
      timestampMs: 1080000,
      eventType: "TEAMFIGHT_FOLLOWUP",
      summary: "후속 합류에 성공했다.",
      importance: 3,
    },
    {
      eventId: "evt_objective_fail",
      timestampMs: 840000,
      eventType: "OBJECTIVE_SETUP_FAIL",
      summary: "전령 주도권을 내줬다.",
      importance: 4,
    },
  ],
};

export const shortMatchNormalized = {
  matchInfo: { result: "LOSS" },
  playerStats: {
    cs: 42,
    csPerMinute: 3.5,
    visionScore: 4,
    killParticipation: 0.25,
  },
  timelineEvents: [
    {
      eventId: "evt_short_death",
      timestampMs: 240000,
      eventType: "PLAYER_DEATH",
      summary: "짧은 경기 초반에 데스가 발생했다.",
      importance: 7,
    },
  ],
};

export const emptyTimelineNormalized = {
  matchInfo: { result: "LOSS" },
  playerStats: {
    cs: 12,
    csPerMinute: 2.4,
    visionScore: 3,
    killParticipation: 0.125,
  },
  timelineEvents: [],
};

export const checklistWeaknesses = [
  { id: "weak_01", improvementHint: "첫 번째 개선 루틴" },
  { id: "weak_02", improvementHint: "두 번째 개선 루틴" },
  { id: "weak_03", improvementHint: "세 번째 개선 루틴" },
  { id: "weak_04", improvementHint: "네 번째 개선 루틴" },
  { id: "weak_05", improvementHint: "다섯 번째 개선 루틴" },
  { id: "weak_06", improvementHint: "상한 밖 개선 루틴" },
];
