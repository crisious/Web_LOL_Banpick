# LoL Replay 분석 연구 자료 정리

이 문서는 LoL Replay 분석 웹 프로젝트에 필요한 외부 자료를 `필수 / 보류 / R&D` 기준으로 분류한 연구 메모다.

기준:

- `필수`: 현재 MVP 구현과 운영 판단에 바로 필요한 자료
- `보류`: 현재 기능에는 직접 필수는 아니지만 UX/확장 설계에 참고 가치가 큰 자료
- `R&D`: 기술 실험 또는 장기 고도화용 자료

## 한줄 결론

- 현재 웹 기반 MVP의 메인 트랙은 `Riot 공식 Web API + Data Dragon + 정책 문서`가 가장 안정적이다.
- `.rofl` 직접 처리와 Replay API는 연구 가치는 높지만, 브라우저 중심 서비스의 기본 경로로 잡기엔 리스크가 있다.
- UX는 `OP.GG 정보구조 + Mobalytics식 축 평가`를 섞는 방식이 적합하다.

## 압축 분류표

| 구분 | 자료 | 링크 | 현재 프로젝트에서의 쓰임 | 메모 |
| --- | --- | --- | --- | --- |
| 필수 | Riot Developer Portal Docs | https://developer.riotgames.com/docs/portal | 개발 키, 프로덕션 키, 레이트리밋, 운영 조건 판단 | MVP 운영 한계와 배포 전략 판단의 기준 |
| 필수 | Riot LoL Docs | https://developer.riotgames.com/docs/lol | Riot ID → PUUID, Data Dragon, Replay API, Queue/Season 상수 확인 | 현재 데이터 수집 흐름의 핵심 문서 |
| 필수 | Riot API Reference | https://developer.riotgames.com/apis/ | `account-v1`, `match-v5`, `spectator-v5` 응답 구조와 엔드포인트 확인 | 서버 호출 스펙의 1차 기준 |
| 필수 | Riot General Policies | https://developer.riotgames.com/policies/general | 공개 서비스, 표시 문구, 정책 위반 여부 판단 | 법적/운영 리스크 방지용 |
| 필수 | Data Dragon versions | https://ddragon.leagueoflegends.com/api/versions.json | 최신 챔피언 아이콘 버전 동기화 | 챔피언 배지 UI에 직접 사용 |
| 보류 | OP.GG detailed match data | https://help.op.gg/hc/en-us/articles/31091817743129-Viewing-detailed-match-data | 경기 상세 UX, 그래프, 오브젝트/타임라인 정보구조 참고 | 전적 사이트형 레이아웃 벤치마크 |
| 보류 | OP.GG OP Score explained | https://help.op.gg/hc/en-us/articles/31088715328665-OP-Score-explained | 경기 점수와 핵심 키워드 요약 UX 참고 | 단일 지표 + 코멘트 UX에 유용 |
| 보류 | Mobalytics GPI | https://mobalytics.gg/gpi/ | 장점/약점 축 기반 진단 프레임 참고 | Vision, Teamplay, Farming 등 다축 평가 모델 |
| R&D | Replay API | https://developer.riotgames.com/docs/lol | 로컬 리플레이 제어, 카메라/타임라인 실험 | 웹앱 기본 경로보단 로컬 툴 성격이 강함 |
| R&D | RiotGames League Director | https://github.com/RiotGames/leaguedirector | Replay API 실제 활용 예시 확인 | 로컬 영상/리플레이 연출 레퍼런스 |
| R&D | rofl-parser.js | https://github.com/gzordrai/rofl-parser.js | `.rofl` 메타데이터 파싱 가능성 검토 | 포맷 대응 리스크 있음 |
| R&D | lolrofl-rs | https://github.com/Ayowel/lolrofl-rs | Rust 기반 `.rofl` 파서 연구 | 유지보수/호환성 불확실성 주의 |
| R&D | ROFL | https://github.com/Mowokuma/ROFL | API로 못 얻는 이동/와드 분석 보완 가능성 검토 | 아카이브 상태 |
| R&D | Structured Summarization of LoL Match Data | https://www.mdpi.com/2076-3417/15/13/7190 | Match/Timeline JSON을 LLM 입력용 중간 스키마로 압축하는 방식 참고 | 분석 품질 고도화용 |
| R&D | KPI identification research | https://www.sciencedirect.com/science/article/pii/S2451958825001332 | 어떤 경기 지표를 장단점 분석 축으로 삼을지 참고 | 데이터 기반 진단 지표 설계용 |
| R&D | WPI Riot API analysis | https://web.cs.wpi.edu/~claypool/mqp/lol-crawler/ | 장기 샘플 누적 분석과 패치 단위 통계 참고 | 플레이어 추세 분석 고도화용 |

## 지금 바로 써야 하는 자료

### 1. Riot API / Portal / Policy

