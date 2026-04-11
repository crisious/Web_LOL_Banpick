# LoL Replay Analysis MVP

리그 오브 레전드 경기 데이터를 불러와서 한 경기 요약, 장점/약점, 핵심 장면, 실행 체크리스트를 보여주는 웹 프로토타입입니다.  
MVP 기준으로는 `.rofl` 원본 직접 처리 대신 Riot Match-V5 + Timeline API를 사용해 분석 입력을 구성합니다.

## 현재 범위

- 저장된 샘플 경기 목록 조회
- 샘플별 분석 대시보드 렌더링
- 저장 샘플 기준 플레이어 추세 요약
- Riot ID 입력 후 최근 경기 후보 조회
- 후보 경기 1건을 클릭해서 새 샘플 생성
- 챔피언 배지 UI 렌더링
  - 작은 카드: Data Dragon 최신 버전 기반 `square icon` 우선 사용
  - 큰 스냅샷: `loading art` 기반 대표 이미지 사용
  - 버전 조회 전/실패 시 `loading art` 또는 이니셜 배지로 fallback
- 원본 응답, 정규화 JSON, 분석 결과 JSON을 `data/samples/` 아래에 저장
- Riot API 키를 프런트엔드에 노출하지 않고 서버에서만 사용

## 화면 흐름

### 1. 샘플 분석 대시보드

- 경기 헤드라인
- Quick View 상단 요약 바
- Champion / Role / Result 스냅샷
- KDA, CS, 킬관여, 시야, 오브젝트 지표
- 저장된 리포트 빠른 비교
- 플레이어 추세 요약
- 초반/중반/후반 페이즈 요약
- 플레이 강점 / 약점
- 다음 경기 체크리스트
- 핵심 장면과 근거 이벤트

### 2. 최근 경기 불러오기

입력값:

- `gameName`
- `tagLine`
- `platformRegion`

버튼을 누르면 서버가 아래 순서로 데이터를 가져옵니다.

1. Riot ID -> `account-v1`
2. PUUID -> 최근 Match ID 목록
3. 각 Match 상세 조회
4. UI에 챔피언/포지션/결과 중심의 샘플 후보 카드 표시

후보 카드를 클릭하면 해당 경기의 상세 + Timeline을 다시 가져와 새 샘플을 생성합니다.

## 주요 파일

```text
.
├── index.html
├── main.js
├── styles.css
├── server.js
├── data/
│   └── samples/
│       ├── manifest.json
│       ├── sample-001/
│       └── sample-002/
├── decision-replay-processing.md
├── plan-riot-api-sample-data.md
├── normalized-match-schema.md
└── sample-data-ops-runbook.md
```

## 로컬 실행

### 1. 환경 변수 파일 준비

```bash
cp .env.example .env
```

`.env`에 Riot 개발 키를 넣습니다.

```bash
RIOT_API_KEY=RGAPI-your-development-key
PORT=8123
```

### 2. 서버 실행

```bash
node server.js
```

브라우저에서 아래 주소를 엽니다.

- [http://127.0.0.1:8123](http://127.0.0.1:8123)

## 테스트용 입력 예시

- `gameName`: `매운맛 비스킷`
- `tagLine`: `KR1`
- `platformRegion`: `KR`

## API 동작 메모

- `KR`, `JP1` 계정의 match/account 조회는 `asia.api.riotgames.com` 클러스터를 사용
- 최근 경기 후보는 간단한 `sampleFitScore` 기준으로 정렬
- 샘플 manifest 항목에는 `champion`, `publicAlias`, `collectedDate`, `theme`를 함께 저장
- 챔피언 배지 이미지는 Riot Data Dragon을 사용하며, 런타임에 최신 버전을 확인해 정사각형 아이콘 경로를 구성
- 생성된 샘플은 아래 파일을 함께 남김

```text
data/samples/sample-<match-id>/
├── raw-account.json
├── raw-match.json
├── raw-timeline.json
├── normalized-match.json
├── analysis-result.json
└── sample-<id>-notes.md
```

## 문서 맵

- `decision-replay-processing.md`: `.rofl` 직접 처리 vs Riot API 의사결정
- `plan-riot-api-sample-data.md`: 샘플 경기 수집 전략
- `riot-api-call-spec.md`: 호출 순서와 요청 스펙
- `normalized-match-schema.md`: 분석 입력 스키마
- `normalization-mapping-rules.md`: Match/Timeline -> 정규화 규칙
- `sample-data-ops-runbook.md`: 샘플 생성 운영 절차

## 현재 샘플 상태

- 현재 저장된 샘플 수: `3`
- 기본 샘플:
  - `sample-001` / `Nasus MID LOSS`
  - `sample-002` / `Dr. Mundo JUNGLE WIN`
- 라이브 생성 검증 샘플:
  - `sample-kr-8166637996` / `Dr. Mundo JUNGLE WIN`

## UI 메모

- 샘플 스위처 카드: 챔피언 배지 + 챔피언명 + 샘플 라벨 + Riot ID
- 저장된 리포트 카드: 챔피언 배지 + 챔피언명 + 역할/결과 배지
- 최근 경기 후보 카드: 챔피언 배지 + 챔피언명 + 역할/결과 태그 + fit 점수
- Quick View Champion 영역: 큰 챔피언 대표 아트 + 챔피언명

## 최근 검증 메모

- `2026-04-11` 기준 Homebrew로 Node 설치 후 `node server.js` 실행 확인
- `/api/samples` 및 `/api/samples/sample-001` 정상 응답 확인
- `매운맛 비스킷#KR1` 기준 `/api/recent-matches` 실데이터 조회 확인
- `KR_8166637996` 기준 `/api/generate-sample` 실데이터 샘플 생성 확인
- 생성 결과가 `data/samples/manifest.json` 및 새 샘플 폴더에 정상 반영되는 것 확인
- Headless Chrome으로 데스크톱/모바일 화면 캡처 후 레이아웃 밀도 조정 완료

## 보안 주의

- `RIOT_API_KEY`는 브라우저 코드에 넣지 않습니다.
- 현재 키가 외부에 노출된 적이 있다면 Riot Developer Portal에서 새 키로 재발급하는 편이 안전합니다.
- 개발 키는 만료형이므로 장기 운영 전에는 재발급과 배포 전략을 따로 잡아야 합니다.

## 현재 한계

- 분석 결과는 규칙 기반 요약이라 코치 품질의 해설은 아닙니다.
- `.rofl` 리플레이 원본 직접 업로드/파싱은 아직 미지원입니다.
- Riot 개발 키 만료, rate limit, 패치 변경에 따라 결과가 흔들릴 수 있습니다.

## 안내

이 프로젝트는 팬메이드 분석 프로토타입입니다.  
Riot Games의 공식 제품이 아니며 Riot의 승인이나 보증을 받지 않았습니다.
