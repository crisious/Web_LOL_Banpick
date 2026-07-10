# 개인 중심 오브젝트 교전·한타 분석 v2 설계

- 상태: 설계 승인·문서 검토 요청
- 작성일: 2026-07-10
- 대상: 게임 리플레이 분석의 오브젝트 교전·한타 분석
- 제품 우선순위: 개인 판단과 포지셔닝을 본문으로 제안하고, 팀 단위 분석은 별도 부록으로 제공

## 1. 배경

현재 전투 분석은 대상 플레이어의 직접 킬과 데스를 중심으로 사건을 추출한다. 어시스트는 별도 후속 이벤트로 변환되고, 대상 플레이어가 직접 관여하지 않은 나머지 9명의 킬·데스 흐름은 교전 묶음에서 빠진다. 그 결과 다음 문제가 발생한다.

1. 같은 오브젝트를 두고 양 팀이 어떻게 진입하고 교환했는지 재구성하기 어렵다.
2. 어시스트와 주변 위치를 개인의 실제 관여로 일관되게 판정하지 못한다.
3. 저장된 기존 샘플 27개에서 teamfightPhaseAnalysis가 모두 비어 있어 한타 단계 분석이 실질적으로 동작하지 않는다.
4. 오브젝트를 획득한 팀과 교전에서 이득을 본 팀이 분리되지 않는다.
5. 현재 양 팀 타임라인은 일부 개인 킬·데스를 아군·상대로 표시하므로 실제 팀 전체 흐름처럼 오해될 수 있다.
6. 위치 프레임의 시간 차이를 노출하지 않아 포지셔닝 설명의 근거 강도가 불명확하다.

이 설계는 기존 분석을 제거하지 않고, 전체 타임라인으로 객관적 사실을 만드는 병렬 v2 모델을 추가한다.

## 2. 목표

### 2.1 제품 목표

사용자가 리포트를 읽고 다음 경기에서 자신의 진입 시점, 아군과의 거리, 오브젝트 전 위치 선정과 이탈 판단 중 무엇을 바꿔야 하는지 알 수 있어야 한다.

### 2.2 기능 목표

1. 전체 10명의 킬·어시스트·사망·오브젝트 사건을 이용해 픽, 소규모 교전, 한타 후보를 결정적으로 분류한다.
2. 오브젝트 전 준비, 쟁탈, 결과, 후속 전환을 하나의 진행 흐름으로 연결한다.
3. 개인의 직접 관여와 위치 기반 추정 관여를 구분한다.
4. 개인 코칭에는 확인 가능한 사실과 근거만 사용한다.
5. 팀 단위 비교는 개인 코칭의 맥락을 보완하는 접힌 부록으로 제공한다.
6. AI는 서버가 계산한 eligible recommendationCode만 선택하고, 최종 설명과 행동 제안 문구는 서버 템플릿이 생성한다.
7. 원본 데이터가 부족하거나 AI가 실패해도 가능한 범위의 사실 분석을 표시한다.

## 3. 비목표

이번 범위에서는 다음을 구현하지 않는다.

- 영상 프레임 또는 실시간 리플레이 파일 분석
- 시야에 보였는지 여부를 위치 데이터만으로 단정
- 스킬 사용 순서, 조준, 콤보 등 챔피언별 미세 조작 분석
- 확인되지 않은 의도, 콜, 감정 또는 인과관계 추정
- 새로운 원시 경기 샘플이나 임시 QA 산출물 커밋
- 기존 combatAnalysis, teamfightPhaseAnalysis 필드 제거
- 이번 목표와 무관한 전체 분석 화면 리디자인

## 4. 선택한 접근

### 4.1 결정

기존 응답을 호환용으로 유지하면서 teamplayAnalysisV2를 병렬 추가한다. 서버는 원본 타임라인에서 사실 모델과 허용 코칭 후보를 만들고, AI는 후보 코드만 선택한다. 최종 문구는 서버 템플릿이 생성한다. 화면은 renderable v2를 우선 사용하고 v2를 표시할 수 없을 때 기존 데이터를 표시한다.

### 4.2 검토한 대안

#### 기존 개인 중심 로직 확장

구현 속도는 빠르지만 대상 플레이어 밖의 사건을 안정적으로 비교하기 어렵고 현재의 빈 한타 단계 문제를 구조적으로 해결하지 못한다.

#### LLM 중심 원시 타임라인 요약

서술을 빠르게 만들 수 있지만 동일 경기 결과가 달라질 수 있고 위치, 인원, 결과, 인과관계 환각을 계약 테스트로 통제하기 어렵다.

#### 병렬 v2 사실 모델과 제한된 AI 코칭 선택

구현 범위는 더 크지만 정확성, 재현성, 테스트 가능성, 이전 데이터 호환성이 가장 좋다. 이 대안을 채택한다.

## 5. 아키텍처

분석은 다음의 독립된 단계로 구성한다.

1. 참가자 정규화
   - 대상 플레이어의 teamId를 기준으로 모든 참가자를 ALLY 또는 ENEMY로 변환한다.
   - 알 수 없는 참가자나 팀은 UNKNOWN으로 유지한다.
2. 원본 사실 추출
   - 전체 CHAMPION_KILL 사건에서 killerId, victimId, assistingParticipantIds, timestamp, position을 보존한다.
   - 중립 오브젝트와 구조물 사건을 정규화한다.
   - participantFrames에서 골드, 레벨, 체력, 위치와 프레임 시각을 보존한다.
3. 교전 탐지
   - 킬 사건을 시간과 거리 규칙으로 묶고 PICK, SKIRMISH, TEAMFIGHT_CANDIDATE로 분류한다.
4. 오브젝트 진행 연결
   - 오브젝트를 기준으로 준비, 쟁탈, 후속 전환 구간을 만들고 가까운 교전을 연결한다.
5. 장면 통합
   - 연결된 오브젝트 진행과 교전을 하나의 sceneId로 통합해 같은 장면이 개인 리뷰에 중복되지 않게 한다.
6. 개인 사실 생성
   - 직접 관여, 추정 관여, 위치, 아군과의 거리, 첫 기록 시점, 생존과 결과를 생성한다.
