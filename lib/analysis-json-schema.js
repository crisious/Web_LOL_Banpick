"use strict";

// analysis-json-schema.md §3, §4, §5 + server.js의 OUTPUT_SCHEMA_EXAMPLE 기준.
//
// 구조화 출력 제약: 재귀 불가, 수치/길이 제약 불가, 모든 object는 additionalProperties:false.
// 배열 최소 길이(phaseSummaries 3개, keyMoments 4개 등)는 여기서 강제할 수 없으므로
// server.js의 validateAnalysisOutput이 계속 담당한다.
//
// properties는 "문서에 적힌 것"이 아니라 "모델이 실제로 낼 수 있는 것"의 상위집합이어야 한다.
// additionalProperties:false는 나열하지 않은 키를 금지하므로, 빠뜨린 필드는 스키마가
// 막아버려 지금보다 나쁜 출력이 된다. 아래 목록은 세 출처의 합집합이다:
//   1. analysis-json-schema.md §4 필드 정의
//   2. data/samples의 저장된 AI 응답 36건에서 실제로 관측된 키
//   3. server.js가 프롬프트로 실제 요구하는 키 (OUTPUT_SCHEMA_EXAMPLE)
//
// 문서와 실데이터가 어긋난 지점은 실데이터를 따랐다 (아래 각 필드 주석 참조).
//
// analysisMeta.schemaViolations / schemaViolationCount는 제외한다 — 서버가 파싱 후
// 사후 기록하는 필드이므로 모델에게 생성시키지 않는다.

const PHASE_ENUM = ["EARLY", "MID", "LATE"];
const SITUATION_ENUM = ["PLAYER_DOMINANT", "PLAYER_DOWN", "TRADED"];
const OUTCOME_TAG_ENUM = [
  "INITIATED_KILL", "CAUGHT_OUT", "TRADE_WON", "TRADE_LOST",
  "TRADE_EVEN", "CLOSED_OUT", "OVERCHASE_DEATH", "DIED_IN_FIGHT",
];
const RECOMMENDATION_CODE_ENUM = [
  "GROUP_BEFORE_OBJECTIVE", "DECIDE_JOIN_OR_TRADE_EARLY",
  "REVIEW_OPENING_DEATH", "RESET_AFTER_CAPTURE",
];

const stringArray = { type: "array", items: { type: "string" } };

