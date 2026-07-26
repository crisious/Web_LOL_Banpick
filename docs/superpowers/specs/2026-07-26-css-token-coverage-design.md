# styles.css 잔여 raw 값 토큰화 설계

- 날짜: 2026-07-26
- 대상: `styles.css`, `scripts/design-audit.js`
- 선행 작업: 정확 일치 17건 치환 완료 (커버리지 colors 91.9% / radius 92.9% / spacing 87.8% / fontSize 96.6%)

## 배경

`scripts/design-audit.js` 기준으로 `styles.css`에 raw 값 93건이 남아 있다(colors 57 + radius 10 + spacing 19 + fontSize 7). 전수 조사(`--top 999 --format json`) 결과 이는 균질한 부채가 아니라 성격이 다른 네 덩어리였다.

| 분류 | colors | radius | spacing | fontSize | 계 |
|---|---:|---:|---:|---:|---:|
| 감사 도구 오집계 (`.evidence-lab` 토큰 정의) | 11 | – | – | – | 11 |
| 알파 파생 가능 | 13 | – | – | – | 13 |
| 반복 사용 (2회 이상) | 4 | 5 | 8 | 0 | 17 |
| 단발 사용 (1회) | 29 | 5 | 11 | 7 | 52 |

핵심 구조적 사실 두 가지:

1. **`.evidence-lab`(styles.css:4915)은 자체 토큰 레이어를 갖는다.** `--evidence-bg`부터 `--evidence-red`까지 11개를 컴포넌트 스코프로 정의한다. 감사 도구는 `:root`만 토큰 정의 블록으로 인식하므로 이 11줄을 raw 색상으로 오집계한다. 즉 colors 커버리지 91.9%는 실제보다 낮게 나온 값이다.
2. **`.tf-*`는 `.evidence-lab`의 형제다.** index.html에서 `.evidence-lab` 섹션은 237행에서 닫히고 `#teamfight-phases`는 296행에서 시작한다. 따라서 `.tf-*` 규칙에서는 `--evidence-*`가 해석되지 않는다 — 사용하면 값이 무효화되어 스타일이 깨진다.

## 목표

- 반복 사용되는 값과 알파 파생 관계를 토큰으로 승격한다.
- 미정의 토큰 참조 버그를 없앤다.
- 감사 도구가 컴포넌트 스코프 토큰을 인식하게 해 지표를 정확히 만든다.

## 비목표

- 단발 리터럴은 원칙적으로 그대로 둔다. 한 번만 쓰이는 값에 이름을 붙이면 중복 제거 이득 없이 조회 단계만 늘어난다.
  - 예외 2건: `#6ee7b7`(4901)과 `#f47272`(4895)는 단발이지만 §2에서 베이스 토큰으로 승격한다. 각각 바로 옆 줄의 태그 배경(4900/4894)이 이 색의 알파 변형이므로, 베이스를 토큰화하지 않으면 파생 관계를 표현할 수 없다.
  - 따라서 단발 52건 중 50건이 리터럴로 남는다.
- 미완성 래더 증설은 하지 않는다 (아래 "후속 관찰" 참조).

## 원칙

**픽셀 동일 유지.** 기존 토큰에 정확히 일치하거나 계산상 동일한 값만 사용한다. 값이 다르면 스냅하지 않고 원래 값을 담은 새 토큰을 만든다.

**예외 2건(승인됨).** 같은 역할에 알파가 드리프트한 곳만 통합한다. 근거는 인접 형제 규칙이 미세하게 다른 값을 쓰고 있어 의도적 구분으로 보기 어렵다는 점이다.

| 예외 | 변경 | 영향 |
|---|---|---|
| 배지 테두리 알파 | 34% / 40% / 42% → **38%** | 1px 테두리 3곳, 최대 0.08 |
| `.tf-tag` 배경 알파 | 16% / 18% → **17%** | 태그 배경 2곳, 0.01 |