7. 중요도 순위
   - 결정적 점수로 개인 리뷰 후보를 정렬한다.
8. AI 코칭 선택
   - 서버 사실을 변경할 수 없는 recommendationCode 계약으로 허용된 제안 하나를 선택한다.
9. 응답 조립
   - 서버 fact template과 검증된 recommendation template을 사실 모델에 결합하고 teamplayAnalysisV2로 반환한다.

각 단계는 입력과 출력이 명확한 순수 함수 또는 경계 모듈로 구현한다. 원본 추출, 교전 탐지, 오브젝트 연결, 개인 리뷰, AI 검증, UI 렌더링을 서로 분리해 한 단계의 변경이 다른 단계의 사실 계약을 바꾸지 않도록 한다.

## 6. 데이터 계약

최상위 신규 필드는 다음 형태를 사용한다.

~~~json
{
  "teamplayAnalysisV2": {
    "schemaVersion": "2.0",
    "coverage": {
      "level": "PARTIAL",
      "source": "RAW_TIMELINE",
      "usablePositionSceneRatio": 0.6,
      "limitationCodes": ["PARTIAL_POSITION_FRAMES"]
    },
    "encounters": [],
    "objectiveEngagements": [],
    "scenes": [],
    "personalReviews": [],
    "teamAppendix": []
  }
}
~~~

### 6.1 공통 근거 계약

모든 교전, 오브젝트 진행, 개인 리뷰에는 다음 정보가 있어야 한다.

- 도메인 ID: encounter는 id, 개인 리뷰는 reviewId처럼 동일 입력에서 항상 같은 값을 만드는 안정적 ID
- sourceRefs: 원본 타임라인 사건 또는 참가자 프레임을 가리키는 1개 이상의 typed 참조
- startTimestamp, endTimestamp
- confidence: HIGH, MEDIUM, LOW 중 하나
- limitationCodes: 적용된 데이터 한계 enum 목록

타임라인 사건 ID는 matchId:frameIndex:eventIndex, 참가자 프레임 ID는 matchId:frameIndex:participantId 형식으로 생성한다. sourceRef는 다음 형태다.

~~~json
{
  "kind": "TIMELINE_EVENT",
  "id": "KR_123:18:4",
  "timestamp": 1122000,
  "participantId": null
}
~~~

kind는 TIMELINE_EVENT 또는 PARTICIPANT_FRAME이다. PARTICIPANT_FRAME은 participantId를 필수로 가진다. 도메인 ID는 schemaVersion, matchId, 도메인 종류, 시작 시각, 정렬된 sourceRef ID를 canonical JSON으로 직렬화해 SHA-256 해시하고 도메인 접두사와 앞 20개 hexadecimal 문자를 결합한다. ID는 배열 순서나 AI 응답 순서에 의존하지 않는다.

개인 리뷰의 situationFacts, decisionFacts, positioningFacts, outcomeFacts와 팀 부록의 사실은 공통 fact atom 배열로 표현한다.

~~~json
{
  "factId": "fact_0123456789abcdefabcd",
  "type": "PLAYER_DISTANCE_2500_5000",
  "timestamp": 1122000,
  "value": {
    "distance": 2840
  },
  "confidence": "MEDIUM",
  "sourceRefs": [
    {
      "kind": "PARTICIPANT_FRAME",
      "id": "KR_123:18:7",
      "timestamp": 1120000,
      "participantId": 7
    },
    {
      "kind": "TIMELINE_EVENT",
      "id": "KR_123:18:4",
      "timestamp": 1122000,
      "participantId": null
    }
  ],
  "limitationCodes": []
}
~~~

factId는 AI가 인용할 수 있는 evidence ID다. SHA-256으로 schemaVersion, reviewId, type, timestamp, 정렬된 sourceRef ID, canonical JSON value를 해시하고 앞 20개 hexadecimal 문자를 fact_ 접두사 뒤에 붙인다. 거리 좌표와 시간은 해시 전에 정수로 반올림한다. AI는 sourceRefs를 직접 인용하지 않고 factId를 사용한다. decisionFacts는 확인된 킬·어시스트·사망 기록과 위치 거리처럼 관찰 가능한 행동만 담으며 의도나 원인을 담지 않는다.

fact type은 다음 closed enum을 사용한다.

- ENCOUNTER_CLASSIFICATION
- ALLY_DEATH_COUNT
- ENEMY_DEATH_COUNT
- FIRST_TAKEDOWN_TEAM
- PLAYER_CONFIRMED_KILL
- PLAYER_CONFIRMED_ASSIST
- PLAYER_CONFIRMED_DEATH
- PLAYER_FIRST_RECORDED_INVOLVEMENT
- PLAYER_DISTANCE_LE_2500
- PLAYER_DISTANCE_2500_5000
- PLAYER_DISTANCE_GT_5000
- NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT
- OBJECTIVE_CAPTURE_TEAM
- OBJECTIVE_CAPTURE_COUNTS
- PLAYER_OBJECTIVE_KILLER
- PLAYER_OBJECTIVE_ASSIST
- STRUCTURE_CONVERSION
- PRE_ENCOUNTER_GOLD_DIFFERENCE
- PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE

각 type의 value shape는 JSON Schema의 discriminated union으로 검증한다. 예를 들어 거리 type은 distance, frameTimestamp, frameAgeSeconds를, 사망·킬·어시스트 type은 participantId, phase, eventTimestamp를 필수로 가진다. enum 추가는 schemaVersion 변경 없이 허용하지 않는다.

playerInvolvement는 모든 도메인에서 같은 객체를 사용한다.

~~~json
{
  "level": "CONFIRMED",
  "records": [
    {
      "basis": "ASSIST",
      "stage": "CONTEST",
      "sourceRefs": [
        {
          "kind": "TIMELINE_EVENT",
          "id": "KR_123:18:4",
          "timestamp": 1122000,
          "participantId": null
        }
      ],
      "distance": null,
      "frameAgeSeconds": null
    }
  ]
}
~~~

