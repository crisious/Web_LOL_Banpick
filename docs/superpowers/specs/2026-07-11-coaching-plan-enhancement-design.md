# LOLGG AI 코칭 플랜 기능 보강 설계

- 상태: 사용자 명세 승인 완료
- 작성일: 2026-07-11
- 선택 방향: `1. 코칭 플랜`
- 적용 대상: `sites/app` 독립형 읽기 전용 Evidence Lab
- 배포 대상: 기존 비공개 Sites 프로젝트와 기존 URL

## 배경

현재 Evidence Lab은 한 경기의 요약, 핵심 지표, 근거 장면, AI 해석, 실행 루틴을 사실과 해석이 섞이지 않도록 보여준다. 다만 긴 AI 헤드라인이 최대 `5.5rem`, 굵기 `820`, 최소 높이 `510px`의 히어로를 차지해 첫 화면을 과도하게 지배한다. 또한 `playtimeScore.categories`, `phaseContext`, `phaseSummaries`, `weaknesses`, `actionChecklist`처럼 이미 배포되는 코칭 데이터가 충분히 활용되지 않는다.

공식 LoL 코칭 서비스 조사에서는 다음 패턴을 확인했다.

- Mobalytics: 역량별 성과 지표와 다음 게임의 목표형 Challenges
- iTero: 경기 데이터를 개인화된 전략 플레이북으로 전환
- Porofessor: 교전, 성장, 시야, 오브젝트 등 영역별 상세 분석
- Skill Capped: 추천 결과뿐 아니라 이유와 실행법을 함께 설명

이 설계는 해당 패턴을 그대로 복제하지 않는다. 현재 공개 샘플에서 검증 가능한 데이터만 사용해 `핵심 약점 → 역량 분해 → 구간별 흐름 → 근거 장면 → 실행 루틴`으로 연결한다.

## 목표

1. 긴 분석 제목의 시각적 압력을 낮춰 경기 정보와 코칭 기능이 첫 화면에서 더 빨리 보이게 한다.
2. 한 경기에서 가장 먼저 고칠 약점과 대표 행동을 하나의 `NEXT GAME FOCUS`로 제시한다.
3. 종합 점수에 숨겨진 여섯 개 역량을 0–10 범위의 데이터 기반 프로필로 보여준다.
4. 초반·중반·후반의 K/D/A와 중요 사건 수를 AI 단계 요약과 함께 연결한다.
5. 기존 사실/AI 해석 분리와 읽기 전용 개인정보 경계를 유지한다.

## 비목표

- 라이브 Riot 계정 검색이나 최신 경기 동기화
- 티어, 역할, 챔피언 평균과의 백분위 비교
- 상대 챔피언 또는 양 팀 조합 기반 매치업 조언
- VOD, 좌표 히트맵, 스킬 사용 영상 분석
- 공개 샘플을 개인의 장기 성장 기록처럼 표현하는 추이 기능
- AI 간 의견 일치율을 통계적 신뢰도처럼 표현하는 기능
- Worker API, 저장소 스키마, 인증 방식 변경

## 시각 조정

### 히어로와 제목

- 히어로 최소 높이: `510px → 390px`
- 히어로 여백: `90px 0 82px → 64px 0 60px`
- 제목 최대 너비: `850px → 760px`
- 제목 크기: `clamp(2.6rem, 5.7vw, 5.5rem) → clamp(1.9rem, 3.8vw, 3.45rem)`
- 제목 굵기: `820 → 700`
- 제목 행간: `1.06 → 1.16`
- 제목 자간: `-0.055em → -0.035em`
- 모바일 제목: `clamp(1.8rem, 8.5vw, 2.8rem)`
- 코칭 요약 상단 여백: `33px → 24px`
- 원형 `LAB` 스탬프는 약 20% 축소하고 명도를 낮춘다.

라임색 eyebrow, 경기 메타 칩, Pretendard 단일 글꼴, 딥 네이비 배경은 유지한다. 제목을 약하게 만드는 대신 섹션 제목과 `NEXT GAME FOCUS`의 위계를 올려 분석 화면다운 밀도를 만든다.

## 정보 구조

페이지 순서는 다음과 같다.

1. 헤더와 공개 샘플 선택
2. 축소된 한 문장 진단 히어로
3. `NEXT GAME FOCUS`
4. 핵심 지표와 `SKILL PROFILE`
5. `PHASE COACH`
6. 기존 핵심 근거 장면
7. 기존 다음 게임 실행 루틴
8. 기존 분석 근거 인덱스

새 기능은 별도 라우트나 모달을 만들지 않고 현재 한 페이지 흐름 안에 배치한다.

## 기능 1: NEXT GAME FOCUS

### 목적

여러 약점과 루틴 중 사용자가 다음 게임에서 가장 먼저 실행할 한 가지를 고르게 한다.

