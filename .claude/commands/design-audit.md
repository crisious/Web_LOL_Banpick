---
description: design-auditor 에이전트를 호출해 styles.css를 이터레이티브하게 개선. 인자로 스코프 전달 (e.g. "radius", "colors", "fontsize", "gap", "all").
argument-hint: [scope]
---

당신은 이 프로젝트의 프런트엔드 디자인 자동 개선 루프를 시작합니다.

**인자**: `$ARGUMENTS` — 개선 스코프. 빈 값이면 "다음 권장 항목"으로 해석 (design-tokens.md 우선순위 준수).

## 실행 절차

1. [design-tokens.md](design-tokens.md)를 Read하여 "10. 알려진 문제 · 개선 후보" 섹션과 권장 우선순위를 확인한다.
2. `$ARGUMENTS`가 명시되어 있으면 그 스코프에 매핑되는 항목을 선택한다.
   - `radius` → 항목 1 (radius 스케일)
   - `colors` / `tokens` → 항목 2, 3 (알파 배경 + 정보 블루)
   - `fontsize` / `typography` → 항목 4
   - `gap` / `spacing` → 항목 5
   - `breakpoint` / `responsive` → 항목 6
   - `all` → 의존성 순으로 1개만 선택 (한 번에 하나만 수행)
3. 선택한 항목과 현재 [styles.css](styles.css) 상태를 briefing으로 준비한다.
4. `Agent` 도구로 `design-auditor` 서브에이전트를 **foreground**로 호출한다. 프롬프트에 다음을 포함:
   - 선택된 개선 항목과 이유
   - [design-tokens.md](design-tokens.md)의 해당 섹션 요약
   - 불변 제약 재확인 (프레임워크/폰트/테마/구조)
   - 보고 형식 강제 (Before/After/검증/확인 요청)
5. 에이전트 응답 수신 후:
   - 변경 파일 목록과 핵심 diff 1개를 사용자에게 한 화면으로 제시
   - 다음 추천 스코프 1개 제안 (연쇄 실행용)
6. 사용자에게 "브라우저 확인 후 `/design-audit <next>`로 계속" 안내

## 안전장치

- 한 번의 호출에서 여러 개선 항목을 한꺼번에 수행하지 말 것. 이터레이션 단위는 **항목 1개**.
- 에이전트가 [index.html](index.html)이나 [main.js](main.js)를 수정하려 하면 중단시키고 이유 확인.
- 변경 후 `Grep`으로 잔존 하드코딩 값 확인을 생략하지 말 것.

## 안 되는 것

- 스크린샷 없이 "색이 더 예쁘다" 같은 주관 판단 강행 — 에이전트가 하면 수정 거부
- CSS 외 파일 수정 — [design-tokens.md](design-tokens.md) 자체 업데이트는 예외적으로 허용 (토큰 표가 바뀌었을 때)
- 기존 `:root` 변수 삭제 — 추가만 허용

## 출력 템플릿

```
## /design-audit <scope> 완료

### 적용된 항목
- <항목명>

### 주요 변경
[styles.css](styles.css) diff 요약 (3~5줄)

### 브라우저 확인 체크리스트
- [ ] <화면1>
- [ ] <화면2>

### 다음 추천
`/design-audit <next-scope>`
```