- level: CONFIRMED, APPROXIMATE, NOT_INVOLVED
- records[].basis: KILLER, VICTIM, ASSIST, OBJECTIVE_KILLER, OBJECTIVE_ASSIST, POSITION_PROXIMITY
- records[].stage: ENCOUNTER, SETUP, CONTEST, CONVERSION

records는 timestamp, basis, sourceRef ID 순으로 정렬한다. 하나라도 직접 기록이 있으면 level은 CONFIRMED, 직접 기록이 없고 위치 근접 기록만 있으면 APPROXIMATE, records가 비면 NOT_INVOLVED다. 각 record는 1개 이상의 sourceRefs를 필수로 가진다. APPROXIMATE는 화면에서 근접 추정으로 표시하며 직접 참여로 표현하지 않는다.

### 6.2 encounters

각 교전은 다음 정보를 포함한다.

- type: PICK, SKIRMISH, TEAMFIGHT_CANDIDATE
- classificationBasis
- phaseEvents: OPENING, EXCHANGE, LATE_SEQUENCE로 분류된 사망 사건
- participants: 양 팀의 직접 기록 참가자
- allyDeaths, enemyDeaths
- firstTakedownTeam
- centerPosition
- playerInvolvement
- linkedObjectiveEngagementIds

교전의 승패는 사망자 차이만으로 확정하지 않는다. allyDeaths와 enemyDeaths를 사실로 제공하고, 오브젝트 획득 및 후속 전환은 별도 결과로 유지한다.

### 6.3 objectiveEngagements

각 오브젝트 진행은 다음 정보를 포함한다.

- objectiveType
- captureStartTimestamp
- captureEndTimestamp
- captureCounts: ally, enemy, unknown
- captureTeam: ALLY, ENEMY, SPLIT, UNKNOWN
- setupWindow
- contestWindow
- conversionWindow
- linkedEncounterIds
- structureConversions
- playerInvolvement
- linkedEncounterInvolvements

captureTeam과 교전 결과는 결합하지 않는다. 상대가 오브젝트를 획득했다는 사실만으로 OBJECTIVE_SETUP_FAIL 같은 인과 레이블을 만들지 않는다.

각 window는 다음 형태를 사용한다.

~~~json
{
  "startMs": 1032000,
  "endMsExclusive": 1102000,
  "sourceRefs": [],
  "linkedEncounterIds": [],
  "teamSnapshots": {
    "start": {
      "ally": null,
      "enemy": null
    },
    "end": {
      "ally": null,
      "enemy": null
    }
  },
  "deathCounts": {
    "ally": 0,
    "enemy": 0
  }
}
~~~

setupWindow과 contestWindow의 deathCounts는 해당 반개구간에 속한 킬 사건만 집계한다. conversionWindow는 구조물과 다음 중립 오브젝트 같은 macro 사건만 담으며 deathCounts는 null이다.

teamSnapshots.start는 startMs 이하, teamSnapshots.end는 endMsExclusive 이하의 최신 프레임을 사용한다. 각 팀 값은 snapshotTimestamp, frameAgeSeconds, totalGold, totalXp, livingParticipantIds, positionedParticipantIds를 가진다. complete frame은 해당 팀 5명의 participantFrame이 모두 있는 프레임이다. 기준 시각보다 60초를 초과해 오래되면 null과 STALE_TEAM_SNAPSHOT을, 5명 중 하나라도 없으면 null과 INCOMPLETE_TEAM_SNAPSHOT을 기록한다.

오브젝트의 CONFIRMED 관여는 OBJECTIVE_KILLER 또는 OBJECTIVE_ASSIST로만 생성한다. setup이나 conversion 위치, 또는 시간만으로 연결된 교전 기록으로는 오브젝트 직접 관여를 만들지 않는다.

linkedEncounterInvolvements는 encounterId, encounterPlayerInvolvement, associationConfidence를 가진다. 교전에 직접 기록된 플레이어는 encounterPlayerInvolvement에서 CONFIRMED일 수 있지만, 이것이 objective playerInvolvement를 CONFIRMED로 승격하지 않는다. associationConfidence는 encounter confidence와 오브젝트 연결 confidence 중 낮은 값을 사용한다.

### 6.4 scenes

scene은 개인 리뷰의 중복을 제거하는 내부·응답 공통 단위다.

- sceneId
- primaryType: OBJECTIVE, ENCOUNTER
- objectiveEngagementId 또는 null
- encounterIds
- startTimestamp, endTimestamp
- involvements
- effectiveInvolvementLevel
- importanceScore

involvements는 OBJECTIVE 또는 ENCOUNTER domainType, domainId, 원본 playerInvolvement, associationConfidence를 보존한다. effectiveInvolvementLevel은 모든 원본 level의 최댓값이며 우선순위는 CONFIRMED > APPROXIMATE > NOT_INVOLVED다. 중요도와 개인 리뷰 포함 여부는 effectiveInvolvementLevel만 사용한다. records는 domainType, domainId, timestamp, basis, sourceRef ID 순으로 안정 정렬하며 서로 다른 도메인의 근거를 합치거나 버리지 않는다.

contestWindow에 하나 이상의 encounter가 연결되면 objectiveEngagement를 primary로 하고 연결된 encounter 사실을 같은 scene에 병합한다. 연결되지 않은 encounter는 독립 scene이 된다. personalReview는 scene당 최대 1개다. objective playerInvolvement가 NOT_INVOLVED여도 연결 encounter가 CONFIRMED이면 scene은 개인 리뷰 후보가 될 수 있지만 UI는 교전 직접 기록과 오브젝트 직접 관여 없음을 별도로 표시한다.

### 6.5 personalReviews

개인 리뷰는 중요도 상위 5개까지 반환하고 화면에서 최대 3개를 기본 노출한다.

- reviewId
- sceneId
- encounterIds
- objectiveEngagementId 또는 null
- importanceScore
- involvements
- effectiveInvolvementLevel
- situationFacts
- decisionFacts
- positioningFacts
- outcomeFacts
- evidenceIds
- narrative
- teamAppendixId

effectiveInvolvementLevel이 NOT_INVOLVED인 scene은 전체 타임라인과 팀 부록에는 남길 수 있지만 개인 리뷰 후보에서는 제외한다.

### 6.6 narrative

