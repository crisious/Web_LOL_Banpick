# 정규화 구현 체크리스트

작성일: 2026-04-10

관련 문서:
- [정규화 경기 데이터 스키마 문서](/Users/a1234/Documents/Web_LOL_Banpick/normalized-match-schema.md)
- [정규화 매핑 규칙 상세서](/Users/a1234/Documents/Web_LOL_Banpick/normalization-mapping-rules.md)
- [Riot API 호출 설계서](/Users/a1234/Documents/Web_LOL_Banpick/riot-api-call-spec.md)

## 1. 문서 목적

이 문서는 `raw Riot API 응답 -> normalized-match.json` 구현 시 필요한 작업을 체크리스트 형태로 정리한다.

목표는 아래와 같다.

- 구현 순서를 흔들림 없이 고정한다
- 빠뜨리기 쉬운 예외 처리를 미리 점검한다
- 샘플 1건 기준으로 바로 실행 가능한 수준의 체크리스트를 제공한다

## 2. 구현 전 준비

- [ ] `RIOT_API_KEY`를 서버 환경변수로 준비했다
- [ ] 테스트용 `Riot ID`를 확보했다
- [ ] 대상 지역(`KR`, `ASIA`)을 정했다
- [ ] raw 저장 디렉터리와 normalized 저장 디렉터리를 정했다
- [ ] 공개용 샘플인지 내부용 샘플인지 결정했다
- [ ] 공개용이면 익명화 규칙을 정했다

## 3. 입력 파일 준비 체크

- [ ] `raw-account.json`이 있다
- [ ] `raw-match.json`이 있다
- [ ] `raw-timeline.json`이 있다
- [ ] `raw-match.metadata.matchId`가 존재한다
- [ ] `raw-match.info.participants[]`가 존재한다
- [ ] `raw-timeline.info.frames[]`가 존재한다

## 4. 대상 플레이어 식별 체크

- [ ] `targetPuuid`를 확보했다
- [ ] `participants[]`에서 `puuid === targetPuuid`인 참가자를 찾았다
- [ ] 대상 participant의 `participantId`를 확보했다
- [ ] 대상 participant의 `teamId`를 확보했다
- [ ] ally 팀 참가자 목록을 계산했다
- [ ] enemy 팀 참가자 목록을 계산했다

실패 조건:

- [ ] 대상 participant를 찾지 못하면 정규화를 중단한다

## 5. `sourceMeta` 생성 체크

- [ ] `sourceType`을 `riot_match_v5`로 설정했다
- [ ] `fetchedAt`을 ISO 문자열로 기록했다
- [ ] `platformRegion`을 채웠다
- [ ] `regionalCluster`를 채웠다
- [ ] `rawMatchId`를 `metadata.matchId`로 채웠다

## 6. `playerContext` 생성 체크

- [ ] `puuid`를 채웠다
- [ ] `riotId`를 채웠다
- [ ] 공개용 샘플이면 익명화했다
- [ ] `isAnonymous` 값을 맞게 설정했다
- [ ] `participantId`를 채웠다

## 7. `matchInfo` 생성 체크

- [ ] `matchId`를 채웠다
- [ ] `queueId`를 채웠다
- [ ] `queueLabel`을 계산했다
- [ ] `mapId`를 채웠다
- [ ] `mapLabel`을 계산했다
- [ ] `gameVersion`을 채웠다
- [ ] `gameCreation`을 ISO 문자열로 변환했다
- [ ] `durationSeconds`를 채웠다
- [ ] `durationLabel`을 `MM:SS`로 변환했다
- [ ] `result`를 `WIN/LOSS`로 변환했다
- [ ] `champion`을 채웠다
- [ ] `position`을 `teamPosition` 우선으로 결정했다
- [ ] `teamId`를 채웠다

검증:

- [ ] `champion`이 비어 있지 않다
- [ ] `position`이 비어 있지 않거나 샘플 탈락 처리 기준을 확인했다
- [ ] `durationSeconds`가 상식적인 값이다

## 8. `playerStats` 생성 체크

- [ ] `kills`를 채웠다
- [ ] `deaths`를 채웠다
- [ ] `assists`를 채웠다
- [ ] `goldEarned`를 채웠다
- [ ] `damageToChampions`를 채웠다
- [ ] `visionScore`를 채웠다
- [ ] `champLevel`을 채웠다
- [ ] `summonerSpells` 배열을 채웠다
- [ ] `items` 배열을 `item0~item6`으로 채웠다

파생 계산:

- [ ] `kda`를 계산했다
- [ ] `cs`를 계산했다
- [ ] `csPerMinute`를 계산했다
- [ ] `killParticipation`를 계산했다

검증:

- [ ] `kda` 값이 비정상적으로 크지 않다
- [ ] `csPerMinute`가 상식적인 범위다
- [ ] `killParticipation`이 0~1 사이 값이다

## 9. `teamContext` 생성 체크

- [ ] ally 팀 총 킬 수를 계산했다
- [ ] 적 팀 총 킬 수를 참고할 수 있게 정리했다
- [ ] 팀 드래곤 수를 계산했다
- [ ] 팀 바론 수를 계산했다
- [ ] 팀 타워 수를 계산했다
- [ ] 적 드래곤 수를 계산했다
- [ ] 적 바론 수를 계산했다
- [ ] 적 타워 수를 계산했다