`color-mix()`가 rgba 리터럴과 픽셀 동일한지는 Chrome 150에서 4가지 배경(#06101d, #0b1d2f, #ffffff, #808080)에 합성해 바이트 비교로 검증했다 — 11/11 일치. 프리멀티플라이드 알파 규칙상 `color-mix(in srgb, C p%, transparent)`는 `C`를 알파 `p`로 적용한 것과 같다.

## 섹션 1 — `.evidence-lab` 알파 파생 레이어

`.evidence-lab`의 기존 베이스 팔레트 아래(styles.css:4926 다음)에 추가한다.

```css
  /* 알파 파생 레이어 — 베이스 색에서 계산으로 유도하므로 베이스 변경이 자동 전파된다. */
  --evidence-border-alpha: 38%;
  --evidence-border-cyan:  color-mix(in srgb, var(--evidence-cyan)  var(--evidence-border-alpha), transparent);
  --evidence-border-green: color-mix(in srgb, var(--evidence-green) var(--evidence-border-alpha), transparent);
  --evidence-border-red:   color-mix(in srgb, var(--evidence-red)   var(--evidence-border-alpha), transparent);
  --evidence-ring-cyan:    color-mix(in srgb, var(--evidence-cyan) 24%, transparent);
  --evidence-fill-alpha: 8%;
  --evidence-fill-cyan:  color-mix(in srgb, var(--evidence-cyan)  var(--evidence-fill-alpha), transparent);
  --evidence-fill-green: color-mix(in srgb, var(--evidence-green) var(--evidence-fill-alpha), transparent);
  --evidence-fill-green-soft: color-mix(in srgb, var(--evidence-green) 14%, transparent);
  --evidence-grid-blue:  color-mix(in srgb, var(--evidence-blue) 3.5%, transparent);
```

치환 11곳:

| 줄 | 현재 값 | 교체 | 픽셀 |
|---:|---|---|---|
| 4945 | `rgba(79, 140, 255, 0.035)` | `var(--evidence-grid-blue)` | 동일 |
| 4946 | `rgba(79, 140, 255, 0.035)` | `var(--evidence-grid-blue)` | 동일 |
| 5004 | `rgba(54, 214, 231, 0.42)` | `var(--evidence-border-cyan)` | **42→38%** |
| 5006 | `rgba(54, 214, 231, 0.08)` | `var(--evidence-fill-cyan)` | 동일 |
| 5043 | `rgba(85, 214, 154, 0.38)` | `var(--evidence-border-green)` | 동일 |
| 5048 | `rgba(255, 115, 128, 0.4)` | `var(--evidence-border-red)` | **40→38%** |
| 5084 | `rgba(85, 214, 154, 0.34)` | `var(--evidence-border-green)` | **34→38%** |
| 5086 | `rgba(85, 214, 154, 0.08)` | `var(--evidence-fill-green)` | 동일 |
| 5111 | `rgba(54, 214, 231, 0.24)` | `var(--evidence-ring-cyan)` | 동일 |
| 5237 | `rgba(54, 214, 231, 0.24)` | `var(--evidence-ring-cyan)` | 동일 |
| 5419 | `rgba(85, 214, 154, 0.14)` | `var(--evidence-fill-green-soft)` | 동일 |

`--evidence-grid-blue`는 `.evidence-lab::before`에서 쓰인다. 커스텀 프로퍼티는 의사 요소로 상속되므로 문제없다.

이 섹션의 토큰 중 다수는 단발 사용이다. 정당화 근거는 중복 제거가 아니라 **파생 관계의 명시와 알파 노브**다 — 비목표에 적은 "단발 값은 토큰화하지 않는다"와 근거가 다르므로 혼동하지 말 것.

## 섹션 2 — `.tf-phase-row` 스코프 토큰

`.tf-*`에서 `--evidence-*`를 쓸 수 없다는 제약 때문에, `.evidence-lab`과 같은 패턴으로 자체 스코프 블록을 만든다. `.tf-phase-row`가 `.tf-tag`·`.tf-kd`의 조상이므로 스코프 루트로 적합하다.

동시에 미정의 토큰 참조 버그를 해소한다. `--border-subtle`과 `--text-muted`는 `styles.css` 어디에도 정의돼 있지 않고 `var()` 폴백만으로 동작하고 있다.

```css
.tf-phase-row {
  --tf-line:  var(--surface-4);   /* 기존 --border-subtle 폴백과 동일값, 전역 래더에 연결 */
  --tf-muted: #a9b3c1;            /* 기존 --text-muted 폴백을 그대로 승격 */
  --tf-win:   #6ee7b7;
  --tf-loss:  #f47272;
  --tf-fill-alpha: 17%;
  --tf-win-fill:  color-mix(in srgb, var(--tf-win)  var(--tf-fill-alpha), transparent);
  --tf-loss-fill: color-mix(in srgb, var(--tf-loss) var(--tf-fill-alpha), transparent);
  padding: 0.5rem 0;
  border-top: 1px solid var(--tf-line);
}
```

치환 7곳:

| 줄 | 현재 값 | 교체 | 픽셀 |
|---:|---|---|---|
| 4873 | `var(--border-subtle, rgba(255, 255, 255, 0.08))` | `var(--tf-line)` | 동일 |
| 4888 | `var(--text-muted, #a9b3c1)` | `var(--tf-muted)` | 동일 |
| 4894 | `rgba(244, 114, 114, 0.18)` | `var(--tf-loss-fill)` | **18→17%** |
| 4895 | `#f47272` | `var(--tf-loss)` | 동일 |
| 4900 | `rgba(110, 231, 183, 0.16)` | `var(--tf-win-fill)` | **16→17%** |
| 4901 | `#6ee7b7` | `var(--tf-win)` | 동일 |
| 4903 | `var(--text-muted, #a9b3c1)` | `var(--tf-muted)` | 동일 |

`--border-subtle` / `--text-muted`라는 이름을 쓰지 않고 `--tf-*`로 옮기는 이유: 두 이름은 전역 체계를 암시하지만 실제 사용처는 `.tf-*` 세 줄뿐이다. 전역에 올리면 기존 `--muted: #97afba`와 의미가 겹치는 두 번째 muted 텍스트 색이 루트에 생긴다.

## 섹션 3 — 반복값 토큰

| 토큰 | 값 | 스코프 | 대상 줄 |
|---|---|---|---|
| `--evidence-radius` | `18px` | `.evidence-lab` | 5016, 5181, 5454 |
| `--evidence-radius-sm` | `12px` | `.evidence-lab` | 5299, 5394 |
| `--evidence-surface-sunken` | `#091827` | `.evidence-lab` | 5300, 5395 |
| `--evidence-gap` | `18px` | `.evidence-lab` | 5166, 5173, 5188 |
| `--space-0` | `2px` | `:root` | 3129, 3140, 3285, 4616, 4822 |

15곳 모두 픽셀 동일.

- `--space-0`은 기존 `--space-1: 4px` 아래 스텝이다. 5곳 전부 `flex-direction: column` 스택의 라벨/값 간격이라 역할이 일치한다.
- `--evidence-surface-sunken`은 `#06101d`(bg)와 `#0b1d2f`(surface) 사이 값이며, 카드 내부 패널 배경으로 쓰인다.
- 5454는 `@media (max-width: 760px)` 안의 `.evidence-lab` 규칙이므로 스코프가 유지된다.
- radius와 gap이 둘 다 18px인 것은 우연이며 별개 토큰으로 둔다. 하나로 묶으면 무관한 두 결정이 결합된다.

## 섹션 4 — `scripts/design-audit.js` 오집계 수정

원인은 감사 대상 소스를 만드는 한 줄이다 (design-audit.js:740).

```js
const auditSource = blankRanges(sanitizedSource, [{ start: rootBlock.start, end: rootBlock.end }]);
```

`:root` 블록만 제외하므로 다른 블록의 커스텀 프로퍼티 정의가 raw 값으로 남는다.

수정:

1. `parseCustomPropertyDeclarations`(design-audit.js:205)가 각 선언의 끝 위치를 함께 반환하도록 `endIndex: index + match[0].length`를 추가한다.
2. `auditSource`를 만들 때 `:root` 블록 범위와 함께 `declaredInCss`의 **모든 선언 범위**를 blank 목록에 넣는다.

블록 전체가 아니라 선언 범위만 제외하는 것이 중요하다. `.evidence-lab`의 `gap: 20px`, `padding: 26px`, `box-shadow: … rgba(0, 0, 0, 0.26)`는 계속 감사 대상이어야 한다.

오프셋 정합성은 확인했다. `sanitizedSource`는 `stripComments(cssSource)`(design-audit.js:729)이고 `stripComments`는 주석의 비개행 문자를 공백으로 치환하므로 길이가 보존된다. `declaredInCss`는 `cssSource`에서 파싱되지만(design-audit.js:738) 두 문자열의 인덱스 공간이 같으므로 `sanitizedSource`에 그 범위를 그대로 blank 처리할 수 있다.

`test-artifacts/server/static-asset-http-tests.mjs:89`가 `/scripts/design-audit.js`를 참조하지만 정적 서빙 403 확인이므로 내용 변경과 무관하다.

## 검증

1. **픽셀 회귀 (자동 생성 하네스).** 위 표의 치환 목록에서 브라우저 검증 페이지를 생성해, 각 교체 값의 계산 결과를 원래 리터럴과 캔버스 합성 후 바이트 비교한다. 예외 5곳(5004, 5048, 5084, 4894, 4900)만 차이가 나야 하고 나머지 28곳은 전부 일치해야 한다. 예외 5곳은 차이가 예상 방향·크기인지 확인한다.
2. **감사 재실행.** `node scripts/design-audit.js --top 999`로 오집계 11건 소멸과 커버리지 상승 확인.
3. **테스트.** `npm test` 3124건 통과 유지.
4. **문법.** 중괄호 균형 및 주석 종료 확인.
5. **`color-mix` 지원 확인.** `CSS.supports('color', 'color-mix(in srgb, red 50%, transparent)')`가 대상 브라우저에서 true인지 확인. 이 프로젝트는 빌드 단계가 없어 폴리필·프리픽스 경로가 없으므로, 지원되지 않는 브라우저에서는 해당 선언이 무효화된다.

### 결과 (실측, 2026-07-26 구현 완료)

| 항목 | 시작 | 예상 | 본 작업 후 | **후속 포함 최종** | raw |
|---|---:|---:|---:|---:|---:|
| colors | 91.9% | ~97% | 96.1% | **97.1%** | 57 → 22 |
| radius | 92.9% | ~96% | 96.4% | **96.4%** | 10 → 5 |
| spacing (gap) | 87.8% | ~93% | 92.9% | **92.9%** | 19 → 11 |
| fontSize | 96.6% | 변화 없음 | 96.6% | **96.6%** | 7 → 7 |

raw 합계 93 → **45**. 정확 일치(`-> --token`) 제안은 소진됐다. `npm test` 3124 → **3219**건 통과.

본 작업 직후 colors가 예상 ~97%에 못 미친 이유는 색상 참조 크레딧이 `:root` 색상 토큰 이름으로 한정되어 `var(--evidence-*)`가 세어지지 않았기 때문이다. 후속 작업에서 이를 고쳐 97.1%가 됐다.

**후속 작업에서 새로 측정된 카테고리:** padding 24.8%(raw 112), margin 11.1%(raw 88). 이전에는 감사되지 않던 영역이다.

### 구현 중 발견해 함께 처리한 사항

1. **`parseCustomPropertyDeclarations`의 기존 버그.** 정규식이 `.btn--active:hover {` 같은 BEM 변형 클래스명을 선언으로 오인하고, 값 패턴 `[^;]+`가 중괄호를 넘어 뒤따르는 실제 선언까지 삼켰다. 원래는 오인된 "선언"이 쓰이지 않아 무해했지만, 선언 범위를 blank 처리하게 되면서 실제 선언을 감사에서 지우는 문제로 번졌다. 부정 룩비하인드 `(?<![\w-])`와 값 패턴 `[^;{}]+`로 고쳤다.

   선행 문자 화이트리스트(`(?<=[{;]|^)`)로 먼저 시도했으나 주석 바로 뒤 선언(`*/` 다음)을 놓쳐 `--mint-bg-trace`와 `--focus-ring`이 토큰 인벤토리에서 빠졌다. HEAD 버전과 출력을 나란히 비교해 잡았다.

2. **참조 크레딧이 이름 접두에 묶여 있던 문제.** `analyzeValueDeclarations`가 `var(--radius-` / `var(--space-` / `var(--fs-` 접두만 인정해, `--evidence-radius`·`--evidence-gap`이 크레딧을 못 받고 raw로 집계됐다. 매직 넘버를 토큰으로 바꾸는 리팩터링이 커버리지를 떨어뜨리는 것으로 보고되는 지표 역전이었다. `declaredInCss` 기준 판정으로 교체했다.

신규 토큰 22개(알파 노브 3개 포함), 치환 33곳. `styles.css` 순변경은 약 +25행이다.

## 후속 관찰 (이번 범위 밖)

### 처리 완료

- **✅ 감사 도구의 `--top` 기본값이 8이다.** 잘림 표시를 추가했다 — `... N more (raise --top to see all)`. 잘리지 않으면 붙이지 않는다. (`b4bbf02`)
- **✅ 색상 참조 크레딧이 `:root` 색상 토큰으로 한정된다.** `looksLikeColor`를 현대 색상 함수(`color-mix`·`color`·`oklch`·`oklab`·`lab`·`lch`·`hwb`·`light-dark`)까지 넓히고, 별칭 연쇄를 고정점까지 따라가는 `collectColorTokenNames`를 추가했다. 대체 토큰 **제안**은 `:root`로 한정한 채 뒀다 — 컴포넌트 스코프 토큰을 제안하면 그 컴포넌트 밖에서 해석되지 않는 값을 권하게 된다. colors refs 644 → 720. (`b4bbf02`)
- **✅ 감사 도구의 spacing 범위가 좁다.** `spacing`(gap)에 통합하지 않고 `padding`·`margin` 카테고리를 신설했다. 통합하면 92.9% → 약 48%로 떨어져 과거 기록과 비교가 끊기고, shorthand(`8px 12px`)는 단일 토큰에 매핑되지 않아 취급이 다르다. 논리 속성(`padding-block` 등)도 포함하며 `0`·`auto`는 키워드로 취급한다. **드러난 백로그: padding 24.8%(raw 112), margin 11.1%(raw 88).** (`60d22ac`)
- **✅ evidence 계조.** `#c6d4df`·`#b8c8d5`(텍스트)와 `#2a506a`·`#2a6385`(테두리)를 토큰으로 승격했다. 처음엔 hex 근접성 때문에 드리프트 쌍으로 봤으나 명암비가 단조 증가하는 분리된 단계임을 보여줬다. (`bb738c2`)

### 조사 결과 비이슈로 판명

- **`--text-muted` 값 불일치 — 비이슈.** 명암비를 계산해 보니 4개 값 전부 WCAG AAA(7:1)를 통과한다: 목업 `#b4c7d2` 10.98:1, `--muted` `#97afba` 8.35:1, `--tf-muted` `#a9b3c1` 9.03:1, `--evidence-muted` `#88a0b4` 7.03:1. 목업 주석의 "AA 통과: 13:1" 자체가 과장이었다(실측 10.98:1). 목업 값은 애초에 배포되지 않았고 기능적 영향이 없으므로 통합하면 렌더링만 바뀌고 접근성 이득은 0이다.
- **미완성 화이트 오버레이 래더 — 가설 기각.** 5개 값의 역할이 서로 다르다: 배경 3곳(0.02 L1093, 0.035 L1608, 0.12 L3626), **테두리** 1곳(0.05 L119), 그라디언트 스톱 1곳(0.18 L4698). "빠진 래더 스텝"이 아니라 역할이 다른 일회성 값들이다. 0.035는 `--surface-1`(0.03)/`--surface-2`(0.04) 사이라 오히려 드리프트에 가깝다.

### 도입 보류

- **감사 도구의 의도적 예외 표기(`/* design-audit-ignore */`).** 단발 리터럴이 50건이라 모두 주석을 달면 CSS가 50줄 길어진다. "의도적 단발"이 기본이라면 표기해야 하는 것은 예외가 아니라 방치된 하드코딩 쪽이다. 커버리지를 100%로 몰지 않는다면 준수 부담만 늘어난다.

### 남은 것

- **padding·margin 백로그.** padding raw 112건(62종) / margin raw 88건(38종). 반복이 많고 대체 토큰 제안이 유효하게 나오는 항목이 있다 — margin `8px`×10 → `--space-2`, `4px`×8 → `--space-1`, padding `16px`×8 → `--space-5`. shorthand는 `var(--space-2) var(--space-4)` 형태가 되므로 제안 로직이 통째로 매칭하지 못한다.
- **evidence 텍스트 계조의 순서.** `--evidence-text-2`(본문, 12.63:1)가 `--evidence-text-3`(히어로 리드, 11.15:1)보다 밝다. 보통 히어로 리드가 더 강조되므로 의도된 순서인지 불확실하다. 값은 보존했고 주석에 남겼다.
- **`#0a1928`·`#17324a`.** `#0a1928`(L5251 background)은 `--evidence-surface-sunken`(#091827)과 `--evidence-surface`(#0b1d2f) 사이라 드리프트로 보인다. `#17324a`(L5144)는 스코어 링의 미충전 트랙 색으로 고유 역할이라 단발로 두는 것이 맞다.