상황, 확인된 행동, 결과와 포지셔닝 관찰은 서버가 fact type과 value를 고정 템플릿으로 렌더링한다. AI 자유 텍스트를 사용하지 않는다.

narrative는 다음 구조를 사용한다.

~~~json
{
  "decisionAssessment": {
    "claimCode": "PLAYER_RECORDED_DEATH",
    "text": "첫 교환 구간에 대상 플레이어의 사망이 기록됐습니다.",
    "evidenceIds": ["fact_0123456789abcdefabcd"],
    "source": "SERVER_FACT_TEMPLATE"
  },
  "positioningObservation": {
    "claimCode": "POSITION_DISTANCE_2500_5000",
    "text": "사용 가능한 과거 프레임에서 교전 중심과의 거리는 2,500 초과 5,000 이하였습니다.",
    "evidenceIds": ["fact_1123456789abcdefabcd"],
    "source": "SERVER_FACT_TEMPLATE"
  },
  "coaching": {
    "recommendationCode": "DECIDE_JOIN_OR_TRADE_EARLY",
    "betterChoice": "오브젝트 생성 전에 합류 또는 반대편 교환 계획을 먼저 확정하세요.",
    "nextGameRule": "오브젝트 30초 전 5,000보다 멀면 합류와 교환 중 하나를 결정하세요.",
    "evidenceIds": ["fact_2123456789abcdefabcd"],
    "selectionSource": "AI_SELECTED"
  }
}
~~~

decisionAssessment와 positioningObservation의 claimCode, text, evidenceIds는 서버 템플릿이 생성하므로 AI가 수정할 수 없다. AI는 허용된 recommendationCode와 evidenceIds만 선택한다. betterChoice와 nextGameRule의 최종 문구도 서버의 recommendation template에서 생성한다.

### 6.7 teamAppendix

teamAppendix는 개인 리뷰와 1:1로 연결하며 다음 사실을 포함한다.

- teamAppendixId
- reviewId
- allyDirectParticipants, enemyDirectParticipants
- firstTakedownTeam
- allyDeaths, enemyDeaths
- preEncounterGoldDifference
- captureTeam
- structureConversions
- factIds

preEncounterGoldDifference는 ally totalGold - enemy totalGold이며 반드시 scene.startTimestamp 이하의 최신 양 팀 complete frame으로 별도 계산한다. window end snapshot을 재사용하지 않는다. 사용한 participantFrame timestamp와 scene.startTimestamp 기준 frameAgeSeconds를 함께 기록한다. 60초 이내의 양 팀 complete frame이 없으면 값을 null로 두고 limitation code를 추가한다. objective가 없는 scene의 captureTeam과 structureConversions는 각각 null과 빈 배열이다.

## 7. 교전 판정 규칙

전체 CHAMPION_KILL 사건을 timestamp, sourceRef ID 오름차순으로 정렬한다. 위치 거리는 Summoner's Rift 좌표의 유클리드 거리로 계산하고 정수로 반올림한다.

후보 연결 규칙은 다음 순서로 적용한다.

1. 직전 사건과 25초를 초과하거나 후보 첫 사건부터 45초를 초과하면 새 후보를 시작한다.
2. 두 사건에 위치가 모두 있으면 15초 이하 간격에서는 직전 위치와 5,000 이하, 15초 초과 25초 이하에서는 3,000 이하일 때만 연결한다.
3. 기존 후보에 위치가 2개 이상 있으면 새 사건은 기존 후보 medoid와도 4,000 이하여야 한다. 이를 통해 교전 중심이 지도 전체로 이동하는 연쇄 병합을 막는다.
4. 두 사건 중 위치가 하나라도 없으면 간격이 15초 이하이고 killerId, victimId, assistingParticipantIds 중 공통 직접 참가자가 있을 때만 연결한다.
5. 위 조건을 만족하지 않으면 새 후보를 시작한다.

centerPosition은 유효한 킬 위치 중 다른 모든 유효 위치까지 거리 합이 가장 작은 medoid다. 동점이면 timestamp, sourceRef ID가 빠른 위치를 선택한다. 위치가 하나도 없으면 null이다.

분류는 겹치지 않는 decision tree로 계산한다.

1. deathCount가 1이면 PICK
2. deathCount가 3 이상이고, 알려진 아군 직접 참가자 2명 이상, 알려진 상대 직접 참가자 2명 이상, 알려진 전체 직접 참가자 6명 이상이면 TEAMFIGHT_CANDIDATE
3. 그 외는 SKIRMISH

직접 참가자는 killerId, victimId, assistingParticipantIds에 기록된 참가자다. UNKNOWN 참가자는 알려진 팀별·전체 최소 인원 계산에서 제외하고 classificationBasis에 그 한계를 기록한다. TEAMFIGHT_CANDIDATE는 킬 로그 기반 후보이며 실제 전술적 한타를 확정한다는 뜻이 아니다.

단계는 시간 순서만 표현하며 단조롭게 진행한다.

- OPENING: encounter 시작 시각부터 2초 미만의 반개구간에 속한 사건
- EXCHANGE: OPENING 이후 첫 10초 초과 사건 간격이 나타나기 전까지의 사건
- LATE_SEQUENCE: 첫 10초 초과 사건 간격이 나타난 사건부터 encounter 끝까지의 사건

LATE_SEQUENCE가 시작된 뒤 EXCHANGE로 돌아가지 않는다. UI에서는 후반 연속 사건으로 표시하며 정리, 추격, 이탈 성공을 의미하지 않는다. INITIATED_KILL, CAUGHT_OUT, OVERCHASE_DEATH, CLEANUP처럼 의도나 원인을 단정하는 레이블은 v2 사실 모델에서 사용하지 않는다.

## 8. 오브젝트 진행 판정 규칙

objectiveEngagement의 anchor는 ELITE_MONSTER_KILL로 기록된 중립 오브젝트로 제한한다. 포탑과 억제기는 독립 anchor가 아니라 conversion macro 사건으로 사용한다.

