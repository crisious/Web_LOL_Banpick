# Design Context Bundle — {{TIMESTAMP}}

이 폴더의 파일을 claude.ai Project에 업로드하면 디자인 제안의 정확도가 올라갑니다.

## 메타

- git commit: `{{GIT_COMMIT}}` (branch: `{{GIT_BRANCH}}`)
- design files dirty (uncommitted): **{{GIT_DIRTY}}**
- main.js 포함: **{{INCLUDE_JS}}**

## 업로드 순서 (권장)

1. `design-tokens.md` — 토큰 시스템 / iteration 히스토리 / 알려진 개선 후보 (claude.ai가 가장 먼저 읽도록)
2. `styles.css` — 현재 스타일 (수정 대상)
3. `index.html` — DOM 구조 (셀렉터/data-attribute 참조)
{{JS_LINE}}

## claude.ai Project 시스템 프롬프트 권장

> 이 프로젝트는 LoL Replay Coach 프론트엔드 디자인 토큰 시스템 정리 작업입니다.
> `design-tokens.md`의 토큰 안에서만 변경하고, 새 토큰 추가는 OK지만 기존 토큰 삭제·이름 변경은 피합니다.
> `index.html` 구조와 `main.js`의 데이터 속성 셀렉터(`[data-view]` 등)는 변경하지 않습니다.
> 응답은 `styles.css`에 적용 가능한 unified diff 또는 셀렉터 단위 교체 블록으로 주세요.

## Claude Code 적용

claude.ai에서 받은 diff/스니펫은 다음 슬래시 커맨드로 반영합니다.

```
/design-apply <diff or 자연어 설명>
```

자동화된 토큰 정리 루프는:

```
/design-audit <radius|colors|fontsize|gap|breakpoint|all>
```
