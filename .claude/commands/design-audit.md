---
description: design-auditor 에이전트를 호출해 styles.css를 이터레이티브하게 개선. 인자로 스코프를 전달 (e.g. "radius", "colors", "fontsize", "gap", "all").
argument-hint: [scope]
---

당신은 이 프로젝트의 프론트엔드 디자인 자동화 개선 루프를 시작합니다.

**인자**: `$ARGUMENTS`
- 값이 비어 있으면 `design-tokens.md`의 권장 우선순위 기준으로 다음 1개 항목만 선택합니다.
- 한 번에 여러 스코프를 합치지 말고 1개만 진행합니다.

## 실행 순서

1. [design-tokens.md](design-tokens.md)를 읽고 `10. 알려진 문제 및 개선 후보` 섹션에서 현재 우선순위를 확인합니다.
2. `$ARGUMENTS`가 있으면 아래 스코프 매핑으로 해석합니다.
   - `radius` -> radius 정리
   - `colors`, `tokens` -> color token / hardcoded literal 정리
   - `fontsize`, `typography` -> font-size 정리
   - `gap`, `spacing` -> spacing 정리
   - `breakpoint`, `responsive` -> breakpoint 정리
   - `all` -> 가장 영향 큰 항목 1개만 선택
3. 먼저 `node scripts/design-audit.js --scope <mapped-scope> --format markdown`를 실행해 현재 상태를 수치로 파악합니다.
   - briefing에 최소한 다음을 포함합니다.
   - token coverage
   - top raw literals / values
   - breakpoint 목록
   - missing custom property 또는 runtime CSS variable 구분
4. [styles.css](styles.css)를 읽고, 필요한 경우 [index.html](index.html), [main.js](main.js)도 함께 확인합니다.
5. `design-auditor` 서브에이전트를 **foreground**로 호출합니다. 프롬프트에는 다음을 포함합니다.
   - 선택한 개선 항목과 이유
   - `scripts/design-audit.js` 결과 중 우선 수정 대상
   - [design-tokens.md](design-tokens.md)의 해당 섹션 요약
   - 구조 보존 제약: `index.html` 구조와 `main.js`의 속성 셀렉터는 변경하지 않음
   - 보고 형식 강제: Before / After / Validation
6. 에이전트 응답 후 변경 파일과 핵심 diff를 사용자에게 보여주고, 다음 권장 스코프 1개를 제안합니다.
7. 가능하면 같은 스코프로 `node scripts/design-audit.js`를 다시 실행해 개선 전후를 비교합니다.

## 안전 장치

- 한 번의 실행에서 여러 개선 항목을 동시에 묶지 않습니다.
- [index.html](index.html) 구조 변경이나 [main.js](main.js) 셀렉터 영향이 생기면 중단하고 이유를 명시합니다.
- `styles.css` 편집 전후로 하드코딩 값이 실제로 줄었는지 audit 결과로 확인합니다.
- 새 토큰 추가는 허용하지만 기존 `:root` 변수를 삭제하거나 이름을 바꾸는 일은 피합니다.

## 금지

- 스크린샷 근거 없이 "보기 좋게" 같은 모호한 판단만으로 큰 변경 진행
- JS/HTML 변경을 자동으로 동반 적용
- 여러 스코프를 한 번에 처리하는 대규모 diff

## 출력 템플릿

```md
## /design-audit <scope> 완료

### 적용한 항목
- <항목명>

### Audit 요약
- Before: <coverage / raw literal 핵심 수치>
- After: <coverage / raw literal 핵심 수치>

### 주요 변경
- [styles.css](styles.css) diff 요약 3~5줄

### 브라우저 확인 체크리스트
- [ ] <화면 1>
- [ ] <화면 2>

### 다음 추천
`/design-audit <next-scope>`
```