팀과 관계없이 연속 VOID_GRUB 사건의 간격이 각각 20초 이하이고 첫 사건부터 마지막 사건까지 60초 이하이면 하나의 VOID_GRUB_CAMP engagement로 묶는다. captureCounts와 모든 sourceRefs를 보존한다. 둘 이상의 알려진 팀이 나눠 획득하면 captureTeam은 SPLIT, 한 팀만 획득하면 해당 팀, 알려진 팀이 없으면 UNKNOWN이다. 다른 중립 오브젝트는 원본 획득 사건 하나당 engagement 하나를 만든다.

일반 오브젝트는 captureStartTimestamp와 captureEndTimestamp가 같다. VOID_GRUB_CAMP는 첫 획득과 마지막 획득 시각을 각각 사용한다. 다음 nominal 반개구간을 만든다.

- setupWindow: [captureStartTimestamp-90초, captureStartTimestamp-20초)
- contestWindow: [captureStartTimestamp-20초, captureEndTimestamp+20초)
- conversionWindow: [captureEndTimestamp, captureEndTimestamp+120초)

setupWindow과 contestWindow는 킬 사건과 교전을 담는다. conversionWindow는 구조물과 다음 중립 오브젝트 같은 macro 사건만 담으므로 contestWindow와 시간상 겹쳐도 같은 종류의 사건이 중복되지 않는다.

nominal setupWindow 또는 contestWindow가 겹쳐도 window 자체를 자르거나 확장하지 않는다. 하나의 combat 사건 또는 encounter가 여러 nominal window에 포함되면 사건 중심 timestamp와 capture 구간 사이의 최소 절대 거리가 가장 작은 engagement 하나에만 귀속한다. 거리가 같으면 captureStartTimestamp와 안정적 ID가 빠른 engagement를 선택한다. conversion macro 사건은 이전 120초 안의 captureEndTimestamp가 가장 최근인 engagement 하나에만 귀속한다.

교전 centerPosition과 오브젝트 사건 위치를 모두 알 수 있을 때는 거리 5,000 이내인 교전을 연결한다. 어느 한쪽 위치가 없으면 contestWindow의 시간 조건으로 연결하되 confidence를 한 단계 낮추고 MISSING_SPATIAL_LINK limitation code를 기록한다.

중립 오브젝트 captureTeam은 killerId의 참가자 팀을 우선 사용하고, 없으면 유효한 killerTeamId를 사용한다. 구조물 획득 팀은 killerId의 참가자 팀을 우선 사용한다. killerId가 없고 raw teamId가 파괴된 구조물 소유 팀을 뜻하는 경우 100과 200을 반전한다. 어느 방법으로도 확인할 수 없으면 UNKNOWN을 유지한다.

구조물 사건은 conversionWindow 안에 있어야 structureConversions 후보가 된다. captureTeam이 ALLY 또는 ENEMY이면 같은 팀이 획득한 구조물만 포함한다. SPLIT이면 ALLY와 ENEMY 양쪽의 구조물 사건을 takerTeam과 함께 보존하고 어느 한쪽의 전환으로 합치지 않는다. captureTeam이 UNKNOWN이면 같은 팀 전환이라고 추정하지 않고 구조물 사건을 포함하지 않는다.

## 9. 개인 관여와 포지셔닝

### 9.1 관여

- CONFIRMED: 대상 플레이어가 killerId, victimId 또는 assistingParticipantIds에 직접 기록됨
- APPROXIMATE: 대상 플레이어가 직접 기록되지 않았지만 사건 시각 이하의 최신 위치 프레임에서 생존 중이고, 프레임 시간 차가 15초 이하이며 사건 또는 교전 중심과 거리가 4,000 이하
- NOT_INVOLVED: 위 조건을 충족하지 않음

APPROXIMATE의 basis는 POSITION_PROXIMITY이며 참여가 아니라 근접 추정이다. decisionAssessment의 근거로 사용할 수 없고 positioningObservation에만 사용할 수 있다. 16~30초 차이의 과거 위치 프레임은 낮은 신뢰도의 broad positioning fact에는 사용할 수 있지만 APPROXIMATE를 만들지는 않는다. 30초를 초과하거나 사건 이후의 프레임은 포지셔닝 판단에서 제외한다.

### 9.2 포지셔닝 사실

포지셔닝은 사건 timestamp 이하의 최신 participantFrame만 사용하고 frameAgeSeconds를 사건 시각에서 프레임 시각을 뺀 값으로 반환한다. 거리는 유클리드 거리이며 정수로 반올림한다.

- DISTANCE_LE_2500
- DISTANCE_2500_5000
- DISTANCE_GT_5000
- NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT

위치 신뢰도는 다음과 같다.

- HIGH: 프레임 시간 차 5초 이하
- MEDIUM: 5초 초과 15초 이하
- LOW: 15초 초과 30초 이하
- 30초 초과: 위치 사실 생략

NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT은 같은 frame timestamp에서 대상 플레이어를 제외한 아군 4명의 생존 상태와 위치가 모두 있을 때만 생성한다. 하나라도 누락되면 사실을 생략하고 INCOMPLETE_ALLY_FRAME_COVERAGE limitation code를 기록한다.

이 enum들은 지도 거리의 관찰값이다. 앞라인, 뒷라인, 고립, 과진입, 잘못된 진입 같은 해석은 서버 사실 필드로 확정하지 않는다.

대상 플레이어의 첫 기록 시점은 최초 killer, victim 또는 assist 기록 timestamp다. 이를 실제 진입 시점으로 표현하지 않는다.

## 10. 중요도 순위

importanceScore는 scene 단위로 계산한다. 동일 입력에서 같은 결과가 나오도록 다음 합계를 사용하고 기본 점수는 scene의 primaryType에 따라 정확히 하나만 선택한다.

- 기본 점수: TEAMFIGHT_CANDIDATE 30, OBJECTIVE_CONTEST 30, SKIRMISH 20, PICK 10
- scene effectiveInvolvementLevel CONFIRMED: 30
- scene effectiveInvolvementLevel APPROXIMATE: 10
- 대상 플레이어가 첫 사망 또는 첫 킬·어시스트 사건에 기록: 15
- 하나의 scene에 오브젝트와 교전이 모두 존재: 15
- 양 팀 사망자 차이 절댓값당 5, 최대 15
- 후속 포탑 또는 억제기 전환 존재: 10