### 데이터 선택 규칙

1. `analysis.weaknesses[0]`을 기본 핵심 약점으로 사용한다.
2. 해당 약점의 `id`와 `actionChecklist[].linkedWeaknessId`가 일치하는 첫 행동을 대표 루틴으로 사용한다.
3. 일치 항목이 없으면 `actionChecklist[0]`을 사용한다.
4. 근거 수는 핵심 약점의 유효한 `relatedEventIds` 개수다.
5. 제목, 설명, 대표 루틴이 모두 없을 때만 명시적인 빈 상태를 표시한다.

### 표시 내용

- 핵심 약점 제목
- 약점 설명
- `연결 근거 N건`
- 다음 경기 대표 행동 한 문장
- `근거 장면 보기` 버튼

### 상호작용

`근거 장면 보기`는 핵심 약점과 이벤트 ID가 겹치는 첫 핵심 장면을 선택하고 근거 장면 영역으로 이동한다. 겹치는 핵심 장면이 없으면 장면 선택을 바꾸지 않고 근거 장면 영역으로만 이동한다. 네이티브 `button`을 사용하고, 이동 후 `tabindex="-1"`인 근거 섹션 제목으로 포커스를 옮긴다. 장면이 바뀌면 기존 근거 상세 라이브 영역이 새 내용을 알리고, 장면이 바뀌지 않으면 앱 상태 영역이 이동 완료를 알린다.

## 기능 2: SKILL PROFILE

### 목적

종합 점수 하나를 전투, 수급, 시야, 생존, 오브젝트, 구조물의 여섯 역량으로 분해한다.

### 데이터

- `normalized.playtimeScore.overall`
- `normalized.playtimeScore.label`
- `normalized.playtimeScore.categories.combat`
- `normalized.playtimeScore.categories.income`
- `normalized.playtimeScore.categories.vision`
- `normalized.playtimeScore.categories.survival`
- `normalized.playtimeScore.categories.objective`
- `normalized.playtimeScore.categories.structure`

### 표시 규칙

- 각 값은 0–10 범위로 제한해 소수점 한 자리까지 표시한다.
- 각 행은 한국어 역량명, 수치, 가로 막대로 구성한다.
- 막대는 `role="meter"`, `aria-valuemin="0"`, `aria-valuemax="10"`, `aria-valuenow`를 제공한다.
- 값이 없거나 숫자가 아니면 해당 행을 `측정 없음`으로 표시하며 추정하지 않는다.
- 이 점수는 티어 평균이나 백분위가 아니라 선택 경기의 내부 코칭 점수라고 명시한다.

기존 KDA, 시야 점수, 킬 관여 카드와 같은 섹션 안에서 배치하되, 핵심 지표 3개는 사실 지표, 여섯 역량은 코칭 모델 지표로 라벨을 분리한다.

## 기능 3: PHASE COACH

### 목적

경기의 초반·중반·후반 흐름을 한눈에 비교하고, 각 구간의 사실 기록과 AI 요약을 구분한다.

### 데이터 결합

- 사실: `normalized.phaseContext.early|mid|late`
- 해석: `analysis.phaseSummaries[]`

단계 매핑은 다음과 같이 고정한다.

- `early ↔ EARLY ↔ 초반`
- `mid ↔ MID ↔ 중반`
- `late ↔ LATE ↔ 후반`

### 카드 내용

- 구간명과 시간 범위
- K / D / A
- 중요 사건 수
- AI 단계 요약

`phaseSummaries`가 없는 샘플에서도 `phaseContext` 카드와 사실 수치는 유지한다. 이 경우 해석 영역에는 `이 구간의 AI 요약이 없습니다.`를 표시한다. 구간 자체가 없으면 해당 카드만 빈 상태로 렌더링한다.

### 레이아웃

- 데스크톱: 3열
- 720px 이하: 1열
- 카드 안에서 사실 수치와 AI 요약을 시각적으로 분리한다.

## 데이터 흐름과 코드 경계

기존 `/api/samples`와 `/api/samples/:id`만 사용한다. 새로운 네트워크 요청이나 Worker 엔드포인트는 만들지 않는다.

테스트 가능한 순수 데이터 변환과 DOM 렌더링을 다음처럼 분리한다.

- `sites/app/coaching-plan.js`
  - `buildFocusModel(analysis)`: 약점과 대표 행동 선택
  - `findFocusMomentId(focus, moments)`: 포커스와 겹치는 첫 근거 장면 선택
  - `buildSkillProfile(normalized)`: 여섯 역량 정규화
  - `buildPhaseModels(normalized, analysis)`: 단계 사실과 AI 요약 결합
- `sites/app/app.js`
  - `renderFocus(model)`: 포커스 카드와 근거 이동 버튼
  - `renderSkillProfile(model)`: 접근 가능한 meter 목록
  - `renderPhaseCoach(models)`: 세 단계 카드

