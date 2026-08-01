"use strict";

const KEY_MOMENTS_MIN = 4;
const ACTION_CHECKLIST_MIN = 3;
const ACTION_CHECKLIST_MAX = 5;
const ELITE_OBJECTIVE_FIGHT_EVENT_TYPES = new Set(["DRAGON_FIGHT", "BARON_FIGHT"]);
const STRUCTURE_TAKE_EVENT_TYPES = new Set(["TOWER_TAKE"]);
const PLAYER_DEATH_EVENT_TYPES = new Set(["PLAYER_DEATH"]);

function timestampLabel(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function phaseFor(timestampMs) {
  if (timestampMs <= 900000) {
    return "EARLY";
  }
  if (timestampMs <= 1800000) {
    return "MID";
  }
  return "LATE";
}

function rawEventTimestampMs(event) {
  return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : 0;
}

function isEliteObjectiveFightEvent(event) {
  return ELITE_OBJECTIVE_FIGHT_EVENT_TYPES.has(event.eventType);
}

function isStructureTakeEvent(event) {
  return STRUCTURE_TAKE_EVENT_TYPES.has(event.eventType);
}

function isPlayerDeathEvent(event) {
  return PLAYER_DEATH_EVENT_TYPES.has(event.eventType);
}

function labelForMoment(event) {
  const map = {
    PLAYER_DEATH: "중요 데스",
    CHAMPION_KILL: "직접 킬 확보",
    TEAMFIGHT_FOLLOWUP: "후속 합류 성공",
    SKIRMISH_WIN: "소규모 교전 우세",
    DRAGON_FIGHT: "드래곤 타이밍",
    BARON_FIGHT: "바론 구도",
    OBJECTIVE_SETUP_WIN: "정글 오브젝트 확보",
    OBJECTIVE_SETUP_FAIL: "오브젝트 손실",
    TOWER_TAKE: "구조물 압박",
  };
  return map[event.eventType] || "핵심 장면";
}

function impactForMoment(event, result) {
  if (isPlayerDeathEvent(event)) {
    return result === "WIN" ? "이기는 흐름을 다소 늦췄다." : "팀 운영이 크게 흔들렸다.";
  }
  if (isEliteObjectiveFightEvent(event)) {
    return "오브젝트 주도권에 직접 영향을 줬다.";
  }
  if (isStructureTakeEvent(event)) {
    return "승리 조건을 구조물로 전환했다.";
  }
  return "교전 흐름을 유리하게 만드는 장면이었다.";
}

function buildActionChecklist(normalized, weaknesses) {
  const checklistWeaknesses = Array.isArray(weaknesses) ? weaknesses.slice(0, ACTION_CHECKLIST_MAX) : [];
  while (checklistWeaknesses.length < ACTION_CHECKLIST_MIN) {
    checklistWeaknesses.push({ improvementHint: "체크리스트 최소 항목을 채우기 위한 기본 개선 루틴" });
  }
  return checklistWeaknesses.map((item, index) => ({
    id: `act_0${index + 1}`,
    priority: index + 1,
    action:
      index === 0
        ? "초반 주요 구도 직후에는 한 템포 먼저 빠지는 기준 만들기"
        : index === 1
          ? "교전이 비는 구간에는 웨이브나 캠프를 더 확실하게 챙겨 자원 손실 줄이기"
          : index === 2
            ? "드래곤·바론 직후에는 추가 추격보다 리셋과 라인 정리를 먼저 선택하기"
            : "시야가 밀릴 때는 contest와 이탈 중 하나를 더 빠르게 결정하기",
    reason: item.improvementHint,
  }));
}

function buildKeyMoments(normalized) {
  const timelineEvents = Array.isArray(normalized.timelineEvents) ? normalized.timelineEvents : [];
  const moments = timelineEvents
    .slice()
    .sort((a, b) => {
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      const aTime = rawEventTimestampMs({ timestamp: a.timestampMs });
      const bTime = rawEventTimestampMs({ timestamp: b.timestampMs });
      return aTime - bTime;
    })
    .slice(0, 7)
    .sort((a, b) => {
      const aTime = rawEventTimestampMs({ timestamp: a.timestampMs });
      const bTime = rawEventTimestampMs({ timestamp: b.timestampMs });
      return aTime - bTime;
    })
    .map((event) => {
      const time = rawEventTimestampMs({ timestamp: event.timestampMs });
      return {
        eventId: event.eventId,
        timestamp: timestampLabel(time),
        phase: phaseFor(time),
        label: labelForMoment(event),
        reason: event.summary,
        impact: impactForMoment(event, normalized.matchInfo.result),
        importance: event.importance,
        relatedEventIds: [event.eventId],
      };
    });

  const fallbackTemplates = [
    {
      phase: "EARLY",
      label: "초반 흐름 점검",
      reason: "핵심 이벤트가 부족해 초반 안정성과 첫 전환 루틴을 기본 점검 항목으로 보완했다.",
      impact: "짧은 경기에서도 초반 판단 기준을 남긴다.",
      relatedEventIds: ["stat_cs"],
    },
    {
      phase: "MID",
      label: "중반 자원 전환 점검",
      reason: `총 CS ${normalized.playerStats?.cs ?? 0}, 분당 CS ${normalized.playerStats?.csPerMinute ?? 0} 기준으로 자원 전환을 확인한다.`,
      impact: "이벤트가 적어도 성장 흐름을 복기할 수 있게 한다.",
      relatedEventIds: ["stat_cs"],
    },
    {
      phase: "LATE",
      label: "시야와 합류 점검",
      reason: `비전 점수 ${normalized.playerStats?.visionScore ?? 0}, 킬 관여율 ${Math.round((normalized.playerStats?.killParticipation ?? 0) * 100)}% 기준으로 합류 품질을 확인한다.`,
      impact: "근거 이벤트가 부족한 경기에서도 시야와 합류 축을 유지한다.",
      relatedEventIds: ["stat_vision"],
    },
    {
      phase: "LATE",
      label: "다음 경기 루틴",
      reason: "타임라인 근거가 적을 때는 라인 정리, 시야 확보, 오브젝트 전 리콜 타이밍을 기본 루틴으로 점검한다.",
      impact: "리포트가 최소 코칭 카드 수를 유지하면서 다음 행동으로 연결된다.",
      relatedEventIds: ["stat_vision"],
    },
  ];

  while (moments.length < KEY_MOMENTS_MIN) {
    const index = moments.length;
    const template = fallbackTemplates[index % fallbackTemplates.length];
    moments.push({
      eventId: `fallback_key_moment_${String(index + 1).padStart(2, "0")}`,
      timestamp: "FULL",
      phase: template.phase,
      label: template.label,
      reason: template.reason,
      impact: template.impact,
      importance: 1,
      relatedEventIds: template.relatedEventIds,
    });
  }

  return moments;
}

module.exports = {
  buildActionChecklist,
  buildKeyMoments,
};