메모:

- [ ] `teamGoldEstimate`는 사용할 수 없으면 `0` 또는 생략 규칙을 적용했다

## 10. timeline 순회 체크

- [ ] `frames[]`를 순회할 준비가 됐다
- [ ] 각 frame의 `events[]`를 순회한다
- [ ] `frameIndex`와 `eventIndex`를 추적한다
- [ ] raw event `timestamp`를 읽는다
- [ ] `timestampLabel`을 `MM:SS`로 변환한다
- [ ] `phase`를 `EARLY/MID/LATE`로 계산한다

## 11. 이벤트 추출 체크

추출 대상:

- [ ] `CHAMPION_KILL`
- [ ] `ELITE_MONSTER_KILL`
- [ ] `BUILDING_KILL`
- [ ] `WARD_PLACED`
- [ ] `WARD_KILL`
- [ ] 필요 시 `SKILL_LEVEL_UP`

필터:

- [ ] 분석 가치 없는 이벤트는 제거한다
- [ ] 플레이어 관여가 없더라도 중요 오브젝트는 유지 여부를 판단한다
- [ ] 중복 이벤트 제거 규칙을 적용한다

## 12. 이벤트 가공 체크

각 유지 이벤트에 대해:

- [ ] `eventId`를 부여했다
- [ ] `timestampMs`를 기록했다
- [ ] `timestampLabel`을 기록했다
- [ ] `phase`를 기록했다
- [ ] `eventType`을 내부 타입으로 변환했다
- [ ] `importance`를 계산했다
- [ ] `isPlayerInvolved`를 계산했다
- [ ] `laneHint`를 생성했다
- [ ] `summary`를 1문장으로 작성했다
- [ ] `rawRef.frameIndex`를 기록했다
- [ ] `rawRef.eventIndex`를 기록했다

검증:

- [ ] `summary`가 기계적인 문장이 아니다
- [ ] `importance`가 1~5 범위다
- [ ] `eventType`이 내부 허용 목록 중 하나다

## 13. `phaseContext` 집계 체크

- [ ] EARLY 구간 킬/데스/어시스트를 집계했다
- [ ] MID 구간 킬/데스/어시스트를 집계했다
- [ ] LATE 구간 킬/데스/어시스트를 집계했다
- [ ] 구간별 `notableEventCount`를 계산했다
- [ ] 3개 구간 객체를 모두 생성했다

## 14. `derivedSignals` 계산 체크

- [ ] `hasEarlyLeadMoments`를 계산했다
- [ ] `hasMidGameThrowRisk`를 계산했다
- [ ] `hasObjectiveControlIssues`를 계산했다
- [ ] `hasStrongRoamingPattern`를 계산했다
- [ ] `hasPositioningRisk`를 계산했다
- [ ] `candidateThemes`를 2개 이상 생성했다

검증:

- [ ] signals가 timelineEvents와 논리적으로 맞는다
- [ ] candidateThemes가 지나치게 일반적이지 않다

## 15. 최소 유효성 검증 체크

- [ ] `schemaVersion` 존재
- [ ] `sourceMeta.rawMatchId` 존재
- [ ] `playerContext.puuid` 존재
- [ ] `matchInfo.matchId` 존재
- [ ] `matchInfo.champion` 존재
- [ ] `matchInfo.position` 존재
- [ ] `matchInfo.result` 존재
- [ ] `playerStats.kills/deaths/assists` 존재
- [ ] `timelineEvents`가 최소 4개 이상이다

권장 품질 검증:

- [ ] `timelineEvents`가 8개 이상이다
- [ ] 장점 3개, 단점 3개를 만들 수 있을 것 같다고 판단된다
- [ ] 구간별 서사가 읽힌다

## 16. 저장 체크

- [ ] `normalized-match.json`으로 저장했다
- [ ] 공개용이면 익명화된 값이 저장되었다
- [ ] raw 파일과 별도로 저장했다
- [ ] 저장 경로를 기록했다

## 17. 실패 시 대응 체크

- [ ] 대상 participant 미발견 시 실패 사유를 기록했다
- [ ] usable event 부족 시 다른 샘플 경기로 교체하기로 했다
- [ ] 역할 불명확 시 샘플 탈락 처리 여부를 판단했다
- [ ] timeline 품질이 낮으면 다른 matchId 후보로 넘어간다

## 18. 최종 완료 기준

아래를 모두 만족하면 정규화 구현 완료로 본다.

- [ ] `normalized-match.json` 생성 성공
- [ ] 필수 필드 누락 없음
- [ ] 핵심 이벤트가 4개 이상 추출됨
- [ ] derived signals가 생성됨
- [ ] 분석 JSON 스키마로 연결 가능한 수준의 품질 확인

## 19. 현재 권장 실행 순서

1. raw 파일 확보
2. participant 식별
3. `matchInfo` 생성
4. `playerStats` 계산
5. `teamContext` 생성
6. timeline 이벤트 추출
7. `phaseContext` 집계
8. `derivedSignals` 계산
9. 유효성 검증
10. 저장