`renderDetail()`은 각 모델 생성과 렌더 함수를 호출한다. `resetDependentPanels()`는 새 세 영역도 loading, empty, error 상태에서 초기화해 이전 경기 내용이 남지 않게 한다.

## 접근성과 반응형

- 새 섹션은 모두 `section`과 연결된 제목을 사용한다.
- 포커스 이동 버튼은 키보드와 터치로 동일하게 작동한다.
- 역량 막대는 색상만으로 수치를 전달하지 않고 이름과 숫자를 함께 표시한다.
- 구간 카드 안에서 사실과 AI 요약의 라벨을 분리한다.
- 1024px 이하에서는 포커스와 역량 프로필을 단일 열로 재배치한다.
- 720px 이하에서는 핵심 지표와 구간 카드를 단일 열로 재배치한다.
- 320px에서도 가로 스크롤이 생기지 않아야 한다.
- `prefers-reduced-motion` 규칙을 유지한다.

## 상태와 오류 처리

- `loading`: 새 세 영역에 각각 구체적인 로딩 문구를 표시한다.
- `empty`: 데이터가 없는 이유를 영역별로 표시한다.
- `error`: 이전 경기의 포커스, 역량, 구간 정보가 남지 않는다.
- 부분 데이터: 사용할 수 있는 사실은 유지하고 누락된 AI 요약이나 점수만 빈 상태로 표시한다.
- 모든 동적 문자열은 기존 `escapeHtml()` 경계를 유지한다.

## 테스트 전략

구현은 테스트 우선으로 진행한다.

### 자동 테스트

1. 제목 강조 축소 계약: 데스크톱·모바일 크기, 굵기, 히어로 높이
2. 포커스 모델: 연결 약점 우선, fallback 행동, 근거 수
3. 포커스 이동: 관련 장면 선택과 관련 장면 없음 fallback
4. 역량 프로필: 여섯 카테고리, 0–10 제한, 숫자 누락 상태, meter ARIA
5. 구간 모델: EARLY/MID/LATE 매핑, K/D/A, 사건 수, AI 요약 결합
6. 구간 요약 누락 샘플의 사실 fallback
7. loading, empty, error에서 새 패널 초기화
8. HTML 이스케이프와 사실/AI 해석 분리
9. 1024px, 720px, 480px 반응형 계약
10. 읽기 전용 스테이징과 개인정보 제거 계약

### 전체 검증

- Sites 전용 테스트와 프로덕션 빌드
- 저장소 전체 회귀 테스트
- 브라우저 QA: 1280px, 768px, 390px, 320px
- 경기 선택, 포커스→근거 이동, 장면 선택, 루틴 체크
- 키보드 포커스, 콘솔 오류, 프레임워크 오류 화면, 가로 넘침
- 기존 비공개 URL의 소유자 접근 정책 유지

스크린샷과 임시 테스트 산출물은 저장소 밖 `/tmp`에만 둔다.

## 변경 범위

변경 예정:

- `sites/app/index.html`
- `sites/app/styles.css`
- `sites/app/app.js`
- `sites/app/coaching-plan.js`
- `sites/tests/standalone-ui.mjs`
- `sites/tests/coaching-plan-models.mjs`
- 필요한 경우 Sites 읽기 전용 smoke 테스트

유지:

- `sites/worker/index.js`
- `sites/vite.config.js`
- `sites/.openai/hosting.json`
- 공개 샘플 원본과 현재 사용자 작업 중 샘플
- 기존 비공개 Sites URL과 접근 정책

## 완료 기준

1. 제목이 긴 샘플에서도 1280px과 320px에서 제목이 화면을 과도하게 지배하지 않는다.
2. 모든 커밋 공개 샘플에서 포커스, 여섯 역량, 세 구간이 오류 없이 렌더링된다.
3. 데이터가 없는 경우 명시적인 빈 상태를 표시하고 수치나 조언을 추정하지 않는다.
4. 기존 근거 장면과 루틴 상호작용이 회귀하지 않는다.
5. 읽기 전용·비식별화 테스트와 전체 회귀 테스트가 통과한다.
6. 브라우저 QA에서 콘솔 오류, 가로 넘침, 접근성 차단 문제가 없다.
7. 기존 비공개 Sites URL에 새 버전이 성공적으로 게시된다.

## 참고 자료

- Mobalytics LoL App: https://mobalytics.gg/lol/glp/app-download
- Mobalytics GPI: https://mobalytics.gg/lol/lp/gpi
- Blitz LoL: https://blitz.gg/welcome/lol
- Porofessor App: https://porofessor.gg/en/download
- iTero AI Coach: https://www.itero.gg/
- Skill Capped LoL Guides: https://www.skill-capped.com/lol/guides
