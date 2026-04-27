---
description: claude.ai Project에 업로드할 디자인 컨텍스트 번들을 생성. 인자에 `js`가 포함되면 main.js도 포함, `open`이 포함되면 탐색기로 폴더 열기.
argument-hint: [js] [open]
---

당신은 claude.ai Project에 업로드할 디자인 컨텍스트 번들을 만드는 역할입니다.

**입력 ($ARGUMENTS)**: 공백 구분 토큰
- `js` → `main.js`도 번들에 포함 (JS 셀렉터 영향 검토가 필요할 때)
- `open` → 생성 후 Windows 탐색기로 폴더 자동 열기
- 비어 있으면 기본 (styles.css + design-tokens.md + index.html + README + summary.json)

## 실행 절차

1. **사전 점검**
   - [scripts/design-context-bundle.ps1](scripts/design-context-bundle.ps1) 존재 확인
   - 없으면 중단하고 사용자에게 보고
   - `git status --porcelain styles.css design-tokens.md index.html main.js`로 dirty 여부 메모 (번들에는 워킹 트리가 들어감)

2. **번들 실행**
   - PowerShell로 호출. 인자 매핑:
     - `js` 있음 → `-IncludeJs`
     - `open` 있음 → `-OpenFolder`
   - 예: `powershell -NoProfile -File scripts/design-context-bundle.ps1 -IncludeJs`
   - 출력에서 생성된 디렉터리 경로(`test-artifacts/design-bundle/<timestamp>`)를 확보

3. **검증**
   - 생성된 디렉터리 안에 다음 4~5개 파일이 있는지 확인 (Bash `ls` 또는 PowerShell `Get-ChildItem`):
     - `styles.css`, `design-tokens.md`, `index.html`, `BUNDLE-README.md`, `bundle-summary.json` (`js` 옵션이면 `main.js` 추가)
   - 각 파일 사이즈가 0이 아닌지 확인

4. **보고**

```md
## /design-bundle 완료

### 옵션
- include_js: <true/false>
- open_folder: <true/false>

### 산출물
[test-artifacts/design-bundle/<timestamp>/](test-artifacts/design-bundle/<timestamp>/)

| file | size |
|---|---|
| styles.css | <KB> |
| design-tokens.md | <KB> |
| index.html | <KB> |
| (main.js) | <KB if included> |
| BUNDLE-README.md | <KB> |
| bundle-summary.json | <KB> |

### git
- commit: <short> (branch: <name>)
- design-files dirty: <true/false>

### 다음 단계
1. 위 폴더의 파일들을 claude.ai Project "Add files"에 드래그
2. `BUNDLE-README.md`의 시스템 프롬프트 권장 문구를 Project 지침으로 복사
3. claude.ai에서 받은 diff는 `/design-apply <diff>`로 반영
```

## 안전 장치

- 번들은 워킹 트리(uncommitted 포함)를 그대로 복사합니다. dirty 상태에서 만든 번들로 받은 제안을 적용할 때, 사용자에게 "현재 워킹 트리 기준 제안임"을 환기합니다.
- `test-artifacts/design-bundle/`은 [.gitignore](.gitignore)에 등록되어 있어 커밋되지 않습니다.

## 금지

- 인자에 명시되지 않은 옵션을 임의로 켜기 (특히 `-IncludeJs`)
- 번들에 `data/`, `server.js`, `.env` 등 디자인 외 파일 추가
- 번들을 git에 추가
