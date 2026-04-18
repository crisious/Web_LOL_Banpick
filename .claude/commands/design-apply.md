---
description: claude.ai Project에서 받은 CSS diff/스니펫을 styles.css에 안전하게 적용. 인자로 diff 또는 설명 전달.
argument-hint: <claude.ai에서 받은 CSS diff 또는 변경 설명>
---

당신은 claude.ai Project에서 받은 디자인 변경사항을 Claude Code로 적용하는 역할이다.

**입력 ($ARGUMENTS)**: claude.ai에서 받은 것 중 하나
- unified diff 형식
- "before → after" 형식
- 특정 셀렉터 전체 교체 형식
- 자연어 설명 ("X 카드의 radius를 22→16로")

## 실행 절차

1. **입력 해석**
   - diff라면 `---`/`+++` 헤더에서 대상 파일 확인 ([styles.css](styles.css)가 아니면 중단)
   - 스니펫이라면 핵심 셀렉터 추출
   - 자연어면 셀렉터/속성 후보 목록화

2. **원본 위치 식별**
   - `Grep`으로 대상 셀렉터를 [styles.css](styles.css)에서 찾는다
   - 셀렉터가 여러 곳에 있으면 context 3줄 비교로 정확한 위치 특정
   - 찾지 못하면 사용자에게 "어느 영역이냐" 명확화 요청 (금지: 임의 위치 생성)

3. **충돌 확인**
   - 변경이 [index.html](index.html) 구조 변경을 요구하면 중단하고 보고
   - [main.js](main.js)에서 해당 클래스/속성을 `querySelector` / `classList` / `setAttribute`로 참조하는지 `Grep`
   - 참조 발견 시 변경 영향 목록화 후 사용자 확인

4. **토큰 정합성 체크** ([design-tokens.md](design-tokens.md) 기준)
   - 하드코딩 색상/간격이 들어왔으면 기존 토큰으로 대체 가능한지 확인
   - 대체 가능한데 하드코딩을 고집하는 제안은 사용자에게 한 번 컨펌

5. **적용**
   - `Edit` 사용. 단일 Edit으로 불가능하면 **순차 Edit** (병렬 금지)
   - `replace_all`은 속성 값 레벨에만 (e.g. `22px → 20px`). 셀렉터 전체 교체에는 금지

6. **검증**
   - 변경 후 `Grep`으로 해당 셀렉터 1회 노출 확인 (중복/고아 방지)
   - 빈 선언 (`property:;`) 없는지 확인
   - 필요 시 [design-tokens.md](design-tokens.md) 해당 섹션 업데이트

7. **보고**

```
## /design-apply 완료

### 원본 요청 (요약)
<1줄>

### 적용 위치
[styles.css](styles.css#L<start>-L<end>) — <selector>

### 변경 요약
- <before/after 1~3줄>

### 부가 검증
- JS 셀렉터 영향: <none / listed>
- 토큰 정합: <ok / <대체 제안>>

### 브라우저 확인
- [ ] <화면>
```

## 금지

- [styles.css](styles.css) 외 파일을 건드리는 변경 (JS/HTML) 자동 적용 — 반드시 먼저 사용자 확인
- 구조 변경 (`div` → `section`, `id` 변경 등) 자동 적용 금지
- "대충 비슷한 셀렉터"에 붙이기 — 정확한 위치만 대상

## 실패 시

- 셀렉터 찾지 못함 → "이 셀렉터가 현재 [styles.css](styles.css)에 없습니다. claude.ai가 오래된 버전을 참고했을 수 있습니다. 최신본을 업로드하고 다시 받으세요." 안내
- 여러 위치 매칭 → 후보 위치와 전후 3줄씩 사용자에게 제시 후 선택 요청
