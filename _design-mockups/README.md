# 디자인 목업 (`_design-mockups/`)

이 폴더는 **프로덕션 코드와 분리된 디자인 레퍼런스**입니다. 각 파일은 외부 의존성이 없는 self-contained HTML(인라인 CSS + 인라인 JS)이라 브라우저로 바로 열어 볼 수 있어요.

> 폴더명에 `_` 접두를 둔 이유: 프로덕션 빌드/배포에서 자동으로 제외시키기 쉽도록(대부분의 정적 호스팅과 빌드 도구가 `_` 접두 폴더를 무시).

---

## 파일 목록

### 1. [`improved-mockup.html`](./improved-mockup.html) — 개요 탭 단일 레퍼런스 (1095 라인, 38.5 KB)

가장 처음 만든 단일 페이지 목업. **로그인된 사용자가 보는 메인 대시보드의 "개요" 탭**만 채워져 있습니다. 디자인 시스템(토큰·컴포넌트·간격·색상)을 한 화면 안에서 검증한 첫 결과물.

**언제 보면 좋은지**: 단일 컴포넌트의 디테일(메트릭 카드, 점수 링, 인사이트 카드, 디테일 헤더)을 클로즈업해서 보고 싶을 때.

### 2. [`improved-full.html`](./improved-full.html) — 4개 탭 풀페이지 (635 라인, 51.1 KB)

개요 / 상세 분석 / 타임라인 / 최근 추세 4개 탭을 모두 채운 완성형 목업. 탭 전환은 실제 JS로 동작하므로 키보드(←/→/Home/End) 네비게이션도 검증 가능.

**언제 보면 좋은지**:
- 신규 컴포넌트(SVG KDA 그래프, 빌드 오더 가로 스크롤, 트렌드 콜아웃)의 풀 컨텍스트를 보고 싶을 때
- 데모 영상 녹화·스크린샷을 찍어야 할 때
- 디자인 변경이 4개 탭 전체에 일관되게 적용되는지 확인할 때

### 3. [`improved-admin.html`](./improved-admin.html) — admin 페이지 통합 디자인 (479 라인, 31 KB)

기존 `admin.html`/`admin.css`가 본 화면과 완전히 다른 팔레트(`--blue`/`--gold`/`--red`)와 폰트(Trebuchet+Georgia 혼합)를 쓰던 문제를 해결한 리디자인 목업. 5개 섹션(LIVE 송출 제어 / 방송 기본 정보 / 페이즈 편집 / 블루팀 / 레드팀)을 본 화면과 동일한 디자인 토큰으로 통일.

**언제 보면 좋은지**: admin 페이지 추가 작업 전 디자인 방향 합의용.

---

## 프로덕션 코드와의 관계

| 항목 | 프로덕션 (`/index.html`, `/styles.css` 등) | 목업 (`_design-mockups/`) |
| --- | --- | --- |
| 토큰 정의 | `:root`에 정의됨 (Phase 1, 4 패치 완료) | 인라인 `<style>`에 동일 토큰 복제 |
| 컴포넌트 | `main.js`/`admin.js`가 동적 렌더 | 정적 HTML로 직접 작성 |
| 데이터 | Riot API + 로컬 샘플 | 더미 한국 컨텍스트 (T1 vs Gen.G 등) |
| a11y | axe-core 0 violations | axe-core 0 violations |

**프로덕션 코드와 목업이 동일한 토큰을 공유**하므로, 어느 한쪽을 수정하면 같은 토큰을 다른 쪽에도 반영해야 합니다.

---

## 검증

세 파일 모두 axe-core WCAG 2.1 AA 자동 감사를 통과했습니다 (위반 0건). 자세한 결과는 상위 폴더의 [`CHANGELOG.md`](../CHANGELOG.md) Phase 8 섹션 참조.

```
✓ improved-mockup.html     passes=38, violations=0
✓ improved-full.html       passes=38, violations=0
✓ improved-admin.html      passes=34, violations=0
```

---

## 열어 보기

```bash
# 브라우저에서 직접 열기 (macOS)
open improved-mockup.html
open improved-full.html
open improved-admin.html

# 또는 간이 정적 서버
python3 -m http.server -d _design-mockups 8080
# → http://localhost:8080/improved-full.html
```