- `Portal Docs`: 개발 키 만료, 레이트리밋, 프로덕션 승인 조건 정리
- `LoL Docs`: Riot ID, PUUID, Data Dragon, Replay API 등 도메인 전반 정리
- `API Reference`: 실제 요청/응답 설계 기준
- `Policies`: 공개 서비스 운영 시 꼭 필요한 정책 기준

현재 프로젝트에 필요한 핵심 흐름:

1. Riot ID 입력
2. `account-v1`로 PUUID 조회
3. `match-v5`로 최근 경기와 상세 경기 조회
4. Timeline 이벤트 정규화
5. Data Dragon으로 챔피언/패치 UI 보강

## 보류 자료를 보는 이유

### 1. OP.GG

- 유저가 익숙한 LoL 전적 사이트 UX 문법을 빠르게 흡수할 수 있다.
- 특히 경기 상세 페이지에서 어떤 정보가 먼저 보여야 하는지 참고하기 좋다.

### 2. Mobalytics

- 단순 KDA 중심이 아니라 `Vision`, `Teamplay`, `Consistency` 같은 축으로 진단하는 방법을 참고할 수 있다.
- 현재 규칙 기반 장단점 분석을 장기적으로 재구성할 때 유용하다.

## R&D 자료를 보는 이유

### 1. `.rofl` 직접 처리

- 가능성은 있지만, 포맷 유지보수와 최신 패치 대응 리스크가 크다.
- 브라우저 웹앱의 주 경로로 쓰기보다 별도 실험 트랙으로 분리하는 편이 안전하다.

### 2. Replay API / League Director

- 리플레이 제어, 장면 추출, 영상화에는 가치가 있다.
- 다만 공식 자료 기준으로는 로컬 환경 전제가 강하므로 웹 서비스 기본 스택으로 보기 어렵다.

### 3. 학술 자료

- 현재 MVP를 당장 만들기 위한 필수 자료는 아니지만,
- LLM 입력 최적화, KPI 정의, 장기 통계 분석을 고도화하는 데 도움된다.

## 권장 우선순위

### 1순위

- Riot Developer Portal Docs
- Riot LoL Docs
- Riot API Reference
- Riot General Policies

### 2순위

- OP.GG detailed match data
- OP.GG OP Score explained
- Mobalytics GPI

### 3순위

- Replay API
- League Director
- `.rofl` 파서 저장소들
- 학술 자료

## 실행 계획형 체크리스트

### Phase 1. 현재 MVP 안정화

- [ ] Riot API 호출 흐름 문서와 실제 서버 엔드포인트가 완전히 일치하는지 점검
- [ ] 최근 경기 후보 카드의 포지션, 결과, 챔피언 표기 규칙을 고정
- [ ] 모바일 레이아웃 깨짐 우선 수정
- [ ] 샘플 생성 실패 시 사용자 메시지와 재시도 동선 정리
- [ ] README에 샘플 생성, 챔피언 배지, 실데이터 흐름 설명 유지

필요 자료:

- Riot Developer Portal Docs
- Riot LoL Docs
- Riot API Reference
- Data Dragon versions.json

### Phase 2. 분석 품질 개선

- [ ] Match-V5 + Timeline 기준으로 early / mid / late 판단 규칙 재정리
- [ ] 장점/약점 문장을 KPI 기반 축으로 분해
- [ ] 플레이어 추세 패널에 반복 패턴 기준 명시
- [ ] 핵심 장면 추출 조건에 오브젝트, 데스, 골드 스윙 우선순위 추가

필요 자료:

- OP.GG detailed match data
- OP.GG OP Score explained
- Mobalytics GPI
- KPI identification research

### Phase 3. 장기 확장 연구

- [ ] raw match/timeline을 LLM 입력용 중간 요약 스키마로 압축하는 설계 문서 작성
- [ ] `.rofl` 직접 처리 가능성 검증 브랜치 분리
- [ ] Replay API / League Director 기반 로컬 툴 시나리오 정리
- [ ] 장기 누적 샘플 통계와 패치 단위 비교 설계

필요 자료:

- Structured Summarization of LoL Match Data
- Replay API
- League Director
- rofl-parser.js
- lolrofl-rs
- WPI Riot API analysis

## 바로 실행할 추천 순서

1. 모바일 레이아웃 수정
2. 최근 경기 후보 → 샘플 생성 UX 오류 처리 보강
3. 분석 규칙을 KPI 축 기준으로 재정리
4. LLM 입력용 중간 요약 스키마 초안 작성
5. `.rofl` 직접 처리 R&D는 별도 브랜치로 분리

## 최종 판단

현재 프로젝트는 아래 방향이 가장 안전하다.

1. 메인 트랙은 `Riot Web API 기반 분석`
2. `.rofl 직접 처리`는 별도 R&D
3. UX는 `전적 사이트형 정보구조 + 축 기반 평가 모델`
4. LLM 연동이 필요해지면 raw JSON 대신 `중간 요약 스키마`를 먼저 설계

이 판단은 Riot 공식 문서, Data Dragon 운영 방식, Replay API의 로컬 성격, 오픈소스 파서 유지보수 상태를 함께 보고 내린 실무적 결론이다.