동점이면 timestamp가 빠른 장면, 그다음 안정적 ID 오름차순으로 정렬한다. 개인 리뷰는 상위 5개로 제한한다.

## 11. AI 선택과 검증

상황, 확인된 행동, 결과, 포지셔닝 관찰은 서버 fact template만 사용한다. decisionAssessment claimCode와 fact type은 다음처럼 1:1로 연결한다.

- PLAYER_RECORDED_KILL → PLAYER_CONFIRMED_KILL
- PLAYER_RECORDED_ASSIST → PLAYER_CONFIRMED_ASSIST
- PLAYER_RECORDED_DEATH → PLAYER_CONFIRMED_DEATH
- PLAYER_FIRST_RECORDED_INVOLVEMENT → PLAYER_FIRST_RECORDED_INVOLVEMENT

positioningObservation claimCode와 fact type도 1:1로 연결한다.

- POSITION_DISTANCE_LE_2500 → PLAYER_DISTANCE_LE_2500
- POSITION_DISTANCE_2500_5000 → PLAYER_DISTANCE_2500_5000
- POSITION_DISTANCE_GT_5000 → PLAYER_DISTANCE_GT_5000
- NO_NEARBY_LIVING_ALLY_AT_SNAPSHOT → NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT

LOW confidence 문구도 서버 템플릿이 낮은 신뢰도의 과거 프레임이라는 표현을 고정해서 붙인다.

AI는 자유 문장을 생성하지 않고 서버가 계산한 eligible recommendation 중 하나를 선택한다. AI 입력에는 reviewId, eligible recommendationCode, 각 code가 허용하는 factId만 포함하며 원본 타임라인 전체를 전달하지 않는다.

AI 응답의 정확한 shape는 다음과 같다.

~~~json
{
  "reviews": [
    {
      "reviewId": "review_abc",
      "recommendationCode": "DECIDE_JOIN_OR_TRADE_EARLY",
      "evidenceIds": ["fact_2123456789abcdefabcd"]
    }
  ]
}
~~~

recommendationCode와 서버 렌더링 문구는 다음 closed enum과 template을 사용한다.

| recommendationCode | 필수 조건 | betterChoice | nextGameRule |
|---|---|---|---|
| GROUP_BEFORE_OBJECTIVE | OBJECTIVE scene + HIGH·MEDIUM NO_LIVING_ALLY_WITHIN_2500_AT_SNAPSHOT | 오브젝트 진입 전에 가까운 아군과 같은 경로를 선택하세요. | 오브젝트 20초 전에는 2,500 이내 생존 아군이 있는지 확인하세요. |
| DECIDE_JOIN_OR_TRADE_EARLY | OBJECTIVE scene setup·contest + HIGH·MEDIUM PLAYER_DISTANCE_GT_5000 | 오브젝트 생성 전에 합류 또는 반대편 교환 계획을 먼저 확정하세요. | 오브젝트 30초 전 5,000보다 멀면 합류와 교환 중 하나를 결정하세요. |
| REVIEW_OPENING_DEATH | OPENING + PLAYER_CONFIRMED_DEATH | 첫 교환 전에 가까운 아군과 사용할 이탈 경로를 확인하세요. | 첫 행동 전에 생존 경로 하나를 정하세요. |
| RESET_AFTER_CAPTURE | ALLY OBJECTIVE_CAPTURE_TEAM + PLAYER_DEATH_WITHIN_120S_AFTER_CAPTURE | 획득 직후 추격보다 생존과 리셋을 먼저 검토하세요. | 오브젝트 획득 후 체력과 생존 인원을 확인한 뒤 다음 행동을 선택하세요. |

reviews는 최대 5개며 reviewId는 요청 집합에 속하고 유일해야 한다. 각 항목은 reviewId, recommendationCode, evidenceIds만 허용한다. evidenceIds는 중복 없는 1~6개이고 해당 review의 factId 부분집합이어야 하며 code의 필수 fact type을 모두 포함해야 한다. code가 허용하지 않은 fact type은 evidenceIds에 포함할 수 없다. 중복 reviewId가 있으면 해당 ID의 응답을 모두 폐기하고, 잘못된 항목은 해당 항목만 폐기한다.

서버는 AI 선택을 검증한 뒤 betterChoice와 nextGameRule을 고정 template에서 생성하고 selectionSource를 AI_SELECTED로 기록한다. AI 호출이 실패하거나 선택이 무효면 eligible code를 RESET_AFTER_CAPTURE, GROUP_BEFORE_OBJECTIVE, DECIDE_JOIN_OR_TRADE_EARLY, REVIEW_OPENING_DEATH 순으로 선택하고 selectionSource를 RULE_FALLBACK으로 기록한다. eligible code가 없으면 coaching은 null이며 코칭을 생성할 근거가 없다는 정상 상태를 표시한다.

## 12. UI 설계

### 12.1 분석 탭

핵심 영역 이름은 개인 판단 리뷰로 한다.

각 카드에는 다음을 표시한다.

1. timestamp, 교전 유형, 중요도, 관여 수준, 위치 신뢰도
2. 상황
3. 확인된 개인 행동
4. 확인된 결과와 포지셔닝 관찰
5. 코칭 제안: 더 안전하거나 기대값이 높은 대안
6. 코칭 제안: 다음 경기에서 적용할 한 문장 행동 규칙

min(3, 개인 리뷰 수)를 기본 노출하고 리뷰가 4개 이상일 때만 전체 보기 버튼으로 나머지를 표시한다. 근거 보기에는 원본 사건, 위치 프레임 시각 차이, 거리, 사망 순서와 결과를 제공한다.

팀 상황 보기는 기본적으로 접힌 상태다. 펼치면 아군·상대 참여 인원, 선취점, 교환 결과, 교전 전 골드 차이, 오브젝트 획득, 후속 구조물 전환을 표시한다.

개인 판단 리뷰와 기존 combatAnalysis·teamfightPhaseAnalysis는 하나의 렌더 슬롯을 사용한다. isRenderableV2가 true일 때만 v2 개인 판단 리뷰를 표시하고 레거시 본문을 숨긴다. false이고 유효한 레거시가 있으면 레거시 본문을 표시한다.