const ANALYSIS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  // §5 최소 유효 응답 조건이 요구하는 필드. combatAnalysis / teamfightPhaseAnalysis는
  // "있는 경우" 검증이지만 프롬프트가 항상 요구하므로(없으면 빈 배열) required에 넣어
  // 누락 위반을 없앤다.
  required: [
    "schemaVersion", "analysisMeta", "matchSummary", "coachSummary",
    "phaseSummaries", "strengths", "weaknesses", "actionChecklist",
    "keyMoments", "evidenceIndex", "combatAnalysis", "teamfightPhaseAnalysis",
  ],
  properties: {
    schemaVersion: { type: "string" },

    // §4.2는 이 객체를 "계약상 닫힌 집합 아님"이라고 명시하지만 구조화 출력은
    // additionalProperties:false를 요구한다. 관측된 레거시 키를 모두 포함해
    // 기존 출력이 막히지 않게 한다.
    analysisMeta: {
      type: "object",
      additionalProperties: false,
      required: ["sourceType", "language"],
      properties: {
        analysisId: { type: "string" },
        generatedAt: { type: "string" },
        sourceType: { type: "string" },
        language: { type: "string" },
        confidence: { type: "number" },
        analysisMode: { type: "string" },
        schemaVersion: { type: "string" },
        matchId: { type: "string" },
        champion: { type: "string" },
        position: { type: "string" },
        result: { type: "string" },
        participantId: { type: "number" },
        riotId: { type: "string" },
        playerRiotId: { type: "string" },
      },
    },

    matchSummary: {
      type: "object",
      additionalProperties: false,
      required: ["headline"],
      properties: {
        matchId: { type: "string" },
        queueType: { type: "string" },
        gameVersion: { type: "string" },
        durationSeconds: { type: "number" },
        result: { type: "string" },
        champion: { type: "string" },
        role: { type: "string" },
        headline: { type: "string" },
      },
    },

    coachSummary: {
      type: "object",
      additionalProperties: false,
      required: ["overallSummary"],
      properties: {
        overallSummary: { type: "string" },
        gameFlowSummary: { type: "string" },
        winLossReason: { type: "string" },
      },
    },

    // §4.5는 rating/focus를 정의하지만 실데이터 36건에서 0회 관측.
    // 실제로는 label/headline/detail이 쓰인다. 양쪽 모두 허용한다.
    phaseSummaries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phase", "summary"],
        properties: {
          phase: { type: "string", enum: PHASE_ENUM },
          summary: { type: "string" },
          rating: { type: "string" },
          focus: { type: "string" },
          label: { type: "string" },
          headline: { type: "string" },
          detail: { type: "string" },
        },
      },
    },

    strengths: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "description", "relatedEventIds"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          detail: { type: "string" },
          evidence: { type: "string" },
          impact: { type: "string" },
          relatedEventIds: stringArray,
        },
      },
    },

    weaknesses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "description", "relatedEventIds"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          detail: { type: "string" },
          evidence: { type: "string" },
          impact: { type: "string" },
          improvementHint: { type: "string" },
          relatedEventIds: stringArray,
        },
      },
    },

    // §4.8은 action/reason에 priority:number를 정의하지만 실데이터는 text/
    // linkedWeaknessId를 쓰고 priority가 string이다. 프롬프트도 text를 요구하므로
    // text를 required로 두고 문서 필드는 선택으로 허용한다.
    actionChecklist: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          detail: { type: "string" },
          linkedWeaknessId: { type: "string" },
          priority: { anyOf: [{ type: "string" }, { type: "number" }] },
          action: { type: "string" },
          reason: { type: "string" },
          relatedEventIds: stringArray,
        },
      },
    },

    // §4.9의 별칭(eventId/id, timestamp/timestampLabel, label/title, reason/description)은
    // 양쪽 다 허용하되, required는 프롬프트가 실제로 지시하는 이름으로 맞춘다.
    keyMoments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "timestampLabel", "phase", "title", "description", "relatedEventIds"],
        properties: {
          id: { type: "string" },
          eventId: { type: "string" },
          timestampLabel: { type: "string" },
          timestamp: { type: "string" },
          phase: { type: "string", enum: PHASE_ENUM },
          title: { type: "string" },
          label: { type: "string" },
          description: { type: "string" },
          reason: { type: "string" },
          detail: { type: "string" },
          impact: { type: "string" },
          importance: { type: "number" },
          relatedEventIds: stringArray,
        },
      },
    },

    // §4.10은 timestamp/summary/statNote를 정의하지만 실데이터는
    // timestampLabel/shortNote/usedIn/importance/phase를 쓴다. 전부 허용한다.
    evidenceIndex: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["eventId", "shortNote"],
        properties: {
          eventId: { type: "string" },
          shortNote: { type: "string" },
          summary: { type: "string" },
          timestampLabel: { type: "string" },
          timestamp: { type: "string" },
          eventType: { type: "string" },
          statNote: { type: "string" },
          phase: { type: "string" },
          importance: { type: "number" },
          usedIn: stringArray,
        },
      },
    },

    combatAnalysis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "encounterId", "situation", "situationLabel",
          "playerDecision", "takeaway", "relatedEventIds",
        ],
        properties: {
          encounterId: { type: "string" },
          // validateAnalysisOutput이 enum 외 값에 throw하므로 스키마로 고정한다.
          situation: { type: "string", enum: SITUATION_ENUM },
          situationLabel: { type: "string" },
          playerDecision: { type: "string" },
          takeaway: { type: "string" },
          relatedEventIds: stringArray,
        },
      },
    },

    teamfightPhaseAnalysis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["teamfightId", "phases", "takeaway"],
        properties: {
          teamfightId: { type: "string" },
          gamePhase: { type: "string", enum: PHASE_ENUM },
          startLabel: { type: "string" },
          endLabel: { type: "string" },
          totalKills: { type: "number" },
          totalDeaths: { type: "number" },
          situation: { type: "string", enum: SITUATION_ENUM },
          takeaway: { type: "string" },
          phases: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "phase", "outcomeTag", "playerKills",
                "playerDeaths", "coaching", "relatedEventIds",
              ],
              properties: {
                phase: { type: "string", enum: ["ENGAGE", "TRADE", "CLEANUP"] },
                startLabel: { type: "string" },
                endLabel: { type: "string" },
                playerKills: { type: "number" },
                playerDeaths: { type: "number" },
                outcomeTag: { type: "string", enum: OUTCOME_TAG_ENUM },
                coaching: { type: "string" },
                relatedEventIds: stringArray,
              },
            },
          },
        },
      },
    },

    // §4.13: 서버가 원본 타임라인에서 파생하는 필드다. "최종 응답의 사실, 시각,
    // 위치, 획득 팀, fact ID는 AI가 생성하거나 수정할 수 없다"이며 실제로 저장된
    // AI 응답 36건에서 0회 관측됐다. §3 최상위 목록에 있으므로 키 자체는 허용하되,
    // 속성 없는 닫힌 객체로 두어 사실 날조를 스키마 수준에서 막는다.
    teamplayAnalysisV2: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },

    // teamplayAnalysisV2에 대한 AI의 유일한 기여. §3 최상위 목록에는 없지만
    // server.js의 OUTPUT_SCHEMA_EXAMPLE이 명시적으로 요구한다. 여기서 빠지면
    // additionalProperties:false가 프롬프트가 지시한 필드를 금지해버린다.
    // 검증 후 최종 응답에서 삭제되는 임시 봉투다 (§4.13).
    teamplayRecommendationSelections: {
      type: "object",
      additionalProperties: false,
      required: ["reviews"],
      properties: {
        reviews: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["reviewId", "recommendationCode", "evidenceIds"],
            properties: {
              reviewId: { type: "string" },
              recommendationCode: { type: "string", enum: RECOMMENDATION_CODE_ENUM },
              evidenceIds: stringArray,
            },
          },
        },
      },
    },
  },
};

module.exports = {
  ANALYSIS_OUTPUT_SCHEMA,
  PHASE_ENUM,
  SITUATION_ENUM,
  OUTCOME_TAG_ENUM,
  RECOMMENDATION_CODE_ENUM,
};
