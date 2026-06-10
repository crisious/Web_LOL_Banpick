# 저장 샘플 GUI 숨김 (상세 페이지) — 설계

> 작성일 2026-06-10. 사용자 승인 완료(브레인스토밍).

## 목적

상세/분석 페이지에서 "저장된 샘플"을 화면에 표시·열람하게 하는 GUI를 더 이상 노출하지 않는다. 백엔드(`/api/samples`)·샘플 데이터·매니페스트·추세 집계는 그대로 유지한다.

## 범위 (사용자 확정)

숨길 GUI 3곳:

| 대상 | 셀렉터 | 위치 |
|---|---|---|
| 사이드바 "저장된 샘플" 스위처 | `.panel--samples` | index.html:94 (사이드바 `sidebar-stack`) |
| 로그인 "저장 샘플 열기" 버튼 + 메타 | `.login-demo-actions` | index.html:35 (로그인 화면) |
| "저장된 경기 리포트 빠른 비교" 스트립 | `.panel--reports` | index.html:383 (`#reports`, 추세 탭) |

유지: 로그인 화면의 서버 모드 안내 `.login-mode-panel`, 추세 누적 패널(`#trends`), `/api/samples`, 매니페스트·샘플 데이터, 기존 이스케이핑/스모크 테스트.

## 방식 (사용자 확정): CSS-only `display: none`

설계 불변식("CSS만 손대고 index.html 구조·main.js 셀렉터 보존")을 준수하기 위해 마크업·JS·셀렉터·테스트를 전혀 바꾸지 않고, `styles.css` 끝에 숨김 블록만 추가한다.

```css
/* 저장 샘플 GUI 숨김 (2026-06-10) — 상세 페이지에서 저장 샘플 표시/열람 GUI 비노출.
   마크업·셀렉터·JS는 보존(설계 불변식). main.js는 숨겨진 요소에 그대로 렌더하지만
   요소가 DOM에 존재하므로 오류 없음. /api/samples·추세 집계는 유지. */
.panel--samples,
.panel--reports,
.login-demo-actions {
  display: none;
}
```

### 왜 `display: none`인가
- 접근성 트리·탭 순서에서도 제거되어 "기능 제거"에 부합(visibility:hidden과 달리 잔여 포커스·공간 없음).
- 세 셀렉터는 모두 변형 클래스(`.panel--samples`/`.panel--reports`)거나 고유 클래스(`.login-demo-actions`)이며, 블록을 styles.css 끝에 두면 기존 `.panel`(display 설정)·`.login-demo-actions`(`display:flex`, 동일 명시도)보다 소스 순서상 뒤라 이긴다. 미디어쿼리(4110)는 `align-items`만 설정하므로 display를 재노출하지 않는다 → `!important` 불필요.

## 동작에 미치는 영향

- main.js의 `renderSampleSwitcher()`, 리포트 스트립 렌더, `applyPendingUi()`의 `dom.sampleSwitcher.querySelectorAll(...)`는 그대로 실행되지만 숨겨진 요소를 대상으로 하므로 사용자 영향·오류 없음.
- **알려진 결과**: 세 GUI를 모두 숨기면 read-only 데모 모드에서 개별 샘플을 화면으로 열 진입점이 사라진다(이전에 본 샘플 캐시 복원·프로그램적 `data-sample-button` 클릭만 가능, 추세 집계는 계속 보임). 사용자 승인됨.
- 라이브 모드(Riot ID 로그인 → 최근 경기 조회 → 분석)는 영향 없음.

## 테스트 / 검증

1. **회귀 테스트**(프로젝트 소스 추출 컨벤션): `styles.css`에 세 셀렉터의 `display: none` 규칙이 존재하는지 단언하는 테스트 추가 → 실수로 다시 노출되면 `npm test`가 잡는다.
2. **전체 스위트**: 마크업·JS 무변경이므로 `npm test`는 기존대로 전부 통과해야 한다(이스케이핑 테스트 등 포함).
3. **브라우저 QA**: 로컬 서버에서 로그인 화면("저장 샘플 열기" 미표시), 사이드바("저장된 샘플" 패널 미표시), 추세 탭("저장된 경기 리포트 빠른 비교" 미표시)을 육안 확인.

## 비고

- 되돌리기: 숨김 블록만 제거하면 원복.
- 추후 마크업/JS까지 완전 삭제하려면 별도 작업으로, 결합된 테스트(`sample-switcher-escaping-tests` 등)와 함께 처리한다.