### 12.2 타임라인 탭

오브젝트·교전 흐름 영역에서 준비, 교전 사실, 획득 팀, 후속 전환 순서로 전체 사실을 표시한다. captureTeam, 사망 교환, 구조물 전환은 독립 항목으로 표시하고 상대 팀 획득을 준비 실패로 바꾸지 않는다.

분석 카드의 전체 흐름 보기 동작은 native button을 사용한다. 활성화하면 타임라인 탭을 선택하고 aria-selected를 갱신한 뒤 같은 sceneId를 가진 heading으로 스크롤하고 tabindex="-1"인 heading에 포커스를 이동한다. 대상이 없으면 현재 위치를 유지하고 status 메시지로 근거 장면을 찾지 못했다고 알린다.

### 12.3 접근성

- 펼치기 동작은 native button을 사용한다.
- aria-expanded와 aria-controls를 연결한다.
- 비동기 분석 상태에는 aria-busy와 status 메시지를 사용한다.
- 승리, 패배, 불확실, 신뢰도는 색상뿐 아니라 텍스트로 표시한다.
- 표를 사용할 경우 caption과 scope를 제공한다.
- 키보드만으로 리뷰, 근거, 팀 부록을 열고 닫은 뒤 원래 버튼으로 돌아올 수 있어야 한다.
- aria-expanded는 실제 hidden 상태와 일치하고 aria-controls 대상 ID는 문서에서 유일해야 한다.
- 320 CSS px와 200% 확대에서 가로로 잘려 접근할 수 없는 본문 정보가 없어야 한다.
- 포커스는 항상 시각적으로 보여야 하며 prefers-reduced-motion에서는 부드러운 스크롤을 사용하지 않는다.

## 13. 오류와 coverage 처리

coverage.level은 다음 중 하나다.

- FULL: 전체 10인 사건이 있고 모든 개인 리뷰 후보 scene에 30초 이내 과거 위치 프레임이 있음
- PARTIAL: 전체 10인 사건이 있고 일부 개인 리뷰 후보 scene에만 유효한 위치 프레임이 있음
- EVENT_ONLY: 전체 10인 교전·오브젝트 사건은 있으나 유효 위치 프레임이 없음
- PLAYER_ONLY: v2 원본이 없고 기존 개인 이벤트만 사용할 수 있음
- UNAVAILABLE: 분석에 필요한 사건 데이터가 없음

coverage.source는 RAW_TIMELINE, LEGACY_ADAPTER, NONE 중 하나다. usablePositionSceneRatio는 유효 위치가 있는 개인 리뷰 후보 scene 수를 전체 후보 scene 수로 나눈 0~1 값이며 후보가 없으면 0이다. limitationCodes는 자유 문장이 아니라 다음 enum만 사용한다.

- PARTIAL_POSITION_FRAMES
- NO_POSITION_FRAMES
- MISSING_SPATIAL_LINK
- INCOMPLETE_ALLY_FRAME_COVERAGE
- UNKNOWN_TEAM
- INCOMPLETE_TEAM_SNAPSHOT
- STALE_TEAM_SNAPSHOT
- INVALID_V2_ITEM
- INVALID_AI_SELECTION

렌더 판정은 모든 UI와 loader에서 다음 단일 식을 사용한다.

isRenderableV2 = root validation 통과 AND coverage.source == RAW_TIMELINE AND coverage.level IN (FULL, PARTIAL, EVENT_ONLY)

PLAYER_ONLY + LEGACY_ADAPTER는 전송 가능한 유효 envelope지만 renderable v2가 아니다.

처리 원칙은 다음과 같다.

- 알 수 없는 팀은 ENEMY로 변환하지 않고 UNKNOWN으로 유지한다.
- 유효 위치가 없으면 위치 근거 부족을 표시하고 포지셔닝 조언을 생략한다.
- 분석 대상 장면이 없으면 오류가 아닌 정상 빈 상태를 표시한다.
- valid v2와 레거시 본문을 동시에 표시하지 않는다.

렌더 우선순위는 다음과 같다.

| 상태 | 렌더 결과 |
|---|---|
| renderable v2 + AI 선택 성공 | v2 사실 + 선택된 서버 recommendation template |
| renderable v2 + 일부 AI 선택 무효 | v2 사실 + 리뷰별 유효 선택 또는 rule fallback |
| renderable v2 + AI 전체 실패 | v2 사실 + rule fallback 또는 코칭 근거 없음 상태, 레거시 미노출 |
| v2 root 치명 오류 + valid legacy | 레거시 본문 |
| PLAYER_ONLY + valid legacy | 레거시 본문 |
| UNAVAILABLE + valid legacy | 레거시 본문 |
| UNAVAILABLE + legacy 없음 | 정상 빈 상태 |

validateTeamplayAnalysisV2는 오류 범위를 다음처럼 분리한다.

- root 치명 오류: root 객체, schemaVersion 또는 필수 배열 shape가 잘못됨. 전체 v2를 사용하지 않고 레거시 fallback을 사용한다.
- 항목 오류: 중복 도메인 ID, endTimestamp가 startTimestamp보다 작음, 존재하지 않는 scene·encounter·objective 참조. 해당 항목과 그 항목에만 의존하는 하위 항목을 제거하고 INVALID_V2_ITEM을 기록한다.
- AI 선택 오류: 잘못된 recommendationCode, 빈 evidenceIds, 허용되지 않은 fact type. 해당 리뷰 선택만 제거하고 INVALID_AI_SELECTION을 기록한다.

개인 리뷰 한 건의 오류로 전체 v2를 레거시 fallback하지 않는다.

## 14. 테스트 전략

### 14.1 서버 단위 테스트

- 15초, 25초, 45초 시간 경계
- 3,000, 4,000 medoid, 5,000 거리 경계
- 서로 다른 라인의 동시 킬과 위치 누락·공통 참가자 연결
- PICK, SKIRMISH, TEAMFIGHT_CANDIDATE decision tree
- ALLY, ENEMY, UNKNOWN 변환
- OPENING, EXCHANGE, LATE_SEQUENCE 단조 단계
- 오브젝트 반개구간과 중복 구간 분리
- 중첩 nominal window에서 가장 가까운 anchor 단일 귀속
- 양 팀 분할 VOID_GRUB_CAMP 그룹화, captureCounts와 SPLIT
- capture 직후 20초 안 구조물의 conversion 귀속
- captureTeam과 교전 사망 결과의 독립성
- objective 직접 관여와 연결 encounter 관여의 분리
- CONFIRMED, APPROXIMATE, NOT_INVOLVED
- scene involvement 원형 보존과 effectiveInvolvementLevel 우선순위
- 미래 위치 프레임 거부와 과거 최신 프레임 선택
- 5초, 15초, 30초 위치 신뢰도 경계
- 아군 프레임 일부 누락 시 근접 사실 생략
- importanceScore와 동점 정렬
- preEncounterGoldDifference가 scene 시작 이후 프레임을 사용하지 않음

### 14.2 계약 테스트

- typed sourceRef와 동일 입력의 안정적 ID·fact hash·정렬 순서
- 서버 fact template claimCode와 AI recommendationCode, evidenceIds, 허용 fact type
- recommendationCode별 고정 betterChoice·nextGameRule template
- AI가 사실 필드를 추가하거나 변경할 수 없음
- UNKNOWN과 누락 데이터를 임의로 채우지 않음
- 모든 개인 리뷰에 원본 근거가 존재
- NOT_INVOLVED 사건이 개인 리뷰에 포함되지 않음
- root·항목·AI 선택 오류의 격리
- scene당 개인 리뷰 최대 1건
- isRenderableV2 단일 판정식과 PLAYER_ONLY 비렌더 판정

### 14.3 UI 테스트

- v2 개인 리뷰 우선 렌더링
- 리뷰 수 0, 1, 2, 3, 5에서 min(3, 수) 기본 노출과 전체 보기
- valid v2와 레거시 본문의 동시 노출 금지
- 팀 부록 기본 접힘과 키보드 조작
- 추정 관여, 신뢰도, 위치 근거 부족 레이블
- 타임라인 탭 전환, scene heading 스크롤·포커스와 대상 누락 status
- FULL, PARTIAL, EVENT_ONLY, PLAYER_ONLY, UNAVAILABLE 상태
- PLAYER_ONLY·UNAVAILABLE envelope와 valid legacy 조합에서 레거시만 렌더링
- AI 실패와 빈 상태
- 기존 데이터 fallback
- aria-expanded·hidden 일치, ID 유일성, 320 CSS px, 200% 확대와 reduced-motion

### 14.4 회귀·통합 테스트

- 합성 fixture로 모든 경계 조건을 검증한다.
- ENEMY가 오브젝트를 획득하지만 ALLY가 사망 교환에서 앞서는 fixture로 독립 결과를 검증한다.
- 이미 커밋된 저장 샘플로 실제 타임라인 회귀를 검증한다.
- 신규 원시 샘플과 test-artifacts/tmp는 커밋하지 않는다.
- 분석 API 응답부터 분석 탭과 타임라인 탭 렌더링까지 검증한다.
- 기존 최상위 응답 필드 snapshot이 유지되고 v2가 additive인지 검증한다.
- v2를 모르는 기존 렌더러 smoke가 통과해야 한다.
- 기존 전체 테스트를 계속 통과해야 한다.

## 15. 수용 기준

구현은 다음 조건을 모두 만족해야 완료로 판단한다.

1. 판정 조건을 만족하는 원본 타임라인이 있는 경기에서 전체 10명의 사건으로 교전 후보가 생성된다.
2. 대상 플레이어가 직접 킬, 어시스트 또는 사망에 기록된 주요 교전은 CONFIRMED 개인 리뷰 후보가 된다.
3. 직접 assist는 CONFIRMED, 15초 이내 근접 비기록은 APPROXIMATE, 원거리 비기록은 NOT_INVOLVED로 고정 fixture가 통과한다.
4. 사건 이후 또는 30초보다 오래된 위치 프레임으로 관여나 포지셔닝 조언을 만들지 않는다.
5. 오브젝트 획득 팀과 교전 사망 결과가 별도 필드와 UI로 표시된다.
6. min(3, 리뷰 수)의 개인 판단 리뷰가 팀 부록보다 먼저 보이고 팀 부록은 기본적으로 접혀 있다.
7. 모든 AI 선택은 eligible recommendationCode와 그 code가 허용하는 factId만 참조하며 최종 문구는 서버 템플릿과 일치한다.
8. AI가 실패하면 v2 사실 분석을 유지하고 valid v2 화면에 레거시 본문을 동시에 표시하지 않는다.
9. 키보드만으로 리뷰·근거·팀 부록과 타임라인 이동을 사용할 수 있고 aria 상태, 320 CSS px, 200% 확대 검증을 통과한다.
10. 기존 최상위 필드 snapshot은 불변이고 teamplayAnalysisV2만 additive이며 구버전 렌더러 smoke가 통과한다.
11. 신규 원시 샘플과 임시 산출물을 제외한 상태로 전체 자동 테스트가 통과한다.

## 16. 배포와 호환성

첫 배포에서는 teamplayAnalysisV2를 추가 필드로 제공한다. 기존 필드는 API 호환을 위해 그대로 유지한다. 하나의 렌더 슬롯에서 isRenderableV2가 true이면 v2만 사용한다. false이면 유효한 기존 필드가 있을 때 레거시를 사용한다.

기존 저장 샘플은 로드 시 메모리에서 coverage를 계산한다. 원본 타임라인이 있으면 v2를 생성할 수 있다. 분석 결과만 있는 오래된 샘플은 level PLAYER_ONLY, source LEGACY_ADAPTER로 표시하고 레거시 본문을 사용한다. 저장 샘플 디렉터리 전체를 일괄 재작성하지 않는다.

v2가 충분히 검증된 뒤 레거시 API 계약 제거 여부를 별도 작업으로 판단한다. 이번 구현에서는 레거시 데이터를 삭제하지 않지만 valid v2 화면에서는 중복 UI를 표시하지 않는다.
